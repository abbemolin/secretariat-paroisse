import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BoutonRecherche } from './pages/RechercheGlobale.jsx'
import MaJournee, { voitMaJournee } from './pages/MaJournee.jsx'
import { Home, Mail, CalendarDays, FolderHeart, FolderOpen, Users, Settings, UserCircle, LogOut, Bell, CloudOff, RefreshCw, ScrollText, GraduationCap, HeartHandshake, Mountain, Flame, BookOpen, BookMarked, BarChart3, LifeBuoy, MoreHorizontal, X, Megaphone, CalendarRange, Newspaper, LayoutGrid, Church, BookOpenText, Sun, Cross, BookHeart } from 'lucide-react'
import { api, ecrireToken, enCache, lireToken, quandSessionExpire, estDemo, suivreFile, suivreReseau, viderFile } from './api.js'
import { derniereMiseAJour, preparerHorsLigne } from './horsligne.js'
import { Chargement, FournisseurNotif, ROLES, dateRelative, useNotif } from './ui.jsx'
import Connexion from './pages/Connexion.jsx'
import { peutVoir, peutModifier } from './acces.js'
import { definirTuileLiturgie } from './affichage.js'
import Accueil from './pages/Accueil.jsx'
import Courrier from './pages/Courrier.jsx'
import Agenda from './pages/Agenda.jsx'
import Dossiers from './pages/Dossiers.jsx'
import Dossier from './pages/Dossier.jsx'
import Documents from './pages/Documents.jsx'
import Utilisateurs from './pages/Utilisateurs.jsx'
import Reglages from './pages/Reglages.jsx'
import Compte from './pages/Compte.jsx'
import Extraits from './pages/Extraits.jsx'
import Catechisme from './pages/Catechisme.jsx'
import CorUnum from './pages/CorUnum.jsx'
import Retraites from './pages/Retraites.jsx'
import Catechumenat from './pages/Catechumenat.jsx'
import Aide from './pages/Aide.jsx'
import Registres from './pages/Registres.jsx'
import Statistiques from './pages/Statistiques.jsx'
import Annonces from './pages/Annonces.jsx'
import Semaine from './pages/Semaine.jsx'
import Newsletter from './pages/Newsletter.jsx'
import Breviaire from './pages/Breviaire.jsx'
import MesseDuJour from './pages/MesseDuJour.jsx'
import Bible from './pages/Bible.jsx'
import CalendrierPropre from './pages/CalendrierPropre.jsx'
import Ordo from './pages/Ordo.jsx'
import IntentionsAujourdhui from './pages/IntentionsAujourdhui.jsx'
import IntentionsCalendrier from './pages/IntentionsCalendrier.jsx'
import IntentionsGerer from './pages/IntentionsGerer.jsx'

const CtxApp = createContext(null)
export const useApp = () => useContext(CtxApp)
export const useAuth = useApp

// Menu regroupé (Sacrements, Catéchèse) ; sur téléphone : 4 entrées principales + « Plus »
const MENU = [
  { to: '/', label: 'Accueil', icone: Home, bas: true },
  { to: '/courrier', label: 'Courrier', icone: Mail, droit: 'mail', bas: true },
  { to: '/agenda', label: 'Agenda', icone: CalendarDays, droit: 'agenda', bas: true },
  { groupe: 'Sacrements', items: [
    { to: '/dossiers', label: 'Dossiers', icone: FolderHeart, droit: 'dossiers', bas: true },
    { to: '/extraits', label: 'Extraits de baptême', icone: ScrollText, droit: 'extraits' },
    { to: '/registres', label: 'Registres', icone: BookMarked, droit: 'registres' }
  ] },
  { groupe: 'Catéchèse', items: [
    { to: '/catechisme', label: 'Catéchisme', icone: GraduationCap, droit: 'catechisme' },
    { to: '/catechumenat', label: 'Catéchuménat', icone: BookOpen, droit: 'catechumenat' },
    { to: '/dossiers?type=confirmand', label: 'Confirmands', icone: Flame, droit: 'dossiers:confirmand' },
    { to: '/cor-unum', label: 'Cor Unum', icone: HeartHandshake, droit: 'cor_unum' },
    { to: '/retraites', label: 'Retraites', icone: Mountain, droit: 'retraites' }
  ] },
  { to: '/documents', label: 'Documents', icone: FolderOpen, droit: 'documents' },
  { to: '/statistiques', label: 'Statistiques', icone: BarChart3, droit: 'statistiques' },
  { groupe: '', secondaire: true, items: [
    { to: '/aide', label: 'Aide', icone: LifeBuoy },
    { to: '/utilisateurs', label: 'Utilisateurs', icone: Users, droit: 'utilisateurs' },
    { to: '/reglages', label: 'Réglages', icone: Settings, droit: 'reglages' }
  ] }
]
const aplatir = (m) => m.flatMap((x) => (x.items ? x.items : [x]))

