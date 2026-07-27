export const Modal = ({
  children,
  title,
  onClose,
  width = 400,
  showFooter = true,
  footer,
  C,
}) => {
  const theme = C || {};

  return (
    <div
      onClick={onClose}
      style={{
      position: "fixed",
      inset: 0,
      background: theme.overlay || "rgba(0,0,0,.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 400,
      padding: 24,
      backdropFilter: "blur(6px)",
    }}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
        background: theme.bgElevated || "#fff",
        borderRadius: 18,
        padding: 24,
        width: width,
        maxWidth: "100%",
        maxHeight: "90vh",
        overflow: "auto",
        border: `1px solid ${theme.border || "#E5E7EB"}`,
        boxShadow: theme.shadowLg || "0 24px 64px rgba(0,0,0,.16)",
      }}>
        {title && (
          <h3 style={{ fontSize: 18, fontWeight: 700, color: theme.textPrimary || "#111827", marginBottom: 16 }}>
            {title}
          </h3>
        )}
        {children}
        {showFooter && (
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
