import EntityBadge from "@/components/EntityBadge";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroups, type Group } from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import { useUser } from "@clerk/clerk-expo";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowUpDown,
  ChevronRight,
  Compass,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  Layout,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type VisibilityFilter = "all" | "joined";
type SortMode = "relevance" | "popular";
type CommunityTab = "All" | "Joined";

type FilterBarProps = {
  selectedTab: CommunityTab;
  sortMode: SortMode;
  onChangeTab: (tab: CommunityTab) => void;
  onToggleSort: () => void;
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
  avatarBgColor: string;
  shadowColor: string;
  successColor: string;
  infoColor: string;
  tintColor: string;
  isDark: boolean;
  onPress: () => void;
};

const RECENT_WINDOW_DAYS = 14;
const FILTER_TABS: CommunityTab[] = ["Joined", "All"];

// Enable layout animation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

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
  segmentBase,
  segmentBorder,
  segmentSelectedBg,
  segmentSelectedBorder,
  textColor,
  tintColor,
}: FilterBarProps) {
  const sortLabel = sortMode === "popular" ? "Popular" : "Relevance";

  return (
    <View style={styles.filterRow}>
      <View style={styles.segmentRow}>
        {FILTER_TABS.map((tab) => {
          const selected = tab === selectedTab;

          return (
            <Pressable
              key={tab}
              onPress={() => {
                if (tab === selectedTab) return;
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                onChangeTab(tab);
              }}
              style={({ pressed }) => [
                styles.segment,
                { backgroundColor: segmentBase, borderColor: segmentBorder },
                selected && styles.segmentSelected,
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
        <ArrowUpDown size={13} color={tintColor} />
        <Text style={[styles.sortText, { color: tintColor }]}>{sortLabel}</Text>
      </Pressable>
    </View>
  );
}

// ─── Shimmer + Skeletons ──────────────────────────────────────────────────────
type ShimmerProps = {
  width: number | string;
  height: number;
  borderRadius?: number;
  baseColor: string;
  highlightColor: string;
  style?: any;
};

function Shimmer({
  width,
  height,
  borderRadius = 8,
  baseColor,
  highlightColor,
  style,
}: ShimmerProps) {
  const progress = useSharedValue(-1);

  useEffect(() => {
    progress.value = -1;
    const animation = withRepeat(
      withTiming(1, {
        duration: 1200,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    progress.value = animation;
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: interpolate(progress.value, [-1, 1], [-200, 200]),
        },
      ],
    };
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          overflow: "hidden",
          backgroundColor: baseColor,
        },
        style,
      ]}
    >
      <AnimatedLinearGradient
        colors={["transparent", highlightColor, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[StyleSheet.absoluteFillObject, animatedStyle]}
      />
    </View>
  );
}

type SkeletonPalette = {
  base: string;
  highlight: string;
  card: string;
  border: string;
};

type CommunitySkeletonProps = {
  palette: SkeletonPalette;
  tintColor: string;
  index: number;
};

function CommunityCardSkeleton({ palette, tintColor, index }: CommunitySkeletonProps) {
  return (
    <Animated.View
      entering={FadeInUp.duration(220).delay(index * 35)}
      layout={Layout.springify().damping(18).mass(0.5)}
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.cardInner}>
        <View
          style={[
            styles.avatarWrap,
            { backgroundColor: palette.base, borderColor: palette.border },
          ]}
        >
          <Shimmer
            width={42}
            height={42}
            borderRadius={21}
            baseColor={palette.base}
            highlightColor={palette.highlight}
          />
        </View>

        <View style={styles.cardText}>
          <Shimmer
            width="70%"
            height={14}
            borderRadius={6}
            baseColor={palette.base}
            highlightColor={palette.highlight}
            style={{ marginBottom: 6 }}
          />
          <Shimmer
            width="40%"
            height={11}
            borderRadius={6}
            baseColor={palette.base}
            highlightColor={palette.highlight}
          />
        </View>

        <View style={styles.cardActions}>
          <Shimmer
            width={56}
            height={22}
            borderRadius={999}
            baseColor={palette.base}
            highlightColor={palette.highlight}
          />
          <ChevronRight size={14} color={palette.base} />
        </View>
      </View>
    </Animated.View>
  );
}

type PopularSkeletonProps = {
  palette: SkeletonPalette;
  index: number;
};

function PopularSkeleton({ palette, index }: PopularSkeletonProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(200).delay(index * 60)}
      style={styles.popularCardOuter}
    >
      <View style={[styles.popularCard, { borderColor: palette.border }]}>
        <Shimmer
          width={96}
          height={96}
          borderRadius={48}
          baseColor={palette.card}
          highlightColor={palette.highlight}
        />
      </View>
      <Shimmer
        width={70}
        height={10}
        borderRadius={6}
        baseColor={palette.base}
        highlightColor={palette.highlight}
      />
    </Animated.View>
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
  avatarBgColor,
  shadowColor,
  successColor,
  infoColor,
  tintColor,
  isDark,
  onPress,
}: CommunityCardProps) {
  const accentColor = isJoined ? successColor : tintColor;
  const statusBg = toRgba(accentColor, isDark ? 0.18 : 0.1);
  const statusBorder = toRgba(accentColor, isDark ? 0.45 : 0.32);
  const newBadgeBorder = toRgba(infoColor, 0.4);
  const newBadgeBg = toRgba(infoColor, 0.12);
  const memberLabel = `${memberCount.toLocaleString()} ${memberCount === 1 ? "member" : "members"}`;
  const joinedRing = toRgba(successColor, 0.8);
  const joinedGlow = toRgba(successColor, isDark ? 0.22 : 0.12);
  const accentLine = isJoined ? successColor : tintColor;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: cardColor,
          borderColor,
          shadowColor,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: pressed ? 0.94 : 1,
        },
      ]}
    >
      {/* Accent left stripe */}
      <View
        style={[styles.cardAccentStripe, { backgroundColor: accentLine }]}
      />
      <View style={styles.cardInner}>
        {/* Avatar */}
        <View
          style={[
            styles.avatarWrap,
            {
              backgroundColor: isJoined ? joinedGlow : avatarBgColor,
              borderColor: isJoined ? joinedRing : borderColor,
            },
          ]}
        >
          <Image
            source={{ uri: item.image ?? undefined }}
            style={styles.avatar}
            contentFit="cover"
          />
        </View>

        {/* Content */}
        <View style={styles.cardText}>
          <View style={styles.cardTitleRow}>
            <View style={styles.nameRow}>
              <EntityBadge kind="community" size={12} />
              <Text
                style={[styles.name, { color: textColor }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.name}
              </Text>
            </View>
            <View style={styles.badgeRow}>
              {isNew ? (
                <View
                  style={[
                    styles.newBadge,
                    {
                      backgroundColor: newBadgeBg,
                      borderColor: newBadgeBorder,
                    },
                  ]}
                >
                  <Sparkles size={8} color={infoColor} />
                  <Text style={[styles.newBadgeText, { color: infoColor }]}>
                    New
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.metaRow}>
            <Users
              size={10}
              color={textSecondaryColor}
              style={{ marginRight: 3 }}
            />
            <Text
              style={[styles.meta, { color: textSecondaryColor }]}
              numberOfLines={1}
            >
              {memberLabel}
            </Text>
          </View>
        </View>

        {/* Action */}
        <View style={styles.cardActions}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusBg,
                borderColor: statusBorder,
              },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: accentColor }]}>
              {isJoined ? "Joined" : "Join"}
            </Text>
          </View>
          <ChevronRight size={14} color={textSecondaryColor} />
        </View>
      </View>
    </Pressable>
  );
}

