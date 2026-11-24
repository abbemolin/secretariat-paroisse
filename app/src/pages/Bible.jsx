import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bookmark, BookmarkPlus, ChevronLeft, ChevronRight, Library, Search, Trash2, X } from 'lucide-react'
import { CANON, LIVRES, chapitresDe, chargerMarques, commentairesDe, enregistrerMarques, estAT, lireReference, rechercher, reference, suivreBible, telechargerBible, versetsDe } from '../liturgie/bible.js'
import { Modale, useNotif } from '../ui.jsx'
import '../liturgie/liturgie.css'

const CLE_POSITION = 'bible-position'
const sansAccent = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const echapper = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Bible Crampon : livres, chapitres, commentaires des Évangiles, recherche, marque-pages ; toute la Bible hors ligne. */
export default function Bible() {
  const [params, setParams] = useSearchParams()
  const notifier = useNotif()
  const dernier = (() => { try { return JSON.parse(localStorage.getItem(CLE_POSITION) || 'null') } catch { return null } })()
  const livre = LIVRES.includes(params.get('livre')) ? params.get('livre') : dernier?.livre || null
  const chapitre = +params.get('chapitre') || (livre === dernier?.livre ? dernier?.chapitre : 1) || 1
  const versetCible = +params.get('verset') || null
  const versetFin = +params.get('fin') || versetCible

  const [onglet, setOnglet] = useState(livre && !estAT(livre) ? 'NT' : 'AT')
  const [livres, setLivres] = useState(!livre)
  const [chapitres, setChapitres] = useState([])
  const [versets, setVersets] = useState(null)
  const [comms, setComms] = useState({})
  const [comm, setComm] = useState(null)
  const [recherche, setRecherche] = useState(false)
  const [panneauMarques, setPanneauMarques] = useState(false)
  const [marques, setMarques] = useState([])
  const [choix, setChoix] = useState(null)   // verset touché
  const [etatHL, setEtatHL] = useState('')
  const zone = useRef(null)

  useEffect(() => { telechargerBible(); chargerMarques().then(setMarques) ; return suivreBible(setEtatHL) }, [])

  const aller = (l, c, v, f) => {
    const p = { livre: l, chapitre: c }
    if (v) p.verset = v
    if (f && f !== v) p.fin = f
    setParams(p)
    setLivres(false); setChoix(null)
  }

  useEffect(() => {
    if (!livre) return
    let annule = false
    setVersets(null); setComms({})
    try { localStorage.setItem(CLE_POSITION, JSON.stringify({ livre, chapitre })) } catch { /* ignore */ }
    chapitresDe(livre).then((l) => !annule && setChapitres(l)).catch(() => {})
    versetsDe(livre, chapitre).then((l) => !annule && setVersets(l)).catch(() => !annule && setVersets([]))
    commentairesDe(livre, chapitre).then((c) => !annule && setComms(c)).catch(() => {})
    return () => { annule = true }
  }, [livre, chapitre])

  // Verset demandé : amené au milieu de l'écran et éclairé
  useEffect(() => {
    if (!versets?.length || !versetCible) { zone.current?.closest('main')?.scrollTo({ top: 0 }); return }
    const el = zone.current?.querySelector(`[data-v="${versetCible}"]`)
    const main = zone.current?.closest('main')
    if (el && main) setTimeout(() => {
      const b = el.getBoundingClientRect(), m = main.getBoundingClientRect()
      main.scrollTo({ top: main.scrollTop + b.top - m.top - m.height / 3, behavior: 'smooth' })
    }, 80)
  }, [versets, versetCible])

  const max = chapitres.length ? Math.max(...chapitres) : chapitre
  const changerChapitre = (n) => { const c = chapitre + n; if (c >= 1 && c <= max) aller(livre, c) }

  // Glisser le doigt : chapitre suivant ou précédent
  const tactile = useRef(null)
  const debut = (e) => { if (e.touches.length === 1) tactile.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } }
  const fin = (e) => {
    const t = tactile.current; tactile.current = null
    if (!t) return
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) < 72 || Math.abs(dy) > 100 || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - t.t > 800) return
    changerChapitre(dx < 0 ? 1 : -1)
  }

  // Marque-pages
  const marquesIci = marques.filter((m) => m.livre === livre && m.chapitre === chapitre)
  async function sauverMarques(l, message) {
    setMarques(l)
    try { setMarques(await enregistrerMarques(l)); if (message) notifier(message) } catch (e) { notifier(e.message, 'erreur') }
  }
  const ajouterMarque = (v) => sauverMarques([{ id: 'm' + Date.now(), livre, chapitre, verset: v || null, note: '', date: new Date().toISOString().slice(0, 10) }, ...marques], 'Marque-page ajouté')
  const retirerMarque = (id) => sauverMarques(marques.filter((m) => m.id !== id))

  return (
    <div className="liturgie">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-clair" onClick={() => setLivres(!livres)}><Library className="h-4 w-4" />Livres</button>
        {livre && (
          <div className="flex items-center gap-1">
            <button className="btn-icone" disabled={chapitre <= 1} onClick={() => changerChapitre(-1)} aria-label="Chapitre précédent"><ChevronLeft className="h-5 w-5" /></button>
            <select className="champ w-auto py-1.5" value={chapitre} onChange={(e) => aller(livre, +e.target.value)} aria-label="Chapitre">
              {(chapitres.length ? chapitres : [chapitre]).map((c) => <option key={c} value={c}>Chapitre {c}</option>)}
            </select>
            <button className="btn-icone" disabled={chapitre >= max} onClick={() => changerChapitre(1)} aria-label="Chapitre suivant"><ChevronRight className="h-5 w-5" /></button>
          </div>
        )}
        <div className="flex-1" />
        <button className="btn-icone" onClick={() => setRecherche(true)} aria-label="Rechercher" title="Rechercher"><Search className="h-5 w-5" /></button>
        <button className="btn-icone relative" onClick={() => setPanneauMarques(true)} aria-label="Marque-pages" title="Marque-pages">
          <Bookmark className="h-5 w-5" />{marques.length > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-or px-1 text-[10px] font-bold text-white">{marques.length}</span>}
        </button>
      </div>

      {livres && (
        <div className="carte mt-3 p-4">
          <div className="mb-3 flex gap-1">
            {['AT', 'NT'].map((o) => <button key={o} onClick={() => setOnglet(o)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${onglet === o ? 'bg-nuit text-white' : 'text-nuit-600 hover:bg-nuit-50'}`}>{o === 'AT' ? 'Ancien Testament' : 'Nouveau Testament'}</button>)}
          </div>
          {Object.entries(CANON[onglet]).map(([groupe, l]) => (
            <div key={groupe} className="mb-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-or-600">{groupe}</div>
              <div className="flex flex-wrap gap-1.5">
                {l.map((x) => <button key={x} onClick={() => aller(x, 1)} className={`rounded-lg border px-2.5 py-1 text-sm ${x === livre ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 text-nuit-700 hover:bg-nuit-50'}`}>{x}</button>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {livre && (
        <article ref={zone} className="carte mt-3 px-5 py-6 sm:px-10" onTouchStart={debut} onTouchEnd={fin}>
          <h1 className="text-center text-3xl font-semibold text-nuit">{livre} {chapitre}</h1>
          <div className="mb-5 mt-1 text-center text-sm tracking-[.5em] text-or">✦✦✦</div>
          {!versets ? <p className="brev-loading">Chargement…</p> : !versets.length ? <p className="brev-empty">Chapitre non disponible.</p> : (
            <div className="bible-texte">
              {versets.map((v) => {
                const eclaire = versetCible && v.n >= versetCible && v.n <= versetFin
                const marque = marquesIci.some((m) => m.verset === v.n)
                return (
                  <span key={v.n}>
                    {v.n > 1 && v.n % 8 === 1 && <><br /><br /></>}
                    <span data-v={v.n} className={`verset ${eclaire ? 'eclaire' : ''} ${marque ? 'marque' : ''}`} onClick={() => setChoix(choix === v.n ? null : v.n)}>
                      <sup className="verset-num">{v.n}</sup>{v.texte}
                    </span>
                    {comms[v.n] && <button className="btn-comm" onClick={() => setComm(v.n)} title="Commentaire">💬</button>}
                    {choix === v.n && (
                      <span className="mx-1 inline-flex items-center gap-1 align-middle font-sans text-xs">
                        <button className="rounded-full bg-nuit px-2 py-0.5 text-white" onClick={() => { ajouterMarque(v.n); setChoix(null) }}><BookmarkPlus className="inline h-3.5 w-3.5" /> Marque-page</button>
                      </span>
                    )}{' '}
                  </span>
                )
              })}
            </div>
          )}
          <div className="mt-6 flex items-center justify-between text-sm">
            <button className="btn btn-clair" disabled={chapitre <= 1} onClick={() => changerChapitre(-1)}><ChevronLeft className="h-4 w-4" />{chapitre > 1 ? `${livre} ${chapitre - 1}` : ''}</button>
            <button className="btn btn-clair" onClick={() => ajouterMarque(null)} title="Marque-page sur ce chapitre"><BookmarkPlus className="h-4 w-4" /></button>
            <button className="btn btn-clair" disabled={chapitre >= max} onClick={() => changerChapitre(1)}>{chapitre < max ? `${livre} ${chapitre + 1}` : ''}<ChevronRight className="h-4 w-4" /></button>
          </div>
        </article>
      )}
      {etatHL && <p className="mt-3 text-center text-xs text-nuit-600/70">{etatHL}</p>}

      {comm && <Modale titre={`${livre} ${chapitre}, ${comm}`} onFermer={() => setComm(null)}><div className="whitespace-pre-line font-titre text-lg leading-relaxed">{comms[comm]}</div></Modale>}
      {recherche && <Recherche onFermer={() => setRecherche(false)} onOuvrir={(r) => { setRecherche(false); setOnglet(estAT(r.livre) ? 'AT' : 'NT'); aller(r.livre, r.chapitre, r.verset_num) }} />}
      {panneauMarques && (
        <Modale titre="Marque-pages" onFermer={() => setPanneauMarques(false)}>
          {!marques.length ? <p className="text-sm text-nuit-600">Aucun marque-page. Touchez un verset, puis « Marque-page ».</p> : (
            <ul className="divide-y divide-nuit-50">
              {marques.map((m) => (
                <li key={m.id} className="flex items-center gap-2 py-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => { setPanneauMarques(false); setOnglet(estAT(m.livre) ? 'AT' : 'NT'); aller(m.livre, m.chapitre, m.verset) }}>
                    <div className="font-medium text-nuit">{m.livre} {m.chapitre}{m.verset ? ', ' + m.verset : ''}</div>
                    <input className="champ mt-1 py-1 text-xs" placeholder="Note (facultatif)" defaultValue={m.note} onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => { if (e.target.value !== m.note) sauverMarques(marques.map((x) => (x.id === m.id ? { ...x, note: e.target.value } : x))) }} />
                  </button>
                  <button className="btn-icone" onClick={() => retirerMarque(m.id)} aria-label="Retirer"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </Modale>
      )}
    </div>
  )
}

function Recherche({ onFermer, onOuvrir }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [indice, setIndice] = useState('Entrez une référence (Mt 5, 3) ou des mots')
  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) { setRes(null); setIndice('Entrez une référence (Mt 5, 3) ou des mots'); return }
    let annule = false
    const minuteur = setTimeout(async () => {
      setRes('charge')
      const ref = /\d/.test(t) ? lireReference(t) : null
      try {
        if (ref) {
          setIndice(`Référence : ${ref.livre} ${ref.chapitre}${ref.verset ? ', ' + ref.verset : ''}`)
          const l = await reference(ref.livre, ref.chapitre, ref.verset)
          if (!annule) setRes(l.map((r) => ({ ...r, estRef: true })))
        } else {
          setIndice(`Recherche dans le texte : « ${t} »`)
          const l = await rechercher(t)
          if (!annule) setRes(l)
        }
      } catch { if (!annule) setRes([]) }
    }, 350)
    return () => { annule = true; clearTimeout(minuteur) }
  }, [q])
  const surligner = (texte) => {
    const cible = sansAccent(q.trim())
    if (!cible) return texte
    const brut = sansAccent(texte)
    const i = brut.search(new RegExp(echapper(cible)))
    if (i < 0) return texte
    return <>{texte.slice(0, i)}<mark className="bg-or-100">{texte.slice(i, i + cible.length)}</mark>{texte.slice(i + cible.length)}</>
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-nuit-800/40 p-3 pt-[8vh]" onClick={onFermer}>
      <div className="carte flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-nuit-50 p-3">
          <Search className="h-5 w-5 text-nuit-600" />
          <input autoFocus className="flex-1 bg-transparent text-base outline-none" placeholder="Mt 5, 3 — ou — miséricorde…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && onFermer()} />
          <button className="btn-icone" onClick={onFermer} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-4 py-1.5 text-xs text-nuit-600/80">{indice}</div>
        <div className="flex-1 overflow-y-auto">
          {res === 'charge' ? <p className="p-4 text-sm text-nuit-600">Recherche…</p>
            : res && !res.length ? <p className="p-4 text-sm text-nuit-600">Aucun résultat trouvé.</p>
              : res && <>
                <div className="px-4 pb-1 text-xs text-nuit-600/70">{res.length} résultat{res.length > 1 ? 's' : ''}</div>
                {res.map((r, i) => (
                  <button key={i} className="block w-full border-t border-nuit-50 px-4 py-2.5 text-left hover:bg-nuit-50/60" onClick={() => onOuvrir(r)}>
                    <div className="text-xs font-semibold text-or-600">{r.livre} {r.chapitre}, {r.verset_num}</div>
                    <div className="font-titre text-lg leading-snug text-nuit-800">{r.estRef ? r.texte : surligner(r.texte)}</div>
                  </button>
                ))}
              </>}
        </div>
      </div>
    </div>
  )
}
