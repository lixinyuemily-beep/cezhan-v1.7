import { Divider } from '../ui';

const MenuIcon = ({ type }) => {
  const iconStyle = { width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" };
  
  switch (type) {
    case 'projects':
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      );
    case 'add':
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      );
    case 'exhibits':
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      );
    case 'settings':
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      );
    case 'help':
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      );
    default:
      return null;
  }
};

export const Sidebar = ({
  currentPage,
  currentStep,
  currentProject,
  navigateTo,
  createNewProject,
  theme,
}) => {
  const C = theme;
  const menuItems = [
    { iconType: "projects", label: "我的项目", key: "p0" },
    { iconType: "add", label: "新建策展", key: "p1" },
    { iconType: "exhibits", label: "展品库", key: "exhibits" },
  ];

  const handleNavClick = (key) => {
    if (key === 'p0') {
      navigateTo(key);
    } else if (key === 'p1') {
      createNewProject();
    } else if (key === 'exhibits') {
      navigateTo(key);
    } else if (key.startsWith('step')) {
      const step = parseInt(key.replace('step', ''), 10);
      if (step <= currentStep) {
        navigateTo(key);
      }
    }
  };

  const showProjectInfo = currentPage.startsWith('step') && currentProject;

  return (
    <aside style={{
      width: 232,
      minHeight: "100vh",
      background: `linear-gradient(180deg, ${C.bgSidebar} 0%, ${C.sidebarAccent || C.bgSidebar} 100%)`,
      display: "flex",
      flexDirection: "column",
      padding: "0",
      position: "fixed",
      top: 0,
      left: 0,
      zIndex: 100,
      boxShadow: C.shadowMd,
      borderRight: `1px solid rgba(255,255,255,0.06)`,
    }}>
      <div style={{ padding: "24px 22px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36,
          height: 36,
          background: `linear-gradient(135deg, ${C.accentSecondary} 0%, ${C.accentPrimary} 100%)`,
          borderRadius: 12,
          flexShrink: 0,
          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.22)",
        }} />
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, letterSpacing: "0.03em", fontFamily: "var(--font-serif)" }}>
          智能策展助手
        </span>
      </div>
      <Divider style={{ margin: "0 0 8px", background: "rgba(255,255,255,.08)" }} />

      {menuItems.map(item => (
        <button
          key={item.key}
          onClick={() => handleNavClick(item.key)}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 16px",
            border: "none",
            cursor: "pointer",
            background: currentPage === item.key ? "rgba(255,255,255,0.11)" : "transparent",
            color: "#fff",
            fontSize: 13,
            fontWeight: currentPage === item.key ? 600 : 500,
            fontFamily: "var(--font-ui)",
            borderRadius: currentPage === item.key ? 12 : 0,
            margin: currentPage === item.key ? "2px 10px" : "2px 0",
            textAlign: "left",
            transition: "background 0.15s, transform 0.15s",
            boxShadow: currentPage === item.key ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "none",
          }}
        >
          <MenuIcon type={item.iconType} />&nbsp;&nbsp;{item.label}
        </button>
      ))}

      {showProjectInfo && (
        <>
          <Divider style={{ margin: "12px 0", background: "rgba(255,255,255,.1)" }} />
          <div style={{
            margin: "0 14px",
            padding: "14px 14px 12px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, lineHeight: 1.5, marginBottom: 6 }}>
              {currentProject?.title || '未命名策展项目'}
            </div>
            <div style={{ color: C.accentSecondary, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
              Step {currentStep} / 5
            </div>
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />
      <Divider style={{ margin: "0", background: "rgba(255,255,255,.08)" }} />
      <div style={{ padding: "8px 10px", display: "flex", gap: 6 }}>
        <button
          onClick={() => navigateTo('settings')}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px", border: "none", cursor: "pointer",
            background: currentPage === 'settings' ? "rgba(255,255,255,0.11)" : "rgba(255,255,255,0.03)",
            color: currentPage === 'settings' ? "#fff" : "rgba(255,255,255,0.74)",
            fontSize: 12,
            fontWeight: currentPage === 'settings' ? 700 : 500,
            borderRadius: 10,
            transition: "background 0.15s, color 0.15s",
            boxShadow: currentPage === 'settings' ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "none",
          }}
        >
          <MenuIcon type="settings" /> 设置
        </button>
        <button
          onClick={() => navigateTo('help')}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px", border: "none", cursor: "pointer",
            background: currentPage === 'help' ? "rgba(255,255,255,0.11)" : "rgba(255,255,255,0.03)",
            color: currentPage === 'help' ? "#fff" : "rgba(255,255,255,0.74)",
            fontSize: 12,
            fontWeight: currentPage === 'help' ? 700 : 500,
            borderRadius: 10,
            transition: "background 0.15s, color 0.15s",
            boxShadow: currentPage === 'help' ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "none",
          }}
        >
          <MenuIcon type="help" /> 帮助
        </button>
      </div>
      <div style={{ height: 12 }} />
    </aside>
  );
};
