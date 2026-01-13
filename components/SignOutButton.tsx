import { Colors } from "@/constants/theme";
import { useAuth } from "@clerk/clerk-expo";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
} from "react-native";

export const SignOutButton = () => {
  const { signOut } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: theme.primary }]}
      onPress={() => signOut()}
    >
      <Text style={[styles.text, { color: theme.primaryForeground }]}>
        Sign Out
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: "flex-start", // vital for content width
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
});
