import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColor } from "@/hooks/use-theme-color";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useAuth();

  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const textSecondaryColor = useThemeColor({}, "textSecondary");
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "border");

  // Mock switch states
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  const SettingItem = ({
    icon,
    label,
    value,
    onPress,
    showChevron = true,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
    onPress?: () => void;
    showChevron?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: borderColor,
      }}
    >
      <Ionicons
        name={icon}
        size={24}
        color={textSecondaryColor}
        style={{ marginRight: 16 }}
      />
      <Text
        style={{ flex: 1, fontSize: 16, color: textColor, fontWeight: "500" }}
      >
        {label}
      </Text>
      {value && (
        <Text
          style={{ fontSize: 16, color: textSecondaryColor, marginRight: 8 }}
        >
          {value}
        </Text>
      )}
      {showChevron && (
        <Ionicons name="chevron-forward" size={20} color={textSecondaryColor} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: 20,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: cardColor,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: backgroundColor,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 16,
          }}
        >
          <Ionicons name="chevron-back" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "700", color: textColor }}>
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Account Section */}
        <View
          style={{
            backgroundColor: cardColor,
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <SettingItem
            icon="mail-outline"
            label="Email"
            value={user?.primaryEmailAddress?.emailAddress}
            showChevron={false}
          />
          <SettingItem
            icon="person-outline"
            label="Username"
            value={
              user?.username ||
              (user?.firstName
                ? `${user.firstName} ${user.lastName || ""}`
                : "User")
            }
          />
          <SettingItem icon="footsteps-outline" label="Step data source" />
          <SettingItem
            icon="language-outline"
            label="Language"
            value="English"
          />
          <SettingItem
            icon="shield-checkmark-outline"
            label="Privacy"
            style={{ borderBottomWidth: 0 }}
          />
        </View>

        {/* Premium Status */}
        <View
          style={{
            backgroundColor: cardColor,
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons
              name="diamond-outline"
              size={24}
              color={primaryColor}
              style={{ marginRight: 12 }}
            />
            <Text style={{ fontSize: 16, fontWeight: "600", color: textColor }}>
              Premium Status
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={{
                fontSize: 14,
                color: "#ef4444",
                marginRight: 4,
                fontWeight: "500",
              }}
            >
              Inactive
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={textSecondaryColor}
            />
          </View>
        </View>

        {/* Refer a friend banner */}
        <TouchableOpacity
          style={{
            backgroundColor: "#ff6b00", // Orange-ish color from design
            borderRadius: 20,
            padding: 20,
            marginBottom: 24,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Decorative circles */}
          <View
            style={{
              position: "absolute",
              right: -20,
              top: -20,
              width: 100,
              height: 100,
              borderRadius: 50,
              borderWidth: 20,
              borderColor: "rgba(255,255,255,0.1)",
            }}
          />

          <Text
            style={{
              color: "white",
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 8,
            }}
          >
            Refer a friend
          </Text>
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons
              name="wallet-outline"
              size={16}
              color="white"
              style={{ marginRight: 6 }}
            />
            <Text style={{ color: "white", fontWeight: "bold" }}>
              50 /referral
            </Text>
          </View>
          {/* Panda illustration placeholder */}
          <View
            style={{
              position: "absolute",
              right: 20,
              bottom: 0,
              height: 80,
              width: 80,
              justifyContent: "flex-end",
            }}
          >
            <Ionicons name="people-circle" size={80} color="white" />
          </View>
        </TouchableOpacity>

        {/* App Settings */}
        <View
          style={{
            backgroundColor: cardColor,
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <SettingItem icon="apps-outline" label="App Icon" />
          <SettingItem
            icon="grid-outline"
            label="Widget"
            style={{ borderBottomWidth: 0 }}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={() => signOut()}
          style={{
            backgroundColor: cardColor,
            borderRadius: 16,
            padding: 16,
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          <Text style={{ color: "#ef4444", fontSize: 16, fontWeight: "600" }}>
            Log Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
