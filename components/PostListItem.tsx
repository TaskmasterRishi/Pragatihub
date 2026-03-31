import { useUser } from "@clerk/clerk-expo";
import { formatDistanceToNowStrict } from "date-fns";
import { Link, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Check,
  EllipsisVertical,
  Flag,
  Loader2,
  MessageSquare,
  Share2,
  Trophy,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  PressableProps,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import EntityBadge from "@/components/EntityBadge";
import VoteButtons from "@/components/VoteButtons";
import { Post } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/Supabase";
import {
  REPORT_REASONS,
  submitReport,
  type ReportReason,
} from "@/lib/actions/moderation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCREEN_WIDTH = Dimensions.get("window").width;
const ACHIEVEMENTS = [
  { id: "insightful", emoji: "🧠", label: "Insightful", color: "#0EA5E9" },
  { id: "helpful", emoji: "🤝", label: "Helpful", color: "#10B981" },
  { id: "creative", emoji: "🎨", label: "Creative", color: "#8B5CF6" },
  { id: "motivating", emoji: "🚀", label: "Motivating", color: "#F97316" },
  { id: "quality", emoji: "🏆", label: "High Quality", color: "#EAB308" },
  { id: "community", emoji: "💬", label: "Community Pick", color: "#EC4899" },
  { id: "off_topic", emoji: "🧩", label: "Off-topic", color: "#6B7280" },
  { id: "misleading", emoji: "⚠️", label: "Misleading", color: "#EF4444" },
  { id: "low_effort", emoji: "🪫", label: "Low Effort", color: "#9CA3AF" },
  { id: "toxic", emoji: "🚫", label: "Toxic", color: "#DC2626" },
] as const;
type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];
const ACHIEVEMENT_IDS = new Set<string>(ACHIEVEMENTS.map((a) => a.id));
const emptyAchievementCounts = () =>
  Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, 0])) as Record<
    AchievementId,
    number
  >;
const isAchievementId = (value: string): value is AchievementId =>
  ACHIEVEMENT_IDS.has(value);
type AwardListUser = {
  id: string;
  name: string;
  image: string | null;
  context: string | null;
};

/* ───────────────────────────────────────────── */
/* Shared shimmer util */
/* ───────────────────────────────────────────── */
function useShimmer(duration = 1200) {
  const progress = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loopRef.current.start();
    return () => loopRef.current?.stop?.();
  }, [duration, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return { translateX };
}

const ShimmerBar = ({
  height = 16,
  borderRadius = 12,
  style,
}: {
  height?: number | string;
  borderRadius?: number;
  style?: any;
}) => {
  const { translateX } = useShimmer();
  return (
    <View
      style={{
        height,
        width: "100%",
        overflow: "hidden",
        borderRadius,
        backgroundColor: "rgba(148, 163, 184, 0.12)",
        ...style,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: SCREEN_WIDTH * 0.35,
          transform: [{ translateX }],
          backgroundColor: "rgba(255,255,255,0.32)",
          opacity: 0.45,
        }}
      />
    </View>
  );
};

/* ───────────────────────────────────────────── */
/* Shared Press Scale Hook */
/* ───────────────────────────────────────────── */
function usePressScale(initial = 1, pressed = 0.96) {
  const scale = useRef(new Animated.Value(initial)).current;

  const onPressIn = useCallback(() => {
    Animated.timing(scale, {
      toValue: pressed,
      duration: 80,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [pressed, scale]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: initial,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [initial, scale]);

  return { scale, onPressIn, onPressOut };
}

/* ───────────────────────────────────────────── */
/* Fade + Scale Entrance */
/* ───────────────────────────────────────────── */
function FadeInView({
  children,
  delay = 0,
  fromScale = 0.96,
  fromTranslateY = 24,
}: {
  children: React.ReactNode;
  delay?: number;
  fromScale?: number;
  fromTranslateY?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(fromScale)).current;
  const translateY = useRef(new Animated.Value(fromTranslateY)).current;

  useEffect(() => {
    const clampedDelay = Math.min(delay, 200);
    const animation = Animated.sequence([
      Animated.delay(clampedDelay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          speed: 16,
          bounciness: 6,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          speed: 18,
          bounciness: 7,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start();
    return () => animation.stop();
  }, [delay, opacity, scale, translateY]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/* ───────────────────────────────────────────── */
/* Post Image */
/* ───────────────────────────────────────────── */
const PostImage = memo(({ uri }: { uri: string }) => {
  // Default to square so we render immediately; update when metadata arrives
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1.05)).current;
  const overlayOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Image.getSize(
      uri,
      (w, h) => setAspectRatio(w / h),
      () => setAspectRatio(1), // fall back if remote size lookup fails
    );
  }, [uri]);

  const onLoad = () => {
    setIsLoaded(true);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 16,
        bounciness: 7,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

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
      {!isLoaded && (
        <View style={{ ...StyleSheet.absoluteFillObject }}>
          <ShimmerBar height="100%" borderRadius={16} />
        </View>
      )}

      <Animated.Image
        source={{ uri }}
        resizeMode="cover"
        onLoad={onLoad}
        onError={() => setIsLoaded(true)}
        blurRadius={isLoaded ? 0 : 8}
        style={{
          width: "100%",
          height: "100%",
          opacity,
          transform: [{ scale }],
        }}
      />
      {/* subtle overlay fade instead of blur timeout */}
      {!isLoaded && (
        <Animated.View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(0,0,0,0.12)",
            opacity: overlayOpacity,
          }}
        />
      )}
    </View>
  );
});

const PostVideo = memo(
  ({
    uri,
    nativeControls = false,
  }: {
    uri: string;
    nativeControls?: boolean;
  }) => {
    const player = useVideoPlayer({ uri }, (createdPlayer) => {
      createdPlayer.loop = true;
      createdPlayer.muted = true;
      createdPlayer.play();
    });
    const [aspectRatio, setAspectRatio] = useState<number | null>(null);
    const lastAspectRatio = useRef<number | null>(null);
    const [isReady, setIsReady] = useState(false);
    const loadingOpacity = useRef(new Animated.Value(1)).current;
    const videoOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      const setRatioFromTrack = (track?: any) => {
        const width = track?.size?.width;
        const height = track?.size?.height;
        if (
          typeof width === "number" &&
          typeof height === "number" &&
          height > 0
        ) {
          const next = width / height;
          if (lastAspectRatio.current !== next) {
            lastAspectRatio.current = next;
            setAspectRatio(next);
          }
          setIsReady(true);
          Animated.timing(loadingOpacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }).start();
          Animated.timing(videoOpacity, {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
          }).start();
        }
      };

      const setRatioFromTracks = (tracks?: any[]) => {
        const trackWithSize = tracks?.find(
          (track) => track?.size?.width && track?.size?.height,
        );
        setRatioFromTrack(trackWithSize);
      };

      const playerAny = player as any;
      setRatioFromTracks(playerAny?.availableVideoTracks);
      setRatioFromTrack(playerAny?.videoTrack);

      const sourceLoadSubscription = playerAny?.addListener?.(
        "sourceLoad",
        (payload: any) => {
          setRatioFromTracks(payload?.availableVideoTracks);
        },
      );
      const videoTrackSubscription = playerAny?.addListener?.(
        "videoTrackChange",
        (payload: any) => {
          setRatioFromTrack(payload?.videoTrack);
        },
      );

      return () => {
        sourceLoadSubscription?.remove?.();
        videoTrackSubscription?.remove?.();
      };
    }, [player]);

    if (!aspectRatio) {
      return (
        <View
          style={{
            width: "100%",
            aspectRatio: 1,
            maxHeight: SCREEN_WIDTH * 1.25,
            borderRadius: 16,
            backgroundColor: "#00000010",
            overflow: "hidden",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              opacity: loadingOpacity,
            }}
          >
            <ShimmerBar height="100%" borderRadius={16} />
          </Animated.View>
        </View>
      );
    }

    return (
      <View
        style={{
          width: "100%",
          aspectRatio,
          borderRadius: 16,
          backgroundColor: "#000",
          overflow: "hidden",
        }}
      >
        <Animated.View style={{ flex: 1, opacity: videoOpacity }}>
          <VideoView
            style={{ flex: 1 }}
            player={player}
            nativeControls={nativeControls}
            fullscreenOptions={{ enable: true }}
            allowsPictureInPicture
            contentFit="contain"
          />
        </Animated.View>

        {!isReady && (
          <Animated.View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              opacity: loadingOpacity,
            }}
          >
            <ShimmerBar height="100%" borderRadius={16} />
          </Animated.View>
        )}
      </View>
    );
  },
);

