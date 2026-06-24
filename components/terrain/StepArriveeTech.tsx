'use client'

import { useState } from 'react'
import TerrainPhotoCapture from '@/components/terrain/TerrainPhotoCapture'
import TerrainBigButton from '@/components/terrain/TerrainBigButton'
import { proxyImageUrl } from '@/lib/proxyImageUrl'

type Intervention = {
  id: string
  photos_urls: string[] | null
}

type Props = {
  interv: Intervention
  onStart: () => void | Promise<void>
  onPhotoUploaded: () => void | Promise<void>
  onError: (msg: string) => void
  starting?: boolean
}

/** Phase 1 — photo optionnelle + un seul bouton pour démarrer. */
export default function StepArriveeTech({ interv, onStart, onPhotoUploaded, onError, starting }: Props) {
  const [skippedPhoto, setSkippedPhoto] = useState(false)
  const hasPhoto = !!(interv.photos_urls && interv.photos_urls.length > 0)

  return (
    <section className="space-y-6">
      <header className="text-center px-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Arrivée sur site</h1>
        <p className="text-sm text-slate-600 mt-2">Photo optionnelle, puis démarrez le chrono.</p>
      </header>

      {hasPhoto && (
        <div className="rounded-2xl overflow-hidden border-2 border-emerald-200 bg-emerald-50">
          <img
            src={proxyImageUrl(interv.photos_urls![0])}
            alt="Photo avant"
            className="w-full max-h-52 object-cover"
          />
          <p className="text-xs text-emerald-800 font-bold py-2 text-center">✓ Photo enregistrée</p>
        </div>
      )}

      {!hasPhoto && !skippedPhoto && (
        <TerrainPhotoCapture
          interventionId={interv.id}
          legendeDefaut="Photo avant intervention"
          titre="📷 Photo avant (optionnel)"
          onUploaded={(_url, _step) => { void onPhotoUploaded() }}
          onOfflineQueued={() => { void onPhotoUploaded() }}
        />
      )}

      <TerrainBigButton onClick={() => void onStart()} loading={starting}>
        ▶ COMMENCER L&apos;INTERVENTION
      </TerrainBigButton>

      {!hasPhoto && !skippedPhoto && (
        <TerrainBigButton variant="ghost" onClick={() => setSkippedPhoto(true)}>
          Passer la photo
        </TerrainBigButton>
      )}
    </section>
  )
}
