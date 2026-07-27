export function ToastProvider({ children, toast, theme }) {
  const C = theme;
  const toastColors = {
    success: C.success,
    error: C.danger || '#B65151',
    warning: C.warning,
    info: C.accentPrimary,
  };
  
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {children}
      {toast?.visible && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 1000,
          minWidth: 180,
          padding: "14px 20px",
          borderRadius: 14,
          boxShadow: C.shadowMd,
          border: `1px solid ${C.border}`,
          background: C.bgElevated,
          color: C.textPrimary,
          fontSize: 13,
          fontWeight: 600,
          textAlign: "center",
          animation: "toastSlideUp 0.3s ease",
        }}>
          <span style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: toastColors[toast.type] || C.accentPrimary,
            marginRight: 10,
            verticalAlign: "middle",
          }} />
          {toast.message}
        </div>
      )}
      <style>{`
        @keyframes toastSlideUp {
          from { opacity: 0; transform: translate(-50%, -30%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </div>
  );
}
