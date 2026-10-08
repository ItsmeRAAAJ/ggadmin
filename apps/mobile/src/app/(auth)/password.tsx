import { Redirect, useRouter } from "expo-router";
import { Lock, UserRound } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AuthScaffold } from "@/components/AuthScaffold";
import { Button, Text, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { ApiError, authApi, errorMessage } from "@/lib/api";
import { authFlow } from "@/lib/authFlow";
import { colors, radius, spacing } from "@/theme";

export default function PasswordScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { identifier } = authFlow.get();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  if (!identifier) return <Redirect href="/login" />;

  const onLogin = async () => {
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login(identifier, password);
      authFlow.clear();
      await signIn(res.token);
    } catch (e) {
      if (e instanceof ApiError && e.code === "INVALID_CREDENTIALS") setError("Incorrect password. Please try again.");
      else setError(errorMessage(e));
      setLoading(false);
    }
  };

  const onForgot = async () => {
    setForgotLoading(true);
    setError(null);
    try {
      const res = await authApi.requestPasswordReset(identifier);
      authFlow.patch({
        purpose: "PASSWORD_RESET",
        maskedEmail: res.maskedEmail,
        resendAt: Date.now() + res.resendAvailableInSeconds * 1000,
      });
      router.push("/otp");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <AuthScaffold title="Enter your password" subtitle="Welcome back! Sign in to continue.">
      <Pressable onPress={() => router.back()} style={styles.chip} accessibilityRole="button" accessibilityLabel="Change account">
        <View style={styles.chipIcon}>
          <UserRound size={16} color={colors.primary} />
        </View>
        <Text variant="bodyMedium" style={styles.flex} numberOfLines={1}>
          {identifier}
        </Text>
        <Text variant="smallMedium" color={colors.primary}>
          Change
        </Text>
      </Pressable>
      <TextField
        label="Password"
        icon={Lock}
        password
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (error) setError(null);
        }}
        placeholder="Your password"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={onLogin}
        autoFocus
        error={error}
        maxLength={72}
      />
      <Pressable onPress={onForgot} disabled={forgotLoading} hitSlop={8} style={styles.forgot} accessibilityRole="button">
        <Text variant="smallMedium" color={forgotLoading ? colors.textMuted : colors.primary}>
          {forgotLoading ? "Sending code…" : "Forgot password?"}
        </Text>
      </Pressable>
      <Button title="Sign in" onPress={onLogin} loading={loading} size="lg" />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.base,
  },
  chipIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  forgot: { alignSelf: "flex-end" },
});
