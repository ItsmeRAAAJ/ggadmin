import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "@/theme";
import { Text } from "./Text";

export type Segment<K extends string> = { key: K; label: string; count?: number };

export function Segmented<K extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<K>[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {segments.map((s) => {
        const active = s.key === value;
        return (
          <Pressable
            key={s.key}
            onPress={() => onChange(s.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.active]}
          >
            <Text variant="smallMedium" color={active ? colors.white : colors.textSecondary}>
              {s.label}
            </Text>
            {s.count !== undefined ? (
              <View style={[styles.count, active && styles.countActive]}>
                <Text variant="caption" color={active ? colors.primaryDark : colors.textSecondary}>
                  {s.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.base,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  count: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  countActive: { backgroundColor: colors.white },
});
