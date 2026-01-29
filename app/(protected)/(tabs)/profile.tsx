import { useUser } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  FileText,
  MessageSquare,
  Settings as SettingsIcon,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Settings from "@/components/Settings";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Pen } from "lucide-react-native";

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [updatingImage, setUpdatingImage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const onSelectImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setUpdatingImage(true);
        const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;

        await user?.setProfileImage({
          file: base64,
        });

        // No need to manually refresh, Clerk generic hook should pick it up or we rely on re-render
      }
    } catch (err) {
      console.error("Error updating image:", err);
      alert("Failed to update profile image");
    } finally {
      setUpdatingImage(false);
    }
  };

  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const textSecondaryColor = useThemeColor({}, "textSecondary");
  const primaryColor = useThemeColor({}, "primary");
  const primaryForeground = useThemeColor({}, "primaryForeground");

  type ProfileTab = "posts" | "comments";
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");

  // Mock counts (Reddit-style)
  const karmaCount = "0";
  const postCount = "0";

  return (
    <View className="flex-1" style={{ backgroundColor }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        className="flex-1"
      >
        {/* Custom Header Area */}
        <View
          style={{
            paddingTop: 10,
            paddingBottom: 30,
            backgroundColor: primaryColor,
          }}
          className="rounded-[25px] px-5"
        >
          {/* Top Navigation Bar */}
          <View className="mb-2 pt-3 flex-row items-center justify-between">
            <TouchableOpacity
              className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20"
              onPress={() => router.back()}
            >
              <ChevronLeft size={24} color={primaryForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowSettings(true)}
              className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20"
            >
              <SettingsIcon size={24} color={primaryForeground} />
            </TouchableOpacity>
          </View>

          {/* Profile Details - avatar centered, then name & stats */}

          <View
            className=" w-full flex-row-reverse items-center justify-between mx-auto px-2"
          >
            <View className="flex-row gap-6">
              <View className="items-center">
                <Text
                  className="text-base font-bold"
                  style={{ color: primaryForeground }}
                >
                  {karmaCount}
                </Text>
                <Text className="text-xs text-white/70">Upvote</Text>
              </View>
              <View className="items-center">
                <Text
                  className="text-base font-bold"
                  style={{ color: primaryForeground }}
                >
                  {postCount}
                </Text>
                <Text className="text-xs text-white/70">Posts</Text>
              </View>
            </View>
            <View className="items-start">
              <Text
                className="text-left text-xl font-bold"
                style={{ color: primaryForeground }}
              >
                {user?.fullName || user?.username || "User"}
              </Text>
              <Text className="mt-1 text-left text-sm text-white/80">
                {user?.username || "username"}
              </Text>
            </View>
          </View>
          <View
            className="items-center"
            style={{ marginBottom: -64 }}
          >
            <View
              className="relative rounded-full p-2"
              style={{
                backgroundColor: backgroundColor,
                borderWidth: 4,
                borderColor: backgroundColor,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Image
                source={{ uri: user?.imageUrl }}
                className="h-36 w-36 rounded-full bg-gray-300"
                style={{
                  opacity: updatingImage ? 0.5 : 1,
                }}
              />
              {updatingImage && (
                <View className="absolute inset-0 items-center justify-center rounded-full">
                  <ActivityIndicator size="small" color="#ffffff" />
                </View>
              )}
              <TouchableOpacity
                onPress={onSelectImage}
                disabled={updatingImage}
                className="absolute -bottom-0.5 -right-0.5 h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
                style={{
                  elevation: 6,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                }}
              >
                <Pen size={18} color={primaryColor} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View className="px-4 pt-16">
          {/* Tabs - Posts | Comments */}
          <View
            className="mt-2 flex-row rounded-2xl px-1 py-1"
            style={{ backgroundColor: cardColor }}
          >
            <TouchableOpacity
              onPress={() => setActiveTab("posts")}
              className="flex-1 flex-row items-center justify-center rounded-xl py-3 gap-2"
              style={{
                backgroundColor:
                  activeTab === "posts" ? primaryColor : "transparent",
              }}
            >
              <FileText
                size={18}
                color={
                  activeTab === "posts" ? primaryForeground : textSecondaryColor
                }
                className="mr-2"
              />
              <Text
                className="font-semibold"
                style={{
                  color:
                    activeTab === "posts"
                      ? primaryForeground
                      : textSecondaryColor,
                }}
              >
                Posts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab("comments")}
              className="flex-1 flex-row items-center justify-center rounded-xl py-3 gap-2"
              style={{
                backgroundColor:
                  activeTab === "comments" ? primaryColor : "transparent",
              }}
            >
              <MessageSquare
                size={18}
                color={
                  activeTab === "comments"
                    ? primaryForeground
                    : textSecondaryColor
                }
                className="mr-2"
              />
              <Text
                className="font-semibold"
                style={{
                  color:
                    activeTab === "comments"
                      ? primaryForeground
                      : textSecondaryColor,
                }}
              >
                Comments
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content area */}
          <View
            className="mt-4 flex-1 rounded-2xl p-6"
            style={{ backgroundColor: cardColor, minHeight: 200 }}
          >
            {activeTab === "posts" ? (
              <View className="items-center justify-center py-8">
                <FileText
                  size={48}
                  color={textSecondaryColor}
                  className="opacity-50"
                />
                <Text
                  className="text-center font-medium"
                  style={{ color: textColor }}
                >
                  No posts yet
                </Text>
                <Text
                  className="mt-1 text-center text-sm"
                  style={{ color: textSecondaryColor }}
                >
                  Your posts will appear here
                </Text>
              </View>
            ) : (
              <View className="items-center justify-center py-8">
                <MessageSquare
                  size={48}
                  color={textSecondaryColor}
                  className=" opacity-50"
                />
                <Text
                  className="text-center font-medium"
                  style={{ color: textColor }}
                >
                  No comments yet
                </Text>
                <Text
                  className="mt-1 text-center text-sm"
                  style={{ color: textSecondaryColor }}
                >
                  Your comments will appear here
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showSettings}
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <Settings onClose={() => setShowSettings(false)} />
      </Modal>
    </View>
  );
}
