import { Tabs } from "expo-router";
import { GraduationCap, House, UserRound, type LucideIcon } from "lucide-react-native";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, font } from "@/theme";

function icon(Icon: LucideIcon) {
  function TabIcon({ color, focused }: { color: string; focused: boolean }) {
    return <Icon size={23} color={color} strokeWidth={focused ? 2.4 : 1.9} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === "android" ? 10 : 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11, marginTop: 2 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 58 + bottom,
          paddingTop: 6,
          paddingBottom: bottom,
          elevation: 0,
        },
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.background },
        animation: "shift",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon(House) }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon(UserRound) }} />
      <Tabs.Screen name="academics" options={{ title: "Academics", tabBarIcon: icon(GraduationCap) }} />
    </Tabs>
  );
}
