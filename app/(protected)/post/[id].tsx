import posts from "@/assets/data/posts.json";
import PostListItem from "@/components/PostListItem";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function DetailedPost() {
  const { id } = useLocalSearchParams();
  const textColor = useThemeColor({}, "text");
  const detailedPost = posts.find((post) => post.id === id);

  if (!detailedPost) {
    return (
      <View>
        <Text style={{ color: textColor }}>Post not found</Text>
      </View>
    );
  }

  return (
    <>
      <View>
        <PostListItem post={detailedPost} isDetailedPost={true} />
      </View>
    </>
  );
}
