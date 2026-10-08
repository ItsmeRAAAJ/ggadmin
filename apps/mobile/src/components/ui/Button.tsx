import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "@/theme";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const palette: Record<Variant, { bg: string; bgPressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, bgPressed: colors.primaryDark, fg: colors.white },
  secondary: { bg: colors.primaryTint, bgPressed: colors.primarySoft, fg: colors.primaryDark },
  outline: { bg: colors.surface, bgPressed: colors.surfaceMuted, fg: colors.text, border: colors.border },
  ghost: { bg: "transparent", bgPressed: colors.surfaceMuted, fg: colors.primary },
  danger: { bg: colors.dangerSoft, bgPressed: "#FEE2E2", fg: colors.dangerDark },
  success: { bg: colors.accent, bgPressed: colors.accentDark, fg: colors.white },
};

const heights: Record<Size, number> = { sm: 36, md: 48, lg: 54 };

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  icon: Icon,
  iconRight: IconRight,
  fullWidth = true,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const p = palette[variant];
  const inactive = disabled || loading;
  const iconSize = size === "sm" ? 16 : 18;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          paddingHorizontal: size === "sm" ? spacing.md : spacing.lg,
          backgroundColor: pressed ? p.bgPressed : p.bg,
          borderColor: p.border ?? "transparent",
          borderWidth: p.border ? 1 : 0,
          opacity: disabled && !loading ? 0.5 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <View style={styles.row}>
          {Icon ? <Icon size={iconSize} color={p.fg} strokeWidth={2.2} /> : null}
          {title ? (
            <Text variant={size === "sm" ? "smallMedium" : "subheading"} color={p.fg} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {IconRight ? <IconRight size={iconSize} color={p.fg} strokeWidth={2.2} /> : null}
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  onPress,
  label,
  color = colors.text,
  bg = colors.surface,
  size = 40,
  disabled,
}: {
  icon: LucideIcon;
  onPress: () => void;
  label: string;
  color?: string;
  bg?: string;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.icon,
        { width: size, height: size, backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Icon size={Math.round(size * 0.5)} color={color} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: { borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
});
