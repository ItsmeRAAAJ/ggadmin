import { CalendarCheck2, History } from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, SectionList, StyleSheet, View } from "react-native";
import { DeadlineCard, deadlineTone } from "@/components/DeadlineCard";
import { EmptyState, ErrorState, Segmented, SkeletonList, Text } from "@/components/ui";
import { useQuery } from "@/hooks/useQuery";
import { academicsApi } from "@/lib/api";
import { formatDayKey } from "@/lib/format";
import type { DeadlineItem } from "@/lib/types";
import { colors, spacing } from "@/theme";

type Tab = "upcoming" | "past";

export default function DeadlinesScreen() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const q = useQuery(() => academicsApi.deadlines(tab), { deps: [tab], refetchOnFocus: true });

  // Past deadlines read best newest-first; upcoming soonest-first (server order).
  const groups = q.data?.groups ?? [];
  const sections = (tab === "past" ? [...groups].reverse() : groups).map((g) => ({
    key: g.date,
    daysLeft: g.daysLeft,
    data: tab === "past" ? [...g.items].reverse() : g.items,
  }));

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Segmented
          value={tab}
          onChange={setTab}
          segments={[
            { key: "upcoming", label: "Upcoming", count: tab === "upcoming" && q.data ? q.data.items.length : undefined },
            { key: "past", label: "Past" },
          ]}
        />
      </View>
      {q.loading && !q.data ? (
        <View style={styles.pad}>
          <SkeletonList count={4} height={120} />
        </View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.reload} />
      ) : (
        <SectionList<DeadlineItem, { key: string; daysLeft: number }>
          sections={sections}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          renderSectionHeader={({ section }) => {
            const tone = deadlineTone(section.daysLeft, tab === "past");
            const color = tone === "danger" ? colors.danger : tone === "warning" ? colors.warningDark : colors.textSecondary;
            return (
              <View style={styles.sectionHead}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text variant="smallMedium" color={color}>
                  {formatDayKey(section.key, section.daysLeft)}
                </Text>
                <Text variant="small" color={colors.textMuted}>
                  · {section.data.length} {section.data.length === 1 ? "item" : "items"}
                </Text>
              </View>
            );
          }}
          renderItem={({ item }) => <DeadlineCard item={item} expanded />}
          ItemSeparatorComponent={Sep}
          ListEmptyComponent={
            tab === "upcoming" ? (
              <EmptyState icon={CalendarCheck2} title="No upcoming deadlines" message="When your teachers set a submission date for practical files, lab records or anything else, it will show up here." />
            ) : (
              <EmptyState icon={History} title="No past deadlines" message="Deadlines that have passed will be listed here." />
            )
          }
        />
      )}
    </View>
  );
}

function Sep() {
  return <View style={{ height: spacing.md }} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, flexGrow: 1 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
