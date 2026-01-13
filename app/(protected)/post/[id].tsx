import { useThemeColor } from "@/hooks/use-theme-color";
import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function DetailedPost() {
  const { id } = useLocalSearchParams();
  const textColor = useThemeColor({}, "text");
  return (
    <>
      <View>
        <Text style={{ color: textColor }}>Detailed Post {id}</Text>
      </View>
    </>
  );
}
