import { useState } from 'react'
import { Eye, ExternalLink } from 'lucide-react'
import { Modale } from '../ui.jsx'

/** Aperçus « Voir comme… » : personnages fictifs, lecture seule (rien n'est enregistré ni envoyé). Réservé aux administrateurs. */
const APP = 'https://app.croix-glorieuse.org/'
const base = () => location.origin + location.pathname
export const APERCUS = [
  { cle: 'catechumene', titre: 'Un catéchumène', texte: "Son app « La Croix glorieuse » : accueil, textes, Bible, calendrier, mon dossier", url: () => APP + '?apercu=catechumene' },
  { cle: 'neophyte', titre: 'Un néophyte', texte: 'La même app après le baptême', url: () => APP + '?apercu=neophyte' },
  { cle: 'chef', titre: 'Un chef de fraternité', texte: 'La page du chef : membres, rencontres, messages, inviter', url: () => base() + 'fraternite/?apercu=1' },
  { cle: 'parrain', titre: 'Un parrain ou une marraine', texte: 'Sa page : certificat à déposer, dates importantes', url: () => APP + 'parrain/?apercu=1' },
  { cle: 'secretaire', titre: 'Une secrétaire', texte: "L'appli du secrétariat avec les droits d'une secrétaire", url: () => base() + '?demo&role=secretaire#/' },
  { cle: 'cure', titre: 'Un prêtre', texte: "L'appli du secrétariat avec les droits d'un prêtre (curé / vicaire)", url: () => base() + '?demo&role=cure#/' },
  { cle: 'diacre', titre: 'Un diacre (accès ajustés)', texte: 'Exemple : seulement ses mails, mariages et obsèques en lecture, sans signature', url: () => base() + '?demo&role=diacre#/' }
]
export default function VoirComme({ seulement, libelle = 'Voir comme…', className = 'btn-clair' }) {
  const [ouvert, setOuvert] = useState(false)
  const liste = APERCUS.filter((a) => !seulement || seulement.includes(a.cle))
  if (liste.length === 1) return <a className={className} href={liste[0].url()} target="_blank" rel="noopener"><Eye className="h-4 w-4" />{libelle}</a>
  return <>
    <button className={className} onClick={() => setOuvert(true)}><Eye className="h-4 w-4" />{libelle}</button>
    {ouvert && <Modale titre="Voir comme…" onFermer={() => setOuvert(false)} pied={<button className="btn-clair" onClick={() => setOuvert(false)}>Fermer</button>}>
      <p className="mb-3 text-sm text-nuit-600">Un personnage fictif, avec des données inventées : vous voyez exactement les écrans de la personne. Rien n'est enregistré ni envoyé. S'ouvre dans un nouvel onglet.</p>
      <ul className="divide-y divide-nuit-100">
        {liste.map((a) => <li key={a.cle}><a href={a.url()} target="_blank" rel="noopener" className="flex items-center gap-3 py-2.5 hover:text-or-600" onClick={() => setOuvert(false)}>
          <span className="flex-1"><span className="font-medium">{a.titre}</span><span className="block text-xs text-nuit-600/70">{a.texte}</span></span><ExternalLink className="h-4 w-4 text-nuit-600/50" /></a></li>)}
      </ul>
    </Modale>}
  </>
}
