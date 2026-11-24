// Annonces : reprise de annonces.html (AppMesse) dans l'interface du secrétariat.
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Megaphone, Plus, Pencil, Trash2, Flag, Check, Circle, GripVertical, CalendarDays, Link2, Image as ImageIcon, Mail, Printer, Loader2, Upload, Copy, CopyPlus, MessageCircle, BellRing } from 'lucide-react'
import { api, fichierEnBase64 } from '../api.js'
import { Chargement, EnTete, Erreur, Interrupteur, Modale, Vide, useCharger, useConfirmer, useNotif } from '../ui.jsx'
import { isoLocal } from '../annonces/semaine.js'

const FILTRES = [['toutes', 'Toutes'], ['actives', 'Actives'], ['prioritaires', 'Prioritaires'], ['inactives', 'Inactives']]
const fmtDate = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')
const aujourdhui = () => isoLocal(new Date())

function prochainDimanche() {
  const d = new Date(), j = d.getDay()
  d.setDate(d.getDate() + (j === 0 ? 0 : 7 - j))
  return isoLocal(d)
}
// Toujours incluse sans dates ; sinon date_debut ≤ dimanche ≤ date_fin
function annoncePourDimanche(a, dateISO) {
  if (!a.date_debut && !a.date_fin) return true
  if (a.date_debut && dateISO < a.date_debut) return false
  if (a.date_fin && dateISO > a.date_fin) return false
  return true
}
const PHOTO_MAX = 1200   // côté le plus long, en pixels

/** Photo allégée avant l'envoi : réduite à 1200 px et recompressée en JPEG (sauf GIF, SVG, ou image déjà petite). */
async function reduireImage(fichier) {
  const brut = async () => ({ nom: fichier.name, type: fichier.type, base64: await fichierEnBase64(fichier) })
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(fichier.type)) return brut()
  try {
    const bmp = await createImageBitmap(fichier)
    const k = Math.min(1, PHOTO_MAX / Math.max(bmp.width, bmp.height))
    if (k === 1 && fichier.size < 600 * 1024) return brut()
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    const g = c.getContext('2d')
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height)   // fond blanc pour les PNG transparents
    g.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82))
    if (!blob || blob.size >= fichier.size) return brut()
    return { nom: fichier.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', base64: await fichierEnBase64(blob) }
  } catch { return brut() }
}

const triFeuille = (a, b) => (b.prioritaire ? 1 : 0) - (a.prioritaire ? 1 : 0) || (a.ordre || 0) - (b.ordre || 0)

