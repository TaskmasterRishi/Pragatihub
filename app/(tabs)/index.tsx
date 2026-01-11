import { useThemeColor } from "@/hooks/use-theme-color";
import { ScrollView, Text, View } from "react-native";

export default function HomeScreen() {
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 120, // space for floating tab bar
        }}
      >
        <Text style={{ color: textColor, fontSize: 18 }}>
          Home Screen
        </Text>
      </ScrollView>
    </View>
  );
}
