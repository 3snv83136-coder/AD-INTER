'use client'

import { useEffect, useState } from 'react'
import { countPendingAccords } from '@/lib/accord/offline-store'
import { syncPendingAccords } from '@/lib/accord/sync'
import { countTerrainPending } from '@/lib/terrain-offline-store'
import { registerTerrainSyncOnOnline, syncTerrainPending } from '@/lib/terrain-offline-sync'

export default function TerrainSyncBadge() {
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [offline, setOffline] = useState(false)

  async function refreshCount() {
    const [terrain, accords] = await Promise.all([countTerrainPending(), countPendingAccords()])
    setPending(terrain + accords)
  }

  useEffect(() => {
    const updateOnline = () => setOffline(!navigator.onLine)
    updateOnline()
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    const unregister = registerTerrainSyncOnOnline()
    void refreshCount()
    const interval = setInterval(() => void refreshCount(), 8000)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
      unregister()
      clearInterval(interval)
    }
  }, [])

  async function handleSync() {
    setSyncing(true)
    try {
      await syncTerrainPending()
      await syncPendingAccords()
      await refreshCount()
    } finally {
      setSyncing(false)
    }
  }

  if (!offline && pending === 0) return null

  return (
    <button
      type="button"
      onClick={() => void handleSync()}
      disabled={syncing || offline}
      className={`text-xs font-bold px-3 py-2 rounded-lg shrink-0 transition ${
        offline
          ? 'bg-amber-500/20 text-amber-200'
          : 'bg-white/15 text-white hover:bg-white/25'
      }`}
      title={offline ? 'Hors ligne — données sauvegardées sur l\'appareil' : 'Synchroniser les données en attente'}
    >
      {offline ? '📴 Hors ligne' : syncing ? '↻ Sync…' : `↻ ${pending} en attente`}
    </button>
  )
}
