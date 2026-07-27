import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Card, Btn, Divider, Tag } from '../components/ui';
import { api } from '../api/client';
import {
  getExhibitFullImageUrl,
  getExhibitImage,
  getExhibitIntroduction,
  getExhibitMaterial,
  getExhibitName,
  getExhibitOther,
  getExhibitPlace,
  getExhibitTime,
  isStructureOnlyUnit,
  normalizeImportedExhibit,
  normalizePreviewExhibitGroups,
} from '../utils/exhibitFields';

function ExhibitThumb({ exhibit, theme, size = 72 }) {
  const imageUrl = getExhibitImage(exhibit);
  const previewUrl = getExhibitFullImageUrl(exhibit) || imageUrl;
  const name = getExhibitName(exhibit);
  const [previewPosition, setPreviewPosition] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  if (!imageUrl || imageFailed) {
    return (
      <div
        title={imageFailed ? '图片加载失败' : '暂无图片'}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          border: `1px solid ${theme.border}`,
          background: theme.bgSecondary,
          color: theme.textSecondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          flexShrink: 0,
        }}
      >
        无图
      </div>
    );
  }

  const showPreview = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const previewWidth = 256;
    const previewHeight = 300;
    const preferLeft = rect.right + 12 + previewWidth > window.innerWidth;
    setPreviewPosition({
      top: Math.max(12, Math.min(rect.top, window.innerHeight - previewHeight - 12)),
      left: Math.max(12, preferLeft ? rect.left - previewWidth - 12 : rect.right + 12),
    });
  };

  const previewLayer = previewPosition && !previewFailed ? createPortal(
    <div
      style={{
        position: 'fixed',
        left: previewPosition.left,
        top: previewPosition.top,
        zIndex: 2147483647,
        padding: 8,
        background: theme.bgPrimary,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        boxShadow: '0 18px 42px rgba(15, 23, 42, 0.18)',
        pointerEvents: 'none',
      }}
    >
      <img
        src={previewUrl}
        alt={name}
        onError={() => setPreviewFailed(true)}
        style={{ width: 240, maxHeight: 240, objectFit: 'contain', display: 'block', borderRadius: 8 }}
      />
      <div style={{ marginTop: 8, fontSize: 12, color: theme.textPrimary, maxWidth: 240, lineHeight: 1.5 }}>
        {name}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div
        onMouseEnter={showPreview}
        onMouseMove={showPreview}
        onMouseLeave={() => setPreviewPosition(null)}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          overflow: "hidden",
          border: `1px solid ${theme.border}`,
          background: theme.bgSecondary,
          flexShrink: 0,
          cursor: 'zoom-in',
        }}
      >
        <img
          src={imageUrl}
          alt={name}
          onError={() => setImageFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
      {previewLayer}
    </>
  );
}

