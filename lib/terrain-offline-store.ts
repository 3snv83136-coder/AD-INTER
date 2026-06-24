/**
 * Brouillons et file d'attente terrain (IndexedDB) — hors-ligne chantier.
 * Photos, dictée rapport, coordonnées client en attente de sync.
 */

export type TerrainDraftKind = 'transcription' | 'client'

export type TerrainDraft = {
  key: string
  intervention_id: string
  kind: TerrainDraftKind
  data: Record<string, string>
  updated_at: string
}

export type PendingTerrainPhoto = {
  local_id: string
  intervention_id: string
  legende: string
  blob: Blob
  created_at: string
}

const DB_NAME = 'allo-terrain-offline'
const DB_VERSION = 1
const DRAFTS = 'drafts'
const PHOTOS = 'photos'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DRAFTS)) {
        db.createObjectStore(DRAFTS, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(PHOTOS)) {
        db.createObjectStore(PHOTOS, { keyPath: 'local_id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB terrain'))
  })
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode)
        const request = run(transaction.objectStore(store))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error || new Error('IDB terrain'))
        transaction.oncomplete = () => db.close()
      }),
  )
}

function draftKey(interventionId: string, kind: TerrainDraftKind): string {
  return `${interventionId}:${kind}`
}

export async function saveTerrainDraft(
  interventionId: string,
  kind: TerrainDraftKind,
  data: Record<string, string>,
): Promise<void> {
  const record: TerrainDraft = {
    key: draftKey(interventionId, kind),
    intervention_id: interventionId,
    kind,
    data,
    updated_at: new Date().toISOString(),
  }
  await tx(DRAFTS, 'readwrite', s => s.put(record))
}

export async function loadTerrainDraft(
  interventionId: string,
  kind: TerrainDraftKind,
): Promise<TerrainDraft | null> {
  try {
    const row = await tx<TerrainDraft | undefined>(DRAFTS, 'readonly', s =>
      s.get(draftKey(interventionId, kind)),
    )
    return row ?? null
  } catch {
    return null
  }
}

export async function clearTerrainDraft(interventionId: string, kind: TerrainDraftKind): Promise<void> {
  await tx(DRAFTS, 'readwrite', s => s.delete(draftKey(interventionId, kind)))
}

export async function savePendingTerrainPhoto(
  interventionId: string,
  legende: string,
  blob: Blob,
  localId?: string,
): Promise<string> {
  const local_id = localId || crypto.randomUUID()
  const record: PendingTerrainPhoto = {
    local_id,
    intervention_id: interventionId,
    legende,
    blob,
    created_at: new Date().toISOString(),
  }
  await tx(PHOTOS, 'readwrite', s => s.put(record))
  return local_id
}

export async function listPendingTerrainPhotos(): Promise<PendingTerrainPhoto[]> {
  try {
    const all = await tx<PendingTerrainPhoto[]>(PHOTOS, 'readonly', s => s.getAll())
    return (all || []).sort((a, b) => a.created_at.localeCompare(b.created_at))
  } catch {
    return []
  }
}

export async function removePendingTerrainPhoto(localId: string): Promise<void> {
  await tx(PHOTOS, 'readwrite', s => s.delete(localId))
}

export async function countTerrainPending(): Promise<number> {
  try {
    const photos = await tx<number>(PHOTOS, 'readonly', s => s.count())
    const drafts = await tx<TerrainDraft[]>(DRAFTS, 'readonly', s => s.getAll())
    return photos + (drafts?.length ?? 0)
  } catch {
    return 0
  }
}