// ─── Popular Rail Card ────────────────────────────────────────────────────────
type PopularCardProps = {
  group: Group;
  memberCount: number;
  cardColor: string;
  textColor: string;
  textSecondaryColor: string;
  borderColor: string;
  tintColor: string;
  isDark: boolean;
  onPress: () => void;
};

function PopularCard({
  group,
  memberCount,
  cardColor,
  textColor,
  textSecondaryColor,
  borderColor,
  tintColor,
  isDark,
  onPress,
}: PopularCardProps) {
  const memberLabel =
    memberCount >= 1000
      ? `${(memberCount / 1000).toFixed(1)}k members`
      : `${memberCount} ${memberCount === 1 ? "member" : "members"}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.popularCardOuter,
        {
          transform: [{ scale: pressed ? 0.95 : 1 }],
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      {/* Circle */}
      <View style={[styles.popularCard, { borderColor }]}>
        {/* Blurred bg image */}
        <Image
          source={{ uri: group.image ?? undefined }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          blurRadius={22}
        />
        {/* Dark bottom scrim */}
        <LinearGradient
          colors={["transparent", toRgba("#000000", isDark ? 0.6 : 0.48)]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        {/* Centered sharp avatar */}
        <View style={[styles.popularAvatarWrap, { borderColor: cardColor }]}>
          <Image
            source={{ uri: group.image ?? undefined }}
            style={styles.popularAvatar}
            contentFit="cover"
          />
        </View>
        {/* Member pill — bottom left */}
        <View
          style={[
            styles.popularMemberPill,
            {
              backgroundColor: toRgba("#000000", 0.55),
              borderColor: toRgba("#ffffff", 0.15),
            },
          ]}
        >
          <Users size={8} color="rgba(255,255,255,0.82)" />
          <Text
            style={[
              styles.popularMemberText,
              { color: "rgba(255,255,255,0.88)" },
            ]}
          >
            {memberLabel}
          </Text>
        </View>
      </View>

      {/* Name below circle */}
      <View style={styles.popularNameRow}>
        <EntityBadge kind="community" size={12} />
        <Text
          style={[styles.popularName, { color: textColor }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {group.name}
        </Text>
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

  const headerBg = toRgba(cardColor, isDark ? 0.76 : 0.97);
  const raisedSurfaceColor = toRgba(cardColor, isDark ? 0.82 : 0.99);
  const searchSurfaceColor = toRgba(inputBg, isDark ? 0.55 : 0.78);
  const softBorderColor = toRgba(borderColor, isDark ? 0.5 : 0.28);
  const subtleBorderColor = toRgba(borderColor, isDark ? 0.38 : 0.18);
  const avatarTintColor = toRgba(inputBg, isDark ? 0.72 : 0.9);
  const heroIconBg = toRgba(tintColor, isDark ? 0.2 : 0.1);
  const heroIconBorder = toRgba(tintColor, isDark ? 0.38 : 0.22);
  const countPillBg = toRgba(tintColor, isDark ? 0.2 : 0.1);
  const segmentBase = toRgba(textColor, isDark ? 0.12 : 0.06);
  const segmentBorder = toRgba(borderColor, isDark ? 0.48 : 0.24);
  const segmentSelectedBg = toRgba(tintColor, isDark ? 0.32 : 0.18);
  const segmentSelectedBorder = toRgba(tintColor, isDark ? 0.58 : 0.38);
  const skeletonPalette: SkeletonPalette = {
    base: toRgba(textColor, isDark ? 0.08 : 0.06),
    highlight: toRgba(textColor, isDark ? 0.18 : 0.12),
    card: raisedSurfaceColor,
    border: softBorderColor,
  };
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

  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const searchTokens = useMemo(() => {
    const normalized = normalizeText(debouncedQuery);
    return normalized ? normalized.split(" ").filter(Boolean) : [];
  }, [debouncedQuery]);

  const normalizedQuery = useMemo(
    () => normalizeText(debouncedQuery),
    [debouncedQuery],
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
      .slice(0, 12);
  }, [groups, joinedSet, memberCountByGroup]);

  const showPopularRail = !normalizedQuery && popularGroups.length > 0;

  const joinedCount = joinedGroupIds.length;
  const totalCount = groups.length;
  const isSkeleton = isLoading && !loadError;
  const listData = isSkeleton ? Array.from({ length: 8 }, (_, i) => i) : visibleGroups;

  // Approximate header height for padding
  const headerPaddingTop = 148;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* ── Sticky blurred header ── */}
      <View
        style={[
          styles.topBarContainer,
          {
            borderColor: tabBarBorder,
            backgroundColor:
              Platform.OS === "web" ? tabBarBackgroundColor : "transparent",
            ...(Platform.OS === "web"
              ? ({
                  backdropFilter: "saturate(160%) blur(20px)",
                  WebkitBackdropFilter: "saturate(160%) blur(20px)",
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
                intensity={80}
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

        <View style={[styles.topBarContent, { paddingTop: 30 }]}>
          {/* Title row */}
          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleRow}>
              <View
                style={[
                  styles.inlineIconWrap,
                  { backgroundColor: heroIconBg, borderColor: heroIconBorder },
                ]}
              >
                <Compass size={14} color={tintColor} />
              </View>
              <Text style={[styles.title, { color: textColor }]}>
                Communities
              </Text>
            </View>

            {/* Stats pill */}
            <View style={styles.statsPillRow}>
              <View
                style={[
                  styles.countPill,
                  { backgroundColor: countPillBg, borderColor: heroIconBorder },
                ]}
              >
                <Text style={[styles.countPillText, { color: tintColor }]}>
                  {totalCount}
                </Text>
              </View>
              {joinedCount > 0 ? (
                <View
                  style={[
                    styles.countPill,
                    {
                      backgroundColor: toRgba(
                        successColor,
                        isDark ? 0.18 : 0.1,
                      ),
                      borderColor: toRgba(successColor, isDark ? 0.4 : 0.25),
                    },
                  ]}
                >
                  <Text style={[styles.countPillText, { color: successColor }]}>
                    {joinedCount} joined
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Search bar */}
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
              size={15}
              color={placeholderColor}
              style={styles.searchIcon}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search communities…"
              placeholderTextColor={placeholderColor}
              style={[styles.searchInput, { color: textColor }]}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        </View>
      </View>

      {/* ── Main list ── */}
      <FlatList
        data={listData}
        keyExtractor={(item) => (isSkeleton ? `skeleton-${item}` : (item as Group).id)}
        renderItem={({ item, index }) =>
          isSkeleton ? (
            <CommunityCardSkeleton
              palette={skeletonPalette}
              tintColor={tintColor}
              index={index}
            />
          ) : (
            <Animated.View
              entering={FadeInUp.duration(220).delay(index * 40)}
              exiting={FadeOut.duration(160)}
              layout={Layout.springify().damping(18).mass(0.5)}
            >
              <View style={{ opacity: refreshing ? 0.96 : 1 }}>
                <CommunityCard
                  item={item as Group}
                  isJoined={joinedSet.has((item as Group).id)}
                  isNew={isRecentlyCreated(item as Group)}
                  memberCount={memberCountByGroup[(item as Group).id] ?? 0}
                  cardColor={raisedSurfaceColor}
                  textColor={textColor}
                  textSecondaryColor={textSecondaryColor}
                  borderColor={softBorderColor}
                  avatarBgColor={avatarTintColor}
                  shadowColor={shadowColor}
                  successColor={successColor}
                  infoColor={infoColor}
                  tintColor={tintColor}
                  isDark={isDark}
                  onPress={() => router.push(`/community/${(item as Group).id}`)}
                />
              </View>
            </Animated.View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerPaddingTop, paddingBottom: 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          <>
            {/* Popular discover rail */}
            {isSkeleton ? (
              <View
                style={[
                  styles.discoverySection,
                  { backgroundColor: headerBg, borderColor: softBorderColor },
                ]}
              >
                <View style={styles.discoveryHeader}>
                  <View
                    style={[
                      styles.discoverIconWrap,
                      {
                        backgroundColor: toRgba(tintColor, isDark ? 0.2 : 0.1),
                        borderColor: toRgba(tintColor, isDark ? 0.38 : 0.2),
                      },
                    ]}
                  >
                    <TrendingUp size={11} color={tintColor} />
                  </View>
                  <Text style={[styles.discoveryTitle, { color: textColor }]}>
                    Trending
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.discoveryRail}
                >
                  {Array.from({ length: 6 }, (_, i) => (
                    <PopularSkeleton
                      key={`pop-skeleton-${i}`}
                      palette={skeletonPalette}
                      index={i}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : showPopularRail ? (
              <View
                style={[
                  styles.discoverySection,
                  { backgroundColor: headerBg, borderColor: softBorderColor },
                ]}
              >
                <View style={styles.discoveryHeader}>
                  <View
                    style={[
                      styles.discoverIconWrap,
                      {
                        backgroundColor: toRgba(tintColor, isDark ? 0.2 : 0.1),
                        borderColor: toRgba(tintColor, isDark ? 0.38 : 0.2),
                      },
                    ]}
                  >
                    <TrendingUp size={11} color={tintColor} />
                  </View>
                  <Text style={[styles.discoveryTitle, { color: textColor }]}>
                    Trending
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.discoveryRail}
                >
                  {popularGroups.map((group) => (
                    <Animated.View
                      key={group.id}
                      entering={FadeIn.duration(200).delay(60)}
                    >
                      <View style={{ transform: [{ scale: refreshing ? 0.99 : 1 }] }}>
                        <PopularCard
                          group={group}
                          memberCount={memberCountByGroup[group.id] ?? 0}
                          cardColor={raisedSurfaceColor}
                          textColor={textColor}
                          textSecondaryColor={textSecondaryColor}
                          borderColor={softBorderColor}
                          tintColor={tintColor}
                          isDark={isDark}
                          onPress={() => router.push(`/community/${group.id}`)}
                        />
                      </View>
                    </Animated.View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* Section label + filter bar */}
            <View style={styles.sectionLabelRow}>
              <Text
                style={[styles.sectionLabel, { color: textSecondaryColor }]}
              >
                {visibilityFilter === "joined"
                  ? "Your communities"
                  : "All communities"}
              </Text>
              <Text
                style={[styles.sectionCount, { color: textSecondaryColor }]}
              >
                {visibleGroups.length}
              </Text>
            </View>

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
              {isLoading ? (
                <ActivityIndicator color={tintColor} size="large" />
              ) : loadError ? (
                <Users size={40} color={textSecondaryColor} />
              ) : normalizedQuery ? (
                <Search size={40} color={textSecondaryColor} />
              ) : (
                <Compass size={40} color={textSecondaryColor} />
              )}
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                {isLoading
                  ? "Finding communities…"
                  : loadError
                    ? loadError
                    : normalizedQuery
                      ? "No communities match this search"
                      : visibilityFilter === "joined"
                        ? "You haven't joined any communities yet"
                        : "No communities yet"}
              </Text>
              {!isLoading &&
              !loadError &&
              visibilityFilter === "joined" &&
              !normalizedQuery ? (
                <Text
                  style={[styles.emptyHint, { color: toRgba(tintColor, 0.7) }]}
                >
                  Switch to All to discover communities
                </Text>
              ) : null}
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
  /* ── Header ── */
  topBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
  },
  topBarContent: {
    gap: 10,
    paddingBottom: 14,
    paddingHorizontal: 14,
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
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  statsPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  countPill: {
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
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
  /* ── List ── */
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  /* ── Section label ── */
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: "600",
  },
  /* ── Filter bar ── */
  filterRow: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  segmentRow: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  segment: {
    flex: 1,
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  segmentSelected: {
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sortButton: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  sortText: {
    fontSize: 12,
    fontWeight: "700",
  },
  pressedScale: {
    transform: [{ scale: 0.97 }],
  },
  /* ── Community card ── */
  itemSeparator: {
    height: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: "hidden",
    flexDirection: "row",
  },
  cardAccentStripe: {
    width: 3,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 11,
    gap: 12,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e5e7eb",
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 4,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  meta: {
    fontSize: 11,
    fontWeight: "500",
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
    fontSize: 9,
    fontWeight: "800",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    minWidth: 52,
    alignItems: "center",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  /* ── Discovery (popular) rail ── */
  discoverySection: {
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  discoveryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
  },
  discoverIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  discoveryTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  discoveryRail: {
    gap: 10,
    paddingRight: 4,
    paddingBottom: 2,
  },
  /* ── Popular card (circle style) ── */
  popularCardOuter: {
    width: 96,
    alignItems: "center",
    gap: 7,
  },
  popularCard: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  popularAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2.5,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
  },
  popularAvatar: {
    width: "100%",
    height: "100%",
  },
  popularMemberPill: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  popularMemberText: {
    fontSize: 8,
    fontWeight: "600",
  },
  popularName: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
  },
  popularNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    maxWidth: "100%",
  },
  /* ── Empty state ── */
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 24,
    paddingHorizontal: 6,
  },
  emptyCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  emptyHint: {
    fontSize: 12,
    textAlign: "center",
    fontWeight: "500",
    marginTop: 2,
  },
});
