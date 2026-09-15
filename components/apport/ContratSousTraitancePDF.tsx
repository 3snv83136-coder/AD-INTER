import { createElement, type ReactElement } from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import { BRAND_NAME } from "@/lib/brand"
import { ALLO_ADRESSE_LIGNES, ALLO_RCS, ALLO_SIRET } from "@/lib/entreprise"
import {
  CGU_SOUS_TRAITANCE_PARAGRAPHES,
  CGU_SOUS_TRAITANCE_VERSION,
} from "@/lib/sous-traitance-cgu"

export type ContratSousTraitancePdfData = {
  reference: string | null
  signataireNom: string
  siret: string | null
  telephone: string
  typeIntervention: string | null
  ville: string | null
  datePrevue: string | null
  accepteAt: string
  preuveHash: string
  signatureSrc: string | { data: Buffer; format: "png" | "jpg" }
  ip: string | null
}

const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#1e293b",
    lineHeight: 1.45,
  },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0e2a52" },
  muted: { fontSize: 8, color: "#64748b", marginTop: 2 },
  title: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#0e2a52",
    textTransform: "uppercase",
  },
  box: {
    borderWidth: 1,
    borderColor: "#d9dfe7",
    padding: 10,
    marginBottom: 10,
  },
  label: { fontSize: 7.5, color: "#64748b", textTransform: "uppercase", marginBottom: 2 },
  value: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  para: { marginBottom: 6, fontSize: 8.5 },
  sig: { width: 180, height: 70, marginTop: 6 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7, color: "#94a3b8" },
})

/**
 * Arbre Document natif (primitives react-pdf), sans composant fonction.
 * En prod Next, un wrapper React déclenche « Component is not a constructor ».
 */
export function buildContratDocument(data: ContratSousTraitancePdfData): ReactElement {
  const siretAllo = ALLO_SIRET ? `SIRET ${ALLO_SIRET}` : null
  const cguNodes = CGU_SOUS_TRAITANCE_PARAGRAPHES.map((p, idx) =>
    createElement(Text, { key: `cgu-${idx}`, style: s.para }, p),
  )

  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: "A4", style: s.page },
      createElement(Text, { key: "brand", style: s.brand }, BRAND_NAME),
      createElement(Text, { key: "addr", style: s.muted }, ALLO_ADRESSE_LIGNES.join(" · ")),
      createElement(
        Text,
        { key: "meta", style: s.muted },
        [siretAllo, ALLO_RCS, data.telephone].filter(Boolean).join(" · "),
      ),
      createElement(
        Text,
        { key: "title", style: s.title },
        "Contrat de sous-traitance — acceptation électronique",
      ),
      createElement(
        View,
        { key: "st", style: s.box },
        createElement(Text, { style: s.label }, "Sous-traitant signataire"),
        createElement(Text, { style: s.value }, data.signataireNom),
        createElement(
          Text,
          { style: s.muted },
          data.siret ? `SIRET ${data.siret}` : "SIRET non renseigné",
        ),
      ),
      createElement(
        View,
        { key: "aff", style: s.box },
        createElement(Text, { style: s.label }, "Intervention confiée"),
        createElement(Text, { style: s.value }, data.typeIntervention || "Intervention"),
        createElement(
          Text,
          { style: s.muted },
          [data.reference ? `Dossier ${data.reference}` : null, data.datePrevue, data.ville]
            .filter(Boolean)
            .join(" · "),
        ),
      ),
      ...cguNodes,
      createElement(
        View,
        { key: "sig", style: s.box },
        createElement(Text, { style: s.label }, "Signature électronique"),
        createElement(
          Text,
          { style: s.muted },
          `Accepté le ${data.accepteAt}${data.ip ? ` · IP ${data.ip}` : ""} · CGU ${CGU_SOUS_TRAITANCE_VERSION}`,
        ),
        createElement(Image, { src: data.signatureSrc, style: s.sig }),
      ),
      createElement(
        Text,
        { key: "footer", style: s.footer },
        `Document interne ${BRAND_NAME} — non communicable au sous-traitant. Empreinte ${data.preuveHash}`,
      ),
    ),
  )
}
