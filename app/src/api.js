// Appels au backend Apps Script.
import { demoApi } from './demo.js'

const CLE_URL = 'secretariat.apiUrl'
const CLE_TOKEN = 'secretariat.token'

export const estDemo = () => new URLSearchParams(location.search).has('demo') || localStorage.getItem(CLE_URL) === 'demo'
// Tolère un texte autour de l'adresse dans la variable GitHub (ex. « Valeur : https://… »)
const URL_BUILD = (String(import.meta.env.VITE_API_URL || '').match(/https:\/\/\S+\/exec/) || [''])[0]
export const urlApi = () => URL_BUILD || localStorage.getItem(CLE_URL) || ''
export const urlApiFixe = () => !!URL_BUILD
export function definirUrlApi(url) { localStorage.setItem(CLE_URL, url.trim()); kvEcrire('apiUrl', url.trim()) }
export const lireToken = () => localStorage.getItem(CLE_TOKEN)
export function ecrireToken(t) {
  if (t) localStorage.setItem(CLE_TOKEN, t); else { localStorage.removeItem(CLE_TOKEN); viderCache() }
  kvEcrire('token', t || '')
  kvEcrire('apiUrl', urlApi())
}

export class ErreurApi extends Error { constructor(code, message) { super(message); this.code = code } }

let surSessionExpiree = () => {}
export function quandSessionExpire(fn) { surSessionExpiree = fn }

// ─── Affichage instantané : dernière réponse connue des lectures, gardée sur l'appareil ───
const LECTURES = ['accueil.resume', 'dossiers.liste', 'dossiers.lire', 'cate.liste', 'cate.lire', 'cor.liste', 'extraits.liste', 'mail.liste', 'promotions.liste', 'agenda.evenements', 'documents.liste']
const CACHE = new Map()
const cleCache = (action, payload) => 'cache:' + action + ':' + JSON.stringify(payload || {})
/** Dernière réponse connue (ou undefined). */
export function enCache(action, payload) {
  const k = cleCache(action, payload)
  if (CACHE.has(k)) return CACHE.get(k)
  try { const v = sessionStorage.getItem(k) ?? localStorage.getItem(k); if (v) { const x = JSON.parse(v); CACHE.set(k, x); return x } } catch { /* ignore */ }
  return undefined
}
function memoriser(action, payload, data) {
  const k = cleCache(action, payload)
  CACHE.set(k, data)
  try {
    localStorage.setItem(k, JSON.stringify(data))
    const index = JSON.parse(localStorage.getItem('cache:index') || '[]').filter((x) => x !== k).concat([k])
    while (index.length > 60) localStorage.removeItem(index.shift())
    localStorage.setItem('cache:index', JSON.stringify(index))
  } catch { /* stockage plein : tant pis */ }
}
export function viderCache() {
  CACHE.clear()
  try { JSON.parse(localStorage.getItem('cache:index') || '[]').forEach((k) => localStorage.removeItem(k)); localStorage.removeItem('cache:index') } catch { /* ignore */ }
}

export async function api(action, payload = {}) {
  const data = await appel(action, payload)
  if (LECTURES.includes(action)) memoriser(action, payload, data)
  return data
}

async function appel(action, payload) {
  if (estDemo()) return demoApi(action, payload)
  const url = urlApi()
  if (!url) throw new ErreurApi('CONFIG', "L'adresse du serveur n'est pas configurée.")
  let rep
  try {
    // text/plain évite la requête préalable CORS, que Apps Script ne gère pas.
    rep = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: lireToken(), payload }), redirect: 'follow' })
  } catch {
    throw new ErreurApi('RESEAU', 'Pas de connexion au serveur. Vérifiez internet.')
  }
  let json
  try { json = await rep.json() } catch { throw new ErreurApi('REPONSE', 'Réponse inattendue du serveur.') }
  if (!json.ok) {
    if (json.code === 'SESSION') { ecrireToken(null); surSessionExpiree() }
    throw new ErreurApi(json.code, json.message)
  }
  return json.data
}

// ─── Petit stockage IndexedDB partagé avec le service worker (notifications) ───
function kv() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('secretariat', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('kv')
    r.onsuccess = () => ok(r.result)
    r.onerror = () => ko(r.error)
  })
}
export async function kvEcrire(cle, valeur) {
  try { const db = await kv(); db.transaction('kv', 'readwrite').objectStore('kv').put(valeur, cle) } catch { /* ignore */ }
}

// ─── Notifications sur ce téléphone / cet ordinateur ───
const versOctets = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}
export const pushPossible = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export async function abonnementActuel() {
  if (!pushPossible()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}
export async function activerPush() {
  if (!pushPossible()) throw new Error("Ce navigateur ne gère pas les notifications. Sur iPhone : installez d'abord l'appli sur l'écran d'accueil.")
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications refusées. Autorisez-les dans les réglages du navigateur.')
  const cle = await api('push.cle')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(cle) })
  await api('push.abonner', { endpoint: sub.endpoint, appareil: navigator.userAgent })
  kvEcrire('token', lireToken()); kvEcrire('apiUrl', urlApi())
}
export async function desactiverPush() {
  const sub = await abonnementActuel()
  if (sub) { await api('push.desabonner', { endpoint: sub.endpoint }); await sub.unsubscribe() }
}

// ─── Fichiers ───
export function fichierEnBase64(fichier) {
  return new Promise((ok, ko) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result).split(',')[1])
    r.onerror = ko
    r.readAsDataURL(fichier)
  })
}
export function telechargerBase64({ nom, type, base64 }) {
  const bin = atob(base64)
  const octets = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([octets], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = nom; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Vignette JPEG (240 px) d'une photo, réduite dans le navigateur ; '' si l'image ne peut pas être lue (HEIC…). */
export function vignetteImage(fichier, taille = 240) {
  return new Promise((ok) => {
    if (!/^image\//.test(fichier?.type || '')) return ok('')
    const url = URL.createObjectURL(fichier), img = new Image()
    img.onload = () => {
      try {
        const k = Math.min(1, taille / Math.max(img.width, img.height)), c = document.createElement('canvas')
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        ok(c.toDataURL('image/jpeg', 0.8))
      } catch { ok('') } finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); ok('') }
    img.src = url
  })
}
