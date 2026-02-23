import HomeTopBar from "@/components/HomeTopBar";
import PostListItem from "@/components/PostListItem";
import { Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/Supabase";
import { useEffect, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 5;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({}, "background");

  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
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

        // Get downvotes count
        const { count: downvotesCount } = await supabase
          .from("post_downvotes")
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
          downvotes: downvotesCount || 0,
          nr_of_comments: commentsCount || 0,
        };
      }),
    );

    console.log("Posts with counts:", JSON.stringify(postsWithCounts, null, 2));
    setPosts(postsWithCounts);
  };

  const [page, setPage] = useState(1);
  const [visiblePosts, setVisiblePosts] = useState<Post[]>([]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) => {
      const title = post.title?.toLowerCase() ?? "";
      const description = post.description?.toLowerCase() ?? "";
      const community = post.group?.name?.toLowerCase() ?? "";
      const author = post.user?.name?.toLowerCase() ?? "";
      return (
        title.includes(q) ||
        description.includes(q) ||
        community.includes(q) ||
        author.includes(q)
      );
    });
  }, [posts, searchQuery]);

  useEffect(() => {
    setVisiblePosts(filteredPosts.slice(0, page * PAGE_SIZE));
  }, [page, filteredPosts]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setPage(1);
    try {
      await fetchPosts();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor }}>
      {/* Floating top bar */}
      <HomeTopBar
        searchQuery={searchQuery}
        onChangeSearchQuery={setSearchQuery}
      />

      <FlatList
        data={visiblePosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostListItem post={item} />}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 80,
        }}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        progressViewOffset={insets.top + 80}
        onEndReached={() => {
          if (page * PAGE_SIZE < filteredPosts.length) {
            setPage((p) => p + 1);
          }
        }}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
