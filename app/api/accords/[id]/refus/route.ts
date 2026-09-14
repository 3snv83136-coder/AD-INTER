import { NextRequest, NextResponse } from "next/server"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

type Body = { motif?: string | null }

/**
 * POST /api/accords/[id]/refus — le client refuse de valider l'accord.
 * Trace le refus (statut REFUSE + motif), protection en cas de litige inverse.
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

  const accord = await prisma.accordIntervention.findUnique({
    where: { id: accordId },
    select: { id: true, statut: true },
  })
  if (!accord) return NextResponse.json({ error: 'Accord introuvable' }, { status: 404 })
  if (accord.statut !== 'BROUILLON') {
    return NextResponse.json(
      { error: `Accord déjà « ${String(accord.statut).toLowerCase()} » — refus impossible.` },
      { status: 409 },
    )
  }

  const motif = (body.motif || '').trim() || null

  try {
    await prisma.accordIntervention.update({
      where: { id: accordId },
      data: { statut: 'REFUSE', motif_refus: motif },
    })
  } catch (e) {
    return NextResponse.json(
      { error: `DB update échouée : ${e instanceof Error ? e.message : 'erreur'}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
