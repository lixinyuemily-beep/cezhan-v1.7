import { useState, useRef, useEffect } from 'react';
import { Btn } from '../components/ui';
import { generateCurationOutline } from '../api/curationApi';
import { api } from '../api/client';
import {
  EXHIBIT_TEMPLATE_HEADERS,
  getExhibitImage,
  getExhibitMaterial,
  getExhibitName,
  getExhibitOther,
  getExhibitPlace,
  getExhibitTime,
  hasMeaningfulExhibitData,
  normalizeImportedExhibit,
} from '../utils/exhibitFields';

const RHYTHM_STAGE_LABELS = ['开场', '铺垫', '转折', '深入', '高潮', '余韵'];
const RHYTHM_PRESETS = [
  {
    key: 'release',
    label: '蓄势递进',
    points: [34, 28, 24, 42, 76, 66],
    summary: '前段刻意压低节奏、留出铺垫和沉淀空间，中后段快速抬升并形成靠后的高潮，尾段略作回落，适合层层蓄势后集中释放。',
  },
  {
    key: 'steady',
    label: '平稳铺陈',
    points: [56, 52, 48, 54, 60, 58],
    summary: '整体维持中等张力，前后变化克制，以稳定铺陈和持续说明为主，适合偏学术、偏知识梳理的展览叙述。',
  },
  {
    key: 'rise',
    label: '渐进抬升',
    points: [38, 44, 50, 60, 72, 78],
    summary: '叙事张力从低到高持续抬升，后段保持较高强度，适合从背景认知逐步走向价值强调和主题升华。',
  },
  {
    key: 'dramatic',
    label: '跌宕起伏',
    points: [62, 40, 70, 34, 82, 58],
    summary: '节奏在高低之间多次切换，包含明显转折、回落和再抬升，后段形成强高潮，适合冲突感、故事性和情绪反差更强的表达。',
  },
];

const RHYTHM_WIDTH = 360;
const RHYTHM_HEIGHT = 232;
const RHYTHM_PADDING_X = 22;
const RHYTHM_PADDING_Y = 18;
const RHYTHM_BASELINE = 50;
const UNIT_COUNT_MIN = 2;
const ITEMS_PER_UNIT_MIN = 2;
const ITEMS_PER_UNIT_FALLBACK_LIMIT = 50;
const SAMPLE_EXHIBIT_FILE_NAME = "示例展品清单.xlsx";
const SAMPLE_EXHIBIT_FILE_URL = `/downloads/${encodeURIComponent(SAMPLE_EXHIBIT_FILE_NAME)}?v=20260806`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const getSliderFillPercentage = (value, min, max) => (max <= min ? 100 : ((value - min) / (max - min)) * 100);