// ─── Tuiles : après la connexion, choix de l'espace (une seule tuile active → entrée directe) ───
const TUILES = [
  { cle: 'secretariat', titre: 'Secrétariat', texte: 'Courrier, agenda, dossiers, catéchèse', icone: Mail, chemin: '/' },
  { cle: 'intentions', titre: 'Intentions de messe', texte: 'Aujourd\'hui, calendrier, gestion des intentions', icone: Church, chemin: '/intentions', droit: 'intentions' },
  { cle: 'annonces', titre: 'Annonces et newsletter', texte: 'Annonces, feuille de semaine, newsletter', icone: Megaphone, chemin: '/annonces', droit: 'annonces' },
  { cle: 'liturgie', titre: 'Liturgie', texte: 'Bréviaire, messe du jour, ordo, Bible', icone: BookOpenText, chemin: '/breviaire', droit: 'liturgie' }
]
const MENU_ANNONCES = [
  { to: '/annonces', label: 'Annonces', icone: Megaphone, bas: true },
  { to: '/semaine', label: 'Feuille de semaine', icone: CalendarRange, bas: true },
  { to: '/newsletter', label: 'Newsletter', icone: Newspaper, bas: true }
]
const MENU_INTENTIONS = [
  { to: '/intentions', label: 'Aujourd\'hui', icone: Home, bas: true, exact: true },
  { to: '/intentions/calendrier', label: 'Calendrier', icone: CalendarDays, bas: true },
  { to: '/intentions/gerer', label: 'Gérer', icone: Church, bas: true }
]
const MENU_LITURGIE = [
  { to: '/breviaire', label: 'Bréviaire', icone: Sun, bas: true },
  { to: '/messe', label: 'Messe du jour', icone: Cross, bas: true },
  { to: '/ordo', label: 'Ordo', icone: ScrollText, bas: true },
  { to: '/bible', label: 'Bible', icone: BookHeart, bas: true },
  { to: '/calendrier-propre', label: 'Calendrier propre', icone: CalendarRange }
]
const tuileDuChemin = (chemin) => {
  const p = chemin.split('/')[1]
  if (['annonces', 'semaine', 'newsletter'].includes(p)) return 'annonces'
  if (['breviaire', 'messe', 'ordo', 'bible', 'calendrier-propre'].includes(p)) return 'liturgie'
  if (p === 'intentions') return 'intentions'
  return 'secretariat'
}
const NOM_TUILE = { annonces: 'Annonces et newsletter', liturgie: 'Liturgie', intentions: 'Intentions de messe' }