const PostLinkPreview = memo(({ uri }: { uri: string }) => {
  const muted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: border,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: muted, fontSize: 12 }} numberOfLines={1}>
        {uri}
      </Text>
    </View>
  );
});

/* ───────────────────────────────────────────── */
/* Skeleton Card (used before posts load) */
/* ───────────────────────────────────────────── */
const SkeletonLine = ({
  width = "100%",
  height = 12,
  radius = 10,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
}) => (
  <View
    //@ts-ignore
    style={{
      width,
      height,
      borderRadius: radius,
      backgroundColor: "rgba(148, 163, 184, 0.16)",
      overflow: "hidden",
    }}
  >
    <ShimmerBar height="100%" borderRadius={radius} />
  </View>
);

const SkeletonCircle = ({ size = 42 }: { size?: number }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: "rgba(148, 163, 184, 0.16)",
      overflow: "hidden",
    }}
  >
    <ShimmerBar height="100%" borderRadius={size / 2} />
  </View>
);

export const PostSkeletonCard = memo(({ index = 0 }: { index?: number }) => {
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");

  return (
    <FadeInView delay={index * 50} fromTranslateY={16} fromScale={0.98}>
      <View
        style={{
          backgroundColor: card,
          borderRadius: 18,
          padding: 14,
          borderWidth: 1,
          marginBottom: 14,
          borderColor: border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 14,
            gap: 12,
          }}
        >
          <SkeletonCircle />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonLine width="52%" height={12} />
            <SkeletonLine width="38%" height={10} />
          </View>
          <SkeletonLine width={64} height={28} radius={999} />
        </View>

        <View style={{ gap: 10 }}>
          <SkeletonLine width="88%" height={16} />
          <SkeletonLine width="70%" height={14} />
          <SkeletonLine width="94%" height={12} />
        </View>

        <View
          style={{
            marginTop: 14,
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: "rgba(148, 163, 184, 0.16)",
            height: SCREEN_WIDTH * 0.6,
          }}
        >
          <ShimmerBar height="100%" borderRadius={16} />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginTop: 14,
          }}
        >
          <SkeletonLine width={90} height={34} radius={999} />
          <SkeletonLine width={70} height={34} radius={999} />
          <View style={{ flex: 1 }} />
          <SkeletonLine width={26} height={26} radius={999} />
          <SkeletonLine width={26} height={26} radius={999} />
        </View>
      </View>
    </FadeInView>
  );
});

type PollOption = {
  id: string;
  option_text: string;
  option_order: number;
  votes: number;
};

type PollState = {
  id: string;
  allowsMultiple: boolean;
  endsAt: string;
  options: PollOption[];
  myVotes: Set<string>;
  totalVotes: number;
};

