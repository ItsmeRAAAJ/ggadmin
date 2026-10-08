import * as WebBrowser from "expo-web-browser";
import { Briefcase, ExternalLink, FileText, RefreshCw, Sparkles, Trash2, UploadCloud } from "lucide-react-native";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Badge, Button, Card, ErrorState, ProgressBar, Screen, Skeleton, Text, useToast } from "@/components/ui";
import { useProfile } from "@/context/ProfileContext";
import { errorMessage, profileApi, type ResumeKind } from "@/lib/api";
import { pickDocument } from "@/lib/pickers";
import { uploadFile } from "@/lib/upload";
import { colors, radius, spacing } from "@/theme";

const KINDS: { kind: ResumeKind; title: string; description: string; icon: typeof Briefcase; field: "techResumeUrl" | "nonTechResumeUrl" }[] = [
  {
    kind: "tech",
    title: "Technical resume",
    description: "For software, engineering and core technical roles.",
    icon: Briefcase,
    field: "techResumeUrl",
  },
  {
    kind: "non-tech",
    title: "Non-technical resume",
    description: "For management, sales, operations and other non-technical roles.",
    icon: Sparkles,
    field: "nonTechResumeUrl",
  },
];

export default function ResumesScreen() {
  const { profile, error, reload, refresh, refreshing, revalidate } = useProfile();
  const toast = useToast();
  const [busy, setBusy] = useState<{ kind: ResumeKind; progress: number | null } | null>(null);

  if (!profile) {
    return (
      <Screen edges={[]}>
        {error ? <ErrorState error={error} onRetry={reload} /> : [0, 1].map((i) => <Skeleton key={i} height={170} rounded={radius.lg} />)}
      </Screen>
    );
  }

  const upload = async (kind: ResumeKind) => {
    const file = await pickDocument("pdf");
    if (!file) return;
    setBusy({ kind, progress: 0 });
    try {
      const url = await uploadFile(file, (req) => profileApi.presignResume(kind, req), (p) => setBusy({ kind, progress: p }));
      await profileApi.confirmResume(kind, url);
      await revalidate();
      toast.success("Resume uploaded");
    } catch (e) {
      Alert.alert("Upload failed", errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = (kind: ResumeKind, title: string) => {
    Alert.alert(`Delete ${title.toLowerCase()}?`, "You can upload a new one anytime.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy({ kind, progress: null });
          try {
            await profileApi.deleteResume(kind);
            await revalidate();
            toast.success("Resume deleted");
          } catch (e) {
            Alert.alert("Couldn't delete", errorMessage(e));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const view = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
    } catch {
      Alert.alert("Couldn't open file", "Please try again.");
    }
  };

  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={busy ? undefined : refresh}>
      <Text color={colors.textSecondary}>
        Keep both resumes up to date — placement teams use them when shortlisting for different kinds of roles. PDF only, up to 5 MB.
      </Text>
      {KINDS.map(({ kind, title, description, icon: Icon, field }) => {
        const url = profile[field];
        const mine = busy?.kind === kind;
        return (
          <Card key={kind}>
            <View style={styles.head}>
              <View style={[styles.icon, { backgroundColor: url ? colors.accentSoft : colors.primaryTint }]}>
                <Icon size={20} color={url ? colors.accentDark : colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text variant="subheading">{title}</Text>
                <Text variant="small" color={colors.textSecondary}>
                  {description}
                </Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <FileText size={16} color={url ? colors.accentDark : colors.textMuted} />
              <Text variant="smallMedium" color={url ? colors.text : colors.textMuted} style={styles.flex}>
                {url ? "Resume uploaded (PDF)" : "Not uploaded yet"}
              </Text>
              <Badge label={url ? "Added" : "Missing"} tone={url ? "success" : "warning"} />
            </View>
            {mine && busy.progress !== null ? (
              <View style={styles.progress}>
                <Text variant="small" color={colors.textSecondary}>
                  Uploading… {Math.round(busy.progress * 100)}%
                </Text>
                <ProgressBar value={busy.progress} />
              </View>
            ) : url ? (
              <View style={styles.actions}>
                <Button title="View" icon={ExternalLink} variant="secondary" size="sm" style={styles.flex} onPress={() => view(url)} disabled={!!busy} />
                <Button title="Replace" icon={RefreshCw} variant="outline" size="sm" style={styles.flex} onPress={() => upload(kind)} disabled={!!busy} />
                <Button
                  title=""
                  accessibilityLabel={`Delete ${title}`}
                  icon={Trash2}
                  variant="danger"
                  size="sm"
                  fullWidth={false}
                  style={styles.iconBtn}
                  onPress={() => remove(kind, title)}
                  loading={mine && busy.progress === null}
                  disabled={!!busy}
                />
              </View>
            ) : (
              <Button title="Upload PDF" icon={UploadCloud} size="sm" style={{ marginTop: spacing.md }} onPress={() => upload(kind)} disabled={!!busy} />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.base,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  progress: { gap: spacing.sm, marginTop: spacing.md },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  iconBtn: { width: 44, paddingHorizontal: 0 },
});
