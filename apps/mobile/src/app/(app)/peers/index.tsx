import { useRouter, type Href } from "expo-router";
import { Link2, Plus, Search, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Avatar, Badge, Card, EmptyState, ErrorState, IconButton, Segmented, SkeletonList, Text, TextField, useToast } from "@/components/ui";
import { FileTypeIcon, PEER_CATEGORIES, categoryLabel, scopeLabel } from "@/components/academics";
import { confirmDelete } from "@/components/EntityCard";
import { useQuery } from "@/hooks/useQuery";
import { peersApi } from "@/lib/api";
import { formatBytes, timeAgo } from "@/lib/format";
import type { PeerCategory, PeerPost } from "@/lib/types";
import { openUrl } from "@/lib/openFile";
import { colors, radius, shadow, spacing } from "@/theme";

type ScopeFilter = "all" | "CLASS" | "BRANCH" | "SEMESTER" | "mine";
type CategoryFilter = PeerCategory | "all";
const PAGE_SIZE = 20;

export default function PeersScreen() {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [items, setItems] = useState<PeerPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const queryKey = `${searchTerm}|${scope}|${category}`;
  const busy = useRef(false);
  const currentQueryKey = useRef(queryKey);
  currentQueryKey.current = queryKey;

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const q = useQuery(
    () => peersApi.feed({
      q: searchTerm || undefined,
      scope: scope !== "all" && scope !== "mine" ? scope : undefined,
      category: category === "all" ? undefined : category,
      mine: scope === "mine" ? true : undefined,
      page: 1,
      limit: PAGE_SIZE,
    }),
    { deps: [queryKey], refetchOnFocus: true }
  );

  useEffect(() => {
    setItems(q.data?.items ?? []);
    setPage(1);
    setHasMore(q.data?.hasMore ?? false);
  }, [q.data]);
  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(false);
  }, [queryKey]);

  const refreshFeed = q.refresh;
  const reload = useCallback(() => { void refreshFeed(); }, [refreshFeed]);

  const loadMore = async () => {
    if (!hasMore || loadingMore || busy.current) return;
    busy.current = true;
    setLoadingMore(true);
    const requestKey = queryKey;
    const nextPage = page + 1;
    try {
      const result = await peersApi.feed({
        q: searchTerm || undefined,
        scope: scope !== "all" && scope !== "mine" ? scope : undefined,
        category: category === "all" ? undefined : category,
        mine: scope === "mine" ? true : undefined,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      if (requestKey !== currentQueryKey.current) return;
      setItems((prev) => {
        const known = new Set(prev.map((i) => i.id));
        return [...prev, ...result.items.filter((i) => !known.has(i.id))];
      });
      setPage(nextPage);
      setHasMore(result.hasMore);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load more resources.");
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  };

  const removePost = (item: PeerPost) => confirmDelete("this resource", async () => {
    try {
      await peersApi.remove(item.id);
      setItems((prev) => prev.filter((post) => post.id !== item.id));
      toast.success("Resource deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete this resource.");
    }
  });

  const categoryOptions: { key: CategoryFilter; label: string }[] = [
    { key: "all", label: "All" },
    ...PEER_CATEGORIES.map((c) => ({ key: c.value, label: c.label })),
  ];

  return (
    <View style={styles.root}>
      <View style={styles.filters}>
        <TextField value={search} onChangeText={setSearch} placeholder="Search resources" icon={Search} returnKeyType="search" />
        <Segmented
          value={scope}
          onChange={setScope}
          segments={[
            { key: "all", label: "All" },
            { key: "CLASS", label: "Class" },
            { key: "BRANCH", label: "Branch" },
            { key: "SEMESTER", label: "Semester" },
            { key: "mine", label: "My posts" },
          ]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {categoryOptions.map((c) => {
            const active = c.key === category;
            return <Pressable key={c.key} onPress={() => setCategory(c.key)} accessibilityRole="radio" accessibilityState={{ checked: active }} style={[styles.categoryChip, active && styles.categoryActive]}><Text variant="smallMedium" color={active ? colors.white : colors.textSecondary}>{c.label}</Text></Pressable>;
          })}
        </ScrollView>
      </View>
      {q.loading && !q.data ? (
        <View style={styles.pad}><SkeletonList count={4} height={164} /></View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={q.reload} />
      ) : (
        <FlatList<PeerPost>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={reload} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.45}
          renderItem={({ item }) => <PeerCard item={item} onOpen={() => void openUrl(item.kind === "FILE" ? item.fileUrl : item.linkUrl)} onDelete={() => removePost(item)} />}
          ListFooterComponent={loadingMore ? <View style={styles.more}><Text variant="small" color={colors.textMuted}>Loading more…</Text></View> : null}
          ListEmptyComponent={<EmptyState icon={Link2} title="No shared resources yet" message="Be the first to share useful notes, papers or links with your peers." />}
        />
      )}
      <Pressable onPress={() => router.push("/peers/new" as Href)} style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]} accessibilityRole="button" accessibilityLabel="Share a resource">
        <Plus size={22} color={colors.white} strokeWidth={2.5} />
        <Text variant="smallMedium" color={colors.white}>Share</Text>
      </Pressable>
    </View>
  );
}

