import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Bell, Home, MessageCircle, Plus, Users } from "lucide-react-native";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? "light";
  const colors = Colors[theme];

  // Get theme colors for tab bar
  const tabBarActiveTint = useThemeColor({}, "tabIconSelected");
  const tabBarInactiveTint = useThemeColor({}, "tabIconDefault");
  const tabBarBackground = useThemeColor({}, "background");
  const tabBarBorder = useThemeColor({}, "border");

  return (
    <Tabs
      screenOptions={{
        // Preload all tab screens instead of lazy-loading on first focus
        lazy: false,
        tabBarActiveTintColor: tabBarActiveTint,
        tabBarInactiveTintColor: tabBarInactiveTint,
        tabBarStyle: {
          backgroundColor: tabBarBackground,
          borderTopColor: tabBarBorder,
          borderTopWidth: 1,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <Home size={28} color={focused ? tabBarActiveTint : tabBarInactiveTint} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ focused }) => <MessageCircle size={28} color={focused ? tabBarActiveTint : tabBarInactiveTint} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          tabBarIcon: ({ focused }) => <Plus size={28} color={focused ? tabBarActiveTint : tabBarInactiveTint} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ focused }) => <Bell size={28} color={focused ? tabBarActiveTint : tabBarInactiveTint} />,
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: "Communities",
          tabBarIcon: ({ focused }) => <Users size={28} color={focused ? tabBarActiveTint : tabBarInactiveTint} />,
        }}
      />
    </Tabs>
  );
}
