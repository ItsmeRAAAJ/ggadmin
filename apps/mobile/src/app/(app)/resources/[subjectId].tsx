import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight, FolderOpen, Files } from "lucide-react-native";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import type { Href } from "expo-router";
import { ErrorState, EmptyState, SkeletonList, Text } from "@/components/ui";
import { useQuery } from "@/hooks/useQuery";
import { academicsApi } from "@/lib/api";
import type { ResourceFolderSummary } from "@/lib/types";
import { colors, radius, shadow, spacing } from "@/theme";

export default function SubjectResourcesScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const router = useRouter();
  const q = useQuery(() => academicsApi.subjectResources(subjectId), { deps: [subjectId], refetchOnFocus: true });
  return (
    <View style={styles.root}>
      {q.loading && !q.data ? <View style={styles.pad}><SkeletonList count={4} height={82} /></View> : q.error && !q.data ? <ErrorState error={q.error} onRetry={q.reload} /> : (
        <FlatList<ResourceFolderSummary>
          data={q.data?.folders ?? []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item }) => <FolderCard item={item} onPress={() => router.push(`/resources/folder/${encodeURIComponent(item.id)}` as Href)} />}
          ListHeaderComponent={q.data ? <View style={styles.header}><Text variant="title">{q.data.subject.name}</Text><Text variant="small" color={colors.textSecondary}>{q.data.subject.code} · Semester {q.data.subject.semester}</Text></View> : null}
          ListEmptyComponent={<EmptyState icon={FolderOpen} title="No folders yet" message="Your teachers haven't added resources for this subject yet." />}
        />
      )}
    </View>
  );
}

function FolderCard({ item, onPress }: { item: ResourceFolderSummary; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.fileCount} files`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.icon}><FolderOpen size={20} color={colors.accentDark} /></View>
      <View style={styles.flex}><Text variant="subheading" numberOfLines={2}>{item.name}</Text><View style={styles.meta}><Files size={14} color={colors.textMuted} /><Text variant="small" color={colors.textMuted}>{item.fileCount} {item.fileCount === 1 ? "file" : "files"}</Text></View></View>
      <ChevronRight size={20} color={colors.textMuted} />
    </Pressable>
  );
}
function Separator() { return <View style={{ height: spacing.md }} />; }
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.base },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxxl, flexGrow: 1 },
  header: { gap: 2, paddingBottom: spacing.base },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.base, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  pressed: { backgroundColor: colors.surfaceMuted }, icon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSoft, borderRadius: radius.md }, flex: { flex: 1, gap: 3 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5 },
});
