import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";

export function AuthScaffold({
  title,
  subtitle,
  children,
  back = true,
  hero,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  back?: boolean;
  hero?: ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {back && router.canGoBack() ? (
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
              <ArrowLeft size={22} color={colors.text} />
            </Pressable>
          ) : null}
          {hero}
          <View style={styles.head}>
            <Text variant="display">{title}</Text>
            {subtitle ? (
              typeof subtitle === "string" ? (
                <Text color={colors.textSecondary}>{subtitle}</Text>
              ) : (
                subtitle
              )
            ) : null}
          </View>
          <View style={styles.body}>{children}</View>
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.xl, paddingTop: spacing.base, gap: spacing.xl, maxWidth: 520, width: "100%", alignSelf: "center" },
  back: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  head: { gap: spacing.sm },
  body: { gap: spacing.base },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.base, alignItems: "center" },
});
