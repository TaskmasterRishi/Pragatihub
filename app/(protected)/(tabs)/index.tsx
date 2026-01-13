import posts from "@/assets/data/posts.json";
import PostListItem from "@/components/PostListItem";
import { SignOutButton } from "@/components/SignOutButton";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";

const PAGE_SIZE = 5;

export default function HomeScreen() {
  const backgroundColor = useThemeColor({}, "background");

  const [page, setPage] = useState(1);
  const [visiblePosts, setVisiblePosts] = useState(posts.slice(0, PAGE_SIZE));

  useEffect(() => {
    setVisiblePosts(posts.slice(0, page * PAGE_SIZE));
  }, [page]);

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <SignOutButton />
      <FlatList
        data={visiblePosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostListItem post={item} />}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 120, // space for floating tab bar
        }}
        onEndReached={() => {
          if (page * PAGE_SIZE < posts.length) {
            setPage((p) => p + 1);
          }
        }}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
