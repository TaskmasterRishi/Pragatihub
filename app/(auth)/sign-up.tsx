import { useSignUp } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import * as React from 'react'
import {
    ActivityIndicator,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const router = useRouter()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [pendingVerification, setPendingVerification] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const onSignUpPress = async () => {
    if (!isLoaded || loading) return

    setError(null)
    setLoading(true)

    try {
      await signUp.create({
        emailAddress,
        password,
      })

      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      })

      setPendingVerification(true)
    } catch (err: any) {
      const clerkError = err?.errors?.[0]

      if (clerkError?.code === 'form_password_pwned') {
        setError(
          'This password has appeared in a data breach. Please choose a stronger, unique password.'
        )
      } else {
        setError(clerkError?.message ?? 'Something went wrong. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const onVerifyPress = async () => {
    if (!isLoaded || loading) return

    setError(null)
    setLoading(true)

    try {
      const result = await signUp.attemptEmailAddressVerification({ code })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        router.replace('/')
      } else {
        setError('Verification incomplete. Please try again.')
      }
    } catch (err: any) {
      const clerkError = err?.errors?.[0]
      setError(clerkError?.message ?? 'Invalid verification code.')
    } finally {
      setLoading(false)
    }
  }

  // ---------------- VERIFY EMAIL ----------------
  if (pendingVerification) {
    return (
      <View>
        <Text>Verify your email</Text>

        <TextInput
          value={code}
          placeholder="Enter verification code"
          onChangeText={setCode}
          autoCapitalize="none"
        />

        {error && <Text style={{ color: 'red' }}>{error}</Text>}

        <TouchableOpacity onPress={onVerifyPress} disabled={loading}>
          {loading ? <ActivityIndicator /> : <Text>Verify</Text>}
        </TouchableOpacity>
      </View>
    )
  }

  // ---------------- SIGN UP ----------------
  return (
    <View>
      <Text>Sign up</Text>

      <TextInput
        autoCapitalize="none"
        value={emailAddress}
        placeholder="Enter email"
        onChangeText={setEmailAddress}
      />

      <TextInput
        value={password}
        placeholder="Enter password"
        secureTextEntry
        onChangeText={setPassword}
      />

      {error && <Text style={{ color: 'red' }}>{error}</Text>}

      <TouchableOpacity onPress={onSignUpPress} disabled={loading}>
        {loading ? <ActivityIndicator /> : <Text>Continue</Text>}
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', gap: 4 }}>
        <Text>Already have an account?</Text>
        <Link href="/sign-in">
          <Text>Sign in</Text>
        </Link>
      </View>
    </View>
  )
}
