import { useNavigation } from "expo-router";
import { Camera, Hash, Phone, UserRound } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { FileSourceSheet } from "@/components/FileSourceSheet";
import { Avatar, Button, Card, DateField, Divider, ErrorState, Screen, Skeleton, Text, TextField, useToast } from "@/components/ui";
import { useProfile } from "@/context/ProfileContext";
import { ApiError, errorMessage, profileApi } from "@/lib/api";
import { fullName, ordinal } from "@/lib/format";
import type { LocalFile, StudentProfile } from "@/lib/types";
import { uploadFile } from "@/lib/upload";
import { PHONE_RE } from "@/lib/validation";
import { colors, radius, spacing } from "@/theme";

type Form = { firstName: string; lastName: string; phone: string; section: string; dateOfBirth: string | null };

const toForm = (p: StudentProfile): Form => ({
  firstName: p.firstName ?? "",
  lastName: p.lastName ?? "",
  phone: p.phone ?? "",
  section: p.section ?? "",
  dateOfBirth: p.dateOfBirth,
});

export default function EditProfileScreen() {
  const { profile, error, reload } = useProfile();
  if (!profile) {
    return (
      <Screen edges={[]}>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <>
            <Skeleton height={120} rounded={radius.lg} />
            <Skeleton height={300} rounded={radius.lg} />
          </>
        )}
      </Screen>
    );
  }
  return <EditForm profile={profile} />;
}

function EditForm({ profile }: { profile: StudentProfile }) {
  const { revalidate } = useProfile();
  const navigation = useNavigation();
  const toast = useToast();
  const [initial, setInitial] = useState<Form>(() => toForm(profile));
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const dirty = useMemo(() => (Object.keys(form) as (keyof Form)[]).some((k) => (form[k] ?? "") !== (initial[k] ?? "")), [form, initial]);

  const today = new Date();
  const maxDob = { year: today.getFullYear() - 10, month: today.getMonth(), day: today.getDate() };

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // Warn before discarding unsaved edits.
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      if (!dirty || saving) return;
      e.preventDefault();
      Alert.alert("Discard changes?", "You have unsaved changes to your details.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsub;
  }, [navigation, dirty, saving]);

  const validate = (): boolean => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";
    const phone = form.phone.replace(/[\s-]/g, "");
    if (phone && !PHONE_RE.test(phone)) e.phone = "Enter a valid phone number (10–15 digits)";
    if (form.section.trim().length > 10) e.section = "Section must be 10 characters or fewer";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const phone = form.phone.replace(/[\s-]/g, "");
      await profileApi.update({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: phone || null,
        section: form.section.trim().toUpperCase() || null,
        dateOfBirth: form.dateOfBirth,
      });
      await revalidate();
      const next = { ...form, phone, section: form.section.trim().toUpperCase() };
      setInitial(next);
      setForm(next);
      toast.success("Details saved");
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) {
        setErrors(e.fieldErrors as Partial<Record<keyof Form, string>>);
      } else {
        Alert.alert("Couldn't save", errorMessage(e));
      }
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file: LocalFile) => {
    setPhotoBusy(true);
    try {
      const url = await uploadFile(file, profileApi.presignPhoto);
      await profileApi.confirmPhoto(url);
      await revalidate();
      toast.success("Photo updated");
    } catch (e) {
      Alert.alert("Couldn't update photo", errorMessage(e));
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = () => {
    Alert.alert("Remove photo?", "Your profile photo will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setPhotoBusy(true);
          try {
            await profileApi.deletePhoto();
            await revalidate();
            toast.success("Photo removed");
          } catch (e) {
            Alert.alert("Couldn't remove photo", errorMessage(e));
          } finally {
            setPhotoBusy(false);
          }
        },
      },
    ]);
  };

  const name = fullName(profile);

  return (
    <Screen
      edges={[]}
      keyboard
      footer={<Button title="Save changes" onPress={save} loading={saving} disabled={!dirty} size="lg" />}
    >
      <View style={styles.photoWrap}>
        <Pressable onPress={() => setPhotoSheet(true)} disabled={photoBusy} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <Avatar uri={profile.profileImageUrl} name={name} size={104} ring />
          <View style={styles.camBadge}>
            {photoBusy ? <ActivityIndicator size="small" color={colors.white} /> : <Camera size={16} color={colors.white} />}
          </View>
        </Pressable>
        <Button
          title={profile.profileImageUrl ? "Change photo" : "Add photo"}
          variant="ghost"
          size="sm"
          fullWidth={false}
          onPress={() => setPhotoSheet(true)}
          disabled={photoBusy}
        />
      </View>

      <Card style={styles.formCard}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="First name"
              value={form.firstName}
              onChangeText={(v) => set("firstName", v)}
              error={errors.firstName}
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
              maxLength={100}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Last name"
              value={form.lastName}
              onChangeText={(v) => set("lastName", v)}
              error={errors.lastName}
              autoCapitalize="words"
              autoComplete="family-name"
              textContentType="familyName"
              maxLength={100}
            />
          </View>
        </View>
        <TextField
          label="Phone"
          optional
          icon={Phone}
          value={form.phone}
          onChangeText={(v) => set("phone", v)}
          error={errors.phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="e.g. 9876543210"
          maxLength={16}
        />
        <DateField
          label="Date of birth"
          optional
          value={form.dateOfBirth}
          onChange={(v) => set("dateOfBirth", v)}
          minYear={1980}
          maxDate={maxDob}
          initialYear={today.getFullYear() - 20}
          error={errors.dateOfBirth}
        />
        <TextField
          label="Section"
          optional
          icon={Hash}
          value={form.section}
          onChangeText={(v) => set("section", v.toUpperCase())}
          error={errors.section}
          autoCapitalize="characters"
          placeholder="e.g. A"
          maxLength={10}
        />
      </Card>

      <Card padded={false}>
        <View style={styles.roHeader}>
          <UserRound size={16} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>
            ACADEMIC DETAILS · MANAGED BY COLLEGE
          </Text>
        </View>
        <ReadOnly label="Enrollment no." value={profile.enrollmentNumber ?? "—"} />
        <Divider inset={spacing.base} />
        <ReadOnly label="Email" value={profile.email} />
        <Divider inset={spacing.base} />
        <ReadOnly label="Branch" value={profile.branch.name} />
        <Divider inset={spacing.base} />
        <ReadOnly label="Semester" value={`${ordinal(profile.currentSemester)} semester`} />
        <Divider inset={spacing.base} />
        <ReadOnly label="Batch" value={`${profile.admissionYear}${profile.passoutYear ? ` – ${profile.passoutYear}` : ""}`} />
      </Card>
      <Text variant="small" color={colors.textMuted} align="center">
        Contact your department if any academic detail is incorrect.
      </Text>

      <FileSourceSheet
        visible={photoSheet}
        onClose={() => setPhotoSheet(false)}
        onPicked={uploadPhoto}
        title="Profile photo"
        sources={["library", "camera"]}
        square
        onRemove={profile.profileImageUrl ? removePhoto : undefined}
        removeLabel="Remove photo"
      />
    </Screen>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.ro}>
      <Text variant="small" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.roValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  photoWrap: { alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  camBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  formCard: { gap: spacing.base },
  row: { flexDirection: "row", gap: spacing.md },
  roHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.base, paddingTop: spacing.base, paddingBottom: spacing.xs },
  ro: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.base, paddingHorizontal: spacing.base, paddingVertical: spacing.md + 2 },
  roValue: { flexShrink: 1, textAlign: "right" },
});
