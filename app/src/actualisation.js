// Actualisation automatique des données et mise à jour automatique de l'appli.
// - Les pages abonnées (useCharger, dossier, courrier…) se rechargent sans bruit toutes les minutes
//   et au retour sur l'onglet, sauf pendant une saisie ou une fenêtre ouverte.
// - Quand une nouvelle version de l'appli est publiée, la page se recharge d'elle-même dès qu'on
//   n'est plus en train de saisir (et qu'aucune modification n'attend d'être envoyée).
import { useEffect, useRef } from 'react'

const ABONNES = new Set()
let modales = 0
let dernierGeste = Date.now()
export const PERIODE = 60000

export function modaleOuverte(n) { modales = Math.max(0, modales + n) }
/** En train de saisir, ou une fenêtre (modale) est ouverte : on ne touche à rien. */
export function occupe() {
  const a = typeof document !== 'undefined' ? document.activeElement : null
  return modales > 0 || !!(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable))
}
export function actualiserTout(forcer) {
  if (document.visibilityState !== 'visible' || !navigator.onLine) return
  if (!forcer && occupe()) return
  ABONNES.forEach((f) => { try { f() } catch { /* ignore */ } })
}
/** fn est appelée à chaque actualisation (toutes les minutes, et au retour sur l'onglet). */
export function useActualisation(fn) {
  const r = useRef(fn)
  r.current = fn
  useEffect(() => {
    const f = () => r.current && r.current()
    ABONNES.add(f)
    return () => { ABONNES.delete(f) }
  }, [])
}

let demarre = false
/** À appeler une fois (App.jsx). attente() : nombre de modifications pas encore envoyées. */
export function demarrerActualisation({ attente = () => 0, demo = false } = {}) {
  if (demarre || typeof window === 'undefined') return
  demarre = true
  let cachee = 0
  const swPossible = 'serviceWorker' in navigator   // aussi en démonstration : l'aperçu doit montrer la dernière version
  const verifierVersion = () => { if (swPossible) navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {}) }
  setInterval(() => actualiserTout(false), PERIODE)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { cachee = Date.now(); return }
    if (Date.now() - cachee > 5000) actualiserTout(false)
    verifierVersion()
  })
  ;['keydown', 'pointerdown', 'input'].forEach((ev) => window.addEventListener(ev, () => { dernierGeste = Date.now() }, true))

  // Nouvelle version : le service worker prend la main (skipWaiting + clients.claim) → rechargement au calme
  if (!swPossible) return
  const avaitUnControleur = !!navigator.serviceWorker.controller
  let aRecharger = false
  const essayer = () => {
    if (!aRecharger) return
    if (occupe() || attente() > 0 || Date.now() - dernierGeste < 30000) { setTimeout(essayer, 15000); return }
    location.reload()
  }
  // Une nouvelle version est prête : bandeau « Mettre à jour » (le rechargement se fait aussi de lui-même au calme)
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (avaitUnControleur) { aRecharger = true; window.dispatchEvent(new Event('nouvelle-version')); essayer() } })
  setInterval(verifierVersion, 10 * 60000)
}
