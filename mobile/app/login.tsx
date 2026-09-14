import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Redirect, router } from 'expo-router'
import { useAuth } from '../src/lib/auth'
import { ApiError } from '../src/lib/api'
import { colors } from '../src/theme'

export default function LoginScreen() {
  const { user, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Redirect href="/planning" />

  async function onSubmit() {
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      router.replace('/planning')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Connexion impossible.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>Allo Débouchage</Text>
        <Text style={styles.sub}>Espace technicien</Text>

        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Identifiant"
          placeholderTextColor={colors.slate400}
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Mot de passe"
          placeholderTextColor={colors.slate400}
          style={styles.input}
          onSubmitEditing={() => void onSubmit()}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={() => void onSubmit()}
          disabled={loading || !username.trim()}
          style={({ pressed }) => [
            styles.btn,
            { opacity: loading || !username.trim() ? 0.5 : pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={styles.btnLabel}>{loading ? 'Connexion…' : 'Se connecter'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.navyDeep,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    gap: 12,
  },
  brand: { fontSize: 22, fontWeight: '900', color: colors.navy, textAlign: 'center' },
  sub: { fontSize: 14, color: colors.slate500, textAlign: 'center', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.slate800,
    backgroundColor: colors.slate50,
  },
  error: { color: colors.red, fontSize: 13, fontWeight: '600' },
  btn: {
    backgroundColor: colors.navy,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnLabel: { color: colors.white, fontWeight: '800', fontSize: 16 },
})
