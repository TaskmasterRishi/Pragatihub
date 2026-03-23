import AppLoader from "@/components/AppLoader";
import { HapticTab } from "@/components/haptic-tab";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroupById, type Group } from "@/lib/actions/groups";
import {
  checkIsModerator,
  fetchPendingReportCount,
} from "@/lib/actions/moderation";
import { useUser } from "@clerk/clerk-expo";
import { BlurView } from "expo-blur";
import { Tabs, useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  MessageCircle,
  Shield,
  UserIcon,
  Users as UsersIcon,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_RADIUS = 28;

export default function CommunityLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const communityId = Array.isArray(id) ? id[0] : id;

  const [community, setCommunity] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMod, setIsMod] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const bg = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");

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

  useEffect(() => {
    if (!communityId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [{ data }, modStatus, count] = await Promise.all([
        fetchGroupById(communityId),
        checkIsModerator(communityId, user?.id),
        fetchPendingReportCount(communityId),
      ]);
      if (cancelled) return;
      setCommunity(data ?? null);
      const isOwner = !!data?.owner_id && data.owner_id === user?.id;
      setIsMod(modStatus || isOwner);
      setPendingCount(count);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [communityId, user?.id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <AppLoader fullScreen />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: bg }]}>
        <Text style={[styles.notFoundTitle, { color: text }]}>
          Community not found
        </Text>
        <Text style={[styles.notFoundSubtext, { color: secondary }]}>
          This community may have been removed or the link is invalid.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: primary }]}
        >
          <ChevronLeft size={20} color="#fff" />
          <Text style={styles.backButtonLabel}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        lazy: false,
        headerShown: false,
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
          title: "Posts",
          tabBarIcon: ({ focused }) => renderIcon(UsersIcon, focused, 24),
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: "Members",
          tabBarIcon: ({ focused }) => renderIcon(UserIcon, focused, 24),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ focused }) => renderIcon(MessageCircle, focused, 24),
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="moderation"
        options={{
          href: isMod ? undefined : null,
          title: "Mod",
          tabBarIcon: ({ focused }) => (
            <View style={{ position: "relative" }}>
              {renderIcon(Shield, focused, 22)}
              {isMod && pendingCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -4,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: "#EF4444",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 3,
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}
                  >
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  notFoundSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  backButtonLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
