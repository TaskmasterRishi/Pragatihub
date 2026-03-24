import AppLoader from "@/components/AppLoader";
import CommunityHeader from "@/components/CommunityHeader";
import PostListItem from "@/components/PostListItem";
import { type Post } from "@/constants/types";
import { useCommunityStats } from "@/hooks/use-community-stats";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroupById, type Group } from "@/lib/actions/groups";
import { checkIsModerator, fetchPendingReportCount } from "@/lib/actions/moderation";
import { supabase } from "@/lib/Supabase";
import { useUser } from "@clerk/clerk-expo";
import { useGlobalSearchParams, useRouter } from "expo-router";
import { FileText, Shield } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 8;

export default function CommunityPostsTab() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const communityId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();

  const [community, setCommunity] = useState<Group | null>(null);
  const { membersCount: members, onlineCount } = useCommunityStats(communityId);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [pendingReports, setPendingReports] = useState(0);

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

  const loadCommunityMeta = useCallback(
    async (showLoader = false) => {
      if (!communityId) return;
      if (showLoader) setLoading(true);

      const [{ data }, modStatus, reportCount] = await Promise.all([
        fetchGroupById(communityId),
        checkIsModerator(communityId, user?.id),
        fetchPendingReportCount(communityId),
      ]);

      setCommunity(data ?? null);
      const isOwner = !!data?.owner_id && data.owner_id === user?.id;
      setIsModerator(modStatus || isOwner);
      setPendingReports(reportCount);
      if (showLoader) setLoading(false);
    },
    [communityId, user?.id],
  );

  useEffect(() => {
    if (!communityId) return;
    void loadCommunityMeta(true);
  }, [communityId, loadCommunityMeta]);

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

  const handleRefresh = useCallback(async () => {
    if (!communityId) return;
    setRefreshing(true);
    try {
      await Promise.all([loadCommunityMeta(false), fetchPosts(1, true)]);
    } finally {
      setRefreshing(false);
    }
  }, [communityId, fetchPosts, loadCommunityMeta]);

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
        refreshing={refreshing}
        onRefresh={() => {
          void handleRefresh();
        }}
        onEndReached={() => {
          if (!postsLoading && loadingPageRef.current === null && hasMore && posts.length > 0)
            void fetchPosts(page + 1);
        }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View>
            <CommunityHeader
              community={community}
              membersCount={members}
              onlineCount={onlineCount}
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
            {isModerator && (
              <Pressable
                onPress={() => {
                  router.push(`/community/${community.id}/moderation`);
                }}
                style={[
                  styles.adminCard,
                  { backgroundColor: card, borderColor: border },
                ]}
              >
                <View
                  style={[
                    styles.adminIconWrap,
                    { backgroundColor: `${primary}18`, borderColor: `${primary}35` },
                  ]}
                >
                  <Shield size={18} color={primary} />
                </View>
                <View style={styles.adminContent}>
                  <Text style={[styles.adminTitle, { color: text }]}>
                    Admin Reports
                  </Text>
                  <Text style={[styles.adminSub, { color: secondary }]}>
                    Review reports, notify authors, or delete violating posts.
                  </Text>
                </View>
                <View
                  style={[
                    styles.adminCountPill,
                    { backgroundColor: `${pendingReports > 0 ? "#EF4444" : primary}22` },
                  ]}
                >
                  <Text
                    style={[
                      styles.adminCountText,
                      { color: pendingReports > 0 ? "#EF4444" : primary },
                    ]}
                  >
                    {pendingReports}
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
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
  adminCard: {
    marginHorizontal: 14,
    marginTop: 2,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  adminIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  adminContent: {
    flex: 1,
  },
  adminTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  adminSub: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  adminCountPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  adminCountText: {
    fontSize: 12,
    fontWeight: "800",
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
