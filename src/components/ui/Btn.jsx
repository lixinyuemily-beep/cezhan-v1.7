export const Btn = ({ children, onClick, variant = "primary", disabled = false, small = false, theme, style }) => {
  const C = theme || {
    accentPrimary: "#1F3A5F",
    bgElevated: "#FFFFFF",
    textSecondary: "#6A7280",
    border: "#DED6C8",
    textPrimary: "#18212B",
    stepInactive: "#D7D0C4",
    danger: "#B65151",
    shadowSm: "0 10px 30px rgba(16, 24, 40, 0.06)",
  };
  
  const base = {
    minHeight: small ? 32 : 40,
    padding: small ? "6px 14px" : "10px 20px",
    borderRadius: 10,
    border: "1px solid transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: small ? 12 : 13,
    lineHeight: 1.2,
    fontFamily: "var(--font-ui)",
    fontWeight: 600,
    letterSpacing: "0.01em",
    transition: "all .18s ease",
    opacity: disabled ? 0.45 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "none",
  };
  const variants = {
    primary:  { background: C.accentPrimary, color: "#fff", boxShadow: C.shadowSm },
    ghost:    { background: C.bgElevated || "#fff", color: C.textSecondary, border: `1px solid ${C.border}` },
    danger:   { background: `${C.danger || "#B65151"}14`, color: C.danger || "#B65151", border: `1px solid ${(C.danger || "#B65151")}22` },
    success:  { background: C.accentPrimary, color: "#fff", boxShadow: C.shadowSm },
    outline:  { background: C.bgElevated || "#fff", color: C.textPrimary, border: `1px solid ${C.border}` },
    disabled: { background: C.stepInactive, color: "#fff" },
  };
  return (
    <button style={{ ...base, ...(disabled ? variants.disabled : variants[variant]), ...style }}
      onClick={disabled ? undefined : onClick}>{children}</button>
  );
};
