'use client'

import { useSession } from "next-auth/react"
import {
  canDeleteRecords,
  canEditDevis,
  canEditFacture,
  canEditIntervention,
  isFullAdmin,
} from "@/lib/permissions"

export function useAccess() {
  const { data, status } = useSession()
  const role = data?.user?.role
  const ready = status !== "loading"
  return {
    role,
    ready,
    isFullAdmin: isFullAdmin(role),
    canDelete: ready && canDeleteRecords(role),
    canEditFacture: ready && canEditFacture(role),
    canEditIntervention: ready && canEditIntervention(role),
    canEditDevis: ready && canEditDevis(role),
    canEditClientContact: ready && (role === "admin" || role === "operateur"),
  }
}
