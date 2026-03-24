import HomeTopBar from "@/components/HomeTopBar";
import PostListItem, { PostSkeletonCard } from "@/components/PostListItem";
import { Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/Supabase";
import { setTabBarVisible } from "@/utils/tabBarVisibility";
import { useUser } from "@clerk/clerk-expo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 5;

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
  const backgroundColor = useThemeColor({}, "background");
  const { user } = useUser();

  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMembershipLoading, setIsMembershipLoading] = useState(true);
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set());
  const skeletonData = useMemo(
    () => Array.from({ length: 6 }).map((_, i) => ({ id: `skeleton-${i}` })),
    [],
  );
  const skeletonOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
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
    } catch (e) {
      setJoinedGroupIds(new Set());
    } finally {
      setIsMembershipLoading(false);
    }
  }, [user?.id]);

  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;

    // Clear existing timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    if (offsetY <= 10) {
      // At or very near the top: show immediately, no debounce
      setTabBarVisible(true);
    } else if (offsetY > 50) {
      // Scrolled down: hide, then show after debounce
      setTabBarVisible(false);
      scrollTimeout.current = setTimeout(() => {
        setTabBarVisible(true);
      }, 500); // Reduced timing
    } else {
      // Between 10 and 50: show immediately
      setTabBarVisible(true);
    }
  };

  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      setTabBarVisible(true);
    };
  }, []);

  useEffect(() => {
    fetchPosts();
  }, []);

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

  const fetchPosts = async () => {
    if (!isInitialLoading && !refreshing) {
      setRefreshing(true);
    }

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

    if (error) {
      setIsInitialLoading(false);
      setRefreshing(false);
      return;
    }

    if (!data) {
      setPosts([]);
      setIsInitialLoading(false);
      setRefreshing(false);
      return;
    }

    // For each post, get the upvotes and comments count
    const postsWithCounts = await Promise.all(
      data.map(async (post) => {
        // Get upvotes count
        const { count: upvotesCount } = await supabase
          .from("post_upvotes")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id);

        // Get downvotes count
        const { count: downvotesCount } = await supabase
          .from("post_downvotes")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id);

        // Get comments count
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

    setPosts(postsWithCounts);
    setIsInitialLoading(false);
    setRefreshing(false);
  };

  const [page, setPage] = useState(1);
  const [visiblePosts, setVisiblePosts] = useState<Post[]>([]);

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

  useEffect(() => {
    setVisiblePosts(filteredPosts.slice(0, page * PAGE_SIZE));
  }, [page, filteredPosts]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const handleRefresh = async () => {
    if (refreshing || isInitialLoading) return;
    setRefreshing(true);
    setPage(1);
    try {
      await fetchPosts();
    } finally {
      setRefreshing(false);
    }
  };

  const renderItem = ({
    item,
    index: itemIndex,
  }: {
    item: Post;
    index: number;
  }) => (
    <PostListItem
      post={item}
      index={itemIndex}
      refreshing={refreshing}
      isMembershipLoading={isMembershipLoading}
      initialJoined={joinedGroupIds.has(item.group.id)}
    />
  );
  const memoizedRenderItem = useCallback(renderItem, [
    refreshing,
    isMembershipLoading,
    joinedGroupIds,
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
              keyExtractor={(item) => item.id}
              renderItem={memoizedRenderItem}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: insets.top + 80,
                paddingBottom: insets.bottom + 40,
              }}
              removeClippedSubviews
              maxToRenderPerBatch={5}
              windowSize={7}
              initialNumToRender={5}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              progressViewOffset={insets.top + 80}
              onEndReached={() => {
                if (page * PAGE_SIZE < filteredPosts.length) {
                  setPage((p) => p + 1);
                }
              }}
              onEndReachedThreshold={0.5}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}
