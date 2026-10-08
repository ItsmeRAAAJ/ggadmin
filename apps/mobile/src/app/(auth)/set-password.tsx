import { Redirect, useRouter } from "expo-router";
import { KeyRound, Lock } from "lucide-react-native";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";
import { AuthScaffold } from "@/components/AuthScaffold";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { Button, TextField, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { ApiError, authApi, errorMessage } from "@/lib/api";
import { authFlow } from "@/lib/authFlow";
import { isStrongPassword } from "@/lib/validation";

export default function SetPasswordScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const pending = authFlow.get().pendingToken;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  if (!pending) return <Redirect href="/login" />;
  const onboarding = pending.kind === "onboard";

  const onSubmit = async () => {
    const next: typeof errors = {};
    if (!isStrongPassword(password)) next.password = "Your password doesn't meet all the requirements yet.";
    if (confirm !== password) next.confirm = "Passwords don't match.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const res = onboarding ? await authApi.onboard(password, pending.token) : await authApi.resetPassword(password, pending.token);
      authFlow.clear();
      await signIn(res.token);
      toast.success(onboarding ? "Welcome to My GGITS! Your account is ready." : "Password updated. You're signed in.");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setErrors({ form: "This session has expired. Please start again." });
      } else if (e instanceof ApiError && e.fieldErrors["password"]) {
        setErrors({ password: e.fieldErrors["password"] });
      } else {
        setErrors({ form: errorMessage(e) });
      }
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      back={false}
      title={onboarding ? "Create your password" : "Choose a new password"}
      subtitle={
        onboarding
          ? "You'll use this with your enrollment number or email to sign in from now on."
          : "Pick a strong password you haven't used before. You'll be signed out of other devices."
      }
    >
      <TextField
        label={onboarding ? "Password" : "New password"}
        icon={Lock}
        password
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setErrors((e) => ({ ...e, password: undefined, form: undefined }));
        }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        autoFocus
        error={errors.password}
        maxLength={72}
      />
      <PasswordChecklist password={password} />
      <TextField
        ref={confirmRef}
        label="Confirm password"
        icon={KeyRound}
        password
        value={confirm}
        onChangeText={(t) => {
          setConfirm(t);
          setErrors((e) => ({ ...e, confirm: undefined, form: undefined }));
        }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        error={errors.confirm ?? errors.form}
        maxLength={72}
      />
      <Button title={onboarding ? "Activate account" : "Update password"} onPress={onSubmit} loading={loading} size="lg" />
      <Button
        title="Start over"
        variant="ghost"
        onPress={() => {
          authFlow.clear();
          router.replace("/login");
        }}
        disabled={loading}
      />
    </AuthScaffold>
  );
}
