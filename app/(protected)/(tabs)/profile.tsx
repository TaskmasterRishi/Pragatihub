import { useUser } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  FileText,
  MessageSquare,
  Users,
  Settings as SettingsIcon,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Settings from "@/components/Settings";
import { useThemeColor } from "@/hooks/use-theme-color";
import { updateUserImage } from "@/lib/actions/users";
import { supabase } from "@/lib/Supabase";
import { Comment, Post } from "@/constants/types";
import PostListItem from "@/components/PostListItem";
import { Pen } from "lucide-react-native";
import CommentItem from "@/components/CommentItem";
import { Group } from "@/lib/actions/groups";

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [updatingImage, setUpdatingImage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
  const [refreshing, setRefreshing] = useState(false);

  const onSelectImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setUpdatingImage(true);
        const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;

        await user?.setProfileImage({ file: base64 });
        await user?.reload();

        if (user?.id) {
          const { error } = await updateUserImage({
            id: user.id,
            image: user.imageUrl ?? null,
          });

          if (error) {
            console.log("Update user image error:", error);
          }
        }

        // No need to manually refresh, Clerk generic hook should pick it up or we rely on re-render
      }
    } catch (err) {
      console.error("Error updating image:", err);
      alert("Failed to update profile image");
    } finally {
      setUpdatingImage(false);
    }
  };

  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const textSecondaryColor = useThemeColor({}, "textSecondary");
  const primaryColor = useThemeColor({}, "primary");
  const primaryForeground = useThemeColor({}, "primaryForeground");

  type ProfileTab = "posts" | "comments" | "communities";
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [tabContainerWidth, setTabContainerWidth] = useState(0);
  const tabIndex = useRef(new Animated.Value(0)).current;

  // Animation values
  const postsTabScale = useRef(new Animated.Value(1)).current;
  const commentsTabScale = useRef(new Animated.Value(1)).current;
  const communitiesTabScale = useRef(new Animated.Value(1)).current;
  const [contentWidth, setContentWidth] = useState(0);

  // Animate when tab changes
  useEffect(() => {
    const index =
      activeTab === "posts" ? 0 : activeTab === "comments" ? 1 : 2;
    Animated.spring(tabIndex, {
      toValue: index,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [activeTab]);

  useEffect(() => {
    if (!user?.id) return;
    fetchUserPosts(user.id);
    fetchUserComments(user.id);
    fetchUserCommunities(user.id);
  }, [user?.id]);

  const fetchUserPosts = async (userId: string) => {
    setPostsLoading(true);

    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        *,
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

    const groups = data
      .map((item) => item.group)
      .filter(Boolean) as Group[];

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
      post: comment.post ? { id: comment.post.id, title: comment.post.title } : undefined,
    }));

    setUserComments(comments);
    setCommentsLoading(false);
  };

  const handleRefresh = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    await Promise.all([
      fetchUserPosts(user.id),
      fetchUserComments(user.id),
      fetchUserCommunities(user.id),
    ]);
    setRefreshing(false);
  };

  const handleTabPress = (tab: ProfileTab) => {
    const scaleAnim =
      tab === "posts"
        ? postsTabScale
        : tab === "comments"
          ? commentsTabScale
          : communitiesTabScale;
    
    // Scale down on press
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

  // Counts

  return (
    <View className="flex-1" style={{ backgroundColor }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={primaryForeground}
          />
        }
      >
        {/* Custom Header Area */}
        <View
          style={{
            paddingTop: 10,
            paddingBottom: 30,
            backgroundColor: primaryColor,
          }}
          className="rounded-[25px] px-5"
        >
          {/* Top Navigation Bar */}
          <View className="mb-2 pt-3 flex-row items-center justify-between">
            <TouchableOpacity
              className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20"
              onPress={() => router.back()}
            >
              <ChevronLeft size={24} color={primaryForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowSettings(true)}
              className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20"
            >
              <SettingsIcon size={24} color={primaryForeground} />
            </TouchableOpacity>
          </View>

          {/* Profile Details - avatar centered, then name & stats */}

          <View
            className=" w-full flex-row-reverse items-center justify-between mx-auto px-2"
          >
            <View className="flex-row gap-6">
              <View className="items-center">
                <Text
                  className="text-base font-bold"
                  style={{ color: primaryForeground }}
                >
                  {karmaCount}
                </Text>
                <Text className="text-xs text-white/70">Upvote</Text>
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
            <View className="items-start">
              <Text
                className="text-left text-xl font-bold"
                style={{ color: primaryForeground }}
              >
                {user?.fullName || user?.username || "User"}
              </Text>
              <Text className="mt-1 text-left text-sm text-white/80">
                {user?.username || "username"}
              </Text>
            </View>
          </View>
          <View
            className="items-center"
            style={{ marginBottom: -64 }}
          >
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
                source={{ uri: user?.imageUrl }}
                className="h-36 w-36 rounded-full bg-gray-300"
                style={{
                  opacity: updatingImage ? 0.5 : 1,
                }}
              />
              {updatingImage && (
                <View className="absolute inset-0 items-center justify-center rounded-full">
                  <ActivityIndicator size="small" color="#ffffff" />
                </View>
              )}
              <TouchableOpacity
                onPress={onSelectImage}
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
            </View>
          </View>
        </View>

        <View className="px-4 pt-16">
          {/* Tabs - Posts | Comments | Communities */}
          <View
            className="mt-2 flex-row rounded-2xl px-1 py-1 relative"
            style={{ backgroundColor: cardColor }}
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              setTabContainerWidth(width);
            }}
          >
            {/* Sliding Background Indicator */}
            {tabContainerWidth > 0 && (
              <Animated.View
                style={{
                  position: "absolute",
                  left: 4,
                  top: 4,
                  bottom: 4,
                  width: (tabContainerWidth - 8) / 3,
                  backgroundColor: primaryColor,
                  borderRadius: 12,
                  transform: [
                    {
                      translateX: tabIndex.interpolate({
                        inputRange: [0, 1, 2],
                        outputRange: [
                          0,
                          tabContainerWidth / 3,
                          (tabContainerWidth / 3) * 2,
                        ],
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
                onPress={() => handleTabPress("posts")}
                className="flex-1 flex-row items-center justify-center rounded-xl py-3 gap-2"
              >
                <FileText
                  size={18}
                  color={
                    activeTab === "posts"
                      ? primaryForeground
                      : textSecondaryColor
                  }
                  className="mr-2"
                />
                <Text
                  className="font-semibold"
                  style={{
                    color:
                      activeTab === "posts"
                        ? primaryForeground
                        : textSecondaryColor,
                  }}
                >
                  Posts
                </Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View
              style={{
                flex: 1,
                transform: [{ scale: commentsTabScale }],
                zIndex: 1,
              }}
            >
              <TouchableOpacity
                onPress={() => handleTabPress("comments")}
                className="flex-1 flex-row items-center justify-center rounded-xl py-3 gap-2"
              >
                <MessageSquare
                  size={18}
                  color={
                    activeTab === "comments"
                      ? primaryForeground
                      : textSecondaryColor
                  }
                  className="mr-2"
                />
                <Text
                  className="font-semibold"
                  style={{
                    color:
                      activeTab === "comments"
                        ? primaryForeground
                        : textSecondaryColor,
                  }}
                >
                  Comments
                </Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View
              style={{
                flex: 1,
                transform: [{ scale: communitiesTabScale }],
                zIndex: 1,
              }}
            >
              <TouchableOpacity
                onPress={() => handleTabPress("communities")}
                className="flex-1 flex-row items-center justify-center rounded-xl py-3 gap-2"
              >
                <Users
                  size={18}
                  color={
                    activeTab === "communities"
                      ? primaryForeground
                      : textSecondaryColor
                  }
                  className="mr-2"
                />
                <Text
                  className="font-semibold"
                  style={{
                    color:
                      activeTab === "communities"
                        ? primaryForeground
                        : textSecondaryColor,
                  }}
                >
                  Communities
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Content area */}
          <View
            className="mt-4 flex-1"
            style={{ overflow: "hidden" }}
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              setContentWidth(width);
            }}
          >
            <Animated.View
              style={{
                flexDirection: "row",
                width: contentWidth > 0 ? contentWidth * 3 : "300%",
                transform: [
                  {
                    translateX: tabIndex.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange:
                        contentWidth > 0
                          ? [0, -contentWidth, -contentWidth * 2]
                          : [0, -300, -600],
                    }),
                  },
                ],
              }}
            >
              {/* Posts Section */}
              <View style={{ width: contentWidth > 0 ? contentWidth : "100%" }}>
                {postsLoading ? (
                  <View className="items-center justify-center py-8">
                    <ActivityIndicator size="small" color={textSecondaryColor} />
                  </View>
                ) : userPosts.length > 0 ? (
                  <View className="gap-3">
                    {userPosts.map((post) => (
                      <PostListItem
                        key={post.id}
                        post={post}
                        hideJoinButton={true}
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
                      Your posts will appear here
                    </Text>
                  </View>
                )}
              </View>

              {/* Comments Section */}
              <View style={{ width: contentWidth > 0 ? contentWidth : "100%" }}>
                {commentsLoading ? (
                  <View className="items-center justify-center py-8">
                    <ActivityIndicator size="small" color={textSecondaryColor} />
                  </View>
                ) : userComments.length > 0 ? (
                  <View className="gap-3">
                    {userComments.map((comment) => (
                      <View key={comment.id}>
                        {comment.post && (
                          <TouchableOpacity
                            onPress={() => router.push(`/post/${comment.post_id}`)}
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
                        )}
                        <CommentItem comment={comment} />
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className="items-center justify-center py-8">
                    <MessageSquare
                      size={48}
                      color={textSecondaryColor}
                      className=" opacity-50"
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
                      Your comments will appear here
                    </Text>
                  </View>
                )}
              </View>

              {/* Communities Section */}
              <View style={{ width: contentWidth > 0 ? contentWidth : "100%" }}>
                {communitiesLoading ? (
                  <View className="items-center justify-center py-8">
                    <ActivityIndicator size="small" color={textSecondaryColor} />
                  </View>
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
                      Communities you join will appear here
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showSettings}
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <Settings onClose={() => setShowSettings(false)} />
      </Modal>
    </View>
  );
}