function buildRhythmPath(points) {
  const stepX = (RHYTHM_WIDTH - RHYTHM_PADDING_X * 2) / (points.length - 1);
  const coords = points.map((value, index) => {
    const x = RHYTHM_PADDING_X + stepX * index;
    const y = RHYTHM_HEIGHT - RHYTHM_PADDING_Y - (value / 100) * (RHYTHM_HEIGHT - RHYTHM_PADDING_Y * 2);
    return { x, y };
  });

  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const current = coords[i];
    const next = coords[i + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  return { path, coords };
}

function getRhythmSummary(points) {
  const peak = Math.max(...points);
  const valley = Math.min(...points);
  const peakIndex = points.indexOf(peak);
  const start = points[0];
  const end = points[points.length - 1];
  const amplitude = peak - valley;

  const trendText = end > start + 12 ? '整体情绪逐步抬升' : end < start - 12 ? '整体由强转缓' : '整体节奏较为均衡';
  const peakText = peakIndex >= 4 ? '高潮靠后，适合层层递进' : peakIndex <= 2 ? '前段较早出现亮点' : '中段转折清晰';
  const amplitudeText = amplitude > 38 ? '起伏明显，观众感受更具戏剧性' : amplitude > 22 ? '有清楚的强弱变化' : '变化克制，偏学术叙述';

  return `${trendText}，${peakText}，${amplitudeText}。`;
}

function RhythmDesigner({ C, value, onChange }) {
  const [dragIndex, setDragIndex] = useState(null);
  const enabled = value?.enabled !== false;
  const points = value?.points || RHYTHM_PRESETS[0].points;
  const presetKey = value?.presetKey || RHYTHM_PRESETS[0].key;
  const currentPreset = RHYTHM_PRESETS.find((preset) => preset.key === presetKey);
  const modeLabel = presetKey === 'custom' ? '自定义曲线' : `当前模板：${currentPreset?.label || RHYTHM_PRESETS[0].label}`;
  const rhythmSummary = presetKey === 'custom'
    ? getRhythmSummary(points)
    : (currentPreset?.summary || getRhythmSummary(points));

  useEffect(() => {
    if (!enabled) return undefined;
    if (dragIndex === null) return undefined;

    const handleMouseMove = (event) => {
      const svg = document.getElementById('narrative-rhythm-board');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relativeY = clamp(event.clientY - rect.top, RHYTHM_PADDING_Y, rect.height - RHYTHM_PADDING_Y);
      const normalized = Math.round(((rect.height - RHYTHM_PADDING_Y - relativeY) / (rect.height - RHYTHM_PADDING_Y * 2)) * 100);
      const nextPoints = points.map((point, index) => (index === dragIndex ? clamp(normalized, 8, 92) : point));
      onChange({
        enabled: true,
        presetKey: 'custom',
        points: nextPoints,
        stages: [...RHYTHM_STAGE_LABELS],
        summary: getRhythmSummary(nextPoints),
      });
    };

    const handleMouseUp = () => setDragIndex(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragIndex, enabled, onChange, points]);

  const { path, coords } = buildRhythmPath(points);
  const baselineY = RHYTHM_HEIGHT - RHYTHM_PADDING_Y - (RHYTHM_BASELINE / 100) * (RHYTHM_HEIGHT - RHYTHM_PADDING_Y * 2);

  return (
    <div style={{
      background: C.bgSecondary,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 16,
      boxShadow: `0 8px 20px ${C.accentPrimary}10`,
      display: 'flex',
      flexDirection: 'column',
      opacity: enabled ? 1 : 0.82,
    }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>叙事节奏</div>
          <button
            type="button"
            aria-pressed={enabled}
            onClick={() => onChange({
              enabled: !enabled,
              presetKey,
              points: [...points],
              stages: [...RHYTHM_STAGE_LABELS],
              summary: rhythmSummary,
            })}
            style={{
              width: 42,
              height: 22,
              border: `1px solid ${enabled ? C.accentPrimary : C.border}`,
              background: enabled ? C.accentPrimary : C.stepInactive,
              borderRadius: 999,
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: enabled ? 'flex-end' : 'flex-start',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'all .18s ease',
              boxShadow: enabled ? `0 6px 14px ${C.accentPrimary}22` : 'none',
            }}
          >
            <span style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#fff',
              display: 'block',
              boxShadow: '0 2px 6px rgba(0,0,0,.18)',
            }} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
          拖动节点，定义展览从铺垫、转折到高潮的情绪推进；关闭后由 AI 自主组织节奏。
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 14,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary }}>节奏模板</span>
        <span style={{
          border: `1px solid ${presetKey === 'custom' ? C.accentSecondary : C.border}`,
          background: presetKey === 'custom' ? `${C.accentSecondary}12` : C.bgSecondary,
          color: presetKey === 'custom' ? C.accentSecondary : C.textSecondary,
          borderRadius: 999,
          padding: '5px 10px',
          fontSize: 11,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          opacity: enabled ? 1 : 0.55,
        }}>
          {modeLabel}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 6,
        marginTop: 10,
      }}>
        {RHYTHM_PRESETS.map((preset) => {
          const active = preset.key === presetKey;
          return (
            <button
              key={preset.key}
              type="button"
              disabled={!enabled}
              onClick={() => {
                onChange({
                  enabled: true,
                  presetKey: preset.key,
                  points: [...preset.points],
                  stages: [...RHYTHM_STAGE_LABELS],
                  summary: preset.summary,
                });
              }}
              style={{
                border: `1px solid ${active ? C.accentPrimary : C.border}`,
                background: active ? `${C.accentPrimary}12` : C.bgSecondary,
                color: active ? C.accentPrimary : C.textSecondary,
                borderRadius: 10,
                padding: '7px 6px',
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                cursor: enabled ? 'pointer' : 'not-allowed',
                opacity: enabled ? 1 : 0.5,
                minHeight: 32,
                whiteSpace: 'nowrap',
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div style={{
        marginTop: 16,
        borderRadius: 10,
        overflow: 'hidden',
        background: enabled
          ? 'linear-gradient(180deg, rgba(43,95,142,0.05) 0%, rgba(200,135,58,0.06) 100%)'
          : 'linear-gradient(180deg, rgba(120,120,120,0.04) 0%, rgba(120,120,120,0.08) 100%)',
        border: `1px solid ${C.border}`,
      }}>
        <svg
          id="narrative-rhythm-board"
          viewBox={`0 0 ${RHYTHM_WIDTH} ${RHYTHM_HEIGHT}`}
          style={{ width: '100%', height: 230, display: 'block', userSelect: 'none' }}
        >
          <text
            x={RHYTHM_PADDING_X}
            y={RHYTHM_PADDING_Y - 2}
            style={{ fontSize: 10, fill: C.textSecondary, letterSpacing: '0.08em' }}
          >
            张力
          </text>

          {[25, 50, 75].map((line) => {
            const y = RHYTHM_HEIGHT - RHYTHM_PADDING_Y - (line / 100) * (RHYTHM_HEIGHT - RHYTHM_PADDING_Y * 2);
            return (
              <line
                key={line}
                x1={RHYTHM_PADDING_X}
                x2={RHYTHM_WIDTH - RHYTHM_PADDING_X}
                y1={y}
                y2={y}
                stroke={C.border}
                strokeDasharray="4 6"
                strokeWidth="1"
              />
            );
          })}

          <line
            x1={RHYTHM_PADDING_X}
            x2={RHYTHM_WIDTH - RHYTHM_PADDING_X}
            y1={baselineY}
            y2={baselineY}
            stroke={C.accentSecondary}
            strokeDasharray="8 6"
            strokeWidth="2"
            opacity={enabled ? 0.85 : 0.45}
          />
          <rect
            x={RHYTHM_WIDTH - RHYTHM_PADDING_X - 76}
            y={baselineY - 18}
            width="74"
            height="16"
            rx="8"
            fill={enabled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.72)'}
            stroke={`${C.accentSecondary}55`}
          />
          <text
            x={RHYTHM_WIDTH - RHYTHM_PADDING_X - 39}
            y={baselineY - 6}
            textAnchor="middle"
            style={{ fontSize: 9, fill: C.accentSecondary, fontWeight: 700, pointerEvents: 'none' }}
          >
            基线 50
          </text>

          {coords.map((coord, index) => (
            <line
              key={RHYTHM_STAGE_LABELS[index]}
              x1={coord.x}
              x2={coord.x}
              y1={RHYTHM_PADDING_Y}
              y2={RHYTHM_HEIGHT - RHYTHM_PADDING_Y}
              stroke={`${C.border}`}
              strokeWidth="1"
              opacity="0.6"
            />
          ))}

          <path
            d={`${path} L ${coords[coords.length - 1].x} ${RHYTHM_HEIGHT - RHYTHM_PADDING_Y} L ${coords[0].x} ${RHYTHM_HEIGHT - RHYTHM_PADDING_Y} Z`}
            fill="url(#rhythmFill)"
            opacity={enabled ? 0.9 : 0.28}
          />
          <path
            d={path}
            fill="none"
            stroke={enabled ? C.accentPrimary : C.textSecondary}
            strokeWidth="3"
            strokeLinecap="round"
            opacity={enabled ? 1 : 0.45}
          />
          <defs>
            <linearGradient id="rhythmFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={C.accentPrimary} stopOpacity="0.18" />
              <stop offset="100%" stopColor={C.accentSecondary} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {coords.map((coord, index) => {
            const isActive = dragIndex === index;
            return (
              <g key={`node-${RHYTHM_STAGE_LABELS[index]}`} style={{ cursor: enabled ? 'ns-resize' : 'not-allowed' }}>
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r={isActive ? 11 : 9}
                  fill="#fff"
                  stroke={enabled ? (isActive ? C.accentSecondary : C.accentPrimary) : C.textSecondary}
                  strokeWidth="3"
                  opacity={enabled ? 1 : 0.55}
                  onMouseDown={() => enabled && setDragIndex(index)}
                />
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r="4"
                  fill={enabled ? (isActive ? C.accentSecondary : C.accentPrimary) : C.textSecondary}
                  opacity={enabled ? 1 : 0.55}
                  onMouseDown={() => enabled && setDragIndex(index)}
                />
                <rect
                  x={coord.x - 24}
                  y={RHYTHM_HEIGHT - 34}
                  width="48"
                  height="18"
                  rx="9"
                  fill={isActive ? `${C.accentSecondary}22` : 'rgba(255,255,255,0.86)'}
                  stroke={isActive ? `${C.accentSecondary}55` : `${C.border}`}
                />
                <text
                  x={coord.x}
                  y={RHYTHM_HEIGHT - 21}
                  textAnchor="middle"
                  style={{ fontSize: 10, fill: C.textSecondary, pointerEvents: 'none' }}
                >
                  {RHYTHM_STAGE_LABELS[index]}
                </text>
              </g>
            );
          })}

          <text
            x={RHYTHM_WIDTH / 2}
            y={RHYTHM_HEIGHT - 4}
            textAnchor="middle"
            style={{ fontSize: 10, fill: C.textSecondary, letterSpacing: '0.08em' }}
          >
            叙事阶段
          </text>
        </svg>
      </div>

      <div style={{
        marginTop: 14,
        padding: '12px 14px',
        background: '#F8F8F7',
        border: `1px solid ${C.border}`,
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 12, color: C.accentPrimary, fontWeight: 700, marginBottom: 4 }}>节奏解读</div>
        <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}>
          {enabled
            ? `${rhythmSummary} 高于基线代表叙事更紧张、更聚焦；低于基线代表叙事更舒缓、更沉淀。`
            : '当前已关闭叙事节奏控制，AI 将根据展品信息和策展意图自主组织叙事推进。'}
        </div>
        <div style={{ fontSize: 11, color: C.textPlaceholder, lineHeight: 1.6, marginTop: 8 }}>
          {enabled
            ? '将直接影响叙事方案、单元结构、序言、单元文案与尾声；展品推荐主要受单元主题间接影响。'
            : '关闭后不会向 AI 传递节奏曲线，生成结果不再受这组节点约束。'}
        </div>
      </div>
    </div>
  );
}

export const PageP1 = ({
  navigateTo,
  setUploaded,
  uploaded,
  createNewProject,
  setCurrentProject,
  exhibitTitle,
  setExhibitTitle,
  uploadedFile,
  setUploadedFile,
  uploadedExhibits,
  setUploadedExhibits,
  additionalIntent,
  setAdditionalIntent,
  advancedSettings,
  setAdvancedSettings,
  buildLLMParams,
  goToStep,
  setCurrentStep,
  setCurrentPage,
  saveAIGeneratedData,
  setProjects,
  setUnits,
  setTextSections,
  setSelectedNarrative,
  narrativeRhythm,
  setNarrativeRhythm,
  showToast,
  activeUserId,
  isLoggedIn,
  requireLogin,
  theme,
}) => {
  const C = theme;
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [serverProgress, setServerProgress] = useState(0);
  const [parseStage, setParseStage] = useState('idle');
  const [parseTaskId, setParseTaskId] = useState('');
  const [parseStatusText, setParseStatusText] = useState('');
  const [parseMeta, setParseMeta] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [librarySaveSummary, setLibrarySaveSummary] = useState(null);
  const [knowledgeExhibits, setKnowledgeExhibits] = useState([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [selectedFromKnowledge, setSelectedFromKnowledge] = useState([]);
  const unitCountMax = Math.max(UNIT_COUNT_MIN, Number(advancedSettings.unitCountMax ?? 6));
  const itemsPerUnitLimit = Math.max(
    ITEMS_PER_UNIT_MIN,
    uploadedExhibits.length || selectedFromKnowledge.length || ITEMS_PER_UNIT_FALLBACK_LIMIT
  );
  const itemsPerUnitMin = Math.max(ITEMS_PER_UNIT_MIN, Number(advancedSettings.itemsPerUnitMin ?? 5));
  const itemsPerUnitMax = clamp(Number(advancedSettings.itemsPerUnitMax ?? advancedSettings.itemsPerUnit ?? 10), itemsPerUnitMin, itemsPerUnitLimit);
  const [itemsRangeDraft, setItemsRangeDraft] = useState({
    min: String(itemsPerUnitMin),
    max: String(itemsPerUnitMax),
  });

  useEffect(() => {
    const loadKnowledgeExhibits = async () => {
      if (!isLoggedIn || !activeUserId) {
        setKnowledgeExhibits([]);
        return;
      }
      try {
        const exhibits = await api.exhibits.getAll({ user_id: activeUserId });
        setKnowledgeExhibits(exhibits);
      } catch (error) {
        console.error('加载知识库展品失败:', error);
      }
    };
    loadKnowledgeExhibits();
  }, [activeUserId, isLoggedIn]);

  useEffect(() => {
    setItemsRangeDraft({
      min: String(itemsPerUnitMin),
      max: String(itemsPerUnitMax),
    });
  }, [itemsPerUnitMin, itemsPerUnitMax]);

  useEffect(() => {
    setAdvancedSettings(prev => {
      const nextMin = clamp(Number(prev.itemsPerUnitMin ?? 5), ITEMS_PER_UNIT_MIN, itemsPerUnitLimit);
      const nextMax = clamp(Number(prev.itemsPerUnitMax ?? prev.itemsPerUnit ?? 10), nextMin, itemsPerUnitLimit);
      if (nextMin === prev.itemsPerUnitMin && nextMax === prev.itemsPerUnitMax && nextMax === prev.itemsPerUnit) {
        return prev;
      }
      return {
        ...prev,
        itemsPerUnitMin: nextMin,
        itemsPerUnitMax: nextMax,
        itemsPerUnit: nextMax,
      };
    });
  }, [itemsPerUnitLimit, setAdvancedSettings]);

  const filteredKnowledgeExhibits = knowledgeSearch
    ? knowledgeExhibits.filter(ex =>
        getExhibitName(ex).includes(knowledgeSearch) ||
        getExhibitTime(ex).includes(knowledgeSearch) ||
        getExhibitPlace(ex).includes(knowledgeSearch) ||
        getExhibitMaterial(ex).includes(knowledgeSearch)
      )
    : knowledgeExhibits;

  const parseProgressValue = parseStage === 'uploading' ? uploadProgress : serverProgress;
  const parseHeadline = parseStage === 'uploading'
    ? '正在上传文件...'
    : parseStage === 'queued'
      ? '解析任务已创建...'
      : parseStage === 'success'
        ? '文件解析完成'
        : '服务端正在解析文件...';

  const handleItemsRangeDraftChange = (key, value) => {
    if (!/^\d*$/.test(value)) return;
    setItemsRangeDraft(prev => ({ ...prev, [key]: value }));
  };

  const commitItemsRangeDraft = (key) => {
    const rawValue = itemsRangeDraft[key];
    if (rawValue === '') {
      setItemsRangeDraft({
        min: String(itemsPerUnitMin),
        max: String(itemsPerUnitMax),
      });
      return;
    }
    const nextValue = parseInt(rawValue, 10);
    if (Number.isNaN(nextValue)) return;
    handleAdvancedChange(key === 'min' ? 'itemsPerUnitMin' : 'itemsPerUnitMax', nextValue);
  };

  const handleItemsRangeKeyDown = (event, key) => {
    if (event.key === 'Enter') {
      commitItemsRangeDraft(key);
      event.currentTarget.blur();
    }
  };

  const handleSelectFromKnowledge = (exhibit) => {
    if (!isLoggedIn) {
      requireLogin('从展品库选择展品');
      return;
    }
    const normalizedExhibit = normalizeImportedExhibit(exhibit);
    if (!selectedFromKnowledge.find(e => e.id === exhibit.id)) {
      setSelectedFromKnowledge([...selectedFromKnowledge, exhibit]);
      setUploadedExhibits([...uploadedExhibits, normalizedExhibit]);
      setUploaded(true);
    }
  };

  const handleRemoveFromKnowledge = (exhibitId) => {
    if (!isLoggedIn) {
      requireLogin('编辑展品清单');
      return;
    }
    setSelectedFromKnowledge(selectedFromKnowledge.filter(e => e.id !== exhibitId));
    setUploadedExhibits(uploadedExhibits.filter(e => e.id !== exhibitId));
    if (uploadedExhibits.length <= 1) {
      setUploaded(false);
    }
  };

  const processSelectedFile = async (file) => {
    if (!isLoggedIn || !activeUserId) {
      requireLogin('上传展品模板');
      return;
    }
    if (!file) return;

    const validExtensions = ['.xlsx', '.csv'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      setParseError(`请上传固定模板的 Excel (.xlsx) 或 CSV 文件，表头必须为：${EXHIBIT_TEMPLATE_HEADERS.join('、')}`);
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setUploadProgress(0);
    setServerProgress(0);
    setParseStage('uploading');
    setParseTaskId('');
    setParseStatusText('文件正在上传到服务端。');
    setParseMeta(null);
    setLibrarySaveSummary(null);

    try {
      const result = await api.exhibits.parseTemplate(file, {
        userId: activeUserId,
        onUploadProgress: (progressEvent) => {
          const total = Number(progressEvent.total || file.size || 0);
          const loaded = Number(progressEvent.loaded || 0);
          if (total > 0) {
            const nextProgress = Math.min(100, Math.round((loaded / total) * 100));
            setUploadProgress(nextProgress);
            if (nextProgress >= 100) {
              setParseStage('queued');
              setParseStatusText('文件上传完成，正在创建解析任务。');
            }
          }
        },
        onTaskProgress: (task) => {
          setParseTaskId(task.task_id || '');
          setParseMeta(task.meta || null);
          setServerProgress(Number(task.progress || 0));
          setParseStage(task.stage || 'parsing');
          setParseStatusText(task.message || '服务端正在解析文件。');
        },
      });

      const parsedExhibits = (result.exhibits || [])
        .map(normalizeImportedExhibit)
        .filter(hasMeaningfulExhibitData);
      let exhibitsForFlow = parsedExhibits;

      if (parsedExhibits.length > 0) {
        try {
          const created = await api.exhibits.createBatch(
            parsedExhibits.map(({ name, time, place, material, introduction, image_url, thumbnail_url, storage_bucket, storage_path, thumbnail_storage_path, other }) => ({
              name: name || '',
              time,
              place,
              material,
              introduction,
              image_url,
              thumbnail_url: thumbnail_url || image_url,
              storage_bucket,
              storage_path,
              thumbnail_storage_path,
              other,
            })),
            { user_id: activeUserId }
          );
          const batchResult = Array.isArray(created)
            ? { exhibits: created, created_count: created.length, duplicate_count: 0, input_duplicate_count: 0, total_count: parsedExhibits.length }
            : (created || {});
          const savedExhibits = (batchResult.exhibits || []).map(normalizeImportedExhibit);
          const createdCount = Number(batchResult.created_count ?? savedExhibits.length ?? 0);
          const duplicateCount = Number(batchResult.duplicate_count || 0);
          const inputDuplicateCount = Number(batchResult.input_duplicate_count || 0);
          const skippedCount = duplicateCount + inputDuplicateCount;
          exhibitsForFlow = savedExhibits.length > 0 ? savedExhibits : parsedExhibits;
          setKnowledgeExhibits((prev) => [...savedExhibits, ...prev]);
          const duplicateReason = skippedCount > 0
            ? `；${skippedCount} 件未重复写入，其中 ${duplicateCount} 件已存在于历史展品库${inputDuplicateCount > 0 ? `，${inputDuplicateCount} 件为本次文件内重复` : ''}`
            : '';
          setLibrarySaveSummary({
            status: 'success',
            count: createdCount,
            message: createdCount > 0
              ? `已新增 ${createdCount} 件展品到展品库${duplicateReason}`
              : `本次未新增展品到展品库，因为这些展品已存在于历史展品库${inputDuplicateCount > 0 ? `，且有 ${inputDuplicateCount} 件为本次文件内重复` : ''}`,
          });
        } catch (saveError) {
          console.error('同步展品库失败:', saveError);
          setLibrarySaveSummary({
            status: 'error',
            count: 0,
            message: saveError.message || '展品已解析，但同步到展品库失败',
          });
          showToast?.('展品已解析，但同步到展品库失败，请稍后在展品库中重新导入', 'error');
        }
      }

      setUploadedFile(file);
      setUploadedExhibits(exhibitsForFlow);
      setParseMeta(result.meta || null);
      setUploadProgress(100);
      setServerProgress(100);
      setParseStage('success');
      setParseStatusText('模板校验、表格解析、图片处理和展品库同步已完成。');
      setUploaded(true);
    } catch (err) {
      setParseError(err.message || '文件解析失败');
      setParseStage('error');
      setParseStatusText('');
      setUploaded(false);
      setUploadedFile(null);
      setUploadedExhibits([]);
      setLibrarySaveSummary(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    await processSelectedFile(file);
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragActive(false);

    if (isParsing) return;
    if (!isLoggedIn) {
      requireLogin('上传展品模板');
      return;
    }

    const file = event.dataTransfer?.files?.[0];
    await processSelectedFile(file);
  };

  const handleReupload = () => {
    if (!isLoggedIn) {
      requireLogin('重新上传展品模板');
      return;
    }
    setUploaded(false);
    setUploadedFile(null);
    setUploadedExhibits([]);
    setUploadProgress(0);
    setServerProgress(0);
    setParseStage('idle');
    setParseTaskId('');
    setParseStatusText('');
    setParseMeta(null);
    setParseError(null);
    setLibrarySaveSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartGeneration = async () => {
    if (!isLoggedIn || !activeUserId) {
      requireLogin('生成并编辑策展方案');
      return;
    }
    if (!uploaded || !uploadedExhibits.length) return;

    setIsGenerating(true);

    try {
      const llmParams = buildLLMParams();

      const result = await generateCurationOutline(llmParams);

      if (result.success) {
        await saveAIGeneratedData(null, result, llmParams);
        showToast('策展大纲生成成功！请选择叙事方向', 'success');
        navigateTo('step1');
      } else {
        showToast(result.error || '生成失败，请重试', 'error');
      }
    } catch (error) {
      console.error('生成失败:', error);
      showToast('生成失败，请重试', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdvancedChange = (key, value) => {
    setAdvancedSettings(prev => {
      const next = { ...prev, [key]: value };
      const nextUnitCountMax = Math.max(UNIT_COUNT_MIN, Number(next.unitCountMax ?? 6));
      let nextItemsPerUnitMin = Math.max(ITEMS_PER_UNIT_MIN, Number(next.itemsPerUnitMin ?? 5));
      let nextItemsPerUnitMax = clamp(Number(next.itemsPerUnitMax ?? next.itemsPerUnit ?? 10), ITEMS_PER_UNIT_MIN, itemsPerUnitLimit);
      if (nextItemsPerUnitMin > nextItemsPerUnitMax) {
        if (key === 'itemsPerUnitMin') {
          nextItemsPerUnitMax = nextItemsPerUnitMin;
        } else {
          nextItemsPerUnitMin = nextItemsPerUnitMax;
        }
      }

      return {
        ...next,
        unitCountMax: nextUnitCountMax,
        itemsPerUnitMin: nextItemsPerUnitMin,
        itemsPerUnitMax: nextItemsPerUnitMax,
        unitCount: clamp(Number(next.unitCount ?? 3), UNIT_COUNT_MIN, nextUnitCountMax),
        itemsPerUnit: nextItemsPerUnitMax,
        temperature: clamp(Number(next.temperature ?? 0.9), 0.1, 1.0),
      };
    });
  };

  return (
    <main style={{ padding: "32px 36px 40px", maxWidth: 1280 }}>
      <section style={{
        padding: "24px 28px",
        borderRadius: 22,
        border: `1px solid ${C.border}`,
        background: `linear-gradient(135deg, ${C.bgElevated || C.bgSecondary} 0%, ${C.bgMuted || C.bgPrimary} 100%)`,
        boxShadow: C.shadowSm,
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, color: C.accentSecondary, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>
          NEW CURATION BRIEF
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, margin: 0, fontFamily: "var(--font-serif)" }}>
          开始新策展
        </h1>
        <p style={{ color: C.textSecondary, fontSize: 14, marginTop: 10, marginBottom: 0, lineHeight: 1.7, maxWidth: 700 }}>
          先确定展览题目、展品清单和策展意图，再通过生成参数与叙事节奏完成整场展览的策略设定。
        </p>
      </section>

      {!isLoggedIn && (
        <div style={{
          marginBottom: 24,
          padding: '14px 16px',
          borderRadius: 14,
          border: `1px solid ${C.border}`,
          background: C.bgSecondary,
          color: C.textSecondary,
          fontSize: 13,
          lineHeight: 1.7,
        }}>
          当前为访客预览模式。你可以查看新建策展界面与参数配置，但不会加载任何个人项目或展品数据；上传、生成与保存前请先登录。
        </div>
      )}

      <div style={{ display: "flex", gap: 40, marginTop: 24, alignItems: "stretch" }}>
        <div style={{ flex: 3, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 8, color: C.textPrimary }}>
            展览题目（可选）
          </label>
          <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8 }}>
            若留空，系统会根据展品内容自动生成主标题。
          </div>
          <input
            placeholder="留空则由 AI 根据展品内容自动生成题目"
            value={exhibitTitle}
            onChange={(e) => setExhibitTitle(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "var(--font-ui)",
              outline: "none", boxSizing: "border-box", background: C.bgElevated || "#fff", color: C.textPrimary,
              boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
            }}
          />

          <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginTop: 22, marginBottom: 8, color: C.textPrimary }}>
            展品清单上传（必填）
          </label>
          <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8 }}>
            当前仅支持固定模板列：{EXHIBIT_TEMPLATE_HEADERS.join('、')}。
            <a
              href={SAMPLE_EXHIBIT_FILE_URL}
              download={SAMPLE_EXHIBIT_FILE_NAME}
              style={{
                marginLeft: 8,
                color: C.accentPrimary,
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              下载示例表格
            </a>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {!uploaded ? (
            <div
              onClick={() => {
                if (!isLoggedIn) {
                  requireLogin('上传展品模板');
                  return;
                }
                fileInputRef.current?.click();
              }}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                minHeight: 388,
                border: `2px dashed ${isDragActive ? C.accentPrimary : C.border}`, borderRadius: 18, padding: "40px 24px",
                textAlign: "center", cursor: "pointer", background: `linear-gradient(180deg, ${C.bgElevated || "#fff"} 0%, ${C.bgMuted || "#fafaf9"} 100%)`,
                display: "flex", flexDirection: "column", justifyContent: "center",
                transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
                boxShadow: isDragActive ? `0 0 0 4px ${C.accentPrimary}18` : C.shadowSm,
                transform: isDragActive ? "scale(1.01)" : "scale(1)",
              }}
            >
              {isParsing ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8, color: C.accentPrimary }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin">
                      <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                    </svg>
                  </div>
                  <div style={{ fontWeight: 600, color: C.textPrimary, marginBottom: 6, fontSize: 18 }}>
                    {parseHeadline}
                  </div>
                  <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 14 }}>
                    {parseStage === 'uploading'
                      ? `文件正在上传到服务端，当前进度 ${uploadProgress}%`
                      : `${parseStatusText || '文件已上传，服务端正在校验固定模板、读取表格并处理图片。'} 当前进度 ${serverProgress}%`}
                  </div>
                  <div style={{
                    width: '100%',
                    maxWidth: 360,
                    height: 10,
                    margin: '0 auto',
                    background: C.bgPrimary,
                    borderRadius: 999,
                    overflow: 'hidden',
                    border: `1px solid ${C.border}`,
                  }}>
                    <div style={{
                      width: `${parseProgressValue}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${C.accentPrimary} 0%, ${C.accentSecondary} 100%)`,
                      transition: 'width .2s ease',
                    }} />
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: C.textSecondary, lineHeight: 1.7 }}>
                    {parseStage === 'uploading'
                      ? '上传完成后会自动进入后台解析，无需重复操作。'
                      : `文件已切换到后台异步解析；即使图片较多也不会占住单次请求。${parseTaskId ? ` 任务 ID：${parseTaskId}` : ''}`}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 10, color: C.textSecondary }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                  </div>
                  <div style={{ fontWeight: 700, color: C.textPrimary, marginBottom: 6, fontSize: 18 }}>
                    {isDragActive ? '松开以上传文件' : '拖拽文件到此或点击选择'}
                  </div>
                  <div style={{ color: C.textSecondary, fontSize: 13, lineHeight: 1.7 }}>
                    支持固定模板 Excel (`.xlsx`) 或 CSV
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Btn small variant="ghost" onClick={(e) => {
                      e.stopPropagation();
                      if (!isLoggedIn) {
                        requireLogin('上传展品模板');
                        return;
                      }
                      fileInputRef.current?.click();
                    }}>{isLoggedIn ? '选择文件' : '登录后上传'}</Btn>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{
              minHeight: 220,
              background: `${C.success}10`, border: `1px solid ${C.success}44`, borderRadius: 18, padding: "20px 22px",
              display: "flex", flexDirection: "column", justifyContent: "center",
              boxShadow: C.shadowSm,
            }}>
              <div style={{ fontWeight: 700, color: C.success, fontSize: 15, marginBottom: 10 }}>
                ✓ 已上传：{uploadedExhibits.length} 件展品
              </div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>
                文件名：{uploadedFile?.name}
              </div>
            {parseMeta && (
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>
                解析结果：成功导入 {Number(parseMeta.imported_count || uploadedExhibits.length || 0)} 条，文件大小 {(Number(parseMeta.file_size || 0) / 1024 / 1024).toFixed(2)} MB
                {Number(parseMeta.embedded_image_count || 0) > 0 ? `，处理嵌入图片 ${parseMeta.embedded_image_count} 张` : ''}
                {Number(parseMeta.incomplete_row_count || 0) > 0 ? `，信息不全 ${parseMeta.incomplete_row_count} 行` : ''}
              </div>
            )}
            {librarySaveSummary && (
              <div style={{
                fontSize: 12,
                color: librarySaveSummary.status === 'success' ? C.success : C.danger,
                marginBottom: 4,
                fontWeight: 700,
              }}>
                展品库同步：{librarySaveSummary.message}
              </div>
            )}
            {Number(parseMeta?.incomplete_row_count || 0) > 0 && (
              <div style={{
                marginTop: 8,
                padding: '10px 12px',
                borderRadius: 10,
                background: `${C.warning}10`,
                border: `1px solid ${C.warning}33`,
                color: C.textSecondary,
                fontSize: 12,
                lineHeight: 1.7,
              }}>
                以下行信息不全，但已保留可解析内容：
                {(parseMeta.incomplete_rows || []).slice(0, 5).map((item) => (
                  <div key={item.row_number}>
                    第 {item.row_number} 行：缺少 {item.missing_fields.join('、')}
                  </div>
                ))}
                {Number(parseMeta.incomplete_row_count || 0) > 5 ? `其余 ${Number(parseMeta.incomplete_row_count || 0) - 5} 行请在展品库中继续检查。` : ''}
              </div>
            )}
              <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
                <span
                  style={{ color: C.accentPrimary, cursor: "pointer", fontSize: 13 }}
                  onClick={() => setShowPreviewModal(true)}
                >
                  [查看清单]
                </span>
                <span
                  style={{ color: C.accentPrimary, cursor: "pointer", fontSize: 13 }}
                  onClick={handleReupload}
                >
                  [重新上传]
                </span>
              </div>
            </div>
          )}

          {parseError && (
            <div style={{
              marginTop: 10, padding: "12px 14px", background: `${C.danger}10`,
              border: `1px solid ${C.danger}44`, borderRadius: 12, fontSize: 13, color: C.danger,
            }}>
              ⚠️ {parseError}
            </div>
          )}

          <div
            style={{
              marginTop: "auto",
              paddingTop: 16,
            }}
          >
            <div
              style={{
              background: C.bgElevated || C.bgSecondary,
              border: `1px solid ${C.border}`,
              borderRadius: 18,
              boxShadow: C.shadowSm,
              overflow: "hidden",
            }}
            >
              <div
                style={{
                  padding: "16px 18px",
                  background: C.bgElevated || C.bgSecondary,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 13, color: C.textPrimary, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  生成参数（高级设置）
                </span>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                <div style={{ padding: "12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 10, alignItems: "stretch" }}>
                    <div style={{ padding: "12px", borderRadius: 14, border: `1px solid ${C.border}`, background: C.bgPrimary, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 700 }}>展览单元数量</div>
                          <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 3 }}>控制正文单元规模</div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.accentPrimary, background: C.accentPrimary + "15", padding: "3px 10px", borderRadius: 12 }}>
                          {advancedSettings.unitCount} 个
                        </span>
                      </div>
                      <div>
                        <input
                          type="range"
                          min={UNIT_COUNT_MIN}
                          max={unitCountMax}
                          value={advancedSettings.unitCount}
                          onChange={(e) => handleAdvancedChange('unitCount', parseInt(e.target.value))}
                          style={{
                            width: "100%",
                            accentColor: C.accentPrimary,
                            cursor: "pointer",
                            height: 6,
                            borderRadius: 3,
                            background: `linear-gradient(to right, ${C.accentPrimary} 0%, ${C.accentPrimary} ${getSliderFillPercentage(advancedSettings.unitCount, UNIT_COUNT_MIN, unitCountMax)}%, ${C.sliderTrack || C.border} ${getSliderFillPercentage(advancedSettings.unitCount, UNIT_COUNT_MIN, unitCountMax)}%, ${C.sliderTrack || C.border} 100%)`,
                          }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textSecondary, marginTop: 4 }}>
                          <span>{UNIT_COUNT_MIN}</span>
                          <span>{unitCountMax}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: "12px", borderRadius: 14, border: `1px solid ${C.border}`, background: C.bgPrimary, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 700 }}>每单元展品数</div>
                          <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 3 }}>
                            AI 优先落在区间内
                          </div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.accentPrimary, background: C.accentPrimary + "15", padding: "3px 10px", borderRadius: 12 }}>
                          {itemsPerUnitMin} - {itemsPerUnitMax} 件
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                        {[
                          { key: 'min', label: '最少', value: itemsRangeDraft.min, committed: itemsPerUnitMin, changeKey: 'itemsPerUnitMin', lower: ITEMS_PER_UNIT_MIN, upper: itemsPerUnitMax },
                          { key: 'max', label: '最多', value: itemsRangeDraft.max, committed: itemsPerUnitMax, changeKey: 'itemsPerUnitMax', lower: itemsPerUnitMin, upper: itemsPerUnitLimit },
                        ].map((field) => (
                          <div
                            key={field.key}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 12,
                              border: `1px solid ${C.border}`,
                              background: C.bgElevated || C.bgSecondary,
                            }}
                          >
                            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6, fontWeight: 600 }}>{field.label}（件）</div>
                            <div style={{ display: "grid", gridTemplateColumns: "24px minmax(0, 1fr) 24px", gap: 4, alignItems: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleAdvancedChange(field.changeKey, field.committed - 1)}
                                disabled={field.committed <= field.lower}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 7,
                                  border: `1px solid ${C.border}`,
                                  background: field.committed <= field.lower ? C.bgMuted || C.bgSecondary : C.bgPrimary,
                                  color: C.textPrimary,
                                  cursor: field.committed <= field.lower ? "not-allowed" : "pointer",
                                  fontWeight: 700,
                                  fontSize: 14,
                                  lineHeight: 1,
                                }}
                              >
                                -
                              </button>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minWidth: 0,
                                  padding: "5px 8px",
                                  borderRadius: 9,
                                  border: `1px solid ${C.border}`,
                                  background: C.bgPrimary,
                                }}
                              >
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={field.value}
                                  onChange={(e) => handleItemsRangeDraftChange(field.key, e.target.value)}
                                  onBlur={() => commitItemsRangeDraft(field.key)}
                                  onKeyDown={(e) => handleItemsRangeKeyDown(e, field.key)}
                                  placeholder={`${field.lower}`}
                                  style={{
                                    width: "100%",
                                    minWidth: 0,
                                    padding: 0,
                                    border: "none",
                                    background: "transparent",
                                    color: C.textPrimary,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    textAlign: "center",
                                    outline: "none",
                                  }}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAdvancedChange(field.changeKey, field.committed + 1)}
                                disabled={field.committed >= field.upper}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 7,
                                  border: `1px solid ${C.border}`,
                                  background: field.committed >= field.upper ? C.bgMuted || C.bgSecondary : C.bgPrimary,
                                  color: C.textPrimary,
                                  cursor: field.committed >= field.upper ? "not-allowed" : "pointer",
                                  fontWeight: 700,
                                  fontSize: 14,
                                  lineHeight: 1,
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: C.textSecondary }}>
                        <span>可清空后重输，回车或离开输入框生效</span>
                        <span>{uploadedExhibits.length > 0 ? `当前上限 ${itemsPerUnitLimit} 件` : '上传展品后按总数自动限制'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, padding: "12px", borderRadius: 14, border: `1px solid ${C.border}`, background: C.bgPrimary }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 700 }}>AI 创意程度</div>
                        <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 3 }}>数值越高，方案表达越发散</div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.accentPrimary, background: C.accentPrimary + "15", padding: "3px 10px", borderRadius: 12 }}>
                        {(advancedSettings.temperature ?? 0.9).toFixed(1)}
                        <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4 }}>
                          ({(advancedSettings.temperature ?? 0.9) < 0.5 ? "保守" : (advancedSettings.temperature ?? 0.9) > 0.8 ? "创意" : "平衡"})
                        </span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.1}
                      value={advancedSettings.temperature ?? 0.9}
                      onChange={(e) => handleAdvancedChange('temperature', parseFloat(e.target.value))}
                      style={{
                        width: "100%",
                        accentColor: C.accentPrimary,
                        cursor: "pointer",
                        height: 6,
                        borderRadius: 3,
                        background: `linear-gradient(to right, ${C.accentPrimary} 0%, ${C.accentPrimary} ${getSliderFillPercentage(advancedSettings.temperature ?? 0.9, 0.1, 1.0)}%, ${C.sliderTrack || C.border} ${getSliderFillPercentage(advancedSettings.temperature ?? 0.9, 0.1, 1.0)}%, ${C.sliderTrack || C.border} 100%)`,
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textSecondary, marginTop: 4 }}>
                      <span>保守</span>
                      <span>平衡</span>
                      <span>创意</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 2, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <label style={{ display: "block", fontWeight: 700, fontSize: 13, marginBottom: 8, color: C.textPrimary }}>
              补充策展意图（可选）
            </label>
            <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8 }}>
              用自然语言补充策展重点、希望凸显的视角，以及希望规避的内容。
            </div>
            <textarea
              placeholder="用自然语言描述您的策展思路、希望强调的重点、希望规避的内容等……

