import { NextRequest, NextResponse } from 'next/server'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const err = dbNotConfiguredResponse()
    return NextResponse.json({ error: err.error }, { status: err.status })
  }

  let body: { valide_par?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const now = new Date()
  const data = await prisma.preBilan.update({
    where: { id: params.id },
    data: {
      statut: 'valide',
      valide_at: now,
      valide_par: body.valide_par || 'Comptable',
    },
    select: { id: true, statut: true, valide_at: true, valide_par: true },
  })

  return NextResponse.json({
    ok: true,
    pre_bilan: {
      ...data,
      valide_at: data.valide_at?.toISOString() ?? null,
    },
  })
}
