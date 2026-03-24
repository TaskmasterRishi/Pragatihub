import AppLoader from "@/components/AppLoader";
import ChatInput from "@/components/ChatInput";
import { useCommunityStats } from "@/hooks/use-community-stats";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroupById, type Group } from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import type { Tables } from "@/types/database.types";
import { useUser } from "@clerk/clerk-expo";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { useGlobalSearchParams } from "expo-router";
import { MessageCircle, Users } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  Image as RNImage,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ─────────────────────────────────────────────────────────────────

type ChatUser = Pick<Tables<"users">, "id" | "name" | "image">;
type ChatMessageRow = Tables<"community_chat_messages">;
type ChatMediaType = "text" | "image" | "gif" | "sticker" | "video";
type ChatMessage = ChatMessageRow & {
  user: ChatUser | null;
  media_type?: ChatMediaType | null;
  media_url?: string | null;
  clientStatus?: "sent" | "sending" | "failed";
};

const CHAT_MEDIA_BUCKET = "chat_media";
const MAX_UPLOAD_BYTES = Number(
  process.env.EXPO_PUBLIC_MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024,
);
const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? "LIVDSRZULELA";
const GIF_PAGE_SIZE = 24;

// A "group" is all consecutive messages from the same sender within the same minute.
type MessageGroup = {
  key: string;
  senderId: string;
  sender: ChatUser | null;
  mine: boolean;
  timestamp: string; // formatted "HH:MM"
  minuteKey: string; // "YYYY-MM-DDTHH:MM"
  messages: ChatMessage[];
};

type TypingUser = {
  id: string;
  name: string;
  image: string | null;
};

type PickerMode = "gif" | "sticker";
type PickerItem = {
  id: string;
  previewUrl: string;
  mediaUrl: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function minuteKey(isoString: string): string {
  // Truncate to the minute: "2024-03-23T15:04"
  return isoString.slice(0, 16);
}

function formatTime(isoString: string): string {
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateDivider(isoString: string): string {
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return "";
  const now = new Date();
  const isToday =
    dt.getDate() === now.getDate() &&
    dt.getMonth() === now.getMonth() &&
    dt.getFullYear() === now.getFullYear();
  if (isToday) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    dt.getDate() === yesterday.getDate() &&
    dt.getMonth() === yesterday.getMonth() &&
    dt.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return "Yesterday";
  return dt.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function detectChatMediaType(
  mimeType?: string | null,
  fileName?: string | null,
  uri?: string | null,
): ChatMediaType {
  const source = `${mimeType ?? ""} ${fileName ?? ""} ${uri ?? ""}`.toLowerCase();
  if (
    source.includes("video") ||
    source.endsWith(".mp4") ||
    source.endsWith(".mov") ||
    source.endsWith(".m4v") ||
    source.endsWith(".webm")
  ) {
    return "video";
  }
  if (source.includes("gif") || source.endsWith(".gif")) return "gif";
  if (source.includes("webp") || source.includes("sticker")) return "sticker";
  return "image";
}

function parseKeyboardMediaInput(raw: string): {
  content: string;
  mediaType?: ChatMediaType;
  mediaUrl?: string;
} {
  const text = raw.trim();
  if (!text) return { content: "" };

  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = text.match(urlRegex) ?? [];
  if (urls.length === 0) return { content: text };

  const mediaUrl = urls[0];
  const lower = mediaUrl.toLowerCase();

  const isGif =
    lower.includes(".gif") || lower.includes("giphy.com") || lower.includes("tenor.com");
  const isSticker =
    lower.includes(".webp") || lower.includes("sticker");
  const isImage =
    lower.includes(".png") ||
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".heic");
  const isVideo =
    lower.includes(".mp4") ||
    lower.includes(".mov") ||
    lower.includes(".m4v") ||
    lower.includes(".webm");

  if (!isGif && !isSticker && !isImage && !isVideo) {
    return { content: text };
  }

  const mediaType: ChatMediaType = isVideo
    ? "video"
    : isGif
      ? "gif"
      : isSticker
        ? "sticker"
        : "image";

  const content = text.replace(mediaUrl, "").trim();
  return { content, mediaType, mediaUrl };
}

/** Group a flat list of messages into MessageGroup[] */
function groupMessages(messages: ChatMessage[], myId: string): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const msg of messages) {
    const mk = minuteKey(msg.created_at);
    const last = groups[groups.length - 1];
    if (last && last.senderId === msg.user_id && last.minuteKey === mk) {
      last.messages.push(msg);
    } else {
      groups.push({
        key: msg.id,
        senderId: msg.user_id,
        sender: msg.user,
        mine: msg.user_id === myId,
        timestamp: formatTime(msg.created_at),
        minuteKey: mk,
        messages: [msg],
      });
    }
  }
  return groups;
}

