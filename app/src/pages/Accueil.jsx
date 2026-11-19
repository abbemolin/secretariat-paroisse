import { Link } from 'react-router-dom'
import { Mail, UserCheck, FolderHeart, CalendarDays, ChevronRight, Bell } from 'lucide-react'
import { api } from '../api.js'
import { useApp } from '../App.jsx'
import { TYPES, prochaineEtape } from '../types.js'
import { Chargement, Erreur, EnTete, heure, jourLong, dateRelative, useCharger } from '../ui.jsx'

export default function Accueil() {
  const { utilisateur, peut } = useApp()
  const { data, chargement, erreur, recharger } = useCharger(() => api('accueil.resume'), [])
  const salut = new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'

  return (
    <>
      <EnTete titre={`${salut}, ${utilisateur.nom}`} sousTitre={jourLong(new Date())} />
      <Erreur erreur={erreur} reessayer={recharger} />
      {chargement && !data ? <Chargement /> : data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {peut('mail') && <Tuile to="/courrier" icone={Mail} chiffre={data.mailsNonLus} libelle="e-mails non lus" />}
            {peut('mail') && <Tuile to="/courrier?filtre=mes" icone={UserCheck} chiffre={data.mesMails} libelle="mails qui me sont attribués" accent={data.mesMails > 0} />}
            {peut('dossiers') && <Tuile to="/dossiers" icone={FolderHeart} chiffre={data.dossiersOuverts} libelle="dossiers en cours" />}
            {peut('agenda') && <Tuile to="/agenda" icone={CalendarDays} chiffre={data.evenements?.length} libelle="événements sur 7 jours" />}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {peut('dossiers') && (
              <section className="carte p-5">
                <Titre texte="Nouvelles demandes" lien="/dossiers" />
                <ListeDossiers liste={data.nouveaux} vide="Aucune nouvelle demande." />
                {data.mesDossiers?.length > 0 && <>
                  <h3 className="mb-1 mt-5 text-lg font-semibold">Mes dossiers</h3>
                  <ListeDossiers liste={data.mesDossiers} />
                </>}
              </section>
            )}
            <div className="space-y-5">
              {data.notifications?.length > 0 && (
                <section className="carte p-5">
                  <Titre texte="Notifications" />
                  <ul className="divide-y divide-nuit-50">
                    {data.notifications.slice(0, 5).map((n) => (
                      <li key={n.id}><Link to={(n.lien || '#/').replace(/^#/, '')} className={`flex items-start gap-2 py-2 text-sm hover:text-or-600 ${n.lu ? 'opacity-60' : ''}`}>
                        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-or" /><div className="min-w-0 flex-1"><div className="font-medium">{n.titre}</div><div className="truncate text-xs text-nuit-600/70">{n.texte}</div></div>
                        <span className="text-xs text-nuit-600/50">{dateRelative(n.date)}</span></Link></li>
                    ))}
                  </ul>
                </section>
              )}
              {peut('agenda') && (
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
              )}
            </div>
          </div>
        </div>
      )}
    </>
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
          <span className="hidden truncate text-xs text-nuit-600/60 sm:block">{prochaineEtape(d.type, d.etapes, d)?.label}</span>
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
