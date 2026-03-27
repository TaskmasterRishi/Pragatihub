import AppLoader from "@/components/AppLoader";
import CommentItem from "@/components/CommentItem";
import PostListItem from "@/components/PostListItem";
import Settings from "@/components/Settings";
import CustomDialog, {
  CustomDialogAction,
} from "@/components/ui/custom-dialog";
import { Comment, Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Group } from "@/lib/actions/groups";
import { deletePost } from "@/lib/actions/posts";
import { supabase } from "@/lib/Supabase";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  FileText,
  MessageCircle,
  MessageSquare,
  Pen,
  Settings as SettingsIcon,
  Users,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";

type ProfileTab = "posts" | "comments" | "communities";

type ProfileViewProps = {
  profileUserId: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  isOwnProfile: boolean;
  updatingImage?: boolean;
  onEditImage?: () => void | Promise<void>;
};

const PROFILE_AWARDS = [
  { id: "insightful", emoji: "🧠", label: "Insightful", color: "#0EA5E9" },
  { id: "helpful", emoji: "🤝", label: "Helpful", color: "#10B981" },
  { id: "creative", emoji: "🎨", label: "Creative", color: "#8B5CF6" },
  { id: "motivating", emoji: "🚀", label: "Motivating", color: "#F97316" },
  { id: "quality", emoji: "🏆", label: "High Quality", color: "#EAB308" },
  { id: "community", emoji: "💬", label: "Community Pick", color: "#EC4899" },
  { id: "off_topic", emoji: "🧩", label: "Off-topic", color: "#6B7280" },
  { id: "misleading", emoji: "⚠️", label: "Misleading", color: "#EF4444" },
  { id: "low_effort", emoji: "🪫", label: "Low Effort", color: "#9CA3AF" },
  { id: "toxic", emoji: "🚫", label: "Toxic", color: "#DC2626" },
] as const;
type ProfileAwardId = (typeof PROFILE_AWARDS)[number]["id"];
const PROFILE_AWARD_IDS = new Set<string>(
  PROFILE_AWARDS.map((award) => award.id),
);
const createEmptyProfileAwardCounts = () =>
  Object.fromEntries(PROFILE_AWARDS.map((award) => [award.id, 0])) as Record<
    ProfileAwardId,
    number
  >;
const isProfileAwardId = (value: string): value is ProfileAwardId =>
  PROFILE_AWARD_IDS.has(value);

