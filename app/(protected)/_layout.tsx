import { useAuth, useUser } from "@clerk/clerk-expo";
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { syncUserToSupabase } from "@/lib/actions/users";

export default function AppLayout() {
  const { isSignedIn } = useAuth();
  const { isLoaded, user } = useUser();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isLoaded || !user) {
      return;
    }

    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) {
      console.log("User sync skipped: missing primary email");
      return;
    }

    syncUserToSupabase({
      id: user.id,
      email,
      name: user.fullName ?? user.username ?? "Anonymous",
      image: user.imageUrl ?? null,
    }).catch((error) => {
      console.log("User sync error:", error);
    });
  }, [isLoaded, user]);

  if (!isSignedIn) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top}}>
      <Stack screenOptions={{ headerShown: false }} >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="post/[id]" options={{animation:"fade_from_bottom"}}/>
        <Stack.Screen name="community/[id]" options={{ animation: "slide_from_right" }} />
      </Stack>
    </View>
  );
}
