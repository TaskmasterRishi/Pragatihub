import { useAuth, useUser } from "@clerk/clerk-expo";
import {
    AppWindow,
    ChevronRight,
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
import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";

import { useThemeColor } from "@/hooks/use-theme-color";
import { createGroup } from "@/lib/actions/groups";

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
  const inputBg = useThemeColor({}, "input");
  const placeholderColor = useThemeColor({}, "placeholder");

  // Mock switch states
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [communityName, setCommunityName] = useState("");
  const [communityImage, setCommunityImage] = useState<string | null>(null);
  const [isCreatingCommunity, setIsCreatingCommunity] = useState(false);
  const [createCommunityError, setCreateCommunityError] = useState<string | null>(
    null,
  );

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

        {/* Community */}
        <View
          className="mb-6 rounded-2xl p-4"
          style={{
            backgroundColor: cardColor,
          }}
        >
          <SettingItem
            Icon={Users}
            label="Create Community"
            onPress={() => setShowCreateCommunity(true)}
            showChevron={false}
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

      <Modal
        visible={showCreateCommunity}
        animationType="slide"
        onRequestClose={() => setShowCreateCommunity(false)}
        transparent
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: cardColor,
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor,
            }}
          >
            <Text style={{ color: textColor, fontSize: 18, fontWeight: "700" }}>
              Create Community
            </Text>
            <Text
              style={{
                color: textSecondaryColor,
                fontSize: 13,
                marginTop: 6,
                marginBottom: 16,
              }}
            >
              Fill the details to create a new community.
            </Text>

            <Text style={{ color: textSecondaryColor, marginBottom: 6 }}>
              Name (required)
            </Text>
            <TextInput
              value={communityName}
              onChangeText={setCommunityName}
              placeholder="Community name"
              placeholderTextColor={placeholderColor}
              style={{
                backgroundColor: inputBg,
                color: textColor,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 12,
              }}
            />

            <Text style={{ color: textSecondaryColor, marginBottom: 6 }}>
              Image (optional)
            </Text>
            <TouchableOpacity
              onPress={async () => {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [1, 1],
                  quality: 0.7,
                });

                if (!result.canceled) {
                  setCommunityImage(result.assets[0].uri ?? null);
                }
              }}
              className="items-center rounded-xl py-3"
              style={{ backgroundColor: inputBg, marginBottom: 12 }}
            >
              <Text style={{ color: textColor, fontWeight: "600" }}>
                {communityImage ? "Change Image" : "Pick Image"}
              </Text>
            </TouchableOpacity>
            {communityImage && (
              <View style={{ alignItems: "center", marginBottom: 12 }}>
                <Image
                  source={{ uri: communityImage }}
                  style={{ width: 96, height: 96, borderRadius: 48 }}
                />
              </View>
            )}

            {createCommunityError && (
              <Text style={{ color: "tomato", marginBottom: 12 }}>
                {createCommunityError}
              </Text>
            )}

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateCommunity(false);
                  setCreateCommunityError(null);
                }}
                className="flex-1 items-center rounded-xl py-3"
                style={{ backgroundColor: backgroundColor }}
              >
                <Text style={{ color: textColor, fontWeight: "600" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!communityName.trim()) {
                    setCreateCommunityError("Name is required.");
                    return;
                  }

                  setIsCreatingCommunity(true);
                  setCreateCommunityError(null);

                  const { error } = await createGroup({
                    name: communityName.trim(),
                    image: communityImage,
                  });

                  if (error) {
                    setCreateCommunityError(
                      error.message ?? "Failed to create community.",
                    );
                    setIsCreatingCommunity(false);
                    return;
                  }

                  setIsCreatingCommunity(false);
                  setCommunityName("");
                  setCommunityImage(null);
                  setShowCreateCommunity(false);
                }}
                disabled={isCreatingCommunity}
                className="flex-1 items-center rounded-xl py-3"
                style={{ backgroundColor: primaryColor }}
              >
                <Text style={{ color: "white", fontWeight: "600" }}>
                  {isCreatingCommunity ? "Creating..." : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
