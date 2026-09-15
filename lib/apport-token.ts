/** Jeton HMAC pour le portail apporteur (lien unique, sans compte). */

export type ApportTokenPayload = {
  typ: "apport"
  interventionId: string
  sousTraitantId: string
  iat: number
  exp: number
}

const APPORT_TTL_SEC = 60 * 60 * 24 * 14

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

export async function signApportToken(
  interventionId: string,
  sousTraitantId: string,
  ttlSec = APPORT_TTL_SEC,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  const payload: ApportTokenPayload = {
    typ: "apport",
    interventionId,
    sousTraitantId,
    iat,
    exp: iat + ttlSec,
  }
  const header = utf8ToB64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = utf8ToB64Url(JSON.stringify(payload))
  const sig = await hmacSha256B64Url(getAuthSecret(), `${header}.${body}`)
  return `${header}.${body}.${sig}`
}

export async function verifyApportToken(token: string): Promise<ApportTokenPayload | null> {
  const raw = (token || "").trim()
  if (!raw || raw.split(".").length !== 3) return null
  let secret: string
  try {
    secret = getAuthSecret()
  } catch {
    return null
  }
  const [header, body, sig] = raw.split(".")
  const expected = await hmacSha256B64Url(secret, `${header}.${body}`)
  if (!timingSafeEqual(sig, expected)) return null
  try {
    const payload = JSON.parse(b64UrlToUtf8(body)) as ApportTokenPayload
    if (payload.typ !== "apport") return null
    if (!payload.interventionId || !payload.sousTraitantId || !payload.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function getAppBaseUrl(): string {
  const fromEnv = (process.env.NEXTAUTH_URL || "").trim().replace(/\/$/, "")
  if (fromEnv) return fromEnv
  const vercel = (process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim().replace(/\/$/, "")
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`
  return "https://ad-inter.vercel.app"
}

export function apportPageUrl(token: string): string {
  return `${getAppBaseUrl()}/apport/${encodeURIComponent(token)}`
}
