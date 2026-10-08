import { useRouter, type Href } from "expo-router";
import { Link2, Paperclip } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChipSelect, FileField } from "@/components/FormBits";
import { FileSourceSheet } from "@/components/FileSourceSheet";
import { PEER_CATEGORIES, PEER_SCOPES } from "@/components/academics";
import { Button, Screen, Text, TextField, useToast } from "@/components/ui";
import { useProfile } from "@/context/ProfileContext";
import { useQuery } from "@/hooks/useQuery";
import { academicsApi, ApiError, errorMessage, peersApi } from "@/lib/api";
import { MAX_STUDY_UPLOAD_BYTES } from "@/lib/config";
import { formatBytes } from "@/lib/format";
import { uploadFile } from "@/lib/upload";
import type { LocalFile, PeerCategory, PeerScope } from "@/lib/types";
import { colors, radius, spacing } from "@/theme";

type ShareKind = "FILE" | "LINK";

export default function NewPeerResourceScreen() {
  const router = useRouter();
  const toast = useToast();
  const { profile } = useProfile();
  const subjects = useQuery(academicsApi.subjects);
  const [kind, setKind] = useState<ShareKind>("FILE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<PeerCategory>("OTHER");
  const [scope, setScope] = useState<PeerScope>("BRANCH");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<LocalFile | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const scopeOptions = useMemo(() => PEER_SCOPES.filter((s) => s.value !== "CLASS" || !!profile?.section).map((s) => ({ value: s.value, label: s.label })), [profile?.section]);
  const subjectOptions = useMemo(() => [
    { value: "none", label: "No subject" },
    ...(subjects.data ?? []).map((s) => ({ value: s.id, label: s.code })),
  ], [subjects.data]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Enter a title.";
    else if (title.trim().length > 200) next.title = "Title must be 200 characters or fewer.";
    if (kind === "FILE" && !file) next.file = "Choose a file to share.";
    if (kind === "LINK") {
      const value = linkUrl.trim();
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.protocol !== "http:") next.linkUrl = "Enter a valid HTTP or HTTPS link.";
      } catch {
        next.linkUrl = "Enter a valid HTTP or HTTPS link.";
      }
    }
    if (description.trim().length > 2000) next.description = "Description must be 2,000 characters or fewer.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    setProgress(null);
    try {
      let fileUrl: string | null = null;
      if (kind === "FILE" && file) {
        fileUrl = await uploadFile(file, peersApi.presign, setProgress, MAX_STUDY_UPLOAD_BYTES);
      }
      await peersApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        scope,
        subjectId: subjectId ?? undefined,
        ...(kind === "FILE" && file ? { fileUrl: fileUrl!, fileName: file.name } : { linkUrl: linkUrl.trim() }),
      });
      toast.success("Resource shared with your peers.");
      router.replace("/peers" as Href);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrors(e.fieldErrors);
      toast.error(errorMessage(e, "Couldn't share this resource."));
      setProgress(null);
    } finally {
      setSubmitting(false);
    }
  };

  const isClassDisabled = !profile?.section;

  return (
    <>
      <Screen keyboard contentStyle={styles.screen}>
        <View style={styles.intro}>
          <View style={styles.heroIcon}><Paperclip size={22} color={colors.primary} /></View>
          <View style={styles.flex}>
            <Text variant="heading">Help your classmates</Text>
                <Text variant="small" color={colors.textSecondary}>Share useful study material with other students.</Text>
          </View>
        </View>

        <View style={styles.kindToggle}>
          {(["FILE", "LINK"] as const).map((k) => {
            const active = kind === k;
            const Icon = k === "FILE" ? Paperclip : Link2;
            return <Pressable key={k} onPress={() => { setKind(k); setErrors({}); }} accessibilityRole="radio" accessibilityState={{ checked: active }} style={[styles.kindOption, active && styles.kindActive]}><Icon size={17} color={active ? colors.white : colors.textSecondary} /><Text variant="smallMedium" color={active ? colors.white : colors.textSecondary}>{k === "FILE" ? "File" : "Link"}</Text></Pressable>;
          })}
        </View>

        {kind === "FILE" ? (
          <FileField
            label="Study material"
            file={file}
            existing={false}
            onPick={() => setSheetOpen(true)}
            onClear={() => { setFile(null); setProgress(null); }}
            progress={progress}
            error={errors.file}
            hint={`PDF, JPG/PNG/HEIC, PPTX, DOCX or XLSX · max ${Math.round(MAX_STUDY_UPLOAD_BYTES / 1024 / 1024)} MB`}
          />
        ) : (
          <TextField label="Resource link" value={linkUrl} onChangeText={setLinkUrl} placeholder="https://…" keyboardType="url" autoCapitalize="none" autoCorrect={false} icon={Link2} error={errors.linkUrl} />
        )}

        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Data Structures previous year papers" maxLength={200} error={errors.title} />
        <TextField label="Description" value={description} onChangeText={setDescription} placeholder="Add context so others know what this contains" multiline maxLength={2000} optional error={errors.description} />

        <ChipSelect
          label="Category"
          options={PEER_CATEGORIES.map(({ value, label }) => ({ value, label }))}
          value={category}
          onChange={setCategory}
          error={errors.category}
        />
        <View>
          <ChipSelect label="Share with" options={scopeOptions} value={scope} onChange={setScope} error={errors.scope} />
          {isClassDisabled ? <Text variant="small" color={colors.textMuted} style={styles.hint}>Class sharing is available after your section is added to your profile.</Text> : <Text variant="small" color={colors.textMuted} style={styles.hint}>{PEER_SCOPES.find((s) => s.value === scope)?.description}</Text>}
        </View>
        <ChipSelect
          label="Subject"
          options={subjectOptions}
          value={subjectId ?? "none"}
          onChange={(id) => setSubjectId(id === "none" ? null : id)}
          error={errors.subjectId}
        />
        {subjects.error && !subjects.data ? <Text variant="small" color={colors.danger}>Subjects couldn&apos;t be loaded. You can still post without choosing one.</Text> : null}

        <View style={styles.limitInfo}><Text variant="caption" color={colors.textMuted}>Sharing limit: 30 resources per day. {kind === "FILE" && file?.size ? `Selected file: ${formatBytes(file.size)}.` : ""}</Text></View>
        <Button title="Share resource" onPress={() => void submit()} loading={submitting} disabled={submitting} />
      </Screen>
      <FileSourceSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onPicked={(picked) => { setFile(picked); setErrors((e) => ({ ...e, file: "" })); setProgress(null); }} title="Choose study material" documentKind="study" />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  intro: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.base, backgroundColor: colors.primaryTint, borderRadius: radius.lg },
  heroIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderRadius: radius.md },
  kindToggle: { flexDirection: "row", gap: spacing.sm, padding: 4, backgroundColor: colors.surfaceMuted, borderRadius: radius.md },
  kindOption: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm, height: 42, borderRadius: radius.sm },
  kindActive: { backgroundColor: colors.primary }, hint: { marginTop: spacing.xs }, limitInfo: { paddingHorizontal: 2 },
});
