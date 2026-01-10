import React from 'react';
import { TextInput, TextInputProps, View, Text, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useThemeColor } from '@/hooks/use-theme-color';

interface InputFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: any;
  variant?: 'default' | 'gradient';
}

export default function InputField({
  label,
  error,
  containerStyle,
  variant = 'default',
  ...textInputProps
}: InputFieldProps) {
  const textColor = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const primaryColor = useThemeColor({}, 'primary');
  const borderColor = useThemeColor({}, 'border');
  const inputBackground = useThemeColor({}, 'input');
  const placeholderColor = useThemeColor({}, 'placeholder');

  // For gradient variant, use semi-transparent white background
  const backgroundColor = variant === 'gradient' 
    ? 'rgba(255, 255, 255, 0.2)' 
    : inputBackground;
  const labelColor = variant === 'gradient' ? '#ffffff' : textColor;
  const inputTextColor = variant === 'gradient' ? '#ffffff' : textColor;
  const inputPlaceholderColor = variant === 'gradient' 
    ? 'rgba(255, 255, 255, 0.7)' 
    : placeholderColor;
  const defaultBorderColor = variant === 'gradient' 
    ? 'rgba(255, 255, 255, 0.3)' 
    : borderColor;
  const focusedBorderColor = variant === 'gradient' 
    ? '#ffffff' 
    : primaryColor;

  const focusScale = useSharedValue(1);
  const focused = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: focusScale.value }],
    borderColor: interpolateColor(
      focused.value,
      [0, 1],
      [defaultBorderColor, focusedBorderColor]
    ),
  }));

  const handleFocus = () => {
    focusScale.value = withSpring(1.02, { damping: 15, stiffness: 200 });
    focused.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handleBlur = () => {
    focusScale.value = withSpring(1, { damping: 15, stiffness: 200 });
    focused.value = withSpring(0, { damping: 15, stiffness: 200 });
  };

  return (
    <View style={containerStyle}>
      {label && (
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: labelColor,
            marginBottom: 8,
          }}
        >
          {label}
        </Text>
      )}
      <Animated.View
        style={[
          {
            backgroundColor: backgroundColor,
            borderRadius: 12,
            borderWidth: 2,
            paddingHorizontal: 16,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
          },
          animatedStyle,
        ]}
      >
        <TextInput
          style={{
            flex: 1,
            fontSize: 16,
            color: inputTextColor,
          }}
          placeholderTextColor={inputPlaceholderColor}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...textInputProps}
        />
      </Animated.View>
      {error && (
        <Text
          style={{
            fontSize: 12,
            color: '#EF4444',
            marginTop: 4,
            marginLeft: 4,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
