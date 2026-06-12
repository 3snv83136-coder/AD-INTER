import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import { PwaScript } from "@/components/PwaScript"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Allo Débouchage — Réalisations",
  description: "Back-office techniciens Allo Débouchage",
  robots: "noindex, nofollow",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-1024x1024.png",
    apple: "/icons/icon-512x512.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Allo Débouchage",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0e2a52",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <SessionProvider>
          {children}
        </SessionProvider>
        <PwaScript />
      </body>
    </html>
  )
}
