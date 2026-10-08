import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/theme";
import { Button } from "./Button";
import { Text } from "./Text";

/** Full-height form sheet with a sticky header and primary action. */
export function FormSheet({
  visible,
  title,
  onClose,
  onSubmit,
  submitLabel = "Save",
  submitting,
  submitDisabled,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={() => {
        if (!submitting) onClose();
      }}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <SafeAreaView style={styles.root} edges={Platform.OS === "ios" ? ["bottom"] : ["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            disabled={submitting}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}
          >
            <X size={22} color={colors.textSecondary} />
          </Pressable>
          <Text variant="heading" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <View style={styles.close} />
        </View>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {children}
          </ScrollView>
          {onSubmit || footer ? (
            <View style={styles.footer}>
              {footer}
              {onSubmit ? (
                <Button title={submitLabel} onPress={onSubmit} loading={submitting} disabled={submitDisabled} />
              ) : null}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

/** Bottom sheet for pickers / action lists. */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.grabber} />
          {title ? (
            <Text variant="heading" style={styles.sheetTitle}>
              {title}
            </Text>
          ) : null}
          {children}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  close: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center" },
  body: { padding: spacing.lg, gap: spacing.base, paddingBottom: spacing.xxl },
  footer: {
    padding: spacing.base,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.base,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginVertical: spacing.sm + 2 },
  sheetTitle: { marginBottom: spacing.md, marginTop: spacing.xs },
});
