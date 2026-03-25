import CommentInput from "@/components/CommentInput";
import CommentItem from "@/components/CommentItem";
import PostListItem, { PostSkeletonCard } from "@/components/PostListItem";
import { Comment, Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/Supabase";
import { useUser } from "@clerk/clerk-expo";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  View,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { Gem, Grid, Image as ImageIcon, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
};

function addDepthToComments(comments: Comment[], depth = 0): Comment[] {
  return comments.map((comment, index) => ({
    ...comment,
    depth,
    isLastInThread: index === comments.length - 1,
    replies: comment.replies
      ? addDepthToComments(comment.replies, depth + 1)
      : [],
  }));
}

function CommentSkeleton() {
  const muted = useThemeColor({}, "textMuted");
  const placeholder = `${muted}30`;

  return (
    <View style={{ gap: SPACING.xs }}>
      <View
        style={{
          height: 32,
          width: "52%",
          borderRadius: 10,
          backgroundColor: placeholder,
        }}
      />
      <View
        style={{
          height: 14,
          width: "88%",
          borderRadius: 8,
          backgroundColor: placeholder,
        }}
      />
      <View
        style={{
          height: 14,
          width: "72%",
          borderRadius: 8,
          backgroundColor: placeholder,
        }}
      />
    </View>
  );
}

const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? "LIVDSRZULELA";
const GIF_PAGE_SIZE = 24;

type PickerMode = "gif" | "sticker";
type PickerItem = {
  id: string;
  previewUrl: string;
  mediaUrl: string;
};

export default function DetailedPost() {
  const { id } = useLocalSearchParams();
  const postId = Array.isArray(id) ? id[0] : id;
  const textColor = useThemeColor({}, "text");
  const background = useThemeColor({}, "background");
  const border = useThemeColor({}, "border");
  const { user } = useUser();
  const insets = useSafeAreaInsets();

  const [detailedPost, setDetailedPost] = useState<Post | null>(null);
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Input & Reply States
  const [commentContent, setCommentContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  // Picker States
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>("gif");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);

  const fetchPickerItems = useCallback(
    async (mode: PickerMode, query: string) => {
      if (!GIPHY_API_KEY) return;
      setPickerLoading(true);
      setPickerError(null);
      try {
        const trimmed = query.trim();
        const endpointBase =
          mode === "sticker"
            ? "https://api.giphy.com/v1/stickers"
            : "https://api.giphy.com/v1/gifs";
        const endpoint =
          trimmed.length > 0 ? `${endpointBase}/search` : `${endpointBase}/trending`;
        const params = new URLSearchParams({
          api_key: GIPHY_API_KEY,
          limit: String(GIF_PAGE_SIZE),
          rating: "pg-13",
        });
        if (trimmed.length > 0) params.append("q", trimmed);
        const response = await fetch(`${endpoint}?${params.toString()}`);
        if (!response.ok) throw new Error(`Failed (${response.status})`);
        const payload = await response.json();
        const mapped: PickerItem[] = (payload?.data ?? [])
          .map((item: any) => ({
            id: String(item?.id ?? ""),
            previewUrl:
              item?.images?.fixed_width_downsampled?.url ??
              item?.images?.fixed_width?.url ??
              item?.images?.original?.url ??
              "",
            mediaUrl:
              item?.images?.original?.url ??
              item?.images?.downsized_large?.url ??
              item?.images?.fixed_width?.url ??
              "",
          }))
          .filter((item: PickerItem) => item.id && item.previewUrl && item.mediaUrl);
        setPickerItems(mapped);
      } catch (error: any) {
        setPickerItems([]);
        setPickerError(error?.message ?? "Failed to load GIFs.");
      } finally {
        setPickerLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!pickerVisible) return;
    const timer = setTimeout(() => {
      void fetchPickerItems(pickerMode, pickerQuery);
    }, 220);
    return () => clearTimeout(timer);
  }, [fetchPickerItems, pickerMode, pickerQuery, pickerVisible]);

  useEffect(() => {
    if (!postId) return;
    fetchPostAndComments();
  }, [postId]);

  const fetchPostAndComments = async () => {
    setLoading(true);

    // Fetch post with aggregated counts
    const { data: postData, error: postError } = await supabase
      .from("posts")
      .select(
        `
        *,
        post_media:post_media(*),
        group:groups(*),
        user:users!posts_user_id_fkey(*),
        upvotes:post_upvotes(count),
        downvotes:post_downvotes(count),
        comments:comments(count)
      `,
      )
      .eq("id", postId)
      .single();

    if (postError) {
      setLoading(false);
      return;
    }

    // Transform post data
    const transformedPost = {
      ...postData,
      upvotes: postData.upvotes?.[0]?.count || 0,
      downvotes: postData.downvotes?.[0]?.count || 0,
      nr_of_comments: postData.comments?.[0]?.count || 0,
    };
    setDetailedPost(transformedPost);

    // Fetch all comments for this post (including replies)
    const { data: commentsData, error: commentsError } = await supabase
      .from("comments")
      .select(
        `
        *,
        user:users!comments_user_id_fkey(*),
        upvotes:comment_upvotes(count),
        downvotes:comment_downvotes(count)
      `,
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (commentsError) {
      console.log("Comments fetch error:", commentsError);
    } else {
      const mapped =
        commentsData?.map((comment) => ({
          id: comment.id,
          post_id: comment.post_id,
          parent_id: comment.parent_id,
          content: comment.comment,
          created_at: comment.created_at,
          upvotes: comment.upvotes?.[0]?.count || 0,
          downvotes: comment.downvotes?.[0]?.count || 0,
          user: comment.user,
          replies: [],
        })) || [];

      const byId = new Map<string, Comment & { parent_id?: string | null }>();
      mapped.forEach((comment) => {
        byId.set(comment.id, comment);
      });

      const topLevel: Comment[] = [];
      mapped.forEach((comment) => {
        if (comment.parent_id) {
          const parent = byId.get(comment.parent_id);
          if (parent) {
            parent.replies = parent.replies || [];
            parent.replies.push(comment);
          } else {
            topLevel.push(comment);
          }
        } else {
          topLevel.push(comment);
        }
      });

      setAllComments(topLevel);
    }

    setLoading(false);
  };

  const topLevelComments = addDepthToComments(allComments);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <FlatList
          data={[0, 1, 2, 3]}
          keyExtractor={(item) => `skeleton-${item}`}
          ListHeaderComponent={
            <View
              style={{
                paddingHorizontal: SPACING.lg,
                paddingTop: SPACING.md,
                paddingBottom: SPACING.md,
              }}
            >
              <PostSkeletonCard index={0} />
              <View style={{ height: SPACING.md }} />
              <View
                style={{
                  width: 120,
                  height: 18,
                  borderRadius: 8,
                  backgroundColor: `${textColor}15`,
                }}
              />
            </View>
          }
          renderItem={() => (
            <View
              style={{
                paddingHorizontal: SPACING.lg,
                paddingBottom: SPACING.md,
              }}
            >
              <CommentSkeleton />
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: insets.bottom + SPACING.lg * 2,
          }}
        />
      </SafeAreaView>
    );
  }

  if (!detailedPost) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: textColor, fontSize: 18 }}>Post not found</Text>
      </SafeAreaView>
    );
  }

  const generateCommentId = () =>
    `comment_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const handleAddComment = async (overrideContent?: string) => {
    const finalContent = overrideContent || commentContent.trim();
    if (!postId || !user?.id || submittingComment || !finalContent) return;
    
    setSubmittingComment(true);
    setPickerVisible(false);

    const { data, error } = await supabase
      .from("comments")
      .insert({
        id: generateCommentId(),
        post_id: postId,
        user_id: user.id,
        comment: finalContent,
        parent_id: replyingTo?.id || null,
        created_at: new Date().toISOString(),
      })
      .select(
        `
        *,
        user:users!comments_user_id_fkey(*),
        upvotes:comment_upvotes(count),
        downvotes:comment_downvotes(count)
      `,
      )
      .single();

    if (error || !data) {
      console.log("Add comment error:", error);
      setSubmittingComment(false);
      return;
    }

    const newComment: Comment = {
      id: data.id,
      post_id: data.post_id,
      content: data.comment,
      created_at: data.created_at,
      upvotes: data.upvotes?.[0]?.count || 0,
      downvotes: data.downvotes?.[0]?.count || 0,
      user: data.user,
      replies: [],
    };

    setAllComments((prev) => [newComment, ...prev]);
    setDetailedPost((prev) =>
      prev
        ? {
            ...prev,
            nr_of_comments: prev.nr_of_comments + 1,
          }
        : prev,
    );
    setCommentContent("");
    setReplyingTo(null);
    setSubmittingComment(false);
  };

  const handlePickGifOrSticker = (item: PickerItem) => {
    const text = commentContent.trim();
    const newContent = text ? `${text}\n${item.mediaUrl}` : item.mediaUrl;
    handleAddComment(newContent);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 16}
      >
        <FlatList
          data={topLevelComments}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View
              style={{
                paddingHorizontal: SPACING.lg,
                paddingTop: SPACING.sm,
                paddingBottom: SPACING.md,
              }}
            >
              <PostListItem
                post={detailedPost}
                isDetailedPost={true}
                index={0}
              />
              <View style={{ height: SPACING.md }} />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: SPACING.sm,
                  marginBottom: SPACING.xs,
                  paddingVertical: SPACING.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: `${border}30`,
                }}
              >
                <Text
                  style={{
                    color: textColor,
                    fontSize: 18,
                    fontWeight: "700",
                    letterSpacing: 0.3,
                  }}
                >
                  Comments
                </Text>
                <View
                  style={{
                    backgroundColor: `${textColor}10`,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      color: textColor,
                      fontSize: 13,
                      fontWeight: "600",
                      opacity: 0.8,
                    }}
                  >
                    {allComments.length}
                  </Text>
                </View>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: SPACING.lg }}>
              <CommentItem
                comment={item}
                depth={item.depth}
                isLastInThread={item.isLastInThread}
                onReply={(comment) => setReplyingTo(comment)}
              />
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          contentContainerStyle={{
            paddingBottom: insets.bottom + SPACING.lg * 5,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
        />

        <View
          style={{
            paddingBottom: insets.bottom,
            borderTopWidth: 1,
            borderColor: `${border}33`,
            backgroundColor: background,
          }}
        >
          {replyingTo && (
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, justifyContent: "space-between" }}>
              <Text style={{ color: textColor, fontSize: 13, fontWeight: "600", opacity: 0.8 }}>
                Replying to <Text style={{ color: useThemeColor({}, "primary") }}>@{replyingTo.user.name}</Text>
              </Text>
              <Pressable onPress={() => setReplyingTo(null)} style={{ padding: 4 }}>
                <X size={16} color={textColor} opacity={0.6} />
              </Pressable>
            </View>
          )}
          <CommentInput
            value={commentContent}
            onChangeText={setCommentContent}
            onSubmit={() => handleAddComment()}
            onPickMedia={() => {
              setPickerMode("gif");
              setPickerVisible(true);
            }}
            isAuthed={!!user?.id}
            sending={submittingComment}
          />
        </View>

        {/* Media Picker Modal */}
        <Modal
          visible={pickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPickerVisible(false)}
        >
          <View style={styles.pickerBackdrop}>
            <View style={[styles.pickerSheet, { backgroundColor: background }]}>
              <View style={styles.pickerHeader}>
                <View style={styles.pickerHeaderLeft}>
                  <Pressable
                    style={[
                      styles.pickerModeBtn,
                      pickerMode === "gif" && { backgroundColor: `${useThemeColor({}, "primary")}22` },
                    ]}
                    onPress={() => setPickerMode("gif")}
                  >
                    <Grid
                      size={14}
                      color={pickerMode === "gif" ? useThemeColor({}, "primary") : textColor}
                      strokeWidth={2.2}
                    />
                    <Text
                      style={[
                        styles.pickerModeText,
                        { color: pickerMode === "gif" ? useThemeColor({}, "primary") : textColor },
                      ]}
                    >
                      GIF
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.pickerModeBtn,
                      pickerMode === "sticker" && { backgroundColor: `${useThemeColor({}, "primary")}22` },
                    ]}
                    onPress={() => setPickerMode("sticker")}
                  >
                    <Gem
                      size={14}
                      color={pickerMode === "sticker" ? useThemeColor({}, "primary") : textColor}
                      strokeWidth={2.2}
                    />
                    <Text
                      style={[
                        styles.pickerModeText,
                        { color: pickerMode === "sticker" ? useThemeColor({}, "primary") : textColor },
                      ]}
                    >
                      Sticker
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  style={[styles.pickerCloseBtn, { backgroundColor: `${textColor}1A` }]}
                  onPress={() => setPickerVisible(false)}
                >
                  <X size={16} color={textColor} strokeWidth={2.4} />
                </Pressable>
              </View>

              <TextInput
                value={pickerQuery}
                onChangeText={setPickerQuery}
                placeholder={
                  pickerMode === "sticker" ? "Search stickers" : "Search GIFs"
                }
                placeholderTextColor={`${textColor}80`}
                style={[
                  styles.pickerSearch,
                  { color: textColor, borderColor: border },
                ]}
              />

              {pickerLoading ? (
                <View style={styles.pickerState}>
                  <ActivityIndicator size="small" color={useThemeColor({}, "primary")} />
                </View>
              ) : pickerError ? (
                <View style={styles.pickerState}>
                  <Text style={[styles.pickerError, { color: "#FF3B30" }]}>
                    {pickerError}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={pickerItems}
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  columnWrapperStyle={styles.pickerRow}
                  contentContainerStyle={styles.pickerGrid}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handlePickGifOrSticker(item)}
                      style={styles.pickerCard}
                    >
                      <Image
                        source={{ uri: item.previewUrl }}
                        style={styles.pickerImage}
                        contentFit="cover"
                      />
                    </Pressable>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    height: "60%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  pickerHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickerModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pickerModeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerSearch: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
  },
  pickerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerError: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  pickerGrid: {
    paddingBottom: 24,
    gap: 8,
  },
  pickerRow: {
    justifyContent: "space-between",
  },
  pickerCard: {
    width: "32%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  pickerImage: {
    width: "100%",
    height: "100%",
  },
});
