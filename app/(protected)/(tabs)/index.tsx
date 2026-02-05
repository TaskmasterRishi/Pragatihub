import PostListItem from "@/components/PostListItem";
import { Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/Supabase";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";

const PAGE_SIZE = 5;

export default function HomeScreen() {
  const backgroundColor = useThemeColor({}, "background");

  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        *,
        group:groups(*),
        user:users!posts_user_id_fkey(*)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Posts fetch error:", error);
      return;
    }

    if (!data) {
      console.log("No posts data returned");
      setPosts([]);
      return;
    }

    console.log("Fetched posts:", data.length);

    // For each post, get the upvotes and comments count
    const postsWithCounts = await Promise.all(
      data.map(async (post) => {
        // Get upvotes count
        const { count: upvotesCount } = await supabase
          .from("post_upvotes")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id);

        // Get comments count
        const { count: commentsCount } = await supabase
          .from("comments")
          .select("*", { count: "exact", head: true })
          .eq("post_id", post.id);

        return {
          ...post,
          upvotes: upvotesCount || 0,
          nr_of_comments: commentsCount || 0,
        };
      }),
    );

    console.log("Posts with counts:", JSON.stringify(postsWithCounts, null, 2));
    setPosts(postsWithCounts);
  };

  const [page, setPage] = useState(1);
  const [visiblePosts, setVisiblePosts] = useState(posts.slice(0, PAGE_SIZE));

  useEffect(() => {
    setVisiblePosts(posts.slice(0, page * PAGE_SIZE));
  }, [page, posts]);

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <FlatList
        data={visiblePosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostListItem post={item} />}
        contentContainerStyle={{
          paddingBottom: 120, // space for floating tab bar
          padding: 20,
        }}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          setPage(1);
          await fetchPosts();
          setRefreshing(false);
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