export default function ProfileView({
  profileUserId,
  displayName,
  username,
  avatarUrl,
  isOwnProfile,
  updatingImage = false,
  onEditImage,
}: ProfileViewProps) {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState(
    displayName || "User",
  );
  const [profileUsername, setProfileUsername] = useState(
    username?.trim()?.length ? username : "@user",
  );
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [userComments, setUserComments] = useState<
    (Comment & { post?: { id: string; title: string } })[]
  >([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [userCommunities, setUserCommunities] = useState<Group[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [karmaCount, setKarmaCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [awardCounts, setAwardCounts] = useState<
    Record<ProfileAwardId, number>
  >(createEmptyProfileAwardCounts);
  const [refreshing, setRefreshing] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogActions, setDialogActions] = useState<CustomDialogAction[]>([]);

  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const textSecondaryColor = useThemeColor({}, "textSecondary");
  const primaryColor = useThemeColor({}, "primary");
  const primaryForeground = useThemeColor({}, "primaryForeground");

  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [tabContainerWidth, setTabContainerWidth] = useState(0);
  const tabIndex = useRef(new Animated.Value(0)).current;
  const visibleTabs = useMemo<ProfileTab[]>(
    () =>
      isOwnProfile
        ? ["posts", "comments", "communities"]
        : ["posts", "communities"],
    [isOwnProfile],
  );

  const postsTabScale = useRef(new Animated.Value(1)).current;
  const commentsTabScale = useRef(new Animated.Value(1)).current;
  const communitiesTabScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setProfileDisplayName(displayName || "User");
  }, [displayName]);

  useEffect(() => {
    setProfileUsername(username?.trim()?.length ? username : "@user");
  }, [username]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab("posts");
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    const index = Math.max(0, visibleTabs.indexOf(activeTab));
    Animated.spring(tabIndex, {
      toValue: index,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [activeTab, tabIndex, visibleTabs]);

  const fetchUserPosts = async (userId: string) => {
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
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      if (error) {
        console.log("Profile posts fetch error:", error);
      }
      setUserPosts([]);
      setPostCount(0);
      setKarmaCount(0);
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
          is_edited:
            //@ts-ignore
            typeof post.updated_at === "string" &&
            //@ts-ignore
            new Date(post.updated_at).getTime() >
              new Date(post.created_at).getTime(),
        };
      }),
    );

    setUserPosts(postsWithCounts);
    setPostCount(postsWithCounts.length);
    setKarmaCount(
      postsWithCounts.reduce((total, post) => total + (post.upvotes ?? 0), 0),
    );
    setPostsLoading(false);
  };

  const fetchUserCommunities = async (userId: string) => {
    setCommunitiesLoading(true);

    const { data, error } = await supabase
      .from("user_groups")
      .select("group:groups(id, name, image)")
      .eq("user_id", userId);

    if (error || !data) {
      if (error) {
        console.log("Profile communities fetch error:", error);
      }
      setUserCommunities([]);
      setCommunitiesLoading(false);
      return;
    }

    const groups = data.map((item) => item.group).filter(Boolean) as Group[];

    setUserCommunities(groups);
    setCommunitiesLoading(false);
  };

  const fetchUserComments = async (userId: string) => {
    setCommentsLoading(true);

    const { data, error } = await supabase
      .from("comments")
      .select(
        `
        *,
        user:users!comments_user_id_fkey(*),
        post:posts(id, title),
        upvotes:comment_upvotes(count),
        downvotes:comment_downvotes(count)
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      if (error) {
        console.log("Profile comments fetch error:", error);
      }
      setUserComments([]);
      setCommentsLoading(false);
      return;
    }

    const comments = data.map((comment) => ({
      id: comment.id,
      post_id: comment.post_id,
      content: comment.comment,
      created_at: comment.created_at,
      upvotes: comment.upvotes?.[0]?.count || 0,
      downvotes: comment.downvotes?.[0]?.count || 0,
      user: comment.user,
      replies: [],
      post: comment.post
        ? { id: comment.post.id, title: comment.post.title }
        : undefined,
    }));

    setUserComments(comments);
    setCommentsLoading(false);
  };

  const fetchUserAwardBreakdown = async (userId: string) => {
    const { data, error } = await supabase
      .from("post_badge_awards")
      .select("badge_key")
      .eq("awarded_to_user_id", userId);

    if (error) {
      console.log("Profile awards breakdown fetch error:", error);
      setAwardCounts(createEmptyProfileAwardCounts());
      return;
    }

    const nextCounts = createEmptyProfileAwardCounts();
    for (const row of data ?? []) {
      const badgeKey = String((row as { badge_key?: string }).badge_key ?? "");
      if (!isProfileAwardId(badgeKey)) continue;
      nextCounts[badgeKey] = (nextCounts[badgeKey] ?? 0) + 1;
    }
    setAwardCounts(nextCounts);
  };

  useEffect(() => {
    if (!profileUserId) return;
    const loaders = [
      fetchUserPosts(profileUserId),
      fetchUserCommunities(profileUserId),
      fetchUserAwardBreakdown(profileUserId),
    ];
    if (isOwnProfile) {
      loaders.push(fetchUserComments(profileUserId));
    } else {
      setUserComments([]);
      setCommentsLoading(false);
    }
    void Promise.all(loaders);
  }, [profileUserId, isOwnProfile]);

  const handleRefresh = async () => {
    if (!profileUserId || refreshing) return;
    setRefreshing(true);
    try {
      const loaders = [
        fetchUserPosts(profileUserId),
        fetchUserCommunities(profileUserId),
        fetchUserAwardBreakdown(profileUserId),
      ];
      if (isOwnProfile) {
        loaders.push(fetchUserComments(profileUserId));
      }
      await Promise.all(loaders);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTabPress = (tab: ProfileTab) => {
    const scaleAnim =
      tab === "posts"
        ? postsTabScale
        : tab === "comments"
          ? commentsTabScale
          : communitiesTabScale;

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
  };
  const getTabScale = (tab: ProfileTab) =>
    tab === "posts"
      ? postsTabScale
      : tab === "comments"
        ? commentsTabScale
        : communitiesTabScale;
  const tabWidth =
    tabContainerWidth > 0 ? (tabContainerWidth - 8) / visibleTabs.length : 0;

  const handleOpenEditPost = (post: Post) => {
    if (!isOwnProfile) return;
    setEditingPost(post);
    setEditTitle(post.title);
    setEditDescription(post.description ?? "");
  };

  const handleSaveEditedPost = async () => {
    if (!isOwnProfile || !editingPost || savingEdit) return;
    const title = editTitle.trim();
    const description = editDescription.trim();
    if (!title) {
      Alert.alert("Title required", "Please enter a title for your post.");
      return;
    }

    setSavingEdit(true);
    const { error } = await supabase
      .from("posts")
      .update({
        title,
        description: description.length > 0 ? description : null,
      })
      .eq("id", editingPost.id)
      .eq("user_id", profileUserId);

    if (error) {
      setSavingEdit(false);
      Alert.alert("Could not update post", error.message ?? "Try again.");
      return;
    }

    const editedAt = new Date().toISOString();
    setUserPosts((prev) =>
      prev.map((post) =>
        post.id === editingPost.id
          ? {
              ...post,
              title,
              description: description.length > 0 ? description : null,
              updated_at: editedAt,
              is_edited: true,
            }
          : post,
      ),
    );
    setEditingPost(null);
    setEditTitle("");
    setEditDescription("");
    setSavingEdit(false);
  };

  const handleDeletePost = (post: Post) => {
    if (!isOwnProfile) return;
    setDialogTitle("Delete post?");
    setDialogMessage("This action cannot be undone.");
    setDialogActions([
      { label: "Cancel", variant: "cancel" },
      {
        label: "Delete",
        variant: "destructive",
        onPress: async () => {
          const { error, storageWarning } = await deletePost(
            post.id,
            profileUserId,
          );

          if (error) {
            Alert.alert("Could not delete post", error.message ?? "Try again.");
            return;
          }

          setUserPosts((prev) => prev.filter((item) => item.id !== post.id));
          setPostCount((prev) => Math.max(0, prev - 1));
          setKarmaCount((prev) => Math.max(0, prev - (post.upvotes ?? 0)));

          if (storageWarning) {
            Alert.alert(
              "Post deleted with warning",
              `Media cleanup issue: ${storageWarning}`,
            );
          }
        },
      },
    ]);
    setDialogVisible(true);
  };

  const handleSharePost = async (post: Post) => {
    try {
      await Share.share({
        message: `${post.title}\n\nhttps://pragatihub.app/post/${post.id}`,
      });
    } catch (error) {
      console.log("Profile share post error:", error);
      if (ToastAndroid?.show) {
        ToastAndroid.show("Could not share post", ToastAndroid.SHORT);
      }
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={primaryForeground}
          />
        }
      >
        <View
          style={{
            paddingTop: 10,
            paddingBottom: 30,
            backgroundColor: primaryColor,
          }}
          className="rounded-[25px] px-5"
        >
          <View className="mb-2 pt-3 flex-row items-center justify-between">
            <TouchableOpacity
              className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20"
              onPress={() => router.back()}
            >
              <ChevronLeft size={24} color={primaryForeground} />
            </TouchableOpacity>

            {isOwnProfile ? (
              <TouchableOpacity
                onPress={() => setShowSettings(true)}
                className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20"
              >
                <SettingsIcon size={24} color={primaryForeground} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/(protected)/dm/[id]",
                    params: {
                      id: profileUserId,
                      name: profileDisplayName || "User",
                    },
                  })
                }
                className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20"
              >
                <MessageCircle size={22} color={primaryForeground} />
              </TouchableOpacity>
            )}
          </View>

          <View className="w-full flex-row-reverse items-center justify-between mx-auto px-2">
            <View className="flex-row gap-6">
              <View className="items-center">
                <Text
                  className="text-base font-bold"
                  style={{ color: primaryForeground }}
                >
                  {karmaCount}
                </Text>
                <Text className="text-xs text-white/70">Upvotes</Text>
              </View>
              <View className="items-center">
                <Text
                  className="text-base font-bold"
                  style={{ color: primaryForeground }}
                >
                  {postCount}
                </Text>
                <Text className="text-xs text-white/70">Posts</Text>
              </View>
            </View>
            <View className="items-start flex-1 pr-4">
              <Text
                className="text-left text-xl font-bold"
                style={{ color: primaryForeground }}
                numberOfLines={1}
              >
                {profileDisplayName || "User"}
              </Text>
              <Text
                className="mt-1 text-left text-sm text-white/80"
                numberOfLines={1}
              >
                {profileUsername}
              </Text>
            </View>
          </View>

          <View className="items-center" style={{ marginBottom: -64 }}>
            <View
              className="relative rounded-full p-2"
              style={{
                backgroundColor: backgroundColor,
                borderWidth: 4,
                borderColor: backgroundColor,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Image
                source={{ uri: avatarUrl ?? "https://via.placeholder.com/150" }}
                className="h-36 w-36 rounded-full bg-gray-300"
                style={{
                  opacity: updatingImage ? 0.5 : 1,
                }}
              />
              {updatingImage ? (
                <AppLoader
                  size="small"
                  color="#ffffff"
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    borderRadius: 9999,
                  }}
                />
              ) : null}

              {isOwnProfile && onEditImage ? (
                <TouchableOpacity
                  onPress={() => {
                    void onEditImage();
                  }}
                  disabled={updatingImage}
                  className="absolute -bottom-0.5 -right-0.5 h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
                  style={{
                    elevation: 6,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                  }}
                >
                  <Pen size={18} color={primaryColor} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        <View className="px-4 pt-16">
          <View
            className="rounded-2xl p-3"
            style={{
              backgroundColor: cardColor,
              borderWidth: 1,
              borderColor: "#ffffff14",
            }}
          >
            <Text
              className="text-sm font-semibold mb-3"
              style={{ color: textColor }}
            >
              All Awards
            </Text>
            <View className="flex-row flex-wrap">
              {PROFILE_AWARDS.map((award) => (
                <View key={award.id} style={{ width: "50%", padding: 4 }}>
                  <View
                    className="rounded-xl px-3 py-2 flex-row items-center justify-between"
                    style={{ backgroundColor: `${award.color}20` }}
                  >
                    <View className="flex-row items-center gap-2">
                      <Text style={{ fontSize: 15 }}>{award.emoji}</Text>
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: textColor, maxWidth: 90 }}
                        numberOfLines={1}
                      >
                        {award.label}
                      </Text>
                    </View>
                    <Text
                      className="text-sm font-bold"
                      style={{ color: textColor }}
                    >
                      {awardCounts[award.id] ?? 0}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View
            className="mt-2 flex-row rounded-2xl px-1 py-1 relative"
            style={{
              backgroundColor: cardColor,
              zIndex: 2,
              elevation: 2,
              minHeight: 52,
            }}
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              setTabContainerWidth(width);
            }}
          >
            {tabContainerWidth > 0 ? (
              <Animated.View
                style={{
                  position: "absolute",
                  left: 4,
                  top: 4,
                  bottom: 4,
                  width: tabWidth,
                  backgroundColor: primaryColor,
                  borderRadius: 12,
                  transform: [
                    {
                      translateX: tabIndex.interpolate({
                        inputRange: visibleTabs.map((_, i) => i),
                        outputRange: visibleTabs.map((_, i) => i * tabWidth),
                      }),
                    },
                  ],
                }}
              />
            ) : null}

            {visibleTabs.map((tab) => (
              <Animated.View
                key={tab}
                style={{
                  flex: 1,
                  transform: [{ scale: getTabScale(tab) }],
                  zIndex: 1,
                }}
              >
                <TouchableOpacity
                  onPress={() => handleTabPress(tab)}
                  className="flex-1 flex-row items-center justify-center rounded-xl py-3 gap-2"
                >
                  {tab === "posts" ? (
                    <FileText
                      size={18}
                      color={
                        activeTab === tab
                          ? primaryForeground
                          : textSecondaryColor
                      }
                      className="mr-2"
                    />
                  ) : tab === "comments" ? (
                    <MessageSquare
                      size={18}
                      color={
                        activeTab === tab
                          ? primaryForeground
                          : textSecondaryColor
                      }
                      className="mr-2"
                    />
                  ) : (
                    <Users
                      size={18}
                      color={
                        activeTab === tab
                          ? primaryForeground
                          : textSecondaryColor
                      }
                      className="mr-2"
                    />
                  )}
                  <Text
                    className="font-semibold"
                    style={{
                      color:
                        activeTab === tab
                          ? primaryForeground
                          : textSecondaryColor,
                    }}
                  >
                    {tab === "posts"
                      ? "Posts"
                      : tab === "comments"
                        ? "Comments"
                        : "Communities"}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          <View className="mt-4">
            {activeTab === "posts" ? (
              <View>
                {postsLoading ? (
                  <AppLoader
                    size="small"
                    color={textSecondaryColor}
                    style={{ paddingVertical: 32 }}
                  />
                ) : userPosts.length > 0 ? (
                  <View className="gap-3">
                    {userPosts.map((post) => (
                      <PostListItem
                        key={post.id}
                        post={post}
                        showOwnerActions={isOwnProfile}
                        onEditPost={
                          isOwnProfile ? handleOpenEditPost : undefined
                        }
                        onDeletePost={
                          isOwnProfile ? handleDeletePost : undefined
                        }
                        onSharePost={handleSharePost}
                      />
                    ))}
                  </View>
                ) : (
                  <View className="items-center justify-center py-8">
                    <FileText
                      size={48}
                      color={textSecondaryColor}
                      className="opacity-50"
                    />
                    <Text
                      className="text-center font-medium"
                      style={{ color: textColor }}
                    >
                      No posts yet
                    </Text>
                    <Text
                      className="mt-1 text-center text-sm"
                      style={{ color: textSecondaryColor }}
                    >
                      {isOwnProfile
                        ? "Your posts will appear here"
                        : "Posts by this user will appear here"}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {activeTab === "comments" ? (
              <View>
                {commentsLoading ? (
                  <AppLoader
                    size="small"
                    color={textSecondaryColor}
                    style={{ paddingVertical: 32 }}
                  />
                ) : userComments.length > 0 ? (
                  <View className="gap-3">
                    {userComments.map((comment) => (
                      <View key={comment.id}>
                        {comment.post ? (
                          <TouchableOpacity
                            onPress={() =>
                              router.push(`/post/${comment.post_id}`)
                            }
                            className="mb-2 rounded-xl px-3 py-2"
                            style={{ backgroundColor: cardColor }}
                          >
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: textSecondaryColor }}
                            >
                              Commented on
                            </Text>
                            <Text
                              className="text-sm font-semibold"
                              style={{ color: textColor }}
                            >
                              {comment.post.title}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        <CommentItem comment={comment} />
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className="items-center justify-center py-8">
                    <MessageSquare
                      size={48}
                      color={textSecondaryColor}
                      className="opacity-50"
                    />
                    <Text
                      className="text-center font-medium"
                      style={{ color: textColor }}
                    >
                      No comments yet
                    </Text>
                    <Text
                      className="mt-1 text-center text-sm"
                      style={{ color: textSecondaryColor }}
                    >
                      {isOwnProfile
                        ? "Your comments will appear here"
                        : "Comments by this user will appear here"}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {activeTab === "communities" ? (
              <View>
                {communitiesLoading ? (
                  <AppLoader
                    size="small"
                    color={textSecondaryColor}
                    style={{ paddingVertical: 32 }}
                  />
                ) : userCommunities.length > 0 ? (
                  <View className="gap-3">
                    {userCommunities.map((group) => (
                      <TouchableOpacity
                        key={group.id}
                        className="flex-row items-center gap-3 rounded-2xl px-4 py-3"
                        style={{ backgroundColor: cardColor }}
                        onPress={() => router.push(`/community/${group.id}`)}
                      >
                        <Image
                          source={{ uri: group.image ?? undefined }}
                          className="h-12 w-12 rounded-xl bg-gray-200"
                        />
                        <View className="flex-1">
                          <Text
                            className="text-base font-semibold"
                            style={{ color: textColor }}
                          >
                            {group.name}
                          </Text>
                          <Text
                            className="text-sm"
                            style={{ color: textSecondaryColor }}
                          >
                            Tap to view community
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View className="items-center justify-center py-8">
                    <Users
                      size={48}
                      color={textSecondaryColor}
                      className="opacity-50"
                    />
                    <Text
                      className="text-center font-medium"
                      style={{ color: textColor }}
                    >
                      No communities yet
                    </Text>
                    <Text
                      className="mt-1 text-center text-sm"
                      style={{ color: textSecondaryColor }}
                    >
                      {isOwnProfile
                        ? "Communities you join will appear here"
                        : "Communities joined by this user will appear here"}
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {isOwnProfile ? (
        <Modal
          visible={showSettings}
          animationType="slide"
          onRequestClose={() => setShowSettings(false)}
        >
          <Settings
            onClose={() => setShowSettings(false)}
            onDisplayNameUpdated={(nextDisplayName) => {
              setProfileDisplayName(nextDisplayName);
            }}
          />
        </Modal>
      ) : null}

      {isOwnProfile ? (
        <Modal
          visible={!!editingPost}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setEditingPost(null)}
        >
          <View
            className="flex-1 items-center justify-center px-5"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          >
            <View
              className="w-full rounded-2xl p-4"
              style={{ backgroundColor: cardColor }}
            >
              <Text
                className="mb-3 text-lg font-semibold"
                style={{ color: textColor }}
              >
                Edit post
              </Text>

              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Post title"
                placeholderTextColor={textSecondaryColor}
                className="mb-3 rounded-xl px-3 py-2"
                style={{
                  color: textColor,
                  borderWidth: 1,
                  borderColor: `${textSecondaryColor}55`,
                }}
              />

              <TextInput
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Post description"
                placeholderTextColor={textSecondaryColor}
                multiline
                textAlignVertical="top"
                className="mb-4 rounded-xl px-3 py-2"
                style={{
                  color: textColor,
                  minHeight: 110,
                  borderWidth: 1,
                  borderColor: `${textSecondaryColor}55`,
                }}
              />

              <View className="flex-row justify-end gap-2">
                <TouchableOpacity
                  onPress={() => setEditingPost(null)}
                  className="rounded-xl px-4 py-2"
                  style={{ backgroundColor: `${textSecondaryColor}25` }}
                  disabled={savingEdit}
                >
                  <Text style={{ color: textColor }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveEditedPost}
                  className="rounded-xl px-4 py-2"
                  style={{ backgroundColor: primaryColor }}
                  disabled={savingEdit}
                >
                  <Text style={{ color: primaryForeground }}>
                    {savingEdit ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      <CustomDialog
        visible={dialogVisible}
        title={dialogTitle}
        message={dialogMessage}
        actions={dialogActions}
        onClose={() => setDialogVisible(false)}
      />
    </View>
  );
}
