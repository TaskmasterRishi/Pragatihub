import { useThemeColor } from "@/hooks/use-theme-color";
import { supabase } from "@/lib/Supabase";
import { useUser } from "@clerk/clerk-expo";
import { Search, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
    Image,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

type Group = {
  id: string;
  name: string;
  image: string | null;
};

type CommunitySearchProps = {
  selectedCommunity: Group | null;
  onCommunitySelect: (community: Group) => void;
};

export default function CommunitySearch({
  selectedCommunity,
  onCommunitySelect,
}: CommunitySearchProps) {
  const { user } = useUser();
  const textColor = useThemeColor({}, "text");
  const primaryColor = useThemeColor({}, "primary");
  const mutedColor = useThemeColor({}, "textMuted");
  const cardColor = useThemeColor({}, "card");
  const borderColor = useThemeColor({}, "border");

  const [showCommunitySearch, setShowCommunitySearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [communities, setCommunities] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCommunities = async () => {
      setIsLoading(true);
      setLoadError(null);

      if (!user?.id) {
        setCommunities([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_groups")
        .select("group:groups(id, name, image)")
        .eq("user_id", user.id);

      if (!isMounted) return;

      if (error) {
        setCommunities([]);
        setLoadError(error.message ?? "Failed to load communities");
      } else {
        const groups = (data ?? [])
          .map((item: { group?: Group | null }) => item.group)
          .filter(Boolean) as Group[];
        groups.sort((a, b) => a.name.localeCompare(b.name));
        setCommunities(groups);
      }

      setIsLoading(false);
    };

    loadCommunities();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const filteredCommunities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter((group) =>
      group.name.toLowerCase().includes(q),
    );
  }, [communities, searchQuery]);

  const renderAvatar = (image: string | null, size: number) => {
    if (image) {
      return (
        <Image
          source={{ uri: image }}
          className={size === 40 ? "w-10 h-10 rounded-full" : "w-8 h-8 rounded-full"}
        />
      );
    }

    return (
      <View
        style={{ backgroundColor: borderColor, width: size, height: size }}
        className="rounded-full"
      />
    );
  };

  return (
    <View>
      {!showCommunitySearch ? (
        <Pressable
          onPress={() => setShowCommunitySearch(true)}
          style={{ backgroundColor: cardColor, borderColor }}
          className="flex-row items-center gap-3 px-4 py-3 rounded-2xl border"
        >
          {selectedCommunity ? (
            <>
              {renderAvatar(selectedCommunity.image, 40)}
              <View className="flex-1">
                <Text style={{ color: mutedColor }} className="text-xs">
                  Community
                </Text>
                <Text
                  style={{ color: textColor }}
                  className="text-sm font-medium"
                >
                  {selectedCommunity.name}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View
                style={{ backgroundColor: primaryColor }}
                className="p-2 rounded-xl"
              >
                <Search size={18} color="white" />
              </View>

              <View className="flex-1">
                <Text style={{ color: mutedColor }} className="text-xs">
                  Community
                </Text>
                <Text
                  style={{ color: textColor }}
                  className="text-sm font-medium"
                >
                  Select a community
                </Text>
              </View>
            </>
          )}
          <X size={20} color={mutedColor} />
        </Pressable>
      ) : (
        <View
          style={{
            backgroundColor: cardColor,
            borderColor,
            borderWidth: 1,
            borderRadius: 16,
          }}
        >
          {/* Search Input - Transformed from selector */}
          <View className="flex-row items-center gap-3 px-4 py-3">
            <View
              style={{ backgroundColor: primaryColor }}
              className="p-2 rounded-xl"
            >
              <Search size={18} color="white" />
            </View>
            <TextInput
              placeholder="Search communities..."
              placeholderTextColor={mutedColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                color: textColor,
                flex: 1,
                fontSize: 16,
              }}
              autoFocus
            />
            <Pressable
              onPress={() => {
                setShowCommunitySearch(false);
                setSearchQuery("");
              }}
              className="p-1"
            >
              <X size={20} color={mutedColor} />
            </Pressable>
          </View>

          {/* Results List */}
          <ScrollView scrollEnabled nestedScrollEnabled={false}>
            {isLoading ? (
              <View className="px-4 py-6 items-center">
                <Text style={{ color: mutedColor }}>Loading communities...</Text>
              </View>
            ) : loadError ? (
              <View className="px-4 py-6 items-center">
                <Text style={{ color: mutedColor }}>{loadError}</Text>
              </View>
            ) : filteredCommunities.length > 0 ? (
              filteredCommunities.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    onCommunitySelect(item);
                    setShowCommunitySearch(false);
                    setSearchQuery("");
                  }}
                  style={{
                    backgroundColor:
                      selectedCommunity?.id === item.id
                        ? primaryColor + "20"
                        : "transparent",
                    borderBottomColor: borderColor,
                    borderBottomWidth: 1,
                  }}
                  className="flex-row items-center gap-3 px-4 py-2"
                >
                  {renderAvatar(item.image, 32)}
                  <View className="flex-1">
                    <Text
                      style={{ color: textColor }}
                      className="font-medium text-sm"
                    >
                      {item.name}
                    </Text>
                  </View>
                  {selectedCommunity?.id === item.id && (
                    <View
                      style={{ backgroundColor: primaryColor }}
                      className="w-2 h-2 rounded-full"
                    />
                  )}
                </Pressable>
              ))
            ) : (
              <View className="px-4 py-6 items-center">
                <Text style={{ color: mutedColor }}>No communities found</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
