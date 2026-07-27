import { useState, useEffect } from 'react';
import { Card, Btn, Divider } from '../components/ui';
import {
  getExhibitImage,
  getExhibitMaterial,
  getExhibitName,
  getExhibitPlace,
  getExhibitTime,
} from '../utils/exhibitFields';

export const PageStep5 = ({
  setPage,
  goPrevStep,
  warningVisible,
  setWarningVisible,
  showExport,
  setShowExport,
  completeProject,
  currentProject,
  theme,
  keptExhibits,
  setKeptExhibits,
  units,
  setUnits,
  textSections,
  setTextSections,
}) => {
  const C = theme;
  const [activeSection, setActiveSection] = useState('preface');
  const [selectedFormat, setSelectedFormat] = useState('PDF');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const infoCardStyle = {
    padding: "14px 16px",
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    background: C.bgElevated || C.bgSecondary,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  };

  useEffect(() => {
    if (currentProject) {
      if (currentProject.units && currentProject.units.length > 0 && (!units || units.length === 0)) {
        setUnits(currentProject.units);
      }
      if (currentProject.keptExhibits && Object.keys(currentProject.keptExhibits).length > 0) {
        setKeptExhibits(currentProject.keptExhibits);
      }
      if (currentProject.textSections && currentProject.textSections.length > 0 && (!textSections || textSections.length === 0)) {
        setTextSections(currentProject.textSections);
      }
    }
  }, [currentProject]);

  const narrative = currentProject?.narrative || {};
  const projectTitle = narrative?.title || currentProject?.title || '策展大纲';
  const allUnits = units || [];
  const unitsData = allUnits.filter(u => u.tag !== '序章' && u.tag !== '尾声');

  const resolveRegularUnit = (sectionId) => {
    const sectionIndex = Number(sectionId);
    if (!Number.isInteger(sectionIndex) || sectionIndex < 0) return null;
    return unitsData[sectionIndex] || null;
  };

  const resolveUnitExhibits = (sectionId) => {
    const unit = resolveRegularUnit(sectionId);
    const sectionIndex = Number(sectionId);
    const candidateKeys = [];

    if (sectionId !== undefined && sectionId !== null) {
      candidateKeys.push(String(sectionId));
    }
    if (unit?.id !== undefined && unit?.id !== null) {
      candidateKeys.push(String(unit.id));
    }
    if (Number.isInteger(sectionIndex)) {
      candidateKeys.push(String(sectionIndex));
      // 兼容历史项目里按原始单元顺序存储的 key（第一个正文单元可能是 "1"）
      candidateKeys.push(String(sectionIndex + 1));
    }

    const triedKeys = [...new Set(candidateKeys)];
    for (const key of triedKeys) {
      const exhibits = keptExhibits?.[key];
      if (Array.isArray(exhibits) && exhibits.length > 0) {
        return exhibits;
      }
    }

    return [];
  };

  const resolveTextSection = (sectionId) => {
    const unit = resolveRegularUnit(sectionId);
    const sectionIndex = Number(sectionId);
    const candidateKeys = [];

    if (sectionId !== undefined && sectionId !== null) {
      candidateKeys.push(String(sectionId));
    }
    if (unit?.id !== undefined && unit?.id !== null) {
      candidateKeys.push(String(unit.id));
    }
    if (Number.isInteger(sectionIndex)) {
      candidateKeys.push(String(sectionIndex));
      candidateKeys.push(String(sectionIndex + 1));
    }

    const triedKeys = [...new Set(candidateKeys)];
    return triedKeys
      .map((key) => textSections?.find((section) => String(section.key) === key))
      .find(Boolean) || null;
  };

  const outlineToc = [
    { id: 'preface', title: '序言', page: 1 },
    ...unitsData.map((u, i) => ({ id: String(i), title: u.tag ? `${u.tag}：${u.title}` : u.title, page: i + 2 })),
    { id: 'epilogue', title: '尾声', page: unitsData.length + 2 },
  ];

  const getSectionContent = (sectionId) => {
    if (sectionId === 'preface') {
      const prefaceSection = textSections?.find(s => s.key === 'preface');
      if (prefaceSection && prefaceSection.text) {
        return {
          title: '序言',
          content: prefaceSection.text,
          isAI: !prefaceSection.edited,
          exhibits: [],
        };
      }
      return {
        title: '序言',
        content: narrative?.preface?.content || currentProject?.narrative?.preface?.content || '',
        isAI: true,
        exhibits: [],
      };
    }
    if (sectionId === 'epilogue') {
      const epilogueSection = textSections?.find(s => s.key === 'epilogue');
      if (epilogueSection && epilogueSection.text) {
        return {
          title: '尾声',
          content: epilogueSection.text,
          isAI: !epilogueSection.edited,
          exhibits: [],
        };
      }
      return {
        title: '尾声',
        content: narrative?.epilogue?.content || currentProject?.narrative?.epilogue?.content || '',
        isAI: true,
        exhibits: [],
      };
    }
    const section = resolveTextSection(sectionId);
    if (section) {
      const exhibits = resolveUnitExhibits(sectionId);
      return {
        title: section.title,
        content: section.text || section.content || '',
        isAI: !section.edited,
        exhibits: exhibits,
      };
    }
    const fallbackUnit = resolveRegularUnit(sectionId);
    return {
      title: fallbackUnit?.title || '',
      content: '',
      isAI: false,
      exhibits: resolveUnitExhibits(sectionId),
    };
  };

  const currentSection = getSectionContent(activeSection);

  const getExhibitId = (exhibit) => (
    exhibit?.id || exhibit?.ID || exhibit?.编号 || exhibit?.exhibit_id || exhibit?.original_index || ''
  );

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const formatTableCell = (value) => String(value || '-')
    .replace(/\|/g, '&#124;')
    .replace(/\r?\n/g, '<br>')
    .trim() || '-';

  const getExhibitImageTag = (exhibit, size = 72) => {
    const imageUrl = getExhibitImage(exhibit);
    if (!imageUrl) return '-';
    const alt = escapeHtml(getExhibitName(exhibit) || '展品图');
    return `<img src="${escapeHtml(imageUrl)}" alt="${alt}" width="${size}" style="width:${size}px;max-height:${size}px;object-fit:cover;border-radius:6px;" />`;
  };

  const handleComplete = () => {
    setShowCompleteModal(true);
  };

  const confirmComplete = () => {
    setShowCompleteModal(false);
    completeProject();
  };

  const convertHtmlToMarkdown = (html) => {
    let md = html
      .replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n')
      .replace(/<h2>(.*?)<\/h2>/g, '## $1\n\n')
      .replace(/<h3>(.*?)<\/h3>/g, '### $1\n\n')
      .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<b>(.*?)<\/b>/g, '**$1**')
      .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replace(/<i>(.*?)<\/i>/g, '*$1*')
      .replace(/<em>(.*?)<\/em>/g, '*$1*')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .trim();
    return md;
  };

  const generateFullOutline = () => {
    let fullContent = `# ${projectTitle}\n\n`;
    fullContent += '## 目录\n\n';
    outlineToc.forEach(item => {
      fullContent += `${item.page}. ${item.title}\n`;
    });
    fullContent += '\n---\n\n';

    const sections = [
      { id: 'preface', ...getSectionContent('preface') },
      ...unitsData.map((_, i) => ({ id: String(i), ...getSectionContent(String(i)) })),
      { id: 'epilogue', ...getSectionContent('epilogue') },
    ];

    sections.forEach(section => {
      fullContent += `## ${section.title}\n\n`;
      fullContent += convertHtmlToMarkdown(section.content);
      fullContent += '\n\n';

      if (section.exhibits && section.exhibits.length > 0) {
        fullContent += '### 展品列表\n\n';
        fullContent += '| 文物名称 | 时间 | 地点 | 材质 | 展品图 | 展品ID |\n';
        fullContent += '|---|---|---|---|---|---|\n';
        section.exhibits.forEach(ex => {
          fullContent += `| ${formatTableCell(getExhibitName(ex))} | ${formatTableCell(getExhibitTime(ex))} | ${formatTableCell(getExhibitPlace(ex))} | ${formatTableCell(getExhibitMaterial(ex))} | ${getExhibitImageTag(ex)} | ${formatTableCell(getExhibitId(ex))} |\n`;
        });
        fullContent += '\n';
      }
    });

    return fullContent;
  };

  const handleExportClick = () => {
    if (selectedFormat === 'Markdown') {
      downloadMarkdown();
    } else if (selectedFormat === 'PDF') {
      downloadPDF();
    } else if (selectedFormat === 'Word') {
      downloadWord();
    }
  };

  const convertMarkdownToHtml = (md) => {
    let html = md;

    html = html.replace(/\|(.+)\|\n\|[-|]+\|\n((?:\|.+\|\n?)+)/g, (_match, header, body) => {
      const headers = header.split('|').filter(h => h.trim()).map(h => `<th>${h.trim()}</th>`).join('');
      const rows = body.trim().split('\n').map(row => {
        const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    });

    html = html
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^(\d+)\. (.+)$/gm, '<div class="toc-item">$1. $2</div>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/---/g, '<hr>')
      .replace(/\n(?=<[^h])/g, '<br>')
      .replace(/\n(?=<h)/g, '');

    return html;
  };

  const downloadPDF = () => {
    const content = generateFullOutline();
    const htmlContent = convertMarkdownToHtml(content);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${projectTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&display=swap');
            body { font-family: 'Source Han Serif SC', 'Noto Serif SC', 'Songti SC', 'STSong', serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.8; }
            h1 { font-size: 24px; text-align: center; }
            h2 { font-size: 18px; border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-top: 24px; }
            h3 { font-size: 14px; margin-top: 16px; }
            .toc-item { display: block; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; vertical-align: middle; }
            th { background: #f5f5f5; }
            td img { width: 72px; max-height: 72px; object-fit: cover; border-radius: 6px; display: block; }
            hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `);
    printWindow.document.close();
    const images = Array.from(printWindow.document.images || []);
    const waitForImages = images.map((img) => (
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          })
    ));
    Promise.all(waitForImages).finally(() => {
      printWindow.focus();
      printWindow.print();
    });
    setShowExport(false);
  };

  const downloadWord = () => {
    const content = generateFullOutline();
    const htmlContent = convertMarkdownToHtml(content);
    const wordHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(projectTitle)}</title>
          <style>
            body { font-family: "SimSun", "Songti SC", serif; line-height: 1.8; }
            h1 { font-size: 24px; text-align: center; }
            h2 { font-size: 18px; border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-top: 24px; }
            h3 { font-size: 14px; margin-top: 16px; }
            .toc-item { display: block; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; vertical-align: middle; }
            th { background: #f5f5f5; }
            td img { width: 72px; max-height: 72px; object-fit: cover; border-radius: 6px; display: block; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `;
    const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectTitle}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExport(false);
  };

  const handleExport = (format) => {
    setSelectedFormat(format);
  };

  const downloadMarkdown = () => {
    const content = generateFullOutline();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectTitle}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExport(false);
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
              Step 5 / 5
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", margin: 0 }}>
              展览大纲生成
            </h1>
            <p style={{ color: C.textSecondary, fontSize: 14, margin: "10px 0 0", lineHeight: 1.8, maxWidth: 720 }}>
              这里汇总了序言、单元结构、文稿与展品清单。请在导出前完整审核，并选择合适的交付格式。
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 20 }}>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>展览题目</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, lineHeight: 1.6 }}>{projectTitle}</div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>大纲章节</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{outlineToc.length} 段</div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>正文单元</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{unitsData.length} 个</div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>当前导出格式</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{selectedFormat}</div>
          </div>
        </div>
      </div>

      {warningVisible && (
        <div style={{
          background: "#FFFBEB", border: `1px solid ${C.warning}`, borderLeft: `4px solid ${C.warning}`,
          borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: C.warning,
        }}>
          ⚠️ 这是最终导出前的人工审核环节。AI 生成内容已标注来源，建议您完整浏览后再导出。导出前请确认学术内容的准确性。
        </div>
      )}

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ width: 260, flexShrink: 0 }}>
          <Card style={{ padding: "12px 0", borderRadius: 20, boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)" }}>
            <div style={{ padding: "0 16px 8px", fontWeight: 700, fontSize: 13, color: C.textSecondary }}>大纲目录</div>
            <Divider />
            <div style={{ padding: "8px 16px 4px", fontWeight: 700, fontSize: 12, color: C.textSecondary }}>{projectTitle}</div>
            {outlineToc.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                style={{
                  padding: "10px 16px", fontSize: 13, cursor: "pointer",
                  color: activeSection === item.id ? C.accentPrimary : C.textSecondary,
                  fontWeight: activeSection === item.id ? 600 : 400,
                  background: activeSection === item.id ? `${C.aiGenerated}88` : "transparent",
                  borderLeft: activeSection === item.id ? `3px solid ${C.accentPrimary}` : "3px solid transparent",
                }}
              >
                {item.title}
              </div>
            ))}
            <Divider />
            <div style={{ padding: "10px 16px 14px" }}>
              <Btn small onClick={() => setShowExport(true)} style={{ width: "100%" }}>⬇ 导出大纲</Btn>
            </div>
          </Card>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 10, fontSize: 12, marginBottom: 16, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <span style={{ background: C.aiGenerated, padding: "5px 10px", borderRadius: 999 }}>蓝色背景为 AI 生成原文</span>
            <span style={{ background: C.humanEdited, padding: "5px 10px", borderRadius: 999 }}>黄色背景为您已修改</span>
          </div>

          <div style={{
            borderRadius: 24,
            border: `1px solid ${C.border}`,
            background: C.bgElevated || C.bgSecondary,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
            padding: "22px 24px",
          }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", margin: "0 0 16px" }}>
              {projectTitle}
            </h1>
            <Divider />

            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, marginTop: 18, marginBottom: 12, fontFamily: "var(--font-serif)" }}>
              {currentSection.title}
            </h2>

            <div
              dangerouslySetInnerHTML={{ __html: currentSection.content }}
              style={{
                background: currentSection.isAI ? C.aiGenerated : C.humanEdited,
                borderRadius: 16,
                padding: "16px 18px",
                fontSize: 14,
                lineHeight: 1.85,
                fontFamily: "var(--font-serif)",
                color: C.textPrimary,
                marginBottom: 20,
                border: `1px solid ${currentSection.isAI ? `${C.accentPrimary}22` : `${C.accentSecondary}33`}`,
              }}
            />

            {(() => {
              const unitExhibits = resolveUnitExhibits(activeSection);

              return unitExhibits.length > 0 && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 10 }}>展品列表</h3>
                <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 16, background: C.bgPrimary }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: C.bgElevated || C.bgSecondary }}>
                        {["文物名称", "时间", "地点", "材质", "展品图", "展品ID"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: C.textSecondary, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {unitExhibits.map((ex, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : C.bgPrimary }}>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.textPrimary, fontWeight: 600 }}>{getExhibitName(ex) || '-'}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.textPrimary }}>{getExhibitTime(ex) || '-'}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.textPrimary }}>{getExhibitPlace(ex) || '-'}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.textPrimary }}>{getExhibitMaterial(ex) || '-'}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.textPrimary }}>
                            {getExhibitImage(ex) ? (
                              <img
                                src={getExhibitImage(ex)}
                                alt={getExhibitName(ex) || '展品图'}
                                style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}`, display: "block" }}
                              />
                            ) : '-'}
                          </td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.textPrimary, wordBreak: "break-all" }}>{getExhibitId(ex) || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
            })()}
          </div>
        </div>
      </div>

      {showExport && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.28)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
          backdropFilter: "blur(4px)", padding: 16,
        }}>
          <div style={{ background: C.bgPrimary, borderRadius: 22, padding: 28, width: 400, maxWidth: "100%", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.14)", border: `1px solid ${C.border}` }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, margin: 0, marginBottom: 16, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>导出策展大纲</h3>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 8 }}>导出格式</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" name="format" checked={selectedFormat === 'PDF'} onChange={() => handleExport('PDF')} /> PDF (.pdf)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginTop: 6 }}>
                <input type="radio" name="format" checked={selectedFormat === 'Word'} onChange={() => handleExport('Word')} /> Word (.doc)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginTop: 6 }}>
                <input type="radio" name="format" checked={selectedFormat === 'Markdown'} onChange={() => handleExport('Markdown')} /> Markdown (.md)
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <Btn variant="ghost" onClick={() => setShowExport(false)}>取消</Btn>
              <Btn onClick={handleExportClick}>导出</Btn>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.28)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
          backdropFilter: "blur(4px)", padding: 16,
        }}>
          <div style={{ background: C.bgPrimary, borderRadius: 22, padding: 28, width: 420, maxWidth: "100%", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.14)", border: `1px solid ${C.border}` }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, margin: 0, marginBottom: 12, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>确认完成</h3>
            <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 20, lineHeight: 1.6 }}>
              确定要完成此策展项目吗？项目将移至已完成列表，您可以随时在"已完成项目"中查看。
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowCompleteModal(false)}>取消</Btn>
              <Btn variant="success" onClick={confirmComplete}>确认完成</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{
        marginTop: 24,
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
            审核无误后即可导出或完成项目
          </div>
          <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
            你可以先导出交付稿，也可以直接完成项目并归档到已完成列表。
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={goPrevStep}>← 返回 Step4</Btn>
          <Btn variant="success" onClick={handleComplete}>✓ 完成</Btn>
        </div>
      </div>
    </main>
  );
};
