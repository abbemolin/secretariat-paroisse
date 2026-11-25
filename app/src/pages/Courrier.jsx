import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Inbox, Star, AlertTriangle, CheckCircle2, ScrollText, ExternalLink, Wand2, Send, MailOpen, Search, ArrowLeft, Reply, ReplyAll, Archive, Trash2, Paperclip, PenSquare, Download, Loader2, X, FolderOpen, Mail, UserCheck, ListTodo, Users, MessageSquare, FolderPlus, CalendarPlus, FolderHeart, CheckSquare, Square, Mail as MailFerme, Maximize2, Sparkles, Eye, Contact } from 'lucide-react'
import { api, enCache, fichierEnBase64, precharger, telechargerBase64 } from '../api.js'
import { useApp } from '../App.jsx'
import { TYPES, ORDRE_TYPES, remplirModele } from '../types.js'
import { Chargement, Erreur, Vide, Modale, useNotif, useDifferer, Aide, dateRelative, dateHeure, nomExpediteur, taille, COULEURS_STATUT, initiales } from '../ui.jsx'
import { useActualisation } from '../actualisation.js'
import { ChoisirDocument } from './Documents.jsx'
import { EditionEvenement } from './Agenda.jsx'
import { creerExtrait } from './Extraits.jsx'
import { B14 } from '../imprimables.js'
import { LIEN_APPMESSE } from '../appmesse.js'
import { EnvoiContacts } from '../envoiContacts.jsx'

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
/** Réponse type suggérée d'après le tri automatique (baptême, mariage, horaires…). */
export function reponseSuggeree(fil, reponses) {
  for (const cle of fil?.tri?.categories || []) {
    const c = TRI.find((x) => x.cle === cle)
    if (!c?.reponse || (c.action === 'horaires' && fil.tri.auto)) continue
    const r = reponses.find((x) => x.cle === c.reponse)
    if (r) return r
  }
  return null
}
const STATUTS = ['À traiter', 'En cours', 'Traité']
// Mails déjà lus pendant la session : réaffichés aussitôt (mémoire seulement, rien n'est gardé sur l'appareil)
const FILS_VUS = new Map()
/** Lecture anticipée d'un mail (survol, mails suivants) : il reste non lu. */
const anticiper = (id) => { if (id && !FILS_VUS.has(id)) precharger('mail.fil', { id }, { appel: { action: 'mail.fil', payload: { id, sansLu: true } }, garder: false }) }

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
  const differer = useDifferer()
  const [fils, setFils] = useState(() => enCache('mail.liste', { filtre, libelle, recherche: '', debut: 0 })?.fils || [])
  const [suivant, setSuivant] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [libelles, setLibelles] = useState([])
  const [redaction, setRedaction] = useState(null)
  const [groupe, setGroupe] = useState(false)
  const [version, setVersion] = useState(0)       // relit le fil ouvert après un envoi
  const [choix, setChoix] = useState(null)        // sélection multiple : Set d'ids (null = mode normal)
  const { utilisateurs, utilisateur } = useApp()
  const basculer = (id) => setChoix((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const changer = (p) => setParams(Object.fromEntries(Object.entries({ filtre, libelle, fil: ouvert, ...p }).filter(([, v]) => v)))

  async function charger(debut = 0) {
    setChargement(true); setErreur(null)
    if (!debut && !recherche) { const c = enCache('mail.liste', { filtre, libelle, recherche: '', debut: 0 }); if (c) { setFils(c.fils); setSuivant(c.suivant) } }
    try {
      const r = await api('mail.liste', { filtre, libelle, recherche, debut })
      setFils((f) => (debut ? [...f, ...r.fils] : r.fils)); setSuivant(r.suivant)
    } catch (e) { setErreur(e) } finally { setChargement(false) }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(0); setChoix(null) }, [filtre, libelle])
  useEffect(() => { api('mail.libelles').then(setLibelles).catch(() => {}) }, [])
  // Actualisation automatique : nouveaux mails en tête de liste (les pages déjà chargées restent), fil ouvert relu
  useActualisation(async () => {
    if (recherche || chargement || choix) return
    try {
      const r = await api('mail.liste', { filtre, libelle, recherche: '', debut: 0 })
      setFils((f) => [...r.fils, ...f.slice(r.fils.length).filter((x) => !r.fils.some((y) => y.id === x.id))])
      if (ouvert) setVersion((v) => v + 1)
    } catch { /* ignore */ }
  })

  async function agir(fil, modif, message) {
    if (modif.archiver || modif.corbeille) {
      const avant = fils
      setFils((l) => l.filter((x) => x.id !== fil.id)); changer({ fil: '' })
      differer(message, () => api('mail.modifier', { id: fil.id, ...modif }), { onAnnule: () => { setFils(avant); changer({ fil: fil.id }) }, onErreur: () => setFils(avant) })
      return
    }
    if (modif.important !== undefined) setFils((l) => l.map((x) => (x.id === fil.id ? { ...x, important: modif.important } : x)))   // aussitôt
    try {
      await api('mail.modifier', { id: fil.id, ...modif })
      if (modif.archiver || modif.corbeille) { setFils((l) => l.filter((x) => x.id !== fil.id)); changer({ fil: '' }) }
      else setFils((l) => l.map((x) => (x.id === fil.id ? { ...x, ...(modif.important !== undefined ? { important: modif.important } : {}), ...(modif.nonLu ? { nonLu: true } : {}) } : x)))
      // Annulable : étoile, non lu
      const inverse = modif.nonLu ? { lu: true } : modif.important !== undefined ? { important: !modif.important } : null
      if (message || modif.nonLu) notifier(message || 'Marqué non lu', 'ok', inverse ? { action: { label: 'Annuler', fn: async () => {
        await api('mail.modifier', { id: fil.id, ...inverse }).catch(() => {})
        setFils((l) => l.map((x) => (x.id === fil.id ? { ...x, ...(inverse.lu ? { nonLu: false } : { important: inverse.important }) } : x)))
      } } } : {})
    } catch (e) { notifier(e.message, 'erreur') }
  }
  const majSuivi = (id, suivi) => setFils((l) => l.map((x) => (x.id === id ? { ...x, suivi } : x)))

  /** Actions sur la sélection (chacune annulable). */
  async function lot(action, valeur) {
    const ids = [...choix], sel = fils.filter((f) => choix.has(f.id)), avant = fils
    const n = ids.length, s = n > 1 ? 's' : ''
    if (action === 'archiver' || action === 'corbeille') {
      setFils((l) => l.filter((x) => !choix.has(x.id))); setChoix(null); if (choix.has(ouvert)) changer({ fil: '' })
      differer(action === 'archiver' ? `${n} mail${s} archivé${s}` : `${n} mail${s} mis à la corbeille`, () => api('mail.lot', { ids, modif: { [action]: true } }),
        { onAnnule: () => setFils(avant), onErreur: () => setFils(avant) })
      return
    }
    try {
      if (action === 'lu' || action === 'nonLu') {
        await api('mail.lot', { ids, modif: { [action]: true } })
        setFils((l) => l.map((x) => (choix.has(x.id) ? { ...x, nonLu: action === 'nonLu' } : x))); setChoix(null)
        notifier(action === 'lu' ? `${n} marqué${s} lu${s}` : `${n} marqué${s} non lu${s}`, 'ok', { action: { label: 'Annuler', fn: async () => {
          await Promise.all(sel.map((f) => api('mail.modifier', { id: f.id, [f.nonLu ? 'nonLu' : 'lu']: true }))).catch(() => {}); setFils((l) => l.map((x) => sel.find((y) => y.id === x.id) || x))
        } } })
      } else {
        const suivi = action === 'statut' ? { statut: valeur } : { attribue_a: valeur }
        const r = await api('mail.lot', { ids, suivi })
        setFils((l) => l.map((x) => (r.suivis[x.id] ? { ...x, suivi: r.suivis[x.id] } : x))); setChoix(null)
        notifier(action === 'statut' ? `${n} mail${s} : ${valeur || 'sans statut'}` : valeur ? `${n} mail${s} attribué${s} à ${nomUtilisateur(valeur)}` : `Attribution retirée (${n})`, 'ok', { action: { label: 'Annuler', fn: async () => {
          for (const f of sel) await api('mail.suivi', { filId: f.id, statut: f.suivi?.statut || '', attribue_a: f.suivi?.attribue_a || '' }).catch(() => {})
          setFils((l) => l.map((x) => sel.find((y) => y.id === x.id) || x))
        } } })
      }
    } catch (e) { notifier(e.message, 'erreur') }
  }

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
            <Aide className="self-center">Les mails entrants sont classés par mots-clés toutes les 5 minutes. Seules les demandes d'horaires reçoivent une réponse automatique ; un mot sensible place le mail en « Prioritaire ». Règles : Réglages → Tri automatique.</Aide>
            {libelles.length > 0 && (
              <select className={`champ py-1.5 text-xs ${libelle && !libelle.startsWith('Tri/') ? 'border-or bg-or-50' : ''}`} value={libelle.startsWith('Tri/') ? '' : libelle} onChange={(e) => changer({ libelle: e.target.value, fil: '' })}>
                <option value="">Libellés…</option>{libelles.map((l) => <option key={l}>{l}</option>)}
              </select>
            )}
          </div>
          <Erreur erreur={erreur} reessayer={() => charger(0)} />
          {choix ? (
            <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-1 rounded-xl bg-nuit px-2 py-1.5 text-white shadow">
              <button className="rounded-lg p-1.5 hover:bg-white/10" title="Quitter la sélection" onClick={() => setChoix(null)}><X className="h-4 w-4" /></button>
              <button className="mr-auto rounded-lg px-1.5 py-1 text-sm hover:bg-white/10" onClick={() => setChoix(choix.size === fils.length ? new Set() : new Set(fils.map((f) => f.id)))}>{choix.size} sélectionné{choix.size > 1 ? 's' : ''} · {choix.size === fils.length ? 'aucun' : 'tous'}</button>
              {choix.size > 0 && <>
                <button className="rounded-lg p-1.5 hover:bg-white/10" title="Marquer lu" onClick={() => lot('lu')}><MailOpen className="h-4 w-4" /></button>
                <button className="rounded-lg p-1.5 hover:bg-white/10" title="Marquer non lu" onClick={() => lot('nonLu')}><MailFerme className="h-4 w-4" /></button>
                <select className="max-w-[7.5rem] rounded-lg border-0 bg-white/10 py-1 pl-2 pr-6 text-xs text-white" value="" onChange={(e) => e.target.value && lot('attribuer', e.target.value === '-' ? '' : e.target.value)} title="Attribuer">
                  <option value="" className="text-nuit">Attribuer…</option>{utilisateurs.map((u) => <option key={u.id} value={u.id} className="text-nuit">{u.nom}{u.id === utilisateur.id ? ' (moi)' : ''}</option>)}<option value="-" className="text-nuit">Personne</option>
                </select>
                <select className="max-w-[6.5rem] rounded-lg border-0 bg-white/10 py-1 pl-2 pr-6 text-xs text-white" value="" onChange={(e) => e.target.value && lot('statut', e.target.value === '-' ? '' : e.target.value)} title="Statut">
                  <option value="" className="text-nuit">Statut…</option>{STATUTS.map((x) => <option key={x} className="text-nuit">{x}</option>)}<option value="-" className="text-nuit">Aucun</option>
                </select>
                <button className="rounded-lg p-1.5 hover:bg-white/10" title="Archiver" onClick={() => lot('archiver')}><Archive className="h-4 w-4" /></button>
                <button className="rounded-lg p-1.5 text-red-200 hover:bg-white/10" title="Corbeille" onClick={() => lot('corbeille')}><Trash2 className="h-4 w-4" /></button>
              </>}
            </div>
          ) : fils.length > 0 && (
            <div className="mb-1 flex justify-end"><button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-nuit-600 hover:bg-nuit-50" onClick={() => setChoix(new Set())}><CheckSquare className="h-3.5 w-3.5" />Sélectionner</button></div>
          )}
          <div className="carte divide-y divide-nuit-50 overflow-hidden">
            {chargement && !fils.length ? <Chargement /> : !fils.length ? <Vide icone={Mail} texte="Aucun message." /> : fils.map((f) => (
              <button key={f.id} onPointerEnter={() => !choix && anticiper(f.id)} onTouchStart={() => !choix && anticiper(f.id)} onClick={() => (choix ? basculer(f.id) : changer({ fil: f.id }))} className={`block w-full px-4 py-3 text-left transition hover:bg-nuit-50/60 ${choix?.has(f.id) ? 'bg-or-50' : ouvert === f.id && !choix ? 'bg-or-50' : ''}`}>
                <div className="flex items-center gap-2">
                  {choix && (choix.has(f.id) ? <CheckSquare className="h-4 w-4 shrink-0 text-or-600" /> : <Square className="h-4 w-4 shrink-0 text-nuit-600/40" />)}
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
          <Fil key={ouvert + ':' + version} id={ouvert} suivants={fils.slice(fils.findIndex((x) => x.id === ouvert) + 1).slice(0, 2).map((x) => x.id)} onRetour={() => changer({ fil: '' })} onAgir={agir} onSuivi={majSuivi} onLu={(id) => setFils((l) => l.map((x) => (x.id === id ? { ...x, nonLu: false } : x)))}
            onRepondre={(fil, tous, reponse, corps) => setRedaction({ mode: tous ? 'tous' : 'repondre', fil, reponse, corps })} />
        ) : <div className="carte hidden flex-1 lg:block"><Vide icone={MailOpen} texte="Sélectionnez un message." /></div>}
      </div>
      {redaction && <Redaction {...redaction} onFermer={() => setRedaction(null)} onEnvoye={(r) => {
        setRedaction(null); notifier(r?.suivi ? 'Message envoyé · mail passé à « Traité »' : 'Message envoyé')
        if (r?.suivi && redaction.fil) majSuivi(redaction.fil.id, r.suivi)
        setVersion((v) => v + 1)
      }} />}
      {groupe && <EnvoiContacts onFermer={() => setGroupe(false)} />}
    </>
  )
}

