import { Stack } from "expo-router";
import { ProfileProvider } from "@/context/ProfileContext";
import { colors, font } from "@/theme";

export const unstable_settings = { initialRouteName: "(tabs)" };

export default function AppLayout() {
  return (
    <ProfileProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: font.semiBold, fontSize: 17, color: colors.text },
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="about" options={{ title: "About My GGITS App" }} />
        <Stack.Screen name="profile/edit" options={{ title: "Personal details" }} />
        <Stack.Screen name="profile/resumes" options={{ title: "Resumes" }} />
        <Stack.Screen name="profile/certificates" options={{ title: "Certificates" }} />
        <Stack.Screen name="profile/projects" options={{ title: "Projects" }} />
        <Stack.Screen name="profile/achievements" options={{ title: "Achievements" }} />
        <Stack.Screen name="profile/social-links" options={{ title: "Social links" }} />
        <Stack.Screen name="profile/security" options={{ title: "Account & security" }} />
        <Stack.Screen name="assignments/index" options={{ title: "Assignments" }} />
        <Stack.Screen name="assignments/[id]" options={{ title: "Assignment" }} />
        <Stack.Screen name="deadlines" options={{ title: "Deadlines" }} />
        <Stack.Screen name="resources/index" options={{ title: "Resources" }} />
        <Stack.Screen name="resources/[subjectId]" options={{ title: "Subject" }} />
        <Stack.Screen name="resources/folder/[id]" options={{ title: "Folder" }} />
        <Stack.Screen name="peers/index" options={{ title: "Share with Peers" }} />
        <Stack.Screen name="peers/new" options={{ title: "Share a resource", animation: "slide_from_bottom" }} />
      </Stack>
    </ProfileProvider>
  );
}
