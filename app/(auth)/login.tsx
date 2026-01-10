import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[theme];

  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const primaryColor = useThemeColor({}, 'primary');
  const borderColor = useThemeColor({}, 'border');
  const inputBackground = useThemeColor({}, 'input');
  const placeholderColor = useThemeColor({}, 'placeholder');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const emailFocusScale = useSharedValue(1);
  const passwordFocusScale = useSharedValue(1);
  const emailFocused = useSharedValue(0);
  const passwordFocused = useSharedValue(0);

  const emailAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emailFocusScale.value }],
    borderColor: interpolateColor(
      emailFocused.value,
      [0, 1],
      [borderColor, primaryColor]
    ),
  }));

  const passwordAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: passwordFocusScale.value }],
    borderColor: interpolateColor(
      passwordFocused.value,
      [0, 1],
      [borderColor, primaryColor]
    ),
  }));

  const handleEmailFocus = () => {
    emailFocusScale.value = withSpring(1.02, { damping: 15, stiffness: 200 });
    emailFocused.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handleEmailBlur = () => {
    emailFocusScale.value = withSpring(1, { damping: 15, stiffness: 200 });
    emailFocused.value = withSpring(0, { damping: 15, stiffness: 200 });
  };

  const handlePasswordFocus = () => {
    passwordFocusScale.value = withSpring(1.02, { damping: 15, stiffness: 200 });
    passwordFocused.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handlePasswordBlur = () => {
    passwordFocusScale.value = withSpring(1, { damping: 15, stiffness: 200 });
    passwordFocused.value = withSpring(0, { damping: 15, stiffness: 200 });
  };

  const handleLogin = () => {
    // Handle login logic here
    console.log('Login:', { email, password });
    // Navigate to tabs after successful login
    // router.replace('/(tabs)');
  };

  const handleRegisterPress = () => {
    router.push('/(auth)/register');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
            {/* Header */}
            <Animated.View
              entering={FadeInUp.delay(200).duration(600)}
              style={{ marginBottom: 48, alignItems: 'center' }}
            >
              <Text
                style={{
                  fontSize: 36,
                  fontWeight: '700',
                  color: textColor,
                  marginBottom: 12,
                }}
              >
                Welcome Back
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  color: textSecondary,
                  textAlign: 'center',
                }}
              >
                Sign in to continue to PragatiHub
              </Text>
            </Animated.View>

            {/* Form */}
            <View style={{ gap: 20 }}>
              {/* Email Input */}
              <Animated.View entering={FadeInDown.delay(300).duration(600)}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: textColor,
                    marginBottom: 8,
                  }}
                >
                  Email
                </Text>
                <Animated.View
                  style={[
                    {
                      backgroundColor: inputBackground,
                      borderRadius: 12,
                      borderWidth: 2,
                      paddingHorizontal: 16,
                      paddingVertical: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                    },
                    emailAnimatedStyle,
                  ]}
                >
                  <TextInput
                    style={{
                      flex: 1,
                      fontSize: 16,
                      color: textColor,
                    }}
                    placeholder="Enter your email"
                    placeholderTextColor={placeholderColor}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={handleEmailFocus}
                    onBlur={handleEmailBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Animated.View>
              </Animated.View>

              {/* Password Input */}
              <Animated.View entering={FadeInDown.delay(400).duration(600)}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: textColor,
                    marginBottom: 8,
                  }}
                >
                  Password
                </Text>
                <Animated.View
                  style={[
                    {
                      backgroundColor: inputBackground,
                      borderRadius: 12,
                      borderWidth: 2,
                      paddingHorizontal: 16,
                      paddingVertical: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                    },
                    passwordAnimatedStyle,
                  ]}
                >
                  <TextInput
                    style={{
                      flex: 1,
                      fontSize: 16,
                      color: textColor,
                    }}
                    placeholder="Enter your password"
                    placeholderTextColor={placeholderColor}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={handlePasswordFocus}
                    onBlur={handlePasswordBlur}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </Animated.View>
              </Animated.View>

              {/* Forgot Password */}
              <Animated.View
                entering={FadeInDown.delay(500).duration(600)}
                style={{ alignItems: 'flex-end' }}
              >
                <TouchableOpacity>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: primaryColor,
                    }}
                  >
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              {/* Login Button */}
              <Animated.View entering={FadeInDown.delay(600).duration(600)} style={{ marginTop: 8 }}>
                <TouchableOpacity
                  onPress={handleLogin}
                  style={{
                    backgroundColor: primaryColor,
                    borderRadius: 12,
                    paddingVertical: 16,
                    alignItems: 'center',
                    shadowColor: primaryColor,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: '#ffffff',
                    }}
                  >
                    Sign In
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Register Link */}
            <Animated.View
              entering={FadeInUp.delay(700).duration(600)}
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginTop: 32,
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 14, color: textSecondary }}>
                Don't have an account?
              </Text>
              <TouchableOpacity onPress={handleRegisterPress}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: primaryColor,
                  }}
                >
                  Sign Up
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
