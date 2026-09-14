import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/intervention-access"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"

export const dynamic = "force-dynamic"

async function requireAdmin(): Promise<NextResponse | null> {
  if (!process.env.AUTH_USER_1 && !process.env.AUTH_TECH_1) return null
  const user = await getSessionUser()
  if (user?.role === "tech") {
    return NextResponse.json({ error: "Accès réservé à l’administrateur" }, { status: 403 })
  }
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }
  return null
}

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error, sous_traitants: [] }, { status })
  }
  try {
    const rows = await prisma.sousTraitant.findMany({
      where: { actif: true },
      orderBy: { nom: "asc" },
    })
    return NextResponse.json({
      sous_traitants: rows.map((s) => ({
        ...s,
        created_at: s.created_at.toISOString(),
        updated_at: s.updated_at.toISOString(),
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur base de données"
    return NextResponse.json({ error: msg, sous_traitants: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  let body: {
    nom?: string
    email?: string
    telephone?: string
    notes?: string
    siret?: string
    adresse?: string
    code_postal?: string
    ville?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const nom = (body.nom || "").trim()
  if (!nom) return NextResponse.json({ error: "Nom du sous-traitant requis" }, { status: 400 })

  const siret = (body.siret || "").replace(/[\s.-]/g, "")
  const adresseLigne = [
    (body.adresse || "").trim(),
    [(body.code_postal || "").trim(), (body.ville || "").trim()].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ")
  const notesParts = [
    /^\d{14}$/.test(siret) ? `SIRET ${siret}` : "",
    adresseLigne,
    (body.notes || "").trim(),
  ].filter(Boolean)
  const notes = notesParts.join("\n") || null

  try {
    const row = await prisma.sousTraitant.create({
      data: {
        nom,
        email: (body.email || "").trim() || null,
        telephone: (body.telephone || "").trim() || null,
        notes,
      },
    })
    return NextResponse.json({
      sous_traitant: {
        ...row,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur base de données"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
