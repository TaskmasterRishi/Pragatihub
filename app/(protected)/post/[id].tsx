import CommentInput from "@/components/CommentInput";
import CommentItem from "@/components/CommentItem";
import PostListItem, { PostSkeletonCard } from "@/components/PostListItem";
import { Comment, Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/Supabase";
import { useUser } from "@clerk/clerk-expo";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  View,
} from "react-native";
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
      <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
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
          backgroundColor: background,
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

  const handleAddComment = async (content: string) => {
    if (!postId || !user?.id || submittingComment) return;
    setSubmittingComment(true);

    const { data, error } = await supabase
      .from("comments")
      .insert({
        id: generateCommentId(),
        post_id: postId,
        user_id: user.id,
        comment: content,
        parent_id: null,
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
    setSubmittingComment(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
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
              <Text
                style={{
                  color: textColor,
                  fontSize: 14,
                  fontWeight: "600",
                  opacity: 0.72,
                  letterSpacing: 0.1,
                }}
              >
                Comments ({allComments.length})
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: SPACING.lg }}>
              <CommentItem
                comment={item}
                depth={item.depth}
                isLastInThread={item.isLastInThread}
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
            paddingHorizontal: SPACING.lg,
            paddingTop: SPACING.sm,
            paddingBottom: insets.bottom + SPACING.xs,
            borderTopWidth: 1,
            borderColor: `${border}33`,
            backgroundColor: background,
          }}
        >
          <CommentInput
            onSubmit={handleAddComment}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
