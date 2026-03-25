import AppLoader from "@/components/AppLoader";
import ChatInput from "@/components/ChatInput";
import { useChat, type ListItem, type MessageGroup } from "@/hooks/use-chat";
import { useThemeColor } from "@/hooks/use-theme-color";
import { parseKeyboardMediaInput, type ChatMediaType } from "@/types/chat";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { ChevronLeft, MessageCircle } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  Image as RNImage,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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

function MessageGroupRow({ group, theme }: { group: MessageGroup; theme: Theme }) {
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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isTablet =
    Platform.OS === "ios" ? Platform.isPad : Math.min(width, height) >= 600;
  const keyboardOffset = Platform.OS === "ios" ? (isTablet ? 90 : 12) : 0;

  const [input, setInput] = useState("");
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  const {
    loading,
    sending,
    errorText,
    typingUsers,
    isMember,
    listItems,
    setTypingStatus,
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

  const theme: Theme = useMemo(
    () => ({ text, secondary, primary, border, backgroundSecondary, isDark }),
    [text, secondary, primary, border, backgroundSecondary, isDark],
  );

  useEffect(() => {
    Animated.spring(composerAnim, {
      toValue: 1,
      bounciness: 0,
      speed: 16,
      useNativeDriver: true,
    }).start();
  }, [composerAnim]);

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
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [listItems.length]);

  const handleSend = async () => {
    const parsed = parseKeyboardMediaInput(input);
    if (!parsed.content && !parsed.mediaUrl) return;
    setInput("");
    await sendMessage({
      content: parsed.content,
      mediaType: parsed.mediaType ?? "text",
      mediaUrl: parsed.mediaUrl ?? null,
    });
  };

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
        <View style={[styles.headerIconWrap, { backgroundColor: `${primary}1A` }]}>
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
      </View>

      {errorText ? (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: "#FF3B3014", borderColor: "#FF3B3044" },
          ]}
        >
          <Text style={[styles.errorText, { color: "#FF3B30" }]}>{errorText}</Text>
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
          return <MessageGroupRow group={item.data} theme={theme} />;
        }}
        ListEmptyComponent={
          <View
            style={[
              styles.emptyWrap,
              { borderColor: border, backgroundColor: card },
            ]}
          >
            <View style={[styles.emptyIcon, { backgroundColor: `${primary}14` }]}>
              <MessageCircle size={28} color={primary} strokeWidth={1.8} />
            </View>
            <Text style={[styles.emptyTitle, { color: text }]}>{emptyTitle}</Text>
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
                    <Image source={{ uri: u.image }} style={styles.typingAvatar} />
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

        <ChatInput
          value={input}
          onChangeText={setInput}
          onSend={() => void handleSend()}
          onTypingStatusChange={setTypingStatus}
          isMember={isMember}
          isAuthed
          sending={sending}
          isDark={isDark}
          composerAnim={composerAnim}
        />
      </KeyboardAvoidingView>
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
});
