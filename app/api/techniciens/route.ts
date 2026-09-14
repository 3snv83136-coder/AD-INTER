import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { dbNotConfiguredResponse, getPrismaOrNull } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ROLES = new Set(['tech', 'admin'])

async function requireAdmin(): Promise<NextResponse | null> {
  if (!process.env.AUTH_USER_1 && !process.env.AUTH_TECH_1) return null
  const session = await auth()
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Accès réservé à l’administrateur' }, { status: 403 })
  }
  return null
}

function normalizeLogin(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase()
  return v || null
}

function dbMissing(): NextResponse {
  const err = dbNotConfiguredResponse()
  return NextResponse.json({ error: err.error, techniciens: [] }, { status: err.status })
}

const selectFields = {
  id: true,
  nom: true,
  email: true,
  telephone: true,
  agence: true,
  actif: true,
  role: true,
  login: true,
  password_hash: true,
  doit_changer_mdp: true,
  derniere_connexion: true,
  created_at: true,
} as const

function serializeTechnicien(row: {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  agence: string | null
  actif: boolean
  role: string
  login: string | null
  password_hash: string | null
  doit_changer_mdp: boolean
  derniere_connexion: Date | null
  created_at: Date
}) {
  const { password_hash, ...t } = row
  return {
    ...t,
    has_password: Boolean(password_hash),
    derniere_connexion: t.derniere_connexion?.toISOString() ?? null,
    created_at: t.created_at.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const prisma = getPrismaOrNull()
  if (!prisma) return dbMissing()

  const url = new URL(req.url)
  const all = url.searchParams.get('all') === '1'

  const data = await prisma.technicien.findMany({
    where: all ? undefined : { actif: true },
    select: selectFields,
    orderBy: { nom: 'asc' },
  })

  return NextResponse.json({ techniciens: data.map(serializeTechnicien) })
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const prisma = getPrismaOrNull()
  if (!prisma) return dbMissing()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
  if (!nom) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const login = normalizeLogin(body.login)
  const role = ROLES.has(String(body.role)) ? String(body.role) : 'tech'
  const password = typeof body.password === 'string' ? body.password : ''

  if (login && !password) {
    return NextResponse.json({ error: 'Mot de passe requis pour un compte avec identifiant' }, { status: 400 })
  }

  const insert: Prisma.TechnicienCreateInput = {
    nom,
    email: typeof body.email === 'string' ? body.email.trim() || null : null,
    telephone: typeof body.telephone === 'string' ? body.telephone.trim() || null : null,
    agence: typeof body.agence === 'string' ? body.agence.trim() || null : null,
    actif: typeof body.actif === 'boolean' ? body.actif : true,
    login,
    role,
  }
  if (login && password) {
    insert.password_hash = await bcrypt.hash(password, 10)
    insert.doit_changer_mdp = true
  }

  try {
    const data = await prisma.technicien.create({
      data: insert,
      select: {
        id: true,
        nom: true,
        email: true,
        telephone: true,
        agence: true,
        actif: true,
        role: true,
        login: true,
        doit_changer_mdp: true,
        derniere_connexion: true,
        created_at: true,
      },
    })
    return NextResponse.json({
      technicien: {
        ...data,
        has_password: Boolean(login && password),
        derniere_connexion: data.derniere_connexion?.toISOString() ?? null,
        created_at: data.created_at.toISOString(),
      },
    }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
      ? 'Cet identifiant est déjà utilisé'
      : e instanceof Error ? e.message : 'Erreur création'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const prisma = getPrismaOrNull()
  if (!prisma) return dbMissing()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const update: Prisma.TechnicienUpdateInput = {}
  if (typeof body.nom === 'string') update.nom = body.nom.trim()
  if (typeof body.email === 'string') update.email = body.email.trim() || null
  if (typeof body.telephone === 'string') update.telephone = body.telephone.trim() || null
  if (typeof body.agence === 'string') update.agence = body.agence.trim() || null
  if (typeof body.actif === 'boolean') update.actif = body.actif

  if ('login' in body) update.login = normalizeLogin(body.login)
  if (typeof body.role === 'string' && ROLES.has(body.role)) update.role = body.role
  if (typeof body.password === 'string' && body.password) {
    update.password_hash = await bcrypt.hash(body.password, 10)
    update.doit_changer_mdp = true
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  try {
    const data = await prisma.technicien.update({
      where: { id },
      data: update,
      select: {
        id: true,
        nom: true,
        email: true,
        telephone: true,
        agence: true,
        actif: true,
        role: true,
        login: true,
        doit_changer_mdp: true,
        derniere_connexion: true,
        created_at: true,
      },
    })
    return NextResponse.json({
      technicien: {
        ...data,
        has_password: true,
        derniere_connexion: data.derniere_connexion?.toISOString() ?? null,
        created_at: data.created_at.toISOString(),
      },
    })
  } catch (e) {
    const msg = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
      ? 'Cet identifiant est déjà utilisé'
      : e instanceof Error ? e.message : 'Erreur mise à jour'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
