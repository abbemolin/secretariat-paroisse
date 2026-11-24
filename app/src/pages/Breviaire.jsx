import { useEffect, useRef } from 'react'
import { monterBreviaire } from '../liturgie/breviaire.js'
import '../liturgie/liturgie.css'

/** Bréviaire : 8 heures, latin/français, grégorien aux Vêpres, hors ligne 30 jours. */
export default function Breviaire() {
  const ref = useRef(null)
  useEffect(() => monterBreviaire(ref.current), [])
  return <div ref={ref} />
}
