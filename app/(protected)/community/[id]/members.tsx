import AppLoader from "@/components/AppLoader";
import { useCommunityPresence } from "@/hooks/use-community-presence";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroupById, type Group } from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import type { Tables } from "@/types/database.types";
import { Image } from "expo-image";
import { useGlobalSearchParams } from "expo-router";
import { Crown, Search, Shield, Users } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type MemberUser = {
  id: string;
  name: string;
  image: string | null;
  joined_at: string | null;
};

type GroupModeratorRow = Tables<"group_moderators">;
type MemberFilter = "all" | "online" | "moderators";

export default function CommunityMembersTab() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const communityId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();

  const [community, setCommunity] = useState<Group | null>(null);
  const [members, setMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("all");

  const [memberUsers, setMemberUsers] = useState<MemberUser[]>([]);
  const [moderatorIds, setModeratorIds] = useState<Set<string>>(new Set());
  const [membersLoading, setMembersLoading] = useState(false);

  const membersRequestIdRef = useRef(0);
  const membersLoadedRef = useRef(false);

  const bg = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const tint = useThemeColor({}, "tint");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const success = useThemeColor({}, "success");
  const warning = useThemeColor({}, "warning");
  const info = useThemeColor({}, "info");
  const input = useThemeColor({}, "input");
  const backgroundSecondary = useThemeColor({}, "backgroundSecondary");
  const { onlineUserIds } = useCommunityPresence(communityId);

  const loadCommunityMeta = useCallback(
    async (showLoader = false) => {
      if (!communityId) return;
      if (showLoader) setLoading(true);

      const [{ data }, membersRes] = await Promise.all([
        fetchGroupById(communityId),
        supabase
          .from("user_groups")
          .select("group_id, user_id", { count: "exact", head: true })
          .eq("group_id", communityId),
      ]);

      setCommunity(data ?? null);
      if (membersRes.count !== null) setMembers(membersRes.count);
      if (showLoader) setLoading(false);
    },
    [communityId],
  );

  useEffect(() => {
    if (!communityId) return;
    void loadCommunityMeta(true);
  }, [communityId, loadCommunityMeta]);

  const fetchMembers = useCallback(async () => {
    if (!communityId || membersLoadedRef.current) return;
    const requestId = ++membersRequestIdRef.current;
    setMembersLoading(true);

    try {
      const [{ data, error }, moderatorsRes] = await Promise.all([
        supabase
          .from("user_groups")
          .select(`joined_at, user:users(id, name, image)`)
          .eq("group_id", communityId)
          .order("joined_at", { ascending: false }),
        supabase
          .from("group_moderators")
          .select("user_id, is_active")
          .eq("group_id", communityId)
          .eq("is_active", true),
      ]);

      if (requestId !== membersRequestIdRef.current) return;
      if (!error && data) {
        const mapped = (data as any[])
          .map((row) =>
            row.user
              ? {
                  id: row.user.id as string,
                  name: row.user.name as string,
                  image: (row.user.image as string) ?? null,
                  joined_at: (row.joined_at as string) ?? null,
                }
              : null,
          )
          .filter(Boolean) as MemberUser[];

        const nextModeratorIds = new Set<string>();
        if (!moderatorsRes.error && moderatorsRes.data) {
          for (const row of moderatorsRes.data as GroupModeratorRow[]) {
            nextModeratorIds.add(row.user_id);
          }
        }

        setModeratorIds(nextModeratorIds);
        setMemberUsers(mapped);
        membersLoadedRef.current = true;
      }
    } finally {
      if (requestId === membersRequestIdRef.current) {
        setMembersLoading(false);
      }
    }
  }, [communityId]);

  useEffect(() => {
    if (!communityId) return;
    membersRequestIdRef.current += 1;
    membersLoadedRef.current = false;
    setMemberUsers([]);
    setModeratorIds(new Set());
    setMembersLoading(false);
    void fetchMembers();
  }, [communityId, fetchMembers]);

  const handleRefresh = useCallback(async () => {
    if (!communityId) return;
    setRefreshing(true);
    try {
      membersLoadedRef.current = false;
      await Promise.all([loadCommunityMeta(false), fetchMembers()]);
    } finally {
      setRefreshing(false);
    }
  }, [communityId, fetchMembers, loadCommunityMeta]);

  const formatJoinedDate = useCallback((value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return `Joined ${value.slice(0, 10)}`;
    return `Joined ${date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  }, []);

  if (loading || !community) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <AppLoader fullScreen />
      </View>
    );
  }

  const filtered = search.trim()
    ? memberUsers.filter((m) =>
        m.name.toLowerCase().includes(search.toLowerCase()),
      )
    : memberUsers;
  const filteredMembers = filtered.filter((member) => {
    const isOwner = !!community.owner_id && member.id === community.owner_id;
    const isMod = isOwner || moderatorIds.has(member.id);
    const isActive = onlineUserIds.has(member.id);
    if (memberFilter === "online") return isActive;
    if (memberFilter === "moderators") return isMod;
    return true;
  });
  const onlineCount = onlineUserIds.size;
  const moderatorsCount =
    moderatorIds.size +
    (community.owner_id && !moderatorIds.has(community.owner_id) ? 1 : 0);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FlatList
        style={styles.list}
        removeClippedSubviews
        windowSize={7}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={32}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + 90,
          flexGrow: 1,
        }}
        data={filteredMembers}
        keyExtractor={(i) => i.id}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => {
          void handleRefresh();
        }}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            <View
              style={[
                styles.heroCard,
                { backgroundColor: card, borderColor: border },
              ]}
            >
              <View>
                <Text style={[styles.headerTitle, { color: text }]}>
                  Members
                </Text>
                <Text style={[styles.headerSubtitle, { color: secondary }]}>
                  Community directory and live presence
                </Text>
              </View>

              <View style={styles.countGrid}>
                <View
                  style={[
                    styles.countPill,
                    { backgroundColor: backgroundSecondary, borderColor: border },
                  ]}
                >
                  <Users size={13} color={primary} />
                  <Text style={[styles.countPillValue, { color: text }]}>
                    {members}
                  </Text>
                  <Text style={[styles.countPillLabel, { color: secondary }]}>
                    Total
                  </Text>
                </View>

                <View
                  style={[
                    styles.countPill,
                    { backgroundColor: `${success}14`, borderColor: `${success}35` },
                  ]}
                >
                  <View style={[styles.liveDot, { backgroundColor: success }]} />
                  <Text style={[styles.countPillValue, { color: text }]}>
                    {onlineCount}
                  </Text>
                  <Text style={[styles.countPillLabel, { color: secondary }]}>
                    Online
                  </Text>
                </View>

                <View
                  style={[
                    styles.countPill,
                    { backgroundColor: `${info}14`, borderColor: `${info}35` },
                  ]}
                >
                  <Shield size={13} color={info} />
                  <Text style={[styles.countPillValue, { color: text }]}>
                    {moderatorsCount}
                  </Text>
                  <Text style={[styles.countPillLabel, { color: secondary }]}>
                    Mods
                  </Text>
                </View>
              </View>
            </View>

            {/* Search bar */}
            <View
              style={[
                styles.searchBar,
                { backgroundColor: input, borderColor: border },
              ]}
            >
              <Search size={16} color={secondary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search members…"
                placeholderTextColor={secondary}
                style={[styles.searchInput, { color: text }]}
                clearButtonMode="while-editing"
              />
            </View>

            <View style={styles.filterRow}>
              {[
                { key: "all" as const, label: "All", count: members },
                { key: "online" as const, label: "Online", count: onlineCount },
                { key: "moderators" as const, label: "Moderators", count: moderatorsCount },
              ].map((item) => {
                const active = item.key === memberFilter;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setMemberFilter(item.key)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: active ? `${primary}18` : backgroundSecondary,
                        borderColor: active ? `${primary}44` : border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipLabel,
                        { color: active ? primary : secondary },
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.filterChipCount,
                        { color: active ? primary : textMuted },
                      ]}
                    >
                      {item.count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const member = item as MemberUser;
          const isOwner =
            !!community.owner_id && member.id === community.owner_id;
          const isMod = isOwner || moderatorIds.has(member.id);
          const isActive = onlineUserIds.has(member.id);
          const roleLabel = isOwner ? "Owner" : isMod ? "Moderator" : "Member";
          const roleColor = isOwner ? warning : isMod ? info : primary;
          const initials = (member.name || "U")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join("");

          return (
            <View
              style={[
                styles.memberCard,
                { backgroundColor: card, borderColor: border },
              ]}
            >
              <View
                style={[
                  styles.memberAccent,
                  { backgroundColor: isActive ? success : `${border}` },
                ]}
              />

              {/* Avatar */}
              <View style={styles.avatarWrapper}>
                {member.image ? (
                  <Image
                    source={{ uri: member.image }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarFallback,
                      { backgroundColor: `${primary}22` },
                    ]}
                  >
                    <Text style={[styles.avatarInitials, { color: primary }]}>
                      {initials}
                    </Text>
                  </View>
                )}

                {/* Online dot */}
                {isActive && (
                  <View
                    style={[
                      styles.activeDot,
                      { backgroundColor: bg, borderColor: bg },
                    ]}
                  >
                    <View
                      style={[styles.activeDotInner, { backgroundColor: success }]}
                    />
                  </View>
                )}
              </View>

              {/* Info */}
              <View style={styles.memberInfo}>
                <Text
                  style={[styles.memberName, { color: text }]}
                  numberOfLines={1}
                >
                  {member.name}
                </Text>
                {member.joined_at && (
                  <Text
                    style={[styles.memberMeta, { color: secondary }]}
                    numberOfLines={1}
                  >
                    {formatJoinedDate(member.joined_at)}
                  </Text>
                )}
                <Text
                  style={[
                    styles.memberLiveMeta,
                    { color: isActive ? success : textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {isActive ? "Live now" : "Offline"}
                </Text>
              </View>

              <View style={styles.badgesCol}>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: `${roleColor}15`,
                      borderColor: `${roleColor}40`,
                    },
                  ]}
                >
                  {isOwner ? (
                    <Crown size={11} color={roleColor} />
                  ) : isMod ? (
                    <Shield size={11} color={roleColor} />
                  ) : (
                    <Users size={11} color={roleColor} />
                  )}
                  <Text
                    style={[
                      styles.badgeLabel,
                      { color: roleColor },
                    ]}
                  >
                    {roleLabel}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: isActive ? `${success}16` : backgroundSecondary,
                      borderColor: isActive ? `${success}45` : border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusBadgeDot,
                      { backgroundColor: isActive ? success : textMuted },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusBadgeLabel,
                      { color: isActive ? success : secondary },
                    ]}
                  >
                    {isActive ? "Online" : "Away"}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          membersLoading ? (
            <View style={styles.emptyCenter}>
              <ActivityIndicator size="large" color={tint} />
              <Text style={[styles.emptyText, { color: secondary }]}>
                Loading members…
              </Text>
            </View>
          ) : (
            <View style={styles.emptyCenter}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: backgroundSecondary },
                ]}
              >
                <Users size={32} color={secondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: text }]}>
                {search ? "No results" : "No members yet"}
              </Text>
              <Text style={[styles.emptyText, { color: secondary }]}>
                {search
                  ? `Nobody matched "${search}"`
                  : memberFilter === "online"
                    ? "No members are online right now."
                    : memberFilter === "moderators"
                      ? "No moderators found in this community."
                      : "When people join, they'll appear here."}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { flex: 1 },

  headerArea: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13.5,
    marginTop: 3,
  },
  countGrid: {
    flexDirection: "row",
    gap: 8,
  },
  countPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    justifyContent: "center",
  },
  countPillValue: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  countPillLabel: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 18,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipLabel: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  filterChipCount: {
    fontSize: 12,
    fontWeight: "700",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },

  memberCard: {
    marginHorizontal: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  memberAccent: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 99,
    marginRight: -2,
  },

  avatarWrapper: { position: "relative" },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: "700",
  },
  activeDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  activeDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 15, fontWeight: "700" },
  memberMeta: { fontSize: 12.5, marginTop: 2 },
  memberLiveMeta: { fontSize: 11.5, marginTop: 3, fontWeight: "700" },

  badgesCol: {
    alignItems: "flex-end",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 6,
  },
  badgeLabel: { fontSize: 10.5, fontWeight: "700" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeLabel: {
    fontSize: 10.5,
    fontWeight: "700",
  },

  emptyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
