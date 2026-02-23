import React from "react";
import {
  ActivityIndicator,
  ActivityIndicatorProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";

type AppLoaderProps = {
  size?: ActivityIndicatorProps["size"];
  color?: string;
  centered?: boolean;
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function AppLoader({
  size = "small",
  color,
  centered = true,
  fullScreen = false,
  style,
}: AppLoaderProps) {
  const fallbackColor = useThemeColor({}, "textSecondary");
  const spinner = (
    <ActivityIndicator size={size} color={color ?? fallbackColor} />
  );

  if (!centered) return spinner;

  return (
    <View style={[styles.center, fullScreen && styles.fullScreen, style]}>
      {spinner}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  fullScreen: {
    flex: 1,
  },
});
