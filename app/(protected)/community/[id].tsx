import AppLoader from "@/components/AppLoader";
import PostListItem from "@/components/PostListItem";
import { Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroupById, type Group } from "@/lib/actions/groups";
import { joinUserGroup, leaveUserGroup } from "@/lib/actions/user-groups";
import { supabase } from "@/lib/Supabase";
import { useUser } from "@clerk/clerk-expo";
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
  const { user: clerkUser } = useUser();

  const communityId = Array.isArray(id) ? id[0] : id;

  const [community, setCommunity] = useState<Group | null>(null);
  const [members, setMembers] = useState(0);
  const [loading, setLoading] = useState(true);

  const [posts, setPosts] = useState<Post[]>([]);
  const [sort, setSort] = useState<SortMode>("hot");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [isJoined, setIsJoined] = useState(false);

  const bg = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const border = useThemeColor({}, "border");
  const card = useThemeColor({}, "card");
  const primary = useThemeColor({}, "primary");
  const tint = useThemeColor({}, "tint");

  useEffect(() => {
    if (!communityId) return;

    const load = async () => {
      setLoading(true);

      const userId = clerkUser?.id;

      const [{ data }, membersRes] = await Promise.all([
        fetchGroupById(communityId),
        supabase
          .from("user_groups")
          .select("group_id, user_id", { count: "exact" }) // count exact requires no head sometimes to return row data too
          .eq("group_id", communityId),
      ]);

      setCommunity(data ?? null);
      if (membersRes.count !== null) setMembers(membersRes.count);

      if (userId && membersRes.data) {
        const joined = membersRes.data.some((m) => m.user_id === userId);
        setIsJoined(joined);
      }

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

  const toggleJoin = async () => {
    const userId = clerkUser?.id;
    if (!userId || !communityId) return;

    if (isJoined) {
      const { error } = await leaveUserGroup({
        userId,
        groupId: communityId,
      });
      if (!error) {
        setIsJoined(false);
        setMembers((prev) => Math.max(0, prev - 1));
      } else {
        console.log("Error leaving group", error);
      }
    } else {
      const { error } = await joinUserGroup({
        userId,
        groupId: communityId,
      });
      if (!error) {
        setIsJoined(true);
        setMembers((prev) => prev + 1);
      } else {
        console.log("Error joining group", error);
      }
    }
  };

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
      {/* Floating Transparent Top Bar over banner */}
      <View style={[styles.headerFloating, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft size={28} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.iconBtn}>
            <Search size={22} color="#fff" />
          </Pressable>
          <Pressable style={styles.iconBtn}>
            <Share size={22} color="#fff" />
          </Pressable>
          <Pressable style={styles.iconBtn}>
            <MoreHorizontal size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={sortedPosts}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <PostListItem post={item} hideJoinButton />}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (!postsLoading && hasMore) fetchPosts(page + 1);
        }}
        onEndReachedThreshold={0.5}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: 8,
              backgroundColor:
                bg === "#000000" || bg === "#121212" ? "#000" : "#e5e5e5",
            }}
          /> // Reddit spacing between cards
        )}
        ListHeaderComponent={
          <View style={{ backgroundColor: card, marginBottom: 8 }}>
            {/* BANNER */}
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

            {/* COMMUNITY INFO */}
            <View style={styles.infoContainer}>
              <View style={styles.avatarRow}>
                <Image
                  source={{ uri: community.image ?? undefined }}
                  style={[styles.avatar, { borderColor: card, borderWidth: 4 }]}
                />
                <Pressable
                  onPress={toggleJoin}
                  style={[
                    styles.joinButton,
                    {
                      backgroundColor: isJoined ? "transparent" : tint,
                      borderColor: isJoined ? border : tint,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.joinButtonText,
                      { color: isJoined ? text : "#fff" },
                    ]}
                  >
                    {isJoined ? "Joined" : "Join"}
                  </Text>
                </Pressable>
              </View>

              <Text style={[styles.communityName, { color: text }]}>
                {community.name}
              </Text>
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
                  <Text style={[styles.statValue, { color: text }]}>
                    <View style={styles.onlineDot} />{" "}
                    {Math.max(1, Math.floor(members * 0.1)).toLocaleString()}
                  </Text>
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
                  backgroundColor:
                    bg === "#000000" || bg === "#121212" ? "#000" : "#f8f9fa",
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

function SortTab({ label, Icon, active, onPress, primary, secondary }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.sortTab, active && { backgroundColor: "#8882" }]}
    >
      <Icon size={16} color={active ? primary : secondary} />
      <Text
        style={{
          color: active ? primary : secondary,
          fontWeight: "600",
          fontSize: 13,
        }}
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

  headerFloating: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  headerLeft: {
    flexDirection: "row",
  },

  headerRight: {
    flexDirection: "row",
    gap: 12,
  },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
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

  joinButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 4,
  },

  joinButtonText: {
    fontWeight: "700",
    fontSize: 14,
  },

  communityName: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 2,
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

  statValue: {
    fontSize: 14,
    fontWeight: "700",
    flexDirection: "row",
    alignItems: "center",
  },

  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },

  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#44d13d",
    marginRight: 4,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
});
