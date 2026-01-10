import { useThemeColor } from '@/hooks/use-theme-color';
import React, { useState } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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
  const primaryColor = useThemeColor({}, 'primary');
  const borderColor = useThemeColor({}, 'border');
  const inputBackground = useThemeColor({}, 'input');
  const placeholderColor = useThemeColor({}, 'placeholder');

  const [isFocused, setIsFocused] = useState(false);

  // For gradient variant, use semi-transparent white background
  const backgroundColor = variant === 'gradient' 
    ? 'rgba(255, 255, 255, 0.20)' 
    : inputBackground;
  const labelColor = variant === 'gradient' ? '#ffffff' : textColor;
  const inputTextColor = variant === 'gradient' ? '#ffffff' : textColor;
  const inputPlaceholderColor = variant === 'gradient' 
    ? 'rgba(255, 255, 255, 0.8)' 
    : placeholderColor;
  const defaultBorderColor = variant === 'gradient' 
    ? 'rgba(255, 255, 255, 0.25)' 
    : borderColor;
  const focusedBorderColor = variant === 'gradient' 
    ? '#ffffff' 
    : primaryColor;

  const borderOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      borderOpacity.value,
      [0, 1],
      [defaultBorderColor, focusedBorderColor]
    ),
  }));

  const handleFocus = () => {
    setIsFocused(true);
    borderOpacity.value = withTiming(1, { duration: 200 });
  };

  const handleBlur = () => {
    setIsFocused(false);
    borderOpacity.value = withTiming(0, { duration: 200 });
  };

  return (
    <View style={containerStyle}>
      {label && (
        <Text
          style={{
            fontSize: 13,
            fontWeight: '500',
            color: labelColor,
            marginBottom: 6,
            opacity: variant === 'gradient' ? 0.9 : 1,
          }}
        >
          {label}
        </Text>
      )}
      <Animated.View
        style={[
          {
            backgroundColor: backgroundColor,
            borderRadius: 10,
            borderWidth: 1.5,
            paddingHorizontal: 14,
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
            fontSize: 15,
            color: inputTextColor,
            padding: 0,
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
            marginTop: 6,
            marginLeft: 2,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
