import { useRouter } from "expo-router";
import { CircleCheckBig, FileText, Inbox } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { AssignmentCard } from "@/components/ItemCards";
import { EmptyState, ErrorState, Segmented, SkeletonList } from "@/components/ui";
import { useQuery } from "@/hooks/useQuery";
import { assignmentApi } from "@/lib/api";
import { assignmentView } from "@/lib/status";
import type { AssignmentListItem } from "@/lib/types";
import { colors, spacing } from "@/theme";

type Tab = "pending" | "submitted" | "all";

const EMPTY: Record<Tab, { title: string; message: string; icon: typeof FileText }> = {
  pending: { title: "No pending assignments", message: "You're all caught up. New assignments from your teachers will appear here.", icon: CircleCheckBig },
  submitted: { title: "Nothing submitted yet", message: "Assignments you submit will be listed here.", icon: FileText },
  all: { title: "No assignments yet", message: "Your teachers haven't posted any assignments for your class.", icon: Inbox },
};

export default function AssignmentsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pending");
  const q = useQuery(assignmentApi.list, { refetchOnFocus: true });

  const groups = useMemo(() => {
    const all = q.data ?? [];
    const due = (a: AssignmentListItem) => new Date(a.dueAt).getTime();
    return {
      pending: all.filter((a) => assignmentView(a).pending).sort((a, b) => due(a) - due(b)),
      submitted: all
        .filter((a) => a.submissionStatus !== "NOT_SUBMITTED")
        .sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime()),
      all,
    };
  }, [q.data]);

  const items = groups[tab];
  const empty = EMPTY[tab];

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Segmented
          value={tab}
          onChange={setTab}
          segments={[
            { key: "pending", label: "Pending", count: q.data ? groups.pending.length : undefined },
            { key: "submitted", label: "Submitted" },
            { key: "all", label: "All" },
          ]}
        />
      </View>
      {q.loading ? (
        <View style={styles.pad}>
          <SkeletonList count={5} height={110} />
        </View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.reload} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Sep}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item }) => <AssignmentCard item={item} onPress={() => router.push(`/assignments/${item.id}`)} />}
          ListEmptyComponent={<EmptyState icon={empty.icon} title={empty.title} message={empty.message} />}
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
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  pad: { paddingHorizontal: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, paddingTop: spacing.xs, flexGrow: 1 },
});
