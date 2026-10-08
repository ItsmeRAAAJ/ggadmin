import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "@/theme";
import { Text } from "./Text";

export type BadgeTone = "neutral" | "primary" | "info" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary },
  primary: { bg: colors.primaryTint, fg: colors.primaryDark },
  info: { bg: "#ECFEFF", fg: "#0E7490" },
  success: { bg: colors.successSoft, fg: colors.accentDark },
  warning: { bg: colors.warningSoft, fg: colors.warningDark },
  danger: { bg: colors.dangerSoft, fg: colors.dangerDark },
};

export function Badge({ label, tone = "neutral", icon: Icon, dot }: { label: string; tone?: BadgeTone; icon?: LucideIcon; dot?: boolean }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: t.fg }]} /> : null}
      {Icon ? <Icon size={12} color={t.fg} strokeWidth={2.4} /> : null}
      <Text variant="caption" color={t.fg} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
