import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight } from 'lucide-react'
import { useApp } from '../App.jsx'
import { Chargement, useNotif, pluriel } from '../ui.jsx'
import { chargerCalendrier, jourLiturgique } from '../liturgie/calendrier.js'
import { COULEURS } from '../liturgie/ordo.js'
import { ZoneCelebration } from '../intentions/composants.jsx'
import { agendaEnCache, chargerAgenda, chargerIntentions, dateCourte, dateLongue, heureDe, heureFr, intentionDeLaMesse, intentionsEnCache, isoLocal, messePassee, messesDuJour, sansAdresse, typeMesse } from '../intentions/donnees.js'

/** Aujourd'hui : fête du jour, messes du jour avec leurs intentions, ce qui reste à traiter. */
export default function IntentionsAujourdhui() {
  const { peut } = useApp()
  const notifier = useNotif()
  const nav = useNavigate()
  const auj = new Date()
  const iso = isoLocal(auj)
  const [intentions, setIntentions] = useState(() => intentionsEnCache() || null)
  const [agenda, setAgenda] = useState(() => agendaEnCache(auj.getFullYear(), auj.getMonth()) || null)
  const [, setCal] = useState(0)
  useEffect(() => {
    chargerCalendrier().then(() => setCal((n) => n + 1))
    chargerIntentions().then(setIntentions).catch((e) => !intentions && notifier(e.message, 'erreur'))
    chargerAgenda(auj.getFullYear(), auj.getMonth()).then(setAgenda).catch(() => setAgenda((a) => a || []))
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  const maj = (r) => setIntentions((l) => l.map((x) => (x.id === r.id ? { ...x, ...r } : x)))
  if (!intentions) return <Chargement />

  const o = jourLiturgique(auj.getFullYear(), auj.getMonth() + 1, auj.getDate())
  const deja = new Set()
  const messes = agenda ? messesDuJour(iso, agenda, intentions).map((e) => ({ e, it: intentionDeLaMesse(e, iso, intentions, deja) })) : null
  const enAttente = intentions.filter((i) => i.statut === 'en_attente' || i.en_edition)
  const aEnvoyer = intentions.filter((i) => i.statut === 'valide' && !i.mail_envoye && !sansAdresse(i))
  const nonCelebrees = intentions.filter((i) => i.statut === 'valide' && !i.celebrant && messePassee(i) && i.date_messe < iso)

  return (
    <div className="space-y-4">
      <div className="carte overflow-hidden">
        <div className="flex items-center gap-3 bg-nuit px-4 py-3 text-white">
          <span className="h-3 w-3 shrink-0 rounded-full border border-white/40" style={{ background: COULEURS[o?.couleur] || '#ccc' }} title={o?.couleur} />
          <div className="min-w-0 flex-1"><div className="text-xs text-white/60">{dateLongue(iso)}</div><div className="font-titre text-xl font-semibold leading-tight">{o?.fete || ''}</div></div>
          {peut('liturgie') && <button className="rounded-lg p-2 text-white/80 hover:bg-white/10" onClick={() => nav(`/messe?date=${iso}`)} title="Messe du jour"><BookOpen className="h-5 w-5" /></button>}
        </div>
        {!messes ? <Chargement /> : !messes.length ? <p className="px-4 py-4 text-sm text-nuit-600">Aucune messe aujourd'hui.</p> : (
          <ul className="divide-y divide-nuit-50">
            {messes.map(({ e, it }) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="w-14 shrink-0 font-titre text-xl font-semibold tabular-nums text-nuit">{heureFr(heureDe(e))}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wide text-nuit-600/70">{typeMesse(e)}</div>
                    <div className="font-medium text-nuit">{it ? it.nom_intention : <span className="text-nuit-600/75">Pas d'intention</span>}</div>
                    {it?.nom_donateur && <div className="text-sm text-nuit-600">{it.nom_donateur}{it.statut !== 'valide' ? ' · en attente' : ''}</div>}
                  </div>
                </div>
                {it && <div className="ml-[4.25rem]"><ZoneCelebration intention={it} onMaj={maj} /></div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="carte p-4">
        <h2 className="mb-2 text-xl font-semibold text-nuit">À traiter</h2>
        {!enAttente.length && !aEnvoyer.length && !nonCelebrees.length ? <p className="text-sm text-nuit-600">Rien à traiter. 🙏</p> : (
          <div className="space-y-1">
            <Ligne n={enAttente.length} texte={pluriel(enAttente.length, 'demande en attente de validation', 'demandes en attente de validation')} couleur="text-red-700" items={enAttente} onClic={(i) => nav(`/intentions/gerer?id=${i.id}`)} />
            <Ligne n={aEnvoyer.length} texte={pluriel(aEnvoyer.length, 'confirmation à envoyer', 'confirmations à envoyer')} couleur="text-or-600" items={aEnvoyer} onClic={(i) => nav(`/intentions/gerer?id=${i.id}`)} />
            <Ligne n={nonCelebrees.length} texte={pluriel(nonCelebrees.length, 'messe passée non déclarée célébrée', 'messes passées non déclarées célébrées')} couleur="text-nuit-700" items={nonCelebrees} onClic={() => nav('/intentions/gerer?filtre=non')} />
          </div>
        )}
      </div>
    </div>
  )
}

function Ligne({ n, texte, couleur, items, onClic }) {
  const [ouvert, setOuvert] = useState(false)
  if (!n) return null
  return (
    <div>
      <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-nuit-50/60" onClick={() => setOuvert(!ouvert)}>
        <span className={`w-8 text-right font-titre text-2xl font-semibold ${couleur}`}>{n}</span><span className="flex-1 text-sm text-nuit-700">{texte}</span><ChevronRight className={`h-4 w-4 transition ${ouvert ? 'rotate-90' : ''}`} />
      </button>
      {ouvert && <div className="ml-10 space-y-0.5 pb-1">{items.slice(0, 12).map((i) => <button key={i.id} className="flex w-full justify-between gap-2 text-left text-sm hover:underline" onClick={() => onClic(i)}><span className="truncate">{i.nom_intention}</span><span className="shrink-0 text-nuit-600">{dateCourte(i.date_messe)} {heureFr(i.heure_messe)}</span></button>)}</div>}
    </div>
  )
}
