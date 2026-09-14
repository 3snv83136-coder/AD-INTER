import { NextRequest, NextResponse } from "next/server"
import { getPrismaOrNull, dbNotConfiguredResponse } from "@/lib/db"
import { createGmbPost } from "@/lib/gmb"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const SITE = "https://allodebouchage.com"

export async function POST(req: NextRequest) {
  let body: { interventionId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }
  const interventionId = (body.interventionId || "").trim()
  if (!interventionId) {
    return NextResponse.json({ error: "interventionId requis" }, { status: 400 })
  }

  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  const interv = await prisma.intervention.findUnique({
    where: { id: interventionId },
    select: { type_intervention: true, ville: true, seo_json: true, photos_urls: true, publie_slug: true },
  })
  if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  const seo = (interv.seo_json || {}) as {
    resume_rich_snippet?: string
    meta_description?: string
  }
  const type = interv.type_intervention || "Intervention"
  const ville = interv.ville || "Var"
  const resume =
    seo.resume_rich_snippet ||
    seo.meta_description ||
    `${type} réalisée à ${ville} par Allo Débouchage.`

  const summary = [`${type} à ${ville}`, "", resume].join("\n")

  const photos: string[] = Array.isArray(interv.photos_urls) ? interv.photos_urls : []
  const photoUrl = photos[0] || null
  const ctaUrl = interv.publie_slug
    ? `${SITE}/nos-realisations/${interv.publie_slug}`
    : SITE

  try {
    const result = await createGmbPost({ summary, photoUrl, ctaUrl })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Échec publication GMB" },
      { status: 502 },
    )
  }
}
