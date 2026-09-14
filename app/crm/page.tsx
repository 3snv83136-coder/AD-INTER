'use client'
import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { BrandLogo } from "@/components/BrandLogo"
import { ICON_512_PATH } from "@/lib/brand"

type SubLink = { href: string; label: string; desc: string }

type PriorityCard = {
  href: string
  label: string
  desc: string
  emoji: string
  bg: string
  subLinks?: SubLink[]
  fullWidth?: boolean
}

type ModuleTile = {
  href: string
  emoji: string
  label: string
  desc: string
  bg: string
  external?: boolean
}

const PRIORITIES: PriorityCard[] = [
  {
    href: '/planning',
    label: 'Planning',
    desc: 'RDV, dispatch & tournées',
    emoji: '📅',
    bg: 'bg-gradient-to-br from-blue-500 to-blue-700',
    fullWidth: true,
  },
  {
    href: '/rapports',
    label: 'Rapports',
    desc: 'Terrain & publication',
    emoji: '📄',
    bg: 'bg-gradient-to-br from-slate-700 to-slate-900',
    subLinks: [
      { href: '/nouveau', label: 'Nouveau rapport', desc: 'Mode terrain' },
      { href: '/rapports', label: 'Tous les rapports', desc: 'Liste & envoi' },
    ],
  },
  {
    href: '/devis',
    label: 'Devis',
    desc: 'Création & suivi',
    emoji: '📋',
    bg: 'bg-gradient-to-br from-amber-400 to-orange-600',
    subLinks: [
      { href: '/devis', label: 'Nouveau devis', desc: 'Rédiger' },
      { href: '/devis/tous', label: 'Tous les devis', desc: 'Historique' },
    ],
  },
  {
    href: '/facture',
    label: 'Facturation',
    desc: 'Factures & relances',
    emoji: '🧾',
    bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
    subLinks: [
      { href: '/facture/nouvelle', label: 'Nouvelle facture', desc: 'Créer' },
      { href: '/facture', label: 'Suivi facturation', desc: 'Liste & paiements' },
    ],
  },
]

const MODULES: ModuleTile[] = [
  { href: '/accord',            emoji: '🤝', label: 'Accords',        desc: 'Liste signés',       bg: 'bg-gradient-to-br from-red-500 to-red-700' },
  { href: '/accord/nouveau',    emoji: '✍️', label: 'Nouvel accord',  desc: 'Créer',              bg: 'bg-gradient-to-br from-rose-400 to-red-500' },
  { href: '/historique',        emoji: '🔔', label: 'Relances',       desc: 'Stop avis/devis',    bg: 'bg-gradient-to-br from-orange-500 to-red-600' },
  { href: '/inspection',        emoji: '📹', label: 'Caméra',         desc: 'Inspection NF',      bg: 'bg-gradient-to-br from-sky-400 to-sky-600' },
  { href: '/attestation',       emoji: '✅', label: 'Attestation',    desc: 'SPANC',              bg: 'bg-gradient-to-br from-[#a18249] to-[#6e5530]' },
  { href: '/historique',        emoji: '📚', label: 'Historique',     desc: 'Interventions',      bg: 'bg-gradient-to-br from-slate-400 to-slate-600' },
  { href: '/clients',           emoji: '👥', label: 'Clients',        desc: 'Annuaire',           bg: 'bg-gradient-to-br from-teal-500 to-teal-700' },
  { href: '/statistiques',      emoji: '📊', label: 'Statistiques',   desc: 'Acquisition',        bg: 'bg-gradient-to-br from-rose-500 to-rose-700' },
  { href: '/comptabilite',      emoji: '💼', label: 'Comptabilité',   desc: 'Bilan & FEC',        bg: 'bg-gradient-to-br from-violet-500 to-violet-700' },
  { href: '/comptabilite',      emoji: '🪪', label: 'RH',             desc: 'Salariés',           bg: 'bg-gradient-to-br from-fuchsia-400 to-purple-600' },
  { href: '/admin/techniciens', emoji: '👷', label: 'Techniciens',    desc: 'Profils site',       bg: 'bg-gradient-to-br from-orange-400 to-orange-600' },
  { href: '/login',             emoji: '🔑', label: 'Accès démo',     desc: 'Essai client',       bg: 'bg-gradient-to-br from-amber-500 to-orange-700' },
  { href: '/mail',              emoji: '📧', label: 'Mail',           desc: 'Emails envoyés',     bg: 'bg-gradient-to-br from-cyan-500 to-cyan-700' },
  { href: '/post-gmb',          emoji: '📍', label: 'Post GMB',       desc: 'Google Business',    bg: 'bg-gradient-to-br from-indigo-500 to-indigo-700' },
  { href: '/statistiques',      emoji: '🌐', label: 'Connexions',     desc: 'Historique & pays',  bg: 'bg-gradient-to-br from-slate-500 to-slate-700' },
]

