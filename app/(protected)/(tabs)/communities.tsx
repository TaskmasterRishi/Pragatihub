import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroups, type Group } from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import { useUser } from "@clerk/clerk-expo";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ArrowUpDown,
  ChevronRight,
  Compass,
  Search,
  Sparkles,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  InteractionManager,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type VisibilityFilter = "all" | "joined";
type SortMode = "relevance" | "popular";
type CommunityTab = "All" | "Joined";

type FilterBarProps = {
  selectedTab: CommunityTab;
  sortMode: SortMode;
  onChangeTab: (tab: CommunityTab) => void;
  onToggleSort: () => void;
  shellColor: string;
  shellBorder: string;
  segmentBase: string;
  segmentBorder: string;
  segmentSelectedBg: string;
  segmentSelectedBorder: string;
  textColor: string;
  tintColor: string;
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
const FILTER_TABS: CommunityTab[] = ["Joined", "All"];

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

function FilterBar({
  selectedTab,
  sortMode,
  onChangeTab,
  onToggleSort,
  shellColor,
  shellBorder,
  segmentBase,
  segmentBorder,
  segmentSelectedBg,
  segmentSelectedBorder,
  textColor,
  tintColor,
}: FilterBarProps) {
  const sortLabel = sortMode === "popular" ? "Popular" : "Relevance";

  return (
    <View
      style={[
        styles.filterRow,
        { backgroundColor: shellColor, borderColor: shellBorder },
      ]}
    >
      <View style={styles.segmentRow}>
        {FILTER_TABS.map((tab) => {
          const selected = tab === selectedTab;

          return (
            <Pressable
              key={tab}
              onPress={() => onChangeTab(tab)}
              style={({ pressed }) => [
                styles.segment,
                { backgroundColor: segmentBase, borderColor: segmentBorder },
                selected && {
                  backgroundColor: segmentSelectedBg,
                  borderColor: segmentSelectedBorder,
                },
                pressed && styles.pressedScale,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? tintColor : textColor },
                ]}
              >
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={onToggleSort}
        style={({ pressed }) => [
          styles.sortButton,
          {
            backgroundColor: segmentBase,
            borderColor: segmentBorder,
          },
          pressed && styles.pressedScale,
        ]}
      >
        <ArrowUpDown size={14} color={tintColor} />
        <Text style={[styles.sortText, { color: tintColor }]}>{sortLabel}</Text>
      </Pressable>
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
  const statusBadgeColor = toRgba(accentColor, 0.12);
  const statusBadgeBorderColor = toRgba(accentColor, 0.34);
  const newBadgeBorder = toRgba(infoColor, 0.4);
  const newBadgeBg = toRgba(infoColor, 0.12);
  const memberLabel = `${memberCount.toLocaleString()} ${memberCount === 1 ? "member" : "members"}`;
  const joinedRing = toRgba(successColor, 0.75);
  const joinedGlow = toRgba(successColor, 0.16);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: cardColor,
          borderColor,
          shadowColor,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          opacity: pressed ? 0.96 : 1,
        },
      ]}
    >
      <View style={styles.cardInner}>
        <View
          style={[
            styles.avatarWrap,
            {
              backgroundColor: isJoined ? joinedGlow : avatarColor,
              borderColor: isJoined ? joinedRing : borderColor,
            },
          ]}
        >
          <Image
            source={{ uri: item.image ?? undefined }}
            style={styles.avatar}
          />
        </View>

        <View style={styles.cardText}>
          <View style={styles.cardTitleRow}>
            <Text
              style={[styles.name, { color: textColor }]}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
              minimumFontScale={0.86}
            >
              {item.name}
            </Text>
            {isNew ? (
              <View
                style={[
                  styles.newBadge,
                  { backgroundColor: newBadgeBg, borderColor: newBadgeBorder },
                ]}
              >
                <Sparkles size={9} color={infoColor} />
                <Text style={[styles.newBadgeText, { color: infoColor }]}>
                  New
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <Text
              style={[styles.meta, { color: textSecondaryColor }]}
              numberOfLines={1}
            >
              {memberLabel}
            </Text>
          </View>
        </View>

        <View style={styles.cardActions}>
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
          <ChevronRight size={15} color={textSecondaryColor} />
        </View>
      </View>
    </Pressable>
  );
}

export default function CommunitiesScreen() {
  const insets = useSafeAreaInsets();
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
  const [androidBlurReady, setAndroidBlurReady] = useState(
    Platform.OS !== "android",
  );

  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const textSecondaryColor = useThemeColor({}, "textSecondary");
  const borderColor = useThemeColor({}, "border");
  const inputBg = useThemeColor({}, "input");
  const placeholderColor = useThemeColor({}, "placeholder");
  const successColor = useThemeColor({}, "success");
  const infoColor = useThemeColor({}, "info");
  const tintColor = useThemeColor({}, "tint");
  const shadowColor = isDark ? "#000000" : "#0f172a";

  const headerBg = toRgba(cardColor, isDark ? 0.74 : 0.96);
  const raisedSurfaceColor = toRgba(cardColor, isDark ? 0.78 : 0.98);
  const searchSurfaceColor = toRgba(inputBg, isDark ? 0.62 : 0.8);
  const softBorderColor = toRgba(borderColor, isDark ? 0.54 : 0.3);
  const subtleBorderColor = toRgba(borderColor, isDark ? 0.42 : 0.22);
  const avatarTintColor = toRgba(inputBg, isDark ? 0.72 : 0.9);
  const heroIconBg = toRgba(tintColor, isDark ? 0.2 : 0.1);
  const heroIconBorder = toRgba(tintColor, isDark ? 0.42 : 0.22);
  const countPillBg = toRgba(tintColor, isDark ? 0.18 : 0.09);
  const filterShellColor = toRgba(inputBg, isDark ? 0.56 : 0.86);
  const segmentBase = toRgba(textColor, isDark ? 0.08 : 0.035);
  const segmentBorder = toRgba(borderColor, isDark ? 0.44 : 0.2);
  const segmentSelectedBg = toRgba(tintColor, isDark ? 0.26 : 0.14);
  const segmentSelectedBorder = toRgba(tintColor, isDark ? 0.5 : 0.3);
  const tabBarBackgroundColor = useThemeColor(
    {
      light: "rgba(255, 255, 255, 0.68)",
      dark: "rgba(39, 39, 42, 0.7)",
    },
    "tabBarBackground",
  );
  const tabBarNativeOverlayColor = useThemeColor(
    {
      light: "rgba(255, 255, 255, 0.12)",
      dark: "rgba(39, 39, 42, 0.18)",
    },
    "tabBarBackground",
  );
  const tabBarBorder = useThemeColor({}, "tabBarBorder");

  const joinedSet = useMemo(() => new Set(joinedGroupIds), [joinedGroupIds]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        setAndroidBlurReady(true);
      }, 320);
    });

    return () => {
      interactionTask.cancel();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

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
          const membersDiff =
            (memberCountByGroup[b.group.id] ?? 0) -
            (memberCountByGroup[a.group.id] ?? 0);
          if (membersDiff !== 0) return membersDiff;
          return a.group.name.localeCompare(b.group.name);
        })
        .map((entry) => entry.group);
    }

    if (sortMode === "popular") {
      return [...scopedGroups].sort((a, b) => {
        const membersDiff =
          (memberCountByGroup[b.id] ?? 0) - (memberCountByGroup[a.id] ?? 0);
        if (membersDiff !== 0) return membersDiff;

        const joinedDiff =
          Number(joinedSet.has(b.id)) - Number(joinedSet.has(a.id));
        if (joinedDiff !== 0) return joinedDiff;

        return a.name.localeCompare(b.name);
      });
    }

    return [...scopedGroups].sort((a, b) => {
      const joinedDiff =
        Number(joinedSet.has(b.id)) - Number(joinedSet.has(a.id));
      if (joinedDiff !== 0) return joinedDiff;

      const recentDiff =
        Number(isRecentlyCreated(b)) - Number(isRecentlyCreated(a));
      if (recentDiff !== 0) return recentDiff;

      return a.name.localeCompare(b.name);
    });
  }, [
    groups,
    joinedSet,
    memberCountByGroup,
    normalizedQuery,
    searchTokens,
    sortMode,
    visibilityFilter,
  ]);

  const popularGroups = useMemo(() => {
    return groups
      .filter((group) => !joinedSet.has(group.id))
      .sort((a, b) => {
        const membersDiff =
          (memberCountByGroup[b.id] ?? 0) - (memberCountByGroup[a.id] ?? 0);
        if (membersDiff !== 0) return membersDiff;

        const dateDiff =
          parseCreatedAt(b.created_at) - parseCreatedAt(a.created_at);
        if (dateDiff !== 0) return dateDiff;

        return a.name.localeCompare(b.name);
      })
      .slice(0, 10);
  }, [groups, joinedSet, memberCountByGroup]);

  const showPopularRail = !normalizedQuery && popularGroups.length > 0;

  const visibleCountLabel = `${visibleGroups.length} of ${groups.length}`;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View
        style={[
          styles.topBarContainer,
          {
            borderColor: tabBarBorder,
            backgroundColor:
              Platform.OS === "web" ? tabBarBackgroundColor : "transparent",
            ...(Platform.OS === "web"
              ? ({
                  backdropFilter: "saturate(140%) blur(18px)",
                  WebkitBackdropFilter: "saturate(140%) blur(18px)",
                } as any)
              : {}),
          },
        ]}
      >
        {Platform.OS !== "web" ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            {androidBlurReady ? (
              <BlurView
                tint={isDark ? "systemMaterialDark" : "systemMaterialLight"}
                intensity={70}
                experimentalBlurMethod={
                  Platform.OS === "android" ? "dimezisBlurView" : undefined
                }
                style={StyleSheet.absoluteFillObject}
              />
            ) : null}
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: tabBarNativeOverlayColor },
              ]}
            />
          </View>
        ) : null}

        <View style={[styles.topBarContent, { paddingTop: 20 }]}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleRow}>
              <View
                style={[
                  styles.inlineIconWrap,
                  { backgroundColor: heroIconBg, borderColor: heroIconBorder },
                ]}
              >
                <Compass size={13} color={tintColor} />
              </View>
              <Text style={[styles.title, { color: textColor }]}>
                Communities
              </Text>
            </View>

            <View
              style={[
                styles.countPill,
                { backgroundColor: countPillBg, borderColor: heroIconBorder },
              ]}
            >
              <Text style={[styles.countPillText, { color: tintColor }]}>
                {groups.length}
              </Text>
            </View>
          </View>

          <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
            {visibleCountLabel} visible
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
              size={16}
              color={placeholderColor}
              style={styles.searchIcon}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search communities"
              placeholderTextColor={placeholderColor}
              style={[styles.searchInput, { color: textColor }]}
              returnKeyType="search"
            />
          </View>
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
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: 148, paddingBottom: 104 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          <>
            {showPopularRail ? (
              <View
                style={[
                  styles.discoverySection,
                  { backgroundColor: headerBg, borderColor: softBorderColor },
                ]}
              >
                <View style={styles.discoveryHeader}>
                  <Compass size={14} color={textSecondaryColor} />
                  <Text style={[styles.discoveryTitle, { color: textColor }]}>
                    Popular
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.discoveryRail}
                >
                  {popularGroups.map((group) => {
                    return (
                      <Pressable
                        key={group.id}
                        onPress={() => router.push(`/community/${group.id}`)}
                        style={({ pressed }) => [
                          styles.discoveryCard,
                          {
                            backgroundColor: raisedSurfaceColor,
                            borderColor: softBorderColor,
                            transform: [{ scale: pressed ? 0.98 : 1 }],
                            opacity: pressed ? 0.96 : 1,
                          },
                        ]}
                      >
                        <Image
                          source={{ uri: group.image ?? undefined }}
                          style={styles.discoveryAvatar}
                        />
                        <View style={styles.discoveryTextWrap}>
                          <Text
                            style={[styles.discoveryName, { color: textColor }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            adjustsFontSizeToFit
                            minimumFontScale={0.82}
                          >
                            {group.name}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <FilterBar
              selectedTab={visibilityFilter === "joined" ? "Joined" : "All"}
              sortMode={sortMode}
              onChangeTab={(tab) =>
                setVisibilityFilter(tab === "Joined" ? "joined" : "all")
              }
              onToggleSort={() =>
                setSortMode((current) =>
                  current === "relevance" ? "popular" : "relevance",
                )
              }
              shellColor={filterShellColor}
              shellBorder={softBorderColor}
              segmentBase={segmentBase}
              segmentBorder={segmentBorder}
              segmentSelectedBg={segmentSelectedBg}
              segmentSelectedBorder={segmentSelectedBorder}
              textColor={textColor}
              tintColor={tintColor}
            />
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: headerBg, borderColor: softBorderColor },
              ]}
            >
              {loadError ? (
                <Users size={36} color={textSecondaryColor} />
              ) : normalizedQuery ? (
                <Search size={36} color={textSecondaryColor} />
              ) : (
                <Compass size={36} color={textSecondaryColor} />
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
  topBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    borderWidth: 1,
    overflow: "hidden",
  },
  topBarContent: {
    gap: 10,
    paddingBottom: 16,
    paddingHorizontal: 12,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 11,
    marginTop: -2,
  },
  countPill: {
    minWidth: 32,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  filterRow: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  segmentRow: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  segment: {
    flex: 1,
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  segmentText: {
    fontSize: 11,
    fontWeight: "700",
  },
  sortButton: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  sortText: {
    fontSize: 11,
    fontWeight: "700",
  },
  pressedScale: {
    transform: [{ scale: 0.98 }],
  },
  itemSeparator: {
    height: 8,
  },
  discoverySection: {
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  discoveryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  discoveryTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  discoveryRail: {
    alignItems: "center",
    paddingRight: 4,
    gap: 12,
  },
  discoveryCard: {
    width: 168,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  discoveryAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e5e7eb",
    alignSelf: "center",
  },
  discoveryTextWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    alignSelf: "center",
  },
  discoveryName: {
    fontSize: 11,
    fontWeight: "600",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 10,
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e5e7eb",
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
    fontWeight: "500",
  },
  newBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 4,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 52,
    alignItems: "center",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    paddingHorizontal: 8,
  },
  emptyCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 14,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: "center",
  },
});
