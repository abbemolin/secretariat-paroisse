import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, FolderHeart, HeartHandshake, GraduationCap, ScrollText, Mountain, CornerDownLeft } from 'lucide-react'
import { api } from '../api.js'

const ICONES = { dossiers: FolderHeart, cor: HeartHandshake, cate: GraduationCap, extraits: ScrollText, retraites: Mountain }

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
          <Search className="h-4 w-4" /><span className="flex-1">Rechercher…</span><kbd className="rounded bg-white/10 px-1.5 text-[10px]">{mac ? '⌘' : 'Ctrl'} K</kbd></button>}
    {ouvert && <Recherche onFermer={() => setOuvert(false)} />}
  </>
}

function Recherche({ onFermer }) {
  const nav = useNavigate()
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
      try { const r = await api('recherche', { q }); if (dernier.current === q) { setRes(r.groupes); setSel(0) } } catch { if (dernier.current === q) setRes([]) } finally { if (dernier.current === q) setCharge(false) }
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
          {charge ? <Loader2 className="h-5 w-5 animate-spin text-or" /> : <Search className="h-5 w-5 text-nuit-600/50" />}
          <input ref={champ} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={clavier} placeholder="Nom, prénom, e-mail, téléphone…" className="flex-1 border-0 bg-transparent py-4 text-base outline-none" />
          <button onClick={onFermer} className="rounded border border-nuit-100 px-1.5 text-[11px] text-nuit-600/60">Échap</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {res === null ? <p className="px-3 py-6 text-center text-sm text-nuit-600/60">Dossiers, fiches Cor Unum, catéchisme, extraits de baptême, retraites.</p>
            : !res.length ? <p className="px-3 py-6 text-center text-sm text-nuit-600/60">{charge ? 'Recherche…' : 'Aucun résultat.'}</p>
            : res.map((g) => {
              const I = ICONES[g.cle] || Search
              return (
                <div key={g.cle} className="mb-1">
                  <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-or-600"><I className="h-3.5 w-3.5" />{g.titre}{g.total > g.items.length && <span className="font-normal normal-case text-nuit-600/50">· {g.items.length} sur {g.total}</span>}</div>
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
