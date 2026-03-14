import AppLoader from "@/components/AppLoader";
import CommunityHeader from "@/components/CommunityHeader";
import PostListItem from "@/components/PostListItem";
import { type Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroupById, type Group } from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import { useGlobalSearchParams } from "expo-router";
import { FileText, Rss } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 8;

export default function CommunityPostsTab() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const communityId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();

  const [community, setCommunity] = useState<Group | null>(null);
  const [members, setMembers] = useState(0);
  const [loading, setLoading] = useState(true);

  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);

  const postsRequestIdRef = useRef(0);
  const loadingPageRef = useRef<number | null>(null);

  const bg = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const tint = useThemeColor({}, "tint");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const secondaryColor = useThemeColor({}, "secondary");
  const backgroundSecondary = useThemeColor({}, "backgroundSecondary");
  const success = useThemeColor({}, "success");

  useEffect(() => {
    if (!communityId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [{ data }, membersRes] = await Promise.all([
        fetchGroupById(communityId),
        supabase
          .from("user_groups")
          .select("group_id, user_id", { count: "exact", head: true })
          .eq("group_id", communityId),
      ]);

      if (cancelled) return;
      setCommunity(data ?? null);
      if (membersRes.count !== null) setMembers(membersRes.count);
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [communityId]);

  const fetchPosts = useCallback(
    async (p = 1, replace = false) => {
      if (!communityId) return;
      if (loadingPageRef.current === p) return;

      loadingPageRef.current = p;
      const requestId = ++postsRequestIdRef.current;
      setPostsLoading(true);

      try {
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

        if (requestId !== postsRequestIdRef.current) return;
        if (!data) {
          if (replace) setPosts([]);
          setHasMore(false);
          setPage(p);
          return;
        }

        const postsData = data as unknown as Post[];

        setPosts((prev) => {
          if (replace) return postsData;
          if (postsData.length === 0) return prev;

          const seen = new Set(prev.map((post) => post.id));
          const next = [...prev];
          for (const post of postsData) {
            if (!seen.has(post.id)) {
              seen.add(post.id);
              next.push(post);
            }
          }
          return next;
        });
        setHasMore(postsData.length === PAGE_SIZE);
        setPage(p);
      } finally {
        if (requestId === postsRequestIdRef.current) {
          setPostsLoading(false);
          loadingPageRef.current = null;
        }
      }
    },
    [communityId],
  );

  useEffect(() => {
    if (!communityId) return;
    postsRequestIdRef.current += 1;
    loadingPageRef.current = null;
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setPostsLoading(false);
    void fetchPosts(1, true);
  }, [communityId, fetchPosts]);

  if (loading || !community) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <AppLoader fullScreen />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FlatList
        style={styles.list}
        removeClippedSubviews
        windowSize={7}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={32}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 90,
          flexGrow: 1,
        }}
        data={posts}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.postWrap}>
            <PostListItem post={item} hideJoinButton />
          </View>
        )}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (!postsLoading && loadingPageRef.current === null && hasMore && posts.length > 0)
            void fetchPosts(page + 1);
        }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <CommunityHeader
            community={community}
            membersCount={members}
            bg={bg}
            card={card}
            border={border}
            primary={primary}
            secondaryColor={secondaryColor}
            text={text}
            secondary={secondary}
            backgroundSecondary={backgroundSecondary}
            success={success}
          />
        }
        ListEmptyComponent={
          postsLoading && posts.length === 0 ? (
            <View style={styles.emptyCenter}>
              <ActivityIndicator size="large" color={tint} />
              <Text style={[styles.emptyText, { color: secondary }]}>Loading posts…</Text>
            </View>
          ) : !postsLoading && posts.length === 0 ? (
            <View style={styles.emptyCenter}>
              <View style={[styles.emptyIcon, { backgroundColor: backgroundSecondary }]}>
                <FileText size={32} color={secondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: text }]}>No posts yet</Text>
              <Text style={[styles.emptyText, { color: secondary }]}>
                Be the first to share something in this community.
              </Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
        ListFooterComponent={
          postsLoading && posts.length > 0 ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={tint} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { flex: 1 },

  postWrap: {
    paddingHorizontal: 14,
    marginTop: 4,
  },

  emptyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
