import { FileText, Image as ImageIcon, Paperclip, Plus, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { ProgressBar, Text } from "@/components/ui";
import type { LocalFile } from "@/lib/types";
import { colors, font, radius, spacing } from "@/theme";

function Label({ text, optional }: { text: string; optional?: boolean }) {
  return (
    <View style={styles.labelRow}>
      <Text variant="smallMedium" color={colors.textSecondary}>
        {text}
      </Text>
      {optional ? (
        <Text variant="small" color={colors.textMuted}>
          Optional
        </Text>
      ) : null}
    </View>
  );
}

function FieldError({ error }: { error?: string | null | undefined }) {
  if (!error) return null;
  return (
    <Text variant="small" color={colors.danger}>
      {error}
    </Text>
  );
}

/** Single-select chip group. */
export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string | null | undefined;
}) {
  return (
    <View style={styles.wrap}>
      <Label text={label} />
      <View style={styles.chips}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text variant="smallMedium" color={active ? colors.white : colors.text}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FieldError error={error} />
    </View>
  );
}

/** Free-text tags (e.g. tech stack). Add with return or comma. */
export function TagInput({
  label,
  value,
  onChange,
  max = 20,
  maxLength = 50,
  placeholder = "Type and press return",
  error,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  maxLength?: number;
  placeholder?: string;
  error?: string | null | undefined;
}) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

  const commit = (raw: string) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim().slice(0, maxLength))
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) {
      if (next.length >= max) break;
      if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    onChange(next);
    setDraft("");
  };

  const full = value.length >= max;

  return (
    <View style={styles.wrap}>
      <Label text={label} optional />
      <View style={[styles.tagBox, focused && styles.tagBoxFocused, !!error && { borderColor: colors.danger }]}>
        {value.map((t) => (
          <View key={t} style={styles.tag}>
            <Text variant="smallMedium" color={colors.primaryDark}>
              {t}
            </Text>
            <Pressable onPress={() => onChange(value.filter((x) => x !== t))} hitSlop={8} accessibilityLabel={`Remove ${t}`}>
              <X size={14} color={colors.primaryDark} />
            </Pressable>
          </View>
        ))}
        {!full ? (
          <TextInput
            value={draft}
            onChangeText={(v) => (v.includes(",") ? commit(v) : setDraft(v))}
            onSubmitEditing={() => commit(draft)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              commit(draft);
            }}
            submitBehavior="submit"
            returnKeyType="done"
            placeholder={value.length ? "Add more" : placeholder}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={maxLength}
            style={styles.tagInput}
          />
        ) : null}
      </View>
      {error ? (
        <FieldError error={error} />
      ) : (
        <Text variant="small" color={colors.textMuted}>
          {full ? `Maximum ${max} items` : "Separate with commas or press return"}
        </Text>
      )}
    </View>
  );
}

/** Shows the currently attached file (existing or newly picked) with change / remove actions. */
export function FileField({
  label,
  optional,
  file,
  existing,
  onPick,
  onClear,
  progress,
  error,
  hint = "PDF, JPG, PNG or WEBP · max 5 MB",
}: {
  label: string;
  optional?: boolean;
  file: LocalFile | null;
  existing: boolean;
  onPick: () => void;
  onClear?: () => void;
  progress?: number | null;
  error?: string | null | undefined;
  hint?: string;
}) {
  const hasFile = !!file || existing;
  const isImage = file?.mimeType.startsWith("image/");
  const Icon = file ? (isImage ? ImageIcon : FileText) : Paperclip;
  return (
    <View style={styles.wrap}>
      <Label text={label} optional={optional} />
      {hasFile ? (
        <View style={[styles.fileBox, !!error && { borderColor: colors.danger }]}>
          <View style={styles.fileIcon}>
            <Icon size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="smallMedium" numberOfLines={1}>
              {file ? file.name : "Current file attached"}
            </Text>
            {progress != null ? (
              <View style={{ marginTop: 6 }}>
                <ProgressBar value={progress} height={4} />
              </View>
            ) : (
              <Pressable onPress={onPick} hitSlop={6}>
                <Text variant="small" color={colors.primary}>
                  Change file
                </Text>
              </Pressable>
            )}
          </View>
          {onClear && progress == null ? (
            <Pressable onPress={onClear} hitSlop={10} accessibilityLabel="Remove file" style={styles.clear}>
              <X size={16} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Pressable onPress={onPick} style={[styles.dropzone, !!error && { borderColor: colors.danger }]} accessibilityRole="button">
          <Plus size={20} color={colors.primary} />
          <Text variant="smallMedium" color={colors.primary}>
            Attach file
          </Text>
          <Text variant="small" color={colors.textMuted}>
            {hint}
          </Text>
        </Pressable>
      )}
      <FieldError error={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs + 2,
    minHeight: 50,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tagBoxFocused: { borderColor: colors.primary },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: spacing.sm + 2,
    paddingRight: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.primaryTint,
  },
  tagInput: { flexGrow: 1, minWidth: 110, fontFamily: font.regular, fontSize: 15, color: colors.text, paddingVertical: 6, paddingHorizontal: 4 },
  fileBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fileIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  clear: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  dropzone: {
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primarySoft,
    backgroundColor: colors.primaryTint,
  },
});
