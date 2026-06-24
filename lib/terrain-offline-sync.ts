/**
 * Synchronise la file terrain (photos en attente) dès que le réseau revient.
 */

import {
  listPendingTerrainPhotos,
  removePendingTerrainPhoto,
} from '@/lib/terrain-offline-store'

let running = false

export async function syncTerrainPending(): Promise<{ uploaded: number; failed: number }> {
  if (running || typeof window === 'undefined' || !navigator.onLine) {
    return { uploaded: 0, failed: 0 }
  }
  running = true
  let uploaded = 0
  let failed = 0

  try {
    const pending = await listPendingTerrainPhotos()
    for (const item of pending) {
      try {
        const fd = new FormData()
        fd.append('photo', item.blob, `offline-${item.local_id}.jpg`)
        fd.append('legende', item.legende)
        const res = await fetch(`/api/interventions/${item.intervention_id}/photo`, {
          method: 'POST',
          body: fd,
        })
        if (!res.ok) {
          failed += 1
          continue
        }
        await removePendingTerrainPhoto(item.local_id)
        uploaded += 1
      } catch {
        failed += 1
      }
    }
  } finally {
    running = false
  }

  return { uploaded, failed }
}

export function registerTerrainSyncOnOnline(): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = () => {
    void syncTerrainPending()
  }
  window.addEventListener('online', handler)
  if (navigator.onLine) void syncTerrainPending()

  return () => window.removeEventListener('online', handler)
}
