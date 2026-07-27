export const C_LIGHT = {
  bgPrimary:       "#F4F0E8",
  bgSecondary:     "#FFFCF7",
  bgElevated:      "#FFFFFF",
  bgMuted:         "#F6F1E8",
  bgSidebar:       "#102235",
  sidebarAccent:   "#17314B",
  accentPrimary:   "#1F3A5F",
  accentSecondary: "#A97A42",
  textPrimary:     "#18212B",
  textSecondary:   "#6A7280",
  textPlaceholder: "#9DA5B2",
  border:          "#DED6C8",
  aiGenerated:     "#EEF3F8",
  humanEdited:     "#F7EFE4",
  warning:         "#B7791F",
  success:         "#2F6B4F",
  danger:          "#B65151",
  stepInactive:    "#D7D0C4",
  sliderTrack:     "#E6DED2",
  sliderThumb:     "#1F3A5F",
  hoverBg:         "#F1EBE1",
  overlay:         "rgba(16, 24, 40, 0.42)",
  shadowSm:        "0 10px 30px rgba(16, 24, 40, 0.06)",
  shadowMd:        "0 18px 48px rgba(16, 24, 40, 0.10)",
  shadowLg:        "0 24px 64px rgba(16, 24, 40, 0.14)",
};

export const C_DARK = {
  bgPrimary:       "#111827",
  bgSecondary:     "#182433",
  bgElevated:      "#1E2D3F",
  bgMuted:         "#162231",
  bgSidebar:       "#0A1220",
  sidebarAccent:   "#132237",
  accentPrimary:   "#7FA6D6",
  accentSecondary: "#D2A35A",
  textPrimary:     "#F8FAFC",
  textSecondary:   "#B3BFCC",
  textPlaceholder: "#7D8A99",
  border:          "#2C3B4E",
  aiGenerated:     "#16304D",
  humanEdited:     "#3B3022",
  warning:         "#D6A04C",
  success:         "#57A57C",
  danger:          "#D16D6D",
  stepInactive:    "#334255",
  sliderTrack:     "#28384A",
  sliderThumb:     "#7FA6D6",
  hoverBg:         "#203043",
  overlay:         "rgba(2, 6, 23, 0.56)",
  shadowSm:        "0 10px 30px rgba(0, 0, 0, 0.22)",
  shadowMd:        "0 18px 48px rgba(0, 0, 0, 0.28)",
  shadowLg:        "0 24px 64px rgba(0, 0, 0, 0.34)",
};

export const getTheme = (isDark) => isDark ? C_DARK : C_LIGHT;

export const C = C_LIGHT;
export const FONT_UI = "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif";
export const FONT_SERIF = "'Source Han Serif SC', 'Noto Serif SC', 'Songti SC', 'STSong', serif";

export const STEPS = ["叙事方向", "单元结构", "展品推荐", "策展文本", "完整大纲"];
