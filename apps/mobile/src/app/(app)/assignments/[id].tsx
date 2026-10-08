import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { AlertTriangle, CalendarClock, CircleCheckBig, ExternalLink, FileCheck2, Lock, UploadCloud, UserRound } from "lucide-react-native";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { FileSourceSheet } from "@/components/FileSourceSheet";
import { SubjectTag } from "@/components/ItemCards";
import { Badge, Button, Card, ErrorState, ProgressBar, Screen, Skeleton, Text, useToast } from "@/components/ui";
import { useNow } from "@/hooks/useNow";
import { useQuery } from "@/hooks/useQuery";
import { assignmentApi, errorMessage } from "@/lib/api";
import { formatDateTime, relativeTo } from "@/lib/format";
import { assignmentDetailView } from "@/lib/status";
import type { LocalFile } from "@/lib/types";
import { uploadFile } from "@/lib/upload";
import { colors, radius, spacing } from "@/theme";

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const q = useQuery(() => assignmentApi.detail(id), { deps: [id] });
  const now = useNow(30_000, !!q.data);
  const [sheet, setSheet] = useState(false);
  const [upload, setUpload] = useState<{ name: string; progress: number } | null>(null);

  const a = q.data;

  const submit = async (file: LocalFile) => {
    setUpload({ name: file.name, progress: 0 });
    try {
      const fileUrl = await uploadFile(file, (req) => assignmentApi.presign(id, req), (p) =>
        setUpload((u) => (u ? { ...u, progress: p } : u))
      );
      const res = await assignmentApi.submit(id, fileUrl);
      toast.success(res.status === "LATE" ? "Submitted (late)" : "Assignment submitted");
      await q.refresh();
    } catch (e) {
      Alert.alert("Submission failed", errorMessage(e));
      void q.refresh();
    } finally {
      setUpload(null);
    }
  };

  const openSubmission = async () => {
    if (!a?.submission?.fileUrl) return;
    try {
      await WebBrowser.openBrowserAsync(a.submission.fileUrl, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
    } catch {
      Alert.alert("Couldn't open file", "Please try again.");
    }
  };

  const confirmReplace = () => {
    Alert.alert("Replace submission?", "Your previous file will be replaced with the new one.", [
      { text: "Cancel", style: "cancel" },
      { text: "Choose file", onPress: () => setSheet(true) },
    ]);
  };

  if (q.loading) {
    return (
      <Screen edges={[]}>
        <Skeleton height={160} rounded={radius.lg} />
        <Skeleton height={110} rounded={radius.lg} />
        <Skeleton height={140} rounded={radius.lg} />
      </Screen>
    );
  }
  if (!a) {
    return (
      <Screen edges={[]}>
        <ErrorState error={q.error} onRetry={q.reload} />
      </Screen>
    );
  }

  const view = assignmentDetailView(a);
  const due = new Date(a.dueAt).getTime();
  const pastDue = now > due;
  const submitted = !!a.submission && a.submission.status !== "NOT_SUBMITTED";
  const reviewed = submitted && view.label === "Reviewed";
  const uploading = !!upload;

  const footer = a.canSubmit ? (
    uploading ? (
      <View style={styles.uploadBox}>
        <View style={styles.uploadRow}>
          <Text variant="smallMedium" numberOfLines={1} style={{ flex: 1 }}>
            Uploading {upload.name}
          </Text>
          <Text variant="smallMedium" color={colors.primary}>
            {Math.round(upload.progress * 100)}%
          </Text>
        </View>
        <ProgressBar value={upload.progress} />
      </View>
    ) : (
      <Button
        title={submitted ? "Replace submission" : pastDue ? "Submit late" : "Submit assignment"}
        icon={UploadCloud}
        variant={submitted ? "outline" : "primary"}
        size="lg"
        onPress={submitted ? confirmReplace : () => setSheet(true)}
      />
    )
  ) : null;

  return (
    <Screen edges={[]} refreshing={q.refreshing} onRefresh={uploading ? undefined : q.refresh} footer={footer}>
      <Card>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <SubjectTag code={a.subject.code} name={a.subject.name} />
          </View>
          <Badge label={view.label} tone={view.tone} dot />
        </View>
        <Text variant="title" style={{ marginTop: spacing.md }}>
          {a.title}
        </Text>
        <View style={styles.metaList}>
          <Meta icon={UserRound} label="Teacher" value={a.teacherName} />
          <Meta
            icon={CalendarClock}
            label="Due"
            value={`${formatDateTime(a.dueAt)} · ${relativeTo(a.dueAt, now)}`}
            danger={pastDue && !submitted}
          />
        </View>
      </Card>

      {a.description ? (
        <Card>
          <Text variant="caption" color={colors.textMuted}>
            DESCRIPTION
          </Text>
          <Text style={{ marginTop: spacing.sm }} selectable>
            {a.description}
          </Text>
        </Card>
      ) : null}

      {/* Submission state */}
      {submitted && a.submission ? (
        <Card>
          <View style={styles.subHead}>
            <View style={[styles.iconCircle, { backgroundColor: reviewed ? colors.successSoft : colors.primaryTint }]}>
              {reviewed ? <CircleCheckBig size={20} color={colors.accentDark} /> : <FileCheck2 size={20} color={colors.primary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="subheading">{reviewed ? "Reviewed by your teacher" : "Your submission"}</Text>
              <Text variant="small" color={colors.textSecondary}>
                {a.submission.status === "LATE" ? "Submitted late · " : "Submitted · "}
                {formatDateTime(a.submission.submittedAt)}
              </Text>
            </View>
          </View>
          {a.submission.fileUrl ? (
            <Button title="View submitted file" icon={ExternalLink} variant="secondary" onPress={openSubmission} style={{ marginTop: spacing.base }} />
          ) : null}
          {a.canSubmit ? (
            <Text variant="small" color={colors.textMuted} style={{ marginTop: spacing.md }}>
              You can replace your file until your teacher reviews it.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {!submitted && a.canSubmit && pastDue ? (
        <Notice tone="warning" icon={AlertTriangle} title="The due date has passed" message="You can still submit, but it will be marked as late." />
      ) : null}
      {!submitted && a.canSubmit && !pastDue ? (
        <Notice tone="info" icon={UploadCloud} title="How to submit" message="Upload a single PDF or a clear photo of your work (max 5 MB)." />
      ) : null}
      {!a.canSubmit && !submitted ? (
        <Notice
          tone="neutral"
          icon={Lock}
          title={a.status === "CLOSED" ? "Assignment closed" : "Submissions closed"}
          message="This assignment is no longer accepting submissions."
        />
      ) : null}
      {reviewed ? (
        <Notice tone="neutral" icon={Lock} title="Submission locked" message="Your teacher has reviewed this submission, so it can no longer be changed." />
      ) : null}

      <FileSourceSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        onPicked={submit}
        title={submitted ? "Replace submission" : "Submit assignment"}
      />
    </Screen>
  );
}

function Meta({ icon: Icon, label, value, danger }: { icon: typeof UserRound; label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.meta}>
      <Icon size={16} color={danger ? colors.danger : colors.textMuted} />
      <Text variant="small" color={colors.textMuted} style={{ width: 60 }}>
        {label}
      </Text>
      <Text variant="smallMedium" color={danger ? colors.dangerDark : colors.text} style={{ flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}

const noticeTones = {
  warning: { bg: colors.warningSoft, fg: colors.warningDark },
  info: { bg: colors.primaryTint, fg: colors.primaryDark },
  neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary },
} as const;

function Notice({ tone, icon: Icon, title, message }: { tone: keyof typeof noticeTones; icon: typeof Lock; title: string; message: string }) {
  const t = noticeTones[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }]}>
      <Icon size={20} color={t.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading" color={t.fg}>
          {title}
        </Text>
        <Text variant="small" color={colors.textSecondary}>
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  metaList: { marginTop: spacing.base, gap: spacing.sm },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  subHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  notice: { flexDirection: "row", gap: spacing.md, padding: spacing.base, borderRadius: radius.lg },
  uploadBox: { gap: spacing.sm, paddingVertical: spacing.xs },
  uploadRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
