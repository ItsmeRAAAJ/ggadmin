import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, shadow, spacing } from "@/theme";

export function Card({
  children,
  onPress,
  style,
  padded = true,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  accessibilityLabel?: string;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, padded && styles.padded, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  padded: { padding: spacing.base },
  pressed: { backgroundColor: colors.surfaceMuted, transform: [{ scale: 0.99 }] },
});
