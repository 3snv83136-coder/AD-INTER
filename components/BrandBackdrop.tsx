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

  const opacity = isDashboard ? 0.42 : isLogin ? 0.22 : 0.16
  const size = isDashboard ? "min(88vw, 620px)" : isLogin ? "min(70vw, 480px)" : "min(54vw, 420px)"
  const top = isDashboard ? "38%" : isLogin ? "44%" : "40%"

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0 bg-[#eef2f7]"
        style={{ opacity: isDashboard ? 0 : isLogin ? 0 : 1 }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-contain bg-center bg-no-repeat"
        style={{
          top,
          width: size,
          height: size,
          backgroundImage: `url(${LOGO_PATH})`,
          opacity,
          filter: isDashboard ? "drop-shadow(0 0 48px rgba(255,255,255,0.12))" : undefined,
        }}
      />
      {isDashboard && (
        <div
          className="absolute left-1/2 top-[12%] -translate-x-1/2 bg-contain bg-center bg-no-repeat"
          style={{
            width: "min(42vw, 280px)",
            height: "min(42vw, 280px)",
            backgroundImage: `url(${LOGO_PATH})`,
            opacity: 0.55,
          }}
        />
      )}
    </div>
  )
}