function Fil({ id, onRetour, onAgir, onRepondre, onSuivi, onLu, suivants = [] }) {
  const notifier = useNotif()
  const nav = useNavigate()
  const { utilisateurs, utilisateur, nomUtilisateur } = useApp()
  const [fil, setFil] = useState(() => FILS_VUS.get(id) || null)
  const [erreur, setErreur] = useState(null)
  const [pj, setPj] = useState(null)
  const [apercu, setApercu] = useState(null)   // pièce jointe ouverte dans l'appli
  const [commentaire, setCommentaire] = useState('')
  const [creation, setCreation] = useState(false)
  const [rdv, setRdv] = useState(null)
  const zoneReponse = useRef(null)
  const lire = () => api('mail.fil', { id }).then((f) => {
    if (f.nonLu) { api('mail.modifier', { id, lu: true }).catch(() => {}); f = { ...f, nonLu: false } }   // lu en avance : marqué lu maintenant
    FILS_VUS.set(id, f); setFil(f); onLu?.(id)
  })
  useEffect(() => {
    setFil(FILS_VUS.get(id) || null); setCreation(false); setErreur(null)
    lire().catch((e) => { if (!FILS_VUS.has(id)) setErreur(e) })
    const t = setTimeout(() => suivants.forEach(anticiper), 1200)   // les mails suivants, en avance
    return () => clearTimeout(t)
  }, [id])   // eslint-disable-line react-hooks/exhaustive-deps

  /** PDF et images : aperçu dans l'appli ; autres fichiers : téléchargés. */
  async function ouvrirPj(m, p) {
    setPj(m.id + p.index)
    try {
      const f = await api('mail.piecejointe', { messageId: m.id, index: p.index })
      if (/^(application\/pdf|image\/(png|jpe?g|gif|webp|svg\+xml))$/i.test(f.type) || /\.(pdf|png|jpe?g|gif|webp)$/i.test(f.nom)) setApercu(f)
      else telechargerBase64(f)
    } catch (e) { notifier(e.message, 'erreur') } finally { setPj(null) }
  }
  /** Statut, attribution… (annulable). */
  async function suivi(modif, msg) {
    const avant = fil?.suivi
    // Affiché aussitôt ; remis comme avant si le serveur refuse
    const prevu = { statut: '', attribue_a: '', dossier_id: '', ...avant, ...modif }
    if (modif.attribue_a && !prevu.statut) prevu.statut = 'À traiter'
    setFil((f) => ({ ...f, suivi: prevu })); onSuivi(id, prevu)
    try {
      const s = await api('mail.suivi', { filId: id, ...modif }); setFil((f) => ({ ...f, suivi: s })); onSuivi(id, s)
      if (msg) notifier(msg, 'ok', avant !== undefined && (modif.statut !== undefined || modif.attribue_a !== undefined) ? { action: { label: 'Annuler', fn: async () => {
        const r = await api('mail.suivi', { filId: id, statut: avant?.statut || '', attribue_a: avant?.attribue_a || '' }).catch(() => null)
        if (r) { setFil((f) => ({ ...f, suivi: r })); onSuivi(id, r) }
      } } } : {})
    }
    catch (e) { setFil((f) => ({ ...f, suivi: avant })); onSuivi(id, avant); notifier(e.message, 'erreur') }
  }
  async function commenter(e) {
    e.preventDefault()
    if (!commentaire.trim()) return
    // Affiché aussitôt, confirmé par le serveur
    const texte = commentaire, tmp = { id: 'tmp' + Date.now(), auteur: utilisateur.nom, date: new Date().toISOString(), texte }
    setFil((f) => ({ ...f, commentaires: [...f.commentaires, tmp] })); setCommentaire('')
    try { const c = await api('mail.commenter', { filId: id, texte }); setFil((f) => ({ ...f, commentaires: f.commentaires.map((x) => (x.id === tmp.id ? c : x)) })) }
    catch (err) { setFil((f) => ({ ...f, commentaires: f.commentaires.filter((x) => x.id !== tmp.id) })); setCommentaire(texte); notifier(err.message, 'erreur') }
  }
  const premier = fil?.messages?.[0]

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <button className="btn-icone lg:hidden" onClick={onRetour}><ArrowLeft className="h-5 w-5" /></button>
        {fil && <>
          <button className="btn-clair" onClick={() => zoneReponse.current?.ouvrir()}><Reply className="h-4 w-4" />Répondre</button>
          <button className="btn-icone" title="Répondre à tous" onClick={() => onRepondre(fil, true)}><ReplyAll className="h-4 w-4" /></button>
          <button className="btn-icone" title="Suivre (étoile)" onClick={() => { setFil((f) => ({ ...f, important: !f.important })); onAgir(fil, { important: !fil.important }, fil.important ? 'Étoile retirée' : 'Étoile ajoutée') }}><Star className={`h-4 w-4 ${fil.important ? 'fill-or text-or' : ''}`} /></button>
          <button className="btn-icone" title="Marquer non lu" onClick={() => { onAgir(fil, { nonLu: true }); onRetour() }}><MailFerme className="h-4 w-4" /></button>
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
                <option value="">—</option>{STATUTS.map((s) => <option key={s}>{s}</option>)}
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
            {fil.contacts?.length > 0 && <div className="-mt-1 mb-3 flex flex-wrap gap-1.5">{fil.contacts.map((c) => <Link key={c.id} to={`/contacts/${c.id}`} className="pastille gap-1 bg-or-50 text-or-600 hover:bg-or-100" title={c.email}><Contact className="h-3 w-3" />{c.nom}</Link>)}</div>}
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
                    <button key={p.index} onClick={() => ouvrirPj(m, p)} className="btn-clair py-1.5 text-xs" title={/pdf|image/.test(p.type || '') ? 'Aperçu' : 'Télécharger'}>
                      {pj === m.id + p.index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : /pdf|image/.test(p.type || '') ? <Eye className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}{p.nom} <span className="text-nuit-600/50">{taille(p.taille)}</span></button>
                  ))}</div>}
                </article>
              ))}
            </div>
          </div>

          <ReponseRapide key={fil.id} ref={zoneReponse} fil={fil} onPlus={(texte, cle) => onRepondre(fil, false, cle, texte)}
            onEnvoye={(r) => { if (r?.suivi) { setFil((f) => ({ ...f, suivi: r.suivi })); onSuivi(id, r.suivi) } lire().catch(() => {}) }} />

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
      {apercu && <ApercuPiece piece={apercu} onFermer={() => setApercu(null)} />}
      {creation && <DossierDepuisMail fil={fil} premier={premier} typeInitial={typeof creation === 'string' ? creation : 'bapteme'} onFermer={() => setCreation(false)} onCree={(d) => { notifier('Dossier créé'); nav(`/dossiers/${d.id}`) }} />}
      {rdv && <EditionEvenement evenement={{ titre: rdv.sujet, lieu: '', description: '', journee: false, debut: new Date(Date.now() + 86400000).toISOString().slice(0, 11) + '10:00:00', fin: new Date(Date.now() + 86400000).toISOString().slice(0, 11) + '11:00:00' }}
        onFermer={() => setRdv(null)} onFait={(m) => { setRdv(null); notifier(m) }} />}
    </div>
  )
}

