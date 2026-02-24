import AppLoader from "@/components/AppLoader";
import PostListItem from "@/components/PostListItem";
import { Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroupById, type Group } from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Clock3, Flame, Trophy, Users } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 5;

type SortMode = "hot" | "new" | "top";

const toRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  if (!/^[A-Fa-f0-9]{6}$/.test(normalized)) return hex;

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const postScore = (post: Post) => (post.upvotes ?? 0) - (post.downvotes ?? 0);

export default function CommunityPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const communityId = Array.isArray(id) ? id[0] : id;
  const [community, setCommunity] = useState<Group | null>(null);
  const [communityMembers, setCommunityMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsRefreshing, setPostsRefreshing] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("hot");

  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const textSecondaryColor = useThemeColor({}, "textSecondary");
  const borderColor = useThemeColor({}, "border");
  const inputColor = useThemeColor({}, "input");
  const primaryColor = useThemeColor({}, "primary");
  const primaryForeground = useThemeColor({}, "primaryForeground");

  const topBarBg = toRgba(cardColor, isDark ? 0.88 : 0.96);
  const softBorder = toRgba(borderColor, isDark ? 0.56 : 0.32);
  const chipBg = toRgba(inputColor, isDark ? 0.52 : 0.8);
  const selectedChipBg = toRgba(primaryColor, isDark ? 0.2 : 0.12);
  const selectedChipBorder = toRgba(primaryColor, isDark ? 0.52 : 0.36);

  useEffect(() => {
    if (!communityId) {
      setCommunity(null);
      setCommunityMembers(0);
      setLoading(false);
      setLoadError("Community not found");
      return;
    }

    let isMounted = true;

    const loadCommunity = async () => {
      setLoading(true);
      setLoadError(null);

      const [{ data, error }, membersResult] = await Promise.all([
        fetchGroupById(communityId),
        supabase
          .from("user_groups")
          .select("group_id", { count: "exact", head: true })
          .eq("group_id", communityId),
      ]);

      if (!isMounted) return;

      if (error) {
        setCommunity(null);
        setLoadError(error.message ?? "Failed to load community");
      } else {
        setCommunity(data ?? null);
      }

      if (!membersResult.error) {
        setCommunityMembers(membersResult.count ?? 0);
      } else {
        setCommunityMembers(0);
      }

      setLoading(false);
    };

    void loadCommunity();

    return () => {
      isMounted = false;
    };
  }, [communityId]);

  useEffect(() => {
    if (!communityId) return;
    setPosts([]);
    setPostsPage(1);
    setPostsHasMore(true);
    void fetchCommunityPosts(communityId, 1, true);
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
        post_media:post_media(*),
        group:groups(*),
        user:users!posts_user_id_fkey(*)
      `,
      )
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (error || !data) {
      if (replace) setPosts([]);
      setPostsLoading(false);
      return;
    }

    const postsWithCounts = await Promise.all(
      data.map(async (post) => {
        const { count: upvotesCount } = await supabase
          .from("post_upvotes")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id);

        const { count: downvotesCount } = await supabase
          .from("post_downvotes")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id);

        const { count: commentsCount } = await supabase
          .from("comments")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id);

        return {
          ...post,
          upvotes: upvotesCount || 0,
          downvotes: downvotesCount || 0,
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

  const visiblePosts = useMemo(() => {
    const sorted = [...posts];

    if (sortMode === "new") {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime(),
      );
      return sorted;
    }

    if (sortMode === "top") {
      sorted.sort((a, b) => postScore(b) - postScore(a));
      return sorted;
    }

    sorted.sort((a, b) => {
      const scoreDiff = postScore(b) - postScore(a);
      if (scoreDiff !== 0) return scoreDiff;

      return (b.nr_of_comments ?? 0) - (a.nr_of_comments ?? 0);
    });

    return sorted;
  }, [posts, sortMode]);

  if (loading) {
    return (
      <View style={[styles.stateScreen, { backgroundColor }]}>
        <AppLoader size="large" color={textColor} fullScreen />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={[styles.stateScreen, { backgroundColor }]}>
        <Text style={[styles.stateText, { color: textColor }]}>
          {loadError ?? "Community not found"}
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backCta,
            { backgroundColor: primaryColor, opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <Text style={[styles.backCtaText, { color: primaryForeground }]}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const handle = community.id ? `r/${community.id}` : "r/community";

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 6,
            backgroundColor: topBarBg,
            borderBottomColor: softBorder,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.navButton,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <ChevronLeft size={22} color={textColor} />
        </Pressable>

        <View style={styles.topBarTextWrap}>
          <Text
            style={[styles.topBarTitle, { color: textColor }]}
            numberOfLines={1}
          >
            {handle}
          </Text>
          <Text style={[styles.topBarSubtitle, { color: textSecondaryColor }]}>
            {communityMembers.toLocaleString()} members
          </Text>
        </View>
      </View>

      <FlatList
        data={visiblePosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostListItem post={item} hideJoinButton={true} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 24 + insets.bottom,
        }}
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
          void fetchCommunityPosts(communityId, postsPage + 1);
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={styles.listHeaderWrap}>
            <View
              style={[
                styles.heroCard,
                { backgroundColor: cardColor, borderColor: softBorder },
              ]}
            >
              <Image
                source={{ uri: community.image ?? undefined }}
                style={styles.communityAvatar}
              />

              <View style={styles.heroTextWrap}>
                <Text
                  style={[styles.communityName, { color: textColor }]}
                  numberOfLines={1}
                >
                  {community.name}
                </Text>
                <Text
                  style={[
                    styles.communityHandle,
                    { color: textSecondaryColor },
                  ]}
                  numberOfLines={1}
                >
                  {handle}
                </Text>
                <View style={styles.memberRow}>
                  <Users size={13} color={textSecondaryColor} />
                  <Text
                    style={[styles.memberText, { color: textSecondaryColor }]}
                  >
                    {communityMembers.toLocaleString()} members
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.sortRow}>
              <Pressable
                onPress={() => setSortMode("hot")}
                style={({ pressed }) => [
                  styles.sortChip,
                  {
                    backgroundColor:
                      sortMode === "hot" ? selectedChipBg : chipBg,
                    borderColor:
                      sortMode === "hot" ? selectedChipBorder : softBorder,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Flame
                  size={13}
                  color={sortMode === "hot" ? primaryColor : textSecondaryColor}
                />
                <Text
                  style={[
                    styles.sortText,
                    {
                      color:
                        sortMode === "hot" ? primaryColor : textSecondaryColor,
                    },
                  ]}
                >
                  Hot
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setSortMode("new")}
                style={({ pressed }) => [
                  styles.sortChip,
                  {
                    backgroundColor:
                      sortMode === "new" ? selectedChipBg : chipBg,
                    borderColor:
                      sortMode === "new" ? selectedChipBorder : softBorder,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Clock3
                  size={13}
                  color={sortMode === "new" ? primaryColor : textSecondaryColor}
                />
                <Text
                  style={[
                    styles.sortText,
                    {
                      color:
                        sortMode === "new" ? primaryColor : textSecondaryColor,
                    },
                  ]}
                >
                  New
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setSortMode("top")}
                style={({ pressed }) => [
                  styles.sortChip,
                  {
                    backgroundColor:
                      sortMode === "top" ? selectedChipBg : chipBg,
                    borderColor:
                      sortMode === "top" ? selectedChipBorder : softBorder,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Trophy
                  size={13}
                  color={sortMode === "top" ? primaryColor : textSecondaryColor}
                />
                <Text
                  style={[
                    styles.sortText,
                    {
                      color:
                        sortMode === "top" ? primaryColor : textSecondaryColor,
                    },
                  ]}
                >
                  Top
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          postsLoading ? (
            <AppLoader
              size="small"
              color={textSecondaryColor}
              style={{ paddingVertical: 20 }}
            />
          ) : (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: cardColor, borderColor: softBorder },
              ]}
            >
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                No posts in this community yet.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },
  topBarTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  topBarSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  listHeaderWrap: {
    paddingBottom: 10,
    gap: 10,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  communityAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#e5e7eb",
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  communityName: {
    fontSize: 18,
    fontWeight: "800",
  },
  communityHandle: {
    fontSize: 12,
    marginTop: 1,
  },
  memberRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  memberText: {
    fontSize: 12,
    fontWeight: "500",
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  sortText: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  stateScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  stateText: {
    fontSize: 16,
    textAlign: "center",
  },
  backCta: {
    marginTop: 16,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backCtaText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
