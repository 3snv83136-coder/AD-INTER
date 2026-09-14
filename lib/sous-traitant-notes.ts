export type SousTraitantFicheInput = {
  siret?: string
  adresse?: string
  code_postal?: string
  ville?: string
  notes?: string
}

export type ParsedSousTraitantNotes = {
  siret: string
  adresse: string
  code_postal: string
  ville: string
  notes: string
}

export function composeSousTraitantNotes(input: SousTraitantFicheInput): string | null {
  const siret = (input.siret || "").replace(/[\s.-]/g, "")
  const adresseLigne = [
    (input.adresse || "").trim(),
    [(input.code_postal || "").trim(), (input.ville || "").trim()].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ")
  const notesParts = [
    /^\d{14}$/.test(siret) ? `SIRET ${siret}` : "",
    adresseLigne,
    (input.notes || "").trim(),
  ].filter(Boolean)
  return notesParts.join("\n") || null
}

export function parseSousTraitantNotes(raw: string | null | undefined): ParsedSousTraitantNotes {
  const empty: ParsedSousTraitantNotes = {
    siret: "",
    adresse: "",
    code_postal: "",
    ville: "",
    notes: "",
  }
  const text = (raw || "").trim()
  if (!text) return empty

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let siret = ""
  const rest: string[] = []

  for (const line of lines) {
    const match = line.match(/^SIRET\s+([\d\s.-]{14,})$/i)
    if (match && !siret) {
      const digits = match[1].replace(/[\s.-]/g, "")
      if (/^\d{14}$/.test(digits)) {
        siret = digits
        continue
      }
    }
    rest.push(line)
  }

  let adresse = ""
  let code_postal = ""
  let ville = ""
  const notesLines: string[] = []

  for (const line of rest) {
    const addr = line.match(/^(.*?)(?:,\s*)?(\d{5})\s+(.+)$/)
    if (addr && !code_postal) {
      adresse = addr[1].replace(/,\s*$/, "").trim()
      code_postal = addr[2]
      ville = addr[3].trim()
      continue
    }
    notesLines.push(line)
  }

  return {
    siret,
    adresse,
    code_postal,
    ville,
    notes: notesLines.join("\n"),
  }
}
