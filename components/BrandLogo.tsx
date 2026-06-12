import Image from "next/image"
import { BRAND_NAME, LOGO_PATH } from "@/lib/brand"

type BrandLogoProps = {
  size?: number
  className?: string
  priority?: boolean
}

export function BrandLogo({ size = 48, className = "", priority = false }: BrandLogoProps) {
  return (
    <Image
      src={LOGO_PATH}
      alt={BRAND_NAME}
      width={size}
      height={size}
      priority={priority}
      className={`object-contain ${className}`}
    />
  )
}
