// Envoi groupé à un groupe de contacts ou à une sélection (Contacts et Courrier).
// Jusqu'à 100 destinataires : Gmail (copie cachée, depuis secretariat@) ; au-delà : Brevo (campagne, lien de désinscription).
import { useEffect, useState } from 'react'
import { Loader2, Users } from 'lucide-react'
import { api } from './api.js'
import { useApp } from './App.jsx'
import { Chargement, Erreur, Modale, useNotif } from './ui.jsx'

export function EnvoiContacts({ groupe: groupeInit = '', ids, libelle, onFermer }) {
  const notifier = useNotif()
  const { utilisateur, signatures } = useApp()
  const [groupes, setGroupes] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [f, setF] = useState({ groupe: groupeInit, sujet: '', corps: '', signature: utilisateur.signature || 'paroisse' })
  const [verif, setVerif] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  useEffect(() => { if (!ids) api('mail.groupes').then(setGroupes).catch(setErreur) }, [ids])
  const maj = (k) => (e) => { setF({ ...f, [k]: e.target.value }); if (k === 'groupe') setVerif(null) }
  const charge = () => (ids ? { ...f, groupe: '', ids } : f)

  async function verifier() {
    setEnvoi(true); setErreur(null)
    try { setVerif(await api('contacts.envoyer', { ...charge(), essai: true })) } catch (e) { setErreur(e) } finally { setEnvoi(false) }
  }
  async function envoyer() {
    setEnvoi(true); setErreur(null)
    try {
      const r = await api('contacts.envoyer', charge())
      notifier(r.canal === 'brevo' ? `Campagne Brevo envoyée à ${r.nb} personnes` : `Envoyé à ${r.nb} personnes`)
      onFermer()
    } catch (e) { setErreur(e); setEnvoi(false) }
  }
  const pret = (ids || f.groupe) && f.sujet && f.corps
  return (
    <Modale large titre="Envoi groupé" onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button>
        {verif ? <button className="btn-or" onClick={envoyer} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Envoyer à {verif.nb} personnes{verif.canal === 'brevo' ? ' (Brevo)' : ''}</button>
          : <button className="btn-principal" onClick={verifier} disabled={envoi || !pret}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Vérifier</button>}</>}>
      <div className="space-y-3">
        <p className="text-xs text-nuit-600/70">Jusqu'à 100 personnes, le message part de secretariat@croix-glorieuse.org, en copie cachée. Au-delà, il part par Brevo (même adresse d'expéditeur, avec un lien de désinscription ; pas de pièce jointe).</p>
        {ids ? <p className="rounded-lg bg-or-50 px-3 py-2 text-sm text-or-600"><Users className="mr-1 inline h-4 w-4" />{libelle || `${ids.length} contacts sélectionnés`}</p>
          : <div><label className="etiquette">Groupe de contacts</label>
            {!groupes && !erreur ? <Chargement /> : <select className="champ" value={f.groupe} onChange={maj('groupe')}>
              <option value="">Choisir…</option>
              <optgroup label="Groupes">{(groupes || []).filter((g) => !g.auto).map((g) => <option key={g.id} value={g.id}>{g.nom} ({g.nb})</option>)}</optgroup>
              <optgroup label="Groupes automatiques">{(groupes || []).filter((g) => g.auto).map((g) => <option key={g.id} value={g.id}>{g.nom} ({g.nb})</option>)}</optgroup>
            </select>}</div>}
        <div><label className="etiquette">Objet</label><input className="champ" value={f.sujet} onChange={maj('sujet')} /></div>
        <textarea className="champ min-h-[200px]" value={f.corps} onChange={maj('corps')} placeholder="Message…" />
        <div><label className="etiquette">Signature</label><select className="champ" value={f.signature} onChange={maj('signature')}>{signatures.map((s) => <option key={s.cle} value={s.cle}>{s.nom}</option>)}</select></div>
        {verif && <p className="rounded-lg bg-or-50 p-3 text-sm text-or-600">
          {verif.nb} adresse{verif.nb > 1 ? 's' : ''}{verif.sans ? ` · ${verif.sans} contact${verif.sans > 1 ? 's' : ''} sans e-mail (ignoré${verif.sans > 1 ? 's' : ''})` : ''} · {verif.canal === 'brevo' ? 'envoi par Brevo' : `envoi par Gmail · quota restant aujourd'hui : ${verif.quota}`}.
        </p>}
        <Erreur erreur={erreur} />
      </div>
    </Modale>
  )
}
