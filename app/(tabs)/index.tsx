import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? 'dark' : 'light';
  
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const cardBackground = useThemeColor({}, 'card');
  const primaryColor = useThemeColor({}, 'primary');
  const borderColor = useThemeColor({}, 'border');

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }} edges={['top', 'bottom']}>
      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ padding: 20, gap: 20 }}
      >
        {/* Header */}
        <View className="items-center" style={{ marginBottom: 20, marginTop: 20 }}>
          <Text className="text-4xl font-bold" style={{ color: textColor, marginBottom: 8 }}>
            PragatiHub
          </Text>
          <Text className="text-base" style={{ color: textSecondary }}>
            Welcome to your learning journey
          </Text>
        </View>

        {/* Feature Cards */}
        <View 
          className="p-5 rounded-2xl" 
          style={{ backgroundColor: cardBackground, borderWidth: 1, borderColor, marginTop: 10 }}
        >
          <Text className="text-xl font-bold mb-2" style={{ color: textColor }}>
            🎓 Learn Together
          </Text>
          <Text className="text-sm" style={{ color: textSecondary, lineHeight: 20 }}>
            Join a community of people building skills, sharing knowledge, and growing side by side.
          </Text>
        </View>

        <View 
          className="p-5 rounded-2xl" 
          style={{ backgroundColor: cardBackground, borderWidth: 1, borderColor }}
        >
          <Text className="text-xl font-bold mb-2" style={{ color: textColor }}>
            🤝 Build Through Collaboration
          </Text>
          <Text className="text-sm" style={{ color: textSecondary, lineHeight: 20 }}>
            Discuss ideas, practice skills, and work on projects with people who share your goals.
          </Text>
        </View>

        <View 
          className="p-5 rounded-2xl mb-5" 
          style={{ backgroundColor: cardBackground, borderWidth: 1, borderColor }}
        >
          <Text className="text-xl font-bold mb-2" style={{ color: textColor }}>
            🚀 Grow Your Potential
          </Text>
          <Text className="text-sm" style={{ color: textSecondary, lineHeight: 20 }}>
            Turn learning into progress and become part of something bigger with PragatiHub.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

