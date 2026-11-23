import { getExhibitName, normalizeExhibitKeyText } from './exhibitFields';

const keyOf = exhibit => {
  const id = exhibit.id ?? exhibit.编号 ?? exhibit.register_num;
  return id != null && String(id).trim()
    ? `id:${id}` : `name:${normalizeExhibitKeyText(getExhibitName(exhibit))}`;
};

export const snapshotExhibits = exhibits => (exhibits || [])
  .map(exhibit => ({ key: keyOf(exhibit), name: getExhibitName(exhibit) }))
  .filter(item => item.key !== 'name:');

export function exhibitImpact(section, exhibits) {
  const next = snapshotExhibits(exhibits);
  const before = section.exhibitContext;
  if (!Array.isArray(before)) return { next, added: [], removed: [] };
  const beforeKeys = new Set(before.map(item => item.key));
  const nextKeys = new Set(next.map(item => item.key));
  return {
    next,
    added: next.filter(item => !beforeKeys.has(item.key)),
    removed: before.filter(item => !nextKeys.has(item.key)),
  };
}

export function removeObsoleteDescriptions(descriptions, removed, next) {
  const activeNames = new Set(next.map(item => normalizeExhibitKeyText(item.name)));
  const removedKeys = new Set(removed.map(item => item.key));
  const removedNames = new Set(removed.map(item => normalizeExhibitKeyText(item.name)));
  return (descriptions || []).filter(item => {
    if (item.entryKey && removedKeys.has(`id:${item.entryKey}`)) return false;
    const name = normalizeExhibitKeyText(item.name);
    return !removedNames.has(name) || activeNames.has(name);
  });
}

export function buildExhibitLocations(groups) {
  const locations = new Map();
  for (const group of groups) {
    for (const item of snapshotExhibits(group.exhibits)) {
      if (!locations.has(item.key)) locations.set(item.key, { ...item, units: [] });
      const entry = locations.get(item.key);
      if (!entry.units.some(unit => unit.key === group.key)) {
        entry.units.push({ key: group.key, title: group.title });
      }
    }
  }
  return locations;
}

export function findReferenceChanges(references, locations) {
  return (references || []).flatMap(reference => {
    const current = locations.get(reference.key);
    const units = current?.units || [];
    const previous = reference.units || [];
    const unchanged = previous.length === units.length && previous.every(old =>
      units.some(unit => unit.key === old.key && unit.title === old.title)
    );
    return unchanged ? [] : [{ reference, current, previous, units }];
  });
}
