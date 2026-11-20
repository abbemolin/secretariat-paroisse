import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Inbox, Star, AlertTriangle, CheckCircle2, ScrollText, ExternalLink, Wand2, Send, MailOpen, Tag, Search, ArrowLeft, Reply, ReplyAll, Archive, Trash2, Paperclip, PenSquare, Download, Loader2, X, FolderOpen, Mail, UserCheck, ListTodo, Users, MessageSquare, FolderPlus, CalendarPlus, FolderHeart } from 'lucide-react'
import { api, fichierEnBase64, telechargerBase64 } from '../api.js'
import { useApp } from '../App.jsx'
import { TYPES, ORDRE_TYPES, remplirModele } from '../types.js'
import { Chargement, Erreur, Vide, Modale, useNotif, dateRelative, dateHeure, nomExpediteur, taille, COULEURS_STATUT, initiales } from '../ui.jsx'
import { ChoisirDocument } from './Documents.jsx'
import { EditionEvenement } from './Agenda.jsx'
import { creerExtrait } from './Extraits.jsx'
import { B14 } from '../imprimables.js'
import { LIEN_APPMESSE } from '../appmesse.js'

/** Tri automatique : mêmes noms que les étiquettes Gmail « Tri/… » créées par le serveur (Tri.gs). */
export const TRI = [
  { cle: 'extrait', nom: 'Extrait de baptême', action: 'extrait' },
  { cle: 'intention', nom: 'Intention de messe', action: 'appmesse' },
  { cle: 'obseques', nom: 'Obsèques', action: 'dossier', type: 'obseques' },
  { cle: 'premiere_communion', nom: 'Première communion', action: 'dossier', type: 'premiere_communion' },
  { cle: 'profession_foi', nom: 'Profession de foi', action: 'dossier', type: 'profession_foi' },
  { cle: 'confirmand', nom: 'Confirmation', action: 'dossier', type: 'confirmand' },
  { cle: 'catechumene', nom: 'Catéchuménat', action: 'dossier', type: 'catechumene' },
  { cle: 'mariage', nom: 'Mariage', action: 'dossier', type: 'mariage', reponse: 'accuse_mariage' },
  { cle: 'bapteme', nom: 'Baptême', action: 'dossier', type: 'bapteme', reponse: 'accuse_bapteme' },
  { cle: 'rendezvous', nom: 'Rendez-vous', action: 'rendezvous' },
  { cle: 'horaires', nom: 'Horaires', action: 'horaires', reponse: 'horaires' }
]
const TRI_SPECIAUX = [{ cle: 'prioritaire', nom: 'Prioritaire' }, { cle: 'auto', nom: 'Réponse auto envoyée' }]
const nomTri = (cle) => TRI.find((c) => c.cle === cle)?.nom || cle

const FILTRES = [
  { cle: 'boite', nom: 'Boîte de réception', icone: Inbox },
  { cle: 'nonlus', nom: 'Non lus', icone: MailOpen },
  { cle: 'mes', nom: 'Mes mails', icone: UserCheck },
  { cle: 'atraiter', nom: 'À suivre', icone: ListTodo },
  { cle: 'suivis', nom: 'Suivis', icone: Star },
  { cle: 'envoyes', nom: 'Envoyés', icone: Send }
]

