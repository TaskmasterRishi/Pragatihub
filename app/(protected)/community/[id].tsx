import PostListItem from "@/components/PostListItem";
import { Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroupById, type Group } from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const PAGE_SIZE = 5;

export default function CommunityPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const communityId = Array.isArray(id) ? id[0] : id;
  const [community, setCommunity] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsRefreshing, setPostsRefreshing] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [postsHasMore, setPostsHasMore] = useState(true);

  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const textSecondaryColor = useThemeColor({}, "textSecondary");
  const primaryColor = useThemeColor({}, "primary");
  const primaryForeground = useThemeColor({}, "primaryForeground");
  const borderColor = useThemeColor({}, "border");

  useEffect(() => {
    if (!communityId) {
      setCommunity(null);
      setLoading(false);
      setLoadError("Community not found");
      return;
    }

    let isMounted = true;

    const loadCommunity = async () => {
      setLoading(true);
      setLoadError(null);

      const { data, error } = await fetchGroupById(communityId);

      if (!isMounted) return;

      if (error) {
        setCommunity(null);
        setLoadError(error.message ?? "Failed to load community");
      } else {
        setCommunity(data ?? null);
      }

      setLoading(false);
    };

    loadCommunity();

    return () => {
      isMounted = false;
    };
  }, [communityId]);

  useEffect(() => {
    if (!communityId) return;
    setPosts([]);
    setPostsPage(1);
    setPostsHasMore(true);
    fetchCommunityPosts(communityId, 1, true);
  }, [communityId]);

  const fetchCommunityPosts = async (
    groupId: string,
    page: number,
    replace = false,
  ) => {
    setPostsLoading(true);

    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        *,
        group:groups(*),
        user:users!posts_user_id_fkey(*)
      `,
      )
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (error || !data) {
      if (error) {
        console.log("Community posts fetch error:", error);
      }
      if (replace) {
        setPosts([]);
      }
      setPostsLoading(false);
      return;
    }

    const postsWithCounts = await Promise.all(
      data.map(async (post) => {
        const { count: upvotesCount } = await supabase
          .from("post_upvotes")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id);

        const { count: commentsCount } = await supabase
          .from("comments")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id);

        return {
          ...post,
          upvotes: upvotesCount || 0,
          nr_of_comments: commentsCount || 0,
        };
      }),
    );

    setPosts((prev) =>
      replace ? postsWithCounts : [...prev, ...postsWithCounts],
    );
    setPostsHasMore(data.length === PAGE_SIZE);
    setPostsPage(page);
    setPostsLoading(false);
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <ActivityIndicator size="large" color={textColor} />
      </View>
    );
  }

  if (!community) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Text style={{ color: textColor, fontSize: 16 }}>
          {loadError ?? "Community not found"}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 16,
            paddingVertical: 10,
            paddingHorizontal: 20,
            backgroundColor: primaryColor,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: primaryForeground, fontWeight: "600" }}>
            Go back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 8, marginRight: 8 }}
        >
          <ChevronLeft size={24} color={textColor} />
        </TouchableOpacity>
        <Text
          style={{ color: textColor, fontSize: 18, fontWeight: "600" }}
          numberOfLines={1}
        >
          {community.name}
        </Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostListItem post={item} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshing={postsRefreshing}
        onRefresh={async () => {
          if (!communityId) return;
          setPostsRefreshing(true);
          await fetchCommunityPosts(communityId, 1, true);
          setPostsRefreshing(false);
        }}
        onEndReached={() => {
          if (!communityId || postsLoading || !postsHasMore) return;
          fetchCommunityPosts(communityId, postsPage + 1);
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            {/* Community hero */}
            <View
              style={{
                backgroundColor: cardColor,
                borderRadius: 20,
                padding: 24,
                alignItems: "center",
                borderWidth: 1,
                borderColor,
              }}
            >
              <Image
                source={{ uri: community.image ?? undefined }}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: "#e5e7eb",
                }}
              />
              <Text
                style={{
                  color: textColor,
                  fontSize: 22,
                  fontWeight: "700",
                  marginTop: 14,
                }}
              >
                {community.name}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 6,
                }}
              >
                <Users size={18} color={textSecondaryColor} />
                <Text
                  style={{
                    color: textSecondaryColor,
                    fontSize: 14,
                    marginLeft: 6,
                  }}
                >
                  Community
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 24, marginBottom: 12 }}>
              <Text
                style={{ color: textColor, fontSize: 18, fontWeight: "700" }}
              >
                Posts
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          postsLoading ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator size="small" color={textSecondaryColor} />
            </View>
          ) : (
            <Text style={{ color: textSecondaryColor, fontSize: 14 }}>
              No posts in this community yet.
            </Text>
          )
        }
      />
    </View>
  );
}
