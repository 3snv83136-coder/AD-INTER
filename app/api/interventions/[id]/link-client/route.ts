import { NextRequest, NextResponse } from "next/server"
import { getPrismaOrNull, dbNotConfiguredResponse } from "@/lib/db"
import { upsertClient, patchClient } from "@/lib/db-helpers"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error }, { status })
  }

  let body: { nom?: string; email?: string; telephone?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const nom = (body.nom || '').trim()
  const email = (body.email || '').trim()
  const telephone = (body.telephone || '').trim()
  if (!nom) {
    return NextResponse.json({ error: 'Nom du client requis' }, { status: 400 })
  }

  const interv = await prisma.intervention.findUnique({
    where: { id: params.id },
    select: { id: true, client_id: true, ville: true, code_postal: true },
  })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  let clientId: string | null = interv.client_id

  if (clientId) {
    await patchClient(clientId, {
      nom,
      email: email || null,
      ...(telephone ? { telephone } : {}),
    })
  } else {
    clientId = await upsertClient({
      nom,
      email: email || null,
      telephone: telephone || null,
      ville: interv.ville || null,
      code_postal: interv.code_postal || null,
    })
    if (!clientId) {
      return NextResponse.json({ error: 'Création du client impossible' }, { status: 500 })
    }
    try {
      await prisma.intervention.update({
        where: { id: params.id },
        data: { client_id: clientId },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur base de données'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, nom: true, email: true, telephone: true, adresse: true, code_postal: true, ville: true },
  })

  return NextResponse.json({ client })
}
