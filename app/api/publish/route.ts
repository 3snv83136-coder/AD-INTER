import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { getPrismaOrNull } from "@/lib/db"
import { upsertClient } from "@/lib/db-helpers"
import { uploadBlob, blobPaths } from "@/lib/storage"

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const publishApiUrl = process.env.PUBLISH_API_URL
  const token = process.env.PUBLISH_API_TOKEN

  if (!publishApiUrl || !token) {
    return NextResponse.json({ error: 'Config publication manquante' }, { status: 500 })
  }

  try {
    const response = await fetch(`${publishApiUrl}/api/gallery/publish/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    })

    const txt = await response.text()
    let data: Record<string, unknown> | null = null
    try { data = JSON.parse(txt) } catch { /* réponse non-JSON */ }

    if (!response.ok) {
      console.error('[publish] Publish API error', {
        status: response.status,
        url: `${publishApiUrl}/api/gallery/publish/`,
        contentType: response.headers.get('content-type'),
        bodyPreview: txt.slice(0, 2000),
        sentFields: Array.from(formData.keys()),
      })
      const msg = data
        ? (typeof data === 'string' ? data : (data.error as string) || (data.detail as string) || JSON.stringify(data))
        : `HTTP ${response.status} — ${txt.slice(0, 800)}`
      return NextResponse.json({ error: `Publish API : ${msg}`, status: response.status, bodyPreview: txt.slice(0, 800) }, { status: response.status })
    }

    persistIntervention(formData, data).catch(e => console.error('[publish] prisma persist', e))

    return NextResponse.json(data ?? { ok: true }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Publish fetch failed : ${msg}` }, { status: 500 })
  }
}

async function persistIntervention(formData: FormData, publishResponse: Record<string, unknown> | null) {
  const prisma = getPrismaOrNull()
  if (!prisma) return

  const get = (k: string) => {
    const v = formData.get(k)
    return typeof v === 'string' ? v : null
  }

  const clientNom = get('client_nom') || ''
  const clientEmail = get('client_email') || ''
  const clientAdresse = get('client_adresse') || ''
  const ville = get('intervention_city') || get('location') || ''
  const codePostal = get('postal_code') || ''
  const slug = (publishResponse?.slug as string) || get('slug') || ''
  const typeIntervention = get('service_type') || ''
  const dateRealisee = get('intervention_date') || null
  const transcription = get('transcription') || ''
  const rapportJson = safeParseJson(get('rapport_json'))
  const seoJson = safeParseJson(get('seo_json'))
  const reference = (rapportJson as { reference?: string })?.reference || null
  const interventionId = get('intervention_id')

  const clientId = await upsertClient({
    nom: clientNom,
    email: clientEmail,
    adresse: clientAdresse,
    ville,
    code_postal: codePostal,
  })

  const photosUrls = await uploadInterventionPhotos(formData, slug || interventionId || reference || 'intervention')

  const dateIso = dateRealisee && /^\d{4}-\d{2}-\d{2}$/.test(dateRealisee) ? new Date(dateRealisee) : null

  if (interventionId) {
    try {
      await prisma.intervention.update({
        where: { id: interventionId },
        data: {
          client_id: clientId,
          type_intervention: typeIntervention || null,
          adresse_chantier: clientAdresse || null,
          ville: ville || null,
          code_postal: codePostal || null,
          date_realisee: dateIso,
          statut: 'terminee',
          transcription: transcription || null,
          rapport_json: rapportJson as Prisma.InputJsonValue,
          seo_json: seoJson as Prisma.InputJsonValue,
          publie_slug: slug || null,
          ...(photosUrls.length > 0 ? { photos_urls: photosUrls } : {}),
        },
      })
    } catch (e) {
      console.error('[persistIntervention update]', e)
    }
    return
  }

  let attempt = 0
  let currentRef: string | null = reference
  while (attempt < 5) {
    try {
      await prisma.intervention.create({
        data: {
          reference: currentRef,
          client_id: clientId,
          type_intervention: typeIntervention || null,
          adresse_chantier: clientAdresse || null,
          ville: ville || null,
          code_postal: codePostal || null,
          date_realisee: dateIso,
          statut: 'terminee',
          transcription: transcription || null,
          rapport_json: rapportJson as Prisma.InputJsonValue,
          seo_json: seoJson as Prisma.InputJsonValue,
          publie_slug: slug || null,
          photos_urls: photosUrls.length > 0 ? photosUrls : [],
        },
      })
      return
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === 'P2002' && currentRef) {
        attempt++
        const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
        currentRef = `${reference}-${suffix}`
        continue
      }
      console.error('[persistIntervention]', e)
      return
    }
  }
  console.error('[persistIntervention] exhausted retries on duplicate reference')
}

function safeParseJson(s: string | null): Record<string, unknown> | null {
  if (!s) return null
  try { return JSON.parse(s) as Record<string, unknown> } catch { return null }
}

async function uploadInterventionPhotos(
  formData: FormData,
  folderKey: string,
): Promise<string[]> {
  const before = formData.get('before_image')
  const after = formData.get('after_image')

  const ordered: File[] = []
  if (before instanceof File && before.size > 0) ordered.push(before)
  if (
    after instanceof File && after.size > 0 &&
    !(before instanceof File && after.name === before.name && after.size === before.size && after.lastModified === before.lastModified)
  ) {
    ordered.push(after)
  }
  for (let i = 0; ; i++) {
    const f = formData.get(`extra_image_${i}`)
    if (!(f instanceof File) || f.size === 0) break
    ordered.push(f)
  }
  if (ordered.length === 0) return []

  const folder = (folderKey || 'intervention').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
  const stamp = Date.now()
  const urls: string[] = []
  for (let i = 0; i < ordered.length; i++) {
    const file = ordered[i]
    const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.jpg').toLowerCase()
    const filename = `${stamp}-${i}${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    try {
      const url = await uploadBlob({
        pathname: blobPaths.photo(folder, filename),
        body: buf,
        contentType: file.type || 'image/jpeg',
      })
      urls.push(url)
    } catch (e) {
      console.error('[uploadInterventionPhotos]', { filename, error: e instanceof Error ? e.message : e })
    }
  }
  return urls
}
