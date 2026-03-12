import AppLoader from "@/components/AppLoader";
import JoinCommunityButton from "@/components/JoinCommunityButton";
import PostListItem from "@/components/PostListItem";
import { Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroupById, type Group } from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import type { Tables } from "@/types/database.types";
import { useUser } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  MoreHorizontal,
  Search,
  Share,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Share as NativeShare,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 8;

type CommunityTab = "posts" | "members";

type MemberUser = {
  id: string;
  name: string;
  image: string | null;
  joined_at: string | null;
};

type GroupModeratorRow = Tables<"group_moderators">;

export default function CommunityPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const insets = useSafeAreaInsets();

  const communityId = Array.isArray(id) ? id[0] : id;

  const [community, setCommunity] = useState<Group | null>(null);
  const [members, setMembers] = useState(0);
  const [loading, setLoading] = useState(true);

  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<CommunityTab>("posts");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [memberUsers, setMemberUsers] = useState<MemberUser[]>([]);
  const [moderatorIds, setModeratorIds] = useState<Set<string>>(new Set());
  const [membersLoading, setMembersLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const [tabContainerWidth, setTabContainerWidth] = useState(0);
  const tabIndex = useRef(new Animated.Value(0)).current;
  const postsTabScale = useRef(new Animated.Value(1)).current;
  const membersTabScale = useRef(new Animated.Value(1)).current;
  const postsRequestIdRef = useRef(0);
  const membersRequestIdRef = useRef(0);
  const loadingPageRef = useRef<number | null>(null);
  const membersLoadedRef = useRef(false);

  const bg = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const border = useThemeColor({}, "border");
  const card = useThemeColor({}, "card");
  const primary = useThemeColor({}, "primary");
  const secondaryColor = useThemeColor({}, "secondary");
  const tint = useThemeColor({}, "tint");
  const backgroundSecondary = useThemeColor({}, "backgroundSecondary");
  const success = useThemeColor({}, "success");
  const primaryForeground = useThemeColor({}, "primaryForeground");

  // Slide indicator when active tab changes
  useEffect(() => {
    const index = activeTab === "posts" ? 0 : 1;
    Animated.spring(tabIndex, {
      toValue: index,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [activeTab, tabIndex]);

  useEffect(() => {
    if (!communityId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const [{ data }, membersRes] = await Promise.all([
        fetchGroupById(communityId),
        supabase
          .from("user_groups")
          .select("group_id, user_id", { count: "exact" }) // count exact requires no head sometimes to return row data too
          .eq("group_id", communityId),
      ]);

      if (cancelled) return;
      setCommunity(data ?? null);
      if (membersRes.count !== null) setMembers(membersRes.count);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
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

  const fetchMembers = useCallback(async () => {
    if (!communityId || membersLoadedRef.current) return;
    const requestId = ++membersRequestIdRef.current;
    setMembersLoading(true);

    try {
      const [{ data, error }, moderatorsRes] = await Promise.all([
        supabase
          .from("user_groups")
          .select(
            `
          joined_at,
          user:users(id, name, image)
        `,
          )
          .eq("group_id", communityId)
          .order("joined_at", { ascending: false }),
        supabase
          .from("group_moderators")
          .select("user_id, is_active")
          .eq("group_id", communityId)
          .eq("is_active", true),
      ]);

      if (requestId !== membersRequestIdRef.current) return;
      if (!error && data) {
        const mapped = (data as any[])
          .map((row) =>
            row.user
              ? {
                  id: row.user.id as string,
                  name: row.user.name as string,
                  image: (row.user.image as string) ?? null,
                  joined_at: (row.joined_at as string) ?? null,
                }
              : null,
          )
          .filter(Boolean) as MemberUser[];

        const nextModeratorIds = new Set<string>();
        if (!moderatorsRes.error && moderatorsRes.data) {
          for (const row of moderatorsRes.data as GroupModeratorRow[]) {
            nextModeratorIds.add(row.user_id);
          }
        }

        setModeratorIds(nextModeratorIds);
        setMemberUsers(mapped);
        membersLoadedRef.current = true;
      }
    } finally {
      if (requestId === membersRequestIdRef.current) {
        setMembersLoading(false);
      }
    }
  }, [communityId]);

  useEffect(() => {
    if (!communityId) return;
    postsRequestIdRef.current += 1;
    membersRequestIdRef.current += 1;
    loadingPageRef.current = null;
    membersLoadedRef.current = false;
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setMemberUsers([]);
    setModeratorIds(new Set());
    setPostsLoading(false);
    setMembersLoading(false);
    void fetchPosts(1, true);
  }, [communityId, fetchPosts]);

  useEffect(() => {
    if (activeTab === "members") {
      void fetchMembers();
    }
  }, [activeTab, fetchMembers]);

  const handleTabPress = useCallback(
    (tab: CommunityTab) => {
      if (tab === activeTab) return;
      const scaleAnim = tab === "posts" ? postsTabScale : membersTabScale;

      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      setActiveTab(tab);
    },
    [activeTab, membersTabScale, postsTabScale],
  );

  const formatJoinedDate = useCallback((value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return `Joined ${value.slice(0, 10)}`;
    return `Joined ${date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <AppLoader fullScreen />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: bg }]}>
        <Text style={[styles.notFoundTitle, { color: text }]}>
          Community not found
        </Text>
        <Text style={[styles.notFoundSubtext, { color: secondary }]}>
          This community may have been removed or the link is invalid.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: primary }]}
        >
          <ChevronLeft size={20} color="#fff" />
          <Text style={styles.backButtonLabel}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const handle = `r/${community.name.replace(/\s+/g, "")}`;
  const isOwner = !!community.owner_id && community.owner_id === user?.id;
  const canEdit = isOwner;

  const handleOpenMoreActions = () => {
    setMenuVisible(true);
  };

  const handleEditCommunity = () => {
    if (!communityId) return;
    setMenuVisible(false);
    router.push(`/community/edit/${communityId}`);
  };

  const handleShareCommunity = async () => {
    if (!communityId) return;
    setMenuVisible(false);
    try {
      await NativeShare.share({
        message: `Join ${community.name}\n\nhttps://pragatihub.app/community/${communityId}`,
      });
    } catch (error) {
      console.log("Community share error:", error);
    }
  };

  const handleOpenMembers = () => {
    setMenuVisible(false);
    setActiveTab("members");
  };

  const handleOpenPosts = () => {
    setMenuVisible(false);
    setActiveTab("posts");
  };

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
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
        data={activeTab === "posts" ? posts : (memberUsers as any)}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) =>
          activeTab === "posts" ? (
            <View style={styles.postListItemWrap}>
              <PostListItem post={item as Post} hideJoinButton />
            </View>
          ) : (
            (() => {
              const member = item as unknown as MemberUser;
              const isOwnerMember =
                !!community.owner_id && member.id === community.owner_id;
              const showModeratorBadge =
                isOwnerMember || moderatorIds.has(member.id);

              return (
                <View
                  style={[
                    styles.memberItemWrap,
                    { backgroundColor: card, borderColor: border },
                  ]}
                >
                  <View
                    style={[styles.memberAvatarRing, { borderColor: border }]}
                  >
                    {member.image ? (
                      <Image
                        source={{ uri: member.image ?? undefined }}
                        style={styles.memberAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.memberAvatar,
                          styles.memberAvatarFallback,
                          { backgroundColor: input },
                        ]}
                      >
                        <Text
                          style={[styles.memberAvatarInitials, { color: text }]}
                        >
                          {(member.name || "U")
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase())
                            .join("")}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.memberInfo}>
                    <Text
                      style={[styles.memberName, { color: text }]}
                      numberOfLines={1}
                    >
                      {member.name}
                    </Text>
                    {member.joined_at && (
                      <Text
                        style={[styles.memberMeta, { color: secondary }]}
                        numberOfLines={1}
                      >
                        {formatJoinedDate(member.joined_at)}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.memberPill,
                      {
                        backgroundColor: showModeratorBadge
                          ? `${primary}22`
                          : backgroundSecondary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.memberPillLabel,
                        { color: showModeratorBadge ? primary : secondary },
                      ]}
                    >
                      {showModeratorBadge ? "Moderator" : "Member"}
                    </Text>
                  </View>
                </View>
              );
            })()
          )
        }
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (
            activeTab === "posts" &&
            !postsLoading &&
            loadingPageRef.current === null &&
            hasMore &&
            posts.length > 0
          )
            void fetchPosts(page + 1);
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          activeTab === "posts" ? (
            postsLoading && posts.length === 0 ? (
              <View
                style={[
                  styles.emptyContainer,
                  styles.emptyContainerGrow,
                  { backgroundColor: bg },
                ]}
              >
                <ActivityIndicator size="large" color={tint} />
                <Text style={[styles.emptyText, { color: secondary }]}>
                  Loading posts…
                </Text>
              </View>
            ) : !postsLoading && posts.length === 0 ? (
              <View
                style={[
                  styles.emptyContainer,
                  styles.emptyContainerGrow,
                  { backgroundColor: bg },
                ]}
              >
                <Text style={[styles.emptyTitle, { color: text }]}>
                  No posts yet
                </Text>
                <Text style={[styles.emptyText, { color: secondary }]}>
                  Be the first to share something in this community.
                </Text>
              </View>
            ) : null
          ) : membersLoading ? (
            <View
              style={[
                styles.emptyContainer,
                styles.emptyContainerGrow,
                { backgroundColor: bg },
              ]}
            >
              <ActivityIndicator size="large" color={tint} />
              <Text style={[styles.emptyText, { color: secondary }]}>
                Loading members…
              </Text>
            </View>
          ) : memberUsers.length === 0 ? (
            <View
              style={[
                styles.emptyContainer,
                styles.emptyContainerGrow,
                { backgroundColor: bg },
              ]}
            >
              <Text style={[styles.emptyTitle, { color: text }]}>
                No members yet
              </Text>
              <Text style={[styles.emptyText, { color: secondary }]}>
                When people join this community, they will appear here.
              </Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => null}
        ListFooterComponent={
          activeTab === "posts" && postsLoading && posts.length > 0 ? (
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
                    contentPosition="top"
                  />
                ) : (
                  <LinearGradient
                    colors={[primary, secondaryColor]}
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
                    {canEdit ? (
                      <Pressable
                        style={styles.iconBtn}
                        hitSlop={8}
                        onPress={handleOpenMoreActions}
                      >
                        <MoreHorizontal size={22} color="#fff" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>

            {/* COMMUNITY INFO CARD - clearly recognizable pop-up card */}
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: card,
                  borderColor: border,
                  shadowColor: "#000",
                  shadowOpacity: 0.08,
                  shadowRadius: 10,
                  elevation: 4,
                },
              ]}
            >
              <View style={styles.infoCardInner}>
                <View style={styles.avatarRow}>
                  <View style={[styles.avatarRing, { borderColor: primary }]}>
                    <Image
                      source={{ uri: community.image ?? undefined }}
                      style={[styles.avatar, { borderColor: card }]}
                    />
                  </View>
                </View>

                <View style={styles.infoCardContent}>
                  <View style={styles.nameRow}>
                    <View style={styles.nameBlock}>
                      <Text
                        style={[styles.communityName, { color: text }]}
                        numberOfLines={1}
                      >
                        {community.name}
                      </Text>
                      <Text
                        style={[styles.communityHandle, { color: secondary }]}
                        numberOfLines={1}
                      >
                        {handle}
                      </Text>
                    </View>
                    {communityId ? (
                      <View style={styles.joinButtonWrap}>
                        <JoinCommunityButton communityId={communityId} />
                      </View>
                    ) : null}
                  </View>

                  {community.description ? (
                    <View
                      style={[
                        styles.descriptionBlock,
                        {
                          backgroundColor: backgroundSecondary,
                          borderLeftColor: primary,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.description, { color: text }]}
                        numberOfLines={4}
                      >
                        {community.description}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.statsRow}>
                    <View
                      style={[
                        styles.statPill,
                        { backgroundColor: backgroundSecondary },
                      ]}
                    >
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
                    <View
                      style={[
                        styles.statPill,
                        { backgroundColor: backgroundSecondary },
                      ]}
                    >
                      <View
                        style={[styles.onlineDot, { backgroundColor: success }]}
                      />
                      <Text style={[styles.statValue, { color: text }]}>
                        {Math.max(
                          1,
                          Math.floor(members * 0.1),
                        ).toLocaleString()}
                      </Text>
                      <Text style={[styles.statLabel, { color: secondary }]}>
                        Online
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Tabs - Posts / Members (animated like profile screen) */}
            <View
              style={[
                styles.sortTabsContainer,
                { backgroundColor: backgroundSecondary, borderColor: border },
              ]}
              onLayout={(event) => {
                const { width } = event.nativeEvent.layout;
                setTabContainerWidth((prev) => (prev === width ? prev : width));
              }}
            >
              {tabContainerWidth > 0 && (
                <Animated.View
                  style={{
                    position: "absolute",
                    left: 4,
                    top: 4,
                    bottom: 4,
                    width: (tabContainerWidth - 8) / 2,
                    backgroundColor: primary,
                    borderRadius: 12,
                    transform: [
                      {
                        translateX: tabIndex.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, (tabContainerWidth - 8) / 2],
                        }),
                      },
                    ],
                  }}
                />
              )}

              <Animated.View
                style={{
                  flex: 1,
                  transform: [{ scale: postsTabScale }],
                  zIndex: 1,
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => handleTabPress("posts")}
                  style={styles.tabButton}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color:
                          activeTab === "posts" ? primaryForeground : secondary,
                      },
                    ]}
                  >
                    Posts
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View
                style={{
                  flex: 1,
                  transform: [{ scale: membersTabScale }],
                  zIndex: 1,
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => handleTabPress("members")}
                  style={styles.tabButton}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color:
                          activeTab === "members"
                            ? primaryForeground
                            : secondary,
                      },
                    ]}
                  >
                    Members
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        }
      />

      <Modal
        transparent
        visible={menuVisible}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setMenuVisible(false)}
        >
          <Pressable
            style={[
              styles.sheetCard,
              { backgroundColor: card, borderColor: border },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: text }]}>
              Community actions
            </Text>
            <Pressable style={styles.sheetAction} onPress={handleEditCommunity}>
              <Text style={[styles.sheetActionLabel, { color: text }]}>
                Edit page
              </Text>
            </Pressable>
            <Pressable
              style={styles.sheetAction}
              onPress={handleShareCommunity}
            >
              <Text style={[styles.sheetActionLabel, { color: text }]}>
                Share community
              </Text>
            </Pressable>
            <Pressable style={styles.sheetAction} onPress={handleOpenMembers}>
              <Text style={[styles.sheetActionLabel, { color: text }]}>
                Open members tab
              </Text>
            </Pressable>
            <Pressable style={styles.sheetAction} onPress={handleOpenPosts}>
              <Text style={[styles.sheetActionLabel, { color: text }]}>
                Open posts tab
              </Text>
            </Pressable>
            <Pressable
              style={[styles.sheetAction, styles.sheetCancel]}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={[styles.sheetCancelLabel, { color: secondary }]}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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

  notFoundTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },

  notFoundSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 32,
    lineHeight: 20,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },

  backButtonLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
    height: 150,
    paddingBottom: 100,
  },
  bannerImage: {
    width: "100%",
    height: 230,
  },

  infoCard: {
    marginHorizontal: 14,
    marginTop: 50,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "visible",
    shadowOffset: { width: 0, height: 6 },
  },

  infoCardInner: {
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 14,
  },

  infoCardContent: {
    overflow: "hidden",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  avatarRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    marginTop: -42,
    marginBottom: 10,
  },

  avatarRing: {
    padding: 2,
    borderRadius: 999,
    borderWidth: 2,
    alignSelf: "flex-start",
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    backgroundColor: "#e5e7eb",
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },

  nameBlock: {
    flex: 1,
    minWidth: 0,
  },

  joinButtonWrap: {
    paddingTop: 2,
    flexShrink: 0,
  },

  communityName: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  communityHandle: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
    opacity: 0.85,
  },

  descriptionBlock: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
  },

  description: {
    fontSize: 12.5,
    lineHeight: 18,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 0,
    marginTop: 4,
    gap: 10,
  },

  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
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

  emptyContainerGrow: {
    flexGrow: 1,
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
    padding: 4,
    minHeight: 44,
    marginTop: 12,
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
  },

  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },

  tabLabel: {
    fontWeight: "600",
    fontSize: 14,
  },

  memberItemWrap: {
    marginHorizontal: 14,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
  },

  memberAvatarRing: {
    padding: 1.5,
    borderRadius: 999,
    borderWidth: 1,
  },

  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e5e7eb",
  },

  memberAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },

  memberAvatarInitials: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  memberInfo: {
    flex: 1,
    minWidth: 0,
  },

  memberName: {
    fontSize: 15,
    fontWeight: "700",
  },

  memberMeta: {
    fontSize: 12.5,
    marginTop: 3,
  },

  memberPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  memberPillLabel: {
    fontSize: 11,
    fontWeight: "600",
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  sheetCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 20,
  },

  sheetTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
    paddingHorizontal: 6,
  },

  sheetAction: {
    paddingVertical: 14,
    paddingHorizontal: 6,
  },

  sheetActionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },

  sheetCancel: {
    marginTop: 2,
  },

  sheetCancelLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
});
