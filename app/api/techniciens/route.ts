import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

const UPDATABLE = new Set(['nom', 'email', 'telephone', 'agence', 'actif'])
const ROLES = new Set(['tech', 'admin'])

/** Garde admin : seul un compte admin peut gérer les comptes techniciens. */
async function requireAdmin(): Promise<NextResponse | null> {
  // Si l'auth n'est pas configurée du tout (dev), on laisse passer.
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

function supabaseMissing(): NextResponse {
  return NextResponse.json({
    error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    techniciens: [],
  }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) return supabaseMissing()

  const url = new URL(req.url)
  const all = url.searchParams.get('all') === '1'

  let query = sb
    .from('techniciens')
    // password_hash JAMAIS renvoyé au client — on expose seulement has_password.
    .select('id, nom, email, telephone, agence, actif, role, login, password_hash, doit_changer_mdp, derniere_connexion, created_at')
    .order('nom', { ascending: true })

  if (!all) query = query.eq('actif', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message, techniciens: [] }, { status: 500 })

  const techniciens = (data || []).map(({ password_hash, ...t }) => ({
    ...t,
    has_password: Boolean(password_hash),
  }))
  return NextResponse.json({ techniciens })
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const sb = getSupabaseOrNull()
  if (!sb) return supabaseMissing()

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

  // Un compte avec login doit avoir un mot de passe (sinon connexion impossible).
  if (login && !password) {
    return NextResponse.json({ error: 'Mot de passe requis pour un compte avec identifiant' }, { status: 400 })
  }

  const insert: Record<string, unknown> = {
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

  const { data, error } = await sb
    .from('techniciens')
    .insert(insert)
    .select('id, nom, email, telephone, agence, actif, role, login, doit_changer_mdp, derniere_connexion, created_at')
    .single()

  if (error) {
    const msg = /duplicate|unique/i.test(error.message)
      ? 'Cet identifiant est déjà utilisé'
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ technicien: data }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const sb = getSupabaseOrNull()
  if (!sb) return supabaseMissing()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const update: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (!UPDATABLE.has(k)) continue
    update[k] = v
  }

  // Identifiant de connexion
  if ('login' in body) update.login = normalizeLogin(body.login)
  // Rôle
  if (typeof body.role === 'string' && ROLES.has(body.role)) update.role = body.role
  // Réinitialisation du mot de passe (force le changement à la prochaine connexion)
  if (typeof body.password === 'string' && body.password) {
    update.password_hash = await bcrypt.hash(body.password, 10)
    update.doit_changer_mdp = true
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('techniciens')
    .update(update)
    .eq('id', id)
    .select('id, nom, email, telephone, agence, actif, role, login, doit_changer_mdp, derniere_connexion, created_at')
    .single()

  if (error) {
    const msg = /duplicate|unique/i.test(error.message)
      ? 'Cet identifiant est déjà utilisé'
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ technicien: data })
}
