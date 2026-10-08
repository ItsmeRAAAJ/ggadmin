import { BookOpen, Medal, Plus, Trophy, Users } from "lucide-react-native";
import { useState } from "react";
import { Alert } from "react-native";
import { confirmDelete, EntityCard } from "@/components/EntityCard";
import { FileSourceSheet } from "@/components/FileSourceSheet";
import { ChipSelect, FileField } from "@/components/FormBits";
import { Button, DateField, EmptyState, ErrorState, FormSheet, Screen, Segmented, SkeletonList, TextField, useToast } from "@/components/ui";
import { useProfile } from "@/context/ProfileContext";
import { ApiError, errorMessage, profileApi } from "@/lib/api";
import { formatDateOnly, todayYmd } from "@/lib/format";
import { openUrl } from "@/lib/openFile";
import type { Achievement, AchievementCategory, LocalFile } from "@/lib/types";
import { uploadFile } from "@/lib/upload";
import { colors } from "@/theme";

const CATEGORIES: { value: AchievementCategory; label: string; icon: typeof Trophy; color: string; bg: string }[] = [
  { value: "ACADEMIC", label: "Academic", icon: BookOpen, color: colors.primary, bg: colors.primaryTint },
  { value: "CO_CURRICULAR", label: "Co-curricular", icon: Users, color: "#0E7490", bg: colors.secondarySoft },
  { value: "EXTRA_CURRICULAR", label: "Extra-curricular", icon: Medal, color: colors.accentDark, bg: colors.accentSoft },
];
const catOf = (c: AchievementCategory) => CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[0]!;

type Filter = "ALL" | AchievementCategory;
type Form = {
  title: string;
  description: string;
  date: string | null;
  category: AchievementCategory | null;
  file: LocalFile | null;
  hasExisting: boolean;
  removeExisting: boolean;
};
const empty: Form = { title: "", description: "", date: null, category: null, file: null, hasExisting: false, removeExisting: false };

export default function AchievementsScreen() {
  const { profile, error, reload, refresh, refreshing, revalidate } = useProfile();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [editing, setEditing] = useState<Achievement | "new" | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);

  const open = (a: Achievement | "new") => {
    setEditing(a);
    setErrors({});
    setForm(
      a === "new"
        ? { ...empty, category: filter === "ALL" ? null : filter }
        : {
            title: a.title,
            description: a.description ?? "",
            date: a.date,
            category: a.category,
            file: null,
            hasExisting: !!a.fileUrl,
            removeExisting: false,
          }
    );
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.category) e.category = "Choose a category";
    setErrors(e);
    if (Object.keys(e).length || !form.category) return;

    setSaving(true);
    try {
      let fileUrl: string | null | undefined;
      if (form.file) {
        setProgress(0);
        fileUrl = await uploadFile(form.file, profileApi.presignAchievement, setProgress);
      } else if (form.removeExisting) {
        fileUrl = null;
      }
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        date: form.date,
        category: form.category,
        ...(fileUrl !== undefined ? { fileUrl } : {}),
      };
      if (editing === "new") await profileApi.addAchievement({ ...body, fileUrl: fileUrl ?? null });
      else if (editing) await profileApi.updateAchievement(editing.id, body);
      await revalidate();
      toast.success(editing === "new" ? "Achievement added" : "Achievement updated");
      setEditing(null);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else Alert.alert("Couldn't save", errorMessage(err));
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const remove = (a: Achievement) =>
    confirmDelete("achievement", async () => {
      try {
        await profileApi.deleteAchievement(a.id);
        await revalidate();
        toast.success("Achievement deleted");
      } catch (err) {
        Alert.alert("Couldn't delete", errorMessage(err));
      }
    });

  const all = profile?.achievements ?? [];
  const items = filter === "ALL" ? all : all.filter((a) => a.category === filter);

  return (
    <Screen
      edges={[]}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={profile && all.length ? <Button title="Add achievement" icon={Plus} onPress={() => open("new")} /> : undefined}
    >
      {!profile ? (
        error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <SkeletonList count={3} height={84} />
        )
      ) : all.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No achievements yet"
          message="Add academic awards, club roles, sports, competitions and more."
          actionLabel="Add achievement"
          onAction={() => open("new")}
        />
      ) : (
        <>
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            segments={[
              { key: "ALL", label: "All", count: all.length },
              ...CATEGORIES.map((c) => ({ key: c.value, label: c.label, count: all.filter((a) => a.category === c.value).length })),
            ]}
          />
          {items.length === 0 ? (
            <EmptyState compact icon={Trophy} title="Nothing here yet" message={`No ${catOf(filter as AchievementCategory).label.toLowerCase()} achievements added.`} />
          ) : (
            items.map((a) => {
              const c = catOf(a.category);
              return (
                <EntityCard
                  key={a.id}
                  icon={c.icon}
                  iconColor={c.color}
                  iconBg={c.bg}
                  title={a.title}
                  subtitle={a.description}
                  meta={[c.label, a.date ? formatDateOnly(a.date) : null, a.fileUrl ? "File attached" : null].filter(Boolean).join(" · ")}
                  onPress={() => open(a)}
                  actions={[
                    ...(a.fileUrl ? [{ label: "View file", onPress: () => void openUrl(a.fileUrl) }] : []),
                    { label: "Edit", onPress: () => open(a) },
                    { label: "Delete", destructive: true, onPress: () => remove(a) },
                  ]}
                />
              );
            })
          )}
        </>
      )}

      <FormSheet
        visible={editing !== null}
        title={editing === "new" ? "Add achievement" : "Edit achievement"}
        onClose={() => !saving && setEditing(null)}
        onSubmit={save}
        submitting={saving}
        submitLabel={progress !== null ? `Uploading ${Math.round(progress * 100)}%` : "Save"}
      >
        <ChipSelect
          label="Category"
          options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          value={form.category}
          onChange={(v) => {
            setForm((f) => ({ ...f, category: v }));
            setErrors((e) => ({ ...e, category: "" }));
          }}
          error={errors.category}
        />
        <TextField
          label="Title"
          value={form.title}
          onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
          error={errors.title}
          placeholder="e.g. 1st place, Smart India Hackathon"
          maxLength={200}
        />
        <TextField
          label="Description"
          optional
          value={form.description}
          onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
          error={errors.description}
          multiline
          maxLength={2000}
        />
        <DateField
          label="Date"
          optional
          value={form.date}
          onChange={(v) => setForm((f) => ({ ...f, date: v }))}
          maxDate={todayYmd()}
          minYear={2000}
          error={errors.date}
        />
        <FileField
          label="Proof / certificate"
          optional
          file={form.file}
          existing={form.hasExisting && !form.removeExisting}
          onPick={() => setPicker(true)}
          onClear={() => setForm((f) => ({ ...f, file: null, removeExisting: f.hasExisting }))}
          progress={progress}
          error={errors.fileUrl}
        />
        <FileSourceSheet
          visible={picker}
          onClose={() => setPicker(false)}
          onPicked={(file) => setForm((f) => ({ ...f, file }))}
          title="Attach proof"
        />
      </FormSheet>
    </Screen>
  );
}
