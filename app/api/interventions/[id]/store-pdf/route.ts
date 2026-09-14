import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getPrismaOrNull, dbNotConfiguredResponse } from "@/lib/db"
import { uploadBlob, blobPaths } from "@/lib/storage"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Params = { params: { id: string } }

/**
 * Upload d'un PDF (rapport ou facture) sur Vercel Blob et
 * persistance de l'URL publique en DB.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const interventionId = params.id
  if (!interventionId) return NextResponse.json({ error: 'ID intervention manquant' }, { status: 400 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Multipart/form-data attendu' }, { status: 400 })
  }

  const kind = String(formData.get('kind') || '').trim()
  if (kind !== 'rapport' && kind !== 'facture') {
    return NextResponse.json({ error: 'kind doit être "rapport" ou "facture"' }, { status: 400 })
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

  let factureId: string | null = null
  if (kind === 'facture') {
    const fac = await prisma.document.findFirst({
      where: { intervention_id: interventionId, type: 'facture' },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    })
    factureId = fac?.id || null
    if (!factureId) {
      return NextResponse.json({ error: 'Aucune facture trouvée pour cette intervention' }, { status: 404 })
    }
  }

  const nonce = crypto.randomBytes(3).toString('hex')
  const filename = `${kind}-${Date.now()}-${nonce}.pdf`
  const buf = Buffer.from(await file.arrayBuffer())

  let url: string
  try {
    url = await uploadBlob({
      pathname: blobPaths.pdf(interventionId, filename),
      body: buf,
      contentType: 'application/pdf',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Upload échoué : ${msg}` }, { status: 502 })
  }

  try {
    if (kind === 'rapport') {
      await prisma.intervention.update({
        where: { id: interventionId },
        data: { pdf_rapport_url: url },
      })
    } else {
      await prisma.document.update({
        where: { id: factureId! },
        data: { pdf_url: url },
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: `DB update échouée : ${msg}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, url, kind })
}
