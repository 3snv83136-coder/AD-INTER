import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'
import { stepToPhase, TERRAIN_PHASES } from '../lib/phases'

export function PhaseBar({ terrainStep }: { terrainStep: number }) {
  const current = stepToPhase(terrainStep)

  return (
    <View style={styles.wrap}>
      {TERRAIN_PHASES.map((p) => {
        const done = current > p.key
        const active = current === p.key
        return (
          <View key={p.key} style={styles.col}>
            <View
              style={[
                styles.dot,
                done && styles.dotDone,
                active && styles.dotActive,
                !done && !active && styles.dotIdle,
              ]}
            >
              <Text style={[styles.icon, active && styles.iconActive]}>
                {done ? '✓' : p.icon}
              </Text>
            </View>
            <Text style={[styles.label, active && styles.labelActive, done && styles.labelDone]}>
              {p.label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.navy,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  col: { flex: 1, alignItems: 'center', gap: 6 },
  dot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.emerald },
  dotActive: { backgroundColor: colors.white },
  dotIdle: { backgroundColor: 'rgba(255,255,255,0.15)' },
  icon: { fontSize: 18, color: 'rgba(255,255,255,0.7)' },
  iconActive: { color: colors.navy },
  label: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.45)' },
  labelActive: { color: colors.white },
  labelDone: { color: '#6ee7b7' },
})
