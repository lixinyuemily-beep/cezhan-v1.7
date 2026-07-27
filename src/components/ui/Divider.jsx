import React from 'react';

export const Divider = ({ style = {}, theme }) => {
  const borderColor = theme?.border || "#E0DDD6";
  
  return (
    <div style={{ height: 1, background: borderColor, margin: "12px 0", ...style }} />
  );
};
