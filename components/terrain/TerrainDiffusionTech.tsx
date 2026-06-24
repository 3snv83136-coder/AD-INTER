'use client'

import TerrainBigButton from '@/components/terrain/TerrainBigButton'

type Props = {
  nom: string
  email: string
  telephone: string
  onNomChange: (v: string) => void
  onEmailChange: (v: string) => void
  onTelChange: (v: string) => void
  onError: (e: string) => void
  prepareAndSendMail: () => Promise<void>
  prepareAndSendSms: () => Promise<void>
  busy: boolean
  progress: string
  mailDone: boolean
  smsDone: boolean
}

/** Phase 4 — envoi client ultra simplifié (technicien). */
export default function TerrainDiffusionTech({
  nom,
  email,
  telephone,
  onNomChange,
  onEmailChange,
  onTelChange,
  onError,
  prepareAndSendMail,
  prepareAndSendSms,
  busy,
  progress,
  mailDone,
  smsDone,
}: Props) {
  return (
    <section className="space-y-5">
      <header className="text-center">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Envoyer au client</h1>
        <p className="text-sm text-slate-600 mt-2">Rapport + facture par mail en un clic.</p>
      </header>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-3">
        <label className="block">
          <span className="text-xs font-bold uppercase text-slate-500">Nom client</span>
          <input
            value={nom}
            onChange={e => onNomChange(e.target.value)}
            className="mt-1 w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base outline-none focus:border-emerald-500"
            placeholder="M. Dupont"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase text-slate-500">Email</span>
          <input
            type="email"
            value={email}
            onChange={e => onEmailChange(e.target.value)}
            className="mt-1 w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base outline-none focus:border-emerald-500"
            placeholder="client@email.fr"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase text-slate-500">Téléphone (SMS)</span>
          <input
            type="tel"
            value={telephone}
            onChange={e => onTelChange(e.target.value)}
            className="mt-1 w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-base outline-none focus:border-emerald-500"
            placeholder="06 12 34 56 78"
          />
        </label>
      </div>

      {progress && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 text-sm font-semibold text-center">
          {progress}
        </div>
      )}

      <TerrainBigButton
        onClick={() => {
          if (!nom.trim()) {
            onError('Indiquez le nom du client.')
            return
          }
          if (!email.trim()) {
            onError('Indiquez l\'email du client.')
            return
          }
          void prepareAndSendMail()
        }}
        loading={busy}
        disabled={!email.trim() || !nom.trim()}
        variant={mailDone ? 'success' : 'primary'}
      >
        {mailDone ? '✓ Envoyé par mail' : '✉ ENVOYER AU CLIENT'}
      </TerrainBigButton>

      <TerrainBigButton
        variant="secondary"
        onClick={() => void prepareAndSendSms()}
        loading={busy}
        disabled={!telephone.trim() || !nom.trim()}
      >
        {smsDone ? '✓ SMS préparé' : '📱 Envoyer par SMS'}
      </TerrainBigButton>
    </section>
  )
}
