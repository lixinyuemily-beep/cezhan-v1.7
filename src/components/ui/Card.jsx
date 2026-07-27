export const Card = ({ children, style = {}, highlighted = false, onClick, theme }) => {
  const C = theme || {
    aiGenerated: "#EEF3F8",
    bgElevated: "#FFFFFF",
    accentPrimary: "#1F3A5F",
    border: "#DED6C8",
    shadowSm: "0 10px 30px rgba(16, 24, 40, 0.06)",
  };
  
  return (
    <div 
      onClick={onClick}
      style={{
        background: highlighted ? C.aiGenerated : (C.bgElevated || C.bgSecondary),
        borderRadius: 16,
        border: `1px solid`,
        borderColor: highlighted ? C.accentPrimary : C.border,
        boxShadow: C.shadowSm,
        overflow: "hidden",
        ...style,
      }}
    >{children}</div>
  );
};
