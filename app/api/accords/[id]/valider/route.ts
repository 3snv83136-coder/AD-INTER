import { NextRequest, NextResponse } from "next/server"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"
import { uploadBlob } from "@/lib/storage"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Params = { params: { id: string } }

type Body = {
  signature?: string
  demande_expresse?: boolean
  renonciation_retractation?: boolean
}

/**
 * POST /api/accords/[id]/valider — validation sur place par signature.
 * Archive la signature, passe l'accord en VALIDE et enregistre les preuves
 * (horodatage, IP, user-agent, consentements).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const accordId = params.id
  if (!accordId) return NextResponse.json({ error: 'ID accord manquant' }, { status: 400 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (body.demande_expresse !== true || body.renonciation_retractation !== true) {
    return NextResponse.json(
      { error: 'Les deux consentements (demande expresse, renonciation) sont requis.' },
      { status: 400 },
    )
  }

  const signature = (body.signature || '').trim()
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(signature)
  if (!m) {
    return NextResponse.json({ error: 'Signature manquante ou format invalide' }, { status: 400 })
  }

  // L'accord doit exister et être encore en brouillon.
  const accord = await prisma.accordIntervention.findUnique({
    where: { id: accordId },
    select: { id: true, statut: true },
  })
  if (!accord) return NextResponse.json({ error: 'Accord introuvable' }, { status: 404 })
  if (accord.statut !== 'BROUILLON') {
    return NextResponse.json(
      { error: `Accord déjà « ${String(accord.statut).toLowerCase()} » — validation impossible.` },
      { status: 409 },
    )
  }

  // Décodage de la signature PNG/JPEG.
  const buf = Buffer.from(m[2], 'base64')
  if (buf.length < 200) {
    return NextResponse.json({ error: 'Signature vide' }, { status: 400 })
  }
  if (buf.length > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Signature trop lourde (max 2 MB)' }, { status: 413 })
  }

  const ext = m[1] === 'jpeg' ? 'jpg' : 'png'
  let signatureUrl: string
  try {
    signatureUrl = await uploadBlob({
      pathname: `accords/${accordId}/signature-${Date.now()}.${ext}`,
      body: buf,
      contentType: `image/${m[1]}`,
    })
  } catch (e) {
    return NextResponse.json(
      { error: `Upload de la signature échoué : ${e instanceof Error ? e.message : 'erreur'}` },
      { status: 502 },
    )
  }

  const valideAt = new Date()
  const ipClient =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  const userAgent = req.headers.get('user-agent') || null

  try {
    await prisma.accordIntervention.update({
      where: { id: accordId },
      data: {
        statut: 'VALIDE',
        valide_at: valideAt,
        canal_validation: 'SIGNATURE',
        signature_image: signatureUrl,
        demande_expresse: true,
        renonciation_retractation: true,
        ip_client: ipClient,
        user_agent: userAgent,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: `DB update échouée : ${e instanceof Error ? e.message : 'erreur'}` },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    valide_at: valideAt.toISOString(),
    signature_url: signatureUrl,
  })
}
