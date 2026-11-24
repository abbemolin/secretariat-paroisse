import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { monterBreviaire } from '../liturgie/breviaire.js'
import '../liturgie/liturgie.css'

/** Bréviaire : 8 heures, latin/français, grégorien aux Vêpres, hors ligne 30 jours. */
export default function Breviaire() {
  const ref = useRef(null)
  const [params] = useSearchParams()
  const date = params.get('date') || ''
  useEffect(() => monterBreviaire(ref.current, { date }), [date])
  return <div ref={ref} />
}
