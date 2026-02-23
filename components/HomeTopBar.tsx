import { BlurView } from "expo-blur";
import { Search } from "lucide-react-native";
import React from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColor } from "@/hooks/use-theme-color";

type HomeTopBarProps = {
  searchQuery: string;
  onChangeSearchQuery: (value: string) => void;
};

const toRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  if (!/^[A-Fa-f0-9]{6}$/.test(normalized)) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function HomeTopBar({
  searchQuery,
  onChangeSearchQuery,
}: HomeTopBarProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const text = useThemeColor({}, "text");
  const border = useThemeColor({}, "border");
  const input = useThemeColor({}, "input");
  const placeholder = useThemeColor({}, "placeholder");
  const tabBarBackground = useThemeColor({}, "tabBarBackground");
  const tabBarBorder = useThemeColor({}, "tabBarBorder");

  const glassBorder = toRgba(tabBarBorder, isDark ? 0.34 : 0.28);
  // overlayColor must be "transparent" — any colour here tints over the blur
  const overlayColor = "transparent";

  // Web: BlurView doesn't work, use a div with backdropFilter
  if (Platform.OS === "web") {
    return (
      <View
        style={[
          styles.container,
          {
            borderColor: glassBorder,
            backgroundColor: isDark
              ? "rgba(0,0,0,0.45)"
              : "rgba(255,255,255,0.45)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          } as any,
        ]}
      >
        <Inner
          text={text}
          border={border}
          input={input}
          placeholder={placeholder}
          searchQuery={searchQuery}
          onChangeSearchQuery={onChangeSearchQuery}
        />
      </View>
    );
  }

  // Native: BlurView IS the root — this is the only way it works
  return (
    <BlurView
      intensity={60}
      tint={isDark ? "dark" : "light"}
      experimentalBlurMethod="dimezisBlurView"
      {...({ overlayColor: overlayColor } as any)}
      style={[styles.container, { paddingTop: 20, borderColor: glassBorder }]}
    >
      <Inner
        text={text}
        border={border}
        input={input}
        placeholder={placeholder}
        searchQuery={searchQuery}
        onChangeSearchQuery={onChangeSearchQuery}
      />
    </BlurView>
  );
}

type InnerProps = {
  text: string;
  border: string;
  input: string;
  placeholder: string;
  searchQuery: string;
  onChangeSearchQuery: (v: string) => void;
};

function Inner({
  text,
  border,
  input,
  placeholder,
  searchQuery,
  onChangeSearchQuery,
}: InnerProps) {
  return (
    <View style={styles.content}>
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
          { backgroundColor: `${input}66`, borderColor: `${border}66` },
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  content: {
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 12,
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
