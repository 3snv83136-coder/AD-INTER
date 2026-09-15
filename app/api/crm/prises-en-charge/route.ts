import { NextResponse } from "next/server"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"
import { getSessionUser } from "@/lib/intervention-access"

export const dynamic = "force-dynamic"

const FENETRE_MS = 24 * 60 * 60 * 1000

export type PriseEnChargeCrm = {
  id: string
  intervention_id: string
  sous_traitant_nom: string
  type_intervention: string | null
  ville: string | null
  reference: string | null
  signed_at: string
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  if (user.role === "tech") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  try {
    const rows = await prisma.contratSousTraitance.findMany({
      where: { created_at: { gte: new Date(Date.now() - FENETRE_MS) } },
      orderBy: { created_at: "desc" },
      take: 20,
      select: {
        id: true,
        created_at: true,
        signataire_nom: true,
        intervention_id: true,
        intervention: {
          select: {
            type_intervention: true,
            ville: true,
            reference: true,
          },
        },
      },
    })

    const prises: PriseEnChargeCrm[] = rows.map((r) => ({
      id: r.id,
      intervention_id: r.intervention_id,
      sous_traitant_nom: r.signataire_nom,
      type_intervention: r.intervention.type_intervention,
      ville: r.intervention.ville,
      reference: r.intervention.reference,
      signed_at: r.created_at.toISOString(),
    }))

    return NextResponse.json({ prises })
  } catch (e) {
    console.error("[crm/prises-en-charge]", e)
    return NextResponse.json({ prises: [] as PriseEnChargeCrm[] })
  }
}
