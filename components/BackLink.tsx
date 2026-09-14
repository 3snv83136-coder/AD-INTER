'use client'

import Link from "next/link"
import { ArrowLeftIcon } from "@/components/Icons"

type BackLinkProps = {
  href: string
  label?: string
  className?: string
}

export function BackLink({ href, label = "Retour", className = "" }: BackLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 shrink-0 rounded-xl px-2.5 py-2 text-sm font-semibold transition hover:bg-white/10 ${className}`}
    >
      <ArrowLeftIcon className="w-5 h-5" strokeWidth={2} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )
}
