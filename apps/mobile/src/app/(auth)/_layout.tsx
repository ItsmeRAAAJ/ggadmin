import { Stack } from "expo-router";
import { colors } from "@/theme";

export const unstable_settings = { initialRouteName: "login" };

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="password" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="set-password" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
