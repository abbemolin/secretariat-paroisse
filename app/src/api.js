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
  if (estDemo()) return   // l'aperçu ne touche pas à la connexion réelle
  if (t) localStorage.setItem(CLE_TOKEN, t); else { localStorage.removeItem(CLE_TOKEN); viderCache() }
  kvEcrire('token', t || '')
  kvEcrire('apiUrl', urlApi())
}

export class ErreurApi extends Error { constructor(code, message) { super(message); this.code = code } }

let surSessionExpiree = () => {}
export function quandSessionExpire(fn) { surSessionExpiree = fn }

// ─── Affichage instantané et hors connexion : dernière réponse connue des lectures, gardée sur l'appareil ───
// (IndexedDB « secretariat-cache », chargée en mémoire au démarrage : les pages la lisent sans attendre)
const LECTURES = ['journee.resume', 'intentions.liste', 'intentions.agenda', 'app.init', 'accueil.resume', 'dossiers.liste', 'dossiers.lire', 'cate.liste', 'cate.lire',
  'cate.reglages', 'cor.liste', 'cor.reglages', 'extraits.liste', 'extraits.lire', 'retraites.liste', 'retraites.lire', 'mail.liste', 'promotions.liste', 'agenda.evenements',
  'documents.liste', 'annonces.liste', 'newsletter.semaine', 'newsletter.lire', 'textes.liste', 'livres.liste', 'catechumenat.reglages', 'notifications.liste']
