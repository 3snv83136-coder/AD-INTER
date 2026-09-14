import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getPrismaOrNull } from "@/lib/db"
import { bearerFromHeader, verifyMobileToken } from "@/lib/mobile-auth"

export type SessionUser = {
  role?: "admin" | "tech"
  technicienId?: string | null
  login?: string | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  if (session?.user) {
    return {
      role: session.user.role,
      technicienId: session.user.technicienId ?? null,
      login: session.user.name ?? null,
    }
  }

  const token = bearerFromHeader(headers().get("authorization"))
  if (!token) return null
  const payload = await verifyMobileToken(token)
  if (!payload) return null
  return {
    role: payload.role,
    technicienId: payload.technicienId ?? null,
    login: payload.login,
  }
}

export function technicienFilterForSession(user: SessionUser | null): string | null {
  if (user?.role === "tech" && user.technicienId) return user.technicienId
  return null
}

export async function assertInterventionAccess(
  interventionId: string,
  user: SessionUser | null,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!user) return { ok: false, status: 401, error: "Non authentifié" }
  if (user.role !== "tech" || !user.technicienId) return { ok: true }

  const prisma = getPrismaOrNull()
  if (!prisma) return { ok: false, status: 503, error: "Base de données non configurée" }

  try {
    const data = await prisma.intervention.findUnique({
      where: { id: interventionId },
      select: { technicien_id: true },
    })
    if (!data) return { ok: false, status: 404, error: "Intervention introuvable" }
    if (data.technicien_id !== user.technicienId) {
      return { ok: false, status: 403, error: "Accès refusé à cette intervention" }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur base de données"
    return { ok: false, status: 500, error: msg }
  }
}
