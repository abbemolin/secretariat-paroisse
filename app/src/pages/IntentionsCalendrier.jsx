import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react'
import { useApp } from '../App.jsx'
import { Chargement, useNotif } from '../ui.jsx'
import { chargerCalendrier, jourLiturgique } from '../liturgie/calendrier.js'
import { COULEURS } from '../liturgie/ordo.js'
import { FicheIntention, ZoneCelebration } from '../intentions/composants.jsx'
import { MOIS, agendaEnCache, chargerAgenda, chargerIntentions, dateLongue, heureDe, heureFr, intentionDeLaMesse, intentionsEnCache, isoLocal, messesDuJour, typeMesse } from '../intentions/donnees.js'

const PASTILLE = { libre: 'bg-nuit-100', attente: 'bg-or', attrib: 'bg-emerald-600' }

/** Calendrier des intentions : reprise de calendrier.html d'AppMesse. */
export default function IntentionsCalendrier() {
  const { peut } = useApp()
  const notifier = useNotif()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const auj = isoLocal(new Date())
  const [jourSel, setJourSel] = useState(params.get('date') || auj)
  const [annee, mois0] = useMemo(() => { const d = new Date(jourSel + 'T12:00:00'); return [d.getFullYear(), d.getMonth()] }, [jourSel])
  const [intentions, setIntentions] = useState(() => intentionsEnCache() || null)
  const [agenda, setAgenda] = useState(() => agendaEnCache(annee, mois0) || null)
  const [fiche, setFiche] = useState(null)
  const [, setCal] = useState(0)
  const detail = useRef(null)

  useEffect(() => { chargerCalendrier().then(() => setCal((n) => n + 1)) }, [])
  const recharger = () => chargerIntentions().then(setIntentions).catch((e) => { if (!intentions) notifier(e.message, 'erreur') })
  useEffect(() => { recharger() }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let annule = false
    setAgenda(agendaEnCache(annee, mois0) || null)
    chargerAgenda(annee, mois0).then((a) => !annule && setAgenda(a)).catch(() => !annule && setAgenda((x) => x || []))
    return () => { annule = true }
  }, [annee, mois0])

  const choisir = (iso) => { setJourSel(iso); setParams({ date: iso }, { replace: true }); setTimeout(() => detail.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60) }
  const changerMois = (n) => { const d = new Date(annee, mois0 + n, 1); choisir(isoLocal(d)) }
  const maj = (r) => setIntentions((l) => { const i = l.findIndex((x) => x.id === r.id); if (i < 0) return [...l, r]; const c = [...l]; c[i] = { ...c[i], ...r }; return c })

  // Glisser le doigt : mois suivant ou précédent
  const tactile = useRef(null)
  const debut = (e) => { tactile.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const fin = (e) => { const t = tactile.current; tactile.current = null; if (!t) return; const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) changerMois(dx < 0 ? 1 : -1) }

  if (!intentions) return <Chargement />
  const nbJours = new Date(annee, mois0 + 1, 0).getDate()
  const decalage = (new Date(annee, mois0, 1).getDay() + 6) % 7
  const cases = [...Array(decalage).fill(null), ...Array.from({ length: nbJours }, (_, i) => isoLocal(new Date(annee, mois0, i + 1)))]

  const etatsDuJour = (iso) => {
    const deja = new Set()
    return messesDuJour(iso, agenda, intentions).map((e) => { const it = intentionDeLaMesse(e, iso, intentions, deja); return { e, it, etat: !it ? 'libre' : it.statut === 'valide' && !it.en_edition ? 'attrib' : 'attente' } })
  }
  const ordo = jourLiturgique(...jourSel.split('-').map(Number))
  const messes = etatsDuJour(jourSel)
  const maintenant = new Date()

  return (
    <div onTouchStart={debut} onTouchEnd={fin}>
      <div className="mb-3 flex items-center gap-1">
        <h1 className="flex-1 text-3xl font-semibold capitalize text-nuit">{MOIS[mois0]} {annee}</h1>
        <button className="btn-icone" onClick={() => changerMois(-1)} aria-label="Mois précédent"><ChevronLeft className="h-5 w-5" /></button>
        <button className="btn-icone" onClick={() => changerMois(1)} aria-label="Mois suivant"><ChevronRight className="h-5 w-5" /></button>
        <button className="btn-clair py-1.5 text-sm" onClick={() => choisir(auj)}>Aujourd'hui</button>
        <button className="btn-or py-1.5" onClick={() => setFiche({ titre: 'Nouvelle intention', initiale: { date_messe: jourSel, google_event_id: 'libre' } })} aria-label="Ajouter une intention"><Plus className="h-4 w-4" /></button>
      </div>

      <div className="carte overflow-hidden">
        <div className="grid grid-cols-7 border-b border-nuit-50 bg-nuit-50/50 text-center text-xs font-semibold text-nuit-600">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j, i) => <div key={i} className="py-1.5">{j}</div>)}</div>
        <div className="grid grid-cols-7">
          {cases.map((iso, k) => {
            if (!iso) return <div key={k} className="min-h-[58px] border-b border-r border-nuit-50/60 bg-nuit-50/20" />
            const d = new Date(iso + 'T12:00:00')
            const o = jourLiturgique(d.getFullYear(), d.getMonth() + 1, d.getDate())
            const etats = agenda ? etatsDuJour(iso) : []
            return (
              <button key={iso} onClick={() => choisir(iso)}
                className={`relative min-h-[58px] border-b border-r border-nuit-50/60 p-1 text-left transition hover:bg-nuit-50/50 ${iso === jourSel ? 'bg-or-50 ring-2 ring-inset ring-or' : ''}`}>
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${iso === auj ? 'bg-nuit font-semibold text-white' : d.getDay() === 0 ? 'font-semibold text-nuit' : 'text-nuit-700'}`}>{d.getDate()}</span>
                {o?.couleur && <span className="absolute right-1 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: COULEURS[o.couleur] }} title={o.couleur} />}
                <span className="mt-1 flex flex-wrap gap-0.5">{etats.map((x, i) => <span key={i} className={`h-2 w-2 rounded-full ${PASTILLE[x.etat]}`} />)}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-nuit-600"><span><span className={`mr-1 inline-block h-2 w-2 rounded-full ${PASTILLE.libre}`} />Libre</span><span><span className={`mr-1 inline-block h-2 w-2 rounded-full ${PASTILLE.attente}`} />En attente</span><span><span className={`mr-1 inline-block h-2 w-2 rounded-full ${PASTILLE.attrib}`} />Attribuée</span></div>

      <div ref={detail} className="carte mt-4 overflow-hidden">
        <div className="border-b border-nuit-50 px-4 py-3">
          <div className="font-titre text-xl font-semibold text-nuit">{dateLongue(jourSel)}</div>
          {ordo?.fete && <div className="mt-0.5 flex items-center gap-2 text-sm text-nuit-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COULEURS[ordo.couleur] || '#ccc' }} />{ordo.fete}</div>}
          {peut('liturgie') && <button className="btn-clair mt-2 py-1.5 text-sm" onClick={() => nav(`/messe?date=${jourSel}`)}><BookOpen className="h-4 w-4" />Propre de la Messe</button>}
        </div>
        {!agenda ? <Chargement /> : !messes.length ? <p className="px-4 py-4 text-sm text-nuit-600">Aucune messe ce jour.</p> : (
          <ul className="divide-y divide-nuit-50">
            {messes.map(({ e, it }) => {
              const h = heureDe(e)
              const passee = jourSel === isoLocal(maintenant) && maintenant.getHours() * 60 + maintenant.getMinutes() > +h.slice(0, 2) * 60 + +h.slice(3) + 30
              return (
                <li key={e.id + h} className={`px-4 py-3 ${passee ? 'opacity-70' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span className="w-14 shrink-0 font-titre text-xl font-semibold tabular-nums text-nuit">{heureFr(h)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs uppercase tracking-wide text-nuit-600/70">{typeMesse(e)}</div>
                      <div className="font-medium text-nuit">{it ? it.nom_intention : '—'}</div>
                      {it?.nom_donateur && <div className="text-sm text-nuit-600">{it.nom_donateur}</div>}
                      <div className="mt-0.5 text-xs">{!it ? <span className="text-nuit-600/70">● Libre</span> : it.statut === 'valide' && !it.en_edition ? <span className="text-emerald-700">● Attribuée</span> : <span className="text-or-600">● En attente</span>}{it?._enAttente ? ' · à envoyer' : ''}</div>
                    </div>
                    {!it ? <button className="btn-clair py-1.5 text-sm" onClick={() => setFiche({ titre: dateLongue(jourSel) + ' — ' + heureFr(h), initiale: { date_messe: jourSel, heure_messe: h, google_event_id: e.id, libre: false } })}><Plus className="h-4 w-4" />Intention</button>
                      : <button className="btn-clair py-1.5 text-sm" onClick={() => setFiche({ titre: 'Modifier — ' + dateLongue(it.date_messe), initiale: { ...it } })}><Pencil className="h-4 w-4" />Modifier</button>}
                  </div>
                  {it && <div className="ml-[4.25rem]"><ZoneCelebration intention={it} onMaj={maj} /></div>}
                </li>
              )
            })}
          </ul>
        )}
        <div className="border-t border-nuit-50 px-4 py-3">
          <button className="btn-clair w-full justify-center text-sm italic" onClick={() => setFiche({ titre: '+ Messe privée', initiale: { date_messe: jourSel, google_event_id: 'prive' } })}>+ Messe privée</button>
        </div>
      </div>

      {fiche && <FicheIntention titre={fiche.titre} initiale={fiche.initiale} onFermer={() => setFiche(null)} onEnregistree={(r) => { setFiche(null); maj(r); recharger() }} />}
    </div>
  )
}
