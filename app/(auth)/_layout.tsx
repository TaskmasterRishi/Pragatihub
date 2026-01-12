import { useAuth } from '@clerk/clerk-expo'
import { Redirect, Stack } from 'expo-router'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function AuthRoutesLayout() {
  const { isSignedIn } = useAuth()
  const insets = useSafeAreaInsets()

  if (isSignedIn) {
    return <Redirect href={'/'} />
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Stack screenOptions={{ headerShown: false }} >
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack>
    </View>
  )
}