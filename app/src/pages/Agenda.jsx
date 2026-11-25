import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, MapPin, Repeat, Loader2, FolderHeart, Globe } from 'lucide-react'
import { api } from '../api.js'
import { Chargement, Erreur, Modale, useCharger, useNotif, useConfirmer, heure, jourLong, versLocal } from '../ui.jsx'

const lundi = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const ajouterJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const memeJour = (a, b) => a.toDateString() === b.toDateString()
const fmt = (o) => new Intl.DateTimeFormat('fr-FR', o)

function bornes(vue, ref) {
  if (vue === 'jour') { const d = new Date(ref); d.setHours(0, 0, 0, 0); return [d, ajouterJours(d, 1)] }
  if (vue === 'liste') { const d = new Date(ref); d.setHours(0, 0, 0, 0); return [d, ajouterJours(d, 21)] }   // 3 semaines à partir du jour choisi
  if (vue === 'semaine') { const d = lundi(ref); return [d, ajouterJours(d, 7)] }
  const premier = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const debut = lundi(premier)
  const dernier = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  return [debut, ajouterJours(lundi(dernier), 7)]
}

export default function Agenda() {
  const notifier = useNotif()
  // Vue retenue sur l'appareil ; « Liste » par défaut sur téléphone
  const [vue, setVueBrute] = useState(() => { try { return localStorage.getItem('agenda.vue') || (window.innerWidth < 640 ? 'liste' : 'semaine') } catch { return 'semaine' } })
  const setVue = (v) => { setVueBrute(v); try { localStorage.setItem('agenda.vue', v) } catch { /* ignore */ } }
  const [ref, setRef] = useState(() => new Date())
  const [edition, setEdition] = useState(null)
  const [debut, fin] = useMemo(() => bornes(vue, ref), [vue, ref])
  const evts = useCharger(() => api('agenda.evenements', { debut: debut.toISOString(), fin: fin.toISOString() }), [debut.getTime(), fin.getTime()], ['agenda.evenements', { debut: debut.toISOString(), fin: fin.toISOString() }])
  const liste = evts.data || []
  const duJour = (j) => liste.filter((e) => new Date(e.debut) < ajouterJours(j, 1) && new Date(e.fin) > j && !(e.journee && new Date(e.fin).getTime() === j.getTime()))

  function decaler(n) {
    setRef((r) => vue === 'mois' ? new Date(r.getFullYear(), r.getMonth() + n, 1) : ajouterJours(r, n * (vue === 'semaine' ? 7 : vue === 'liste' ? 21 : 1)))
  }
  function nouveau(jour) {
    const d = new Date(jour || new Date()); d.setHours(jour ? 10 : new Date().getHours() + 1, 0, 0, 0)
    setEdition({ titre: '', lieu: '', description: '', journee: false, debut: d.toISOString(), fin: new Date(d.getTime() + 3600000).toISOString() })
  }
  const titre = vue === 'jour' ? jourLong(ref) : vue === 'liste' ? `À partir du ${fmt({ day: 'numeric', month: 'long' }).format(debut)}` : vue === 'mois' ? fmt({ month: 'long', year: 'numeric' }).format(ref)
    : `${fmt({ day: 'numeric', month: 'short' }).format(debut)} – ${fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(ajouterJours(fin, -1))}`

  const Evt = ({ e, compact }) => (
    <button onClick={() => setEdition(e)} className={`block w-full rounded-md border-l-4 px-2 text-left hover:brightness-95 ${compact ? 'py-0.5 text-xs' : 'py-1.5 text-xs'} ${e.dossier ? 'border-or bg-or-50' : 'border-nuit-600 bg-nuit-50'}`}>
      <span className="font-medium text-nuit-600">{e.journee ? '' : heure(e.debut) + ' '}</span>
      <span className="font-medium text-nuit-800">{e.titre}</span>{e._enAttente && <span className="ml-1 text-xs italic text-nuit-600/70">(en attente d'envoi)</span>}
      {!compact && e.lieu && <div className="truncate text-nuit-600/70"><MapPin className="mr-0.5 inline h-3 w-3" />{e.lieu}</div>}
    </button>
  )

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-semibold">Agenda</h1><p className="flex items-center gap-1 text-sm text-nuit-600/80"><Globe className="h-3.5 w-3.5" />Agenda public (affiché sur croix-glorieuse.org)</p></div>
        <button className="btn-or" onClick={() => nouveau()}><Plus className="h-4 w-4" />Événement</button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-nuit-100 bg-white">
          <button aria-label="Précédent" title="Précédent" className="btn-icone" onClick={() => decaler(-1)}><ChevronLeft className="h-4 w-4" /></button>
          <button className="px-2 text-sm" onClick={() => setRef(new Date())}>Aujourd'hui</button>
          <button aria-label="Suivant" title="Suivant" className="btn-icone" onClick={() => decaler(1)}><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex rounded-lg border border-nuit-100 bg-white p-0.5 text-sm">
          {['liste', 'jour', 'semaine', 'mois'].map((v) => <button key={v} onClick={() => setVue(v)} aria-pressed={vue === v} className={`rounded-md px-3 py-1 capitalize ${vue === v ? 'bg-nuit text-white' : 'text-nuit-600'}`}>{v}</button>)}
        </div>
        <span className="font-titre text-xl font-semibold first-letter:uppercase">{titre}</span>
        {evts.chargement && <Loader2 className="h-4 w-4 animate-spin text-nuit-600/75" />}
      </div>

      <Erreur erreur={evts.erreur} reessayer={evts.recharger} />
      {evts.chargement && !evts.data ? <Chargement /> : (
        <>
          {vue === 'jour' && (
            <div className="carte divide-y divide-nuit-50">
              {!duJour(debut).length ? <p className="p-6 text-center text-sm text-nuit-600/75">Rien ce jour-là.</p> : duJour(debut).map((e) => (
                <button key={e.id + e.debut} onClick={() => setEdition(e)} className="flex w-full gap-4 px-4 py-3 text-left hover:bg-nuit-50/50">
                  <div className="w-24 shrink-0 text-sm font-medium text-nuit-600">{e.journee ? 'Journée' : `${heure(e.debut)} – ${heure(e.fin)}`}</div>
                  <div className="min-w-0 flex-1"><div className="font-medium">{e.titre}{e.recurrent && <Repeat className="ml-1 inline h-3 w-3 opacity-50" />}</div>
                    {e.lieu && <div className="text-xs text-nuit-600/70"><MapPin className="mr-0.5 inline h-3 w-3" />{e.lieu}</div>}</div>
                  {e.dossier && <FolderHeart className="h-4 w-4 text-or" />}
                </button>
              ))}
              <button onClick={() => nouveau(debut)} className="w-full py-2.5 text-sm text-or-600 hover:bg-nuit-50">+ Ajouter ce jour-là</button>
            </div>
          )}
          {vue === 'liste' && (() => {
            const jours = Array.from({ length: 21 }, (_, i) => ajouterJours(debut, i)).map((j) => [j, duJour(j)]).filter(([, l]) => l.length)
            return !jours.length ? <div className="carte p-6 text-center text-sm text-nuit-600/75">Rien de prévu ces trois semaines.</div> : (
              <div className="carte divide-y divide-nuit-50">
                {jours.map(([j, l]) => {
                  const auj = memeJour(j, new Date())
                  return (
                    <section key={j.toISOString()} className="flex gap-4 px-4 py-3">
                      <button onClick={() => nouveau(j)} title="Ajouter ce jour-là" className={`w-24 shrink-0 text-left text-sm font-semibold first-letter:uppercase sm:w-32 ${auj ? 'text-or-600' : 'text-nuit'}`}>{auj ? "Aujourd'hui" : fmt({ weekday: 'long', day: 'numeric', month: 'short' }).format(j)}</button>
                      <div className="min-w-0 flex-1 space-y-1.5">{l.map((e) => (
                        <button key={e.id + e.debut} onClick={() => setEdition(e)} className="flex w-full items-start gap-3 rounded-md text-left hover:bg-nuit-50/60">
                          <span className="w-12 shrink-0 text-sm text-nuit-600">{e.journee ? 'Journée' : heure(e.debut)}</span>
                          <span className="min-w-0 flex-1"><span className="font-medium">{e.titre}</span>{e.recurrent && <Repeat className="ml-1 inline h-3 w-3 opacity-50" />}
                            {e.lieu && <span className="block truncate text-xs text-nuit-600/80"><MapPin className="mr-0.5 inline h-3 w-3" />{e.lieu}</span>}</span>
                          {e.dossier && <FolderHeart className="mt-0.5 h-4 w-4 shrink-0 text-or" />}
                        </button>))}</div>
                    </section>
                  )
                })}
              </div>
            )
          })()}
          {vue === 'semaine' && (
            <div className="grid gap-3 lg:grid-cols-7">
              {Array.from({ length: 7 }, (_, i) => ajouterJours(debut, i)).map((j) => {
                const l = duJour(j), auj = memeJour(j, new Date())
                return (
                  <section key={j.toISOString()} className={`carte flex flex-col p-3 lg:min-h-[180px] ${auj ? 'ring-2 ring-or/50' : ''} ${!l.length ? 'hidden lg:flex' : ''}`}>
                    <button onClick={() => nouveau(j)} className="group mb-2 flex items-baseline justify-between text-left">
                      <span className={`text-sm font-semibold capitalize ${auj ? 'text-or-600' : ''}`}><span className="lg:hidden">{jourLong(j)}</span><span className="hidden lg:inline">{fmt({ weekday: 'short' }).format(j)} {j.getDate()}</span></span>
                      <Plus className="h-3.5 w-3.5 text-nuit-600/30 group-hover:text-or" />
                    </button>
                    <div className="space-y-1.5">{l.map((e) => <Evt key={e.id + e.debut} e={e} />)}</div>
                  </section>
                )
              })}
            </div>
          )}
          {vue === 'mois' && (
            <div className="carte overflow-hidden">
              <div className="grid grid-cols-7 border-b border-nuit-50 bg-nuit-50/50 text-center text-xs font-medium text-nuit-600">
                {['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((j) => <div key={j} className="py-1.5">{j}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: Math.round((fin - debut) / 86400000) }, (_, i) => ajouterJours(debut, i)).map((j) => {
                  const l = duJour(j), autreMois = j.getMonth() !== ref.getMonth(), auj = memeJour(j, new Date())
                  return (
                    <div key={j.toISOString()} className={`min-h-[64px] border-b border-r border-nuit-50 p-1 sm:min-h-[96px] ${autreMois ? 'bg-nuit-50/30 text-nuit-600/40' : ''}`}>
                      <button onClick={() => { setRef(j); setVue('jour') }} className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs ${auj ? 'bg-or font-semibold text-white' : 'hover:bg-nuit-50'}`}>{j.getDate()}</button>
                      <div className="hidden space-y-0.5 sm:block">{l.slice(0, 3).map((e) => <Evt key={e.id + e.debut} e={e} compact />)}{l.length > 3 && <div className="text-xs text-nuit-600/75">+{l.length - 3}</div>}</div>
                      {l.length > 0 && <div className="flex gap-0.5 sm:hidden">{l.slice(0, 4).map((e) => <span key={e.id + e.debut} className={`h-1.5 w-1.5 rounded-full ${e.dossier ? 'bg-or' : 'bg-nuit-600'}`} />)}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
      {edition && <EditionEvenement evenement={edition} onFermer={() => setEdition(null)} onFait={(msg) => { setEdition(null); notifier(msg); evts.recharger() }} />}
    </>
  )
}

export function EditionEvenement({ evenement, onFermer, onFait }) {
  const confirmer = useConfirmer()
  const nouveau = !evenement.id
  const lectureSeule = evenement.recurrent
  const [f, setF] = useState(() => ({
    ...evenement,
    debut: versLocal(evenement.debut, !evenement.journee),
    fin: versLocal(evenement.journee ? new Date(new Date(evenement.fin) - 1) : evenement.fin, !evenement.journee)
  }))
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const basculerJournee = (e) => {
    const j = e.target.checked
    setF({ ...f, journee: j, debut: j ? f.debut.slice(0, 10) : f.debut + 'T10:00', fin: j ? f.fin.slice(0, 10) : f.fin + 'T11:00' })
  }
  async function enregistrer() {
    setEnvoi(true); setErreur(null)
    try {
      const r = await api(nouveau ? 'agenda.creer' : 'agenda.modifier', { ...f, debut: new Date(f.journee ? f.debut + 'T00:00' : f.debut).toISOString(), fin: new Date(f.journee ? f.fin + 'T00:00' : f.fin).toISOString() })
      onFait(r?._enAttente ? 'Hors connexion : gardé sur l\'appareil, envoyé au retour du réseau' : nouveau ? 'Événement créé' : f.dossier ? 'Événement et dossier mis à jour' : 'Événement modifié')
    } catch (e) { setErreur(e) } finally { setEnvoi(false) }
  }
  async function supprimer() {
    if (!(await confirmer({ titre: "Supprimer l'événement", texte: f.dossier ? "L'événement sera retiré de l'agenda public et la date retirée du dossier." : "L'événement sera retiré de l'agenda public.", bouton: 'Supprimer', danger: true }))) return
    setEnvoi(true)
    try { await api('agenda.supprimer', { id: f.id }); onFait('Événement supprimé') } catch (e) { setErreur(e); setEnvoi(false) }
  }
  return (
    <Modale titre={nouveau ? 'Nouvel événement' : lectureSeule ? f.titre : "Modifier l'événement"} onFermer={onFermer}
      pied={lectureSeule ? <button className="btn-clair" onClick={onFermer}>Fermer</button> : <>
        {!nouveau && <button className="btn-danger mr-auto" onClick={supprimer} disabled={envoi}>Supprimer</button>}
        <button className="btn-clair" onClick={onFermer}>Annuler</button>
        <button className="btn-principal" onClick={enregistrer} disabled={envoi || !f.titre}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
      </>}>
      {lectureSeule ? (
        <div className="space-y-2 text-sm">
          <p>{jourLong(evenement.debut)}{!f.journee && `, ${heure(evenement.debut)} – ${heure(evenement.fin)}`}</p>
          {f.lieu && <p><MapPin className="mr-1 inline h-4 w-4" />{f.lieu}</p>}
          {f.description && <p className="whitespace-pre-wrap text-nuit-600">{f.description}</p>}
          <p className="rounded-lg bg-nuit-50 p-3 text-xs text-nuit-600"><Repeat className="mr-1 inline h-3.5 w-3.5" />Événement récurrent : à modifier dans Google Agenda, pour ne pas toucher toute la série par erreur.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {f.dossier && <Link to={`/dossiers/${f.dossier}`} className="flex items-center gap-2 rounded-lg bg-or-50 p-3 text-sm text-or-600"><FolderHeart className="h-4 w-4" />Lié à un dossier : changer la date ici met aussi le dossier à jour. Ouvrir le dossier →</Link>}
          <div><label className="etiquette">Titre (visible sur le site)</label><input className="champ" value={f.titre} onChange={maj('titre')} autoFocus={nouveau} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.journee} onChange={basculerJournee} />Toute la journée</label>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="etiquette">Début</label><input className="champ" type={f.journee ? 'date' : 'datetime-local'} value={f.debut} onChange={maj('debut')} /></div>
            <div><label className="etiquette">Fin</label><input className="champ" type={f.journee ? 'date' : 'datetime-local'} value={f.fin} onChange={maj('fin')} /></div>
          </div>
          <div><label className="etiquette">Lieu</label><input className="champ" value={f.lieu} onChange={maj('lieu')} /></div>
          <div><label className="etiquette">Description (visible sur le site)</label><textarea className="champ min-h-[80px]" value={f.description} onChange={maj('description')} /></div>
          <p className="flex items-center gap-1 text-xs text-nuit-600/75"><Globe className="h-3 w-3" />Cet agenda est public : n'y mettez pas d'informations personnelles.</p>
          <Erreur erreur={erreur} />
        </div>
      )}
    </Modale>
  )
}
