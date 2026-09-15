import { NextRequest, NextResponse } from "next/server"
import { getPrismaOrNull } from "@/lib/db"
import { blobPaths, uploadBlob } from "@/lib/storage"
import {
  PHOTO_SLOT_APRES,
  PHOTO_SLOT_AVANT,
  loadApportContext,
  upsertPhotoSlot,
} from "@/lib/apport"

export const dynamic = "force-dynamic"
export const maxDuration = 30

type Params = { params: { token: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const loaded = await loadApportContext(params.token)
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  }
  if (loaded.ctx.already) {
    return NextResponse.json({ error: "Ce dossier a déjà été envoyé.", already: true }, { status: 409 })
  }
  if (!loaded.ctx.pris_en_charge) {
    return NextResponse.json(
      { error: "Accepte d’abord les conditions générales et signe pour prendre l’intervention." },
      { status: 403 },
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Multipart/form-data attendu" }, { status: 400 })
  }

  const slotRaw = String(formData.get("slot") || "").trim()
  if (slotRaw !== PHOTO_SLOT_AVANT && slotRaw !== PHOTO_SLOT_APRES) {
    return NextResponse.json({ error: "Indiquez si c’est la photo avant ou après." }, { status: 400 })
  }

  const file = formData.get("photo")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Photo manquante" }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo trop lourde (max 10 MB)" }, { status: 413 })
  }

  const prisma = getPrismaOrNull()
  if (!prisma) {
    return NextResponse.json({ error: "Service indisponible" }, { status: 503 })
  }

  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || ".jpg").toLowerCase()
  const filename = `${slotRaw}-${Date.now()}${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  let url: string
  try {
    url = await uploadBlob({
      pathname: blobPaths.photo(loaded.ctx.interventionId, filename),
      body: buf,
      contentType: file.type || "image/jpeg",
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Upload échoué : ${msg}` }, { status: 502 })
  }

  const next = upsertPhotoSlot(loaded.ctx.photos_urls, loaded.ctx.photos_legendes, slotRaw, url)
  await prisma.intervention.update({
    where: { id: loaded.ctx.interventionId },
    data: {
      photos_urls: next.urls,
      photos_legendes: next.legendes,
    },
  })

  return NextResponse.json({
    ok: true,
    url,
    slot: slotRaw,
  })
}
