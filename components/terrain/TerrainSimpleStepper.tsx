'use client'

import { stepToPhase, TERRAIN_PHASES } from '@/lib/terrain-phases'

type Props = {
  terrainStep: number
}

/** Barre de progression 4 phases — lecture seule, gros libellés. */
export default function TerrainSimpleStepper({ terrainStep }: Props) {
  const current = stepToPhase(terrainStep)

  return (
    <div className="bg-[#0e2a52] text-white px-3 py-4 border-b border-white/10">
      <div className="max-w-2xl mx-auto grid grid-cols-4 gap-1">
        {TERRAIN_PHASES.map((p) => {
          const done = current > p.key
          const active = current === p.key
          return (
            <div key={p.key} className="flex flex-col items-center gap-1 text-center">
              <div
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg font-bold transition ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-white text-[#0e2a52] ring-4 ring-white/30 scale-110'
                      : 'bg-white/15 text-white/50'
                }`}
              >
                {done ? '✓' : p.icon}
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-bold leading-tight ${
                  active ? 'text-white' : done ? 'text-emerald-300' : 'text-white/45'
                }`}
              >
                {p.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
