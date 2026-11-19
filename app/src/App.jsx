import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Home, Mail, CalendarDays, FolderHeart, FolderOpen, Users, Settings, UserCircle, LogOut, Bell, ScrollText } from 'lucide-react'
import { api, ecrireToken, lireToken, quandSessionExpire, estDemo } from './api.js'
import { Chargement, FournisseurNotif, ROLES, dateRelative } from './ui.jsx'
import Connexion from './pages/Connexion.jsx'
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

const CtxApp = createContext(null)
export const useApp = () => useContext(CtxApp)
export const useAuth = useApp

const MENU = [
  { to: '/', label: 'Accueil', icone: Home },
  { to: '/courrier', label: 'Courrier', icone: Mail, droit: 'mail' },
  { to: '/agenda', label: 'Agenda', icone: CalendarDays, droit: 'agenda' },
  { to: '/dossiers', label: 'Dossiers', icone: FolderHeart, droit: 'dossiers' },
  { to: '/documents', label: 'Documents', icone: FolderOpen, droit: 'documents' },
  { to: '/extraits', label: 'Extraits de baptême', icone: ScrollText, droit: 'dossiers', secondaire: true },
  { to: '/utilisateurs', label: 'Utilisateurs', icone: Users, droit: 'utilisateurs', secondaire: true },
  { to: '/reglages', label: 'Réglages', icone: Settings, droit: 'reglages', secondaire: true }
]

export default function App() {
  const [donnees, setDonnees] = useState(null)
  const [pret, setPret] = useState(false)

  const charger = useCallback(async () => {
    try { setDonnees(await api('app.init')) } catch { ecrireToken(null); setDonnees(null) }
  }, [])

  useEffect(() => {
    quandSessionExpire(() => setDonnees(null))
    if (!lireToken() && !estDemo()) { setPret(true); return }
    charger().finally(() => setPret(true))
  }, [charger])

  if (!pret) return <Chargement />

  const valeur = donnees && {
    ...donnees,
    peut: (d) => !d || donnees.utilisateur.droits.includes(d),
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

function Cloche() {
  const { nonLues, majDonnees } = useApp()
  const [ouvert, setOuvert] = useState(false)
  const [liste, setListe] = useState(null)
  const nav = useNavigate()
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
  const { utilisateur, peut, deconnecter } = useApp()
  const menu = MENU.filter((m) => peut(m.droit))
  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 flex-col bg-nuit text-white lg:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <img src="./logo-128.png" alt="" className="h-12 w-12 rounded-full" />
          <div className="leading-tight"><div className="font-titre text-lg font-semibold">La Croix glorieuse</div><div className="text-xs text-white/60">Secrétariat paroissial</div></div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {menu.map(({ to, label, icone: I, secondaire }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${secondaire ? 'mt-0' : ''} ${isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
              <I className="h-4 w-4" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-1">
            <NavLink to="/compte" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5">
              <UserCircle className="h-5 w-5 shrink-0 text-or" />
              <div className="min-w-0 leading-tight"><div className="truncate">{utilisateur.nom}</div><div className="text-xs text-white/50">{ROLES[utilisateur.role]}</div></div>
            </NavLink>
            <Cloche />
          </div>
          <button onClick={deconnecter} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" />Se déconnecter</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between bg-nuit px-4 py-2.5 text-white lg:hidden" style={{ paddingTop: 'max(0.6rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2"><img src="./logo-128.png" alt="" className="h-8 w-8 rounded-full" /><span className="font-titre text-lg font-semibold">La Croix glorieuse</span></div>
          <div className="flex items-center"><Cloche /><NavLink to="/compte" className="rounded-lg p-2 hover:bg-white/10"><UserCircle className="h-6 w-6" /></NavLink></div>
        </header>
        {estDemo() && <div className="bg-or-100 px-4 py-1.5 text-center text-xs text-or-600">Mode démonstration — données fictives, rien n'est envoyé.</div>}

        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-5 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8">
          <div className="mx-auto max-w-6xl">
            <Routes>
              <Route path="/" element={<Accueil />} />
              {peut('mail') && <Route path="/courrier" element={<Courrier />} />}
              {peut('agenda') && <Route path="/agenda" element={<Agenda />} />}
              {peut('dossiers') && <Route path="/dossiers" element={<Dossiers />} />}
              {peut('dossiers') && <Route path="/dossiers/:id" element={<Dossier />} />}
              {peut('documents') && <Route path="/documents" element={<Documents />} />}
              {peut('dossiers') && <Route path="/extraits" element={<Extraits />} />}
              {peut('dossiers') && <Route path="/extraits/:id" element={<Extraits />} />}
              {peut('utilisateurs') && <Route path="/utilisateurs" element={<Utilisateurs />} />}
              {peut('reglages') && <Route path="/reglages" element={<Reglages />} />}
              <Route path="/compte" element={<Compte />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-nuit-100 bg-white safe-bottom lg:hidden">
          {menu.filter((m) => !m.secondaire).map(({ to, label, icone: I }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-or-600' : 'text-nuit-600/70'}`}>
              <I className="h-5 w-5" />{label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
