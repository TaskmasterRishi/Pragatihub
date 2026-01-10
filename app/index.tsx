import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors } from '@/constants/theme';
import { hasCompletedOnboarding } from '@/utils/onboarding-storage';

export default function Index() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[theme];
  const backgroundColor = useThemeColor({}, 'background');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const completed = await hasCompletedOnboarding();
        
        if (completed) {
          // If onboarding is completed, redirect to auth
          router.replace('/(auth)/login');
        } else {
          // If not completed, show onboarding
          router.replace('/(onboarding)');
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // On error, show onboarding
        router.replace('/(onboarding)');
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  // Show loading screen while checking onboarding status
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
