export const EXHIBIT_TEMPLATE_HEADERS = ['展品名称', '时间', '地点', '材质', '介绍', '图片', '其他'];

export function getExhibitName(exhibit) {
  return exhibit?.name || exhibit?.['展品名称'] || exhibit?.名称 || exhibit?.品名 || '';
}

export function getExhibitTime(exhibit) {
  return exhibit?.time || exhibit?.era || exhibit?.['时间'] || exhibit?.年代 || exhibit?.时代 || '';
}

export function getExhibitPlace(exhibit) {
  return exhibit?.place || exhibit?.['地点'] || exhibit?.origin || exhibit?.出土地 || exhibit?.产地 || exhibit?.来源 || '';
}

export function getExhibitMaterial(exhibit) {
  return exhibit?.material || exhibit?.mat || exhibit?.['材质'] || '';
}

export function getExhibitIntroduction(exhibit) {
  return exhibit?.introduction || exhibit?.description || exhibit?.['介绍'] || exhibit?.描述 || exhibit?.简介 || '';
}

export function getExhibitImage(exhibit) {
  return getExhibitThumbnailUrl(exhibit);
}

export function normalizeImageUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith('//')) return `${window.location.protocol}${url}`;
  return url;
}

export function getExhibitFullImageUrl(exhibit) {
  return normalizeImageUrl(exhibit?.image_url || exhibit?.image || exhibit?.['图片'] || exhibit?.thumbnail_url || '');
}

export function getExhibitThumbnailUrl(exhibit) {
  return normalizeImageUrl(exhibit?.thumbnail_url || exhibit?.image_url || exhibit?.image || exhibit?.['图片'] || '');
}

export function getExhibitOther(exhibit) {
  return exhibit?.other || exhibit?.size || exhibit?.sz || exhibit?.['其他'] || exhibit?.尺寸 || '';
}

