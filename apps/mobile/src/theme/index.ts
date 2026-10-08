import { Platform, type TextStyle, type ViewStyle } from "react-native";

export const colors = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryDeep: "#1E3A8A",
  primarySoft: "#DBEAFE",
  primaryTint: "#EFF6FF",
  secondary: "#06B6D4",
  secondarySoft: "#CFFAFE",
  accent: "#10B981",
  accentDark: "#059669",
  accentSoft: "#D1FAE5",

  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  textInverse: "#FFFFFF",

  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F5F9",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",

  success: "#10B981",
  successSoft: "#ECFDF5",
  warning: "#F59E0B",
  warningDark: "#B45309",
  warningSoft: "#FFFBEB",
  danger: "#EF4444",
  dangerDark: "#B91C1C",
  dangerSoft: "#FEF2F2",

  overlay: "rgba(15, 23, 42, 0.45)",
  white: "#FFFFFF",
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, full: 999 } as const;

export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semiBold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

export const type = {
  display: { fontFamily: font.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  title: { fontFamily: font.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  heading: { fontFamily: font.semiBold, fontSize: 17, lineHeight: 24 },
  subheading: { fontFamily: font.semiBold, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: font.medium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  smallMedium: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

function makeShadow(y: number, blur: number, opacity: number, elevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: y }, shadowOpacity: opacity, shadowRadius: blur },
    android: { elevation },
    default: { boxShadow: `0px ${y}px ${blur * 2}px rgba(15,23,42,${opacity})` } as ViewStyle,
  })!;
}

export const shadow = {
  sm: makeShadow(1, 3, 0.06, 1),
  md: makeShadow(4, 12, 0.08, 3),
  lg: makeShadow(10, 24, 0.12, 8),
};
