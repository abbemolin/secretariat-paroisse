import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, HeartHandshake, Check, X, HelpCircle, Mail, PauseCircle, PlayCircle, Trash2, Send, Users, ShieldCheck, Crown, Loader2, Search, FolderHeart, UserCheck, UserX, Home, Eraser, RefreshCw, Archive } from 'lucide-react'
import { api } from '../api.js'
import { useApp } from '../App.jsx'
import FonctionFermee from '../FonctionFermee.jsx'
import { Chargement, Erreur, EnTete, Modale, Vide, dateCourte, dateHeure, useCharger, useConfirmer, useNotif } from '../ui.jsx'

const COULEUR = {
  attente: 'bg-or-100 text-or-600', precisions: 'bg-or-50 text-or-600', invite: 'bg-nuit-50 text-nuit', actif: 'bg-green-50 text-green-800',
  refuse: 'bg-red-50 text-red-700', suspendu: 'bg-red-50 text-red-700', desactive: 'bg-nuit-50 text-nuit-600'
}
const VUES = [['demandes', 'Demandes'], ['comptes', 'Comptes'], ['priere', 'Prière'], ['inviter', 'Inviter'], ['dons', 'Dons'], ['rgpd', 'RGPD']]

/** Rappel RGPD affiché sur la page (données personnelles des paroissiens). */
function RappelRgpd() {
  return (
    <div className="mb-4 flex gap-3 rounded-lg border border-or-100 bg-or-50/60 p-3 text-xs leading-relaxed text-nuit-700">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-or-600" />
      <p><strong>Données personnelles.</strong> Ces informations servent seulement à vérifier que les personnes sont bien paroissiennes et à gérer leur accès à l'app.
        Ne les transmettez pas hors de la paroisse et ne les copiez pas. Responsable : la paroisse, représentée par le curé ; une personne qui demande à voir, corriger
        ou effacer ses données s'adresse à secretariat@croix-glorieuse.org (elle peut aussi le faire elle-même dans l'app). Une demande refusée est effacée
        après 3 mois ; un compte sans connexion depuis 18 mois est désactivé puis effacé.</p>
    </div>
  )
}

