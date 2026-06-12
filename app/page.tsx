'use client'
import { useEffect, useState } from "react"
import Link from "next/link"
import { BrandLogo } from "@/components/BrandLogo"

type Tool = {
  href: string
  emoji: string
  label: string
  desc: string
  bg: string
  text: 'white' | 'black'
  external?: boolean
  featured?: boolean
}

const TOOLS: Tool[] = [
  { href: '/accord',            emoji: '🤝', label: 'Accord',          desc: 'Accords signés',           bg: 'bg-gradient-to-br from-red-500 to-red-700',         text: 'white', featured: true },
  { href: '/planning',          emoji: '📅', label: 'Planning',        desc: 'RDV & tournées',           bg: 'bg-gradient-to-br from-blue-500 to-blue-700',       text: 'white', featured: true },
  { href: '/nouveau',           emoji: '📝', label: 'Rapport',         desc: 'Terrain',                  bg: 'bg-gradient-to-br from-slate-700 to-slate-900',     text: 'white' },
  { href: '/rapports',          emoji: '📄', label: 'Rapports',        desc: 'Liste & publication',      bg: 'bg-gradient-to-br from-slate-500 to-slate-700',     text: 'white' },
  { href: '/inspection',        emoji: '📹', label: 'Caméra',          desc: 'Inspection NF',            bg: 'bg-gradient-to-br from-sky-400 to-sky-600',         text: 'white' },
  { href: '/devis',             emoji: '📋', label: 'Devis',           desc: 'Nouveau devis',            bg: 'bg-gradient-to-br from-amber-400 to-amber-600',     text: 'white' },
  { href: '/devis/tous',        emoji: '📑', label: 'Tous devis',      desc: 'Historique devis',         bg: 'bg-gradient-to-br from-yellow-500 to-orange-600',   text: 'white' },
  { href: '/facture',           emoji: '🧾', label: 'Facturation',     desc: 'Suivi & relances',         bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700', text: 'white' },
  { href: '/facture/nouvelle',  emoji: '➕', label: 'Facture',         desc: 'Créer facture',            bg: 'bg-gradient-to-br from-lime-500 to-green-700',     text: 'white' },
  { href: '/attestation',       emoji: '✅', label: 'Attestation',     desc: 'SPANC',                    bg: 'bg-gradient-to-br from-[#a18249] to-[#6e5530]',     text: 'white' },
  { href: '/historique',        emoji: '📚', label: 'Historique',      desc: 'Interventions',            bg: 'bg-gradient-to-br from-slate-400 to-slate-600',     text: 'white' },
  { href: '/clients',           emoji: '👥', label: 'Clients',         desc: 'Annuaire',                 bg: 'bg-gradient-to-br from-teal-500 to-teal-700',       text: 'white' },
  { href: '/statistiques',      emoji: '📊', label: 'Statistiques',    desc: 'Acquisition',              bg: 'bg-gradient-to-br from-rose-500 to-rose-700',       text: 'white' },
  { href: '/comptabilite',      emoji: '💼', label: 'Comptabilité',    desc: 'Bilan & FEC',              bg: 'bg-gradient-to-br from-violet-500 to-violet-700',   text: 'white' },
  { href: '/mail',              emoji: '📧', label: 'Mail',            desc: 'Emails envoyés',           bg: 'bg-gradient-to-br from-cyan-500 to-cyan-700',       text: 'white' },
  { href: '/post-gmb',          emoji: '📍', label: 'Post GMB',        desc: 'Google Business',          bg: 'bg-gradient-to-br from-indigo-500 to-indigo-700',   text: 'white' },
  { href: 'https://adsconstructor.vercel.app/', emoji: '📢', label: 'ADS', desc: 'Publicités', bg: 'bg-gradient-to-br from-orange-500 to-pink-600', text: 'white', external: true },
  { href: '/accord/nouveau',    emoji: '✍️', label: 'Nouvel accord',   desc: 'Créer accord',             bg: 'bg-gradient-to-br from-red-400 to-rose-600',        text: 'white' },
  { href: '/admin/techniciens', emoji: '👷', label: 'Équipe',          desc: 'Comptes techniciens',      bg: 'bg-gradient-to-br from-slate-600 to-slate-800',     text: 'white' },
]

function ToolTile({ t, introClass }: { t: Tool; introClass?: string }) {
  const textColor = t.text === 'white' ? 'text-white' : 'text-black'
  const tileClass = t.featured
    ? `group relative min-h-[108px] sm:min-h-[120px] rounded-xl sm:rounded-2xl overflow-hidden flex flex-col justify-end p-3 sm:p-4 shadow-lg ring-1 ring-white/10 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] ${t.bg} ${textColor} ${introClass || ''}`
    : `group relative min-h-[100px] sm:min-h-[108px] rounded-xl overflow-hidden flex flex-col justify-end p-3 shadow-md ring-1 ring-white/10 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${t.bg} ${textColor} ${introClass || ''}`

  const inner = (
    <>
      <span
        aria-hidden
        className="pointer-events-none select-none absolute -top-1 -right-1 text-[2.75rem] sm:text-[3.25rem] leading-none opacity-20 transition-transform group-hover:scale-105"
      >
        {t.emoji}
      </span>
      <div className="relative z-10">
        <div className="text-sm sm:text-base font-extrabold leading-tight tracking-tight drop-shadow-sm">
          {t.label}
        </div>
        <p className="mt-0.5 text-[10px] sm:text-[11px] leading-snug opacity-85 line-clamp-2 font-medium">
          {t.desc}
        </p>
      </div>
    </>
  )

  if (t.external) {
    return (
      <a href={t.href} target="_blank" rel="noopener noreferrer" title={t.desc} className={tileClass}>
        {inner}
      </a>
    )
  }

  return (
    <Link href={t.href} title={t.desc} className={tileClass}>
      {inner}
    </Link>
  )
}

export default function Home() {
  const [intro, setIntro] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIntro(sessionStorage.getItem('allo_seen_intro') !== '1')
    sessionStorage.setItem('allo_seen_intro', '1')
  }, [])

  const featured = TOOLS.filter(t => t.featured)
  const rest = TOOLS.filter(t => !t.featured)

  return (
    <main className="min-h-dvh bg-[#0a1628] text-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1628]/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2 flex items-center justify-end">
          <div className="text-[10px] sm:text-xs text-white/60 tabular-nums">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </header>

      <section
        className={`relative z-10 flex flex-col items-center justify-center px-4 pt-6 pb-8 sm:pt-10 sm:pb-10 ${intro ? 'allo-drop' : ''}`}
      >
        <div className="relative w-full max-w-[min(92vw,520px)]">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1e6fd9]/20 blur-3xl"
          />
          <BrandLogo
            variant="full"
            size={160}
            priority
            className="relative mx-auto h-auto w-full max-w-[min(92vw,520px)] drop-shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
          />
        </div>
      </section>

      <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-5 pb-6 space-y-4 sm:space-y-5">
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-semibold mb-2 px-0.5">
            Priorités
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {featured.map(t => (
              <ToolTile key={t.href} t={t} introClass={intro ? 'allo-drop' : ''} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-semibold mb-2 px-0.5">
            Tous les modules
            <span className="ml-2 text-white/35 tabular-nums">{TOOLS.length}</span>
          </h2>
          <div
            className="grid gap-2 sm:gap-2.5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 118px), 1fr))' }}
          >
            {rest.map(t => (
              <ToolTile key={`${t.href}-${t.label}`} t={t} />
            ))}
          </div>
        </section>
      </div>

      <style jsx>{`
        @keyframes softFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .allo-drop { opacity: 0; animation: softFadeUp 0.45s ease-out 0.05s forwards; }
        @media (prefers-reduced-motion: reduce) {
          .allo-drop { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </main>
  )
}
