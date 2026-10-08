import { Redirect, useRouter } from "expo-router";
import { MailCheck } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AuthScaffold } from "@/components/AuthScaffold";
import { Button, OtpInput, Text, useToast } from "@/components/ui";
import { ApiError, authApi, errorMessage } from "@/lib/api";
import { authFlow } from "@/lib/authFlow";
import { OTP_LENGTH } from "@/lib/config";
import { colors, radius, spacing } from "@/theme";

function secondsLeft(at?: number) {
  return at ? Math.max(0, Math.ceil((at - Date.now()) / 1000)) : 0;
}

export default function OtpScreen() {
  const router = useRouter();
  const toast = useToast();
  const flow = authFlow.get();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(() => secondsLeft(flow.resendAt));
  const lastSubmitted = useRef<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setResendIn(secondsLeft(authFlow.get().resendAt)), 1000);
    return () => clearInterval(t);
  }, []);

  const verify = useCallback(
    async (value: string) => {
      const { identifier, purpose } = authFlow.get();
      if (!purpose || value.length !== OTP_LENGTH || lastSubmitted.current === value) return;
      lastSubmitted.current = value;
      setVerifying(true);
      setError(null);
      try {
        const res = await authApi.verifyOtp(identifier, value, purpose);
        authFlow.patch({
          pendingToken: res.type === "ONBOARDING" ? { kind: "onboard", token: res.onboardingToken } : { kind: "reset", token: res.resetToken },
        });
        router.replace("/set-password");
      } catch (e) {
        setError(errorMessage(e));
        setCode("");
        lastSubmitted.current = null;
        if (e instanceof ApiError && e.code === "INVALID_STATE") {
          toast.error(e.message);
          router.replace("/login");
        }
      } finally {
        setVerifying(false);
      }
    },
    [router, toast]
  );

  if (!flow.identifier || !flow.purpose) return <Redirect href="/login" />;

  const onResend = async () => {
    setResending(true);
    setError(null);
    try {
      const res = await authApi.resendOtp(flow.identifier, flow.purpose!);
      authFlow.patch({ maskedEmail: res.maskedEmail, resendAt: Date.now() + res.resendAvailableInSeconds * 1000 });
      setResendIn(res.resendAvailableInSeconds);
      setCode("");
      toast.success("A new code has been sent.");
    } catch (e) {
      if (e instanceof ApiError && e.code === "OTP_COOLDOWN") {
        const wait = Number(e.details?.["resendAvailableInSeconds"] ?? 60);
        authFlow.patch({ resendAt: Date.now() + wait * 1000 });
        setResendIn(wait);
      }
      setError(errorMessage(e));
    } finally {
      setResending(false);
    }
  };

  const isReset = flow.purpose === "PASSWORD_RESET";

  return (
    <AuthScaffold
      title={isReset ? "Reset your password" : "Verify your email"}
      subtitle={
        <Text color={colors.textSecondary}>
          Enter the 6-digit code we sent to <Text variant="bodyMedium">{flow.maskedEmail ?? "your email"}</Text>. It expires in 10 minutes.
        </Text>
      }
      hero={
        <View style={styles.iconWrap}>
          <MailCheck size={30} color={colors.primary} />
        </View>
      }
    >
      <OtpInput
        value={code}
        onChange={(v) => {
          setCode(v);
          if (error) setError(null);
          if (v.length === OTP_LENGTH) void verify(v);
        }}
        error={!!error}
        editable={!verifying}
      />
      {error ? (
        <Text variant="small" color={colors.danger} align="center">
          {error}
        </Text>
      ) : null}
      <Button title="Verify" onPress={() => verify(code)} loading={verifying} disabled={code.length !== OTP_LENGTH} size="lg" />
      <View style={styles.resendRow}>
        <Text variant="small" color={colors.textSecondary}>
          Didn&apos;t get the code? Check spam, or
        </Text>
        {resendIn > 0 ? (
          <Text variant="smallMedium" color={colors.textMuted}>
            resend in {resendIn}s
          </Text>
        ) : (
          <Pressable onPress={onResend} disabled={resending} hitSlop={8} accessibilityRole="button">
            <Text variant="smallMedium" color={resending ? colors.textMuted : colors.primary}>
              {resending ? "sending…" : "resend code"}
            </Text>
          </Pressable>
        )}
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  resendRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4 },
});
