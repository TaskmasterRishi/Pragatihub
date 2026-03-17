import { useUser } from "@clerk/clerk-expo";
import { useFocusEffect } from "expo-router";
import { ArrowBigDown, ArrowBigUp } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text } from "react-native";

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
  }, [pressed, scale]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: initial,
      useNativeDriver: true,
      speed: 25,
      bounciness: 5,
    }).start();
  }, [initial, scale]);

  return { scale, onPressIn, onPressOut };
}

function AnimatedIconButton({
  children,
  onPress,
  disabled,
  extraScale,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  extraScale?: Animated.Value;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale();
  const combinedScale = extraScale ? Animated.multiply(scale, extraScale) : scale;

  return (
    <Animated.View style={{ transform: [{ scale: combinedScale }] }}>
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
  const upBounce = useRef(new Animated.Value(1)).current;
  const downBounce = useRef(new Animated.Value(1)).current;
  const bounce = useCallback((value: Animated.Value) => {
    value.setValue(1);
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1.12,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(value, {
        toValue: 1,
        speed: 20,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    setUpvotes(initialUpvotes || 0);
  }, [initialUpvotes]);

  useEffect(() => {
    setDownvotes(initialDownvotes || 0);
  }, [initialDownvotes]);

  const loadVoteState = useCallback(async () => {
    if (!itemId) return;

    const { up, down } = VOTE_CONFIG[type];
    const idField = up.idField;

    // Fetch current counts and (if logged in) user's vote state in parallel
    const [upCountRes, downCountRes, upUserRes, downUserRes] = await Promise.all([
      supabase
        .from(up.table)
        .select("*", { count: "exact", head: true })
        .eq(idField, itemId),
      supabase
        .from(down.table)
        .select("*", { count: "exact", head: true })
        .eq(idField, itemId),
      user?.id
        ? supabase
            .from(up.table)
            .select("user_id")
            .eq(idField, itemId)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      user?.id
        ? supabase
            .from(down.table)
            .select("user_id")
            .eq(idField, itemId)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    // Always update counts from server so they stay in sync across screens
    setUpvotes(upCountRes.count ?? 0);
    setDownvotes(downCountRes.count ?? 0);

    if (!user?.id) {
      setVoteState("none");
      return;
    }

    if (upUserRes.error || downUserRes.error) {
      console.log("Vote state error:", upUserRes.error || downUserRes.error);
      return;
    }

    if (upUserRes.data) {
      setVoteState("up");
    } else if (downUserRes.data) {
      setVoteState("down");
    } else {
      setVoteState("none");
    }
  }, [itemId, type, user?.id]);

  useEffect(() => {
    loadVoteState();
  }, [loadVoteState]);

  // Refetch vote state when screen gains focus so highlight stays in sync
  // (e.g. user liked on community screen, then navigates to home)
  useFocusEffect(
    useCallback(() => {
      loadVoteState();
    }, [loadVoteState])
  );

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
    let success = false;
    if (voteState === "up") {
      success = await removeUpvote();
    } else if (voteState === "down") {
      const removed = await removeDownvote();
      if (removed) {
        success = await addUpvote();
      }
    } else {
      success = await addUpvote();
    }
    if (success) {
      bounce(upBounce);
    }
    setIsLoading(false);
  };

  const handleDownvote = async () => {
    if (!user?.id || isLoading) return;
    setIsLoading(true);
    let success = false;
    if (voteState === "down") {
      success = await removeDownvote();
    } else if (voteState === "up") {
      const removed = await removeUpvote();
      if (removed) {
        success = await addDownvote();
      }
    } else {
      success = await addDownvote();
    }
    if (success) {
      bounce(downBounce);
    }
    setIsLoading(false);
  };

  const countSpacing = compact ? 6 : 12;
  const countFontSize = compact ? 12 : 14;
  const isUpvoted = voteState === "up";
  const isDownvoted = voteState === "down";

  return (
    <>
      <AnimatedIconButton
        onPress={handleUpvote}
        disabled={isLoading}
        extraScale={upBounce}
      >
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

      <AnimatedIconButton
        onPress={handleDownvote}
        disabled={isLoading}
        extraScale={downBounce}
      >
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
