import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React from "react";
import {
  Animated,
  Easing,
  InteractionManager,
  Platform,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTabBarVisibility } from "@/utils/tabBarVisibility";

import { HapticTab } from "@/components/haptic-tab";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  Bell,
  Home,
  MessageCircle,
  Plus,
  User,
  Users,
} from "lucide-react-native";

const TAB_BAR_RADIUS = 28;
const HIDE_SHOW_EASING = Easing.bezier(0.22, 0.61, 0.36, 1);

export default function TabLayout() {
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

  const tabBarActiveTint = useThemeColor({}, "tabIconSelected");
  const tabBarInactiveTint = useThemeColor({}, "tabIconDefault");
  const tabBarBackgroundColor = useThemeColor(
    {
      light: "rgba(255, 255, 255, 0.68)",
      dark: "rgba(39, 39, 42, 0.7)",
    },
    "tabBarBackground",
  );
  const tabBarNativeOverlayColor = useThemeColor(
    {
      light: "rgba(255, 255, 255, 0.12)",
      dark: "rgba(39, 39, 42, 0.18)",
    },
    "tabBarBackground",
  );
  const tabBarBorder = useThemeColor(
    {
      light: "rgba(148, 163, 184, 0.35)",
      dark: "rgba(228, 228, 231, 0.2)",
    },
    "tabBarBorder",
  );

  const visible = useTabBarVisibility();
  const transY = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    transY.stopAnimation();
    opacity.stopAnimation();
    Animated.parallel([
      Animated.timing(transY, {
        toValue: visible ? 0 : 140,
        duration: visible ? 260 : 220,
        easing: HIDE_SHOW_EASING,
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0.9,
        duration: visible ? 240 : 200,
        easing: HIDE_SHOW_EASING,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]).start();
  }, [opacity, transY, visible]);

  const renderIcon = (
    Icon: React.ComponentType<{ size?: number; color?: string }>,
    focused: boolean,
    size = 24,
  ) => (
    <View
      style={{
        minWidth: 42,
        height: 30,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? `${tabBarActiveTint}22` : "transparent",
        borderWidth: focused ? 1 : 0,
        borderColor: focused ? `${tabBarActiveTint}44` : "transparent",
      }}
    >
      <Icon
        size={size}
        color={focused ? tabBarActiveTint : tabBarInactiveTint}
      />
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        lazy: true,
        headerShown: false,
        freezeOnBlur: true,
        tabBarButton: HapticTab,

        tabBarActiveTintColor: tabBarActiveTint,
        tabBarInactiveTintColor: tabBarInactiveTint,
        tabBarBackground:
          Platform.OS === "web"
            ? undefined
            : () => (
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    { borderRadius: TAB_BAR_RADIUS, overflow: "hidden" },
                  ]}
                >
                  {androidBlurReady ? (
                    <BlurView
                      tint={
                        isDark ? "systemMaterialDark" : "systemMaterialLight"
                      }
                      intensity={70}
                      experimentalBlurMethod={
                        Platform.OS === "android"
                          ? "dimezisBlurView"
                          : undefined
                      }
                      style={StyleSheet.absoluteFillObject}
                    />
                  ) : null}
                  <View
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tabBarNativeOverlayColor },
                    ]}
                  />
                </View>
              ),

        tabBarStyle: {
          position: "absolute",
          opacity,
          transform: [{ translateY: transY }],
          marginHorizontal: 12,
          bottom: Math.max(insets.bottom, 8),

          height: 72,
          paddingTop: 6,
          paddingBottom: 8,

          backgroundColor:
            Platform.OS === "web" ? tabBarBackgroundColor : "transparent",
          borderRadius: TAB_BAR_RADIUS,
          borderWidth: 1.5,
          borderColor: tabBarBorder,
          overflow: "hidden",
          ...(Platform.OS === "web"
            ? ({
                backdropFilter: "saturate(140%) blur(18px)",
                WebkitBackdropFilter: "saturate(140%) blur(18px)",
              } as any)
            : {}),

          shadowColor: "#000",
          shadowOpacity: isDark ? 0.35 : 0.18,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },

          elevation: 16,
        },

        tabBarItemStyle: {
          paddingVertical: 4,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => renderIcon(Home, focused, 24),
        }}
      />

      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ focused }) => renderIcon(Bell, focused, 24),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ focused }) => renderIcon(MessageCircle, focused, 24),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          tabBarIcon: ({ focused }) => renderIcon(Plus, focused, 26),
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: "Communities",
          tabBarIcon: ({ focused }) => renderIcon(Users, focused, 24),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => renderIcon(User, focused, 24),
        }}
      />
    </Tabs>
  );
}
