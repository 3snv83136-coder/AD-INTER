import bcrypt from "bcryptjs"

export type AuthRole = "admin" | "operateur" | "tech"

export type AuthAccount = {
  id: string
  login: string
  role: AuthRole
  /** Hash bcrypt — null pour les admins bootstrap (MDP via AUTH_ADMIN_PASSWORDS) */
  passwordHash: string | null
  /** UUID technicien Supabase (comptes tech) */
  technicienId: string | null
  /** Libellé d’affichage (ex. « 31 10 ») pour la présence. */
  accessLabel?: string
}

export function formatAccessCode(password: string): string {
  const digits = password.replace(/\D/g, "")
  if (digits.length === 4) return `${digits.slice(0, 2)} ${digits.slice(2)}`
  return password.trim()
}

function normalizeBcryptHash(raw: string): string {
  let hash = raw || ""
  if (hash && !hash.startsWith("$2")) hash = hash.replace(/_/g, "$")
  return hash
}

/** AUTH_USER_N=login  |  AUTH_ADMIN_PASSWORDS=liste de MDP (virgules) */
function loadAdmins(): AuthAccount[] {
  const accounts: AuthAccount[] = []
  for (let i = 1; i <= 10; i++) {
    const entry = process.env[`AUTH_USER_${i}`]
    if (!entry?.trim()) continue
    const login = entry.includes(":") ? entry.split(":")[0].trim() : entry.trim()
    if (!login) continue
    accounts.push({
      id: `admin-${i}`,
      login,
      role: "admin",
      passwordHash: null,
      technicienId: null,
    })
  }
  return accounts
}

const DEFAULT_ADMIN_PASSWORDS = ["3110", "1004", "3112", "3005"]
const DEFAULT_OWNER_PASSWORDS = ["3110", "1004"]

