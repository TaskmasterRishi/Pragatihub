import AppLoader from "@/components/AppLoader";
import JoinCommunityButton from "@/components/JoinCommunityButton";
import PostListItem from "@/components/PostListItem";
import { Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroupById, type Group } from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Clock3,
  Flame,
  MoreHorizontal,
  Search,
  Share,
  Trophy,
  Users,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const PAGE_SIZE = 8;
type SortMode = "hot" | "new" | "top";

const score = (p: Post) => (p.upvotes ?? 0) - (p.downvotes ?? 0);

export default function CommunityPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const communityId = Array.isArray(id) ? id[0] : id;

  const [community, setCommunity] = useState<Group | null>(null);
  const [members, setMembers] = useState(0);
  const [loading, setLoading] = useState(true);

  const [posts, setPosts] = useState<Post[]>([]);
  const [sort, setSort] = useState<SortMode>("hot");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);

  const bg = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const border = useThemeColor({}, "border");
  const card = useThemeColor({}, "card");
  const primary = useThemeColor({}, "primary");
  const tint = useThemeColor({}, "tint");
  const backgroundSecondary = useThemeColor({}, "backgroundSecondary");
  const success = useThemeColor({}, "success");
  const primaryForeground = useThemeColor({}, "primaryForeground");

  const [sortTabWidth, setSortTabWidth] = useState(0);
  const sortTabIndex = useRef(new Animated.Value(0)).current;
  const hotTabScale = useRef(new Animated.Value(1)).current;
  const newTabScale = useRef(new Animated.Value(1)).current;
  const topTabScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const index = sort === "hot" ? 0 : sort === "new" ? 1 : 2;
    Animated.spring(sortTabIndex, {
      toValue: index,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [sort, sortTabIndex]);

  useEffect(() => {
    if (!communityId) return;

    const load = async () => {
      setLoading(true);

      const [{ data }, membersRes] = await Promise.all([
        fetchGroupById(communityId),
        supabase
          .from("user_groups")
          .select("group_id, user_id", { count: "exact" }) // count exact requires no head sometimes to return row data too
          .eq("group_id", communityId),
      ]);

      setCommunity(data ?? null);
      if (membersRes.count !== null) setMembers(membersRes.count);
      setLoading(false);
    };

    void load();
  }, [communityId]);

  const fetchPosts = async (p = 1, replace = false) => {
    if (!communityId) return;
    setPostsLoading(true);

    const { data } = await supabase
      .from("posts")
      .select(
        `*,
        post_media:post_media(*),
        group:groups(*),
        user:users!posts_user_id_fkey(*)`,
      )
      .eq("group_id", communityId)
      .order("created_at", { ascending: false })
      .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1);

    if (!data) {
      setPostsLoading(false);
      return;
    }

    const postsData = data as unknown as Post[];

    setPosts((prev) => (replace ? postsData : [...prev, ...postsData]));
    setHasMore(data.length === PAGE_SIZE);
    setPage(p);
    setPostsLoading(false);
  };

  useEffect(() => {
    fetchPosts(1, true);
  }, [communityId]);

  const sortedPosts = useMemo(() => {
    const arr = [...posts];

    if (sort === "new") {
      arr.sort(
        (a, b) =>
          new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime(),
      );
    } else if (sort === "top") {
      arr.sort((a, b) => score(b) - score(a));
    } else {
      arr.sort((a, b) => score(b) - score(a));
    }

    return arr;
  }, [posts, sort]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <AppLoader fullScreen />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={{ color: text }}>Community not found</Text>
      </View>
    );
  }

  const handle = `r/${community.name.replace(/\s+/g, "")}`;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
        data={sortedPosts}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.postListItemWrap}>
            <PostListItem post={item} hideJoinButton />
          </View>
        )}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (!postsLoading && hasMore) fetchPosts(page + 1);
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          postsLoading && posts.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: bg }]}>
              <ActivityIndicator size="large" color={tint} />
              <Text style={[styles.emptyText, { color: secondary }]}>
                Loading posts…
              </Text>
            </View>
          ) : !postsLoading && posts.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: bg }]}>
              <Text style={[styles.emptyTitle, { color: text }]}>
                No posts yet
              </Text>
              <Text style={[styles.emptyText, { color: secondary }]}>
                Be the first to share something in this community.
              </Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => null}
        ListFooterComponent={
          postsLoading && posts.length > 0 ? (
            <View style={[styles.footerLoader, { backgroundColor: bg }]}>
              <ActivityIndicator size="small" color={tint} />
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View style={[styles.headerCard, { backgroundColor: card }]}>
            {/* Banner with transparent bar overlaid on top - both scroll with content */}
            <View style={styles.bannerWrap}>
              <View style={styles.bannerContainer}>
                {community.banner_image ? (
                  <Image
                    source={{ uri: community.banner_image }}
                    style={styles.bannerImage}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={[tint, "#4a90e2"]}
                    style={styles.bannerImage}
                  />
                )}
              </View>
              <View style={styles.toolbarOverlay} pointerEvents="box-none">
                <View style={styles.toolbarRow}>
                  <Pressable
                    onPress={() => router.back()}
                    style={styles.iconBtn}
                    hitSlop={8}
                  >
                    <ChevronLeft size={26} color="#fff" />
                  </Pressable>
                  <View style={styles.toolbarRight}>
                    <Pressable style={styles.iconBtn} hitSlop={8}>
                      <Search size={22} color="#fff" />
                    </Pressable>
                    <Pressable style={styles.iconBtn} hitSlop={8}>
                      <Share size={22} color="#fff" />
                    </Pressable>
                    <Pressable style={styles.iconBtn} hitSlop={8}>
                      <MoreHorizontal size={22} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>

            {/* COMMUNITY INFO */}
            <View style={styles.infoContainer}>
              <View style={styles.avatarRow}>
                <Image
                  source={{ uri: community.image ?? undefined }}
                  style={[styles.avatar, { borderColor: card, borderWidth: 4 }]}
                />
              </View>

              <View style={styles.nameRow}>
                <Text
                  style={[styles.communityName, { color: text }]}
                  numberOfLines={1}
                >
                  {community.name}
                </Text>
                {communityId ? (
                  <View style={styles.joinButtonWrap}>
                    <JoinCommunityButton communityId={communityId} />
                  </View>
                ) : null}
              </View>
              <Text style={[styles.communityHandle, { color: secondary }]}>
                {handle}
              </Text>

              {community.description && (
                <Text style={[styles.description, { color: text }]}>
                  {community.description}
                </Text>
              )}

              {/* Members & Online - compact, left-aligned, rounded card */}
              <View
                style={[
                  styles.statsRow,
                  { backgroundColor: backgroundSecondary, borderColor: border },
                ]}
              >
                <View style={styles.statPill}>
                  <Users size={14} color={primary} />
                  <Text style={[styles.statValue, { color: text }]}>
                    {members.toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: secondary }]}>
                    Members
                  </Text>
                </View>
                <View
                  style={[styles.statDivider, { backgroundColor: border }]}
                />
                <View style={styles.statPill}>
                  <View
                    style={[styles.onlineDot, { backgroundColor: success }]}
                  />
                  <Text style={[styles.statValue, { color: text }]}>
                    {Math.max(1, Math.floor(members * 0.1)).toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: secondary }]}>
                    Online
                  </Text>
                </View>
              </View>
            </View>

            {/* Sort tabs - same style as profile tabs */}
            <View
              style={[styles.sortTabsContainer, { backgroundColor: card }]}
              onLayout={(e) => setSortTabWidth(e.nativeEvent.layout.width)}
            >
              {sortTabWidth > 0 && (
                <Animated.View
                  style={[
                    styles.sortTabIndicator,
                    {
                      width: (sortTabWidth - 8) / 3,
                      backgroundColor: primary,
                    },
                    {
                      transform: [
                        {
                          translateX: sortTabIndex.interpolate({
                            inputRange: [0, 1, 2],
                            outputRange: [
                              0,
                              (sortTabWidth - 8) / 3,
                              ((sortTabWidth - 8) / 3) * 2,
                            ],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              )}
              <Animated.View
                style={[
                  styles.sortTabWrap,
                  { transform: [{ scale: hotTabScale }] },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => {
                    Animated.sequence([
                      Animated.timing(hotTabScale, {
                        toValue: 0.95,
                        duration: 100,
                        useNativeDriver: true,
                      }),
                      Animated.timing(hotTabScale, {
                        toValue: 1,
                        duration: 100,
                        useNativeDriver: true,
                      }),
                    ]).start();
                    setSort("hot");
                  }}
                  style={styles.sortTabButton}
                >
                  <Flame
                    size={18}
                    color={sort === "hot" ? primaryForeground : secondary}
                  />
                  <Text
                    style={[
                      styles.sortTabLabel,
                      { color: sort === "hot" ? primaryForeground : secondary },
                    ]}
                  >
                    Hot
                  </Text>
                </TouchableOpacity>
              </Animated.View>
              <Animated.View
                style={[
                  styles.sortTabWrap,
                  { transform: [{ scale: newTabScale }] },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => {
                    Animated.sequence([
                      Animated.timing(newTabScale, {
                        toValue: 0.95,
                        duration: 100,
                        useNativeDriver: true,
                      }),
                      Animated.timing(newTabScale, {
                        toValue: 1,
                        duration: 100,
                        useNativeDriver: true,
                      }),
                    ]).start();
                    setSort("new");
                  }}
                  style={styles.sortTabButton}
                >
                  <Clock3
                    size={18}
                    color={sort === "new" ? primaryForeground : secondary}
                  />
                  <Text
                    style={[
                      styles.sortTabLabel,
                      { color: sort === "new" ? primaryForeground : secondary },
                    ]}
                  >
                    New
                  </Text>
                </TouchableOpacity>
              </Animated.View>
              <Animated.View
                style={[
                  styles.sortTabWrap,
                  { transform: [{ scale: topTabScale }] },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => {
                    Animated.sequence([
                      Animated.timing(topTabScale, {
                        toValue: 0.95,
                        duration: 100,
                        useNativeDriver: true,
                      }),
                      Animated.timing(topTabScale, {
                        toValue: 1,
                        duration: 100,
                        useNativeDriver: true,
                      }),
                    ]).start();
                    setSort("top");
                  }}
                  style={styles.sortTabButton}
                >
                  <Trophy
                    size={18}
                    color={sort === "top" ? primaryForeground : secondary}
                  />
                  <Text
                    style={[
                      styles.sortTabLabel,
                      { color: sort === "top" ? primaryForeground : secondary },
                    ]}
                  >
                    Top
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  toolbar: {
    paddingHorizontal: 12,
  },

  bannerWrap: {
    position: "relative",
  },

  toolbarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  toolbarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  list: {
    flex: 1,
  },

  postListItemWrap: {
    paddingHorizontal: 14,
    marginTop: 4,
  },

  headerCard: {
    marginBottom: 10,
    overflow: "hidden",
  },

  bannerContainer: {
    width: "100%",
    height: 160,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },

  infoContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  avatarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: -38,
    marginBottom: 12,
  },

  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#e5e7eb",
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 2,
  },

  joinButtonWrap: {
    paddingTop: 5,
    flexShrink: 0,
  },

  communityName: {
    fontSize: 22,
    fontWeight: "800",
    flex: 1,
  },

  communityHandle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },

  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
    gap: 10,
  },

  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
  },

  statValue: {
    fontSize: 13,
    fontWeight: "700",
  },

  statLabel: {
    fontSize: 11,
    marginTop: 0,
    fontWeight: "500",
  },

  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  sortTabsContainer: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    minHeight: 52,
    marginTop: 12,
    position: "relative",
    overflow: "hidden",
  },

  sortTabIndicator: {
    position: "absolute",
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 12,
  },

  sortTabWrap: {
    flex: 1,
    zIndex: 1,
  },

  sortTabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },

  sortTabLabel: {
    fontWeight: "600",
    fontSize: 14,
  },
});