export const PageStep3 = ({
  navigateTo,
  goNextStep,
  goPrevStep,
  exhibitConfirmations,
  setExhibitConfirmations,
  keptExhibits,
  setKeptExhibits,
  units,
  setUnits,
  currentProject,
  setCurrentProject,
  projects,
  setProjects,
  activeUserId,
  showToast,
  theme,
}) => {
  const C = theme;
  const getUnitNarrative = (unit) => String(unit?.narrative || unit?.desc || unit?.description || '').trim();
  const getUnitKey = (unit, index = 0) => String(unit?.id ?? unit?.unit_id ?? index);
  const [showAlt, setShowAlt] = useState(false);
  const [activeUnitId, setActiveUnitId] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [addFromAltModal, setAddFromAltModal] = useState(null);
  const [manualAddModal, setManualAddModal] = useState(false);
  const [searchModal, setSearchModal] = useState(false);
  const [exhibitsByUnit, setExhibitsByUnit] = useState({});
  const [deletingKey, setDeletingKey] = useState(null);
  const [nextStepModal, setNextStepModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (units.length > 0 && !activeUnitId) {
      setActiveUnitId(getUnitKey(units[0], 0));
    }
  }, [units, activeUnitId]);

  useEffect(() => {
    if (currentProject) {
      if (currentProject.units && currentProject.units.length > 0 && (!units || units.length === 0)) {
        setUnits(currentProject.units);
      }
      if (currentProject.keptExhibits && Object.keys(currentProject.keptExhibits).length > 0 && (!keptExhibits || Object.keys(keptExhibits).length === 0)) {
        const normalizedGroups = normalizePreviewExhibitGroups(currentProject.keptExhibits, currentProject.units || units);
        setKeptExhibits(normalizedGroups);
        setExhibitsByUnit(normalizedGroups);
      }
      if (currentProject.exhibitConfirmations) {
        setExhibitConfirmations(currentProject.exhibitConfirmations);
      }
    }
  }, [currentProject]);

  useEffect(() => {
    if (units.length > 0 && keptExhibits && Object.keys(keptExhibits).length > 0) {
      const normalizedGroups = normalizePreviewExhibitGroups(keptExhibits, units);
      const hasData = units.some((u, index) => normalizedGroups[getUnitKey(u, index)] && normalizedGroups[getUnitKey(u, index)].length > 0);
      if (hasData && Object.keys(exhibitsByUnit).length === 0) {
        setKeptExhibits(normalizedGroups);
        setExhibitsByUnit(normalizedGroups);
      }
    }
  }, [units.length]);

  const activeUnitIndex = units.findIndex((u, index) => getUnitKey(u, index) === activeUnitId);
  const activeUnit = units[activeUnitIndex] || units[0];
  const activeUnitKey = activeUnit ? getUnitKey(activeUnit, Math.max(activeUnitIndex, 0)) : '';
  const activeDataKey = activeUnitId || activeUnitKey;
  const allExhibits = exhibitsByUnit[activeDataKey] || [];
  const keptExhibitsList = keptExhibits[activeDataKey] || [];
  const confirmedCount = Object.keys(exhibitConfirmations).length;
  const mainUnitCount = units.length || 0;
  const isStructureNode = isStructureOnlyUnit(activeUnit);
  const itemCountMin = Number(activeUnit?.itemsMin ?? Math.min(activeUnit?.items || 0, activeUnit?.itemsMax || activeUnit?.items || 0));
  const itemCountMax = Number(activeUnit?.itemsMax ?? activeUnit?.items ?? itemCountMin);
  const hasItemRange = !isStructureNode && itemCountMax > 0;
  const isItemCountInsufficient = hasItemRange && allExhibits.length < itemCountMin;
  const isItemCountExceeded = hasItemRange && allExhibits.length > itemCountMax;
  const infoCardStyle = {
    padding: "14px 16px",
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    background: C.bgElevated || C.bgSecondary,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  };

  const formatUnitDisplayTitle = (unit) => {
    if (!unit) return '请选择单元';
    const tag = String(unit.tag || '').trim();
    const title = String(unit.title || '').trim();
    if (tag && title) return `${tag}：${title}`;
    return title || tag || '未命名单元';
  };

  const markStep3Edited = (serverData = {}, localData = {}) => {
    if (!currentProject) return;
    const updatedProject = {
      ...currentProject,
      ...localData,
      step: 3,
    };
    setCurrentProject?.(updatedProject);
    setProjects?.((projects || []).map(project => project.id === currentProject.id ? updatedProject : project));

    if (currentProject.id) {
      api.projects.update(currentProject.id, {
        step: 3,
        ...serverData,
      }).catch((error) => {
        console.error('保存展品编辑状态失败:', error);
        showToast?.('展品已在页面更新，但保存到服务器失败', 'error');
      });
    }
  };

  const isExhibitKept = (index) => {
    const exhibit = allExhibits[index];
    return keptExhibitsList.some(e => e.id === exhibit.id);
  };

  const handleKeepExhibit = (index) => {
    const exhibit = allExhibits[index];
    if (!exhibit) return;
    setKeptExhibits(prev => {
      const unitKept = prev[activeDataKey] || [];
      if (unitKept.some(e => e.id === exhibit.id)) {
        return prev;
      }
      const nextKeptExhibits = { ...prev, [activeDataKey]: [...unitKept, exhibit] };
      markStep3Edited(
        { kept_exhibits: nextKeptExhibits },
        { keptExhibits: nextKeptExhibits }
      );
      return nextKeptExhibits;
    });
  };

  const handleRemoveExhibit = (index) => {
    const exhibit = allExhibits[index];
    if (!exhibit) return;
    setDeleteModal({ index, name: exhibit.name });
  };

  const confirmDelete = () => {
    if (deleteModal) {
      setDeletingKey(deleteModal.index);
      setTimeout(() => {
        const exhibit = allExhibits[deleteModal.index];
        setExhibitsByUnit(prev => {
          const unitExhibits = [...(prev[activeDataKey] || [])];
          unitExhibits.splice(deleteModal.index, 1);
          return { ...prev, [activeDataKey]: unitExhibits };
        });
        if (exhibit) {
          setKeptExhibits(prev => {
            const unitKept = prev[activeDataKey] || [];
            const nextKeptExhibits = { ...prev, [activeDataKey]: unitKept.filter(e => e.id !== exhibit.id && e.name !== exhibit.name) };
            markStep3Edited(
              { kept_exhibits: nextKeptExhibits },
              { keptExhibits: nextKeptExhibits }
            );
            return nextKeptExhibits;
          });
        }
        setDeleteModal(null);
        setDeletingKey(null);
        showToast('展品已删除', 'success');
      }, 300);
    }
  };

  const handleAddExhibit = (exhibit) => {
    setExhibitsByUnit(prev => {
      const nextExhibitsByUnit = {
        ...prev,
        [activeDataKey]: [...(prev[activeDataKey] || []), { ...exhibit, src: "手动添加" }]
      };
      markStep3Edited(
        { kept_exhibits: nextExhibitsByUnit },
        { keptExhibits: nextExhibitsByUnit }
      );
      return nextExhibitsByUnit;
    });
    showToast('展品添加成功', 'success');
  };

  const handleAddFromAlt = (exhibit, index) => {
    setAddFromAltModal({ exhibit, index });
  };

  const confirmAddFromAlt = () => {
    if (!addFromAltModal) return;
    const { exhibit, index } = addFromAltModal;
    const nextExhibitsByUnit = {
      ...exhibitsByUnit,
      [activeDataKey]: [...(exhibitsByUnit[activeDataKey] || []), { ...exhibit, src: "从备选添加" }]
    };
    setExhibitsByUnit(nextExhibitsByUnit);
    setKeptExhibits(prev => {
      const leftovers = [...(prev['_leftovers'] || [])];
      leftovers.splice(index, 1);
      const nextKeptExhibits = {
        ...prev,
        [activeDataKey]: nextExhibitsByUnit[activeDataKey],
        '_leftovers': leftovers,
      };
      markStep3Edited(
        { kept_exhibits: nextKeptExhibits },
        { keptExhibits: nextKeptExhibits }
      );
      return nextKeptExhibits;
    });
    setAddFromAltModal(null);
    showToast('展品已添加到主推', 'success');
  };

  const handleConfirmUnit = () => {
    if (exhibitConfirmations[activeDataKey]) return;
    setExhibitConfirmations(prev => {
      const nextConfirmations = { ...prev, [activeDataKey]: true };
      markStep3Edited(
        { exhibit_confirmations: nextConfirmations },
        { exhibitConfirmations: nextConfirmations }
      );
      return nextConfirmations;
    });
    showToast('单元已确认', 'success');
  };

  const handlePrevUnit = () => {
    if (activeUnitIndex > 0) {
      setActiveUnitId(getUnitKey(units[activeUnitIndex - 1], activeUnitIndex - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextUnit = () => {
    if (activeUnitIndex >= 0 && activeUnitIndex < units.length - 1) {
      setActiveUnitId(getUnitKey(units[activeUnitIndex + 1], activeUnitIndex + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
              Step 3 / 5
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", margin: 0 }}>
              审核展品推荐
            </h1>
            <p style={{ color: C.textSecondary, fontSize: 14, margin: "10px 0 0", lineHeight: 1.8, maxWidth: 720 }}>
              在这一页确认每个单元的主推展品，必要时删除、替换或补充。确认后，系统会基于这些展品生成对应的策展文本。
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 20 }}>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>结构单元</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{mainUnitCount} 个</div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>已确认单元</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{confirmedCount} / {mainUnitCount}</div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>当前单元</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, lineHeight: 1.6 }}>
              {formatUnitDisplayTitle(activeUnit)}
            </div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>当前主推展品</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{allExhibits.length} 件</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ width: 200, flexShrink: 0, alignSelf: "flex-start", position: "sticky", top: 84 }}>
          <Card style={{
            padding: "12px 0",
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
            borderRadius: 20,
            borderColor: `${C.border}`,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
          }}>
            <div style={{ padding: "0 16px 8px", fontSize: 11, color: C.textSecondary, fontWeight: 700 }}>单元导航</div>
            <Divider />
            {units.map((u, index) => {
              const unitKey = getUnitKey(u, index);
              const isConfirmed = exhibitConfirmations[unitKey];
              const isActive = unitKey === activeUnitId;
              return (
                <div
                  key={unitKey}
                  onClick={() => setActiveUnitId(unitKey)}
                  style={{
                    padding: "10px 16px", background: isActive ? `${C.aiGenerated}` : "transparent",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    cursor: "pointer", fontSize: 12,
                    color: isActive ? C.accentPrimary : C.textSecondary,
                    fontWeight: isActive ? 700 : 400,
                    borderLeft: isActive ? `3px solid ${C.accentPrimary}` : "3px solid transparent",
                  }}
                >
                  <span>
                    {isConfirmed ? "●" : isActive ? "●" : "○"} {formatUnitDisplayTitle(u)}
                  </span>
                  {isConfirmed && <span style={{ color: C.success }}>✓</span>}
                </div>
              );
            })}
            <Divider />
            <div style={{ padding: "0 16px", fontSize: 11, color: C.textSecondary }}>整体进度：</div>
            <div style={{ padding: "2px 16px 8px", fontSize: 11, color: C.accentPrimary, fontWeight: 700 }}>
              {confirmedCount} / {units.length} 单元已确认
            </div>
            {confirmedCount < units.length && (
              <div style={{ padding: "8px 16px 16px" }}>
                <Btn small onClick={() => {
                  const allConfirmed = {};
                  units.forEach((u, index) => { allConfirmed[getUnitKey(u, index)] = true; });
                  setExhibitConfirmations(allConfirmed);
                  showToast('已确认所有单元', 'success');
                }} style={{ width: '100%' }}>
                  一键确认全部
                </Btn>
              </div>
            )}
          </Card>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            borderRadius: 22,
            border: `1px solid ${C.border}`,
            background: C.bgElevated || C.bgSecondary,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
            padding: "20px 22px",
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 20, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>
                  {formatUnitDisplayTitle(activeUnit)}
                </span>
                {activeUnit?.tag && <Tag label={activeUnit.tag} color={activeUnit.tagColor || C.accentSecondary} />}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <Btn small variant="ghost" disabled={activeUnitIndex <= 0} onClick={handlePrevUnit}>
                  ← 上一个单元
                </Btn>
                <Btn small variant="ghost" disabled={activeUnitIndex === -1 || activeUnitIndex >= units.length - 1} onClick={handleNextUnit}>
                  下一个单元 →
                </Btn>
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>
              叙事定位：{getUnitNarrative(activeUnit) || '暂无'}
            </div>
          </div>

          {isStructureNode ? (
            <div style={{
              padding: "22px 20px",
              marginBottom: 20,
              borderRadius: 18,
              border: `1px dashed ${C.border}`,
              background: C.bgElevated || C.bgSecondary,
              color: C.textSecondary,
              lineHeight: 1.8,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>
                {activeUnit?.tag || '该单元'}仅作为结构节点
              </div>
              <div style={{ fontSize: 13 }}>
                {activeUnit?.tag === '序章'
                  ? '序章不分配主推展品，后续将直接用于生成序言内容。'
                  : '尾声不分配主推展品，后续将直接用于生成尾声内容。'}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 16, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.textSecondary }}>
                  主推展品（已分配到该单元）
                </div>
                {isItemCountInsufficient && (
                  <div style={{ fontSize: 12, color: '#e74c3c', fontWeight: 600 }}>
                    ⚠️ 适配该单元的展品数量不足（当前{allExhibits.length}件/下限{itemCountMin}件）
                  </div>
                )}
                {isItemCountExceeded && (
                  <div style={{ fontSize: 12, color: '#e67e22', fontWeight: 600 }}>
                    ⚠️ 适配该单元的展品数量超出（当前{allExhibits.length}件/上限{itemCountMax}件）
                  </div>
                )}
              </div>

              {allExhibits.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: C.textPlaceholder }}>
                  该单元暂无推荐展品
                </div>
              ) : (
                allExhibits.map((e, i) => {
                  const isKept = isExhibitKept(i);
                  const isDeleting = deletingKey === i;
                  const isAiRecommended = e.src === "AI推荐";
                  const displayReason = isAiRecommended ? String(e.reason || "").trim() : "";
                  const sourceTagColor = isAiRecommended ? C.aiGenerated : C.humanEdited;
                  const displayStars = Math.max(1, Math.min(5, Number(e.confidence ?? e.stars ?? 4) || 4));
                  return (
                    <Card key={i} style={{
                      marginBottom: 12,
                      opacity: isDeleting ? 0 : 1,
                      transform: isDeleting ? "translateX(100px)" : "translateX(0)",
                      transition: "opacity 0.3s, transform 0.3s",
                      borderRadius: 18,
                      boxShadow: "0 12px 28px rgba(15, 23, 42, 0.04)",
                    }}>
                      <div style={{ padding: 16 }}>
                        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <ExhibitThumb exhibit={e} theme={C} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                            {isAiRecommended && (
                              <>
                                <span style={{ fontSize: 12, color: C.textSecondary, fontWeight: 700 }}>
                                  AI推荐程度
                                </span>
                                <span style={{ color: C.accentSecondary, fontSize: 14 }}>
                                  {"★".repeat(displayStars)}{"☆".repeat(5 - displayStars)}
                                </span>
                              </>
                            )}
                            <Tag
                              label={`来源：${e.src}`}
                              color={sourceTagColor}
                              textColor={C.textPrimary}
                            />
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: C.textPrimary }}>{getExhibitName(e)}</div>
                          <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 8, lineHeight: 1.7, textAlign: "left" }}>
                            <div>ID: {e.id || '-'}</div>
                            <div>时间：{getExhibitTime(e) || '-'}</div>
                            <div>地点：{getExhibitPlace(e) || '-'}</div>
                            <div>材质：{getExhibitMaterial(e) || '-'}</div>
                            <div>其他：{getExhibitOther(e) || '-'}</div>
                          </div>
                          {displayReason && (
                            <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 8, lineHeight: 1.6, padding: '8px 10px', background: C.bgSecondary, borderRadius: 4, textAlign: "left" }}>
                              <strong>推荐理由：</strong>{displayReason}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 8 }}>
                            <Btn
                              small
                              variant={isKept ? "success" : "outline"}
                              disabled={isKept}
                              onClick={() => handleKeepExhibit(i)}
                              style={isKept ? {
                                background: "#E8F5EA",
                                color: "#4F8A61",
                                opacity: 1,
                                border: "1px solid #BFDCC7",
                              } : undefined}
                            >
                              {isKept ? "✓ 已保留" : "✓ 保留"}
                            </Btn>
                            <Btn small variant="danger" onClick={() => handleRemoveExhibit(i)}>
                              ✗ 删除
                            </Btn>
                          </div>
                        </div>
                      </div>
                      </div>
                    </Card>
                  );
                })
              )}

              <button
                onClick={() => setShowAlt(!showAlt)}
                style={{
                  padding: "8px 14px", background: C.bgPrimary, border: `1px solid ${C.border}`,
                  borderRadius: 6, cursor: "pointer", fontSize: 12, color: C.textSecondary, marginBottom: 12,
                }}
              >
                {showAlt ? "▼" : "▶"} 展开查看备选展品（未被分配到单元）
              </button>

              {showAlt && (
                <div style={{ marginBottom: 20 }}>
                  {keptExhibits['_leftovers'] && keptExhibits['_leftovers'].length > 0 ? (
                    <>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: C.textSecondary,
                        marginBottom: 12, padding: '8px 12px', background: C.bgSecondary, borderRadius: 6
                      }}>
                        备选展品（{keptExhibits['_leftovers'].length} 件）
                      </div>
                      {keptExhibits['_leftovers'].map((e, i) => (
                        <Card key={i} style={{ marginBottom: 8, background: C.bgSecondary }}>
                          <div style={{ padding: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <ExhibitThumb exhibit={e} theme={C} size={52} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                <Tag label="备选" color={C.textPlaceholder} textColor="#fff" />
                                <span style={{ fontSize: 11, color: C.textSecondary }}>{e.ctx || 'AI推荐'}</span>
                              </div>
                              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{getExhibitName(e)}</div>
                              <div style={{ fontSize: 11, color: C.textSecondary }}>
                                {getExhibitTime(e) || '-'} / {getExhibitPlace(e) || '-'} / {getExhibitMaterial(e) || '-'} / {getExhibitOther(e) || '-'}
                              </div>
                              <Btn small variant="primary" onClick={() => handleAddFromAlt(e, i)} style={{ marginTop: 8 }}>
                                + 添加到主推展品
                              </Btn>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </>
                  ) : (
                    <div style={{
                      fontSize: 13, color: C.textSecondary,
                      padding: '8px 12px', background: C.bgSecondary, borderRadius: 6
                    }}>
                      无备选展品（所有展品已分配到各单元）
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                <Btn small variant="ghost" onClick={() => setSearchModal(true)}>+ 从展品库添加</Btn>
                <Btn small variant="ghost" onClick={() => setManualAddModal(true)}>+ 手动输入展品信息</Btn>
              </div>
            </>
          )}

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
                {confirmedCount === units.length ? '所有单元已确认' : '请逐个确认各单元主推展品'}
              </div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
                确认后将进入策展文本审核阶段，系统会以当前展品配置生成序言、单元文本与尾声。
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => navigateTo("step2")}>← 返回</Btn>
              {!exhibitConfirmations[activeDataKey] && (
                <Btn onClick={handleConfirmUnit}>
                  确认该单元展品
                </Btn>
              )}
              {confirmedCount === units.length && (
                <Btn onClick={() => setNextStepModal(true)}>
                  进入下一步 →
                </Btn>
              )}
            </div>
          </div>
        </div>
      </div>

      {deleteModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.28)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
          backdropFilter: "blur(4px)", padding: 16,
        }}>
          <div style={{ background: C.bgPrimary, borderRadius: 22, padding: 24, width: 380, maxWidth: "100%", border: `1px solid ${C.border}`, boxShadow: "0 24px 60px rgba(15, 23, 42, 0.14)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>确认删除</h3>
            <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>
              确定要删除展品「{deleteModal.name}」吗？此操作可撤销。
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setDeleteModal(null)}>取消</Btn>
              <Btn variant="danger" onClick={confirmDelete}>确认删除</Btn>
            </div>
          </div>
        </div>
      )}

      {addFromAltModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.28)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
          backdropFilter: "blur(4px)", padding: 16,
        }}>
          <div style={{ background: C.bgPrimary, borderRadius: 22, padding: 24, width: 380, maxWidth: "100%", border: `1px solid ${C.border}`, boxShadow: "0 24px 60px rgba(15, 23, 42, 0.14)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>确认添加</h3>
            <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>
              确定要将展品「{addFromAltModal.exhibit.name}」添加到主推展品吗？
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setAddFromAltModal(null)}>取消</Btn>
              <Btn variant="primary" onClick={confirmAddFromAlt}>确认添加</Btn>
            </div>
          </div>
        </div>
      )}

      {manualAddModal && (
        <ManualAddModal C={C} onClose={() => setManualAddModal(false)} onAdd={handleAddExhibit} />
      )}

      {searchModal && (
        <SearchModal C={C} onClose={() => setSearchModal(false)} onAdd={handleAddExhibit} uploadedExhibits={exhibitsByUnit[activeDataKey] || []} activeUserId={activeUserId} />
      )}

      {nextStepModal && !isGenerating && (
        <NextStepModal
          C={C}
          onClose={() => setNextStepModal(false)}
          onConfirm={() => {
            setIsGenerating(true);
            goNextStep();
          }}
        />
      )}

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
              正在生成策展文本
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>
              AI 将基于当前确认的展品组合，生成序言、各单元文本与尾声内容。
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

