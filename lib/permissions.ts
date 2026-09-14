import { NextResponse } from "next/server"
import type { AuthRole } from "@/lib/auth-users"

export const OPERATOR_CLIENT_FIELDS = [
  "email",
  "telephone",
  "adresse",
  "code_postal",
  "ville",
] as const

export function isFullAdmin(role?: AuthRole | string | null): boolean {
  return role === "admin"
}

export function canDeleteRecords(role?: AuthRole | string | null): boolean {
  return role === "admin"
}

export function canEditFacture(role?: AuthRole | string | null): boolean {
  return role === "admin"
}

export function canEditIntervention(role?: AuthRole | string | null): boolean {
  return role === "admin"
}

export function canEditDevis(role?: AuthRole | string | null): boolean {
  return role === "admin" || role === "operateur"
}

export function forbiddenManageResponse(): NextResponse {
  return NextResponse.json(
    { error: "Cette action est réservée à l’administrateur." },
    { status: 403 },
  )
}

export function requireFullAdmin(role?: AuthRole | string | null): NextResponse | null {
  if (role === "admin" || !role) return null
  return forbiddenManageResponse()
}
