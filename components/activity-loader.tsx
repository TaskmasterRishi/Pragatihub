import { useThemeColor } from '@/hooks/use-theme-color';
import { ActivityIndicator, View } from 'react-native';

export default function ActivityLoader() {
  const primaryColor = useThemeColor({}, 'primary');
  const backgroundColor = useThemeColor({}, 'background');

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor }}
    >
      <ActivityIndicator size="large" color={primaryColor} />
    </View>
  );
}
