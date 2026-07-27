export const Tag = ({ label, color, textColor = "#fff", theme }) => {
  const defaultColor = theme?.accentPrimary || "#2B5F8E";
  
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 11,
      lineHeight: 1.2,
      fontWeight: 600,
      letterSpacing: "0.01em",
      background: color || defaultColor,
      color: textColor,
      boxShadow: theme?.shadowSm || "none",
    }}>{label}</span>
  );
};
