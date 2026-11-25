import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Mail, UserCheck, FolderHeart, CalendarDays, ChevronRight, Bell, ExternalLink, ListChecks, CheckCircle2, SlidersHorizontal, ArrowUp, ArrowDown } from 'lucide-react'
import { chargerAppMesse, CELEBRANTS, COULEURS_LITURGIQUES, LIEN_APPMESSE } from '../appmesse.js'
import { api } from '../api.js'
import { useApp, Espaces } from '../App.jsx'
import MaJournee, { voitMaJournee } from './MaJournee.jsx'
import { chargerCalendrier, jourLiturgique } from '../liturgie/calendrier.js'
import { COULEURS } from '../liturgie/ordo.js'
import { TYPES, prochaineEtape } from '../types.js'
import { Chargement, Erreur, Modale, useNotif, heure, jourLong, dateRelative, useCharger, pluriel } from '../ui.jsx'

// AppMESSE chargée une seule fois (en-tête + carte « Fête du jour »)
let promesseAppMesse = null
const appMesse = () => (promesseAppMesse ||= chargerAppMesse(7).catch((e) => { promesseAppMesse = null; throw e }))

const BLOCS = { chiffres: 'Chiffres (mails, dossiers, agenda)', afaire: 'À faire', fete: 'Intentions de messe', demandes: 'Nouvelles demandes et mes dossiers', notifications: 'Notifications', agenda: 'Les 7 prochains jours' }
const LARGES = ['chiffres', 'afaire', 'fete']

