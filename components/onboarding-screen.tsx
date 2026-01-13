import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  hasCompletedOnboarding,
  setOnboardingCompleted,
} from "@/utils/onboarding-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Extrapolate,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// --- auth check addition ---
import { useAuth } from "@clerk/clerk-expo"; // or your actual auth hook

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface OnboardingSlide {
  title: string;
  subtitle: string;
  image: any;
}

// Gradient colors for each screen
const gradientColors = [
  { start: "#FF6B9D", end: "#A855F7" }, // Pink to Purple - Screen 1
  { start: "#3B82F6", end: "#A855F7" }, // Blue to Purple - Screen 2
  { start: "#3B82F6", end: "#06B6D4" }, // Blue to Cyan - Screen 3
];

const slides: OnboardingSlide[] = [
  {
    title: "Learn Together",
    subtitle:
      "Join a community of people building skills, sharing knowledge, and growing side by side.",
    image: require("@/assets/onBoarding/image1.png"),
  },
  {
    title: "Build Through Collaboration",
    subtitle:
      "Discuss ideas, practice skills, and work on projects with people who share your goals.",
    image: require("@/assets/onBoarding/image2.png"),
  },
  {
    title: "Grow Your Potential",
    subtitle:
      "Turn learning into progress and become part of something bigger with PragatiHub.",
    image: require("@/assets/onBoarding/image3.png"),
  },
];

const Slide = ({
  slide,
  index,
  scrollX,
}: {
  slide: OnboardingSlide;
  index: number;
  scrollX: any;
}) => {
  const animatedImageStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.8, 1, 0.8],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.5, 1, 0.5],
      Extrapolate.CLAMP
    );

    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [50, 0, 50],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ scale }, { translateY }],
      opacity,
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolate.CLAMP
    );

    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [30, 0, -30],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <View
      key={index}
      style={{
        width: SCREEN_WIDTH,
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
        backgroundColor: "transparent",
      }}
    >
      {/* Image Container */}
      <Animated.View
        style={[
          {
            width: SCREEN_WIDTH * 0.85,
            height: SCREEN_HEIGHT * 0.5,
            marginBottom: 40,
            alignItems: "center",
            justifyContent: "center",
          },
          animatedImageStyle,
        ]}
      >
        <Image
          source={slide.image}
          style={{
            width: "100%",
            height: "100%",
            resizeMode: "contain",
          }}
        />
      </Animated.View>

      {/* Text Content */}
      <Animated.View
        style={[
          {
            alignItems: "center",
            paddingHorizontal: 20,
          },
          animatedTextStyle,
        ]}
      >
        <Text
          style={{
            fontSize: 32,
            fontWeight: "700",
            color: "#ffffff",
            textAlign: "center",
            marginBottom: 16,
            lineHeight: 40,
          }}
        >
          {slide.title}
        </Text>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "400",
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 24,
            maxWidth: SCREEN_WIDTH * 0.9,
            opacity: 0.9,
          }}
        >
          {slide.subtitle}
        </Text>
      </Animated.View>
    </View>
  );
};

