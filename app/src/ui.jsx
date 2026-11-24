import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { enCache, fileAttente } from './api.js'
import { X, Loader2, AlertCircle, CheckCircle2, CloudOff } from 'lucide-react'

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

export const ROLES = { admin: 'Administrateur', cure: 'Curé', vicaire: 'Vicaire / prêtre', diacre: 'Diacre', secretaire: 'Secrétaire' }

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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-nuit-800/40 backdrop-blur-[2px] sm:items-center" onClick={onFermer}>
      <div className={`carte flex h-[100dvh] w-full flex-col rounded-none border-0 sm:h-auto sm:max-h-[92vh] sm:rounded-xl sm:border ${large ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-nuit-100/70 px-5 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <h2 className="text-xl font-semibold">{titre}</h2>
          <button className="btn-icone" onClick={onFermer} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
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
        {sousTitre && <div className="mt-0.5 text-sm text-nuit-600/80">{sousTitre}</div>}
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

const CtxDifferer = createContext(() => {})
/**
 * Action annulable : const differer = useDifferer()
 * differer('Dossier supprimé', () => api(...))  → l'action part après 6 s, sauf si on clique « Annuler ».
 * Option onAnnule : remettre l'affichage comme avant.
 */
export const useDifferer = () => useContext(CtxDifferer)
/** Ids masqués en attendant une suppression différée (les listes les cachent). */
export const enSuppression = new Set()

function FournisseurToasts({ children }) {
  const [liste, setListe] = useState([])
  const retirer = (id) => setListe((l) => l.filter((x) => x.id !== id))
  const notifier = useCallback((texte, type = 'ok', opts = {}) => {
    const id = Math.random()
    setListe((l) => [...l, { id, texte, type, action: opts.action }])
    setTimeout(() => retirer(id), opts.duree || (opts.action ? 6500 : 3500))
    return id
  }, [])
  const differer = useCallback((texte, executer, { onAnnule, onErreur, ids = [], delai = 6000 } = {}) => {
    let annule = false
    ids.forEach((x) => enSuppression.add(x))
    const id = Math.random()
    // les ids restent masqués après la suppression ; on ne les rend visibles qu'en cas d'annulation ou d'erreur
    const rendre = () => ids.forEach((x) => enSuppression.delete(x))
    setListe((l) => [...l, { id, texte, type: 'ok', action: { label: 'Annuler', fn: () => { annule = true; rendre(); retirer(id); onAnnule?.() } } }])
    setTimeout(async () => {
      retirer(id)
      if (annule) return
      try { await executer() } catch (e) { rendre(); onErreur?.(e); setListe((l) => [...l, { id: Math.random(), texte: e.message, type: 'erreur' }]) }
    }, delai)
  }, [])
  return (
    <CtxNotif.Provider value={notifier}>
      <CtxDifferer.Provider value={differer}>
        {children}
      </CtxDifferer.Provider>
      <div className="pointer-events-none fixed bottom-20 left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {liste.map((n) => (
          <div key={n.id} className={`pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${n.type === 'erreur' ? 'bg-red-700' : 'bg-nuit'}`}>
            {n.type === 'erreur' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-or-100" />}{n.texte}
            {n.action && <button className="ml-2 rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-white/25" onClick={() => { n.action.fn(); retirer(n.id) }}>{n.action.label}</button>}
          </div>
        ))}
      </div>
    </CtxNotif.Provider>
  )
}

// ─── Hook de chargement ───
/**
 * useCharger(fn, deps, cle) — cle = [action, payload] : affiche tout de suite la dernière réponse connue,
 * puis la remplace par la réponse fraîche (« affichage instantané »).
 */
export function useCharger(fn, deps = [], cle) {
  const initial = cle ? enCache(cle[0], cle[1]) : undefined
  const [etat, setEtat] = useState({ data: initial ?? null, chargement: true, erreur: null })
  const recharger = useCallback(async () => {
    setEtat((e) => ({ ...e, data: e.data ?? (cle ? enCache(cle[0], cle[1]) ?? null : null), chargement: true, erreur: null }))
    try { setEtat({ data: await fn(), chargement: false, erreur: null }) }
    catch (erreur) { setEtat((e) => ({ ...e, chargement: false, erreur })) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { recharger() }, [recharger])
  return { ...etat, recharger, setData: (d) => setEtat((e) => ({ ...e, data: typeof d === 'function' ? d(e.data) : d })) }
}

/** Petite aide « ? » : un clic affiche l'explication. */
export function Aide({ children, className = '' }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <span className={`relative inline-flex align-middle ${className}`}>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOuvert(!ouvert) }} aria-label="Aide"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-or/50 bg-or-50 text-[11px] font-bold text-or-600 hover:bg-or-100">?</button>
      {ouvert && <>
        <span className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOuvert(false) }} />
        <span className="carte absolute left-1/2 top-6 z-50 w-72 -translate-x-1/2 p-3 text-left text-xs font-normal normal-case leading-relaxed text-nuit-700 shadow-lg" onClick={(e) => e.stopPropagation()}>{children}</span>
      </>}
    </span>
  )
}

/** Indicateur d'enregistrement automatique. */
export function EtatEnregistrement({ etat }) {
  if (!etat) return null
  return <span className={`inline-flex items-center gap-1 text-xs ${etat === 'erreur' ? 'text-red-700' : 'text-nuit-600/70'}`}>
    {etat === 'encours' ? <><span className="h-2 w-2 animate-pulse rounded-full bg-or" />Enregistrement…</> : etat === 'erreur' ? <><AlertCircle className="h-3.5 w-3.5" />Non enregistré</> : etat === 'attente' ? <><CloudOff className="h-3.5 w-3.5 text-or" />Gardé sur l'appareil — envoyé au retour de la connexion</> : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Enregistré</>}
  </span>
}

/** Enregistrement automatique : appelle sauver(valeur) 1 s après la dernière modification. */
export function useAutoEnregistrement(valeur, reference, sauver) {
  const [etat, setEtat] = useState('')
  const dernier = useRef(JSON.stringify(reference))
  useEffect(() => { dernier.current = JSON.stringify(reference) }, [reference])
  useEffect(() => {
    const v = JSON.stringify(valeur)
    if (valeur == null || v === dernier.current) return
    const t = setTimeout(async () => {
      setEtat('encours')
      try { await sauver(valeur); dernier.current = v; setEtat(fileAttente().length ? 'attente' : 'ok') } catch { setEtat('erreur') }
    }, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(valeur)])
  return etat
}

/** Interrupteur on/off (bouton, pas de case native). */
export function Interrupteur({ actif, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={actif} disabled={disabled} onClick={() => onChange(!actif)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${actif ? 'bg-or' : 'bg-nuit-100'} disabled:opacity-50`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${actif ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}
