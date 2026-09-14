import { NextRequest, NextResponse } from "next/server"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"
import { blobPaths, uploadBlob } from "@/lib/storage"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Params = { params: { id: string } }

/**
 * POST /api/accords/[id]/pdf — archive le PDF d'un accord sur Vercel Blob.
 *
 * Le PDF est rendu côté client (@react-pdf/renderer) puis envoyé en
 * multipart/form-data — même approche que /api/interventions/[id]/store-pdf
 * (évite la limite ~4.5 MB du body JSON sur Vercel).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const accordId = params.id
  if (!accordId) return NextResponse.json({ error: 'ID accord manquant' }, { status: 400 })

  const accord = await prisma.accordIntervention.findUnique({
    where: { id: accordId },
    select: { id: true },
  })
  if (!accord) return NextResponse.json({ error: 'Accord introuvable' }, { status: 404 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Multipart/form-data attendu' }, { status: 400 })
  }

  const file = formData.get('pdf')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'PDF manquant' }, { status: 400 })
  }
  if (file.size < 1000) {
    return NextResponse.json({ error: 'PDF trop petit (probablement corrompu)' }, { status: 400 })
  }
  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: 'PDF trop lourd (max 12 MB)' }, { status: 413 })
  }

  const buf = Buffer.from(await file.arrayBuffer())

  let url: string
  try {
    url = await uploadBlob({
      pathname: blobPaths.accord(accordId),
      body: buf,
      contentType: 'application/pdf',
    })
  } catch (e) {
    return NextResponse.json(
      { error: `Upload échoué : ${e instanceof Error ? e.message : 'erreur'}` },
      { status: 502 },
    )
  }

  try {
    await prisma.accordIntervention.update({
      where: { id: accordId },
      data: { pdf_url: url },
    })
  } catch (e) {
    return NextResponse.json(
      { error: `DB update échouée : ${e instanceof Error ? e.message : 'erreur'}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, url })
}
