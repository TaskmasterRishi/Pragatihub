import OnboardingScreen from "@/components/onboarding-screen";
import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";

export default function OnboardingIndex() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <Redirect href={"/(protected)/(tabs)"} />;
  } else if (!isSignedIn) {
    return <Redirect href={"../(auth)"} />;
  }

  return <OnboardingScreen />;
}
