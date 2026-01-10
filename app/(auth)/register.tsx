import { Redirect } from 'expo-router';

export default function RegisterScreen() {
  // Redirect to login since login now handles both modes
  return <Redirect href="/(auth)/login" />;
}
