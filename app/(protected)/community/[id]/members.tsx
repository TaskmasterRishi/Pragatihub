import AppLoader from "@/components/AppLoader";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroupById, type Group } from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import type { Tables } from "@/types/database.types";
import { Image } from "expo-image";
import { useGlobalSearchParams } from "expo-router";
import { Shield, Users } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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

export default function CommunityMembersTab() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const communityId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();

  const [community, setCommunity] = useState<Group | null>(null);
  const [members, setMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [memberUsers, setMemberUsers] = useState<MemberUser[]>([]);
  const [moderatorIds, setModeratorIds] = useState<Set<string>>(new Set());
  const [membersLoading, setMembersLoading] = useState(false);

  const membersRequestIdRef = useRef(0);
  const membersLoadedRef = useRef(false);

  const bg = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const tint = useThemeColor({}, "tint");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const backgroundSecondary = useThemeColor({}, "backgroundSecondary");
  const input = useThemeColor({}, "input");

  useEffect(() => {
    if (!communityId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [{ data }, membersRes] = await Promise.all([
        fetchGroupById(communityId),
        supabase
          .from("user_groups")
          .select("group_id, user_id", { count: "exact", head: true })
          .eq("group_id", communityId),
      ]);

      if (cancelled) return;
      setCommunity(data ?? null);
      if (membersRes.count !== null) setMembers(membersRes.count);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [communityId]);

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

  const filtered = search.trim()
    ? memberUsers.filter((m) =>
        m.name.toLowerCase().includes(search.toLowerCase()),
      )
    : memberUsers;

  if (loading || !community) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <AppLoader fullScreen />
      </View>
    );
  }

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
        data={filtered}
        keyExtractor={(i) => i.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            {/* Title row */}
            <View style={styles.titleRow}>
              <View>
                <Text style={[styles.headerTitle, { color: text }]}>
                  Members
                </Text>
                <View style={styles.countRow}>
                  <Users size={14} color={secondary} />
                  <Text style={[styles.countLabel, { color: secondary }]}>
                    {members} {members === 1 ? "member" : "members"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Search bar */}
            <View
              style={[
                styles.searchBar,
                { backgroundColor: backgroundSecondary, borderColor: border },
              ]}
            >
              <Users size={16} color={secondary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search members…"
                placeholderTextColor={secondary}
                style={[styles.searchInput, { color: text }]}
                clearButtonMode="while-editing"
              />
            </View>

            {/* Section label */}
            {!search && moderatorIds.size > 0 && (
              <Text style={[styles.sectionLabel, { color: secondary }]}>
                All Members
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const member = item as MemberUser;
          const isOwner =
            !!community.owner_id && member.id === community.owner_id;
          const isMod = isOwner || moderatorIds.has(member.id);
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

                {/* Online dot — decorative */}
                {isMod && (
                  <View
                    style={[
                      styles.modDot,
                      { backgroundColor: bg, borderColor: bg },
                    ]}
                  >
                    <View
                      style={[styles.modDotInner, { backgroundColor: primary }]}
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
              </View>

              {/* Badge */}
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isMod
                      ? `${primary}18`
                      : backgroundSecondary,
                    borderColor: isMod ? `${primary}44` : border,
                  },
                ]}
              >
                {isMod && <Shield size={11} color={primary} />}
                <Text
                  style={[
                    styles.badgeLabel,
                    { color: isMod ? primary : secondary },
                  ]}
                >
                  {isOwner ? "Owner" : isMod ? "Mod" : "Member"}
                </Text>
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
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  countLabel: {
    fontSize: 14,
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
  searchInput: {
    flex: 1,
    fontSize: 15,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 2,
  },

  memberCard: {
    marginHorizontal: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
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
  modDot: {
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
  modDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 15, fontWeight: "700" },
  memberMeta: { fontSize: 12.5, marginTop: 2 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeLabel: { fontSize: 11, fontWeight: "600" },

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
