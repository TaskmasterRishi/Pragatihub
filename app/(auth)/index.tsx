import FloatingIconsBackground from "@/components/floating-icons-background";
import InputField from "@/components/ui/input-field";
import { useThemeColor } from "@/hooks/use-theme-color";
import { syncUserToSupabase } from "@/lib/actions/users";
import { setSupabaseAccessTokenProvider } from "@/lib/Supabase";
import { useWarmUpBrowser } from "@/hooks/useWarmUpBrowser";
import { useAuth, useOAuth, useSignIn, useSignUp } from "@clerk/clerk-expo";
import * as AuthSession from "expo-auth-session";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

type AuthMode = "login" | "register" | "verify";
type ClientTrustStrategy = "email_code" | "phone_code";
const POST_AUTH_ROUTE = "/";
const OAUTH_CALLBACK_PATH = "oauth-native-callback";

/* -------------------- ERROR NORMALIZER -------------------- */
const getClerkErrorMessage = (err: any): string => {
  if (err?.errors?.length) {
    return (
      err.errors[0].longMessage ||
      err.errors[0].message ||
      "Something went wrong"
    );
  }
  return err?.message || "Unexpected error occurred";
};

const pickClientTrustStrategy = (
  attempt: any,
): ClientTrustStrategy | null => {
  const factors = attempt?.supportedSecondFactors;
  if (!Array.isArray(factors)) return null;

  if (factors.some((factor) => factor?.strategy === "email_code")) {
    return "email_code";
  }

  if (factors.some((factor) => factor?.strategy === "phone_code")) {
    return "phone_code";
  }

  return null;
};

