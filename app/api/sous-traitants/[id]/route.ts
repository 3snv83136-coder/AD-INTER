import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/intervention-access"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"
import { composeSousTraitantNotes } from "@/lib/sous-traitant-notes"

export const dynamic = "force-dynamic"

type Params = { params: { id: string } }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin()
  if (denied) return denied
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 })
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

  try {
    const existing = await prisma.sousTraitant.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: "Sous-traitant introuvable" }, { status: 404 })
    }

    const row = await prisma.sousTraitant.update({
      where: { id: params.id },
      data: {
        nom,
        email: (body.email || "").trim() || null,
        telephone: (body.telephone || "").trim() || null,
        notes: composeSousTraitantNotes(body),
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