export function normalizeExhibitText(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function getExhibitDeduplicationKey(exhibit = {}) {
  return [
    getExhibitName(exhibit),
    getExhibitTime(exhibit),
    getExhibitPlace(exhibit),
    getExhibitMaterial(exhibit),
    getExhibitIntroduction(exhibit),
    getExhibitFullImageUrl(exhibit),
    getExhibitOther(exhibit),
  ].map(normalizeExhibitText).join('|');
}

export function deduplicateExhibits(exhibits = []) {
  const seenKeys = new Set();
  const uniqueExhibits = [];
  let duplicateCount = 0;

  exhibits.forEach((exhibit) => {
    const key = getExhibitDeduplicationKey(exhibit);
    if (seenKeys.has(key)) {
      duplicateCount += 1;
      return;
    }
    seenKeys.add(key);
    uniqueExhibits.push(exhibit);
  });

  return {
    uniqueExhibits,
    duplicateCount,
  };
}

export function getExhibitSearchText(exhibit = {}) {
  return [
    exhibit?.id,
    getExhibitName(exhibit),
    getExhibitTime(exhibit),
    getExhibitPlace(exhibit),
    getExhibitMaterial(exhibit),
    getExhibitIntroduction(exhibit),
    getExhibitOther(exhibit),
    getExhibitFullImageUrl(exhibit),
  ].map(normalizeExhibitText).filter(Boolean).join(' ');
}

export function getSearchKeywords(search = '') {
  return normalizeExhibitText(search).split(' ').filter(Boolean);
}

export function isStructureOnlyUnit(unit = {}) {
  return unit?.tag === '序章' || unit?.tag === '尾声';
}

export function normalizeImportedExhibit(exhibit = {}) {
  const name = String(getExhibitName(exhibit) || '').trim();
  const time = String(getExhibitTime(exhibit) || '').trim();
  const place = String(getExhibitPlace(exhibit) || '').trim();
  const material = String(getExhibitMaterial(exhibit) || '').trim();
  const introduction = String(getExhibitIntroduction(exhibit) || '').trim();
  const imageUrl = getExhibitFullImageUrl(exhibit);
  const thumbnailUrl = getExhibitThumbnailUrl(exhibit) || imageUrl;
  const other = String(getExhibitOther(exhibit) || '').trim();

  return {
    ...exhibit,
    name,
    time,
    place,
    material,
    introduction,
    image_url: imageUrl,
    thumbnail_url: thumbnailUrl,
    other,
    // 兼容项目里仍有部分旧逻辑读取旧字段名
    era: time,
    description: introduction,
    size: other,
  };
}

export function normalizePreviewExhibit(exhibit = {}) {
  const normalized = normalizeImportedExhibit(exhibit);
  const imageUrl = getExhibitFullImageUrl(normalized) || getExhibitThumbnailUrl(normalized);
  const thumbnailUrl = getExhibitThumbnailUrl(normalized) || imageUrl;
  const confidence = Number(exhibit?.confidence ?? exhibit?.stars ?? normalized.confidence ?? 4) || 4;

  return {
    ...normalized,
    image_url: imageUrl,
    thumbnail_url: thumbnailUrl,
    era: getExhibitTime(normalized),
    mat: getExhibitMaterial(normalized),
    sz: getExhibitOther(normalized),
    stars: confidence,
    confidence,
  };
}

export function normalizePreviewExhibitGroups(exhibitGroups = {}, units = []) {
  if (!exhibitGroups || typeof exhibitGroups !== 'object') return {};

  const normalizedGroups = {};
  const consumedKeys = new Set();
  const regularUnits = units
    .map((unit, index) => ({ unit, index }))
    .filter(({ unit }) => !isStructureOnlyUnit(unit));

  const normalizeList = (value) => (
    Array.isArray(value) ? value.map(normalizePreviewExhibit) : null
  );

  const writeGroup = (targetKey, sourceKey) => {
    if (!targetKey && targetKey !== 0) return;
    const list = normalizeList(exhibitGroups[sourceKey]);
    if (!list) return;
    normalizedGroups[String(targetKey)] = list;
    consumedKeys.add(String(sourceKey));
  };

  units.forEach((unit, index) => {
    const unitKey = unit?.id ?? unit?.unit_id ?? index;
    [unit?.id, unit?.unit_id].forEach((candidateKey) => {
      if (candidateKey !== undefined && candidateKey !== null && !normalizedGroups[String(unitKey)]) {
        writeGroup(unitKey, String(candidateKey));
      }
    });
  });

  regularUnits.forEach(({ unit, index }, regularIndex) => {
    const unitKey = unit?.id ?? unit?.unit_id ?? index;
    const numericKey = String(regularIndex);
    if (!normalizedGroups[String(unitKey)]) {
      writeGroup(unitKey, numericKey);
    } else if (Array.isArray(exhibitGroups[numericKey])) {
      consumedKeys.add(numericKey);
    }
  });

  if (Array.isArray(exhibitGroups._leftovers)) {
    normalizedGroups._leftovers = exhibitGroups._leftovers.map(normalizePreviewExhibit);
    consumedKeys.add('_leftovers');
  }

  Object.entries(exhibitGroups).forEach(([key, value]) => {
    if (consumedKeys.has(key) || normalizedGroups[key]) return;
    const list = normalizeList(value);
    if (list) normalizedGroups[key] = list;
  });

  return normalizedGroups;
}

export function hasMeaningfulExhibitData(exhibit = {}) {
  return [
    getExhibitName(exhibit),
    getExhibitTime(exhibit),
    getExhibitPlace(exhibit),
    getExhibitMaterial(exhibit),
    getExhibitIntroduction(exhibit),
    getExhibitImage(exhibit),
    getExhibitOther(exhibit),
  ].some((value) => String(value || '').trim() !== '');
}

export function getIncompleteExhibitFields(exhibit = {}) {
  const mapping = [
    ['展品名称', getExhibitName(exhibit)],
    ['时间', getExhibitTime(exhibit)],
    ['地点', getExhibitPlace(exhibit)],
    ['材质', getExhibitMaterial(exhibit)],
    ['介绍', getExhibitIntroduction(exhibit)],
    ['图片', getExhibitImage(exhibit)],
  ];

  return mapping
    .filter(([, value]) => String(value || '').trim() === '')
    .map(([label]) => label);
}

export function isIncompleteExhibit(exhibit = {}) {
  return hasMeaningfulExhibitData(exhibit) && getIncompleteExhibitFields(exhibit).length > 0;
}
