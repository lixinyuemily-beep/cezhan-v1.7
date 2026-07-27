import { useState, useEffect } from 'react';
import { Btn, Tag } from '../components/ui';
import { api } from '../api/client';

export const PageStep2 = ({
  navigateTo,
  goNextStep,
  goPrevStep,
  units,
  setUnits,
  currentProject,
  setCurrentProject,
  projects,
  setProjects,
  setCurrentStep,
  setCurrentPage,
  setKeptExhibits,
  keptExhibits,
  showToast,
  theme,
}) => {
  const C = theme;
  const [editingUnit, setEditingUnit] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleteModal, setDeleteModal] = useState(null);
  const [isDistributing, setIsDistributing] = useState(false);

  const getUnitNarrative = (unit) => String(unit?.narrative || unit?.desc || unit?.description || '').trim();
  const normalizeLegacyFallbackUnits = (unitList = []) => {
    const titles = unitList.map(unit => String(unit?.title || '').trim());
    const isLegacyFallback =
      unitList.length === 4 &&
      titles[0] === '开篇' &&
      titles[1] === '核心展示' &&
      titles[2] === '文化解读' &&
      titles[3] === '总结';

    if (!isLegacyFallback) {
      return unitList;
    }

    return unitList.map((unit, index) => {
      if (index === 0) {
        const narrative = getUnitNarrative(unit) || '交代主题缘起与观看入口，为正文展开蓄势。';
        return {
          ...unit,
          tag: '序章',
          tagColor: '#C8873A',
          title: '序章',
          desc: narrative,
          narrative,
          description: unit?.description || narrative,
          itemsMin: 0,
          itemsMax: 0,
          items: 0,
        };
      }

      if (index === unitList.length - 1) {
        const narrative = getUnitNarrative(unit) || '回望全文主旨，完成情绪收束与余韵延展。';
        return {
          ...unit,
          tag: '尾声',
          tagColor: '#2D7D52',
          title: '尾声',
          desc: narrative,
          narrative,
          description: unit?.description || narrative,
          itemsMin: 0,
          itemsMax: 0,
          items: 0,
        };
      }

      return unit;
    });
  };

  useEffect(() => {
    if (currentProject) {
      if (currentProject.units && currentProject.units.length > 0 && (!units || units.length === 0)) {
        const normalizedUnits = normalizeLegacyFallbackUnits(currentProject.units);
        setUnits(normalizedUnits);
        if (normalizedUnits !== currentProject.units) {
          updateProjectInStore(normalizedUnits);
        }
      }
      if (currentProject.keptExhibits && Object.keys(currentProject.keptExhibits).length > 0 && (!keptExhibits || Object.keys(keptExhibits).length === 0)) {
        setKeptExhibits(currentProject.keptExhibits);
      }
    }
  }, [currentProject]);

  const tagOptions = [
    { tag: "序章", tagColor: "#C8873A" },
    { tag: "第一单元", tagColor: "#2B5F8E" },
    { tag: "第二单元", tagColor: "#2B5F8E" },
    { tag: "第三单元", tagColor: "#2B5F8E" },
    { tag: "第四单元", tagColor: "#2B5F8E" },
    { tag: "第五单元", tagColor: "#2B5F8E" },
    { tag: "第六单元", tagColor: "#2B5F8E" },
    { tag: "第七单元", tagColor: "#2B5F8E" },
    { tag: "第八单元", tagColor: "#2B5F8E" },
    { tag: "尾声", tagColor: "#2D7D52" },
  ];

  const toChineseNum = (num) => {
    const cn = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
    if (num <= 10) return cn[num];
    if (num <= 99) {
      const shi = Math.floor(num / 10);
      const ge = num % 10;
      return (shi > 1 ? cn[shi] : "") + "十" + (ge > 0 ? cn[ge] : "");
    }
    return num.toString();
  };

  const getTagOrder = (tag) => {
    if (tag === "序章") return 0;
    if (tag === "尾声") return 100;
    const match = tag.match(/第(.*)单元/);
    if (match) {
      const numStr = match[1];
      const numMap = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
      return numMap[numStr] ? numMap[numStr] + 1 : 50;
    }
    return 50;
  };

  const sortUnitsByTag = (unitList) => {
    const sorted = [...unitList].sort((a, b) => getTagOrder(a.tag) - getTagOrder(b.tag));
    return sorted.map((u, idx) => ({ ...u, id: u.id || `unit-${Date.now()}-${idx}` }));
  };

  const getComparableUnit = (unit = {}) => ({
    title: String(unit.title || '').trim(),
    tag: String(unit.tag || '').trim(),
    tagColor: unit.tagColor || '',
    desc: getUnitNarrative(unit),
    itemsMin: Number(unit.itemsMin || 0),
    itemsMax: Number(unit.itemsMax ?? unit.items ?? 0),
    items: Number(unit.items ?? unit.itemsMax ?? 0),
  });

  const handleEditUnit = (unit, index) => {
    const isPrologueOrEpilogue = unit.tag === '序章' || unit.tag === '尾声';
    setEditingUnit({ ...unit, index });
    setEditForm({
      title: unit.title,
      tag: unit.tag,
      tagColor: unit.tagColor,
      desc: getUnitNarrative(unit),
      itemsMin: isPrologueOrEpilogue ? 0 : (unit.itemsMin || Math.min(unit.items || 5, 5)),
      itemsMax: isPrologueOrEpilogue ? 0 : (unit.itemsMax || unit.items || 5),
      items: isPrologueOrEpilogue ? 0 : (unit.itemsMax || unit.items || 5)
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) {
      alert('请填写单元标题');
      return;
    }

    const isPrologueOrEpilogue = editForm.tag === '序章' || editForm.tag === '尾声';
    const normalizedItemsMin = isPrologueOrEpilogue ? 0 : Number(editForm.itemsMin || 0);
    const normalizedItemsMax = isPrologueOrEpilogue
      ? 0
      : Math.max(normalizedItemsMin, Number(editForm.itemsMax || normalizedItemsMin));
    const newUnits = [...units];
    newUnits[editingUnit.index] = {
      ...newUnits[editingUnit.index],
      title: editForm.title,
      tag: editForm.tag,
      tagColor: editForm.tagColor,
      desc: editForm.desc,
      narrative: editForm.desc,
      description: editForm.desc,
      itemsMin: normalizedItemsMin,
      itemsMax: normalizedItemsMax,
      items: normalizedItemsMax,
    };
    const beforeUnit = getComparableUnit(units[editingUnit.index]);
    const afterUnit = getComparableUnit(newUnits[editingUnit.index]);
    if (JSON.stringify(beforeUnit) === JSON.stringify(afterUnit)) {
      setEditingUnit(null);
      setEditForm({});
      return;
    }

    const sortedUnits = sortUnitsByTag(newUnits);
    setUnits(sortedUnits);
    updateProjectInStore(sortedUnits, 2);
    if (currentProject?.id) {
      try {
        await api.projects.update(currentProject.id, {
          step: 2,
          units: sortedUnits,
        });
      } catch (error) {
        console.error('保存单元编辑失败:', error);
        showToast?.('单元已在页面更新，但保存到服务器失败', 'error');
      }
    }
    setEditingUnit(null);
    setEditForm({});
  };

  const handleCancelEdit = () => {
    setEditingUnit(null);
    setEditForm({});
  };

  const persistStep2Units = async (newUnits) => {
    if (!currentProject?.id) return;
    try {
      await api.projects.update(currentProject.id, {
        step: 2,
        units: newUnits,
      });
    } catch (error) {
      console.error('保存单元结构失败:', error);
      showToast?.('单元已在页面更新，但保存到服务器失败', 'error');
    }
  };

  const handleAddUnit = () => {
    const regularUnitCount = units.filter(u => u.tag !== '序章' && u.tag !== '尾声').length;
    const newUnit = {
      id: Date.now(),
      tag: `第${toChineseNum(regularUnitCount + 1)}单元`,
      tagColor: "#2B5F8E",
      title: "新单元标题",
      desc: "请填写叙事定位",
      narrative: "请填写叙事定位",
      description: "请填写叙事定位",
      itemsMin: 2,
      itemsMax: 5,
      items: 5
    };
    const newUnits = sortUnitsByTag([...units, newUnit]);
    setUnits(newUnits);
    updateProjectInStore(newUnits, 2);
    persistStep2Units(newUnits);
  };

  const handleDeleteUnit = (index) => {
    setDeleteModal({ index, name: units[index].title });
  };

  const confirmDelete = () => {
    if (deleteModal) {
      const newUnits = sortUnitsByTag(units.filter((_, i) => i !== deleteModal.index));
      setUnits(newUnits);
      updateProjectInStore(newUnits, 2);
      persistStep2Units(newUnits);
      setDeleteModal(null);
    }
  };

  const updateProjectInStore = (newUnits, stepOverride = currentProject?.step) => {
    if (currentProject) {
      const updatedProject = { ...currentProject, step: stepOverride, units: newUnits };
      setCurrentProject(updatedProject);
      setProjects(projects.map(p => p.id === currentProject.id ? updatedProject : p));
    }
  };

  const hasEmptyMainUnitRecommendations = (result, recommendationUnits) => {
    if (!result?.recommendations) return true;
    return recommendationUnits.some((unit, index) => {
      const unitKey = String(unit.id ?? index);
      const recommended = result.recommendations[unitKey];
      return !Array.isArray(recommended) || recommended.length === 0;
    });
  };

  const requestRecommendationsWithRetry = async (payload, recommendationUnits, maxRetries = 2) => {
    let lastResult = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      lastResult = await api.ai.recommendExhibitsBatch(payload);
      if (!hasEmptyMainUnitRecommendations(lastResult, recommendationUnits)) {
        return lastResult;
      }
      console.warn(`展品推荐存在空正文单元，自动重试 ${attempt + 1}/${maxRetries + 1}`, lastResult);
    }
    throw new Error('部分正文单元未获得推荐展品，请调整单元数量、展品数量范围或展品清单后重试');
  };

  const handleNext = async () => {
    if (!currentProject?.llmParams?.exhibits || currentProject.llmParams.exhibits.length === 0) {
      showToast('没有展品数据，无法分配', 'error');
      return;
    }

    setIsDistributing(true);

    try {
      const unitsWithItems = units.map(u => {
        const isPrologueOrEpilogue = u.tag === '序章' || u.tag === '尾声';
        return {
          ...u,
          itemsMin: isPrologueOrEpilogue ? 0 : (u.itemsMin || Math.min(u.items || 5, 5)),
          itemsMax: isPrologueOrEpilogue ? 0 : (u.itemsMax || u.items || 5),
          items: isPrologueOrEpilogue ? 0 : (u.itemsMax || u.items || 5),
        };
      });
      const mainUnits = unitsWithItems.filter(u => u.tag !== '序章' && u.tag !== '尾声');
      const recommendationUnits = mainUnits.map(u => ({
        ...u,
        itemsMin: u.itemsMin || Math.min(u.items || 5, 5),
        itemsMax: u.itemsMax || u.items || 5,
        items: u.itemsMax || u.items || 5
      }));

      console.log('Step2 handleNext - unitsWithItems:', recommendationUnits);
      console.log('Step2 handleNext - exhibit_pool count:', currentProject.llmParams.exhibits.length);

      const recommendPayload = {
        units: recommendationUnits,
        exhibit_pool: currentProject.llmParams.exhibits,
        narrative: currentProject.narrative || { title: '', desc: '' }
      };
      const result = await requestRecommendationsWithRetry(recommendPayload, recommendationUnits);

      console.log('AI返回的推荐结果:', result);
      console.log('AI返回的leftovers数量:', result.leftovers?.length || 0);

      if (result.recommendations) {
        const newKeptExhibits = result.recommendations;
        if (result.leftovers && result.leftovers.length > 0) {
          newKeptExhibits['_leftovers'] = result.leftovers.map(ex => ({ ...ex, kept: false, ctx: '备选', src: '备选' }));
        }
        setKeptExhibits(newKeptExhibits);

        const updatedProject = { ...currentProject, step: 3, units: unitsWithItems, keptExhibits: newKeptExhibits };
        setUnits(unitsWithItems);
        setCurrentProject(updatedProject);
        setProjects(projects.map(p => p.id === currentProject.id ? updatedProject : p));

        if (currentProject.id) {
          try {
            await api.projects.update(currentProject.id, {
              step: 3,
              units: unitsWithItems,
              kept_exhibits: newKeptExhibits,
            });
          } catch (e) {
            console.error('保存step失败:', e);
          }
        }

        setCurrentStep(3);
        setCurrentPage('step3');
      } else {
        throw new Error('AI推荐失败');
      }
    } catch (error) {
      console.error('分配展品失败:', error);
      showToast('分配展品失败，请重试', 'error');
    } finally {
      setIsDistributing(false);
    }
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
          <div style={{ maxWidth: 820 }}>
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
              Step 2 / 5
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", margin: 0 }}>
              审核并调整单元结构
            </h1>
            <p style={{ color: C.textSecondary, fontSize: 14, margin: "10px 0 0", lineHeight: 1.8, maxWidth: 720 }}>
              在这一页确认单元顺序、标题、叙事定位和每单元展品数量。确认后，系统会基于这些结构分配展品。
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 20 }}>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>当前叙事方向</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, lineHeight: 1.6 }}>
              {currentProject?.narrative?.label || currentProject?.narrative?.title || '未命名方向'}
            </div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>单元总数</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
              {units.length || 0} 个
            </div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>正文单元</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
              {units.filter(u => u.tag !== '序章' && u.tag !== '尾声').length} 个
            </div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>待分配展品</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
              {currentProject?.llmParams?.exhibits?.length || 0} 件
            </div>
          </div>
        </div>
      </div>

      <div style={{
        borderRadius: 24,
        border: `1px solid ${C.border}`,
        background: C.bgElevated || C.bgSecondary,
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "18px 22px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>
              单元结构草案
            </div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
              可编辑标题、叙事定位与展品数，序章与尾声仅作为结构节点，不分配展品。
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary }}>
            已生成 {units.length || 0} 个结构节点
          </div>
        </div>

        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, userSelect: "none" }}>
        {units.map((u, i) => {
          const isPrologueOrEpilogue = u.tag === '序章' || u.tag === '尾声';
          return (
            <div
              key={u.id || i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: C.bgPrimary,
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                padding: "12px 14px",
                flexWrap: "wrap",
              }}
            >
              <div style={{
                width: 32,
                minHeight: 32,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: C.bgElevated || C.bgSecondary,
                border: `1px solid ${C.border}`,
                fontSize: 14,
                color: C.textPlaceholder,
                userSelect: "none",
                flexShrink: 0,
              }}>☰</div>

              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                  <Tag label={u.tag} color={u.tagColor} />
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary, fontFamily: "var(--font-serif)", lineHeight: 1.45 }}>
                    {u.title}
                  </div>
                </div>
                <div style={{
                  fontSize: 12,
                  color: C.textSecondary,
                  lineHeight: 1.7,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}>
                  叙事定位：{getUnitNarrative(u) || '暂无'}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <div style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  background: C.bgElevated || C.bgSecondary,
                  border: `1px solid ${C.border}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, whiteSpace: "nowrap" }}>
                    {isPrologueOrEpilogue ? '不分配展品' : `${u.itemsMin || Math.min(u.items || 5, 5)} - ${u.itemsMax || u.items || 5} 件展品`}
                  </div>
                </div>

                <Btn small variant="ghost" onClick={() => handleEditUnit(u, i)}>编辑</Btn>
                {!isPrologueOrEpilogue && (
                  <Btn small variant="ghost" onClick={() => handleDeleteUnit(i)} style={{ color: '#b7553d' }}>删除</Btn>
                )}
              </div>
            </div>
        )})}
          <button
            onClick={handleAddUnit}
            style={{
              alignSelf: "flex-start",
              padding: "7px 10px",
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              background: C.bgElevated || C.bgSecondary,
              color: C.accentPrimary,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 6,
            }}
          >
            <span style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `${C.accentPrimary}10`,
              border: `1px solid ${C.accentPrimary}16`,
              fontSize: 13,
              lineHeight: 1,
              flexShrink: 0,
            }}>+</span>
            <span>添加单元</span>
          </button>
        </div>
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
            结构确认后进入展品分配
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
            系统会根据当前单元标题、叙事定位和展品数量，为每个正文单元推荐展品。
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={() => navigateTo("step1")}>← 返回</Btn>
          <Btn onClick={handleNext} disabled={isDistributing}>
            {isDistributing ? "正在分配展品..." : "确认单元结构，进入下一步 →"}
          </Btn>
        </div>
      </div>

      {editingUnit && (
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
            width: 540,
            maxWidth: "100%",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.14)",
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 18, margin: 0, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>
              编辑单元
              </h3>
              <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 6 }}>
                你可以调整单元在整条叙事链中的定位与展品承载量。
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 6 }}>
                单元标签
              </div>
              <select
                value={editForm.tag}
                onChange={(e) => {
                  const selected = tagOptions.find(t => t.tag === e.target.value);
                  setEditForm({
                    ...editForm,
                    tag: e.target.value,
                    tagColor: selected?.tagColor || "#2B5F8E"
                  });
                }}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 14,
                  border: `1px solid ${C.border}`, fontSize: 14,
                  outline: "none", boxSizing: "border-box", background: C.bgElevated || "#fff",
                }}
              >
                {tagOptions.map(opt => (
                  <option key={opt.tag} value={opt.tag}>{opt.tag}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 6 }}>
                单元标题
              </div>
              <input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="例如：文明的序章"
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 14,
                  border: `1px solid ${C.border}`, fontSize: 14,
                  outline: "none", boxSizing: "border-box", background: C.bgElevated || "#fff",
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 6 }}>
                叙事定位
              </div>
              <textarea
                value={editForm.desc}
                onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })}
                placeholder="描述这个单元的叙事定位和核心内容..."
                rows={3}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 14, resize: "vertical",
                  border: `1px solid ${C.border}`, fontSize: 13,
                  outline: "none", boxSizing: "border-box", fontFamily: "var(--font-ui)",
                  background: C.bgElevated || "#fff", lineHeight: 1.8,
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 6 }}>
                展品数量
              </div>
              {editForm.tag === '序章' || editForm.tag === '尾声' ? (
                <div style={{ color: C.textSecondary, fontSize: 13 }}>
                  序章和尾声不分配展品
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textSecondary }}>
                    最少
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={editForm.itemsMin ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!/^\d*$/.test(value)) return;
                        setEditForm({ ...editForm, itemsMin: value });
                      }}
                      onBlur={() => {
                        const nextMin = Math.max(0, parseInt(editForm.itemsMin || '0', 10));
                        const nextMax = Math.max(nextMin, Number(editForm.itemsMax || 0));
                        setEditForm({ ...editForm, itemsMin: nextMin, itemsMax: nextMax, items: nextMax });
                      }}
                      style={{ width: 56, padding: "8px 10px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.bgElevated || "#fff" }}
                    />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textSecondary }}>
                    最多
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={editForm.itemsMax ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!/^\d*$/.test(value)) return;
                        setEditForm({ ...editForm, itemsMax: value });
                      }}
                      onBlur={() => {
                        const nextMin = Number(editForm.itemsMin || 0);
                        const nextMax = Math.max(nextMin, parseInt(editForm.itemsMax || `${nextMin}`, 10));
                        setEditForm({ ...editForm, itemsMax: nextMax, items: nextMax });
                      }}
                      style={{ width: 56, padding: "8px 10px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.bgElevated || "#fff" }}
                    />
                  </label>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={handleCancelEdit}>取消</Btn>
              <Btn onClick={handleSaveEdit}>保存</Btn>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.34)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
          backdropFilter: "blur(4px)",
          padding: 16,
        }}>
          <div style={{ background: C.bgPrimary, borderRadius: 22, padding: 24, width: 380, maxWidth: "100%", border: `1px solid ${C.border}`, boxShadow: "0 24px 60px rgba(15, 23, 42, 0.14)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>确认删除</h3>
            <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>
              确定要删除单元「{deleteModal.name}」吗？此操作可撤销。
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setDeleteModal(null)}>取消</Btn>
              <Btn variant="danger" onClick={confirmDelete}>确认删除</Btn>
            </div>
          </div>
        </div>
      )}

      {isDistributing && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(245, 242, 236, 0.84)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          zIndex: 350, backdropFilter: "blur(4px)",
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
              正在分配展品
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>
              AI 正在依据当前单元结构，为每个单元匹配更合适的展品组合。
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
