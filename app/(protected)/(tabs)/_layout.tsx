import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Bell, Home, Plus, User, Users } from "lucide-react-native";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  const tabBarActiveTint = useThemeColor({}, "tabIconSelected");
  const tabBarInactiveTint = useThemeColor({}, "tabIconDefault");
  const tabBarBackground = useThemeColor({}, "card");
  const borderColor = useThemeColor({}, "border");

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Tabs
        screenOptions={{
          lazy: false,
          headerShown: false,
          tabBarButton: HapticTab,

          tabBarActiveTintColor: tabBarActiveTint,
          tabBarInactiveTintColor: tabBarInactiveTint,

          tabBarStyle: {
            position: "absolute",

            // Floating spacing
            marginLeft: 16,
            marginRight: 16,
            bottom: insets.bottom,

            height: 64,

            backgroundColor: tabBarBackground,
            borderRadius: 24,
            borderTopWidth: 0,
            borderColor,

            // iOS shadow
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },

            // Android elevation
            elevation: 18,
          },

          tabBarItemStyle: {
            paddingVertical: 6,
          },

          tabBarLabelStyle: {
            fontSize: 11,
            marginBottom: 4,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ focused }) => (
              <Home
                size={26}
                color={focused ? tabBarActiveTint : tabBarInactiveTint}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="create"
          options={{
            title: "Create",
            tabBarIcon: ({ focused }) => (
              <Plus
                size={30}
                color={focused ? tabBarActiveTint : tabBarInactiveTint}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="inbox"
          options={{
            title: "Inbox",
            tabBarIcon: ({ focused }) => (
              <Bell
                size={26}
                color={focused ? tabBarActiveTint : tabBarInactiveTint}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="communities"
          options={{
            title: "Communities",
            tabBarIcon: ({ focused }) => (
              <Users
                size={26}
                color={focused ? tabBarActiveTint : tabBarInactiveTint}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ focused }) => (
              <User
                size={26}
                color={focused ? tabBarActiveTint : tabBarInactiveTint}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