function EcranTuiles({ tuiles }) {
  const { utilisateur, deconnecter, peut } = useApp()
  const nav = useNavigate()
  const prenom = String(utilisateur.nom || '').replace(/^(abbé|père)\s+/i, '')
  return (
    <div className="flex min-h-full flex-col bg-parchemin">
      <header className="flex items-center gap-3 bg-nuit px-4 py-3 text-white sm:px-8" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <img src="./logo-128.png" alt="" className="h-9 w-9 rounded-full" />
        <span className="flex-1 font-titre text-xl font-semibold">La Croix glorieuse</span>
        <PastilleReseau />
        <BoutonRecherche mobile />
        <Cloche />
        <button onClick={deconnecter} className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Se déconnecter" title="Se déconnecter"><LogOut className="h-5 w-5" /></button>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8 sm:py-14">
        <h1 className="text-4xl font-semibold text-nuit">Bonjour{prenom ? ', ' + (utilisateur.nom.match(/^abbé/i) ? 'abbé ' + prenom.split(' ').slice(-1)[0] : prenom.split(' ')[0]) : ''}</h1>
        <p className="mt-1 text-sm capitalize text-nuit-600">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        {voitMaJournee(peut) && <MaJournee />}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {tuiles.map((t) => {
            const I = t.icone
            return (
              <button key={t.cle} disabled={t.bientot} onClick={() => nav(t.chemin)}
                className={`carte flex min-h-[170px] flex-col items-start gap-2 p-4 text-left transition sm:p-5 ${t.bientot ? 'cursor-default opacity-55' : 'hover:-translate-y-0.5 hover:shadow-md'}`}>
                <span className={`mb-1 flex h-11 w-11 items-center justify-center rounded-full ${t.cle === 'secretariat' ? 'bg-nuit-50 text-nuit' : 'bg-or-50 text-or-600'}`}><I className="h-6 w-6" /></span>
                <span className="font-titre text-xl font-semibold leading-tight text-nuit">{t.titre}</span>
                <span className="text-xs leading-snug text-nuit-600">{t.texte}</span>
                {t.bientot && <span className="pastille mt-auto bg-nuit-50 text-nuit-600">Bientôt</span>}
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}

/** Lien de menu : tient compte de « ?type=… » (Confirmands est une vue de Dossiers). */
function LienMenu({ to, label, court, icone: I, mobile, onClick, exact }) {
  const loc = useLocation()
  const [chemin, requete] = to.split('?')
  const typeLien = new URLSearchParams(requete || '').get('type')
  const typeActuel = new URLSearchParams(loc.search).get('type')
  const actif = chemin === '/' || exact ? loc.pathname === chemin : (loc.pathname === chemin || loc.pathname.startsWith(chemin + '/')) && (typeLien ? typeActuel === typeLien : !(chemin === '/dossiers' && typeActuel === 'confirmand'))
  if (mobile) return <NavLink to={to} onClick={onClick} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${actif ? 'text-or-600' : 'text-nuit-600/70'}`}><I className="h-5 w-5" />{court || label}</NavLink>
  return (
    <NavLink to={to} onClick={onClick} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${actif ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
      <I className="h-4 w-4" />{label}
    </NavLink>
  )
}

/** Sur téléphone : toutes les rubriques, regroupées. */
function MenuPlus({ menu, onFermer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-nuit-800/40" onClick={onFermer}>
      <div className="carte w-full rounded-b-none p-4 safe-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between"><span className="font-titre text-xl font-semibold">Toutes les rubriques</span><button className="btn-icone" onClick={onFermer}><X className="h-5 w-5" /></button></div>
        {menu.map((m, i) => m.items ? (
          <div key={i} className="mt-2">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-or-600">{m.groupe || 'Paramètres et aide'}</div>
            <div className="grid grid-cols-3 gap-2">{m.items.map((x) => <TuileMenu key={x.to} {...x} onClick={onFermer} />)}</div>
          </div>
        ) : null)}
        <div className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-or-600">Autres</div>
        <div className="grid grid-cols-3 gap-2">{menu.filter((m) => !m.items && !m.bas).map((x) => <TuileMenu key={x.to} {...x} onClick={onFermer} />)}<TuileMenu to="/compte" label="Mon compte" icone={UserCircle} onClick={onFermer} /></div>
      </div>
    </div>
  )
}
function TuileMenu({ to, label, icone: I, onClick }) {
  return <NavLink to={to} onClick={onClick} className="flex flex-col items-center gap-1 rounded-xl border border-nuit-100 p-3 text-center text-xs text-nuit-700 hover:bg-nuit-50"><I className="h-5 w-5 text-or" />{label}</NavLink>
}

export default function App() {
  const [donnees, setDonnees] = useState(null)
  const [pret, setPret] = useState(false)

  const charger = useCallback(async () => {
    try { setDonnees({ ...(await api('app.init')), horsLigne: false }) } catch (e) {
      // Sans connexion : on démarre avec la dernière session connue (bréviaire, Bible… restent utilisables)
      const copie = e.code === 'RESEAU' && enCache('app.init')
      if (copie) { setDonnees({ ...copie, horsLigne: true }); return }
      if (e.code !== 'RESEAU') ecrireToken(null)
      setDonnees(null)
    }
  }, [])

  useEffect(() => {
    quandSessionExpire(() => setDonnees(null))
    if (!lireToken() && !estDemo()) { setPret(true); window.finDemarrage?.(); return }
    charger().finally(() => { setPret(true); window.finDemarrage?.() })
  }, [charger])
  // Retour de la connexion : session et données rafraîchies (le serveur est réessayé chaque minute tant qu'on est hors ligne)
  useEffect(() => {
    let avant = false, t = null
    const fin = suivreReseau((hors) => {
      if (avant && !hors) charger()
      avant = hors
      clearInterval(t)
      if (hors) t = setInterval(() => api('app.init').then((d) => setDonnees((x) => ({ ...x, ...d }))).catch(() => {}), 60000)
    })
    window.addEventListener('online', charger)
    return () => { fin(); clearInterval(t); window.removeEventListener('online', charger) }
  }, [charger])
  // Préparation hors connexion, en arrière-plan (au plus toutes les 30 minutes)
  const uid = donnees?.utilisateur?.id
  useEffect(() => {
    if (!uid) return
    const f = () => preparerHorsLigne((d) => peutVoir(donnees.utilisateur, d))
    const t = setTimeout(f, 4000)   // après l'affichage de la première page
    const i = setInterval(f, 5 * 60000)
    window.addEventListener('online', f)
    return () => { clearTimeout(t); clearInterval(i); window.removeEventListener('online', f) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  if (!pret) return <Chargement />

  const valeur = donnees && {
    ...donnees,
    peut: (d) => peutVoir(donnees.utilisateur, d),
    ecrit: (zone, sorte) => peutModifier(donnees.utilisateur, zone, sorte),
    nomUtilisateur: (id) => donnees.utilisateurs.find((u) => u.id === id)?.nom || '',
    recharger: charger,
    majDonnees: (patch) => setDonnees((d) => ({ ...d, ...patch })),
    deconnecter: async () => { try { await api('auth.logout') } catch { /* ignore */ } ecrireToken(null); setDonnees(null) }
  }

  return (
    <FournisseurNotif>
      {!donnees ? <Connexion onConnexion={async ({ token }) => { ecrireToken(token); await charger() }} /> : (
        <CtxApp.Provider value={valeur}><Cadre /></CtxApp.Provider>
      )}
    </FournisseurNotif>
  )
}

/** Hors connexion : petit nuage barré dans l'en-tête (avec le nombre de modifications en attente) ; un appui donne le détail. */
function PastilleReseau({ haut }) {
  const [hors, setHors] = useState(false)
  const [attente, setAttente] = useState(0)
  const [ouvert, setOuvert] = useState(false)
  useEffect(() => { const a = suivreReseau(setHors), b = suivreFile(setAttente); return () => { a(); b() } }, [])
  if (!hors && !attente) return null
  const le = derniereMiseAJour()
  return (
    <div className="relative">
      <button onClick={() => setOuvert(!ouvert)} className="relative rounded-lg p-2 text-current opacity-80 hover:bg-white/10" aria-label="Hors connexion" title={hors ? 'Hors connexion' : 'Modifications en attente d\'envoi'}>
        {hors ? <CloudOff className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
        {attente > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-nuit">{attente}</span>}
      </button>
      {ouvert && <>
        <div className="fixed inset-0 z-40" onClick={() => setOuvert(false)} />
        <div className={`carte absolute z-50 w-72 p-3 text-left text-sm text-nuit-700 shadow-lg ${haut ? 'bottom-11 left-0' : 'right-0 top-11'}`}>
          <div className="font-semibold text-nuit">{hors ? 'Hors connexion' : 'Connexion retrouvée'}</div>
          {hors && <p className="mt-1 text-xs leading-relaxed">L'appli fonctionne avec ce qui est gardé sur l'appareil{le ? ', à jour du ' + new Date(le).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}.</p>}
          {attente > 0 && <p className="mt-1 text-xs leading-relaxed">{attente > 1 ? `${attente} modifications gardées` : '1 modification gardée'} sur l'appareil : {attente > 1 ? 'elles partiront' : 'elle partira'} toute seule au retour du réseau.</p>}
          {attente > 0 && <button className="btn-clair mt-2 w-full py-1.5 text-xs" onClick={() => viderFile()}><RefreshCw className="h-3.5 w-3.5" />Envoyer maintenant</button>}
        </div>
      </>}
    </div>
  )
}

function Cloche() {
  const { nonLues, majDonnees } = useApp()
  const [ouvert, setOuvert] = useState(false)
  const [liste, setListe] = useState(null)
  const nav = useNavigate()
  // « Ma journée » : ouvrir la cloche depuis « À traiter »
  useEffect(() => {
    const f = async () => { setOuvert(true); setListe(await api('notifications.liste', { limite: 20 }).catch(() => [])) }
    window.addEventListener('ouvrir-cloche', f); return () => window.removeEventListener('ouvrir-cloche', f)
  }, [])
  useEffect(() => {
    const t = setInterval(() => api('notifications.liste', { nonLues: true, limite: 50 }).then((l) => majDonnees({ nonLues: l.length })).catch(() => {}), 120000)
    return () => clearInterval(t)
  }, [majDonnees])
  async function ouvrir() {
    setOuvert(!ouvert)
    if (!ouvert) setListe(await api('notifications.liste', { limite: 20 }).catch(() => []))
  }
  async function aller(n) {
    setOuvert(false)
    if (!n.lu) { api('notifications.lues', { ids: [n.id] }).catch(() => {}); majDonnees({ nonLues: Math.max(0, nonLues - 1) }) }
    if (n.lien) nav(n.lien.replace(/^#/, ''))
  }
  return (
    <div className="relative">
      <button onClick={ouvrir} className="relative rounded-lg p-2 text-current hover:bg-white/10" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {nonLues > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-or px-1 text-[10px] font-bold text-white">{nonLues}</span>}
      </button>
      {ouvert && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOuvert(false)} />
          <div className="carte absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden text-nuit-800">
            <div className="flex items-center justify-between border-b border-nuit-50 px-4 py-2.5">
              <span className="font-titre text-lg font-semibold">Notifications</span>
              {nonLues > 0 && <button className="text-xs text-or-600 hover:underline" onClick={() => { api('notifications.lues', {}); majDonnees({ nonLues: 0 }); setListe((l) => l?.map((n) => ({ ...n, lu: true }))) }}>Tout marquer lu</button>}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {!liste ? <Chargement /> : !liste.length ? <p className="p-4 text-sm text-nuit-600/70">Aucune notification.</p> : liste.map((n) => (
                <button key={n.id} onClick={() => aller(n)} className={`block w-full border-b border-nuit-50 px-4 py-2.5 text-left text-sm hover:bg-nuit-50/60 ${n.lu ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-2">{!n.lu && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-or" />}
                    <div className="min-w-0 flex-1"><div className="font-medium">{n.titre}</div><div className="truncate text-xs text-nuit-600/70">{n.texte}</div></div>
                    <span className="shrink-0 text-[11px] text-nuit-600/50">{dateRelative(n.date)}</span></div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Cadre() {
  const { utilisateur, peut, ecrit, deconnecter } = useApp()
  const loc = useLocation()
  const [plus, setPlus] = useState(false)
  const notifier = useNotif()
  const nav = useNavigate()
  const zonePage = { courrier: 'courrier', agenda: 'agenda', extraits: 'extraits', registres: 'registres', catechisme: 'catechisme', catechumenat: 'catechumenat', 'cor-unum': 'cor_unum', retraites: 'retraites', documents: 'documents', annonces: 'annonces', semaine: 'annonces', newsletter: 'annonces', breviaire: 'liturgie', messe: 'liturgie', bible: 'liturgie', ordo: 'liturgie', 'calendrier-propre': 'liturgie', intentions: 'intentions' }[loc.pathname.split('/')[1]]
  const tuilesActives = TUILES.filter((t) => !t.bientot && peut(t.droit))
  const avecTuiles = tuilesActives.length > 1
  const tuile = tuileDuChemin(loc.pathname)
  // Mode sombre propre à la tuile « Liturgie »
  useEffect(() => { definirTuileLiturgie(tuile === 'liturgie') }, [tuile])
  useEffect(() => () => definirTuileLiturgie(false), [])
  // Écran des tuiles à l'ouverture de l'appli (une fois par session)
  useEffect(() => {
    if (!avecTuiles) return
    try { if (sessionStorage.getItem('tuiles-vues')) return; sessionStorage.setItem('tuiles-vues', '1') } catch { /* ignore */ }
    if (loc.pathname === '/') nav('/tuiles', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avecTuiles])
  const lectureSeule = (zonePage && !ecrit(zonePage)) || (loc.pathname === '/dossiers' && !ecrit('dossiers'))
  useEffect(() => {
    const fin = suivreFile(() => {})
    const refus = (e) => notifier('Une modification gardée hors connexion a été refusée par le serveur : ' + e.detail, 'erreur')
    window.addEventListener('file-erreur', refus)
    viderFile()
    return () => { fin(); window.removeEventListener('file-erreur', refus) }
  }, [notifier])
  const menu = tuile === 'annonces' ? MENU_ANNONCES : tuile === 'liturgie' ? MENU_LITURGIE : tuile === 'intentions' ? MENU_INTENTIONS : MENU.map((m) => (m.items ? { ...m, items: m.items.filter((x) => peut(x.droit)) } : m)).filter((m) => (m.items ? m.items.length : peut(m.droit)))
  const bas = aplatir(menu).filter((m) => m.bas)
  if (avecTuiles && loc.pathname === '/tuiles') return <EcranTuiles tuiles={TUILES.filter((t) => t.bientot || peut(t.droit))} />
  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 flex-col bg-nuit text-white lg:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <img src="./logo-128.png" alt="" className="h-12 w-12 rounded-full" />
          <div className="leading-tight"><div className="font-titre text-lg font-semibold">La Croix glorieuse</div><div className="text-xs text-white/60">{NOM_TUILE[tuile] || 'Secrétariat paroissial'}</div></div>
        </div>
        {avecTuiles && <NavLink to="/tuiles" className="mx-3 mb-2 flex items-center gap-3 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"><LayoutGrid className="h-4 w-4" />Tuiles</NavLink>}
        <BoutonRecherche />
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {menu.map((m, i) => m.items ? (
            <div key={i} className={m.secondaire ? 'border-t border-white/10 pt-2' : 'pt-2'}>
              {m.groupe && <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">{m.groupe}</div>}
              {m.items.map((x) => <LienMenu key={x.to} {...x} />)}
            </div>
          ) : <LienMenu key={m.to} {...m} />)}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-1">
            <NavLink to="/compte" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5">
              <UserCircle className="h-5 w-5 shrink-0 text-or" />
              <div className="min-w-0 leading-tight"><div className="truncate">{utilisateur.nom}</div><div className="text-xs text-white/50">{ROLES[utilisateur.role]}</div></div>
            </NavLink>
            <PastilleReseau haut />
            <Cloche />
          </div>
          <button onClick={deconnecter} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" />Se déconnecter</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between bg-nuit px-4 py-2.5 text-white lg:hidden" style={{ paddingTop: 'max(0.6rem, env(safe-area-inset-top))' }}>
          <div className="flex min-w-0 items-center gap-2"><img src="./logo-128.png" alt="" className="h-8 w-8 rounded-full" /><span className="truncate font-titre text-lg font-semibold">{NOM_TUILE[tuile] || 'La Croix glorieuse'}</span></div>
          <div className="flex items-center">{avecTuiles && <NavLink to="/tuiles" className="rounded-lg p-2 hover:bg-white/10" aria-label="Tuiles" title="Tuiles"><LayoutGrid className="h-5 w-5" /></NavLink>}<PastilleReseau /><BoutonRecherche mobile /><Cloche /><NavLink to="/compte" className="rounded-lg p-2 hover:bg-white/10"><UserCircle className="h-6 w-6" /></NavLink></div>
        </header>
        {lectureSeule && <div className="bg-nuit-50 px-4 py-1.5 text-center text-xs text-nuit-600">Lecture seule : vous pouvez consulter cette page, mais pas la modifier.</div>}
        {estDemo() && <div className="bg-or-100 px-4 py-1.5 text-center text-xs text-or-600">{({ secretaire: 'Aperçu : vous voyez l\'appli comme une secrétaire. ', cure: 'Aperçu : vous voyez l\'appli comme un prêtre. ', diacre: 'Aperçu : vous voyez l\'appli comme un diacre aux accès ajustés. ' })[new URLSearchParams(location.search).get('role')] || 'Mode démonstration — '}Données fictives, rien n'est enregistré ni envoyé.</div>}

        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-5 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8">
          <div className="mx-auto max-w-6xl animate-entree" key={loc.pathname}>
            <Routes>
              <Route path="/" element={<Accueil />} />
              {peut('mail') && <Route path="/courrier" element={<Courrier />} />}
              {peut('agenda') && <Route path="/agenda" element={<Agenda />} />}
              {peut('dossiers') && <Route path="/dossiers" element={<Dossiers />} />}
              {peut('dossiers') && <Route path="/dossiers/:id" element={<Dossier />} />}
              {peut('documents') && <Route path="/documents" element={<Documents />} />}
              {peut('catechisme') && <Route path="/catechisme" element={<Catechisme />} />}
              {peut('cor_unum') && <Route path="/cor-unum" element={<CorUnum />} />}
              {peut('retraites') && <Route path="/retraites" element={<Retraites />} />}
              {peut('catechumenat') && <Route path="/catechumenat" element={<Catechumenat />} />}
              {peut('retraites') && <Route path="/retraites/:id" element={<Retraites />} />}
              {peut('catechisme') && <Route path="/catechisme/:id" element={<Catechisme />} />}
              {peut('extraits') && <Route path="/extraits" element={<Extraits />} />}
              {peut('extraits') && <Route path="/extraits/:id" element={<Extraits />} />}
              {peut('registres') && <Route path="/registres" element={<Registres />} />}
              {peut('statistiques') && <Route path="/statistiques" element={<Statistiques />} />}
              {peut('utilisateurs') && <Route path="/utilisateurs" element={<Utilisateurs />} />}
              {peut('reglages') && <Route path="/reglages" element={<Reglages />} />}
              {peut('annonces') && <Route path="/annonces" element={<Annonces />} />}
              {peut('annonces') && <Route path="/semaine" element={<Semaine />} />}
              {peut('annonces') && <Route path="/newsletter" element={<Newsletter />} />}
              {peut('liturgie') && <Route path="/breviaire" element={<Breviaire />} />}
              {peut('liturgie') && <Route path="/messe" element={<MesseDuJour />} />}
              {peut('liturgie') && <Route path="/bible" element={<Bible />} />}
              {peut('liturgie') && <Route path="/calendrier-propre" element={<CalendrierPropre />} />}
              {peut('liturgie') && <Route path="/ordo" element={<Ordo />} />}
              {peut('intentions') && <Route path="/intentions" element={<IntentionsAujourdhui />} />}
              {peut('intentions') && <Route path="/intentions/calendrier" element={<IntentionsCalendrier />} />}
              {peut('intentions') && <Route path="/intentions/gerer" element={<IntentionsGerer />} />}
              <Route path="/aide" element={<Aide />} />
              <Route path="/compte" element={<Compte />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-nuit-100 bg-white safe-bottom lg:hidden">
          {bas.map((x) => <LienMenu key={x.to} {...x} mobile />)}
          {NOM_TUILE[tuile]
            ? <NavLink to="/tuiles" className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-nuit-600/70"><LayoutGrid className="h-5 w-5" />Tuiles</NavLink>
            : <button onClick={() => setPlus(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-nuit-600/70"><MoreHorizontal className="h-5 w-5" />Plus</button>}
        </nav>
        {plus && <MenuPlus menu={menu} onFermer={() => setPlus(false)} />}
      </div>
    </div>
  )
}
