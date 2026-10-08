import { Check, Circle } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Text } from "@/components/ui";
import { passwordRules } from "@/lib/validation";
import { colors, spacing } from "@/theme";

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <View style={styles.list}>
      {passwordRules.map((r) => {
        const ok = r.test(password);
        return (
          <View key={r.key} style={styles.item}>
            {ok ? <Check size={14} color={colors.accent} strokeWidth={3} /> : <Circle size={12} color={colors.textMuted} />}
            <Text variant="small" color={ok ? colors.accentDark : colors.textSecondary}>
              {r.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.xs + 2, columnGap: spacing.base },
  item: { flexDirection: "row", alignItems: "center", gap: 6, width: "46%" },
});
