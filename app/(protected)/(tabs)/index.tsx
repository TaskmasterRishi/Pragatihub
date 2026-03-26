import HomeTopBar from "@/components/HomeTopBar";
import PostListItem, { PostSkeletonCard } from "@/components/PostListItem";
import { Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/Supabase";
import { setTabBarVisible } from "@/utils/tabBarVisibility";
import { useUser } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 5;
const USERS_PREVIEW_COUNT = 3;
const SHOW_TOP_THRESHOLD = 24;
const HIDE_OFFSET_THRESHOLD = 120;
const SCROLL_DIRECTION_DEADZONE = 4;
const VISIBILITY_TOGGLE_COOLDOWN_MS = 140;

type SearchUser = {
  id: string;
  name: string;
  image: string | null;
};

type CountRow = {
  post_id: string | null;
};

const EmptyState = () => {
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        speed: 16,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={{
        paddingTop: 120,
        paddingHorizontal: 32,
        alignItems: "center",
        gap: 8,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Text style={{ color: text, fontSize: 18, fontWeight: "800" }}>
        No posts yet
      </Text>
      <Text
        style={{
          color: muted,
          fontSize: 14,
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        Pull to refresh or be the first to share something with the community.
      </Text>
    </Animated.View>
  );
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const backgroundColor = useThemeColor({}, "background");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const { user } = useUser();

  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedUsers, setSearchedUsers] = useState<SearchUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMembershipLoading, setIsMembershipLoading] = useState(true);
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const skeletonData = useMemo(
    () => Array.from({ length: 6 }).map((_, i) => ({ id: `skeleton-${i}` })),
    [],
  );
  const skeletonOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const tabBarVisibleRef = useRef(true);
  const lastOffsetYRef = useRef(0);
  const lastVisibilityToggleAtRef = useRef(0);

  const setTabBarVisibility = useCallback((visible: boolean) => {
    if (tabBarVisibleRef.current === visible) return;
    tabBarVisibleRef.current = visible;
    setTabBarVisible(visible);
  }, []);

  const loadMemberships = useCallback(async () => {
    if (!user?.id) {
      setJoinedGroupIds(new Set());
      setIsMembershipLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("user_groups")
        .select("group_id")
        .eq("user_id", user.id);
      if (error) {
        setJoinedGroupIds(new Set());
      } else {
        setJoinedGroupIds(new Set((data ?? []).map((g) => g.group_id)));
      }
    } catch {
      setJoinedGroupIds(new Set());
    } finally {
      setIsMembershipLoading(false);
    }
  }, [user?.id]);

  const countRowsByPostId = useCallback((rows: CountRow[] | null) => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      if (!row.post_id) continue;
      counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1);
    }
    return counts;
  }, []);

  const fetchPosts = useCallback(
    async ({ withRefreshIndicator = false }: { withRefreshIndicator?: boolean } = {}) => {
      if (withRefreshIndicator) {
        setRefreshing(true);
      }

      try {
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
          .order("created_at", { ascending: false });

        if (error || !data) {
          setPosts([]);
          return;
        }

        if (data.length === 0) {
          setPosts([]);
          return;
        }

        const postIds = data.map((post) => post.id);

        const [upvotesRes, downvotesRes, commentsRes] = await Promise.all([
          supabase.from("post_upvotes").select("post_id").in("post_id", postIds),
          supabase.from("post_downvotes").select("post_id").in("post_id", postIds),
          supabase.from("comments").select("post_id").in("post_id", postIds),
        ]);

        const upvoteCounts = countRowsByPostId((upvotesRes.data as CountRow[] | null) ?? null);
        const downvoteCounts = countRowsByPostId(
          (downvotesRes.data as CountRow[] | null) ?? null,
        );
        const commentCounts = countRowsByPostId((commentsRes.data as CountRow[] | null) ?? null);

        const postsWithCounts = data.map((post) => ({
          ...post,
          upvotes: upvoteCounts.get(post.id) ?? 0,
          downvotes: downvoteCounts.get(post.id) ?? 0,
          nr_of_comments: commentCounts.get(post.id) ?? 0,
        }));

        setPosts(postsWithCounts as Post[]);
      } finally {
        setIsInitialLoading(false);
        if (withRefreshIndicator) {
          setRefreshing(false);
        }
      }
    },
    [countRowsByPostId],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = Math.max(0, event.nativeEvent.contentOffset.y);
      const deltaY = offsetY - lastOffsetYRef.current;
      lastOffsetYRef.current = offsetY;

      if (offsetY <= SHOW_TOP_THRESHOLD) {
        setTabBarVisibility(true);
        return;
      }

      if (Math.abs(deltaY) < SCROLL_DIRECTION_DEADZONE) {
        return;
      }

      const now = Date.now();
      if (
        now - lastVisibilityToggleAtRef.current <
        VISIBILITY_TOGGLE_COOLDOWN_MS
      ) {
        return;
      }

      if (deltaY > 0 && offsetY > HIDE_OFFSET_THRESHOLD) {
        setTabBarVisibility(false);
        lastVisibilityToggleAtRef.current = now;
        return;
      }

      if (deltaY < 0) {
        setTabBarVisibility(true);
        lastVisibilityToggleAtRef.current = now;
      }
    },
    [setTabBarVisibility],
  );

  useEffect(() => {
    return () => {
      setTabBarVisibility(true);
    };
  }, [setTabBarVisibility]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    loadMemberships();
  }, [loadMemberships]);

  useEffect(() => {
    if (isInitialLoading) return;
    Animated.parallel([
      Animated.timing(skeletonOpacity, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isInitialLoading, skeletonOpacity, contentOpacity]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) => {
      const title = post.title?.toLowerCase() ?? "";
      const description = post.description?.toLowerCase() ?? "";
      const community = post.group?.name?.toLowerCase() ?? "";
      const author = post.user?.name?.toLowerCase() ?? "";
      return (
        title.includes(q) ||
        description.includes(q) ||
        community.includes(q) ||
        author.includes(q)
      );
    });
  }, [posts, searchQuery]);

  const visiblePosts = useMemo(
    () => filteredPosts.slice(0, page * PAGE_SIZE),
    [filteredPosts, page],
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    const q = searchQuery.trim();
    setShowAllUsers(false);

    if (!q || q.length < 2) {
      setSearchedUsers([]);
      setUsersLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setUsersLoading(true);
      let query = supabase
        .from("users")
        .select("id, name, image")
        .ilike("name", `%${q}%`)
        .limit(12);

      if (user?.id) {
        query = query.neq("id", user.id);
      }

      const { data, error } = await query;

      if (cancelled) return;
      if (error) {
        setSearchedUsers([]);
      } else {
        setSearchedUsers((data ?? []) as SearchUser[]);
      }
      setUsersLoading(false);
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, user?.id]);

  const handleRefresh = useCallback(async () => {
    if (refreshing || isInitialLoading) return;
    setPage(1);
    await fetchPosts({ withRefreshIndicator: true });
  }, [fetchPosts, isInitialLoading, refreshing]);

  const hasActiveSearch = searchQuery.trim().length > 0;
  const visibleUsers = useMemo(
    () =>
      showAllUsers
        ? searchedUsers
        : searchedUsers.slice(0, USERS_PREVIEW_COUNT),
    [searchedUsers, showAllUsers],
  );
  const hasMoreUsers = searchedUsers.length > USERS_PREVIEW_COUNT;
  const hasMorePosts = visiblePosts.length < filteredPosts.length;

  const renderItem = useCallback(
    ({ item, index: itemIndex }: { item: Post; index: number }) => (
      <PostListItem
        post={item}
        index={itemIndex}
        refreshing={refreshing}
        isMembershipLoading={isMembershipLoading}
        initialJoined={joinedGroupIds.has(item.group.id)}
      />
    ),
    [refreshing, isMembershipLoading, joinedGroupIds],
  );
  const keyExtractor = useCallback((item: Post) => item.id, []);
  const onEndReached = useCallback(() => {
    if (!hasMorePosts) return;
    setPage((previousPage) => previousPage + 1);
  }, [hasMorePosts]);

  const listHeader = useMemo(() => {
    if (!hasActiveSearch) return null;

    return (
      <View style={styles.searchHeaderWrap}>
        <View
          style={[styles.usersCard, { backgroundColor: card, borderColor: border }]}
        >
          <View style={styles.usersHeaderRow}>
            <Text style={[styles.usersTitle, { color: text }]}>Users</Text>
            {usersLoading ? (
              <ActivityIndicator size="small" color={primary} />
            ) : null}
          </View>

          {!usersLoading && visibleUsers.length === 0 ? (
            <Text style={[styles.usersEmpty, { color: secondary }]}>
              No users found
            </Text>
          ) : (
            visibleUsers.map((foundUser) => (
              <Pressable
                key={foundUser.id}
                onPress={() => router.push(`/user/${foundUser.id}`)}
                style={[styles.userRow, { borderColor: `${border}88` }]}
              >
                {foundUser.image ? (
                  <Image source={{ uri: foundUser.image }} style={styles.avatar} />
                ) : (
                  <View
                    style={[
                      styles.avatarFallback,
                      { backgroundColor: `${primary}20` },
                    ]}
                  >
                    <Text style={[styles.avatarFallbackText, { color: primary }]}>
                      {(foundUser.name[0] ?? "?").toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text
                  numberOfLines={1}
                  style={[styles.userName, { color: text }]}
                >
                  {foundUser.name}
                </Text>
              </Pressable>
            ))
          )}

          {!usersLoading && hasMoreUsers ? (
            <Pressable
              onPress={() => setShowAllUsers((prev) => !prev)}
              style={styles.showMoreButton}
            >
              <Text style={[styles.showMoreText, { color: primary }]}>
                {showAllUsers ? "Show less" : "Show more users"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={[styles.postsHeading, { color: secondary }]}>Posts</Text>
      </View>
    );
  }, [
    hasActiveSearch,
    card,
    border,
    text,
    usersLoading,
    primary,
    visibleUsers,
    secondary,
    router,
    hasMoreUsers,
    showAllUsers,
  ]);

  const showEmptyState = !isInitialLoading && !refreshing && posts.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor }}>
      {/* Floating top bar */}
      <HomeTopBar
        searchQuery={searchQuery}
        onChangeSearchQuery={setSearchQuery}
      />

      <View style={{ flex: 1 }}>
        {/* Skeleton stays mounted so we can fade it out smoothly */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { opacity: skeletonOpacity }]}
        >
          <FlatList
            data={skeletonData}
            keyExtractor={(item) => item.id}
            renderItem={({ index: i }) => <PostSkeletonCard index={i} />}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: insets.top + 80,
              paddingBottom: insets.bottom + 40,
            }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />
        </Animated.View>

        {showEmptyState ? (
          <EmptyState />
        ) : (
          <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
            <FlatList
              data={visiblePosts}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: insets.top + 80,
                paddingBottom: insets.bottom + 40,
              }}
              ListHeaderComponent={listHeader}
              removeClippedSubviews
              maxToRenderPerBatch={5}
              windowSize={7}
              initialNumToRender={5}
              updateCellsBatchingPeriod={50}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              progressViewOffset={insets.top + 80}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.5}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchHeaderWrap: {
    marginBottom: 12,
    gap: 10,
  },
  usersCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  usersHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  usersTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  usersEmpty: {
    fontSize: 13,
    lineHeight: 18,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  avatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 12,
    fontWeight: "700",
  },
  userName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  showMoreButton: {
    alignSelf: "flex-start",
    paddingTop: 2,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: "700",
  },
  postsHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
