import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/intervention-access"
import { cloturerRapporteurIntervention } from "@/lib/rapporteur"

export const dynamic = "force-dynamic"

type Params = { params: { id: string } }

export async function POST(_req: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  if (user.role === "tech") {
    return NextResponse.json({ error: "Accès réservé à l’administrateur" }, { status: 403 })
  }

  const result = await cloturerRapporteurIntervention(params.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result)
}
