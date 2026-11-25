import { Link } from 'react-router-dom'
import { PowerOff } from 'lucide-react'
import { useApp } from './App.jsx'

/** Bandeau : cette fonction de l'app des paroissiens est désactivée (Réglages → App des paroissiens). */
export default function FonctionFermee({ cle, texte }) {
  const { fonctions, utilisateur } = useApp()
  if (!fonctions || fonctions[cle]) return null
  const reglable = utilisateur.role === 'admin' || utilisateur.role === 'cure'
  return (
    <div className="mb-4 flex gap-3 rounded-lg border border-nuit-100 bg-nuit-50/70 p-3 text-sm text-nuit-700">
      <PowerOff className="mt-0.5 h-4 w-4 shrink-0 text-nuit-600" />
      <p>{texte} Vous pouvez tout préparer ici ; les paroissiens ne voient rien tant que ce n'est pas activé
        {reglable ? <> dans <Link className="text-or-600 underline" to="/reglages?onglet=app">Réglages → App des paroissiens</Link>.</> : ' (Réglages → App des paroissiens, par le curé).'}</p>
    </div>
  )
}