const PostPoll = memo(({ postId }: { postId: string }) => {
  const { user } = useUser();
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const card = useThemeColor({}, "card");

  const [poll, setPoll] = useState<PollState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingOptionId, setSubmittingOptionId] = useState<string | null>(
    null,
  );

  const loadPoll = useCallback(async () => {
    setLoading(true);
    const { data: pollData, error: pollError } = await supabase
      .from("post_polls")
      .select("id, allows_multiple, ends_at")
      .eq("post_id", postId)
      .maybeSingle();

    if (pollError || !pollData) {
      if (pollError) {
        console.log("Poll fetch error:", pollError);
      }
      setPoll(null);
      setLoading(false);
      return;
    }

    const [
      { data: optionsData, error: optionsError },
      { data: votesData, error: votesError },
    ] = await Promise.all([
      supabase
        .from("post_poll_options")
        .select("id, option_text, option_order")
        .eq("poll_id", pollData.id)
        .order("option_order", { ascending: true }),
      supabase
        .from("post_poll_votes")
        .select("option_id, user_id")
        .eq("poll_id", pollData.id),
    ]);

    if (optionsError || votesError || !optionsData) {
      console.log(
        "Poll options/votes fetch error:",
        optionsError || votesError,
      );
      setPoll(null);
      setLoading(false);
      return;
    }

    const voteCounts = new Map<string, number>();
    const myVotes = new Set<string>();

    (votesData ?? []).forEach((vote) => {
      voteCounts.set(vote.option_id, (voteCounts.get(vote.option_id) ?? 0) + 1);
      if (vote.user_id === user?.id) {
        myVotes.add(vote.option_id);
      }
    });

    const options: PollOption[] = optionsData.map((option) => ({
      ...option,
      votes: voteCounts.get(option.id) ?? 0,
    }));

    setPoll({
      id: pollData.id,
      allowsMultiple: pollData.allows_multiple,
      endsAt: pollData.ends_at,
      options,
      myVotes,
      totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    });
    setLoading(false);
  }, [postId, user?.id]);

  useEffect(() => {
    loadPoll();
  }, [loadPoll]);

  const updatePollVoteState = (optionId: string) => {
    setPoll((prev) => {
      if (!prev) return prev;

      const options = prev.options.map((option) => ({ ...option }));
      const myVotes = new Set(prev.myVotes);
      const isAlreadyVoted = myVotes.has(optionId);

      if (prev.allowsMultiple) {
        const targetOption = options.find((option) => option.id === optionId);
        if (!targetOption) return prev;

        if (isAlreadyVoted) {
          myVotes.delete(optionId);
          targetOption.votes = Math.max(0, targetOption.votes - 1);
        } else {
          myVotes.add(optionId);
          targetOption.votes += 1;
        }
      } else {
        if (isAlreadyVoted) {
          options.forEach((option) => {
            if (option.id === optionId) {
              option.votes = Math.max(0, option.votes - 1);
            }
          });
          myVotes.clear();
        } else {
          myVotes.forEach((selectedOptionId) => {
            options.forEach((option) => {
              if (option.id === selectedOptionId) {
                option.votes = Math.max(0, option.votes - 1);
              }
            });
          });
          myVotes.clear();
          myVotes.add(optionId);
          options.forEach((option) => {
            if (option.id === optionId) {
              option.votes += 1;
            }
          });
        }
      }

      return {
        ...prev,
        options,
        myVotes,
        totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
      };
    });
  };

  const handleVote = async (optionId: string) => {
    if (!user?.id || !poll || submittingOptionId) return;
    if (new Date(poll.endsAt).getTime() <= Date.now()) return;

    const isAlreadyVoted = poll.myVotes.has(optionId);
    setSubmittingOptionId(optionId);

    if (poll.allowsMultiple) {
      if (isAlreadyVoted) {
        const { error } = await supabase
          .from("post_poll_votes")
          .delete()
          .eq("poll_id", poll.id)
          .eq("option_id", optionId)
          .eq("user_id", user.id);
        if (error) {
          console.log("Poll vote remove error:", error);
          setSubmittingOptionId(null);
          return;
        }
      } else {
        const { error } = await supabase.from("post_poll_votes").insert({
          poll_id: poll.id,
          option_id: optionId,
          user_id: user.id,
        });
        if (error) {
          console.log("Poll vote add error:", error);
          setSubmittingOptionId(null);
          return;
        }
      }
    } else if (isAlreadyVoted) {
      const { error } = await supabase
        .from("post_poll_votes")
        .delete()
        .eq("poll_id", poll.id)
        .eq("user_id", user.id);
      if (error) {
        console.log("Poll vote remove error:", error);
        setSubmittingOptionId(null);
        return;
      }
    } else {
      const { error: removeError } = await supabase
        .from("post_poll_votes")
        .delete()
        .eq("poll_id", poll.id)
        .eq("user_id", user.id);

      if (removeError) {
        console.log("Poll vote reset error:", removeError);
        setSubmittingOptionId(null);
        return;
      }

      const { error: addError } = await supabase
        .from("post_poll_votes")
        .insert({
          poll_id: poll.id,
          option_id: optionId,
          user_id: user.id,
        });

      if (addError) {
        console.log("Poll vote add error:", addError);
        setSubmittingOptionId(null);
        return;
      }
    }

    updatePollVoteState(optionId);
    setSubmittingOptionId(null);
  };

  if (loading) {
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: border,
          borderRadius: 16,
          paddingVertical: 18,
          alignItems: "center",
        }}
      >
        <Loader2 size={20} color={muted} />
      </View>
    );
  }

  if (!poll || poll.options.length === 0) {
    return null;
  }

  const isExpired = new Date(poll.endsAt).getTime() <= Date.now();
  const pollMeta = isExpired
    ? `Ended ${formatDistanceToNowStrict(new Date(poll.endsAt))} ago`
    : `Ends in ${formatDistanceToNowStrict(new Date(poll.endsAt))}`;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: border,
        borderRadius: 16,
        padding: 10,
        gap: 8,
      }}
    >
      {poll.options.map((option) => {
        const isSelected = poll.myVotes.has(option.id);
        const percentage =
          poll.totalVotes > 0
            ? Math.round((option.votes / poll.totalVotes) * 100)
            : 0;

        return (
          <Pressable
            key={option.id}
            disabled={isExpired || !!submittingOptionId}
            onPress={() => handleVote(option.id)}
            style={{
              borderWidth: 1,
              borderColor: isSelected ? primary : border,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: card,
              opacity:
                submittingOptionId && submittingOptionId !== option.id
                  ? 0.6
                  : 1,
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: `${percentage}%`,
                backgroundColor: `${primary}22`,
              }}
            />
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text style={{ color: text, fontWeight: "500", flex: 1 }}>
                {option.option_text}
              </Text>

              {isSelected && <Check size={16} color={primary} />}
              <Text style={{ color: muted, marginLeft: 8, fontSize: 12 }}>
                {option.votes} ({percentage}%)
              </Text>
            </View>
          </Pressable>
        );
      })}

      <Text style={{ color: muted, fontSize: 12 }}>
        {poll.totalVotes} vote{poll.totalVotes === 1 ? "" : "s"} •{" "}
        {poll.allowsMultiple ? "Multiple choices" : "Single choice"} •{" "}
        {pollMeta}
      </Text>
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
  pressedScale = 0.96,
  enableOpacity = true,
  hitSlop,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  pressedScale?: number;
  enableOpacity?: boolean;
  hitSlop?:
    | number
    | { top?: number; left?: number; bottom?: number; right?: number };
}) {
  const { scale, onPressIn, onPressOut } = usePressScale(1, pressedScale);
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    onPressIn();
    if (!enableOpacity) return;
    Animated.timing(opacity, {
      toValue: 0.7,
      duration: 90,
      useNativeDriver: true,
    }).start();
  }, [enableOpacity, onPressIn, opacity]);

  const handlePressOut = useCallback(() => {
    onPressOut();
    if (!enableOpacity) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  }, [enableOpacity, onPressOut, opacity]);

  return (
    <Animated.View style={[{ transform: [{ scale }], opacity }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={{ color: "#00000008", borderless: true }}
        hitSlop={hitSlop}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function ScalePressable({
  children,
  onPress,
  style,
  disabled = false,
  pressedScale = 0.96,
  ...pressableProps
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  disabled?: boolean;
  pressedScale?: number;
} & PressableProps) {
  const { scale, onPressIn, onPressOut } = usePressScale(1, pressedScale);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={{ color: "#00000008" }}
        {...pressableProps}
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
  showOwnerActions = false,
  index = 0,
  refreshing = false,
  onEditPost,
  onDeletePost,
  onSharePost,
}: {
  post: Post;
  isDetailedPost?: boolean;
  showOwnerActions?: boolean;
  index?: number;
  refreshing?: boolean;
  onEditPost?: (post: Post) => void;
  onDeletePost?: (post: Post) => void;
  onSharePost?: (post: Post) => void;
}) {
  const router = useRouter();
  const { user } = useUser();
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");
  const cardBorder = useThemeColor({ light: "#cbd5e1" }, "border");
  const background = useThemeColor({}, "background");
  const userBadgeAccent = useThemeColor({}, "userBadgeAccent");
  const communityBadgeAccent = useThemeColor({}, "communityBadgeAccent");
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);
  const orderedMedia = [...(post.post_media ?? [])].sort(
    (a, b) => a.media_order - b.media_order,
  );
  const firstMedia = orderedMedia[0];
  const primaryMediaUrl =
    firstMedia?.media_url ??
    (post.post_type === "video" ? (post.link_url ?? null) : post.image);
  const isVideoPost =
    firstMedia?.media_type === "video" ||
    (post.post_type === "video" && !!primaryMediaUrl);
  const isPollPost = post.post_type === "poll";
  const canReportPost = user?.id !== post.user.id;
  const [ownerSheetVisible, setOwnerSheetVisible] = useState(false);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(
    null,
  );
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [isWritingDetails, setIsWritingDetails] = useState(false);
  const [isSubmittingModeratorSupport, setIsSubmittingModeratorSupport] =
    useState(false);
  const [awardSheetVisible, setAwardSheetVisible] = useState(false);
  const [awardUsersSheetVisible, setAwardUsersSheetVisible] = useState(false);
  const [awardUsersSheetTitle, setAwardUsersSheetTitle] = useState("");
  const [awardUsersLoading, setAwardUsersLoading] = useState(false);
  const [awardUsersLoaded, setAwardUsersLoaded] = useState(false);
  const [awardUsers, setAwardUsers] = useState<AwardListUser[]>([]);
  const [awardContext, setAwardContext] = useState("");
  const awardUsersRequestIdRef = useRef(0);
  const [achievementCounts, setAchievementCounts] = useState<
    Record<AchievementId, number>
  >(emptyAchievementCounts);
  const [awardedByMe, setAwardedByMe] = useState<Record<string, true>>({});
  const loadingPulseAnim = useRef(new Animated.Value(0.85)).current;
  const reportSheetAnim = useRef(new Animated.Value(0)).current;
  const reportSuccessAnim = useRef(new Animated.Value(0)).current;
  const updatedAt = post.updated_at ?? post.edited_at ?? null;
  const isEdited =
    post.is_edited === true ||
    (typeof updatedAt === "string" &&
      new Date(updatedAt).getTime() - new Date(post.created_at).getTime() >
        1000);
  const reportSheetTranslateY = reportSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [36, 0],
  });
  const reportSuccessTranslateY = reportSuccessAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  useEffect(() => {
    if (!reportSheetVisible) return;
    reportSheetAnim.setValue(0);
    Animated.parallel([
      Animated.timing(reportSheetAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reportSheetVisible, reportSheetAnim]);

  useEffect(() => {
    if (!reportSubmitted) return;
    reportSuccessAnim.setValue(0);
    Animated.spring(reportSuccessAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 16,
      bounciness: 7,
    }).start();
  }, [reportSubmitted, reportSuccessAnim]);

  const handleShare = async () => {
    if (onSharePost) {
      onSharePost(post);
      return;
    }

    try {
      await Share.share({
        message: `${post.title}\n\nhttps://pragatihub.app/post/${post.id}`,
      });
    } catch (error) {
      console.log("Share post error:", error);
    }
  };

  const openOwnerMenu = () => {
    setOwnerSheetVisible(true);
  };

  const openReportMenu = () => {
    setSelectedReason(null);
    setReportDetails("");
    setReportSubmitted(false);
    setReportSheetVisible(true);
  };

  const handleSubmitReport = async () => {
    if (!selectedReason || reportSubmitting || !user?.id) return;
    setReportSubmitting(true);
    const { error } = await submitReport(
      post.id,
      post.group.id,
      selectedReason,
      user.id,
      reportDetails,
    );
    setReportSubmitting(false);
    if (!error) {
      setReportSubmitted(true);
      setTimeout(() => {
        setReportSheetVisible(false);
        setReportSubmitted(false);
        setSelectedReason(null);
        setReportDetails("");
      }, 2000);
    } else {
      Alert.alert(
        "Error",
        (error as Error)?.message ||
          "Failed to submit report. Please try again.",
      );
    }
  };

  const supportAuthorAsModerator = async () => {
    if (!user?.id || isSubmittingModeratorSupport) return;
    setIsSubmittingModeratorSupport(true);
    try {
      await supabase.from("group_moderator_votes").upsert(
        {
          group_id: post.group.id,
          candidate_user_id: post.user.id,
          voter_user_id: user.id,
        },
        { onConflict: "group_id,candidate_user_id,voter_user_id" },
      );
    } catch (e) {
      console.log("Support moderator error:", e);
    } finally {
      setIsSubmittingModeratorSupport(false);
    }
  };

  // subtle pulse for refresh shimmer
  useEffect(() => {
    if (!refreshing) {
      loadingPulseAnim.setValue(0.85);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingPulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(loadingPulseAnim, {
          toValue: 0.85,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [loadingPulseAnim, refreshing]);

  const entranceDelay = Math.min(index * 40, 200);
  const isOnDetail = isDetailedPost;
  const postAgeLabel = `${formatDistanceToNowStrict(new Date(post.created_at))} ago`;
  const canAwardPost = !!user?.id && user.id !== post.user.id;
  const fetchAchievementState = useCallback(async () => {
    const { data, error } = await supabase
      .from("post_badge_awards")
      .select("badge_key, awarded_by_user_id")
      .eq("post_id", post.id);

    if (error) return;

    const nextCounts = emptyAchievementCounts();
    const nextAwardedByMe: Record<string, true> = {};
    for (const row of data ?? []) {
      const badgeKey = String((row as any).badge_key ?? "");
      if (!isAchievementId(badgeKey)) continue;
      nextCounts[badgeKey] = (nextCounts[badgeKey] ?? 0) + 1;
      if (
        user?.id &&
        String((row as any).awarded_by_user_id ?? "") === user.id
      ) {
        nextAwardedByMe[badgeKey] = true;
      }
    }

    setAchievementCounts(nextCounts);
    setAwardedByMe(nextAwardedByMe);
  }, [post.id, user?.id]);

  useEffect(() => {
    void fetchAchievementState();
  }, [fetchAchievementState]);

  useEffect(() => {
    const channel = supabase
      .channel(`post-badges:${post.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_badge_awards",
          filter: `post_id=eq.${post.id}`,
        },
        () => {
          void fetchAchievementState();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchAchievementState, post.id]);

  const totalAchievementCount = ACHIEVEMENTS.reduce(
    (sum, item) => sum + (achievementCounts[item.id] ?? 0),
    0,
  );
  const visibleAchievements = isOnDetail
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter(
        (item) => (achievementCounts[item.id] ?? 0) > 0,
      ).slice(0, 4);
  const compactAchievements = ACHIEVEMENTS.filter(
    (item) => (achievementCounts[item.id] ?? 0) > 0,
  ).slice(0, 6);
  const showFloatingCompactAchievements =
    !isOnDetail && compactAchievements.length > 0;
  const awardAchievement = async (id: AchievementId, context?: string) => {
    if (!canAwardPost) {
      Alert.alert("Not available", "You cannot award your own post.");
      return;
    }
    if (awardedByMe[id]) {
      Alert.alert("Already awarded", "You already gave this badge.");
      return;
    }
    setAwardedByMe((prev) => ({ ...prev, [id]: true }));
    setAchievementCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    setAwardSheetVisible(false);

    const { error } = await supabase.from("post_badge_awards").insert({
      post_id: post.id,
      badge_key: id,
      awarded_by_user_id: user?.id,
      awarded_to_user_id: post.user.id,
      award_context: (context ?? "").trim() || null,
    });

    if (!error) {
      setAwardContext("");
      return;
    }

    setAwardedByMe((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setAchievementCounts((prev) => ({
      ...prev,
      [id]: Math.max((prev[id] ?? 1) - 1, 0),
    }));

    if ((error as any)?.code === "23505") {
      Alert.alert("Already awarded", "You already gave this badge.");
      return;
    }

    Alert.alert("Could not award", error.message ?? "Please try again.");
  };
  const openAwardUsersSheet = async (
    achievement: (typeof ACHIEVEMENTS)[number],
  ) => {
    const requestId = awardUsersRequestIdRef.current + 1;
    awardUsersRequestIdRef.current = requestId;
    setAwardUsersSheetTitle(`${achievement.emoji} ${achievement.label}`);
    setAwardUsers([]);
    setAwardUsersLoaded(false);
    setAwardUsersLoading(true);
    setAwardUsersSheetVisible(true);

    const { data, error } = await supabase
      .from("post_badge_awards")
      .select(
        "awarded_by_user_id, award_context, awarded_by:users!post_badge_awards_awarded_by_user_id_fkey(id, name, image)",
      )
      .eq("post_id", post.id)
      .eq("badge_key", achievement.id)
      .order("created_at", { ascending: false });

    if (awardUsersRequestIdRef.current !== requestId) return;

    if (error) {
      setAwardUsersLoading(false);
      setAwardUsersLoaded(true);
      return;
    }

    const seen = new Set<string>();
    const users: AwardListUser[] = [];
    for (const row of (data ?? []) as any[]) {
      const uid = String(row.awarded_by_user_id ?? "");
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      users.push({
        id: uid,
        name: String(row.awarded_by?.name ?? "User"),
        image: (row.awarded_by?.image as string | null) ?? null,
        context: (row.award_context as string | null) ?? null,
      });
    }
    setAwardUsers(users);
    setAwardUsersLoading(false);
    setAwardUsersLoaded(true);
  };
  const MetaBadge = ({
    prefix,
    value,
    variant,
    trailing,
    onPress,
  }: {
    prefix: string;
    value: string;
    variant: "user" | "community";
    trailing?: string;
    onPress?: () => void;
  }) => {
    const isCommunity = variant === "community";
    const badgeAccent = isCommunity ? communityBadgeAccent : userBadgeAccent;
    const content = (
      <>
        {prefix ? (
          <View
            style={{
              width: variant === "user" ? 22 : 18,
              height: variant === "user" ? 22 : 18,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${badgeAccent}22`,
            }}
          >
            <Text
              style={{
                color: badgeAccent,
                fontSize: variant === "user" ? 16 : 10,
                fontWeight: "800",
              }}
            >
              {prefix}
            </Text>
          </View>
        ) : null}
        <Text
          style={{
            color: text,
            fontSize: variant === "user" ? 16 : 11,
            fontWeight: variant === "user" ? "800" : "700",
            flexShrink: 1,
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
        {trailing ? (
          <Text style={{ color: badgeAccent, fontSize: 12, fontWeight: "900" }}>
            {trailing}
          </Text>
        ) : null}
      </>
    );

    if (onPress) {
      return (
        <Pressable
          onPress={onPress}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingVertical: 0,
            maxWidth: "100%",
          }}
        >
          {content}
        </Pressable>
      );
    }

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingVertical: 0,
          maxWidth: "100%",
        }}
      >
        {content}
      </View>
    );
  };

  return (
    <FadeInView delay={entranceDelay} fromTranslateY={24} fromScale={0.96}>
      <>
        <View
          style={{
            backgroundColor: card,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            marginBottom: isOnDetail
              ? 10
              : showFloatingCompactAchievements
                ? 40
                : 14,
            borderColor: cardBorder,
            shadowColor: "#0b1220",
            shadowOpacity: isOnDetail ? 0.04 : 0.06,
            shadowRadius: isOnDetail ? 7 : 10,
            shadowOffset: { width: 0, height: isOnDetail ? 4 : 6 },
            elevation: isOnDetail ? 2 : 3,
            position: "relative",
          }}
        >
          {/* Header */}
          <View className="flex-row items-center mb-3">
            <Pressable onPress={() => router.push(`/user/${post.user.id}`)}>
              <Image
                source={{
                  uri: post.user.image || "https://via.placeholder.com/150",
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: `${border}99`,
                }}
              />
            </Pressable>

            <View className="ml-3 flex-1">
              <View style={{ gap: 2, maxWidth: "100%" }}>
                <MetaBadge
                  prefix="U"
                  value={post.user.name}
                  variant="user"
                  onPress={() => router.push(`/user/${post.user.id}`)}
                />
                <MetaBadge
                  prefix=""
                  value={`Posted under ${post.group.name}`}
                  variant="community"
                  trailing=">"
                  onPress={() => router.push(`/community/${post.group.id}`)}
                />
                <Text
                  style={{ color: muted, fontSize: 10.5, fontWeight: "600" }}
                  numberOfLines={1}
                >
                  {postAgeLabel}
                </Text>
              </View>
            </View>

            {showOwnerActions ? (
              <Pressable
                onPress={openOwnerMenu}
                hitSlop={8}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <EllipsisVertical size={18} color={muted} />
              </Pressable>
            ) : null}
          </View>

          {isEdited && (
            <Text
              style={{
                color: muted,
                fontSize: 12,
                fontWeight: "600",
                marginTop: -8,
                marginBottom: 12,
              }}
            >
              Edited
            </Text>
          )}

          <Link href={`/post/${post.id}`} asChild>
            <ScalePressable pressedScale={0.97}>
              <View className="gap-3">
                <Text
                  style={{
                    color: text,
                    fontSize: 19,
                    lineHeight: 25,
                    fontWeight: "800",
                  }}
                >
                  {post.title}
                </Text>

                {post.description && (
                  <Text
                    style={{ color: muted, fontSize: 14, lineHeight: 20 }}
                    numberOfLines={isDetailedPost ? undefined : 2}
                  >
                    {post.description}
                  </Text>
                )}

                {post.post_type === "link" && !!post.link_url && (
                  <PostLinkPreview uri={post.link_url} />
                )}

                {!!primaryMediaUrl && !isVideoPost && (
                  <PostImage uri={primaryMediaUrl} />
                )}
              </View>
            </ScalePressable>
          </Link>

          {isPollPost && <PostPoll postId={post.id} />}

          {!!primaryMediaUrl &&
            isVideoPost &&
            (isDetailedPost ? (
              <PostVideo uri={primaryMediaUrl} nativeControls />
            ) : (
              <Link href={`/post/${post.id}`} asChild>
                <ScalePressable pressedScale={0.97}>
                  <PostVideo uri={primaryMediaUrl} />
                </ScalePressable>
              </Link>
            ))}

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: border,
              marginTop: 12,
              marginBottom: 10,
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
                backgroundColor: background,
                paddingHorizontal: 6,
                paddingVertical: 4,
              }}
            >
              <VoteButtons
                type="post"
                itemId={post.id}
                initialUpvotes={post.upvotes}
                initialDownvotes={post.downvotes}
              />
            </View>

            {/* Comments */}
            <View
              className="flex-row items-center ml-3"
              style={{
                borderWidth: 1,
                borderColor: border,
                borderRadius: 999,
                backgroundColor: background,
                paddingHorizontal: 9,
                paddingVertical: 6,
                gap: 5,
              }}
            >
              <MessageSquare size={16} color={muted} />
              <Text style={{ color: muted, fontWeight: "600", fontSize: 12 }}>
                {post.nr_of_comments}
              </Text>
            </View>

            {/* Actions */}
            <View
              className="ml-auto flex-row items-center"
              style={{
                borderWidth: 1,
                borderColor: border,
                borderRadius: 999,
                backgroundColor: background,
                paddingHorizontal: 9,
                paddingVertical: 5,
              }}
            >
              {canAwardPost ? (
                <>
                  <AnimatedIconButton>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Pressable onPress={() => setAwardSheetVisible(true)}>
                        <Trophy size={17} color={muted} />
                      </Pressable>
                      {totalAchievementCount > 0 ? (
                        <Text
                          style={{
                            color: muted,
                            fontSize: 11,
                            fontWeight: "700",
                            minWidth: 10,
                          }}
                        >
                          {totalAchievementCount}
                        </Text>
                      ) : null}
                    </View>
                  </AnimatedIconButton>

                  <View
                    style={{
                      width: 1,
                      height: 18,
                      backgroundColor: border,
                      marginHorizontal: 10,
                    }}
                  />
                </>
              ) : null}

              <AnimatedIconButton onPress={handleShare}>
                <Share2 size={17} color={muted} />
              </AnimatedIconButton>

              {canReportPost && (
                <View
                  style={{
                    width: 1,
                    height: 18,
                    backgroundColor: border,
                    marginHorizontal: 10,
                  }}
                />
              )}

              {/* Report button — hidden for post owner */}
              {canReportPost && (
                <AnimatedIconButton onPress={openReportMenu}>
                  <Flag size={17} color={muted} />
                </AnimatedIconButton>
              )}
            </View>
          </View>

          {isOnDetail && (
            <View
              style={{
                marginTop: 10,
                borderTopWidth: 1,
                borderColor: `${border}AA`,
                paddingTop: 8,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  rowGap: 8,
                }}
              >
                {visibleAchievements.map((item) => {
                  const count = achievementCounts[item.id] ?? 0;
                  const dim = count === 0;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => void openAwardUsersSheet(item)}
                      style={{
                        width: "48.5%",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        borderWidth: 1,
                        borderRadius: 12,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        backgroundColor: dim ? `${muted}10` : `${item.color}16`,
                        borderColor: dim ? `${border}` : `${item.color}4A`,
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>{item.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: dim ? muted : item.color,
                            fontSize: 11.5,
                            fontWeight: "700",
                          }}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: dim ? muted : item.color,
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        {count}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {showFloatingCompactAchievements && (
            <View
              style={{
                position: "absolute",
                left: 14,
                right: 14,
                bottom: -22,
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {compactAchievements.map((item) => {
                const count = achievementCounts[item.id] ?? 0;
                return (
                  <View key={item.id}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        borderWidth: 1,
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        backgroundColor: card,
                        borderColor: `${item.color}66`,
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>{item.emoji}</Text>
                      <Text
                        style={{
                          color: item.color,
                          fontSize: 11,
                          fontWeight: "800",
                        }}
                      >
                        {count}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {refreshing && (
            <Animated.View
              pointerEvents="none"
              style={{
                ...StyleSheet.absoluteFillObject,
                borderRadius: 18,
                overflow: "hidden",
                opacity: 0.35,
              }}
            >
              <Animated.View
                style={{
                  ...StyleSheet.absoluteFillObject,
                  opacity: refreshing ? loadingPulseAnim : 0,
                }}
              >
                <ShimmerBar height="100%" borderRadius={18} />
              </Animated.View>
            </Animated.View>
          )}
        </View>

        <Modal
          transparent
          visible={ownerSheetVisible}
          animationType="fade"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setOwnerSheetVisible(false)}
        >
          <View
            style={{
              flex: 1,
            }}
          >
            <Pressable
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: "rgba(0,0,0,0.35)",
              }}
              onPress={() => setOwnerSheetVisible(false)}
            />
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: bottomInset + 32,
                marginBottom: -bottomInset,
                borderTopWidth: 1,
                borderColor: border,
                gap: 8,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: border,
                  alignSelf: "center",
                  marginBottom: 8,
                }}
              />

              <TouchableOpacity
                onPress={() => {
                  setOwnerSheetVisible(false);
                  onEditPost?.(post);
                }}
                style={{
                  paddingVertical: 12,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: text, fontSize: 16, fontWeight: "600" }}>
                  Edit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setOwnerSheetVisible(false);
                  void handleShare();
                }}
                style={{
                  paddingVertical: 12,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: text, fontSize: 16, fontWeight: "600" }}>
                  Share
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setOwnerSheetVisible(false);
                  onDeletePost?.(post);
                }}
                style={{
                  paddingVertical: 12,
                  borderRadius: 10,
                }}
              >
                <Text
                  style={{ color: "#ef4444", fontSize: 16, fontWeight: "600" }}
                >
                  Delete
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setOwnerSheetVisible(false)}
                style={{
                  marginTop: 4,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: `${muted}20`,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: text, fontSize: 15, fontWeight: "600" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </Pressable>
          </View>
        </Modal>

        {/* ── Report Modal ── */}
        <Modal
          transparent
          visible={reportSheetVisible}
          animationType="slide"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setReportSheetVisible(false)}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: "rgba(2, 6, 23, 0.58)",
              }}
              onPress={() => setReportSheetVisible(false)}
            />
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: "flex-end",
              }}
            >
              <Animated.View
                style={{
                  backgroundColor: card,
                  borderTopLeftRadius: 30,
                  borderTopRightRadius: 30,
                  borderTopWidth: 1,
                  borderColor: border,
                  maxHeight: "92%",
                  paddingBottom: bottomInset + 20,
                  overflow: "hidden",
                  shadowColor: "#000",
                  shadowOpacity: 0.2,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: -8 },
                  elevation: 12,
                  opacity: reportSheetAnim,
                  transform: [{ translateY: reportSheetTranslateY }],
                }}
              >
                {/* Handle */}
                <View
                  style={{
                    alignItems: "center",
                    paddingTop: 12,
                    paddingBottom: 4,
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 5,
                      borderRadius: 999,
                      backgroundColor: `${muted}40`,
                    }}
                  />
                </View>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingTop: 14,
                    paddingBottom: 20,
                  }}
                >
                  {reportSubmitted ? (
                    /* ── Success State ── */
                    <Animated.View
                      style={{
                        alignItems: "center",
                        paddingVertical: 34,
                        gap: 14,
                        opacity: reportSuccessAnim,
                        transform: [{ translateY: reportSuccessTranslateY }],
                      }}
                    >
                      <View
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 36,
                          backgroundColor: "#22c55e18",
                          borderWidth: 1.5,
                          borderColor: "#22c55e44",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Check size={32} color="#22c55e" />
                      </View>
                      <View style={{ alignItems: "center", gap: 6 }}>
                        <Text
                          style={{
                            color: text,
                            fontSize: 20,
                            fontWeight: "800",
                            letterSpacing: -0.3,
                          }}
                        >
                          Report Submitted
                        </Text>
                        <Text
                          style={{
                            color: muted,
                            fontSize: 14,
                            textAlign: "center",
                            lineHeight: 22,
                            maxWidth: 260,
                          }}
                        >
                          Moderators will review your report and take
                          appropriate action.
                        </Text>
                      </View>
                      <ScalePressable
                        onPress={() => setReportSheetVisible(false)}
                        pressedScale={0.96}
                        style={{
                          marginTop: 4,
                          overflow: "hidden",
                          borderRadius: 16,
                          backgroundColor: "#22c55e",
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 15,
                            fontWeight: "700",
                            paddingVertical: 13,
                            paddingHorizontal: 40,
                          }}
                        >
                          Done
                        </Text>
                      </ScalePressable>
                    </Animated.View>
                  ) : (
                    /* ── Report Form ── */
                    <>
                      {/* Header */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 12,
                          borderRadius: 16,
                          backgroundColor: `${muted}10`,
                          borderWidth: 1,
                          borderColor: `${muted}20`,
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: "#EF444418",
                            borderWidth: 1,
                            borderColor: "#EF444433",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Flag size={18} color="#EF4444" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: text,
                              fontSize: 18,
                              fontWeight: "800",
                              letterSpacing: -0.3,
                            }}
                          >
                            Report Post
                          </Text>
                          <Text
                            style={{
                              color: muted,
                              fontSize: 12.5,
                              marginTop: 2,
                              lineHeight: 18,
                            }}
                          >
                            Pick the issue that best matches this post.
                          </Text>
                        </View>
                      </View>

                      {/* Divider */}
                      <View
                        style={{
                          height: 1,
                          backgroundColor: border,
                          marginVertical: 18,
                        }}
                      />

                      <Text
                        style={{
                          color: text,
                          fontSize: 13,
                          fontWeight: "700",
                          marginBottom: 12,
                          opacity: 0.8,
                        }}
                      >
                        Why are you reporting this?
                      </Text>

                      {/* Reason Grid — 2 columns */}
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 8,
                          marginBottom: 22,
                        }}
                      >
                        {REPORT_REASONS.map((reason) => {
                          const isSelected = selectedReason === reason.value;
                          return (
                            <ScalePressable
                              key={reason.value}
                              onPress={() => setSelectedReason(reason.value)}
                              pressedScale={0.975}
                              style={{
                                width: "48%",
                                borderRadius: 16,
                                borderWidth: 1.5,
                                borderColor: isSelected
                                  ? reason.color
                                  : `${border}`,
                                backgroundColor: isSelected
                                  ? `${reason.color}16`
                                  : `${muted}10`,
                                overflow: "hidden",
                              }}
                            >
                              <View
                                style={{
                                  paddingVertical: 13,
                                  paddingHorizontal: 14,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                  minHeight: 48,
                                }}
                              >
                                {/* Color dot */}
                                <View
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 5,
                                    backgroundColor: isSelected
                                      ? reason.color
                                      : `${muted}60`,
                                  }}
                                />
                                <Text
                                  style={{
                                    color: isSelected ? reason.color : text,
                                    fontSize: 13.5,
                                    fontWeight: isSelected ? "700" : "500",
                                    flex: 1,
                                  }}
                                  numberOfLines={2}
                                >
                                  {reason.label}
                                </Text>
                                {isSelected && (
                                  <View
                                    style={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: 8,
                                      backgroundColor: reason.color,
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <Check
                                      size={10}
                                      color="#fff"
                                      strokeWidth={3}
                                    />
                                  </View>
                                )}
                              </View>
                            </ScalePressable>
                          );
                        })}
                      </View>

                      {/* Details input wrapped in KeyboardAvoidingView */}
                      <KeyboardAvoidingView
                        behavior={
                          Platform.OS === "ios" ? "position" : "padding"
                        }
                        keyboardVerticalOffset={
                          Platform.OS === "ios" ? 140 : 80
                        }
                      >
                        <Text
                          style={{
                            color: text,
                            fontSize: 13,
                            fontWeight: "700",
                            marginBottom: 10,
                            opacity: 0.8,
                          }}
                        >
                          Additional details (optional)
                        </Text>
                        <View
                          style={{
                            borderWidth: 1.5,
                            borderColor:
                              reportDetails.length > 0 ? `${muted}60` : border,
                            borderRadius: 16,
                            overflow: "hidden",
                            marginBottom: 6,
                            backgroundColor: `${muted}08`,
                          }}
                        >
                          <TextInput
                            value={reportDetails}
                            onChangeText={setReportDetails}
                            placeholder="Describe what's wrong with this post… (optional)"
                            placeholderTextColor={`${muted}60`}
                            multiline
                            maxLength={500}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 12,
                              color: text,
                              fontSize: 14,
                              minHeight: 94,
                              textAlignVertical: "top",
                              lineHeight: 20,
                            }}
                          />
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 20,
                          }}
                        >
                          <Text style={{ color: muted, fontSize: 11.5 }}>
                            Include context to help moderators review faster.
                          </Text>
                          <Text style={{ color: muted, fontSize: 11.5 }}>
                            {reportDetails.length}/500
                          </Text>
                        </View>

                        {/* Submit button */}
                        <ScalePressable
                          disabled={!selectedReason || reportSubmitting}
                          onPress={() => {
                            void handleSubmitReport();
                          }}
                          pressedScale={0.965}
                          style={{
                            borderRadius: 18,
                            backgroundColor:
                              selectedReason && !reportSubmitting
                                ? "#EF4444"
                                : `${muted}25`,
                            overflow: "hidden",
                            marginBottom: 12,
                            shadowColor: selectedReason
                              ? "#EF4444"
                              : "transparent",
                            shadowOpacity: 0.35,
                            shadowRadius: 10,
                            shadowOffset: { width: 0, height: 4 },
                            elevation: selectedReason ? 4 : 0,
                          }}
                        >
                          <View
                            style={{
                              alignItems: "center",
                              paddingVertical: 15,
                            }}
                          >
                            <Text
                              style={{
                                color:
                                  selectedReason && !reportSubmitting
                                    ? "#fff"
                                    : muted,
                                fontSize: 15.5,
                                fontWeight: "800",
                                letterSpacing: 0.2,
                              }}
                            >
                              {reportSubmitting
                                ? "Submitting…"
                                : "Submit Report"}
                            </Text>
                          </View>
                        </ScalePressable>

                        <ScalePressable
                          onPress={() => setReportSheetVisible(false)}
                          pressedScale={0.975}
                          style={{
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: `${muted}25`,
                            backgroundColor: `${muted}08`,
                            overflow: "hidden",
                          }}
                        >
                          <View
                            style={{
                              paddingVertical: 12,
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: text,
                                fontSize: 14.5,
                                fontWeight: "600",
                              }}
                            >
                              Cancel
                            </Text>
                          </View>
                        </ScalePressable>
                      </KeyboardAvoidingView>
                    </>
                  )}
                </ScrollView>
              </Animated.View>
            </Pressable>
          </View>
        </Modal>

        <Modal
          transparent
          visible={awardSheetVisible}
          animationType="fade"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setAwardSheetVisible(false)}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: "rgba(2, 6, 23, 0.46)",
              }}
              onPress={() => setAwardSheetVisible(false)}
            />
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderTopWidth: 1,
                borderColor: border,
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: bottomInset + 18,
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: border,
                  alignSelf: "center",
                  marginBottom: 6,
                }}
              />
              <Text style={{ color: text, fontSize: 18, fontWeight: "800" }}>
                Award Achievement
              </Text>
              <Text style={{ color: muted, fontSize: 13 }}>
                {canAwardPost
                  ? "Choose a badge to award this post."
                  : "You cannot award your own post."}
              </Text>
              <TextInput
                value={awardContext}
                onChangeText={setAwardContext}
                editable={canAwardPost}
                placeholder="Add context/reason (optional)"
                placeholderTextColor={`${muted}99`}
                maxLength={180}
                style={{
                  borderWidth: 1,
                  borderColor: `${border}CC`,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: text,
                  backgroundColor: `${background}CC`,
                  fontSize: 13,
                }}
              />

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ACHIEVEMENTS.map((item) => {
                  const already = !!awardedByMe[item.id];
                  return (
                    <Pressable
                      key={item.id}
                      disabled={!canAwardPost || already}
                      onPress={() => awardAchievement(item.id, awardContext)}
                      style={{
                        width: "48%",
                        borderWidth: 1.2,
                        borderRadius: 14,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        backgroundColor: already
                          ? `${item.color}20`
                          : `${item.color}12`,
                        borderColor: already
                          ? `${item.color}70`
                          : `${item.color}48`,
                        opacity: !canAwardPost ? 0.55 : 1,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: item.color,
                              fontSize: 13,
                              fontWeight: "800",
                            }}
                          >
                            {item.label}
                          </Text>
                          <Text
                            style={{
                              color: muted,
                              fontSize: 11,
                              marginTop: 1,
                            }}
                          >
                            {already ? "Awarded by you" : "Tap to award"}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => setAwardSheetVisible(false)}
                style={{
                  marginTop: 4,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: `${muted}20`,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: text, fontSize: 15, fontWeight: "700" }}>
                  Close
                </Text>
              </Pressable>
            </Pressable>
          </View>
        </Modal>

        <Modal
          transparent
          visible={awardUsersSheetVisible}
          animationType="slide"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => {
            awardUsersRequestIdRef.current += 1;
            setAwardUsersSheetVisible(false);
          }}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              style={{
                ...StyleSheet.absoluteFillObject,
                backgroundColor: "rgba(2, 6, 23, 0.46)",
              }}
              onPress={() => {
                awardUsersRequestIdRef.current += 1;
                setAwardUsersSheetVisible(false);
              }}
            />
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: "72%",
                backgroundColor: card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderTopWidth: 1,
                borderColor: border,
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: bottomInset + 14,
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: border,
                  alignSelf: "center",
                  marginBottom: 4,
                }}
              />
              <Text style={{ color: text, fontSize: 17, fontWeight: "800" }}>
                {awardUsersSheetTitle}
              </Text>
              <Text style={{ color: muted, fontSize: 12.5 }}>
                Users who awarded this badge
              </Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
              >
                {awardUsersLoading || !awardUsersLoaded ? (
                  <Text style={{ color: muted, fontSize: 13 }}>
                    Loading users...
                  </Text>
                ) : awardUsers.length === 0 ? (
                  <Text style={{ color: muted, fontSize: 13 }}>
                    No users yet
                  </Text>
                ) : (
                  awardUsers.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        awardUsersRequestIdRef.current += 1;
                        setAwardUsersSheetVisible(false);
                        router.push(`/user/${item.id}`);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: border,
                        borderRadius: 12,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        gap: 8,
                      }}
                    >
                      <Image
                        source={{
                          uri: item.image || "https://via.placeholder.com/150",
                        }}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          borderWidth: 1,
                          borderColor: `${border}99`,
                        }}
                      />
                      <EntityBadge kind="user" size={12} />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: text,
                            fontSize: 14,
                            fontWeight: "700",
                          }}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        {item.context ? (
                          <Text
                            style={{
                              color: muted,
                              fontSize: 12.5,
                              marginTop: 2,
                            }}
                            numberOfLines={2}
                          >
                            {item.context}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </Pressable>
          </View>
        </Modal>
      </>
    </FadeInView>
  );
}

export default memo(PostListItem);
