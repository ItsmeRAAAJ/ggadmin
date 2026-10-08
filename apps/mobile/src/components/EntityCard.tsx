import { EllipsisVertical, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { Card, Text } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";

type Action = { label: string; onPress: () => void; destructive?: boolean };

export function showActions(title: string, actions: Action[]) {
  if (Platform.OS === "ios") {
    const labels = [...actions.map((a) => a.label), "Cancel"];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex: actions.map((a, i) => (a.destructive ? i : -1)).filter((i) => i >= 0),
      },
      (i) => actions[i]?.onPress()
    );
  } else {
    Alert.alert(title, undefined, [
      ...actions.map((a) => ({ text: a.label, onPress: a.onPress, style: a.destructive ? ("destructive" as const) : ("default" as const) })),
      { text: "Cancel", style: "cancel" as const },
    ], { cancelable: true });
  }
}

/** Card used by the profile collection screens (certificates, projects, …). */
export function EntityCard({
  icon: Icon,
  iconColor = colors.primary,
  iconBg = colors.primaryTint,
  title,
  subtitle,
  meta,
  children,
  onPress,
  actions,
}: {
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  children?: ReactNode;
  onPress?: () => void;
  actions: Action[];
}) {
  return (
    <Card onPress={onPress} accessibilityLabel={title}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: iconBg }]}>
          <Icon size={20} color={iconColor} />
        </View>
        <View style={styles.body}>
          <Text variant="subheading" numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="small" color={colors.textSecondary} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
          {meta ? (
            <Text variant="small" color={colors.textMuted}>
              {meta}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => showActions(title, actions)}
          hitSlop={10}
          style={styles.more}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${title}`}
        >
          <EllipsisVertical size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
  more: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: -spacing.xs },
});

/** Confirm-and-delete helper. */
export function confirmDelete(what: string, onConfirm: () => Promise<void>) {
  Alert.alert(`Delete ${what}?`, "This can't be undone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => void onConfirm() },
  ]);
}
