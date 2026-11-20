import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, RotateCcw, Wand2, AlertTriangle, CheckCircle2, Download, GraduationCap } from 'lucide-react'
import { api, fichierEnBase64 } from '../api.js'
import { chargerSceau, oublierSceau } from './Extraits.jsx'
import { useApp } from '../App.jsx'
import { Chargement, Erreur, useCharger, useNotif, dateHeure, Interrupteur } from '../ui.jsx'
import { ApercuSignature } from './Courrier.jsx'

const ONGLETS = ['Paroisse', 'Signatures', 'Réponses types', 'Tri automatique', 'Catéchisme', 'Journal']

export default function Reglages() {
  const [onglet, setOnglet] = useState('Paroisse')
  return (
    <>
      <div className="mb-5"><h1 className="text-3xl font-semibold">Réglages</h1><p className="text-sm text-nuit-600/80">Paroisse, signatures, réponses types, tri des mails, journal des actions</p></div>
      <div className="-mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1">
        {ONGLETS.map((o) => <button key={o} onClick={() => setOnglet(o)} className={`pastille shrink-0 border px-3 py-1.5 text-sm ${onglet === o ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>{o}</button>)}
      </div>
      {onglet === 'Paroisse' && <Paroisse />}
      {onglet === 'Signatures' && <Signatures />}
      {onglet === 'Réponses types' && <Reponses />}
      {onglet === 'Tri automatique' && <TriAutomatique />}
      {onglet === 'Catéchisme' && <CatechismeReglages />}
      {onglet === 'Journal' && <Journal />}
    </>
  )
}

const CHAMPS_PAROISSE = [
  ['paroisse', 'Nom de la paroisse (formulaires B14, B6…)'], ['paroisse_courte', 'Nom court'], ['diocese', 'Diocèse'],
  ['commune', 'Commune (« fait à »)'], ['eglise', 'Église par défaut'], ['adresse', 'Adresse (signatures)'],
  ['site', 'Site (signatures)'], ['url_horaires', 'Page des horaires'],
  ['url_rdv_cure', 'Prise de rendez-vous avec le curé – lien (première communion)'], ['url_rdv_cure_integre', 'Prise de rendez-vous avec le curé – adresse de la page intégrée (iframe)'], ['url_icones', 'Adresse des icônes de signature (facultatif)']
]

function Paroisse() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <ParoisseInfos />
      <div className="space-y-5"><Sceau /><Signataires /></div>
    </div>
  )
}

function Sceau() {
  const notifier = useNotif()
  const [img, setImg] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  useEffect(() => { chargerSceau().then(setImg) }, [])
  async function choisir(f) {
    if (!f) return
    setEnvoi(true)
    try { const r = await api('sceau.ecrire', { base64: await fichierEnBase64(f), type: f.type }); oublierSceau(); setImg(r); notifier('Sceau enregistré') }
    catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  return (
    <div className="carte space-y-3 p-5">
      <h2 className="text-xl font-semibold">Sceau paroissial</h2>
      <p className="text-xs text-nuit-600/70">Apposé sur les extraits de baptême signés. Image PNG (fond transparent ou blanc).</p>
      <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-nuit-100 bg-white">
        {img === null ? <Loader2 className="h-5 w-5 animate-spin" /> : img ? <img src={img} alt="Sceau" className="max-h-32" /> : <span className="text-xs text-nuit-600/50">Aucun sceau</span>}
      </div>
      <label className="btn-clair w-full cursor-pointer">{envoi && <Loader2 className="h-4 w-4 animate-spin" />}{img ? 'Remplacer' : 'Choisir l\'image'}
        <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => choisir(e.target.files[0])} /></label>
    </div>
  )
}

function Signataires() {
  const { reglages, utilisateurs, majDonnees } = useApp()
  const notifier = useNotif()
  const defaut = utilisateurs.filter((u) => u.role === 'admin' || u.role === 'secretaire' || u.signature === 'cure').map((u) => u.id)
  const [ids, setIds] = useState(() => (reglages.signataires ? reglages.signataires.split(',').filter(Boolean) : defaut))
  async function enregistrer(liste) {
    setIds(liste)
    try { const r = await api('reglages.ecrire', { ...reglages, signataires: liste.join(',') }); majDonnees({ reglages: r }); notifier('Signataires enregistrés') } catch (e) { notifier(e.message, 'erreur') }
  }
  return (
    <div className="carte space-y-2 p-5">
      <h2 className="text-xl font-semibold">Peuvent signer les extraits</h2>
      {utilisateurs.map((u) => (
        <label key={u.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ids.includes(u.id)}
          onChange={(e) => enregistrer(e.target.checked ? [...ids, u.id] : ids.filter((x) => x !== u.id))} />{u.nom}</label>
      ))}
    </div>
  )
}

function ParoisseInfos() {
  const { reglages, majDonnees } = useApp()
  const notifier = useNotif()
  const [f, setF] = useState(reglages)
  const [envoi, setEnvoi] = useState(false)
  async function enregistrer() {
    setEnvoi(true)
    try { const { signataires: _s, ...sansSignataires } = f; const r = await api('reglages.ecrire', sansSignataires); majDonnees({ reglages: r }); notifier('Réglages enregistrés') } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  return (
    <div className="carte space-y-3 p-5">
      {CHAMPS_PAROISSE.map(([k, l]) => <div key={k}><label className="etiquette">{l}</label><input className="champ" value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>)}
      <button className="btn-principal" onClick={enregistrer} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
    </div>
  )
}

function Signatures() {
  const { signatures, reglages, majDonnees } = useApp()
  const notifier = useNotif()
  const [liste, setListe] = useState(signatures)
  const [envoi, setEnvoi] = useState(false)
  const maj = (i, k, v) => setListe(liste.map((s, j) => (j === i ? { ...s, [k]: v } : s)))
  async function enregistrer() {
    setEnvoi(true)
    try { const r = await api('signatures.ecrire', { signatures: liste }); majDonnees({ signatures: r }); setListe(r); notifier('Signatures enregistrées') } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-nuit-600">Modèle commun : seuls le nom, la fonction, l'e-mail et le téléphone changent. Adresse et site viennent de l'onglet Paroisse.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {liste.map((s, i) => (
          <div key={s.cle} className="carte grid gap-4 p-4 sm:grid-cols-2">
            <div className="space-y-2">
              {[['nom', 'Nom'], ['fonction', 'Fonction'], ['email', 'E-mail affiché'], ['telephone', 'Téléphone']].map(([k, l]) => (
                <div key={k}><label className="etiquette">{l}</label><input className="champ py-1.5 text-xs" value={s[k]} onChange={(e) => maj(i, k, e.target.value)} /></div>
              ))}
              <button className="text-xs text-red-700 hover:underline" onClick={() => setListe(liste.filter((_, j) => j !== i))}><Trash2 className="mr-1 inline h-3 w-3" />Supprimer</button>
            </div>
            <div className="rounded-lg border border-nuit-100 bg-white p-3"><ApercuSignature sig={s} reglages={reglages} /></div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn-clair" onClick={() => setListe([...liste, { cle: 'sig' + Date.now(), nom: '', fonction: '', email: 'secretariat@croix-glorieuse.org', telephone: '03 88 36 08 42' }])}><Plus className="h-4 w-4" />Ajouter</button>
        <button className="btn-principal" onClick={enregistrer} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
      </div>
    </div>
  )
}

function Reponses() {
  const { reponses, majDonnees } = useApp()
  const notifier = useNotif()
  const [liste, setListe] = useState(reponses)
  const [envoi, setEnvoi] = useState(false)
  const maj = (i, k, v) => setListe(liste.map((s, j) => (j === i ? { ...s, [k]: v } : s)))
  const fixes = ['accuse_bapteme', 'accuse_mariage', 'horaires', 'document_manquant']
  async function enregistrer() {
    setEnvoi(true)
    try { const r = await api('reponses.ecrire', { reponses: liste }); majDonnees({ reponses: r }); setListe(r); notifier('Réponses types enregistrées') } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-nuit-600">Champs remplis automatiquement : <code className="rounded bg-nuit-50 px-1">{'{nom}'}</code> (nom du dossier ou de l'expéditeur), <code className="rounded bg-nuit-50 px-1">{'{type}'}</code>, <code className="rounded bg-nuit-50 px-1">{'{url_horaires}'}</code>, <code className="rounded bg-nuit-50 px-1">{'{documents_manquants}'}</code>. La signature s'ajoute toute seule.</p>
      {liste.map((r, i) => (
        <div key={r.cle} className="carte space-y-2 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div><label className="etiquette">Titre (dans l'appli)</label><input className="champ py-1.5" value={r.titre} onChange={(e) => maj(i, 'titre', e.target.value)} /></div>
            <div><label className="etiquette">Objet du mail</label><input className="champ py-1.5" value={r.sujet} onChange={(e) => maj(i, 'sujet', e.target.value)} /></div>
          </div>
          <textarea className="champ min-h-[150px] text-sm" value={r.corps} onChange={(e) => maj(i, 'corps', e.target.value)} />
          {!fixes.includes(r.cle) && <button className="text-xs text-red-700 hover:underline" onClick={() => setListe(liste.filter((_, j) => j !== i))}><Trash2 className="mr-1 inline h-3 w-3" />Supprimer</button>}
        </div>
      ))}
      <div className="flex gap-2">
        <button className="btn-clair" onClick={() => setListe([...liste, { cle: 'rep' + Date.now(), titre: 'Nouvelle réponse', sujet: '', corps: 'Bonjour,\n\n\n\nAvec l\'assurance de nos prières à toutes vos intentions,' }])}><Plus className="h-4 w-4" />Ajouter</button>
        <button className="btn-principal" onClick={enregistrer} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
      </div>
    </div>
  )
}

function Journal() {
  const { data, chargement, erreur } = useCharger(() => api('journal.liste', { limite: 300 }), [])
  return (
    <div className="carte p-4">
      <Erreur erreur={erreur} />
      {chargement ? <Chargement /> : (
        <ul className="divide-y divide-nuit-50 text-sm">
          {data?.map((j, i) => <li key={i} className="flex flex-wrap gap-x-3 py-2"><span className="w-36 shrink-0 text-xs text-nuit-600/60">{dateHeure(j.date)}</span><span className="font-medium">{j.utilisateur}</span><span>{j.action}</span><span className="text-nuit-600/70">{j.detail}</span></li>)}
        </ul>
      )}
    </div>
  )
}

const ACTIONS_TRI = {
  extrait: 'propose « Créer l\'extrait de baptême »',
  appmesse: 'propose d\'ouvrir AppMESSE',
  dossier: 'propose de créer le dossier (et l\'accusé de réception s\'il existe)',
  rendezvous: 'propose un rendez-vous dans l\'agenda',
  horaires: 'répond automatiquement avec la réponse type « Horaires »'
}
const versTexte = (l) => (l || []).join(', ')
const versListe = (t) => String(t || '').split(/[\n,;]/).map((x) => x.trim().toLowerCase()).filter(Boolean)

function TriAutomatique() {
  const notifier = useNotif()
  const { data, chargement, erreur } = useCharger(() => api('tri.lire'), [])
  const journal = useCharger(() => api('journal.liste', { limite: 300 }), [])
  const [f, setF] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [essai, setEssai] = useState({ sujet: '', texte: '' })
  const [resultat, setResultat] = useState(null)
  useEffect(() => {
    if (data) setF({ actif: data.actif, envoi_auto: data.envoi_auto, desactivees: data.desactivees, sensibles: versTexte(data.sensibles), ignores: versTexte(data.ignores),
      mots: Object.fromEntries(data.categories.map((c) => [c.cle, versTexte(data.mots[c.cle])])) })
  }, [data])
  if (chargement || !f) return <><Erreur erreur={erreur} />{!erreur && <Chargement />}</>

  async function enregistrer(modif = {}) {
    const g = { ...f, ...modif }
    setF(g); setEnvoi(true)
    try {
      await api('tri.ecrire', { actif: g.actif, envoi_auto: g.envoi_auto, desactivees: g.desactivees, sensibles: versListe(g.sensibles), ignores: versListe(g.ignores),
        mots: Object.fromEntries(Object.entries(g.mots).map(([k, v]) => [k, versListe(v)])) })
      notifier(modif.actif !== undefined ? (g.actif ? 'Tri automatique activé' : 'Tri automatique désactivé') : 'Règles enregistrées')
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  async function tester() {
    try { setResultat(await api('tri.tester', essai)) } catch (e) { notifier(e.message, 'erreur') }
  }
  const auto = (journal.data || []).filter((j) => j.utilisateur === 'Tri automatique' && j.action === 'Réponse auto envoyée')
  const nom = (cle) => data.categories.find((c) => c.cle === cle)?.nom || cle

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div className="carte space-y-4 p-5">
          <div className="flex items-start gap-3">
            <Wand2 className="mt-1 h-5 w-5 shrink-0 text-or" />
            <div className="flex-1">
              <h2 className="text-xl font-semibold">Tri des mails entrants</h2>
              <p className="text-sm text-nuit-600">Toutes les 5 minutes, chaque nouveau mail est lu et reçoit une étiquette selon les mots-clés ci-dessous ; l'appli propose alors l'action qui correspond. Aucune IA : rien ne sort du compte Google.</p>
            </div>
            <Interrupteur actif={f.actif} onChange={(v) => enregistrer({ actif: v })} />
          </div>
          <label className="flex items-start gap-3 rounded-lg bg-or-50/60 p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={f.envoi_auto} onChange={(e) => enregistrer({ envoi_auto: e.target.checked })} />
            <span><strong>Répondre automatiquement aux demandes d'horaires</strong><br /><span className="text-xs text-nuit-600">Avec la réponse type « Horaires » et la signature de la paroisse, seulement pour un nouveau message, une fois par jour et par adresse. Jamais si le mail contient un mot sensible. Le mail est alors marqué « Traité ».</span></span>
          </label>
          <p className="text-xs text-nuit-600/70">Écriture des mots-clés : sans accents ni majuscules (« bapteme » reconnaît aussi « Baptême ») ; une étoile à la fin reconnaît toutes les terminaisons (« baptis* » → baptiser, baptisé, baptisée…). Séparer par des virgules.</p>
        </div>

        {data.categories.map((c) => {
          const off = f.desactivees.includes(c.cle)
          return (
            <div key={c.cle} className={`carte space-y-2 p-4 ${off ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={!off} onChange={(e) => setF({ ...f, desactivees: e.target.checked ? f.desactivees.filter((x) => x !== c.cle) : [...f.desactivees, c.cle] })} />{c.nom}</label>
                <span className="text-xs text-nuit-600/70">— {ACTIONS_TRI[c.action]}</span>
                <button className="ml-auto text-xs text-nuit-600/70 hover:underline" onClick={() => setF({ ...f, mots: { ...f.mots, [c.cle]: versTexte(c.defaut) } })}><RotateCcw className="mr-1 inline h-3 w-3" />Mots par défaut</button>
              </div>
              <textarea className="champ min-h-[60px] text-xs" value={f.mots[c.cle]} onChange={(e) => setF({ ...f, mots: { ...f.mots, [c.cle]: e.target.value } })} />
            </div>
          )
        })}

        <div className="carte space-y-2 p-4">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-700" /><h3 className="font-semibold">Mots sensibles</h3>
            <button className="ml-auto text-xs text-nuit-600/70 hover:underline" onClick={() => setF({ ...f, sensibles: versTexte(data.defaut.sensibles) })}><RotateCcw className="mr-1 inline h-3 w-3" />Par défaut</button></div>
          <p className="text-xs text-nuit-600/70">Si l'un d'eux apparaît : aucune réponse automatique ; le mail est étiqueté « Prioritaire », étoilé et mis « À traiter ».</p>
          <textarea className="champ min-h-[70px] text-xs" value={f.sensibles} onChange={(e) => setF({ ...f, sensibles: e.target.value })} />
        </div>
        <div className="carte space-y-2 p-4">
          <div className="flex items-center gap-2"><h3 className="font-semibold">Expéditeurs ignorés</h3>
            <button className="ml-auto text-xs text-nuit-600/70 hover:underline" onClick={() => setF({ ...f, ignores: versTexte(data.defaut.ignores) })}><RotateCcw className="mr-1 inline h-3 w-3" />Par défaut</button></div>
          <p className="text-xs text-nuit-600/70">Adresses (ou morceaux d'adresse, ex. « @alsace.catholique.fr ») jamais triées. Les newsletters, listes de diffusion et réponses automatiques sont toujours ignorées.</p>
          <textarea className="champ min-h-[60px] text-xs" value={f.ignores} onChange={(e) => setF({ ...f, ignores: e.target.value })} />
        </div>
        <button className="btn-principal" onClick={() => enregistrer()} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer les règles</button>
      </div>

      <div className="space-y-5">
        <div className="carte space-y-3 p-5">
          <h2 className="text-lg font-semibold">Essayer sur un texte</h2>
          <p className="text-xs text-nuit-600/70">Collez un mail pour voir ce que le tri en ferait (règles enregistrées).</p>
          <input className="champ py-1.5 text-sm" placeholder="Objet" value={essai.sujet} onChange={(e) => setEssai({ ...essai, sujet: e.target.value })} />
          <textarea className="champ min-h-[120px] text-sm" placeholder="Texte du mail" value={essai.texte} onChange={(e) => setEssai({ ...essai, texte: e.target.value })} />
          <button className="btn-clair w-full" onClick={tester} disabled={!essai.texte && !essai.sujet}>Tester</button>
          {resultat && (
            <div className="space-y-2 rounded-lg bg-nuit-50/60 p-3 text-sm">
              {resultat.categories.length ? resultat.categories.map((c) => <div key={c}><span className="pastille bg-or-50 text-or-600">{nom(c)}</span> <span className="text-xs text-nuit-600/70">{resultat.mots[c].join(', ')}</span></div>) : <div className="text-nuit-600">Aucune catégorie reconnue.</div>}
              {resultat.sensibles.length > 0 && <div className="text-xs text-red-700"><AlertTriangle className="mr-1 inline h-3 w-3" />Prioritaire : {resultat.sensibles.join(', ')}</div>}
              <div className="text-xs">{resultat.envoiAuto ? <span className="text-emerald-700"><CheckCircle2 className="mr-1 inline h-3 w-3" />Recevrait la réponse « Horaires » automatiquement.</span> : 'Pas de réponse automatique.'}</div>
            </div>
          )}
        </div>
        <div className="carte p-5">
          <h2 className="mb-2 text-lg font-semibold">Réponses automatiques envoyées</h2>
          {journal.chargement ? <Chargement /> : !auto.length ? <p className="text-sm text-nuit-600/70">Aucune pour l'instant.</p> : (
            <ul className="divide-y divide-nuit-50 text-sm">{auto.slice(0, 40).map((j, i) => <li key={i} className="py-2"><div className="text-xs text-nuit-600/60">{dateHeure(j.date)}</div>{j.detail}</li>)}</ul>
          )}
        </div>
      </div>
    </div>
  )
}