export default function Annonces() {
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const { data, chargement, erreur, recharger, setData } = useCharger(() => api('annonces.liste'), [], ['annonces.liste', {}])
  const [filtre, setFiltre] = useState('toutes')
  const [fiche, setFiche] = useState(null)        // annonce en cours de modification ({} = nouvelle)
  const [feuille, setFeuille] = useState(false)
  const [whatsapp, setWhatsapp] = useState(false)
  const [glisse, setGlisse] = useState(null)      // { src, over }
  const annonces = data || []
  // Ouverte depuis la recherche : ?id=…
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    const id = params.get('id'), a = id && data?.find((x) => String(x.id) === id)
    if (a) { setFiche(a); setParams({}, { replace: true }) }
  }, [data, params])   // eslint-disable-line react-hooks/exhaustive-deps

  const filtrees = annonces.filter((a) => (filtre === 'actives' ? a.actif : filtre === 'inactives' ? !a.actif : filtre === 'prioritaires' ? a.prioritaire : true))
  const prioritaires = filtrees.filter((a) => a.prioritaire)
  const normales = filtrees.filter((a) => !a.prioritaire)
  const nbActives = annonces.filter((a) => a.actif).length

  async function basculer(a, champ, messages) {
    // Affiché aussitôt ; remis comme avant si le serveur refuse
    setData((l) => (l || []).map((x) => (x.id === a.id ? { ...x, [champ]: !a[champ] } : x)))
    try {
      await api('annonces.ecrire', { id: a.id, [champ]: !a[champ] })
      notifier(a[champ] ? messages[0] : messages[1])
      recharger()
    } catch (e) { setData((l) => (l || []).map((x) => (x.id === a.id ? { ...x, [champ]: a[champ] } : x))); notifier(e.message, 'erreur') }
  }
  /** Notification sur les téléphones des paroissiens (app « La Croix glorieuse »). */
  async function notifierA(a, encore = false) {
    if (!encore && !(await confirmer({ titre: 'Notifier les paroissiens', texte: `« ${a.titre} » : une notification part sur les téléphones des paroissiens qui ont installé l'app (sauf ceux qui ont coupé les annonces).`, bouton: 'Notifier' }))) return
    try {
      const r = await api('annonces.notifier', { id: a.id, encore })
      notifier(r.appareils ? `Notification envoyée (${r.appareils} appareil${r.appareils > 1 ? 's' : ''})` : 'Aucun téléphone abonné pour le moment')
      setData((d) => (d || []).map((x) => (x.id === a.id ? { ...x, notifie_le: r.le } : x)))
    } catch (e) {
      if (e.code === 'DEJA' && await confirmer({ titre: 'Déjà notifiée', texte: e.message + '\n\nNotifier encore une fois ?', bouton: 'Notifier encore' })) return notifierA(a, true)
      if (e.code !== 'DEJA') notifier(e.message, 'erreur')
    }
  }
  async function supprimer(a) {
    if (!(await confirmer({ titre: 'Supprimer l\'annonce', texte: `Supprimer « ${a.titre} » ? Cette action est irréversible.`, bouton: 'Supprimer', danger: true }))) return
    try { await api('annonces.supprimer', { id: a.id }); notifier('Annonce supprimée'); recharger() } catch (e) { notifier(e.message, 'erreur') }
  }
  // Réordonnement : comme l'AppMesse, ordre 0, 1, 2… sur la liste affichée
  async function deplacer(srcId, destId) {
    const liste = [...filtrees]
    const i = liste.findIndex((x) => x.id === srcId), j = liste.findIndex((x) => x.id === destId)
    if (i < 0 || j < 0 || i === j) return
    const [x] = liste.splice(i, 1)
    liste.splice(j, 0, x)
    setData((d) => {
      const ordre = new Map(liste.map((a, k) => [a.id, k]))
      return (d || []).map((a) => (ordre.has(a.id) ? { ...a, ordre: ordre.get(a.id) } : a)).sort((a, b) => (b.prioritaire ? 1 : 0) - (a.prioritaire ? 1 : 0) || (a.ordre ?? 1e9) - (b.ordre ?? 1e9))
    })
    try { await api('annonces.ordre', { ids: liste.map((a) => a.id) }); notifier('Ordre enregistré') } catch (e) { notifier(e.message, 'erreur') }
    recharger()
  }

  // Glisser-déposer (souris et doigt) par la poignée
  function debutGlisse(e, a) {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setGlisse({ src: a.id, over: null })
  }
  function mouvementGlisse(e) {
    if (!glisse) return
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-annonce]')
    const over = el ? Number(el.dataset.annonce) || el.dataset.annonce : null
    if (over !== glisse.over) setGlisse({ ...glisse, over })
  }
  function finGlisse() {
    if (glisse?.over && glisse.over !== glisse.src) deplacer(glisse.src, glisse.over)
    setGlisse(null)
  }

  const carte = (a) => (
    <Carte key={a.id} a={a} glisse={glisse} onModifier={() => setFiche(a)} onSupprimer={() => supprimer(a)} onNotifier={() => notifierA(a)}
      onDupliquer={() => setFiche({ ...a, id: undefined, event_date: '', event_heure: '', date_debut: '', date_fin: '', _copie: true })}
      onPrio={() => basculer(a, 'prioritaire', ['Priorité retirée', 'Annonce prioritaire'])}
      onActif={() => basculer(a, 'actif', ['Annonce désactivée', 'Annonce activée'])}
      poignee={{ onPointerDown: (e) => debutGlisse(e, a), onPointerMove: mouvementGlisse, onPointerUp: finGlisse, onPointerCancel: () => setGlisse(null) }} />
  )

  return (
    <div>
      <EnTete titre="Annonces" sousTitre={data ? `${nbActives} annonce${nbActives > 1 ? 's' : ''} active${nbActives > 1 ? 's' : ''}` : ''}
        actions={<>
          <button className="btn-clair" onClick={() => setWhatsapp(true)}><MessageCircle className="h-4 w-4" />Texte WhatsApp</button>
          <button className="btn-clair" onClick={() => setFeuille(true)}><Printer className="h-4 w-4" />Feuille du dimanche</button>
          <button className="btn-principal" onClick={() => setFiche({})}><Plus className="h-4 w-4" />Nouvelle annonce</button>
        </>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTRES.map(([k, l]) => (
          <button key={k} onClick={() => setFiltre(k)} className={`pastille border px-3 py-1.5 text-sm ${filtre === k ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>
            {k === 'prioritaires' && <Flag className="mr-1 h-3.5 w-3.5" />}{l}
          </button>
        ))}
      </div>
      <Erreur erreur={erreur} reessayer={recharger} />
      {chargement && !data ? <Chargement /> : !filtrees.length ? <Vide icone={Megaphone} texte={`Aucune annonce${filtre !== 'toutes' ? ' dans ce filtre' : ''}.`} /> : (
        <div className="space-y-3">
          {prioritaires.length > 0 && <div className="flex items-center gap-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-or-600"><Flag className="h-3.5 w-3.5" />Prioritaires</div>}
          {prioritaires.map(carte)}
          {normales.length > 0 && prioritaires.length > 0 && <div className="pt-3 text-xs font-semibold uppercase tracking-wide text-nuit-600/70">Annonces</div>}
          {normales.map(carte)}
        </div>
      )}
      {fiche && <Fiche annonce={fiche} onFermer={() => setFiche(null)} onEnregistre={() => { setFiche(null); recharger() }} />}
      {feuille && <Feuille annonces={annonces} onFermer={() => setFeuille(false)} />}
      {whatsapp && <WhatsApp annonces={annonces} onFermer={() => setWhatsapp(false)} />}
    </div>
  )
}

function Carte({ a, glisse, poignee, onModifier, onDupliquer, onSupprimer, onPrio, onActif, onNotifier }) {
  const expiree = a.date_fin && a.date_fin < aujourdhui()
  const chips = []
  if (a.event_date) chips.push([CalendarDays, fmtDate(a.event_date) + (a.event_heure ? ' à ' + a.event_heure.slice(0, 5) : ''), 'bg-or-50 text-or-600'])
  if (a.lien) chips.push([Link2, 'Lien', 'bg-nuit-50 text-nuit-600'])
  if (a.image_url) chips.push([ImageIcon, 'Image', 'bg-nuit-50 text-nuit-600'])
  if (a.dans_newsletter) chips.push([Mail, 'Newsletter', 'bg-sky-50 text-sky-800'])
  if (a.dans_feuille) chips.push([Printer, 'Feuille', 'bg-emerald-50 text-emerald-800'])
  if (a.notifie_le) chips.push([BellRing, 'Notifiée le ' + new Date(a.notifie_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), 'bg-or-50 text-or-600'])
  if (!a.actif) chips.push([null, 'Inactive', 'bg-gray-100 text-gray-600'])
  if (expiree) chips.push([null, 'Expirée', 'bg-gray-100 text-gray-600'])
  const source = glisse?.src === a.id, cible = glisse?.over === a.id && !source
  return (
    <div data-annonce={a.id} className={`carte overflow-hidden transition ${a.prioritaire ? 'border-l-4 border-l-or' : ''} ${!a.actif ? 'opacity-60' : ''} ${source ? 'opacity-40' : ''} ${cible ? 'ring-2 ring-or' : ''}`}>
      <div className="flex gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="font-titre text-xl font-semibold leading-tight">{a.titre}{a._enAttente && <span className="pastille ml-2 bg-nuit-50 align-middle font-sans text-[10px] font-normal text-nuit-600">en attente d'envoi</span>}</div>
          {a.description && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-nuit-600">{a.description}</p>}
          {chips.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{chips.map(([I, t, c], i) => <span key={i} className={`pastille gap-1 ${c}`}>{I && <I className="h-3 w-3" />}{t}</span>)}</div>}
        </div>
        {a.image_url && <img src={a.image_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-nuit-50 px-2 py-1.5">
        <button type="button" aria-label="Glisser pour réordonner" title="Glisser pour réordonner" className="btn-icone cursor-grab touch-none active:cursor-grabbing" {...poignee}><GripVertical className="h-4 w-4" /></button>
        <button className={`btn text-xs ${a.prioritaire ? 'bg-or-100 text-or-600' : 'text-nuit-600 hover:bg-nuit-50'}`} onClick={onPrio}><Flag className="h-3.5 w-3.5" />{a.prioritaire ? 'Prioritaire' : 'Priorité'}</button>
        <button className={`btn text-xs ${a.actif ? 'bg-emerald-50 text-emerald-800' : 'text-nuit-600 hover:bg-nuit-50'}`} onClick={onActif}>{a.actif ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}{a.actif ? 'Active' : 'Inactive'}</button>
        <button className="btn text-xs text-nuit-600 hover:bg-nuit-50" onClick={onModifier}><Pencil className="h-3.5 w-3.5" />Modifier</button>
        <button className="btn text-xs text-nuit-600 hover:bg-nuit-50" onClick={onDupliquer}><CopyPlus className="h-3.5 w-3.5" />Dupliquer</button>
        {a.actif && !a._enAttente && <button className="btn text-xs text-nuit-600 hover:bg-nuit-50" onClick={onNotifier} title="Notification sur les téléphones des paroissiens"><BellRing className="h-3.5 w-3.5" />Notifier</button>}
        <button className="btn ml-auto text-xs text-red-700 hover:bg-red-50" onClick={onSupprimer}><Trash2 className="h-3.5 w-3.5" />Supprimer</button>
      </div>
    </div>
  )
}

function Fiche({ annonce, onFermer, onEnregistre }) {
  const notifier = useNotif()
  const a = annonce || {}
  const [f, setF] = useState({
    titre: a.titre || '', description: a.description || '', event_date: a.event_date || '', event_heure: a.event_heure ? a.event_heure.slice(0, 5) : '',
    date_debut: a.date_debut || '', date_fin: a.date_fin || '', image_url: a.image_url || '', lien: a.lien || '', lien_label: a.lien_label || '',
    prioritaire: !!a.prioritaire, actif: a.id || a._copie ? !!a.actif : true, dans_newsletter: !!a.dans_newsletter, dans_feuille: !!a.dans_feuille
  })
  const [envoi, setEnvoi] = useState(false)
  const [image, setImage] = useState(false)
  const [imageOk, setImageOk] = useState(true)
  const fichier = useRef(null)
  const ch = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function envoyerImage(e) {
    const x = e.target.files?.[0]
    e.target.value = ''
    if (!x) return
    setImage(true)
    try {
      const r = await api('annonces.image', await reduireImage(x))
      setF((g) => ({ ...g, image_url: r.url })); setImageOk(true); notifier('Image chargée')
    } catch (er) { notifier('Image non envoyée : ' + er.message, 'erreur') } finally { setImage(false) }
  }
  async function enregistrer() {
    if (!f.titre.trim()) { notifier('Le titre est obligatoire', 'erreur'); return }
    setEnvoi(true)
    try { const r = await api('annonces.ecrire', { ...(a.id ? { id: a.id } : {}), ...f }); notifier(r?._enAttente ? 'Hors connexion : gardée sur l\'appareil, envoyée au retour du réseau' : a.id ? 'Annonce modifiée' : 'Annonce créée'); onEnregistre() }
    catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  const interrupteurs = [['prioritaire', 'Prioritaire', 'En tête de la liste et « À la une » dans la newsletter'], ['actif', 'Active', 'Visible sur le site et proposée ailleurs'],
    ['dans_newsletter', 'Dans la newsletter', 'Proposée dans la newsletter'], ['dans_feuille', 'Dans la feuille', 'Proposée pour la feuille du dimanche']]
  return (
    <Modale titre={a.id ? 'Modifier l\'annonce' : a._copie ? 'Nouvelle annonce (copie)' : 'Nouvelle annonce'} onFermer={onFermer} large
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={envoi} onClick={enregistrer}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button></>}>
      <div className="space-y-4">
        <div><label className="etiquette" htmlFor="an-titre">Titre</label><input id="an-titre" className="champ" maxLength={120} placeholder="Titre de l'annonce" value={f.titre} onChange={ch('titre')} autoFocus /></div>
        <div><label className="etiquette" htmlFor="an-desc">Description (facultatif)</label><textarea id="an-desc" className="champ min-h-[110px]" maxLength={1000} placeholder="Texte de l'annonce…" value={f.description} onChange={ch('description')} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="etiquette" htmlFor="an-evd">Date de l'événement (facultatif)</label><input id="an-evd" type="date" className="champ" value={f.event_date} onChange={ch('event_date')} /></div>
          <div><label className="etiquette" htmlFor="an-evh">Heure (facultatif)</label><input id="an-evh" type="time" className="champ" value={f.event_heure} onChange={ch('event_heure')} /></div>
          <div><label className="etiquette" htmlFor="an-deb">Publication à partir du (facultatif)</label><input id="an-deb" type="date" className="champ" value={f.date_debut} onChange={ch('date_debut')} /></div>
          <div><label className="etiquette" htmlFor="an-fin">Masquer après le (facultatif)</label><input id="an-fin" type="date" className="champ" value={f.date_fin} onChange={ch('date_fin')} /></div>
        </div>
        <div>
          <label className="etiquette" htmlFor="an-img">Image (facultatif)</label>
          <div className="flex gap-2">
            <button type="button" className="btn-clair shrink-0" disabled={image} onClick={() => fichier.current?.click()}>{image ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Choisir…</button>
            <input ref={fichier} type="file" accept="image/*" className="hidden" onChange={envoyerImage} />
            <input id="an-img" type="url" className="champ" placeholder="https://… (adresse directe)" value={f.image_url} onChange={(e) => { setF({ ...f, image_url: e.target.value }); setImageOk(true) }} />
          </div>
          {f.image_url && imageOk && <img src={f.image_url} alt="" className="mt-2 max-h-40 rounded-lg" onError={() => setImageOk(false)} />}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="etiquette" htmlFor="an-lien">Lien (facultatif)</label><input id="an-lien" type="url" className="champ" placeholder="https://…" value={f.lien} onChange={ch('lien')} /></div>
          <div><label className="etiquette" htmlFor="an-ll">Texte du lien (facultatif)</label><input id="an-ll" className="champ" maxLength={60} placeholder="En savoir plus…" value={f.lien_label} onChange={ch('lien_label')} /></div>
        </div>
        <div>
          <div className="etiquette">Publication</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {interrupteurs.map(([k, l, t]) => (
              <label key={k} className="flex items-center gap-3 rounded-lg border border-nuit-100 p-2.5 text-sm">
                <Interrupteur actif={f[k]} onChange={(v) => setF({ ...f, [k]: v })} />
                <span><strong className="font-medium">{l}</strong><br /><span className="text-xs text-nuit-600/70">{t}</span></span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modale>
  )
}

/** Feuille du dimanche : annonces actives cochées « Feuille », valables ce dimanche → texte à copier. */
function Feuille({ annonces, onFermer }) {
  const notifier = useNotif()
  const [date, setDate] = useState(prochainDimanche())
  const candidats = annonces.filter((a) => a.dans_feuille && a.actif && annoncePourDimanche(a, date)).sort(triFeuille)
  const [retirees, setRetirees] = useState(new Set())
  const libelle = date ? new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  async function copier() {
    const selection = candidats.filter((a) => !retirees.has(a.id))
    if (!selection.length) { notifier('Aucune annonce sélectionnée', 'erreur'); return }
    const texte = selection.map((a) => '❖ ' + a.titre.toUpperCase() + (a.description ? '\n' + a.description : '')).join('\n\n')
    try { await navigator.clipboard.writeText(texte); notifier(`${selection.length} annonce${selection.length > 1 ? 's' : ''} copiée${selection.length > 1 ? 's' : ''}`) }
    catch { notifier('Copie impossible sur cet appareil', 'erreur') }
  }
  return (
    <Modale titre="Feuille du dimanche" onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Fermer</button><button className="btn-principal" disabled={!candidats.length} onClick={copier}><Copy className="h-4 w-4" />Copier</button></>}>
      <div className="space-y-3">
        <div><label className="etiquette" htmlFor="fe-date">Dimanche</label><input id="fe-date" type="date" className="champ" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="mt-1 text-xs capitalize text-nuit-600/70">{libelle}</div></div>
        {!candidats.length ? <p className="text-sm text-nuit-600/70">Aucune annonce pour ce dimanche.</p> : (
          <ul className="space-y-1.5">{candidats.map((a) => (
            <li key={a.id}><label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-nuit-100 p-2.5 text-sm hover:bg-nuit-50/50">
              <input type="checkbox" className="mt-1 accent-[#521a22]" checked={!retirees.has(a.id)} onChange={() => setRetirees((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n })} />
              <span className="min-w-0"><span className="font-medium">{a.titre}</span>{a.description && <span className="block truncate text-xs text-nuit-600/70">{a.description.slice(0, 100)}{a.description.length > 100 ? '…' : ''}</span>}</span>
            </label></li>
          ))}</ul>
        )}
        <p className="text-xs text-nuit-600/70">Le texte copié a la forme « ❖ TITRE » puis la description, comme dans l'AppMesse.</p>
      </div>
    </Modale>
  )
}

/** Texte pour WhatsApp : annonces cochées, *titre* en gras, date de l'événement, texte et lien. */
function WhatsApp({ annonces, onFermer }) {
  const notifier = useNotif()
  const auj = aujourdhui()
  const actives = annonces.filter((a) => a.actif)
  const [coches, setCoches] = useState(() => new Set(actives.filter((a) => annoncePourDimanche(a, auj)).map((a) => a.id)))
  const quand = (a) => {
    if (!a.event_date) return ''
    const d = new Date(a.event_date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    return '_' + d.charAt(0).toUpperCase() + d.slice(1) + (a.event_heure ? ' à ' + Number(a.event_heure.slice(0, 2)) + ' h' + (a.event_heure.slice(3, 5) === '00' ? '' : ' ' + a.event_heure.slice(3, 5)) : '') + '_'
  }
  const texte = actives.filter((a) => coches.has(a.id)).map((a) => [
    '*' + a.titre.trim() + '*', quand(a), (a.description || '').trim(), a.lien ? (a.lien_label ? a.lien_label.trim() + ' : ' : '') + a.lien : ''
  ].filter(Boolean).join('\n')).join('\n\n')
  async function copier() {
    if (!texte) { notifier('Aucune annonce cochée', 'erreur'); return }
    try { await navigator.clipboard.writeText(texte); notifier('Texte copié : collez-le dans WhatsApp') } catch { notifier('Copie impossible sur cet appareil', 'erreur') }
  }
  const basculer = (id) => setCoches((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  return (
    <Modale titre="Texte pour WhatsApp" onFermer={onFermer} large
      pied={<><button className="btn-clair" onClick={onFermer}>Fermer</button><button className="btn-principal" disabled={!texte} onClick={copier}><Copy className="h-4 w-4" />Copier</button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="etiquette">Annonces actives</div>
          {!actives.length ? <p className="text-sm text-nuit-600/70">Aucune annonce active.</p> : (
            <ul className="space-y-1.5">{actives.map((a) => (
              <li key={a.id}><label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-nuit-100 p-2.5 text-sm hover:bg-nuit-50/50">
                <input type="checkbox" className="mt-1 accent-[#521a22]" checked={coches.has(a.id)} onChange={() => basculer(a.id)} />
                <span className="min-w-0 font-medium">{a.titre}</span>
              </label></li>
            ))}</ul>
          )}
        </div>
        <div>
          <div className="etiquette">Aperçu</div>
          <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#e7f6e7] p-3 font-sans text-sm text-nuit-800">{texte || '—'}</pre>
          <p className="mt-1 text-xs text-nuit-600/70">*Texte* s'affiche en gras et _texte_ en italique dans WhatsApp.</p>
        </div>
      </div>
    </Modale>
  )
}
