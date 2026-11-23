import { useState } from 'react';
import { experimentCondition, recordInteraction } from '../utils/experiment';
import { getExhibitIntroduction, getExhibitName, getExhibitTime } from '../utils/exhibitFields';
import { Card, Btn, Divider } from '../components/ui';
import { generateUnitStructure } from '../api/curationApi';
import { api, getReadableApiError } from '../api/client';

export const PageStep1 = ({
  navigateTo,
  goNextStep,
  goPrevStep,
  selectedNarrative,
  setSelectedNarrative,
  currentProject,
  setCurrentProject,
  setCurrentStep,
  setCurrentPage,
  projects,
  setProjects,
  units,
  setUnits,
  generateStep2Data,
  llmParams,
  showToast,
  theme,
}) => {
  const C = theme;
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customLogic, setCustomLogic] = useState('');
  const [generationError, setGenerationError] = useState('');

  const plans = currentProject?.narrativeOptions || [
    { label: "方案 A", title: "未生成方案",
      logic: "请先创建项目",
      units: "-", items: "-" },
  ];
  const condition = experimentCondition(currentProject);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [comparisonError, setComparisonError] = useState('');
  const [fixedInstruction, setFixedInstruction] = useState('');
  const visiblePlans = condition === 'fixed' ? plans.slice(0, 1) : plans;

  const comparePlans = async () => {
    setComparing(true);
    setComparisonError('');
    const details = { task: 'narrative_direction', mode: 'selection', state: { direction_confirmed: false } };
    void recordInteraction(currentProject, 1, 'request_start', details);
    try {
      const records = (currentProject.llmParams?.exhibits || currentProject.uploadedExhibits || [])
        .map((item, index) => ({
          key: String(index), name: getExhibitName(item), date: getExhibitTime(item),
          description: getExhibitIntroduction(item),
        })).filter(item => item.name).slice(0, 200);
      const overviews = await api.ai.compareNarratives({
        options: plans, records, unit_count: Number(currentProject.llmParams?.advanced_settings?.unitCount || 3),
      });
      setComparison({ projectId: currentProject.id, plans, overviews });
      void recordInteraction(currentProject, 1, 'generation_result', { ...details, outcome: 'ready' });
    } catch (error) {
      setComparisonError('方案概要生成失败，请重试。');
      void recordInteraction(currentProject, 1, 'generation_result', { ...details, outcome: 'failed' });
    } finally {
      setComparing(false);
    }
  };

  const effectiveIndex = condition === 'fixed' ? 0 : selectedNarrative;
  const selectedPlan = effectiveIndex != null ? visiblePlans[effectiveIndex] : null;
  const activeComparison = comparison?.projectId === currentProject?.id && comparison?.plans === plans ? comparison.overviews : null;
  const canConfirmNarrative = !!selectedPlan && !isGenerating;
  const displayExhibitionTitle =
    selectedPlan?.title ||
    currentProject?.llmParams?.exhibition_title ||
    currentProject?.title ||
    '未命名策展项目';

  const handleSelectPlan = (index) => {
    const nextPlan = plans?.[index];
    setSelectedNarrative(index);
    if (currentProject && nextPlan) {
      const updatedProject = {
        ...currentProject,
        selectedNarrative: index,
        narrative: nextPlan,
      };
      setCurrentProject(updatedProject);
      setProjects(projects.map(project => project.id === currentProject.id ? updatedProject : project));
    }
  };

  const handleConfirm = async () => {
    if (!currentProject || !currentProject.llmParams) {
      showToast?.('请先创建项目', 'warning');
      return;
    }

    if (!selectedPlan) {
      showToast?.('请先选择一个叙事方向', 'info');
      return;
    }

    const overview = activeComparison?.[effectiveIndex];
    const addition = [
      overview?.units?.map(unit => `${unit.title}：${unit.claim}（展品：${unit.exhibits.join('、')}）`).join('\n'),
      condition === 'fixed' ? fixedInstruction.trim() : '',
    ].filter(Boolean).join('\n');
    const confirmedPlan = addition ? { ...selectedPlan, logic: [selectedPlan.logic, addition].join('\n') } : selectedPlan;
    const nextPlans = plans.map((plan, index) => index === effectiveIndex ? confirmedPlan : plan);
    const projectTitle =
      currentProject?.llmParams?.exhibition_title ||
      currentProject?.exhibitionTitle ||
      selectedPlan?.title ||
      '未命名策展项目';

    if (currentProject.id) {
      try {
        await api.projects.update(currentProject.id, {
          title: projectTitle,
          selected_narrative: effectiveIndex,
          step: 2,
          narrative: confirmedPlan,
          narrative_options: nextPlans,
        });
      } catch (error) {
        console.error('更新项目失败:', error);
      }
    }

    void recordInteraction(currentProject, 1, 'candidate_disposition', {
      task: 'narrative_direction', outcome: 'accepted', index: effectiveIndex, revised: Boolean(fixedInstruction.trim()),
    });
    setSelectedNarrative(effectiveIndex);
    setGenerationError('');
    setIsGenerating(true);

    try {
      const params = {
        selectedNarrative: effectiveIndex,
        narrativeOptions: nextPlans,
        exhibits: currentProject.llmParams.exhibits,
        additional_intent: currentProject.llmParams.additional_intent,
        narrative_rhythm: currentProject.llmParams.narrative_rhythm,
        advanced_settings: currentProject.llmParams.advanced_settings,
      };

      const result = await generateUnitStructure(params);

      if (result.success) {
        const updatedProject = {
          ...currentProject,
          title: projectTitle,
          selectedNarrative: effectiveIndex,
          narrative: confirmedPlan,
          narrativeOptions: nextPlans,
          step: 2,
          units: result.data.units,
          textSections: result.data.textSections,
          exhibitRecommendations: result.data.exhibitRecommendations,
        };

        setCurrentProject(updatedProject);
        setProjects(projects.map(p => p.id === currentProject.id ? updatedProject : p));
        setUnits(result.data.units || []);

        setCurrentStep(2);
        setCurrentPage('step2');
      } else {
        const message = result.error || '单元结构生成失败：请重新生成本步';
        setGenerationError(message);
        showToast?.(message, 'error', 5000);
      }
    } catch (error) {
      console.error('生成失败:', error);
      const message = getReadableApiError(error, '单元结构生成失败');
      setGenerationError(message);
      showToast?.(message, 'error', 5000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomDirection = () => {
    setShowCustomModal(true);
  };

  const handleSaveCustom = () => {
    if (!customTitle.trim() || !customLogic.trim()) {
      alert('请填写完整的叙事方向');
      return;
    }

    const customPlan = {
      label: "自定义",
      title: customTitle,
      logic: customLogic,
    };

    const newNarrativeOptions = [...(currentProject?.narrativeOptions || []), customPlan];
    const customIndex = newNarrativeOptions.length - 1;

    const updatedProject = {
      ...currentProject,
      narrativeOptions: newNarrativeOptions,
      selectedNarrative: customIndex,
    };

    setCurrentProject(updatedProject);
    setProjects(projects.map(p => p.id === currentProject.id ? updatedProject : p));
    setSelectedNarrative(customIndex);
    setShowCustomModal(false);
    setCustomTitle('');
    setCustomLogic('');
  };

  const handleCustomCancel = () => {
    setShowCustomModal(false);
    setCustomTitle('');
    setCustomLogic('');
  };

  const infoCardStyle = {
    padding: "14px 16px",
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    background: C.bgElevated || C.bgSecondary,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  };

  return (
    <main style={{ padding: "28px 36px" }}>
      <div style={{
        padding: "24px 28px",
        borderRadius: 24,
        border: `1px solid ${C.border}`,
        background: `linear-gradient(180deg, ${C.bgElevated || C.bgSecondary} 0%, ${C.bgSecondary} 100%)`,
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        marginBottom: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
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
              Step 1 / 5
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", margin: 0 }}>
              选择叙事方向
            </h1>
            <p style={{ color: C.textSecondary, fontSize: 14, margin: "10px 0 0", lineHeight: 1.8, maxWidth: 720 }}>
              {condition === 'fixed' ? '由人工智能起草一份叙事方向，策展人可以补充修改意见。' : 'AI 已基于当前展品与策展意图生成叙事方案。你可以选择一个作为主线，或新增自定义方向。'}
            </p>
          </div>
          <button
            onClick={handleCustomDirection} hidden={condition === 'fixed'}
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              background: C.bgPrimary,
              color: C.accentPrimary,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              boxShadow: "0 6px 14px rgba(15, 23, 42, 0.04)",
              whiteSpace: "nowrap",
            }}
          >
            + 自定义叙事方向
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 20 }}>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>展览题目</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, lineHeight: 1.6 }}>
              {displayExhibitionTitle}
            </div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>展品规模</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
              {currentProject?.exhibitCount || currentProject?.llmParams?.exhibits?.length || 0} 件
            </div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>目标单元数</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
              {currentProject?.llmParams?.advanced_settings?.unitCount || 3} 个
            </div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>当前选择</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
              {selectedPlan?.label || '尚未选择'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>
            AI 生成方案
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
            选择最契合策展目标的一条主线，再进入单元结构阶段细化。
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.textSecondary }}>
          共 {plans.length} 个候选方向
        </div>
      </div>

      {condition === 'fixed' && <label style={{ display: 'block', marginBottom: 16 }}>
        叙事方向修改意见 <input value={fixedInstruction} onChange={event => setFixedInstruction(event.target.value)} />
      </label>}
      {condition === 'model' && plans.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <Btn small disabled={comparing} onClick={comparePlans}>{comparing ? '正在生成概要…' : '对照方案概要'}</Btn>
          {comparisonError && <p role="alert">{comparisonError}</p>}
          {activeComparison && <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', textAlign: 'left' }}>
              <thead><tr><th>比较维度</th>{plans.map((plan, index) => <th key={index}>{plan.label} {plan.title}</th>)}</tr></thead>
              <tbody>
                <tr><th>单元划分</th>{activeComparison.map((item, index) => <td key={index}>{item.units.map(unit => unit.title).join('、')}</td>)}</tr>
                <tr><th>各单元论点</th>{activeComparison.map((item, index) => <td key={index}>{item.units.map(unit => <p key={unit.title}>{unit.title}：{unit.claim}</p>)}</td>)}</tr>
                <tr><th>拟用展品</th>{activeComparison.map((item, index) => <td key={index}>{item.units.map(unit => <p key={unit.title}>{unit.title}：{unit.exhibits.join('、') || '待补充'}</p>)}</td>)}</tr>
                <tr><th>资料缺口</th>{activeComparison.map((item, index) => <td key={index}>{item.gaps.join('；') || '本次未标出'}</td>)}</tr>
                <tr><th>选择</th>{activeComparison.map((_, index) => <td key={index}><Btn small onClick={() => handleSelectPlan(index)}>选择{plans[index].label}</Btn></td>)}</tr>
              </tbody>
            </table>
          </div>}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        {visiblePlans.map((p, i) => (
          <Card key={i} highlighted={effectiveIndex === i} style={{
            cursor: "pointer",
            height: "100%",
            overflow: "hidden",
            borderColor: effectiveIndex === i ? `${C.accentPrimary}38` : `${C.border}`,
            boxShadow: effectiveIndex === i ? "0 20px 42px rgba(38, 72, 112, 0.10)" : "0 12px 26px rgba(15, 23, 42, 0.04)",
          }}
            onClick={() => handleSelectPlan(i)}>
            <div style={{
              height: 4,
              background: effectiveIndex === i
                ? `linear-gradient(90deg, ${C.accentPrimary} 0%, ${C.accentSecondary} 100%)`
                : `${C.border}`,
            }} />
            <div style={{
              padding: 22,
              background: effectiveIndex === i ? `${C.aiGenerated}` : C.bgElevated || "transparent",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div style={{
                  fontSize: 11,
                  color: effectiveIndex === i ? C.accentPrimary : C.textSecondary,
                  fontWeight: 700,
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: effectiveIndex === i ? `${C.accentPrimary}12` : C.bgPrimary,
                  border: `1px solid ${effectiveIndex === i ? `${C.accentPrimary}18` : C.border}`,
                }}>
                  {p.label}
                </div>
                {effectiveIndex === i && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.accentPrimary }}>
                    已选中
                  </div>
                )}
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, color: C.textPrimary, marginBottom: 12, fontFamily: "var(--font-serif)", lineHeight: 1.55 }}>
                {p.title}
              </div>
              <Divider style={{ margin: "0 0 14px" }} />
              <div style={{ fontSize: 12, color: C.textSecondary, fontWeight: 700, marginBottom: 8 }}>核心逻辑</div>
              <div style={{ fontSize: 13, color: C.textPrimary, marginBottom: 18, lineHeight: 1.85, flex: 1 }}>
                {p.logic}
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
                marginTop: "auto",
              }}>
                <div style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: C.bgPrimary,
                  border: `1px solid ${C.border}`,
                }}>
                  <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4 }}>预计单元数</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>
                    {currentProject?.llmParams?.advanced_settings?.unitCount || 3} 个
                  </div>
                </div>
                <div style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: C.bgPrimary,
                  border: `1px solid ${C.border}`,
                }}>
                  <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4 }}>涉及展品</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>
                    {currentProject?.exhibitCount || 0} 件
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{
        marginTop: 22,
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
            {selectedPlan?.title || '请选择一个叙事方向'}
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
            确认后将基于该方案生成单元结构，并延续到后续展品分配与文案生成。
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={() => navigateTo("p0")}>← 返回</Btn>
          <Btn onClick={handleConfirm} disabled={!canConfirmNarrative}>
            {isGenerating ? '正在生成单元结构...' : '确认方向，进入下一步 →'}
          </Btn>
        </div>
        {generationError && (
          <div style={{
            flexBasis: '100%',
            marginTop: 4,
            padding: '10px 12px',
            borderRadius: 12,
            background: `${C.danger || '#B91C1C'}10`,
            color: C.danger || '#B91C1C',
            fontSize: 12,
            lineHeight: 1.6,
          }}>
            {generationError}
          </div>
        )}
      </div>

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
              width: 52, height: 52, border: `4px solid ${C.border}`, borderTopColor: C.accentPrimary,
              borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto",
            }} />
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
            <div style={{ marginTop: 20, fontSize: 16, color: C.textPrimary, fontWeight: 700 }}>
              AI 正在生成单元结构
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>
              正在把你选中的叙事方向转化为可执行的策展结构，请稍候片刻。
            </div>
          </div>
        </div>
      )}

      {showCustomModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.28)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
          backdropFilter: "blur(4px)",
          padding: 16,
        }}>
          <div style={{
            background: C.bgPrimary,
            borderRadius: 22,
            padding: 24,
            width: 520,
            maxWidth: "100%",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.14)",
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ marginBottom: 18 }}>
              <h3 style={{ fontWeight: 700, fontSize: 18, margin: 0, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>
                自定义叙事方向
              </h3>
              <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 6 }}>
                你可以补充一个新的展览标题和核心叙事逻辑，作为自定义方案加入候选列表。
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 8 }}>
                展览题目
              </div>
              <input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="例如：青铜之路：丝路文明的金属叙事"
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 14,
                  border: `1px solid ${C.border}`, fontSize: 14,
                  outline: "none", boxSizing: "border-box", background: C.bgElevated || "#fff",
                }}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 8 }}>
                核心逻辑
              </div>
              <textarea
                value={customLogic}
                onChange={(e) => setCustomLogic(e.target.value)}
                placeholder="描述展览的叙事逻辑、核心观点和希望观众感受到的推进方式..."
                rows={5}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 14, resize: "vertical",
                  border: `1px solid ${C.border}`, fontSize: 13,
                  outline: "none", boxSizing: "border-box", fontFamily: "var(--font-ui)",
                  background: C.bgElevated || "#fff", lineHeight: 1.8,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={handleCustomCancel}>取消</Btn>
              <Btn onClick={handleSaveCustom}>保存方案</Btn>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