function CatechismeReglages() {
  const notifier = useNotif()
  const { data, chargement, erreur } = useCharger(() => api('cate.reglages'), [])
  const [f, setF] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [importe, setImporte] = useState(false)
  useEffect(() => { if (data) setF({ ...data, cotisation: String(data.cotisation), feuilles: data.feuilles.map((x) => ({ ...x })) }) }, [data])
  if (chargement || !f) return <><Erreur erreur={erreur} />{!erreur && <Chargement />}</>

  async function enregistrer(modif = {}) {
    const g = { ...f, ...modif }
    setF(g); setEnvoi(true)
    try {
      const r = await api('cate.reglagesEcrire', { cotisation: g.cotisation, ecoles: g.ecoles, feuilles: g.feuilles.map(({ id, annee }) => ({ id, annee })), import_auto: g.import_auto })
      setF({ ...r, cotisation: String(r.cotisation) })
      notifier(modif.import_auto !== undefined ? (g.import_auto ? 'Import automatique activé' : 'Import automatique désactivé') : 'Réglages enregistrés')
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  async function importer() {
    setImporte(true)
    try { const r = await api('cate.importer'); notifier(r.nouvelles ? `${r.nouvelles} inscription(s) importée(s)` : 'Aucune nouvelle inscription'); if (r.erreurs?.length) notifier(r.erreurs.slice(0, 3).join(' · '), 'erreur') }
    catch (e) { notifier(e.message, 'erreur') } finally { setImporte(false) }
  }
  const majF = (i, k, v) => setF({ ...f, feuilles: f.feuilles.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })
  const majE = (i, k, v) => setF({ ...f, ecoles: f.ecoles.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <div className="carte space-y-3 p-5">
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-1 h-5 w-5 shrink-0 text-or" />
            <div className="flex-1"><h2 className="text-xl font-semibold">Formulaire d'inscription</h2>
              <p className="text-sm text-nuit-600">L'appli lit la feuille de réponses du formulaire Google de chaque année. Chaque nouvelle réponse devient une inscription ; une demande de sacrement crée le dossier.</p></div>
          </div>
          {f.feuilles.map((x, i) => (
            <div key={i} className="space-y-1 rounded-lg border border-nuit-100 p-3">
              <div className="grid grid-cols-[110px_1fr_auto] items-end gap-2">
                <div><label className="etiquette">Année</label><input className="champ py-1.5" placeholder="2027-2028" value={x.annee || ''} onChange={(e) => majF(i, 'annee', e.target.value)} /></div>
                <div><label className="etiquette">Feuille de réponses (adresse)</label><input className="champ py-1.5 text-xs" placeholder="https://docs.google.com/spreadsheets/d/…" value={x.id} onChange={(e) => majF(i, 'id', e.target.value)} /></div>
                <button className="btn-icone text-red-700" onClick={() => setF({ ...f, feuilles: f.feuilles.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
              </div>
              {x.nom ? <p className="text-xs text-emerald-700">✓ {x.nom}</p> : x.erreur ? <p className="text-xs text-red-700">{x.erreur}</p> : null}
            </div>
          ))}
          <button className="text-sm text-or-600 hover:underline" onClick={() => setF({ ...f, feuilles: [...f.feuilles, { id: '', annee: '' }] })}><Plus className="mr-1 inline h-3.5 w-3.5" />Ajouter l'année suivante</button>
          <p className="text-xs text-nuit-600/70">Chaque année, après avoir créé le nouveau formulaire, ouvrez sa feuille de réponses et collez son adresse ici.</p>
          <div className="flex items-center gap-3 rounded-lg bg-or-50/60 p-3">
            <div className="flex-1 text-sm"><strong>Import automatique</strong><br /><span className="text-xs text-nuit-600">Toutes les 15 minutes ; une notification signale les nouvelles inscriptions.</span></div>
            <Interrupteur actif={f.import_auto} onChange={(v) => enregistrer({ import_auto: v })} />
          </div>
          <button className="btn-clair w-full" onClick={importer} disabled={importe}>{importe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Importer maintenant</button>
        </div>
      </div>
      <div className="space-y-5">
        <div className="carte space-y-3 p-5">
          <h2 className="text-xl font-semibold">Cotisation</h2>
          <div className="flex items-center gap-2 text-sm"><span className="flex-1">Cotisation d'inscription, par enfant</span><input className="champ w-28 text-right" value={f.cotisation} onChange={(e) => setF({ ...f, cotisation: e.target.value })} /> €</div>
          <p className="text-xs text-nuit-600/70">S'applique aux nouvelles inscriptions ; modifiable enfant par enfant. Le prix des manuels est lu dans le texte des choix du formulaire, par ex. « (17 €) ».</p>
        </div>
        <div className="carte space-y-3 p-5">
          <h2 className="text-xl font-semibold">Écoles</h2>
          <p className="text-xs text-nuit-600/70">Pour envoyer les formulaires Première communion et Profession de foi aux écoles (Dossiers → Envoyer un formulaire).</p>
          {f.ecoles.map((x, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input className="champ py-1.5" placeholder="Nom de l'école" value={x.nom} onChange={(e) => majE(i, 'nom', e.target.value)} />
              <input className="champ py-1.5" placeholder="E-mail du responsable" value={x.email} onChange={(e) => majE(i, 'email', e.target.value)} />
              <button className="btn-icone text-red-700" onClick={() => setF({ ...f, ecoles: f.ecoles.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button className="text-sm text-or-600 hover:underline" onClick={() => setF({ ...f, ecoles: [...f.ecoles, { nom: '', email: '' }] })}><Plus className="mr-1 inline h-3.5 w-3.5" />Ajouter une école</button>
        </div>
        <button className="btn-principal" onClick={() => enregistrer()} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
      </div>
    </div>
  )
}
