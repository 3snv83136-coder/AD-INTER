import { NextRequest, NextResponse } from 'next/server'
import { upsertPreBilan } from '@/lib/compta-pre-bilan'
import { moisPrecedent } from '@/lib/compta-kpis'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'

export const dynamic = 'force-dynamic'

const selectCols = {
  id: true,
  periode_annee: true,
  periode_mois: true,
  statut: true,
  snapshot: true,
  releve_id: true,
  comptable_email: true,
  envoye_at: true,
  valide_at: true,
  valide_par: true,
  created_at: true,
  updated_at: true,
} as const

function serializePreBilan(row: {
  id: string
  periode_annee: number
  periode_mois: number
  statut: string
  snapshot: unknown
  releve_id: string | null
  comptable_email: string | null
  envoye_at: Date | null
  valide_at: Date | null
  valide_par: string | null
  created_at: Date
  updated_at: Date
}) {
  return {
    ...row,
    envoye_at: row.envoye_at?.toISOString() ?? null,
    valide_at: row.valide_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  const url = new URL(req.url)
  const anneeParam = url.searchParams.get('annee')
  const moisParam = url.searchParams.get('mois')

  const def = moisPrecedent()
  const annee = anneeParam ? Number(anneeParam) : def.annee

  if (!moisParam) {
    const data = await prisma.preBilan.findMany({
      where: { periode_annee: annee },
      select: selectCols,
      orderBy: { periode_mois: 'asc' },
    })

    return NextResponse.json({ pre_bilans: data.map(serializePreBilan), annee })
  }

  const mois = Number(moisParam)

  const data = await prisma.preBilan.findUnique({
    where: { periode_annee_periode_mois: { periode_annee: annee, periode_mois: mois } },
    select: selectCols,
  })

  return NextResponse.json({
    pre_bilan: data ? serializePreBilan(data) : null,
    annee,
    mois,
  })
}

export async function POST(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  let body: { annee?: number; mois?: number }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const def = moisPrecedent()
  const annee = body.annee || def.annee
  const mois = body.mois || def.mois

  try {
    const result = await upsertPreBilan(annee, mois)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur génération pré-bilan' },
      { status: 500 },
    )
  }
}
