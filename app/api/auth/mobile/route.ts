import { NextRequest, NextResponse } from "next/server"
import {
  lookupDbAccountByLogin,
  lookupTechnicienIdByLogin,
  touchDerniereConnexion,
} from "@/lib/auth"
import { verifyCredentials } from "@/lib/auth-users"
import { bearerFromHeader, signMobileToken, verifyMobileToken } from "@/lib/mobile-auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const token = bearerFromHeader(req.headers.get("authorization"))
  if (!token) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }
  const payload = await verifyMobileToken(token)
  if (!payload) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 })
  }
  return NextResponse.json({
    user: {
      login: payload.login,
      role: payload.role,
      technicienId: payload.technicienId,
    },
  })
}

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const username = (body.username || "").trim()
  const password = body.password || ""
  if (!username) {
    return NextResponse.json({ error: "Identifiant requis" }, { status: 400 })
  }

  try {
    const account = await verifyCredentials(
      username,
      password,
      lookupTechnicienIdByLogin,
      lookupDbAccountByLogin,
    )
    if (!account) {
      return NextResponse.json({ error: "Identifiant ou mot de passe incorrect." }, { status: 401 })
    }

    if (account.technicienId && account.id.startsWith("db-")) {
      await touchDerniereConnexion(account.technicienId)
    }

    const token = await signMobileToken({
      sub: account.id,
      login: account.login,
      role: account.role,
      technicienId: account.technicienId,
    })

    return NextResponse.json({
      token,
      user: {
        login: account.login,
        role: account.role,
        technicienId: account.technicienId,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur authentification"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
