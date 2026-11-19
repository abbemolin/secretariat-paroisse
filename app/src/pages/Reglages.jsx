import { useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { api } from '../api.js'
import { useApp } from '../App.jsx'
import { Chargement, Erreur, useCharger, useNotif, dateHeure } from '../ui.jsx'
import { ApercuSignature } from './Courrier.jsx'

const ONGLETS = ['Paroisse', 'Signatures', 'Réponses types', 'Journal']

export default function Reglages() {
  const [onglet, setOnglet] = useState('Paroisse')
  return (
    <>
      <div className="mb-5"><h1 className="text-3xl font-semibold">Réglages</h1><p className="text-sm text-nuit-600/80">Paroisse, signatures, réponses types, journal des actions</p></div>
      <div className="-mx-1 mb-5 flex gap-1.5 overflow-x-auto px-1">
        {ONGLETS.map((o) => <button key={o} onClick={() => setOnglet(o)} className={`pastille shrink-0 border px-3 py-1.5 text-sm ${onglet === o ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>{o}</button>)}
      </div>
      {onglet === 'Paroisse' && <Paroisse />}
      {onglet === 'Signatures' && <Signatures />}
      {onglet === 'Réponses types' && <Reponses />}
      {onglet === 'Journal' && <Journal />}
    </>
  )
}

const CHAMPS_PAROISSE = [
  ['paroisse', 'Nom de la paroisse (formulaires B14, B6…)'], ['paroisse_courte', 'Nom court'], ['diocese', 'Diocèse'],
  ['commune', 'Commune (« fait à »)'], ['eglise', 'Église par défaut'], ['adresse', 'Adresse (signatures)'],
  ['site', 'Site (signatures)'], ['url_horaires', 'Page des horaires'], ['url_icones', 'Adresse des icônes de signature (facultatif)']
]

function Paroisse() {
  const { reglages, majDonnees } = useApp()
  const notifier = useNotif()
  const [f, setF] = useState(reglages)
  const [envoi, setEnvoi] = useState(false)
  async function enregistrer() {
    setEnvoi(true)
    try { const r = await api('reglages.ecrire', f); majDonnees({ reglages: r }); notifier('Réglages enregistrés') } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  return (
    <div className="carte max-w-2xl space-y-3 p-5">
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
        <button className="btn-clair" onClick={() => setListe([...liste, { cle: 'rep' + Date.now(), titre: 'Nouvelle réponse', sujet: '', corps: 'Bonjour,\n\n\n\nBien fraternellement,' }])}><Plus className="h-4 w-4" />Ajouter</button>
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
