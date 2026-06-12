import Image from "next/image"
import { BRAND_NAME, ICON_512_PATH, LOGO_FULL_PATH, LOGO_PATH } from "@/lib/brand"

type BrandLogoProps = {
  size?: number
  className?: string
  priority?: boolean
  /** icon = symbole seul · full = logo horizontal · mark = alias logo.png */
  variant?: "icon" | "full" | "mark"
}

export function BrandLogo({
  size = 48,
  className = "",
  priority = false,
  variant = "mark",
}: BrandLogoProps) {
  const src = variant === "icon" ? ICON_512_PATH : variant === "full" ? LOGO_FULL_PATH : LOGO_PATH
  const width = variant === "full" ? Math.round(size * 2.8) : size
  const height = size

  return (
    <Image
      src={src}
      alt={BRAND_NAME}
      width={width}
      height={height}
      priority={priority}
      className={`object-contain ${className}`}
    />
  )
}
