import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { chargerCalendrier, jourLiturgique, titreFrancais } from '../liturgie/calendrier.js'
import { chargerMesse, nomMesse, piecesMesse } from '../liturgie/messe.js'
import { isoJour, prechargerLiturgie } from '../liturgie/source.js'
import '../liturgie/liturgie.css'

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

/** Messe du jour : le propre de la Messe (latin / français), comme l'AppMesse ; les lectures ouvrent la Bible. */
export default function MesseDuJour() {
  const [params, setParams] = useSearchParams()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : isoJour(new Date())
  const [lang, setLang] = useState('la')
  const [etat, setEtat] = useState({ charge: true })
  const [active, setActive] = useState(0)
  const [, setCal] = useState(0)

  useEffect(() => { chargerCalendrier().then(() => setCal((n) => n + 1)); prechargerLiturgie() }, [])
  useEffect(() => {
    let annule = false
    setEtat({ charge: true })
    chargerMesse(date).then((m) => { if (!annule) { setEtat({ messe: m }); setActive(m ? m.active : 0) } })
      .catch(() => !annule && setEtat({ horsLigne: true }))
    return () => { annule = true }
  }, [date])

  const [y, mo, d] = date.split('-').map(Number)
  const jour = new Date(y, mo - 1, d)
  const ordo = jourLiturgique(y, mo, d)
  const messe = etat.messe
  const m = messe && messe.messes[active]
  const pieces = useMemo(() => (m ? piecesMesse(m, lang === 'fr') : []), [m, lang])
  const changerJour = (n) => { const j = new Date(y, mo - 1, d + n); setParams({ date: isoJour(j) }, { replace: true }) }

  useEffect(() => {
    const k = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return
      if (e.key === 'ArrowLeft') changerJour(-1)
      if (e.key === 'ArrowRight') changerJour(1)
    }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  })

  return (
    <div className="liturgie brev">
      <div className="brev-hero">
        <button type="button" className="brev-nav-jour brev-nav-jour-left" onClick={() => changerJour(-1)} aria-label="Jour précédent"><span className="brev-nav-arrow">‹</span></button>
        <button type="button" className="brev-nav-jour brev-nav-jour-right" onClick={() => changerJour(1)} aria-label="Jour suivant"><span className="brev-nav-arrow">›</span></button>
        <div className="brev-hero-body">
          <span className="brev-hero-fete">{m ? titreFrancais(m.titre_fr || m.titre) : (ordo && ordo.fete) || 'Messe du jour'}</span>
          <span className="brev-hero-date">{JOURS[jour.getDay()]} {d} {MOIS[mo - 1]} {y}{ordo?.couleur ? ' · ' + ordo.couleur.toLowerCase() : ''}</span>
        </div>
      </div>
      <div className="brev-toolbar" style={{ flexWrap: 'wrap' }}>
        <div className="lang-toggle">
          <button type="button" className={`lang-btn ${lang === 'la' ? 'active' : ''}`} onClick={() => setLang('la')}>Latin</button>
          <button type="button" className={`lang-btn ${lang === 'fr' ? 'active' : ''}`} onClick={() => setLang('fr')}>Français</button>
        </div>
        {messe && messe.messes.length > 1 && (
          <div className="lang-toggle">
            {messe.messes.map((x, i) => <button key={i} type="button" className={`lang-btn ${i === active ? 'active' : ''}`} onClick={() => setActive(i)}>{nomMesse(messe.messes, i)}</button>)}
          </div>
        )}
        <div className="brev-toolbar-filler" />
        {date !== isoJour(new Date()) && <button type="button" className="taille-btn" onClick={() => setParams({}, { replace: true })}>Aujourd’hui</button>}
      </div>
      <div className="brev-content">
        {etat.charge ? <div className="brev-loading">Chargement…</div>
          : etat.horsLigne ? <div className="brev-empty">Propre indisponible sans connexion pour ce jour.</div>
            : !m ? <div className="brev-empty">Propre non disponible pour ce jour.</div>
              : <div className="space-y-5">{pieces.map((h, i) => <div key={i} className="messe-piece" dangerouslySetInnerHTML={{ __html: h }} />)}</div>}
      </div>
    </div>
  )
}