function PeerCard({ item, onOpen, onDelete }: { item: PeerPost; onOpen: () => void; onDelete: () => void }) {
  const uploader = item.uploader;
  const ext = item.fileType?.split("/").pop() ?? "link";
  return (
    <Card>
      <View style={styles.authorRow}>
        <Avatar uri={uploader.avatarUrl} name={uploader.name} size={40} />
        <View style={styles.author}>
          <Text variant="smallMedium" numberOfLines={1}>{uploader.name}</Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{uploader.branch} · Sem {uploader.semester} · {timeAgo(item.createdAt)}</Text>
        </View>
        <Badge label={scopeLabel(item.scope)} tone="info" />
        {item.isMine ? <IconButton icon={Trash2} label="Delete my post" onPress={onDelete} color={colors.danger} bg={colors.dangerSoft} size={34} /> : null}
      </View>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} style={({ pressed }) => [styles.postBody, pressed && { opacity: 0.78 }]}>
        <View style={styles.postTitleRow}>
          <Text variant="subheading" style={styles.postTitle}>{item.title}</Text>
        </View>
        {item.description ? <Text variant="small" color={colors.textSecondary} numberOfLines={3}>{item.description}</Text> : null}
        <View style={styles.tags}>
          <Badge label={categoryLabel(item.category)} tone="neutral" />
          {item.subject ? <Badge label={item.subject.code} tone="primary" /> : null}
        </View>
        <View style={styles.attachment}>
          <FileTypeIcon type={item.kind === "LINK" ? "link" : ext} size={40} />
          <View style={styles.flex}>
            <Text variant="smallMedium" numberOfLines={1}>{item.kind === "LINK" ? item.linkUrl : item.fileName ?? item.title}</Text>
            <Text variant="caption" color={colors.textMuted}>{item.kind === "LINK" ? "Open link" : [ext.toUpperCase(), formatBytes(item.fileSize)].filter(Boolean).join(" · ")}</Text>
          </View>
          <Link2 size={17} color={colors.primary} />
        </View>
      </Pressable>
    </Card>
  );
}

function Separator() { return <View style={{ height: spacing.md }} />; }
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  filters: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  categoryRow: { gap: spacing.sm }, categoryChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, categoryActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pad: { paddingHorizontal: spacing.lg }, list: { paddingHorizontal: spacing.lg, paddingBottom: 100, flexGrow: 1 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, author: { flex: 1, gap: 2 },
  postBody: { gap: spacing.sm, marginTop: spacing.md }, postTitleRow: { flexDirection: "row", alignItems: "center" }, postTitle: { flex: 1 }, tags: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
  attachment: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.sm }, flex: { flex: 1, gap: 2 },
  more: { alignItems: "center", paddingVertical: spacing.md },
  fab: { position: "absolute", right: spacing.lg, bottom: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, height: 52, borderRadius: radius.full, ...shadow.md }, fabPressed: { backgroundColor: colors.primaryDark, transform: [{ scale: 0.97 }] },
});
