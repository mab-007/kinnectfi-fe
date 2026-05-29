import { Platform } from "react-native";

// Palette pulled from the onboarding mockups: warm cream canvas, ink text,
// terracotta primary action.
export const colors = {
  bg: "#F4EFE7",
  surface: "#FBF8F2",
  ink: "#2A2724",
  inkSoft: "#6F685E",
  inkFaint: "#A89F92",
  primary: "#D8623E",
  primaryPressed: "#BE5031",
  primaryDisabled: "#E7B6A6",
  border: "#E4DCCE",
  field: "#FFFFFF",
  danger: "#C0492B",
  success: "#2E7D5B",
  onPrimary: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

// Serif display face to echo the mockup headings without bundling a custom font.
export const fonts = {
  serif: Platform.select({ ios: "Georgia", default: "serif" }),
};