/** Insert date dividers between groups that fall on different calendar days */
type ListItem =
  | { type: "divider"; key: string; label: string }
  | { type: "group"; data: MessageGroup };

function buildListItems(groups: MessageGroup[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDate = "";
  for (const g of groups) {
    const date = g.minuteKey.slice(0, 10); // "YYYY-MM-DD"
    if (date !== lastDate) {
      lastDate = date;
      items.push({
        type: "divider",
        key: `divider-${date}`,
        label: formatDateDivider(g.messages[0].created_at),
      });
    }
    items.push({ type: "group", data: g });
  }
  return items;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

type Theme = {
  text: string;
  secondary: string;
  primary: string;
  border: string;
  backgroundSecondary: string;
  isDark: boolean;
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

function MessageGroupRow({
  group,
  theme,
}: {
  group: MessageGroup;
  theme: Theme;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(10)).current;
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAvatarPress = () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setShowTooltip(true);
    tooltipTimer.current = setTimeout(() => setShowTooltip(false), 2000);
  };

  useEffect(
    () => () => {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    },
    [],
  );

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
      {/* Avatar column (others only) */}
      {!mine && (
        <View style={groupStyles.avatarCol}>
          {/* Tooltip */}
          {showTooltip && (
            <View
              style={[
                groupStyles.tooltip,
                { backgroundColor: isDark ? "#3a3a3c" : "#1c1c1e" },
              ]}
            >
              <Text style={groupStyles.tooltipText} numberOfLines={1}>
                {sender?.name ?? "Unknown"}
              </Text>
            </View>
          )}

          <Pressable onPress={handleAvatarPress}>
            {sender?.image ? (
              <Image
                source={{ uri: sender.image }}
                style={groupStyles.avatar}
              />
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
          </Pressable>
        </View>
      )}

      {/* Bubble column — no sender name label */}
      <View style={[groupStyles.bubbleCol, mine && groupStyles.bubbleColMine]}>
        {/* Each message in the group */}
        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1;
          // Tail radius: the very last bubble gets the "tail" corner
          // Tail = bottom corner of the LAST bubble only, same side always
          // Others → bottom-left tail  |  Mine → bottom-right tail
          const radiusTL = 18;
          const radiusTR = 18;
          const radiusBL = !mine && isLast ? 4 : 18;
          const radiusBR = mine && isLast ? 4 : 18;
          return (
            <View
              key={msg.id}
              style={[
                groupStyles.bubble,
                msg.media_url && !msg.content?.trim()
                  ? groupStyles.bubbleMediaOnly
                  : null,
                {
                  backgroundColor: bubbleBg,
                  borderColor: bubbleBorderColor,
                  borderTopLeftRadius: radiusTL,
                  borderTopRightRadius: radiusTR,
                  borderBottomLeftRadius: radiusBL,
                  borderBottomRightRadius: radiusBR,
                  marginBottom: isLast ? 0 : 2,
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
                  {msg.content}
                </Text>
              ) : null}
            </View>
          );
        })}

        {/* Single timestamp + send status for the whole group */}
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

const groupStyles = StyleSheet.create({
  outer: {
    flexDirection: "row",
    marginBottom: 12,
    maxWidth: "82%",
    alignItems: "flex-end",
  },
  outerMine: { alignSelf: "flex-end" },
  outerOther: { alignSelf: "flex-start" },
  avatarCol: { marginRight: 8, marginBottom: 18 }, // 18 = timestamp height
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
  senderName: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    marginLeft: 2,
    letterSpacing: 0.1,
  },
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
  mediaNoBottomGap: {
    marginBottom: 0,
  },
  mediaVideoWrap: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  messageText: { fontSize: 14.5, lineHeight: 21 },
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
  timestamp: {
    fontSize: 10,
    opacity: 0.6,
    letterSpacing: 0.2,
  },
  timestampMine: { marginLeft: 0, marginRight: 0, alignSelf: "center" },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  // Tooltip
  tooltip: {
    position: "absolute",
    bottom: 44,
    left: 0,
    marginBottom: 4,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 9999,
    minWidth: 60,
    maxWidth: 220,
    elevation: 20,
  },
  tooltipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});

// ─── Main screen ────────────────────────────────────────────────────────────

export default function CommunityChatTab() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const communityId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isTablet =
    Platform.OS === "ios" ? Platform.isPad : Math.min(width, height) >= 600;
  const keyboardOffset = Platform.OS === "ios" ? (isTablet ? 90 : 12) : 0;

  const [community, setCommunity] = useState<Group | null>(null);
  const { membersCount: members } = useCommunityStats(communityId);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]); // Array of user objects
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>("gif");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const listRef = useRef<FlatList<ListItem> | null>(null);
  const composerAnim = useRef(new Animated.Value(0)).current;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isAuthed = !!user?.id;

  const composerReserved = 32 + insets.bottom;

  // Slide-up composer on mount
  useEffect(() => {
    Animated.spring(composerAnim, {
      toValue: 1,
      bounciness: 0,
      speed: 16,
      useNativeDriver: true,
    }).start();
  }, [composerAnim]);

  // Android fallback: keep composer above keyboard even after app resume.
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
      if (nextState !== "active") {
        setAndroidKeyboardHeight(0);
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      appStateSub.remove();
    };
  }, [insets.bottom]);

  const loadCommunityMeta = useCallback(async () => {
    if (!communityId || !isAuthed || !user?.id) return;
    const [{ data }, membershipRes] = await Promise.all([
      fetchGroupById(communityId),
      supabase
        .from("user_groups")
        .select("group_id", { count: "exact", head: true })
        .eq("group_id", communityId)
        .eq("user_id", user.id),
    ]);
    setCommunity(data ?? null);
    setIsMember((membershipRes.count ?? 0) > 0);
  }, [communityId, isAuthed, user?.id]);

  const loadMessages = useCallback(async () => {
    if (!communityId || !isAuthed) return;
    const { data, error } = await supabase
      .from("community_chat_messages")
      .select(
        "id, group_id, user_id, content, media_type, media_url, created_at, user:users(id, name, image)",
      )
      .eq("group_id", communityId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) {
      setErrorText(error.message ?? "Failed to load messages.");
      return;
    }
    const mapped = ((data ?? []) as any[]).map((row) => ({
      id: row.id as string,
      group_id: row.group_id as string,
      user_id: row.user_id as string,
      content: row.content as string,
      media_type: (row.media_type as ChatMediaType | null) ?? "text",
      media_url: (row.media_url as string | null) ?? null,
      created_at: row.created_at as string,
      clientStatus: "sent" as const,
      user: row.user
        ? {
            id: row.user.id as string,
            name: row.user.name as string,
            image: (row.user.image as string | null) ?? null,
          }
        : null,
    })) as ChatMessage[];
    setMessages(mapped);
  }, [communityId, isAuthed]);

  useEffect(() => {
    if (!communityId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorText(null);
      await Promise.all([loadCommunityMeta(), loadMessages()]);
      if (!cancelled) setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [communityId, loadCommunityMeta, loadMessages]);

  // Real-time & Presence
  useEffect(() => {
    if (!communityId || !isAuthed || !user) return;

    const channel = supabase.channel(`community-chat:${communityId}`, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_chat_messages",
          filter: `group_id=eq.${communityId}`,
        },
        async (payload) => {
          const next = payload.new as ChatMessageRow;

          // Hydrate sender
          const { data: sender } = await supabase
            .from("users")
            .select("id, name, image")
            .eq("id", next.user_id)
            .single();

          const hydrated: ChatMessage = {
            ...next,
            media_type: (next as any).media_type ?? "text",
            media_url: (next as any).media_url ?? null,
            clientStatus: "sent",
            user: sender
              ? { id: sender.id, name: sender.name, image: sender.image }
              : null,
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === hydrated.id)) return prev;
            const optimisticIndex = prev.findIndex(
              (m) =>
                m.clientStatus === "sending" &&
                m.user_id === hydrated.user_id &&
                m.content === hydrated.content &&
                (m.media_url ?? null) === (hydrated.media_url ?? null),
            );
            if (optimisticIndex >= 0) {
              const nextMessages = [...prev];
              nextMessages[optimisticIndex] = hydrated;
              return nextMessages;
            }
            return [...prev, hydrated];
          });
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const typers: TypingUser[] = [];
        Object.keys(state).forEach((key) => {
          const presence = state[key] as any[];
          presence.forEach((p) => {
            if (p.typing && p.user_id !== user.id) {
              typers.push({
                id: p.user_id,
                name: p.user_name || "Someone",
                image: p.user_image || null,
              });
            }
          });
        });
        // Dedupe by ID
        const uniqueTypers = Array.from(
          new Map(typers.map((t) => [t.id, t])).values(),
        );
        setTypingUsers(uniqueTypers);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            user_name: user.fullName || user.firstName || "User",
            user_image: user.imageUrl || null,
            typing: false,
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [communityId, isAuthed, user?.id, user?.imageUrl]);

  // Handle typing status updates from Input
  const setTypingStatus = useCallback(
    async (isTyping: boolean) => {
      if (!channelRef.current || !user) return;
      await channelRef.current.track({
        user_id: user.id,
        user_name: user.fullName || user.firstName || "User",
        user_image: user.imageUrl || null,
        typing: isTyping,
      });
    },
    [user?.id, user?.imageUrl],
  );

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      60,
    );
    return () => clearTimeout(t);
  }, [messages.length]);

  // Build grouped list items
  const listItems = useMemo<ListItem[]>(() => {
    const groups = groupMessages(messages, user?.id ?? "");
    return buildListItems(groups);
  }, [messages, user?.id]);

  const uploadChatMedia = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey || !user?.id || !communityId) {
        return { publicUrl: null, error: "Missing upload configuration." };
      }

      const extensionFromMime = asset.mimeType?.split("/")?.[1];
      const extensionFromName = asset.fileName?.split(".").pop();
      const extensionFromUri = asset.uri.split("?")[0].split(".").pop();
      const extension =
        extensionFromMime || extensionFromName || extensionFromUri || "jpg";
      const inferredType = detectChatMediaType(
        asset.mimeType,
        asset.fileName,
        asset.uri,
      );
      const objectPath = `community/${communityId}/${user.id}/chat_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}.${extension}`;

      const localUri = asset.uri.startsWith("content://")
        ? `${FileSystem.cacheDirectory}chat_upload_${Date.now()}.${extension}`
        : asset.uri;

      if (asset.uri.startsWith("content://")) {
        await FileSystem.copyAsync({ from: asset.uri, to: localUri });
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
        return {
          publicUrl: null,
          error: `File exceeds max size (${maxMb} MB).`,
        };
      }

      const uploadUrl = `${supabaseUrl}/storage/v1/object/${CHAT_MEDIA_BUCKET}/${objectPath}`;
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, localUri, {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type":
            asset.mimeType ??
            (inferredType === "video" ? "video/mp4" : "image/jpeg"),
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
      return { publicUrl: data.publicUrl, error: null, mediaType: inferredType };
    },
    [communityId, user?.id],
  );

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
          trimmed.length > 0 ? `${endpointBase}/search` : `${endpointBase}/trending`;
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
          .filter((item: PickerItem) => item.id && item.previewUrl && item.mediaUrl);
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

  const sendChatMessage = useCallback(
    async ({
      content,
      mediaType = "text",
      mediaUrl = null,
    }: {
      content: string;
      mediaType?: ChatMediaType;
      mediaUrl?: string | null;
    }) => {
      if (!communityId || !user?.id || !isMember || sending) return;
      const normalizedContent = content.trim();
      if (!normalizedContent && !mediaUrl) return;

      const optimisticId = `optimistic-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const now = new Date().toISOString();
      const optimistic: ChatMessage = {
        id: optimisticId,
        group_id: communityId,
        user_id: user.id,
        content: normalizedContent,
        media_type: mediaType,
        media_url: mediaUrl,
        created_at: now,
        clientStatus: "sending",
        user: {
          id: user.id,
          name: user.fullName || user.firstName || "You",
          image: user.imageUrl ?? null,
        },
      };

      setMessages((prev) => [...prev, optimistic]);
      setSending(true);
      setErrorText(null);
      void setTypingStatus(false);

      const { data, error } = await supabase
        .from("community_chat_messages")
        .insert({
          group_id: communityId,
          user_id: user.id,
          content: normalizedContent,
          media_type: mediaType,
          media_url: mediaUrl,
        })
        .select("id, group_id, user_id, content, media_type, media_url, created_at")
        .single();

      if (error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId ? { ...m, clientStatus: "failed" } : m,
          ),
        );
        if (!mediaUrl && normalizedContent) setInput(normalizedContent);
        setErrorText(error.message ?? "Failed to send message.");
      } else if (data?.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? {
                  ...m,
                  id: data.id,
                  group_id: data.group_id,
                  user_id: data.user_id,
                  content: data.content,
                  media_type: (data as any).media_type ?? "text",
                  media_url: (data as any).media_url ?? null,
                  created_at: data.created_at,
                  clientStatus: "sent",
                }
              : m,
          ),
        );
      }
      setSending(false);
    },
    [
      communityId,
      isMember,
      sending,
      user?.id,
      user?.fullName,
      user?.firstName,
      user?.imageUrl,
      setTypingStatus,
    ],
  );

  const handleSend = useCallback(async () => {
    const parsed = parseKeyboardMediaInput(input);
    if (!parsed.content && !parsed.mediaUrl) return;
    setInput("");
    await sendChatMessage({
      content: parsed.content,
      mediaType: parsed.mediaType ?? "text",
      mediaUrl: parsed.mediaUrl ?? null,
    });
  }, [input, sendChatMessage]);

  useEffect(() => {
    if (!pickerVisible) return;
    const timer = setTimeout(() => {
      void fetchPickerItems(pickerMode, pickerQuery);
    }, 220);
    return () => clearTimeout(timer);
  }, [fetchPickerItems, pickerMode, pickerQuery, pickerVisible]);

  const handlePickFromLibrary = useCallback(async () => {
    if (!isMember || !isAuthed || sending) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorText("Media library permission is required to upload images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const caption = input.trim();
    if (caption) setInput("");

    const upload = await uploadChatMedia(asset);
    if (!upload.publicUrl) {
      if (caption) setInput(caption);
      setErrorText(upload.error ?? "Failed to upload media.");
      return;
    }

    await sendChatMessage({
      content: caption,
      mediaType: upload.mediaType ?? "image",
      mediaUrl: upload.publicUrl,
    });
  }, [input, isAuthed, isMember, sending, sendChatMessage, uploadChatMedia]);

  const openPicker = useCallback(() => {
    if (!isMember || !isAuthed || sending) return;
    setPickerVisible(true);
    setPickerError(null);
    setPickerQuery("");
    setPickerMode("gif");
  }, [isAuthed, isMember, sending]);

  const handlePickGifOrSticker = useCallback(
    async (item: PickerItem) => {
      const caption = input.trim();
      if (caption) setInput("");
      setPickerVisible(false);
      await sendChatMessage({
        content: caption,
        mediaType: pickerMode === "sticker" ? "sticker" : "gif",
        mediaUrl: item.mediaUrl,
      });
    },
    [input, pickerMode, sendChatMessage],
  );

  // Common styles/themes
  const bg = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const border = useThemeColor({}, "border");
  const card = useThemeColor({}, "card");
  const primary = useThemeColor({}, "primary");
  const backgroundSecondary = useThemeColor({}, "backgroundSecondary");

  const theme: Theme = {
    text,
    secondary,
    primary,
    border,
    backgroundSecondary,
    isDark,
  };

  if (loading || !community) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <AppLoader fullScreen />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View
          style={[styles.headerIconWrap, { backgroundColor: `${primary}1A` }]}
        >
          <MessageCircle size={19} color={primary} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: text }]}>Global Chat</Text>
          <View style={styles.headerMeta}>
            <Users size={12} color={secondary} strokeWidth={2} />
            <Text style={[styles.headerMetaText, { color: secondary }]}>
              {members} {members === 1 ? "member" : "members"}
            </Text>
          </View>
        </View>
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

      {/* ── Message list ── */}
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
          return <MessageGroupRow group={item.data} theme={theme} />;
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
              No messages yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: secondary }]}>
              Be the first to say something!
            </Text>
          </View>
        }
      />

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={[styles.pickerSheet, { backgroundColor: card }]}>
            <View style={styles.pickerHeader}>
              <Pressable
                style={styles.pickerModeBtn}
                onPress={() => void handlePickFromLibrary()}
              >
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
                <Text style={[styles.pickerModeText, { color: text }]}>GIF</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.pickerModeBtn,
                  pickerMode === "sticker" && { backgroundColor: `${primary}22` },
                ]}
                onPress={() => setPickerMode("sticker")}
              >
                <Text style={[styles.pickerModeText, { color: text }]}>
                  Sticker
                </Text>
              </Pressable>
              <Pressable onPress={() => setPickerVisible(false)}>
                <Text style={[styles.pickerCloseText, { color: secondary }]}>
                  Close
                </Text>
              </Pressable>
            </View>

            <TextInput
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder={
                pickerMode === "sticker" ? "Search stickers" : "Search GIFs"
              }
              placeholderTextColor={`${secondary}80`}
              style={[
                styles.pickerSearch,
                { color: text, borderColor: border, backgroundColor: bg },
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

      {/* ── Chat Input Area with isolated KeyboardAvoidingView ── */}
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
        {/* ── Typing Indicator ── */}
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

        {/* ── Chat Input ── */}
        <ChatInput
          value={input}
          onChangeText={setInput}
          onSend={() => void handleSend()}
          onPickMedia={openPicker}
          onTypingStatusChange={setTypingStatus}
          isMember={isMember}
          isAuthed={isAuthed}
          sending={sending}
          isDark={isDark}
          composerAnim={composerAnim}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  headerMetaText: { fontSize: 12, fontWeight: "500" },

  // Error
  errorBox: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  errorText: { fontSize: 13, fontWeight: "500" },

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingTop: 6 },

  // Empty state
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
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginLeft: 16,
    alignSelf: "flex-start",
    marginBottom: 8, // Clear space just above input bar
  },
  inputContainer: {
    elevation: 20,
    zIndex: 100,
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
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    maxHeight: "70%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  pickerModeBtn: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  pickerModeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  pickerCloseText: {
    fontSize: 12,
    fontWeight: "700",
  },
  pickerSearch: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    marginBottom: 10,
  },
  pickerGrid: {
    paddingBottom: 8,
    gap: 8,
  },
  pickerRow: {
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pickerCard: {
    width: "32%",
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  pickerImage: {
    width: "100%",
    height: "100%",
  },
  pickerState: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerError: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});
