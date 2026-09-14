import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { BigButton } from '../../../src/components/BigButton'
import { PhaseBar } from '../../../src/components/PhaseBar'
import { api, ApiError, uploadPhoto } from '../../../src/lib/api'
import { fmtDateFR, fmtHeure } from '../../../src/lib/format'
import { stepToPhase } from '../../../src/lib/phases'
import type {
  ClientDetail,
  InterventionDetail,
  RapportPreview,
  SeoPreview,
} from '../../../src/lib/types'
import { colors } from '../../../src/theme'

function fullAddress(interv: InterventionDetail, client: ClientDetail | null): string {
  return [
    interv.adresse_chantier || client?.adresse,
    interv.code_postal || client?.code_postal,
    interv.ville || client?.ville,
  ]
    .filter(Boolean)
    .join(' ')
}

async function openTel(phone: string) {
  const url = `tel:${phone.replace(/\s/g, '')}`
  await Linking.openURL(url)
}

async function openMaps(address: string) {
  const q = encodeURIComponent(address)
  const url = Platform.OS === 'ios' ? `maps:0,0?q=${q}` : `geo:0,0?q=${q}`
  await Linking.openURL(url)
}

async function openSms(phone: string, body: string) {
  const sep = Platform.OS === 'ios' ? '&' : '?'
  await Linking.openURL(`sms:${phone.replace(/\s/g, '')}${sep}body=${encodeURIComponent(body)}`)
}

