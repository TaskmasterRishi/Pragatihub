import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroups, type Group } from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import { useUser } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Compass, Search, Sparkles, Users } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";

type VisibilityFilter = "all" | "joined" | "popular";
type SortMode = "relevance" | "recent";
type TopTab = "All" | "Joined" | "Popular";
type BottomTab = "Relevant" | "Newest";

type GroupTabsProps = {
  topTab?: TopTab;
  bottomTab?: BottomTab;
  onChangeTopTab?: (tab: TopTab) => void;
  onChangeBottomTab?: (tab: BottomTab) => void;
};

type CommunityCardProps = {
  item: Group;
  isJoined: boolean;
  isNew: boolean;
  memberCount: number;
  cardColor: string;
  textColor: string;
  textSecondaryColor: string;
  borderColor: string;
  avatarColor: string;
  shadowColor: string;
  successColor: string;
  infoColor: string;
  onPress: () => void;
};

const RECENT_WINDOW_DAYS = 14;
const TOP_TABS: TopTab[] = ["All", "Joined", "Popular"];
const BOTTOM_TABS: BottomTab[] = ["Relevant", "Newest"];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseCreatedAt = (value: string | null) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const isRecentlyCreated = (group: Group) => {
  const createdAt = parseCreatedAt(group.created_at);
  if (!createdAt) return false;
  const ageMs = Date.now() - createdAt;
  return ageMs <= RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
};

const getSearchScore = (group: Group, query: string, tokens: string[]) => {
  if (!query) return 0;

  const name = normalizeText(group.name);
  const id = normalizeText(group.id);

  let score = 0;

  if (name === query) score += 120;
  if (name.startsWith(query)) score += 60;
  if (name.includes(query)) score += 30;
  if (id.startsWith(query)) score += 24;
  if (id.includes(query)) score += 12;

  for (const token of tokens) {
    if (name.startsWith(token)) score += 10;
    if (name.includes(token)) score += 6;
    if (id.includes(token)) score += 4;
  }

  return score;
};

const toRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  if (!/^[A-Fa-f0-9]{6}$/.test(normalized)) return hex;

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function GroupTabs({
  topTab = "All",
  bottomTab = "Relevant",
  onChangeTopTab,
  onChangeBottomTab,
}: GroupTabsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const border = useThemeColor({}, "border");
  const input = useThemeColor({}, "input");
  const text = useThemeColor({}, "text");
  const tint = useThemeColor({}, "tint");
  const [selectedTop, setSelectedTop] = useState<TopTab>(topTab);
  const [selectedBottom, setSelectedBottom] = useState<BottomTab>(bottomTab);

  const containerColor = toRgba(input, isDark ? 0.5 : 0.78);
  const containerBorderColor = toRgba(border, isDark ? 0.62 : 0.45);
  const tabBaseColor = toRgba(text, isDark ? 0.09 : 0.04);
  const tabBorderColor = toRgba(border, isDark ? 0.46 : 0.28);
  const tabSelectedColor = toRgba(tint, isDark ? 0.28 : 0.16);
  const tabSelectedBorderColor = toRgba(tint, isDark ? 0.58 : 0.34);

  useEffect(() => {
    setSelectedTop(topTab);
  }, [topTab]);

  useEffect(() => {
    setSelectedBottom(bottomTab);
  }, [bottomTab]);

  const handleTopTab = (tab: TopTab) => {
    setSelectedTop(tab);
    onChangeTopTab?.(tab);
  };

  const handleBottomTab = (tab: BottomTab) => {
    setSelectedBottom(tab);
    onChangeBottomTab?.(tab);
  };

  return (
    <View
      style={[
        styles.groupTabsContainer,
        {
          backgroundColor: containerColor,
          borderColor: containerBorderColor,
        },
      ]}
    >
      <View style={styles.groupTabsTopRow}>
        {TOP_TABS.map((tab) => {
          const selected = selectedTop === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => handleTopTab(tab)}
              style={[
                styles.groupTabButton,
                { backgroundColor: tabBaseColor, borderColor: tabBorderColor },
                selected && {
                  backgroundColor: tabSelectedColor,
                  borderColor: tabSelectedBorderColor,
                },
              ]}
            >
              <Text
                style={[styles.groupTabText, { color: selected ? tint : text }]}
              >
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.groupTabsBottomRow}>
        {BOTTOM_TABS.map((tab) => {
          const selected = selectedBottom === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => handleBottomTab(tab)}
              style={[
                styles.groupTabButton,
                { backgroundColor: tabBaseColor, borderColor: tabBorderColor },
                selected && {
                  backgroundColor: tabSelectedColor,
                  borderColor: tabSelectedBorderColor,
                },
              ]}
            >
              <Text
                style={[styles.groupTabText, { color: selected ? tint : text }]}
              >
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CommunityCard({
  item,
  isJoined,
  isNew,
  memberCount,
  cardColor,
  textColor,
  textSecondaryColor,
  borderColor,
  avatarColor,
  shadowColor,
  successColor,
  infoColor,
  onPress,
}: CommunityCardProps) {
  const accentColor = isJoined ? successColor : infoColor;
  const statusBadgeColor = toRgba(accentColor, 0.16);
  const statusBadgeBorderColor = toRgba(accentColor, 0.45);
  const newBadgeBorder = toRgba(infoColor, 0.48);
  const newBadgeBg = toRgba(infoColor, 0.16);
  const memberLabel = `${memberCount.toLocaleString()} member${memberCount === 1 ? "" : "s"}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: cardColor,
          borderColor,
          shadowColor,
          transform: [{ scale: pressed ? 0.99 : 1 }],
          opacity: pressed ? 0.94 : 1,
        },
      ]}
    >
      <View style={styles.cardInner}>
        <View
          style={[
            styles.avatarWrap,
            { backgroundColor: avatarColor, borderColor },
          ]}
        >
          <Image
            source={{ uri: item.image ?? undefined }}
            style={styles.avatar}
          />
        </View>

        <View style={styles.cardText}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
              {item.name}
            </Text>
            {isNew ? (
              <View
                style={[
                  styles.newBadge,
                  { backgroundColor: newBadgeBg, borderColor: newBadgeBorder },
                ]}
              >
                <Sparkles size={11} color={infoColor} />
                <Text style={[styles.newBadgeText, { color: infoColor }]}>
                  New
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[styles.meta, { color: textSecondaryColor }]}
            numberOfLines={1}
          >
            {memberLabel}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: statusBadgeColor,
              borderColor: statusBadgeBorderColor,
            },
          ]}
        >
          <Text style={[styles.statusBadgeText, { color: accentColor }]}>
            {isJoined ? "Joined" : "Join"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function CommunitiesScreen() {
  const router = useRouter();
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [searchQuery, setSearchQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>([]);
  const [memberCountByGroup, setMemberCountByGroup] = useState<
    Record<string, number>
  >({});
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const textSecondaryColor = useThemeColor({}, "textSecondary");
  const borderColor = useThemeColor({}, "border");
  const inputBg = useThemeColor({}, "input");
  const placeholderColor = useThemeColor({}, "placeholder");
  const successColor = useThemeColor({}, "success");
  const infoColor = useThemeColor({}, "info");
  const shadowColor = isDark ? "#000000" : "#0f172a";

  const surfaceColor = toRgba(cardColor, isDark ? 0.62 : 0.88);
  const raisedSurfaceColor = toRgba(cardColor, isDark ? 0.72 : 0.93);
  const searchSurfaceColor = toRgba(inputBg, isDark ? 0.58 : 0.8);
  const softBorderColor = toRgba(borderColor, isDark ? 0.6 : 0.44);
  const subtleBorderColor = toRgba(borderColor, isDark ? 0.4 : 0.3);
  const avatarTintColor = toRgba(inputBg, isDark ? 0.76 : 0.88);

  const joinedSet = useMemo(() => new Set(joinedGroupIds), [joinedGroupIds]);

  const loadCommunities = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") {
        setIsLoading(true);
      } else {
        setRefreshing(true);
      }

      setLoadError(null);

      const [groupsResult, userGroupsResult, membershipsResult] =
        await Promise.all([
          fetchGroups(),
          user?.id
            ? supabase
                .from("user_groups")
                .select("group_id")
                .eq("user_id", user.id)
            : Promise.resolve({ data: [], error: null }),
          supabase.from("user_groups").select("group_id"),
        ]);

      if (groupsResult.error) {
        setGroups([]);
        setLoadError(
          groupsResult.error.message ?? "Failed to load communities",
        );
      } else {
        setGroups(groupsResult.data ?? []);
      }

      if (userGroupsResult.error) {
        setJoinedGroupIds([]);
        setLoadError(
          (previous) =>
            previous ??
            userGroupsResult.error?.message ??
            "Failed to load community visibility",
        );
      } else {
        const ids = (userGroupsResult.data ?? []).map(
          (entry) => entry.group_id,
        );
        setJoinedGroupIds(ids);
      }

      if (membershipsResult.error) {
        setMemberCountByGroup({});
      } else {
        const memberCounts = (membershipsResult.data ?? []).reduce<
          Record<string, number>
        >((accumulator, entry) => {
          if (!entry.group_id) return accumulator;

          accumulator[entry.group_id] = (accumulator[entry.group_id] ?? 0) + 1;
          return accumulator;
        }, {});

        setMemberCountByGroup(memberCounts);
      }

      if (mode === "initial") {
        setIsLoading(false);
      } else {
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    void loadCommunities("initial");
  }, [loadCommunities]);

  const handleRefresh = () => {
    void loadCommunities("refresh");
  };

  const searchTokens = useMemo(() => {
    const normalized = normalizeText(searchQuery);
    return normalized ? normalized.split(" ").filter(Boolean) : [];
  }, [searchQuery]);

  const normalizedQuery = useMemo(
    () => normalizeText(searchQuery),
    [searchQuery],
  );

  const visibleGroups = useMemo(() => {
    let scopedGroups = groups;

    if (visibilityFilter === "joined") {
      scopedGroups = scopedGroups.filter((group) => joinedSet.has(group.id));
    }

    if (visibilityFilter === "popular") {
      scopedGroups = scopedGroups.filter((group) => !joinedSet.has(group.id));
    }

    const hasQuery = normalizedQuery.length > 0;

    if (hasQuery) {
      return scopedGroups
        .map((group) => ({
          group,
          score: getSearchScore(group, normalizedQuery, searchTokens),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const dateDiff =
            parseCreatedAt(b.group.created_at) -
            parseCreatedAt(a.group.created_at);
          if (dateDiff !== 0) return dateDiff;
          return a.group.name.localeCompare(b.group.name);
        })
        .map((entry) => entry.group);
    }

    if (sortMode === "recent") {
      return [...scopedGroups].sort((a, b) => {
        const dateDiff =
          parseCreatedAt(b.created_at) - parseCreatedAt(a.created_at);
        if (dateDiff !== 0) return dateDiff;
        return a.name.localeCompare(b.name);
      });
    }

    if (sortMode === "relevance") {
      return [...scopedGroups].sort((a, b) => {
        const joinedDiff =
          Number(joinedSet.has(b.id)) - Number(joinedSet.has(a.id));
        if (joinedDiff !== 0) return joinedDiff;
        const recentDiff =
          Number(isRecentlyCreated(b)) - Number(isRecentlyCreated(a));
        if (recentDiff !== 0) return recentDiff;
        return a.name.localeCompare(b.name);
      });
    }

    return scopedGroups;
  }, [
    groups,
    joinedSet,
    normalizedQuery,
    searchTokens,
    sortMode,
    visibilityFilter,
  ]);

  const popularGroups = useMemo(() => {
    return groups
      .filter((group) => !joinedSet.has(group.id))
      .sort((a, b) => {
        const dateDiff =
          parseCreatedAt(b.created_at) - parseCreatedAt(a.created_at);
        if (dateDiff !== 0) return dateDiff;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [groups, joinedSet]);

  const showPopularRail =
    !normalizedQuery &&
    visibilityFilter !== "joined" &&
    popularGroups.length > 0;

  const visibleCountLabel = `${visibleGroups.length} visible of ${groups.length}`;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <View
          style={[
            styles.headerCard,
            { backgroundColor: surfaceColor, borderColor: softBorderColor },
          ]}
        >
          <Text style={[styles.title, { color: textColor }]}>Communities</Text>
          <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
            {visibleCountLabel}
          </Text>

          <View
            style={[
              styles.searchWrapper,
              {
                backgroundColor: searchSurfaceColor,
                borderColor: subtleBorderColor,
              },
            ]}
          >
            <Search
              size={20}
              color={placeholderColor}
              style={styles.searchIcon}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name or community id"
              placeholderTextColor={placeholderColor}
              style={[styles.searchInput, { color: textColor }]}
              returnKeyType="search"
            />
          </View>
        </View>

        <View style={styles.filtersBlock}>
          <GroupTabs
            topTab={
              visibilityFilter === "joined"
                ? "Joined"
                : visibilityFilter === "popular"
                  ? "Popular"
                  : "All"
            }
            bottomTab={sortMode === "recent" ? "Newest" : "Relevant"}
            onChangeTopTab={(tab) => {
              if (tab === "Joined") {
                setVisibilityFilter("joined");
                return;
              }
              if (tab === "Popular") {
                setVisibilityFilter("popular");
                return;
              }
              setVisibilityFilter("all");
            }}
            onChangeBottomTab={(tab) => {
              if (tab === "Newest") {
                setSortMode("recent");
                return;
              }
              setSortMode("relevance");
            }}
          />
        </View>
      </View>

      <FlatList
        data={visibleGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CommunityCard
            item={item}
            isJoined={joinedSet.has(item.id)}
            isNew={isRecentlyCreated(item)}
            memberCount={memberCountByGroup[item.id] ?? 0}
            cardColor={raisedSurfaceColor}
            textColor={textColor}
            textSecondaryColor={textSecondaryColor}
            borderColor={softBorderColor}
            avatarColor={avatarTintColor}
            shadowColor={shadowColor}
            successColor={successColor}
            infoColor={infoColor}
            onPress={() => router.push(`/community/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          showPopularRail ? (
            <View
              style={[
                styles.discoverySection,
                { backgroundColor: surfaceColor, borderColor: softBorderColor },
              ]}
            >
              <View style={styles.discoveryHeader}>
                <Compass size={17} color={textSecondaryColor} />
                <Text style={[styles.discoveryTitle, { color: textColor }]}>
                  Popular
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.discoveryRail}
              >
                {popularGroups.map((group, index) => {
                  const memberCount = memberCountByGroup[group.id] ?? 0;

                  return (
                    <Pressable
                      key={group.id}
                      onPress={() => router.push(`/community/${group.id}`)}
                      style={({ pressed }) => [
                        styles.discoveryCard,
                        {
                          backgroundColor: raisedSurfaceColor,
                          borderColor: softBorderColor,
                          shadowColor,
                          marginLeft: index === 0 ? 0 : 10,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                          opacity: pressed ? 0.94 : 1,
                        },
                      ]}
                    >
                      <View style={styles.discoveryCardContent}>
                        <Image
                          source={{ uri: group.image ?? undefined }}
                          style={styles.discoveryAvatar}
                        />
                        <Text
                          style={[styles.discoveryName, { color: textColor }]}
                          numberOfLines={1}
                        >
                          {group.name}
                        </Text>
                        <Text
                          style={[
                            styles.discoveryMeta,
                            { color: textSecondaryColor },
                          ]}
                          numberOfLines={1}
                        >
                          {memberCount.toLocaleString()}{" "}
                          {memberCount === 1 ? "member" : "members"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: surfaceColor, borderColor: softBorderColor },
              ]}
            >
              {loadError ? (
                <Users size={48} color={textSecondaryColor} />
              ) : normalizedQuery ? (
                <Search size={48} color={textSecondaryColor} />
              ) : (
                <Compass size={48} color={textSecondaryColor} />
              )}
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                {isLoading
                  ? "Loading communities..."
                  : loadError
                    ? loadError
                    : normalizedQuery
                      ? "No communities match this search"
                      : visibilityFilter === "joined"
                        ? "You have not joined any communities yet"
                        : "No communities yet"}
              </Text>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  filtersBlock: {
    marginTop: 12,
  },
  groupTabsContainer: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  groupTabsTopRow: {
    flexDirection: "row",
    gap: 8,
  },
  groupTabsBottomRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  groupTabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  groupTabText: {
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 120,
  },
  discoverySection: {
    marginBottom: 20,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  discoveryRail: {
    alignItems: "center",
    paddingRight: 6,
  },
  discoveryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 6,
  },
  discoveryTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  discoveryCard: {
    width: 150,
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    justifyContent: "center",
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  discoveryCardContent: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    gap: 10,
  },
  discoveryAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e5e7eb",
  },
  discoveryName: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
  },
  discoveryMeta: {
    marginTop: 4,
    fontSize: 11,
    textAlign: "center",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e5e7eb",
  },
  cardText: {
    flex: 1,
    justifyContent: "center",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  meta: {
    fontSize: 12,
    marginTop: 4,
  },
  newBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 44,
    paddingHorizontal: 12,
  },
  emptyCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 18,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: "center",
  },
});
