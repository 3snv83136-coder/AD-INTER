import { NextRequest, NextResponse } from "next/server"
import { deepseek } from "@/lib/deepseek"
import { findVilleByName } from "@/lib/villes-var"
import { searchCommunesFrance } from "@/lib/communes-france"
import { TYPES_INTERVENTION } from "@/lib/types-intervention"
import { mergeTextoFields, parseTextoLocal, type TextoFields } from "@/lib/parse-texto"

const MODEL = "deepseek-v4-flash"
const TYPES = [...TYPES_INTERVENTION]

async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let lastErr: any
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e: any) {
      lastErr = e
      const status = e?.status || e?.response?.status
      const msg = String(e?.message || '')
      const retryable =
        status === 529 || status === 503 || status === 500 || status === 429 ||
        /529|overloaded|503|500|429|rate.?limit/i.test(msg)
      if (!retryable || attempt === maxAttempts) throw e
      const delay = Math.min(1500 * Math.pow(2, attempt - 1), 10000) + Math.random() * 800
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

function parseJson(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  try { return JSON.parse(cleaned) } catch {}
  const lastBrace = cleaned.lastIndexOf('}')
  if (lastBrace > 0) {
    try { return JSON.parse(cleaned.slice(0, lastBrace + 1)) } catch {}
  }
  throw new Error('JSON invalide')
}

export async function POST(req: NextRequest) {
  const { transcription } = await req.json()
  if (!transcription || typeof transcription !== 'string' || transcription.trim().length < 10) {
    return NextResponse.json({ error: 'Dictée trop courte' }, { status: 400 })
  }
  const local = parseTextoLocal(transcription)
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({
      ...local,
      warning: "IA indisponible — champs remplis en mode rapide depuis le texto.",
    })
  }

  const prompt = `Tu extraits des informations depuis une dictée OU un SMS collé (texto client) pour Allo Débouchage, partout en France.

Texte : """
${transcription}
"""

Types d'intervention possibles (choisis LE PLUS proche) :
${TYPES.map(t => `- ${t}`).join('\n')}

La ville et le code postal peuvent être n'importe où en France. N'INVENTE PAS un code postal, un téléphone ou un nom.

Extrait les champs. Si une info est absente, renvoie "" (chaîne vide). N'INVENTE RIEN.

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans backticks) :
{
  "type_intervention": "un des types de la liste ci-dessus",
  "ville": "nom officiel de la commune",
  "code_postal": "code postal à 5 chiffres si présent, sinon \\"\\"",
  "adresse": "rue/numéro si mentionné, sinon \\"\\"",
  "client_nom": "nom du client (Mme X, M. Y, société), sinon \\"\\"",
  "client_email": "email si présent, sinon \\"\\"",
  "client_telephone": "numéro FR si présent, sinon \\"\\"",
  "date_intervention": "YYYY-MM-DD si une date est claire, sinon \\"\\"",
  "heure": "HH:MM si une heure est claire, sinon \\"\\"",
  "notes": "le reste utile (accès, étage, symptômes), sinon \\"\\""
}`

  // Fallback gracieux : si l'API est KO, on renvoie des champs vides pour ne pas bloquer le flow.
  let msg
  try {
    msg = await callWithRetry(() => deepseek.messages.create({
      model: MODEL,
      max_tokens: 1500,
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: prompt }],
    }))
  } catch (e: any) {
    return NextResponse.json({
      ...local,
      warning: `Extraction IA indisponible (${e?.status || ''} ${String(e?.message || '').slice(0, 120)}) — champs remplis en mode rapide.`,
    })
  }

  let data: any
  try {
    data = parseJson(
      (msg.content as { type: string; text: string }[])
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("")
    )
  } catch (e: any) {
    return NextResponse.json({
      ...local,
      warning: "Réponse IA illisible — champs remplis en mode rapide.",
    })
  }

  // Normalisation ville + récupération CP (France entière)
  let ville = typeof data.ville === "string" ? data.ville.trim() : ""
  let codePostal = typeof data.code_postal === "string"
    ? data.code_postal.replace(/\D/g, "").slice(0, 5)
    : ""
  if (ville) {
    const exact = findVilleByName(ville)
    if (exact) {
      ville = exact.nom
      if (!codePostal) codePostal = exact.cp
    } else {
      try {
        const remote = await searchCommunesFrance(ville, 1)
        if (remote[0]) {
          ville = remote[0].nom
          if (!codePostal) codePostal = remote[0].cp
        }
      } catch {
        /* on garde la ville extraite */
      }
    }
  }

  const ai: Partial<TextoFields> = {
    type_intervention: TYPES.includes(data.type_intervention) ? data.type_intervention : "",
    ville,
    code_postal: codePostal,
    adresse: typeof data.adresse === "string" ? data.adresse : "",
    client_nom: typeof data.client_nom === "string" ? data.client_nom : "",
    client_email: typeof data.client_email === "string" ? data.client_email : "",
    client_telephone: typeof data.client_telephone === "string" ? data.client_telephone : "",
    date_intervention: typeof data.date_intervention === "string" ? data.date_intervention : "",
    heure: typeof data.heure === "string" ? data.heure : "",
    notes: typeof data.notes === "string" ? data.notes : "",
  }

  return NextResponse.json(mergeTextoFields(ai, local))
}
