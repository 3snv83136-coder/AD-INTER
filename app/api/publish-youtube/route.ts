import { NextRequest, NextResponse } from "next/server"
import { getPrisma } from "@/lib/db"
import { buildVideoMetadata, uploadVideoToYouTube } from "@/lib/youtube"

export const dynamic = "force-dynamic"
export const maxDuration = 300

type Body = { interventionId?: string }
type VideoUrls = { vertical?: string; square?: string; horizontal?: string }

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
  } catch {
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
  const horizontalUrl = videoUrls?.horizontal
  if (!horizontalUrl) {
    return NextResponse.json(
      { error: "Pas de vidéo 16:9 disponible. Génère la vidéo d'abord." },
      { status: 400 },
    )
  }

  await prisma.intervention.update({
    where: { id: interventionId },
    data: { video_status: "uploading", video_error: null },
  })

  try {
    const meta = await buildVideoMetadata({
      typeIntervention: intervention.type_intervention,
      ville: intervention.ville,
      reference: intervention.reference,
      rapport: intervention.rapport_json as Record<string, unknown> | null,
    })

    const { videoId, url } = await uploadVideoToYouTube({
      videoUrl: horizontalUrl,
      title: meta.title,
      description: meta.description,
      tags: meta.tags,
      privacyStatus: "public",
    })

    await prisma.intervention.update({
      where: { id: interventionId },
      data: {
        video_youtube_id: videoId,
        video_youtube_url: url,
        video_status: "published",
        video_published_at: new Date(),
        video_error: null,
      },
    })

    return NextResponse.json({ ok: true, videoId, url }, { status: 200 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    await prisma.intervention.update({
      where: { id: interventionId },
      data: { video_status: "ready", video_error: message },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
