import CommentInput from "@/components/CommentInput";
import CommentItem from "@/components/CommentItem";
import PostListItem from "@/components/PostListItem";
import { Comment, Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/Supabase";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from "react-native";

function addDepthToComments(comments: any[]): any[] {
  // Add depth information to all top-level comments
  // Preserve the original structure including replies
  return comments.map((comment) => ({
    ...comment,
    depth: 0,
    isLastInThread: false,
  }));
}

export default function DetailedPost() {
  const { id } = useLocalSearchParams();
  const postId = Array.isArray(id) ? id[0] : id;
  const textColor = useThemeColor({}, "text");
  const background = useThemeColor({}, "background");
  const border = useThemeColor({}, "border");

  const [detailedPost, setDetailedPost] = useState<Post | null>(null);
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

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
      console.log("Post fetch error:", postError);
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

    // Fetch comments for this post
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
      .is("parent_id", null); // Only top-level comments for now

    if (commentsError) {
      console.log("Comments fetch error:", commentsError);
    } else {
      // Transform comments data
      const transformedComments =
        commentsData?.map((comment) => ({
          id: comment.id,
          post_id: comment.post_id,
          content: comment.comment,
          created_at: comment.created_at,
          upvotes: comment.upvotes?.[0]?.count || 0,
          downvotes: comment.downvotes?.[0]?.count || 0,
          user: comment.user,
          replies: [],
        })) || [];
      setAllComments(transformedComments);
    }

    setLoading(false);
  };

  const topLevelComments = addDepthToComments(allComments);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={textColor} />
      </View>
    );
  }

  if (!detailedPost) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: textColor, fontSize: 18 }}>Post not found</Text>
      </View>
    );
  }

  const handleAddComment = (content: string) => {
    const newComment = {
      id: `comment-${Date.now()}`,
      post_id: postId as string,
      content,
      created_at: new Date().toISOString(),
      upvotes: 0,
      downvotes: 0,
      user: {
        id: "user-current", // Mock current user
        name: "u/You",
        image: null,
      },
      replies: [], // Initialize empty replies array
    };
    setAllComments((prev: any) => [...prev, newComment]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: background, margin: 16 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          data={topLevelComments}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={{ backgroundColor: background }}>
              <View style={{ paddingTop: 8 }}>
                <PostListItem post={detailedPost} isDetailedPost={true} />
              </View>
              <View
                style={{
                  height: 8,
                  backgroundColor: background,
                }}
              />
              <View
                style={{
                  height: 1,
                  backgroundColor: border,
                }}
              />
              <View
                style={{
                  height: 8,
                  backgroundColor: background,
                }}
              />
              <Text
                style={{
                  color: textColor,
                  fontSize: 18,
                  fontWeight: "bold",
                  paddingHorizontal: 16,
                  paddingBottom: 16,
                }}
              >
                Comments ({allComments.length})
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <CommentItem
              comment={item}
              depth={item.depth}
              isLastInThread={item.isLastInThread}
            />
          )}
          contentContainerStyle={{
            paddingBottom: 140, // Extra padding for input
            backgroundColor: background,
          }}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: background }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: background,
          }}
        >
          <CommentInput onSubmit={handleAddComment} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
