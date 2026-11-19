import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

// ─── Formats ───
const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtCourt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const fmtHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const fmtComplet = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const jourLong = (d) => fmtJour.format(new Date(d))
export const heure = (d) => fmtHeure.format(new Date(d))
export const dateHeure = (d) => (d ? fmtComplet.format(new Date(d)) : '—')
export function dateRelative(d) {
  const x = new Date(d), now = new Date()
  if (x.toDateString() === now.toDateString()) return heure(x)
  const hier = new Date(now); hier.setDate(now.getDate() - 1)
  if (x.toDateString() === hier.toDateString()) return 'hier'
  return fmtCourt.format(x)
}
export const dateSimple = (s) => {
  if (!s) return '—'
  const d = new Date(String(s).length === 10 ? s + 'T12:00:00' : s)
  return isNaN(d) ? String(s) : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}
export const taille = (o) => (!o ? '' : o < 1024 ? o + ' o' : o < 1048576 ? Math.round(o / 1024) + ' Ko' : (o / 1048576).toFixed(1) + ' Mo')
export const nomExpediteur = (de) => (String(de).match(/^"?([^"<]+)"?\s*</)?.[1] || de).trim()

// Valeur pour <input type="datetime-local"> / "date" en heure locale
export function versLocal(iso, avecHeure = true) {
  const d = new Date(iso); const p = (n) => String(n).padStart(2, '0')
  const j = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  return avecHeure ? `${j}T${p(d.getHours())}:${p(d.getMinutes())}` : j
}

export const ROLES = { admin: 'Administrateur', cure: 'Curé / prêtre', secretaire: 'Secrétaire' }

export const COULEURS_STATUT = {
  'À traiter': 'bg-or-100 text-or-600',
  'En cours': 'bg-blue-100 text-blue-800',
  Traité: 'bg-emerald-100 text-emerald-800',
  ouvert: 'bg-blue-50 text-blue-800',
  clos: 'bg-emerald-100 text-emerald-800',
  annule: 'bg-gray-100 text-gray-600'
}

export const initiales = (nom) => String(nom || '?').replace(/^(abbé|père|sœur|soeur)\s+/i, '').split(/\s+/).map((m) => m[0]).slice(0, 2).join('').toUpperCase()
export const dateCourte = (s) => (s ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(String(s).length === 10 ? s + 'T12:00:00' : s)) : '—')

// ─── Composants ───
export function Chargement({ texte = 'Chargement…' }) {
  return <div className="flex items-center justify-center gap-2 py-12 text-nuit-600 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{texte}</div>
}

export function Erreur({ erreur, reessayer }) {
  if (!erreur) return null
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{erreur.message || String(erreur)}</div>
      {reessayer && <button className="font-medium underline" onClick={reessayer}>Réessayer</button>}
    </div>
  )
}

export function Vide({ icone: Icone, texte }) {
  return <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-nuit-600/70">{Icone && <Icone className="h-8 w-8 opacity-40" />}{texte}</div>
}

export function Modale({ titre, onFermer, children, pied, large }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onFermer()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onFermer])
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-nuit-800/40 backdrop-blur-[2px]" onClick={onFermer}>
      <div className={`carte flex max-h-[92vh] w-full flex-col rounded-b-none sm:rounded-xl ${large ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-nuit-100/70 px-5 py-3">
          <h2 className="text-xl font-semibold">{titre}</h2>
          <button className="btn-icone" onClick={onFermer} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {pied && <div className="flex flex-wrap justify-end gap-2 border-t border-nuit-100/70 px-5 py-3 safe-bottom">{pied}</div>}
      </div>
    </div>
  )
}

export function EnTete({ titre, sousTitre, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold leading-tight">{titre}</h1>
        {sousTitre && <p className="mt-0.5 text-sm text-nuit-600/80">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

// ─── Notifications et confirmations (jamais de fenêtre native du navigateur) ───
const CtxNotif = createContext(() => {})
export const useNotif = () => useContext(CtxNotif)
const CtxConfirmer = createContext(async () => false)
/** const confirmer = useConfirmer(); if (await confirmer({ titre, texte, bouton, danger })) … */
export const useConfirmer = () => useContext(CtxConfirmer)

/** Imprime un document HTML via un cadre caché (pas de nouvel onglet). */
export function imprimerHtml(html) {
  const cadre = document.createElement('iframe')
  Object.assign(cadre.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(cadre)
  cadre.onload = () => { cadre.contentWindow.focus(); cadre.contentWindow.print(); setTimeout(() => cadre.remove(), 60000) }
  cadre.srcdoc = html
}

export function FournisseurNotif({ children }) {
  const [demande, setDemande] = useState(null)
  const confirmer = useCallback((opts) => new Promise((resoudre) => setDemande({ ...opts, resoudre })), [])
  const repondre = (ok) => { demande?.resoudre(ok); setDemande(null) }
  return (
    <CtxConfirmer.Provider value={confirmer}>
      <FournisseurToasts>{children}</FournisseurToasts>
      {demande && (
        <Modale titre={demande.titre || 'Confirmer'} onFermer={() => repondre(false)}
          pied={<><button className="btn-clair" onClick={() => repondre(false)}>Annuler</button>
            <button className={demande.danger ? 'btn bg-red-700 text-white hover:bg-red-800' : 'btn-principal'} onClick={() => repondre(true)} autoFocus>{demande.bouton || 'Confirmer'}</button></>}>
          <p className="whitespace-pre-line text-sm text-nuit-600">{demande.texte}</p>
        </Modale>
      )}
    </CtxConfirmer.Provider>
  )
}

function FournisseurToasts({ children }) {
  const [liste, setListe] = useState([])
  const notifier = useCallback((texte, type = 'ok') => {
    const id = Math.random()
    setListe((l) => [...l, { id, texte, type }])
    setTimeout(() => setListe((l) => l.filter((x) => x.id !== id)), 3500)
  }, [])
  return (
    <CtxNotif.Provider value={notifier}>
      {children}
      <div className="pointer-events-none fixed bottom-20 left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {liste.map((n) => (
          <div key={n.id} className={`pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${n.type === 'erreur' ? 'bg-red-700' : 'bg-nuit'}`}>
            {n.type === 'erreur' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-or-100" />}{n.texte}
          </div>
        ))}
      </div>
    </CtxNotif.Provider>
  )
}

// ─── Hook de chargement ───
export function useCharger(fn, deps = []) {
  const [etat, setEtat] = useState({ data: null, chargement: true, erreur: null })
  const recharger = useCallback(async () => {
    setEtat((e) => ({ ...e, chargement: true, erreur: null }))
    try { setEtat({ data: await fn(), chargement: false, erreur: null }) }
    catch (erreur) { setEtat((e) => ({ ...e, chargement: false, erreur })) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { recharger() }, [recharger])
  return { ...etat, recharger, setData: (d) => setEtat((e) => ({ ...e, data: typeof d === 'function' ? d(e.data) : d })) }
}
