// « Ma journée » : en haut de l'écran des tuiles, pour les prêtres (accès Liturgie ou Intentions de messe).
// Messes du jour et leurs intentions (avec « J'ai célébré »), office de l'heure, ce qui m'attend.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, Mail, PenLine, FolderHeart, Bell, Church, Clock } from 'lucide-react'
import { useApp } from '../App.jsx'
import { api, enCache } from '../api.js'
import { chargerCalendrier, jourLiturgique } from '../liturgie/calendrier.js'
import { COULEURS } from '../liturgie/ordo.js'
import { NOMS_HEURES, heureDuMoment } from '../liturgie/heures.js'
import { ZoneCelebration } from '../intentions/composants.jsx'
import { agendaEnCache, chargerAgenda, chargerIntentions, heureDe, heureFr, intentionDeLaMesse, intentionsEnCache, isoLocal, messesDuJour, typeMesse } from '../intentions/donnees.js'

export const voitMaJournee = (peut) => peut('liturgie') || peut('intentions')

export default function MaJournee() {
  const { peut, nonLues } = useApp()
  const nav = useNavigate()
  const auj = new Date()
  const iso = isoLocal(auj)
  const avecIntentions = peut('intentions'), avecLiturgie = peut('liturgie')
  const [, setCal] = useState(0)
  const [intentions, setIntentions] = useState(() => (avecIntentions ? intentionsEnCache() || null : null))
  const [agenda, setAgenda] = useState(() => (avecIntentions ? agendaEnCache(auj.getFullYear(), auj.getMonth()) || null : null))
  const [resume, setResume] = useState(() => enCache('journee.resume', {}) || null)
  useEffect(() => {
    chargerCalendrier().then(() => setCal((n) => n + 1))
    api('journee.resume').then(setResume).catch(() => {})
    if (!avecIntentions) return
    chargerIntentions().then(setIntentions).catch(() => setIntentions((l) => l || []))
    chargerAgenda(auj.getFullYear(), auj.getMonth()).then(setAgenda).catch(() => setAgenda((a) => a || []))
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  const maj = (r) => setIntentions((l) => l.map((x) => (x.id === r.id ? { ...x, ...r } : x)))

  const o = jourLiturgique(auj.getFullYear(), auj.getMonth() + 1, auj.getDate())
  const deja = new Set()
  const messes = avecIntentions && agenda && intentions ? messesDuJour(iso, agenda, intentions).map((e) => ({ e, it: intentionDeLaMesse(e, iso, intentions, deja) })) : null
  const heure = heureDuMoment(auj)
  const nomHeure = (NOMS_HEURES.find(([h]) => h === heure) || [])[1]

  const enAttente = (intentions || []).filter((i) => i.statut === 'en_attente' || i.en_edition).length
  const nonLuesN = resume?.nonLues ?? nonLues ?? 0
  const aTraiter = [
    resume?.mesMails ? { n: resume.mesMails, texte: resume.mesMails > 1 ? 'mails qui me sont attribués' : 'mail qui m\'est attribué', icone: Mail, aller: () => nav('/courrier?filtre=mes') } : null,
    resume?.aSigner ? { n: resume.aSigner, texte: resume.aSigner > 1 ? 'extraits de baptême à signer' : 'extrait de baptême à signer', icone: PenLine, aller: () => nav('/extraits') } : null,
    resume?.mesDossiers ? { n: resume.mesDossiers, texte: resume.mesDossiers > 1 ? 'dossiers ouverts dont je suis responsable' : 'dossier ouvert dont je suis responsable', icone: FolderHeart, aller: () => nav('/dossiers') } : null,
    enAttente ? { n: enAttente, texte: enAttente > 1 ? 'demandes d\'intention en attente' : 'demande d\'intention en attente', icone: Church, aller: () => nav('/intentions') } : null,
    nonLuesN ? { n: nonLuesN, texte: nonLuesN > 1 ? 'notifications non lues' : 'notification non lue', icone: Bell, aller: () => window.dispatchEvent(new Event('ouvrir-cloche')) } : null
  ].filter(Boolean)

  return (
    <section className="mt-6 grid items-start gap-3 sm:gap-4 lg:grid-cols-3" aria-label="Ma journée">
      {/* Fête du jour et messes */}
      <div className={`carte overflow-hidden ${avecIntentions ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
        <button className="flex w-full items-center gap-3 bg-nuit px-4 py-3 text-left text-white disabled:cursor-default" disabled={!avecLiturgie} onClick={() => nav(`/messe?date=${iso}`)}>
          <span className="h-3 w-3 shrink-0 rounded-full border border-white/40" style={{ background: COULEURS[o?.couleur] || '#ccc' }} title={o?.couleur} />
          <span className="min-w-0 flex-1"><span className="block text-[11px] uppercase tracking-wider text-white/55">Ma journée{o?.classe ? ' · ' + o.classe : ''}</span><span className="block font-titre text-lg font-semibold leading-tight">{o?.fete || ''}</span></span>
          {avecLiturgie && <BookOpen className="h-5 w-5 shrink-0 text-white/70" aria-label="Messe du jour" />}
        </button>
        {avecIntentions && (!messes ? <p className="px-4 py-3 text-sm text-nuit-600/70">Messes du jour…</p>
          : !messes.length ? <p className="px-4 py-3 text-sm text-nuit-600">Aucune messe aujourd'hui.</p> : (
          <ul className="divide-y divide-nuit-50">
            {messes.map(({ e, it }) => (
              <li key={e.id} className="px-4 py-2.5">
                <div className="flex items-start gap-3">
                  <span className="w-12 shrink-0 font-titre text-lg font-semibold tabular-nums text-nuit">{heureFr(heureDe(e))}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-wide text-nuit-600/70">{typeMesse(e)}</div>
                    <div className="font-medium leading-snug text-nuit">{it ? it.nom_intention : <span className="text-nuit-600/60">Pas d'intention</span>}</div>
                    {it?.nom_donateur && <div className="text-xs text-nuit-600">{it.nom_donateur}{it.statut !== 'valide' ? ' · en attente' : ''}</div>}
                  </div>
                </div>
                {it && <div className="ml-[3.75rem]"><ZoneCelebration intention={it} onMaj={maj} /></div>}
              </li>
            ))}
          </ul>
        ))}
      </div>

      <div className="grid content-start gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-1">
        {/* Office de l'heure */}
        {avecLiturgie && (
          <div className="carte p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-or-600"><Clock className="h-3.5 w-3.5" />Office de l'heure</div>
            <button className="flex w-full items-center gap-3 rounded-xl bg-or-50 px-3 py-2.5 text-left hover:bg-or-100" onClick={() => nav(`/breviaire?heure=${heure}`)}>
              <span className="flex-1 font-titre text-2xl font-semibold text-nuit">{nomHeure}</span><ChevronRight className="h-5 w-5 text-or-600" />
            </button>
            <div className="mt-2 flex flex-wrap gap-1">
              {NOMS_HEURES.filter(([h]) => h !== heure).map(([h, n]) => <button key={h} className="rounded-full border border-nuit-100 px-2.5 py-0.5 text-xs text-nuit-600 hover:border-or hover:text-or-600" onClick={() => nav(`/breviaire?heure=${h}`)}>{n}</button>)}
            </div>
          </div>
        )}
        {/* À traiter */}
        <div className="carte p-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-or-600">À traiter</div>
          {!aTraiter.length ? <p className="py-1 text-sm text-nuit-600">{resume ? 'Rien qui vous attende. 🙏' : '…'}</p> : (
            <div className="-mx-2">
              {aTraiter.map((x) => { const I = x.icone; return (
                <button key={x.texte} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-nuit-50/60" onClick={x.aller}>
                  <I className="h-4 w-4 shrink-0 text-nuit-600/60" /><span className="w-6 text-right font-titre text-xl font-semibold text-nuit">{x.n}</span><span className="flex-1 text-sm leading-snug text-nuit-700">{x.texte}</span><ChevronRight className="h-4 w-4 text-nuit-600/40" />
                </button>
              ) })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
