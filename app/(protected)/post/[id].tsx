import comments from "@/assets/data/comments.json";
import posts from "@/assets/data/posts.json";
import CommentInput from "@/components/CommentInput";
import CommentItem from "@/components/CommentItem";
import PostListItem from "@/components/PostListItem";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
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
  const textColor = useThemeColor({}, "text");
  const background = useThemeColor({}, "background");
  const detailedPost = posts.find((post) => post.id === id);
  const initialComments = comments.filter((comment) => comment.post_id === id);
  const [allComments, setAllComments] = useState(initialComments);
  const topLevelComments = addDepthToComments(allComments);

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
      post_id: id as string,
      content,
      created_at: new Date().toISOString(),
      upvotes: 0,
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
    <View style={{ flex: 1, backgroundColor: useThemeColor({}, "background") }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          data={topLevelComments}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={{ backgroundColor: useThemeColor({}, "background") }}>
              <View style={{ paddingTop: 8 }}>
                <PostListItem post={detailedPost} isDetailedPost={true} />
              </View>
              <View
                style={{
                  height: 8,
                  backgroundColor: useThemeColor({}, "background"),
                }}
              />
              <View
                style={{
                  height: 1,
                  backgroundColor: useThemeColor({}, "border"),
                  marginHorizontal: 16,
                }}
              />
              <View
                style={{
                  height: 8,
                  backgroundColor: useThemeColor({}, "background"),
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
            <View style={{ marginHorizontal: 12 }}>
              <CommentItem
                comment={item}
                depth={item.depth}
                isLastInThread={item.isLastInThread}
              />
            </View>
          )}
          contentContainerStyle={{
            paddingBottom: 140, // Extra padding for input
            backgroundColor: useThemeColor({}, "background"),
          }}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: useThemeColor({}, "background") }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: useThemeColor({}, "background"),
            paddingBottom: Platform.OS === "ios" ? 34 : 16, // Safe area padding
          }}
        >
          <CommentInput onSubmit={handleAddComment} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
