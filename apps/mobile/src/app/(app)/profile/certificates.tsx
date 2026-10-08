import { Award, Plus } from "lucide-react-native";
import { useState } from "react";
import { Alert } from "react-native";
import { confirmDelete, EntityCard } from "@/components/EntityCard";
import { FileSourceSheet } from "@/components/FileSourceSheet";
import { FileField } from "@/components/FormBits";
import { Button, DateField, EmptyState, ErrorState, FormSheet, Screen, SkeletonList, Text, TextField, useToast } from "@/components/ui";
import { useProfile } from "@/context/ProfileContext";
import { ApiError, errorMessage, profileApi } from "@/lib/api";
import { formatMonthYear, todayYmd } from "@/lib/format";
import { openUrl } from "@/lib/openFile";
import type { Certificate, LocalFile } from "@/lib/types";
import { uploadFile } from "@/lib/upload";
import { colors } from "@/theme";

type Form = { title: string; issuer: string; issueDate: string | null; file: LocalFile | null; hasExisting: boolean };
const empty: Form = { title: "", issuer: "", issueDate: null, file: null, hasExisting: false };

export default function CertificatesScreen() {
  const { profile, error, reload, refresh, refreshing, revalidate } = useProfile();
  const toast = useToast();
  const [editing, setEditing] = useState<Certificate | "new" | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);

  const open = (c: Certificate | "new") => {
    setEditing(c);
    setErrors({});
    setForm(c === "new" ? empty : { title: c.title, issuer: c.issuer ?? "", issueDate: c.issueDate, file: null, hasExisting: !!c.fileUrl });
  };
  const close = () => {
    if (!saving) setEditing(null);
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.file && !form.hasExisting) e.fileUrl = "Please attach the certificate";
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      let fileUrl: string | undefined;
      if (form.file) {
        setProgress(0);
        fileUrl = await uploadFile(form.file, profileApi.presignCertificate, setProgress);
      }
      const body = { title: form.title.trim(), issuer: form.issuer.trim() || null, issueDate: form.issueDate };
      if (editing === "new") {
        await profileApi.addCertificate({ ...body, fileUrl: fileUrl! });
      } else if (editing) {
        await profileApi.updateCertificate(editing.id, fileUrl ? { ...body, fileUrl } : body);
      }
      await revalidate();
      toast.success(editing === "new" ? "Certificate added" : "Certificate updated");
      setEditing(null);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else Alert.alert("Couldn't save", errorMessage(err));
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const remove = (c: Certificate) =>
    confirmDelete("certificate", async () => {
      try {
        await profileApi.deleteCertificate(c.id);
        await revalidate();
        toast.success("Certificate deleted");
      } catch (err) {
        Alert.alert("Couldn't delete", errorMessage(err));
      }
    });

  const items = profile?.certificates ?? [];

  return (
    <Screen
      edges={[]}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={profile && items.length ? <Button title="Add certificate" icon={Plus} onPress={() => open("new")} /> : undefined}
    >
      {!profile ? (
        error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <SkeletonList count={3} height={84} />
        )
      ) : items.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certificates yet"
          message="Add certifications from courses, workshops or competitions to strengthen your profile."
          actionLabel="Add certificate"
          onAction={() => open("new")}
        />
      ) : (
        <>
          <Text variant="small" color={colors.textSecondary}>
            {items.length} certificate{items.length === 1 ? "" : "s"} · tap one to view the file
          </Text>
          {items.map((c) => (
            <EntityCard
              key={c.id}
              icon={Award}
              iconColor={colors.warningDark}
              iconBg={colors.warningSoft}
              title={c.title}
              subtitle={c.issuer}
              meta={c.issueDate ? `Issued ${formatMonthYear(c.issueDate)}` : null}
              onPress={c.fileUrl ? () => openUrl(c.fileUrl) : () => open(c)}
              actions={[
                ...(c.fileUrl ? [{ label: "View file", onPress: () => void openUrl(c.fileUrl) }] : []),
                { label: "Edit", onPress: () => open(c) },
                { label: "Delete", destructive: true, onPress: () => remove(c) },
              ]}
            />
          ))}
        </>
      )}

      <FormSheet
        visible={editing !== null}
        title={editing === "new" ? "Add certificate" : "Edit certificate"}
        onClose={close}
        onSubmit={save}
        submitting={saving}
        submitLabel={progress !== null ? `Uploading ${Math.round(progress * 100)}%` : "Save"}
      >
        <TextField
          label="Title"
          value={form.title}
          onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
          error={errors.title}
          placeholder="e.g. AWS Cloud Practitioner"
          maxLength={200}
        />
        <TextField
          label="Issued by"
          optional
          value={form.issuer}
          onChangeText={(v) => setForm((f) => ({ ...f, issuer: v }))}
          error={errors.issuer}
          placeholder="e.g. Amazon Web Services"
          maxLength={200}
        />
        <DateField
          label="Issue date"
          optional
          value={form.issueDate}
          onChange={(v) => setForm((f) => ({ ...f, issueDate: v }))}
          maxDate={todayYmd()}
          minYear={2000}
          error={errors.issueDate}
        />
        <FileField
          label="Certificate file"
          file={form.file}
          existing={form.hasExisting}
          onPick={() => setPicker(true)}
          progress={progress}
          error={errors.fileUrl}
        />
        <FileSourceSheet
          visible={picker}
          onClose={() => setPicker(false)}
          onPicked={(file) => {
            setForm((f) => ({ ...f, file }));
            setErrors((e) => ({ ...e, fileUrl: "" }));
          }}
          title="Attach certificate"
        />
      </FormSheet>
    </Screen>
  );
}

