// Actions groupées : cases à cocher dans les listes, barre d'actions en bas, récapitulatif avant d'agir,
// « Annuler » pendant 10 secondes pour ce qui ne part pas à l'extérieur (mails, signatures, registres : confirmés puis faits).
import { useState } from 'react'
import { CheckSquare, X } from 'lucide-react'
import { useConfirmer, useDifferer, useNotif } from './ui.jsx'

/** sel : null (pas de sélection) ou Set d'identifiants. */
export function useSelection() {
  const [sel, setSel] = useState(null)
  return {
    sel, actif: !!sel, n: sel ? sel.size : 0, a: (id) => !!sel && sel.has(id),
    commencer: () => setSel(new Set()), quitter: () => setSel(null), vider: () => setSel(new Set()),
    basculer: (id) => setSel((s) => { const x = new Set(s || []); if (x.has(id)) x.delete(id); else x.add(id); return x }),
    choisir: (ids) => setSel(new Set(ids)), ids: () => [...(sel || [])]
  }
}

/** Bouton qui fait apparaître les cases. */
export function BoutonSelection({ s, className = 'btn-clair' }) {
  return <button className={s.actif ? 'btn-principal' : className} onClick={s.actif ? s.quitter : s.commencer}><CheckSquare className="h-4 w-4" /><span className="hidden sm:inline">{s.actif ? 'Terminer la sélection' : 'Sélectionner'}</span></button>
}

/** Case à cocher d'une ligne (à mettre au début de la ligne quand la sélection est active). */
export function Case({ s, id, nom, disabled, title }) {
  if (!s.actif) return null
  return <input type="checkbox" className="h-4 w-4 shrink-0 accent-[#521a22]" checked={s.a(id)} disabled={disabled} title={title}
    aria-label={`Choisir ${nom || ''}`} onClick={(e) => e.stopPropagation()} onChange={() => s.basculer(id)} />
}

/** Barre d'actions (en bas de l'écran). tous : ids de la liste affichée (filtrée) ; raccourcis : [[libellé, ids]] */
export function BarreSelection({ s, tous, raccourcis = [], children }) {
  if (!s.actif) return null
  return (
    <div className="sticky bottom-20 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-or/40 bg-white px-3 py-2 text-sm shadow-lg md:bottom-4">
      <button className="rounded-lg p-1 text-nuit-600 hover:bg-nuit-50" title="Quitter la sélection" onClick={s.quitter}><X className="h-4 w-4" /></button>
      <span className="font-medium">{s.n} sélectionné{s.n > 1 ? 's' : ''}</span>
      <button className="text-xs text-or-600 underline" onClick={() => s.choisir(tous)}>Tout sélectionner ({tous.length})</button>
      {raccourcis.filter(([, ids]) => ids.length).map(([l, ids]) => <button key={l} className="text-xs text-or-600 underline" onClick={() => s.choisir(ids)}>{l} ({ids.length})</button>)}
      {s.n > 0 && <button className="text-xs text-nuit-600 underline" onClick={s.vider}>Tout décocher</button>}
      {s.n > 0 && <span className="ml-auto flex flex-wrap items-center gap-2">{children}</span>}
    </div>
  )
}

/** Menu déroulant d'actions dans la barre (choix → action). */
export function MenuAction({ libelle, choix, onChoix, disabled }) {
  return (
    <select className="champ w-auto py-1.5 text-xs" value="" disabled={disabled} onChange={(e) => { const c = choix.find((x) => String(x[0]) === e.target.value); if (c) onChoix(c[0], c[1]) }}>
      <option value="">{libelle}</option>{choix.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

/** Compte rendu : « 12 faits · 2 non traités : … ». */
export function texteRapport(r, verbe = 'fait') {
  const ig = r?.ignores || []
  return `${r?.faits ?? 0} ${verbe}${(r?.faits ?? 0) > 1 ? 's' : ''}` + (ig.length ? ` · ${ig.length} non traité${ig.length > 1 ? 's' : ''} : ` + ig.slice(0, 4).map((x) => `${x.nom} (${x.raison})`).join(', ') + (ig.length > 4 ? '…' : '') : '')
}

/**
 * const lancer = useActionGroupee()
 * lancer({ titre, texte, bouton, executer, appliquer, annuler, externe, verbe, apres })
 * - toujours un récapitulatif ;
 * - externe (mail, signature, registre) : fait tout de suite, compte rendu ;
 * - sinon : appliquer() montre le résultat, l'envoi part après 10 s sauf « Annuler » (annuler() remet l'affichage).
 */
export function useActionGroupee() {
  const confirmer = useConfirmer()
  const differer = useDifferer()
  const notifier = useNotif()
  return async function lancer({ titre, texte, bouton = 'Appliquer', danger, executer, appliquer, annuler, externe, verbe, apres }) {
    if (!(await confirmer({ titre, texte, bouton, danger }))) return
    const fin = (r) => { const ig = r?.ignores?.length; notifier(texteRapport(r, verbe), ig ? 'erreur' : undefined); if (apres) apres(r) }
    if (externe) {
      try { fin(await executer()) } catch (e) { notifier(e.message, 'erreur') }
      return
    }
    if (appliquer) appliquer()
    differer(titre, async () => fin(await executer()), { delai: 10000, onAnnule: () => { if (annuler) annuler() }, onErreur: (e) => { notifier(e.message, 'erreur'); if (annuler) annuler() } })
  }
}
