import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { verifyCredentials, type DbAccount } from "@/lib/auth-users"
import { getPrismaOrNull } from "@/lib/db"

export async function lookupDbAccountByLogin(login: string): Promise<DbAccount | null> {
  const prisma = getPrismaOrNull()
  if (!prisma) return null
  const needle = login.trim().toLowerCase()
  const rows = await prisma.technicien.findMany({
    where: { login: { not: null } },
    select: { id: true, login: true, password_hash: true, role: true, actif: true },
  })
  const row = rows.find(t => (t.login || "").trim().toLowerCase() === needle)
  if (!row) return null
  return {
    technicienId: row.id,
    login: row.login as string,
    passwordHash: row.password_hash ?? null,
    role: (row.role as DbAccount["role"]) ?? "tech",
    actif: row.actif !== false,
  }
}

export async function touchDerniereConnexion(technicienId: string): Promise<void> {
  const prisma = getPrismaOrNull()
  if (!prisma) return
  try {
    await prisma.technicien.update({
      where: { id: technicienId },
      data: { derniere_connexion: new Date() },
    })
  } catch {
    /* non bloquant */
  }
}

export async function lookupTechnicienIdByLogin(login: string): Promise<string | null> {
  const prisma = getPrismaOrNull()
  if (!prisma) return null
  const data = await prisma.technicien.findMany({
    where: { actif: true },
    select: { id: true, nom: true },
  })
  if (!data.length) return null
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
        const username = credentials?.username == null ? "" : String(credentials.username)
        const password = credentials?.password == null ? "" : String(credentials.password)
        const account = await verifyCredentials(
          username,
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
          accessLabel: account.accessLabel ?? account.login,
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
        token.accessLabel = user.accessLabel
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id ?? ""
        session.user.role = token.role
        session.user.technicienId = token.technicienId ?? null
        session.user.accessLabel = token.accessLabel
      }
      return session
    },
  },
})
