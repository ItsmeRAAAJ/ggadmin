import { useFocusEffect, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { ArrowRight, CalendarClock, CircleCheckBig, CircleHelp, FileText, Sparkles } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AssignmentCard } from "@/components/ItemCards";
import { DeadlineCard } from "@/components/DeadlineCard";
import { Avatar, Card, EmptyState, ErrorState, ProgressRing, Screen, SectionHeader, Skeleton, SkeletonList, Text } from "@/components/ui";
import { useProfile } from "@/context/ProfileContext";
import { useQuery } from "@/hooks/useQuery";
import { academicsApi, assignmentApi } from "@/lib/api";
import { fullName, greeting, ordinal } from "@/lib/format";
import { assignmentView } from "@/lib/status";
import { colors, radius, shadow, spacing } from "@/theme";

const COMPLETENESS_ROUTES: Record<string, string> = {
  name: "/profile/edit",
  phone: "/profile/edit",
  dob: "/profile/edit",
  photo: "/profile/edit",
  resume: "/profile/resumes",
  projects: "/profile/projects",
  certificates: "/profile/certificates",
  achievements: "/profile/achievements",
  socialLinks: "/profile/social-links",
};

export default function HomeScreen() {
  const router = useRouter();
  const { profile, error: profileError, loading: profileLoading, revalidate, revalidateIfStale, reload: reloadProfile } = useProfile();
  const feed = useQuery(
    async () => {
      const [deadlines, assignments] = await Promise.all([academicsApi.deadlines("upcoming"), assignmentApi.list()]);
      return { deadlines: deadlines.items, assignments };
    },
    { refetchOnFocus: true }
  );

  useFocusEffect(
    useCallback(() => {
      void revalidateIfStale();
    }, [revalidateIfStale])
  );

  const upNext = useMemo(() => {
    if (!feed.data) return null;
    const deadlines = feed.data.deadlines;
    const pending = feed.data.assignments
      .filter((a) => assignmentView(a).pending)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    return { deadlines, pending };
  }, [feed.data]);

  const name = profile ? fullName(profile) : "";
  const firstName = profile?.firstName ?? "";
  const refreshing = feed.refreshing;
  const onRefresh = () => {
    void feed.refresh();
    void revalidate();
  };

  const nextMissing = profile?.completeness.missing.find((m) => !m.done);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="small" color={colors.textSecondary}>
            {greeting()}
            {firstName ? "," : ""}
          </Text>
          {profileLoading && !profile ? (
            <Skeleton width={160} height={26} style={{ marginTop: 4 }} />
          ) : (
            <Text variant="title" numberOfLines={1}>
              {firstName || "Student"} :) 
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/about" as Href)}
            style={({ pressed }) => [styles.helpButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="About My GGITS App"
            accessibilityHint="Opens information about the app"
          >
            <CircleHelp size={23} color={colors.primary} />
          </Pressable>
          <Pressable onPress={() => router.navigate("/profile")} accessibilityRole="button" accessibilityLabel="Open profile">
            <Avatar uri={profile?.profileImageUrl} name={name || "S"} size={46} />
          </Pressable>
        </View>
      </View>

      {profileError && !profile ? <ErrorState error={profileError} onRetry={reloadProfile} compact /> : null}

      {/* Identity + completeness hero */}
      {profile ? (
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.flex}>
              <Text variant="caption" color="rgba(255,255,255,0.75)">
                {profile.branch.shortCode} · {ordinal(profile.currentSemester)} SEMESTER{profile.section ? ` · SEC ${profile.section}` : ""}
              </Text>
              <Text variant="heading" color={colors.white} numberOfLines={1} style={{ marginTop: 4 }}>
                {profile.enrollmentNumber ?? profile.email}
              </Text>
              <Text variant="small" color="rgba(255,255,255,0.8)" numberOfLines={1}>
                {profile.branch.name} · Batch {profile.admissionYear}–{profile.passoutYear ?? profile.admissionYear + 4}
              </Text>
            </View>
            <ProgressRing percent={profile.completeness.percent} size={66} stroke={6} color={colors.accent} track="rgba(255,255,255,0.22)" labelColor={colors.white} />
          </View>
          {nextMissing ? (
            <Pressable
              onPress={() => router.push((COMPLETENESS_ROUTES[nextMissing.key] ?? "/profile") as never)}
              style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Sparkles size={16} color={colors.primaryDark} />
              <Text variant="smallMedium" color={colors.primaryDark} style={styles.flex} numberOfLines={1}>
                Complete your profile: {nextMissing.label.toLowerCase()}
              </Text>
              <ArrowRight size={16} color={colors.primaryDark} />
            </Pressable>
          ) : (
            <View style={styles.heroCta}>
              <CircleCheckBig size={16} color={colors.accentDark} />
              <Text variant="smallMedium" color={colors.accentDark}>
                Your profile is complete. Great work!
              </Text>
            </View>
          )}
        </View>
      ) : profileLoading ? (
        <Skeleton height={150} rounded={radius.xl} />
      ) : null}

      {/* Quick stats */}
      {upNext ? (
        <View style={styles.stats}>
          <StatTile
            icon={FileText}
            value={upNext.pending.length}
            label={upNext.pending.length === 1 ? "Pending assignment" : "Pending assignments"}
            tint={colors.warningDark}
            bg={colors.warningSoft}
            onPress={() => router.push("/assignments")}
          />
          <StatTile
            icon={CalendarClock}
            value={upNext.deadlines.length}
            label={upNext.deadlines.length === 1 ? "Upcoming deadline" : "Upcoming deadlines"}
            tint={colors.primary}
            bg={colors.primaryTint}
            onPress={() => router.push("/deadlines" as Href)}
          />
        </View>
      ) : null}

      {/* Up next */}
      <SectionHeader title="Up next" />
      {feed.loading ? (
        <SkeletonList count={3} />
      ) : feed.error && !feed.data ? (
        <ErrorState error={feed.error} onRetry={feed.reload} compact />
      ) : upNext && upNext.pending.length + upNext.deadlines.length === 0 ? (
        <Card>
          <EmptyState icon={CircleCheckBig} title="You're all caught up" message="New assignments and deadlines from your teachers will show up here." compact />
        </Card>
      ) : upNext ? (
        <View style={styles.list}>
          {upNext.deadlines.slice(0, 3).map((d) => (
            <DeadlineCard key={`dl-${d.id}`} item={d} onPress={() => router.push("/deadlines" as Href)} />
          ))}
          {upNext.pending.slice(0, 5).map((a) => (
            <AssignmentCard key={`ag-${a.id}`} item={a} onPress={() => router.push(`/assignments/${a.id}`)} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
  tint,
  bg,
  onPress,
}: {
  icon: typeof FileText;
  value: number;
  label: string;
  tint: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} style={styles.stat} accessibilityLabel={`${value} ${label}`}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Icon size={18} color={tint} />
      </View>
      <Text variant="title">{value}</Text>
      <Text variant="small" color={colors.textSecondary} numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  helpButton: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.75 },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.base,
    overflow: "hidden",
    ...shadow.md,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.base },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
  },
  stats: { flexDirection: "row", gap: spacing.md },
  stat: { flex: 1, gap: 2 },
  statIcon: { width: 34, height: 34, borderRadius: radius.sm + 2, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  list: { gap: spacing.md },
});
