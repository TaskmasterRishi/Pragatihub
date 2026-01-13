import { useAuth, useUser } from "@clerk/clerk-expo";
import {
    AppWindow,
    ChevronRight,
    Footprints,
    Gem,
    Grid,
    Languages,
    Mail,
    ShieldCheck,
    User,
    Users,
    Wallet,
    X,
} from "lucide-react-native";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColor } from "@/hooks/use-theme-color";

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
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
    Icon,
    label,
    value,
    onPress,
    showChevron = true,
    style,
  }: {
    Icon: any;
    label: string;
    value?: string;
    onPress?: () => void;
    showChevron?: boolean;
    style?: any;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center border-b py-4"
      style={[
        {
          borderBottomColor: borderColor,
        },
        style,
      ]}
    >
      <Icon size={24} color={textSecondaryColor} className="mr-4" />
      <Text
        className="flex-1 text-base font-medium"
        style={{ color: textColor }}
      >
        {label}
      </Text>
      {value && (
        <Text className="mr-2 text-base" style={{ color: textSecondaryColor }}>
          {value}
        </Text>
      )}
      {showChevron && <ChevronRight size={20} color={textSecondaryColor} />}
    </TouchableOpacity>
  );

  return (
    <View className="flex-1" style={{ backgroundColor }}>
      {/* Header */}
      <View
        className="flex-row items-center justify-between border-b rounded-b-xl px-5 pb-5"
        style={{
          paddingTop: 15,
          backgroundColor: cardColor,
          borderBottomColor: borderColor,
        }}
      >
        <Text className="text-xl font-bold" style={{ color: textColor }}>
          Settings
        </Text>
        <TouchableOpacity
          onPress={onClose}
          className="h-10 w-10 items-center justify-center rounded-xl"
          style={{
            backgroundColor: backgroundColor,
          }}
        >
          <X size={24} color={textColor} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Account Section */}
        <View
          className="mb-6 rounded-2xl p-4"
          style={{
            backgroundColor: cardColor,
          }}
        >
          <SettingItem
            Icon={Mail}
            label="Email"
            value={user?.primaryEmailAddress?.emailAddress}
            showChevron={false}
          />
          <SettingItem
            Icon={User}
            label="Username"
            value={
              user?.username ||
              (user?.firstName
                ? `${user.firstName} ${user.lastName || ""}`
                : "User")
            }
          />
          <SettingItem Icon={Footprints} label="Step data source" />
          <SettingItem Icon={Languages} label="Language" value="English" />
          <SettingItem
            Icon={ShieldCheck}
            label="Privacy"
            style={{ borderBottomWidth: 0 }}
          />
        </View>

        {/* Premium Status */}
        <View
          className="mb-6 flex-row items-center justify-between rounded-2xl p-4"
          style={{
            backgroundColor: cardColor,
          }}
        >
          <View className="flex-row items-center">
            <Gem size={24} color={primaryColor} className="mr-3" />
            <Text
              className="text-base font-semibold"
              style={{ color: textColor }}
            >
              Premium Status
            </Text>
          </View>
          <View className="flex-row items-center">
            <Text className="mr-1 text-sm font-medium text-red-500">
              Inactive
            </Text>
            <ChevronRight size={20} color={textSecondaryColor} />
          </View>
        </View>

        {/* Refer a friend banner */}
        <TouchableOpacity
          className="relative mb-6 overflow-hidden rounded-2xl p-5"
          style={{
            backgroundColor: "#ff6b00", // Orange-ish color from design
          }}
        >
          {/* Decorative circles */}
          <View className="absolute -right-5 -top-5 h-[100px] w-[100px] rounded-full border-[20px] border-white/10" />

          <Text className="mb-2 text-lg font-bold text-white">
            Refer a friend
          </Text>
          <View className="self-start flex-row items-center rounded-2xl bg-white/20 px-3 py-1.5">
            <Wallet size={16} color="white" className="mr-1.5" />
            <Text className="font-bold text-white">50 /referral</Text>
          </View>
          {/* Panda illustration placeholder */}
          <View className="absolute bottom-0 right-5 h-20 w-20 justify-end">
            <Users size={80} color="white" />
          </View>
        </TouchableOpacity>

        {/* App Settings */}
        <View
          className="mb-6 rounded-2xl p-4"
          style={{
            backgroundColor: cardColor,
          }}
        >
          <SettingItem Icon={AppWindow} label="App Icon" />
          <SettingItem
            Icon={Grid}
            label="Widget"
            style={{ borderBottomWidth: 0 }}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={() => signOut()}
          className="mb-10 items-center rounded-2xl p-4"
          style={{
            backgroundColor: cardColor,
          }}
        >
          <Text className="text-base font-semibold text-red-500">Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
