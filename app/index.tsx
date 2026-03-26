import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";

export default function RootIndexRoute() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;

  if (isSignedIn) {
    return <Redirect href="/(protected)/(tabs)" />;
  }

  return <Redirect href="/(auth)" />;
}