export default function OnboardingScreen() {
  // --- auth check addition ---
  const { isSignedIn, isLoaded } = useAuth
    ? useAuth()
    : { isSignedIn: false, isLoaded: true };
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? "dark" : "light";
  const colors = Colors[theme];

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primaryColor = useThemeColor({}, "primary");

  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const buttonWidth = useSharedValue(56); // Arrow button
  const buttonHeight = useSharedValue(56);
  const buttonRadius = useSharedValue(28);
  const iconOpacity = useSharedValue(1);
  const iconRotation = useSharedValue(0);

  // --- auth check addition with redirect ---
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/(protected)/(tabs)");
    }
  }, [isLoaded, isSignedIn]);

  // Check if onboarding is already completed
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      const completed = await hasCompletedOnboarding();
      if (completed) {
        if (isSignedIn) {
          router.replace("/(protected)/(tabs)");
        } else {
          router.replace("/(auth)");
        }
      }
    };
    checkOnboardingStatus();
  }, [isSignedIn, router]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const handleMomentumScrollEnd = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const handleSkip = async () => {
    await setOnboardingCompleted();
    if (isSignedIn) {
      router.replace("/(protected)/(tabs)");
    } else {
      router.replace("/(auth)");
    }
  };

  const handleGetStarted = async () => {
    await setOnboardingCompleted();
    if (isSignedIn) {
      router.replace("/(protected)/(tabs)");
    } else {
      router.replace("/(auth)");
    }
  };

  const scrollToNext = () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
    }
  };

  const handleArrowPress = async () => {
    if (currentIndex === slides.length - 1) {
      await handleGetStarted();
    } else {
      scrollToNext();
    }
  };

  // Animated style for the arrow/button container
  const arrowButtonAnimatedStyle = useAnimatedStyle(() => ({
    width: buttonWidth.value,
    height: buttonHeight.value,
    borderRadius: buttonRadius.value,
  }));

  const arrowIconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ rotate: `${iconRotation.value}deg` }],
  }));

  const getStartedTextAnimatedStyle = useAnimatedStyle(() => {
    const minWidth = 56;
    const maxWidth = SCREEN_WIDTH / 2;
    const progress = Math.max(
      0,
      Math.min(1, (buttonWidth.value - minWidth) / (maxWidth - minWidth))
    );
    const textProgress = Math.max(0, Math.min(1, (progress - 0.3) / 0.4));
    return {
      opacity: textProgress,
      transform: [{ scale: 0.8 + textProgress * 0.2 }],
    };
  });

  useEffect(() => {
    if (currentIndex === slides.length - 1) {
      const getStartedWidth = SCREEN_WIDTH / 2;
      buttonWidth.value = withSpring(getStartedWidth, {
        damping: 20,
        stiffness: 100,
      });
      buttonHeight.value = withSpring(56, { damping: 20, stiffness: 100 });
      buttonRadius.value = withSpring(28, { damping: 20, stiffness: 100 });
      iconRotation.value = withTiming(90, { duration: 300 });
      iconOpacity.value = withTiming(0, { duration: 300 });
    } else {
      buttonWidth.value = withTiming(56, { duration: 300 });
      buttonHeight.value = withTiming(56, { duration: 300 });
      buttonRadius.value = withTiming(28, { duration: 300 });
      iconRotation.value = withTiming(0, { duration: 250 });
      iconOpacity.value = withTiming(1, { duration: 250 });
    }
  }, [currentIndex]);

  // Create animated gradient overlay layers for smooth transitions
  const GradientLayer = ({ index }: { index: number }) => {
    const opacityStyle = useAnimatedStyle(() => {
      const inputRange = [
        (index - 1) * SCREEN_WIDTH,
        index * SCREEN_WIDTH,
        (index + 1) * SCREEN_WIDTH,
      ];
      const slideOpacity = interpolate(
        scrollX.value,
        inputRange,
        [0, 1, 0],
        Extrapolate.CLAMP
      );
      return { opacity: slideOpacity };
    });

    return (
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          },
          opacityStyle,
        ]}
      >
        <LinearGradient
          colors={[gradientColors[index].start, gradientColors[index].end]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    );
  };

  // --- show loading indicator while auth is loading ---
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Animated Gradient Background Layers - Full Screen */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
        }}
      >
        {slides.map((_, index) => (
          <GradientLayer key={index} index={index} />
        ))}
      </View>

      <SafeAreaView
        style={{ flex: 1, zIndex: 1, backgroundColor: "transparent" }}
        edges={["top", "bottom"]}
      >
        {/* Skip Button */}
        {currentIndex < slides.length - 1 && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            style={{
              position: "absolute",
              top: 50,
              right: 24,
              zIndex: 10,
            }}
          >
            <TouchableOpacity
              onPress={handleSkip}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#ffffff",
                }}
              >
                Skip
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <Animated.ScrollView
          style={{ zIndex: 1, backgroundColor: "transparent" }}
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH}
          snapToAlignment="center"
          contentContainerStyle={{
            alignItems: "center",
          }}
        >
          {slides.map((slide, index) => (
            <Slide key={index} slide={slide} index={index} scrollX={scrollX} />
          ))}
        </Animated.ScrollView>

        {/* Arrow / Get Started Button - Bottom Center */}
        <Animated.View
          style={[
            {
              position: "absolute",
              bottom: 60,
              alignSelf: "center",
              zIndex: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#1E4499",
              shadowColor: primaryColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
              overflow: "hidden",
            },
            arrowButtonAnimatedStyle,
          ]}
        >
          <TouchableOpacity
            onPress={handleArrowPress}
            style={{
              width: "100%",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              paddingHorizontal: 24,
              gap: 8,
            }}
            activeOpacity={0.8}
          >
            {/* Arrow Icon */}
            <Animated.View
              style={[
                {
                  position: "absolute",
                  alignItems: "center",
                  justifyContent: "center",
                },
                arrowIconAnimatedStyle,
              ]}
            >
              <MaterialIcons name="arrow-forward" size={24} color="#ffffff" />
            </Animated.View>

            {/* Get Started Text */}
            <Animated.View
              style={[
                {
                  position: "absolute",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                },
                getStartedTextAnimatedStyle,
              ]}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: "#ffffff",
                }}
                numberOfLines={1}
              >
                Get Started
              </Text>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