export default function AuthScreen() {
  const { isSignedIn, getToken } = useAuth();
  useWarmUpBrowser();
  const router = useRouter();
  const primaryColor = useThemeColor({}, "primary");
  const {
    signIn,
    setActive: setSignInActive,
    isLoaded: isSignInLoaded,
  } = useSignIn();
  const {
    isLoaded: isSignUpLoaded,
    signUp,
    setActive: setSignUpActive,
  } = useSignUp();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });

  const [mode, setMode] = useState<AuthMode | "clientTrust">("login");
  const [clientTrustStrategy, setClientTrustStrategy] =
    useState<ClientTrustStrategy | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string>("");

  // Form State
  const [name, setName] = useState(""); // Username for Clerk
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState(""); // Verification code

  // Animation values
  const formOpacity = useSharedValue(1);
  const headerOpacity = useSharedValue(1);
  const bottomTextOpacity = useSharedValue(1);

  const toggleMode = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    // Fade out
    formOpacity.value = withTiming(0, { duration: 200 });
    headerOpacity.value = withTiming(0, { duration: 200 });
    bottomTextOpacity.value = withTiming(0, { duration: 200 });

    setTimeout(() => {
      setMode(mode === "login" ? "register" : "login");
      setError(""); // Clear errors when switching modes
      // Clear form sensitive data but keep email if possible? No, clear all for safety/cleanliness
      // setName("");
      // setEmail("");
      // setPassword("");
      // setConfirmPassword("");
      // setCode("");

      // Fade in
      formOpacity.value = withTiming(1, { duration: 300 });
      headerOpacity.value = withTiming(1, { duration: 300 });
      bottomTextOpacity.value = withTiming(1, { duration: 300 });

      setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
    }, 200);
  };

  const formAnimatedStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    pointerEvents: formOpacity.value > 0.5 ? "auto" : "none",
  }));

  const buttonContainerStyle = useAnimatedStyle(() => {
    const opacity = formOpacity.value;
    return {
      opacity,
      overflow: opacity > 0.15 ? "visible" : "hidden",
    };
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const bottomTextAnimatedStyle = useAnimatedStyle(() => ({
    opacity: bottomTextOpacity.value,
    pointerEvents: bottomTextOpacity.value > 0.5 ? "auto" : "none",
  }));

  /* -------------------- HANDLERS -------------------- */

  const onSignInPress = async () => {
    try {
      if (!isSignInLoaded) throw new Error("Auth not ready");
      const identifier = email.trim();
      if (!identifier) throw new Error("Please enter your email");
      if (!password) throw new Error("Please enter your password");

      const attempt = await signIn.create({
        identifier,
        password,
      });

      if (attempt.status === "complete" && attempt.createdSessionId) {
        await setSignInActive({ session: attempt.createdSessionId });
        router.replace(POST_AUTH_ROUTE);
        return;
      }

      // Some Clerk flows return an intermediate state first, then require explicit first-factor completion.
      if (attempt.status === "needs_first_factor") {
        const firstFactorAttempt = await signIn.attemptFirstFactor({
          strategy: "password",
          password,
        });

        if (
          firstFactorAttempt.status === "complete" &&
          firstFactorAttempt.createdSessionId
        ) {
          await setSignInActive({ session: firstFactorAttempt.createdSessionId });
          router.replace(POST_AUTH_ROUTE);
          return;
        }
      }

      if (attempt.status === "needs_client_trust") {
        const strategy = pickClientTrustStrategy(attempt);
        if (!strategy) {
          throw new Error(
            "This sign-in needs device verification, but no supported verification method is available.",
          );
        }

        await signIn.prepareSecondFactor({ strategy } as any);
        setClientTrustStrategy(strategy);
        setCode("");
        setMode("clientTrust");
        return;
      }

      throw new Error(
        `Login incomplete (${attempt.status}). Please try again.`,
      );
    } catch (err) {
      throw new Error(getClerkErrorMessage(err));
    }
  };

  const onSignUpPress = async () => {
    try {
      if (!isSignUpLoaded) throw new Error("Auth not ready");
      if (password !== confirmPassword)
        throw new Error("Passwords do not match");

      await signUp.create({
        username: name,
        emailAddress: email,
        password,
      });

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setMode("verify");
    } catch (err) {
      throw new Error(getClerkErrorMessage(err));
    }
  };

  const onVerifyPress = async () => {
    try {
      if (!isSignUpLoaded) throw new Error("Auth not ready");

      const attempt = await signUp.attemptEmailAddressVerification({ code });

      if (attempt.status !== "complete") {
        throw new Error("Invalid verification code");
      }

      await setSignUpActive({ session: attempt.createdSessionId });

      const template = process.env.EXPO_PUBLIC_CLERK_SUPABASE_TEMPLATE ?? "supabase";
      setSupabaseAccessTokenProvider(async () => {
        const token = await getToken({ template });
        return token ?? null;
      });

      const createdUserId =
        attempt.createdUserId ?? signUp.createdUserId ?? signUp.id;
      if (createdUserId && email.trim().length > 0) {
        const displayName = name.trim().length > 0 ? name.trim() : "Anonymous";
        const { error: syncError } = await syncUserToSupabase({
          id: createdUserId,
          email: email.trim(),
          name: displayName,
          image: null,
        });
        if (syncError) {
          console.log("Post-signup user sync error:", syncError);
        }
      }

      router.replace(POST_AUTH_ROUTE);
    } catch (err) {
      throw new Error(getClerkErrorMessage(err));
    }
  };

  const onClientTrustVerifyPress = async () => {
    try {
      if (!isSignInLoaded) throw new Error("Auth not ready");
      if (!clientTrustStrategy) {
        throw new Error("Verification method unavailable. Please sign in again.");
      }

      const trimmedCode = code.trim();
      if (!trimmedCode) {
        throw new Error("Please enter the verification code.");
      }

      const attempt = await signIn.attemptSecondFactor({
        strategy: clientTrustStrategy,
        code: trimmedCode,
      } as any);

      if (attempt.status === "complete" && attempt.createdSessionId) {
        await setSignInActive({ session: attempt.createdSessionId });
        router.replace(POST_AUTH_ROUTE);
        return;
      }

      throw new Error(`Verification incomplete (${attempt.status}).`);
    } catch (err) {
      throw new Error(getClerkErrorMessage(err));
    }
  };

  const onGoogleSignInPress = useCallback(async () => {
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        path: OAUTH_CALLBACK_PATH,
      });
      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl,
      });
      if (!createdSessionId) throw new Error("OAuth failed");

      await setActive?.({ session: createdSessionId });
      router.replace(POST_AUTH_ROUTE);
    } catch (err) {
      throw new Error(getClerkErrorMessage(err));
    }
  }, [router, startOAuthFlow]);

  const handleSubmit = async () => {
    try {
      setError("");
      if (mode === "login") await onSignInPress();
      if (mode === "register") await onSignUpPress();
      if (mode === "verify") await onVerifyPress();
      if (mode === "clientTrust") await onClientTrustVerifyPress();
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    }
  };

  const clearError = () => error && setError("");

  const handleNameChange = (text: string) => {
    setName(text);
    clearError();
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    clearError();
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    clearError();
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    clearError();
  };

  const handleCodeChange = (text: string) => {
    setCode(text);
    clearError();
  };

  if (isSignedIn) {
    return <Redirect href={POST_AUTH_ROUTE} />;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Gradient Background */}
      <LinearGradient
        colors={["#3B82F6", "#2B2F77", "#070B34"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Floating Icons Background */}
      <FloatingIconsBackground />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingVertical: 20 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                paddingHorizontal: 24,
                zIndex: 1,
              }}
            >
              {/* Header */}
              <Animated.View
                style={[
                  { marginBottom: 40, alignItems: "center" },
                  headerAnimatedStyle,
                ]}
              >
                <Text
                  style={{
                    fontSize: 36,
                    fontWeight: "700",
                    color: "#ffffff",
                    marginBottom: 12,
                  }}
                >
                  {mode === "login"
                    ? "Welcome Back"
                    : mode === "register"
                      ? "Create Account"
                      : mode === "verify"
                        ? "Verify Email"
                        : "Verify Device"}
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: "#ffffff",
                    textAlign: "center",
                    opacity: 0.9,
                  }}
                >
                  {mode === "login"
                    ? "Sign in to continue to PragatiHub"
                    : mode === "register"
                      ? "Join PragatiHub and start your journey"
                      : mode === "verify"
                        ? "Enter the code sent to your email"
                        : `Enter the ${clientTrustStrategy === "phone_code" ? "SMS" : "email"} code to trust this device`}
                </Text>
              </Animated.View>

              {/* Form */}
              <Animated.View style={[{ gap: 16 }, formAnimatedStyle]}>
                {error && (
                  <View
                    style={{
                      backgroundColor: "rgba(239,68,68,0.2)",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <Text style={{ color: "#FEE2E2", textAlign: "center" }}>
                      {error}
                    </Text>
                  </View>
                )}

                {mode === "verify" || mode === "clientTrust" ? (
                  // VERIFY FORM
                  <View>
                    <InputField
                      label="Verification Code"
                      placeholder="Enter code"
                      value={code}
                      onChangeText={handleCodeChange}
                      keyboardType="number-pad"
                      variant="gradient"
                    />
                  </View>
                ) : (
                  // LOGIN / REGISTER FORM
                  <>
                    {/* Name Input - Only for Register */}
                    {mode === "register" && (
                      <View>
                        <InputField
                          label="Username"
                          placeholder="Enter your username"
                          value={name}
                          onChangeText={handleNameChange}
                          autoCapitalize="none"
                          autoCorrect={false}
                          variant="gradient"
                        />
                      </View>
                    )}

                    {/* Email Input */}
                    <View>
                      <InputField
                        label="Email"
                        placeholder="Enter your email"
                        value={email}
                        onChangeText={handleEmailChange}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        variant="gradient"
                      />
                    </View>

                    {/* Password Input */}
                    <View>
                      <InputField
                        label="Password"
                        placeholder={
                          mode === "login"
                            ? "Enter your password"
                            : "Create a password"
                        }
                        value={password}
                        onChangeText={handlePasswordChange}
                        secureTextEntry
                        autoCapitalize="none"
                        variant="gradient"
                      />
                    </View>

                    {/* Confirm Password Input - Only for Register */}
                    {mode === "register" && (
                      <View>
                        <InputField
                          label="Confirm Password"
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChangeText={handleConfirmPasswordChange}
                          secureTextEntry
                          autoCapitalize="none"
                          variant="gradient"
                        />
                      </View>
                    )}
                  </>
                )}

                {/* Forgot Password - Only for Login */}
                {mode === "login" && (
                  <View style={{ alignItems: "flex-end" }}>
                    <TouchableOpacity>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: "#ffffff",
                        }}
                      >
                        Forgot Password?
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Submit Button */}
                <Animated.View
                  style={[
                    {
                      marginTop: 8,
                    },
                    buttonContainerStyle,
                  ]}
                >
                  <View
                    style={{
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 8,
                    }}
                  >
                    <TouchableOpacity
                      onPress={handleSubmit}
                      disabled={isTransitioning}
                      style={{
                        backgroundColor: "#ffffff",
                        borderRadius: 12,
                        paddingVertical: 16,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: primaryColor,
                        }}
                      >
                        {mode === "login"
                          ? "Sign In"
                          : mode === "register"
                            ? "Create Account"
                            : mode === "verify"
                              ? "Verify"
                              : "Verify Device"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>

                {/* Google Sign In - Only shown in Login/Register, not Verify */}
                {mode !== "verify" && mode !== "clientTrust" && (
                  <TouchableOpacity
                    onPress={async () => {
                      setError("");
                      try {
                        await onGoogleSignInPress();
                      } catch (e: any) {
                        setError(e?.message ?? "Something went wrong");
                      }
                    }}
                    disabled={isTransitioning}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      paddingVertical: 16,
                      alignItems: "center",
                      marginTop: 10,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.2)",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#ffffff",
                      }}
                    >
                      {mode === "login"
                        ? "Sign in with Google"
                        : "Sign up with Google"}
                    </Text>
                  </TouchableOpacity>
                )}
              </Animated.View>

              {/* Toggle Link */}
              {mode !== "verify" && mode !== "clientTrust" && (
                <Animated.View
                  style={[
                    {
                      flexDirection: "row",
                      justifyContent: "center",
                      marginTop: 24,
                      gap: 4,
                    },
                    bottomTextAnimatedStyle,
                  ]}
                >
                  <Text
                    style={{ fontSize: 14, color: "#ffffff", opacity: 0.9 }}
                  >
                    {mode === "login"
                      ? "Don't have an account? "
                      : "Already have an account? "}
                  </Text>
                  <TouchableOpacity
                    onPress={toggleMode}
                    disabled={isTransitioning}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: "#ffffff",
                        opacity: isTransitioning ? 0.5 : 1,
                      }}
                    >
                      {mode === "login" ? "Sign Up" : "Sign In"}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Back to Login from Verify */}
              {(mode === "verify" || mode === "clientTrust") && (
                <TouchableOpacity
                  onPress={() => {
                    setMode("login");
                    setClientTrustStrategy(null);
                    setCode("");
                    setError("");
                  }}
                  style={{ marginTop: 20, alignItems: "center" }}
                >
                  <Text style={{ color: "white", fontWeight: "600" }}>
                    Back to Sign In
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
