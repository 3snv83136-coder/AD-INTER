import { NextRequest, NextResponse } from "next/server"
import { persistFacture, type PersistFactureInput } from "@/lib/persist"
import { getSessionUser } from "@/lib/intervention-access"
import { canEditFacture } from "@/lib/permissions"
import { findDocumentId } from "@/lib/db-helpers"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let body: PersistFactureInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  if (!body?.facture || typeof body.facture !== "object") {
    return NextResponse.json({ error: "Champ facture manquant" }, { status: 400 })
  }

  const role = (await getSessionUser())?.role
  if (role && !canEditFacture(role)) {
    const numero = typeof body.numero === "string"
      ? body.numero
      : body.facture?.numero
    const existing = await findDocumentId("facture", numero)
    if (existing) {
      return NextResponse.json(
        { error: "Cette action est réservée à l’administrateur." },
        { status: 403 },
      )
    }
  }

  try {
    const id = await persistFacture({ ...body, emailSent: false })
    if (!id) {
      return NextResponse.json({
        error: "Sauvegarde impossible (Supabase non configuré ou erreur d'insertion)",
      }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur de sauvegarde" },
      { status: 500 },
    )
  }
}
