import { useUser } from "@clerk/clerk-expo";
import { formatDistanceToNowStrict } from "date-fns";
import { Link } from "expo-router";
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
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import JoinCommunityButton from "@/components/JoinCommunityButton";
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
    const loadingOpacity = useRef(new Animated.Value(1)).current;
    const loadingRotate = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      const loop = Animated.loop(
        Animated.timing(loadingRotate, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }, []);

    useEffect(() => {
      const setRatioFromTrack = (track?: any) => {
        const width = track?.size?.width;
        const height = track?.size?.height;
        if (
          typeof width === "number" &&
          typeof height === "number" &&
          height > 0
        ) {
          setAspectRatio(width / height);
          Animated.timing(loadingOpacity, {
            toValue: 0,
            duration: 180,
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
      const spin = loadingRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
      });

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
            style={{
              opacity: loadingOpacity,
              transform: [{ rotate: spin }],
            }}
          >
            <Loader2 size={28} color="#999" />
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
        <VideoView
          style={{ flex: 1 }}
          player={player}
          nativeControls={nativeControls}
          fullscreenOptions={{ enable: true }}
          allowsPictureInPicture
          contentFit="contain"
        />
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
  showJoinButton = true,
  hideJoinButton = false,
  showOwnerActions = false,
  onEditPost,
  onDeletePost,
  onSharePost,
}: {
  post: Post;
  isDetailedPost?: boolean;
  showJoinButton?: boolean;
  hideJoinButton?: boolean;
  showOwnerActions?: boolean;
  onEditPost?: (post: Post) => void;
  onDeletePost?: (post: Post) => void;
  onSharePost?: (post: Post) => void;
}) {
  const { user } = useUser();
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");
  const cardBorder = useThemeColor({ light: "#cbd5e1" }, "border");
  const background = useThemeColor({}, "background");
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);
  const shouldShowJoinButton = showJoinButton && !hideJoinButton;
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
  const [ownerSheetVisible, setOwnerSheetVisible] = useState(false);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [isWritingDetails, setIsWritingDetails] = useState(false);
  const [isSubmittingModeratorSupport, setIsSubmittingModeratorSupport] =
    useState(false);
  const updatedAt = post.updated_at ?? post.edited_at ?? null;
  const isEdited =
    post.is_edited === true ||
    (typeof updatedAt === "string" &&
      new Date(updatedAt).getTime() - new Date(post.created_at).getTime() >
        1000);

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
      Alert.alert("Error", (error as Error)?.message || "Failed to submit report. Please try again.");
    }
  };

  const supportAuthorAsModerator = async () => {
    if (!user?.id || isSubmittingModeratorSupport) return;
    setIsSubmittingModeratorSupport(true);
    try {
      await supabase
        .from("group_moderator_votes")
        .upsert(
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

  return (
    <FadeInView>
      <>
        <View
          style={{
            backgroundColor: card,
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            marginBottom: 14,
            borderColor: cardBorder,
            shadowColor: "#0b1220",
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 3,
          }}
        >
          {/* Header */}
          <View className="flex-row items-center mb-3">
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

            <View className="ml-3 flex-1">
              <View className="flex-row items-center gap-1">
                <Text
                  style={{ color: text, fontWeight: "700", fontSize: 13 }}
                  numberOfLines={1}
                >
                  {post.group.name}
                </Text>
                <Text style={{ color: muted }} className="text-xs">
                  •
                </Text>
                <Text
                  style={{ color: muted, fontSize: 11, fontWeight: "500" }}
                  numberOfLines={1}
                >
                  {formatDistanceToNowStrict(new Date(post.created_at))} ago
                </Text>
              </View>
              <Text
                style={{ color: muted, fontSize: 12, marginTop: 2 }}
                numberOfLines={1}
              >
                Posted by {post.user.name}
              </Text>
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
            ) : (
              shouldShowJoinButton && (
                <JoinCommunityButton communityId={post.group.id} />
              )
            )}
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
            <Pressable>
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
            </Pressable>
          </Link>

          {isPollPost && <PostPoll postId={post.id} />}

          {!!primaryMediaUrl &&
            isVideoPost &&
            (isDetailedPost ? (
              <PostVideo uri={primaryMediaUrl} nativeControls />
            ) : (
              <Link href={`/post/${post.id}`} asChild>
                <Pressable>
                  <PostVideo uri={primaryMediaUrl} />
                </Pressable>
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
              <AnimatedIconButton>
                <Trophy size={17} color={muted} />
              </AnimatedIconButton>

              <View
                style={{
                  width: 1,
                  height: 18,
                  backgroundColor: border,
                  marginHorizontal: 10,
                }}
              />

              <AnimatedIconButton onPress={handleShare}>
                <Share2 size={17} color={muted} />
              </AnimatedIconButton>

              <View
                style={{
                  width: 1,
                  height: 18,
                  backgroundColor: border,
                  marginHorizontal: 10,
                }}
              />

              {/* Report button — hidden for post owner */}
              {user?.id !== post.user.id && (
                <AnimatedIconButton onPress={openReportMenu}>
                  <Flag size={17} color={muted} />
                </AnimatedIconButton>
              )}
            </View>
          </View>
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
                backgroundColor: "rgba(0,0,0,0.5)",
              }}
              onPress={() => setReportSheetVisible(false)}
            />
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: card,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                borderTopWidth: 1,
                borderColor: border,
                maxHeight: "92%",
                paddingBottom: bottomInset + 36,
                marginBottom: -bottomInset,
              }}
            >
              {/* Handle */}
              <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
                <View
                  style={{
                    width: 40,
                    height: 4,
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
                  paddingTop: 12,
                  paddingBottom: 20,
                }}
              >
                    {reportSubmitted ? (
                      /* ── Success State ── */
                      <View style={{ alignItems: "center", paddingVertical: 32, gap: 14 }}>
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
                          <Flag size={32} color="#22c55e" />
                        </View>
                        <View style={{ alignItems: "center", gap: 6 }}>
                          <Text style={{ color: text, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 }}>
                            Report Submitted
                          </Text>
                          <Text style={{ color: muted, fontSize: 14, textAlign: "center", lineHeight: 22, maxWidth: 260 }}>
                            Moderators will review your report and take appropriate action.
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setReportSheetVisible(false)}
                          style={{
                            marginTop: 4,
                            paddingVertical: 13,
                            paddingHorizontal: 40,
                            borderRadius: 16,
                            backgroundColor: "#22c55e",
                          }}
                        >
                          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      /* ── Report Form ── */
                      <>
                        {/* Header */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 }}>
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
                            <Text style={{ color: text, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }}>
                              Report Post
                            </Text>
                            <Text style={{ color: muted, fontSize: 12.5, marginTop: 1 }}>
                              Help keep the community safe
                            </Text>
                          </View>
                        </View>

                        {/* Divider */}
                        <View style={{ height: 1, backgroundColor: border, marginVertical: 16 }} />

                        <Text style={{ color: text, fontSize: 13, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 12, opacity: 0.6 }}>
                          Select a reason
                        </Text>

                        {/* Reason Grid — 2 columns */}
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                          {REPORT_REASONS.map((reason) => {
                            const isSelected = selectedReason === reason.value;
                            return (
                              <TouchableOpacity
                                key={reason.value}
                                onPress={() => setSelectedReason(reason.value)}
                                style={{
                                  width: "48%",
                                  paddingVertical: 13,
                                  paddingHorizontal: 14,
                                  borderRadius: 16,
                                  borderWidth: 1.5,
                                  borderColor: isSelected ? reason.color : `${border}`,
                                  backgroundColor: isSelected ? `${reason.color}18` : `${muted}08`,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                {/* Color dot */}
                                <View
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 5,
                                    backgroundColor: isSelected ? reason.color : `${muted}60`,
                                  }}
                                />
                                <Text
                                  style={{
                                    color: isSelected ? reason.color : text,
                                    fontSize: 13.5,
                                    fontWeight: isSelected ? "700" : "500",
                                    flex: 1,
                                  }}
                                  numberOfLines={1}
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
                                    <Check size={10} color="#fff" strokeWidth={3} />
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Details input wrapped in KeyboardAvoidingView */}
                        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "position" : "padding"} keyboardVerticalOffset={Platform.OS === "ios" ? 140 : 80}>
                          <Text style={{ color: text, fontSize: 13, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10, opacity: 0.6 }}>
                            Additional details
                          </Text>
                          <View
                            style={{
                              borderWidth: 1.5,
                              borderColor: reportDetails.length > 0 ? `${muted}60` : border,
                              borderRadius: 16,
                              overflow: "hidden",
                              marginBottom: 6,
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
                                minHeight: 80,
                                textAlignVertical: "top",
                                lineHeight: 20,
                              }}
                            />
                          </View>
                          <Text style={{ color: muted, fontSize: 11.5, textAlign: "right", marginBottom: 20 }}>
                            {reportDetails.length}/500
                          </Text>
  
                          {/* Submit button */}
                          <TouchableOpacity
                            disabled={!selectedReason || reportSubmitting}
                            onPress={() => { void handleSubmitReport(); }}
                            style={{
                              paddingVertical: 15,
                              borderRadius: 18,
                              backgroundColor: selectedReason && !reportSubmitting ? "#EF4444" : `${muted}25`,
                              alignItems: "center",
                              marginBottom: 10,
                              shadowColor: selectedReason ? "#EF4444" : "transparent",
                              shadowOpacity: 0.35,
                              shadowRadius: 10,
                              shadowOffset: { width: 0, height: 4 },
                              elevation: selectedReason ? 4 : 0,
                            }}
                          >
                            <Text
                              style={{
                                color: selectedReason && !reportSubmitting ? "#fff" : muted,
                                fontSize: 15.5,
                                fontWeight: "800",
                                letterSpacing: 0.2,
                              }}
                            >
                              {reportSubmitting ? "Submitting…" : "Submit Report"}
                            </Text>
                          </TouchableOpacity>
  
                          <TouchableOpacity
                            onPress={() => setReportSheetVisible(false)}
                            style={{ paddingVertical: 12, alignItems: "center" }}
                          >
                            <Text style={{ color: muted, fontSize: 14.5, fontWeight: "600" }}>Cancel</Text>
                          </TouchableOpacity>
                        </KeyboardAvoidingView>
                      </>
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
