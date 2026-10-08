import Constants from "expo-constants";
import { BookOpen, CalendarClock, FileText, FolderOpen, GraduationCap, LockKeyhole, Share2, UserRound } from "lucide-react-native";
import { Image, StyleSheet, View } from "react-native";
import { Card, Screen, Text } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";

const FEATURES = [
  {
    icon: GraduationCap,
    title: "Your student dashboard",
    description:
      "See your branch, semester, section and enrollment details at a glance. The home screen brings your upcoming academic work together so you can quickly see what needs your attention.",
    color: colors.primary,
    background: colors.primaryTint,
  },
  {
    icon: FileText,
    title: "Assignments and submissions",
    description:
      "Review assignments shared by your teachers, check due dates and submission status, and upload your work from the app.",
    color: colors.warningDark,
    background: colors.warningSoft,
  },
  {
    icon: CalendarClock,
    title: "Academic deadlines",
    description:
      "Keep track of upcoming practical files, lab records and other submission deadlines set for your class.",
    color: colors.primaryDark,
    background: colors.primarySoft,
  },
  {
    icon: FolderOpen,
    title: "Learning resources",
    description:
      "Find subject-wise notes and study material shared by your teachers, organized into subjects and folders.",
    color: colors.accentDark,
    background: colors.accentSoft,
  },
  {
    icon: Share2,
    title: "Share with peers",
    description:
      "Discover useful papers, lab manuals, links and other study resources shared by fellow students, or contribute resources to help your peers.",
    color: "#7C3AED",
    background: "#F5F3FF",
  },
  {
    icon: UserRound,
    title: "Your profile and portfolio",
    description:
      "Keep your personal details up to date and build a record of your resumes, projects, certificates, achievements and social links.",
    color: "#0E7490",
    background: "#ECFEFF",
  },
];

export default function AboutScreen() {
  return (
    <Screen>
      <View style={styles.intro}>
        <Text variant="heading">College life, in one place</Text>
        <Text variant="small" color={colors.textSecondary} style={styles.paragraph}>
          My GGITS brings together the academic information and tools you use as a student. Check what is coming up,
          access learning material, stay on top of submissions and maintain a portfolio of your work all from your phone.
        </Text>
      </View>

      <Text variant="subheading">What you can do</Text>
      <View style={styles.features}>
        {FEATURES.map(({ icon: Icon, title, description, color, background }) => (
          <Card key={title} style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: background }]}>
              <Icon size={21} color={color} />
            </View>
            <View style={styles.featureCopy}>
              <Text variant="subheading">{title}</Text>
              <Text variant="small" color={colors.textSecondary} style={styles.featureDescription}>
                {description}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      <Card style={styles.noteCard}>
        <View style={styles.noteHeading}>
          <LockKeyhole size={19} color={colors.primary} />
          <Text variant="subheading">Your account and student details</Text>
        </View>
        <Text variant="small" color={colors.textSecondary}>
          Use your student account to access the app. You can change your password and manage sign-in sessions under
          Profile → Account &amp; security. Your enrollment, branch and semester details are managed by your department;
          contact them if something looks incorrect.
        </Text>
      </Card>

      <View style={styles.credit}>
        <Image
          source={require("../../../assets/shubh.png")}
          style={styles.creatorImage}
          resizeMode="contain"
          accessibilityLabel="Shubhashish Chakraborty"
        />
        <Text variant="small" color={colors.textMuted}>
          Developed by
        </Text>
        <Text variant="subheading" align="center">
          Shubhashish Chakraborty
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          shubhashish.me
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
  },
  brandMark: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  version: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  intro: { gap: spacing.sm },
  paragraph: { lineHeight: 21 },
  features: { gap: spacing.md },
  featureCard: { flexDirection: "row", gap: spacing.md },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  featureCopy: { flex: 1, gap: spacing.xs },
  featureDescription: { lineHeight: 20 },
  noteCard: { gap: spacing.md },
  noteHeading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  credit: { alignItems: "center", gap: spacing.xs, marginTop: spacing.md, marginBottom: spacing.xl },
  creatorImage: { width: 140, height: 166, marginBottom: spacing.xs },
});
