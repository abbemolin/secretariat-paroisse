// Réglages → Liturgie : clé GitHub pour publier le calendrier propre dans le dépôt de l'AppMesse.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '../api.js'
import { Chargement, Erreur, useCharger, useNotif } from '../ui.jsx'

export default function LiturgieReglages() {
  const notifier = useNotif()
  const { data, chargement, erreur } = useCharger(() => api('liturgie.reglages'), [])
  const [f, setF] = useState(null)
  const [cle, setCle] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [test, setTest] = useState(null)
  useEffect(() => { if (data) setF(data) }, [data])
  if (chargement || !f) return <><Erreur erreur={erreur} />{!erreur && <Chargement />}</>
  async function enregistrer(effacer) {
    setEnvoi(true)
    try { setF(await api('liturgie.reglagesEcrire', effacer ? { github_cle_effacer: true } : { github_cle: cle })); setCle(''); notifier('Réglages enregistrés') }
    catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  async function tester() {
    setTest('…')
    try { setTest((await api('liturgie.tester')).github) } catch (e) { setTest('✗ ' + e.message) }
  }
  return (
    <div className="max-w-3xl space-y-5">
      <div className="carte space-y-3 p-5">
        <h2 className="text-xl font-semibold">Calendrier propre (GitHub)</h2>
        <p className="text-sm text-nuit-600">Le calendrier propre est enregistré dans le dépôt de l'AppMesse ({f.depot}), qui recalcule ensuite le bréviaire et la messe des jours concernés.</p>
        <div><label className="etiquette" htmlFor="rl-gh">Clé GitHub</label>
          <input id="rl-gh" className="champ" type="password" autoComplete="new-password" placeholder={f.github_ok ? '•••••••• (enregistrée)' : 'github_pat_…'} value={cle} onChange={(e) => setCle(e.target.value)} />
          <p className="mt-1 text-xs text-nuit-600/70">GitHub → Settings → Developer settings → Fine-grained tokens : accès au seul dépôt {f.depot}, droits « Contents » en lecture et écriture et « Actions » en lecture. Elle n'est jamais réaffichée.</p></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-principal" disabled={envoi || !cle} onClick={() => enregistrer(false)}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
          <button className="btn-clair" onClick={tester} disabled={!f.github_ok}>Tester</button>
          {f.github_ok && <button className="btn-danger" onClick={() => enregistrer(true)} disabled={envoi}>Effacer la clé</button>}
        </div>
        {test && <p className={`text-sm ${test.startsWith('✓') ? 'text-emerald-700' : test.startsWith('✗') ? 'text-red-700' : ''}`}>{test}</p>}
      </div>
    </div>
  )
}
