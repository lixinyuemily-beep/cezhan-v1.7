import { useState } from 'react';
import { STEPS } from '../constants/theme';
import { Card, Btn } from '../components/ui';
import { api } from '../api/client';

const RHYTHM_PRESET_LABELS = {
  steady: '平稳铺陈',
  rise: '渐进抬升',
  dramatic: '跌宕起伏',
  release: '蓄势递进',
  custom: '自定义节奏',
};

const RHYTHM_PREVIEW_WIDTH = 280;
const RHYTHM_PREVIEW_HEIGHT = 96;
const RHYTHM_PREVIEW_PADDING_X = 16;
const RHYTHM_PREVIEW_PADDING_Y = 14;
const RHYTHM_BASELINE = 50;

const VERSION_TYPE_LABELS = {
  original: '初始生成',
  revision: '过程修改',
  final: '最终确定',
};

const VERSION_SOURCE_LABELS = {
  project_create: '创建项目',
  project_update: '保存编辑',
  project_complete: '完成项目',
};

const VERSION_FIELD_LABELS = {
  title: '项目标题',
  theme: '展览主题',
  narrative: '叙事方向',
  narrative_options: '叙事方案',
  selected_narrative: '选中叙事',
  llm_params: '生成参数',
  step: '当前步骤',
  status: '项目状态',
  exhibit_count: '展品数量',
  exhibition_title: '展览标题',
  uploaded_exhibits: '上传展品',
  units: '展览单元',
  kept_exhibits: '保留展品',
  text_sections: '策展文本',
  exhibit_confirmations: '展品确认',
  time: '最近编辑时间',
};

