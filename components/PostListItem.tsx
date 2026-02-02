import { formatDistanceToNowStrict } from "date-fns";
import { Link } from "expo-router";
import {
  ArrowBigDown,
  ArrowBigUp,
  Loader2,
  MessageSquare,
  Share2,
  Trophy,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
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

const SCREEN_WIDTH = Dimensions.get("window").width;

/* ───────────────────────────────────────────── */
/* Shared Press Scale Hook */
/* ───────────────────────────────────────────── */
function usePressScale(initial = 1, pressed = 0.9) {
  const scale = useRef(new Animated.Value(initial)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: pressed,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  }, []);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: initial,
      useNativeDriver: true,
      speed: 25,
      bounciness: 5,
    }).start();
  }, []);

  return { scale, onPressIn, onPressOut };
}

/* ───────────────────────────────────────────── */
/* Fade + Scale Entrance */
/* ───────────────────────────────────────────── */
function FadeInView({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 18,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      {children}
    </Animated.View>
  );
}

/* ───────────────────────────────────────────── */
/* Post Image */
/* ───────────────────────────────────────────── */
const PostImage = memo(({ uri }: { uri: string }) => {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    Image.getSize(
      uri,
      (w, h) => setAspectRatio(w / h),
      () => setAspectRatio(1),
    );
  }, [uri]);

  const onLoad = () => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

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
      <Animated.View
        style={{
          position: "absolute",
          opacity: opacity.interpolate({
            inputRange: [0, 0.01],
            outputRange: [1, 0],
          }),
          transform: [{ rotate: spin }],
        }}
      >
        <Loader2 size={28} color="#999" />
      </Animated.View>

      <Animated.Image
        source={{ uri }}
        resizeMode="cover"
        onLoad={onLoad}
        style={{
          width: "100%",
          height: "100%",
          opacity,
        }}
      />
    </View>
  );
});

/* ───────────────────────────────────────────── */
/* Animated Icon Button */
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
  const { scale, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={{ color: "#00000008", borderless: true }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/* ───────────────────────────────────────────── */
/* Main Post Card */
/* ───────────────────────────────────────────── */
function PostListItem({
  post,
  isDetailedPost = false,
}: {
  post: Post;
  isDetailedPost?: boolean;
}) {
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");

  return (
    <FadeInView>
      <View
        style={{
          backgroundColor: card,
          borderRadius: 20,
          padding: 16,
          margin: 16,
          borderWidth: 1,
          borderColor: border,
        }}
      >
        {/* Header */}
        <View className="flex-row items-center mb-4">
          <Image
            source={{
              uri: post.user.image || "https://via.placeholder.com/150",
            }}
            className="w-10 h-10 rounded-full"
          />

          <View className="ml-3 flex-1">
            <View className="flex-row items-center gap-1">
              <Text style={{ color: text }} className="font-semibold text-sm">
                {post.group.name}
              </Text>
              <Text style={{ color: muted }} className="text-xs">
                •
              </Text>
              <Text style={{ color: muted }} className="text-xs">
                {formatDistanceToNowStrict(new Date(post.created_at))} ago
              </Text>
            </View>
            <Text style={{ color: muted }} className="text-xs">
              Posted by {post.user.name}
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
            <Text style={{ color: "white" }} className="font-semibold">
              Join
            </Text>
          </AnimatedIconButton>
        </View>

        <Link href={`/post/${post.id}`} asChild>
          <Pressable>
            <View className="gap-3">
              <Text style={{ color: text }} className="text-lg font-bold">
                {post.title}
              </Text>

              {post.description && (
                <Text
                  style={{ color: muted }}
                  numberOfLines={isDetailedPost ? undefined : 2}
                >
                  {post.description}
                </Text>
              )}

              {post.image && <PostImage uri={post.image} />}
            </View>
          </Pressable>
        </Link>

        {/* Divider */}
        <View
          style={{
            height: 1,
            backgroundColor: border,
            marginVertical: 14,
          }}
        />

        {/* Footer */}
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
            <AnimatedIconButton>
              <ArrowBigUp size={22} color={text} />
            </AnimatedIconButton>

            <Text style={{ color: text }} className="mx-3 font-semibold">
              {post.upvotes}
            </Text>

            <AnimatedIconButton>
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
    </FadeInView>
  );
}

export default memo(PostListItem);
