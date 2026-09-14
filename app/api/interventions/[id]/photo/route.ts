import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, assertInterventionAccess } from "@/lib/intervention-access"
import { getPrismaOrNull, dbNotConfiguredResponse } from "@/lib/db"
import { uploadBlob, blobPaths } from "@/lib/storage"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Params = { params: { id: string } }

/**
 * Upload d'une photo unique pour le Mode Terrain.
 * Multipart/form-data : `photo` (File), `legende` (string, optionnel).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: 'ID intervention manquant' }, { status: 400 })
  }

  const user = await getSessionUser()
  const access = await assertInterventionAccess(interventionId, user)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Multipart/form-data attendu' }, { status: 400 })
  }

  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Photo manquante' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Photo trop lourde (max 10 MB)' }, { status: 413 })
  }

  const legende = String(formData.get('legende') || '').trim().slice(0, 200)

  const interv = await prisma.intervention.findUnique({
    where: { id: interventionId },
    select: { id: true, photos_urls: true, photos_legendes: true, terrain_step: true },
  })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.jpg').toLowerCase()
  const filename = `${Date.now()}${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  let url: string
  try {
    url = await uploadBlob({
      pathname: blobPaths.photo(interventionId, filename),
      body: buf,
      contentType: file.type || 'image/jpeg',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Upload échoué : ${msg}` }, { status: 502 })
  }

  const photosUrls = [...(interv.photos_urls || []), url]
  const photosLegendes = [...(interv.photos_legendes || []), legende || defaultLegende(photosUrls.length - 1)]

  const currentStep = interv.terrain_step ?? 0
  let nextStep = currentStep
  const count = photosUrls.length
  if (count >= 1 && currentStep < 1) nextStep = 1
  else if (count >= 2 && currentStep < 3) nextStep = 3

  try {
    const updated = await prisma.intervention.update({
      where: { id: interventionId },
      data: {
        photos_urls: photosUrls,
        photos_legendes: photosLegendes,
        terrain_step: nextStep,
      },
      select: { id: true, photos_urls: true, photos_legendes: true, terrain_step: true },
    })

    return NextResponse.json({
      ok: true,
      url,
      photos_urls: updated.photos_urls,
      photos_legendes: updated.photos_legendes,
      terrain_step: updated.terrain_step,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function defaultLegende(index: number): string {
  if (index === 0) return 'Photo avant intervention'
  if (index === 1) return 'Photo après intervention'
  return `Photo ${index + 1}`
}
