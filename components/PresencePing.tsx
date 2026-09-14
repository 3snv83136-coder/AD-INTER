'use client'

import { useEffect } from "react"
import { useSession } from "next-auth/react"

const INTERVAL_MS = 15_000

async function ping(): Promise<void> {
  if (typeof window === "undefined") return
  if (window.location.pathname.startsWith("/login")) return
  try {
    await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
      keepalive: true,
    })
  } catch {
    /* non bloquant */
  }
}

/** Heartbeat de présence — tous les utilisateurs connectés, lecture réservée au super admin. */
export function PresencePing() {
  const { status } = useSession()

  useEffect(() => {
    if (status !== "authenticated") return

    void ping()
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void ping()
    }, INTERVAL_MS)

    const onVisible = () => {
      if (document.visibilityState === "visible") void ping()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [status])

  return null
}
