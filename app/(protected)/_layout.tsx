import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AppLayout() {
  const { isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();

  if (!isSignedIn) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top}}>
      <Stack screenOptions={{ headerShown: false }} >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="post/[id]" options={{animation:"fade_from_bottom"}}/>
      </Stack>
    </View>
  );
}
