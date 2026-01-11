import ActivityLoader from "@/components/activity-loader";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function InboxScreen() {
  const [isFocused, setIsFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? "dark" : "light";

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primaryColor = useThemeColor({}, "primary");
  const cardBackground = useThemeColor({}, "card");

  if (!isFocused) {
    return <ActivityLoader />;
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor }}
      edges={["top", "bottom"]}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        <View>
          <Text style={{ color: textColor }}>Inbox Screen</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