export default function Courrier() {
  const notifier = useNotif()
  const { nomUtilisateur } = useApp()
  const [params, setParams] = useSearchParams()
  const filtre = params.get('filtre') || 'boite'
  const libelle = params.get('libelle') || ''
  const ouvert = params.get('fil')
  const [recherche, setRecherche] = useState('')
  const [fils, setFils] = useState([])
  const [suivant, setSuivant] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [libelles, setLibelles] = useState([])
  const [redaction, setRedaction] = useState(null)
  const [groupe, setGroupe] = useState(false)

  const changer = (p) => setParams(Object.fromEntries(Object.entries({ filtre, libelle, fil: ouvert, ...p }).filter(([, v]) => v)))

  async function charger(debut = 0) {
    setChargement(true); setErreur(null)
    try {
      const r = await api('mail.liste', { filtre, libelle, recherche, debut })
      setFils((f) => (debut ? [...f, ...r.fils] : r.fils)); setSuivant(r.suivant)
    } catch (e) { setErreur(e) } finally { setChargement(false) }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(0) }, [filtre, libelle])
  useEffect(() => { api('mail.libelles').then(setLibelles).catch(() => {}) }, [])

  async function agir(fil, modif, message) {
    try {
      await api('mail.modifier', { id: fil.id, ...modif })
      if (modif.archiver || modif.corbeille) { setFils((l) => l.filter((x) => x.id !== fil.id)); changer({ fil: '' }) }
      else setFils((l) => l.map((x) => (x.id === fil.id ? { ...x, ...(modif.important !== undefined ? { important: modif.important } : {}), ...(modif.nonLu ? { nonLu: true } : {}) } : x)))
      if (message) notifier(message)
    } catch (e) { notifier(e.message, 'erreur') }
  }
  const majSuivi = (id, suivi) => setFils((l) => l.map((x) => (x.id === id ? { ...x, suivi } : x)))

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-semibold">Courrier</h1><p className="text-sm text-nuit-600/80">secretariat@croix-glorieuse.org</p></div>
        <div className="flex gap-2">
          <button className="btn-clair" onClick={() => setGroupe(true)}><Users className="h-4 w-4" /><span className="hidden sm:inline">Envoi groupé</span></button>
          <button className="btn-or" onClick={() => setRedaction({ mode: 'nouveau' })}><PenSquare className="h-4 w-4" />Nouveau</button>
        </div>
      </div>
      <div className="flex gap-5">
        <div className={`${ouvert ? 'hidden lg:flex' : 'flex'} min-w-0 flex-1 flex-col lg:max-w-md`}>
          <form className="relative mb-3" onSubmit={(e) => { e.preventDefault(); charger(0) }}>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-nuit-600/50" />
            <input className="champ pl-9" placeholder="Rechercher (nom, sujet, adresse…)" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </form>
          <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {FILTRES.map(({ cle, nom, icone: I }) => (
              <button key={cle} onClick={() => changer({ filtre: cle, libelle: '', fil: '' })} className={`pastille shrink-0 gap-1 border py-1 ${filtre === cle && !libelle ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}><I className="h-3 w-3" />{nom}</button>
            ))}
          </div>
          <div className="mb-3 flex gap-2">
            <select className={`champ py-1.5 text-xs ${libelle.startsWith('Tri/') ? 'border-or bg-or-50' : ''}`} value={libelle.startsWith('Tri/') ? libelle : ''} onChange={(e) => changer({ libelle: e.target.value, fil: '' })}>
              <option value="">Tri automatique…</option>
              {[...TRI_SPECIAUX, ...TRI].map((c) => <option key={c.cle} value={'Tri/' + c.nom}>{c.nom}</option>)}
            </select>
            {libelles.length > 0 && (
              <select className={`champ py-1.5 text-xs ${libelle && !libelle.startsWith('Tri/') ? 'border-or bg-or-50' : ''}`} value={libelle.startsWith('Tri/') ? '' : libelle} onChange={(e) => changer({ libelle: e.target.value, fil: '' })}>
                <option value="">Libellés…</option>{libelles.map((l) => <option key={l}>{l}</option>)}
              </select>
            )}
          </div>
          <Erreur erreur={erreur} reessayer={() => charger(0)} />
          <div className="carte divide-y divide-nuit-50 overflow-hidden">
            {chargement && !fils.length ? <Chargement /> : !fils.length ? <Vide icone={Mail} texte="Aucun message." /> : fils.map((f) => (
              <button key={f.id} onClick={() => changer({ fil: f.id })} className={`block w-full px-4 py-3 text-left transition hover:bg-nuit-50/60 ${ouvert === f.id ? 'bg-or-50' : ''}`}>
                <div className="flex items-center gap-2">
                  {f.nonLu && <span className="h-2 w-2 shrink-0 rounded-full bg-or" />}
                  <span className={`min-w-0 flex-1 truncate text-sm ${f.nonLu ? 'font-semibold' : ''}`}>{filtre === 'envoyes' ? 'À : ' + nomExpediteur(f.a) : nomExpediteur(f.de)}{f.nb > 1 && <span className="ml-1 text-xs text-nuit-600/60">({f.nb})</span>}</span>
                  {f.important && <Star className="h-3.5 w-3.5 fill-or text-or" />}
                  <span className="shrink-0 text-xs text-nuit-600/60">{dateRelative(f.date)}</span>
                </div>
                <div className={`truncate text-sm ${f.nonLu ? 'font-medium' : 'text-nuit-700'}`}>{f.sujet}</div>
                <EtiquettesTri tri={f.tri} />
                <div className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs text-nuit-600/60">{f.extrait}</span>
                  {f.suivi?.dossier_id && <FolderHeart className="h-3.5 w-3.5 text-or" />}
                  {f.suivi?.statut && <span className={`pastille py-0 text-[10px] ${COULEURS_STATUT[f.suivi.statut]}`}>{f.suivi.statut}</span>}
                  {f.suivi?.attribue_a && <span title={nomUtilisateur(f.suivi.attribue_a)} className="flex h-5 w-5 items-center justify-center rounded-full bg-nuit text-[9px] font-semibold text-white">{initiales(nomUtilisateur(f.suivi.attribue_a))}</span>}
                </div>
              </button>
            ))}
            {suivant && <button className="w-full py-3 text-sm text-or-600 hover:bg-nuit-50" onClick={() => charger(suivant)} disabled={chargement}>{chargement ? 'Chargement…' : 'Plus de messages'}</button>}
          </div>
        </div>
        {ouvert ? (
          <Fil id={ouvert} onRetour={() => changer({ fil: '' })} onAgir={agir} onSuivi={majSuivi}
            onRepondre={(fil, tous, reponse) => setRedaction({ mode: tous ? 'tous' : 'repondre', fil, reponse })} />
        ) : <div className="carte hidden flex-1 lg:block"><Vide icone={MailOpen} texte="Sélectionnez un message." /></div>}
      </div>
      {redaction && <Redaction {...redaction} onFermer={() => setRedaction(null)} onEnvoye={() => { setRedaction(null); notifier('Message envoyé') }} />}
      {groupe && <EnvoiGroupe onFermer={() => setGroupe(false)} />}
    </>
  )
}

function Fil({ id, onRetour, onAgir, onRepondre, onSuivi }) {
  const notifier = useNotif()
  const nav = useNavigate()
  const { utilisateurs, utilisateur, nomUtilisateur } = useApp()
  const [fil, setFil] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [pj, setPj] = useState(null)
  const [commentaire, setCommentaire] = useState('')
  const [creation, setCreation] = useState(false)
  const [rdv, setRdv] = useState(null)
  useEffect(() => { setFil(null); setCreation(false); setErreur(null); api('mail.fil', { id }).then(setFil).catch(setErreur) }, [id])

  async function telechargerPj(m, p) {
    setPj(m.id + p.index)
    try { telechargerBase64(await api('mail.piecejointe', { messageId: m.id, index: p.index })) } catch (e) { notifier(e.message, 'erreur') } finally { setPj(null) }
  }
  async function suivi(modif, msg) {
    try { const s = await api('mail.suivi', { filId: id, ...modif }); setFil((f) => ({ ...f, suivi: s })); onSuivi(id, s); if (msg) notifier(msg) }
    catch (e) { notifier(e.message, 'erreur') }
  }
  async function commenter(e) {
    e.preventDefault()
    if (!commentaire.trim()) return
    try { const c = await api('mail.commenter', { filId: id, texte: commentaire }); setFil((f) => ({ ...f, commentaires: [...f.commentaires, c] })); setCommentaire('') }
    catch (err) { notifier(err.message, 'erreur') }
  }
  const premier = fil?.messages?.[0]

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <button className="btn-icone lg:hidden" onClick={onRetour}><ArrowLeft className="h-5 w-5" /></button>
        {fil && <>
          <button className="btn-clair" onClick={() => onRepondre(fil, false)}><Reply className="h-4 w-4" />Répondre</button>
          <button className="btn-icone" title="Répondre à tous" onClick={() => onRepondre(fil, true)}><ReplyAll className="h-4 w-4" /></button>
          <button className="btn-icone" title="Suivre (étoile)" onClick={() => onAgir(fil, { important: !fil.important }, fil.important ? 'Étoile retirée' : 'Étoile ajoutée')}><Star className={`h-4 w-4 ${fil.important ? 'fill-or text-or' : ''}`} /></button>
          <button className="btn-icone" title="Marquer non lu" onClick={() => { onAgir(fil, { nonLu: true }); onRetour() }}><MailOpen className="h-4 w-4" /></button>
          <button className="btn-icone" title="Archiver" onClick={() => onAgir(fil, { archiver: true }, 'Archivé')}><Archive className="h-4 w-4" /></button>
          <button className="btn-icone text-red-700" title="Corbeille" onClick={() => onAgir(fil, { corbeille: true }, 'Mis à la corbeille')}><Trash2 className="h-4 w-4" /></button>
        </>}
      </div>
      <Erreur erreur={erreur} />
      {!fil ? !erreur && <div className="carte"><Chargement /></div> : (
        <div className="space-y-4">
          <SuggestionsTri fil={fil} premier={premier} onRepondre={(cle) => onRepondre(fil, false, cle)} onDossier={(type) => setCreation(type)} onRdv={() => setRdv(fil)} onSuivi={suivi} />
          {/* Suivi interne */}
          <div className="carte grid gap-3 p-4 sm:grid-cols-3">
            <div><label className="etiquette">Statut</label>
              <select className="champ py-1.5" value={fil.suivi?.statut || ''} onChange={(e) => suivi({ statut: e.target.value }, 'Statut mis à jour')}>
                <option value="">—</option>{['À traiter', 'En cours', 'Traité'].map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <div><label className="etiquette">Attribué à</label>
              <select className="champ py-1.5" value={fil.suivi?.attribue_a || ''} onChange={(e) => suivi({ attribue_a: e.target.value }, e.target.value ? 'Attribué à ' + nomUtilisateur(e.target.value) : 'Attribution retirée')}>
                <option value="">Personne</option>{utilisateurs.map((u) => <option key={u.id} value={u.id}>{u.nom}{u.id === utilisateur.id ? ' (moi)' : ''}</option>)}
              </select></div>
            <div><label className="etiquette">Dossier</label>
              {fil.suivi?.dossier_id
                ? <Link to={`/dossiers/${fil.suivi.dossier_id}`} className="btn-clair w-full py-1.5"><FolderHeart className="h-4 w-4 text-or" />Ouvrir le dossier</Link>
                : <div className="flex gap-1">
                    <button className="btn-clair flex-1 px-2 py-1.5 text-xs" onClick={() => setCreation(true)}><FolderPlus className="h-4 w-4" />Dossier</button>
                    <button className="btn-clair flex-1 px-2 py-1.5 text-xs" onClick={() => setRdv(fil)}><CalendarPlus className="h-4 w-4" />Rendez-vous</button>
                  </div>}
            </div>
          </div>

          <div className="carte p-5">
            <h2 className="mb-3 text-2xl font-semibold leading-tight">{fil.sujet}</h2>
            <div className="space-y-5">
              {fil.messages.map((m) => (
                <article key={m.id} className="border-t border-nuit-50 pt-4 first:border-0 first:pt-0">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <div><span className="font-semibold">{nomExpediteur(m.de)}</span> <span className="text-xs text-nuit-600/60">{m.de.match(/<(.+)>/)?.[1]}</span>
                      <div className="text-xs text-nuit-600/60">à {m.a}{m.cc && `, cc ${m.cc}`}</div></div>
                    <span className="text-xs text-nuit-600/60">{dateHeure(m.date)}</span>
                  </div>
                  <CorpsMail html={m.html} />
                  {m.pieces.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{m.pieces.map((p) => (
                    <button key={p.index} onClick={() => telechargerPj(m, p)} className="btn-clair py-1.5 text-xs">
                      {pj === m.id + p.index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}{p.nom} <span className="text-nuit-600/50">{taille(p.taille)}</span></button>
                  ))}</div>}
                </article>
              ))}
            </div>
          </div>

          {/* Commentaires internes */}
          <div className="carte p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4 text-or" />Commentaires internes <span className="font-normal text-nuit-600/60">(invisibles de l'expéditeur)</span></h3>
            <div className="space-y-2">
              {fil.commentaires.map((c) => (
                <div key={c.id} className="rounded-lg bg-nuit-50/60 px-3 py-2 text-sm"><div className="text-xs text-nuit-600/70"><strong>{c.auteur}</strong> · {dateRelative(c.date)}</div><div className="whitespace-pre-wrap">{c.texte}</div></div>
              ))}
            </div>
            <form onSubmit={commenter} className="mt-2 flex gap-2">
              <input className="champ" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Ajouter un commentaire…" />
              <button className="btn-principal" disabled={!commentaire.trim()}>Envoyer</button>
            </form>
          </div>
        </div>
      )}
      {creation && <DossierDepuisMail fil={fil} premier={premier} typeInitial={typeof creation === 'string' ? creation : 'bapteme'} onFermer={() => setCreation(false)} onCree={(d) => { notifier('Dossier créé'); nav(`/dossiers/${d.id}`) }} />}
      {rdv && <EditionEvenement evenement={{ titre: rdv.sujet, lieu: '', description: '', journee: false, debut: new Date(Date.now() + 86400000).toISOString().slice(0, 11) + '10:00:00', fin: new Date(Date.now() + 86400000).toISOString().slice(0, 11) + '11:00:00' }}
        onFermer={() => setRdv(null)} onFait={(m) => { setRdv(null); notifier(m) }} />}
    </div>
  )
}

function EtiquettesTri({ tri }) {
  if (!tri || (!tri.categories?.length && !tri.prioritaire && !tri.auto)) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tri.prioritaire && <span className="pastille gap-0.5 bg-red-50 py-0 text-[10px] text-red-700"><AlertTriangle className="h-2.5 w-2.5" />Prioritaire</span>}
      {tri.categories.map((c) => <span key={c} className="pastille bg-or-50 py-0 text-[10px] text-or-600">{nomTri(c)}</span>)}
      {tri.auto && <span className="pastille gap-0.5 bg-emerald-50 py-0 text-[10px] text-emerald-700"><CheckCircle2 className="h-2.5 w-2.5" />Réponse auto</span>}
    </div>
  )
}

/** Bandeau « Tri automatique » : ce qui a été reconnu dans le mail et les actions proposées. */
function SuggestionsTri({ fil, premier, onRepondre, onDossier, onRdv, onSuivi }) {
  const nav = useNavigate()
  const notifier = useNotif()
  const { reglages, reponses } = useApp()
  const [occupe, setOccupe] = useState(false)
  const tri = fil.tri
  if (!tri || (!tri.categories?.length && !tri.prioritaire && !tri.auto)) return null
  const email = premier?.de.match(/<(.+)>/)?.[1] || premier?.de || ''
  const aDossier = !!fil.suivi?.dossier_id
  const existe = (cle) => reponses.some((r) => r.cle === cle)

  async function extrait() {
    setOccupe(true)
    try {
      const v = Object.fromEntries(B14.champs.map(([k]) => [k, '']))
      Object.assign(v, { paroisse: reglages.paroisse, diocese: reglages.diocese, fait_a: reglages.commune, fait_le: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), _demandeur: email })
      const x = await creerExtrait(v)
      if (!fil.suivi?.statut) await onSuivi({ statut: 'En cours' })
      nav(`/extraits/${x.id}`)
    } catch (e) { notifier(e.message, 'erreur'); setOccupe(false) }
  }

  const boutons = []
  tri.categories.forEach((cle) => {
    const c = TRI.find((x) => x.cle === cle)
    if (!c) return
    if (c.action === 'horaires' && !tri.auto) boutons.push(<button key={cle} className="btn-clair py-1.5 text-xs" onClick={() => onRepondre('horaires')}><Reply className="h-3.5 w-3.5" />Répondre : horaires</button>)
    if (c.action === 'extrait') boutons.push(<button key={cle} className="btn-or py-1.5 text-xs" disabled={occupe} onClick={extrait}>{occupe ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScrollText className="h-3.5 w-3.5" />}Créer l'extrait de baptême</button>)
    if (c.action === 'dossier' && !aDossier) boutons.push(<button key={cle} className="btn-or py-1.5 text-xs" onClick={() => onDossier(c.type)}><FolderPlus className="h-3.5 w-3.5" />Créer le dossier : {TYPES[c.type].nom.toLowerCase()}</button>)
    if (c.action === 'dossier' && c.reponse && existe(c.reponse)) boutons.push(<button key={cle + 'r'} className="btn-clair py-1.5 text-xs" onClick={() => onRepondre(c.reponse)}><Reply className="h-3.5 w-3.5" />Répondre : accusé de réception</button>)
    if (c.action === 'rendezvous') boutons.push(<button key={cle} className="btn-clair py-1.5 text-xs" onClick={onRdv}><CalendarPlus className="h-3.5 w-3.5" />Proposer un rendez-vous</button>)
    if (c.action === 'appmesse') boutons.push(<a key={cle} className="btn-clair py-1.5 text-xs" href={LIEN_APPMESSE} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />Ouvrir AppMESSE (intentions)</a>)
  })

  return (
    <div className={`carte space-y-2 border-l-4 p-4 ${tri.prioritaire ? 'border-l-red-600' : 'border-l-or'}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Wand2 className="h-4 w-4 text-or" /><span className="font-semibold">Tri automatique</span>
        {tri.categories.length > 0 && <span className="text-nuit-600">· {tri.categories.map(nomTri).join(', ')}</span>}
      </div>
      {tri.prioritaire && <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Mail sensible (décès, maladie, urgence…) : aucune réponse automatique, à traiter en priorité.</p>}
      {tri.auto && <p className="flex items-start gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />La réponse type « Horaires » a été envoyée automatiquement ({reglages.url_horaires}). Elle apparaît dans le fil ci-dessous.</p>}
      {boutons.length > 0 && <div className="flex flex-wrap gap-2">{boutons}</div>}
    </div>
  )
}

function DossierDepuisMail({ fil, premier, typeInitial = 'bapteme', onFermer, onCree }) {
  const [type, setType] = useState(typeInitial)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const email = premier?.de.match(/<(.+)>/)?.[1] || premier?.de || ''
  async function creer() {
    setEnvoi(true)
    try { onCree(await api('dossiers.creer', { type, filId: fil.id, source: 'Mail : ' + fil.sujet, nom: nomExpediteur(premier?.de || ''), infos: { email, message: premier?.texte?.slice(0, 2000) || '' } })) }
    catch (e) { setErreur(e); setEnvoi(false) }
  }
  return (
    <Modale titre="Créer un dossier depuis ce mail" onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={envoi} onClick={creer}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Créer</button></>}>
      <p className="mb-3 text-sm text-nuit-600">Le mail sera rattaché au dossier ; l'adresse <strong>{email}</strong> et le message seront repris.</p>
      <div className="grid gap-2">{ORDRE_TYPES.map((t) => (
        <label key={t} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${type === t ? 'border-or bg-or-50' : 'border-nuit-100'}`}>
          <input type="radio" checked={type === t} onChange={() => setType(t)} /><span className="h-3 w-3 rounded-full" style={{ background: TYPES[t].couleur }} />{TYPES[t].nom}
        </label>
      ))}</div>
      <div className="mt-3"><Erreur erreur={erreur} /></div>
    </Modale>
  )
}

function CorpsMail({ html }) {
  const [hauteur, setHauteur] = useState(200)
  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{font-family:Inter,system-ui,sans-serif;font-size:14px;color:#161e33;margin:0;word-wrap:break-word}img{max-width:100%;height:auto}blockquote{border-left:3px solid #d9dfec;margin:0 0 0 4px;padding-left:10px;color:#555}</style></head><body>${html}</body></html>`
  return <iframe title="message" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} className="w-full" style={{ height: hauteur }}
    onLoad={(e) => { try { setHauteur(e.target.contentDocument.body.scrollHeight + 20) } catch { /* ignore */ } }} />
}

/** Aperçu de la signature (même rendu que dans le mail envoyé). */
export function ApercuSignature({ sig, reglages }) {
  if (!sig) return null
  return (
    <div className="font-[Arial] text-[13px]" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="text-[14px] font-bold text-[#222]">{sig.nom}</div>
      {sig.fonction && <div className="text-[#777]">{sig.fonction}</div>}
      <div className="my-2.5 border-t-2 border-[#1a73e8]" />
      <div className="space-y-1 text-[#777]">
        <div>✉&nbsp; <u>{sig.email}</u></div><div>☎&nbsp; <u>{sig.telephone}</u></div><div>⌖&nbsp; {reglages.adresse}</div>
        <div>🔗&nbsp; <b className="text-[#1a73e8] underline">{reglages.site}</b></div>
      </div>
      <div className="mt-2.5 border-t-2 border-[#1a73e8]" />
    </div>
  )
}

/**
 * Rédaction d'un mail : nouveau, réponse, ou depuis un dossier.
 * props : mode ('nouveau' | 'repondre' | 'tous'), fil, dossier, a, sujet, corps, reponse (clé de réponse type), contexte
 */
export function Redaction({ mode, fil, dossier, a: aInit = '', sujet: sujetInit = '', corps: corpsInit = '', reponse, contexte = {}, onFermer, onEnvoye, envoiPersonnalise, noteJointe, destinataires, bouton, boutons: boutonsInit }) {
  const boutons = boutonsInit || (bouton ? [bouton] : [])
  const { utilisateur, signatures, reponses, reglages } = useApp()
  const dernier = fil?.messages?.[fil.messages.length - 1]
  const ctx = { nom: dossier?.nom || (dernier ? nomExpediteur(dernier.de) : ''), type: dossier ? TYPES[dossier.type].nom.toLowerCase() : '', url_horaires: reglages.url_horaires, ...contexte }
  const modele = reponses.find((r) => r.cle === reponse)
  const [a, setA] = useState(aInit)
  const [cc, setCc] = useState('')
  const [sujet, setSujet] = useState(modele ? remplirModele(modele.sujet, ctx) : sujetInit)
  const [corps, setCorps] = useState(modele ? remplirModele(modele.corps, ctx) : corpsInit)
  const [signature, setSignature] = useState(utilisateur.signature || signatures[0]?.cle || '')
  const [fichiers, setFichiers] = useState([])
  const [docs, setDocs] = useState([])
  const [choixDoc, setChoixDoc] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  function appliquerModele(cle) {
    const m = reponses.find((r) => r.cle === cle)
    if (!m) return
    if (mode === 'nouveau') setSujet(remplirModele(m.sujet, ctx))
    setCorps(remplirModele(m.corps, ctx))
  }
  async function envoyer() {
    setEnvoi(true); setErreur(null)
    try {
      if (envoiPersonnalise) { onEnvoye(await envoiPersonnalise({ a, sujet, corps, signature })); return }
      const pieces = await Promise.all(fichiers.map(async (f) => ({ nom: f.name, type: f.type, base64: await fichierEnBase64(f) })))
      const r = await api('mail.envoyer', { a, cc, sujet, corps, signature, fichiers: pieces, documentsDrive: docs.map((d) => d.id),
        filId: mode === 'nouveau' ? undefined : fil.id, tous: mode === 'tous', dossierId: dossier?.id, boutons })
      onEnvoye(r)
    } catch (e) { setErreur(e) } finally { setEnvoi(false) }
  }

  return (
    <Modale large titre={mode === 'nouveau' ? 'Nouveau message' : `Réponse${mode === 'tous' ? ' à tous' : ''}`} onFermer={onFermer}
      pied={<>
        {envoiPersonnalise ? <span className="mr-auto" /> : <>
        <label className="btn-clair mr-auto cursor-pointer"><Paperclip className="h-4 w-4" /><span className="hidden sm:inline">Fichier</span>
          <input type="file" multiple className="hidden" onChange={(e) => setFichiers([...fichiers, ...e.target.files])} /></label>
        <button className="btn-clair" onClick={() => setChoixDoc(true)}><FolderOpen className="h-4 w-4" /><span className="hidden sm:inline">Document</span></button></>}
        <button className="btn-principal" onClick={envoyer} disabled={envoi || (mode === 'nouveau' && !a && !destinataires)}>{envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Envoyer</button>
      </>}>
      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          {destinataires ? <>
            <p className="rounded-lg bg-or-50 px-3 py-2 text-sm text-or-600"><Users className="mr-1 inline h-4 w-4" />{destinataires}</p>
            <div><label className="etiquette">Objet</label><input className="champ" value={sujet} onChange={(e) => setSujet(e.target.value)} /></div>
          </> : mode === 'nouveau' ? <>
            <div><label className="etiquette">À</label><input className="champ" value={a} onChange={(e) => setA(e.target.value)} placeholder="adresse@exemple.fr" /></div>
            <div><label className="etiquette">Cc</label><input className="champ" value={cc} onChange={(e) => setCc(e.target.value)} /></div>
            <div><label className="etiquette">Objet</label><input className="champ" value={sujet} onChange={(e) => setSujet(e.target.value)} /></div>
          </> : <p className="text-sm text-nuit-600">À : <strong>{dernier ? nomExpediteur(dernier.de) : ''}</strong> — {fil.sujet}</p>}
          <textarea className="champ min-h-[260px] font-sans" value={corps} onChange={(e) => setCorps(e.target.value)} autoFocus />
          {boutons.length > 0 && <div className="space-y-1.5 text-xs text-nuit-600/70"><div>Boutons du mail (placés là où le texte indique « [Bouton : …] », sinon à la fin) :</div>
            {boutons.map((b) => <div key={b.texte}>{!b.imageSeule && <span className="inline-block rounded-lg bg-nuit px-4 py-2 text-sm font-semibold text-white">{b.texte}</span>}{b.image && <img src={b.image} alt="" className="mt-1.5 w-72 rounded-lg border border-nuit-100" />}</div>)}</div>}
          {noteJointe && <span className="pastille gap-1 bg-or-50 text-or-600"><Paperclip className="h-3 w-3" />{noteJointe}</span>}
          {(fichiers.length > 0 || docs.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {fichiers.map((f, i) => <span key={'f' + i} className="pastille gap-1 bg-nuit-50 text-nuit"><Paperclip className="h-3 w-3" />{f.name}<button onClick={() => setFichiers(fichiers.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button></span>)}
              {docs.map((d) => <span key={d.id} className="pastille gap-1 bg-or-50 text-or-600"><FolderOpen className="h-3 w-3" />{d.nom}<button onClick={() => setDocs(docs.filter((x) => x.id !== d.id))}><X className="h-3 w-3" /></button></span>)}
            </div>
          )}
          <Erreur erreur={erreur} />
        </div>
        <div className="space-y-3">
          <div><label className="etiquette">Réponse type</label>
            <select className="champ py-1.5" defaultValue="" onChange={(e) => appliquerModele(e.target.value)}>
              <option value="">Choisir…</option>{reponses.map((r) => <option key={r.cle} value={r.cle}>{r.titre}</option>)}
            </select></div>
          <div><label className="etiquette">Signature</label>
            <select className="champ py-1.5" value={signature} onChange={(e) => setSignature(e.target.value)}>
              {signatures.map((s) => <option key={s.cle} value={s.cle}>{s.nom}</option>)}
            </select></div>
          <div className="rounded-lg border border-nuit-100 bg-white p-3"><ApercuSignature sig={signatures.find((s) => s.cle === signature)} reglages={reglages} /></div>
          <p className="text-[11px] text-nuit-600/60">Envoyé depuis secretariat@croix-glorieuse.org{dossier ? ' · rattaché au dossier' : ''}.</p>
        </div>
      </div>
      {choixDoc && <ChoisirDocument onFermer={() => setChoixDoc(false)} onChoix={(d) => { setDocs([...docs, d]); setChoixDoc(false) }} />}
    </Modale>
  )
}

function EnvoiGroupe({ onFermer }) {
  const notifier = useNotif()
  const { utilisateur, signatures } = useApp()
  const [groupes, setGroupes] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [f, setF] = useState({ groupe: '', sujet: '', corps: '', signature: utilisateur.signature || 'paroisse' })
  const [verif, setVerif] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  useEffect(() => { api('mail.groupes').then(setGroupes).catch(setErreur) }, [])
  const maj = (k) => (e) => { setF({ ...f, [k]: e.target.value }); if (k === 'groupe') setVerif(null) }

  async function verifier() {
    setEnvoi(true); setErreur(null)
    try { setVerif(await api('mail.envoiGroupe', { ...f, essai: true })) } catch (e) { setErreur(e) } finally { setEnvoi(false) }
  }
  async function envoyer() {
    setEnvoi(true); setErreur(null)
    try { const r = await api('mail.envoiGroupe', f); notifier(`Envoyé à ${r.nb} personnes`); onFermer() } catch (e) { setErreur(e); setEnvoi(false) }
  }
  return (
    <Modale large titre="Envoi groupé" onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button>
        {verif ? <button className="btn-or" onClick={envoyer} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Envoyer à {verif.nb} personnes</button>
          : <button className="btn-principal" onClick={verifier} disabled={envoi || !f.groupe || !f.sujet || !f.corps}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Vérifier</button>}</>}>
      <div className="space-y-3">
        <p className="text-xs text-nuit-600/70">Les destinataires sont en copie cachée (ils ne voient pas les autres adresses). Groupes issus de Google Contacts, 99 personnes au plus.</p>
        <div><label className="etiquette">Groupe de contacts</label>
          {!groupes && !erreur ? <Chargement /> : <select className="champ" value={f.groupe} onChange={maj('groupe')}>
            <option value="">Choisir…</option>{(groupes || []).map((g) => <option key={g.id} value={g.id}>{g.nom} ({g.nb})</option>)}
          </select>}</div>
        <div><label className="etiquette">Objet</label><input className="champ" value={f.sujet} onChange={maj('sujet')} /></div>
        <textarea className="champ min-h-[200px]" value={f.corps} onChange={maj('corps')} placeholder="Message…" />
        <div><label className="etiquette">Signature</label><select className="champ" value={f.signature} onChange={maj('signature')}>{signatures.map((s) => <option key={s.cle} value={s.cle}>{s.nom}</option>)}</select></div>
        {verif && <p className="rounded-lg bg-or-50 p-3 text-sm text-or-600">{verif.nb} adresses trouvées · quota restant aujourd'hui : {verif.quota}.</p>}
        <Erreur erreur={erreur} />
      </div>
    </Modale>
  )
}