export const PageP0 = ({
  projects,
  completedProjects,
  navigateTo,
  openProject,
  createNewProject,
  setProjects,
  setCompletedProjects,
  showToast,
  refreshProjects,
  setCurrentStep,
  setCurrentPage,
  isLoggedIn,
  theme,
}) => {
  const C = theme;
  const [viewingProject, setViewingProject] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [loadingProject, setLoadingProject] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const [loadingHistoryId, setLoadingHistoryId] = useState(null);

  const getProjectActionId = (project) => project?.id || project?.projectId || project?.project_id || '';
  const isLoadingProject = (project) => {
    const actionId = getProjectActionId(project);
    return Boolean(actionId) && loadingProject === actionId;
  };
  const isLoadingHistory = (project) => {
    const actionId = getProjectActionId(project);
    return Boolean(actionId) && loadingHistoryId === actionId;
  };
  const isDeletingProject = (project) => {
    const actionId = getProjectActionId(project);
    return Boolean(actionId) && deletingId === actionId;
  };

  const getCreativityLabel = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '未记录';
    const temperature = Number(value);
    if (temperature < 0.5) return '保守';
    if (temperature > 0.8) return '创意';
    return '平衡';
  };

  const getRhythmPreviewPoints = (points = []) => {
    if (!points.length) return [];
    const plotWidth = RHYTHM_PREVIEW_WIDTH - RHYTHM_PREVIEW_PADDING_X * 2;
    const plotHeight = RHYTHM_PREVIEW_HEIGHT - RHYTHM_PREVIEW_PADDING_Y * 2;
    return points.map((value, index) => {
      const x = RHYTHM_PREVIEW_PADDING_X + (index / Math.max(points.length - 1, 1)) * plotWidth;
      const y = RHYTHM_PREVIEW_HEIGHT - RHYTHM_PREVIEW_PADDING_Y - (Number(value) / 100) * plotHeight;
      return { x, y };
    });
  };

  const formatVersionTime = (value) => {
    if (!value) return '未记录时间';
    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return value;
    }
  };

  const getStepText = (step) => {
    const stepNumber = Number(step);
    if (!stepNumber) return '未记录步骤';
    return `Step ${stepNumber}：${STEPS[stepNumber - 1] || '项目流程'}`;
  };

  const getNarrativeText = (value) => {
    if (value == null || value === '') return '未选择';
    if (typeof value === 'number') return `第 ${value + 1} 个方案`;
    if (typeof value === 'object') return value.title || value.label || value.name || '已选择方案';
    return String(value);
  };

  const getUnitTitle = (unit, index) => {
    const tag = String(unit?.tag || '').trim();
    const title = String(unit?.title || '').trim();
    if (tag && title) return `${tag}「${title}」`;
    return title || tag || `第 ${index + 1} 个单元`;
  };

  const getUnitNarrative = (unit) => String(unit?.narrative || unit?.desc || unit?.description || '').trim();

  const getSectionTitle = (section) => {
    if (section?.title) return section.title;
    if (section?.key === 'preface') return '展览序言';
    if (section?.key === 'epilogue') return '展览尾声';
    return `第 ${Number(section?.key) + 1 || ''} 段文本`;
  };

  const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  const describeTextChange = (before = '', after = '') => {
    const beforeText = stripHtml(before);
    const afterText = stripHtml(after);
    if (!beforeText && afterText) return '新增文案';
    if (beforeText && !afterText) return '清空文案';
    if (beforeText === afterText) return '';
    return `文案已修改（${beforeText.length} 字 → ${afterText.length} 字）`;
  };

  const getCountLabel = (value, unit = '项') => {
    if (Array.isArray(value)) return `${value.length} ${unit}`;
    if (value && typeof value === 'object') return `${Object.keys(value).length} ${unit}`;
    return `0 ${unit}`;
  };

  const getVersionStepLabel = (version) => {
    const snapshot = version?.snapshot || {};
    const previous = version?.previous_snapshot || {};
    const changedFields = Array.isArray(version?.changed_fields) ? version.changed_fields : [];
    if (changedFields.includes('text_sections')) return getStepText(4);
    if (changedFields.includes('kept_exhibits') || changedFields.includes('exhibit_confirmations')) return getStepText(3);
    if (changedFields.includes('units')) return getStepText(2);
    if (changedFields.includes('selected_narrative') || changedFields.includes('narrative') || changedFields.includes('narrative_options')) return getStepText(1);
    return getStepText(snapshot.step || previous.step);
  };

  const getVersionOperation = (version) => {
    const type = version?.snapshot_type;
    if (type === 'original') return '创建项目，保存初始生成结果';
    if (type === 'final') return '完成项目，保存最终确认结果';
    const changedFields = Array.isArray(version?.changed_fields) ? version.changed_fields : [];
    if (changedFields.includes('text_sections')) return '审核并编辑策展文本';
    if (changedFields.includes('kept_exhibits') || changedFields.includes('exhibit_confirmations')) return '确认或调整展品推荐';
    if (changedFields.includes('units') && changedFields.includes('step')) return '确认单元结构并进入展品分配';
    if (changedFields.includes('units')) return '编辑单元结构';
    if (changedFields.includes('selected_narrative') || changedFields.includes('narrative')) return '选择叙事方向并生成单元结构';
    if (changedFields.includes('llm_params') || changedFields.includes('uploaded_exhibits')) return '调整生成参数或展品清单';
    if (changedFields.includes('step')) return '推进项目流程';
    if (!changedFields.length) return '保存编辑后的项目状态';
    return `更新${changedFields.map(field => VERSION_FIELD_LABELS[field] || field).join('、')}`;
  };

  const getVersionChangeDetails = (version) => {
    const snapshot = version?.snapshot || {};
    const previous = version?.previous_snapshot || {};
    const changedFields = Array.isArray(version?.changed_fields) ? version.changed_fields : [];
    const details = [];

    if (version?.snapshot_type === 'original') {
      details.push(`Step 1：创建项目，初始展品数为 ${snapshot.exhibit_count || snapshot.uploaded_exhibits?.length || 0} 件。`);
      if (snapshot.llm_params?.narrative_rhythm) {
        const rhythm = snapshot.llm_params.narrative_rhythm;
        details.push(`叙事节奏：${RHYTHM_PRESET_LABELS[rhythm.presetKey] || '自定义节奏'}。`);
      }
      return details;
    }

    if (version?.snapshot_type === 'final') {
      details.push(`Step 5：完成项目，保存最终确认结果。`);
      return details;
    }

    if (changedFields.includes('step') && previous.step !== snapshot.step) {
      details.push(`流程步骤：从 ${getStepText(previous.step)} 进入 ${getStepText(snapshot.step)}。`);
    }

    if (changedFields.includes('title') && previous.title !== snapshot.title) {
      details.push(`项目标题：从「${previous.title || '未命名'}」改为「${snapshot.title || '未命名'}」。`);
    }

    if (changedFields.includes('exhibition_title') && previous.exhibition_title !== snapshot.exhibition_title) {
      details.push(`展览标题：从「${previous.exhibition_title || '未填写'}」改为「${snapshot.exhibition_title || '未填写'}」。`);
    }

    if (changedFields.includes('selected_narrative') && previous.selected_narrative !== snapshot.selected_narrative) {
      details.push(`Step 1：叙事方向从「${getNarrativeText(previous.selected_narrative)}」改为「${getNarrativeText(snapshot.selected_narrative)}」。`);
    }

    if (changedFields.includes('narrative')) {
      const beforeNarrative = getNarrativeText(previous.narrative);
      const afterNarrative = getNarrativeText(snapshot.narrative);
      if (beforeNarrative !== afterNarrative) {
        details.push(`Step 1：选定叙事方向「${afterNarrative}」。`);
      }
    }

    if (changedFields.includes('uploaded_exhibits')) {
      details.push(`Step 1：上传展品清单从 ${getCountLabel(previous.uploaded_exhibits, '件')} 调整为 ${getCountLabel(snapshot.uploaded_exhibits, '件')}。`);
    }

    if (changedFields.includes('llm_params')) {
      const beforeParams = previous.llm_params || {};
      const afterParams = snapshot.llm_params || {};
      if (beforeParams.additional_intent !== afterParams.additional_intent) {
        details.push(`Step 1：补充策展意图已修改。`);
      }
      const beforeRhythm = beforeParams.narrative_rhythm || {};
      const afterRhythm = afterParams.narrative_rhythm || {};
      if (beforeRhythm.presetKey !== afterRhythm.presetKey || beforeRhythm.enabled !== afterRhythm.enabled) {
        details.push(`Step 1：叙事节奏从「${RHYTHM_PRESET_LABELS[beforeRhythm.presetKey] || '未设置'}」改为「${RHYTHM_PRESET_LABELS[afterRhythm.presetKey] || '自定义节奏'}」。`);
      }
    }

    if (changedFields.includes('units')) {
      const beforeUnits = Array.isArray(previous.units) ? previous.units : [];
      const afterUnits = Array.isArray(snapshot.units) ? snapshot.units : [];
      if (beforeUnits.length !== afterUnits.length) {
        details.push(`Step 2：单元数量从 ${beforeUnits.length} 个调整为 ${afterUnits.length} 个。`);
      }
      afterUnits.forEach((unit, index) => {
        const beforeUnit = beforeUnits.find(item => item?.id && item.id === unit?.id) || beforeUnits[index];
        if (!beforeUnit) {
          details.push(`Step 2：新增${getUnitTitle(unit, index)}。`);
          return;
        }
        if (beforeUnit.title !== unit.title) {
          details.push(`Step 2：${unit.tag || `第 ${index + 1} 个单元`}标题从「${beforeUnit.title || '未命名'}」改为「${unit.title || '未命名'}」。`);
        }
        const beforeNarrative = getUnitNarrative(beforeUnit);
        const afterNarrative = getUnitNarrative(unit);
        if (beforeNarrative !== afterNarrative) {
          details.push(`Step 2：${getUnitTitle(unit, index)}的叙事定位已修改。`);
        }
        const beforeRange = `${beforeUnit.itemsMin ?? 0}-${beforeUnit.itemsMax ?? beforeUnit.items ?? 0}`;
        const afterRange = `${unit.itemsMin ?? 0}-${unit.itemsMax ?? unit.items ?? 0}`;
        if (beforeRange !== afterRange) {
          details.push(`Step 2：${getUnitTitle(unit, index)}的展品数量范围从 ${beforeRange} 件改为 ${afterRange} 件。`);
        }
      });
    }

    if (changedFields.includes('kept_exhibits')) {
      const beforeKept = previous.kept_exhibits || {};
      const afterKept = snapshot.kept_exhibits || {};
      const keys = Array.from(new Set([...Object.keys(beforeKept), ...Object.keys(afterKept)])).filter(key => key !== '_leftovers');
      keys.forEach((key) => {
        const beforeCount = Array.isArray(beforeKept[key]) ? beforeKept[key].length : 0;
        const afterCount = Array.isArray(afterKept[key]) ? afterKept[key].length : 0;
        if (beforeCount !== afterCount) {
          details.push(`Step 3：第 ${Number(key) + 1 || key} 个正文单元主推展品从 ${beforeCount} 件调整为 ${afterCount} 件。`);
        }
      });
      const beforeLeftovers = Array.isArray(beforeKept._leftovers) ? beforeKept._leftovers.length : 0;
      const afterLeftovers = Array.isArray(afterKept._leftovers) ? afterKept._leftovers.length : 0;
      if (beforeLeftovers !== afterLeftovers) {
        details.push(`Step 3：备选展品从 ${beforeLeftovers} 件调整为 ${afterLeftovers} 件。`);
      }
    }

    if (changedFields.includes('exhibit_confirmations')) {
      const beforeCount = Object.keys(previous.exhibit_confirmations || {}).length;
      const afterCount = Object.keys(snapshot.exhibit_confirmations || {}).length;
      if (beforeCount !== afterCount) {
        details.push(`Step 3：已确认单元从 ${beforeCount} 个变为 ${afterCount} 个。`);
      }
    }

    if (changedFields.includes('text_sections')) {
      const beforeSections = Array.isArray(previous.text_sections) ? previous.text_sections : [];
      const afterSections = Array.isArray(snapshot.text_sections) ? snapshot.text_sections : [];
      if (beforeSections.length !== afterSections.length) {
        details.push(`Step 4：策展文本从 ${beforeSections.length} 段变为 ${afterSections.length} 段。`);
      }
      afterSections.forEach((section, index) => {
        const beforeSection = beforeSections.find(item => String(item?.key) === String(section?.key)) || beforeSections[index];
        if (!beforeSection) {
          details.push(`Step 4：新增「${getSectionTitle(section)}」文案。`);
          return;
        }
        const textChange = describeTextChange(beforeSection.text, section.text);
        if (textChange) {
          details.push(`Step 4：「${getSectionTitle(section)}」${textChange}。`);
        }
      });
    }

    if (!details.length && changedFields.length) {
      details.push(`本次保存更新了：${changedFields.map(field => VERSION_FIELD_LABELS[field] || field).join('、')}。`);
    }

    return details.slice(0, 8);
  };

  const getVersionSnapshotMeta = (version) => {
    const snapshot = version?.snapshot || {};
    const step = snapshot.step ? `Step ${snapshot.step}` : null;
    const textCount = Array.isArray(snapshot.text_sections) ? `${snapshot.text_sections.length} 段文本` : null;
    const unitCount = Array.isArray(snapshot.units) ? `${snapshot.units.length} 个单元` : null;
    const exhibitCount = Array.isArray(snapshot.uploaded_exhibits)
      ? `${snapshot.uploaded_exhibits.length} 件展品`
      : (snapshot.exhibit_count ? `${snapshot.exhibit_count} 件展品` : null);
    return [step, unitCount, textCount, exhibitCount].filter(Boolean).join(' · ');
  };

  const handleViewHistory = async (project) => {
    const actionId = getProjectActionId(project);
    if (!actionId) {
      showToast?.('项目缺少有效 ID，无法加载修改历史', 'error');
      return;
    }
    setLoadingHistoryId(actionId);
    setHistoryModal({
      project,
      versions: [],
      loading: true,
      error: '',
    });

    try {
      const versions = await api.projects.versions(actionId);
      setHistoryModal({
        project,
        versions: Array.isArray(versions) ? versions : [],
        loading: false,
        error: '',
      });
    } catch (error) {
      console.error('加载修改历史失败:', error);
      setHistoryModal({
        project,
        versions: [],
        loading: false,
        error: error.message || '加载修改历史失败',
      });
    } finally {
      setLoadingHistoryId(null);
    }
  };

  const handleCloseHistory = () => {
    setHistoryModal(null);
    setLoadingHistoryId(null);
  };

  const renderSetupContent = (project) => {
    const llmParams = project?.llmParams || {};
    const advancedSettings = llmParams.advanced_settings || {};
    const temperature = advancedSettings.temperature;
    const hasTemperature = temperature != null && !Number.isNaN(Number(temperature));
    const creativityPercent = hasTemperature ? Math.round(((Number(temperature) - 0.1) / 0.9) * 100) : 0;
    const rhythm = llmParams.narrative_rhythm || null;
    const rhythmEnabled = rhythm?.enabled !== false;
    const rhythmPoints = Array.isArray(rhythm?.points) ? rhythm.points : [];
    const previewPoints = getRhythmPreviewPoints(rhythmPoints);
    const rhythmPath = previewPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const baselineY = RHYTHM_PREVIEW_HEIGHT - RHYTHM_PREVIEW_PADDING_Y - (RHYTHM_BASELINE / 100) * (RHYTHM_PREVIEW_HEIGHT - RHYTHM_PREVIEW_PADDING_Y * 2);
    const rhythmLabel = rhythm
      ? (rhythmEnabled ? (RHYTHM_PRESET_LABELS[rhythm.presetKey] || '自定义节奏') : '已关闭，AI 自主发挥')
      : '未记录';

    return (
      <div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.25fr)",
          gap: 14,
        }}>
          <div style={{
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 14,
            background: C.bgSecondary,
          }}>
            <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 6 }}>AI 创意程度</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: C.accentPrimary }}>
                {hasTemperature ? Number(temperature).toFixed(1) : '--'}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.accentSecondary }}>
                {getCreativityLabel(temperature)}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: C.sliderTrack || C.border, overflow: "hidden" }}>
              <div style={{
                width: `${Math.min(Math.max(creativityPercent, 0), 100)}%`,
                height: "100%",
                borderRadius: 999,
                background: C.accentPrimary,
              }} />
            </div>
            <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 8 }}>
              影响 AI 生成时的发散程度，数值越高越偏创意表达。
            </div>
          </div>

          <div style={{
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 14,
            background: C.bgSecondary,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>叙事节奏</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: rhythmEnabled ? C.textPrimary : C.textSecondary }}>
                  {rhythmLabel}
                </div>
              </div>
              <span style={{
                alignSelf: "flex-start",
                border: `1px solid ${rhythmEnabled ? C.accentPrimary : C.border}`,
                borderRadius: 999,
                padding: "3px 8px",
                color: rhythmEnabled ? C.accentPrimary : C.textSecondary,
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}>
                {rhythm ? (rhythmEnabled ? '已启用' : '已关闭') : '未记录'}
              </span>
            </div>

            {previewPoints.length > 0 ? (
              <svg
                width="100%"
                viewBox={`0 0 ${RHYTHM_PREVIEW_WIDTH} ${RHYTHM_PREVIEW_HEIGHT}`}
                role="img"
                aria-label="叙事节奏预览"
                style={{ display: "block", marginTop: 4 }}
              >
                <line
                  x1={RHYTHM_PREVIEW_PADDING_X}
                  x2={RHYTHM_PREVIEW_WIDTH - RHYTHM_PREVIEW_PADDING_X}
                  y1={baselineY}
                  y2={baselineY}
                  stroke={C.accentSecondary}
                  strokeDasharray="6 5"
                  strokeWidth="1.5"
                  opacity={rhythmEnabled ? 0.75 : 0.4}
                />
                <text
                  x={RHYTHM_PREVIEW_WIDTH - RHYTHM_PREVIEW_PADDING_X - 2}
                  y={baselineY - 5}
                  textAnchor="end"
                  style={{ fontSize: 9, fill: C.accentSecondary, fontWeight: 700 }}
                >
                  基线 50
                </text>
                <path
                  d={rhythmPath}
                  fill="none"
                  stroke={rhythmEnabled ? C.accentPrimary : C.textSecondary}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={rhythmEnabled ? 1 : 0.45}
                />
                {previewPoints.map((point, index) => (
                  <circle
                    key={`${point.x}-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r="3.5"
                    fill="#fff"
                    stroke={rhythmEnabled ? C.accentPrimary : C.textSecondary}
                    strokeWidth="2"
                    opacity={rhythmEnabled ? 1 : 0.55}
                  />
                ))}
              </svg>
            ) : (
              <div style={{ fontSize: 12, color: C.textPlaceholder, padding: "18px 0" }}>
                暂无叙事节奏记录
              </div>
            )}

            <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.6, marginTop: 6 }}>
              {rhythm?.summary || (rhythmEnabled ? '用于控制叙事方案、单元结构和文案语气。' : '关闭后生成不受节奏曲线约束。')}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleContinueEdit = async (project) => {
    const actionId = getProjectActionId(project);
    if (!actionId) {
      showToast?.('项目缺少有效 ID，无法打开', 'error');
      return;
    }
    setLoadingProject(actionId);
    try {
      let enrichedProject = null;
      
      let fullProject = null;
      try {
        fullProject = await api.projects.get(actionId);
      } catch (e) {
        // 项目可能已完成
      }
      
      if (fullProject) {
        enrichedProject = {
          ...project,
          _fromApi: true,
          step: fullProject.step || project.step,
          narrative: fullProject.narrative,
          narrativeOptions: fullProject.narrative_options,
          selectedNarrative: fullProject.selected_narrative ?? null,
          llmParams: fullProject.llm_params,
          exhibitionTitle: fullProject.exhibition_title,
          uploadedExhibits: fullProject.uploaded_exhibits,
          units: fullProject.units,
          keptExhibits: fullProject.kept_exhibits,
          textSections: fullProject.text_sections,
          exhibitConfirmations: fullProject.exhibit_confirmations,
        };
      } else {
        const completedProject = await api.projects.getCompleted(actionId);
        if (completedProject) {
          enrichedProject = {
            ...project,
            step: 5,
            narrative: completedProject.narrative,
            narrativeOptions: completedProject.narrative_options,
            selectedNarrative: completedProject.selected_narrative ?? null,
            llmParams: completedProject.llm_params,
            exhibitionTitle: completedProject.exhibition_title,
            uploadedExhibits: completedProject.uploaded_exhibits,
            units: completedProject.units,
            keptExhibits: completedProject.kept_exhibits,
            textSections: completedProject.text_sections,
          };
        }
      }
      
      if (enrichedProject) {
        const hasConfirmedNarrative =
          enrichedProject.selectedNarrative !== null &&
          enrichedProject.selectedNarrative !== undefined &&
          enrichedProject.narrative?.title;

        if (enrichedProject.step <= 1 || !hasConfirmedNarrative) {
          enrichedProject.step = 1;
          enrichedProject.selectedNarrative = null;
          enrichedProject.selected_narrative = null;
          enrichedProject.narrative = null;
          openProject(enrichedProject);
          showToast('请先选择一个叙事方向', 'info');
          setLoadingProject(null);
          return;
        }

        openProject(enrichedProject);
        setLoadingProject(null);
      } else {
        openProject(project);
        setLoadingProject(null);
      }
    } catch (error) {
      console.error('获取项目详情失败:', error);
      openProject(project);
      setLoadingProject(null);
    }
  };

  const handleViewOutline = async (project) => {
    const actionId = getProjectActionId(project);
    if (!actionId) {
      showToast?.('项目缺少有效 ID，无法打开大纲', 'error');
      return;
    }
    setLoadingProject(actionId);
    try {
      const completedProject = await api.projects.getCompleted(actionId);
      if (completedProject) {
        const enrichedProject = {
          ...project,
          step: 5,
          narrative: completedProject.narrative,
          narrativeOptions: completedProject.narrative_options,
          selectedNarrative: completedProject.selected_narrative ?? null,
          llmParams: completedProject.llm_params,
          exhibitionTitle: completedProject.exhibition_title,
          uploadedExhibits: completedProject.uploaded_exhibits,
          exhibitConfirmations: completedProject.exhibit_confirmations,
          units: completedProject.units,
          keptExhibits: completedProject.kept_exhibits,
          textSections: completedProject.text_sections,
        };
        openProject(enrichedProject);
        setCurrentStep(5);
        setCurrentPage('step5');
      } else {
        showToast('项目不存在', 'error');
      }
    } catch (error) {
      console.error('获取项目详情失败:', error);
      showToast('加载失败', 'error');
    }
    setLoadingProject(null);
  };

  const handleViewProject = async (project) => {
    const actionId = getProjectActionId(project);
    if (!actionId) {
      showToast?.('项目缺少有效 ID，无法查看', 'error');
      return;
    }
    setLoadingProject(actionId);
    try {
      let enrichedProject = null;
      
      let fullProject = null;
      try {
        fullProject = await api.projects.get(actionId);
      } catch (e) {
        // 项目可能已完成，从进行中表删除
      }
      
      if (fullProject) {
        enrichedProject = {
          ...project,
          step: fullProject.step || project.step,
          narrative: fullProject.narrative,
          narrativeOptions: fullProject.narrative_options,
          selectedNarrative: fullProject.selected_narrative ?? null,
          llmParams: fullProject.llm_params,
          exhibitionTitle: fullProject.exhibition_title,
          uploadedExhibits: fullProject.uploaded_exhibits,
          exhibitConfirmations: fullProject.exhibit_confirmations,
          units: fullProject.units,
          keptExhibits: fullProject.kept_exhibits,
          textSections: fullProject.text_sections,
        };
      } else {
        const completedProject = await api.projects.getCompleted(actionId);
        if (completedProject) {
          enrichedProject = {
            ...project,
            step: 5,
            narrative: completedProject.narrative,
            narrativeOptions: completedProject.narrative_options,
            selectedNarrative: completedProject.selected_narrative ?? null,
            llmParams: completedProject.llm_params,
            exhibitionTitle: completedProject.exhibition_title,
            uploadedExhibits: completedProject.uploaded_exhibits,
            exhibitConfirmations: completedProject.exhibit_confirmations,
            units: completedProject.units,
            keptExhibits: completedProject.kept_exhibits,
            textSections: completedProject.text_sections,
          };
        }
      }
      
      if (enrichedProject) {
        setViewingProject(enrichedProject);
        setLoadingProject(null);
      } else {
        setViewingProject({ ...project, step: 5 });
        setLoadingProject(null);
      }
    } catch (error) {
      console.error('获取项目详情失败:', error);
      setViewingProject({ ...project, step: 5 });
      setLoadingProject(null);
    }
  };

  const handleCloseView = () => {
    setViewingProject(null);
    setLoadingProject(null);
  };

  const handleEditFromView = async (project) => {
    const actionId = getProjectActionId(project);
    if (!actionId) {
      showToast?.('项目缺少有效 ID，无法打开', 'error');
      return;
    }
    try {
      let fullProject = null;
      try {
        fullProject = await api.projects.get(actionId);
      } catch (e) {
        // 项目可能已完成，从已完成表获取
      }
      
      if (fullProject) {
        const enrichedProject = {
          ...project,
          step: fullProject.step || project.step,
          narrative: fullProject.narrative,
          narrativeOptions: fullProject.narrative_options,
          selectedNarrative: fullProject.selected_narrative ?? null,
          llmParams: fullProject.llm_params,
          exhibitionTitle: fullProject.exhibition_title,
          uploadedExhibits: fullProject.uploaded_exhibits,
          exhibitConfirmations: fullProject.exhibit_confirmations,
          units: fullProject.units,
          keptExhibits: fullProject.kept_exhibits,
          textSections: fullProject.text_sections,
        };
        openProject(enrichedProject);
        setCurrentStep(enrichedProject.step);
        setCurrentPage(`step${enrichedProject.step}`);
        setLoadingProject(null);
      } else {
        // 尝试从已完成项目表获取
        const completedProject = await api.projects.getCompleted(actionId);
        if (completedProject) {
          const enrichedProject = {
            ...project,
            step: 5,
            narrative: completedProject.narrative,
            narrativeOptions: completedProject.narrative_options,
            selectedNarrative: completedProject.selected_narrative ?? null,
            llmParams: completedProject.llm_params,
            exhibitionTitle: completedProject.exhibition_title,
            uploadedExhibits: completedProject.uploaded_exhibits,
            exhibitConfirmations: completedProject.exhibit_confirmations,
            units: completedProject.units,
            keptExhibits: completedProject.kept_exhibits,
            textSections: completedProject.text_sections,
          };
          openProject(enrichedProject);
          setCurrentStep(5);
          setCurrentPage('step5');
        } else {
          openProject({ ...project, step: 5 });
          setCurrentStep(5);
          setCurrentPage('step5');
        }
        setLoadingProject(null);
      }
    } catch (error) {
      console.error('获取项目详情失败:', error);
      openProject({ ...project, step: 5 });
      setCurrentStep(5);
      setCurrentPage('step5');
      setLoadingProject(null);
    }
    setViewingProject(null);
  };

  const handleDeleteClick = (project, e) => {
    e.stopPropagation();
    const actionId = getProjectActionId(project);
    if (!actionId) {
      showToast?.('项目缺少有效 ID，无法删除', 'error');
      return;
    }
    setDeleteModal({ id: actionId, title: project.title, isCompleted: project.step >= 5 });
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;

    setIsDeleting(true);
    setDeletingId(deleteModal.id);
    try {
      if (deleteModal.isCompleted) {
        try {
          await api.projects.deleteCompleted(deleteModal.id);
        } catch (e) {
          await api.projects.delete(deleteModal.id);
        }
      } else {
        await api.projects.delete(deleteModal.id);
      }
      showToast('项目已删除', 'success');
      setDeleteModal(null);
      setDeletingId(null);
      if (viewingProject?.id === deleteModal.id) {
        setViewingProject(null);
      }
      refreshProjects();
    } catch (error) {
      console.error('删除项目失败:', error);
      showToast('删除失败，请重试', 'error');
      setDeletingId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderStepContent = (project, step) => {
    switch (step) {
      case 1:
        const hasSelectedNarrative =
          project.selectedNarrative !== null &&
          project.selectedNarrative !== undefined &&
          project.narrative?.title;
        const selectedOption = hasSelectedNarrative ? project.narrativeOptions?.[project.selectedNarrative] : null;
        return (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>叙事方向</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>
              {selectedOption?.title || project.narrative?.title || '未设置'}
            </div>
            {selectedOption?.desc && (
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8 }}>
                {selectedOption.desc}
              </div>
            )}
            {selectedOption?.logic && (
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8 }}>
                {selectedOption.logic}
              </div>
            )}
            {project.llmParams && project.llmParams.exhibits && (
              <div style={{ fontSize: 12, color: C.textSecondary }}>
                展品数量: {project.llmParams.exhibits.length} 件
              </div>
            )}
            {project.narrativeOptions && project.narrativeOptions.length > 0 && (
              <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
                方案数量: {project.narrativeOptions.length}（{hasSelectedNarrative ? `已选择: ${project.selectedNarrative + 1}` : '尚未选择'}）
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>单元结构</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>
              {project.units?.length || 0} 个单元
            </div>
            {project.units && project.units.length > 0 && (
              <div style={{ fontSize: 12, color: C.textSecondary }}>
                {project.units.map((u, i) => (
                  <div key={i} style={{ marginTop: 4, paddingLeft: 8, borderLeft: `2px solid ${C.accentPrimary}44` }}>
                    {u.tag}: {u.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>展品筛选</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>
              {project.exhibitCount || 0} 件展品
            </div>
            {project.exhibitRecommendations && project.exhibitRecommendations.length > 0 && (
              <div style={{ fontSize: 12, color: C.textSecondary }}>
                <div>推荐展品: {project.exhibitRecommendations.length} 件</div>
              </div>
            )}
            {project.units && project.units.length > 0 && (
              <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 8 }}>
                {project.units.map((u, i) => (
                  <div key={i} style={{ marginTop: 4 }}>
                    {u.title}: {u.items || 0} 件
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>文本撰写</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>
              {project.textSections?.length || 0} 个文本段落
            </div>
            {project.textSections && project.textSections.length > 0 && (
              <div style={{ fontSize: 12, color: C.textSecondary }}>
                {project.textSections.map((s, i) => (
                  <div key={i} style={{ marginTop: 4, paddingLeft: 8, borderLeft: `2px solid ${s.edited ? C.humanEdited : C.aiGenerated}` }}>
                    {s.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 5:
        return (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>最终大纲</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>
              策展大纲已完成
            </div>
            {project.textSections && project.textSections.length > 0 && (
              <div style={{ fontSize: 12, color: C.textSecondary }}>
                <div>包含 {project.textSections.length} 个章节</div>
              </div>
            )}
            {project.units && project.units.length > 0 && (
              <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
                <div>共 {project.units.length} 个展览单元</div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main style={{ padding: "32px 36px 40px", maxWidth: 1280 }}>
      <section style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 20,
        padding: "24px 28px",
        borderRadius: 22,
        border: `1px solid ${C.border}`,
        background: `linear-gradient(135deg, ${C.bgElevated || C.bgSecondary} 0%, ${C.bgMuted || C.bgPrimary} 100%)`,
        boxShadow: C.shadowSm,
        marginBottom: 28,
      }}>
        <div>
          <div style={{ fontSize: 11, color: C.accentSecondary, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>
            CURATION WORKSPACE
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, margin: 0, fontFamily: "var(--font-serif)" }}>
            我的项目
          </h1>
          <div style={{ color: C.textSecondary, fontSize: 14, marginTop: 10, lineHeight: 1.7, maxWidth: 620 }}>
            在这里查看进行中的策展任务、已完成的大纲交付，以及每个项目在生成链路中的状态与关键配置。
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{
            padding: "10px 14px",
            borderRadius: 14,
            border: `1px solid ${C.border}`,
            background: C.bgElevated || C.bgSecondary,
            color: C.textSecondary,
            fontSize: 12,
            fontWeight: 600,
          }}>
            进行中 {projects.length} 个
          </div>
          <div style={{
            padding: "10px 14px",
            borderRadius: 14,
            border: `1px solid ${C.border}`,
            background: C.bgElevated || C.bgSecondary,
            color: C.textSecondary,
            fontSize: 12,
            fontWeight: 600,
          }}>
            已完成 {completedProjects.length} 个
          </div>
          <Btn onClick={() => createNewProject()} style={{ minWidth: 156 }}>+ 新建策展项目</Btn>
        </div>
      </section>

      <section style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>进行中</div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
              继续编辑、查看当前进度，或直接回到对应步骤。
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary, fontWeight: 600 }}>
            共 {projects.length} 个项目
          </div>
        </div>
        {projects.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 280px))", gap: 16 }}>
            {projects.map((p, i) => (
              <Card
                key={p.id || i}
                style={{
                  width: '100%',
                  overflow: "hidden",
                  borderColor: `${C.accentPrimary}18`,
                  background: C.bgElevated || C.bgSecondary,
                }}
              >
                <div style={{ height: 4, background: `linear-gradient(90deg, ${C.accentPrimary} 0%, ${C.accentSecondary} 100%)` }} />
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary, lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "var(--font-serif)" }}>
                        {p.title}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                    <span style={{ fontSize: 12, color: C.textSecondary, whiteSpace: "nowrap" }}>
                      当前阶段：<span style={{ color: C.textPrimary, fontWeight: 700 }}>{STEPS[Math.max(0, (p.step || 1) - 1)] || '新建策展'}</span>
                    </span>
                    <span style={{
                      color: C.accentPrimary,
                      fontWeight: 700,
                      fontSize: 11,
                      padding: "4px 9px",
                      borderRadius: 999,
                      background: `${C.accentPrimary}12`,
                      border: `1px solid ${C.accentPrimary}16`,
                      whiteSpace: "nowrap",
                    }}>
                      Step {p.step} / 5
                    </span>
                    <div style={{ flex: "1 1 72px", minWidth: 64, height: 6, background: C.stepInactive, borderRadius: 999, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(p.step / 5) * 100}%`,
                          background: `linear-gradient(90deg, ${C.accentPrimary} 0%, ${C.accentSecondary} 100%)`,
                          borderRadius: 999,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: C.textSecondary, whiteSpace: "nowrap" }}>
                      最近编辑：{p.time}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn small onClick={() => handleContinueEdit(p)} disabled={isLoadingProject(p)}>
                      {isLoadingProject(p) ? '加载中...' : '继续编辑'}
                    </Btn>
                    <Btn small variant="ghost" onClick={() => handleViewProject(p)} disabled={isLoadingProject(p)}>查看</Btn>
                    <Btn small variant="ghost" onClick={() => handleViewHistory(p)} disabled={isLoadingHistory(p)}>
                      {isLoadingHistory(p) ? '加载中...' : '修改历史'}
                    </Btn>
                    <Btn
                      small
                      variant="ghost"
                      onClick={(e) => handleDeleteClick(p, e)}
                      disabled={isDeletingProject(p)}
                      style={{ color: C.danger, borderColor: `${C.danger}26`, background: `${C.danger}08` }}
                    >
                      {isDeletingProject(p) ? '删除中...' : '删除'}
                    </Btn>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card style={{ padding: 28, background: C.bgElevated || C.bgSecondary }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, marginBottom: 8, fontFamily: "var(--font-serif)" }}>还没有进行中的项目</div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7, marginBottom: 16 }}>
              {isLoggedIn
                ? '新建一个策展任务后，这里会持续记录从叙事方向到完整大纲的进度变化。'
                : '当前为访客预览模式。登录后，这里只会显示你自己的进行中项目。'}
            </div>
            <Btn onClick={() => createNewProject()} style={{ minWidth: 132 }}>{isLoggedIn ? '开始新策展' : '预览新建流程'}</Btn>
          </Card>
        )}
      </section>

      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>已完成</div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
              查看完整大纲、回顾配置，或重新进入成果页进行导出。
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary, fontWeight: 600 }}>
            共 {completedProjects.length} 个项目
          </div>
        </div>
        {completedProjects.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 280px))", gap: 16 }}>
            {completedProjects.map((p, i) => (
              <Card
                key={p.id || i}
                style={{
                  width: '100%',
                  overflow: "hidden",
                  borderColor: `${C.success}1E`,
                  background: C.bgElevated || C.bgSecondary,
                }}
              >
                <div style={{ height: 4, background: `linear-gradient(90deg, ${C.success} 0%, ${C.accentSecondary} 100%)` }} />
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary, lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "var(--font-serif)" }}>
                        {p.title}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                    <span style={{ fontSize: 12, color: C.textSecondary, whiteSpace: "nowrap" }}>
                      当前阶段：<span style={{ color: C.textPrimary, fontWeight: 700 }}>完整大纲</span>
                    </span>
                    <span style={{
                      color: C.success,
                      fontWeight: 700,
                      fontSize: 11,
                      padding: "4px 9px",
                      borderRadius: 999,
                      background: `${C.success}12`,
                      border: `1px solid ${C.success}16`,
                      whiteSpace: "nowrap",
                    }}>
                      Step 5 / 5
                    </span>
                    <span style={{ fontSize: 11, color: C.textSecondary, whiteSpace: "nowrap" }}>
                      最近编辑：{p.time}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn small onClick={() => handleViewOutline(p)} disabled={isLoadingProject(p)}>
                      {isLoadingProject(p) ? '加载中...' : '查看大纲'}
                    </Btn>
                    <Btn small variant="ghost" onClick={() => handleViewProject(p)} disabled={isLoadingProject(p)}>查看</Btn>
                    <Btn small variant="ghost" onClick={() => handleViewHistory(p)} disabled={isLoadingHistory(p)}>
                      {isLoadingHistory(p) ? '加载中...' : '修改历史'}
                    </Btn>
                    <Btn
                      small
                      variant="ghost"
                      onClick={(e) => handleDeleteClick(p, e)}
                      disabled={isDeletingProject(p)}
                      style={{ color: C.danger, borderColor: `${C.danger}26`, background: `${C.danger}08` }}
                    >
                      {isDeletingProject(p) ? '删除中...' : '删除'}
                    </Btn>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card style={{ padding: 28, background: C.bgElevated || C.bgSecondary }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, marginBottom: 8, fontFamily: "var(--font-serif)" }}>还没有已完成项目</div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>
              {isLoggedIn
                ? '当项目走到完整大纲阶段后，这里会沉淀你的可交付策展成果。'
                : '登录后，这里只会显示你自己的已完成策展项目。'}
            </div>
          </Card>
        )}
      </section>

      {viewingProject && (
        <div style={{
          position: "fixed", inset: 0, background: C.overlay,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 500, padding: 40,
          backdropFilter: "blur(8px)",
        }}>
          <div style={{
            background: C.bgElevated || "#fff", borderRadius: 22, width: "100%", maxWidth: 860,
            maxHeight: "90vh", overflow: "auto", boxShadow: C.shadowLg, border: `1px solid ${C.border}`,
          }}>
            <div style={{ padding: "24px 28px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: C.accentSecondary, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>
                    PROJECT OVERVIEW
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>
                    {viewingProject.title}
                  </h2>
                  <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>最近编辑：{viewingProject.time}</span>
                    <span>当前进度：Step {viewingProject.step} / 5</span>
                  </div>
                </div>
                <button
                  onClick={handleCloseView}
                  style={{
                    width: 32, height: 32, borderRadius: 6, border: "none",
                    background: C.bgMuted || C.bgSecondary, cursor: "pointer", fontSize: 18, color: C.textSecondary,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >×</button>
              </div>
            </div>

            <div style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <div style={{ display: "flex", gap: 20 }}>
                  <div style={{ width: 80, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: `linear-gradient(135deg, ${C.accentSecondary} 0%, ${C.accentPrimary} 100%)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 700, fontSize: 12,
                    }}>
                      配
                    </div>
                    <div style={{
                      width: 2, flex: 1, minHeight: 76, marginTop: 8,
                      background: C.success,
                    }} />
                  </div>
                  <div style={{ flex: 1, paddingBottom: 24 }}>
                    <div style={{
                      fontWeight: 700, fontSize: 14, marginBottom: 8,
                      color: C.textPrimary,
                    }}>
                      新建策展：生成配置
                    </div>
                    {renderSetupContent(viewingProject)}
                  </div>
                </div>

                {STEPS.map((label, i) => {
                  const step = i + 1;
                  const isDone = step <= viewingProject.step;
                  const isCurrent = step === viewingProject.step;

                  return (
                    <div key={step} style={{ display: "flex", gap: 20 }}>
                      <div style={{ width: 80, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 8 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: isDone ? (isCurrent ? C.accentPrimary : C.success) : C.stepInactive,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontWeight: 700, fontSize: 13,
                          boxShadow: isCurrent ? `0 8px 20px ${C.accentPrimary}24` : "none",
                        }}>
                          {isDone ? (isCurrent ? step : "✓") : step}
                        </div>
                        {step < STEPS.length && (
                          <div style={{
                            width: 2, flex: 1, minHeight: 60, marginTop: 8,
                            background: isDone ? C.success : C.stepInactive,
                          }} />
                        )}
                      </div>
                      <div style={{
                        flex: 1,
                        paddingBottom: step < STEPS.length ? 24 : 0,
                        padding: "2px 0 24px",
                      }}>
                        <div style={{
                          fontWeight: 700, fontSize: 14, marginBottom: 8,
                          color: isDone ? C.textPrimary : C.textSecondary,
                        }}>
                          Step {step}：{label}
                        </div>
                        {isDone ? (
                          renderStepContent(viewingProject, step)
                        ) : (
                          <div style={{ fontSize: 13, color: C.textPlaceholder }}>
                            尚未完成
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: "20px 28px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <Btn
                variant="ghost"
                onClick={() => handleViewHistory(viewingProject)}
                disabled={loadingHistoryId === viewingProject.id}
              >
                {loadingHistoryId === viewingProject.id ? '加载中...' : '修改历史'}
              </Btn>
              <Btn variant="ghost" onClick={handleCloseView}>关闭</Btn>
              {viewingProject.step < 5 ? (
                <Btn onClick={() => handleEditFromView(viewingProject)}>继续编辑</Btn>
              ) : (
                <Btn onClick={() => handleEditFromView(viewingProject)}>查看大纲</Btn>
              )}
            </div>
          </div>
        </div>
      )}

      {historyModal && (
        <div style={{
          position: "fixed", inset: 0, background: C.overlay,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 650, padding: 40,
          backdropFilter: "blur(8px)",
        }}>
          <div style={{
            background: C.bgElevated || "#fff",
            borderRadius: 22,
            width: "100%",
            maxWidth: 820,
            maxHeight: "88vh",
            overflow: "auto",
            boxShadow: C.shadowLg,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ padding: "24px 28px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.accentSecondary, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>
                    VERSION HISTORY
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", margin: 0 }}>
                    修改历史
                  </h2>
                  <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 8 }}>
                    {historyModal.project?.title}
                  </div>
                </div>
                <button
                  onClick={handleCloseHistory}
                  style={{
                    width: 32, height: 32, borderRadius: 6, border: "none",
                    background: C.bgMuted || C.bgSecondary, cursor: "pointer", fontSize: 18, color: C.textSecondary,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >×</button>
              </div>
            </div>

            <div style={{ padding: "22px 28px 26px" }}>
              {historyModal.loading ? (
                <div style={{ padding: "34px 0", textAlign: "center", color: C.textSecondary, fontSize: 14 }}>
                  正在加载修改历史...
                </div>
              ) : historyModal.error ? (
                <div style={{
                  border: `1px solid ${C.danger}26`,
                  background: `${C.danger}08`,
                  color: C.danger,
                  borderRadius: 14,
                  padding: 16,
                  fontSize: 13,
                  lineHeight: 1.7,
                }}>
                  {historyModal.error}
                  <div style={{ color: C.textSecondary, marginTop: 8 }}>
                    如果刚启用该功能，请确认已经在 Supabase 执行 project_versions_migration.sql。
                  </div>
                </div>
              ) : historyModal.versions.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {historyModal.versions.map((version) => {
                    const type = version.snapshot_type || 'revision';
                    const meta = getVersionSnapshotMeta(version);
                    const isFinal = type === 'final';
                    const isOriginal = type === 'original';
                    const stepLabel = getVersionStepLabel(version);
                    const operation = getVersionOperation(version);
                    const changeDetails = getVersionChangeDetails(version);

                    return (
                      <div
                        key={version.id || `${version.project_id}-${version.version}`}
                        style={{
                          border: `1px solid ${isFinal ? C.success : isOriginal ? C.accentPrimary : C.border}`,
                          background: isFinal ? `${C.success}08` : isOriginal ? `${C.accentPrimary}08` : C.bgSecondary,
                          borderRadius: 16,
                          padding: 16,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", marginBottom: 10 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                              <span style={{
                                fontSize: 12,
                                color: isFinal ? C.success : isOriginal ? C.accentPrimary : C.textPrimary,
                                fontWeight: 800,
                                padding: "4px 9px",
                                borderRadius: 999,
                                background: C.bgElevated || C.bgPrimary,
                                border: `1px solid ${C.border}`,
                              }}>
                                V{version.version} · {VERSION_TYPE_LABELS[type] || '过程修改'}
                              </span>
                              <span style={{ fontSize: 12, color: C.textSecondary }}>
                                {VERSION_SOURCE_LABELS[version.source] || version.source || '系统记录'}
                              </span>
                            </div>
                            <div style={{ fontSize: 14, color: C.textPrimary, fontWeight: 800, lineHeight: 1.5 }}>
                              {stepLabel}
                            </div>
                            <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 3, lineHeight: 1.6 }}>
                              {operation}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: C.textSecondary, whiteSpace: "nowrap", paddingTop: 4 }}>
                            {formatVersionTime(version.created_at)}
                          </div>
                        </div>

                        {changeDetails.length > 0 && (
                          <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            marginTop: 10,
                            fontSize: 13,
                            color: C.textSecondary,
                            lineHeight: 1.7,
                          }}>
                            {changeDetails.map((detail, index) => (
                              <div key={`${version.id || version.version}-detail-${index}`} style={{ display: "flex", gap: 8 }}>
                                <span style={{ color: C.accentSecondary, fontWeight: 800, flexShrink: 0 }}>变更点</span>
                                <span>{detail}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {meta && (
                          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 8 }}>
                            {meta}
                          </div>
                        )}

                        {Array.isArray(version.changed_fields) && version.changed_fields.length > 0 && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                            {version.changed_fields.map((field) => (
                              <span
                                key={field}
                                style={{
                                  fontSize: 11,
                                  color: C.accentSecondary,
                                  background: `${C.accentSecondary}10`,
                                  border: `1px solid ${C.accentSecondary}18`,
                                  borderRadius: 999,
                                  padding: "3px 8px",
                                  fontWeight: 700,
                                }}
                              >
                                {VERSION_FIELD_LABELS[field] || field}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{
                  border: `1px solid ${C.border}`,
                  background: C.bgSecondary,
                  borderRadius: 16,
                  padding: 22,
                  fontSize: 13,
                  color: C.textSecondary,
                  lineHeight: 1.7,
                }}>
                  这个项目暂时还没有历史记录。
                </div>
              )}
            </div>

            <div style={{ padding: "18px 28px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={handleCloseHistory}>关闭</Btn>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div style={{
          position: "fixed", inset: 0, background: C.overlay,
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
          backdropFilter: "blur(6px)",
        }}>
          <div style={{ background: C.bgElevated || "#fff", borderRadius: 20, padding: 24, width: 380, border: `1px solid ${C.border}`, boxShadow: C.shadowLg }}>
            <div style={{ fontSize: 11, color: C.danger, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>DELETE PROJECT</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: C.textPrimary }}>确认删除</h3>
            <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>
              确定要删除项目「{deleteModal.title}」吗？此操作不可撤销。
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setDeleteModal(null)} disabled={isDeleting}>取消</Btn>
              <Btn variant="danger" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? "删除中..." : "确认删除"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {loadingProject && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(255,255,255,.9)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          zIndex: 300,
        }}>
          <div style={{ 
            width: 48, height: 48, border: `4px solid ${C.border}`, borderTopColor: C.accentPrimary,
            borderRadius: "50%", animation: "spin 1s linear infinite",
          }} />
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
          <div style={{ marginTop: 20, fontSize: 15, color: C.textPrimary, fontWeight: 600 }}>
            加载项目...
          </div>
        </div>
      )}
    </main>
  );
};