export default function InterventionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [interv, setInterv] = useState<InterventionDetail | null>(null)
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [transcription, setTranscription] = useState('')
  const [rapportPreview, setRapportPreview] = useState<RapportPreview | null>(null)
  const [seoPreview, setSeoPreview] = useState<SeoPreview | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setError('')
    try {
      const data = await api<{ intervention: InterventionDetail; client: ClientDetail | null }>(
        `/api/interventions/${id}`,
      )
      setInterv(data.intervention)
      setClient(data.client)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function terrainAction(action: 'debut' | 'fin' | 'set', step?: number) {
    if (!id) return
    setBusy(action)
    setError('')
    try {
      const body = action === 'set' ? { action, step } : { action }
      await api(`/api/interventions/${id}/terrain-step`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action impossible')
    } finally {
      setBusy('')
    }
  }

  async function takePhoto(legende: string) {
    if (!id) return
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      setError('Autorise la caméra pour photographier le chantier.')
      return
    }
    const shot = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
    })
    if (shot.canceled || !shot.assets[0]) return
    const asset = shot.assets[0]
    setBusy('photo')
    setError('')
    try {
      await uploadPhoto(
        id,
        {
          uri: asset.uri,
          name: 'photo.jpg',
          type: asset.mimeType || 'image/jpeg',
        },
        legende,
      )
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Envoi photo impossible')
    } finally {
      setBusy('')
    }
  }

  async function generateRapport() {
    if (!interv) return
    if (transcription.trim().length < 20) {
      setError('Tape au moins quelques phrases sur l’intervention.')
      return
    }
    setBusy('generate')
    setError('')
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 180_000)
    try {
      const gen = await api<{ rapport: RapportPreview; seo: SeoPreview }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          transcription,
          type_intervention: interv.type_intervention || 'Intervention',
          ville: interv.ville || '',
          code_postal: interv.code_postal || '',
        }),
        signal: ctrl.signal,
      })
      setRapportPreview(gen.rapport)
      setSeoPreview(gen.seo)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setError('La génération a pris trop de temps. Réessaie.')
      } else {
        setError(e instanceof ApiError ? e.message : 'Génération échouée')
      }
    } finally {
      clearTimeout(timer)
      setBusy('')
    }
  }

  async function validateRapport() {
    if (!interv || !rapportPreview) return
    setBusy('save')
    setError('')
    try {
      await api('/api/save-rapport', {
        method: 'POST',
        body: JSON.stringify({
          interventionId: interv.id,
          rapport: rapportPreview,
          seo: seoPreview,
          transcription,
          typeIntervention: interv.type_intervention,
          dateIntervention: interv.date_prevue,
        }),
      })
      await api(`/api/interventions/${interv.id}/terrain-step`, {
        method: 'POST',
        body: JSON.stringify({ action: 'set', step: 4 }),
      })
      setRapportPreview(null)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sauvegarde échouée')
    } finally {
      setBusy('')
    }
  }

  async function closeAndClient() {
    if (!id) return
    setBusy('fin')
    setError('')
    try {
      await api(`/api/interventions/${id}/terrain-step`, {
        method: 'POST',
        body: JSON.stringify({ action: 'fin' }),
      })
      await api(`/api/interventions/${id}/terrain-step`, {
        method: 'POST',
        body: JSON.stringify({ action: 'set', step: 6 }),
      })
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Clôture impossible')
    } finally {
      setBusy('')
    }
  }

  async function prepareDocs() {
    if (!interv) return
    const nom = (client?.nom || '').trim()
    if (!nom) {
      setError('Nom client manquant pour générer les documents.')
      return
    }
    setBusy('pdfs')
    setError('')
    try {
      await api(`/api/interventions/${interv.id}/facture-quick`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      await api(`/api/interventions/${interv.id}/generate-pdfs`, {
        method: 'POST',
        body: JSON.stringify({
          nom,
          email: client?.email || '',
          telephone: client?.telephone || '',
        }),
      })
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Documents impossibles')
    } finally {
      setBusy('')
    }
  }

  async function sendMail() {
    if (!interv || !client?.email) {
      setError('Email client manquant.')
      return
    }
    setBusy('mail')
    setError('')
    try {
      await api('/api/notify-rapport-facture', {
        method: 'POST',
        body: JSON.stringify({
          interventionId: interv.id,
          clientEmail: client.email,
        }),
      })
      Alert.alert('Envoyé', 'Le mail client est parti.')
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Envoi mail impossible')
    } finally {
      setBusy('')
    }
  }

  async function sendSms() {
    if (!interv || !client?.telephone) {
      setError('Téléphone client manquant.')
      return
    }
    setBusy('sms')
    setError('')
    try {
      const data = await api<{ body: string }>('/api/notify-rapport-facture-sms', {
        method: 'POST',
        body: JSON.stringify({
          interventionId: interv.id,
          clientPhone: client.telephone,
        }),
      })
      await openSms(client.telephone, data.body)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'SMS impossible')
    } finally {
      setBusy('')
    }
  }

  if (loading || !interv) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Intervention' }} />
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.navy} />}
      </View>
    )
  }

  const phase = stepToPhase(interv.terrain_step ?? 0)
  const photos = interv.photos_urls || []
  const addr = fullAddress(interv, client)
  const phone = client?.telephone
  const hasRapport = !!(interv.rapport_json && Object.keys(interv.rapport_json).length > 0)

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: interv.reference || 'Intervention',
        }}
      />
      <PhaseBar terrainStep={interv.terrain_step ?? 0} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.client}>{client?.nom || 'Client'}</Text>
          <Text style={styles.meta}>
            {[interv.type_intervention, fmtHeure(interv.heure_prevue), fmtDateFR(interv.date_prevue)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {addr ? <Text style={styles.addr}>{addr}</Text> : null}
          {interv.notes_internes ? (
            <Text style={styles.notes}>{interv.notes_internes}</Text>
          ) : null}

          <View style={styles.actions}>
            {phone ? (
              <Pressable style={styles.action} onPress={() => void openTel(phone)}>
                <Text style={styles.actionText}>📞 Appeler</Text>
              </Pressable>
            ) : null}
            {addr ? (
              <Pressable style={styles.action} onPress={() => void openMaps(addr)}>
                <Text style={styles.actionText}>🗺️ GPS</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {photos.length > 0 ? (
          <ScrollView horizontal style={styles.thumbs} showsHorizontalScrollIndicator={false}>
            {photos.map((url) => (
              <Image key={url} source={{ uri: url }} style={styles.thumb} />
            ))}
          </ScrollView>
        ) : null}

        {phase === 0 ? (
          <View style={styles.block}>
            <Text style={styles.h}>Arrivée sur site</Text>
            <Text style={styles.p}>Prends une photo avant travaux, puis démarre.</Text>
            <BigButton
              label={photos.length === 0 ? '📷 Photo avant' : '📷 Autre photo'}
              onPress={() => void takePhoto(photos.length === 0 ? 'Photo avant intervention' : `Photo ${photos.length + 1}`)}
              loading={busy === 'photo'}
            />
            {photos.length >= 1 ? (
              <BigButton
                label="▶ Démarrer l’intervention"
                onPress={() => void terrainAction('debut')}
                loading={busy === 'debut'}
                variant="secondary"
              />
            ) : null}
          </View>
        ) : null}

        {phase === 1 ? (
          <View style={styles.block}>
            <Text style={styles.h}>Chantier</Text>
            {!interv.heure_debut_reelle ? (
              <BigButton
                label="▶ Démarrer l’intervention"
                onPress={() => void terrainAction('debut')}
                loading={busy === 'debut'}
              />
            ) : (
              <Text style={styles.ok}>Intervention démarrée.</Text>
            )}
            <BigButton
              label="📷 Photo chantier / après"
              onPress={() =>
                void takePhoto(photos.length < 2 ? 'Photo après intervention' : `Photo ${photos.length + 1}`)
              }
              loading={busy === 'photo'}
              variant="secondary"
            />
            {photos.length >= 2 ? (
              <BigButton label="Passer à la clôture" onPress={() => void terrainAction('set', 3)} loading={busy === 'set'} />
            ) : (
              <Text style={styles.p}>Une photo après travaux débloque la clôture.</Text>
            )}
          </View>
        ) : null}

        {phase === 2 ? (
          <View style={styles.block}>
            <Text style={styles.h}>Clôture</Text>
            {rapportPreview ? (
              <>
                {seoPreview?.titre_h1 ? <Text style={styles.previewTitle}>{seoPreview.titre_h1}</Text> : null}
                {rapportPreview.diagnostic ? (
                  <Text style={styles.preview}>{rapportPreview.diagnostic}</Text>
                ) : null}
                {rapportPreview.travaux_realises ? (
                  <Text style={styles.preview}>{rapportPreview.travaux_realises}</Text>
                ) : null}
                <BigButton label="Valider le rapport" onPress={() => void validateRapport()} loading={busy === 'save'} />
                <BigButton
                  label="Recommencer"
                  variant="secondary"
                  onPress={() => setRapportPreview(null)}
                />
              </>
            ) : (
              <>
                <Text style={styles.p}>Décris ce que tu as fait (bouchon, curage, résultat…).</Text>
                <TextInput
                  value={transcription}
                  onChangeText={setTranscription}
                  multiline
                  placeholder="Ex. WC bouché, hydrocurage 15 min, écoulement rétabli…"
                  placeholderTextColor={colors.slate400}
                  style={styles.area}
                />
                <BigButton
                  label={busy === 'generate' ? 'Rédaction du rapport…' : 'Générer le rapport'}
                  onPress={() => void generateRapport()}
                  loading={busy === 'generate'}
                  disabled={transcription.trim().length < 20}
                />
              </>
            )}
            {hasRapport ? (
              <>
                <Text style={styles.ok}>Rapport enregistré.</Text>
                <BigButton
                  label="Terminer et envoyer au client"
                  onPress={() => void closeAndClient()}
                  loading={busy === 'fin'}
                />
              </>
            ) : null}
          </View>
        ) : null}

        {phase === 3 ? (
          <View style={styles.block}>
            <Text style={styles.h}>Envoi client</Text>
            <Text style={styles.p}>Prépare les PDF, puis envoie le mail ou ouvre Messages.</Text>
            <BigButton
              label="Préparer facture + PDF"
              onPress={() => void prepareDocs()}
              loading={busy === 'pdfs'}
            />
            {client?.email ? (
              <BigButton
                label={interv.mail_envoye_at ? 'Renvoyer le mail' : 'Envoyer le mail'}
                onPress={() => void sendMail()}
                loading={busy === 'mail'}
                variant="secondary"
              />
            ) : (
              <Text style={styles.p}>Pas d’email client — SMS uniquement.</Text>
            )}
            {phone ? (
              <BigButton
                label="Ouvrir le SMS client"
                onPress={() => void sendSms()}
                loading={busy === 'sms'}
                variant="secondary"
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  body: { padding: 16, paddingBottom: 48, gap: 16 },
  error: { color: colors.red, fontWeight: '700' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  client: { fontSize: 20, fontWeight: '900', color: colors.navy },
  meta: { color: colors.slate500, fontWeight: '600' },
  addr: { color: colors.slate800, marginTop: 6 },
  notes: { color: colors.amber, marginTop: 8, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  action: {
    backgroundColor: colors.slate100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionText: { fontWeight: '800', color: colors.navy },
  thumbs: { flexGrow: 0 },
  thumb: { width: 96, height: 96, borderRadius: 12, marginRight: 8, backgroundColor: colors.slate200 },
  block: { gap: 12 },
  h: { fontSize: 18, fontWeight: '900', color: colors.slate800 },
  p: { color: colors.slate500, fontSize: 14, lineHeight: 20 },
  ok: { color: colors.emeraldDark, fontWeight: '700' },
  area: {
    minHeight: 140,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    fontSize: 16,
    color: colors.slate800,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  previewTitle: { fontSize: 16, fontWeight: '800', color: colors.navy },
  preview: { color: colors.slate600, lineHeight: 20, backgroundColor: colors.white, padding: 12, borderRadius: 12 },
})
