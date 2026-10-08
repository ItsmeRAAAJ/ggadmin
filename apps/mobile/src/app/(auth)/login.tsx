import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ArrowRight, AtSign } from "lucide-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AuthScaffold } from "@/components/AuthScaffold";
import { Button, Text, TextField, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { authApi, errorMessage } from "@/lib/api";
import { authFlow } from "@/lib/authFlow";
import { colors, radius, spacing } from "@/theme";

const STAFF_MESSAGE = "This app is for students. Teachers and admins, please sign in on the My GGITS web portal.";

export default function LoginScreen() {
  const router = useRouter();
  const toast = useToast();
  const { sessionEndedReason, clearSessionEndedReason } = useAuth();
  const [identifier, setIdentifier] = useState(authFlow.get().identifier);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionEndedReason) {
      toast.show(sessionEndedReason);
      clearSessionEndedReason();
    }
  }, [sessionEndedReason, clearSessionEndedReason, toast]);

  const onContinue = async () => {
    const value = identifier.trim();
    if (value.length < 3) {
      setError("Enter your enrollment number or college email.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.lookup(value.includes("@") ? value.toLowerCase() : value.toUpperCase());
      if (res.role !== "STUDENT") {
        setError(STAFF_MESSAGE);
        return;
      }
      authFlow.start(value.includes("@") ? value.toLowerCase() : value.toUpperCase());
      if (res.next === "PASSWORD") {
        router.push("/password");
      } else {
        authFlow.patch({
          purpose: "FIRST_LOGIN",
          maskedEmail: res.maskedEmail,
          resendAt: Date.now() + res.resendAvailableInSeconds * 1000,
        });
        router.push("/otp");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      back={false}
      title="Welcome to My GGITS"
      subtitle="Sign in with your enrollment number or college email to get started."
      hero={
        <View style={styles.hero}>
          <Image source={require("../../../assets/logo_withgg.png")} style={styles.logo} contentFit="contain" accessibilityLabel="My GGITS" />
        </View>
      }
      footer={
        <Text variant="small" color={colors.textMuted} align="center">
          First time here? Enter your details - we&apos;ll email you a code to activate your account.
        </Text>
      }
    >
      <TextField
        label="Enrollment number or email"
        icon={AtSign}
        value={identifier}
        onChangeText={(t) => {
          setIdentifier(t);
          if (error) setError(null);
        }}
        placeholder="e.g. 0201CS231001"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="go"
        onSubmitEditing={onContinue}
        error={error}
        maxLength={254}
      />
      <Button title="Continue" iconRight={ArrowRight} onPress={onContinue} loading={loading} size="lg" />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", marginTop: spacing.xl },
  logo: { width: 180, height: 180, borderRadius: radius.xl },
});
