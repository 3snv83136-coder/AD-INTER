import { ImageResponse } from "next/og"
import { APPORT_LIEN_CTA } from "@/lib/apport-cta"

export const runtime = "edge"
export const alt = APPORT_LIEN_CTA
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function ApportOpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#dc2626",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
        }}
      >
        <div
          style={{
            color: "#ffffff",
            fontSize: 64,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.25,
            letterSpacing: -1,
          }}
        >
          {APPORT_LIEN_CTA}
        </div>
      </div>
    ),
    { ...size },
  )
}
