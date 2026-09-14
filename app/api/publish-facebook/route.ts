import { NextRequest, NextResponse } from "next/server"
import { getPrisma } from "@/lib/db"
import { publishToFacebook, buildSocialMetadata } from "@/lib/social"

export const dynamic = "force-dynamic"
export const maxDuration = 120

type VideoUrls = { vertical?: string; square?: string; horizontal?: string }

export async function POST(req: NextRequest) {
  let body: { interventionId?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const interventionId = body.interventionId
  if (!interventionId) return NextResponse.json({ error: "interventionId manquant" }, { status: 400 })

  const prisma = getPrisma()
  const intervention = await prisma.intervention.findUnique({
    where: { id: interventionId },
    select: { id: true, reference: true, ville: true, type_intervention: true, rapport_json: true, video_urls: true },
  })

  if (!intervention) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  const videoUrls = intervention.video_urls as VideoUrls | null
  const videoUrl = videoUrls?.square || videoUrls?.horizontal
  if (!videoUrl) {
    return NextResponse.json({ error: "Pas de vidéo disponible. Génère d'abord." }, { status: 400 })
  }

  try {
    const meta = await buildSocialMetadata({
      typeIntervention: intervention.type_intervention,
      ville: intervention.ville,
      rapport: intervention.rapport_json as Record<string, unknown> | null,
    })

    const result = await publishToFacebook({
      videoUrl,
      title: meta.title,
      description: meta.description,
    })

    return NextResponse.json({ ok: true, ...result }, { status: 200 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Facebook publish failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
