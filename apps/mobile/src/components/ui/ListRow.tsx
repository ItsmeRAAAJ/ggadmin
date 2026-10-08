import { ChevronRight, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "@/theme";
import { Text } from "./Text";

export function ListRow({
  icon: Icon,
  iconColor = colors.primary,
  iconBg = colors.primaryTint,
  title,
  subtitle,
  right,
  onPress,
  chevron = !!onPress,
  destructive,
}: {
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
}) {
  const content = (
    <>
      {Icon ? (
        <View style={[styles.icon, { backgroundColor: destructive ? colors.dangerSoft : iconBg }]}>
          <Icon size={18} color={destructive ? colors.danger : iconColor} strokeWidth={2} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="bodyMedium" color={destructive ? colors.dangerDark : colors.text} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" color={colors.textSecondary} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <ChevronRight size={18} color={colors.textMuted} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      {content}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: inset }} />;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <Text variant="heading">{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text variant="smallMedium" color={colors.primary}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.base, minHeight: 56 },
  icon: { width: 36, height: 36, borderRadius: radius.sm + 2, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
});
