import { Redirect, Stack } from 'expo-router'
import { useAuth } from '../../src/lib/auth'
import { colors } from '../../src/theme'

export default function AppGroupLayout() {
  const { user } = useAuth()
  if (!user) return <Redirect href="/login" />

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: colors.slate50 },
      }}
    />
  )
}
