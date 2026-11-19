import { useState } from 'react'
import { Settings, Loader2 } from 'lucide-react'
import { api, definirUrlApi, urlApi, urlApiFixe } from '../api.js'
import { Erreur } from '../ui.jsx'

export default function Connexion({ onConnexion }) {
  const [identifiant, setIdentifiant] = useState('')
  const [motdepasse, setMotdepasse] = useState('')
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [reglage, setReglage] = useState(!urlApi())
  const [adresse, setAdresse] = useState(urlApi())

  async function valider(e) {
    e.preventDefault()
    setErreur(null); setEnvoi(true)
    try { onConnexion(await api('auth.login', { identifiant, motdepasse })) }
    catch (err) { setErreur(err) }
    finally { setEnvoi(false) }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-nuit px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-white">
          <img src="./logo.png" alt="Paroisse personnelle La Croix glorieuse" className="mx-auto mb-4 h-32 w-32 rounded-full shadow-lg" />
          <h1 className="text-3xl font-semibold">La Croix glorieuse</h1>
          <p className="mt-1 text-sm text-white/60">Secrétariat paroissial</p>
        </div>

        {reglage ? (
          <form className="carte space-y-4 p-6" onSubmit={(e) => { e.preventDefault(); definirUrlApi(adresse); setReglage(false) }}>
            <div>
              <label className="etiquette">Adresse du serveur (Apps Script)</label>
              <input className="champ font-mono text-xs" value={adresse} onChange={(e) => setAdresse(e.target.value)}
                placeholder="https://script.google.com/macros/s/…/exec" required />
              <p className="mt-2 text-xs text-nuit-600/70">À demander à l'administrateur. Une seule fois par appareil.</p>
            </div>
            <button className="btn-principal w-full">Enregistrer</button>
            <a href="?demo" className="block text-center text-xs text-nuit-600 underline">Essayer en mode démonstration</a>
          </form>
        ) : (
          <form className="carte space-y-4 p-6" onSubmit={valider}>
            <div>
              <label className="etiquette">Identifiant</label>
              <input className="champ" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoCapitalize="none" autoComplete="username" required autoFocus />
            </div>
            <div>
              <label className="etiquette">Mot de passe</label>
              <input className="champ" type="password" value={motdepasse} onChange={(e) => setMotdepasse(e.target.value)} autoComplete="current-password" required />
            </div>
            <Erreur erreur={erreur} />
            <button className="btn-principal w-full" disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Se connecter</button>
            {!urlApiFixe() && (
              <button type="button" onClick={() => setReglage(true)} className="mx-auto flex items-center gap-1 text-xs text-nuit-600/70 hover:text-nuit">
                <Settings className="h-3 w-3" />Serveur
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
