import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/Supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  CheckCheck,
  MessageCircle,
  RefreshCw,
  Megaphone,
  ShieldAlert,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

type InboxKind =
  | "comment"
  | "reply"
  | "moderation"
  | "community_post"
  | "chat";
type InboxFilter = "all" | "unread";

type InboxItem = {
  id: string;
  kind: InboxKind;
  createdAt: string;
  title: string;
  preview: string;
  actorName: string;
  actorImage: string | null;
  path: string;
};

type UserRow = {
  id: string;
  name: string;
  image: string | null;
};

const READ_KEY_PREFIX = "pragatihub.inbox.read.v1";

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(value: string, max = 110) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function formatTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "just now";
  }
}

let notificationsModule: any | null | undefined;
function getNotificationsModule() {
  if (notificationsModule !== undefined) return notificationsModule;

  const isExpoGo =
    Constants.executionEnvironment === "storeClient" ||
    Constants.appOwnership === "expo";
  if (Platform.OS === "web" || isExpoGo) {
    notificationsModule = null;
    return notificationsModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require("expo-notifications");
  } catch {
    notificationsModule = null;
  }
  return notificationsModule;
}

async function fetchInboxItems(userId: string): Promise<InboxItem[]> {
  const membershipsResult = await supabase
    .from("user_groups")
    .select("group_id")
    .eq("user_id", userId)
    .limit(300);

  if (membershipsResult.error) throw membershipsResult.error;
  const memberGroupIds = (membershipsResult.data ?? []).map(
    (row) => row.group_id,
  );

  const ownPostsResult = await supabase
    .from("posts")
    .select("id, title")
    .eq("user_id", userId)
    .limit(300);

  if (ownPostsResult.error) throw ownPostsResult.error;
  const ownPosts = ownPostsResult.data ?? [];
  const ownPostIds = ownPosts.map((post) => post.id);
  const ownPostTitleMap = new Map(ownPosts.map((post) => [post.id, post.title]));

  const [commentsResult, reportsResult, communityPostsResult, chatResult] =
    await Promise.all([
      ownPostIds.length > 0
        ? supabase
            .from("comments")
            .select("id, comment, post_id, user_id, created_at, parent_id")
            .in("post_id", ownPostIds)
            .neq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("post_reports")
        .select(
          "id, post_id, status, reason, created_at, resolved_at, resolved_by",
        )
        .eq("reporter_id", userId)
        .neq("status", "pending")
        .order("resolved_at", { ascending: false })
        .limit(100),
      memberGroupIds.length > 0
        ? supabase
            .from("posts")
            .select("id, title, description, created_at, group_id, user_id")
            .in("group_id", memberGroupIds)
            .neq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      memberGroupIds.length > 0
        ? supabase
            .from("community_chat_messages")
            .select("id, content, created_at, group_id, user_id")
            .in("group_id", memberGroupIds)
            .neq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (commentsResult.error) throw commentsResult.error;
  if (reportsResult.error) throw reportsResult.error;
  if (communityPostsResult.error) throw communityPostsResult.error;
  if (chatResult.error) throw chatResult.error;

  const comments = commentsResult.data ?? [];
  const reports = reportsResult.data ?? [];
  const communityPosts = communityPostsResult.data ?? [];
  const chatMessages = chatResult.data ?? [];

  const actorIds = new Set<string>();
  const missingPostIds = new Set<string>();
  const communityGroupIds = new Set<string>();
  for (const comment of comments) {
    actorIds.add(comment.user_id);
    if (!ownPostTitleMap.has(comment.post_id)) {
      missingPostIds.add(comment.post_id);
    }
  }
  for (const report of reports) {
    if (report.resolved_by) actorIds.add(report.resolved_by);
    if (report.post_id) missingPostIds.add(report.post_id);
  }
  for (const post of communityPosts) {
    actorIds.add(post.user_id);
    communityGroupIds.add(post.group_id);
  }
  for (const chat of chatMessages) {
    actorIds.add(chat.user_id);
    communityGroupIds.add(chat.group_id);
  }

  const [actorsResult, postsResult, groupsResult] = await Promise.all([
    actorIds.size > 0
      ? supabase
          .from("users")
          .select("id, name, image")
          .in("id", Array.from(actorIds))
      : Promise.resolve({ data: [], error: null }),
    missingPostIds.size > 0
      ? supabase
          .from("posts")
          .select("id, title")
          .in("id", Array.from(missingPostIds))
      : Promise.resolve({ data: [], error: null }),
    communityGroupIds.size > 0
      ? supabase
          .from("groups")
          .select("id, name")
          .in("id", Array.from(communityGroupIds))
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (actorsResult.error) throw actorsResult.error;
  if (postsResult.error) throw postsResult.error;
  if (groupsResult.error) throw groupsResult.error;

  const actorMap = new Map(
    ((actorsResult.data ?? []) as UserRow[]).map((user) => [user.id, user]),
  );
  for (const post of postsResult.data ?? []) {
    ownPostTitleMap.set(post.id, post.title);
  }
  const groupNameMap = new Map(
    (groupsResult.data ?? []).map((group) => [group.id, group.name ?? "your community"]),
  );

  const commentItems: InboxItem[] = comments.map((comment) => {
    const actor = actorMap.get(comment.user_id);
    const postTitle = ownPostTitleMap.get(comment.post_id) ?? "your post";
    const body = truncate(normalizeText(comment.comment) || "New activity");
    const isReply = Boolean(comment.parent_id);

    return {
      id: `comment:${comment.id}`,
      kind: isReply ? "reply" : "comment",
      createdAt: comment.created_at,
      title: isReply
        ? `${actor?.name ?? "Someone"} replied on ${postTitle}`
        : `${actor?.name ?? "Someone"} commented on ${postTitle}`,
      preview: body,
      actorName: actor?.name ?? "Unknown user",
      actorImage: actor?.image ?? null,
      path: `/post/${comment.post_id}`,
    };
  });

  const reportItems: InboxItem[] = reports.map((report) => {
    const resolver = report.resolved_by ? actorMap.get(report.resolved_by) : null;
    const postTitle = ownPostTitleMap.get(report.post_id) ?? "a post";
    const status = normalizeText(report.status).toLowerCase();
    const title =
      status === "removed"
        ? `A reported post was removed`
        : `A report was reviewed`;
    const preview =
      status === "removed"
        ? `Moderators removed ${postTitle}.`
        : `Moderators dismissed your report on ${postTitle}.`;

    return {
      id: `report:${report.id}:${report.resolved_at ?? report.created_at}:${status}`,
      kind: "moderation",
      createdAt: report.resolved_at ?? report.created_at,
      title,
      preview,
      actorName: resolver?.name ?? "Moderator team",
      actorImage: resolver?.image ?? null,
      path: `/post/${report.post_id}`,
    };
  });

  const communityPostItems: InboxItem[] = communityPosts.map((post) => {
    const actor = actorMap.get(post.user_id);
    const groupName = groupNameMap.get(post.group_id) ?? "your community";
    const previewSource = normalizeText(post.description) || normalizeText(post.title) || "New post";
    return {
      id: `community-post:${post.id}`,
      kind: "community_post",
      createdAt: post.created_at,
      title: `${actor?.name ?? "Someone"} posted in ${groupName}`,
      preview: truncate(previewSource, 110),
      actorName: actor?.name ?? "Unknown user",
      actorImage: actor?.image ?? null,
      path: `/post/${post.id}`,
    };
  });

  const chatItems: InboxItem[] = chatMessages.map((chat) => {
    const actor = actorMap.get(chat.user_id);
    const groupName = groupNameMap.get(chat.group_id) ?? "your community";
    const preview = truncate(normalizeText(chat.content) || "Sent a message", 110);
    return {
      id: `chat:${chat.id}`,
      kind: "chat",
      createdAt: chat.created_at,
      title: `${actor?.name ?? "Someone"} messaged in ${groupName}`,
      preview,
      actorName: actor?.name ?? "Unknown user",
      actorImage: actor?.image ?? null,
      path: `/community/${chat.group_id}/chat`,
    };
  });

  return [...commentItems, ...reportItems, ...communityPostItems, ...chatItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [errorText, setErrorText] = useState<string | null>(null);

  const knownIdsRef = useRef<Set<string>>(new Set());
  const seededRealtimeRef = useRef(false);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadInbox = useCallback(
    async (mode: "initial" | "refresh" | "silent") => {
      if (!userId) return;
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        setErrorText(null);
        const nextItems = await fetchInboxItems(userId);
        setItems(nextItems);
      } catch (error: any) {
        setErrorText(error?.message ?? "Failed to load inbox");
      } finally {
        if (mode === "initial") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [userId],
  );

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
    void loadInbox("initial");
  }, [loadInbox, userId]);

  useEffect(() => {
    if (!userId) return;

    const queueRefresh = () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }
      refreshDebounceRef.current = setTimeout(() => {
        void loadInbox("silent");
      }, 900);
    };

    const postFilter =
      userId && typeof userId === "string"
        ? { filter: `user_id=neq.${userId}` }
        : {};

    const channel = supabase
      .channel(`inbox-${userId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        queueRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_reports" },
        queueRefresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", ...postFilter },
        queueRefresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_chat_messages" },
        queueRefresh,
      )
      .subscribe();

    return () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [loadInbox, userId]);

  useEffect(() => {
    const Notifications = getNotificationsModule();
    if (!Notifications || Platform.OS === "web") return;

    if (!seededRealtimeRef.current) {
      knownIdsRef.current = new Set(items.map((item) => item.id));
      seededRealtimeRef.current = true;
      return;
    }

    const newUnreadItems = items.filter(
      (item) => !knownIdsRef.current.has(item.id) && !readSet.has(item.id),
    );

    for (const item of items) {
      knownIdsRef.current.add(item.id);
    }

    if (newUnreadItems.length === 0) return;

    void (async () => {
      for (const item of newUnreadItems.slice(0, 3)) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: item.title,
              body: item.preview,
              data: { path: item.path, itemId: item.id },
              ...(Platform.OS === "android" ? { channelId: "inbox-updates" } : {}),
            },
            trigger: null,
          });
        } catch {
          // no-op: fallback is in-app inbox list
        }
      }
    })();
  }, [items, readSet]);

  const onRefresh = useCallback(() => {
    void loadInbox("refresh");
  }, [loadInbox]);

  const renderIcon = (kind: InboxKind, isUnread: boolean) => {
    const color = isUnread ? accentColor : secondaryTextColor;
    if (kind === "chat") return <MessageCircle size={18} color={color} />;
    if (kind === "community_post") return <Megaphone size={18} color={color} />;
    if (kind === "moderation") return <ShieldAlert size={18} color={color} />;
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
                    <Text style={[styles.itemTime, { color: secondaryTextColor }]}>
                      {formatTime(item.createdAt)}
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
