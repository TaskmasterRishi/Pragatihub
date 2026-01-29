import groups from "@/assets/data/groups.json";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { ChevronLeft, Users } from "lucide-react-native";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function CommunityPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const community = groups.find((g) => g.id === id);

  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "card");
  const textColor = useThemeColor({}, "text");
  const textSecondaryColor = useThemeColor({}, "textSecondary");
  const primaryColor = useThemeColor({}, "primary");
  const primaryForeground = useThemeColor({}, "primaryForeground");
  const borderColor = useThemeColor({}, "border");

  if (!community) {
    return (
      <View style={{ flex: 1, backgroundColor, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <Text style={{ color: textColor, fontSize: 16 }}>Community not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: primaryColor, borderRadius: 12 }}
        >
          <Text style={{ color: primaryForeground, fontWeight: "600" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 8, marginRight: 8 }}
        >
          <ChevronLeft size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={{ color: textColor, fontSize: 18, fontWeight: "600" }} numberOfLines={1}>
          {community.name}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Community hero */}
        <View
          style={{
            backgroundColor: cardColor,
            borderRadius: 20,
            padding: 24,
            alignItems: "center",
            borderWidth: 1,
            borderColor,
          }}
        >
          <Image
            source={{ uri: community.image }}
            style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#e5e7eb" }}
          />
          <Text style={{ color: textColor, fontSize: 22, fontWeight: "700", marginTop: 14 }}>
            {community.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
            <Users size={18} color={textSecondaryColor} />
            <Text style={{ color: textSecondaryColor, fontSize: 14, marginLeft: 6 }}>
              Community
            </Text>
          </View>
        </View>

        {/* Placeholder content */}
        <View style={{ marginTop: 24 }}>
          <Text style={{ color: textSecondaryColor, fontSize: 14 }}>
            Community feed and settings can go here.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
