import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarRange, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'
import { api } from '../api.js'
import { useApp } from '../App.jsx'
import { useNotif } from '../ui.jsx'
import { chargerCalendrier } from '../liturgie/calendrier.js'
import { CLASSE_COURTE, COULEURS, details, joursDuMois } from '../liturgie/ordo.js'
import { construireSemaine, decalerSemaine, lundiDe } from '../annonces/semaine.js'
import BoutonSombre from '../liturgie/BoutonSombre.jsx'
import '../liturgie/liturgie.css'

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const deux = (n) => String(n).padStart(2, '0')

/** Messes de l'agenda et intentions, par jour (AAAA-MM-JJ → [{ heure, label }]). */
function messesParJour(annee, mois, evenements, intentions) {
  const res = {}
  let lundi = lundiDe(new Date(annee, mois - 1, 1))
  const fin = `${annee}-${deux(mois)}-${deux(new Date(annee, mois, 0).getDate())}`
  while (lundi <= fin) {
    construireSemaine(lundi, evenements, intentions).forEach((j) => { res[j.iso] = j.horaires.filter((h) => h.bold) })
    lundi = decalerSemaine(lundi, 1)
  }
  return res
}

/** Ordo liturgique : un mois, jour par jour, comme un ordo imprimé ; PDF du mois. */
export default function Ordo() {
  const { peut } = useApp()
  const notifier = useNotif()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const auj = new Date()
  const [annee, mois] = /^\d{4}-\d{2}$/.test(params.get('mois') || '') ? params.get('mois').split('-').map(Number) : [auj.getFullYear(), auj.getMonth() + 1]
  const [cal, setCal] = useState(0)
  const [det, setDet] = useState({})
  const [messes, setMesses] = useState(null)
  const [choix, setChoix] = useState(null)
  const [pdf, setPdf] = useState(false)
  const isoAuj = `${auj.getFullYear()}-${deux(auj.getMonth() + 1)}-${deux(auj.getDate())}`
  const zone = useRef(null)

  useEffect(() => { chargerCalendrier().then(() => setCal((n) => n + 1)) }, [])
  const jours = useMemo(() => joursDuMois(annee, mois), [annee, mois, cal])   // eslint-disable-line react-hooks/exhaustive-deps

  // Détails (messe, Vêpres) lus jour par jour, 4 à la fois
  useEffect(() => {
    let annule = false
    setDet({})
    const file = jours.map((j) => j.iso)
    const ouvrier = async () => {
      while (file.length && !annule) {
        const iso = file.shift()
        const x = await details(iso)
        if (!annule) setDet((d) => ({ ...d, [iso]: x }))
      }
    }
    Promise.all([ouvrier(), ouvrier(), ouvrier(), ouvrier()])
    return () => { annule = true }
  }, [jours])

  // Messes de l'agenda et intentions du mois
  useEffect(() => {
    let annule = false
    setMesses(null)
    const debut = new Date(annee, mois - 1, 1), fin = new Date(annee, mois, 0, 23, 59, 59)
    api('liturgie.ordo', { debut: `${annee}-${deux(mois)}-01`, fin: `${annee}-${deux(mois)}-${deux(fin.getDate())}`, debutIso: debut.toISOString(), finIso: fin.toISOString() })
      .then((r) => !annule && setMesses(messesParJour(annee, mois, r.evenements, r.intentions)))
      .catch(() => !annule && setMesses({}))
    return () => { annule = true }
  }, [annee, mois])

  // Mois en cours : amené sur aujourd'hui
  useEffect(() => {
    const el = zone.current?.querySelector(`[data-jour="${isoAuj}"]`)
    const main = zone.current?.closest('main')
    if (el && main) setTimeout(() => main.scrollTo({ top: main.scrollTop + el.getBoundingClientRect().top - main.getBoundingClientRect().top - 90 }), 50)
  }, [annee, mois, isoAuj])

  const changerMois = (n) => { const d = new Date(annee, mois - 1 + n, 1); setParams({ mois: `${d.getFullYear()}-${deux(d.getMonth() + 1)}` }, { replace: true }); setChoix(null) }

  async function telechargerPdf() {
    setPdf(true)
    try {
      const manque = jours.filter((j) => !det[j.iso])
      const complets = { ...det }
      for (const j of manque) complets[j.iso] = await details(j.iso)
      const { pdfOrdo } = await import('../liturgie/ordoPdf.js')
      await pdfOrdo(annee, mois, jours, complets, messes || {})
    } catch (e) { notifier(e.message, 'erreur') } finally { setPdf(false) }
  }

  return (
    <div className="liturgie">
      <div className="sticky top-0 z-20 -mx-4 mb-3 flex items-center gap-1 bg-parchemin px-4 py-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <button className="btn-icone" onClick={() => changerMois(-1)} aria-label="Mois précédent"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="min-w-0 flex-1 truncate text-center text-2xl font-semibold capitalize text-nuit sm:flex-none sm:text-3xl"><span className="hidden sm:inline">Ordo · </span>{MOIS[mois - 1]} {annee}</h1>
        <button className="btn-icone" onClick={() => changerMois(1)} aria-label="Mois suivant"><ChevronRight className="h-5 w-5" /></button>
        <div className="hidden flex-1 sm:block" />
        <BoutonSombre />
        <button className="btn-icone" onClick={telechargerPdf} disabled={pdf} title="Télécharger le mois (PDF)" aria-label="Télécharger le mois (PDF)">{pdf ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}</button>
        {peut('liturgie') && <button className="btn-clair hidden py-1.5 sm:inline-flex" onClick={() => nav('/calendrier-propre')}><CalendarRange className="h-4 w-4" />Calendrier propre</button>}
        {peut('liturgie') && <button className="btn-icone sm:hidden" onClick={() => nav('/calendrier-propre')} title="Calendrier propre" aria-label="Calendrier propre"><CalendarRange className="h-5 w-5" /></button>}
      </div>

      <div ref={zone} className="carte divide-y divide-nuit-50 overflow-hidden">
        {jours.map((j) => {
          const x = det[j.iso]
          const m = messes?.[j.iso] || []
          const dimanche = j.dow === 0
          return (
            <div key={j.iso} data-jour={j.iso} className={`relative cursor-pointer px-3 py-2.5 hover:bg-nuit-50/40 sm:px-4 ${j.iso === isoAuj ? 'bg-or-50/60' : ''}`} onClick={() => setChoix(choix === j.iso ? null : j.iso)}>
              <div className="flex items-baseline gap-2.5">
                <span className="mt-1 h-3 w-3 shrink-0 self-start rounded-full border border-black/10" style={{ background: COULEURS[j.couleur] || '#ccc' }} title={j.couleur} />
                <span className={`w-14 shrink-0 text-sm tabular-nums ${dimanche ? 'font-semibold text-nuit' : 'text-nuit-600'}`}>{JOURS[j.dow]} {j.d}</span>
                <span className={`min-w-0 flex-1 font-titre text-lg leading-snug ${dimanche || j.classe === '1re classe' ? 'font-semibold' : ''} text-nuit`}>{j.fete}</span>
                <span className="shrink-0 text-xs text-nuit-600/80">{CLASSE_COURTE[j.classe] || j.classe}</span>
              </div>
              <div className="ml-[5.25rem] mt-0.5 space-y-0.5 text-[13px] leading-snug text-nuit-600">
                {x?.messe && <div>Messe : {[x.messe.gloria ? 'Gloria' : 'sans Gloria', x.messe.credo ? 'Credo' : null, x.messe.preface ? 'Préface ' + x.messe.preface : null].filter(Boolean).join(' · ')}</div>}
                {j.comm && <div className="italic">{j.comm}</div>}
                {x?.vepres && <div>{x.vepres}</div>}
                {!x && <div className="text-nuit-600/40">…</div>}
                {(j.obligation || j.actuelle || j.ancienne) && (
                  <div>{j.obligation && <span className="mr-2 font-semibold text-nuit">{j.obligation}</span>}
                    {j.actuelle && <span className="mr-2 font-medium text-[color:var(--rubric)]">{j.actuelle}</span>}
                    {j.ancienne && <span className="text-nuit-600/70">1962 : {j.ancienne}</span>}</div>
                )}
                {m.length > 0 && <div className="pt-0.5">{m.map((h, i) => <div key={i}><span className="tabular-nums text-nuit-700">{h.heure}</span> {h.label}</div>)}</div>}
              </div>
              {choix === j.iso && (
                <div className="ml-[5.25rem] mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-principal py-1.5 text-xs" onClick={() => nav(`/breviaire?date=${j.iso}`)}>Bréviaire de ce jour</button>
                  <button className="btn-clair py-1.5 text-xs" onClick={() => nav(`/messe?date=${j.iso}`)}>Messe de ce jour</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-center text-xs text-nuit-600/70">Couleur, rang, commémoraisons, messe et Vêpres : calculés par le moteur du bréviaire (rubriques 1960, calendrier propre). Pénitence : discipline actuelle en France ; « 1962 » : discipline de 1962, par dévotion.</p>
    </div>
  )
}
