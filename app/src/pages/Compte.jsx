import { useEffect, useState } from 'react'
import { LogOut, Loader2, Smartphone, Bell, BellOff, Users, Settings, Moon, Type, BellRing } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, activerPush, desactiverPush, abonnementActuel, pushPossible, estDemo } from '../api.js'
import { useApp } from '../App.jsx'
import { Erreur, useNotif, ROLES, Interrupteur, Chargement } from '../ui.jsx'
import { lireAffichage, ecrireAffichage, TAILLES, THEMES } from '../affichage.js'

export default function Compte() {
  const { utilisateur, deconnecter, peut } = useApp()
  const notifier = useNotif()
  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function changer(e) {
    e.preventDefault(); setErreur(null)
    if (nouveau !== confirmation) { setErreur(new Error('Les deux mots de passe ne correspondent pas.')); return }
    setEnvoi(true)
    try { await api('auth.motdepasse', { ancien, nouveau }); notifier('Mot de passe modifié'); setAncien(''); setNouveau(''); setConfirmation('') }
    catch (err) { setErreur(err) } finally { setEnvoi(false) }
  }

  return (
    <>
      <div className="mb-5"><h1 className="text-3xl font-semibold">Mon compte</h1><p className="text-sm text-nuit-600/80">{utilisateur.nom} · {ROLES[utilisateur.role]} · identifiant « {utilisateur.identifiant} »</p></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Notifications />
          <PrefsNotifications />
          <form className="carte space-y-3 p-5" onSubmit={changer}>
            <h2 className="text-xl font-semibold">Changer mon mot de passe</h2>
            <div><label className="etiquette">Mot de passe actuel</label><input className="champ" type="password" value={ancien} onChange={(e) => setAncien(e.target.value)} required autoComplete="current-password" /></div>
            <div><label className="etiquette">Nouveau mot de passe (8 caractères min.)</label><input className="champ" type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} required minLength={8} autoComplete="new-password" /></div>
            <div><label className="etiquette">Confirmer</label><input className="champ" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required autoComplete="new-password" /></div>
            <Erreur erreur={erreur} />
            <button className="btn-principal" disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Modifier</button>
          </form>
        </div>
        <div className="space-y-5">
          <Affichage />
          <div className="carte space-y-2 p-5 text-sm">
            <h2 className="flex items-center gap-2 text-xl font-semibold"><Smartphone className="h-5 w-5 text-or" />Installer l'appli</h2>
            <p><strong>iPhone</strong> : dans Safari, bouton Partager → « Sur l'écran d'accueil ». Ouvrez ensuite l'appli depuis l'icône pour activer les notifications.</p>
            <p><strong>Android</strong> : dans Chrome, menu ⋮ → « Installer l'application ».</p>
            <p><strong>Ordinateur</strong> : dans Chrome ou Edge, icône d'installation à droite de la barre d'adresse.</p>
          </div>
          {(peut('utilisateurs') || peut('reglages')) && (
            <div className="carte space-y-2 p-5">
              <h2 className="text-xl font-semibold">Administration</h2>
              {peut('utilisateurs') && <Link to="/utilisateurs" className="btn-clair w-full justify-start"><Users className="h-4 w-4" />Utilisateurs</Link>}
              {peut('reglages') && <Link to="/reglages" className="btn-clair w-full justify-start"><Settings className="h-4 w-4" />Réglages (signatures, réponses types, journal)</Link>}
            </div>
          )}
          <button className="btn-danger w-full" onClick={deconnecter}><LogOut className="h-4 w-4" />Se déconnecter</button>
        </div>
      </div>
    </>
  )
}

