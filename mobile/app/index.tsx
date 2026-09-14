import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '../src/lib/auth'
import { colors } from '../src/theme'

export default function Index() {
  const { ready, user } = useAuth()
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.white} />
      </View>
    )
  }
  if (!user) return <Redirect href="/login" />
  return <Redirect href="/planning" />
}
