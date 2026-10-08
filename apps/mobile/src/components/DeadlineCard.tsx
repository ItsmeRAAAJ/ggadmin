import { CalendarClock, UserRound } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Badge, Card, Text, type BadgeTone } from "@/components/ui";
import { Meta, SubjectTag } from "@/components/ItemCards";
import { formatDateTime, formatDaysLeft } from "@/lib/format";
import type { DeadlineItem } from "@/lib/types";
import { colors, radius, spacing } from "@/theme";

export function deadlineTone(daysLeft: number, isPast: boolean): BadgeTone {
  if (isPast) return "neutral";
  if (daysLeft <= 0) return "danger";
  if (daysLeft <= 2) return "warning";
  return "info";
}

export function DeadlineCard({ item, onPress, expanded = false }: { item: DeadlineItem; onPress?: () => void; expanded?: boolean }) {
  const tone = deadlineTone(item.daysLeft, item.isPast);
  const accent = tone === "danger" ? colors.danger : tone === "warning" ? colors.warning : tone === "info" ? colors.primary : colors.border;
  return (
    <Card onPress={onPress} accessibilityLabel={`${item.title}, ${formatDaysLeft(item.daysLeft)}`} style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <SubjectTag code={item.subject.code} name={item.subject.name} />
          <Text variant="heading" numberOfLines={expanded ? undefined : 2} style={styles.title}>
            {item.title}
          </Text>
        </View>
        <Badge label={item.isPast ? "Passed" : formatDaysLeft(item.daysLeft)} tone={tone} />
      </View>
      {expanded && item.description ? (
        <Text variant="body" color={colors.textSecondary} style={styles.desc}>
          {item.description}
        </Text>
      ) : null}
      <View style={styles.footer}>
        <Meta icon={CalendarClock} text={formatDateTime(item.dueAt)} color={tone === "danger" ? colors.danger : colors.textSecondary} />
        <Meta icon={UserRound} text={item.teacherName} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderLeftWidth: 4 },
  flex: { flex: 1 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  title: { marginTop: 4 },
  desc: { marginTop: spacing.sm },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
    borderRadius: radius.sm,
  },
});
