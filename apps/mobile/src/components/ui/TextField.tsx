import { Eye, EyeOff, type LucideIcon } from "lucide-react-native";
import { forwardRef, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { colors, font, radius, spacing } from "@/theme";
import { Text } from "./Text";

export type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string | null | undefined;
  hint?: string;
  icon?: LucideIcon;
  password?: boolean;
  optional?: boolean;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, icon: Icon, password, optional, style, multiline, editable = true, onFocus, onBlur, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.wrap}>
      {label ? (
        <View style={styles.labelRow}>
          <Text variant="smallMedium" color={colors.textSecondary}>
            {label}
          </Text>
          {optional ? (
            <Text variant="small" color={colors.textMuted}>
              Optional
            </Text>
          ) : null}
        </View>
      ) : null}
      <View
        style={[
          styles.field,
          multiline && styles.multiline,
          { borderColor, backgroundColor: editable ? colors.surface : colors.surfaceMuted },
          // iOS only: on Android (Fabric) toggling shadow props on the focused input's parent
          // makes the native TextInput lose focus right after it gains it, closing the keyboard.
          Platform.OS === "ios" && focused && !error && styles.focusRing,
        ]}
      >
        {Icon ? <Icon size={18} color={focused ? colors.primary : colors.textMuted} style={styles.leading} /> : null}
        <TextInput
          ref={ref}
          {...rest}
          editable={editable}
          multiline={multiline}
          secureTextEntry={password ? hidden : rest.secureTextEntry}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          maxFontSizeMultiplier={1.4}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMultiline, !editable && { color: colors.textSecondary }, style]}
        />
        {password ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            style={styles.trailing}
          >
            {hidden ? <Eye size={18} color={colors.textMuted} /> : <EyeOff size={18} color={colors.textMuted} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="small" color={colors.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color={colors.textMuted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: radius.md,
    minHeight: 50,
    paddingHorizontal: spacing.md + 2,
  },
  focusRing: { shadowColor: colors.primary, shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  multiline: { alignItems: "flex-start", paddingVertical: spacing.sm },
  leading: { marginRight: spacing.sm + 2 },
  trailing: { marginLeft: spacing.sm, padding: 2 },
  input: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.text, paddingVertical: 12 },
  inputMultiline: { minHeight: 96, textAlignVertical: "top", paddingVertical: 6 },
});
