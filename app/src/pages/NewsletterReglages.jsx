// Réglages → Newsletter : clés (Supabase, Brevo), liste Brevo, jour et heure d'envoi.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '../api.js'
import { Chargement, Erreur, useCharger, useNotif } from '../ui.jsx'

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

export default function NewsletterReglages() {
  const notifier = useNotif()
  const { data, chargement, erreur } = useCharger(() => api('newsletter.reglages'), [])
  const [f, setF] = useState(null)
  const [cles, setCles] = useState({ brevo: '', supabase: '' })
  const [envoi, setEnvoi] = useState(false)
  const [test, setTest] = useState(null)
  useEffect(() => { if (data) setF(data) }, [data])
  if (chargement || !f) return <><Erreur erreur={erreur} />{!erreur && <Chargement />}</>

  async function enregistrer() {
    setEnvoi(true)
    try {
      const r = await api('newsletter.reglagesEcrire', {
        liste: f.liste, jour: f.jour, heure: f.heure, expediteur_nom: f.expediteur_nom, expediteur_email: f.expediteur_email, supabase_url: f.supabase_url,
        brevo_cle: cles.brevo || undefined, supabase_cle: cles.supabase || undefined
      })
      setF(r); setCles({ brevo: '', supabase: '' }); notifier('Réglages enregistrés')
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  async function tester() {
    setTest({ supabase: '…', brevo: '…' })
    try { setTest(await api('newsletter.tester')) } catch (e) { setTest({ supabase: '✗ ' + e.message, brevo: '' }) }
  }
  const couleur = (t) => (t?.startsWith('✓') ? 'text-emerald-700' : t?.startsWith('✗') ? 'text-red-700' : '')
  return (
    <div className="max-w-3xl space-y-5">
      <div className="carte space-y-3 p-5">
        <h2 className="text-xl font-semibold">Brevo (envoi de la newsletter)</h2>
        <div><label className="etiquette" htmlFor="rn-brevo">Clé API Brevo</label>
          <input id="rn-brevo" className="champ" type="password" autoComplete="new-password" placeholder={f.brevo_ok ? '•••••••• (enregistrée)' : 'xkeysib-…'} value={cles.brevo} onChange={(e) => setCles({ ...cles, brevo: e.target.value })} />
          <p className="mt-1 text-xs text-nuit-600/70">Brevo → SMTP et API → Clés API. La même clé que celle de l'AppMesse convient. Elle n'est jamais réaffichée.</p></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="etiquette" htmlFor="rn-liste">N° de la liste Brevo</label><input id="rn-liste" className="champ" type="number" min="1" value={f.liste} onChange={(e) => setF({ ...f, liste: e.target.value })} /></div>
          <div><label className="etiquette" htmlFor="rn-jour">Jour d'envoi</label>
            <select id="rn-jour" className="champ" value={f.jour} onChange={(e) => setF({ ...f, jour: Number(e.target.value) })}>{JOURS.map((j, i) => <option key={i} value={i}>{j}</option>)}</select></div>
          <div><label className="etiquette" htmlFor="rn-heure">Heure (Paris)</label><input id="rn-heure" className="champ" type="time" value={f.heure} onChange={(e) => setF({ ...f, heure: e.target.value })} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="etiquette" htmlFor="rn-nom">Nom de l'expéditeur</label><input id="rn-nom" className="champ" value={f.expediteur_nom} onChange={(e) => setF({ ...f, expediteur_nom: e.target.value })} /></div>
          <div><label className="etiquette" htmlFor="rn-mail">Adresse de l'expéditeur</label><input id="rn-mail" className="champ" type="email" value={f.expediteur_email} onChange={(e) => setF({ ...f, expediteur_email: e.target.value })} /></div>
        </div>
        <p className="text-sm text-nuit-600">Prochain envoi possible : <strong>{new Date(f.prochain_envoi).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</strong></p>
      </div>

      <div className="carte space-y-3 p-5">
        <h2 className="text-xl font-semibold">Base des annonces (AppMesse)</h2>
        <p className="text-sm text-nuit-600">Les annonces et les intentions restent dans la base Supabase de l'AppMesse : rien n'est déplacé.</p>
        <div><label className="etiquette" htmlFor="rn-url">Adresse du projet Supabase</label><input id="rn-url" className="champ" value={f.supabase_url} onChange={(e) => setF({ ...f, supabase_url: e.target.value })} /></div>
        <div><label className="etiquette" htmlFor="rn-sb">Clé secrète Supabase (service_role ou « sb_secret_… »)</label>
          <input id="rn-sb" className="champ" type="password" autoComplete="new-password" placeholder={f.supabase_secret_ok ? '•••••••• (enregistrée)' : 'facultative pour l\'instant'} value={cles.supabase} onChange={(e) => setCles({ ...cles, supabase: e.target.value })} />
          <p className="mt-1 text-xs text-nuit-600/70">{f.supabase_secret_ok ? 'Clé secrète enregistrée : le serveur l\'utilise.' : 'Sans clé secrète, le serveur utilise la clé publique de l\'AppMesse. Elle suffit aujourd\'hui ; il faudra la clé secrète quand la base sera fermée au public.'} Supabase → Project Settings → API Keys.</p></div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-principal" disabled={envoi} onClick={enregistrer}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
        <button className="btn-clair" onClick={tester}>Tester la connexion</button>
      </div>
      {test && <div className="space-y-1 text-sm"><p className={couleur(test.supabase)}>{test.supabase}</p>{test.brevo && <p className={couleur(test.brevo)}>{test.brevo}</p>}</div>}
    </div>
  )
}
