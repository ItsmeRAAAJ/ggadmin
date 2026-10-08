import { BriefcaseBusiness, CodeXml, Globe, Link2, Plus } from "lucide-react-native";
import { useState } from "react";
import { Alert } from "react-native";
import { confirmDelete, EntityCard } from "@/components/EntityCard";
import { ChipSelect } from "@/components/FormBits";
import { Button, EmptyState, ErrorState, FormSheet, Screen, SkeletonList, Text, TextField, useToast } from "@/components/ui";
import { useProfile } from "@/context/ProfileContext";
import { ApiError, errorMessage, profileApi } from "@/lib/api";
import { normaliseUrl } from "@/lib/format";
import { openUrl } from "@/lib/openFile";
import type { SocialLink, SocialPlatform } from "@/lib/types";
import { isHttpUrl } from "@/lib/validation";
import { colors } from "@/theme";

const PLATFORMS: { value: SocialPlatform; label: string; icon: typeof Globe; color: string; bg: string; placeholder: string; host?: string }[] = [
  { value: "LINKEDIN", label: "LinkedIn", icon: BriefcaseBusiness, color: "#0A66C2", bg: "#E8F1FB", placeholder: "linkedin.com/in/your-name", host: "linkedin.com" },
  { value: "GITHUB", label: "GitHub", icon: CodeXml, color: colors.text, bg: colors.surfaceMuted, placeholder: "github.com/your-username", host: "github.com" },
  { value: "PORTFOLIO", label: "Portfolio", icon: Globe, color: colors.accentDark, bg: colors.accentSoft, placeholder: "yourname.dev" },
  { value: "OTHER", label: "Other", icon: Link2, color: colors.primary, bg: colors.primaryTint, placeholder: "https://…" },
];
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}
const platformOf = (p: SocialPlatform) => PLATFORMS.find((x) => x.value === p) ?? PLATFORMS[3]!;

export default function SocialLinksScreen() {
  const { profile, error, reload, refresh, refreshing, revalidate } = useProfile();
  const toast = useToast();
  const [editing, setEditing] = useState<SocialLink | "new" | null>(null);
  const [platform, setPlatform] = useState<SocialPlatform | null>(null);
  const [url, setUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const items = profile?.socialLinks ?? [];
  const used = new Set(items.map((l) => l.platform));

  const open = (l: SocialLink | "new") => {
    setEditing(l);
    setErrors({});
    if (l === "new") {
      setPlatform(PLATFORMS.find((p) => p.value !== "OTHER" && !used.has(p.value))?.value ?? "OTHER");
      setUrl("");
    } else {
      setPlatform(l.platform);
      setUrl(l.url);
    }
  };

  const save = async () => {
    const e: Record<string, string> = {};
    const normalised = url.trim() ? normaliseUrl(url.trim()) : "";
    if (!platform) e.platform = "Choose a platform";
    if (!normalised) e.url = "Link is required";
    else if (!isHttpUrl(normalised)) e.url = "Enter a valid link";
    else {
      const expected = platform ? platformOf(platform).host : undefined;
      if (expected && !hostnameOf(normalised).endsWith(expected)) e.url = `This doesn't look like a ${platformOf(platform!).label} link`;
    }
    setErrors(e);
    if (Object.keys(e).length || !platform) return;

    setSaving(true);
    try {
      if (editing === "new") await profileApi.addSocialLink({ platform, url: normalised });
      else if (editing) await profileApi.updateSocialLink(editing.id, { platform, url: normalised });
      await revalidate();
      toast.success(editing === "new" ? "Link added" : "Link updated");
      setEditing(null);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else Alert.alert("Couldn't save", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = (l: SocialLink) =>
    confirmDelete(`${platformOf(l.platform).label} link`, async () => {
      try {
        await profileApi.deleteSocialLink(l.id);
        await revalidate();
        toast.success("Link deleted");
      } catch (err) {
        Alert.alert("Couldn't delete", errorMessage(err));
      }
    });

  return (
    <Screen
      edges={[]}
      refreshing={refreshing}
      onRefresh={refresh}
      footer={profile && items.length ? <Button title="Add link" icon={Plus} onPress={() => open("new")} /> : undefined}
    >
      {!profile ? (
        error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <SkeletonList count={3} height={72} />
        )
      ) : items.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No links yet"
          message="Add your LinkedIn, GitHub or portfolio so recruiters can learn more about you."
          actionLabel="Add link"
          onAction={() => open("new")}
        />
      ) : (
        <>
          <Text variant="small" color={colors.textSecondary}>
            Tap a link to open it.
          </Text>
          {items.map((l) => {
            const p = platformOf(l.platform);
            return (
              <EntityCard
                key={l.id}
                icon={p.icon}
                iconColor={p.color}
                iconBg={p.bg}
                title={p.label}
                subtitle={l.url.replace(/^https?:\/\/(www\.)?/, "")}
                onPress={() => openUrl(l.url)}
                actions={[
                  { label: "Open link", onPress: () => void openUrl(l.url) },
                  { label: "Edit", onPress: () => open(l) },
                  { label: "Delete", destructive: true, onPress: () => remove(l) },
                ]}
              />
            );
          })}
        </>
      )}

      <FormSheet
        visible={editing !== null}
        title={editing === "new" ? "Add link" : "Edit link"}
        onClose={() => !saving && setEditing(null)}
        onSubmit={save}
        submitting={saving}
      >
        <ChipSelect
          label="Platform"
          options={PLATFORMS.map((p) => ({ value: p.value, label: p.label }))}
          value={platform}
          onChange={(v) => {
            setPlatform(v);
            setErrors({});
          }}
          error={errors.platform}
        />
        <TextField
          label="Link"
          value={url}
          onChangeText={(v) => {
            setUrl(v);
            if (errors.url) setErrors((e) => ({ ...e, url: "" }));
          }}
          error={errors.url}
          placeholder={platform ? platformOf(platform).placeholder : "https://…"}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          textContentType="URL"
          maxLength={2048}
          hint="We'll add https:// automatically if you leave it out."
        />
      </FormSheet>
    </Screen>
  );
}
