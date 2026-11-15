export const PageSettings = ({ 
  darkMode,
  setDarkMode,
  theme,
}) => {
  const C = theme;
  const infoCardStyle = {
    padding: "14px 16px",
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    background: C.bgElevated || C.bgSecondary,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  };
  const sectionCardStyle = {
    borderRadius: 20,
    border: `1px solid ${C.border}`,
    background: C.bgElevated || C.bgSecondary,
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.04)",
    padding: "20px 22px",
  };
  const switchTrackStyle = {
    width: 48,
    height: 28,
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    background: darkMode ? C.accentPrimary : C.stepInactive,
    position: "relative",
    transition: "background 0.2s ease",
    boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.14)",
  };
  const switchThumbStyle = {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#fff",
    position: "absolute",
    top: 3,
    left: darkMode ? 23 : 3,
    transition: "left 0.2s ease",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.18)",
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
            Workspace Settings
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", margin: 0 }}>
            设置
          </h1>
          <p style={{ color: C.textSecondary, fontSize: 14, margin: "10px 0 0", lineHeight: 1.8, maxWidth: 720 }}>
            统一管理界面外观、系统行为和当前工作台状态，让日常策展操作保持稳定、清晰、可追踪。
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 20 }}>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>当前主题</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
              {darkMode ? '深色模式' : '浅色模式'}
            </div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>自动保存</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>已启用</div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>数据同步</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>云端项目存档</div>
          </div>
          <div style={infoCardStyle}>
            <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>当前版本</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>v1.0.0</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>
        <div style={{ ...sectionCardStyle, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)" }}>
              界面偏好
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7, marginTop: 6 }}>
              这部分用于控制工作台的视觉呈现与阅读舒适度，优先保证长时间编辑时的稳定体验。
            </div>
          </div>

          <div style={{
            padding: "18px 18px",
            borderRadius: 18,
            border: `1px solid ${C.border}`,
            background: C.bgPrimary,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: C.textPrimary }}>深色模式</div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.8 }}>
                  切换整体界面配色，在暗光环境下减少屏幕眩光；开启后，侧边栏、内容卡片与编辑区域会同步切换。
                </div>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                aria-label="切换深色模式"
                style={switchTrackStyle}
              >
                <div style={switchThumbStyle} />
              </button>
            </div>
          </div>

          <div style={{
            padding: "18px 18px",
            borderRadius: 18,
            border: `1px solid ${C.border}`,
            background: C.bgPrimary,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
          }}>
            <div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 6 }}>推荐场景</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>长时间审稿与夜间使用</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 6 }}>生效范围</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>全局页面与编辑器区域</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 6 }}>切换方式</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>即时应用，无需刷新</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={sectionCardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", marginBottom: 10 }}>
              工作方式
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{
                padding: "14px 16px",
                borderRadius: 16,
                background: C.bgPrimary,
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>自动保存</div>
                <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.7 }}>
                  项目编辑进度会持续写入云端，返回“我的项目”后可继续接续当前工作。
                </div>
              </div>
              <div style={{
                padding: "14px 16px",
                borderRadius: 16,
                background: C.bgPrimary,
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>导出与交付</div>
                <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.7 }}>
                  完整大纲阶段支持导出 Markdown、Word 与 PDF，便于交付策展方案或继续编辑。
                </div>
              </div>
            </div>
          </div>

          <div style={sectionCardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", marginBottom: 10 }}>
              关于系统
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.8 }}>
              <div style={{ color: C.textPrimary, fontWeight: 700, marginBottom: 8 }}>智能策展助手 v1.0.0</div>
              <div>
                面向策展工作流的 AI 协作平台，围绕叙事方向、单元结构、展品推荐、策展文本与完整大纲，提供从方案生成到交付导出的连续支持。
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
