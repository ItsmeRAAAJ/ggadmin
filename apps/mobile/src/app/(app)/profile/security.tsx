import { KeyRound, LogOut, MonitorSmartphone, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { Button, Card, Divider, ListRow, Screen, Text, TextField, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/context/ProfileContext";
import { ApiError, authApi, errorMessage } from "@/lib/api";
import { isStrongPassword } from "@/lib/validation";
import { colors, radius, spacing } from "@/theme";

export default function SecurityScreen() {
  const { signIn, signOut } = useAuth();
  const { profile } = useProfile();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const change = async () => {
    const e: typeof errors = {};
    if (!current) e.current = "Enter your current password";
    if (!isStrongPassword(next)) e.next = "Password doesn't meet the requirements";
    else if (next === current) e.next = "New password must be different from the current one";
    if (confirm !== next) e.confirm = "Passwords don't match";
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const { token } = await authApi.changePassword(current, next);
      // Other sessions are invalidated server-side; keep this device signed in with the fresh token.
      await signIn(token);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed");
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_PASSWORD") setErrors({ current: err.message });
      else if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setErrors({ current: err.fieldErrors.currentPassword, next: err.fieldErrors.newPassword });
      } else Alert.alert("Couldn't change password", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const logoutEverywhere = () => {
    Alert.alert("Sign out of all devices?", "You'll be signed out everywhere, including this phone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out all",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            await authApi.logoutAll();
            await signOut();
          } catch (err) {
            setLoggingOut(false);
            Alert.alert("Couldn't sign out", errorMessage(err));
          }
        },
      },
    ]);
  };

  const logout = () => {
    Alert.alert("Sign out?", "You'll need your password to sign in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen edges={[]} keyboard>
      <Card padded={false}>
        <ListRow icon={ShieldCheck} iconColor={colors.accentDark} iconBg={colors.accentSoft} title="Signed in as" subtitle={profile?.email ?? "—"} />
      </Card>

      <Card style={styles.form}>
        <View style={styles.head}>
          <View style={styles.headIcon}>
            <KeyRound size={18} color={colors.primary} />
          </View>
          <Text variant="heading">Change password</Text>
        </View>
        <TextField
          label="Current password"
          password
          value={current}
          onChangeText={(v) => {
            setCurrent(v);
            if (errors.current) setErrors((x) => ({ ...x, current: undefined }));
          }}
          error={errors.current}
          autoComplete="current-password"
          textContentType="password"
        />
        <TextField
          label="New password"
          password
          value={next}
          onChangeText={(v) => {
            setNext(v);
            if (errors.next) setErrors((x) => ({ ...x, next: undefined }));
          }}
          error={errors.next}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        {next ? <PasswordChecklist password={next} /> : null}
        <TextField
          label="Confirm new password"
          password
          value={confirm}
          onChangeText={(v) => {
            setConfirm(v);
            if (errors.confirm) setErrors((x) => ({ ...x, confirm: undefined }));
          }}
          error={errors.confirm}
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={change}
          returnKeyType="done"
        />
        <Button title="Update password" onPress={change} loading={saving} disabled={!current || !next || !confirm} />
        <Text variant="small" color={colors.textMuted}>
          Changing your password signs you out on all other devices.
        </Text>
      </Card>

      <Card padded={false}>
        <ListRow
          icon={MonitorSmartphone}
          title="Sign out of all devices"
          subtitle="Use this if you signed in on a shared or lost phone"
          onPress={loggingOut ? undefined : logoutEverywhere}
          chevron={false}
        />
        <Divider inset={64} />
        <ListRow icon={LogOut} title="Sign out" destructive onPress={logout} chevron={false} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.base },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headIcon: { width: 36, height: 36, borderRadius: radius.sm + 2, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
});
