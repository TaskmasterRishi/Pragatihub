import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";

export default function OAuthNativeCallbackRoute() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  return <Redirect href="/(auth)" />;
}
