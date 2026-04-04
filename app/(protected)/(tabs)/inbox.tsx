import { useThemeColor } from "@/hooks/use-theme-color";
import {
  formatInboxCreatedAt,
  type InboxFilter,
  type InboxItem,
  type InboxKind,
} from "@/lib/inbox/inbox-data";
import { inboxSyncManager } from "@/lib/inbox/inbox-sync";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import {
  Bell,
  CheckCheck,
  MessageCircle,
  RefreshCw,
  Megaphone,
  ShieldAlert,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

const READ_KEY_PREFIX = "pragatihub.inbox.read.v1";

export default function InboxScreen() {
  const { user } = useUser();
  const router = useRouter();
  const userId = user?.id ?? null;

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const secondaryTextColor = useThemeColor({}, "textSecondary");
  const borderColor = useThemeColor({}, "border");
  const cardColor = useThemeColor({}, "card");
  const accentColor = useThemeColor({}, "primary");
  const backgroundSecondary = useThemeColor({}, "backgroundSecondary");

  const [items, setItems] = useState<InboxItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [errorText, setErrorText] = useState<string | null>(null);

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = useMemo(
    () => items.filter((item) => !readSet.has(item.id)).length,
    [items, readSet],
  );
  const filteredItems = useMemo(
    () =>
      filter === "unread"
        ? items.filter((item) => !readSet.has(item.id))
        : items,
    [filter, items, readSet],
  );

  const storageKey = useMemo(
    () => (userId ? `${READ_KEY_PREFIX}.${userId}` : null),
    [userId],
  );

  const persistReadIds = useCallback(
    async (nextReadIds: string[]) => {
      if (!storageKey) return;
      await AsyncStorage.setItem(storageKey, JSON.stringify(nextReadIds));
    },
    [storageKey],
  );

  const markAsRead = useCallback(
    (itemId: string) => {
      setReadIds((current) => {
        if (current.includes(itemId)) return current;
        const next = [...current, itemId];
        void persistReadIds(next);
        return next;
      });
    },
    [persistReadIds],
  );

  const markAllAsRead = useCallback(() => {
    const allIds = items.map((item) => item.id);
    setReadIds(allIds);
    void persistReadIds(allIds);
  }, [items, persistReadIds]);

  useEffect(() => {
    if (!storageKey) return;
    let active = true;
    const hydrate = async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!active || !raw) {
          if (active) setReadIds([]);
          return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setReadIds(parsed.filter((value) => typeof value === "string"));
        } else {
          setReadIds([]);
        }
      } catch {
        if (active) setReadIds([]);
      }
    };
    void hydrate();
    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!userId) return;
    setErrorText(null);
    inboxSyncManager.start(userId);
    setItems(inboxSyncManager.getItems());
    const unsubscribe = inboxSyncManager.subscribe((nextItems) => {
      setItems(nextItems);
      setLoading(false);
    });
    return () => {
      unsubscribe();
    };
  }, [userId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setErrorText(null);
    inboxSyncManager
      .refresh()
      .catch((error: any) => {
        setErrorText(error?.message ?? "Failed to load inbox");
      })
      .finally(() => {
        setRefreshing(false);
      });
  }, []);

  const renderIcon = (kind: InboxKind, isUnread: boolean) => {
    const color = isUnread ? accentColor : secondaryTextColor;
    if (kind === "chat" || kind === "chat_mention" || kind === "chat_reply" || kind === "dm") {
      return <MessageCircle size={18} color={color} />;
    }
    if (kind === "community_post" || kind === "badge_award" || kind === "community_join") {
      return <Megaphone size={18} color={color} />;
    }
    if (kind === "moderation" || kind === "moderator_vote") {
      return <ShieldAlert size={18} color={color} />;
    }
    if (kind === "reply") return <MessageCircle size={18} color={color} />;
    return <Bell size={18} color={color} />;
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: borderColor, backgroundColor: backgroundColor },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: textColor }]}>Inbox</Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  unreadCount > 0 ? `${accentColor}20` : backgroundSecondary,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: unreadCount > 0 ? accentColor : secondaryTextColor },
              ]}
            >
              {unreadCount} unread
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <View style={styles.filters}>
            <Pressable
              onPress={() => setFilter("all")}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    filter === "all" ? `${accentColor}1E` : backgroundSecondary,
                  borderColor: filter === "all" ? `${accentColor}66` : borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: filter === "all" ? accentColor : secondaryTextColor },
                ]}
              >
                All
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFilter("unread")}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    filter === "unread"
                      ? `${accentColor}1E`
                      : backgroundSecondary,
                  borderColor:
                    filter === "unread" ? `${accentColor}66` : borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color:
                      filter === "unread" ? accentColor : secondaryTextColor,
                  },
                ]}
              >
                Unread
              </Text>
            </Pressable>
          </View>

          <View style={styles.rowActionsRight}>
            <Pressable
              onPress={onRefresh}
              style={[
                styles.ghostAction,
                { borderColor, backgroundColor: backgroundSecondary },
              ]}
            >
              <RefreshCw size={15} color={secondaryTextColor} />
            </Pressable>
            <Pressable
              onPress={markAllAsRead}
              disabled={items.length === 0 || unreadCount === 0}
              style={[
                styles.primaryAction,
                {
                  backgroundColor:
                    unreadCount > 0 ? `${accentColor}1E` : backgroundSecondary,
                  borderColor: unreadCount > 0 ? `${accentColor}66` : borderColor,
                  opacity: unreadCount > 0 ? 1 : 0.6,
                },
              ]}
            >
              <CheckCheck size={14} color={accentColor} />
              <Text style={[styles.primaryActionText, { color: accentColor }]}>
                Mark all
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={accentColor} />
          <Text style={[styles.stateText, { color: secondaryTextColor }]}>
            Loading inbox...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={accentColor}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.stateTitle, { color: textColor }]}>
                {filter === "unread" ? "No unread notifications" : "Inbox is empty"}
              </Text>
              <Text style={[styles.stateText, { color: secondaryTextColor }]}>
                {errorText
                  ? errorText
                  : "When people interact with your content, updates will show here."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUnread = !readSet.has(item.id);
            return (
              <Pressable
                onPress={() => {
                  markAsRead(item.id);
                  router.push(item.path as never);
                }}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: cardColor,
                    borderColor: isUnread ? `${accentColor}4A` : borderColor,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: isUnread
                        ? `${accentColor}1E`
                        : backgroundSecondary,
                    },
                  ]}
                >
                  {renderIcon(item.kind, isUnread)}
                </View>

                <View style={styles.itemContent}>
                  <View style={styles.itemHeaderRow}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.itemTitle,
                        { color: textColor, fontWeight: isUnread ? "700" : "600" },
                      ]}
                    >
                      {item.title}
                    </Text>
                  </View>

                  <Text
                    numberOfLines={2}
                    style={[styles.itemPreview, { color: secondaryTextColor }]}
                  >
                    {item.preview}
                  </Text>

                  <View style={styles.actorRow}>
                    {item.actorImage ? (
                      <Image source={{ uri: item.actorImage }} style={styles.avatar} />
                    ) : (
                      <View
                        style={[
                          styles.avatarFallback,
                          { backgroundColor: backgroundSecondary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarInitial,
                            { color: secondaryTextColor },
                          ]}
                        >
                          {item.actorName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text
                      numberOfLines={1}
                      style={[styles.actorName, { color: secondaryTextColor }]}
                    >
                      {item.actorName}
                    </Text>
                  </View>
                  <Text style={[styles.createdAtText, { color: secondaryTextColor }]}>
                    {formatInboxCreatedAt(item.createdAt)}
                  </Text>
                </View>

                {isUnread ? (
                  <View
                    style={[styles.unreadDot, { backgroundColor: accentColor }]}
                  />
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3 },
  badge: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  filters: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowActionsRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: { fontSize: 13, fontWeight: "700" },
  ghostAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  primaryActionText: { fontSize: 12, fontWeight: "700" },
  listContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  itemCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  itemContent: { flex: 1, gap: 6 },
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  },
  itemTitle: { flex: 1, fontSize: 14 },
  itemTime: { fontSize: 11, fontWeight: "500" },
  itemPreview: { fontSize: 13, lineHeight: 19 },
  actorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  avatar: { width: 20, height: 20, borderRadius: 10 },
  avatarFallback: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 10, fontWeight: "700" },
  actorName: { fontSize: 12, flex: 1 },
  createdAtText: { fontSize: 11, fontWeight: "500", marginTop: 2, opacity: 0.9 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 8,
  },
  stateTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  stateText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
