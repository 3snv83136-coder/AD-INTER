'use client'
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

type Compte = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  agence: string | null
  actif: boolean
  role: 'tech' | 'admin'
  login: string | null
  has_password: boolean
  doit_changer_mdp: boolean
  derniere_connexion: string | null
  created_at: string
}

type FormState = {
  id: string | null
  nom: string
  email: string
  telephone: string
  agence: string
  login: string
  password: string
  role: 'tech' | 'admin'
  actif: boolean
}

const EMPTY_FORM: FormState = {
  id: null,
  nom: '',
  email: '',
  telephone: '',
  agence: '',
  login: '',
  password: '',
  role: 'tech',
  actif: true,
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export default function AdminTechniciensPage() {
  const [comptes, setComptes] = useState<Compte[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/techniciens?all=1', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
      setComptes(json.techniciens || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setFormError('')
    setForm({ ...EMPTY_FORM })
  }

  function openEdit(c: Compte) {
    setFormError('')
    setForm({
      id: c.id,
      nom: c.nom || '',
      email: c.email || '',
      telephone: c.telephone || '',
      agence: c.agence || '',
      login: c.login || '',
      password: '',
      role: c.role || 'tech',
      actif: c.actif,
    })
  }

  async function save() {
    if (!form) return
    if (!form.nom.trim()) { setFormError('Le nom est requis'); return }
    if (form.login.trim() && !form.id && !form.password) {
      setFormError('Définissez un mot de passe pour ce nouvel identifiant')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const isEdit = Boolean(form.id)
      const payload: Record<string, unknown> = {
        nom: form.nom.trim(),
        email: form.email.trim(),
        telephone: form.telephone.trim(),
        agence: form.agence.trim(),
        login: form.login.trim(),
        role: form.role,
        actif: form.actif,
      }
      if (isEdit) payload.id = form.id
      if (form.password) payload.password = form.password

      const res = await fetch('/api/techniciens', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Échec de l’enregistrement')
      setForm(null)
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Échec de l’enregistrement')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActif(c: Compte) {
    try {
      const res = await fetch('/api/techniciens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, actif: !c.actif }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Échec')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec')
    }
  }

  return (
    <main className="allo-page text-slate-900 pb-16">
      <header className="sticky top-0 z-20 bg-[#0e2a52] text-white border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/70 hover:text-white text-sm">← Accueil</Link>
            <h1 className="text-lg sm:text-xl font-black tracking-tight">Équipe & comptes</h1>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-bold px-3 py-2 rounded-xl transition"
          >
            + Nouveau compte
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5">
        <p className="text-sm text-slate-500 mb-4">
          Gérez les comptes des techniciens (mode terrain) et des administrateurs.
          Un identifiant + mot de passe permet la connexion à l’application.
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-slate-400 text-sm py-10 text-center">Chargement…</div>
        ) : comptes.length === 0 ? (
          <div className="text-slate-400 text-sm py-10 text-center">Aucun compte. Créez le premier.</div>
        ) : (
          <div className="space-y-2">
            {comptes.map(c => (
              <div
                key={c.id}
                className={`rounded-xl border bg-white px-4 py-3 flex items-center justify-between gap-3 ${
                  c.actif ? 'border-slate-200' : 'border-slate-200 opacity-60'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 truncate">{c.nom}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                      c.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-cyan-100 text-cyan-700'
                    }`}>
                      {c.role === 'admin' ? 'Admin' : 'Technicien'}
                    </span>
                    {!c.actif && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">
                        Inactif
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {c.login
                      ? <>🔑 <span className="font-mono">{c.login}</span>{c.has_password ? '' : ' (sans mot de passe)'}</>
                      : <span className="text-slate-400">aucun accès applicatif</span>}
                    {c.derniere_connexion && <> · dernière connexion {formatDate(c.derniere_connexion)}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleActif(c)}
                    title={c.actif ? 'Désactiver' : 'Réactiver'}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100"
                  >
                    {c.actif ? 'Désactiver' : 'Réactiver'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="text-xs font-bold text-cyan-700 hover:text-cyan-900 px-2 py-1 rounded-lg hover:bg-cyan-50"
                  >
                    Modifier
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92dvh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <h2 className="font-black text-slate-800">
                {form.id ? 'Modifier le compte' : 'Nouveau compte'}
              </h2>
              <button type="button" onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {formError && (
                <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">{formError}</div>
              )}

              <Field label="Nom complet *">
                <input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} className={inputCls} placeholder="Jean Dupont" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="jean@…" type="email" />
                </Field>
                <Field label="Téléphone">
                  <input value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} className={inputCls} placeholder="06…" />
                </Field>
              </div>

              <hr className="border-slate-100" />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Accès à l’application</p>

              <Field label="Identifiant de connexion">
                <input value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} className={inputCls} placeholder="jean.dupont" autoCapitalize="none" />
              </Field>

              <Field label={form.id ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe'}>
                <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inputCls} placeholder="••••••" type="text" autoCapitalize="none" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Rôle">
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as 'tech' | 'admin' })} className={inputCls}>
                    <option value="tech">Technicien (terrain)</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </Field>
                <Field label="Statut">
                  <select value={form.actif ? '1' : '0'} onChange={e => setForm({ ...form, actif: e.target.value === '1' })} className={inputCls}>
                    <option value="1">Actif</option>
                    <option value="0">Inactif</option>
                  </select>
                </Field>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 text-slate-600 font-semibold py-2.5 rounded-xl hover:bg-slate-100">Annuler</button>
              <button type="button" onClick={save} disabled={saving} className="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  )
}
