import { ChevronRight, Clock } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Badge, Card, Text } from "@/components/ui";
import { formatDateTime, relativeTo } from "@/lib/format";
import { assignmentView } from "@/lib/status";
import type { AssignmentListItem } from "@/lib/types";
import { colors, radius, spacing } from "@/theme";

export function Meta({ icon: Icon, text, color = colors.textSecondary }: { icon: typeof Clock; text: string; color?: string }) {
  return (
    <View style={styles.meta}>
      <Icon size={14} color={color} />
      <Text variant="small" color={color} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export function SubjectTag({ code, name }: { code: string; name: string }) {
  return (
    <Text variant="caption" color={colors.primary} numberOfLines={1}>
      {code} · {name.toUpperCase()}
    </Text>
  );
}

export function AssignmentCard({ item, onPress }: { item: AssignmentListItem; onPress: () => void }) {
  const v = assignmentView(item);
  const submitted = item.submissionStatus !== "NOT_SUBMITTED";
  const dueText = submitted && item.submittedAt ? `Submitted ${formatDateTime(item.submittedAt)}` : `Due ${formatDateTime(item.dueAt)}`;
  const dueColor = !submitted && item.isOverdue ? colors.danger : !submitted && v.pending ? colors.warningDark : colors.textSecondary;
  return (
    <Card onPress={onPress} accessibilityLabel={`${item.title}, ${v.label}`}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <SubjectTag code={item.subject.code} name={item.subject.name} />
          <Text variant="heading" numberOfLines={2} style={styles.title}>
            {item.title}
          </Text>
        </View>
        <Badge label={v.label} tone={v.tone} />
      </View>
      <View style={styles.footer}>
        <Meta icon={Clock} text={dueText} color={dueColor} />
        {!submitted && v.pending && !item.isOverdue ? (
          <Text variant="smallMedium" color={colors.textMuted}>
            {relativeTo(item.dueAt).replace(/^in /, "")} left
          </Text>
        ) : (
          <ChevronRight size={18} color={colors.textMuted} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  title: { marginTop: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
    borderRadius: radius.sm,
  },
});
