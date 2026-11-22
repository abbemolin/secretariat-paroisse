import { useState } from 'react'
import { UserPlus, Loader2, KeyRound } from 'lucide-react'
import { api } from '../api.js'
import VoirComme from './VoirComme.jsx'
import { useApp } from '../App.jsx'
import { Chargement, Erreur, Modale, useCharger, useNotif, dateHeure, ROLES, Interrupteur } from '../ui.jsx'
import { PAGES_ACCES, SORTES_ACCES, ONGLETS_REGLAGES, accesDuRole } from '../acces.js'

export default function Utilisateurs() {
  const notifier = useNotif()
  const { utilisateur: moi, recharger: rechargerApp } = useApp()
  const [edition, setEdition] = useState(null)
  const { data, chargement, erreur, recharger } = useCharger(() => api('utilisateurs.liste'), [])

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-semibold">Utilisateurs</h1><p className="text-sm text-nuit-600/80">Comptes de l'appli (indépendants de Google)</p></div>
        <div className="flex gap-2">
          <VoirComme />
          <button className="btn-or" onClick={() => setEdition({})}><UserPlus className="h-4 w-4" />Ajouter</button>
        </div>
      </div>
      <Erreur erreur={erreur} reessayer={recharger} />
      {chargement && !data ? <Chargement /> : (
        <div className="carte divide-y divide-nuit-50">
          {data?.map((u) => (
            <button key={u.id} onClick={() => setEdition(u)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-nuit-50/50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nuit-50 font-titre text-lg font-semibold text-nuit">{u.nom[0]}</div>
              <div className="min-w-0 flex-1"><div className="font-medium">{u.nom}{u.id === moi.id && <span className="ml-1 text-xs text-nuit-600/60">(vous)</span>}</div><div className="text-xs text-nuit-600/60">{u.identifiant} · dernière connexion {dateHeure(u.derniere_connexion)}</div></div>
              <span className="pastille bg-nuit-50 text-nuit">{ROLES[u.role]}{u.acces_perso && u.role !== 'admin' ? ' · accès ajustés' : ''}</span>
              {!u.actif && <span className="pastille bg-red-50 text-red-700">désactivé</span>}
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 rounded-lg bg-nuit-50/60 p-4 text-xs text-nuit-600">
        <p><strong>Administrateur</strong> : tout, y compris les comptes et les accès. Pour les autres, le rôle pré-coche des accès habituels, que vous ajustez dans la fiche de chaque personne (page par page, en lecture ou en modification).</p>
      </div>
      {edition && <Edition u={edition} onFermer={() => setEdition(null)} onFait={(m) => { setEdition(null); notifier(m); recharger(); rechargerApp() }} />}
    </>
  )
}

function Edition({ u, onFermer, onFait }) {
  const nouveau = !u.id
  const { signatures } = useApp()
  const [f, setF] = useState({ identifiant: u.identifiant || '', nom: u.nom || '', role: u.role || 'secretaire', signature: u.signature || '', actif: u.actif ?? true, motdepasse: '' })
  const [acces, setAcces] = useState(() => u.acces || accesDuRole(u.role || 'secretaire'))
  const changerRole = (role) => { setF({ ...f, role }); setAcces(accesDuRole(role)) }
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const generer = () => setF({ ...f, motdepasse: 'Croix-' + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10) })

  async function enregistrer() {
    setEnvoi(true); setErreur(null)
    try {
      if (nouveau) await api('utilisateurs.creer', { ...f, acces })
      else await api('utilisateurs.modifier', { id: u.id, nom: f.nom, role: f.role, signature: f.signature, actif: f.actif, acces, ...(f.motdepasse ? { motdepasse: f.motdepasse } : {}) })
      onFait(nouveau ? 'Utilisateur créé' : 'Utilisateur modifié')
    } catch (e) { setErreur(e) } finally { setEnvoi(false) }
  }
  return (
    <Modale large titre={nouveau ? 'Nouvel utilisateur' : f.nom} onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" onClick={enregistrer} disabled={envoi || !f.nom || (nouveau && (!f.identifiant || !f.motdepasse))}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button></>}>
      <div className="space-y-3">
        <div><label className="etiquette">Nom affiché</label><input className="champ" value={f.nom} onChange={maj('nom')} placeholder="Père Martin" autoFocus /></div>
        <div><label className="etiquette">Identifiant de connexion</label><input className="champ" value={f.identifiant} onChange={maj('identifiant')} disabled={!nouveau} placeholder="pere.martin" autoCapitalize="none" /></div>
        <div><label className="etiquette">Rôle</label><select className="champ" value={f.role} onChange={(e) => changerRole(e.target.value)}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="etiquette">Signature des mails (par défaut)</label><select className="champ" value={f.signature} onChange={maj('signature')}><option value="">—</option>{signatures.map((x) => <option key={x.cle} value={x.cle}>{x.nom}{x.fonction ? ' – ' + x.fonction : ''}</option>)}</select></div>
        <div><label className="etiquette">{nouveau ? 'Mot de passe provisoire' : 'Nouveau mot de passe (laisser vide pour ne pas changer)'}</label>
          <div className="flex gap-2"><input className="champ font-mono" value={f.motdepasse} onChange={maj('motdepasse')} />
            <button type="button" className="btn-clair" onClick={generer} title="Générer"><KeyRound className="h-4 w-4" /></button></div>
          <p className="mt-1 text-xs text-nuit-600/60">8 caractères minimum. Communiquez-le à la personne, qui le changera dans « Mon compte ».</p></div>
        {!nouveau && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.actif} onChange={maj('actif')} />Compte actif (décocher coupe l'accès immédiatement)</label>}
        <Acces role={f.role} acces={acces} onChange={setAcces} />
        <Erreur erreur={erreur} />
      </div>
    </Modale>
  )
}


const NIV = [['', 'Aucun'], ['l', 'Lecture'], ['m', 'Modification']]
function Niveau({ valeur, onChange }) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border border-nuit-100 text-xs">
      {NIV.map(([k, l]) => <button key={k} type="button" onClick={() => onChange(k)}
        className={`px-2.5 py-1 ${valeur === k ? (k === 'm' ? 'bg-nuit text-white' : k === 'l' ? 'bg-or text-white' : 'bg-nuit-100 text-nuit') : 'bg-white text-nuit-600/70 hover:bg-nuit-50'}`}>{l}</button>)}
    </div>
  )
}
function Ligne({ label, children }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm"><span>{label}</span>{children}</div>
}

/** Accès de la personne : page par page (aucun / lecture / modification), dossiers par sorte, onglets des réglages, signature. */
function Acces({ role, acces: a, onChange }) {
  if (role === 'admin') return <div className="rounded-lg bg-nuit-50/60 p-3 text-sm text-nuit-600">Administrateur : accès complet à tout, y compris les utilisateurs et leurs accès.</div>
  const tous = (niv) => { const x = { ...a, dossiers: { ...a.dossiers } }; PAGES_ACCES.forEach(([k]) => { x[k] = niv }); SORTES_ACCES.forEach(([k]) => { x.dossiers[k] = niv }); onChange(x) }
  return (
    <div className="space-y-4 border-t border-nuit-100 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-lg font-semibold">Accès</h3>
        <button type="button" className="btn-clair text-xs" onClick={() => onChange(accesDuRole(role))}>Accès habituels du rôle</button>
        <button type="button" className="btn-clair text-xs" onClick={() => tous('l')}>Tout en lecture</button>
      </div>
      <div className="divide-y divide-nuit-50">
        {PAGES_ACCES.map(([k, l]) => (
          <div key={k}>
            <Ligne label={l}><Niveau valeur={a[k] || ''} onChange={(v) => onChange({ ...a, [k]: v })} /></Ligne>
            {k === 'courrier' && a.courrier && (
              <div className="mb-1.5 ml-4 flex flex-wrap gap-3 text-xs text-nuit-600">
                <label className="flex items-center gap-1.5"><input type="radio" checked={a.courrier_tout !== false} onChange={() => onChange({ ...a, courrier_tout: true })} />Tout le courrier</label>
                <label className="flex items-center gap-1.5"><input type="radio" checked={a.courrier_tout === false} onChange={() => onChange({ ...a, courrier_tout: false })} />Seulement les mails qui lui sont attribués</label>
              </div>
            )}
          </div>
        ))}
      </div>
      <div>
        <h4 className="mb-1 text-sm font-semibold text-nuit-600">Dossiers, par sorte</h4>
        <div className="divide-y divide-nuit-50">
          {SORTES_ACCES.map(([k, l]) => <Ligne key={k} label={l}><Niveau valeur={a.dossiers?.[k] || ''} onChange={(v) => onChange({ ...a, dossiers: { ...a.dossiers, [k]: v } })} /></Ligne>)}
        </div>
      </div>
      <div>
        <h4 className="mb-1.5 text-sm font-semibold text-nuit-600">Réglages : onglets permis</h4>
        <div className="flex flex-wrap gap-1.5">
          {ONGLETS_REGLAGES.map((o) => { const on = (a.reglages || []).includes(o); return (
            <button key={o} type="button" onClick={() => onChange({ ...a, reglages: on ? a.reglages.filter((x) => x !== o) : [...(a.reglages || []), o] })}
              className={`pastille border px-2.5 py-1 text-xs ${on ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>{o}</button>) })}
        </div>
      </div>
      <Ligne label={<span>Peut signer <span className="text-xs text-nuit-600/60">(extraits de baptême, B6, courriers)</span></span>}><Interrupteur actif={!!a.signer} onChange={(v) => onChange({ ...a, signer: v })} /></Ligne>
    </div>
  )
}
