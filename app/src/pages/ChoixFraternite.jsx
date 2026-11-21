import { useEffect, useState } from 'react'
import { Check, UserMinus } from 'lucide-react'
import { api } from '../api.js'
import { Chargement, Erreur, Modale } from '../ui.jsx'

/**
 * Choisir la fraternité Cor Unum (année en cours) où placer une ou plusieurs personnes.
 * La fiche Cor Unum est créée et reliée au dossier si elle n'existe pas encore ; sinon elle est déplacée.
 */
export default function ChoixFraternite({ titre, sousTitre, actuelle, retirer, onFermer, onChoisir }) {
  const [data, setData] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [occupe, setOccupe] = useState(false)
  useEffect(() => { api('cor.equipesCourantes', {}).then(setData).catch(setErreur) }, [])
  async function choisir(id) {
    setOccupe(true)
    try { await onChoisir(id) } finally { setOccupe(false) }
  }
  return (
    <Modale titre={titre} onFermer={onFermer} pied={<button className="btn-clair" onClick={onFermer}>Fermer</button>}>
      <Erreur erreur={erreur} />
      {!data ? <Chargement /> : <>
        <p className="mb-3 text-sm text-nuit-600">{sousTitre} Fraternités {data.annee}.</p>
        {!data.equipes.length ? <p className="text-sm text-nuit-600/70">Aucune fraternité pour {data.annee}. Créez-les d'abord dans Cor Unum.</p> : (
          <ul className="max-h-[55vh] divide-y divide-nuit-100 overflow-y-auto">
            {data.equipes.map((e) => (
              <li key={e.id}><button className="flex w-full items-center gap-3 py-2.5 text-left text-sm hover:bg-nuit-50/60 disabled:opacity-50" disabled={occupe || e.nom === actuelle} onClick={() => choisir(e.id)}>
                <span className="flex-1"><span className="font-semibold">{e.nom}</span>
                  <span className="block text-xs text-nuit-600/70">{e.chefs.length ? `chef : ${e.chefs.join(', ')}` : 'pas encore de chef'} · {e.membres} membre{e.membres > 1 ? 's' : ''}</span></span>
                {e.nom === actuelle ? <span className="flex items-center gap-1 text-xs text-emerald-700"><Check className="h-3.5 w-3.5" />actuelle</span> : <span className="text-xs text-or-600">Choisir</span>}
              </button></li>
            ))}
          </ul>
        )}
        {retirer && <button className="btn-clair mt-3 text-sm" disabled={occupe} onClick={() => choisir('')}><UserMinus className="h-4 w-4" />Retirer de sa fraternité</button>}
      </>}
    </Modale>
  )
}
