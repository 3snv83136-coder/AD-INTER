import { NextRequest, NextResponse } from 'next/server'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error, releves: [] }, { status: err.status })
  }

  const url = new URL(req.url)
  const annee = url.searchParams.get('annee')
  const mois = url.searchParams.get('mois')

  const data = await prisma.releveBancaire.findMany({
    where: {
      ...(annee ? { periode_annee: Number(annee) } : {}),
      ...(mois ? { periode_mois: Number(mois) } : {}),
    },
    select: {
      id: true,
      compte_id: true,
      periode_annee: true,
      periode_mois: true,
      pdf_url: true,
      fichier_nom: true,
      nb_operations: true,
      solde_fin_mois: true,
      notes: true,
      uploaded_at: true,
    },
    orderBy: [{ periode_annee: 'desc' }, { periode_mois: 'desc' }],
    take: 36,
  })

  const releves = data.map(r => ({
    ...r,
    solde_fin_mois: r.solde_fin_mois != null ? Number(r.solde_fin_mois) : null,
    uploaded_at: r.uploaded_at.toISOString(),
  }))

  return NextResponse.json({ releves })
}
