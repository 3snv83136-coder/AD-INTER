import type { AuthRole } from "@/lib/auth-users"

/** JWT HS256 compatible Edge (middleware) et Node (routes API). */

export type MobileTokenPayload = {
  sub: string
  login: string
  role: AuthRole
  technicienId: string | null
  iat: number
  exp: number
}

const TOKEN_TTL_SEC = 60 * 60 * 24 * 30

function getAuthSecret(): string {
  const secret = (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "").trim()
  if (!secret) throw new Error("NEXTAUTH_SECRET manquant")
  return secret
}

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64UrlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function utf8ToB64Url(s: string): string {
  return bytesToB64Url(new TextEncoder().encode(s))
}

function b64UrlToUtf8(s: string): string {
  return new TextDecoder().decode(b64UrlToBytes(s))
}

async function hmacSha256B64Url(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data))
  return bytesToB64Url(new Uint8Array(sig))
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

export async function signMobileToken(
  input: Omit<MobileTokenPayload, "iat" | "exp">,
  ttlSec = TOKEN_TTL_SEC,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  const payload: MobileTokenPayload = { ...input, iat, exp: iat + ttlSec }
  const header = utf8ToB64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = utf8ToB64Url(JSON.stringify(payload))
  const sig = await hmacSha256B64Url(getAuthSecret(), `${header}.${body}`)
  return `${header}.${body}.${sig}`
}

export async function verifyMobileToken(token: string): Promise<MobileTokenPayload | null> {
  if (!token || token.split(".").length !== 3) return null
  let secret: string
  try {
    secret = getAuthSecret()
  } catch {
    return null
  }
  const [header, body, sig] = token.split(".")
  const expected = await hmacSha256B64Url(secret, `${header}.${body}`)
  if (!timingSafeEqual(sig, expected)) return null
  try {
    const payload = JSON.parse(b64UrlToUtf8(body)) as MobileTokenPayload
    if (!payload?.sub || !payload.role || !payload.exp) return null
    if (payload.role !== "admin" && payload.role !== "tech") return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function bearerFromHeader(value: string | null): string | null {
  if (!value) return null
  const m = /^Bearer\s+(.+)$/i.exec(value.trim())
  return m?.[1]?.trim() || null
}
