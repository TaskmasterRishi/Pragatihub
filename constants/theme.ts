/**
 * Custom color scheme for the app.
 * Colors are defined for both light and dark modes.
 */

import { Platform } from 'react-native';

// Primary brand colors
const primaryLight = '#0A66E8'; 
const primaryDark = '#084DB3';
const secondaryLight = '#6da5ffff'; 
const secondaryDark = '#0558d4ff'; 

// Semantic colors
const successLight = '#10b981'; // Green
const successDark = '#34d399';
const warningLight = '#f59e0b'; // Amber
const warningDark = '#fbbf24';
const errorLight = '#ef4444'; // Red
const errorDark = '#f87171';
const infoLight = '#3b82f6'; // Blue
const infoDark = '#60a5fa';

// Neutral colors
const neutralLight = {
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
};

const neutralDark = {
  50: '#18181b',
  100: '#27272a',
  200: '#3f3f46',
  300: '#52525b',
  400: '#71717a',
  500: '#a1a1aa',
  600: '#d4d4d8',
  700: '#e4e4e7',
  800: '#f4f4f5',
  900: '#fafafa',
};

export const Colors = {
  light: {
    // Primary colors
    primary: primaryLight,
    primaryForeground: '#ffffff',
    secondary: secondaryLight,
    secondaryForeground: '#ffffff',
    
    // Background colors
    background: neutralLight[50],
    backgroundSecondary: neutralLight[100],
    card: '#ffffff',
    cardForeground: neutralLight[900],
    
    // Text colors
    text: neutralLight[900],
    textSecondary: neutralLight[600],
    textMuted: neutralLight[500],
    
    // Border and divider
    border: neutralLight[200],
    borderLight: neutralLight[100],
    divider: neutralLight[200],
    
    // Interactive elements
    tint: primaryLight,
    icon: neutralLight[600],
    tabIconDefault: neutralDark[400],
    tabIconSelected: primaryDark,
    
    // Semantic colors
    success: successLight,
    warning: warningLight,
    error: errorLight,
    info: infoLight,
    
    // Input fields
    input: neutralLight[100],
    inputBorder: neutralLight[300],
    placeholder: neutralLight[400],
  },
  dark: {
    // Primary colors
    primary: primaryDark,
    primaryForeground: '#ffffff',
    secondary: secondaryDark,
    secondaryForeground: '#ffffff',
    
    // Background colors
    background: neutralDark[50],
    backgroundSecondary: neutralDark[100],
    card: neutralDark[100],
    cardForeground: neutralDark[900],
    
    // Text colors
    text: neutralDark[900],
    textSecondary: neutralDark[600],
    textMuted: neutralDark[500],
    
    // Border and divider
    border: neutralDark[300],
    borderLight: neutralDark[200],
    divider: neutralDark[300],
    
    // Interactive elements
    tint: primaryDark,
    icon: neutralDark[600],
    tabIconDefault: neutralLight[400],
    tabIconSelected: primaryLight,
    
    // Semantic colors
    success: successDark,
    warning: warningDark,
    error: errorDark,
    info: infoDark,
    
    // Input fields
    input: neutralDark[200],
    inputBorder: neutralDark[300],
    placeholder: neutralDark[500],
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
