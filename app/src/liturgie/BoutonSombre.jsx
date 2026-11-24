import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { basculerSombreLiturgie, estSombre } from '../affichage.js'

/** Bouton ☾ / ☀ de la tuile « Bible et bréviaire » (mode sombre de la tuile seule, sur cet appareil). */
export default function BoutonSombre({ className = 'btn-icone' }) {
  const [sombre, setSombre] = useState(estSombre)
  useEffect(() => {
    const f = () => setSombre(estSombre())
    window.addEventListener('theme-liturgie', f)
    return () => window.removeEventListener('theme-liturgie', f)
  }, [])
  const I = sombre ? Sun : Moon
  return <button type="button" className={className} onClick={basculerSombreLiturgie} aria-label={sombre ? 'Mode clair' : 'Mode sombre'} title={sombre ? 'Mode clair' : 'Mode sombre'}><I className="h-5 w-5" /></button>
}
