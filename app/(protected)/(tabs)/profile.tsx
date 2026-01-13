import { useUser } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import { Link, useRouter } from "expo-router";
import {
  ChevronLeft,
  Footprints,
  Plus,
  Settings as SettingsIcon,
  Star,
  Trophy,
  Zap,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColor } from "@/hooks/use-theme-color";
import { Pen } from "lucide-react-native";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [updatingImage, setUpdatingImage] = useState(false);

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

  const StatCard = ({
    Icon,
    value,
    label,
    iconColor,
  }: {
    Icon: any;
    value: string;
    label: string;
    iconColor: string;
  }) => (
    <View
      className="mb-4 rounded-3xl p-4"
      style={{
        width: (width - 48) / 2,
        backgroundColor: cardColor,
      }}
    >
      <View
        className="mb-3 h-10 w-10 items-center justify-center rounded-full"
        style={{
          backgroundColor: `${iconColor}20`, // 20% opacity
        }}
      >
        <Icon size={20} color={iconColor} />
      </View>
      <Text
        className="mb-1 text-2xl font-extrabold"
        style={{
          color: textColor,
        }}
      >
        {value}
      </Text>
      <Text
        className="text-xs font-medium"
        style={{ color: textSecondaryColor }}
      >
        {label}
      </Text>
    </View>
  );

  const WeeklyChart = () => {
    const data = [30, 45, 20, 60, 35, 15, 30]; // Mock data
    const chartHeight = 120;

    return (
      <View
        className="mb-24 rounded-3xl p-5"
        style={{
          backgroundColor: cardColor,
        }}
      >
        <View className="mb-5 flex-row items-center">
          <Text
            className="mr-2 text-lg font-bold"
            style={{
              color: textColor,
            }}
          >
            Weekly XP
          </Text>
          <Text className="text-lg font-bold" style={{ color: textColor }}>
            30
          </Text>
          <Zap size={16} color="#fbbf24" fill="#fbbf24" className="ml-1" />
        </View>

        <View
          style={{
            height: chartHeight,
          }}
          className="flex-row items-end justify-between"
        >
          <View className="h-full justify-between py-0">
            <Text className="text-xs" style={{ color: textSecondaryColor }}>
              30
            </Text>
            <Text className="text-xs" style={{ color: textSecondaryColor }}>
              25
            </Text>
            <Text className="text-xs" style={{ color: textSecondaryColor }}>
              20
            </Text>
            <Text className="text-xs" style={{ color: textSecondaryColor }}>
              15
            </Text>
          </View>

          {data.map((val, idx) => {
            const height = (val / 60) * 100; // scaling based on max 60 for better visual
            const isToday = idx === 1; // Mocking "Tuesday" (index 1) as "Today" highlighted

            return (
              <View key={idx} className="w-[10%] items-center">
                <View
                  style={{
                    height: `${height}%`,
                    backgroundColor: isToday ? "#f97316" : "#ffe4bc", // Orange for highlighted
                  }}
                  className="w-full rounded-t-lg"
                />
              </View>
            );
          })}
        </View>
      </View>
    );
  };

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
          <View className="mb-6 pt-3 flex-row items-center justify-between">
            <TouchableOpacity
              className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20"
              onPress={() => router.back()}
            >
              <ChevronLeft size={24} color={primaryForeground} />
            </TouchableOpacity>

            <Link href="/settings" asChild>
              <TouchableOpacity className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                <SettingsIcon size={24} color={primaryForeground} />
              </TouchableOpacity>
            </Link>
          </View>

          {/* Profile Details */}
          <View className="mb-5 items-center">
            <View className="relative mb-3 rounded-full bg-white/20 p-1">
              <Image
                source={{ uri: user?.imageUrl }}
                className="h-[90px] w-[90px] rounded-full bg-gray-300"
                style={{
                  opacity: updatingImage ? 0.5 : 1,
                }}
              />
              {updatingImage && (
                <View className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center">
                  <ActivityIndicator size="small" color="#ffffff" />
                </View>
              )}
              <TouchableOpacity
                onPress={onSelectImage}
                disabled={updatingImage}
                className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm"
                style={{
                  elevation: 4,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                }}
              >
                <Pen size={18} color={primaryColor} />
              </TouchableOpacity>
            </View>

            <View className="w-full flex-row items-center justify-between px-2.5">
              <View className="flex-1">
                <Text
                  className="mb-1 text-2xl font-bold"
                  style={{
                    color: primaryForeground,
                  }}
                >
                  {user?.fullName || user?.username || "User"}
                </Text>
                <Text className="text-white/80 text-sm">
                  {user?.primaryEmailAddress?.emailAddress}
                </Text>
              </View>

              <View className="items-end">
                <TouchableOpacity className="mb-2 flex-row items-center rounded-3xl bg-white/20 px-3 py-2">
                  <Plus size={16} color="#ff8c42" />
                  <Text className="ml-1 font-bold text-[#ff8c42]">Friends</Text>
                </TouchableOpacity>

                <View className="w-[120px] flex-row justify-between">
                  <View className="items-center">
                    <Text
                      className="text-lg font-bold"
                      style={{
                        color: primaryForeground,
                      }}
                    >
                      1.5K
                    </Text>
                    <Text className="text-xs text-white/70">Followers</Text>
                  </View>
                  <View className="items-center">
                    <Text
                      className="text-lg font-bold"
                      style={{
                        color: primaryForeground,
                      }}
                    >
                      0
                    </Text>
                    <Text className="text-xs text-white/70">Following</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Floating Stats Grid */}
        <View className="-mt-5 px-4">
          <TouchableOpacity className="absolute right-6 -top-4 z-10 rounded-3xl bg-[#ffaa5b] px-3 py-1.5">
            <Text className="text-xs font-bold text-white">Record</Text>
          </TouchableOpacity>

          <View className="flex-row flex-wrap justify-between">
            <StatCard
              Icon={Star}
              value="51"
              label="Balance"
              iconColor="#facc15"
            />
            <StatCard
              Icon={Trophy}
              value="1"
              label="Level"
              iconColor="#facc15"
            />
            <StatCard
              Icon={Footprints}
              value="Barefoot"
              label="Current League"
              iconColor="#f87171"
            />
            <StatCard
              Icon={Zap}
              value="30"
              label="Total XP"
              iconColor="#a3e635"
            />
          </View>

          {/* Weekly XP Chart */}
          <WeeklyChart />
        </View>
      </ScrollView>
    </View>
  );
}
