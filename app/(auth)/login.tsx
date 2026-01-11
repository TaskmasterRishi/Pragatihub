import FloatingIconsBackground from "@/components/floating-icons-background";
import InputField from "@/components/ui/input-field";
import { AuthMode } from "@/constants/types";
import { useThemeColor } from "@/hooks/use-theme-color";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function AuthScreen() {
  const router = useRouter();
  const primaryColor = useThemeColor({}, "primary");

  const [mode, setMode] = useState<AuthMode>("login");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Animation values for smooth transitions
  const formOpacity = useSharedValue(1);
  const headerOpacity = useSharedValue(1);
  const bottomTextOpacity = useSharedValue(1);

  const toggleMode = () => {
    if (isTransitioning) return; // Prevent rapid toggling

    setIsTransitioning(true);

    // Fade out
    formOpacity.value = withTiming(0, { duration: 200 });
    headerOpacity.value = withTiming(0, { duration: 200 });
    bottomTextOpacity.value = withTiming(0, { duration: 200 });

    // After animation, switch mode and fade in
    setTimeout(() => {
      setMode(mode === "login" ? "register" : "login");
      // Clear form when switching
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      // Fade in
      formOpacity.value = withTiming(1, { duration: 300 });
      headerOpacity.value = withTiming(1, { duration: 300 });
      bottomTextOpacity.value = withTiming(1, { duration: 300 });

      // Re-enable interactions after animation completes
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
    // Use overflow hidden when opacity is very low to clip shadow completely
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

  const handleSubmit = () => {
    if (mode === "login") {
      console.log("Login:", { email, password });
      // router.replace('/(tabs)');
    } else {
      console.log("Register:", { name, email, password, confirmPassword });
      // router.replace('/(tabs)');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Gradient Background */}
      <LinearGradient
        colors={["#3B82F6", "#2B2F77", "#070B34"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
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
                  {mode === "login" ? "Welcome Back" : "Create Account"}
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
                    : "Join PragatiHub and start your journey"}
                </Text>
              </Animated.View>

              {/* Form */}
              <Animated.View style={[{ gap: 16 }, formAnimatedStyle]}>
                {/* Name Input - Only for Register */}
                {mode === "register" && (
                  <View>
                    <InputField
                      label="Full Name"
                      placeholder="Enter your full name"
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
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
                    onChangeText={setEmail}
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
                    onChangeText={setPassword}
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
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      variant="gradient"
                    />
                  </View>
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
                        {mode === "login" ? "Sign In" : "Create Account"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </Animated.View>

              {/* Toggle Link */}
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
                <Text style={{ fontSize: 14, color: "#ffffff", opacity: 0.9 }}>
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
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
