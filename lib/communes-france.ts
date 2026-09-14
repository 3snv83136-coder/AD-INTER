/** Commune + code postal — même forme que le catalogue Var. */
export type CommuneFr = { nom: string; cp: string }

type GeoCommune = {
  nom: string
  codesPostaux?: string[]
}

type BanFeature = {
  properties?: {
    city?: string
    name?: string
    postcode?: string
    type?: string
  }
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function expandCommunes(rows: GeoCommune[], preferCp?: string): CommuneFr[] {
  const out: CommuneFr[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const cps = (row.codesPostaux || []).filter(Boolean)
    if (cps.length === 0) continue
    const filtered = preferCp ? cps.filter((cp) => cp.startsWith(preferCp)) : [cps[0]]
    const chosen = filtered.length > 0 ? filtered : [cps[0]]
    for (const cp of chosen) {
      const key = `${row.nom}|${cp}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ nom: row.nom, cp })
    }
  }
  return out
}

function fromBan(features: BanFeature[] | undefined): CommuneFr[] {
  const rows = [...(features || [])].sort((a, b) => {
    const am = a.properties?.type === "municipality" ? 0 : 1
    const bm = b.properties?.type === "municipality" ? 0 : 1
    return am - bm
  })
  const out: CommuneFr[] = []
  const seen = new Set<string>()
  for (const f of rows) {
    const nom = (f.properties?.city || f.properties?.name || "").trim()
    const cp = (f.properties?.postcode || "").replace(/\D/g, "").slice(0, 5)
    if (!nom || cp.length !== 5) continue
    const key = `${nom}|${cp}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ nom, cp })
  }
  return out
}

async function searchByName(q: string, limit: number): Promise<CommuneFr[]> {
  const ban = await fetchJson<{ features?: BanFeature[] }>(
    `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&type=municipality&limit=${limit}`,
  )
  const fromBanList = fromBan(ban?.features)
  if (fromBanList.length > 0) return fromBanList.slice(0, limit)

  const geo = await fetchJson<GeoCommune[]>(
    `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,codesPostaux&boost=population&limit=${limit}`,
  )
  return expandCommunes(Array.isArray(geo) ? geo : []).slice(0, limit)
}

async function searchByPostalCode(digits: string, limit: number): Promise<CommuneFr[]> {
  if (digits.length !== 5) return []

  const ban = await fetchJson<{ features?: BanFeature[] }>(
    `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(digits)}&limit=${limit}`,
    10000,
  )
  const fromBanList = fromBan(ban?.features).filter((c) => c.cp === digits)
  if (fromBanList.length > 0) return fromBanList.slice(0, limit)

  const geo = await fetchJson<GeoCommune[]>(
    `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(digits)}&fields=nom,codesPostaux&limit=${limit}`,
    8000,
  )
  return expandCommunes(Array.isArray(geo) ? geo : [], digits).slice(0, limit)
}

export async function searchCommunesFrance(query: string, limit = 12): Promise<CommuneFr[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const digits = q.replace(/\s+/g, "")
  if (/^\d{2,5}$/.test(digits)) {
    return searchByPostalCode(digits, limit)
  }
  return searchByName(q, limit)
}
