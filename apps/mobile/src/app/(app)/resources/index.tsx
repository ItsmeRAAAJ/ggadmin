import { useRouter, type Href } from "expo-router";
import { BookOpen, ChevronRight, Files } from "lucide-react-native";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { EmptyState, ErrorState, SkeletonList, Text } from "@/components/ui";
import { useQuery } from "@/hooks/useQuery";
import { academicsApi } from "@/lib/api";
import type { AcademicSubject } from "@/lib/types";
import { colors, radius, shadow, spacing } from "@/theme";

export default function ResourcesScreen() {
  const router = useRouter();
  const q = useQuery(academicsApi.subjects, { refetchOnFocus: true });
  return (
    <View style={styles.root}>
      {q.loading && !q.data ? (
        <View style={styles.pad}><SkeletonList count={5} height={84} /></View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.reload} />
      ) : (
        <FlatList<AcademicSubject>
          data={q.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item }) => (
            <SubjectCard
              item={item}
              onPress={() => router.push(`/resources/${encodeURIComponent(item.id)}` as Href)}
            />
          )}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text variant="small" color={colors.textSecondary}>Choose a subject to browse study material shared by your teachers.</Text>
            </View>
          }
          ListEmptyComponent={<EmptyState icon={BookOpen} title="No resources yet" message="Subject resources shared by your teachers will appear here." />}
        />
      )}
    </View>
  );
}

function SubjectCard({ item, onPress }: { item: AcademicSubject; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${item.name} resources`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.subjectIcon}>
        <BookOpen size={20} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text variant="subheading" numberOfLines={2}>{item.name}</Text>
        <Text variant="small" color={colors.textSecondary}>{item.code} · Semester {item.semester}</Text>
        <View style={styles.meta}>
          <Files size={14} color={colors.textMuted} />
          <Text variant="small" color={colors.textMuted}>
            {item.folderCount} {item.folderCount === 1 ? "folder" : "folders"} · {item.fileCount} {item.fileCount === 1 ? "file" : "files"}
          </Text>
        </View>
      </View>
      <ChevronRight size={20} color={colors.textMuted} />
    </Pressable>
  );
}

function Separator() { return <View style={{ height: spacing.md }} />; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.base },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, paddingTop: spacing.sm, flexGrow: 1 },
  header: { paddingBottom: spacing.base },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.base, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  pressed: { backgroundColor: colors.surfaceMuted },
  subjectIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryTint, borderRadius: radius.md },
  flex: { flex: 1, gap: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
});
