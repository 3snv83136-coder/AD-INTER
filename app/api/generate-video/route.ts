import { NextRequest, NextResponse } from "next/server"
import fs from "node:fs/promises"
import { Prisma } from "@prisma/client"
import { getPrisma } from "@/lib/db"
import type { VideoFormat } from "@/lib/video-render-prod"
import { uploadVideoToStorage } from "@/lib/video-storage"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const ALL_FORMATS: VideoFormat[] = ["vertical", "horizontal", "square"]

type Body = {
  interventionId?: string
  formats?: VideoFormat[]
}

type VideoUrls = Partial<Record<VideoFormat, string>>

export async function POST(req: NextRequest) {
  process.env.AWS_LAMBDA_JS_RUNTIME ??= "nodejs22.x"

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const interventionId = body.interventionId
  if (!interventionId) {
    return NextResponse.json({ error: "interventionId manquant" }, { status: 400 })
  }

  const formats = (body.formats?.length ? body.formats : ALL_FORMATS).filter((f) =>
    ALL_FORMATS.includes(f),
  )
  if (formats.length === 0) {
    return NextResponse.json({ error: "Aucun format valide" }, { status: 400 })
  }

  const prisma = getPrisma()

  const intervention = await prisma.intervention.findUnique({
    where: { id: interventionId },
    select: { id: true, ville: true, type_intervention: true, photos_urls: true, rapport_json: true, date_realisee: true, video_urls: true },
  })

  if (!intervention) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  const photoUrls: string[] = Array.isArray(intervention.photos_urls) ? intervention.photos_urls : []
  if (photoUrls.length === 0) {
    return NextResponse.json({ error: "Aucune photo sur cette intervention" }, { status: 400 })
  }

  const photos = photoUrls.slice(0, 8).map((url) => ({ url }))

  await prisma.intervention.update({
    where: { id: interventionId },
    data: { video_status: "rendering", video_error: null },
  })

  const existingUrls = (intervention.video_urls as VideoUrls | null) || {}
  const result: VideoUrls = { ...existingUrls }

  try {
    const { renderVideo } = await import("@/lib/video-render-prod")
    for (const format of formats) {
      const { filePath } = await renderVideo({
        format,
        photos,
        ville: intervention.ville || undefined,
        typeIntervention: intervention.type_intervention || undefined,
        dateRealisee: intervention.date_realisee
          ? intervention.date_realisee.toISOString().slice(0, 10)
          : undefined,
      })
      const stamp = Date.now()
      const storagePath = `${interventionId}/${stamp}-${format}.mp4`
      const publicUrl = await uploadVideoToStorage({ filePath, storagePath })
      result[format] = publicUrl
      await fs.unlink(filePath).catch(() => {})
    }

    await prisma.intervention.update({
      where: { id: interventionId },
      data: {
        video_urls: result as Prisma.InputJsonValue,
        video_status: "ready",
        video_rendered_at: new Date(),
        video_error: null,
      },
    })

    return NextResponse.json({ ok: true, video_urls: result }, { status: 200 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    await prisma.intervention.update({
      where: { id: interventionId },
      data: { video_status: "failed", video_error: message },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
