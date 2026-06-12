"use client"

import { usePathname } from "next/navigation"
import { LOGO_PATH } from "@/lib/brand"

/**
 * Filigrane logo fixe sur toutes les pages.
 * Opacité et taille renforcées sur le dashboard (/) et la page login.
 */
export function BrandBackdrop() {
  const pathname = usePathname() || ""
  const isDashboard = pathname === "/"
  const isLogin = pathname === "/login"

  // Le dashboard gère son propre logo central (app/page.tsx)
  if (isDashboard) return null

  const opacity = isLogin ? 0.22 : 0.16
  const size = isLogin ? "min(70vw, 480px)" : "min(54vw, 420px)"

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0 bg-[#eef2f7]"
        style={{ opacity: isLogin ? 0 : 1 }}
      />
      <div
        className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 bg-contain bg-center bg-no-repeat"
        style={{
          width: size,
          height: size,
          backgroundImage: `url(${LOGO_PATH})`,
          opacity,
        }}
      />
    </div>
  )
}
