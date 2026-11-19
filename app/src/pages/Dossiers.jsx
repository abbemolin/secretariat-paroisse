import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, FolderHeart, Loader2, Globe } from 'lucide-react'
import { api } from '../api.js'
import { useApp } from '../App.jsx'
import { TYPES, ORDRE_TYPES, ETATS, prochaineEtape, documentsManquants, PAR_ANNEE, anneeSacrements } from '../types.js'
import { Chargement, Erreur, Modale, Vide, useCharger, dateCourte, initiales, COULEURS_STATUT } from '../ui.jsx'

export default function Dossiers() {
  const nav = useNavigate()
  const { nomUtilisateur } = useApp()
  const [params, setParams] = useSearchParams()
  const type = params.get('type') || ''
  const etat = params.get('etat') || 'ouvert'
  const annee = params.get('annee') || ''
  const parAnnee = PAR_ANNEE.includes(type)
  const [texte, setTexte] = useState('')
  const [nouveau, setNouveau] = useState(false)
  const { data, chargement, erreur, recharger } = useCharger(() => api('dossiers.liste', {}), [])

  const tous = data || []
  const liste = tous.filter((d) => (!type || d.type === type) && (etat === 'tous' || d.etat === etat) &&
    (!parAnnee || !annee || (annee === 'aucune' ? !anneeSacrements(d) : anneeSacrements(d) === annee)) &&
    (!texte || `${d.nom} ${d.email} ${d.telephone}`.toLowerCase().includes(texte.toLowerCase())))
  const compte = (t) => tous.filter((d) => d.type === t && (etat === 'tous' || d.etat === etat)).length
  const changer = (p) => setParams(Object.fromEntries(Object.entries({ type, etat, annee, ...p }).filter(([, v]) => v)))

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-semibold">Dossiers</h1><p className="text-sm text-nuit-600/80">Baptêmes, mariages, obsèques, catéchumènes, confirmands</p></div>
        <button className="btn-or" onClick={() => setNouveau(true)}><Plus className="h-4 w-4" />Nouveau dossier</button>
      </div>

      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button onClick={() => changer({ type: '', annee: '' })} className={`pastille shrink-0 border py-1 ${!type ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>Tous</button>
        {ORDRE_TYPES.map((t) => (
          <button key={t} onClick={() => changer({ type: t, annee: '' })} className={`pastille shrink-0 gap-1.5 border py-1 ${type === t ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: TYPES[t].couleur }} />{TYPES[t].pluriel}{data && <span className="opacity-60">{compte(t)}</span>}
          </button>
        ))}
      </div>
      {parAnnee && data && (() => {
        const base = tous.filter((d) => d.type === type && (etat === 'tous' || d.etat === etat))
        const annees = [...new Set(base.map(anneeSacrements).filter(Boolean))].sort()
        const sans = base.filter((d) => !anneeSacrements(d)).length
        return (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-nuit-600">{type === 'confirmand' ? 'Année de confirmation :' : 'Année des sacrements :'}</span>
            <button onClick={() => changer({ annee: '' })} className={`pastille border py-1 ${!annee ? 'border-or bg-or text-white' : 'border-or/40 bg-white text-or-600'}`}>Toutes</button>
            {annees.map((a) => <button key={a} onClick={() => changer({ annee: a })} className={`pastille border py-1 ${annee === a ? 'border-or bg-or text-white' : 'border-or/40 bg-white text-or-600'}`}>{a} <span className="ml-1 opacity-70">{base.filter((d) => anneeSacrements(d) === a).length}</span></button>)}
            {sans > 0 && <button onClick={() => changer({ annee: 'aucune' })} className={`pastille border py-1 ${annee === 'aucune' ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>Non fixée <span className="ml-1 opacity-70">{sans}</span></button>}
          </div>
        )
      })()}
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-nuit-600/50" />
          <input className="champ pl-9" placeholder="Nom, e-mail, téléphone…" value={texte} onChange={(e) => setTexte(e.target.value)} /></div>
        <select className="champ" value={etat} onChange={(e) => changer({ etat: e.target.value })}>
          <option value="ouvert">En cours</option><option value="clos">Clos</option><option value="annule">Annulés</option><option value="tous">Tous</option>
        </select>
      </div>

      <Erreur erreur={erreur} reessayer={recharger} />
      {chargement && !data ? <Chargement /> : (
        <div className="carte overflow-hidden">
          {!liste.length ? <Vide icone={FolderHeart} texte="Aucun dossier." /> : (
            <div className="divide-y divide-nuit-50">
              {(parAnnee && !annee ? [...liste].sort((x, y) => (anneeSacrements(x) || '9999').localeCompare(anneeSacrements(y) || '9999')) : liste).map((d, i, arr) => {
                const entete = parAnnee && !annee && (i === 0 || anneeSacrements(arr[i - 1]) !== anneeSacrements(d))
                const t = TYPES[d.type], prochaine = prochaineEtape(d.type, d.etapes), manquants = documentsManquants(d.type, d.documents).length
                const total = t.etapes.filter((e) => !e.optionnel).length, faites = t.etapes.filter((e) => !e.optionnel && d.etapes.includes(e.cle)).length
                return (
                  <div key={d.id}>
                  {entete && <div className="bg-or-50 px-4 py-1.5 font-titre text-lg font-semibold text-or-600">{anneeSacrements(d) ? (type === 'confirmand' ? 'Confirmations ' : 'Sacrements ') + anneeSacrements(d) : 'Année non fixée'}</div>}
                  <button onClick={() => nav(`/dossiers/${d.id}`)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left text-sm hover:bg-nuit-50/50 md:grid-cols-[150px_1fr_200px_120px_40px]">
                    <span className="flex flex-col gap-0.5"><span className="pastille w-fit text-white" style={{ background: t.couleur }}>{t.nom}</span>
                      {PAR_ANNEE.includes(d.type) && !parAnnee && anneeSacrements(d) && <span className="pastille w-fit border border-or/40 py-0 text-[10px] text-or-600">{anneeSacrements(d)}</span>}</span>
                    <span className="min-w-0"><span className="block truncate font-medium">{d.nom}</span>
                      <span className="block truncate text-xs text-nuit-600/60">{d.etat !== 'ouvert' ? <span className={`pastille py-0 ${COULEURS_STATUT[d.etat]}`}>{ETATS[d.etat]}</span> : prochaine ? '→ ' + prochaine.label : 'Toutes les étapes faites'}{manquants > 0 && d.etat === 'ouvert' && ` · ${manquants} document${manquants > 1 ? 's' : ''} manquant${manquants > 1 ? 's' : ''}`}</span></span>
                    <span className="hidden md:block"><span className="block h-1.5 overflow-hidden rounded-full bg-nuit-50"><span className="block h-full rounded-full" style={{ width: `${(faites / total) * 100}%`, background: t.couleur }} /></span><span className="text-[11px] text-nuit-600/60">{faites}/{total} étapes</span></span>
                    <span className="text-right text-xs text-nuit-600/70 md:text-left">{d.date_celebration ? <span className="inline-flex items-center gap-1 font-medium text-nuit"><Globe className="h-3 w-3 text-or" />{dateCourte(d.date_celebration)}</span> : d.date_souhaitee ? 'souhaité ' + dateCourte(d.date_souhaitee) : '—'}</span>
                    <span className="hidden justify-end md:flex">{d.responsable && <span title={nomUtilisateur(d.responsable)} className="flex h-7 w-7 items-center justify-center rounded-full bg-nuit text-[10px] font-semibold text-white">{initiales(nomUtilisateur(d.responsable))}</span>}</span>
                  </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      {nouveau && <NouveauDossier typeInitial={type || 'bapteme'} onFermer={() => setNouveau(false)} onCree={(d) => nav(`/dossiers/${d.id}`)} />}
    </>
  )
}

function NouveauDossier({ typeInitial, onFermer, onCree }) {
  const { utilisateurs } = useApp()
  const [type, setType] = useState(typeInitial)
  const [infos, setInfos] = useState({})
  const [responsable, setResponsable] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const section = TYPES[type].sections[0]
  const contact = TYPES[type].sections.find((s) => s.champs.some((c) => c.cle === 'telephone'))
  const champs = [...section.champs.slice(0, 4), ...(contact && contact !== section ? contact.champs.filter((c) => ['telephone', 'email'].includes(c.cle)) : [])]

  async function creer() {
    setEnvoi(true); setErreur(null)
    try { onCree(await api('dossiers.creer', { type, infos, responsable })) } catch (e) { setErreur(e); setEnvoi(false) }
  }
  return (
    <Modale titre="Nouveau dossier" onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" onClick={creer} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Créer le dossier</button></>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">{ORDRE_TYPES.map((t) => (
          <button key={t} onClick={() => { setType(t); setInfos({}) }} className={`pastille gap-1.5 border py-1 ${type === t ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 text-nuit-600'}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: TYPES[t].couleur }} />{TYPES[t].nom}</button>
        ))}</div>
        <p className="text-xs text-nuit-600/70">{section.titre} — le reste se complète ensuite dans le dossier.</p>
        <div className="grid grid-cols-2 gap-3">
          {champs.map((c) => (
            <div key={c.cle}><label className="etiquette">{c.label}</label>
              <input className="champ" type={c.type === 'date' ? 'date' : c.type === 'email' ? 'email' : c.type === 'tel' ? 'tel' : 'text'} value={infos[c.cle] || ''} onChange={(e) => setInfos({ ...infos, [c.cle]: e.target.value })} /></div>
          ))}
        </div>
        <div><label className="etiquette">Responsable</label>
          <select className="champ" value={responsable} onChange={(e) => setResponsable(e.target.value)}><option value="">Personne pour l'instant</option>{utilisateurs.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}</select></div>
        <Erreur erreur={erreur} />
      </div>
    </Modale>
  )
}
