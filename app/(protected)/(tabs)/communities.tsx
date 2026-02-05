import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroups, type Group } from "@/lib/actions/groups";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Search, Users } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

function CommunityCard({
  item,
  cardColor,
  textColor,
  textSecondaryColor,
  borderColor,
  onPress,
}: {
  item: Group;
  cardColor: string;
  textColor: string;
  textSecondaryColor: string;
  borderColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: cardColor,
          borderColor,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.cardInner}>
        <Image
          source={{ uri: item.image }}
          style={styles.avatar}
        />
        <View style={styles.cardText}>
          <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text
            style={[styles.meta, { color: textSecondaryColor }]}
            numberOfLines={1}
          >
            Community
          </Text>
        </View>
        <Users size={20} color={textSecondaryColor} />
      </View>
    </Pressable>
  );
}

export default function CommunitiesScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
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

  useEffect(() => {
    let isMounted = true;

    const loadGroups = async () => {
      setIsLoading(true);
      setLoadError(null);

      const { data, error } = await fetchGroups();

      if (!isMounted) return;

      if (error) {
        setGroups([]);
        setLoadError(error.message ?? "Failed to load communities");
      } else {
        setGroups(data ?? []);
      }

      setIsLoading(false);
    };

    loadGroups();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setLoadError(null);

    const { data, error } = await fetchGroups();

    if (error) {
      setGroups([]);
      setLoadError(error.message ?? "Failed to load communities");
    } else {
      setGroups(data ?? []);
    }

    setRefreshing(false);
  };

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.trim().toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q),
    );
  }, [searchQuery, groups]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>Communities</Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          {groups.length} communities
        </Text>
        <View style={[styles.searchWrapper, { backgroundColor: inputBg, borderColor }]}>
          <Search size={20} color={placeholderColor} style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search communities..."
            placeholderTextColor={placeholderColor}
            style={[styles.searchInput, { color: textColor }]}
            returnKeyType="search"
          />
        </View>
      </View>
      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CommunityCard
            item={item}
            cardColor={cardColor}
            textColor={textColor}
            textSecondaryColor={textSecondaryColor}
            borderColor={borderColor}
            onPress={() => router.push(`/community/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Users size={48} color={textSecondaryColor} />
            <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
              {isLoading
                ? "Loading communities..."
                : loadError
                  ? loadError
                  : searchQuery.trim()
                    ? "No communities match your search"
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
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
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
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e5e7eb",
  },
  cardText: {
    flex: 1,
    marginLeft: 14,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
});
