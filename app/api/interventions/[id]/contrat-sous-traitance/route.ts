import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/intervention-access"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"
import { FLUX_RAPPORTEUR } from "@/lib/rapporteur"

export const dynamic = "force-dynamic"
export const maxDuration = 30

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
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

  const interv = await prisma.intervention.findUnique({
    where: { id: params.id },
    select: { id: true, flux: true },
  })
  if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })
  if (interv.flux !== FLUX_RAPPORTEUR) {
    return NextResponse.json({ error: "Pas une affaire rapporteur" }, { status: 400 })
  }

  const contrat = await prisma.contratSousTraitance.findUnique({
    where: { intervention_id: params.id },
  })
  if (!contrat) {
    return NextResponse.json({ error: "Aucun contrat signé pour cette affaire" }, { status: 404 })
  }

  let pdf: ArrayBuffer
  try {
    const res = await fetch(contrat.pdf_url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    pdf = await res.arrayBuffer()
  } catch {
    return NextResponse.json({ error: "Impossible de lire le contrat archivé" }, { status: 502 })
  }

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contrat-sous-traitance-${params.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Preuve-Hash": contrat.preuve_hash,
    },
  })
}
