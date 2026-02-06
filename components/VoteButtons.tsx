import { useUser } from "@clerk/clerk-expo";
import { ArrowBigDown, ArrowBigUp } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/Supabase";

type VoteType = "post" | "comment";

type VoteButtonsProps = {
  type: VoteType;
  itemId: string;
  initialUpvotes: number;
  initialDownvotes: number;
  size?: number;
  compact?: boolean;
};

type VoteConfig = {
  up: {
    table: "post_upvotes" | "comment_upvotes";
    idField: "post_id" | "comment_id";
  };
  down: {
    table: "post_downvotes" | "comment_downvotes";
    idField: "post_id" | "comment_id";
  };
};

const VOTE_CONFIG: Record<VoteType, VoteConfig> = {
  post: {
    up: { table: "post_upvotes", idField: "post_id" },
    down: { table: "post_downvotes", idField: "post_id" },
  },
  comment: {
    up: { table: "comment_upvotes", idField: "comment_id" },
    down: { table: "comment_downvotes", idField: "comment_id" },
  },
};

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

function AnimatedIconButton({
  children,
  onPress,
  disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={{ color: "#00000008", borderless: true }}
        disabled={disabled}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function VoteButtons({
  type,
  itemId,
  initialUpvotes,
  initialDownvotes,
  size = 22,
  compact = false,
}: VoteButtonsProps) {
  const { user } = useUser();
  const text = useThemeColor({}, "text");
  const primary = useThemeColor({}, "primary");

  const [upvotes, setUpvotes] = useState<number>(initialUpvotes || 0);
  const [downvotes, setDownvotes] = useState<number>(initialDownvotes || 0);
  const [voteState, setVoteState] = useState<"up" | "down" | "none">("none");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setUpvotes(initialUpvotes || 0);
  }, [initialUpvotes]);

  useEffect(() => {
    setDownvotes(initialDownvotes || 0);
  }, [initialDownvotes]);

  useEffect(() => {
    if (!user?.id || !itemId) {
      setVoteState("none");
      return;
    }

    let cancelled = false;
    const { up, down } = VOTE_CONFIG[type];

    const loadVoteState = async () => {
      const [upRes, downRes] = await Promise.all([
        supabase
          .from(up.table)
          .select("user_id")
          .eq(up.idField, itemId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from(down.table)
          .select("user_id")
          .eq(down.idField, itemId)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      if (upRes.error || downRes.error) {
        console.log("Vote state error:", upRes.error || downRes.error);
        return;
      }

      if (upRes.data) {
        setVoteState("up");
      } else if (downRes.data) {
        setVoteState("down");
      } else {
        setVoteState("none");
      }
    };

    loadVoteState();

    return () => {
      cancelled = true;
    };
  }, [itemId, type, user?.id]);

  const removeUpvote = async () => {
    if (!user?.id) return false;
    const { up } = VOTE_CONFIG[type];
    const { error } = await supabase
      .from(up.table)
      .delete()
      .eq(up.idField, itemId)
      .eq("user_id", user.id);

    if (error) {
      console.log("Remove upvote error:", error);
      return false;
    }

    setVoteState("none");
    setUpvotes((prev) => Math.max(0, prev - 1));
    return true;
  };

  const addUpvote = async () => {
    if (!user?.id) return false;
    const { up } = VOTE_CONFIG[type];
    const { error } = await supabase.from(up.table).insert({
      [up.idField]: itemId,
      user_id: user.id,
    });

    if (error) {
      console.log("Add upvote error:", error);
      return false;
    }

    setVoteState("up");
    setUpvotes((prev) => prev + 1);
    return true;
  };

  const removeDownvote = async () => {
    if (!user?.id) return false;
    const { down } = VOTE_CONFIG[type];
    const { error } = await supabase
      .from(down.table)
      .delete()
      .eq(down.idField, itemId)
      .eq("user_id", user.id);

    if (error) {
      console.log("Remove downvote error:", error);
      return false;
    }

    setVoteState("none");
    setDownvotes((prev) => Math.max(0, prev - 1));
    return true;
  };

  const addDownvote = async () => {
    if (!user?.id) return false;
    const { down } = VOTE_CONFIG[type];
    const { error } = await supabase.from(down.table).insert({
      [down.idField]: itemId,
      user_id: user.id,
    });

    if (error) {
      console.log("Add downvote error:", error);
      return false;
    }

    setVoteState("down");
    setDownvotes((prev) => prev + 1);
    return true;
  };

  const handleUpvote = async () => {
    if (!user?.id || isLoading) return;
    setIsLoading(true);
    if (voteState === "up") {
      await removeUpvote();
    } else if (voteState === "down") {
      const removed = await removeDownvote();
      if (removed) {
        await addUpvote();
      }
    } else {
      await addUpvote();
    }
    setIsLoading(false);
  };

  const handleDownvote = async () => {
    if (!user?.id || isLoading) return;
    setIsLoading(true);
    if (voteState === "down") {
      await removeDownvote();
    } else if (voteState === "up") {
      const removed = await removeUpvote();
      if (removed) {
        await addDownvote();
      }
    } else {
      await addDownvote();
    }
    setIsLoading(false);
  };

  const countSpacing = compact ? 6 : 12;
  const countFontSize = compact ? 12 : 14;
  const isUpvoted = voteState === "up";
  const isDownvoted = voteState === "down";

  return (
    <>
      <AnimatedIconButton onPress={handleUpvote} disabled={isLoading}>
        <ArrowBigUp
          size={size}
          color={isUpvoted ? primary : text}
          fill={isUpvoted ? primary : "transparent"}
        />
      </AnimatedIconButton>

      <Text
        style={{
          color: text,
          fontWeight: "600",
          marginHorizontal: countSpacing,
          fontSize: countFontSize,
        }}
      >
        {upvotes}
      </Text>

      <AnimatedIconButton onPress={handleDownvote} disabled={isLoading}>
        <ArrowBigDown
          size={size}
          color={isDownvoted ? primary : text}
          fill={isDownvoted ? primary : "transparent"}
        />
      </AnimatedIconButton>

      <Text
        style={{
          color: text,
          fontWeight: "600",
          marginLeft: countSpacing,
          fontSize: countFontSize,
        }}
      >
        {downvotes}
      </Text>
    </>
  );
}
