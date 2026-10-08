import { ExternalLink, FolderGit2, Plus } from "lucide-react-native";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { confirmDelete, EntityCard } from "@/components/EntityCard";
import { TagInput } from "@/components/FormBits";
import { Button, DateField, EmptyState, ErrorState, FormSheet, Screen, SkeletonList, Text, TextField, useToast } from "@/components/ui";
import { useProfile } from "@/context/ProfileContext";
import { ApiError, errorMessage, profileApi } from "@/lib/api";
import { formatMonthYear, hostOf, normaliseUrl, todayYmd } from "@/lib/format";
import { openUrl } from "@/lib/openFile";
import type { Project } from "@/lib/types";
import { isHttpUrl } from "@/lib/validation";
import { colors, radius, spacing } from "@/theme";

type Form = { title: string; description: string; techStack: string[]; link: string; startDate: string | null; endDate: string | null };
const empty: Form = { title: "", description: "", techStack: [], link: "", startDate: null, endDate: null };

function period(p: Project): string | null {
  const s = formatMonthYear(p.startDate);
  const e = formatMonthYear(p.endDate);
  if (s && e) return s === e ? s : `${s} – ${e}`;
  if (s) return `${s} – Present`;
  if (e) return `Completed ${e}`;
  return null;
}

export default function ProjectsScreen() {
  const { profile, error, reload, refresh, refreshing, revalidate } = useProfile();
  const toast = useToast();
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  const open = (p: Project | "new") => {
    setEditing(p);
    setErrors({});
    setForm(
      p === "new"
        ? empty
        : { title: p.title, description: p.description ?? "", techStack: p.techStack, link: p.link ?? "", startDate: p.startDate, endDate: p.endDate }
    );
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    const link = form.link.trim() ? normaliseUrl(form.link.trim()) : "";
    if (link && !isHttpUrl(link)) e.link = "Enter a valid link, e.g. github.com/you/project";
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) e.endDate = "End date must be after start date";
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        techStack: form.techStack,
        link: link || null,
        startDate: form.startDate,
        endDate: form.endDate,
      };
      if (editing === "new") await profileApi.addProject(body);
      else if (editing) await profileApi.updateProject(editing.id, body);
      await revalidate();
      toast.success(editing === "new" ? "Project added" : "Project updated");
      setEditing(null);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else Alert.alert("Couldn't save", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = (p: Project) =>
    confirmDelete("project", async () => {
      try {
        await profileApi.deleteProject(p.id);
        await revalidate();
        toast.success("Project deleted");
      } catch (err) {
        Alert.alert("Couldn't delete", errorMessage(err));
      }
    });

  const items = profile?.projects ?? [];

  return (
    <Screen
      edges={[]}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={profile && items.length ? <Button title="Add project" icon={Plus} onPress={() => open("new")} /> : undefined}
    >
      {!profile ? (
        error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <SkeletonList count={3} height={120} />
        )
      ) : items.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects yet"
          message="Showcase what you've built — academic, personal or hackathon projects all count."
          actionLabel="Add project"
          onAction={() => open("new")}
        />
      ) : (
        items.map((p) => (
          <EntityCard
            key={p.id}
            icon={FolderGit2}
            title={p.title}
            subtitle={p.description}
            meta={period(p)}
            onPress={() => open(p)}
            actions={[
              ...(p.link ? [{ label: "Open link", onPress: () => void openUrl(p.link) }] : []),
              { label: "Edit", onPress: () => open(p) },
              { label: "Delete", destructive: true, onPress: () => remove(p) },
            ]}
          >
            {p.techStack.length ? (
              <View style={styles.tags}>
                {p.techStack.map((t) => (
                  <View key={t} style={styles.tag}>
                    <Text variant="small" color={colors.primaryDark}>
                      {t}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {p.link ? (
              <Button
                title={hostOf(p.link)}
                icon={ExternalLink}
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => openUrl(p.link)}
                style={styles.link}
              />
            ) : null}
          </EntityCard>
        ))
      )}

      <FormSheet
        visible={editing !== null}
        title={editing === "new" ? "Add project" : "Edit project"}
        onClose={() => !saving && setEditing(null)}
        onSubmit={save}
        submitting={saving}
      >
        <TextField label="Title" value={form.title} onChangeText={(v) => set("title", v)} error={errors.title} placeholder="e.g. Campus Event App" maxLength={200} />
        <TextField
          label="Description"
          optional
          value={form.description}
          onChangeText={(v) => set("description", v)}
          error={errors.description}
          multiline
          placeholder="What does it do? What was your role?"
          maxLength={2000}
        />
        <TagInput label="Tech stack" value={form.techStack} onChange={(v) => set("techStack", v)} placeholder="e.g. React, Node.js" error={errors.techStack} />
        <TextField
          label="Link"
          optional
          value={form.link}
          onChangeText={(v) => set("link", v)}
          error={errors.link}
          placeholder="github.com/you/project"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={2048}
        />
        <View style={styles.dates}>
          <View style={styles.flex}>
            <DateField label="Start date" optional value={form.startDate} onChange={(v) => set("startDate", v)} maxDate={todayYmd()} minYear={2000} error={errors.startDate} />
          </View>
          <View style={styles.flex}>
            <DateField label="End date" optional value={form.endDate} onChange={(v) => set("endDate", v)} minYear={2000} error={errors.endDate} />
          </View>
        </View>
        <Text variant="small" color={colors.textMuted}>
          Leave the end date empty if you&apos;re still working on it.
        </Text>
      </FormSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md },
  tag: { paddingHorizontal: spacing.sm + 2, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.primaryTint },
  link: { marginTop: spacing.sm, marginLeft: -spacing.md },
  dates: { flexDirection: "row", gap: spacing.md },
});