export default function Accueil() {
  const { utilisateur, peut } = useApp()
  const { data, chargement, erreur, recharger, setData } = useCharger(() => api('accueil.resume'), [], ['accueil.resume', {}])
  const [perso, setPerso] = useState(false)
  // Fête du jour : la même source que « Ma journée » et le bréviaire (ordo de la paroisse)
  const [, setCal] = useState(0)
  useEffect(() => { chargerCalendrier().then(() => setCal((n) => n + 1)).catch(() => {}) }, [])
  const auj = new Date()
  const fete = jourLiturgique(auj.getFullYear(), auj.getMonth() + 1, auj.getDate())
  const journee = voitMaJournee(peut)
  const salut = new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'
  const prefs = data?.blocs || { ordre: Object.keys(BLOCS), masques: [] }

  const rendus = {
    chiffres: () => (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {peut('mail') && <Tuile to="/courrier" icone={Mail} chiffre={data.mailsNonLus} libelle={pluriel(data.mailsNonLus, 'e-mail non lu', 'e-mails non lus')} />}
        {peut('mail') && <Tuile to="/courrier?filtre=mes" icone={UserCheck} chiffre={data.mesMails} libelle={pluriel(data.mesMails, 'mail qui m\'est attribué', 'mails qui me sont attribués')} accent={data.mesMails > 0} />}
        {peut('dossiers') && <Tuile to="/dossiers" icone={FolderHeart} chiffre={data.dossiersOuverts} libelle={pluriel(data.dossiersOuverts, 'dossier en cours', 'dossiers en cours')} />}
        {peut('agenda') && <Tuile to="/agenda" icone={CalendarDays} chiffre={data.evenements?.length} libelle={pluriel(data.evenements?.length, 'événement sur 7 jours', 'événements sur 7 jours')} />}
      </div>
    ),
    afaire: () => data.afaire && (
      <section className="carte p-5">
        <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold"><ListChecks className="h-5 w-5 text-or" />À faire</h2>
        {!data.afaire.length ? <p className="flex items-center gap-2 text-sm text-nuit-600/70"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Rien en attente. Bonne journée !</p> : (
          <ul className="divide-y divide-nuit-50">
            {data.afaire.map((x) => (
              <li key={x.cle}><Link to={x.lien} className="flex items-center gap-3 py-2.5 text-sm hover:text-or-600">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-or px-2 text-xs font-bold text-white">{x.nombre}</span>
                <span className="flex-1">{x.texte}</span><ChevronRight className="h-4 w-4 text-nuit-600/40" /></Link></li>
            ))}
          </ul>
        )}
      </section>
    ),
    fete: () => !journee && <FeteEtIntentions />,
    demandes: () => peut('dossiers') && (
      <section className="carte p-5">
        <Titre texte="Nouvelles demandes" lien="/dossiers" />
        <ListeDossiers liste={data.nouveaux} vide="Aucune nouvelle demande." />
        {data.mesDossiers?.length > 0 && <>
          <h3 className="mb-1 mt-5 text-lg font-semibold">Mes dossiers</h3>
          <ListeDossiers liste={data.mesDossiers} />
        </>}
      </section>
    ),
    notifications: () => data.notifications?.length > 0 && (
      <section className="carte p-5">
        <Titre texte="Notifications" />
        <ul className="divide-y divide-nuit-50">
          {data.notifications.slice(0, 5).map((n) => (
            <li key={n.id}><Link to={(n.lien || '#/').replace(/^#/, '')} className={`flex items-start gap-2 py-2 text-sm hover:text-or-600 ${n.lu ? 'opacity-60' : ''}`}>
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-or" /><div className="min-w-0 flex-1"><div className="font-medium">{n.titre}</div><div className="truncate text-xs text-nuit-600/70">{n.texte}</div></div>
              <span className="text-xs text-nuit-600/75">{dateRelative(n.date)}</span></Link></li>
          ))}
        </ul>
      </section>
    ),
    agenda: () => peut('agenda') && (
      <section className="carte p-5">
        <Titre texte="Les 7 prochains jours" lien="/agenda" />
        {!data.evenements?.length ? <p className="text-sm text-nuit-600/70">Rien de prévu.</p> : (
          <ul className="divide-y divide-nuit-50">
            {data.evenements.slice(0, 8).map((e) => (
              <li key={e.id + e.debut} className="flex gap-3 py-2 text-sm">
                <div className="w-28 shrink-0 text-nuit-600/80"><div className="text-xs first-letter:uppercase">{jourLong(e.debut).split(' ').slice(0, 3).join(' ')}</div><div className="font-medium text-nuit">{e.journee ? 'journée' : heure(e.debut)}</div></div>
                <div className="min-w-0 flex-1"><div className="font-medium">{e.titre}</div>{e.lieu && <div className="text-xs text-nuit-600/70">{e.lieu}</div>}</div>
                {e.dossier && <Link to={`/dossiers/${e.dossier}`} className="self-center text-xs text-or-600 hover:underline">dossier</Link>}
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  }
  // Les blocs larges prennent toute la largeur ; les autres se rangent deux par deux sur ordinateur
  const lignes = []
  if (data) prefs.ordre.filter((b) => !prefs.masques.includes(b)).forEach((b) => {
    const el = rendus[b]?.(); if (!el) return
    const dernier = lignes[lignes.length - 1]
    if (LARGES.includes(b)) lignes.push({ large: true, blocs: [[b, el]] })
    else if (dernier && !dernier.large && dernier.blocs.length < 2) dernier.blocs.push([b, el])
    else lignes.push({ large: false, blocs: [[b, el]] })
  })

  return (
    <>
      <div className="mb-5">
        <div className="flex items-start gap-2">
          <h1 className="min-w-0 flex-1 text-2xl font-semibold leading-tight sm:text-3xl">{salut}, {utilisateur.nom}</h1>
          <button className="btn-clair shrink-0 px-2 py-1.5" title="Personnaliser mon accueil" aria-label="Personnaliser mon accueil" onClick={() => setPerso(true)}><SlidersHorizontal className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-nuit-600/80">
          <span className="shrink-0 first-letter:uppercase sm:hidden">{new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <span className="hidden shrink-0 first-letter:uppercase sm:inline">{jourLong(new Date())}</span>
          {fete?.fete && <><span className="shrink-0">·</span><span className="h-2.5 w-2.5 shrink-0 rounded-full border border-nuit-100" style={{ background: COULEURS[fete.couleur] || '#ddd' }} title={`Couleur liturgique : ${fete.couleur}`} /><span className="truncate" title={fete.fete}>{fete.fete}</span></>}
        </p>
      </div>
      {/* Ma journée (prêtres) et « À traiter », puis les autres espaces de l'appli */}
      {journee && <div className="-mt-3 mb-5"><MaJournee /></div>}
      <div className="mb-5"><Espaces /></div>
      <Erreur erreur={erreur} reessayer={recharger} />
      {chargement && !data ? <Chargement /> : data && (
        <div className="space-y-5">
          {lignes.map((l, i) => l.large ? <div key={l.blocs[0][0]}>{l.blocs[0][1]}</div>
            : <div key={i} className={`grid gap-5 ${l.blocs.length > 1 ? 'lg:grid-cols-2' : ''} items-start`}>{l.blocs.map(([b, el]) => <div key={b}>{el}</div>)}</div>)}
          {!lignes.length && <p className="text-sm text-nuit-600/70">Tous les blocs sont masqués. « Personnaliser » pour en afficher.</p>}
        </div>
      )}
      {perso && <Personnaliser prefs={prefs} onFermer={() => setPerso(false)} onEnregistre={(b) => { setData((x) => ({ ...x, blocs: b })); setPerso(false) }} />}
    </>
  )
}

/** Choisir l'ordre des blocs de l'accueil et ceux à masquer (retenu pour l'utilisateur, sur tous ses appareils). */
function Personnaliser({ prefs, onFermer, onEnregistre }) {
  const notifier = useNotif()
  const [ordre, setOrdre] = useState(prefs.ordre)
  const [masques, setMasques] = useState(prefs.masques)
  const [envoi, setEnvoi] = useState(false)
  const bouger = (i, d) => { const o = [...ordre]; const [x] = o.splice(i, 1); o.splice(i + d, 0, x); setOrdre(o) }
  async function enregistrer() {
    setEnvoi(true)
    try { onEnregistre(await api('accueil.blocs', { ordre, masques })); notifier('Accueil personnalisé') } catch (e) { notifier(e.message, 'erreur'); setEnvoi(false) }
  }
  return (
    <Modale titre="Personnaliser mon accueil" onFermer={onFermer}
      pied={<><button className="btn-clair mr-auto" onClick={() => { setOrdre(Object.keys(BLOCS)); setMasques([]) }}>Rétablir</button><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={envoi} onClick={enregistrer}>Enregistrer</button></>}>
      <p className="mb-3 text-sm text-nuit-600">L'ordre et les blocs affichés sont retenus pour vous, sur tous vos appareils.</p>
      <ul className="divide-y divide-nuit-100 rounded-xl border border-nuit-100">
        {ordre.map((b, i) => (
          <li key={b} className="flex items-center gap-2 px-3 py-2">
            <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#521a22]" checked={!masques.includes(b)} onChange={(e) => setMasques(e.target.checked ? masques.filter((x) => x !== b) : [...masques, b])} />
              <span className={masques.includes(b) ? 'text-nuit-600/75 line-through' : ''}>{BLOCS[b]}</span></label>
            <button className="btn-clair px-2 py-1" disabled={i === 0} onClick={() => bouger(i, -1)} aria-label="Monter"><ArrowUp className="h-4 w-4" /></button>
            <button className="btn-clair px-2 py-1" disabled={i === ordre.length - 1} onClick={() => bouger(i, 1)} aria-label="Descendre"><ArrowDown className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
    </Modale>
  )
}

const Titre = ({ texte, lien }) => (
  <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">{texte}</h2>{lien && <Link to={lien} className="text-xs text-or-600 hover:underline">Tout voir</Link>}</div>
)

function ListeDossiers({ liste, vide }) {
  if (!liste?.length) return vide ? <p className="text-sm text-nuit-600/70">{vide}</p> : null
  return (
    <ul className="divide-y divide-nuit-50">
      {liste.map((d) => (
        <li key={d.id}><Link to={`/dossiers/${d.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-or-600">
          <span className="pastille text-white" style={{ background: TYPES[d.type].couleur }}>{TYPES[d.type].nom}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{d.nom}</span>
          <span className="hidden truncate text-xs text-nuit-600/75 sm:block">{prochaineEtape(d.type, d.etapes, d)?.label}</span>
          <ChevronRight className="h-4 w-4 text-nuit-600/40" />
        </Link></li>
      ))}
    </ul>
  )
}

function Tuile({ to, icone: I, chiffre, libelle, accent }) {
  return (
    <Link to={to} className={`carte flex items-center gap-3 p-4 transition hover:shadow-md ${accent ? 'ring-1 ring-or/50' : ''}`}>
      <div className={`rounded-lg p-2.5 ${accent ? 'bg-or-50 text-or-600' : 'bg-nuit-50 text-nuit'}`}><I className="h-5 w-5" /></div>
      <div><div className="font-titre text-3xl font-semibold leading-none">{chiffre ?? '—'}</div><div className="mt-1 text-xs text-nuit-600/70">{libelle}</div></div>
    </Link>
  )
}

const CLASSES = { I: '1re classe', II: '2e classe', III: '3e classe', IV: '4e classe' }

/** Carte AppMESSE : fête du jour (ordo) et intentions de messe (lecture seule). */
function FeteEtIntentions() {
  const [data, setData] = useState(null)
  const [erreur, setErreur] = useState(false)
  const [semaine, setSemaine] = useState(false)
  useEffect(() => { appMesse().then(setData).catch(() => setErreur(true)) }, [])
  if (erreur) return null
  const auj = new Date().toLocaleDateString('sv-SE')
  const ordoDu = (j) => data?.ordo.find((o) => o.date === j)
  const intentionsDu = (j) => (data?.intentions || []).filter((i) => i.date_messe === j)
  const jours = semaine ? [...new Set([auj, ...(data?.intentions || []).map((i) => i.date_messe)])].sort() : [auj]
  const o = ordoDu(auj)
  return (
    <section className="carte overflow-hidden">
      <div className="px-5 py-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3">
          <h2 className="text-lg font-semibold">Intentions de messe</h2>
          <button className="text-xs text-or-600 hover:underline" onClick={() => setSemaine(!semaine)}>{semaine ? "Aujourd'hui seulement" : 'Les 7 prochains jours'}</button>
        </div>
        {o && <p className="mb-1 text-xs text-nuit-600/70">{[CLASSES[o.classe] || o.classe, o.commemoraison ? `Commémoraison : ${o.commemoraison}` : ''].filter(Boolean).join(' · ')} · <a href={LIEN_APPMESSE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-or-600 hover:underline">AppMESSE<ExternalLink className="h-3 w-3" /></a></p>}
        {!o && <p className="mb-1 text-xs"><a href={LIEN_APPMESSE} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-or-600 hover:underline">AppMESSE<ExternalLink className="h-3 w-3" /></a></p>}
        {!data ? null : jours.map((j) => {
          const liste = intentionsDu(j), oj = ordoDu(j)
          return (
            <div key={j} className="py-1.5">
              {semaine && <div className="mt-1 text-xs font-medium text-nuit-600 first-letter:uppercase">{jourLong(j + 'T12:00')}{oj && j !== auj ? <span className="font-normal text-nuit-600/75"> — {oj.fete}</span> : null}</div>}
              {!liste.length ? <p className="text-sm text-nuit-600/75">{j === auj ? "Aucune intention aujourd'hui." : 'Aucune intention.'}</p> : (
                <ul className="divide-y divide-nuit-50">
                  {liste.map((i) => (
                    <li key={i.id} className="flex items-baseline gap-3 py-1.5 text-sm">
                      <span className="w-12 shrink-0 font-medium text-nuit">{i.heure_messe || '—'}</span>
                      <span className="min-w-0 flex-1"><span className="text-xs text-nuit-600/75">{i.type_intention} · </span>{i.nom_intention}</span>
                      {i.statut === 'en_attente' && <span className="pastille bg-amber-100 py-0 text-xs text-amber-900">à valider</span>}
                      {i.celebrant && <span className="shrink-0 text-xs text-nuit-600/75">{CELEBRANTS[i.celebrant] || i.celebrant}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
