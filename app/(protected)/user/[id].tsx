import ProfileView from "@/components/profile/ProfileView";
import AppLoader from "@/components/AppLoader";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/Supabase";
import { useUser } from "@clerk/clerk-expo";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

type UserRow = {
  id: string;
  name: string;
  image: string | null;
};

export default function UserProfileScreen() {
  const { user } = useUser();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const textColor = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");

  const userId = useMemo(() => {
    if (Array.isArray(params.id)) return params.id[0] ?? "";
    return params.id ?? "";
  }, [params.id]);

  const [profileUser, setProfileUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      if (!userId) {
        if (mounted) {
          setProfileUser(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("id, name, image")
        .eq("id", userId)
        .single();

      if (!mounted) return;

      if (error || !data) {
        setProfileUser(null);
      } else {
        setProfileUser(data as UserRow);
      }
      setLoading(false);
    };

    void loadUser();

    return () => {
      mounted = false;
    };
  }, [userId]);

  if (userId && user?.id && userId === user.id) {
    return <Redirect href="/(protected)/(tabs)/profile" />;
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <AppLoader fullScreen />
      </View>
    );
  }

  if (!profileUser) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text style={{ color: textColor, fontSize: 18, fontWeight: "700" }}>
          User not found
        </Text>
        <Text
          style={{ color: secondary, marginTop: 6, textAlign: "center", fontSize: 14 }}
        >
          This profile is unavailable.
        </Text>
      </View>
    );
  }

  return (
    <ProfileView
      profileUserId={profileUser.id}
      displayName={profileUser.name || "User"}
      username={profileUser.name ? `@${profileUser.name.replace(/\s+/g, "_").toLowerCase()}` : "@user"}
      avatarUrl={profileUser.image}
      isOwnProfile={false}
    />
  );
}
