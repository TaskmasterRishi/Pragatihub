import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React from "react";
import {
  Dimensions,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColor } from "@/hooks/use-theme-color";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const textSecondaryColor = useThemeColor({}, "textSecondary");
  const primaryColor = useThemeColor({}, "primary");
  const primaryForeground = useThemeColor({}, "primaryForeground");

  const StatCard = ({
    iconName,
    value,
    label,
    iconColor,
    bgColor = cardColor,
  }: any) => (
    <View
      style={{
        width: (width - 48) / 2,
        backgroundColor: bgColor,
        padding: 16,
        borderRadius: 20,
        marginBottom: 16,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: `${iconColor}20`, // 20% opacity
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <Text
        style={{
          fontSize: 24,
          fontWeight: "800",
          color: textColor,
          marginBottom: 4,
        }}
      >
        {value}
      </Text>
      <Text
        style={{ fontSize: 13, color: textSecondaryColor, fontWeight: "500" }}
      >
        {label}
      </Text>
    </View>
  );

  const WeeklyChart = () => {
    const data = [30, 45, 20, 60, 35, 15, 30]; // Mock data
    const max = Math.max(...data);
    const chartHeight = 120;

    return (
      <View
        style={{
          backgroundColor: cardColor,
          padding: 20,
          borderRadius: 24,
          marginBottom: 100,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: textColor,
              marginRight: 8,
            }}
          >
            Weekly XP
          </Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: textColor }}>
            30
          </Text>
          <Ionicons
            name="flash"
            size={16}
            color="#fbbf24"
            style={{ marginLeft: 4 }}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            height: chartHeight,
          }}
        >
          <View
            style={{
              height: "100%",
              justifyContent: "space-between",
              paddingVertical: 0,
            }}
          >
            <Text style={{ fontSize: 12, color: textSecondaryColor }}>30</Text>
            <Text style={{ fontSize: 12, color: textSecondaryColor }}>25</Text>
            <Text style={{ fontSize: 12, color: textSecondaryColor }}>20</Text>
            <Text style={{ fontSize: 12, color: textSecondaryColor }}>15</Text>
          </View>

          {data.map((val, idx) => {
            const height = (val / 60) * 100; // scaling based on max 60 for better visual
            const isToday = idx === 1; // Mocking "Tuesday" (index 1) as "Today" highlighted

            return (
              <View key={idx} style={{ alignItems: "center", width: "10%" }}>
                <View
                  style={{
                    height: `${height}%`,
                    width: "100%",
                    backgroundColor: isToday ? "#f97316" : "#ffe4bc", // Orange for highlighted
                    borderRadius: 8,
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                  }}
                />
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        style={{ flex: 1 }}
      >
        {/* Custom Header Area */}
        <View
          style={{
            backgroundColor: primaryColor,
            paddingTop: insets.top + 10,
            paddingBottom: 30,
            borderBottomLeftRadius: 40,
            borderBottomRightRadius: 40,
            paddingHorizontal: 20,
          }}
        >
          {/* Top Navigation Bar */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <TouchableOpacity
              style={{
                width: 44,
                height: 44,
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => router.back()} // Though it's a tab, design shows back. Maybe irrelevant for main tab but harmless.
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={primaryForeground}
              />
            </TouchableOpacity>

            <Link href="/settings" asChild>
              <TouchableOpacity
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="settings-outline"
                  size={24}
                  color={primaryForeground}
                />
              </TouchableOpacity>
            </Link>
          </View>

          {/* Profile Details */}
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <View
              style={{
                padding: 4,
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 50,
                marginBottom: 12,
              }}
            >
              <Image
                source={{ uri: user?.imageUrl }}
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 45,
                  backgroundColor: "#ccc",
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                width: "100%",
                justifyContent: "space-between",
                paddingHorizontal: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: primaryForeground,
                    marginBottom: 4,
                  }}
                >
                  {user?.fullName || user?.username || "User"}
                </Text>
                <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>
                  {user?.primaryEmailAddress?.emailAddress}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(255,255,255,0.2)",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginBottom: 8,
                  }}
                >
                  <Ionicons name="add" size={16} color="#ff8c42" />
                  <Text
                    style={{
                      color: "#ff8c42",
                      fontWeight: "bold",
                      marginLeft: 4,
                    }}
                  >
                    Friends
                  </Text>
                </TouchableOpacity>

                <View
                  style={{
                    flexDirection: "row",
                    width: 120,
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ alignItems: "center" }}>
                    <Text
                      style={{
                        color: primaryForeground,
                        fontWeight: "bold",
                        fontSize: 16,
                      }}
                    >
                      1.5K
                    </Text>
                    <Text
                      style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}
                    >
                      Followers
                    </Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text
                      style={{
                        color: primaryForeground,
                        fontWeight: "bold",
                        fontSize: 16,
                      }}
                    >
                      0
                    </Text>
                    <Text
                      style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}
                    >
                      Following
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Floating Stats Grid */}
        <View style={{ paddingHorizontal: 16, marginTop: -20 }}>
          <TouchableOpacity
            style={{
              position: "absolute",
              right: 24,
              top: -16,
              zIndex: 10,
              backgroundColor: "#ffaa5b",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: "white", fontWeight: "bold", fontSize: 12 }}>
              Record
            </Text>
          </TouchableOpacity>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <StatCard
              iconName="star"
              value="51"
              label="Balance"
              iconColor="#facc15"
            />
            <StatCard
              iconName="trophy"
              value="1"
              label="Level"
              iconColor="#facc15"
            />
            <StatCard
              iconName="footsteps"
              value="Barefoot"
              label="Current League"
              iconColor="#f87171"
            />
            <StatCard
              iconName="flash"
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
