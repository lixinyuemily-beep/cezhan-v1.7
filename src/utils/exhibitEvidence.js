import { getExhibitIntroduction, normalizeExhibitKeyText } from './exhibitFields';

const fieldLabels = {
  date: '年代',
  place: '地点',
  material: '材质',
  description: '介绍',
};

export function assessExhibitEvidence(exhibit) {
  const sources = (Array.isArray(exhibit.source_records) ? exhibit.source_records : []).filter(source =>
    source?.id && source?.label && source?.locator && source?.fields && typeof source.fields === 'object'
  );
  const conflicts = Object.entries(fieldLabels).flatMap(([key, label]) => {
    // Free-form descriptions may be complementary. Compare only explicitly structured facts.
    if (key === 'description') return [];
    const entries = sources.flatMap(source => normalizeExhibitKeyText(source.fields[key]) ? [{
      sourceId: source.id, label: source.label, locator: source.locator, value: source.fields[key],
    }] : []);
    const values = new Set(entries.map(entry => normalizeExhibitKeyText(entry.value)));
    return values.size > 1 ? [{ key, label, entries }] : [];
  });

  const description = sources.map(source => source.fields.description)
    .find(value => normalizeExhibitKeyText(value));
  const importedDescription = getExhibitIntroduction(exhibit) || exhibit.intro || exhibit.desc;
  const hasDescription = Boolean(normalizeExhibitKeyText(sources.length ? description : importedDescription));
  return {
    state: conflicts.length ? 'conflict' : hasDescription ? (sources.length ? 'available' : 'unlocated') : 'missing',
    sources,
    conflicts,
  };
}