const ManualAddModal = ({ C, onClose, onAdd }) => {
  const [form, setForm] = useState({ name: '', time: '', place: '', material: '', ctx: '', stars: 5, other: '', introduction: '' });

  const handleSubmit = () => {
    if (!form.name.trim()) {
      return;
    }
    onAdd({
      name: form.name,
      time: form.time,
      era: form.time,
      place: form.place,
      mat: form.material,
      material: form.material,
      ctx: form.ctx,
      id: `MAN-${Date.now()}`,
      stars: form.stars,
      sz: form.other,
      other: form.other,
      introduction: form.introduction,
    });
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400,
    }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 400, maxHeight: "80vh", overflow: "auto" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>手动输入展品信息</h3>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: C.textSecondary }}>展品名称 *</div>
          <input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="请输入展品名称"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}`, boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: C.textSecondary }}>时间</div>
            <input
              value={form.time}
              onChange={e => setForm({ ...form, time: e.target.value })}
              placeholder="如：唐代"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}`, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: C.textSecondary }}>地点</div>
            <input
              value={form.place}
              onChange={e => setForm({ ...form, place: e.target.value })}
              placeholder="如：长安"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}`, boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: C.textSecondary }}>材质</div>
            <input
              value={form.material}
              onChange={e => setForm({ ...form, material: e.target.value })}
              placeholder="如：青铜"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}`, boxSizing: "border-box" }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: C.textSecondary }}>推荐星级</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 0" }}>
              {[1, 2, 3, 4, 5].map(n => (
                <span
                  key={n}
                  onClick={() => setForm({ ...form, stars: n })}
                  style={{
                    fontSize: 20, cursor: "pointer",
                    color: n <= form.stars ? C.accentSecondary : C.stepInactive
                  }}
                >
                  {n <= form.stars ? "★" : "☆"}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: C.textSecondary }}>其他</div>
          <input
            value={form.other}
            onChange={e => setForm({ ...form, other: e.target.value })}
            placeholder="如：高 32cm、编号、残损情况"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}`, boxSizing: "border-box" }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: C.textSecondary }}>介绍 / 策展语境</div>
          <textarea
            value={form.introduction || form.ctx}
            onChange={e => setForm({ ...form, introduction: e.target.value, ctx: e.target.value })}
            placeholder="请输入展品介绍或策展语境说明"
            rows={3}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}`, boxSizing: "border-box", resize: "vertical" }}
          />
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
          <Btn onClick={handleSubmit}>添加</Btn>
        </div>
      </div>
    </div>
  );
};

