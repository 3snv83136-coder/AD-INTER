import type { Metadata } from "next"
import { APPORT_LIEN_CTA } from "@/lib/apport-cta"

export const metadata: Metadata = {
  title: APPORT_LIEN_CTA,
  description: APPORT_LIEN_CTA,
  robots: "noindex, nofollow",
  openGraph: {
    title: APPORT_LIEN_CTA,
    description: APPORT_LIEN_CTA,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: APPORT_LIEN_CTA,
    description: APPORT_LIEN_CTA,
  },
}

export default function ApportLayout({ children }: { children: React.ReactNode }) {
  return children
}
