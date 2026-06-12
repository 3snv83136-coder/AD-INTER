import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { verifyCredentials, type DbAccount } from "@/lib/auth-users"
import { getSupabaseOrNull } from "@/lib/supabase"

/**
 * Recherche un compte dans la table `techniciens` par login (insensible à la casse).
 * Source de vérité des comptes gérés depuis l'admin (migration 013).
 */
async function lookupDbAccountByLogin(login: string): Promise<DbAccount | null> {
  const sb = getSupabaseOrNull()
  if (!sb) return null
  const needle = login.trim().toLowerCase()
  const { data } = await sb
    .from("techniciens")
    .select("id, login, password_hash, role, actif")
    .not("login", "is", null)
  const row = data?.find(t => (t.login || "").trim().toLowerCase() === needle)
  if (!row) return null
  return {
    technicienId: row.id as string,
    login: row.login as string,
    passwordHash: (row.password_hash as string) ?? null,
    role: (row.role as DbAccount["role"]) ?? "tech",
    actif: row.actif !== false,
  }
}

/** Marque la dernière connexion réussie (best-effort, n'échoue jamais l'auth). */
async function touchDerniereConnexion(technicienId: string): Promise<void> {
  const sb = getSupabaseOrNull()
  if (!sb) return
  try {
    await sb
      .from("techniciens")
      .update({ derniere_connexion: new Date().toISOString() })
      .eq("id", technicienId)
  } catch {
    /* non bloquant */
  }
}

async function lookupTechnicienIdByLogin(login: string): Promise<string | null> {
  const sb = getSupabaseOrNull()
  if (!sb) return null
  const { data } = await sb
    .from("techniciens")
    .select("id, nom")
    .eq("actif", true)
  if (!data?.length) return null
  const aliases: Record<string, string> = {
    technicien1: "technicien 1",
    "technicien-1": "technicien 1",
  }
  const needle = aliases[login.trim().toLowerCase()] || login.trim().toLowerCase()
  const exact = data.find(t => (t.nom || "").trim().toLowerCase() === needle)
  if (exact) return exact.id
  const slug = data.find(t =>
    (t.nom || "").trim().toLowerCase().replace(/\s+/g, ".") === needle
    || (t.nom || "").trim().toLowerCase().replace(/\s+/g, "") === needle.replace(/\./g, ""),
  )
  return slug?.id ?? null
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Identifiant", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string | undefined
        const password = credentials?.password as string | undefined
        const account = await verifyCredentials(
          username || "",
          password,
          lookupTechnicienIdByLogin,
          lookupDbAccountByLogin,
        )
        if (!account) return null
        if (account.technicienId && account.id.startsWith("db-")) {
          await touchDerniereConnexion(account.technicienId)
        }
        return {
          id: account.id,
          name: account.login,
          role: account.role,
          technicienId: account.technicienId,
        }
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.technicienId = user.technicienId ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role
        session.user.technicienId = token.technicienId ?? null
      }
      return session
    },
  },
})
