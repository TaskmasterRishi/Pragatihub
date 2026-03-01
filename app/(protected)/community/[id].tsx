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
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
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
          paddingHorizontal: 12,
          flexGrow: 1,
        }}
        data={sortedPosts}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <PostListItem post={item} hideJoinButton />}
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

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: text }]}>
                    {members.toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: secondary }]}>
                    Members
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <View style={styles.statValueRow}>
                    <View
                      style={[styles.onlineDot, { backgroundColor: success }]}
                    />
                    <Text style={[styles.statValue, { color: text }]}>
                      {Math.max(1, Math.floor(members * 0.1)).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={[styles.statLabel, { color: secondary }]}>
                    Online
                  </Text>
                </View>
              </View>
            </View>

            {/* SORT BAR */}
            <View
              style={[
                styles.sortBar,
                {
                  borderBottomWidth: 1,
                  borderTopWidth: 1,
                  borderColor: border,
                  backgroundColor: backgroundSecondary,
                },
              ]}
            >
              <SortTab
                label="Hot"
                Icon={Flame}
                active={sort === "hot"}
                onPress={() => setSort("hot")}
                primary={text}
                secondary={secondary}
              />
              <SortTab
                label="New"
                Icon={Clock3}
                active={sort === "new"}
                onPress={() => setSort("new")}
                primary={text}
                secondary={secondary}
              />
              <SortTab
                label="Top"
                Icon={Trophy}
                active={sort === "top"}
                onPress={() => setSort("top")}
                primary={text}
                secondary={secondary}
              />
            </View>
          </View>
        }
      />
    </View>
  );
}

type SortTabProps = {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  active: boolean;
  onPress: () => void;
  primary: string;
  secondary: string;
};

function SortTab({
  label,
  Icon,
  active,
  onPress,
  primary,
  secondary,
}: SortTabProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sortTab,
        active && styles.sortTabActive,
        pressed && styles.sortTabPressed,
      ]}
    >
      <Icon size={16} color={active ? primary : secondary} />
      <Text
        style={[styles.sortTabLabel, { color: active ? primary : secondary }]}
      >
        {label}
      </Text>
    </Pressable>
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
    gap: 24,
  },

  statItem: {
    flexDirection: "column",
  },

  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  statValue: {
    fontSize: 14,
    fontWeight: "700",
  },

  statLabel: {
    fontSize: 12,
    marginTop: 2,
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

  sortBar: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },

  sortTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },

  sortTabActive: {
    backgroundColor: "rgba(128, 128, 128, 0.15)",
  },

  sortTabPressed: {
    opacity: 0.8,
  },

  sortTabLabel: {
    fontWeight: "600",
    fontSize: 13,
  },
});