const CACHE = new Map()
const cleCache = (action, payload) => 'cache:' + action + ':' + JSON.stringify(payload || {})
function baseCache() {
  if (!baseCache.p) baseCache.p = new Promise((ok, ko) => {
    const r = indexedDB.open('secretariat-cache', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('cache')
    r.onsuccess = () => ok(r.result)
    r.onerror = () => ko(r.error)
  })
  return baseCache.p
}
/** Au démarrage (avant le premier affichage) : tout le cache en mémoire ; reprend l'ancien cache du navigateur. */
export async function chargerCacheLocal() {
  if (estDemo()) return
  try {
    const db = await baseCache()
    await new Promise((ok) => {
      const s = db.transaction('cache').objectStore('cache'), r = s.openCursor()
      r.onsuccess = () => { const c = r.result; if (c) { CACHE.set(c.key, c.value); c.continue() } else ok() }
      r.onerror = () => ok()
    })
    const anciens = JSON.parse(localStorage.getItem('cache:index') || '[]')
    if (anciens.length) {
      const ecr = db.transaction('cache', 'readwrite').objectStore('cache')
      anciens.forEach((k) => { try { const v = JSON.parse(localStorage.getItem(k)); if (v != null && !CACHE.has(k)) { CACHE.set(k, v); ecr.put(v, k) } } catch { /* ignore */ } localStorage.removeItem(k) })
      localStorage.removeItem('cache:index')
    }
  } catch { /* navigation privée : cache en mémoire seulement */ }
}
/** Dernière réponse connue (ou undefined). */
export function enCache(action, payload) {
  if (estDemo()) return undefined   // l'aperçu ne lit ni n'écrit le cache de la vraie session
  return CACHE.get(cleCache(action, payload))
}
/** Garde une ou plusieurs réponses : memoriser(action, payload, data) ou memoriser([[action, payload, data], …]). */
export function memoriser(action, payload, data) {
  if (estDemo()) return
  const l = Array.isArray(action) ? action : [[action, payload, data]]
  l.forEach(([a, p, d]) => CACHE.set(cleCache(a, p), d))
  baseCache().then((db) => { const s = db.transaction('cache', 'readwrite').objectStore('cache'); l.forEach(([a, p, d]) => s.put(d, cleCache(a, p))) }).catch(() => {})
}
export function viderCache() {
  CACHE.clear()
  baseCache().then((db) => db.transaction('cache', 'readwrite').objectStore('cache').clear()).catch(() => {})
  try { localStorage.removeItem('horsligne.le') } catch { /* ignore */ }
}

// ─── État du réseau (pastille « hors connexion ») ───
let horsConnexion = typeof navigator !== 'undefined' && navigator.onLine === false
const ecouteursReseau = new Set()
function etatReseau(hors) { if (hors !== horsConnexion) { horsConnexion = hors; ecouteursReseau.forEach((f) => f(hors)) } }
/** fn(horsConnexion) à chaque changement ; renvoie la fonction pour se désabonner. */
export function suivreReseau(fn) { ecouteursReseau.add(fn); fn(horsConnexion); return () => ecouteursReseau.delete(fn) }
if (typeof window !== 'undefined') window.addEventListener('offline', () => etatReseau(true))

/** Sans connexion, une lecture sans copie exacte peut se déduire d'une copie plus large (agenda des mois préparés). */
function repli(action, payload) {
  if (action === 'agenda.evenements') {
    const tout = enCache('agenda.horsligne', {})
    if (!tout || !(tout.debut <= payload.debut && tout.fin >= payload.fin)) return undefined
    return tout.evenements.filter((e) => e.debut < payload.fin && e.fin > payload.debut)
  }
  return undefined
}

export async function api(action, payload = {}) {
  let data
  try { data = await appel(action, payload); etatReseau(false) }
  catch (e) {
    if (e.code === 'RESEAU') {
      etatReseau(true)
      if (action in EN_FILE) return mettreEnFile(action, payload)
      if (LECTURES.includes(action)) { const c = enCache(action, payload) ?? repli(action, payload); if (c !== undefined) return c }
    }
    throw e
  }
  if (LECTURES.includes(action)) memoriser(action, payload, data)
  if (typeof EN_FILE[action] === 'string') memoriser(EN_FILE[action], { id: payload.id }, data)
  return data
}

// ─── Hors connexion : les enregistrements sont gardés sur l'appareil et renvoyés au retour du réseau ───
// action → lecture correspondante (null : gardée sans mise à jour du cache ; fonction : met elle-même les copies à jour)
const EN_FILE = {
  'dossiers.modifier': 'dossiers.lire', 'cate.modifier': 'cate.lire', 'intentions.celebrer': null, 'intentions.ecrire': null,
  'agenda.creer': majAgendaLocal, 'agenda.modifier': majAgendaLocal, 'annonces.ecrire': majAnnoncesLocal
}
/** Événement créé ou modifié hors connexion : visible tout de suite dans l'agenda gardé. */
function majAgendaLocal(p) {
  const e = { lieu: '', description: '', ...p, _enAttente: true }
  const tout = enCache('agenda.horsligne', {})
  if (tout) memoriser('agenda.horsligne', {}, { ...tout, evenements: [...tout.evenements.filter((x) => x.id !== e.id), e].sort((a, b) => a.debut.localeCompare(b.debut)) })
  for (const [k, v] of CACHE) {
    if (!k.startsWith('cache:agenda.evenements:') || !Array.isArray(v)) continue
    const b = JSON.parse(k.slice('cache:agenda.evenements:'.length))
    const l = v.filter((x) => x.id !== e.id)
    if (e.debut < b.fin && e.fin > b.debut) l.push(e)
    memoriser('agenda.evenements', b, l.sort((a, c) => a.debut.localeCompare(c.debut)))
  }
  return e
}
/** Annonce créée ou modifiée hors connexion : visible tout de suite dans la liste gardée. */
function majAnnoncesLocal(p) {
  const l = enCache('annonces.liste', {}) || []
  const avant = l.find((x) => x.id === p.id)
  const a = { ...(avant || { created_at: new Date().toISOString(), ordre: null }), ...p, _enAttente: true }
  memoriser('annonces.liste', {}, avant ? l.map((x) => (x.id === a.id ? a : x)) : [a, ...l])
  return a
}
const CLE_FILE = 'file-attente'
const ecouteursFile = new Set()
export const fileAttente = () => { try { return JSON.parse(localStorage.getItem(CLE_FILE) || '[]') } catch { return [] } }
function ecrireFile(l) { try { localStorage.setItem(CLE_FILE, JSON.stringify(l)) } catch { /* plein */ } ecouteursFile.forEach((f) => f(l.length)) }
/** fn(nombre) appelé à chaque changement de la file ; renvoie la fonction pour se désabonner. */
export function suivreFile(fn) { ecouteursFile.add(fn); fn(fileAttente().length); return () => ecouteursFile.delete(fn) }
const estLocal = (id) => /^local-/.test(String(id || ''))
function mettreEnFile(action, payload) {
  const l = fileAttente()
  // Création hors connexion : identifiant provisoire (une modification ultérieure s'ajoute à la création)
  if ((action === 'agenda.creer' || action === 'annonces.ecrire') && payload.id === undefined) payload = { ...payload, id: 'local-' + Date.now() }
  if (action === 'agenda.modifier' && estLocal(payload.id)) action = 'agenda.creer'
  const i = payload.id === undefined ? -1 : l.findIndex((x) => x.action === action && x.payload.id === payload.id)
  if (i > -1) l[i] = { action, payload: { ...l[i].payload, ...payload }, t: Date.now() }   // une seule entrée par fiche : la plus récente
  else l.push({ action, payload, t: Date.now() })
  ecrireFile(l)
  const lecture = EN_FILE[action]
  if (typeof lecture === 'function') return lecture(payload)
  if (!lecture) return { ...payload, _enAttente: true }
  const res = { ...(enCache(lecture, { id: payload.id }) || {}), ...payload, _enAttente: true }
  memoriser(lecture, { id: payload.id }, res)
  return res
}
let envoiEnCours = false
/** Renvoie les enregistrements en attente, dans l'ordre. */
export async function viderFile() {
  if (envoiEnCours || estDemo() || !lireToken()) return
  envoiEnCours = true
  try {
    let l = fileAttente()
    while (l.length) {
      const x = l[0]
      try {
        const pl = estLocal(x.payload.id) ? (({ id, ...r }) => r)(x.payload) : x.payload   // création : sans l'identifiant provisoire
        const data = await appel(x.action, pl)
        etatReseau(false)
        if (typeof EN_FILE[x.action] === 'string') memoriser(EN_FILE[x.action], { id: x.payload.id }, data)
      } catch (e) {
        if (e.code === 'RESEAU') { etatReseau(true); break }   // toujours hors connexion : on réessaiera
        window.dispatchEvent(new CustomEvent('file-erreur', { detail: e.message }))   // refus du serveur : abandonné
      }
      l = fileAttente().filter((y) => y.t !== x.t)
      ecrireFile(l)
    }
  } finally { envoiEnCours = false }
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => viderFile())
  setInterval(() => { if (fileAttente().length) viderFile() }, 30000)
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