例如：希望以时间为主线，重点突出清代文物。"
              rows={8}
              value={additionalIntent}
              onChange={(e) => setAdditionalIntent(e.target.value)}
              style={{
                width: "100%", minHeight: 220, flex: 1, padding: "12px 14px", borderRadius: 14, resize: "vertical",
                border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "var(--font-ui)",
                outline: "none", boxSizing: "border-box", background: C.bgElevated || "#fff", color: C.textPrimary,
                boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.03)",
              }}
            />
            <div style={{ color: C.textSecondary, fontSize: 11, textAlign: "right", marginTop: 4 }}>
              {additionalIntent.length} / 500
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <RhythmDesigner
              C={C}
              value={narrativeRhythm}
              onChange={setNarrativeRhythm}
            />
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "18px 20px",
        borderRadius: 18,
        border: `1px solid ${C.border}`,
        background: C.bgElevated || C.bgSecondary,
        boxShadow: C.shadowSm,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>
            准备开始生成策展大纲
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}>
            系统会基于展品清单、策展意图、生成参数和叙事节奏，生成叙事方向与后续大纲。
          </div>
        </div>
        <Btn
          disabled={(!uploaded || !uploadedExhibits.length || isGenerating) && isLoggedIn}
          onClick={handleStartGeneration}
          style={{ minWidth: 188 }}
        >
          {!isLoggedIn ? '登录后生成策展大纲' : isGenerating ? '正在生成中...' : '开始生成策展大纲 →'}
        </Btn>

        {isGenerating && (
          <div style={{
            position: "fixed", inset: 0, background: C.overlay,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            zIndex: 300,
            backdropFilter: "blur(6px)",
          }}>
            <div style={{
              width: 48,
              height: 48,
              border: `4px solid ${C.border}`,
              borderTopColor: C.accentPrimary,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
            <div style={{ color: C.textPrimary, fontSize: 15, fontWeight: 600, marginTop: 20 }}>
              正在调用 AI 生成策展大纲...
            </div>
            <div style={{ color: C.textSecondary, fontSize: 13, marginTop: 8 }}>
              这可能需要几秒钟时间
            </div>
          </div>
        )}
      </div>

      {showPreviewModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400,
          padding: 24,
        }}>
          <div style={{
            background: C.bgSecondary,
            borderRadius: 12,
            padding: 24,
            width: 760,
            maxWidth: "calc(100vw - 48px)",
            height: "min(760px, calc(100vh - 72px))",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow: C.shadowLg,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: C.textPrimary }}>展品清单</h3>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>
              共解析到 <span style={{ color: C.accentPrimary, fontWeight: 700 }}>{uploadedExhibits.length}</span> 件展品
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.bgPrimary, borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSecondary, fontWeight: 600 }}>序号</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSecondary, fontWeight: 600 }}>缩略图</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSecondary, fontWeight: 600 }}>展品名称</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSecondary, fontWeight: 600 }}>时间</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSecondary, fontWeight: 600 }}>地点</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSecondary, fontWeight: 600 }}>材质</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSecondary, fontWeight: 600 }}>其他</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadedExhibits.map((ex, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "10px 12px", color: C.textSecondary }}>{i + 1}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {getExhibitImage(ex) ? (
                          <img
                            src={getExhibitImage(ex)}
                            alt={getExhibitName(ex)}
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: `1px solid ${C.border}` }}
                          />
                        ) : (
                          <span style={{ color: C.textSecondary }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", color: C.textPrimary, fontWeight: 600 }}>{getExhibitName(ex) || '-'}</td>
                      <td style={{ padding: "10px 12px", color: C.textPrimary }}>{getExhibitTime(ex) || '-'}</td>
                      <td style={{ padding: "10px 12px", color: C.textPrimary }}>{getExhibitPlace(ex) || '-'}</td>
                      <td style={{ padding: "10px 12px", color: C.textPrimary }}>{getExhibitMaterial(ex) || '-'}</td>
                      <td style={{ padding: "10px 12px", color: C.textSecondary, fontSize: 12 }}>{getExhibitOther(ex) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, flexShrink: 0 }}>
              <Btn onClick={() => setShowPreviewModal(false)}>关闭</Btn>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
