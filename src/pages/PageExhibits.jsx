import { useEffect, useMemo, useRef, useState } from 'react';
import { Btn, Divider } from '../components/ui';
import { api } from '../api/client';
import {
  EXHIBIT_TEMPLATE_HEADERS,
  deduplicateExhibits,
  getExhibitDeduplicationKey,
  getExhibitFullImageUrl,
  getExhibitImage,
  getIncompleteExhibitFields,
  getExhibitIntroduction,
  getExhibitMaterial,
  hasMeaningfulExhibitData,
  isIncompleteExhibit,
  getExhibitName,
  getExhibitOther,
  getExhibitPlace,
  getExhibitSearchText,
  getSearchKeywords,
  getExhibitTime,
  normalizeImportedExhibit,
} from '../utils/exhibitFields';

const EMPTY_FORM = {
  name: '',
  time: '',
  place: '',
  material: '',
  introduction: '',
  image_url: '',
  other: '',
};

function ThumbnailCell({ exhibit, theme }) {
  const thumbnailUrl = getExhibitImage(exhibit);
  const previewUrl = getExhibitFullImageUrl(exhibit) || thumbnailUrl;
  const name = getExhibitName(exhibit);
  const [previewPosition, setPreviewPosition] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  if (!thumbnailUrl || imageFailed) {
    return <span style={{ color: theme.textSecondary }}>-</span>;
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

  return (
    <div
      style={{ display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={showPreview}
      onMouseMove={showPreview}
      onMouseLeave={() => setPreviewPosition(null)}
    >
      <div style={{ display: 'inline-block' }}>
        <img
          src={thumbnailUrl}
          alt={name}
          onError={() => setImageFailed(true)}
          style={{
            width: 40,
            height: 40,
            objectFit: 'cover',
            borderRadius: 8,
            border: `1px solid ${theme.border}`,
            cursor: 'zoom-in',
          }}
        />
        {previewPosition && !previewFailed && (
          <div
          style={{
            position: 'fixed',
            left: previewPosition.left,
            top: previewPosition.top,
            zIndex: 9999,
            padding: 8,
            background: theme.bgPrimary,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            boxShadow: '0 18px 42px rgba(15, 23, 42, 0.18)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          <img
            src={previewUrl}
            alt={name}
            onError={() => setPreviewFailed(true)}
            style={{ width: 240, maxHeight: 240, objectFit: 'contain', display: 'block', borderRadius: 8 }}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: theme.textPrimary, maxWidth: 240, whiteSpace: 'normal' }}>
            {name}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

function ExhibitStatusTag({ exhibit, theme }) {
  const missingFields = getIncompleteExhibitFields(exhibit);
  if (!isIncompleteExhibit(exhibit)) {
    return null;
  }

  return (
    <span
      title={`缺少：${missingFields.join('、')}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        border: `1px solid ${theme.warning}44`,
        background: `${theme.warning}12`,
        color: theme.warning,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      信息不全
    </span>
  );
}

export const PageExhibits = ({
  showToast,
  theme,
  activeUserId,
  isLoggedIn,
  requireLogin,
}) => {
  const C = theme;
  const FILTER_TABS = [
    { key: 'all', label: '全部' },
    { key: 'complete', label: '信息完整展品' },
    { key: 'incomplete', label: '信息不全展品' },
  ];
  const [exhibits, setExhibits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExhibit, setEditingExhibit] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!isLoggedIn || !activeUserId) {
      setExhibits([]);
      setLoading(false);
      return;
    }
    loadExhibits();
  }, [activeUserId, isLoggedIn]);

  const loadExhibits = async () => {
    setLoading(true);
    try {
      const params = activeUserId ? { user_id: activeUserId } : {};
      const data = await api.exhibits.getAll(params);
      const normalized = (data || []).map(normalizeImportedExhibit);
      const { uniqueExhibits, duplicateCount } = deduplicateExhibits(normalized);
      setExhibits(uniqueExhibits);
      if (duplicateCount > 0) {
        console.info(`展品库已隐藏 ${duplicateCount} 条重复展品`, { duplicateCount });
      }
    } catch (error) {
      console.error('加载展品失败:', error);
      showToast('加载展品失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredExhibits = useMemo(() => {
    const keywords = getSearchKeywords(search);
    return exhibits.filter((ex) => {
      const incomplete = isIncompleteExhibit(ex);
      if (filterMode === 'incomplete' && !incomplete) {
        return false;
      }
      if (filterMode === 'complete' && incomplete) {
        return false;
      }
      if (keywords.length === 0) {
        return true;
      }
      const searchText = getExhibitSearchText(ex);
      return keywords.every((keyword) => searchText.includes(keyword));
    });
  }, [exhibits, search, filterMode]);

  const exhibitCounts = useMemo(
    () => ({
      all: exhibits.length,
      incomplete: exhibits.filter((exhibit) => isIncompleteExhibit(exhibit)).length,
      complete: exhibits.filter((exhibit) => !isIncompleteExhibit(exhibit)).length,
    }),
    [exhibits]
  );

  const handleImportExcel = async (event) => {
    if (!isLoggedIn || !activeUserId) {
      requireLogin('导入展品模板');
      if (event?.target) event.target.value = '';
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportSummary(null);
    try {
      const parsed = await api.exhibits.parseTemplate(file, { userId: activeUserId });
      const exhibitsData = (parsed.exhibits || [])
        .map(normalizeImportedExhibit)
        .filter(hasMeaningfulExhibitData);
      if (exhibitsData.length === 0) {
        showToast('未找到有效的展品数据', 'error');
        return;
      }
      const existingKeys = new Set(exhibits.map(getExhibitDeduplicationKey));
      const importKeys = new Set();
      const dedupedExhibitsData = [];
      let duplicateInFileCount = 0;
      let duplicateInLibraryCount = 0;

      exhibitsData.forEach((exhibit) => {
        const key = getExhibitDeduplicationKey(exhibit);
        if (existingKeys.has(key)) {
          duplicateInLibraryCount += 1;
          return;
        }
        if (importKeys.has(key)) {
          duplicateInFileCount += 1;
          return;
        }
        importKeys.add(key);
        dedupedExhibitsData.push(exhibit);
      });

      if (dedupedExhibitsData.length === 0) {
        setImportSummary({
          importedCount: 0,
          skippedBlankRows: Number(parsed.meta?.skipped_blank_rows || 0),
          incompleteRowCount: Number(parsed.meta?.incomplete_row_count || 0),
          incompleteRows: parsed.meta?.incomplete_rows || [],
          duplicateInFileCount,
          duplicateInLibraryCount,
          fileName: parsed.file_name || file.name,
        });
        showToast('未导入新展品：本次文件中的展品均已存在或重复', 'info');
        return;
      }

      const created = await api.exhibits.createBatch(
        dedupedExhibitsData.map(({ name, time, place, material, introduction, image_url, thumbnail_url, storage_bucket, storage_path, thumbnail_storage_path, other }) => ({
          name,
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

      setImportSummary({
        importedCount: created.length,
        skippedBlankRows: Number(parsed.meta?.skipped_blank_rows || 0),
        incompleteRowCount: Number(parsed.meta?.incomplete_row_count || 0),
        incompleteRows: parsed.meta?.incomplete_rows || [],
        duplicateInFileCount,
        duplicateInLibraryCount,
        fileName: parsed.file_name || file.name,
      });
      const duplicateText = duplicateInFileCount + duplicateInLibraryCount > 0
        ? `，已跳过重复 ${duplicateInFileCount + duplicateInLibraryCount} 条`
        : '';
      showToast(
        `成功导入 ${created.length} 条展品${duplicateText}${Number(parsed.meta?.incomplete_row_count || 0) > 0 ? `，其中 ${Number(parsed.meta?.incomplete_row_count || 0)} 行信息不全` : ''}`,
        Number(parsed.meta?.incomplete_row_count || 0) > 0 ? 'info' : 'success'
      );
      loadExhibits();
    } catch (error) {
      console.error('导入失败:', error);
      showToast(`导入失败: ${error.message}`, 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!isLoggedIn || !activeUserId) {
      requireLogin(editingExhibit ? '编辑展品' : '添加展品');
      return;
    }
    if (!formData.name.trim()) {
      showToast('请输入展品名称', 'error');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      time: formData.time.trim(),
      place: formData.place.trim(),
      material: formData.material.trim(),
      introduction: formData.introduction.trim(),
      image_url: formData.image_url.trim(),
      thumbnail_url: formData.image_url.trim(),
      other: formData.other.trim(),
    };
    const duplicateExhibit = exhibits.find((exhibit) => {
      if (editingExhibit && exhibit.id === editingExhibit.id) {
        return false;
      }
      return getExhibitDeduplicationKey(exhibit) === getExhibitDeduplicationKey(payload);
    });
    if (duplicateExhibit) {
      showToast(`展品「${getExhibitName(duplicateExhibit) || payload.name}」已存在，未重复保存`, 'info');
      return;
    }

    try {
      if (editingExhibit) {
        await api.exhibits.update(editingExhibit.id, payload, { user_id: activeUserId });
        showToast('展品更新成功', 'success');
      } else {
        await api.exhibits.create(payload, { user_id: activeUserId });
        showToast('展品添加成功', 'success');
      }
      setShowAddModal(false);
      setEditingExhibit(null);
      setFormData(EMPTY_FORM);
      loadExhibits();
    } catch (error) {
      console.error('保存展品失败:', error);
      showToast('保存展品失败', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    if (!isLoggedIn || !activeUserId) {
      requireLogin('删除展品');
      return;
    }

    try {
      await api.exhibits.delete(deleteModal.id, { user_id: activeUserId });
      showToast('展品删除成功', 'success');
      setDeleteModal(null);
      loadExhibits();
    } catch (error) {
      console.error('删除展品失败:', error);
      showToast('删除展品失败', 'error');
    }
  };

  const confirmDelete = (exhibit) => {
    if (!isLoggedIn) {
      requireLogin('删除展品');
      return;
    }
    setDeleteModal({ id: exhibit.id, name: getExhibitName(exhibit) });
  };

  const openEditModal = (exhibit) => {
    if (!isLoggedIn) {
      requireLogin('编辑展品');
      return;
    }
    setEditingExhibit(exhibit);
    setFormData({
      name: getExhibitName(exhibit),
      time: getExhibitTime(exhibit),
      place: getExhibitPlace(exhibit),
      material: getExhibitMaterial(exhibit),
      introduction: getExhibitIntroduction(exhibit),
      image_url: getExhibitImage(exhibit),
      other: getExhibitOther(exhibit),
    });
    setShowAddModal(true);
  };

  const openAddModal = () => {
    if (!isLoggedIn) {
      requireLogin('添加展品');
      return;
    }
    setEditingExhibit(null);
    setFormData(EMPTY_FORM);
    setShowAddModal(true);
  };

  return (
    <main style={{ padding: "28px 36px", maxWidth: 1320 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>
            展品库管理
          </h1>
          <p style={{ color: C.textSecondary, fontSize: 14, marginTop: 6, lineHeight: 1.7 }}>
            管理全局展品知识库，固定模版字段为：{EXHIBIT_TEMPLATE_HEADERS.join('、')}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleImportExcel}
            style={{ display: 'none' }}
          />
          <Btn variant="ghost" onClick={() => {
            if (!isLoggedIn) {
              requireLogin('导入展品模板');
              return;
            }
            fileInputRef.current?.click();
          }} disabled={isImporting}>
            {isLoggedIn ? (isImporting ? '导入中...' : '导入固定模板') : '登录后导入模板'}
          </Btn>
          <Btn onClick={openAddModal}>{isLoggedIn ? '+ 添加展品' : '登录后添加展品'}</Btn>
        </div>
      </div>
      <Divider />

      {!isLoggedIn && (
        <div style={{
          marginTop: 18,
          padding: '14px 16px',
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: C.bgSecondary,
          color: C.textSecondary,
          fontSize: 13,
          lineHeight: 1.7,
        }}>
          当前为访客预览模式。系统不会加载任何展品数据；导入、添加、编辑、删除前请先登录。
        </div>
      )}

      {importSummary && (
        <div style={{
          marginTop: 18,
          padding: '14px 16px',
          borderRadius: 12,
          border: `1px solid ${Number(importSummary.incompleteRowCount || 0) > 0 ? `${C.warning}44` : `${C.success}44`}`,
          background: Number(importSummary.incompleteRowCount || 0) > 0 ? `${C.warning}10` : `${C.success}10`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
            导入结果：成功导入 {importSummary.importedCount} 条展品
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: C.textSecondary, lineHeight: 1.7 }}>
            文件：{importSummary.fileName}
            {Number(importSummary.skippedBlankRows || 0) > 0 ? `，已跳过空白行 ${importSummary.skippedBlankRows} 行` : ''}
            {Number(importSummary.duplicateInLibraryCount || 0) > 0 ? `，已跳过库内已有 ${importSummary.duplicateInLibraryCount} 条` : ''}
            {Number(importSummary.duplicateInFileCount || 0) > 0 ? `，已跳过文件内重复 ${importSummary.duplicateInFileCount} 条` : ''}
            {Number(importSummary.incompleteRowCount || 0) > 0 ? `，信息不全 ${importSummary.incompleteRowCount} 行` : ''}
          </div>
          {Number(importSummary.incompleteRowCount || 0) > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.textSecondary, lineHeight: 1.7 }}>
              {(importSummary.incompleteRows || []).slice(0, 8).map((item) => (
                <div key={item.row_number}>
                  第 {item.row_number} 行：缺少 {item.missing_fields.join('、')}，已按当前可解析信息导入
                </div>
              ))}
              {Number(importSummary.incompleteRowCount || 0) > 8 ? `其余 ${Number(importSummary.incompleteRowCount || 0) - 8} 行请在下方展品库中继续检查。` : ''}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索展品名称、时间、地点、材质、介绍、其他，支持空格分词..."
            style={{
              width: "100%", maxWidth: 520, padding: "10px 14px", borderRadius: 6,
              border: `1px solid ${C.border}`, fontSize: 14, boxSizing: "border-box",
            }}
          />
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: 4,
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              background: '#fff',
              gap: 4,
              flexWrap: 'wrap',
            }}
          >
            {FILTER_TABS.map((tab) => {
              const active = filterMode === tab.key;
              const count = exhibitCounts[tab.key] ?? 0;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterMode(tab.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 999,
                    border: 'none',
                    background: active ? `${C.accentPrimary}12` : 'transparent',
                    color: active ? C.accentPrimary : C.textSecondary,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      padding: '1px 8px',
                      borderRadius: 999,
                      background: active ? `${C.accentPrimary}18` : C.bgPrimary,
                      color: active ? C.accentPrimary : C.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: C.textSecondary }}>加载中...</div>
      ) : filteredExhibits.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: C.textSecondary }}>
          {search || filterMode !== 'all'
            ? "未找到匹配的展品"
            : isLoggedIn
              ? "展品库为空，请添加展品"
              : "登录后可查看你自己的展品库"}
        </div>
      ) : (
        <div style={{
          border: `1px solid ${C.border}`, borderRadius: 8, overflow: "auto",
          background: "#fff",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 1180 }}>
            <thead>
              <tr style={{ background: "#f5f5f4" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600 }}>缩略图</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontFamily: "var(--font-serif)" }}>展品名称</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontFamily: "var(--font-serif)" }}>时间</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontFamily: "var(--font-serif)" }}>地点</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontFamily: "var(--font-serif)" }}>材质</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontFamily: "var(--font-serif)" }}>介绍</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontFamily: "var(--font-serif)" }}>其他</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredExhibits.map((ex, idx) => (
                <tr key={ex.id || idx} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 16px", verticalAlign: 'top' }}>
                    <ThumbnailCell exhibit={ex} theme={C} />
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 500, color: C.textSecondary }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>{getExhibitName(ex) || '-'}</span>
                      <ExhibitStatusTag exhibit={ex} theme={C} />
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: C.textSecondary }}>{getExhibitTime(ex) || '-'}</td>
                  <td style={{ padding: "12px 16px", color: C.textSecondary }}>{getExhibitPlace(ex) || '-'}</td>
                  <td style={{ padding: "12px 16px", color: C.textSecondary }}>{getExhibitMaterial(ex) || '-'}</td>
                  <td style={{ padding: "12px 16px", color: C.textSecondary, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {getExhibitIntroduction(ex) || '-'}
                  </td>
                  <td style={{ padding: "12px 16px", color: C.textSecondary }}>{getExhibitOther(ex) || '-'}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: 'nowrap' }}>
                    <span
                      onClick={() => openEditModal(ex)}
                      style={{ color: C.accentPrimary, cursor: "pointer", marginRight: 12, fontSize: 13 }}
                    >
                      编辑
                    </span>
                    <span
                      onClick={() => confirmDelete(ex)}
                      style={{ color: C.danger, cursor: "pointer", fontSize: 13 }}
                    >
                      删除
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12, color: C.textSecondary, fontSize: 13 }}>
        共 {filteredExhibits.length} 条记录
        {filterMode === 'complete' ? `（当前仅显示信息完整展品）` : ''}
        {filterMode === 'incomplete' ? `（当前仅显示信息不全展品）` : ''}
      </div>

      {showAddModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400,
        }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 560, maxHeight: '86vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
              {editingExhibit ? '编辑展品' : '添加展品'}
            </h3>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                展品名称 <span style={{ color: C.danger }}>*</span>
              </label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入展品名称"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, boxSizing: "border-box", fontSize: 14 }}
              />
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>时间</label>
                <input
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  placeholder="如：清代乾隆年间"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, boxSizing: "border-box", fontSize: 14 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>地点</label>
                <input
                  value={formData.place}
                  onChange={(e) => setFormData({ ...formData, place: e.target.value })}
                  placeholder="如：敦煌、长安"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, boxSizing: "border-box", fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>材质</label>
                <input
                  value={formData.material}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                  placeholder="如：青铜、瓷器"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, boxSizing: "border-box", fontSize: 14 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>其他</label>
                <input
                  value={formData.other}
                  onChange={(e) => setFormData({ ...formData, other: e.target.value })}
                  placeholder="如：高45cm、残损、编号等"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, boxSizing: "border-box", fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>图片</label>
              <input
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="支持图片 URL、Base64，或通过固定模板导入图片列"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, boxSizing: "border-box", fontSize: 14 }}
              />
              {getExhibitFullImageUrl({ image_url: formData.image_url }) && (
                <div style={{ marginTop: 10 }}>
                  <img
                    src={getExhibitFullImageUrl({ image_url: formData.image_url })}
                    alt={formData.name || '预览图'}
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                    style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10, border: `1px solid ${C.border}` }}
                  />
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>介绍</label>
              <textarea
                value={formData.introduction}
                onChange={(e) => setFormData({ ...formData, introduction: e.target.value })}
                placeholder="请输入展品介绍"
                rows={4}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: `1px solid ${C.border}`, boxSizing: "border-box", fontSize: 14, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowAddModal(false)}>取消</Btn>
              <Btn onClick={handleSubmit}>{editingExhibit ? '保存' : '添加'}</Btn>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400,
        }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 360 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>确认删除</h3>
            <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20 }}>
              确定要删除展品「{deleteModal.name}」吗？此操作不可撤销。
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setDeleteModal(null)}>取消</Btn>
              <Btn onClick={handleDelete}>确认删除</Btn>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
