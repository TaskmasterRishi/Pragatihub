import { useGlobalPresence } from "@/hooks/use-global-presence";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  fetchPrivateChatOverviews,
  searchUsersForPrivateChat,
} from "@/lib/actions/chat";
import type { ChatUser, PrivateChatOverview } from "@/types/chat";
import { useUser } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { MessageCircle, Search } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Row = { type: "header"; key: string; label: string } | { type: "user"; key: string; user: ChatUser } | { type: "recent"; key: string; item: PrivateChatOverview };

export default function ChatHomeTab() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [recentChats, setRecentChats] = useState<PrivateChatOverview[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const { onlineUserIds } = useGlobalPresence();

  const bg = useThemeColor({}, "background");
  const card = useThemeColor({}, "card");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");

  const userId = user?.id;

  const loadRecents = useCallback(async (showLoader = true) => {
    if (!userId) return;
    if (showLoader) setLoadingRecent(true);
    const { data, error } = await fetchPrivateChatOverviews(userId);
    if (error) {
      setErrorText(error);
    } else {
      setErrorText(null);
      setRecentChats(data);
    }
    if (showLoader) setLoadingRecent(false);
  }, [userId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      setLoadingRecent(false);
      return;
    }
    void loadRecents();
  }, [isLoaded, loadRecents, userId]);

  useEffect(() => {
    if (!userId) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await searchUsersForPrivateChat(trimmed, userId);
      if (error) {
        setErrorText(error);
        setSearchResults([]);
      } else {
        setErrorText(null);
        setSearchResults(data);
      }
      setSearching(false);
    }, 220);

    return () => clearTimeout(timer);
  }, [query, userId]);

  const onlineUsers = useMemo(() => {
    if (recentChats.length === 0 || onlineUserIds.size === 0) return [];
    const unique = new Map<string, ChatUser>();
    for (const chat of recentChats) {
      if (!onlineUserIds.has(chat.otherUser.id)) continue;
      unique.set(chat.otherUser.id, chat.otherUser);
    }
    return Array.from(unique.values());
  }, [onlineUserIds, recentChats]);

  const onRefresh = useCallback(async () => {
    if (!userId) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);

    if (query.trim().length >= 2) {
      const { data, error } = await searchUsersForPrivateChat(query.trim(), userId);
      if (error) {
        setErrorText(error);
        setSearchResults([]);
      } else {
        setErrorText(null);
        setSearchResults(data);
      }
    }

    await loadRecents(false);
    setRefreshing(false);
  }, [loadRecents, query, userId]);

  const openWithUser = (target: ChatUser) => {
    router.push({
      pathname: "/(protected)/dm/[id]",
      params: {
        id: target.id,
        name: target.name,
      },
    });
  };

  const rows: Row[] = [];
  const hasSearch = query.trim().length >= 2;

  if (hasSearch) {
    rows.push({ type: "header", key: "search-header", label: "Search results" });
    for (const found of searchResults) {
      rows.push({ type: "user", key: `search-${found.id}`, user: found });
    }
  } else {
    rows.push({ type: "header", key: "recent-header", label: "Recent chats" });
    for (const item of recentChats) {
      rows.push({ type: "recent", key: `recent-${item.chatId}`, item });
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.searchWrap, { backgroundColor: card, borderColor: border }]}>
        <Search size={16} color={secondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search users to start 1:1 chat"
          placeholderTextColor={`${secondary}99`}
          style={[styles.searchInput, { color: text }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {onlineUsers.length > 0 ? (
        <View style={[styles.onlineWrap, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.onlineTitle, { color: text }]}>
            Online now ({onlineUsers.length})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.onlineList}
          >
            {onlineUsers.map((target) => (
              <Pressable
                key={target.id}
                style={styles.onlineUser}
                onPress={() => openWithUser(target)}
              >
                <View style={styles.onlineAvatarWrap}>
                  {target.image ? (
                    <Image source={{ uri: target.image }} style={styles.onlineAvatar} />
                  ) : (
                    <View style={[styles.onlineAvatarFallback, { backgroundColor: `${primary}22` }]}>
                      <Text style={[styles.onlineAvatarFallbackText, { color: primary }]}>
                        {(target.name[0] ?? "?").toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.onlineDot, { backgroundColor: "#22C55E", borderColor: card }]} />
                </View>
                <Text style={[styles.onlineName, { color: text }]} numberOfLines={1}>
                  {target.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {errorText ? (
        <View style={[styles.errorBox, { borderColor: "#FF3B3044", backgroundColor: "#FF3B3014" }]}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : null}

      {searching || loadingRecent ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={primary} />
        </View>
      ) : (
        <FlatList<Row>
          data={rows}
          keyExtractor={(item) => item.key}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            if (item.type === "header") {
              return <Text style={[styles.sectionTitle, { color: secondary }]}>{item.label}</Text>;
            }

            if (item.type === "user") {
              const target = item.user;
              const isActive = onlineUserIds.has(target.id);
              return (
                <Pressable
                  style={[styles.row, { borderColor: border, backgroundColor: card }]}
                  onPress={() => openWithUser(target)}
                >
                  <View style={styles.avatarWrap}>
                    {target.image ? (
                      <Image source={{ uri: target.image }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatarFallback, { backgroundColor: `${primary}22` }]}>
                        <Text style={[styles.avatarFallbackText, { color: primary }]}>
                          {(target.name[0] ?? "?").toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {isActive ? (
                      <View style={[styles.rowOnlineDot, { backgroundColor: "#22C55E", borderColor: card }]} />
                    ) : null}
                  </View>
                  <View style={styles.rowMeta}>
                    <Text style={[styles.rowTitle, { color: text }]} numberOfLines={1}>
                      {target.name}
                    </Text>
                    <Text
                      style={[
                        styles.rowSubtitle,
                        { color: isActive ? "#16A34A" : secondary },
                      ]}
                    >
                      {isActive ? "Live now" : "Start private chat"}
                    </Text>
                  </View>
                </Pressable>
              );
            }

            const target = item.item.otherUser;
            const isActive = onlineUserIds.has(target.id);
            return (
              <Pressable
                style={[styles.row, { borderColor: border, backgroundColor: card }]}
                onPress={() => openWithUser(target)}
              >
                <View style={styles.avatarWrap}>
                  {target.image ? (
                    <Image source={{ uri: target.image }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: `${primary}22` }]}>
                      <Text style={[styles.avatarFallbackText, { color: primary }]}>
                        {(target.name[0] ?? "?").toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {isActive ? (
                    <View style={[styles.rowOnlineDot, { backgroundColor: "#22C55E", borderColor: card }]} />
                  ) : null}
                </View>
                <View style={styles.rowMeta}>
                  <Text style={[styles.rowTitle, { color: text }]} numberOfLines={1}>
                    {target.name}
                  </Text>
                  <Text
                    style={[
                      styles.rowSubtitle,
                      { color: isActive ? "#16A34A" : secondary },
                    ]}
                    numberOfLines={1}
                  >
                    {isActive ? "Live now" : item.item.lastMessageText}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconWrap, { backgroundColor: `${primary}14` }]}>
                <MessageCircle size={24} color={primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: text }]}>
                {hasSearch ? "No users found" : "No private chats yet"}
              </Text>
              <Text style={[styles.emptySubtitle, { color: secondary }]}>
                {hasSearch
                  ? "Try a different name or email."
                  : "Search users above to start one-to-one chat."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 14 },
  searchWrap: {
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  errorBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 12.5,
    fontWeight: "600",
  },
  onlineWrap: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  onlineTitle: {
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  onlineList: {
    paddingHorizontal: 12,
    gap: 12,
  },
  onlineUser: {
    width: 58,
    alignItems: "center",
    gap: 6,
  },
  onlineAvatarWrap: {
    width: 44,
    height: 44,
    position: "relative",
  },
  onlineAvatar: { width: 44, height: 44, borderRadius: 22 },
  onlineAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineAvatarFallbackText: {
    fontSize: 16,
    fontWeight: "700",
  },
  onlineDot: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  onlineName: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingBottom: 24, gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginVertical: 4,
  },
  row: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    position: "relative",
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 16,
    fontWeight: "700",
  },
  rowOnlineDot: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  rowMeta: { flex: 1 },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: "500",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 48,
    paddingHorizontal: 16,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    textAlign: "center",
    marginTop: 4,
    fontSize: 13,
  },
});
