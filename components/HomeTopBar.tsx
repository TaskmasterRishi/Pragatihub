import { Search } from "lucide-react-native";
import React from "react";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";

type HomeTopBarProps = {
  searchQuery: string;
  onChangeSearchQuery: (value: string) => void;
};

export default function HomeTopBar({
  searchQuery,
  onChangeSearchQuery,
}: HomeTopBarProps) {
  const text = useThemeColor({}, "text");
  const border = useThemeColor({}, "border");
  const input = useThemeColor({}, "input");
  const placeholder = useThemeColor({}, "placeholder");

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.logo}
        />
        <Text style={[styles.brandText, { color: text }]}>PragatiHub</Text>
      </View>

      <View
        style={[
          styles.searchWrapper,
          { backgroundColor: input, borderColor: `${border}cc` },
        ]}
      >
        <Search size={18} color={placeholder} />
        <TextInput
          value={searchQuery}
          onChangeText={onChangeSearchQuery}
          placeholder="Search posts"
          placeholderTextColor={placeholder}
          style={[styles.searchInput, { color: text }]}
          returnKeyType="search"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  brandText: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
});