function Notifications() {
  const notifier = useNotif()
  const [actif, setActif] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  useEffect(() => { if (estDemo()) { setActif(false); return } abonnementActuel().then((s) => setActif(!!s)).catch(() => setActif(false)) }, [])

  async function basculer() {
    setEnvoi(true)
    try {
      if (actif) { await desactiverPush(); setActif(false); notifier('Notifications désactivées sur cet appareil') }
      else { await activerPush(); setActif(true); notifier('Notifications activées sur cet appareil') }
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  return (
    <div className="carte space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Bell className="h-5 w-5 text-or" />Notifications sur cet appareil</h2>
      <p className="text-sm text-nuit-600">Être prévenu quand un mail ou un dossier vous est confié, ou qu'une demande arrive du site. À activer sur chaque téléphone ou ordinateur.</p>
      {!pushPossible() && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Ce navigateur ne gère pas les notifications. Sur iPhone, installez d'abord l'appli sur l'écran d'accueil puis ouvrez-la depuis l'icône.</p>}
      <div className="flex flex-wrap gap-2">
        <button className={actif ? 'btn-clair' : 'btn-or'} onClick={basculer} disabled={envoi || actif === null || !pushPossible()}>
          {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : actif ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}{actif ? 'Désactiver' : 'Activer les notifications'}</button>
        {actif && <button className="btn-clair" onClick={async () => { await api('push.tester'); notifier('Notification de test envoyée') }}>Tester</button>}
      </div>
    </div>
  )
}

function Affichage() {
  const [a, setA] = useState(lireAffichage())
  const maj = (k, v) => { const b = { ...a, [k]: v }; setA(b); ecrireAffichage(b) }
  const choix = (k, options) => (
    <div className="flex flex-wrap gap-1.5">{Object.entries(options).map(([v, l]) => (
      <button key={v} onClick={() => maj(k, v)} className={`pastille border px-3 py-1.5 text-sm ${a[k] === v ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>{l}</button>
    ))}</div>
  )
  return (
    <div className="carte space-y-3 p-5">
      <h2 className="text-xl font-semibold">Affichage</h2>
      <p className="text-xs text-nuit-600/70">Propre à cet appareil.</p>
      <div><div className="etiquette flex items-center gap-1.5"><Type className="h-3.5 w-3.5" />Taille du texte</div>{choix('taille', TAILLES)}</div>
      <div><div className="etiquette flex items-center gap-1.5"><Moon className="h-3.5 w-3.5" />Thème</div>{choix('theme', THEMES)}</div>
    </div>
  )
}

function PrefsNotifications() {
  const notifier = useNotif()
  const [p, setP] = useState(null)
  useEffect(() => { api('notifications.prefs').then(setP).catch(() => setP(false)) }, [])
  if (p === false) return null
  async function enregistrer(q) {
    setP(q)
    try { setP(await api('notifications.prefs', { ecrire: true, coupees: q.coupees, calme: q.calme })); notifier('Préférences enregistrées') } catch (e) { notifier(e.message, 'erreur') }
  }
  return (
    <div className="carte space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><BellRing className="h-5 w-5 text-or" />Ce que je reçois</h2>
      {!p ? <Chargement /> : <>
        <div className="space-y-2">{p.categories.map((c) => {
          const actif = !p.coupees.includes(c.cle)
          return <label key={c.cle} className="flex items-center gap-3 text-sm"><Interrupteur actif={actif} onChange={(v) => enregistrer({ ...p, coupees: v ? p.coupees.filter((x) => x !== c.cle) : [...p.coupees, c.cle] })} /><span className="flex-1">{c.nom}</span></label>
        })}</div>
        <div className="rounded-lg bg-nuit-50/60 p-3">
          <label className="flex items-center gap-3 text-sm"><Interrupteur actif={p.calme.actif} onChange={(v) => enregistrer({ ...p, calme: { ...p.calme, actif: v } })} /><span className="flex-1"><strong>Heures calmes</strong><br /><span className="text-xs text-nuit-600/70">Les notifications restent dans l'appli, mais rien ne sonne sur le téléphone.</span></span></label>
          {p.calme.actif && <div className="mt-2 flex items-center gap-2 text-sm">De <input type="time" className="champ w-28 py-1" value={p.calme.de} onChange={(e) => enregistrer({ ...p, calme: { ...p.calme, de: e.target.value } })} /> à <input type="time" className="champ w-28 py-1" value={p.calme.a} onChange={(e) => enregistrer({ ...p, calme: { ...p.calme, a: e.target.value } })} /></div>}
        </div>
      </>}
    </div>
  )
}
