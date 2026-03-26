import AppLoader from "@/components/AppLoader";
import ChatInput from "@/components/ChatInput";
import { useChat, type ListItem, type MessageGroup } from "@/hooks/use-chat";
import { useCommunityPresence } from "@/hooks/use-community-presence";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  deleteCommunityChatMessage,
  deletePrivateChatMessage,
  editCommunityChatMessage,
  editPrivateChatMessage,
  toggleCommunityChatReaction,
  togglePrivateChatReaction,
} from "@/lib/actions/chat";
import { supabase } from "@/lib/Supabase";
import {
  parseKeyboardMediaInput,
  type AnyChatMessage,
  type ChatMediaType,
  type ChatMessageReaction,
  type PickerItem,
  type PickerMode,
} from "@/types/chat";
import { useUser } from "@clerk/clerk-expo";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  ChevronDown,
  ChevronLeft,
  CornerUpLeft,
  Gem,
  Grid,
  Image as ImageIcon,
  MessageCircle,
  X,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Image as RNImage,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Theme = {
  text: string;
  secondary: string;
  primary: string;
  border: string;
  backgroundSecondary: string;
  isDark: boolean;
};

type MentionCandidate = {
  id: string;
  name: string;
  image: string | null;
  handle: string;
};

type MentionLookup = Record<
  string,
  {
    id: string;
    name: string;
    image: string | null;
    handle: string;
  }
>;

type ReactionUser = {
  id: string;
  name: string;
  image: string | null;
};

type OnlineUser = {
  id: string;
  name: string;
  image: string | null;
};

type ChatThreadProps = {
  chatType: "community" | "private";
  communityId?: string;
  privateChatId?: string;
  otherUserId?: string;
  title: string;
  subtitle?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
};

const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? "LIVDSRZULELA";
const GIF_PAGE_SIZE = 24;
const CHAT_MEDIA_BUCKET =
  process.env.EXPO_PUBLIC_SUPABASE_CHAT_MEDIA_BUCKET ??
  process.env.EXPO_PUBLIC_SUPABASE_POST_MEDIA_BUCKET ??
  "post-media";
const MAX_UPLOAD_BYTES = Number(
  process.env.EXPO_PUBLIC_MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024,
);

type PickedMedia = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  assetType?: "image" | "video" | "livePhoto" | "pairedVideo" | undefined;
};

function DateDivider({
  label,
  secondary,
  border,
}: {
  label: string;
  secondary: string;
  border: string;
}) {
  return (
    <View style={divStyles.row}>
      <View style={[divStyles.line, { backgroundColor: border }]} />
      <Text style={[divStyles.label, { color: secondary }]}>{label}</Text>
      <View style={[divStyles.line, { backgroundColor: border }]} />
    </View>
  );
}

function AnimatedDot({ delay, color }: { delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [anim, delay]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          opacity: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 1],
          }),
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -3],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function MessageMedia({
  mediaType,
  mediaUrl,
  hasCaption,
}: {
  mediaType?: ChatMediaType | null;
  mediaUrl?: string | null;
  hasCaption: boolean;
}) {
  const { width } = useWindowDimensions();
  const [aspectRatio, setAspectRatio] = useState(1);
  const safeUrl = mediaUrl ?? "";
  const mediaWidth = Math.max(120, Math.round(Math.min(width * 0.5, 220)));
  const player = useVideoPlayer({ uri: safeUrl }, (createdPlayer) => {
    createdPlayer.muted = false;
    createdPlayer.loop = false;
    createdPlayer.pause();
  });

  useEffect(() => {
    if (!mediaUrl || mediaType === "video") return;
    RNImage.getSize(
      mediaUrl,
      (w, h) => {
        if (w > 0 && h > 0) setAspectRatio(w / h);
      },
      () => setAspectRatio(1),
    );
  }, [mediaType, mediaUrl]);

  if (!mediaUrl) return null;

  if (mediaType === "video") {
    return (
      <View
        style={[
          groupStyles.mediaVideoWrap,
          !hasCaption ? groupStyles.mediaNoBottomGap : null,
        ]}
      >
        <VideoView
          style={[
            groupStyles.media,
            !hasCaption ? groupStyles.mediaNoBottomGap : null,
            { width: mediaWidth, aspectRatio },
          ]}
          player={player}
          nativeControls
          allowsPictureInPicture
          contentFit="contain"
          fullscreenOptions={{ enable: true }}
        />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: mediaUrl }}
      style={[
        groupStyles.media,
        !hasCaption ? groupStyles.mediaNoBottomGap : null,
        { width: mediaWidth, aspectRatio },
      ]}
      contentFit="contain"
      transition={120}
    />
  );
}

function normalizeMentionHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.]/g, "");
}

function renderTextWithMentions(
  content: string,
  textColor: string,
  mentionColor: string,
) {
  const mentionRegex = /(^|\s)(@[a-zA-Z0-9_.]+)/g;
  const pieces: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = mentionRegex.exec(content)) !== null) {
    const leading = match[1] ?? "";
    const mention = match[2] ?? "";
    const start = match.index;
    const mentionStart = start + leading.length;
    const mentionEnd = mentionStart + mention.length;

    if (start > lastIndex) {
      pieces.push(
        <Text key={`text-${lastIndex}`} style={{ color: textColor }}>
          {content.slice(lastIndex, start)}
        </Text>,
      );
    }

    if (leading) {
      pieces.push(
        <Text key={`space-${start}`} style={{ color: textColor }}>
          {leading}
        </Text>,
      );
    }

    pieces.push(
      <Text
        key={`mention-${mentionStart}`}
        style={{ color: mentionColor, fontWeight: "700" }}
      >
        {mention}
      </Text>,
    );
    lastIndex = mentionEnd;
  }

  if (lastIndex < content.length) {
    pieces.push(
      <Text key={`text-${lastIndex}`} style={{ color: textColor }}>
        {content.slice(lastIndex)}
      </Text>,
    );
  }

  return pieces.length > 0 ? pieces : content;
}

function extractMentionHandles(content: string) {
  const mentionRegex = /(?:^|\s)@([a-zA-Z0-9_.]+)/g;
  const handles: string[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = mentionRegex.exec(content)) !== null) {
    const handle = normalizeMentionHandle(match[1] ?? "");
    if (!handle) continue;
    if (!handles.includes(handle)) handles.push(handle);
  }
  return handles;
}

