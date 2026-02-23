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
  cardColor: string;
  textColor: string;
  textSecondaryColor: string;
  borderColor: string;
  successColor: string;
  infoColor: string;
  successTextColor: string;
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

function GroupTabs({
  topTab = "All",
  bottomTab = "Relevant",
  onChangeTopTab,
  onChangeBottomTab,
}: GroupTabsProps) {
  const background = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const tint = useThemeColor({}, "tint");
  const [selectedTop, setSelectedTop] = useState<TopTab>(topTab);
  const [selectedBottom, setSelectedBottom] = useState<BottomTab>(bottomTab);

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
    <View style={[styles.groupTabsContainer, { backgroundColor: background }]}>
      <View style={styles.groupTabsTopRow}>
        {TOP_TABS.map((tab) => {
          const selected = selectedTop === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => handleTopTab(tab)}
              style={[
                styles.groupTabButton,
                selected && { backgroundColor: `${tint}20` },
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
                selected && { backgroundColor: `${tint}20` },
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
  cardColor,
  textColor,
  textSecondaryColor,
  borderColor,
  successColor,
  infoColor,
  successTextColor,
  onPress,
}: CommunityCardProps) {
  const badgeColor = isJoined ? successColor : infoColor;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: cardColor,
          borderColor,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.cardInner}>
        <Image
          source={{ uri: item.image ?? undefined }}
          style={styles.avatar}
        />

        <View style={styles.cardText}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
              {item.name}
            </Text>
            {isNew && (
              <View style={[styles.newBadge, { borderColor: infoColor }]}>
                <Sparkles size={11} color={infoColor} />
                <Text style={[styles.newBadgeText, { color: infoColor }]}>
                  New
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.meta, { color: textSecondaryColor }]}
            numberOfLines={1}
          >
            {isJoined ? "Joined • visible in your feed" : "Join community"}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: badgeColor }]}>
          <Text style={[styles.statusBadgeText, { color: successTextColor }]}>
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

  const [searchQuery, setSearchQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>([]);
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
  const primaryForegroundColor = useThemeColor({}, "primaryForeground");
  const successColor = useThemeColor({}, "success");
  const infoColor = useThemeColor({}, "info");

  const joinedSet = useMemo(() => new Set(joinedGroupIds), [joinedGroupIds]);

  const loadCommunities = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") {
        setIsLoading(true);
      } else {
        setRefreshing(true);
      }

      setLoadError(null);

      const [groupsResult, userGroupsResult] = await Promise.all([
        fetchGroups(),
        user?.id
          ? supabase
              .from("user_groups")
              .select("group_id")
              .eq("user_id", user.id)
          : Promise.resolve({ data: [], error: null }),
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
        <Text style={[styles.title, { color: textColor }]}>Communities</Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          {visibleCountLabel}
        </Text>

        <View
          style={[
            styles.searchWrapper,
            { backgroundColor: inputBg, borderColor },
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
            cardColor={cardColor}
            textColor={textColor}
            textSecondaryColor={textSecondaryColor}
            borderColor={borderColor}
            successColor={successColor}
            infoColor={infoColor}
            successTextColor={primaryForegroundColor}
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
            <View style={styles.discoverySection}>
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
                {popularGroups.map((group, index) => (
                  <Pressable
                    key={group.id}
                    onPress={() => router.push(`/community/${group.id}`)}
                    style={({ pressed }) => [
                      styles.discoveryCard,
                      {
                        backgroundColor: cardColor,
                        borderColor,
                        marginLeft: index === 0 ? 0 : 10,
                        opacity: pressed ? 0.92 : 1,
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
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
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
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
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
    marginTop: 14,
  },
  groupTabsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  groupTabsTopRow: {
    flexDirection: "row",
    gap: 10,
  },
  groupTabsBottomRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  groupTabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  groupTabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
  },
  discoverySection: {
    marginBottom: 18,
  },
  discoveryRail: {
    alignItems: "center",
  },
  discoveryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 6,
  },
  discoveryTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  discoveryCard: {
    width: 150,
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    justifyContent: "center",
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
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontSize: 15,
    fontWeight: "600",
  },
  meta: {
    fontSize: 12,
    marginTop: 3,
  },
  newBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 12,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: "center",
  },
});
