import { formatDistanceToNowStrict } from "date-fns";
import {
  ArrowBigDown,
  ArrowBigUp,
  Loader2,
  MessageSquare,
  Share2,
  Trophy,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";

import { Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";

export type PostListItemProps = {
  post: Post;
};
const SCREEN_WIDTH = Dimensions.get("window").width;

/* ───────────────────────────────────────────── */
/* Post Image with Animated Loader */
/* ───────────────────────────────────────────── */
function PostImage({ uri }: { uri: string }) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const rotate = useRef(new Animated.Value(0)).current;

  /* Spinner animation */
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  /* Fetch image size */
  useEffect(() => {
    Image.getSize(
      uri,
      (width, height) => {
        setAspectRatio(width / height);
      },
      () => {
        setAspectRatio(1);
      }
    );
  }, [uri]);

  if (!aspectRatio) return null;

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View
      style={{
        width: "100%",
        aspectRatio,
        maxHeight: SCREEN_WIDTH * 1.25,
        borderRadius: 16,
        backgroundColor: "#00000010",
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Loader */}
      {!loaded && (
        <Animated.View
          style={{
            position: "absolute",
            transform: [{ rotate: spin }],
          }}
        >
          <Loader2 size={28} color="#999" />
        </Animated.View>
      )}

      {/* Image */}
      <Image
        source={{ uri }}
        resizeMode="cover"
        onLoadEnd={() => setLoaded(true)}
        style={{
          width: "100%",
          height: "100%",
          opacity: loaded ? 1 : 0,
        }}
      />
    </View>
  );
}

/* ───────────────────────────────────────────── */
/* Animated Button Wrapper */
/* ───────────────────────────────────────────── */
function AnimatedIconButton({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.8,
      useNativeDriver: true,
      speed: 40,
      bounciness: 7,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 25,
      bounciness: 5,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={{ color: "#00000008", borderless: true }}
        style={{ borderRadius: 999 }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/* ───────────────────────────────────────────── */
/* Main Post Card */
/* ───────────────────────────────────────────── */
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

        <AnimatedIconButton
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
        </AnimatedIconButton>
      </View>

      {/* ───────── Content ───────── */}
      <View className="gap-3">
        <Text className="text-lg font-bold leading-6" style={{ color: text }}>
          {post.title}
        </Text>

        {post.image && <PostImage uri={post.image} />}

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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: border,
            borderRadius: 999,
            paddingHorizontal: 6,
            paddingVertical: 4,
          }}
        >
          <AnimatedIconButton style={{ padding: 4 }}>
            <ArrowBigUp size={22} color={text} />
          </AnimatedIconButton>

          <Text className="font-semibold ml-3" style={{ color: text }}>
            {post.upvotes}
          </Text>

          <View
            style={{
              width: 1,
              height: 20,
              backgroundColor: border,
              marginHorizontal: 6,
            }}
          />

          <AnimatedIconButton style={{ padding: 4 }}>
            <ArrowBigDown size={22} color={text} />
          </AnimatedIconButton>
        </View>

        {/* Comments */}
        <View className="flex-row items-center ml-4 gap-1">
          <MessageSquare size={20} color={muted} />
          <Text style={{ color: muted }}>{post.nr_of_comments}</Text>
        </View>

        {/* Actions */}
        <View
          className="ml-auto flex-row items-center"
          style={{
            borderWidth: 1,
            borderColor: border,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <AnimatedIconButton>
            <Trophy size={20} color={muted} />
          </AnimatedIconButton>

          <View
            style={{
              width: 1,
              height: 18,
              backgroundColor: border,
              marginHorizontal: 10,
            }}
          />

          <AnimatedIconButton>
            <Share2 size={20} color={muted} />
          </AnimatedIconButton>
        </View>
      </View>
    </View>
  );
}
