import { ActivityIndicator, Pressable, Text, StyleSheet } from 'react-native'
import { colors } from '../theme'

type Variant = 'primary' | 'secondary' | 'danger'

type Props = {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  variant?: Variant
}

export function BigButton({ label, onPress, disabled, loading, variant = 'primary' }: Props) {
  const bg =
    variant === 'secondary' ? colors.white : variant === 'danger' ? colors.red : colors.emerald
  const fg = variant === 'secondary' ? colors.navy : colors.white
  const border = variant === 'secondary' ? colors.slate200 : 'transparent'

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled || loading ? 0.5 : pressed ? 0.9 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 2,
  },
  label: {
    fontSize: 17,
    fontWeight: '800',
  },
})
