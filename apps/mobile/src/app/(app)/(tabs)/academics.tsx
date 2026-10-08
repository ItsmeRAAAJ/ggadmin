import { useRouter, type Href } from "expo-router";
import { CalendarClock, ChevronRight, FileText, FolderOpen, Share2, type LucideIcon } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Screen, Text } from "@/components/ui";
import { useProfile } from "@/context/ProfileContext";
import { useQuery } from "@/hooks/useQuery";
import { academicsApi, assignmentApi } from "@/lib/api";
import { ordinal } from "@/lib/format";
import { assignmentView } from "@/lib/status";
import { colors, radius, shadow, spacing } from "@/theme";

type Module = {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  route: string;
  fg: string;
  bg: string;
  badge?: string | null;
};

export default function AcademicsScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const counts = useQuery(
    async () => {
      const [assignments, deadlines] = await Promise.all([assignmentApi.list(), academicsApi.deadlines("upcoming")]);
      return {
        pending: assignments.filter((a) => assignmentView(a).pending).length,
        deadlines: deadlines.items.length,
        dueSoon: deadlines.items.filter((d) => d.daysLeft <= 2).length,
      };
    },
    { refetchOnFocus: true }
  );

  const modules = useMemo<Module[]>(() => {
    const c = counts.data;
    return [
      {
        key: "assignments",
        title: "Assignments",
        subtitle: "View and submit your class assignments",
        icon: FileText,
        route: "/assignments",
        fg: "#B45309",
        bg: "#FEF3C7",
        badge: c && c.pending > 0 ? `${c.pending} pending` : null,
      },
      {
        key: "deadlines",
        title: "Deadlines",
        subtitle: "Practical files, lab records & other submissions",
        icon: CalendarClock,
        route: "/deadlines",
        fg: colors.primaryDark,
        bg: colors.primaryTint,
        badge: c && c.dueSoon > 0 ? `${c.dueSoon} due soon` : c && c.deadlines > 0 ? `${c.deadlines} upcoming` : null,
      },
      {
        key: "resources",
        title: "Resources",
        subtitle: "Notes and study material from your teachers",
        icon: FolderOpen,
        route: "/resources",
        fg: colors.accentDark,
        bg: colors.accentSoft,
      },
      {
        key: "peers",
        title: "Share with Peers",
        subtitle: "Papers, lab manuals & links shared by students",
        icon: Share2,
        route: "/peers",
        fg: "#7C3AED",
        bg: "#F5F3FF",
      },
    ];
  }, [counts.data]);

  return (
    <Screen refreshing={counts.refreshing} onRefresh={counts.refresh}>
      <View style={styles.head}>
        <Text variant="title">Academics</Text>
        {profile ? (
          <Text variant="small" color={colors.textSecondary}>
            {profile.branch.shortCode} · {ordinal(profile.currentSemester)} semester{profile.section ? ` · Section ${profile.section}` : ""}
          </Text>
        ) : null}
      </View>
      <View style={styles.grid}>
        {modules.map((m) => (
          <ModuleCard key={m.key} m={m} onPress={() => router.push(m.route as Href)} />
        ))}
      </View>
    </Screen>
  );
}

function ModuleCard({ m, onPress }: { m: Module; onPress: () => void }) {
  const Icon = m.icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${m.title}. ${m.subtitle}${m.badge ? `. ${m.badge}` : ""}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: m.bg }]}>
        <Icon size={24} color={m.fg} />
      </View>
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <Text variant="heading" numberOfLines={1} style={styles.shrink}>
            {m.title}
          </Text>
          {m.badge ? (
            <View style={[styles.badge, { backgroundColor: m.bg }]}>
              <Text variant="caption" color={m.fg} numberOfLines={1}>
                {m.badge.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="small" color={colors.textSecondary} numberOfLines={2} style={styles.sub}>
          {m.subtitle}
        </Text>
      </View>
      <ChevronRight size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  head: { gap: 2, marginTop: spacing.xs },
  grid: { gap: spacing.md },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.base,
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 92,
    ...shadow.sm,
  },
  pressed: { backgroundColor: colors.surfaceMuted, transform: [{ scale: 0.99 }] },
  icon: { width: 52, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  sub: { marginTop: 2 },
});
