export const PAIEMENTS_INTERVENTION = [
  "Chèque sur place",
  "Paiement par virement",
  "Carte bleue",
] as const

export const DETAILS_TRAVAUX = [
  "Cuisine",
  "Lavabo",
  "Évier",
  "WC",
  "Salle de bain",
  "Douche",
  "Regard",
  "Extérieur",
  "Regard intérieur",
  "Regard extérieur",
  "Colonne",
] as const

export const ETAGES_RAPIDES = ["RDC", "SS", "1", "2", "3", "4", "5", "6"] as const

export type ConsignesIntervention = {
  paiements: string[]
  etage: string
  details: string[]
  extra: string
}

export function emptyConsignes(): ConsignesIntervention {
  return { paiements: [], etage: "", details: [], extra: "" }
}

function uniqueLabels(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const t = v.trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

function matchKnown(raw: string, known: readonly string[]): string[] {
  const found = new Set<string>()
  let remaining = raw
  const longestFirst = [...known].sort((a, b) => b.length - a.length)
  for (const label of longestFirst) {
    const idx = remaining.toLowerCase().indexOf(label.toLowerCase())
    if (idx < 0) continue
    found.add(label)
    remaining = remaining.slice(0, idx) + remaining.slice(idx + label.length)
  }
  if (found.size > 0) return known.filter((k) => found.has(k))
  return uniqueLabels(raw.split(/[,·•;|/]+/))
}

export function composeConsignesIntervention(c: ConsignesIntervention): string | null {
  const lines: string[] = []
  if (c.paiements.length > 0) lines.push(`Paiement : ${uniqueLabels(c.paiements).join(", ")}`)
  if (c.etage.trim()) lines.push(`Étage : ${c.etage.trim()}`)
  if (c.details.length > 0) lines.push(`Détail : ${uniqueLabels(c.details).join(", ")}`)
  if (c.extra.trim()) lines.push(`Notes : ${c.extra.trim()}`)
  return lines.join("\n") || null
}

export function parseConsignesIntervention(raw: string | null | undefined): ConsignesIntervention {
  const empty = emptyConsignes()
  if (!raw?.trim()) return empty
  const hasStructure = /^(Paiement|Étage|Etage|Détail|Detail|Notes)\s*:/im.test(raw)
  if (!hasStructure) return { ...empty, extra: raw.trim() }

  const next = emptyConsignes()
  const extraLines: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^(Paiement|Étage|Etage|Détail|Detail|Notes)\s*:\s*(.*)$/i)
    if (!m) {
      if (line.trim()) extraLines.push(line.trim())
      continue
    }
    const key = m[1].toLowerCase()
    const value = m[2].trim()
    if (!value) continue
    if (key === "paiement") next.paiements = matchKnown(value, PAIEMENTS_INTERVENTION)
    else if (key === "étage" || key === "etage") next.etage = value
    else if (key === "détail" || key === "detail") next.details = matchKnown(value, DETAILS_TRAVAUX)
    else extraLines.push(value)
  }
  next.extra = extraLines.join("\n").trim()
  return next
}

export function applyTextoNotes(
  current: ConsignesIntervention,
  notes: string,
): ConsignesIntervention {
  const parsed = parseConsignesIntervention(notes)
  const structured =
    parsed.paiements.length > 0 || Boolean(parsed.etage) || parsed.details.length > 0
  if (!structured) {
    return {
      ...current,
      extra: [current.extra, notes].filter((v) => v.trim()).join("\n"),
    }
  }
  return {
    paiements: uniqueLabels([...current.paiements, ...parsed.paiements]),
    etage: parsed.etage || current.etage,
    details: uniqueLabels([...current.details, ...parsed.details]),
    extra: [current.extra, parsed.extra].filter((v) => v.trim()).join("\n"),
  }
}

export function consignesHasContent(c: ConsignesIntervention): boolean {
  return c.paiements.length > 0 || Boolean(c.etage.trim()) || c.details.length > 0 || Boolean(c.extra.trim())
}
