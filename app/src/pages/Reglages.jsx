import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, RotateCcw, Wand2, AlertTriangle, CheckCircle2, Download, GraduationCap } from 'lucide-react'
import { api, fichierEnBase64 } from '../api.js'
import { chargerSceau, oublierSceau } from './Extraits.jsx'
import { useApp } from '../App.jsx'
import { Chargement, Erreur, useCharger, useNotif, useConfirmer, dateHeure, Interrupteur } from '../ui.jsx'
import { ApercuSignature } from './Courrier.jsx'
import { VARIABLES_COURRIER } from './Courriers.jsx'
import { ONGLETS_REGLAGES, ongletPermis } from '../acces.js'
import NewsletterReglages from './NewsletterReglages.jsx'


export default function Reglages() {
  const { utilisateur } = useApp()
  const onglets = ONGLETS_REGLAGES.filter((o) => ongletPermis(utilisateur, o))
  const [onglet, setOnglet] = useState(onglets[0])
  return (
    <>
      <div className="mb-5"><h1 className="text-3xl font-semibold">Réglages</h1><p className="text-sm text-nuit-600/80">Paroisse, signatures, réponses types, tri des mails, journal des actions</p></div>
      <div className="-mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1">
        {onglets.map((o) => <button key={o} onClick={() => setOnglet(o)} className={`pastille shrink-0 border px-3 py-1.5 text-sm ${onglet === o ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>{o}</button>)}
      </div>
      {onglet === 'Paroisse' && <Paroisse />}
      {onglet === 'Signatures' && <Signatures />}
      {onglet === 'Réponses types' && <Reponses />}
      {onglet === 'Modèles' && <Modeles />}
      {onglet === 'Tri automatique' && <TriAutomatique />}
      {onglet === 'Catéchisme' && <CatechismeReglages />}
      {onglet === 'Confirmands' && <ConfirmandsReglages />}
      {onglet === 'Cor Unum' && <CorUnumReglages />}
      {onglet === 'Paiements en ligne' && <PaiementsReglages />}
      {onglet === 'Newsletter' && <NewsletterReglages />}
      {onglet === 'Journal' && <Journal />}
      {onglet === 'Sauvegardes' && <Sauvegardes />}
    </>
  )
}

const CHAMPS_PAROISSE = [
  ['paroisse', 'Nom de la paroisse (formulaires B14, B6…)'], ['paroisse_courte', 'Nom court'], ['diocese', 'Diocèse'],
  ['commune', 'Commune (« fait à »)'], ['eglise', 'Église par défaut'], ['adresse', 'Adresse (signatures)'],
  ['site', 'Site (signatures)'], ['url_horaires', 'Page des horaires'],
  ['url_formulaires', 'Adresse des formulaires envoyés par mail (ex. https://secretariat.croix-glorieuse.org/)'],
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
  const { utilisateurs } = useApp()
  const ok = utilisateurs.filter((u) => u.actif && (u.role === 'admin' || u.acces?.signer))
  return (
    <div className="carte space-y-2 p-5">
      <h2 className="text-xl font-semibold">Peuvent signer</h2>
      <p className="text-sm text-nuit-600/80">{ok.length ? ok.map((u) => u.nom).join(', ') : 'Personne'}.</p>
      <p className="text-xs text-nuit-600/60">Extraits, B6 et courriers. Se règle dans Utilisateurs → fiche de la personne → « Peut signer ».</p>
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

function Modeles() {
  const notifier = useNotif()
  const { data, chargement, erreur } = useCharger(() => api('modeles'), [])
  const [liste, setListe] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  useEffect(() => { if (data) setListe(data.modeles) }, [data])
  if (chargement || !liste) return <><Erreur erreur={erreur} />{!erreur && <Chargement />}</>
  const maj = (i, k, v) => setListe(liste.map((m, j) => (j === i ? { ...m, [k]: v } : m)))
  async function enregistrer(retablir) {
    setEnvoi(true)
    try { const r = await api('modeles', { ecrire: retablir ? [{ cle: retablir, retablir: true }] : liste }); setListe(r.modeles); notifier(retablir ? 'Texte d\'origine rétabli' : 'Modèles enregistrés') }
    catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  return (
    <div className="space-y-4">
      <div className="carte p-4 text-sm text-nuit-600/80">
        <p className="mb-2">Ces textes pré-remplissent les courriers (bouton « Courriers » d'un dossier) ; ils restent modifiables avant la signature. Variables remplacées automatiquement :</p>
        <div className="flex flex-wrap gap-1.5">{VARIABLES_COURRIER.map(([k, l]) => <span key={k} className="pastille bg-nuit-50 text-xs" title={l}><code>{'{' + k + '}'}</code> <span className="text-nuit-600/60">{l}</span></span>)}</div>
      </div>
      {liste.map((m, i) => (
        <div key={m.cle} className="carte space-y-2 p-4">
          <div className="flex items-center gap-2"><h3 className="flex-1 text-lg font-semibold">{m.titre}</h3>
            {m.modifie && <button className="btn-clair text-sm" disabled={envoi} onClick={() => enregistrer(m.cle)}><RotateCcw className="h-4 w-4" />Texte d'origine</button>}</div>
          <label className="etiquette">Objet</label>
          <input className="champ" value={m.objet} onChange={(e) => maj(i, 'objet', e.target.value)} />
          <label className="etiquette">Texte</label>
          <textarea className="champ min-h-[180px] text-sm leading-relaxed" value={m.corps} onChange={(e) => maj(i, 'corps', e.target.value)} />
        </div>
      ))}
      <div className="flex justify-end"><button className="btn-principal" onClick={() => enregistrer()} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button></div>
    </div>
  )
}

function Sauvegardes() {
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const { data, chargement, erreur, recharger } = useCharger(() => api('sauvegardes'), [])
  const [encours, setEncours] = useState('')
  async function faire(payload, cle, message) {
    setEncours(cle)
    try { await api('sauvegardes', payload); notifier(message); recharger() } catch (e) { notifier(e.message, 'erreur') } finally { setEncours('') }
  }
  async function restaurer(s) {
    const ok = await confirmer({ titre: 'Restaurer cette sauvegarde ?', danger: true, bouton: 'Restaurer',
      texte: `Toute l'application reviendra à l'état du ${dateHeure(s.date)}. Ce qui a été saisi depuis sera perdu dans l'application (l'état actuel est d'abord sauvegardé, et l'ancienne base reste dans le Drive).` })
    if (ok) { await faire({ restaurer: s.id }, s.id, 'Sauvegarde restaurée.'); setTimeout(() => location.reload(), 1200) }
  }
  return (
    <div className="carte p-4">
      <Erreur erreur={erreur} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-nuit-600/80">Chaque dimanche à 3 h, une copie complète de la base est rangée dans le Drive (dossier « Sauvegardes ») ; les 8 dernières sont gardées. Chaque nuit, les notifications de plus de 6 mois sont effacées et le journal de plus de 2 ans est archivé (dossier « Archives »).</p>
        <button className="btn-principal" disabled={!!encours} onClick={() => faire({ sauvegarder: true }, 'nouv', 'Sauvegarde faite.')}>{encours === 'nouv' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Sauvegarder maintenant</button>
      </div>
      {chargement ? <Chargement /> : (
        <>
          {data?.entretien && <p className="mb-2 text-xs text-nuit-600/60">Dernier entretien automatique : {dateHeure(data.entretien)}</p>}
          {!data?.sauvegardes?.length ? <p className="text-sm text-nuit-600/70">Aucune sauvegarde pour l'instant.</p> : (
            <ul className="divide-y divide-nuit-50 text-sm">
              {data.sauvegardes.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                  <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">{s.nom.replace('Sauvegarde secrétariat ', '')}</a>
                  <button className="btn-clair text-sm" disabled={!!encours} onClick={() => restaurer(s)}>{encours === s.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Restaurer</button>
                </li>
              ))}
            </ul>
          )}
        </>
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

function CorUnumReglages() {
  const notifier = useNotif()
  const { data, chargement, erreur } = useCharger(() => api('cor.reglages'), [])
  const [f, setF] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [importe, setImporte] = useState(false)
  useEffect(() => { if (data) setF({ ...data, feuilles: data.feuilles.map((x) => ({ ...x })) }) }, [data])
  if (chargement || !f) return <><Erreur erreur={erreur} />{!erreur && <Chargement />}</>
  async function enregistrer(modif = {}) {
    const g = { ...f, ...modif }
    setF(g); setEnvoi(true)
    try {
      const r = await api('cor.reglagesEcrire', { lien_formulaire: g.lien_formulaire, feuilles: g.feuilles.map(({ id, annee }) => ({ id, annee })), import_auto: g.import_auto })
      setF(r); notifier(modif.import_auto !== undefined ? (g.import_auto ? 'Import automatique activé' : 'Import automatique désactivé') : 'Réglages enregistrés')
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  async function importer() {
    setImporte(true)
    try { const r = await api('cor.importer'); notifier(r.nouvelles || r.fusionnees ? `${r.nouvelles} nouvelle(s), ${r.fusionnees} mise(s) à jour` : 'Aucune nouvelle réponse') } catch (e) { notifier(e.message, 'erreur') } finally { setImporte(false) }
  }
  const majF = (i, k, v) => setF({ ...f, feuilles: f.feuilles.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="carte space-y-3 p-5">
        <h2 className="text-xl font-semibold">Formulaire d'inscription</h2>
        <p className="text-sm text-nuit-600">L'appli lit la feuille de réponses du formulaire Google de chaque année. Une réponse rejoint la fiche de la même personne (ou de son foyer), sinon une fiche « à répartir » est créée avec une fraternité proposée.</p>
        {f.feuilles.map((x, i) => (
          <div key={i} className="space-y-1 rounded-lg border border-nuit-100 p-3">
            <div className="grid grid-cols-[110px_1fr_auto] items-end gap-2">
              <div><label className="etiquette">Année</label><input className="champ py-1.5" placeholder="2027-2028" value={x.annee || ''} onChange={(e) => majF(i, 'annee', e.target.value)} /></div>
              <div><label className="etiquette">Feuille de réponses (adresse)</label><input className="champ py-1.5 text-xs" value={x.id} onChange={(e) => majF(i, 'id', e.target.value)} /></div>
              <button className="btn-icone text-red-700" onClick={() => setF({ ...f, feuilles: f.feuilles.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
            </div>
            {x.nom ? <p className="text-xs text-emerald-700">✓ {x.nom}</p> : x.erreur ? <p className="text-xs text-red-700">{x.erreur}</p> : null}
          </div>
        ))}
        <button className="text-sm text-or-600 hover:underline" onClick={() => setF({ ...f, feuilles: [...f.feuilles, { id: '', annee: '' }] })}><Plus className="mr-1 inline h-3.5 w-3.5" />Ajouter l'année suivante</button>
        <div className="flex items-center gap-3 rounded-lg bg-or-50/60 p-3">
          <div className="flex-1 text-sm"><strong>Import automatique</strong><br /><span className="text-xs text-nuit-600">Toutes les 15 minutes ; une notification signale les nouvelles inscriptions.</span></div>
          <Interrupteur actif={f.import_auto} onChange={(v) => enregistrer({ import_auto: v })} />
        </div>
        <button className="btn-clair w-full" onClick={importer} disabled={importe}>{importe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Importer maintenant</button>
      </div>
      <div className="space-y-5">
        <div className="carte space-y-3 p-5">
          <h2 className="text-xl font-semibold">Lien public du formulaire</h2>
          <p className="text-xs text-nuit-600/70">Pour relancer les anciens. Dans Google Forms : bouton « Envoyer » → icône lien → copier (adresse qui commence par https://docs.google.com/forms/d/e/… ou https://forms.gle/…).</p>
          <input className="champ" placeholder="https://forms.gle/…" value={f.lien_formulaire || ''} onChange={(e) => setF({ ...f, lien_formulaire: e.target.value })} />
        </div>
        <button className="btn-principal" onClick={() => enregistrer()} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
      </div>
    </div>
  )
}

function ConfirmandsReglages() {
  const notifier = useNotif()
  const { data, chargement, erreur } = useCharger(() => api('conf.reglages'), [])
  const [f, setF] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [importe, setImporte] = useState(false)
  useEffect(() => { if (data) setF({ ...data, feuilles: data.feuilles.map((x) => ({ ...x })) }) }, [data])
  if (chargement || !f) return <><Erreur erreur={erreur} />{!erreur && <Chargement />}</>
  async function enregistrer(modif = {}) {
    const g = { ...f, ...modif }
    setF(g); setEnvoi(true)
    try {
      const r = await api('conf.reglagesEcrire', { feuilles: g.feuilles.map(({ id, annee, annee_confirmation }) => ({ id, annee, annee_confirmation })), import_auto: g.import_auto })
      setF(r); notifier(modif.import_auto !== undefined ? (g.import_auto ? 'Import automatique activé' : 'Import automatique désactivé') : 'Réglages enregistrés')
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  async function importer() {
    setImporte(true)
    try { const r = await api('conf.importer'); notifier(r.nouveaux || r.completes ? `${r.nouveaux} nouveau(x), ${r.completes} complété(s)` : 'Aucune nouvelle inscription') } catch (e) { notifier(e.message, 'erreur') } finally { setImporte(false) }
  }
  const majF = (i, k, v) => setF({ ...f, feuilles: f.feuilles.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })
  return (
    <div className="max-w-3xl space-y-5">
      <div className="carte space-y-3 p-5">
        <h2 className="text-xl font-semibold">Formulaire « Confirmation adultes »</h2>
        <p className="text-sm text-nuit-600">Chaque réponse crée un dossier « Confirmand adulte » (ou complète le dossier existant de la même personne), classé dans l'année de confirmation choisie. Les réponses en double sont fusionnées.</p>
        {f.feuilles.map((x, i) => (
          <div key={i} className="space-y-1 rounded-lg border border-nuit-100 p-3">
            <div className="grid grid-cols-[110px_110px_1fr_auto] items-end gap-2">
              <div><label className="etiquette">Année scolaire</label><input className="champ py-1.5" placeholder="2027-2028" value={x.annee || ''} onChange={(e) => majF(i, 'annee', e.target.value)} /></div>
              <div><label className="etiquette">Confirmation</label><input className="champ py-1.5" placeholder="2028" value={x.annee_confirmation || ''} onChange={(e) => majF(i, 'annee_confirmation', e.target.value)} /></div>
              <div><label className="etiquette">Feuille de réponses (adresse)</label><input className="champ py-1.5 text-xs" value={x.id} onChange={(e) => majF(i, 'id', e.target.value)} /></div>
              <button className="btn-icone text-red-700" onClick={() => setF({ ...f, feuilles: f.feuilles.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
            </div>
            {x.nom ? <p className="text-xs text-emerald-700">✓ {x.nom}</p> : x.erreur ? <p className="text-xs text-red-700">{x.erreur}</p> : null}
          </div>
        ))}
        <button className="text-sm text-or-600 hover:underline" onClick={() => setF({ ...f, feuilles: [...f.feuilles, { id: '', annee: '', annee_confirmation: '' }] })}><Plus className="mr-1 inline h-3.5 w-3.5" />Ajouter l'année suivante</button>
        <div className="flex items-center gap-3 rounded-lg bg-or-50/60 p-3">
          <div className="flex-1 text-sm"><strong>Import automatique</strong><br /><span className="text-xs text-nuit-600">Toutes les 15 minutes. Un accusé de réception (réponse type « Accusé de réception – confirmation ») part pour chaque nouvelle inscription reçue après la mise en service{f.accuse_depuis ? ` (${new Date(f.accuse_depuis).toLocaleDateString('fr-FR')})` : ''}.</span></div>
          <Interrupteur actif={f.import_auto} onChange={(v) => enregistrer({ import_auto: v })} />
        </div>
        <div className="flex gap-2">
          <button className="btn-clair flex-1" onClick={importer} disabled={importe}>{importe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Importer maintenant</button>
          <button className="btn-principal" onClick={() => enregistrer()} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
        </div>
      </div>
    </div>
  )
}

const STATUTS_PAIEMENT = { paye: ['Reçu', 'bg-emerald-100 text-emerald-900'], en_attente: ['En attente', 'bg-amber-100 text-amber-900'], cree: ['Préparé', 'bg-nuit-100 text-nuit-600'], abandonne: ['Abandonné', 'bg-nuit-100 text-nuit-600'] }

function PaiementsReglages() {
  const notifier = useNotif()
  const { data, chargement, erreur } = useCharger(() => api('paiements.reglages'), [])
  const [f, setF] = useState(null)
  const [secret, setSecret] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [test, setTest] = useState(null)
  useEffect(() => { if (data) setF(data) }, [data])
  if (chargement || !f) return <><Erreur erreur={erreur} />{!erreur && <Chargement />}</>
  async function enregistrer(modif = {}) {
    const g = { ...f, ...modif }
    setF(g); setEnvoi(true)
    try {
      const r = await api('paiements.reglagesEcrire', { slug: g.slug, client_id: g.client_id, client_secret: secret || undefined, sandbox: g.sandbox, actif: g.actif, hors_ligne: g.hors_ligne })
      setF(r); setSecret(''); notifier(modif.actif !== undefined ? (g.actif ? 'Paiement en ligne activé' : 'Paiement en ligne désactivé') : 'Réglages enregistrés')
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  async function tester() {
    setTest('…')
    try { const r = await api('paiements.tester'); setTest(`✓ Connecté à « ${r.nom} »${r.ville ? ' (' + r.ville + ')' : ''} – mode ${r.mode}`) } catch (e) { setTest('✗ ' + e.message) }
  }
  const copier = (t) => navigator.clipboard?.writeText(t).then(() => notifier('Copié'), () => notifier('Copie impossible', 'erreur'))
  const pret = f.slug && f.client_id && f.secret_ok
  return (
    <div className="max-w-3xl space-y-5">
      <div className="carte space-y-3 p-5">
        <h2 className="text-xl font-semibold">HelloAsso</h2>
        <p className="text-sm text-nuit-600">Paiement en ligne de la cotisation du catéchisme (par famille), des livres et des retraites (retraite et participation à la cérémonie, séparément). L'appli calcule le montant, la personne paie sur la page sécurisée de HelloAsso, puis le paiement s'inscrit tout seul dans l'appli.</p>
        <div><label className="etiquette">Adresse ou nom court de l'association sur HelloAsso</label><input className="champ" placeholder="https://www.helloasso.com/associations/…" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="etiquette">Identifiant de l'API (Client ID)</label><input className="champ" value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })} /></div>
          <div><label className="etiquette">Secret de l'API (Client Secret)</label><input className="champ" type="password" autoComplete="new-password" placeholder={f.secret_ok ? '•••••••• (enregistré)' : ''} value={secret} onChange={(e) => setSecret(e.target.value)} /></div>
        </div>
        <p className="text-xs text-nuit-600/70">Sur HelloAsso : Mon compte → Intégrations et API. Le secret n'est jamais réaffiché.</p>
        <label className="flex items-center gap-3 text-sm"><Interrupteur actif={f.sandbox} onChange={(v) => setF({ ...f, sandbox: v })} />Mode essai (compte « sandbox » de HelloAsso, aucun vrai paiement)</label>
        <div className="flex flex-wrap gap-2">
          <button className="btn-principal" disabled={envoi} onClick={() => enregistrer()}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
          <button className="btn-clair" disabled={!pret} onClick={tester}>Tester la connexion</button>
        </div>
        {test && <p className={`text-sm ${test.startsWith('✓') ? 'text-emerald-700' : test.startsWith('✗') ? 'text-red-700' : ''}`}>{test}</p>}
      </div>
      <div className="carte space-y-3 p-5">
        <label className="flex items-center gap-3"><Interrupteur actif={f.actif} disabled={!pret || envoi} onChange={(v) => enregistrer({ actif: v })} /><span><strong>Paiement en ligne activé</strong><br /><span className="text-xs text-nuit-600/70">Boutons « Payer en ligne » dans les mails et les pages ; mail automatique aux parents après chaque nouvelle inscription au catéchisme ; contrôle des paiements toutes les 15 minutes.</span></span></label>
        <div><label className="etiquette">Paiement hors ligne (rappelé dans les mails du catéchisme et de la boutique)</label><textarea className="champ min-h-[70px]" placeholder="Vous pouvez aussi régler par chèque à l'ordre de « … » ou en espèces au secrétariat." value={f.hors_ligne} onChange={(e) => setF({ ...f, hors_ligne: e.target.value })} onBlur={() => enregistrer()} /></div>
        <div><label className="etiquette">Adresse de notification (à coller sur HelloAsso → Intégrations et API → « Mon URL de callback »)</label>
          <div className="flex gap-2"><input className="champ text-xs" readOnly value={f.url_notification} onFocus={(e) => e.target.select()} /><button className="btn-clair" onClick={() => copier(f.url_notification)}>Copier</button></div>
          <p className="mt-1 text-xs text-nuit-600/70">Facultatif : sans elle, les paiements sont quand même vérifiés au retour de la personne et toutes les 15 minutes.</p></div>
        <div><label className="etiquette">Boutique de livres (lien public)</label>
          <div className="flex gap-2"><input className="champ text-xs" readOnly value={f.url_boutique} onFocus={(e) => e.target.select()} /><button className="btn-clair" onClick={() => copier(f.url_boutique)}>Copier</button></div></div>
      </div>
      <div className="carte p-5">
        <h2 className="mb-2 text-xl font-semibold">Derniers paiements en ligne</h2>
        {!f.derniers.length ? <p className="text-sm text-nuit-600/70">Aucun pour l'instant.</p> : (
          <ul className="divide-y divide-nuit-100 text-sm">{f.derniers.map((x) => (
            <li key={x.id} className="flex items-center gap-3 py-2"><span className="w-24 shrink-0 text-xs text-nuit-600/70">{dateHeure(x.date)}</span><span className="flex-1">{x.libelle}<span className="block text-xs text-nuit-600/60">{x.email}</span></span>
              <span className="font-medium">{(x.montant || 0).toLocaleString('fr-FR')} €</span><span className={`pastille ${STATUTS_PAIEMENT[x.statut]?.[1] || ''}`}>{STATUTS_PAIEMENT[x.statut]?.[0] || x.statut}</span></li>))}</ul>
        )}
      </div>
    </div>
  )
}
