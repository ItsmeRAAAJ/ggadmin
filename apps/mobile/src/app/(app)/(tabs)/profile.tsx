import { useFocusEffect, useRouter } from "expo-router";
import {
  Award,
  BadgeCheck,
  Camera,
  Check,
  FileBadge,
  FileText,
  FolderGit2,
  Link2,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  UserRoundPen,
} from "lucide-react-native";
import { useCallback } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Avatar, Badge, Card, Divider, ErrorState, ListRow, ProgressBar, Screen, Skeleton, Text } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/context/ProfileContext";
import { formatDateOnly, fullName, ordinal } from "@/lib/format";
import { colors, radius, spacing } from "@/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { profile, error, loading, refreshing, refresh, revalidateIfStale, reload } = useProfile();

  useFocusEffect(
    useCallback(() => {
      void revalidateIfStale();
    }, [revalidateIfStale])
  );

  const confirmLogout = () =>
    Alert.alert("Sign out?", "You'll need your password to sign in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  if (loading && !profile) {
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: spacing.md, marginTop: spacing.xl }}>
          <Skeleton width={96} height={96} rounded={48} />
          <Skeleton width={180} height={22} />
          <Skeleton width={140} height={14} />
        </View>
        <Skeleton height={80} rounded={radius.lg} />
        <Skeleton height={260} rounded={radius.lg} />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }

  const name = fullName(profile);
  const resumeCount = Number(!!profile.techResumeUrl) + Number(!!profile.nonTechResumeUrl);
  const { percent, missing } = profile.completeness;
  const todo = missing.filter((m) => !m.done);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text variant="title">Profile</Text>

      {/* Identity */}
      <View style={styles.identity}>
        <Pressable onPress={() => router.push("/profile/edit")} accessibilityRole="button" accessibilityLabel="Edit photo and details">
          <Avatar uri={profile.profileImageUrl} name={name || profile.email} size={96} />
          <View style={styles.camera}>
            <Camera size={14} color={colors.white} />
          </View>
        </Pressable>
        <Text variant="title" align="center" numberOfLines={2}>
          {name || "Add your name"}
        </Text>
        <Text variant="small" color={colors.textSecondary} align="center">
          {profile.enrollmentNumber ?? ""}
        </Text>
        <View style={styles.tags}>
          <Badge label={profile.branch.shortCode} tone="primary" />
          <Badge label={`${ordinal(profile.currentSemester)} sem`} tone="info" />
          {profile.section ? <Badge label={`Sec ${profile.section}`} tone="neutral" /> : null}
        </View>
      </View>

      {/* Completeness */}
      <Card>
        <View style={styles.rowBetween}>
          <Text variant="subheading">Profile strength</Text>
          <Text variant="subheading" color={percent === 100 ? colors.accentDark : colors.primary}>
            {percent}%
          </Text>
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <ProgressBar value={percent / 100} color={percent === 100 ? colors.accent : colors.primary} height={8} />
        </View>
        {todo.length ? (
          <View style={styles.chips}>
            {missing.map((m) => (
              <View key={m.key} style={[styles.chip, m.done && styles.chipDone]}>
                {m.done ? <Check size={12} color={colors.accentDark} strokeWidth={3} /> : null}
                <Text variant="small" color={m.done ? colors.accentDark : colors.textSecondary}>
                  {m.label}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text variant="small" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
            Everything&apos;s filled in. Keep it updated as you grow!
          </Text>
        )}
      </Card>

      {/* Details */}
      <Card padded={false}>
        <ListRow icon={Mail} title="College email" subtitle={profile.email} chevron={false} />
        <Divider inset={64} />
        <ListRow icon={Phone} title="Phone" subtitle={profile.phone ?? "Not added"} chevron={false} />
        <Divider inset={64} />
        <ListRow icon={BadgeCheck} title="Date of birth" subtitle={formatDateOnly(profile.dateOfBirth, "Not added")} chevron={false} />
      </Card>

      <Text variant="caption" color={colors.textMuted} style={styles.groupLabel}>
        YOUR PROFILE
      </Text>
      <Card padded={false}>
        <ListRow icon={UserRoundPen} title="Personal details" subtitle="Name, photo, phone, date of birth" onPress={() => router.push("/profile/edit")} />
        <Divider inset={64} />
        <ListRow
          icon={FileText}
          iconColor={colors.secondary}
          iconBg="#ECFEFF"
          title="Resumes"
          subtitle={`${resumeCount} of 2 uploaded`}
          onPress={() => router.push("/profile/resumes")}
        />
        <Divider inset={64} />
        <ListRow
          icon={FolderGit2}
          iconColor="#7C3AED"
          iconBg="#F5F3FF"
          title="Projects"
          subtitle={countLabel(profile.projects.length, "project")}
          onPress={() => router.push("/profile/projects")}
        />
        <Divider inset={64} />
        <ListRow
          icon={FileBadge}
          iconColor={colors.accentDark}
          iconBg={colors.accentSoft}
          title="Certificates"
          subtitle={countLabel(profile.certificates.length, "certificate")}
          onPress={() => router.push("/profile/certificates")}
        />
        <Divider inset={64} />
        <ListRow
          icon={Award}
          iconColor={colors.warningDark}
          iconBg={colors.warningSoft}
          title="Achievements"
          subtitle={countLabel(profile.achievements.length, "achievement")}
          onPress={() => router.push("/profile/achievements")}
        />
        <Divider inset={64} />
        <ListRow
          icon={Link2}
          iconColor="#0E7490"
          iconBg="#ECFEFF"
          title="Social links"
          subtitle={countLabel(profile.socialLinks.length, "link")}
          onPress={() => router.push("/profile/social-links")}
        />
      </Card>

      <Text variant="caption" color={colors.textMuted} style={styles.groupLabel}>
        ACCOUNT
      </Text>
      <Card padded={false}>
        <ListRow icon={ShieldCheck} title="Account & security" subtitle="Change password, sign out everywhere" onPress={() => router.push("/profile/security")} />
        <Divider inset={64} />
        <ListRow icon={LogOut} title="Sign out" destructive onPress={confirmLogout} chevron={false} />
      </Card>

      <Text variant="small" color={colors.textMuted} align="center" style={{ marginTop: spacing.sm }}>
        Branch, semester and enrollment details are managed by your department. Contact them if something looks wrong.
      </Text>
    </Screen>
  );
}

function countLabel(n: number, noun: string) {
  return n === 0 ? `No ${noun}s yet` : `${n} ${noun}${n === 1 ? "" : "s"}`;
}

const styles = StyleSheet.create({
  identity: { alignItems: "center", gap: spacing.xs + 2 },
  camera: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  tags: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  chipDone: { backgroundColor: colors.accentSoft },
  groupLabel: { marginTop: spacing.sm, marginBottom: -spacing.sm, marginLeft: spacing.xs },
});
