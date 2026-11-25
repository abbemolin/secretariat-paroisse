import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, FolderHeart, HeartHandshake, GraduationCap, ScrollText, Mountain, CornerDownLeft, Church, Megaphone, BookOpenText, Sun } from 'lucide-react'
import { api } from '../api.js'
import { useApp } from '../App.jsx'
import { chargerCalendrier, jourLiturgique } from '../liturgie/calendrier.js'

const ICONES = { dossiers: FolderHeart, cor: HeartHandshake, cate: GraduationCap, extraits: ScrollText, retraites: Mountain, intentions: Church, annonces: Megaphone, bible: BookOpenText, fetes: Sun }
const sa = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const deux = (n) => String(n).padStart(2, '0')

/** Fêtes du calendrier (« Odile », « Assomption ») : les prochaines dates sur deux ans. */
async function chercherFetes(q) {
  await chargerCalendrier()
  const mots = sa(q).split(/\s+/).filter(Boolean), vus = new Set(), items = []
  const d = new Date(); d.setHours(12, 0, 0, 0)
  for (let i = 0; i < 731 && items.length < 8; i++, d.setDate(d.getDate() + 1)) {
    const j = jourLiturgique(d.getFullYear(), d.getMonth() + 1, d.getDate())
    const texte = [j?.fete, j?.commemoration, j?.romain].filter(Boolean).join(' ')
    if (!j || !mots.every((m) => sa(texte).includes(m))) continue
    const iso = `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
    if (vus.has(j.fete)) continue
    vus.add(j.fete)
    items.push({ titre: j.fete, sous: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + (j.classe ? ' · ' + j.classe : ''), lien: `/ordo?jour=${iso}` })
  }
  return items.length ? [{ cle: 'fetes', titre: 'Fêtes du calendrier', total: items.length, items }] : []
}

/** Bible : une référence (« Mt 5, 3 », « 1 Co 13 ») ou des mots (4 lettres au moins). */
async function chercherBible(q) {
  const { lireReference, rechercher, versetsDe } = await import('../liturgie/bible.js')
  const r = lireReference(q)
  if (r) {
    let texte = ''
    try { const v = await versetsDe(r.livre, r.chapitre); texte = (r.verset ? v.find((x) => x.n === r.verset) : v[0])?.texte || '' } catch { /* hors ligne */ }
    const ref = `${r.livre} ${r.chapitre}${r.verset ? ', ' + r.verset + (r.fin && r.fin !== r.verset ? '-' + r.fin : '') : ''}`
    return [{ cle: 'bible', titre: 'Bible', total: 1, items: [{ titre: ref, sous: texte, lien: `/bible?livre=${encodeURIComponent(r.livre)}&chapitre=${r.chapitre}${r.verset ? '&verset=' + r.verset : ''}${r.fin ? '&fin=' + r.fin : ''}` }] }]
  }
  if (q.trim().length < 4) return []
  // Mot entier au début (« odile » ne ramène pas « crocodile »)
  const debutMot = new RegExp('(^|[^a-z0-9])' + sa(q.trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const l = (await rechercher(q.trim()).catch(() => []) || []).filter((v) => debutMot.test(sa(v.texte)))
  if (!l.length) return []
  return [{ cle: 'bible', titre: 'Passages de la Bible', total: l.length, items: l.slice(0, 8).map((v) => ({ titre: `${v.livre} ${v.chapitre}, ${v.verset_num}`, sous: v.texte, lien: `/bible?livre=${encodeURIComponent(v.livre)}&chapitre=${v.chapitre}&verset=${v.verset_num}` })) }]
}

/** Champ « Rechercher… » du menu ; ouvre la recherche globale (aussi avec Ctrl+K / ⌘K). */
export function BoutonRecherche({ mobile }) {
  const [ouvert, setOuvert] = useState(false)
  useEffect(() => {
    const f = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOuvert(true) } }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  }, [])
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  return <>
    {mobile
      ? <button onClick={() => setOuvert(true)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Rechercher"><Search className="h-6 w-6" /></button>
      : <button onClick={() => setOuvert(true)} className="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-left text-sm text-white/60 hover:bg-white/15">
          <Search className="h-4 w-4" /><span className="flex-1">Rechercher…</span><kbd className="rounded bg-white/10 px-1.5 text-xs">{mac ? '⌘' : 'Ctrl'} K</kbd></button>}
    {ouvert && <Recherche onFermer={() => setOuvert(false)} />}
  </>
}

function Recherche({ onFermer }) {
  const nav = useNavigate()
  const { peut } = useApp()
  const liturgie = peut('liturgie')
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [charge, setCharge] = useState(false)
  const [sel, setSel] = useState(0)
  const champ = useRef(null), dernier = useRef('')
  useEffect(() => { champ.current?.focus() }, [])
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return }
    const t = setTimeout(async () => {
      dernier.current = q; setCharge(true)
      // Le serveur (dossiers, intentions, annonces…) et, sur l'appareil, la Bible et le calendrier liturgique
      const [serveur, bible, fetes] = await Promise.all([
        api('recherche', { q }).then((r) => r.groupes).catch(() => []),
        liturgie ? chercherBible(q).catch(() => []) : [],
        liturgie ? chercherFetes(q).catch(() => []) : []
      ])
      if (dernier.current === q) { setRes([...serveur, ...fetes, ...bible]); setSel(0); setCharge(false) }
    }, 280)
    return () => clearTimeout(t)
  }, [q])
  const plats = (res || []).flatMap((g) => g.items.map((x) => ({ ...x, groupe: g.cle })))
  const aller = (x) => { onFermer(); nav(x.lien) }
  function clavier(e) {
    if (e.key === 'Escape') onFermer()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, plats.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && plats[sel]) aller(plats[sel])
  }
  useEffect(() => { document.getElementById('rg-' + sel)?.scrollIntoView({ block: 'nearest' }) }, [sel])
  let n = -1
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-nuit/40 p-3 pt-[8vh] backdrop-blur-sm sm:pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onFermer() }}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white text-nuit shadow-2xl animate-entree">
        <div className="flex items-center gap-3 border-b border-nuit-100 px-4">
          {charge ? <Loader2 className="h-5 w-5 animate-spin text-or" /> : <Search className="h-5 w-5 text-nuit-600/75" />}
          <input ref={champ} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={clavier} placeholder={liturgie ? 'Nom, intention, fête, passage (Mt 5, 3)…' : 'Nom, prénom, e-mail, téléphone…'} className="flex-1 border-0 bg-transparent py-4 text-base outline-none" />
          <button onClick={onFermer} className="rounded border border-nuit-100 px-1.5 text-xs text-nuit-600/75">Échap</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {res === null ? <p className="px-3 py-6 text-center text-sm text-nuit-600/75">{[peut('dossiers') && 'Dossiers, Cor Unum, catéchisme, extraits, retraites', peut('intentions') && 'intentions de messe', peut('annonces') && 'annonces', liturgie && 'fêtes du calendrier, passages de la Bible'].filter(Boolean).join(' · ')}.</p>
            : !res.length ? <p className="px-3 py-6 text-center text-sm text-nuit-600/75">{charge ? 'Recherche…' : 'Aucun résultat.'}</p>
            : res.map((g) => {
              const I = ICONES[g.cle] || Search
              return (
                <div key={g.cle} className="mb-1">
                  <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-or-600"><I className="h-3.5 w-3.5" />{g.titre}{g.total > g.items.length && <span className="font-normal normal-case text-nuit-600/75">· {g.items.length} sur {g.total}</span>}</div>
                  {g.items.map((x) => { n++; const k = n; return (
                    <button key={x.lien + k} id={'rg-' + k} onMouseEnter={() => setSel(k)} onClick={() => aller(x)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${sel === k ? 'bg-or-50' : ''}`}>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{x.titre}</span><span className="block truncate text-xs text-nuit-600/70">{x.sous}</span></span>
                      {sel === k && <CornerDownLeft className="h-4 w-4 text-nuit-600/40" />}
                    </button>
                  ) })}
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
