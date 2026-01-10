import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? 'dark' : 'light';
  
  // Background colors
  const backgroundColor = useThemeColor({}, 'background');
  const backgroundSecondary = useThemeColor({}, 'backgroundSecondary');
  const cardBackground = useThemeColor({}, 'card');
  
  // Text colors
  const textColor = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const textMuted = useThemeColor({}, 'textMuted');
  
  // Brand colors
  const primaryColor = useThemeColor({}, 'primary');
  const secondaryColor = useThemeColor({}, 'secondary');
  
  // Semantic colors
  const successColor = useThemeColor({}, 'success');
  const warningColor = useThemeColor({}, 'warning');
  const errorColor = useThemeColor({}, 'error');
  const infoColor = useThemeColor({}, 'info');
  
  // Border colors
  const borderColor = useThemeColor({}, 'border');

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }} edges={['top', 'bottom']}>
      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ padding: 20, gap: 20 }}
      >
      {/* Header */}
      <View className="items-center" style={{ marginBottom: 20 }}>
        <Text className="text-3xl font-bold" style={{ color: textColor }}>
          Custom Color Scheme
        </Text>
        <Text className="text-base mt-2" style={{ color: textSecondary }}>
          Current theme: {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </Text>
      </View>

      {/* Brand Colors Card */}
      <View 
        className="p-5 rounded-2xl" 
        style={{ backgroundColor: cardBackground, borderWidth: 1, borderColor }}
      >
        <Text className="text-xl font-bold mb-4" style={{ color: textColor }}>
          Brand Colors
        </Text>
        <View className="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="w-16 h-16 rounded-xl" style={{ backgroundColor: primaryColor }} />
            <View className="flex-1">
              <Text className="text-base font-semibold" style={{ color: textColor }}>
                Primary
              </Text>
              <Text className="text-sm" style={{ color: textMuted }}>
                {primaryColor}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="w-16 h-16 rounded-xl" style={{ backgroundColor: secondaryColor }} />
            <View className="flex-1">
              <Text className="text-base font-semibold" style={{ color: textColor }}>
                Secondary
              </Text>
              <Text className="text-sm" style={{ color: textMuted }}>
                {secondaryColor}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Semantic Colors Card */}
      <View 
        className="p-5 rounded-2xl" 
        style={{ backgroundColor: cardBackground, borderWidth: 1, borderColor }}
      >
        <Text className="text-xl font-bold mb-4" style={{ color: textColor }}>
          Semantic Colors
        </Text>
        <View className="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="w-16 h-16 rounded-xl" style={{ backgroundColor: successColor }} />
            <View className="flex-1">
              <Text className="text-base font-semibold" style={{ color: textColor }}>
                Success
              </Text>
              <Text className="text-sm" style={{ color: textMuted }}>
                {successColor}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="w-16 h-16 rounded-xl" style={{ backgroundColor: warningColor }} />
            <View className="flex-1">
              <Text className="text-base font-semibold" style={{ color: textColor }}>
                Warning
              </Text>
              <Text className="text-sm" style={{ color: textMuted }}>
                {warningColor}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="w-16 h-16 rounded-xl" style={{ backgroundColor: errorColor }} />
            <View className="flex-1">
              <Text className="text-base font-semibold" style={{ color: textColor }}>
                Error
              </Text>
              <Text className="text-sm" style={{ color: textMuted }}>
                {errorColor}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="w-16 h-16 rounded-xl" style={{ backgroundColor: infoColor }} />
            <View className="flex-1">
              <Text className="text-base font-semibold" style={{ color: textColor }}>
                Info
              </Text>
              <Text className="text-sm" style={{ color: textMuted }}>
                {infoColor}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Text Colors Card */}
      <View 
        className="p-5 rounded-2xl" 
        style={{ backgroundColor: cardBackground, borderWidth: 1, borderColor }}
      >
        <Text className="text-xl font-bold mb-4" style={{ color: textColor }}>
          Text Colors
        </Text>
        <View className="gap-3">
          <Text className="text-lg font-bold" style={{ color: textColor }}>
            Primary Text - {textColor}
          </Text>
          <Text className="text-base" style={{ color: textSecondary }}>
            Secondary Text - {textSecondary}
          </Text>
          <Text className="text-sm" style={{ color: textMuted }}>
            Muted Text - {textMuted}
          </Text>
        </View>
      </View>

      {/* Background Colors Card */}
      <View 
        className="p-5 rounded-2xl mb-5" 
        style={{ backgroundColor: cardBackground, borderWidth: 1, borderColor }}
      >
        <Text className="text-xl font-bold mb-4" style={{ color: textColor }}>
          Background Colors
        </Text>
        <View className="gap-3">
          <View 
            className="p-4 rounded-xl" 
            style={{ backgroundColor: backgroundSecondary }}
          >
            <Text className="text-sm font-semibold" style={{ color: textColor }}>
              Secondary Background
            </Text>
          </View>
          <View 
            className="p-4 rounded-xl" 
            style={{ backgroundColor: cardBackground, borderWidth: 1, borderColor }}
          >
            <Text className="text-sm font-semibold" style={{ color: textColor }}>
              Card Background
      </Text>
    </View>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

