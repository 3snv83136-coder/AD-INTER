import { detectTypeIntervention } from "@/lib/types-intervention"

export type TextoFields = {
  client_nom: string
  client_email: string
  client_telephone: string
  adresse: string
  ville: string
  code_postal: string
  type_intervention: string
  date_intervention: string
  heure: string
  notes: string
}

export function emptyTextoFields(): TextoFields {
  return {
    client_nom: "",
    client_email: "",
    client_telephone: "",
    adresse: "",
    ville: "",
    code_postal: "",
    type_intervention: "",
    date_intervention: "",
    heure: "",
    notes: "",
  }
}

function pickPhone(text: string): string {
  const m = text.match(/(?:\+33|0033|0)\s*[1-9](?:[\s.-]*\d{2}){4}/)
  if (!m) return ""
  return m[0].replace(/[^\d+]/g, "").replace(/^0033/, "+33").replace(/^0/, "0")
}

function toIsoDate(d: number, m: number, y: number): string {
  const year = y < 100 ? 2000 + y : y
  const mm = String(m).padStart(2, "0")
  const dd = String(d).padStart(2, "0")
  return `${year}-${mm}-${dd}`
}

/** Parse rapide d’un SMS / texto (sans IA) : téléphone, email, CP, type. */
export function parseTextoLocal(text: string): TextoFields {
  const out = emptyTextoFields()
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  if (email) out.client_email = email[0]
  out.client_telephone = pickPhone(text)

  const cpVille = text.match(/\b(\d{5})[ \t]+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\- ]{2,40})/)
  if (cpVille) {
    out.code_postal = cpVille[1]
    out.ville = cpVille[2].trim().replace(/[,.]$/, "")
  } else {
    const cp = text.match(/\b(\d{5})\b/)
    if (cp) out.code_postal = cp[1]
  }

  const addr = text.match(
    /\d{1,4}\s+(?:rue|av(?:enue)?|bd|boulevard|chemin|impasse|place|all[ée]e|route|quai)[\s\S]{3,60}/i,
  )
  if (addr) {
    out.adresse = addr[0].split(/\n/)[0].replace(/\s+\d{5}\b.*/, "").trim()
  }

  const detected = detectTypeIntervention(text)
  if (detected) out.type_intervention = detected

  const date = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/)
  if (date) out.date_intervention = toIsoDate(Number(date[1]), Number(date[2]), Number(date[3]))

  const heure = text.match(/\b(\d{1,2})\s*[hH:]\s*(\d{2})?\b/)
  if (heure) {
    const hh = String(Math.min(23, Number(heure[1]))).padStart(2, "0")
    const min = heure[2] ? heure[2] : "00"
    out.heure = `${hh}:${min}`
  }

  const nom = text.match(/\b(?:mme|mr|m\.|madame|monsieur)\s+([A-Za-zÀ-ÿ'’\-]{2,30}(?:\s+[A-Za-zÀ-ÿ'’\-]{2,30})?)/i)
  if (nom) out.client_nom = nom[0].replace(/\s+/g, " ").trim()

  return out
}

export function mergeTextoFields(primary: Partial<TextoFields>, fallback: TextoFields): TextoFields {
  const base = emptyTextoFields()
  const keys = Object.keys(base) as (keyof TextoFields)[]
  const out = { ...base }
  for (const k of keys) {
    const a = (primary[k] || "").trim()
    const b = (fallback[k] || "").trim()
    out[k] = a || b
  }
  return out
}