const SearchModal = ({ C, onClose, onAdd, uploadedExhibits, activeUserId }) => {
  const [keyword, setKeyword] = useState('');
  const [allExhibits, setAllExhibits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
     const loadAllExhibits = async () => {
       setLoading(true);
       try {
         const { api } = await import('../api/client');
         const data = await api.exhibits.getAll({ user_id: activeUserId });
         setAllExhibits(data || []);
       } catch (err) {
         console.error('加载展品失败:', err);
       } finally {
         setLoading(false);
       }
     };
     loadAllExhibits();
   }, [activeUserId]);

  const searchResults = keyword
    ? allExhibits.filter(r =>
        getExhibitName(r).includes(keyword) ||
        getExhibitTime(r).includes(keyword) ||
        getExhibitPlace(r).includes(keyword) ||
        getExhibitMaterial(r).includes(keyword) ||
        r.id?.includes(keyword)
      )
    : [];

  const handleAdd = (item) => {
    onAdd({
      ...normalizeImportedExhibit(item),
      name: getExhibitName(item),
      time: getExhibitTime(item) || '时间未上传',
      era: getExhibitTime(item) || '时间未上传',
      place: getExhibitPlace(item) || '地点未上传',
      mat: getExhibitMaterial(item) || '材质未上传',
      material: getExhibitMaterial(item) || '材质未上传',
      ctx: "从展品库添加",
      id: item.id,
      stars: 5,
      sz: getExhibitOther(item) || "其他信息未上传",
      other: getExhibitOther(item) || "其他信息未上传",
      introduction: getExhibitIntroduction(item),
    });
    onClose();
  };

  const isAlreadyAdded = (item) => {
    return uploadedExhibits?.some(ex => ex.id === item.id);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400,
    }}>
      <div style={{ background: C.bgSecondary, borderRadius: 12, padding: 24, width: 560, maxHeight: "80vh", overflow: "auto" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: C.textPrimary }}>从展品库添加</h3>
        <div style={{ marginBottom: 16 }}>
          <input
            value={keyword}
            onChange={e => { setKeyword(e.target.value); setSearched(true); }}
            placeholder="输入关键词搜索展品名称、时间、地点、材质..."
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 6,
              border: `1px solid ${C.border}`, boxSizing: "border-box", fontSize: 14,
              background: C.bgPrimary, color: C.textPrimary
            }}
          />
        </div>
        <div style={{ maxHeight: 300, overflow: "auto", border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 20 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: C.textPlaceholder, fontSize: 13 }}>
              加载展品库中...
            </div>
          ) : !searched ? (
            <div style={{ padding: 40, textAlign: "center", color: C.textPlaceholder, fontSize: 13 }}>
              输入关键词进行搜索
            </div>
          ) : searchResults.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.textPlaceholder, fontSize: 13 }}>
              未找到相关展品
            </div>
          ) : (
            searchResults.map((r, i) => {
              const added = isAlreadyAdded(r);
              return (
                <div
                  key={i}
                  style={{
                    padding: "12px 16px", borderBottom: `1px solid ${C.border}`, cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: added ? C.bgPrimary : 'transparent',
                    opacity: added ? 0.6 : 1,
                  }}
                  onClick={() => !added && handleAdd(r)}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.textPrimary }}>{getExhibitName(r)}</div>
                    <div style={{ fontSize: 12, color: C.textSecondary }}>{r.id} · {getExhibitTime(r) || '-'} · {getExhibitPlace(r) || '-'} · {getExhibitMaterial(r) || '-'}</div>
                  </div>
                  {added ? (
                    <span style={{ fontSize: 12, color: C.textSecondary }}>已添加</span>
                  ) : (
                    <Btn small variant="ghost">添加</Btn>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
        </div>
      </div>
    </div>
  );
};

const NextStepModal = ({ C, onClose, onConfirm }) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400,
  }}>
    <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 400 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>进入下一步</h3>
      <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>
        所有单元展品已确认，是否进入下一步审核策展文本？
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>取消</Btn>
        <Btn onClick={onConfirm}>确认进入</Btn>
      </div>
    </div>
  </div>
);
