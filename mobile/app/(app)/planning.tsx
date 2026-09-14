import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Stack, router, useFocusEffect } from 'expo-router'
import { useAuth } from '../../src/lib/auth'
import { api, ApiError } from '../../src/lib/api'
import { endOfWeekISO, fmtDateFR, fmtHeure, startOfWeekISO, todayISO } from '../../src/lib/format'
import { phaseCta, STATUT_LABEL } from '../../src/lib/phases'
import type { InterventionRow } from '../../src/lib/types'
import { colors } from '../../src/theme'

type DateFilter = 'today' | 'week' | 'all'

function statutColor(statut: string): string {
  if (statut === 'en_cours') return colors.blue
  if (statut === 'terminee') return colors.emerald
  if (statut === 'annulee') return colors.slate400
  return colors.red
}

export default function PlanningScreen() {
  const { user, logout } = useAuth()
  const [rows, setRows] = useState<InterventionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<DateFilter>('today')

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true)
    setError('')
    try {
      const data = await api<{ interventions: InterventionRow[] }>('/api/interventions?limit=200')
      setRows(data.interventions || [])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load(true)
    }, [load]),
  )

  const filtered = useMemo(() => {
    const today = todayISO()
    const from = startOfWeekISO()
    const to = endOfWeekISO()
    return rows.filter((r) => {
      if (r.statut === 'annulee') return false
      const d = r.date_prevue
      if (filter === 'today') return d === today
      if (filter === 'week') return !!d && d >= from && d <= to
      return true
    })
  }, [rows, filter])

  return (
    <View style={styles.page}>
      <Stack.Screen
        options={{
          title: 'Planning',
          headerRight: () => (
            <Pressable onPress={() => void logout()} hitSlop={12}>
              <Text style={styles.logout}>Déconnexion</Text>
            </Pressable>
          ),
        }}
      />

      <Text style={styles.hello}>
        {user?.login || 'Technicien'}
        {user?.role === 'admin' ? ' · admin' : ''}
      </Text>

      <View style={styles.filters}>
        {([
          ['today', 'Aujourd’hui'],
          ['week', 'Semaine'],
          ['all', 'Toutes'],
        ] as const).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key)}
            style={[styles.chip, filter === key && styles.chipOn]}
          >
            <Text style={[styles.chipText, filter === key && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                void load(true)
              }}
            />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {filtered.length === 0 ? (
            <Text style={styles.empty}>Aucune intervention sur cette période.</Text>
          ) : (
            filtered.map((row) => (
              <Pressable
                key={row.id}
                onPress={() => router.push(`/intervention/${row.id}`)}
                style={[styles.card, { borderLeftColor: statutColor(row.statut) }]}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.hour}>{fmtHeure(row.heure_prevue) || '—'}</Text>
                  {row.urgence ? <Text style={styles.urg}>URGENT</Text> : null}
                  <Text style={[styles.statut, { color: statutColor(row.statut) }]}>
                    {STATUT_LABEL[row.statut] || row.statut}
                  </Text>
                </View>
                <Text style={styles.client}>{row.client_nom || 'Client'}</Text>
                <Text style={styles.meta}>
                  {[row.type_intervention, row.ville].filter(Boolean).join(' · ')}
                </Text>
                <Text style={styles.addr}>
                  {[row.adresse_chantier, row.code_postal, row.ville].filter(Boolean).join(' ')}
                </Text>
                <Text style={styles.date}>{fmtDateFR(row.date_prevue)}</Text>
                <Text style={styles.cta}>{phaseCta(row.terrain_step ?? 0)} →</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.slate50 },
  logout: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 13, paddingRight: 4 },
  hello: {
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 13,
    color: colors.slate500,
    fontWeight: '600',
  },
  filters: { flexDirection: 'row', gap: 8, padding: 16, paddingTop: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontWeight: '700', color: colors.slate600, fontSize: 13 },
  chipTextOn: { color: colors.white },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  error: { color: colors.red, fontWeight: '600', marginBottom: 8 },
  empty: { color: colors.slate500, textAlign: 'center', marginTop: 32 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  hour: { fontSize: 20, fontWeight: '900', color: colors.navy },
  urg: {
    backgroundColor: colors.red,
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  statut: { marginLeft: 'auto', fontWeight: '800', fontSize: 12 },
  client: { fontSize: 17, fontWeight: '800', color: colors.slate800 },
  meta: { color: colors.slate500, marginTop: 2, fontSize: 13 },
  addr: { color: colors.slate600, marginTop: 4, fontSize: 13 },
  date: { color: colors.slate400, marginTop: 4, fontSize: 12 },
  cta: { marginTop: 10, color: colors.blue, fontWeight: '800' },
})
