import { NextRequest, NextResponse } from "next/server"
import { dbNotConfiguredResponse, getPrismaOrNull } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) {
    const { error, status } = dbNotConfiguredResponse()
    return NextResponse.json({ error, clients: [] }, { status })
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const phone = (url.searchParams.get('phone') || '').trim()
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 1000)

  const select = {
    id: true,
    nom: true,
    email: true,
    telephone: true,
    adresse: true,
    code_postal: true,
    ville: true,
  } as const

  // Recherche dédiée par numéro de téléphone : on normalise (digits-only)
  // côté client ET côté serveur pour matcher quel que soit le format de
  // saisie (06 12 34 56 78 / 0612345678 / +33612345678).
  if (phone) {
    const queryDigits = phone.replace(/\D/g, '')
    if (queryDigits.length < 6) {
      return NextResponse.json({ clients: [] })
    }
    try {
      const candidates = await prisma.client.findMany({
        where: { telephone: { not: null } },
        select,
        orderBy: { nom: 'asc' },
        take: 1000,
      })
      const sufLen = Math.min(queryDigits.length, 9)
      const querySuf = queryDigits.slice(-sufLen)
      const matches = candidates.filter(c => {
        const stored = (c.telephone || '').replace(/\D/g, '')
        if (stored.length < 6) return false
        if (stored === queryDigits) return true
        if (stored.endsWith(querySuf) && sufLen >= 6) return true
        if (queryDigits.endsWith(stored.slice(-Math.min(stored.length, 9))) && stored.length >= 6) return true
        return false
      })
      return NextResponse.json({ clients: matches.slice(0, limit) })
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Erreur', clients: [] },
        { status: 500 },
      )
    }
  }

  try {
    const safe = q.replace(/[%,]/g, ' ')
    const data = await prisma.client.findMany({
      where: q
        ? {
            OR: [
              { nom: { contains: safe, mode: 'insensitive' } },
              { email: { contains: safe, mode: 'insensitive' } },
              { ville: { contains: safe, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select,
      orderBy: { nom: 'asc' },
      take: limit,
    })
    return NextResponse.json({ clients: data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur', clients: [] },
      { status: 500 },
    )
  }
}
