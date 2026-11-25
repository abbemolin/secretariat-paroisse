import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Send, Loader2, RotateCw, Trash2, Printer, FileText, ClipboardList, CheckCircle2, Clock, FolderHeart, School, UserRound, MonitorSmartphone, QrCode } from 'lucide-react'
import { api } from '../api.js'
import { useApp } from '../App.jsx'
import { Chargement, Erreur, EnTete, Modale, Vide, Aide, dateCourte, heure, useCharger, useConfirmer, useNotif } from '../ui.jsx'
import { anneeScolaireActuelle } from '../types.js'
import { IMPRIMABLES } from '../imprimables.js'
import { Imprimer } from './Dossier.jsx'
import qrcode from '../qrcode.js'

const VUES = [['envoyer', 'Envoyer un formulaire'], ['suivi', 'Suivi des envois'], ['documents', 'Documents à imprimer']]
const B = 'Remplir le formulaire'
const FIN = "\n\nAvec l'assurance de nos prières à toutes vos intentions,"

/** Texte proposé pour chaque formulaire (modifiable avant l'envoi). */
function texteParDefaut(cle, { paroisse, vers, promo, rdv }) {
  const bouton = `\n[Bouton : ${B}]`
  const cel = { premiere_communion: 'première communion', profession_foi: 'profession de foi', confirmation_jeune: 'confirmation' }[cle]
  if (cel) {
    const annee = anneeScolaireActuelle()
    const quand = promo?.date
      ? `La ${cel} (année ${annee}) aura lieu le ${new Date(promo.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} à ${heure(promo.date).replace(':', ' h ')}${promo.lieu ? ', ' + promo.lieu : ''}.`
      : `La date et l'heure de la ${cel} (année ${annee}) vous seront communiquées prochainement.`
    const infos = `${quand}\nLes informations concernant la retraite vous seront communiquées plus tard.` +
      (rdv ? `\n\nRendez-vous avec Monsieur le Curé : merci de vous inscrire rapidement ici :\n[Bouton : Prendre rendez-vous avec Monsieur le Curé]` : '')
    return vers === 'ecole'
      ? `Bonjour,\n\nPour l'inscription des enfants de votre établissement à la ${cel}, voici le formulaire à transmettre aux familles. Il suffit de cliquer sur le bouton ci-dessous ; les réponses arrivent directement au secrétariat de la paroisse. Une copie de l'acte de baptême de l'enfant est demandée (sauf baptême à la paroisse La Croix glorieuse).${bouton}\n\n${infos}\n\nMerci beaucoup pour votre aide.${FIN}`
      : `Bonjour,\n\nPour inscrire votre enfant à la ${cel}, merci de remplir le formulaire en cliquant sur le bouton ci-dessous, en joignant une copie de son acte de baptême (sauf baptême à la paroisse La Croix glorieuse). Votre demande arrivera directement au secrétariat de la paroisse.${bouton}\n\n${infos}${FIN}`
  }
  const t = {
    bapteme: `Vous souhaitez faire baptiser votre enfant. Merci de remplir ce formulaire en ligne : le secrétariat vous recontactera pour la préparation.`,
    mariage: `Vous souhaitez vous marier à l'église. Merci de remplir ce formulaire en ligne : un prêtre vous recontactera pour la préparation.`,
    catechumene: `Vous souhaitez recevoir le baptême. Merci de remplir ce formulaire en ligne : un prêtre vous recontactera.`,
    confirmand: `Vous souhaitez recevoir la confirmation. Merci de remplir ce formulaire en ligne : nous vous recontacterons pour la préparation.`,
    parrainage: `Vous avez été choisi(e) comme parrain ou marraine. Pour que nous puissions vous délivrer le certificat demandé par la paroisse de la célébration, merci de remplir ce formulaire en ligne (vous pouvez y joindre un extrait de votre acte de baptême). Nous vous enverrons ensuite le certificat signé.`,
    recommandation: `Vous nous demandez une lettre de recommandation. Merci de remplir ce formulaire en ligne en précisant à qui elle est destinée : nous reprendrons contact avec vous si besoin, puis nous vous l'enverrons signée.`,
    accord_ailleurs: `Vous souhaitez faire baptiser votre enfant dans une autre paroisse. Pour que le curé de ${paroisse} puisse vous donner son accord (formulaire diocésain B 15), merci de compléter ce formulaire en ligne.`,
    accord_ici: `Vous souhaitez faire baptiser votre enfant à ${paroisse}. Comme vous habitez sur le territoire d'une autre paroisse, l'accord de votre curé est nécessaire (formulaire diocésain B 15). Merci de compléter ce formulaire en ligne : nous vous enverrons ensuite le document prérempli, à faire signer par votre curé.`
  }[cle] || 'Merci de remplir ce formulaire en ligne.'
  return `Bonjour,\n\n${t}${bouton}${FIN}`
}

