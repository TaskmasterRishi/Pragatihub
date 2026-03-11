import { useThemeColor } from "@/hooks/use-theme-color";
import { syncUserToSupabase } from "@/lib/actions/users";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { BlurView } from "expo-blur";
import { Redirect, Stack } from "expo-router";
import React, { useEffect } from "react";
import {
  InteractionManager,
  Platform,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AppLayout() {
  const { isSignedIn } = useAuth();
  const { isLoaded, user } = useUser();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [androidBlurReady, setAndroidBlurReady] = React.useState(
    Platform.OS !== "android",
  );

  React.useEffect(() => {
    if (Platform.OS !== "android") return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        setAndroidBlurReady(true);
      }, 320);
    });

    return () => {
      interactionTask.cancel();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const appBackgroundColor = useThemeColor(
    {
      light: "rgba(255, 255, 255, 0.68)",
      dark: "rgba(39, 39, 42, 0.7)",
    },
    "tabBarBackground",
  );
  const appNativeOverlayColor = useThemeColor(
    {
      light: "rgba(255, 255, 255, 0.12)",
      dark: "rgba(39, 39, 42, 0.18)",
    },
    "tabBarBackground",
  );

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
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor:
            Platform.OS === "web" ? appBackgroundColor : "transparent",
          ...(Platform.OS === "web"
            ? ({
                backdropFilter: "saturate(140%) blur(18px)",
                WebkitBackdropFilter: "saturate(140%) blur(18px)",
              } as any)
            : {}),
        },
      ]}
    >
      {Platform.OS !== "web" ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          {androidBlurReady ? (
            <BlurView
              tint={isDark ? "systemMaterialDark" : "systemMaterialLight"}
              intensity={70}
              experimentalBlurMethod={
                Platform.OS === "android" ? "dimezisBlurView" : undefined
              }
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: appNativeOverlayColor },
            ]}
          />
        </View>
      ) : null}

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="post/[id]"
          options={{ animation: "fade_from_bottom" }}
        />
        <Stack.Screen
          name="community/[id]"
          options={{ animation: "slide_from_right" }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
