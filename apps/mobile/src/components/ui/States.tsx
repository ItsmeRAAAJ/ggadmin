import { CloudOff, Inbox, type LucideIcon, RefreshCw, TriangleAlert } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import type { ApiError } from "@/lib/api";
import { colors, radius, spacing } from "@/theme";
import { Button } from "./Button";
import { Text } from "./Text";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  actionLabel,
  onAction,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <View style={styles.iconWrap}>
        <Icon size={26} color={colors.primary} strokeWidth={1.8} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="small" color={colors.textSecondary} align="center" style={styles.msg}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="secondary" size="sm" fullWidth={false} style={styles.action} />
      ) : null}
    </View>
  );
}

export function ErrorState({ error, onRetry, compact }: { error: ApiError | null; onRetry: () => void; compact?: boolean }) {
  const offline = error?.isNetwork;
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <View style={[styles.iconWrap, { backgroundColor: offline ? colors.surfaceMuted : colors.dangerSoft }]}>
        {offline ? <CloudOff size={26} color={colors.textSecondary} /> : <TriangleAlert size={26} color={colors.danger} />}
      </View>
      <Text variant="heading" align="center">
        {offline ? "You're offline" : "Couldn't load this"}
      </Text>
      <Text variant="small" color={colors.textSecondary} align="center" style={styles.msg}>
        {error?.message ?? "Something went wrong. Please try again."}
      </Text>
      <Button title="Try again" icon={RefreshCw} onPress={onRetry} variant="outline" size="sm" fullWidth={false} style={styles.action} />
    </View>
  );
}

export function Skeleton({
  width = "100%",
  height = 16,
  rounded = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ width, height, borderRadius: rounded, backgroundColor: colors.border, opacity }, style]} />;
}

export function SkeletonList({ count = 4, height = 92 }: { count?: number; height?: number }) {
  return (
    <View style={{ gap: spacing.md }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} rounded={radius.lg} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  compact: { paddingVertical: spacing.xl },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  msg: { maxWidth: 300 },
  action: { marginTop: spacing.md },
});