function summarizeReactions(reactions: ChatMessageReaction[]) {
  const map = new Map<string, number>();
  for (const reaction of reactions) {
    if (!reaction.emoji) continue;
    map.set(reaction.emoji, (map.get(reaction.emoji) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([emoji, count]) => ({ emoji, count }));
}

function MessageGroupRow({
  group,
  theme,
  mentionLookup,
  onLongPressMessage,
  onPressReaction,
  onLongPressReaction,
}: {
  group: MessageGroup;
  theme: Theme;
  mentionLookup: MentionLookup;
  onLongPressMessage?: (message: AnyChatMessage) => void;
  onPressReaction?: (message: AnyChatMessage, emoji: string) => void;
  onLongPressReaction?: (message: AnyChatMessage, emoji: string) => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(slideY, {
        toValue: 0,
        bounciness: 4,
        speed: 22,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, slideY]);

  const { mine, sender, messages, timestamp } = group;
  const { text, secondary, primary, border, backgroundSecondary, isDark } =
    theme;
  const hasSending = messages.some((m) => m.clientStatus === "sending");
  const hasFailed = messages.some((m) => m.clientStatus === "failed");
  const hasEdited = messages.some((m) => Boolean(m.edited_at));

  const bubbleBg = mine
    ? isDark
      ? `${primary}28`
      : `${primary}18`
    : backgroundSecondary;
  const bubbleBorderColor = mine ? `${primary}45` : border;

  return (
    <Animated.View
      style={[
        groupStyles.outer,
        mine ? groupStyles.outerMine : groupStyles.outerOther,
        { opacity, transform: [{ translateY: slideY }] },
      ]}
    >
      {!mine && (
        <View style={groupStyles.avatarCol}>
          {sender?.image ? (
            <Image source={{ uri: sender.image }} style={groupStyles.avatar} />
          ) : (
            <View
              style={[
                groupStyles.avatarFallback,
                { backgroundColor: `${primary}22` },
              ]}
            >
              <Text style={[groupStyles.avatarText, { color: primary }]}>
                {(sender?.name?.[0] ?? "?").toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={[groupStyles.bubbleCol, mine && groupStyles.bubbleColMine]}>
        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1;

          const mentionedUsers = extractMentionHandles(msg.content ?? "")
            .map((handle) => mentionLookup[handle])
            .filter(Boolean);

          return (
            <View
              key={msg.id}
              style={{
                marginBottom: isLast ? 10 : 12,
                position: "relative",
              }}
            >
              {mentionedUsers.length > 0 ? (
                <View
                  style={[
                    groupStyles.mentionHeaderWrap,
                    mine
                      ? groupStyles.mentionHeaderWrapMine
                      : groupStyles.mentionHeaderWrapOther,
                  ]}
                >
                  {mentionedUsers.slice(0, 2).map((mentionedUser) => (
                    <View
                      key={mentionedUser.id}
                      style={[
                        groupStyles.mentionHeaderItem,
                        mine
                          ? groupStyles.mentionHeaderItemMine
                          : groupStyles.mentionHeaderItemOther,
                      ]}
                    >
                      {mentionedUser.image ? (
                        <Image
                          source={{ uri: mentionedUser.image }}
                          style={groupStyles.mentionHeaderAvatar}
                        />
                      ) : (
                        <View
                          style={[
                            groupStyles.mentionHeaderAvatarFallback,
                            { backgroundColor: `${primary}22` },
                          ]}
                        >
                          <Text
                            style={[
                              groupStyles.mentionHeaderAvatarText,
                              { color: primary },
                            ]}
                          >
                            {(mentionedUser.name[0] ?? "?").toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={[
                          groupStyles.mentionHeaderName,
                          { color: secondary },
                        ]}
                        numberOfLines={1}
                      >
                        @{mentionedUser.handle}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {msg.reply_to_message_id ? (
                <View
                  style={[
                    groupStyles.replyRefWrap,
                    mine
                      ? groupStyles.replyRefWrapMine
                      : groupStyles.replyRefWrapOther,
                    {
                      borderColor: bubbleBorderColor,
                      backgroundColor: `${primary}10`,
                    },
                  ]}
                >
                  <View style={groupStyles.replyRefHeader}>
                    <CornerUpLeft size={11} color={primary} />
                    <Text
                      style={[groupStyles.replyRefAuthor, { color: primary }]}
                      numberOfLines={1}
                    >
                      {msg.reply_to?.user?.name ?? "Replied message"}
                    </Text>
                  </View>
                  <Text
                    style={[groupStyles.replyRefText, { color: secondary }]}
                    numberOfLines={1}
                  >
                    {msg.reply_to?.content?.trim() || "Original message"}
                  </Text>
                </View>
              ) : null}
              <Pressable
                onLongPress={() => onLongPressMessage?.(msg as AnyChatMessage)}
                delayLongPress={240}
                style={[
                  groupStyles.bubble,
                  msg.media_url && !msg.content?.trim()
                    ? groupStyles.bubbleMediaOnly
                    : null,
                  {
                    backgroundColor: bubbleBg,
                    borderColor: bubbleBorderColor,
                    borderRadius: 18,
                  },
                ]}
              >
                <MessageMedia
                  mediaType={msg.media_type}
                  mediaUrl={msg.media_url}
                  hasCaption={Boolean(msg.content?.trim())}
                />
                {msg.content?.trim() ? (
                  <Text style={[groupStyles.messageText, { color: text }]}>
                    {renderTextWithMentions(msg.content, text, primary)}
                  </Text>
                ) : null}
              </Pressable>
              {(msg.reactions?.length ?? 0) > 0 ? (
                <View
                  style={[
                    groupStyles.reactionOverlay,
                    mine
                      ? groupStyles.reactionOverlayMine
                      : groupStyles.reactionOverlayOther,
                  ]}
                >
                  {summarizeReactions(msg.reactions ?? []).map((reaction) => (
                    <Pressable
                      key={`${msg.id}-${reaction.emoji}`}
                      onPress={() =>
                        onPressReaction?.(msg as AnyChatMessage, reaction.emoji)
                      }
                      onLongPress={() =>
                        onLongPressReaction?.(
                          msg as AnyChatMessage,
                          reaction.emoji,
                        )
                      }
                      delayLongPress={220}
                      style={[
                        groupStyles.reactionChip,
                        {
                          backgroundColor: backgroundSecondary,
                          borderColor: bubbleBorderColor,
                        },
                      ]}
                    >
                      <Text
                        style={[groupStyles.reactionChipText, { color: text }]}
                      >
                        {reaction.emoji} {reaction.count}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        <View
          style={[
            groupStyles.timestampRow,
            mine && groupStyles.timestampRowMine,
          ]}
        >
          <Text
            style={[
              groupStyles.timestamp,
              { color: secondary },
              mine && groupStyles.timestampMine,
            ]}
          >
            {timestamp}
          </Text>
          {hasEdited ? (
            <Text style={[groupStyles.statusText, { color: secondary }]}>
              Edited
            </Text>
          ) : null}
          {mine && hasSending ? (
            <ActivityIndicator size="small" color={secondary} />
          ) : null}
          {mine && hasFailed ? (
            <Text style={[groupStyles.statusText, { color: "#FF3B30" }]}>
              Unable to send
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

export default function ChatThread({
  chatType,
  communityId,
  privateChatId,
  otherUserId,
  title,
  subtitle,
  emptyTitle = "No messages yet",
  emptySubtitle = "Start the conversation",
  showBackButton = false,
  onBackPress,
}: ChatThreadProps) {
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isTablet =
    Platform.OS === "ios" ? Platform.isPad : Math.min(width, height) >= 600;
  const keyboardOffset = Platform.OS === "ios" ? (isTablet ? 90 : 12) : 0;

  const [input, setInput] = useState("");
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>("gif");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [mentionCandidates, setMentionCandidates] = useState<
    MentionCandidate[]
  >([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [activeMessage, setActiveMessage] = useState<AnyChatMessage | null>(
    null,
  );
  const [actionsVisible, setActionsVisible] = useState(false);
  const [editingMessage, setEditingMessage] = useState<AnyChatMessage | null>(
    null,
  );
  const [replyTarget, setReplyTarget] = useState<AnyChatMessage | null>(null);
  const [reactionDetailsVisible, setReactionDetailsVisible] = useState(false);
  const [reactionDetailsEmoji, setReactionDetailsEmoji] = useState("");
  const [reactionDetailsUsers, setReactionDetailsUsers] = useState<
    ReactionUser[]
  >([]);
  const [onlineSheetVisible, setOnlineSheetVisible] = useState(false);
  const { onlineUserIds, onlineCount } = useCommunityPresence(
    chatType === "community" ? communityId : undefined,
  );

  const {
    loading,
    sending,
    errorText,
    typingUsers,
    isMember,
    listItems,
    setMessages,
    setTypingStatus,
    broadcastReactionChange,
    broadcastMessageUpdate,
    broadcastMessageDelete,
    sendMessage,
  } = useChat({
    chatType,
    communityId,
    privateChatId,
    otherUserId,
  });

  const bg = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const border = useThemeColor({}, "border");
  const card = useThemeColor({}, "card");
  const primary = useThemeColor({}, "primary");
  const backgroundSecondary = useThemeColor({}, "backgroundSecondary");

  const listRef = useRef<FlatList<ListItem> | null>(null);
  const composerAnim = useRef(new Animated.Value(0)).current;
  const composerReserved = 32 + insets.bottom;
  const mentionMatch = useMemo(
    () => input.match(/(?:^|\s)@([a-zA-Z0-9_.]*)$/),
    [input],
  );
  const mentionVisible =
    chatType === "community" && isMember && mentionMatch !== null;
  const mentionSuggestions = useMemo(() => {
    if (chatType !== "community") return [];
    if (!mentionMatch) return [];

    const typed = mentionQuery;
    const filtered = mentionCandidates.filter((candidate) => {
      if (!typed) return true;
      return (
        candidate.handle.includes(typed) ||
        candidate.name.toLowerCase().includes(typed.replace(/_/g, " "))
      );
    });

    return filtered.slice(0, 6);
  }, [chatType, mentionCandidates, mentionMatch, mentionQuery]);
  const mentionLookup = useMemo<MentionLookup>(
    () =>
      mentionCandidates.reduce<MentionLookup>((acc, candidate) => {
        acc[candidate.handle] = candidate;
        return acc;
      }, {}),
    [mentionCandidates],
  );

  const theme: Theme = useMemo(
    () => ({ text, secondary, primary, border, backgroundSecondary, isDark }),
    [text, secondary, primary, border, backgroundSecondary, isDark],
  );
  const onlineUsers = useMemo<OnlineUser[]>(() => {
    if (chatType !== "community") return [];
    if (!onlineUserIds.size) return [];
    return mentionCandidates.filter((member) => onlineUserIds.has(member.id));
  }, [chatType, mentionCandidates, onlineUserIds]);
  const onlinePreview = useMemo(() => onlineUsers.slice(0, 4), [onlineUsers]);
  const onlineOverflowCount = Math.max(0, onlineCount - onlinePreview.length);

  useEffect(() => {
    Animated.spring(composerAnim, {
      toValue: 1,
      bounciness: 0,
      speed: 16,
      useNativeDriver: true,
    }).start();
  }, [composerAnim]);

  useEffect(() => {
    if (chatType !== "community" || !communityId) {
      setMentionCandidates([]);
      return;
    }

    let cancelled = false;
    const loadMembers = async () => {
      const { data, error } = await supabase
        .from("user_groups")
        .select("user:users(id, name, image)")
        .eq("group_id", communityId);

      if (cancelled || error) return;
      const next = ((data ?? []) as any[])
        .map((row) => row.user)
        .filter(Boolean)
        .map((member) => ({
          id: String(member.id),
          name: String(member.name ?? "User"),
          image: (member.image as string | null) ?? null,
          handle: normalizeMentionHandle(String(member.name ?? "")),
        }))
        .filter((member) => member.handle.length > 0);

      setMentionCandidates(
        Array.from(new Map(next.map((member) => [member.id, member])).values()),
      );
    };

    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [chatType, communityId]);

  useEffect(() => {
    if (!mentionMatch) {
      setMentionQuery("");
      return;
    }
    setMentionQuery(normalizeMentionHandle(mentionMatch[1] ?? ""));
  }, [mentionMatch]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      const nextHeight = Math.max(
        0,
        (event.endCoordinates?.height ?? 0) - insets.bottom,
      );
      setAndroidKeyboardHeight(nextHeight);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setAndroidKeyboardHeight(0);
    });
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") setAndroidKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      appStateSub.remove();
    };
  }, [insets.bottom]);

  useEffect(() => {
    if (listItems.length === 0) return;
    const t = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      60,
    );
    return () => clearTimeout(t);
  }, [listItems.length]);

  const fetchPickerItems = useCallback(
    async (mode: PickerMode, query: string) => {
      if (!GIPHY_API_KEY) return;
      setPickerLoading(true);
      setPickerError(null);
      try {
        const trimmed = query.trim();
        const endpointBase =
          mode === "sticker"
            ? "https://api.giphy.com/v1/stickers"
            : "https://api.giphy.com/v1/gifs";
        const endpoint =
          trimmed.length > 0
            ? `${endpointBase}/search`
            : `${endpointBase}/trending`;
        const params = new URLSearchParams({
          api_key: GIPHY_API_KEY,
          limit: String(GIF_PAGE_SIZE),
          rating: "pg-13",
        });
        if (trimmed.length > 0) params.append("q", trimmed);
        const response = await fetch(`${endpoint}?${params.toString()}`);
        if (!response.ok) throw new Error(`Failed (${response.status})`);
        const payload = await response.json();
        const mapped: PickerItem[] = (payload?.data ?? [])
          .map((item: any) => ({
            id: String(item?.id ?? ""),
            previewUrl:
              item?.images?.fixed_width_downsampled?.url ??
              item?.images?.fixed_width?.url ??
              item?.images?.original?.url ??
              "",
            mediaUrl:
              item?.images?.original?.url ??
              item?.images?.downsized_large?.url ??
              item?.images?.fixed_width?.url ??
              "",
          }))
          .filter(
            (item: PickerItem) => item.id && item.previewUrl && item.mediaUrl,
          );
        setPickerItems(mapped);
      } catch (error: any) {
        setPickerItems([]);
        setPickerError(error?.message ?? "Failed to load GIFs.");
      } finally {
        setPickerLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!pickerVisible) return;
    const timer = setTimeout(() => {
      void fetchPickerItems(pickerMode, pickerQuery);
    }, 220);
    return () => clearTimeout(timer);
  }, [fetchPickerItems, pickerMode, pickerQuery, pickerVisible]);

  const sendPickedMedia = async (
    mediaType: ChatMediaType,
    mediaUrl: string,
  ) => {
    const content = input.trim();
    const { mentionUserIds, mentionHandles } = resolveMentions(content);
    setInput("");
    await sendMessage({
      content,
      mediaType,
      mediaUrl,
      mentionUserIds,
      mentionHandles,
    });
  };

  const uploadMediaToStorage = async (media: PickedMedia, userId: string) => {
    const extensionFromMime = media.mimeType?.split("/")?.[1];
    const extensionFromName = media.fileName?.split(".").pop();
    const extensionFromUri = media.uri.split("?")[0].split(".").pop();
    const extension =
      extensionFromMime || extensionFromName || extensionFromUri || "bin";
    const objectPath = `chat/${userId}/media_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}.${extension}`;

    const localUri = media.uri.startsWith("content://")
      ? `${FileSystem.cacheDirectory}chat_upload_${Date.now()}.${extension}`
      : media.uri;

    if (media.uri.startsWith("content://")) {
      await FileSystem.copyAsync({ from: media.uri, to: localUri });
    }

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      return { publicUrl: null, error: "Selected file could not be read." };
    }
    const fileSize =
      typeof (fileInfo as { size?: number }).size === "number"
        ? (fileInfo as { size: number }).size
        : null;
    if (fileSize && fileSize > MAX_UPLOAD_BYTES) {
      const maxMb = (MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0);
      const fileMb = (fileSize / (1024 * 1024)).toFixed(1);
      return {
        publicUrl: null,
        error: `File is ${fileMb} MB. Max allowed is ${maxMb} MB.`,
      };
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return { publicUrl: null, error: "Supabase URL or anon key is missing." };
    }

    const uploadUrl = `${supabaseUrl}/storage/v1/object/${CHAT_MEDIA_BUCKET}/${objectPath}`;
    const uploadResult = await FileSystem.uploadAsync(uploadUrl, localUri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type":
          media.mimeType ??
          (media.assetType === "video" ? "video/mp4" : "image/jpeg"),
        "x-upsert": "false",
      },
    });

    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      return {
        publicUrl: null,
        error: `Upload failed (${uploadResult.status}).`,
      };
    }

    const { data } = supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .getPublicUrl(objectPath);
    return { publicUrl: data.publicUrl, error: null };
  };

  const handlePickFromGallery = async () => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to send media.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Allow media access to pick from gallery.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const upload = await uploadMediaToStorage(
      {
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        //@ts-ignore
        assetType: asset.type,
      },
      user.id,
    );

    if (upload.error || !upload.publicUrl) {
      Alert.alert(
        "Upload failed",
        upload.error ?? "Could not upload selected media.",
      );
      return;
    }

    setPickerVisible(false);
    await sendPickedMedia(
      asset.type === "video" ? "video" : "image",
      upload.publicUrl,
    );
  };

  const handlePickGifOrSticker = async (item: PickerItem) => {
    setPickerVisible(false);
    await sendPickedMedia(
      pickerMode === "sticker" ? "sticker" : "gif",
      item.mediaUrl,
    );
  };

  const resolveMentions = useCallback(
    (content: string) => {
      const mentionRegex = /(?:^|\s)@([a-zA-Z0-9_.]+)/g;
      const mentionUserIds: string[] = [];
      const mentionHandles: string[] = [];
      let match: RegExpExecArray | null = null;

      while ((match = mentionRegex.exec(content)) !== null) {
        const handle = normalizeMentionHandle(match[1] ?? "");
        if (!handle) continue;
        const target = mentionCandidates.find(
          (candidate) => candidate.handle === handle,
        );
        if (!target) continue;
        if (!mentionUserIds.includes(target.id)) {
          mentionUserIds.push(target.id);
          mentionHandles.push(`@${handle}`);
        }
      }

      return { mentionUserIds, mentionHandles };
    },
    [mentionCandidates],
  );

  const handlePickMention = useCallback((candidate: MentionCandidate) => {
    setInput((prev) =>
      prev.replace(
        /(?:^|\s)@[a-zA-Z0-9_.]*$/,
        (matched) =>
          `${matched.startsWith(" ") ? " " : ""}@${candidate.handle} `,
      ),
    );
  }, []);

  const handleSend = async () => {
    if (editingMessage) {
      if (!user?.id) return;
      const content = input.trim();
      if (!content) {
        Alert.alert("Message required", "Please enter message text.");
        return;
      }

      const { data, error } =
        chatType === "community"
          ? await editCommunityChatMessage({
              messageId: editingMessage.id,
              userId: user.id,
              content,
            })
          : await editPrivateChatMessage({
              messageId: editingMessage.id,
              userId: user.id,
              content,
            });

      if (error || !data) {
        Alert.alert("Could not edit message", error?.message ?? "Try again.");
        return;
      }

      updateMessageLocally(editingMessage.id, (message) => ({
        ...message,
        content: data.content ?? content,
        edited_at: data.edited_at ?? new Date().toISOString(),
      }));
      void broadcastMessageUpdate({
        messageId: editingMessage.id,
        content: data.content ?? content,
        editedAt: data.edited_at ?? new Date().toISOString(),
      });
      setEditingMessage(null);
      setInput("");
      return;
    }

    const parsed = parseKeyboardMediaInput(input);
    if (!parsed.content && !parsed.mediaUrl) return;
    const { mentionUserIds, mentionHandles } = resolveMentions(parsed.content);
    setInput("");
    await sendMessage({
      content: parsed.content,
      mediaType: parsed.mediaType ?? "text",
      mediaUrl: parsed.mediaUrl ?? null,
      replyToMessageId: replyTarget?.id ?? null,
      replyTo: replyTarget
        ? {
            id: replyTarget.id,
            content: replyTarget.content?.trim() || "Media message",
            user_id: replyTarget.user_id,
            user: replyTarget.user ?? null,
          }
        : null,
      mentionUserIds,
      mentionHandles,
    });
    setReplyTarget(null);
  };

  const updateMessageLocally = useCallback(
    (
      messageId: string,
      updater: (message: AnyChatMessage) => AnyChatMessage,
    ) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== messageId) return message;
          return updater(message);
        }),
      );
    },
    [setMessages],
  );

  const openActionsForMessage = useCallback((message: AnyChatMessage) => {
    setActiveMessage(message);
    setActionsVisible(true);
  }, []);

  const toggleReactionForMessage = useCallback(
    async (message: AnyChatMessage, emoji: string, closeSheet = false) => {
      if (!message?.id || !user?.id) return;
      const snapshot = message;
      if (closeSheet) setActionsVisible(false);

      updateMessageLocally(snapshot.id, (current) => {
        const mineSameEmoji = (current.reactions ?? []).find(
          (reaction) =>
            reaction.user_id === user.id && reaction.emoji === emoji,
        );
        if (mineSameEmoji) {
          return {
            ...current,
            reactions: (current.reactions ?? []).filter(
              (reaction) =>
                !(reaction.user_id === user.id && reaction.emoji === emoji),
            ),
          };
        }
        return {
          ...current,
          reactions: [
            ...(current.reactions ?? []),
            { user_id: user.id, emoji } as ChatMessageReaction,
          ],
        };
      });

      const result =
        chatType === "community"
          ? await toggleCommunityChatReaction({
              messageId: snapshot.id,
              userId: user.id,
              emoji,
            })
          : await togglePrivateChatReaction({
              messageId: snapshot.id,
              userId: user.id,
              emoji,
            });

      if (result.error) {
        updateMessageLocally(snapshot.id, () => snapshot);
        Alert.alert("Could not react", result.error.message ?? "Try again.");
        return;
      }
      if (result.mode === "added" || result.mode === "removed") {
        void broadcastReactionChange({
          messageId: snapshot.id,
          userId: user.id,
          emoji,
          mode: result.mode,
        });
      }
    },
    [broadcastReactionChange, chatType, updateMessageLocally, user?.id],
  );

  const handleReplyToMessage = useCallback(() => {
    if (!activeMessage) return;
    setEditingMessage(null);
    setReplyTarget(activeMessage);
    setActionsVisible(false);
  }, [activeMessage]);

  const handleStartEditMessage = useCallback(() => {
    if (!activeMessage || activeMessage.user_id !== user?.id) return;
    setEditingMessage(activeMessage);
    setInput(activeMessage.content ?? "");
    setReplyTarget(null);
    setActionsVisible(false);
  }, [activeMessage, user?.id]);

  const handleDeleteForMe = useCallback(() => {
    if (!activeMessage?.id) return;
    const messageId = activeMessage.id;
    if (editingMessage?.id === messageId) {
      setEditingMessage(null);
      setInput("");
    }
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
    setActionsVisible(false);
  }, [activeMessage, editingMessage?.id, setMessages]);

  const handleDeleteForAll = useCallback(async () => {
    if (!activeMessage?.id || !user?.id) return;
    const messageId = activeMessage.id;
    const { error } =
      chatType === "community"
        ? await deleteCommunityChatMessage({
            messageId,
            userId: user.id,
          })
        : await deletePrivateChatMessage({
            messageId,
            userId: user.id,
          });
    if (error) {
      Alert.alert("Could not delete message", error.message ?? "Try again.");
      return;
    }
    if (editingMessage?.id === messageId) {
      setEditingMessage(null);
      setInput("");
    }
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
    void broadcastMessageDelete({ messageId });
    setActionsVisible(false);
  }, [
    activeMessage,
    broadcastMessageDelete,
    chatType,
    editingMessage?.id,
    setMessages,
    user?.id,
  ]);

  const handlePressReactionChip = useCallback(
    (message: AnyChatMessage, emoji: string) => {
      void toggleReactionForMessage(message, emoji, false);
    },
    [toggleReactionForMessage],
  );

  const handleLongPressReactionChip = useCallback(
    async (message: AnyChatMessage, emoji: string) => {
      const reactionUserIds = (message.reactions ?? [])
        .filter((reaction) => reaction.emoji === emoji)
        .map((reaction) => reaction.user_id);
      if (reactionUserIds.length === 0) return;

      const uniqueIds = Array.from(new Set(reactionUserIds));
      const { data, error } = await supabase
        .from("users")
        .select("id, name, image")
        .in("id", uniqueIds);

      if (error) {
        Alert.alert("Could not load users", error.message ?? "Try again.");
        return;
      }

      const users = ((data ?? []) as any[]).map((row) => ({
        id: String(row.id),
        name: String(row.name ?? "User"),
        image: (row.image as string | null) ?? null,
      }));

      const byId = new Map(users.map((u) => [u.id, u]));
      const ordered = uniqueIds
        .map((id) => byId.get(id))
        .filter(Boolean) as ReactionUser[];

      setReactionDetailsEmoji(emoji);
      setReactionDetailsUsers(ordered);
      setReactionDetailsVisible(true);
    },
    [],
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <AppLoader fullScreen />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        {showBackButton ? (
          <Pressable
            style={[styles.backButton, { borderColor: border }]}
            onPress={onBackPress}
          >
            <ChevronLeft size={18} color={text} />
          </Pressable>
        ) : null}
        <View
          style={[styles.headerIconWrap, { backgroundColor: `${primary}1A` }]}
        >
          <MessageCircle size={19} color={primary} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.headerMetaText, { color: secondary }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {chatType === "community" && onlineCount > 0 ? (
          <View style={styles.onlineDockWrap}>
            <Pressable
              onPress={() => setOnlineSheetVisible(true)}
              style={[
                styles.onlineDock,
                { backgroundColor: card, borderColor: border },
              ]}
            >
              <View style={styles.onlineAvatars}>
                {onlinePreview.map((member, index) => (
                  <View
                    key={member.id}
                    style={[
                      styles.onlineAvatarWrap,
                      {
                        marginLeft: index === 0 ? 0 : -10,
                        zIndex: 10 - index,
                        borderColor: card,
                      },
                    ]}
                  >
                    {member.image ? (
                      <Image
                        source={{ uri: member.image }}
                        style={styles.onlineAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.onlineAvatarFallback,
                          { backgroundColor: `${primary}22` },
                        ]}
                      >
                        <Text
                          style={[styles.onlineAvatarText, { color: primary }]}
                        >
                          {(member.name[0] ?? "?").toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.onlinePresenceDot,
                        { backgroundColor: "#22C55E", borderColor: card },
                      ]}
                    />
                  </View>
                ))}
                {onlineOverflowCount > 0 ? (
                  <View
                    style={[
                      styles.onlineOverflowBadge,
                      {
                        marginLeft: onlinePreview.length > 0 ? -10 : 0,
                        borderColor: card,
                        backgroundColor: backgroundSecondary,
                      },
                    ]}
                  >
                    <Text style={[styles.onlineOverflowText, { color: text }]}>
                      +{onlineOverflowCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.onlineMeta}>
                <Text style={[styles.onlineLabel, { color: text }]}>
                  Online
                </Text>
                <Text style={[styles.onlineSubLabel, { color: secondary }]}>
                  {onlineCount} now
                </Text>
              </View>
              <View
                style={[
                  styles.onlineExpandBtn,
                  {
                    backgroundColor: `${primary}18`,
                    borderColor: `${primary}30`,
                  },
                ]}
              >
                <ChevronDown size={13} color={primary} />
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>

      {errorText ? (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: "#FF3B3014", borderColor: "#FF3B3044" },
          ]}
        >
          <Text style={[styles.errorText, { color: "#FF3B30" }]}>
            {errorText}
          </Text>
        </View>
      ) : null}

      <FlatList<ListItem>
        ref={(r) => {
          listRef.current = r as any;
        }}
        style={styles.list}
        data={listItems}
        keyExtractor={(item) =>
          item.type === "divider" ? item.key : item.data.key
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "none"}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: composerReserved },
          listItems.length === 0
            ? { flexGrow: 1, justifyContent: "center" }
            : null,
        ]}
        renderItem={({ item }) => {
          if (item.type === "divider") {
            return (
              <DateDivider
                label={item.label}
                secondary={secondary}
                border={border}
              />
            );
          }
          return (
            <MessageGroupRow
              group={item.data}
              theme={theme}
              mentionLookup={mentionLookup}
              onLongPressMessage={openActionsForMessage}
              onPressReaction={handlePressReactionChip}
              onLongPressReaction={handleLongPressReactionChip}
            />
          );
        }}
        ListEmptyComponent={
          <View
            style={[
              styles.emptyWrap,
              { borderColor: border, backgroundColor: card },
            ]}
          >
            <View
              style={[styles.emptyIcon, { backgroundColor: `${primary}14` }]}
            >
              <MessageCircle size={28} color={primary} strokeWidth={1.8} />
            </View>
            <Text style={[styles.emptyTitle, { color: text }]}>
              {emptyTitle}
            </Text>
            <Text style={[styles.emptySubtitle, { color: secondary }]}>
              {emptySubtitle}
            </Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        enabled={Platform.OS === "ios"}
        behavior="padding"
        keyboardVerticalOffset={keyboardOffset}
        style={[
          styles.inputContainer,
          Platform.OS === "android"
            ? { marginBottom: androidKeyboardHeight }
            : null,
        ]}
      >
        {typingUsers.length > 0 && (
          <View style={styles.typingWrap}>
            <View style={styles.typingAvatars}>
              {typingUsers.map((u, i) => (
                <View
                  key={u.id}
                  style={[
                    styles.typingAvatarWrap,
                    { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i },
                  ]}
                >
                  {u.image ? (
                    <Image
                      source={{ uri: u.image }}
                      style={styles.typingAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.typingAvatarFallback,
                        { backgroundColor: primary },
                      ]}
                    >
                      <Text style={styles.typingAvatarText}>
                        {u.name[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
            <View style={styles.dotContainer}>
              <AnimatedDot delay={0} color={secondary} />
              <AnimatedDot delay={200} color={secondary} />
              <AnimatedDot delay={400} color={secondary} />
            </View>
          </View>
        )}

        {replyTarget ? (
          <View
            style={[
              styles.replyBar,
              { backgroundColor: card, borderColor: border },
            ]}
          >
            <View style={styles.replyBarTextWrap}>
              <Text style={[styles.replyBarTitle, { color: primary }]}>
                Replying to {replyTarget.user?.name ?? "message"}
              </Text>
              <Text
                style={[styles.replyBarSnippet, { color: secondary }]}
                numberOfLines={1}
              >
                {replyTarget.content || "Media message"}
              </Text>
            </View>
            <Pressable
              onPress={() => setReplyTarget(null)}
              style={styles.replyBarClose}
            >
              <X size={14} color={secondary} />
            </Pressable>
          </View>
        ) : null}

        {editingMessage ? (
          <View
            style={[
              styles.replyBar,
              { backgroundColor: card, borderColor: border },
            ]}
          >
            <View style={styles.replyBarTextWrap}>
              <Text style={[styles.replyBarTitle, { color: primary }]}>
                Editing message
              </Text>
              <Text
                style={[styles.replyBarSnippet, { color: secondary }]}
                numberOfLines={1}
              >
                {editingMessage.content || "Message"}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setEditingMessage(null);
                setInput("");
              }}
              style={styles.replyBarClose}
            >
              <X size={14} color={secondary} />
            </Pressable>
          </View>
        ) : null}

        {mentionVisible ? (
          <View
            style={[
              styles.mentionSheet,
              { backgroundColor: card, borderColor: border },
            ]}
          >
            {mentionSuggestions.length > 0 ? (
              mentionSuggestions.map((candidate) => (
                <Pressable
                  key={candidate.id}
                  onPress={() => handlePickMention(candidate)}
                  style={styles.mentionRow}
                >
                  {candidate.image ? (
                    <Image
                      source={{ uri: candidate.image }}
                      style={styles.mentionAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.mentionAvatarFallback,
                        { backgroundColor: `${primary}1F` },
                      ]}
                    >
                      <Text
                        style={[styles.mentionAvatarText, { color: primary }]}
                      >
                        {(candidate.name[0] ?? "?").toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.mentionMeta}>
                    <Text
                      style={[styles.mentionName, { color: text }]}
                      numberOfLines={1}
                    >
                      {candidate.name}
                    </Text>
                    <Text
                      style={[styles.mentionHandle, { color: secondary }]}
                      numberOfLines={1}
                    >
                      @{candidate.handle}
                    </Text>
                  </View>
                </Pressable>
              ))
            ) : (
              <Text style={[styles.mentionEmpty, { color: secondary }]}>
                No members match @{mentionQuery}
              </Text>
            )}
          </View>
        ) : null}

        <ChatInput
          value={input}
          onChangeText={setInput}
          onSend={() => void handleSend()}
          onPickMedia={() => setPickerVisible(true)}
          onTypingStatusChange={setTypingStatus}
          isMember={isMember}
          isAuthed
          sending={sending}
          isDark={isDark}
          composerAnim={composerAnim}
        />
      </KeyboardAvoidingView>

      <Modal
        visible={onlineSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOnlineSheetVisible(false)}
      >
        <View style={styles.sheetRoot}>
          <Pressable
            style={styles.sheetDismissArea}
            onPress={() => setOnlineSheetVisible(false)}
          />
          <Pressable
            style={[
              styles.reactionDetailsSheet,
              {
                backgroundColor: card,
                borderColor: border,
                paddingBottom: Math.max(insets.bottom, 10),
              },
            ]}
            onPress={() => {}}
          >
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: `${secondary}55` },
              ]}
            />
            <Text style={[styles.reactionDetailsTitle, { color: text }]}>
              Online now
            </Text>
            <Text style={[styles.onlineSheetSubtitle, { color: secondary }]}>
              {onlineCount} members currently active
            </Text>
            <FlatList
              data={onlineUsers}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <View style={styles.reactionUserRow}>
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.reactionUserAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.reactionUserAvatarFallback,
                        { backgroundColor: `${primary}22` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.reactionUserAvatarText,
                          { color: primary },
                        ]}
                      >
                        {(item.name[0] ?? "?").toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[styles.reactionUserName, { color: text }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <Text
                  style={[styles.reactionDetailsEmpty, { color: secondary }]}
                >
                  No one online yet
                </Text>
              }
            />
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={actionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionsVisible(false)}
      >
        <View style={styles.sheetRoot}>
          <Pressable
            style={styles.sheetDismissArea}
            onPress={() => setActionsVisible(false)}
          />
          <Pressable
            style={[
              styles.actionsSheet,
              {
                backgroundColor: card,
                borderColor: border,
                paddingBottom: Math.max(insets.bottom, 10),
              },
            ]}
            onPress={() => {}}
          >
            <View style={styles.actionsEmojiRow}>
              {["👍", "❤️", "😂", "🔥", "😮", "👏"].map((emoji) => (
                <Pressable
                  key={emoji}
                  style={[
                    styles.emojiAction,
                    { backgroundColor: `${primary}18` },
                  ]}
                  onPress={() => {
                    if (!activeMessage) return;
                    void toggleReactionForMessage(activeMessage, emoji, true);
                  }}
                >
                  <Text style={styles.emojiActionText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.actionBtn} onPress={handleReplyToMessage}>
              <Text style={[styles.actionBtnText, { color: text }]}>Reply</Text>
            </Pressable>

            {activeMessage?.user_id === user?.id ? (
              <>
                <Pressable
                  style={styles.actionBtn}
                  onPress={handleStartEditMessage}
                >
                  <Text style={[styles.actionBtnText, { color: text }]}>
                    Edit
                  </Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={handleDeleteForMe}>
                  <Text style={[styles.actionBtnText, { color: text }]}>
                    Delete for me
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => void handleDeleteForAll()}
                >
                  <Text style={[styles.actionBtnText, { color: "#FF3B30" }]}>
                    Delete for all
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.actionBtn} onPress={handleDeleteForMe}>
                <Text style={[styles.actionBtnText, { color: text }]}>
                  Delete for me
                </Text>
              </Pressable>
            )}
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={reactionDetailsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReactionDetailsVisible(false)}
      >
        <View style={styles.sheetRoot}>
          <Pressable
            style={styles.sheetDismissArea}
            onPress={() => setReactionDetailsVisible(false)}
          />
          <Pressable
            style={[
              styles.reactionDetailsSheet,
              {
                backgroundColor: card,
                borderColor: border,
                paddingBottom: Math.max(insets.bottom, 10),
              },
            ]}
            onPress={() => {}}
          >
            <Text style={[styles.reactionDetailsTitle, { color: text }]}>
              {reactionDetailsEmoji} Reactions
            </Text>
            <FlatList
              data={reactionDetailsUsers}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <View style={styles.reactionUserRow}>
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.reactionUserAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.reactionUserAvatarFallback,
                        { backgroundColor: `${primary}22` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.reactionUserAvatarText,
                          { color: primary },
                        ]}
                      >
                        {(item.name[0] ?? "?").toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[styles.reactionUserName, { color: text }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <Text
                  style={[styles.reactionDetailsEmpty, { color: secondary }]}
                >
                  No reactions yet
                </Text>
              }
            />
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={[styles.pickerSheet, { backgroundColor: bg }]}>
            <View style={styles.pickerHeader}>
              <View style={styles.pickerHeaderLeft}>
                <Pressable
                  style={[
                    styles.pickerModeBtn,
                    { backgroundColor: `${primary}16` },
                  ]}
                  onPress={() => void handlePickFromGallery()}
                >
                  <ImageIcon size={14} color={primary} strokeWidth={2.2} />
                  <Text style={[styles.pickerModeText, { color: primary }]}>
                    Gallery
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.pickerModeBtn,
                    pickerMode === "gif" && { backgroundColor: `${primary}22` },
                  ]}
                  onPress={() => setPickerMode("gif")}
                >
                  <Grid
                    size={14}
                    color={pickerMode === "gif" ? primary : text}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      styles.pickerModeText,
                      { color: pickerMode === "gif" ? primary : text },
                    ]}
                  >
                    GIF
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.pickerModeBtn,
                    pickerMode === "sticker" && {
                      backgroundColor: `${primary}22`,
                    },
                  ]}
                  onPress={() => setPickerMode("sticker")}
                >
                  <Gem
                    size={14}
                    color={pickerMode === "sticker" ? primary : text}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      styles.pickerModeText,
                      { color: pickerMode === "sticker" ? primary : text },
                    ]}
                  >
                    Sticker
                  </Text>
                </Pressable>
              </View>
              <Pressable
                style={[
                  styles.pickerCloseBtn,
                  { backgroundColor: `${text}1A` },
                ]}
                onPress={() => setPickerVisible(false)}
              >
                <X size={16} color={text} strokeWidth={2.4} />
              </Pressable>
            </View>

            <TextInput
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder={
                pickerMode === "sticker" ? "Search stickers" : "Search GIFs"
              }
              placeholderTextColor={`${text}80`}
              style={[
                styles.pickerSearch,
                { color: text, borderColor: border },
              ]}
            />

            {pickerLoading ? (
              <View style={styles.pickerState}>
                <ActivityIndicator size="small" color={primary} />
              </View>
            ) : pickerError ? (
              <View style={styles.pickerState}>
                <Text style={[styles.pickerError, { color: "#FF3B30" }]}>
                  {pickerError}
                </Text>
              </View>
            ) : (
              <FlatList
                data={pickerItems}
                keyExtractor={(item) => item.id}
                numColumns={3}
                columnWrapperStyle={styles.pickerRow}
                contentContainerStyle={styles.pickerGrid}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => void handlePickGifOrSticker(item)}
                    style={styles.pickerCard}
                  >
                    <Image
                      source={{ uri: item.previewUrl }}
                      style={styles.pickerImage}
                      contentFit="cover"
                    />
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const divStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
});

const groupStyles = StyleSheet.create({
  outer: {
    flexDirection: "row",
    marginBottom: 12,
    maxWidth: "82%",
    alignItems: "flex-end",
  },
  outerMine: { alignSelf: "flex-end" },
  outerOther: { alignSelf: "flex-start" },
  avatarCol: { marginRight: 8, marginBottom: 18 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "700" },
  bubbleCol: { gap: 0, alignItems: "flex-start" },
  bubbleColMine: { alignItems: "flex-end" },
  bubble: {
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
    minWidth: 56,
    maxWidth: "100%",
  },
  bubbleMediaOnly: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    minWidth: 0,
    overflow: "hidden",
  },
  media: {
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "rgba(0,0,0,0.06)",
    maxHeight: 320,
  },
  mediaNoBottomGap: { marginBottom: 0 },
  mediaVideoWrap: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  messageText: { fontSize: 14.5, lineHeight: 21 },
  replyRefWrap: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 4,
    maxWidth: "100%",
  },
  replyRefWrapMine: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  replyRefWrapOther: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  replyRefAuthor: {
    fontSize: 11,
    fontWeight: "700",
  },
  replyRefHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  replyRefText: {
    fontSize: 11.5,
    marginTop: 1,
  },
  reactionOverlay: {
    position: "absolute",
    bottom: -10,
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6,
    zIndex: 2,
  },
  reactionOverlayMine: {
    right: 12,
    justifyContent: "flex-end",
  },
  reactionOverlayOther: {
    left: 12,
    justifyContent: "flex-start",
  },
  reactionChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 11,
    borderWidth: 1,
  },
  reactionChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  mentionHeaderWrap: {
    gap: 4,
    marginBottom: 0,
    maxWidth: "100%",
  },
  mentionHeaderWrapMine: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  mentionHeaderWrapOther: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  mentionHeaderItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
  },
  mentionHeaderItemMine: {
    paddingRight: 5,
  },
  mentionHeaderItemOther: {
    paddingRight: 5,
  },
  mentionHeaderAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  mentionHeaderAvatarFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  mentionHeaderAvatarText: {
    fontSize: 9,
    fontWeight: "700",
  },
  mentionHeaderName: {
    fontSize: 11,
    fontWeight: "700",
    maxWidth: 120,
  },
  timestampRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginLeft: 2,
  },
  timestampRowMine: {
    marginLeft: 0,
    marginRight: 2,
    alignSelf: "flex-end",
  },
  timestamp: { fontSize: 10, opacity: 0.6, letterSpacing: 0.2 },
  timestampMine: { marginLeft: 0, marginRight: 0, alignSelf: "center" },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerMetaText: { fontSize: 12, fontWeight: "500" },

  errorBox: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  errorText: { fontSize: 13, fontWeight: "500" },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingTop: 6 },

  emptyWrap: {
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 8,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptySubtitle: { fontSize: 13.5, textAlign: "center", lineHeight: 19 },

  typingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 16,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  replyBar: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  replyBarTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  replyBarTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  replyBarSnippet: {
    fontSize: 12,
    marginTop: 2,
  },
  replyBarClose: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  mentionSheet: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  mentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mentionAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  mentionAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  mentionAvatarText: {
    fontSize: 11,
    fontWeight: "700",
  },
  mentionMeta: {
    flex: 1,
    minWidth: 0,
  },
  mentionName: {
    fontSize: 14,
    fontWeight: "600",
  },
  mentionHandle: {
    fontSize: 12,
    marginTop: 1,
  },
  mentionEmpty: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
  },
  inputContainer: {
    elevation: 20,
    zIndex: 100,
  },
  onlineDockWrap: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  onlineDock: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  onlineAvatars: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 40,
  },
  onlineAvatarWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    position: "relative",
  },
  onlineAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  onlineAvatarFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineAvatarText: {
    fontSize: 9,
    fontWeight: "800",
  },
  onlinePresenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    position: "absolute",
    right: -1,
    bottom: -1,
  },
  onlineOverflowBadge: {
    height: 24,
    minWidth: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  onlineOverflowText: {
    fontSize: 10,
    fontWeight: "800",
  },
  onlineMeta: {
    minWidth: 52,
  },
  onlineLabel: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  },
  onlineSubLabel: {
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
    marginTop: 1,
  },
  onlineExpandBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 10,
  },
  onlineSheetSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: -2,
    marginBottom: 10,
  },
  typingAvatars: {
    flexDirection: "row",
    alignItems: "center",
  },
  typingAvatarWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "white",
    overflow: "hidden",
  },
  typingAvatar: {
    width: "100%",
    height: "100%",
  },
  typingAvatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  typingAvatarText: {
    color: "white",
    fontSize: 9,
    fontWeight: "800",
  },
  dotContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  dot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetDismissArea: {
    flex: 1,
  },
  actionsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    padding: 14,
  },
  actionsSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    padding: 10,
    gap: 2,
  },
  actionsEmojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  emojiAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiActionText: {
    fontSize: 18,
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  editSheet: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 14,
    padding: 12,
    marginBottom: 24,
    marginTop: "auto",
  },
  editTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 90,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: "top",
    fontSize: 14,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
  },
  editActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  reactionDetailsSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    padding: 12,
    maxHeight: "55%",
  },
  reactionDetailsTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  reactionDetailsEmpty: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  reactionUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reactionUserAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  reactionUserAvatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionUserAvatarText: {
    fontSize: 12,
    fontWeight: "700",
  },
  reactionUserName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    height: "62%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickerModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pickerModeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  pickerCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerSearch: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "500",
  },
  pickerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerError: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  pickerGrid: {
    paddingBottom: 24,
    gap: 8,
  },
  pickerRow: {
    gap: 8,
  },
  pickerCard: {
    flex: 1 / 3,
    borderRadius: 12,
    overflow: "hidden",
    aspectRatio: 1,
    backgroundColor: "rgba(127,127,127,0.14)",
  },
  pickerImage: {
    width: "100%",
    height: "100%",
  },
});
