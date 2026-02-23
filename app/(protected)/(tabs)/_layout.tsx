import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Bell, Home, Plus, User, Users } from "lucide-react-native";

type MenuBlurProps = {
  isDark: boolean;
};

const MenuBlur = ({ isDark }: MenuBlurProps) => {
  if (Platform.OS === "web") {
    return (
      <View
        style={[
          StyleSheet.absoluteFillObject,
          styles.glassLayer,
          {
            backgroundColor: isDark
              ? "rgba(0,0,0,0.45)"
              : "rgba(255,255,255,0.45)",
          } as any,
        ]}
      />
    );
  }

  // Native: BlurView IS the root — no wrapping View
  return (
    <BlurView
      intensity={60}
      tint={isDark ? "dark" : "light"}
      experimentalBlurMethod="dimezisBlurView"
      {...({ overlayColor: "transparent" } as any)}
      style={[StyleSheet.absoluteFillObject, styles.glassLayer]}
    />
  );
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const tabBarActiveTint = useThemeColor({}, "tabIconSelected");
  const tabBarInactiveTint = useThemeColor({}, "tabIconDefault");
  const tabBarBackground = useThemeColor({}, "tabBarBackground");
  const tabBarBorder = useThemeColor({}, "tabBarBorder");

  const toRgba = (hex: string, alpha: number) => {
    const normalized = hex.replace("#", "");
    if (!/^[A-Fa-f0-9]{6}$/.test(normalized)) return hex;

    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const glassBorder = toRgba(tabBarBorder, isDark ? 0.34 : 0.28);
  const blurOverlayColor = toRgba(tabBarBackground, isDark ? 0.08 : 0.06);

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
        lazy: false,
        headerShown: false,
        tabBarButton: HapticTab,

        tabBarActiveTintColor: tabBarActiveTint,
        tabBarInactiveTintColor: tabBarInactiveTint,

        tabBarBackground: () => <MenuBlur isDark={isDark} />,

        tabBarStyle: {
          position: "absolute",
          marginHorizontal: 12,
          bottom: Math.max(insets.bottom, 8),

          height: 72,
          paddingTop: 6,
          paddingBottom: 8,

          backgroundColor: "transparent",
          borderRadius: 28,
          borderWidth: 1.5,
          borderColor: glassBorder,
          overflow: "hidden",

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

const styles = StyleSheet.create({
  glassLayer: {
    flex: 1,
    borderRadius: 28,
    overflow: "hidden",
  },
});
