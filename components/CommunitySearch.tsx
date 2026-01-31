import groupsData from "@/assets/data/groups.json";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Search, X } from "lucide-react-native";
import { useState } from "react";
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
  image: string;
};

type CommunitySearchProps = {
  selectedCommunity: Group | null;
  onCommunitySelect: (community: Group) => void;
};

export default function CommunitySearch({
  selectedCommunity,
  onCommunitySelect,
}: CommunitySearchProps) {
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const primaryColor = useThemeColor({}, "primary");
  const mutedColor = useThemeColor({}, "textMuted");
  const cardColor = useThemeColor({}, "card");
  const borderColor = useThemeColor({}, "border");

  const [showCommunitySearch, setShowCommunitySearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCommunities = (groupsData as Group[]).filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
              <Image
                source={{ uri: selectedCommunity.image }}
                className="w-10 h-10 rounded-full"
              />
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
            {filteredCommunities.length > 0 ? (
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
                  <Image
                    source={{ uri: item.image }}
                    className="w-8 h-8 rounded-full"
                  />
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
