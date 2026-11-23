import { useState, useRef, useEffect } from 'react';
import { ExhibitWriting } from '../components/ExhibitWriting';
import { Btn, Divider, Tag, Modal } from '../components/ui';
import { api } from '../api/client';
import { experimentCondition, newInteractionId, recordInteraction } from '../utils/experiment';
import { retryAsync } from '../utils/retry';

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
  </svg>
);

const ToolbarBtn = ({ onClick, active, children, title, C }) => (
  <button
    type="button"
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    title={title}
    style={{
      padding: "4px 10px", border: "none", borderRadius: 4, cursor: "pointer",
      background: active ? C.accentPrimary : "transparent", color: active ? "#fff" : C.textSecondary,
      fontSize: 13, fontWeight: 600, marginRight: 4,
    }}
  >
    {children}
  </button>
);

const RichTextToolbar = ({ onFormat, C }) => (
  <div style={{ display: "flex", gap: 4, marginBottom: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
    <ToolbarBtn onClick={() => onFormat('undo')} title="撤销" C={C}>↶</ToolbarBtn>
    <ToolbarBtn onClick={() => onFormat('redo')} title="重做" C={C}>↷</ToolbarBtn>
    <span style={{ width: 1, background: C.border, margin: "0 8px" }} />
    <ToolbarBtn onClick={() => onFormat('bold')} title="加粗" C={C}><strong>B</strong></ToolbarBtn>
    <ToolbarBtn onClick={() => onFormat('italic')} title="斜体" C={C}><em>I</em></ToolbarBtn>
    <ToolbarBtn onClick={() => onFormat('underline')} title="下划线" C={C}><u>U</u></ToolbarBtn>
    <span style={{ width: 1, background: C.border, margin: "0 8px" }} />
    <ToolbarBtn onClick={() => onFormat('h1')} title="标题1" C={C}>H1</ToolbarBtn>
    <ToolbarBtn onClick={() => onFormat('h2')} title="标题2" C={C}>H2</ToolbarBtn>
    <ToolbarBtn onClick={() => onFormat('h3')} title="标题3" C={C}>H3</ToolbarBtn>
    <span style={{ width: 1, background: C.border, margin: "0 8px" }} />
    <ToolbarBtn onClick={() => onFormat('ul')} title="无序列表" C={C}>•</ToolbarBtn>
    <ToolbarBtn onClick={() => onFormat('ol')} title="有序列表" C={C}>1.</ToolbarBtn>
  </div>
);

const sanitizeRichTextHtml = (html = '') => String(html || '')
  .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  .replace(/\son\w+="[^"]*"/gi, '')
  .replace(/\son\w+='[^']*'/gi, '')
  .replace(/\sjavascript:/gi, '');

export const PageStep4 = ({
  setPage,
  goNextStep,
  goPrevStep,
  textSections,
  setTextSections,
  keptExhibits,
  setKeptExhibits,
  currentProject,
  setCurrentProject,
  projects,
  setProjects,
  isGenerating,
  theme,
  units,
  setUnits,
  selectedNarrative,
  narrativeOptions,
}) => {
  const C = theme;
  const [editing, setEditing] = useState(null);
  const [regenerateModal, setRegenerateModal] = useState(null);
  const [regeneratingKey, setRegeneratingKey] = useState(null);
  const editorRef = useRef(null);
  const savedSelectionRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [historySection, setHistorySection] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const currentNarrative = narrativeOptions[selectedNarrative] || { title: '', desc: '' };
  const infoCardStyle = {
    padding: "14px 16px",
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    background: C.bgElevated || C.bgSecondary,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  };

  const persistSections = async (nextTextSections, llmParams) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setErrorMessage('');
    try {
      if (currentProject?.id) {
        await api.projects.update(currentProject.id, {
          text_sections: nextTextSections,
          ...(llmParams ? { llm_params: llmParams } : {}),
        });
      }
      setTextSections(nextTextSections);
      const updatedFields = { textSections: nextTextSections, ...(llmParams ? { llmParams } : {}) };
      setCurrentProject?.(project => project?.id === currentProject?.id ? { ...project, ...updatedFields } : project);
      setProjects?.(items => items.map(project => (
        project.id === currentProject?.id ? { ...project, ...updatedFields } : project
      )));
      return true;
    } catch (error) {
      console.error('保存文本审核失败:', error);
      setErrorMessage('保存失败。请重试。');
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const condition = experimentCondition(currentProject);
  const sharedWritingRules = currentProject?.llmParams?.exhibit_writing_rules || {};
  const saveExhibitWriting = (section, changes, nextSharedRules) => persistSections(
    textSections.map(item => item === section ? {
      ...item, ...changes,
      reviewVersions: changes.exhibits ? [...(item.reviewVersions || []), versionOf(item)] : item.reviewVersions,
    } : item),
    nextSharedRules ? { ...currentProject.llmParams, exhibit_writing_rules: nextSharedRules } : undefined,
  );

  const logReview = (type, details) => void recordInteraction(currentProject, 4, type, details);

  const versionOf = ({ text, exhibits, edited, failed }) => ({
    text, exhibits, edited, failed, savedAt: new Date().toISOString(),
  });

  const replaceSection = (section, replacement) => ({
    ...section,
    ...replacement,
    autoRepairing: false,
    error: '',
    reviewStatus: 'pending',
    reviewVersions: [...(section.reviewVersions || []), versionOf(section)],
  });

  const hasText = html => Boolean(String(html || '').replace(/<[^>]+>|&nbsp;/gi, '').trim());
  const needsRepair = section => section.failed || !hasText(section.text) || (!section.edited && isFailureText(section.text));
  const needsReview = section => section.reviewStatus === 'pending' || needsRepair(section);

  const isFailureText = (text = '') => /生成失败|请手动编辑/.test(String(text || ''));

  const parseTextSectionContent = (rawContent = '', sectionKey = '') => {
    const originalContent = String(rawContent || '').trim();
    let content = originalContent;
    let exhibitSummaries = [];
    let summary = '';
    let parsedJson = null;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        parsedJson = parsed;
        if (Array.isArray(parsed.sections)) {
          const currentSection = parsed.sections.find(section => String(section?.key) === String(sectionKey));
          if (!currentSection) {
            return {
              text: '<p>文本生成失败，正在继续生成文本，请稍候。</p>',
              exhibits: [],
              failed: true,
              error: '模型返回了整套文本，但缺少当前单元内容',
            };
          }
          content = String(currentSection.text || currentSection.content || '').trim();
          exhibitSummaries = Array.isArray(currentSection.exhibits) ? currentSection.exhibits : [];
          if (!content) {
            return {
              text: '<p>文本生成失败，正在继续生成文本，请稍候。</p>',
              exhibits: exhibitSummaries,
              failed: true,
              error: '当前单元文本为空',
            };
          }
        }
        if (parsed.intro) {
          content = `<p>${parsed.intro}</p>`;
        }
        if (parsed.exhibits && Array.isArray(parsed.exhibits)) {
          exhibitSummaries = parsed.exhibits;
        }
        if (parsed.summary) {
          summary = `<p>${parsed.summary}</p>`;
        }
      }
    } catch (e) {
      console.error('解析文本响应失败:', e);
    }

    if (parsedJson && Array.isArray(parsedJson.sections) && content === originalContent) {
      return {
        text: '<p>文本生成失败，正在继续生成文本，请稍候。</p>',
        exhibits: [],
        failed: true,
        error: '模型返回了整套文本，未能匹配当前单元',
      };
    }
    if (/^\s*[{[]/.test(content) && /"(sections|intro|exhibits|desc|name)"\s*:/.test(content)) {
      return {
        text: '<p>文本生成失败，正在继续生成文本，请稍候。</p>',
        exhibits: exhibitSummaries,
        failed: true,
        error: '模型返回格式异常，已隐藏原始 JSON',
      };
    }
    if (content && !content.startsWith('<')) {
      content = `<p>${content}</p>`;
    }

    return { text: content + summary, exhibits: exhibitSummaries };
  };

  const buildGenerationContext = () => {
    const narrative = narrativeOptions[selectedNarrative] || { title: '', desc: '' };
    const narrativeRhythm = currentProject?.llmParams?.narrative_rhythm || null;
    const regularUnits = (units || []).filter(u => u.tag !== '序章' && u.tag !== '尾声');
    const exhibitionTitle =
      currentProject?.exhibitionTitle ||
      currentProject?.llmParams?.exhibition_title ||
      currentProject?.title ||
      narrative?.title ||
      '展览';

    return { narrative, narrativeRhythm, regularUnits, exhibitionTitle };
  };

  const exhibitsForKey = (key, unit) => keptExhibits?.[unit?.id ?? unit?.unit_id] || keptExhibits?.[key] || [];

  const buildSectionsToGenerate = () => {
    const { regularUnits } = buildGenerationContext();
    const sections = [];

    if ((units || []).some(unit => unit.tag === '序章') || textSections.some(section => section.key === 'preface')) {
      sections.push({ key: 'preface', title: '展览序言', kind: 'preface' });
    }

    regularUnits.forEach((unit, index) => {
      const key = String(index);
      sections.push({
        key,
        title: unit.title,
        kind: 'unit',
        unit,
        exhibits: exhibitsForKey(key, unit),
      });
    });

    if ((units || []).some(unit => unit.tag === '尾声') || textSections.some(section => section.key === 'epilogue')) {
      sections.push({ key: 'epilogue', title: '展览尾声', kind: 'epilogue' });
    }

    return sections;
  };

  const generateFullDraftSections = async () => {
    const { narrative, narrativeRhythm, exhibitionTitle } = buildGenerationContext();
    const sections = buildSectionsToGenerate();
    const response = await retryAsync(
      () => api.ai.generateTextSectionsBatch({
        exhibition_title: exhibitionTitle,
        sections,
        kept_exhibits: keptExhibits || {},
        narrative,
        narrative_rhythm: narrativeRhythm,
      }),
      {
        label: 'regenerate full text draft',
        retries: 2,
        delayMs: 1800,
        shouldRetryResult: (result) => {
          const generatedSections = result?.sections || [];
          return generatedSections.length !== sections.length || generatedSections.some(section => !String(section?.text || '').trim() || isFailureText(section?.text));
        },
      }
    );
    return response.sections || [];
  };

  const generateSectionContent = async (sectionKey) => {
    const { narrative, narrativeRhythm, regularUnits, exhibitionTitle } = buildGenerationContext();

    if (sectionKey === 'preface') {
      const response = await retryAsync(
        () => api.ai.generatePreface(exhibitionTitle, regularUnits.length, narrative, narrativeRhythm),
        {
          label: 'generate preface',
          shouldRetryResult: (result) => !String(result?.content || '').trim() || isFailureText(result?.content),
        }
      );
      return { text: response.content, exhibits: [] };
    }

    if (sectionKey === 'epilogue') {
      const response = await retryAsync(
        () => api.ai.generateEpilogue(exhibitionTitle, regularUnits.length, narrative, narrativeRhythm),
        {
          label: 'generate epilogue',
          shouldRetryResult: (result) => !String(result?.content || '').trim() || isFailureText(result?.content),
        }
      );
      return { text: response.content, exhibits: [] };
    }

    const unit = regularUnits[Number(sectionKey)];
    const unitExhibits = exhibitsForKey(sectionKey, unit);
    const response = await retryAsync(
      () => api.ai.generateTextSection({
        unit,
        exhibits: unitExhibits,
        narrative,
        narrative_rhythm: narrativeRhythm,
      }),
      {
        label: `generate text section ${unit?.title || sectionKey}`,
        shouldRetryResult: (result) => !String(result?.content || '').trim() || isFailureText(result?.content),
      }
    );

    return parseTextSectionContent(response.content || '', sectionKey);
  };

  useEffect(() => {
    if (currentProject) {
      if (currentProject.units && currentProject.units.length > 0 && (!units || units.length === 0)) {
        setUnits(currentProject.units);
      }
      if (currentProject.keptExhibits && Object.keys(currentProject.keptExhibits).length > 0 && (!keptExhibits || Object.keys(keptExhibits).length === 0)) {
        setKeptExhibits(currentProject.keptExhibits);
      }
      if (currentProject.textSections && currentProject.textSections.length > 0 && (!textSections || textSections.length === 0)) {
        setTextSections(currentProject.textSections);
      }
    }
  }, [currentProject]);

  const saveEditorSelection = () => {
    const selection = window.getSelection?.();
    const editor = editorRef.current;
    if (!selection || !editor || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = range.cloneRange();
    }
  };

  const restoreEditorSelection = () => {
    const selection = window.getSelection?.();
    const range = savedSelectionRef.current;
    if (!selection || !range) return;
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handleFormat = (command) => {
    editorRef.current?.focus();
    restoreEditorSelection();
    if (command === 'undo') {
      document.execCommand('undo', false, null);
    } else if (command === 'redo') {
      document.execCommand('redo', false, null);
    } else if (command === 'h1') {
      document.execCommand('formatBlock', false, 'h1');
    } else if (command === 'h2') {
      document.execCommand('formatBlock', false, 'h2');
    } else if (command === 'h3') {
      document.execCommand('formatBlock', false, 'h3');
    } else if (command === 'ul') {
      document.execCommand('insertUnorderedList', false, null);
    } else if (command === 'ol') {
      document.execCommand('insertOrderedList', false, null);
    } else {
      document.execCommand(command, false, null);
    }
    editorRef.current?.focus();
    saveEditorSelection();
  };

  const saveEditingSection = async (sectionKey) => {
    if (!editorRef.current) {
      setEditing(null);
      return;
    }
    const nextText = sanitizeRichTextHtml(editorRef.current.innerHTML);
    const currentSection = textSections.find(section => section.key === sectionKey);
    if (currentSection && (nextText !== currentSection.text || needsRepair(currentSection))) {
      const nextTextSections = textSections.map(section =>
        section.key === sectionKey ? replaceSection(section, { text: nextText, edited: true, failed: !hasText(nextText) }) : section
      );
      if (!await persistSections(nextTextSections)) return;
      logReview('revision', { method: 'manual', scope: { section_key: sectionKey }, candidate_id: currentSection.appliedCandidateId });
    }
    setEditing(null);
    savedSelectionRef.current = null;
  };

  const cancelEditingSection = () => {
    setEditing(null);
    savedSelectionRef.current = null;
  };

  const handleRegenerate = (section) => {
    setErrorMessage('');
    setRegenerateModal(section);
  };

  const generateCandidate = async (fullDraft) => {
    const section = regenerateModal;
    if (!section) return;
    setRegenerateModal(null);
    setErrorMessage('');
    setRegeneratingKey(section.key);
    const candidateId = newInteractionId();
    const scope = { section_key: section.key, generation_range: fullDraft ? 'outline' : 'section' };
    logReview('request_start', { task: 'interpretive_text', method: 'regeneration', scope, candidate_id: candidateId });
    try {
      const generated = fullDraft
        ? (await generateFullDraftSections()).find(item => String(item.key) === String(section.key))
        : await generateSectionContent(section.key);
      const text = sanitizeRichTextHtml(generated?.text);
      if (!hasText(text) || generated.failed || isFailureText(text)) {
        throw new Error(generated?.error || '没有可用的候选文本');
      }
      const approved = (section.exhibits || []).filter(item => item.curatorReviewed);
      const generatedExhibits = generated.exhibits ?? section.exhibits ?? [];
      const exhibits = [...generatedExhibits.filter(item => !approved.some(kept => kept.name === item.name)), ...approved];
      setPreview({
        section,
        candidateId,
        replacement: { text, exhibits, edited: false, failed: false },
        restoring: false,
      });
      logReview('generation_result', { candidate_id: candidateId, outcome: 'ready', scope });
    } catch (error) {
      logReview('generation_result', { candidate_id: candidateId, outcome: 'failed', scope });
      console.error('生成候选文本失败:', error);
      setErrorMessage('候选生成失败。原文已保留，你可以重新尝试或直接编辑。');
    } finally {
      setRegeneratingKey(null);
    }
  };

  const applyPreview = async () => {
    const current = textSections.find(section => section.key === preview.section.key);
    if (current !== preview.section) {
      setPreview(null);
      setErrorMessage('当前文字已变化，请重新打开预览。');
      return;
    }
    const saved = await persistSections(textSections.map(section => (
      section === current ? replaceSection(section, { ...preview.replacement, appliedCandidateId: preview.candidateId }) : section
    )));
    if (saved) {
      logReview(preview.restoring ? 'revision' : 'candidate_disposition', {
        method: preview.restoring ? 'restore' : 'regeneration',
        outcome: preview.restoring ? 'restored' : 'accepted',
        scope: { section_key: current.key },
        candidate_id: preview.candidateId,
      });
      setPreview(null);
    }
  };

  const confirmSection = async (key) => {
    const saved = await persistSections(textSections.map(section => (
      section.key === key ? { ...section, reviewStatus: 'confirmed' } : section
    )));
    if (saved) {
      const section = textSections.find(item => item.key === key);
      logReview('review', {
        outcome: section?.appliedCandidateId && section.edited ? 'accepted_after_edit' : 'confirmed',
        scope: { section_key: key }, candidate_id: section?.appliedCandidateId,
      });
    }
  };

  const dismissPreview = () => {
    if (savingRef.current) return;
    if (preview.candidateId) {
      logReview('candidate_disposition', {
        candidate_id: preview.candidateId, outcome: 'discarded', scope: { section_key: preview.section.key },
      });
    }
    setPreview(null);
  };

  return (
    <main style={{ padding: "28px 36px" }}>
      {isGenerating && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(245, 242, 236, 0.84)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          zIndex: 300, backdropFilter: "blur(4px)",
        }}>
          <div style={{
            width: 420,
            maxWidth: "calc(100vw - 32px)",
            padding: "28px 24px",
            borderRadius: 22,
            background: C.bgPrimary,
            border: `1px solid ${C.border}`,
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
            textAlign: "center",
          }}>
            <div style={{
              width: 48, height: 48, border: `4px solid ${C.border}`, borderTopColor: C.accentPrimary,
              borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto",
            }} />
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
            <div style={{ marginTop: 20, fontSize: 16, color: C.textPrimary, fontWeight: 700 }}>
              AI 正在生成策展文本
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>
              正在为序言、各单元与尾声组织文稿，请稍候片刻。
            </div>
          </div>
        </div>
      )}

      <div style={{
        padding: "24px 28px",
        borderRadius: 24,
        border: `1px solid ${C.border}`,
        background: `linear-gradient(180deg, ${C.bgElevated || C.bgSecondary} 0%, ${C.bgSecondary} 100%)`,
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        marginBottom: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 760 }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              background: `${C.accentPrimary}12`,
              border: `1px solid ${C.accentPrimary}18`,
              color: C.accentPrimary,
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 14,
            }}>
              Step 4 / 5
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", margin: 0 }}>
              审核并编辑策展文本
            </h1>
            <p style={{ color: C.textSecondary, fontSize: 14, margin: "10px 0 0", lineHeight: 1.8, maxWidth: 720 }}>
              AI 已生成序言、单元文案与尾声。你可以逐段审核、直接编辑，或对单段进行重新生成。
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ background: C.aiGenerated, padding: "5px 10px", borderRadius: 999 }}>蓝色背景为 AI 生成原文</span>
            <span style={{ background: C.humanEdited, padding: "5px 10px", borderRadius: 999 }}>黄色背景为您已修改</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 20 }}>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>当前叙事方向</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, lineHeight: 1.6 }}>
              {currentNarrative?.title || currentNarrative?.label || '未命名方向'}
            </div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>文本段落</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{textSections.length || 0} 段</div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>已人工修改</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
              {textSections.filter(sec => sec.edited).length} 段
            </div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>展品支撑</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
              {Object.values(keptExhibits || {}).filter(Array.isArray).reduce((sum, list) => sum + list.length, 0)} 件
            </div>
          </div>
        </div>
      </div>

      {errorMessage && !preview && <p role="alert" style={{ color: C.warning }}>{errorMessage}</p>}

      {textSections.map((sec) => {
        const unit = (units || []).filter(item => item.tag !== '序章' && item.tag !== '尾声')[Number(sec.key)];
        const sectionExhibits = exhibitsForKey(sec.key, unit);
        return (
        <div key={sec.key} style={{
          marginBottom: 24,
          borderRadius: 22,
          border: `1px solid ${C.border}`,
          background: C.bgElevated || C.bgSecondary,
          boxShadow: "0 14px 30px rgba(15, 23, 42, 0.04)",
          padding: "18px 20px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", margin: 0 }}>
                {sec.title}
              </h2>
              {sec.edited && <Tag label="[已修改]" color={C.humanEdited} textColor={C.accentSecondary} />}
              {needsReview(sec) && <Tag label="待审阅" color={C.aiGenerated} textColor={C.accentPrimary} />}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {sec.reviewVersions?.length > 0 && (
                <Btn small variant="ghost" disabled={saving || editing !== null} onClick={() => setHistorySection(sec)}>版本记录</Btn>
              )}
              <Btn small variant="ghost" disabled={saving || editing !== null} onClick={() => handleRegenerate(sec)}>
                <RefreshIcon /> 重新生成
              </Btn>
              {sec.reviewStatus !== 'confirmed' && !needsRepair(sec) && (
                <Btn small disabled={saving || editing !== null} onClick={() => confirmSection(sec.key)}>确认本段</Btn>
              )}
            </div>
          </div>

          {editing === sec.key ? (
            <div style={{ border: `1.5px solid ${C.accentPrimary}`, borderRadius: 16, overflow: 'hidden', background: C.bgPrimary }}>
              <RichTextToolbar onFormat={handleFormat} C={C} />
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(sec.text) }}
                onMouseUp={saveEditorSelection}
                onKeyUp={saveEditorSelection}
                onInput={saveEditorSelection}
                style={{
                  width: "100%", padding: "14px 16px", boxSizing: "border-box",
                  fontSize: 14, lineHeight: 1.8, minHeight: 120,
                  fontFamily: "var(--font-serif)", resize: "vertical",
                  background: C.humanEdited, outline: 'none',
                }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                padding: '10px 12px',
                borderTop: `1px solid ${C.border}`,
                background: C.bgPrimary,
              }}>
                <Btn variant="ghost" disabled={saving} onClick={cancelEditingSection}>取消</Btn>
                <Btn disabled={saving} onClick={() => saveEditingSection(sec.key)}>确定保存</Btn>
              </div>
            </div>
          ) : (
            <div
              onClick={() => { if (!saving && editing === null) setEditing(sec.key); }}
              style={{
                padding: "16px 18px", borderRadius: 16, cursor: "text",
                background: sec.edited ? C.humanEdited : C.aiGenerated,
                fontSize: 14, lineHeight: 1.8, color: C.textPrimary, fontFamily: "var(--font-serif)",
                border: `1px solid ${sec.edited ? C.accentSecondary + "44" : C.accentPrimary + "22"}`,
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(needsRepair(sec) ? '<p>生成失败。可重新生成或直接编辑。</p>' : sec.text) }}
            />
          )}

          {condition && sectionExhibits.length > 0 && editing === null && (
            <ExhibitWriting key={`${currentProject?.id}-${sec.key}-${condition}`} section={sec}
              exhibits={sectionExhibits} condition={condition} sharedRules={sharedWritingRules}
              save={saveExhibitWriting} log={logReview} C={C} />
          )}

          {sec.key !== 'preface' && sec.key !== 'epilogue' && (() => {
            const exhibitsForSection = sectionExhibits;
            const hasExhibits = exhibitsForSection.length > 0;
            return hasExhibits && (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: C.bgPrimary, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, color: C.textSecondary, fontWeight: 700, marginBottom: 4 }}>展品摘要：</div>
                <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}>
                  {exhibitsForSection.slice(0, 3).map((ex, idx) => (
                    <span key={idx}>· {ex.name} {ex.desc && `— ${ex.desc.slice(0, 20)}${ex.desc.length > 20 ? '...' : ''}`}{idx < Math.min(exhibitsForSection.length, 3) - 1 ? '；' : ''}</span>
                  ))}
                  {exhibitsForSection.length > 3 && <span> 等{exhibitsForSection.length}件展品</span>}
                </div>
              </div>
            );
          })()}
        </div>
      ); })}

      <div style={{
        marginTop: 8,
        padding: "18px 20px",
        borderRadius: 20,
        border: `1px solid ${C.border}`,
        background: C.bgElevated || C.bgSecondary,
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.04)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
            确认文本后进入完整大纲
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: C.warning }}>
            {textSections.some(needsReview) ? '请先处理生成失败的段落，并确认待审阅的文字。' : '请核对各段文字的表述、结构与学术准确性。'}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Btn variant="ghost" disabled={saving || editing !== null} onClick={goPrevStep}>← 返回 Step3</Btn>
          <Btn disabled={saving || editing !== null || textSections.some(needsReview)} onClick={goNextStep}>确认文本，生成完整大纲 →</Btn>
        </div>
      </div>

      {regenerateModal && (
        <Modal onClose={() => setRegenerateModal(null)}>
          <div style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: C.textPrimary }}>重新生成确认</h3>
            <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20, lineHeight: 1.6 }}>
              请选择「{regenerateModal.title}」的重新生成方式。本次由人工智能起草，策展人审阅确认。生成后可对照原文和候选，再决定是否应用。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setRegenerateModal(null)}>取消</Btn>
              <Btn variant="ghost" onClick={() => generateCandidate(false)}>只生成当前段</Btn>
              <Btn onClick={() => generateCandidate(true)}>整套生成，仅预览当前段</Btn>
            </div>
          </div>
        </Modal>
      )}

      {historySection && (
        <Modal C={C} title="版本记录" onClose={() => setHistorySection(null)} showFooter={false}>
          {historySection.reviewVersions.slice().reverse().map((version, index) => (
            <div key={index} style={{ padding: '8px 0', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>{new Date(version.savedAt).toLocaleString('zh-CN')}</span>
              <Btn small variant="ghost" onClick={() => {
                const { savedAt, ...replacement } = version;
                setErrorMessage('');
                setPreview({ section: historySection, replacement, restoring: true });
                setHistorySection(null);
              }}>查看版本</Btn>
            </div>
          ))}
        </Modal>
      )}

      {preview && (
        <Modal C={C} width={900} title={preview.restoring ? '对照历史版本' : '对照生成候选'}
          onClose={dismissPreview}
          footer={<>
            <Btn variant="ghost" disabled={saving} onClick={dismissPreview}>保留原文</Btn>
            <Btn disabled={saving} onClick={applyPreview}>{preview.restoring ? '恢复此版本' : '应用候选'}</Btn>
          </>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16 }}>
            {[
              ['当前原文', preview.section.text],
              [preview.restoring ? '历史版本' : '生成候选', preview.replacement.text],
            ].map(([label, html]) => (
              <section key={label} style={infoCardStyle}>
                <h4>{label}</h4>
                <div dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }} />
              </section>
            ))}
          </div>
          {errorMessage && <p role="alert" style={{ color: C.warning }}>{errorMessage}</p>}
        </Modal>
      )}

      {regeneratingKey && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(245, 242, 236, 0.84)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          zIndex: 350, backdropFilter: "blur(4px)",
        }}>
          <div style={{
            width: 360,
            maxWidth: "calc(100vw - 32px)",
            padding: "24px 20px",
            borderRadius: 22,
            background: C.bgPrimary,
            border: `1px solid ${C.border}`,
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
            textAlign: "center",
          }}>
            <div style={{
              width: 40, height: 40, border: `3px solid ${C.border}`, borderTopColor: C.accentPrimary,
              borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto",
            }} />
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
            <div style={{ marginTop: 16, fontSize: 14, color: C.textPrimary, fontWeight: 700 }}>
              正在重新生成
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: C.textSecondary }}>
              请稍候，系统正在生成供审阅的候选。
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
