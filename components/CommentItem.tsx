import { Comment } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { formatDistanceToNowStrict } from "date-fns";
import {
    CornerDownRight,
    MessageCircle,
} from "lucide-react-native";
import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import VoteButtons from "@/components/VoteButtons";

type CommentItemProps = {
  comment: Comment;
  depth?: number;
  isLastInThread?: boolean;
};

type CommentDisplayProps = {
  comment: Comment;
  isReply?: boolean;
};

// Render individual comment content (used for both main and reply)
function CommentContent({ comment, isReply = false }: CommentDisplayProps) {
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");

  return (
    <View style={{ paddingVertical: isReply ? 10 : 0 }}>
      {/* Comment Header */}
      <View className="flex-row items-start mb-2">
        <Image
          source={{ uri: comment.user.image || undefined }}
          className={isReply ? "w-6 h-6" : "w-7 h-7"}
          style={{
            borderRadius: 999,
            borderWidth: isReply ? 1 : 1.5,
            borderColor: border,
          }}
        />
        <View className="ml-2 flex-1">
          <View className="flex-row items-center">
            <Text
              className={isReply ? "text-xs" : "text-sm"}
              style={{ color: text, fontWeight: "600" }}
              numberOfLines={1}
            >
              {comment.user.name}
            </Text>
            {isReply && (
              <View
                style={{
                  backgroundColor: primary,
                  paddingHorizontal: 6,
                  paddingVertical: 0.5,
                  borderRadius: 6,
                  marginLeft: 6,
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontSize: 8,
                    fontWeight: "bold",
                    letterSpacing: 0.3,
                  }}
                >
                  REPLY
                </Text>
              </View>
            )}
          </View>
          <Text className="text-xs mt-0.5" style={{ color: muted }}>
            {formatDistanceToNowStrict(new Date(comment.created_at))} ago
          </Text>
        </View>
      </View>

      {/* Comment Content */}
      <Text
        className={isReply ? "text-xs leading-4" : "text-sm leading-5"}
        style={{
          color: text,
          lineHeight: isReply ? 16 : 20,
          marginBottom: isReply ? 6 : 8,
          marginLeft: 24,
        }}
      >
        {comment.content}
      </Text>

      {/* Comment Footer */}
      <View
        style={{
          marginLeft: 24,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: border,
            borderRadius: isReply ? 12 : 16,
            paddingHorizontal: isReply ? 8 : 10,
            paddingVertical: isReply ? 4 : 5,
            backgroundColor: card,
          }}
        >
          <VoteButtons
            type="comment"
            itemId={comment.id}
            initialUpvotes={comment.upvotes}
            initialDownvotes={comment.downvotes}
            size={isReply ? 12 : 14}
            compact={true}
          />
        </View>

        {!isReply && (
          <Pressable
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: isReply ? 8 : 10,
              paddingVertical: isReply ? 4 : 5,
              borderRadius: isReply ? 12 : 16,
              backgroundColor: "transparent",
            }}
          >
            <MessageCircle size={isReply ? 11 : 13} color={muted} />
            <Text
              style={{
                color: muted,
                fontSize: isReply ? 10 : 12,
                marginLeft: 3,
                fontWeight: "500",
              }}
            >
              Reply
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function CommentItem({
  comment,
  depth = 0,
  isLastInThread = false,
}: CommentItemProps) {
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");

  const isReply = depth > 0;

  // For replies, just render the content without a card
  if (isReply) {
    return (
      <View>
        <CommentContent comment={comment} isReply={true} />
      </View>
    );
  }

  // For main comments, create a card that contains the comment + all replies
  return (
    <View style={{ marginBottom: 12 }}>
      <View
        style={{
          backgroundColor: card,
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 14,
          marginLeft: 0,
          borderWidth: 1,
          borderColor: border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 3,
          elevation: 1,
        }}
      >
        {/* Main Comment */}
        <CommentContent comment={comment} isReply={false} />

        {/* Divider - only show if there are replies */}
        {comment.replies && comment.replies.length > 0 && (
          <View
            style={{
              height: 1,
              backgroundColor: border,
              marginVertical: 10,
              marginLeft: 24,
              marginRight: 0,
            }}
          />
        )}

        {/* Replies inside the same card */}
        {comment.replies && comment.replies.length > 0 && (
          <View>
            {comment.replies.map((reply, index) => (
              <View
                key={reply.id}
                style={{
                  flexDirection: "row",
                  marginLeft: 16,
                }}
              >
                <CornerDownRight
                  size={16}
                  color={border}
                  style={{ marginTop: 4, marginRight: 6 }}
                />
                <View style={{ flex: 1 }}>
                  <CommentContent comment={reply} isReply={true} />
                  {/* Divider between replies */}
                  {index < comment.replies!.length - 1 && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: border,
                        marginVertical: 8,
                        marginLeft: 24,
                        marginRight: 0,
                        opacity: 0.5,
                      }}
                    />
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
