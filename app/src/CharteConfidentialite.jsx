import { useState } from 'react'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { api } from './api.js'

/**
 * Charte de confidentialité de l'équipe : à accepter à la première connexion, puis chaque année.
 * Tant qu'elle n'est pas acceptée, le serveur ferme les pages qui contiennent des données personnelles.
 */
export default function CharteConfidentialite({ charte, onAcceptee, onDeconnecter }) {
  const [lu, setLu] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  async function accepter() {
    setEnvoi(true); setErreur('')
    try { onAcceptee(await api('charte.accepter')) } catch (e) { setErreur(e.message) } finally { setEnvoi(false) }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-nuit-800/60 backdrop-blur-sm sm:items-center">
      <div className="carte flex h-[100dvh] w-full flex-col rounded-none sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-xl">
        <div className="flex items-center gap-3 border-b border-nuit-100/70 px-5 py-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <ShieldCheck className="h-7 w-7 text-or" />
          <div><h2 className="text-xl font-semibold">Charte de confidentialité</h2>
            <p className="text-xs text-nuit-600/80">{charte.acceptee_le ? 'Renouvellement annuel' : 'À accepter avant d\'accéder aux données des paroissiens'}</p></div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-nuit-800">
          <p>L'appli contient des informations personnelles et souvent sensibles (sacrements, vie spirituelle, santé, coordonnées). Le RGPD et le secret pastoral nous obligent à les protéger. Responsable : <strong>{charte.responsable}</strong> ; contact pour les droits des personnes : <strong>{charte.contact}</strong>.</p>
          <p className="mt-3 font-semibold">En tant que membre de l'équipe :</p>
          <ol className="mt-1 list-decimal space-y-1.5 pl-5">{charte.texte.map((t, i) => <li key={i}>{t}</li>)}</ol>
          <p className="mt-3 text-xs text-nuit-600/80">Votre acceptation est notée (date) au journal. Elle vous sera redemandée dans un an.</p>
          <label className="mt-4 flex items-start gap-2 rounded-lg bg-or-50/70 p-3 font-medium"><input type="checkbox" className="mt-1" checked={lu} onChange={(e) => setLu(e.target.checked)} />J'ai lu cette charte et je m'engage à la respecter.</label>
          {erreur && <p className="mt-2 text-red-700">{erreur}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-nuit-100/70 px-5 py-3 safe-bottom">
          <button className="btn-clair" onClick={onDeconnecter}>Se déconnecter</button>
          <button className="btn-principal" disabled={!lu || envoi} onClick={accepter}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}J'accepte</button>
        </div>
      </div>
    </div>
  )
}
