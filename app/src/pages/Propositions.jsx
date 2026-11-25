import { useState } from 'react'
import { Plus, Trash2, Copy, Loader2, Music, BookOpen, ArrowUp, ArrowDown, Sparkles, Eye, EyeOff } from 'lucide-react'
import { api } from '../api.js'
import FonctionFermee from '../FonctionFermee.jsx'
import { Chargement, Erreur, EnTete, Modale, Vide, dateCourte, useCharger, useConfirmer, useNotif } from '../ui.jsx'

/**
 * Propositions spirituelles pour l'app des paroissiens (curé et prêtres) :
 * parcours jour par jour (dates fixes) et textes isolés ; texte, image, audio, référence biblique.
 */
const ajouter = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const aujourdhui = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })

export default function Propositions() {
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const { data, chargement, erreur, recharger, setData } = useCharger(() => api('propositions.liste'), [])
  const [edition, setEdition] = useState(null)
  async function ouvrir(p) {
    try { setEdition(p ? await api('propositions.lire', { id: p.id }) : { type: 'parcours', titre: '', resume: '', image: '', debut: aujourdhui(), statut: 'brouillon', etapes: [{ titre: '', texte: '', bible: '' }] }) }
    catch (e) { notifier(e.message, 'erreur') }
  }
  async function supprimer(p) {
    if (!(await confirmer({ titre: 'Supprimer la proposition', texte: `« ${p.titre} » et ses étapes disparaissent de l'app ; les abonnements sont effacés.`, bouton: 'Supprimer', danger: true }))) return
    try { setData(await api('propositions.supprimer', { id: p.id })); notifier('Supprimée') } catch (e) { notifier(e.message, 'erreur') }
  }
  const auj = aujourdhui()
  return (
    <>
      <EnTete titre="Propositions" sousTitre="Parcours et textes pour l'app des paroissiens"
        actions={<button className="btn-principal" onClick={() => ouvrir(null)}><Plus className="h-4 w-4" />Nouvelle proposition</button>} />
      <FonctionFermee cle="propositions" texte="Les propositions sont désactivées dans l'app : ni lecture ni notification." />
      <Erreur erreur={erreur} reessayer={recharger} />
      {chargement && !data ? <Chargement /> : !data?.length ? <Vide icone={Sparkles} texte="Aucune proposition pour le moment." /> : (
        <div className="carte divide-y divide-nuit-50">
          {data.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <button className="min-w-0 flex-1 text-left" onClick={() => ouvrir(p)}>
                <div className="font-medium">{p.titre}</div>
                <div className="text-xs text-nuit-600/70">{p.type === 'parcours' ? `Parcours · ${p.nb_etapes} étape${p.nb_etapes > 1 ? 's' : ''} · du ${dateCourte(p.debut)} au ${dateCourte(p.fin)}` : `Texte · ${dateCourte(p.debut)}`}{p.type === 'parcours' ? ` · ${p.abonnes} abonné${p.abonnes > 1 ? 's' : ''}` : ''}</div>
              </button>
              <span className={`pastille ${p.statut === 'publiee' ? (p.fin < auj ? 'bg-nuit-50 text-nuit-600' : 'bg-green-50 text-green-800') : 'bg-or-100 text-or-600'}`}>{p.statut === 'publiee' ? (p.fin < auj ? 'terminée' : p.debut > auj ? 'à venir' : 'en cours') : 'brouillon'}</span>
              <button className="btn-icone text-red-700" aria-label="Supprimer" onClick={() => supprimer(p)}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-nuit-600/70">Les paroissiens connectés voient les propositions publiées. Pour un parcours, chacun peut s'abonner : il reçoit l'étape du jour à l'heure qu'il a choisie et coche ce qu'il a fait (la paroisse ne voit que le nombre d'abonnés).</p>
      {edition && <Edition p={edition} onFermer={() => setEdition(null)} onFait={() => { setEdition(null); recharger() }} />}
    </>
  )
}

function Edition({ p, onFermer, onFait }) {
  const notifier = useNotif()
  const [f, setF] = useState(p)
  const [envoi, setEnvoi] = useState('')
  const [dupli, setDupli] = useState(false)
  const [nouveauDebut, setNouveauDebut] = useState('')
  const parcours = f.type === 'parcours'
  const majE = (i, k, v) => setF({ ...f, etapes: f.etapes.map((e, j) => (j === i ? { ...e, [k]: v } : e)) })
  const deplacer = (i, d) => { const l = [...f.etapes]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); setF({ ...f, etapes: l.map((e) => ({ ...e, jour: '' })) }) }
  const jourDe = (e, i) => e.jour || (parcours ? ajouter(f.debut || aujourdhui(), i) : f.debut)
  async function enregistrer(statut) {
    setEnvoi(statut)
    try {
      const r = await api('propositions.ecrire', { ...f, statut, etapes: f.etapes.map((e, i) => ({ ...e, jour: parcours ? jourDe(e, i) : f.debut })) })
      notifier(statut === 'publiee' ? 'Publiée dans l\'app' : 'Brouillon enregistré'); setF(r); onFait()
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi('') }
  }
  async function dupliquer() {
    setEnvoi('dupli')
    try { await api('propositions.dupliquer', { id: f.id, debut: nouveauDebut }); notifier('Copie créée (brouillon)'); onFait() } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi('') }
  }
  async function audio(i, fichier) {
    if (!fichier) return
    if (fichier.size > 20 * 1024 * 1024) { notifier('Fichier trop lourd (20 Mo au plus).', 'erreur'); return }
    setEnvoi('audio' + i)
    try {
      const b64 = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(fichier) })
      const r = await api('propositions.audio', { nom: fichier.name, type: fichier.type || 'audio/mpeg', base64: b64 })
      setF((g) => ({ ...g, etapes: g.etapes.map((e, j) => (j === i ? { ...e, ...r } : e)) })); notifier('Audio envoyé')
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi('') }
  }
  return (
    <Modale large titre={f.id ? f.titre || 'Proposition' : 'Nouvelle proposition'} onFermer={onFermer}
      pied={<>
        {f.id && <button className="btn-clair mr-auto" onClick={() => setDupli(!dupli)}><Copy className="h-4 w-4" />Dupliquer</button>}
        <button className="btn-clair" onClick={onFermer}>Fermer</button>
        <button className="btn-clair" disabled={!!envoi} onClick={() => enregistrer('brouillon')}>{envoi === 'brouillon' ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}{f.statut === 'publiee' ? 'Retirer (brouillon)' : 'Enregistrer le brouillon'}</button>
        <button className="btn-principal" disabled={!!envoi} onClick={() => enregistrer('publiee')}>{envoi === 'publiee' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}{f.statut === 'publiee' ? 'Enregistrer' : 'Publier'}</button>
      </>}>
      <div className="space-y-3">
        {dupli && <div className="rounded-lg bg-or-50 p-3 text-sm"><label className="etiquette">Nouvelle date du premier jour (ex. Avent de l'année prochaine)</label>
          <div className="flex gap-2"><input type="date" className="champ" value={nouveauDebut} onChange={(e) => setNouveauDebut(e.target.value)} />
            <button className="btn-principal" disabled={!nouveauDebut || !!envoi} onClick={dupliquer}>{envoi === 'dupli' && <Loader2 className="h-4 w-4 animate-spin" />}Créer la copie</button></div>
          <p className="mt-1 text-xs text-nuit-600/70">Toutes les étapes sont décalées d'autant ; la copie est un brouillon.</p></div>}
        <div className="flex gap-1 rounded-lg bg-nuit-50 p-1 text-sm">
          {[['parcours', 'Parcours jour par jour'], ['texte', 'Texte isolé']].map(([k, l]) => <button key={k} className={`flex-1 rounded-md px-3 py-1.5 ${f.type === k ? 'bg-white font-semibold text-nuit shadow-sm' : 'text-nuit-600'}`} onClick={() => setF({ ...f, type: k, etapes: k === 'texte' ? f.etapes.slice(0, 1) : f.etapes })}>{l}</button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div><label className="etiquette">Titre</label><input className="champ" value={f.titre} maxLength={120} onChange={(e) => setF({ ...f, titre: e.target.value })} placeholder={parcours ? 'Avent 2026 : un pas par jour' : 'Saint Nicolas'} /></div>
          <div><label className="etiquette">{parcours ? 'Premier jour' : 'Date de publication'}</label><input type="date" className="champ" value={f.debut} onChange={(e) => setF({ ...f, debut: e.target.value, etapes: f.etapes.map((x) => ({ ...x, jour: '' })) })} /></div>
        </div>
        <div><label className="etiquette">Présentation courte</label><textarea className="champ min-h-[60px]" maxLength={600} value={f.resume} onChange={(e) => setF({ ...f, resume: e.target.value })} /></div>
        <div><label className="etiquette">Image (adresse https://, facultatif)</label><input className="champ" value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} /></div>
        {f.etapes.map((e, i) => (
          <div key={e.id || i} className="rounded-lg border border-nuit-100 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-nuit">
              {parcours ? <>Jour {i + 1} · <span className="font-normal text-nuit-600">{((s) => s.charAt(0).toUpperCase() + s.slice(1))(new Date(jourDe(e, i) + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</span></> : 'Texte'}
              {parcours && <span className="ml-auto flex gap-1">
                <button className="btn-icone" disabled={i === 0} onClick={() => deplacer(i, -1)} aria-label="Monter"><ArrowUp className="h-4 w-4" /></button>
                <button className="btn-icone" disabled={i === f.etapes.length - 1} onClick={() => deplacer(i, 1)} aria-label="Descendre"><ArrowDown className="h-4 w-4" /></button>
                <button className="btn-icone text-red-700" disabled={f.etapes.length === 1} onClick={() => setF({ ...f, etapes: f.etapes.filter((_, j) => j !== i).map((x) => ({ ...x, jour: '' })) })} aria-label="Retirer"><Trash2 className="h-4 w-4" /></button></span>}
            </div>
            <input className="champ mb-2" placeholder="Titre de l'étape" value={e.titre || ''} onChange={(ev) => majE(i, 'titre', ev.target.value)} />
            <textarea className="champ mb-2 min-h-[140px]" placeholder="Texte (méditation, vie du saint, prière…)" value={e.texte || ''} onChange={(ev) => majE(i, 'texte', ev.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <div><label className="etiquette flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />Référence biblique (facultatif)</label><input className="champ" placeholder="Mt 5, 1-12" value={e.bible || ''} onChange={(ev) => majE(i, 'bible', ev.target.value)} /></div>
              <div><label className="etiquette">Image de l'étape (https://, facultatif)</label><input className="champ" value={e.image || ''} onChange={(ev) => majE(i, 'image', ev.target.value)} /></div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <label className="btn-clair cursor-pointer">{envoi === 'audio' + i ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}{e.audio_id ? 'Remplacer l\'audio' : 'Ajouter un audio (MP3, 20 Mo)'}
                <input type="file" accept="audio/*" className="hidden" onChange={(ev) => audio(i, ev.target.files[0])} /></label>
              {e.audio_id && <><span className="text-xs text-nuit-600">{e.audio_nom}</span><button className="text-xs text-red-700 underline" onClick={() => setF({ ...f, etapes: f.etapes.map((x, j) => (j === i ? { ...x, audio_id: '', audio_nom: '' } : x)) })}>retirer</button></>}
            </div>
          </div>
        ))}
        {parcours && <button className="btn-clair" onClick={() => setF({ ...f, etapes: [...f.etapes, { titre: '', texte: '', bible: '' }] })}><Plus className="h-4 w-4" />Ajouter un jour</button>}
      </div>
    </Modale>
  )
}