export default function Formulaires() {
  const [vue, setVue] = useState('envoyer')
  const [envoi, setEnvoi] = useState(null)
  const [surPlace, setSurPlace] = useState(null)
  const { data, chargement, erreur, recharger, setData } = useCharger(() => api('formulaires.liste'), [])
  const nonRemplis = (data?.envois || []).filter((x) => !x.rempli_le).length
  return (
    <>
      <EnTete titre="Formulaires" sousTitre="Envoyer un formulaire en ligne, suivre les réponses, imprimer les documents" />
      <div className="mb-4 flex gap-1 rounded-lg bg-nuit-50 p-1 text-sm">
        {VUES.map(([k, l]) => <button key={k} onClick={() => setVue(k)} className={`flex-1 rounded-md px-3 py-1.5 ${vue === k ? 'bg-white font-semibold text-nuit shadow-sm' : 'text-nuit-600'}`}>{l}
          {k === 'suivi' && nonRemplis > 0 && <span className="ml-1.5 rounded-full bg-or px-1.5 text-xs font-bold text-white">{nonRemplis}</span>}</button>)}
      </div>
      <Erreur erreur={erreur} reessayer={recharger} />
      {chargement && !data ? <Chargement /> : vue === 'envoyer' ? (
        !data?.catalogue?.length ? <Vide icone={ClipboardList} texte="Aucun formulaire : vous n'avez accès à aucune sorte de dossier." /> : (
          <>
            <p className="mb-3 text-sm text-nuit-600"><strong>Par mail</strong> : le destinataire reçoit un bouton vers le formulaire ; vous suivez la réponse dans « Suivi des envois ».
              {' '}<strong>Sur place</strong> : vous le remplissez avec la personne, sur votre écran ou sur son téléphone (QR code), sans mail. <strong>Le dossier se crée quand le formulaire est rempli.</strong></p>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.catalogue.map((f) => (
                <div key={f.cle} className="carte p-4">
                  <div className="font-medium">{f.nom}</div>
                  {f.ecole && <div className="text-xs text-nuit-600/70">Par mail : à un parent ou à une école</div>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-clair h-8 py-1 text-xs" onClick={() => setEnvoi(f)}><Send className="h-3.5 w-3.5" />Envoyer par mail</button>
                    <button className="btn-clair h-8 py-1 text-xs" onClick={() => setSurPlace(f)}><UserRound className="h-3.5 w-3.5" />Remplir sur place</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      ) : vue === 'suivi' ? <Suivi envois={data?.envois || []} setData={setData} /> : <Documents />}
      {surPlace && <SurPlaceModale f={surPlace} onFermer={() => setSurPlace(null)} />}
      {envoi && <EnvoiModale f={envoi} onFermer={() => setEnvoi(null)} onEnvoye={(r) => { setData(r); setEnvoi(null); setVue('suivi') }} />}
    </>
  )
}

/** Remplir un formulaire avec la personne, sans mail : sur cet écran, ou sur son téléphone par QR code (lien à usage unique, 24 h). */
function SurPlaceModale({ f, onFermer }) {
  const notifier = useNotif()
  const nav = useNavigate()
  // Un seul lien par ouverture de la fenêtre (pas d'actualisation automatique : le QR code ne doit pas changer)
  const [sp, setSp] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [essai, setEssai] = useState(0)
  useEffect(() => {
    let actif = true
    setErreur(null)
    api('formulaires.surPlace', { formulaire: f.cle }).then((r) => actif && setSp(r)).catch((e) => actif && setErreur(e))
    return () => { actif = false }
  }, [f.cle, essai])
  const recharger = () => setEssai((n) => n + 1)
  const lien = sp?.lien || ''
  const qr = useMemo(() => {
    if (!lien) return ''
    try { const q = qrcode(0, 'M'); q.addData(lien); q.make(); return q.createDataURL(6, 4) } catch { return '' }
  }, [lien])
  // Rempli sur son téléphone : le dossier créé s'ouvre ici
  useEffect(() => {
    if (!sp?.jeton || sp.demo) return
    let fini = false
    const t = setInterval(async () => {
      try {
        const r = await api('formulaires.surPlaceEtat', { jeton: sp.jeton })
        if (!fini && r.dossier_id) { fini = true; clearInterval(t); notifier('Formulaire rempli : dossier créé'); nav(`/dossiers/${r.dossier_id}`) }
      } catch { /* réseau : on réessaie */ }
    }, 4000)
    return () => { fini = true; clearInterval(t) }
  }, [sp?.jeton])
  function remplirIci() {
    const base = location.href.split('#')[0].replace(/[?].*$/, '').replace(/[^/]*$/, '')
    location.href = `${base}${sp.slug}/?p=${sp.jeton}&ici=1`
  }
  return (
    <Modale titre={f.nom} onFermer={onFermer} pied={<button className="btn-clair" onClick={onFermer}>Fermer</button>}>
      <Erreur erreur={erreur} reessayer={recharger} />
      {!sp ? !erreur && <Chargement /> : (
        <div className="space-y-4">
          <button className="btn-principal w-full justify-center py-3" onClick={remplirIci}><MonitorSmartphone className="h-5 w-5" />Remplir ici, sur cet écran</button>
          <div className="rounded-lg border border-nuit-100 p-4 text-center">
            <div className="mb-2 flex items-center justify-center gap-2 text-sm font-medium"><QrCode className="h-4 w-4 text-or-600" />Ou sur le téléphone de la personne</div>
            {qr ? <img src={qr} alt="QR code du formulaire" className="mx-auto h-56 w-56" style={{ imageRendering: 'pixelated' }} /> : <p className="text-xs text-nuit-600/70 break-all">{sp.lien}</p>}
            <p className="mt-2 text-xs text-nuit-600/80">Elle scanne ce code avec l'appareil photo et remplit le formulaire. Gardez cette fenêtre ouverte : le dossier s'ouvrira ici dès qu'elle aura envoyé.</p>
          </div>
          <ul className="space-y-1 text-xs text-nuit-600/80">
            <li>• Lien valable 24 h, pour une seule réponse (jusqu'au {dateCourte(sp.expire_le)} à {heure(sp.expire_le)}).</li>
            <li>• L'adresse e-mail est facultative ; si elle est donnée, un accusé de réception peut être envoyé (case cochée par défaut).</li>
            <li>• 🔒 La personne coche elle-même la case de consentement. Le dossier garde la mention « rempli au secrétariat » avec votre nom.</li>
          </ul>
        </div>
      )}
    </Modale>
  )
}

function EnvoiModale({ f, onFermer, onEnvoye }) {
  const notifier = useNotif()
  const { reglages } = useApp()
  const [vers, setVers] = useState('parent')
  const [email, setEmail] = useState('')
  const [nom, setNom] = useState('')
  const [ecole, setEcole] = useState('')
  const cate = useCharger(() => (f.ecole ? api('cate.reglages') : Promise.resolve(null)), [])
  const promos = useCharger(() => (f.ecole ? api('promotions.liste') : Promise.resolve(null)), [])
  const ecoles = (cate.data?.ecoles || []).filter((x) => x.nom)
  const choisie = ecoles.find((x) => x.nom === ecole)
  const rdv = f.cle === 'premiere_communion' && reglages.url_rdv_cure
  const proposition = useMemo(() => texteParDefaut(f.cle, { paroisse: reglages.paroisse, vers, promo: promos.data?.[`${f.cle}|${anneeScolaireActuelle()}`], rdv }),
    [f.cle, vers, promos.data, reglages, rdv])
  const [texte, setTexte] = useState(null)
  const [sujet, setSujet] = useState(f.nom)
  const [envoi, setEnvoi] = useState(false)
  const dest = vers === 'ecole' ? choisie?.email || '' : email
  async function envoyer() {
    setEnvoi(true)
    try {
      const base = location.href.split('#')[0].replace(/[?].*$/, '').replace(/[^/]*$/, '')
      const boutons = rdv ? [{ texte: 'Prendre rendez-vous avec Monsieur le Curé', url: reglages.url_rdv_cure, image: `${base}mail/rdv-cure.png`, imageSeule: true }] : []
      const r = await api('formulaires.envoyer', { formulaire: f.cle, email: dest, nom: vers === 'ecole' ? ecole : nom, ecole: vers === 'ecole' ? ecole : '', sujet, texte: texte ?? proposition, boutons })
      notifier('Formulaire envoyé'); onEnvoye(r)
    } catch (e) { notifier(e.message, 'erreur'); setEnvoi(false) }
  }
  return (
    <Modale titre={f.nom} onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={envoi || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dest)} onClick={envoyer}>{envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Envoyer</button></>}>
      <div className="space-y-3">
        {f.ecole && <div className="grid grid-cols-2 gap-2">{[['parent', 'Un parent'], ['ecole', 'Une école']].map(([k, l]) => (
          <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${vers === k ? 'border-or bg-or-50' : 'border-nuit-100'}`}><input type="radio" checked={vers === k} onChange={() => { setVers(k); setTexte(null) }} />{l}</label>
        ))}</div>}
        {vers === 'ecole' ? (
          <div><label className="etiquette">École</label>
            <select className="champ" value={ecole} onChange={(e) => setEcole(e.target.value)}><option value="">Choisir…</option>{ecoles.map((x) => <option key={x.nom} value={x.nom}>{x.nom}{x.email ? '' : ' (pas d\'e-mail)'}</option>)}</select>
            <p className="mt-1 text-xs text-nuit-600/70">Les écoles et leurs adresses se règlent dans Réglages → Catéchisme. Le formulaire s'ouvrira avec l'école déjà choisie ; chaque famille qui le remplit crée son dossier.</p></div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="etiquette">E-mail du destinataire</label><input className="champ" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" autoFocus /></div>
            <div><label className="etiquette">Nom (facultatif, pour le suivi)</label><input className="champ" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Famille Martin" /></div>
          </div>
        )}
        {['profession_foi', 'confirmation_jeune'].includes(f.cle) && vers === 'ecole' && ecole === 'Herrade de Landsberg' && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Herrade de Landsberg n'est pas proposée dans ce formulaire.</p>}
        <div><label className="etiquette">Objet</label><input className="champ" value={sujet} onChange={(e) => setSujet(e.target.value)} /></div>
        <div><label className="etiquette">Message — « [Bouton : …] » place le bouton à cet endroit</label>
          <textarea className="champ min-h-[200px] text-sm" value={texte ?? proposition} onChange={(e) => setTexte(e.target.value)} /></div>
        <p className="text-xs text-nuit-600/70">🔒 L'adresse et le nom servent seulement au suivi de cet envoi ; ils sont effacés de la liste au bout d'un an.</p>
      </div>
    </Modale>
  )
}

function Suivi({ envois, setData }) {
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const [filtre, setFiltre] = useState('attente')
  const [occupe, setOccupe] = useState('')
  const liste = envois.filter((x) => filtre === 'tous' || !x.rempli_le)
  async function op(x, action, msg) {
    if (action === 'retirer' && !(await confirmer({ titre: 'Retirer de la liste', texte: `L'envoi à ${x.nom || x.email} est retiré du suivi. Le lien envoyé reste valable ; un dossier déjà créé n'est pas touché.`, bouton: 'Retirer' }))) return
    setOccupe(x.id + action)
    try { setData(await api('formulaires.' + action, { id: x.id })); notifier(msg) } catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }
  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-sm">
        {[['attente', 'Pas encore remplis'], ['tous', 'Tous']].map(([k, l]) => <button key={k} onClick={() => setFiltre(k)} className={`pastille border px-3 py-1 ${filtre === k ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>{l}</button>)}
        <Aide>Un formulaire envoyé à une école peut être rempli par plusieurs familles : chaque réponse crée un dossier. Les envois de plus d'un an sont effacés automatiquement.</Aide>
      </div>
      {!liste.length ? <Vide icone={CheckCircle2} texte={filtre === 'attente' ? 'Tous les formulaires envoyés ont été remplis.' : 'Aucun formulaire envoyé.'} /> : (
        <div className="carte divide-y divide-nuit-50">
          {liste.map((x) => (
            <div key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{x.formulaire_nom}</div>
                <div className="text-xs text-nuit-600/80">{x.ecole ? <><School className="mr-1 inline h-3 w-3" />{x.ecole} · </> : x.nom ? x.nom + ' · ' : ''}{x.email}</div>
                <div className="text-xs text-nuit-600/75">Envoyé le {dateCourte(x.envoye_le)} par {x.envoye_par}{x.relances > 0 && ` · relancé ${x.relances} fois (dernière le ${dateCourte(x.relance_le)})`}</div>
              </div>
              {x.rempli_le
                ? <span className="pastille bg-green-50 text-green-800"><CheckCircle2 className="h-3 w-3" />{x.reponses > 1 ? `${x.reponses} réponses` : `rempli le ${dateCourte(x.rempli_le)}`}</span>
                : <span className="pastille bg-or-50 text-or-600"><Clock className="h-3 w-3" />pas encore rempli</span>}
              {x.dossier_ids.slice(0, 3).map((id, k) => <Link key={id} to={`/dossiers/${id}`} className="pastille border border-nuit-100 text-nuit hover:border-or"><FolderHeart className="h-3 w-3" />dossier{x.dossier_ids.length > 1 ? ' ' + (k + 1) : ''}</Link>)}
              {(!x.rempli_le || x.ecole) && <button className="btn-clair h-8 py-1 text-xs" disabled={!!occupe} onClick={() => op(x, 'relancer', 'Rappel envoyé')}>{occupe === x.id + 'relancer' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}Relancer</button>}
              <button className="btn-icone p-1 text-nuit-600/75 hover:text-red-700" title="Retirer de la liste" disabled={!!occupe} onClick={() => op(x, 'retirer', 'Retiré de la liste')}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

const DOCUMENTS = [
  { cle: 'B14', types: ['bapteme', 'catechumene'], aide: 'Extrait de baptême' },
  { cle: 'B15', types: ['bapteme', 'bapteme_ailleurs'], aide: 'Accord du curé du domicile des parents' },
  { cle: 'B6', types: ['catechumene'], aide: 'Entrée en catéchuménat' },
  { cle: 'sepulture', types: ['obseques'], aide: 'Extrait du registre des sépultures' }
]

function Documents() {
  const app = useApp()
  const notifier = useNotif()
  const [choix, setChoix] = useState({})
  const [ouvert, setOuvert] = useState(null)   // { modele, dossier }
  const { data } = useCharger(() => api('dossiers.liste', {}), [], ['dossiers.liste', {}])
  const reglages = { ...app.reglages, cure_nom: app.utilisateurs.find((u) => u.role === 'cure')?.nom || '' }
  async function ouvrir(doc, id) {
    if (!id) { setOuvert({ modele: IMPRIMABLES[doc.cle], dossier: { type: doc.types[doc.cle === 'B15' ? 1 : 0], infos: {}, etapes: {}, documents: {} }, vierge: true }); return }
    try { setOuvert({ modele: IMPRIMABLES[doc.cle], dossier: await api('dossiers.lire', { id }) }) } catch (e) { notifier(e.message, 'erreur') }
  }
  const visibles = DOCUMENTS.filter((doc) => doc.types.some((t) => app.peut(`dossiers:${t === 'bapteme_ailleurs' ? 'bapteme' : t}`)))
  return (
    <>
      <p className="mb-3 text-sm text-nuit-600">Partez d'un document vierge (à remplir à l'écran ou à la main), ou d'un dossier pour le préremplir. Depuis un dossier, vous pouvez aussi l'archiver, le signer ou l'envoyer, comme dans le dossier lui-même.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {visibles.map((doc) => {
          const dossiers = (data || []).filter((d) => doc.types.includes(d.type) && d.etat !== 'annule')
          return (
            <div key={doc.cle} className="carte p-4">
              <div className="mb-1 flex items-center gap-2 font-medium"><FileText className="h-4 w-4 text-or-600" />{IMPRIMABLES[doc.cle].titre}</div>
              <p className="mb-3 text-xs text-nuit-600/70">{doc.aide}</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-clair" onClick={() => ouvrir(doc)}><Printer className="h-4 w-4" />Vierge</button>
                <select className="champ w-auto min-w-0 flex-1 py-1.5 text-sm" value={choix[doc.cle] || ''} onChange={(e) => { setChoix({ ...choix, [doc.cle]: e.target.value }); if (e.target.value) ouvrir(doc, e.target.value) }}>
                  <option value="">Depuis un dossier…</option>
                  {dossiers.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
              </div>
            </div>
          )
        })}
      </div>
      {ouvert && <Imprimer modele={ouvert.modele} dossier={ouvert.dossier} reglages={reglages} libre={ouvert.vierge}
        onFermer={() => { setOuvert(null); setChoix({}) }} onArchive={(x, msg) => notifier(msg || 'Document archivé dans le dossier')} />}
    </>
  )
}
