# Theme Documentation

This document explains how to use the custom color scheme in this React Native app with NativeWind.

## Table of Contents
- [Overview](#overview)
- [Theme Structure](#theme-structure)
- [Available Colors](#available-colors)
- [Usage Guide](#usage-guide)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Adding New Colors](#adding-new-colors)

## Overview

The app uses a centralized theme system defined in `constants/theme.ts` that automatically supports both light and dark modes. Colors are accessed dynamically through the `useThemeColor` hook, which ensures your UI adapts to the user's system theme preference.

**Key Points:**
- ✅ Single source of truth: `constants/theme.ts`
- ✅ Automatic light/dark mode switching
- ✅ Type-safe color access
- ✅ Works seamlessly with NativeWind utility classes

## Theme Structure

The theme is organized into two modes:

```typescript
Colors = {
  light: { /* light mode colors */ },
  dark: { /* dark mode colors */ }
}
```

Each mode contains the same color properties but with different values optimized for that theme.

## Available Colors

### Brand Colors
- `primary` - Main brand color (Indigo)
- `primaryForeground` - Text color on primary background
- `secondary` - Secondary brand color (Purple)
- `secondaryForeground` - Text color on secondary background

### Background Colors
- `background` - Main app background
- `backgroundSecondary` - Secondary background (for sections)
- `card` - Card/container background
- `cardForeground` - Text color on card background

### Text Colors
- `text` - Primary text color
- `textSecondary` - Secondary/muted text color
- `textMuted` - Less emphasized text

### Border Colors
- `border` - Default border color
- `borderLight` - Lighter border variant
- `divider` - Divider/separator color

### Semantic Colors
- `success` - Success states (Green)
- `warning` - Warning states (Amber)
- `error` - Error states (Red)
- `info` - Informational states (Blue)

### Interactive Elements
- `tint` - Active/tint color (same as primary)
- `icon` - Default icon color
- `tabIconDefault` - Unselected tab icon color
- `tabIconSelected` - Selected tab icon color

### Input Fields
- `input` - Input field background
- `inputBorder` - Input field border
- `placeholder` - Placeholder text color

## Usage Guide

### Basic Usage with `useThemeColor` Hook

Import the hook and use it to get theme-aware colors:

```tsx
import { useThemeColor } from '@/hooks/use-theme-color';
import { View, Text } from 'react-native';

export default function MyComponent() {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  
  return (
    <View style={{ backgroundColor }}>
      <Text style={{ color: textColor }}>Hello World</Text>
    </View>
  );
}
```

### Using Multiple Colors

```tsx
export default function MyComponent() {
  // Background colors
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'card');
  
  // Text colors
  const textColor = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  
  // Brand colors
  const primaryColor = useThemeColor({}, 'primary');
  const errorColor = useThemeColor({}, 'error');
  
  return (
    <View style={{ backgroundColor }}>
      <View style={{ backgroundColor: cardBackground, padding: 16 }}>
        <Text style={{ color: textColor, fontSize: 20, fontWeight: 'bold' }}>
          Title
        </Text>
        <Text style={{ color: textSecondary }}>
          Subtitle text
        </Text>
        <View style={{ backgroundColor: primaryColor, padding: 10 }}>
          <Text style={{ color: '#fff' }}>Primary Button</Text>
        </View>
      </View>
    </View>
  );
}
```

### Combining with NativeWind Classes

Use NativeWind for layout, spacing, and typography sizes, while using theme colors via style prop:

```tsx
import { useThemeColor } from '@/hooks/use-theme-color';
import { View, Text } from 'react-native';

export default function MyComponent() {
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const primaryColor = useThemeColor({}, 'primary');
  
  return (
    <View 
      className="flex-1 p-5 items-center justify-center"
      style={{ backgroundColor }}
    >
      <View 
        className="p-6 rounded-2xl w-full"
        style={{ 
          backgroundColor: cardBackground,
          borderWidth: 1,
          borderColor 
        }}
      >
        <Text 
          className="text-2xl font-bold mb-2"
          style={{ color: textColor }}
        >
          Card Title
        </Text>
        <View 
          className="mt-4 px-4 py-3 rounded-lg"
          style={{ backgroundColor: primaryColor }}
        >
          <Text className="text-base font-semibold" style={{ color: '#fff' }}>
            Action Button
          </Text>
        </View>
      </View>
    </View>
  );
}
```

### Overriding Colors (Optional)

You can override colors for specific components:

```tsx
export default function MyComponent() {
  // Override with custom colors
  const customBackground = useThemeColor(
    { light: '#ff0000', dark: '#990000' }, 
    'background'
  );
  
  // Or use default theme color
  const defaultBackground = useThemeColor({}, 'background');
  
  return (
    <View style={{ backgroundColor: customBackground }}>
      {/* Custom red background in light mode, dark red in dark mode */}
    </View>
  );
}
```

### Using with Themed Components

Pre-built themed components are available:

```tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function MyComponent() {
  return (
    <ThemedView style={{ padding: 20 }}>
      <ThemedText type="title">Title Text</ThemedText>
      <ThemedText type="default">Default text</ThemedText>
      <ThemedText type="link">Link text</ThemedText>
    </ThemedView>
  );
}
```

**ThemedText types:**
- `default` - Regular text (16px)
- `title` - Large title (32px, bold)
- `defaultSemiBold` - Semi-bold text (16px)
- `subtitle` - Subtitle text (20px, bold)
- `link` - Link text (uses primary color)

## Examples

### Example 1: Simple Card

```tsx
import { View, Text } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function Card() {
  const cardBg = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  
  return (
    <View 
      className="p-5 rounded-xl mx-4 my-2"
      style={{ 
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor 
      }}
    >
      <Text 
        className="text-lg font-bold mb-2"
        style={{ color: textColor }}
      >
        Card Title
      </Text>
      <Text 
        className="text-sm"
        style={{ color: textColor }}
      >
        Card content goes here
      </Text>
    </View>
  );
}
```

### Example 2: Button Component

```tsx
import { TouchableOpacity, Text, ViewStyle, TextStyle } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

interface ButtonProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'error';
  onPress: () => void;
}

export default function Button({ title, variant = 'primary', onPress }: ButtonProps) {
  const primaryColor = useThemeColor({}, 'primary');
  const secondaryColor = useThemeColor({}, 'secondary');
  const errorColor = useThemeColor({}, 'error');
  
  const bgColor = variant === 'primary' ? primaryColor 
                : variant === 'secondary' ? secondaryColor 
                : errorColor;
  
  return (
    <TouchableOpacity
      className="px-6 py-3 rounded-lg"
      style={{ backgroundColor: bgColor }}
      onPress={onPress}
    >
      <Text className="text-base font-semibold text-center" style={{ color: '#fff' }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}
```

### Example 3: Status Badge

```tsx
import { View, Text } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

interface BadgeProps {
  label: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

export default function Badge({ label, type }: BadgeProps) {
  const successColor = useThemeColor({}, 'success');
  const warningColor = useThemeColor({}, 'warning');
  const errorColor = useThemeColor({}, 'error');
  const infoColor = useThemeColor({}, 'info');
  
  const colors = {
    success: successColor,
    warning: warningColor,
    error: errorColor,
    info: infoColor,
  };
  
  return (
    <View 
      className="px-3 py-1 rounded-full"
      style={{ backgroundColor: colors[type] }}
    >
      <Text className="text-xs font-semibold" style={{ color: '#fff' }}>
        {label}
      </Text>
    </View>
  );
}
```

### Example 4: Input Field

```tsx
import { TextInput, View, Text } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function Input({ label, ...props }) {
  const inputBg = useThemeColor({}, 'input');
  const inputBorder = useThemeColor({}, 'inputBorder');
  const placeholderColor = useThemeColor({}, 'placeholder');
  const textColor = useThemeColor({}, 'text');
  const labelColor = useThemeColor({}, 'textSecondary');
  
  return (
    <View className="mb-4">
      <Text 
        className="text-sm font-medium mb-2"
        style={{ color: labelColor }}
      >
        {label}
      </Text>
      <TextInput
        className="px-4 py-3 rounded-lg text-base"
        style={{
          backgroundColor: inputBg,
          borderWidth: 1,
          borderColor: inputBorder,
          color: textColor,
        }}
        placeholderTextColor={placeholderColor}
        {...props}
      />
    </View>
  );
}
```

### Example 5: List Item

```tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

interface ListItemProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}

export default function ListItem({ title, subtitle, onPress }: ListItemProps) {
  const cardBg = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const borderColor = useThemeColor({}, 'border');
  
  return (
    <TouchableOpacity
      className="px-5 py-4"
      style={{ 
        backgroundColor: cardBg,
        borderBottomWidth: 1,
        borderBottomColor: borderColor 
      }}
      onPress={onPress}
    >
      <Text 
        className="text-base font-semibold mb-1"
        style={{ color: textColor }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text 
          className="text-sm"
          style={{ color: textSecondary }}
        >
          {subtitle}
        </Text>
      )}
    </TouchableOpacity>
  );
}
```

## Best Practices

### ✅ DO

1. **Always use `useThemeColor` for colors that should change with theme:**
   ```tsx
   const bgColor = useThemeColor({}, 'background');
   ```

2. **Use NativeWind classes for static properties:**
   ```tsx
   <View className="flex-1 p-5 rounded-xl" style={{ backgroundColor: bgColor }} />
   ```

3. **Keep color definitions in `constants/theme.ts` only:**
   - Single source of truth
   - Easy to maintain and update

4. **Use semantic color names:**
   ```tsx
   // ✅ Good
   const errorColor = useThemeColor({}, 'error');
   
   // ❌ Bad
   const redColor = '#ef4444';
   ```

### ❌ DON'T

1. **Don't use Tailwind color classes for theme colors:**
   ```tsx
   // ❌ This won't switch themes
   <View className="bg-primary" />
   
   // ✅ Use this instead
   <View style={{ backgroundColor: useThemeColor({}, 'primary') }} />
   ```

2. **Don't hardcode colors:**
   ```tsx
   // ❌ Bad
   <Text style={{ color: '#111827' }}>Text</Text>
   
   // ✅ Good
   <Text style={{ color: useThemeColor({}, 'text') }}>Text</Text>
   ```

3. **Don't duplicate color values:**
   - All colors should come from `constants/theme.ts`

4. **Don't mix theme approaches:**
   - Stick to `useThemeColor` hook consistently

## Adding New Colors

To add a new color to the theme:

1. **Update `constants/theme.ts`:**

```typescript
export const Colors = {
  light: {
    // ... existing colors
    yourNewColor: '#your-light-color',
  },
  dark: {
    // ... existing colors
    yourNewColor: '#your-dark-color',
  },
};
```

2. **Use it in your component:**

```tsx
const yourColor = useThemeColor({}, 'yourNewColor');
```

3. **Update TypeScript types (if needed):**
   The `useThemeColor` hook automatically infers types from the Colors object, so no manual type updates are needed.

### Example: Adding a Gradient Color

```typescript
// In constants/theme.ts
export const Colors = {
  light: {
    // ... existing colors
    gradientStart: '#667eea',
    gradientEnd: '#764ba2',
  },
  dark: {
    // ... existing colors
    gradientStart: '#4c63d2',
    gradientEnd: '#6b46c1',
  },
};
```

```tsx
// In your component
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function GradientButton() {
  const gradientStart = useThemeColor({}, 'gradientStart');
  const gradientEnd = useThemeColor({}, 'gradientEnd');
  
  return (
    <LinearGradient
      colors={[gradientStart, gradientEnd]}
      className="px-6 py-3 rounded-lg"
    >
      <Text className="text-white font-semibold">Gradient Button</Text>
    </LinearGradient>
  );
}
```

## Checking Current Theme

To check if the app is in dark or light mode:

```tsx
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function MyComponent() {
  const colorScheme = useColorScheme(); // 'light' | 'dark' | null
  const isDark = colorScheme === 'dark';
  
  return (
    <Text>Current theme: {isDark ? 'Dark' : 'Light'}</Text>
  );
}
```

## Summary

- **Single Source of Truth**: All colors defined in `constants/theme.ts`
- **Dynamic Theming**: Use `useThemeColor` hook for all theme colors
- **Static Utilities**: Use NativeWind classes for layout, spacing, typography
- **Automatic Switching**: Theme changes automatically based on system settings
- **Type Safe**: Full TypeScript support with autocomplete

For questions or issues, refer to the theme constants file or check existing component implementations.
