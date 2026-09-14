import { NextRequest, NextResponse } from "next/server"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/**
 * POST /api/accords/[id]/annuler — annule un accord encore en brouillon.
 * Un accord VALIDE (signé) ou REFUSE n'est pas annulable depuis l'app : il
 * constitue une preuve et reste tel quel.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const accordId = params.id
  if (!accordId) return NextResponse.json({ error: 'ID accord manquant' }, { status: 400 })

  const accord = await prisma.accordIntervention.findUnique({
    where: { id: accordId },
    select: { id: true, statut: true },
  })
  if (!accord) return NextResponse.json({ error: 'Accord introuvable' }, { status: 404 })
  if (accord.statut !== 'BROUILLON') {
    return NextResponse.json(
      { error: `Accord « ${String(accord.statut).toLowerCase()} » — annulation impossible.` },
      { status: 409 },
    )
  }

  try {
    await prisma.accordIntervention.update({
      where: { id: accordId },
      data: { statut: 'ANNULE' },
    })
  } catch (e) {
    return NextResponse.json(
      { error: `DB update échouée : ${e instanceof Error ? e.message : 'erreur'}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
