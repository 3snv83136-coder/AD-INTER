import { NextRequest, NextResponse } from "next/server"
import { loadApportContext } from "@/lib/apport"
import { accepterSousTraitance } from "@/lib/contrat-sous-traitance"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type Params = { params: { token: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const loaded = await loadApportContext(params.token)
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  }
  if (loaded.ctx.pris_en_charge) {
    return NextResponse.json({
      ok: true,
      already: true,
      pris_en_charge: true,
    })
  }

  let body: { cgu?: unknown; signature?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }
  if (body.cgu !== true) {
    return NextResponse.json(
      { error: "Tu dois cocher la case d’acceptation des conditions générales d’Allo Débouchage." },
      { status: 400 },
    )
  }
  const signature = typeof body.signature === "string" ? body.signature : ""

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  const userAgent = req.headers.get("user-agent")

  const result = await accepterSousTraitance({
    interventionId: loaded.ctx.interventionId,
    sousTraitantId: loaded.ctx.payload.sousTraitantId,
    signatureDataUrl: signature,
    ip,
    userAgent,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({
    ok: true,
    already: result.already,
    pris_en_charge: true,
    pris_en_charge_at: result.pris_en_charge_at,
  })
}
