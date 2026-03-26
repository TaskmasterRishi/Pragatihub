import { BlurView } from "expo-blur";
import { Search } from "lucide-react-native";
import React from "react";
import {
  Animated,
  Easing,
  Image,
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";
import { useTabBarVisibility } from "@/utils/tabBarVisibility";

type HomeTopBarProps = {
  searchQuery: string;
  onChangeSearchQuery: (value: string) => void;
};

const TOP_BAR_HIDDEN_TRANSLATE_Y = -85;
const HIDE_SHOW_EASING = Easing.bezier(0.22, 0.61, 0.36, 1);

export default function HomeTopBar({
  searchQuery,
  onChangeSearchQuery,
}: HomeTopBarProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [androidBlurReady, setAndroidBlurReady] = React.useState(
    Platform.OS !== "android",
  );

  React.useEffect(() => {
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

  const text = useThemeColor({}, "text");
  const border = useThemeColor({}, "border");
  const input = useThemeColor({}, "input");
  const placeholder = useThemeColor({}, "placeholder");
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

  const visible = useTabBarVisibility();
  const transY = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    transY.stopAnimation();
    opacity.stopAnimation();
    Animated.parallel([
      Animated.timing(transY, {
        toValue: visible ? 0 : TOP_BAR_HIDDEN_TRANSLATE_Y,
        duration: visible ? 260 : 220,
        easing: HIDE_SHOW_EASING,
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0.92,
        duration: visible ? 240 : 200,
        easing: HIDE_SHOW_EASING,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]).start();
  }, [opacity, transY, visible]);

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        styles.container,
        {
          paddingTop: 20,
          backgroundColor:
            Platform.OS === "web" ? tabBarBackgroundColor : "transparent",
          ...(Platform.OS === "web"
            ? ({
                backdropFilter: "saturate(140%) blur(18px)",
                WebkitBackdropFilter: "saturate(140%) blur(18px)",
              } as any)
            : {}),
          opacity,
          transform: [{ translateY: transY }],
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
      <Inner
        text={text}
        border={border}
        input={input}
        placeholder={placeholder}
        searchQuery={searchQuery}
        onChangeSearchQuery={onChangeSearchQuery}
      />
    </Animated.View>
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
          { backgroundColor: input, borderColor: border },
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
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: "hidden",
  },
  content: {
    gap: 10,
    paddingBottom: 16,
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
    borderWidth: 0,
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