function BrandWatermark({ className = '' }: { className?: string }) {
  return (
    <Image
      src={ICON_512_PATH}
      alt=""
      aria-hidden
      width={120}
      height={120}
      className={`pointer-events-none select-none object-contain opacity-[0.12] ${className}`}
    />
  )
}

function PriorityTile({ card, introClass }: { card: PriorityCard; introClass?: string }) {
  const hasSubs = card.subLinks && card.subLinks.length > 0

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl shadow-lg ring-1 ring-white/10 text-white ${card.bg} ${
        card.fullWidth ? 'col-span-full min-h-[108px] sm:min-h-[118px]' : 'min-h-[148px] sm:min-h-[160px]'
      } ${introClass || ''}`}
    >
      <BrandWatermark className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-32 sm:h-32" />

      <Link href={card.href} className="absolute inset-0 z-10" aria-label={card.label} />

      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-2 text-4xl sm:text-5xl opacity-25"
      >
        {card.emoji}
      </span>

      <div className="relative z-[1] flex h-full flex-col justify-between p-3 sm:p-4">
        <div>
          <div className="text-lg sm:text-xl font-extrabold tracking-tight drop-shadow-sm">{card.label}</div>
          <p className="mt-0.5 text-[11px] sm:text-xs font-medium opacity-90">{card.desc}</p>
        </div>

        {hasSubs && (
          <div className="relative z-20 mt-3 grid grid-cols-2 gap-1.5 sm:gap-2">
            {card.subLinks!.map(sub => (
              <Link
                key={sub.href + sub.label}
                href={sub.href}
                className="rounded-lg bg-black/20 px-2 py-2 sm:px-2.5 sm:py-2.5 ring-1 ring-white/10 transition hover:bg-black/30 hover:scale-[1.02]"
              >
                <div className="text-[11px] sm:text-xs font-bold leading-tight">{sub.label}</div>
                <div className="text-[9px] sm:text-[10px] opacity-75 font-medium">{sub.desc}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ModuleTile({ t }: { t: ModuleTile }) {
  const tileClass = `group relative min-h-[100px] sm:min-h-[108px] rounded-xl overflow-hidden flex flex-col justify-end p-3 shadow-md ring-1 ring-white/10 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${t.bg} text-white`

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

  return (
    <main className="min-h-dvh bg-[#0a1628] text-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a1628]/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          <div className={`flex items-center gap-2 sm:gap-3 min-w-0 ${intro ? 'allo-drop' : ''}`}>
            <Link href="/" className="shrink-0" aria-label="Retour aux espaces">
              <BrandLogo
                variant="full"
                size={36}
                priority
                className="h-8 sm:h-9 w-auto max-w-[160px] sm:max-w-[200px] shrink-0"
              />
            </Link>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-white/50 font-semibold shrink-0">
              CRM
            </span>
          </div>
          <div className="text-[10px] sm:text-xs text-white/60 tabular-nums shrink-0">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-5 space-y-4 sm:space-y-5">
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-semibold mb-2 px-0.5">
            Priorités
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {PRIORITIES.map(card => (
              <PriorityTile
                key={card.label}
                card={card}
                introClass={intro ? 'allo-drop' : ''}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-semibold mb-2 px-0.5">
            Tous les modules
            <span className="ml-2 text-white/35 tabular-nums">{MODULES.length}</span>
          </h2>
          <div
            className="grid gap-2 sm:gap-2.5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 118px), 1fr))' }}
          >
            {MODULES.map(t => (
              <ModuleTile key={`${t.href}-${t.label}`} t={t} />
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
