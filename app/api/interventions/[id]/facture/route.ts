import { NextRequest, NextResponse } from "next/server"
import { getPrismaOrNull, dbNotConfiguredResponse } from "@/lib/db"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  try {
    const facture = await prisma.document.findFirst({
      where: { intervention_id: params.id, type: 'facture' },
      orderBy: { created_at: 'desc' },
      select: {
        id: true, numero: true, montant_ht: true, montant_ttc: true, tva_taux: true,
        pdf_url: true, payload: true, agence: true, date_emission: true, echeance: true, statut: true,
      },
    })

    if (!facture) return NextResponse.json({ facture: null })

    return NextResponse.json({
      facture: {
        ...facture,
        montant_ht: facture.montant_ht != null ? Number(facture.montant_ht) : null,
        montant_ttc: facture.montant_ttc != null ? Number(facture.montant_ttc) : null,
        tva_taux: facture.tva_taux != null ? Number(facture.tva_taux) : null,
        date_emission: facture.date_emission.toISOString().slice(0, 10),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur base de données'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
