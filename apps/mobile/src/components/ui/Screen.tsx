import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, spacing } from "@/theme";

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  edges = ["top"],
  contentStyle,
  keyboard,
  footer,
  bg = colors.background,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
  footer?: ReactNode;
  bg?: string;
}) {
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: bg }]} edges={edges}>
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {body}
          {footer}
        </KeyboardAvoidingView>
      ) : (
        <>
          {body}
          {footer}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.base },
});
