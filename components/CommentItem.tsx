import { Comment } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowBigDown, ArrowBigUp } from "lucide-react-native";
import React from "react";
import { Image, Text, View } from "react-native";

type CommentItemProps = {
  comment: Comment;
  depth?: number;
};

export default function CommentItem({ comment, depth = 0 }: CommentItemProps) {
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");

  const marginLeft = depth * 20; // Indent replies

  return (
    <View>
      <View
        style={{
          backgroundColor: card,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: border,
          marginLeft,
        }}
      >
        {/* Comment Header */}
        <View className="flex-row items-center mb-3">
          <Image
            source={{ uri: comment.user.image || undefined }}
            className="w-8 h-8 rounded-full bg-gray-200"
          />
          <View className="ml-3 flex-1">
            <Text className="font-semibold text-sm" style={{ color: text }}>
              {comment.user.name}
            </Text>
            <Text className="text-xs" style={{ color: muted }}>
              {formatDistanceToNowStrict(new Date(comment.created_at))} ago
            </Text>
          </View>
        </View>

        {/* Comment Content */}
        <Text className="text-base leading-6 mb-3" style={{ color: text }}>
          {comment.content}
        </Text>

        {/* Comment Footer */}
        <View className="flex-row items-center">
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: border,
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <ArrowBigUp size={16} color={text} />
            <Text className="font-semibold mx-2" style={{ color: text }}>
              {comment.upvotes}
            </Text>
            <ArrowBigDown size={16} color={text} />
          </View>
        </View>
      </View>

      {/* Render Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <View style={{ marginLeft }}>
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </View>
      )}
    </View>
  );
}