/** Réponse rapide, sous le fil : texte, réponse type (suggérée d'après le tri), signature ; 10 s pour annuler l'envoi. */
const ReponseRapide = forwardRef(function ReponseRapide({ fil, onPlus, onEnvoye }, ref) {
  const { utilisateur, signatures, reponses, reglages } = useApp()
  const differer = useDifferer()
  const notifier = useNotif()
  const [texte, setTexte] = useState('')
  const [ouvert, setOuvert] = useState(false)
  const [signature, setSignature] = useState(utilisateur.signature || signatures[0]?.cle || '')
  const [enAttente, setEnAttente] = useState(false)
  const champ = useRef(null)
  const dernier = fil.messages[fil.messages.length - 1]
  const nom = nomExpediteur(dernier?.de || '')
  const suggestion = reponseSuggeree(fil, reponses)
  const ctx = { nom, type: '', url_horaires: reglages.url_horaires }
  const ouvrir = () => { setOuvert(true); setTimeout(() => { champ.current?.focus(); champ.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, 50) }
  useImperativeHandle(ref, () => ({ ouvrir }))
  useEffect(() => { const c = champ.current; if (c) { c.style.height = 'auto'; c.style.height = Math.min(Math.max(c.scrollHeight, 120), 480) + 'px' } }, [texte, ouvert])
  const appliquer = (cle) => { const r = reponses.find((x) => x.cle === cle); if (r) { setTexte(remplirModele(r.corps, ctx)); ouvrir() } }

  function envoyer() {
    const corps = texte
    if (!corps.trim()) return
    setTexte(''); setOuvert(false); setEnAttente(true)
    const reprendre = () => { setTexte(corps); setOuvert(true); setEnAttente(false) }
    differer('Envoi dans 10 secondes…', async () => {
      const r = await api('mail.envoyer', { corps, signature, filId: fil.id })
      setEnAttente(false)
      notifier(r?.suivi ? 'Message envoyé · mail passé à « Traité »' : 'Message envoyé')
      onEnvoye(r)
    }, { delai: 10000, onAnnule: reprendre, onErreur: reprendre })
  }

  if (enAttente) return <div className="carte flex items-center gap-2 p-3 text-sm text-nuit-600"><Loader2 className="h-4 w-4 animate-spin text-or" />Réponse sur le point de partir — « Annuler » en bas de l'écran pour la reprendre.</div>
  if (!ouvert && !texte) return (
    <div className="carte flex flex-wrap items-center gap-2 p-3">
      <button className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-nuit-100 px-3 py-2.5 text-left text-sm text-nuit-600/70 hover:border-or" onClick={ouvrir}><Reply className="h-4 w-4 shrink-0" /><span className="truncate">Répondre à {nom}…</span></button>
      {suggestion && <button className="btn-clair py-2 text-xs" onClick={() => appliquer(suggestion.cle)} title="Réponse type suggérée d'après le tri automatique"><Sparkles className="h-3.5 w-3.5 text-or" />{suggestion.titre}</button>}
    </div>
  )
  return (
    <div className="carte p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-nuit-600">
        <Reply className="h-3.5 w-3.5" /><span>À : <strong>{nom}</strong></span><span className="flex-1" />
        {suggestion && !texte.trim() && <button className="pastille gap-1 border border-or/40 bg-or-50 py-1 text-or-600" onClick={() => appliquer(suggestion.cle)}><Sparkles className="h-3 w-3" />Suggestion : {suggestion.titre}</button>}
        <select className="champ w-auto py-1 text-xs" value="" onChange={(e) => appliquer(e.target.value)}><option value="">Réponse type…</option>{reponses.map((r) => <option key={r.cle} value={r.cle}>{r.titre}</option>)}</select>
      </div>
      <textarea ref={champ} className="champ resize-none font-sans" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Votre réponse…"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); envoyer() } }} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select className="champ w-auto py-1.5 text-xs" value={signature} onChange={(e) => setSignature(e.target.value)} title="Signature">{signatures.map((s) => <option key={s.cle} value={s.cle}>{s.nom}</option>)}</select>
        <span className="flex-1" />
        <button className="btn-icone" title="Plus d'options : pièces jointes, documents, copie…" onClick={() => onPlus(texte)}><Maximize2 className="h-4 w-4" /></button>
        <button className="btn-clair py-1.5" onClick={() => { setTexte(''); setOuvert(false) }}>Annuler</button>
        <button className="btn-principal py-1.5" disabled={!texte.trim()} onClick={envoyer} title="Ctrl + Entrée"><Send className="h-4 w-4" />Envoyer</button>
      </div>
    </div>
  )
})

/** Pièce jointe ouverte dans l'appli : PDF (pages dessinées, lisibles aussi sur téléphone) ou image. */
function ApercuPiece({ piece, onFermer }) {
  const [url] = useState(() => {
    const bin = atob(piece.base64), o = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i)
    return URL.createObjectURL(new Blob([o], { type: piece.type }))
  })
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const pdf = /pdf/i.test(piece.type) || /\.pdf$/i.test(piece.nom)
  const zone = useRef(null)
  const [etat, setEtat] = useState(pdf ? 'chargement' : '')
  useEffect(() => {
    if (!pdf) return
    let fini = false
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
        const doc = await pdfjs.getDocument({ url }).promise
        const largeur = Math.min(zone.current?.clientWidth || 700, 900)
        for (let n = 1; n <= Math.min(doc.numPages, 40) && !fini; n++) {
          const page = await doc.getPage(n)
          const v0 = page.getViewport({ scale: 1 }), k = largeur / v0.width, dpr = window.devicePixelRatio || 1
          const v = page.getViewport({ scale: k * dpr })
          const c = document.createElement('canvas')
          c.width = v.width; c.height = v.height; c.style.width = '100%'; c.className = 'mb-3 rounded border border-nuit-100 bg-white shadow-sm'
          await page.render({ canvasContext: c.getContext('2d'), viewport: v }).promise
          if (fini) return
          zone.current?.appendChild(c)
          if (n === 1) setEtat('')
        }
      } catch { if (!fini) setEtat('erreur') }
    })()
    return () => { fini = true }
  }, [pdf, url])
  return (
    <Modale large titre={piece.nom} onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Fermer</button><button className="btn-principal" onClick={() => telechargerBase64(piece)}><Download className="h-4 w-4" />Télécharger</button></>}>
      {pdf ? <>
        {etat === 'chargement' && <Chargement />}
        {etat === 'erreur' && <p className="text-sm text-nuit-600">Aperçu impossible pour ce PDF. <button className="underline" onClick={() => telechargerBase64(piece)}>Le télécharger</button></p>}
        <div ref={zone} className="mx-auto max-w-[900px]" />
      </> : <img src={url} alt={piece.nom} className="mx-auto max-h-[75vh] rounded-lg" />}
    </Modale>
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
  const [cache, setCache] = useState(false)
  const differer = useDifferer()

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
      const charge = { a, cc, sujet, corps, signature, fichiers: pieces, documentsDrive: docs.map((d) => d.id),
        filId: mode === 'nouveau' ? undefined : fil.id, tous: mode === 'tous', dossierId: dossier?.id, boutons }
      // 10 secondes pour annuler : la fenêtre se cache et revient telle quelle si on annule
      setCache(true)
      differer('Envoi dans 10 secondes…', async () => { const r = await api('mail.envoyer', charge); onEnvoye(r) },
        { delai: 10000, onAnnule: () => { setCache(false); setEnvoi(false) }, onErreur: (e) => { setCache(false); setEnvoi(false); setErreur(e) } })
    } catch (e) { setErreur(e); setEnvoi(false) }
  }
  const suggestion = mode !== 'nouveau' && !reponse && fil ? reponseSuggeree(fil, reponses) : null
  if (cache) return null

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
            <div><label className="etiquette">À</label><input className="champ" value={a} onChange={(e) => setA(e.target.value)} placeholder="adresse@exemple.fr ou nom d'un contact" list="contacts-adresses" autoComplete="off" />
              <AdressesContacts saisie={a} /></div>
            <div><label className="etiquette">Cc</label><input className="champ" value={cc} onChange={(e) => setCc(e.target.value)} /></div>
            <div><label className="etiquette">Objet</label><input className="champ" value={sujet} onChange={(e) => setSujet(e.target.value)} /></div>
          </> : <p className="text-sm text-nuit-600">À : <strong>{dernier ? nomExpediteur(dernier.de) : ''}</strong> — {fil.sujet}</p>}
          {suggestion && !corps.trim() && <button className="pastille gap-1 border border-or/40 bg-or-50 py-1 text-or-600" onClick={() => appliquerModele(suggestion.cle)}><Sparkles className="h-3 w-3" />Suggestion : {suggestion.titre}</button>}
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
          <div className="apercu-clair rounded-lg border border-nuit-100 bg-white p-3"><ApercuSignature sig={signatures.find((s) => s.cle === signature)} reglages={reglages} /></div>
          <p className="text-[11px] text-nuit-600/60">Envoyé depuis secretariat@croix-glorieuse.org{dossier ? ' · rattaché au dossier' : ''}.</p>
        </div>
      </div>
      {choixDoc && <ChoisirDocument onFermer={() => setChoixDoc(false)} onChoix={(d) => { setDocs([...docs, d]); setChoixDoc(false) }} />}
    </Modale>
  )
}

/** Destinataires proposés à partir des contacts (liste gardée sur l'appareil, chargée au besoin). */
function AdressesContacts({ saisie }) {
  const { peut } = useApp()
  const [liste, setListe] = useState(() => enCache('contacts.liste', {})?.contacts || null)
  useEffect(() => { if (!liste && peut('contacts')) api('contacts.liste').then((d) => setListe(d.contacts)).catch(() => {}) }, [liste, peut])
  // plusieurs adresses séparées par des virgules : la proposition complète la dernière
  const debut = String(saisie || '').includes(',') ? String(saisie).replace(/[^,]*$/, '').trim() + ' ' : ''
  return (
    <datalist id="contacts-adresses">
      {(liste || []).flatMap((c) => c.emails.map((m) => <option key={c.id + m} value={debut + m}>{[c.prenom, c.nom].filter(Boolean).join(' ') || c.organisation}</option>))}
    </datalist>
  )
}
