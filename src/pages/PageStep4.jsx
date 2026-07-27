import { useState, useRef, useEffect } from 'react';
import { Btn, Divider, Tag, Modal } from '../components/ui';
import { api } from '../api/client';

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
  const currentNarrative = narrativeOptions[selectedNarrative] || { title: '', desc: '' };
  const infoCardStyle = {
    padding: "14px 16px",
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    background: C.bgElevated || C.bgSecondary,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  };

  const markStep4Edited = (nextTextSections) => {
    if (!currentProject) return;
    const updatedProject = {
      ...currentProject,
      step: 4,
      textSections: nextTextSections,
    };
    setCurrentProject?.(updatedProject);
    setProjects?.((projects || []).map(project => project.id === currentProject.id ? updatedProject : project));

    if (currentProject.id) {
      api.projects.update(currentProject.id, {
        step: 4,
        text_sections: nextTextSections,
      }).catch((error) => {
        console.error('保存文本编辑状态失败:', error);
      });
    }
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

  const saveEditingSection = (sectionKey) => {
    if (!editorRef.current) {
      setEditing(null);
      return;
    }
    const nextText = sanitizeRichTextHtml(editorRef.current.innerHTML);
    const currentSection = textSections.find(section => section.key === sectionKey);
    if (nextText !== currentSection?.text) {
      const nextTextSections = textSections.map(section =>
        section.key === sectionKey ? { ...section, text: nextText, edited: true } : section
      );
      setTextSections(nextTextSections);
      markStep4Edited(nextTextSections);
    }
    setEditing(null);
    savedSelectionRef.current = null;
  };

  const cancelEditingSection = () => {
    setEditing(null);
    savedSelectionRef.current = null;
  };

  const handleRegenerate = (sectionKey) => {
    setRegenerateModal({
      key: sectionKey,
      title: textSections.find(s => s.key === sectionKey)?.title || sectionKey
    });
  };

  const confirmRegenerate = async () => {
    if (!regenerateModal) return;

    const sectionKey = regenerateModal.key;
    setRegeneratingKey(sectionKey);
    setRegenerateModal(null);

    try {
      const narrative = narrativeOptions[selectedNarrative] || { title: '', desc: '' };
      const narrativeRhythm = currentProject?.llmParams?.narrative_rhythm || null;
      const regularUnits = (units || []).filter(u => u.tag !== '序章' && u.tag !== '尾声');
      const exhibitionTitle =
        currentProject?.exhibitionTitle ||
        currentProject?.llmParams?.exhibition_title ||
        currentProject?.title ||
        narrative?.title ||
        '展览';

      if (sectionKey === 'preface') {
        const response = await api.ai.generatePreface(
          exhibitionTitle,
          regularUnits.length,
          narrative,
          narrativeRhythm
        );

        const nextTextSections = textSections.map(s =>
          s.key === sectionKey
            ? { ...s, text: response.content || '<p>序言生成失败，请手动编辑</p>', edited: false }
            : s
        );
        setTextSections(nextTextSections);
        markStep4Edited(nextTextSections);
        return;
      }

      if (sectionKey === 'epilogue') {
        const response = await api.ai.generateEpilogue(
          exhibitionTitle,
          regularUnits.length,
          narrative,
          narrativeRhythm
        );

        const nextTextSections = textSections.map(s =>
          s.key === sectionKey
            ? { ...s, text: response.content || '<p>尾声生成失败，请手动编辑</p>', edited: false }
            : s
        );
        setTextSections(nextTextSections);
        markStep4Edited(nextTextSections);
        return;
      }

      const unit = regularUnits[Number(sectionKey)];
      const unitExhibits = keptExhibits?.[sectionKey] || [];
      const response = await api.ai.generateTextSection({
        unit: unit,
        exhibits: unitExhibits,
        narrative: narrative,
        narrative_rhythm: narrativeRhythm,
      });

      let content = response.content || '';
      let exhibitSummaries = [];
      let summary = '';

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
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

      const nextTextSections = textSections.map(s =>
        s.key === sectionKey
          ? { ...s, text: content + summary, exhibits: exhibitSummaries, edited: false }
          : s
      );
      setTextSections(nextTextSections);
      markStep4Edited(nextTextSections);
    } catch (error) {
      console.error('重新生成文本失败:', error);
    } finally {
      setRegeneratingKey(null);
    }
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

      {textSections.map((sec, i) => (
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
            </div>
            <span
              onClick={() => handleRegenerate(sec.key)}
              style={{ color: C.accentPrimary, cursor: "pointer", fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
              disabled={regeneratingKey !== null}
            >
              <RefreshIcon /> 重新生成
            </span>
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
                <Btn variant="ghost" onClick={cancelEditingSection}>取消</Btn>
                <Btn onClick={() => saveEditingSection(sec.key)}>确定保存</Btn>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditing(sec.key)}
              style={{
                padding: "16px 18px", borderRadius: 16, cursor: "text",
                background: sec.edited ? C.humanEdited : C.aiGenerated,
                fontSize: 14, lineHeight: 1.8, color: C.textPrimary, fontFamily: "var(--font-serif)",
                border: `1px solid ${sec.edited ? C.accentSecondary + "44" : C.accentPrimary + "22"}`,
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(sec.text) }}
            />
          )}

          {sec.key !== 'preface' && sec.key !== 'epilogue' && (() => {
            const unitId = sec.key;
            const exhibitsForSection = keptExhibits?.[unitId] || [];
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
      ))}

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
            请先确认各段文字的表述、结构与学术准确性，再进入最终交付页。
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={goPrevStep}>← 返回 Step3</Btn>
          <Btn onClick={goNextStep}>确认文本，生成完整大纲 →</Btn>
        </div>
      </div>

      {regenerateModal && (
        <Modal onClose={() => setRegenerateModal(null)}>
          <div style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: C.textPrimary }}>重新生成确认</h3>
            <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20, lineHeight: 1.6 }}>
              确定要重新生成「{regenerateModal.title}」的策展文本吗？<br/>
              当前文本内容将被覆盖，无法恢复。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setRegenerateModal(null)}>取消</Btn>
              <Btn onClick={confirmRegenerate}>确认重新生成</Btn>
            </div>
          </div>
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
              请稍候，系统正在更新当前段落内容。
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