function loadPasswordList(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim().replace(/^["']+|["']+$/g, "").replace(/\s+/g, ""))
    .filter(Boolean)
}

function uniqueCodes(codes: string[]): string[] {
  return Array.from(new Set(codes.filter(Boolean)))
}

function loadAdminPasswords(): string[] {
  return uniqueCodes([
    ...DEFAULT_ADMIN_PASSWORDS,
    ...loadPasswordList(process.env.AUTH_ADMIN_PASSWORDS || ""),
    ...loadOwnerPasswords(),
  ])
}

/** Accès complets : 3110 et 1004 (surcharge possible via AUTH_ADMIN_OWNER_PASSWORDS). */
function loadOwnerPasswords(): string[] {
  return uniqueCodes([
    ...DEFAULT_OWNER_PASSWORDS,
    ...loadPasswordList(process.env.AUTH_ADMIN_OWNER_PASSWORDS || ""),
  ])
}

export function normalizeAccessCode(value: unknown): string {
  if (value == null) return ""
  return String(value).trim().replace(/\s+/g, "")
}

function passwordMatchesAdmin(password: unknown, allowed: string[]): boolean {
  const needle = normalizeAccessCode(password)
  if (!needle) return false
  return allowed.some((p) => p === needle)
}

export type TechEnvEntry = {
  id: string
  login: string
  passwordHash: string
  technicienIdHint: string | null
}

/**
 * AUTH_TECH_N=login:hash_bcrypt[:technicien_id]
 * Si technicien_id absent, résolution par nom (voir resolveTechnicienId).
 */
export function loadTechFromEnv(): TechEnvEntry[] {
  const accounts: TechEnvEntry[] = []
  for (let i = 1; i <= 20; i++) {
    const entry = process.env[`AUTH_TECH_${i}`]
    if (!entry?.trim()) continue
    const colon = entry.indexOf(":")
    if (colon < 0) continue
    const login = entry.slice(0, colon).trim()
    const rest = entry.slice(colon + 1)
    const secondColon = rest.indexOf(":")
    const hashPart = secondColon >= 0 ? rest.slice(0, secondColon) : rest
    const techIdHint = secondColon >= 0 ? rest.slice(secondColon + 1).trim() : null
    const passwordHash = normalizeBcryptHash(hashPart)
    if (!login || !passwordHash) continue
    accounts.push({
      id: `tech-${i}`,
      login,
      passwordHash,
      technicienIdHint: techIdHint || null,
    })
  }
  return accounts
}

export function getAllAuthAccounts(): AuthAccount[] {
  return [
    ...loadAdmins(),
    ...loadTechFromEnv().map(t => ({
      id: t.id,
      login: t.login,
      role: "tech" as const,
      passwordHash: t.passwordHash,
      technicienId: t.technicienIdHint,
    })),
  ]
}

export async function resolveTechnicienIdForLogin(
  login: string,
  explicitId: string | undefined,
  lookupByNom: (login: string) => Promise<string | null>,
): Promise<string | null> {
  if (explicitId?.trim()) return explicitId.trim()
  return lookupByNom(login)
}

/**
 * Compte stocké dans la table `techniciens` (auth en base).
 * Source de vérité pour les comptes À l'eau Débouchage gérés depuis l'admin.
 */
export type DbAccount = {
  technicienId: string
  login: string
  passwordHash: string | null
  role: AuthRole
  actif: boolean
}

export async function verifyCredentials(
  username: string,
  password: string | undefined,
  lookupTechnicienId: (login: string) => Promise<string | null>,
  lookupDbAccount?: (login: string) => Promise<DbAccount | null>,
): Promise<AuthAccount | null> {
  const login = String(username ?? "").trim()
  const passCode = normalizeAccessCode(password)
  const loginCode = normalizeAccessCode(login)
  const admins = loadAdmins()
  const allowed = loadAdminPasswords()
  const adminByName = admins.find(a => a.login.toLowerCase() === login.toLowerCase())

  // 1. Admin bootstrap : identifiant `admin` + code, ou le code seul dans l’identifiant
  let matchedCode: string | null = null
  if (adminByName && passwordMatchesAdmin(passCode, allowed)) {
    matchedCode = passCode
  } else if (passwordMatchesAdmin(loginCode, allowed)) {
    if (!passCode || passCode === loginCode || passwordMatchesAdmin(passCode, allowed)) {
      matchedCode = passwordMatchesAdmin(passCode, allowed) ? passCode : loginCode
    }
  }

  if (matchedCode) {
    const admin = adminByName || admins[0]
    if (!admin) return null
    const isOwner = passwordMatchesAdmin(matchedCode, loadOwnerPasswords())
    return {
      ...admin,
      id: isOwner ? "admin-owner" : "admin-operateur",
      role: isOwner ? "admin" : "operateur",
      accessLabel: formatAccessCode(matchedCode),
    }
  }

  if (!login) return null

  const pwd = password ?? ""

  // 2. Compte géré en base (techniciens.login / password_hash / role)
  if (lookupDbAccount) {
    const dbAccount = await lookupDbAccount(login)
    if (dbAccount) {
      if (!dbAccount.actif) return null
      if (!dbAccount.passwordHash || !pwd) return null
      const valid = await bcrypt.compare(pwd, dbAccount.passwordHash)
      if (!valid) return null
      return {
        id: `db-${dbAccount.technicienId}`,
        login: dbAccount.login,
        role: dbAccount.role,
        passwordHash: dbAccount.passwordHash,
        technicienId: dbAccount.technicienId,
      }
    }
  }

  // 3. Repli sur les comptes tech historiques par variable d'env (compat historique)
  const techDef = loadTechFromEnv().find(t => t.login.toLowerCase() === login.toLowerCase())
  if (!techDef) return null

  if (!pwd) return null
  const valid = await bcrypt.compare(pwd, techDef.passwordHash)
  if (!valid) return null

  const technicienId = await resolveTechnicienIdForLogin(
    login,
    techDef.technicienIdHint ?? undefined,
    lookupTechnicienId,
  )
  if (!technicienId) return null

  return {
    id: techDef.id,
    login: techDef.login,
    role: "tech",
    passwordHash: techDef.passwordHash,
    technicienId,
  }
}

/** Compte tech si le login correspond à un AUTH_TECH_* (affiche champ mot de passe). */
export function isTechLogin(login: string): boolean {
  const l = login.trim().toLowerCase()
  return loadTechFromEnv().some(t => t.login.toLowerCase() === l)
}
