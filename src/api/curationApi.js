import { api } from './client';
import { retryAsync } from '../utils/retry';
import {
  getExhibitIntroduction,
  getExhibitMaterial,
  getExhibitName,
  getExhibitOther,
  getExhibitPlace,
  getExhibitTime,
} from '../utils/exhibitFields';

export async function generateCurationOutline(params) {
  if (!params || !params.exhibits || params.exhibits.length === 0) {
    return {
      success: false,
      error: "请先上传展品清单",
    };
  }

  try {
    const exhibitInfo = params.exhibits
      .slice(0, 20)
      .map(ex => `${getExhibitName(ex) || '未知'} (${getExhibitTime(ex)} ${getExhibitPlace(ex)} ${getExhibitMaterial(ex)} ${getExhibitOther(ex)})`)
      .join('、');

    const result = await api.ai.generateNarrative({
      theme: String(params.exhibition_title || "").trim(),
      exhibit_count: params.exhibits.length,
      exhibit_info: exhibitInfo,
      additional_intent: params.additional_intent || "",
      narrative_rhythm: params.narrative_rhythm || null,
      unit_count: params.advanced_settings?.unitCount || 3,
      temperature: params.advanced_settings?.temperature || 0.9,
    });

    const options = (result.options || []).map((opt, i) => ({
      label: `方案 ${String.fromCharCode(65 + i)}`,
      title: opt.title || "",
      logic: opt.desc || "",
    }));

    return {
      success: true,
      data: {
        narrative: options[0] || { title: "默认方案", logic: "" },
        narrativeOptions: options,
        units: [],
        textSections: [],
        exhibitRecommendations: [],
      },
    };
  } catch (error) {
    console.error("=== API 调用失败 ===", error);
    return {
      success: false,
      error: error.message || "生成失败",
    };
  }
}

export async function recommendExhibitsToUnits(units, exhibits, narrative) {
  if (!units || units.length === 0 || !exhibits || exhibits.length === 0) {
    return {
      success: false,
      error: "参数不完整",
    };
  }

  try {
    const allRecommendations = {};

    const exhibitsPerUnit = Math.ceil(exhibits.length / units.length);
    let exhibitIndex = 0;

    for (const unit of units) {
      const unitExhibits = [];
      for (let i = 0; i < exhibitsPerUnit && exhibitIndex < exhibits.length; i++) {
        const ex = exhibits[exhibitIndex];
        unitExhibits.push({
          name: getExhibitName(ex),
          time: getExhibitTime(ex),
          era: getExhibitTime(ex),
          place: getExhibitPlace(ex),
          mat: getExhibitMaterial(ex),
          material: getExhibitMaterial(ex),
          sz: getExhibitOther(ex),
          other: getExhibitOther(ex),
          introduction: getExhibitIntroduction(ex),
          id: ex.编号 || ex.id || '',
          stars: 5,
          ctx: "用户上传",
          src: "用户上传",
          kept: true,
        });
        exhibitIndex++;
      }
      allRecommendations[unit.id] = unitExhibits;
    }

    return {
      success: true,
      data: {
        exhibitRecommendations: allRecommendations,
      },
    };
  } catch (error) {
    console.error("=== 展品分配失败 ===", error);
    return {
      success: false,
      error: error.message || "分配失败",
    };
  }
}

export async function generateUnitStructure(params) {
  if (!params || params.selectedNarrative === undefined || params.selectedNarrative === null || !params.exhibits) {
    return {
      success: false,
      error: "参数不完整",
    };
  }

  try {
    const narrative = params.narrativeOptions?.[params.selectedNarrative] || { title: "", desc: "" };
    const itemsPerUnitMin = Number(params.advanced_settings?.itemsPerUnitMin ?? 5);
    const itemsPerUnitMax = Number(params.advanced_settings?.itemsPerUnitMax ?? params.advanced_settings?.itemsPerUnit ?? 10);

    const exhibitList = params.exhibits.map(ex => ({
      name: getExhibitName(ex),
      time: getExhibitTime(ex),
      place: getExhibitPlace(ex),
      material: getExhibitMaterial(ex),
      other: getExhibitOther(ex),
      introduction: getExhibitIntroduction(ex),
    }));

    const result = await retryAsync(
      () => api.ai.generateUnits({
        narrative: narrative,
        exhibit_count: params.exhibits.length,
        unit_count: params.advanced_settings?.unitCount || 3,
        exhibit_list: exhibitList,
        narrative_rhythm: params.narrative_rhythm || null,
      }),
      {
        label: 'generate units',
        retries: 2,
        delayMs: 1800,
        shouldRetryResult: (response) => !Array.isArray(response?.units) || response.units.length === 0,
      }
    );

    const units = (result.units || []).map((u, i) => {
      const tag = u.tag || `第${i + 1}单元`;
      const isStructureOnlyUnit = tag === '序章' || tag === '尾声';
      const narrativeText = String(u.narrative || u.desc || u.description || '').trim();
      const descriptionText = String(u.description || u.desc || u.narrative || '').trim();
      return {
        id: i,
        tag,
        tagColor: "#2B5F8E",
        title: u.title || `单元 ${i + 1}`,
        desc: narrativeText,
        narrative: narrativeText,
        description: descriptionText,
        itemsMin: isStructureOnlyUnit ? 0 : itemsPerUnitMin,
        itemsMax: isStructureOnlyUnit ? 0 : itemsPerUnitMax,
        items: isStructureOnlyUnit ? 0 : itemsPerUnitMax,
      };
    });

    return {
      success: true,
      data: {
        units,
      },
    };
  } catch (error) {
    console.error("=== 单元生成失败 ===", error);
    const message = String(error?.message || "").trim();
    return {
      success: false,
      error: message || "单元结构生成失败，请重试",
    };
  }
}
