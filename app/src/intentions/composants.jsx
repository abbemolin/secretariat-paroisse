// Fenêtres communes de la tuile « Intentions de messe ».
import { useEffect, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { api } from '../api.js'
import { useApp } from '../App.jsx'
import { Modale, useNotif } from '../ui.jsx'
import { TYPES, celebrants, cleCelebrant, dateLongue, heureFr, nomCelebrant, sansAdresse } from './donnees.js'

/** Saisie ou modification d'une intention (Calendrier : + Intention, + Messe privée, + ; Gérer : Modifier). */
export function FicheIntention({ initiale, titre, onFermer, onEnregistree }) {
  const notifier = useNotif()
  const [f, setF] = useState({ type_intention: 'Défunt', nom_donateur: '', commentaire: '', nom_intention: '', heure_messe: '09:00', ...initiale })
  const [envoi, setEnvoi] = useState(false)
  const maj = (k, v) => setF((x) => ({ ...x, [k]: v }))
  async function enregistrer() {
    if (!f.nom_intention?.trim()) { notifier('Veuillez indiquer une intention.', 'erreur'); return }
    if (!f.date_messe) { notifier('Veuillez indiquer une date.', 'erreur'); return }
    setEnvoi(true)
    try {
      const r = await api('intentions.ecrire', { id: f.id, google_event_id: f.google_event_id, date_messe: f.date_messe, heure_messe: f.heure_messe,
        nom_intention: f.nom_intention, type_intention: f.type_intention, nom_donateur: f.nom_donateur, commentaire: f.commentaire })
      notifier(r._enAttente ? 'Intention gardée sur l\'appareil : elle sera envoyée au retour de la connexion' : '✅ Intention enregistrée')
      onEnregistree(r._enAttente ? { ...f, id: f.id || 'local-' + Date.now(), statut: 'valide', _enAttente: true, google_event_id: f.id ? f.google_event_id : ({ prive: 'prive_local', libre: 'libre_local' }[f.google_event_id] || f.google_event_id) } : r)
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  return (
    <Modale titre={titre} onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Fermer</button>
        <button className="btn-principal" disabled={envoi} onClick={enregistrer}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}✅ Confirmer l'intention</button></>}>
      <div className="space-y-3">
        {f.libre !== false && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="etiquette">Date</label><input type="date" className="champ" value={f.date_messe || ''} onChange={(e) => maj('date_messe', e.target.value)} /></div>
            <div><label className="etiquette">Heure</label><input type="time" className="champ" value={f.heure_messe || ''} onChange={(e) => maj('heure_messe', e.target.value)} /></div>
          </div>
        )}
        <div><label className="etiquette">Intention pour</label><input autoFocus className="champ" placeholder="ex : Défunts famille Dupont" value={f.nom_intention} onChange={(e) => maj('nom_intention', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="etiquette">Type</label><select className="champ" value={f.type_intention} onChange={(e) => maj('type_intention', e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="etiquette">Demandeur</label><input className="champ" placeholder="Mme Dupont" value={f.nom_donateur} onChange={(e) => maj('nom_donateur', e.target.value)} /></div>
        </div>
        <div><label className="etiquette">Note privée</label><textarea className="champ" rows={2} value={f.commentaire || ''} onChange={(e) => maj('commentaire', e.target.value)} /></div>
      </div>
    </Modale>
  )
}

/** « J'ai célébré cette messe » / « Célébrée — Abbé … · Annuler » ; le curé peut aussi l'attribuer à un autre prêtre. */
export function ZoneCelebration({ intention, onMaj, compact }) {
  const { utilisateur, utilisateurs } = useApp()
  const notifier = useNotif()
  const [choix, setChoix] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const moi = cleCelebrant(utilisateur)
  const peutAttribuer = utilisateur.role === 'admin' || utilisateur.role === 'cure'
  async function celebrer(celebrant) {
    setEnvoi(true)
    try {
      const r = await api('intentions.celebrer', { id: intention.id, ...(celebrant !== undefined ? { celebrant } : {}) })
      const cle = celebrant === undefined ? moi : celebrant
      onMaj(r._enAttente ? { ...intention, celebrant: cle, celebre_le: cle ? new Date().toISOString() : null, _enAttente: true } : r)
      notifier(r._enAttente ? 'Gardé sur l\'appareil : envoyé au retour de la connexion' : cle ? '✝ Messe déclarée comme célébrée' : '↩ Déclaration annulée')
      setChoix(false)
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  if (intention.statut !== 'valide') return null
  if (intention.celebrant) {
    const peutAnnuler = peutAttribuer || intention.celebrant === moi
    return (
      <div className={`flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 ${compact ? '' : 'mt-2'}`}>
        <span className="flex-1">✝ Célébrée — {nomCelebrant(intention.celebrant, utilisateurs)}{intention._enAttente ? ' (à envoyer)' : ''}</span>
        {peutAttribuer && <select className="champ w-auto py-1 text-xs" value="" disabled={envoi} onChange={(e) => e.target.value && celebrer(e.target.value)}>
          <option value="">Modifier…</option>{celebrants(utilisateurs).map((c) => <option key={c.cle} value={c.cle}>{c.nom}</option>)}</select>}
        {peutAnnuler && <button className="text-xs underline" disabled={envoi} onClick={() => celebrer(null)}>Annuler</button>}
      </div>
    )
  }
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'mt-2'}`}>
      <button className="btn-clair py-1.5 text-sm" disabled={envoi} onClick={() => celebrer()}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}✝ J'ai célébré cette messe</button>
      {peutAttribuer && (choix
        ? <select autoFocus className="champ w-auto py-1.5 text-sm" defaultValue="" onChange={(e) => e.target.value && celebrer(e.target.value)} onBlur={() => setChoix(false)}>
          <option value="">— Célébrée par…</option>{celebrants(utilisateurs).map((c) => <option key={c.cle} value={c.cle}>{c.nom}</option>)}</select>
        : <button className="text-xs text-nuit-600 underline" onClick={() => setChoix(true)}>Un autre prêtre…</button>)}
    </div>
  )
}

/** Mail au demandeur : aperçu modifiable, puis envoi immédiat (confirmation) ; refus : avec date proposée ou non. */
export function FenetreMail({ intention, refus, onFermer, onFait }) {
  const notifier = useNotif()
  const [alt, setAlt] = useState({ date: '', heure: '' })
  const [apercu, setApercu] = useState(null)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const adresse = !sansAdresse(intention)
  useEffect(() => {
    let annule = false
    api('intentions.apercu', { id: intention.id, refus: !!refus, date_alternative: alt.date || undefined, heure_alternative: alt.heure || undefined })
      .then((a) => { if (!annule) { setApercu(a); setTexte(a.texte) } }).catch((e) => notifier(e.message, 'erreur'))
    return () => { annule = true }
  }, [intention.id, refus, alt.date, alt.heure])   // eslint-disable-line react-hooks/exhaustive-deps
  async function envoyer(avecMail) {
    setEnvoi(true)
    try {
      const r = refus
        ? await api('intentions.refuser', { id: intention.id, date_alternative: alt.date || undefined, heure_alternative: alt.heure || undefined, envoyer: avecMail, texte })
        : await api('intentions.mail', { id: intention.id, texte })
      notifier(refus ? (avecMail ? '✖️ Demande refusée — mail envoyé' : '✖️ Demande refusée') : '📧 Confirmation envoyée')
      onFait(r)
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  return (
    <Modale titre={refus ? 'Refuser la demande' : '📧 Confirmation au demandeur'} onFermer={onFermer} large
      pied={<>
        <button className="btn-clair mr-auto" onClick={onFermer}>Fermer sans envoyer</button>
        {refus && <button className="btn-clair" disabled={envoi} onClick={() => envoyer(false)}>Refuser sans mail</button>}
        {adresse && <button className="btn-principal" disabled={envoi || !apercu} onClick={() => envoyer(true)}>{envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{refus ? 'Refuser et envoyer' : 'Envoyer'}</button>}
      </>}>
      <div className="space-y-3">
        <p className="text-sm text-nuit-600"><b>{intention.nom_intention}</b> — {dateLongue(intention.date_messe)}{intention.heure_messe ? ' à ' + heureFr(intention.heure_messe) : ''}</p>
        {refus && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="etiquette">Date proposée (facultatif)</label><input type="date" className="champ" value={alt.date} onChange={(e) => setAlt({ ...alt, date: e.target.value })} /></div>
            <div><label className="etiquette">Heure proposée</label><input type="time" className="champ" value={alt.heure} disabled={!alt.date} onChange={(e) => setAlt({ ...alt, heure: e.target.value })} /></div>
          </div>
        )}
        {!adresse ? <p className="rounded-lg bg-nuit-50 px-3 py-2 text-sm text-nuit-600">Sans adresse : aucun mail ne peut être envoyé{refus ? ' ; la demande sera seulement marquée refusée' : ''}.</p> : (
          <>
            <div className="text-sm text-nuit-600">À : <b>{apercu?.destinataire}</b> · Objet : {apercu?.objet}</div>
            <textarea className="champ min-h-[260px] font-mono text-[13px]" value={texte} onChange={(e) => setTexte(e.target.value)} disabled={!apercu} />
            <p className="text-xs text-nuit-600/70">Envoyé depuis secretariat@croix-glorieuse.org, comme aujourd'hui.</p>
          </>
        )}
      </div>
    </Modale>
  )
}
