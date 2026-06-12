function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

/** Meta description Django — jamais vide (requis côté Allo Débouchage). */
export function buildPublishDescription(opts: {
  seo: Record<string, unknown>
  rapport?: Record<string, unknown> | null
  typeIntervention?: string | null
  ville: string
}): string {
  const { seo, rapport, typeIntervention, ville } = opts
  const candidates: unknown[] = [
    seo.meta_description,
    seo.resume_rich_snippet,
    rapport?.objet,
    rapport?.diagnostic,
    typeIntervention && ville
      ? `${typeIntervention} à ${ville} — réalisation Allo Débouchage.`
      : null,
    ville ? `Intervention d'assainissement à ${ville} — Allo Débouchage.` : null,
  ]
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return stripHtml(c.trim())
  }
  return "Intervention d'assainissement — Allo Débouchage, Var."
}
