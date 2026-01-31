import comments from "@/assets/data/comments.json";
import posts from "@/assets/data/posts.json";
import CommentInput from "@/components/CommentInput";
import CommentItem from "@/components/CommentItem";
import PostListItem from "@/components/PostListItem";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, Text, View } from "react-native";

function flattenComments(comments: any[], depth = 0): any[] {
  const result: any[] = [];
  for (const comment of comments) {
    result.push({ ...comment, depth });
    if (comment.replies) {
      result.push(...flattenComments(comment.replies, depth + 1));
    }
  }
  return result;
}

export default function DetailedPost() {
  const { id } = useLocalSearchParams();
  const textColor = useThemeColor({}, "text");
  const detailedPost = posts.find((post) => post.id === id);
  const initialComments = comments.filter((comment) => comment.post_id === id);
  const [allComments, setAllComments] = useState(initialComments);
  const flattenedComments = flattenComments(allComments);

  if (!detailedPost) {
    return (
      <View>
        <Text style={{ color: textColor }}>Post not found</Text>
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
    };
    setAllComments((prev: any) => [...prev, newComment]);
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={flattenedComments}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View>
              <PostListItem post={detailedPost} isDetailedPost={true} />
            </View>
            <View
              style={{
                height: 1,
                backgroundColor: useThemeColor({}, "border"),
                marginHorizontal: 16,
                marginVertical: 8,
              }}
            />
            <Text
              style={{
                color: textColor,
                fontSize: 18,
                fontWeight: "bold",
                paddingHorizontal: 16,
                paddingBottom: 8,
              }}
            >
              Comments ({allComments.length})
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ marginHorizontal: 16 }}>
            <CommentItem comment={item} depth={item.depth} />
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
      <CommentInput onSubmit={handleAddComment} />
    </View>
  );
}
