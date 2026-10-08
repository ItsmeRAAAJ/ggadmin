import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { OTP_LENGTH } from "@/lib/config";
import { colors, font, radius, spacing } from "@/theme";
import { Text } from "./Text";

/** Single hidden input rendered as N boxes — supports paste & SMS/email autofill. */
export function OtpInput({
  value,
  onChange,
  error,
  autoFocus = true,
  editable = true,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
}) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="Verification code" style={styles.row}>
      {Array.from({ length: OTP_LENGTH }, (_, i) => {
        const char = value[i] ?? "";
        const active = focused && (i === value.length || (i === OTP_LENGTH - 1 && value.length === OTP_LENGTH));
        return (
          <View
            key={i}
            style={[
              styles.box,
              char ? styles.filled : null,
              active ? styles.active : null,
              error ? styles.error : null,
            ]}
          >
            <Text variant="title" color={colors.text}>
              {char}
            </Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, OTP_LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        autoFocus={autoFocus}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  box: {
    flex: 1,
    aspectRatio: 0.86,
    maxHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  filled: { borderColor: colors.borderStrong },
  active: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  error: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  hidden: { position: "absolute", width: "100%", height: "100%", opacity: 0.011, color: "transparent", fontFamily: font.regular },
});
