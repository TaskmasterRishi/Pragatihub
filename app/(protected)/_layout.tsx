import { useThemeColor } from "@/hooks/use-theme-color";
import { setSupabaseAccessTokenProvider } from "@/lib/Supabase";
import { communityPresenceManager } from "@/lib/realtime/community-presence";
import { syncUserToSupabase } from "@/lib/actions/users";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth, useUser } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import { BlurView } from "expo-blur";
import { Redirect, Stack, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  InteractionManager,
  Platform,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AppLayout() {
  const { isSignedIn, getToken } = useAuth();
  const { isLoaded, user } = useUser();
  const router = useRouter();
  const notificationListenerRef = useRef<any>(null);
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
    if (!isLoaded || !isSignedIn) {
      setSupabaseAccessTokenProvider(null);
      return;
    }

    const template = process.env.EXPO_PUBLIC_CLERK_SUPABASE_TEMPLATE ?? "supabase";
    setSupabaseAccessTokenProvider(async () => {
      const token = await getToken({ template });
      return token ?? null;
    });

    return () => {
      setSupabaseAccessTokenProvider(null);
    };
  }, [getToken, isLoaded, isSignedIn]);

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

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;
    communityPresenceManager.start(user.id);
    return () => {
      communityPresenceManager.stop();
    };
  }, [isLoaded, isSignedIn, user?.id]);

  useEffect(() => {
    if (Platform.OS === "web" || !isLoaded || !isSignedIn || !user?.id) return;
    const isExpoGo =
      Constants.executionEnvironment === "storeClient" ||
      Constants.appOwnership === "expo";
    if (isExpoGo) return;

    let notificationsModule: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      notificationsModule = require("expo-notifications");
    } catch {
      notificationsModule = null;
    }
    if (!notificationsModule) return;

    const Notifications = notificationsModule;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    const registerPush = async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("inbox-updates", {
            name: "Inbox Updates",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 200, 250],
            lightColor: "#0A66E8",
            lockscreenVisibility:
              Notifications.AndroidNotificationVisibility.PUBLIC,
            showBadge: true,
          });
        }

        const existing = await Notifications.getPermissionsAsync();
        let finalStatus = existing.status;
        if (finalStatus !== "granted") {
          const requested = await Notifications.requestPermissionsAsync();
          finalStatus = requested.status;
        }
        if (finalStatus !== "granted") return;

        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          Constants?.easConfig?.projectId;
        const token = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        await AsyncStorage.setItem(
          `pragatihub.push.expoToken.${user.id}`,
          token.data ?? "",
        );
      } catch {
        // Keep app usable even when push registration fails.
      }
    };

    notificationListenerRef.current =
      Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response?.notification?.request?.content?.data;
        const path = data?.path;
        if (typeof path === "string") {
          router.push(path as never);
        }
      });

    void registerPush();

    return () => {
      if (notificationListenerRef.current) {
        Notifications.removeNotificationSubscription(
          notificationListenerRef.current,
        );
      }
      notificationListenerRef.current = null;
    };
  }, [isLoaded, isSignedIn, router, user?.id]);

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
        <Stack.Screen
          name="community/edit/[id]"
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
