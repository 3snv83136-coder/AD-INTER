'use client'
import { useEffect, useRef, useState } from "react"
import { VILLES_VAR, searchVilles, findVilleByName, type VilleVar } from "@/lib/villes-var"
import { searchVillesFrance } from "@/lib/villes-france-cp"

type Props = {
  value: string
  onChange: (nom: string) => void
  onSelect: (v: VilleVar) => void
  placeholder?: string
  className?: string
  showCheck?: boolean
}

function dedupe(list: VilleVar[]): VilleVar[] {
  const seen = new Set<string>()
  return list.filter((v) => {
    const key = `${v.nom}|${v.cp}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default function VilleCombobox({
  value, onChange, onSelect, placeholder, className, showCheck = true,
}: Props) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [remote, setRemote] = useState<VilleVar[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const lastAutoCp = useRef("")
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const local = value.trim().length >= 1
    ? dedupe([...searchVilles(value, 8), ...searchVillesFrance(value, 8)])
    : VILLES_VAR.slice(0, 8)
  const suggestions = dedupe([...local, ...remote]).slice(0, 12)
  const isExactMatch =
    !!findVilleByName(value)
    || suggestions.some((v) => v.nom === value || v.cp === value)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  useEffect(() => {
    const q = value.trim()
    if (/^\d{5}$/.test(q) && lastAutoCp.current !== q) {
      const hit = [...searchVilles(q, 8), ...searchVillesFrance(q, 8)].find((v) => v.cp === q)
      if (hit) {
        lastAutoCp.current = q
        onSelectRef.current(hit)
      }
    }
    if (q.length < 2) {
      setRemote([])
      setLoading(false)
      return
    }
    const ac = new AbortController()
    const t = window.setTimeout(() => {
      setLoading(true)
      void fetch(`/api/communes?q=${encodeURIComponent(q)}`, { signal: ac.signal, cache: "no-store" })
        .then((r) => r.json())
        .then((data: { communes?: VilleVar[] }) => {
          const list = Array.isArray(data.communes) ? data.communes : []
          setRemote(list)
          if (/^\d{5}$/.test(q) && list[0] && lastAutoCp.current !== q) {
            lastAutoCp.current = q
            onSelectRef.current(list[0])
          }
        })
        .catch(() => {
          /* réseau / abort */
        })
        .finally(() => setLoading(false))
    }, 180)
    return () => {
      window.clearTimeout(t)
      ac.abort()
    }
  }, [value])

  function pick(v: VilleVar) {
    lastAutoCp.current = v.cp
    onSelect(v)
    setOpen(false)
  }

  const baseInput = `w-full border-2 ${isExactMatch ? "border-emerald-400 bg-emerald-50" : "border-slate-200"} focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors`

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.currentTarget.value); setOpen(true); setHighlight(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, suggestions.length - 1)) }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
          else if (e.key === "Enter" && suggestions[highlight]) { e.preventDefault(); pick(suggestions[highlight]) }
          else if (e.key === "Escape") setOpen(false)
        }}
        placeholder={placeholder ?? "Ville ou code postal — toute la France"}
        autoComplete="off"
        inputMode={/^\d/.test(value.trim()) ? "numeric" : "text"}
        className={className ?? baseInput}
      />
      {showCheck && isExactMatch && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 text-lg pointer-events-none">✓</span>
      )}
      {open && (suggestions.length > 0 || loading) && (
        <div className="absolute z-[80] left-0 right-0 mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
          {loading && suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">Recherche des communes…</div>
          ) : (
            suggestions.map((v, i) => (
              <button
                key={`${v.nom}-${v.cp}-${i}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(v)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-4 py-3 flex justify-between items-center gap-3 border-b border-slate-100 last:border-b-0 transition ${
                  i === highlight ? "bg-blue-50 text-blue-700" : "text-[#0e2a52] hover:bg-slate-50"
                }`}
              >
                <span className="font-semibold text-sm">{v.nom}</span>
                <span className="text-xs text-slate-500 font-mono shrink-0">{v.cp}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
