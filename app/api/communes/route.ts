import { NextRequest, NextResponse } from "next/server"
import { searchCommunesFrance } from "@/lib/communes-france"
import { searchVillesFrance } from "@/lib/villes-france-cp"
import { searchVilles } from "@/lib/villes-var"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || ""
  if (q.length < 2) {
    return NextResponse.json({ communes: [] })
  }

  const local = [...searchVilles(q, 8), ...searchVillesFrance(q, 8)]
  let remote: Awaited<ReturnType<typeof searchCommunesFrance>> = []
  try {
    remote = await searchCommunesFrance(q, 12)
  } catch (e) {
    console.error("[communes]", e)
  }

  const seen = new Set<string>()
  const communes = [...local, ...remote].filter((c) => {
    const key = `${c.nom}|${c.cp}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 12)

  return NextResponse.json({ communes })
}
