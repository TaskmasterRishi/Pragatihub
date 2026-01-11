import { useThemeColor } from "@/hooks/use-theme-color";
import { formatDistanceToNowStrict } from "date-fns";
import {
  ArrowBigDown,
  ArrowBigUp,
  MessageSquare,
  Share2,
  Trophy,
} from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";

export type Post = {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  created_at: string;
  upvotes: number;
  nr_of_comments: number;
  group: {
    name: string;
    image: string;
  };
};

export type PostListItemProps = {
  post: Post;
};

export default function PostListItem({ post }: PostListItemProps) {
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");

  return (
    <View
      style={{
        backgroundColor: card,
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      {/* ───────── Header ───────── */}
      <View className="flex-row items-center mb-4">
        <Image
          source={{ uri: post.group.image }}
          className="w-10 h-10 rounded-full"
        />

        <View className="ml-3 flex-1">
          <Text className="font-semibold text-base" style={{ color: text }}>
            {post.group.name}
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: muted }}>
            {formatDistanceToNowStrict(new Date(post.created_at))} ago
          </Text>
        </View>

        <Pressable
          style={{
            backgroundColor: primary,
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 999,
          }}
        >
          <Text className="text-sm font-semibold" style={{ color: "white" }}>
            Join
          </Text>
        </Pressable>
      </View>

      {/* ───────── Content ───────── */}
      <View className="gap-3">
        <Text className="text-lg font-bold leading-6" style={{ color: text }}>
          {post.title}
        </Text>

        {post.image && (
          <Image
            source={{ uri: post.image }}
            className="w-full aspect-[4/3] rounded-2xl"
            resizeMode="cover"
          />
        )}

        {post.description && (
          <Text
            className="text-base leading-6"
            style={{ color: muted }}
            numberOfLines={3}
          >
            {post.description}
          </Text>
        )}
      </View>

      {/* ───────── Divider ───────── */}
      <View
        style={{
          height: 1,
          backgroundColor: border,
          marginVertical: 14,
        }}
      />

      {/* ───────── Footer ───────── */}
      <View className="flex-row items-center">
        {/* Votes */}
        <View className="flex-row items-center gap-1">
          <Pressable className="p-1">
            <ArrowBigUp size={22} color={text} />
          </Pressable>

          <Text className="font-semibold mx-1" style={{ color: text }}>
            {post.upvotes}
          </Text>

          <Pressable className="p-1">
            <ArrowBigDown size={22} color={text} />
          </Pressable>
        </View>

        {/* Comments */}
        <View className="flex-row items-center ml-4 gap-1">
          <MessageSquare size={20} color={muted} />
          <Text style={{ color: muted }}>{post.nr_of_comments}</Text>
        </View>

        {/* Actions */}
        <View className="ml-auto flex-row gap-4">
          <Pressable>
            <Trophy size={20} color={muted} />
          </Pressable>
          <Pressable>
            <Share2 size={20} color={muted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