export default function Paroissiens() {
  const { utilisateur } = useApp()
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const [vue, setVue] = useState('demandes')
  const [ouvert, setOuvert] = useState(null)
  const [occupe, setOccupe] = useState('')
  const [filtre, setFiltre] = useState('')
  const [statut, setStatut] = useState('')
  const { data, chargement, erreur, recharger, setData } = useCharger(() => api('paroissiens.liste'), [])
  const comptes = useMemo(() => data?.comptes || [], [data])
  const demandes = comptes.filter((c) => c.statut === 'attente' || c.statut === 'precisions').sort((a, b) => String(a.cree_le).localeCompare(String(b.cree_le)))

  async function operer(c, op, extra = {}, message) {
    setOccupe(c.id + op)
    try { setData(await api('paroissiens.modifier', { id: c.id, op, ...extra })); if (message) notifier(message); setOuvert(null) }
    catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }
  async function migrer() {
    if (!(await confirmer({ titre: 'Reprendre les espaces existants', texte: 'Chaque catéchumène ou néophyte qui a déjà un espace reçoit un compte, avec le même mot de passe. Rien n\'est envoyé. Vous pouvez relancer sans risque de doublon.', bouton: 'Reprendre' }))) return
    setOccupe('migrer')
    try {
      const r = await api('paroissiens.migrer')
      notifier(`${r.crees} compte(s) créé(s)` + (r.adresse_prise.length ? ` · adresse partagée : ${r.adresse_prise.join(', ')}` : '') + (r.sans_adresse.length ? ` · sans adresse : ${r.sans_adresse.join(', ')}` : ''))
      recharger()
    } catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }

  const liste = comptes.filter((c) => (!statut || c.statut === statut) && (!filtre || [c.prenom, c.nom, c.mail, c.telephone].join(' ').toLowerCase().includes(filtre.toLowerCase())))
    .sort((a, b) => String(a.nom + a.prenom).localeCompare(String(b.nom + b.prenom), 'fr'))

  return (
    <>
      <EnTete titre="App des paroissiens" sousTitre="app.croix-glorieuse.org — demandes d'accès et comptes"
        actions={(utilisateur.role === 'admin' || utilisateur.role === 'cure') && data && !data.migration && <button className="btn-clair" disabled={!!occupe} onClick={migrer}>{occupe === 'migrer' && <Loader2 className="h-4 w-4 animate-spin" />}Reprendre les espaces des catéchumènes</button>} />
      <FonctionFermee cle="comptes" texte="L'app des paroissiens est fermée : pas de connexion par adresse e-mail ni de demande d'accès." />
      <RappelRgpd />
      <div className="mb-4 flex gap-1 rounded-lg bg-nuit-50 p-1 text-sm">
        {VUES.map(([k, l]) => <button key={k} onClick={() => setVue(k)} className={`flex-1 rounded-md px-3 py-1.5 ${vue === k ? 'bg-white font-semibold text-nuit shadow-sm' : 'text-nuit-600'}`}>{l}{k === 'demandes' && demandes.length > 0 && <span className="ml-1.5 rounded-full bg-or px-1.5 text-[11px] font-bold text-white">{demandes.length}</span>}</button>)}
      </div>
      <Erreur erreur={erreur} reessayer={recharger} />
      {chargement && !data ? <Chargement /> : vue === 'demandes' ? (
        !demandes.length ? <Vide icone={UserCheck} texte="Aucune demande d'accès à examiner." /> : (
          <div className="space-y-3">{demandes.map((c) => <Demande key={c.id} c={c} occupe={occupe} operer={operer} onOuvrir={() => setOuvert({ c, mode: 'refuser' })} onPrecisions={() => setOuvert({ c, mode: 'precisions' })} />)}</div>
        )
      ) : vue === 'comptes' ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-nuit-600/50" /><input className="champ pl-9" placeholder="Nom, adresse, téléphone…" value={filtre} onChange={(e) => setFiltre(e.target.value)} /></div>
            <select className="champ w-auto" value={statut} onChange={(e) => setStatut(e.target.value)}><option value="">Tous ({comptes.length})</option>{Object.entries(data?.statuts || {}).map(([k, l]) => <option key={k} value={k}>{l} ({comptes.filter((c) => c.statut === k).length})</option>)}</select>
          </div>
          {!liste.length ? <Vide icone={Users} texte="Aucun compte." /> : (
            <div className="carte divide-y divide-nuit-50">
              {liste.map((c) => (
                <button key={c.id} onClick={() => setOuvert({ c, mode: 'fiche' })} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-nuit-50/50">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.prenom} {c.nom}{c.chef && <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-or-600"><Crown className="h-3 w-3" />chef {c.chef}</span>}</div>
                    <div className="truncate text-xs text-nuit-600/70">{c.mail || 'sans adresse'}{c.derniere_visite ? ' · vu ' + dateCourte(c.derniere_visite) : ''}</div>
                  </div>
                  {c.foyer && <span className="pastille bg-nuit-50 text-nuit" title={'Foyer avec ' + c.foyer}><Home className="h-3 w-3" />foyer</span>}
                  {c.dossier_id && <span className="pastille bg-nuit-50 text-nuit"><FolderHeart className="h-3 w-3" />catéchuménat</span>}
                  {c.cor && <span className="pastille bg-nuit-50 text-nuit">Cor Unum</span>}
                  <span className={`pastille ${COULEUR[c.statut] || ''}`}>{data.statuts[c.statut] || c.statut}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : vue === 'priere' ? <MurPriere /> : vue === 'rgpd' ? <EffacementsRgpd /> : vue === 'dons' ? <Dons modifiable={utilisateur.role === 'admin' || utilisateur.role === 'cure'} /> : <Inviter onFait={recharger} />}
      {ouvert?.mode === 'fiche' && <Fiche c={ouvert.c} statuts={data.statuts} occupe={occupe} operer={operer} onFermer={() => setOuvert(null)} />}
      {(ouvert?.mode === 'refuser' || ouvert?.mode === 'precisions') && <Reponse c={ouvert.c} mode={ouvert.mode} occupe={occupe} operer={operer} onFermer={() => setOuvert(null)} />}
    </>
  )
}

function Rapprochement({ l }) {
  if (!l?.length) return <div className="mt-2 flex items-center gap-1.5 text-xs text-or-600"><UserX className="h-3.5 w-3.5" />Inconnu(e) des fichiers de la paroisse : vérifiez avant d'accepter.</div>
  return (
    <div className="mt-2 rounded-md bg-green-50/70 p-2 text-xs text-green-900">
      <div className="mb-1 flex items-center gap-1.5 font-semibold"><UserCheck className="h-3.5 w-3.5" />Connu(e) de la paroisse</div>
      {l.map((z, i) => <div key={i}>{z.source === 'Dossier' ? <Link className="underline" to={`/dossiers/${z.id}`}>{z.nom}</Link> : z.nom} — {z.source} · {z.detail} <span className="text-green-900/60">({z.raisons.join(', ')})</span></div>)}
    </div>
  )
}

function Demande({ c, occupe, operer, onOuvrir, onPrecisions }) {
  const d = c.demande || {}
  const confirmer = useConfirmer()
  async function accepter() {
    if (d.mineur && d.accord?.reponse !== 'oui') {
      if (!(await confirmer({ titre: 'Accepter sans l\'accord du parent ?', texte: `Le parent de ${c.prenom} n'a pas encore répondu au mail. N'acceptez que si vous avez vérifié son accord autrement (rencontre, papier signé).`, bouton: 'Accepter quand même' }))) return
      return operer(c, 'valider', { sans_accord: true }, 'Accès accepté : invitation envoyée par mail')
    }
    operer(c, 'valider', {}, 'Accès accepté : invitation envoyée par mail')
  }
  return (
    <div className="carte p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><div className="font-titre text-xl font-semibold">{c.prenom} {c.nom}</div>
          <div className="text-sm text-nuit-600">{c.mail} · {c.telephone}</div></div>
        <div className="text-right text-xs text-nuit-600/70">Demande du {dateHeure(c.cree_le)}{c.statut === 'precisions' && <div className="mt-1 pastille bg-or-50 text-or-600">Précisions demandées</div>}</div>
      </div>
      <div className="mt-2 space-y-0.5 text-sm">
        {d.messe && <div><span className="text-nuit-600/70">Messe habituelle :</span> {d.messe}</div>}
        {d.liens?.length > 0 && <div><span className="text-nuit-600/70">À la paroisse :</span> {d.liens.join(', ')}</div>}
        {d.connait && <div><span className="text-nuit-600/70">Quelqu'un qui le/la connaît :</span> {d.connait}</div>}
        {d.mineur && <AccordParent c={c} occupe={occupe} operer={operer} />}
        {d.mot && <div className="whitespace-pre-wrap"><span className="text-nuit-600/70">Message :</span> {d.mot}</div>}
        {c.statut === 'precisions' && c.motif && <div className="rounded bg-nuit-50/70 p-2 text-xs"><strong>Question posée :</strong> {c.motif}</div>}
      </div>
      <Rapprochement l={c.rapprochement} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-principal" disabled={!!occupe} onClick={() => accepter()}>{occupe === c.id + 'valider' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Accepter</button>
        <button className="btn-clair" disabled={!!occupe} onClick={onPrecisions}><HelpCircle className="h-4 w-4" />Demander des précisions</button>
        <button className="btn-clair text-red-700" disabled={!!occupe} onClick={onOuvrir}><X className="h-4 w-4" />Refuser</button>
      </div>
    </div>
  )
}

/** Lycéen(ne) : accord du parent demandé par mail. */
function AccordParent({ c, occupe, operer }) {
  const d = c.demande || {}, a = d.accord || {}
  const [autre, setAutre] = useState(false)
  const [mail, setMail] = useState(d.parent_mail || '')
  return (
    <div className={`rounded p-2 text-xs ${a.reponse === 'oui' ? 'bg-green-50 text-green-900' : 'bg-or-50'}`}>
      <strong>Lycéen(ne), moins de 18 ans</strong> — pas de petites annonces ni de messages ; mur de prière : prier seulement.
      <div className="mt-1">{a.reponse === 'oui' ? <>Accord donné par <strong>{a.par}</strong> le {dateCourte(a.le)} (lien envoyé à {d.parent_mail}).</>
        : a.reponse === 'non' ? <>Le parent ({d.parent_mail}) a <strong>refusé</strong> le {dateCourte(a.le)}.</>
        : <>Accord du parent <strong>attendu</strong> : mail envoyé à {d.parent_mail}{a.envoye_le ? ' le ' + dateCourte(a.envoye_le) : ''}{a.exp ? `, lien valable jusqu'au ${dateCourte(a.exp)}` : ''}.</>}</div>
      {a.reponse !== 'oui' && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {autre && <input className="champ h-8 w-56 py-1 text-xs" type="email" value={mail} onChange={(e) => setMail(e.target.value)} />}
          <button className="btn-clair h-8 py-1 text-xs" disabled={!!occupe} onClick={() => operer(c, 'relancerAccord', autre ? { parent_mail: mail } : {}, 'Mail renvoyé au parent')}><Mail className="h-3.5 w-3.5" />Renvoyer le mail au parent</button>
          {!autre && <button className="text-xs text-or-600 underline" onClick={() => setAutre(true)}>autre adresse</button>}
        </div>
      )}
    </div>
  )
}

function Reponse({ c, mode, occupe, operer, onFermer }) {
  const [texte, setTexte] = useState('')
  const [prevenir, setPrevenir] = useState(true)
  const refus = mode === 'refuser'
  return (
    <Modale titre={refus ? `Refuser la demande de ${c.prenom}` : `Demander des précisions à ${c.prenom}`} onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button>
        <button className={refus ? 'btn-principal bg-red-700' : 'btn-principal'} disabled={!!occupe || (!refus && !texte.trim())}
          onClick={() => operer(c, refus ? 'refuser' : 'precisions', refus ? { motif: texte, prevenir } : { message: texte }, refus ? 'Demande refusée' : 'Question envoyée par mail')}>
          {occupe && <Loader2 className="h-4 w-4 animate-spin" />}{refus ? 'Refuser' : <><Send className="h-4 w-4" />Envoyer</>}</button></>}>
      <label className="etiquette">{refus ? 'Message à la personne (facultatif)' : 'Votre question (envoyée par mail ; la personne répond au secrétariat)'}</label>
      <textarea className="champ min-h-[110px]" value={texte} onChange={(e) => setTexte(e.target.value)} autoFocus
        placeholder={refus ? 'Ex. : nous ne vous avons pas encore rencontré(e) ; venez nous voir après la messe.' : 'Ex. : à quelle messe venez-vous d\'habitude ? Qui vous a fait connaître la paroisse ?'} />
      {refus && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={prevenir} onChange={(e) => setPrevenir(e.target.checked)} />Prévenir la personne par mail</label>}
      {refus && <p className="mt-2 text-xs text-nuit-600/70">La demande refusée est effacée automatiquement après 3 mois (RGPD).</p>}
    </Modale>
  )
}

function Fiche({ c, statuts, occupe, operer, onFermer }) {
  const confirmer = useConfirmer()
  const [mail, setMail] = useState('')
  const ligne = (l, v) => v ? <div className="flex gap-2 py-1 text-sm"><span className="w-40 shrink-0 text-nuit-600/70">{l}</span><span className="min-w-0 break-words">{v}</span></div> : null
  async function supprimer() {
    if (!(await confirmer({ titre: 'Effacer ce compte', texte: `Le compte de ${c.prenom} ${c.nom} sera effacé (accès à l'app, préférences, notifications). Les dossiers et les registres restent. Ce n'est pas réversible.`, bouton: 'Effacer', danger: true }))) return
    operer(c, 'supprimer', {}, 'Compte effacé')
  }
  return (
    <Modale titre={`${c.prenom} ${c.nom}`} onFermer={onFermer}>
      <span className={`pastille ${COULEUR[c.statut] || ''}`}>{statuts[c.statut] || c.statut}</span>
      <div className="mt-3 divide-y divide-nuit-50">
        {ligne('Adresse', c.mail || 'aucune (une adresse par adulte)')}
        {ligne('Téléphone', c.telephone)}
        {ligne('Adresse postale', c.adresse)}
        {ligne('Chef de fraternité', c.chef)}
        {ligne('Foyer', c.foyer ? 'relié au compte de ' + c.foyer : '')}
        {ligne('Compte créé', dateHeure(c.cree_le))}
        {ligne('Accepté par', c.valide_par ? `${c.valide_par}, ${dateCourte(c.valide_le)}` : '')}
        {ligne('Dernière visite', c.derniere_visite ? dateHeure(c.derniere_visite) : 'jamais')}
        {ligne('Confidentialité acceptée', c.confidentialite_le ? dateCourte(c.confidentialite_le) : 'pas encore')}
        {ligne('Invitation valable jusqu\'au', c.invitation_exp ? dateCourte(c.invitation_exp) : '')}
        {ligne('Motif', c.motif)}
        {c.dossier_id && <div className="py-1 text-sm"><Link className="text-or-600 underline" to={`/dossiers/${c.dossier_id}`}>Ouvrir le dossier de catéchuménat</Link></div>}
      </div>
      {c.rapprochement?.length > 0 && <Rapprochement l={c.rapprochement} />}
      {!c.mail && (
        <div className="mt-4 rounded-lg bg-nuit-50/60 p-3">
          <label className="etiquette">Adresse personnelle (pour la connexion)</label>
          <div className="flex gap-2"><input className="champ" type="email" value={mail} onChange={(e) => setMail(e.target.value)} placeholder="prenom@exemple.fr" />
            <button className="btn-principal" disabled={!!occupe || !mail} onClick={() => operer(c, 'adresse', { mail }, 'Adresse enregistrée : invitation envoyée')}>Enregistrer</button></div>
          <p className="mt-1 text-xs text-nuit-600/70">En attendant, la personne garde l'accès par son lien personnel.</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {c.statut === 'invite' && c.mail && <button className="btn-clair" disabled={!!occupe} onClick={() => operer(c, 'renvoyer', {}, 'Invitation renvoyée')}><Mail className="h-4 w-4" />Renvoyer l'invitation</button>}
        {['actif', 'invite'].includes(c.statut) && <button className="btn-clair" disabled={!!occupe} onClick={() => operer(c, 'suspendre', {}, 'Compte suspendu')}><PauseCircle className="h-4 w-4" />Suspendre</button>}
        {['suspendu', 'desactive'].includes(c.statut) && <button className="btn-clair" disabled={!!occupe} onClick={() => operer(c, 'reactiver', {}, 'Compte réactivé')}><PlayCircle className="h-4 w-4" />Réactiver</button>}
        {c.statut === 'refuse' && <button className="btn-clair" disabled={!!occupe} onClick={() => operer(c, 'valider', {}, 'Accès accepté')}><Check className="h-4 w-4" />Accepter finalement</button>}
        {c.foyer && <button className="btn-clair" disabled={!!occupe} onClick={() => operer(c, 'delierFoyer', {}, 'Lien de foyer défait')}><Home className="h-4 w-4" />Défaire le foyer</button>}
        <button className="btn-clair text-red-700" disabled={!!occupe} onClick={supprimer}><Trash2 className="h-4 w-4" />Effacer le compte</button>
      </div>
      {c.demande?.mineur && <div className="mt-3"><AccordParent c={c} occupe={occupe} operer={operer} /></div>}
    </Modale>
  )
}

function Inviter({ onFait }) {
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const { data, chargement, erreur } = useCharger(() => api('cor.equipesCourantes'), [])
  const [occupe, setOccupe] = useState('')
  const [rapport, setRapport] = useState(null)
  async function inviter(payload, quoi) {
    if (!(await confirmer({ titre: 'Envoyer les invitations', texte: `${quoi} : chaque personne qui a une adresse reçoit un mail pour ouvrir son compte. Celles qui ont déjà un compte ne reçoivent rien.`, bouton: 'Envoyer' }))) return
    setOccupe(JSON.stringify(payload))
    try { const r = await api('paroissiens.inviter', payload); setRapport(r); notifier(`${r.invites.length} invitation(s) envoyée(s)`); onFait() }
    catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }
  return (
    <>
      <p className="mb-3 text-sm text-nuit-600">Les personnes des fraternités Cor Unum sont déjà connues de la paroisse : elles sont invitées directement, sans demande à valider. Une adresse par adulte : une fiche de couple avec une seule adresse donne un seul compte.</p>
      <Erreur erreur={erreur} />
      {chargement && !data ? <Chargement /> : (
        <div className="carte divide-y divide-nuit-50">
          <div className="flex items-center gap-3 px-4 py-3 text-sm">
            <Crown className="h-5 w-5 text-or" /><div className="flex-1"><div className="font-medium">Tous les chefs de fraternité</div><div className="text-xs text-nuit-600/70">Ils ouvriront la page de leur fraternité depuis l'app, avec leur propre mot de passe.</div></div>
            <button className="btn-or" disabled={!!occupe} onClick={() => inviter({ chefs: true }, 'Tous les chefs de fraternité')}><Send className="h-4 w-4" />Inviter</button>
          </div>
          {(data?.equipes || []).map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Users className="h-5 w-5 text-nuit-600/60" /><div className="flex-1"><div className="font-medium">{e.nom}</div><div className="text-xs text-nuit-600/70">{e.membres} membre(s){e.chefs.length ? ' · chef : ' + e.chefs.join(', ') : ''}</div></div>
              <button className="btn-clair" disabled={!!occupe} onClick={() => inviter({ equipe_id: e.id }, 'Fraternité ' + e.nom)}>{occupe === JSON.stringify({ equipe_id: e.id }) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Inviter</button>
            </div>
          ))}
        </div>
      )}
      {rapport && (
        <div className="carte mt-4 p-4 text-sm">
          <div className="font-semibold">Résultat</div>
          <div>✓ Invités : {rapport.invites.join(', ') || '—'}</div>
          {rapport.deja.length > 0 && <div>Déjà un compte : {rapport.deja.join(', ')}</div>}
          {rapport.sans_adresse.length > 0 && <div className="text-or-600">Sans adresse (à compléter dans Cor Unum) : {rapport.sans_adresse.join(', ')}</div>}
          {rapport.refuses.length > 0 && <div className="text-red-700">Non invités (compte refusé ou suspendu) : {rapport.refuses.join(', ')}</div>}
        </div>
      )}
    </>
  )
}

/** Causes de dons : formulaires de don HelloAsso proposés dans l'app (accueil et partie publique). */
function Dons({ modifiable }) {
  const notifier = useNotif()
  const { data, chargement, erreur, setData } = useCharger(() => api('paroissiens.dons'), [])
  const [l, setL] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const liste = l ?? data ?? []
  const maj = (i, k, v) => setL(liste.map((c, j) => (j === i ? { ...c, [k]: v } : c)))
  async function enregistrer() {
    setEnvoi(true)
    try { const r = await api('paroissiens.donsEcrire', { causes: liste }); setData(r); setL(null); notifier('Causes enregistrées') }
    catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  return (
    <>
      <p className="mb-3 text-sm text-nuit-600">Les causes actives apparaissent dans l'app, sur l'accueil et dans la partie publique, avec un bouton vers votre formulaire de don HelloAsso (qui fait le reçu fiscal). Une annonce peut aussi porter un bouton « Faire un don » (tuile Annonces → modifier l'annonce).</p>
      <Erreur erreur={erreur} />
      {chargement && !data ? <Chargement /> : (
        <div className="space-y-3">
          {!liste.length && <Vide icone={HeartHandshake} texte="Aucune cause de don pour le moment." />}
          {liste.map((c, i) => (
            <div key={c.id || i} className="carte space-y-2 p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div><label className="etiquette">Nom de la cause</label><input className="champ" disabled={!modifiable} value={c.titre} maxLength={80} onChange={(e) => maj(i, 'titre', e.target.value)} placeholder="Soutenir la paroisse" /></div>
                <div><label className="etiquette">Lien du formulaire de don HelloAsso</label><input className="champ" disabled={!modifiable} value={c.url} onChange={(e) => maj(i, 'url', e.target.value)} placeholder="https://www.helloasso.com/associations/…/formulaires/…" /></div>
              </div>
              <div><label className="etiquette">Texte court (facultatif)</label><input className="champ" disabled={!modifiable} value={c.texte} maxLength={300} onChange={(e) => maj(i, 'texte', e.target.value)} placeholder="Chauffage de l'église, travaux…" /></div>
              {modifiable && <div className="flex items-center gap-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={c.actif !== false} onChange={(e) => maj(i, 'actif', e.target.checked)} />Proposée dans l'app</label>
                <button className="btn ml-auto text-xs text-red-700 hover:bg-red-50" onClick={() => setL(liste.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" />Retirer</button></div>}
            </div>
          ))}
          {modifiable && <div className="flex gap-2">
            <button className="btn-clair" onClick={() => setL([...liste, { titre: '', texte: '', url: '', actif: true }])}><Plus className="h-4 w-4" />Ajouter une cause</button>
            <button className="btn-principal" disabled={envoi || l === null} onClick={enregistrer}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
          </div>}
          {!modifiable && <p className="text-xs text-nuit-600/70">Seuls le curé et les administrateurs modifient les causes.</p>}
        </div>
      )}
    </>
  )
}

/** Mur de prière : relecture des intentions mises de côté (modérateur automatique ou signalements). */
function MurPriere() {
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const { data, chargement, erreur, setData } = useCharger(() => api('paroissiens.prieres'), [])
  const [tout, setTout] = useState(false)
  const [occ, setOcc] = useState('')
  const l = data || []
  const aRelire = l.filter((x) => x.statut === 'relecture' || x.statut === 'masquee')
  async function op(x, o) {
    if (o === 'supprimer' && !(await confirmer({ titre: 'Supprimer l\'intention', texte: 'Elle disparaît du mur et de la liste du déposant.', bouton: 'Supprimer', danger: true }))) return
    setOcc(x.id + o)
    try { setData(await api('paroissiens.moderer', { id: x.id, op: o })); notifier(o === 'publier' ? 'Publiée' : o === 'refuser' ? 'Non publiée' : 'Supprimée') } catch (e) { notifier(e.message, 'erreur') } finally { setOcc('') }
  }
  const carte = (x) => (
    <div key={x.id} className="carte p-4 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-nuit-600/70"><span>{dateHeure(x.cree_le)}</span><span>· {x.auteur}</span>
        {x.statut === 'masquee' && <span className="pastille bg-red-50 text-red-700">masquée ({x.signalements} signalements)</span>}
        {x.statut === 'relecture' && <span className="pastille bg-or-100 text-or-600">à relire</span>}
        {x.statut === 'refusee' && <span className="pastille bg-nuit-50 text-nuit-600">non publiée</span>}
        {x.statut === 'publiee' && <span className="pastille bg-green-50 text-green-800">sur le mur · {x.priants} prient</span>}</div>
      <p className="whitespace-pre-wrap">{x.texte}</p>
      {x.grace && <p className="mt-1 text-xs text-nuit-600">Action de grâce : {x.grace}</p>}
      {x.raisons?.length > 0 && <p className="mt-1 text-xs text-or-600">Mise de côté : {x.raisons.join(', ')}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {x.statut !== 'publiee' && <button className="btn-principal" disabled={!!occ} onClick={() => op(x, 'publier')}><Check className="h-4 w-4" />Publier</button>}
        {x.statut !== 'refusee' && <button className="btn-clair" disabled={!!occ} onClick={() => op(x, 'refuser')}><X className="h-4 w-4" />Ne pas publier</button>}
        <button className="btn-clair text-red-700" disabled={!!occ} onClick={() => op(x, 'supprimer')}><Trash2 className="h-4 w-4" />Supprimer</button>
      </div>
    </div>
  )
  return (
    <>
      <p className="mb-3 text-sm text-nuit-600">Les intentions sont anonymes pour les paroissiens ; vous voyez l'auteur pour pouvoir relire. Le modérateur automatique met de côté celles qui contiennent un nom, des coordonnées, un lien, un mot déplacé ou un sujet sensible. Gardées 6 mois.</p>
      <Erreur erreur={erreur} />
      {chargement && !data ? <Chargement /> : (
        <div className="space-y-3">
          {!aRelire.length && <Vide icone={Check} texte="Aucune intention à relire." />}
          {aRelire.map(carte)}
          <button className="btn-clair" onClick={() => setTout(!tout)}>{tout ? 'Masquer les autres intentions' : `Voir toutes les intentions (${l.length})`}</button>
          {tout && l.filter((x) => !aRelire.includes(x)).map(carte)}
        </div>
      )}
    </>
  )
}

/** Effacements RGPD : liste du mois à confirmer (sinon effacement automatique au bout de 30 jours). */
function EffacementsRgpd() {
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const [occupe, setOccupe] = useState('')
  const [choix, setChoix] = useState({})
  const { data, chargement, erreur, recharger, setData } = useCharger(() => api('paroissiens.rgpd'), [])
  const el = data?.liste?.elements || []
  const coches = el.filter((x) => choix[x.cle] !== false)
  async function op(o, extra = {}, msg) {
    setOccupe(o + (extra.cle || ''))
    try { setData(await api('paroissiens.rgpd', { op: o, ...extra })); if (msg) notifier(msg) } catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }
  async function effacer() {
    if (!(await confirmer({ titre: 'Effacer définitivement', texte: `${coches.length} élément(s) seront effacés : fiches Cor Unum supprimées, fiches santé et contacts d'urgence vidés (les inscriptions aux retraites restent). Ce n'est pas réversible.`, bouton: 'Effacer', danger: true }))) return
    op('effacer', { cles: coches.map((x) => x.cle) }, 'Effacé et noté au journal')
  }
  if (chargement && !data) return <Chargement />
  return (
    <>
      <Erreur erreur={erreur} reessayer={recharger} />
      <div className="mb-3 rounded-lg bg-nuit-50/60 p-3 text-xs leading-relaxed text-nuit-700">
        Chaque mois, l'app prépare la liste des données à effacer : les <strong>fiches Cor Unum</strong> des personnes sans activité depuis <strong>3 ans</strong>{' '}
        (ni fraternité, ni connexion à l'app, ni nouvelle inscription) et les <strong>fiches santé et contacts d'urgence des retraites</strong> finies depuis plus d'<strong>un mois</strong>.
        Confirmez, ou gardez une fiche un an de plus si la personne est encore là. Sans réponse, tout est effacé automatiquement au bout de 30 jours. Chaque effacement est noté au journal.
      </div>
      {!el.length ? (
        <div className="carte p-6 text-center text-sm text-nuit-600">
          <Archive className="mx-auto mb-2 h-6 w-6 text-nuit-600/50" />Rien à effacer pour le moment.
          {data?.preparee_le && <div className="mt-1 text-xs text-nuit-600/70">Liste vérifiée le {dateCourte(data.preparee_le)}.</div>}
          <button className="btn-clair mt-3" disabled={!!occupe} onClick={() => op('preparer', {}, 'Liste vérifiée')}>{occupe === 'preparer' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Vérifier maintenant</button>
        </div>
      ) : (
        <>
          <div className="mb-2 text-sm text-nuit-600">Liste du {dateCourte(data.liste.le)} — effacement automatique le <strong>{dateCourte(data.liste.auto_le)}</strong> si rien n'est fait.</div>
          <div className="carte divide-y divide-nuit-50">
            {el.map((x) => (
              <label key={x.cle} className="flex items-center gap-3 px-4 py-3 text-sm">
                <input type="checkbox" checked={choix[x.cle] !== false} onChange={(e) => setChoix({ ...choix, [x.cle]: e.target.checked })} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{x.nom}</div>
                  <div className="text-xs text-nuit-600/70">{x.type === 'cor'
                    ? `Cor Unum ${x.annees.join(', ')} · ${x.ids.length} fiche(s) · dernière activité : ${dateCourte(x.derniere)}`
                    : `Retraite du ${dateCourte(x.date)} · ${x.nb} inscription(s) avec fiche santé ou contact d'urgence`}</div>
                </div>
                <button className="btn-clair h-8 py-1 text-xs" disabled={!!occupe} onClick={(e) => { e.preventDefault(); op('garder', { cle: x.cle }, 'Gardée un an de plus') }}>Garder un an</button>
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-principal bg-red-700" disabled={!!occupe || !coches.length} onClick={effacer}>{occupe === 'effacer' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}Effacer la sélection ({coches.length})</button>
          </div>
        </>
      )}
    </>
  )
}
