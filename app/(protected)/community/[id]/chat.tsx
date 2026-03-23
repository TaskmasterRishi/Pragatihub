import AppLoader from "@/components/AppLoader";
import ChatInput from "@/components/ChatInput";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroupById, type Group } from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import type { Tables } from "@/types/database.types";
import { useUser } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { useGlobalSearchParams } from "expo-router";
import { MessageCircle, Users } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ─────────────────────────────────────────────────────────────────

type ChatUser = Pick<Tables<"users">, "id" | "name" | "image">;
type ChatMessageRow = Tables<"community_chat_messages">;
type ChatMessage = ChatMessageRow & { user: ChatUser | null };

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
          const isFirst = idx === 0;
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
              <Text style={[groupStyles.messageText, { color: text }]}>
                {msg.content}
              </Text>
            </View>
          );
        })}

        {/* Single timestamp for the whole group */}
        <Text
          style={[
            groupStyles.timestamp,
            { color: secondary },
            mine && groupStyles.timestampMine,
          ]}
        >
          {timestamp}
        </Text>
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
  messageText: { fontSize: 14.5, lineHeight: 21 },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    marginLeft: 2,
    opacity: 0.6,
    letterSpacing: 0.2,
  },
  timestampMine: { marginLeft: 0, marginRight: 2, alignSelf: "flex-end" },
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
  const [members, setMembers] = useState(0);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]); // Array of user objects
  const listRef = useRef<FlatList<ListItem> | null>(null);
  const composerAnim = useRef(new Animated.Value(0)).current;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isAuthed = !!user?.id;

  const composerReserved = Math.max(insets.bottom, 10) + (isMember ? 80 : 100);

  // Slide-up composer on mount
  useEffect(() => {
    Animated.spring(composerAnim, {
      toValue: 1,
      bounciness: 0,
      speed: 16,
      useNativeDriver: true,
    }).start();
  }, [composerAnim]);

  const loadCommunityMeta = useCallback(async () => {
    if (!communityId || !isAuthed || !user?.id) return;
    const [{ data }, membersRes, membershipRes] = await Promise.all([
      fetchGroupById(communityId),
      supabase
        .from("user_groups")
        .select("group_id, user_id", { count: "exact", head: true })
        .eq("group_id", communityId),
      supabase
        .from("user_groups")
        .select("group_id", { count: "exact", head: true })
        .eq("group_id", communityId)
        .eq("user_id", user.id),
    ]);
    setCommunity(data ?? null);
    if (membersRes.count !== null) setMembers(membersRes.count);
    setIsMember((membershipRes.count ?? 0) > 0);
  }, [communityId, isAuthed, user?.id]);

  const loadMessages = useCallback(async () => {
    if (!communityId || !isAuthed) return;
    const { data, error } = await supabase
      .from("community_chat_messages")
      .select(
        "id, group_id, user_id, content, created_at, user:users(id, name, image)",
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
      created_at: row.created_at as string,
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
          // Optimistic check
          if (messages.some((m) => m.id === next.id)) return;

          // Hydrate sender
          const { data: sender } = await supabase
            .from("users")
            .select("id, name, image")
            .eq("id", next.user_id)
            .single();

          const hydrated: ChatMessage = {
            ...next,
            user: sender
              ? { id: sender.id, name: sender.name, image: sender.image }
              : null,
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === hydrated.id)) return prev;
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

  const canSend = useMemo(
    () => isAuthed && isMember && input.trim().length > 0 && !sending,
    [input, isAuthed, isMember, sending],
  );

  const handleSend = useCallback(async () => {
    const message = input.trim();
    if (!message || !communityId || !user?.id || !isMember || sending) return;
    setSending(true);
    setErrorText(null);
    setInput("");
    // Immediate stop typing
    void setTypingStatus(false);
    const { error } = await supabase
      .from("community_chat_messages")
      .insert({ group_id: communityId, user_id: user.id, content: message });
    if (error) {
      setInput(message);
      setErrorText(error.message ?? "Failed to send message.");
    }
    setSending(false);
  }, [communityId, input, isMember, sending, user?.id, setTypingStatus]);

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

      {/* ── Chat Input Area with isolated KeyboardAvoidingView ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardOffset}
        style={styles.inputContainer}
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
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 20,
    zIndex: 100,
    // The background color from chat.tsx is applied via style prop in render
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
});
