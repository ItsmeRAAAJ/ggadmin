import { useLocalSearchParams } from "expo-router";
import { Download, UserRound } from "lucide-react-native";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { FileTypeIcon } from "@/components/academics";
import { EmptyState, ErrorState, SkeletonList, Text } from "@/components/ui";
import { useQuery } from "@/hooks/useQuery";
import { academicsApi } from "@/lib/api";
import { formatBytes, formatDateTime } from "@/lib/format";
import { openUrl } from "@/lib/openFile";
import type { ResourceFileItem } from "@/lib/types";
import { colors, radius, shadow, spacing } from "@/theme";

export default function ResourceFolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery(() => academicsApi.folder(id), { deps: [id], refetchOnFocus: true });
  return (
    <View style={styles.root}>
      {q.loading && !q.data ? <View style={styles.pad}><SkeletonList count={4} height={86} /></View> : q.error && !q.data ? <ErrorState error={q.error} onRetry={q.reload} /> : (
        <FlatList<ResourceFileItem>
          data={q.data?.files ?? []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item }) => <FileCard item={item} onPress={() => void openUrl(item.fileUrl)} />}
          ListHeaderComponent={q.data ? <View style={styles.header}><Text variant="title">{q.data.name}</Text><Text variant="small" color={colors.textSecondary}>{q.data.subject.code} · {q.data.subject.name}</Text></View> : null}
          ListEmptyComponent={<EmptyState icon={Download} title="No files in this folder" message="Files shared by your teacher will appear here." />}
        />
      )}
    </View>
  );
}

function FileCard({ item, onPress }: { item: ResourceFileItem; onPress: () => void }) {
  const ext = item.fileType?.split("/").pop()?.replace("vnd.openxmlformats-officedocument.", "") ?? "file";
  return (
    <Pressable onPress={onPress} disabled={!item.fileUrl} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <FileTypeIcon type={ext} size={44} />
      <View style={styles.flex}>
        <Text variant="subheading" numberOfLines={2}>{item.title}</Text>
        {item.fileName ? <Text variant="small" color={colors.textSecondary} numberOfLines={1}>{item.fileName}</Text> : null}
        <View style={styles.meta}><UserRound size={13} color={colors.textMuted} /><Text variant="small" color={colors.textMuted} numberOfLines={1}>{item.teacherName}</Text>{formatBytes(item.fileSize) ? <Text variant="small" color={colors.textMuted}>· {formatBytes(item.fileSize)}</Text> : null}</View>
        <Text variant="caption" color={colors.textMuted}>{formatDateTime(item.createdAt)}</Text>
      </View>
      <Download size={18} color={colors.primary} />
    </Pressable>
  );
}
function Separator() { return <View style={{ height: spacing.md }} />; }
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.base },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxxl, flexGrow: 1 }, header: { gap: 2, paddingBottom: spacing.base },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.base, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  pressed: { backgroundColor: colors.surfaceMuted }, flex: { flex: 1, gap: 3 }, meta: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
});
