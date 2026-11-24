// Bible Crampon (base publique de l'AppMesse) et commentaires des Évangiles (servis par le serveur, usage privé).
// Comme l'AppMesse : toute la Bible et les commentaires sont gardés sur l'appareil (IndexedDB) pour la lecture hors ligne.
import { api, estDemo } from '../api.js'

const URL_SB = 'https://pmeaimfcwtykhqtueomd.supabase.co/rest/v1/'
const CLE_SB = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZWFpbWZjd3R5a2hxdHVlb21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MzA4MzIsImV4cCI6MjA4MzMwNjgzMn0.X91Usnq8WtZYuY40UFIo7Xl8P1O46LKqe1GvJ7RIWYE'

export const CANON = {
  AT: {
    Pentateuque: ['Genèse', 'Exode', 'Lévitique', 'Nombres', 'Deutéronome'],
    Historiques: ['Josué', 'Juges', 'Ruth', '1 Samuel', '2 Samuel', '1 Rois', '2 Rois', '1 Chroniques', '2 Chroniques', 'Esdras', 'Néhémie',
      'Tobie', 'Judith', 'Esther', '1 Macchabées', '2 Macchabées'],
    Sapientiaux: ['Job', 'Psaumes', 'Proverbes', 'Ecclésiaste', 'Cantique des Cantiques', 'Sagesse', 'Ecclésiastique'],
    Prophètes: ['Isaïe', 'Jérémie', 'Lamentations', 'Baruch', 'Ézéchiel', 'Daniel', 'Osée', 'Joël', 'Amos', 'Abdias', 'Jonas', 'Michée', 'Nahum',
      'Habacuc', 'Sophonie', 'Aggée', 'Zacharie', 'Malachie']
  },
  NT: {
    'Évangiles': ['Matthieu', 'Marc', 'Luc', 'Jean'],
    'Actes et Paul': ['Actes', 'Romains', '1 Corinthiens', '2 Corinthiens', 'Galates', 'Éphésiens', 'Philippiens', 'Colossiens',
      '1 Thessaloniciens', '2 Thessaloniciens', '1 Timothée', '2 Timothée', 'Tite', 'Philémon', 'Hébreux'],
    'Épîtres catholiques': ['Jacques', '1 Pierre', '2 Pierre', '1 Jean', '2 Jean', '3 Jean', 'Jude'],
    Apocalypse: ['Apocalypse']
  }
}
export const LIVRES = [...Object.values(CANON.AT), ...Object.values(CANON.NT)].flat()
export const estAT = (livre) => Object.values(CANON.AT).flat().includes(livre)
export const ABREGE_COMMENTAIRE = { Matthieu: 'Mt', Marc: 'Mc', Luc: 'Lc', Jean: 'Jn' }

const sansAccent = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Abréviations françaises (recherche) et latines (références de la Messe et du bréviaire, Vulgate)
const ABREVIATIONS = {
  gn: 'Genèse', gen: 'Genèse', ex: 'Exode', exod: 'Exode', lv: 'Lévitique', lev: 'Lévitique', nb: 'Nombres', num: 'Nombres', dt: 'Deutéronome', deut: 'Deutéronome',
  jos: 'Josué', ios: 'Josué', jg: 'Juges', jdc: 'Juges', iudic: 'Juges', judic: 'Juges', rt: 'Ruth',
  '1s': '1 Samuel', '2s': '2 Samuel', '1sm': '1 Samuel', '2sm': '2 Samuel', '1r': '1 Rois', '2r': '2 Rois',
  '1reg': '1 Samuel', '2reg': '2 Samuel', '3reg': '1 Rois', '4reg': '2 Rois', '1ch': '1 Chroniques', '2ch': '2 Chroniques', '1par': '1 Chroniques', '2par': '2 Chroniques',
  esd: 'Esdras', esdr: 'Esdras', ne: 'Néhémie', neh: 'Néhémie', tb: 'Tobie', tob: 'Tobie', jdt: 'Judith', iudith: 'Judith', judith: 'Judith', est: 'Esther', esth: 'Esther',
  '1m': '1 Macchabées', '2m': '2 Macchabées', '1mach': '1 Macchabées', '2mach': '2 Macchabées', '1macc': '1 Macchabées', '2macc': '2 Macchabées',
  jb: 'Job', ps: 'Psaumes', pr: 'Proverbes', prov: 'Proverbes', qo: 'Ecclésiaste', eccl: 'Ecclésiaste', eccle: 'Ecclésiaste',
  ct: 'Cantique des Cantiques', cant: 'Cantique des Cantiques', cantique: 'Cantique des Cantiques', sg: 'Sagesse', sap: 'Sagesse',
  si: 'Ecclésiastique', sir: 'Ecclésiastique', eccli: 'Ecclésiastique', siracide: 'Ecclésiastique',
  is: 'Isaïe', isa: 'Isaïe', jr: 'Jérémie', jer: 'Jérémie', ier: 'Jérémie', lm: 'Lamentations', lam: 'Lamentations', ba: 'Baruch', bar: 'Baruch',
  ez: 'Ézéchiel', ezech: 'Ézéchiel', dn: 'Daniel', dan: 'Daniel', os: 'Osée', osee: 'Osée', jl: 'Joël', joel: 'Joël', ioel: 'Joël', am: 'Amos',
  ab: 'Abdias', abd: 'Abdias', jon: 'Jonas', jonae: 'Jonas', ionae: 'Jonas', mi: 'Michée', mich: 'Michée', na: 'Nahum', nah: 'Nahum', nahoum: 'Nahum',
  ha: 'Habacuc', hab: 'Habacuc', so: 'Sophonie', soph: 'Sophonie', ag: 'Aggée', agg: 'Aggée', za: 'Zacharie', zach: 'Zacharie', ml: 'Malachie', mal: 'Malachie', malach: 'Malachie',
  mt: 'Matthieu', matt: 'Matthieu', mc: 'Marc', marc: 'Marc', lc: 'Luc', luc: 'Luc', jn: 'Jean', joann: 'Jean', ioann: 'Jean', joannes: 'Jean', ioannes: 'Jean', joh: 'Jean',
  ac: 'Actes', act: 'Actes', acts: 'Actes', rm: 'Romains', rom: 'Romains', '1co': '1 Corinthiens', '2co': '2 Corinthiens', '1cor': '1 Corinthiens', '2cor': '2 Corinthiens',
  ga: 'Galates', gal: 'Galates', ep: 'Éphésiens', eph: 'Éphésiens', ephes: 'Éphésiens', ph: 'Philippiens', phil: 'Philippiens', philipp: 'Philippiens', col: 'Colossiens',
  '1th': '1 Thessaloniciens', '2th': '2 Thessaloniciens', '1thess': '1 Thessaloniciens', '2thess': '2 Thessaloniciens',
  '1tm': '1 Timothée', '2tm': '2 Timothée', '1tim': '1 Timothée', '2tim': '2 Timothée', tt: 'Tite', tit: 'Tite', phm: 'Philémon', philem: 'Philémon',
  he: 'Hébreux', hb: 'Hébreux', heb: 'Hébreux', hebr: 'Hébreux', jc: 'Jacques', ic: 'Jacques', jac: 'Jacques', iac: 'Jacques', jas: 'Jacques', ias: 'Jacques', ja: 'Jacques',
  '1p': '1 Pierre', '2p': '2 Pierre', '1pet': '1 Pierre', '2pet': '2 Pierre', '1petri': '1 Pierre', '2petri': '2 Pierre',
  '1jn': '1 Jean', '2jn': '2 Jean', '3jn': '3 Jean', '1joann': '1 Jean', '1ioann': '1 Jean', '1joannes': '1 Jean', '1ioannes': '1 Jean', '1joannnes': '1 Jean', '1ioannnes': '1 Jean',
  '1john': '1 Jean', '1iohn': '1 Jean', '2joann': '2 Jean', '3joann': '3 Jean',
  jude: 'Jude', jud: 'Jude', ap: 'Apocalypse', apoc: 'Apocalypse', ap0c: 'Apocalypse'
}

/** « Mt 5 », « 1 Cor 4:9-14 », « Genèse 1, 3 », « 3 Reg 19:3 » → { livre, chapitre, verset, fin } (ou null). */
export function lireReference(texte) {
  const m = String(texte || '').trim().match(/^([1-4]?\s*\.?\s*[A-Za-zÀ-ÿœæ][A-Za-zÀ-ÿœæ .']*?)\.?\s+(\d+)(?:\s*[,;:.]\s*(\d+)(?:\s*-\s*(\d+))?)?/)
  if (!m) return null
  const brut = sansAccent(m[1]).replace(/[.\s']/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae')
  let livre = ABREVIATIONS[brut]
  if (!livre) livre = LIVRES.find((l) => sansAccent(l).replace(/\s/g, '') === brut) || (brut.length >= 3 ? LIVRES.find((l) => sansAccent(l).replace(/\s/g, '').startsWith(brut)) : null)
  if (!livre) return null
  return { livre, chapitre: +m[2], verset: m[3] ? +m[3] : null, fin: m[4] ? +m[4] : null }
}

// ─── Stockage sur l'appareil ───
const BibleLocale = {
  _db: null,
  ouvrir() {
    if (this._db) return this._db
    this._db = new Promise((ok, ko) => {
      const r = indexedDB.open('bible-hors-ligne', 1)
      r.onupgradeneeded = () => {
        const d = r.result
        d.createObjectStore('versets', { keyPath: ['livre', 'chapitre', 'verset_num'] })
        d.createObjectStore('commentaires', { keyPath: ['abrege', 'chapitre', 'verset'] })
        d.createObjectStore('meta')
      }
      r.onsuccess = () => ok(r.result)
      r.onerror = () => ko(r.error)
    })
    return this._db
  },
  async meta(cle, valeur) {
    const d = await this.ouvrir()
    return new Promise((ok, ko) => {
      const s = d.transaction('meta', valeur === undefined ? 'readonly' : 'readwrite').objectStore('meta')
      const r = valeur === undefined ? s.get(cle) : s.put(valeur, cle)
      r.onsuccess = () => ok(r.result)
      r.onerror = () => ko(r.error)
    })
  },
  async ecrire(magasin, lignes) {
    const d = await this.ouvrir()
    return new Promise((ok, ko) => {
      const t = d.transaction(magasin, 'readwrite')
      lignes.forEach((l) => t.objectStore(magasin).put(l))
      t.oncomplete = ok
      t.onerror = () => ko(t.error)
    })
  },
  async plage(magasin, debut, fin) {
    const d = await this.ouvrir()
    return new Promise((ok, ko) => {
      const r = d.transaction(magasin).objectStore(magasin).getAll(IDBKeyRange.bound(debut, fin))
      r.onsuccess = () => ok(r.result)
      r.onerror = () => ko(r.error)
    })
  },
  versets(livre, chap) { return this.plage('versets', [livre, +chap, -Infinity], [livre, +chap, []]) },
  async chapitres(livre) {
    const l = await this.plage('versets', [livre, -Infinity, -Infinity], [livre, [], []])
    return [...new Set(l.map((v) => +v.chapitre))]
  },
  commentaires(abrege, chap) { return this.plage('commentaires', [abrege, +chap, -Infinity], [abrege, +chap, []]) },
  async recherche(q) {
    const d = await this.ouvrir()
    const cible = sansAccent(q)
    return new Promise((ok, ko) => {
      const res = []
      const r = d.transaction('versets').objectStore('versets').openCursor()
      r.onsuccess = () => {
        const c = r.result
        if (!c || res.length >= 200) return ok(res)
        if (sansAccent(c.value.texte).includes(cible)) res.push(c.value)
        c.continue()
      }
      r.onerror = () => ko(r.error)
    })
  }
}

async function sb(requete) {
  const rep = await fetch(URL_SB + requete, { headers: { apikey: CLE_SB, Authorization: `Bearer ${CLE_SB}` } })
  if (!rep.ok) throw new Error('Bible injoignable')
  return rep.json()
}
const cleNum = (v) => (v === null || v === undefined || v === '' ? '' : isNaN(+v) ? String(v) : +v)
const complete = async (quoi) => { try { return (await BibleLocale.meta(quoi)) === true } catch { return false } }

/** Lecture locale si tout est téléchargé ; sinon le réseau, puis ce qui existe en local. */
async function lire(quoi, local, reseau) {
  if (await complete(quoi)) { try { return await local() } catch (e) { console.error(e) } }
  try { if (navigator.onLine !== false) return await reseau() } catch (e) { console.error(e) }
  try { return await local() } catch { return [] }
}

export async function chapitresDe(livre) {
  const l = await lire('complet', () => BibleLocale.chapitres(livre),
    async () => [...new Set((await sb(`bible_crampon?select=chapitre&livre=eq.${encodeURIComponent(livre)}&order=chapitre`)).map((r) => +r.chapitre))])
  return l.sort((a, b) => a - b)
}
export async function versetsDe(livre, chapitre) {
  const l = await lire('complet', () => BibleLocale.versets(livre, chapitre),
    () => sb(`bible_crampon?select=verset_num,texte&livre=eq.${encodeURIComponent(livre)}&chapitre=eq.${chapitre}&order=verset_num`))
  return l.map((v) => ({ n: +v.verset_num, texte: v.texte })).sort((a, b) => a.n - b.n)
}
/** Commentaires d'un chapitre d'Évangile : { verset: texte }. */
export async function commentairesDe(livre, chapitre) {
  const ab = ABREGE_COMMENTAIRE[livre]
  if (!ab) return {}
  if (estDemo()) return { 1: 'Commentaire d\'exemple (aperçu) : les vrais commentaires ne sont visibles qu\'une fois connecté.' }
  let l = []
  try { l = await BibleLocale.commentaires(ab, chapitre) } catch { /* ignore */ }
  if (!l.length && !(await complete('commentaires_complets'))) {
    try { await telechargerCommentaires(); l = await BibleLocale.commentaires(ab, chapitre) } catch { /* hors ligne */ }
  }
  const m = {}
  l.forEach((c) => { m[+c.verset] = c.texte })
  return m
}
export async function rechercher(q) {
  return lire('complet', () => BibleLocale.recherche(q),
    () => sb(`bible_crampon?select=livre,chapitre,verset_num,texte&texte=ilike.${encodeURIComponent('*' + q + '*')}&order=id&limit=200`))
}
export async function reference(livre, chapitre, verset) {
  const l = await versetsDe(livre, chapitre)
  return (verset ? l.filter((v) => v.n === verset) : l).map((v) => ({ livre, chapitre, verset_num: v.n, texte: v.texte }))
}

// ─── Téléchargement complet (reprend là où il s'était arrêté) ───
const abonnes = new Set()
let etat = ''
function annoncer(t) { etat = t; abonnes.forEach((f) => f(t)) }
export function suivreBible(fn) { abonnes.add(fn); fn(etat); return () => abonnes.delete(fn) }

let telechargementCommentaires = null
function telechargerCommentaires() {
  if (estDemo()) return Promise.resolve()   // l'aperçu ne touche pas aux données gardées sur l'appareil
  if (!telechargementCommentaires) {
    telechargementCommentaires = (async () => {
      if (await complete('commentaires_complets')) return
      let de = (await BibleLocale.meta('reprise_commentaires_srv')) || 0
      while (de !== null) {
        const r = await api('liturgie.commentaires', { de })
        await BibleLocale.ecrire('commentaires', r.lignes.map((l) => ({ abrege: l.abrege || '', chapitre: cleNum(l.chapitre), verset: cleNum(l.verset), texte: l.texte })))
        de = r.suite
        await BibleLocale.meta('reprise_commentaires_srv', de || 0)
      }
      await BibleLocale.meta('commentaires_complets', true)
    })().finally(() => { telechargementCommentaires = null })
  }
  return telechargementCommentaires
}

let telechargement = null
export function telechargerBible() {
  if (telechargement || !('indexedDB' in window)) return telechargement || Promise.resolve()
  telechargement = (async () => {
    try {
      if (!(await complete('complet'))) {
        if (navigator.onLine === false) { annoncer('Sans connexion : Bible non encore téléchargée'); return }
        navigator.storage?.persist?.().catch(() => {})
        const PAGE = 1000
        let de = (await BibleLocale.meta('reprise_versets')) || 0
        for (;;) {
          const l = await sb(`bible_crampon?select=livre,chapitre,verset_num,texte&order=id&offset=${de}&limit=${PAGE}`)
          if (!l.length) break
          await BibleLocale.ecrire('versets', l.map((v) => ({ livre: v.livre, chapitre: cleNum(v.chapitre), verset_num: cleNum(v.verset_num), texte: v.texte })))
          de += l.length
          await BibleLocale.meta('reprise_versets', de)
          annoncer(`Hors ligne : téléchargement de la Bible… ${de.toLocaleString('fr-FR')} versets`)
          if (l.length < PAGE) break
        }
        await BibleLocale.meta('complet', true)
      }
      if (navigator.onLine !== false && !estDemo()) {
        annoncer('Hors ligne : téléchargement des commentaires…')
        await telechargerCommentaires()
      }
      annoncer((await complete('commentaires_complets')) ? 'Hors ligne : Bible prête' : 'Hors ligne : Bible prête (commentaires à télécharger)')
    } catch (e) {
      console.error(e)
      annoncer('Hors ligne : téléchargement incomplet, reprise à la prochaine ouverture')
    }
  })().finally(() => { telechargement = null })
  return telechargement
}

// ─── Marque-pages : rangés sur le compte ; copie sur l'appareil pour le hors-ligne ───
const CLE_MARQUES = 'bible.marques'
const CLE_MARQUES_ENVOI = 'bible.marques.aEnvoyer'
export function marquesLocales() { try { return JSON.parse(localStorage.getItem(CLE_MARQUES) || '[]') } catch { return [] } }
function garderLocales(l) { try { localStorage.setItem(CLE_MARQUES, JSON.stringify(l)) } catch { /* plein */ } }
/** Récupère les marque-pages du compte (après avoir envoyé ceux gardés hors connexion). */
export async function chargerMarques() {
  if (estDemo()) return marquesDemo
  try {
    if (localStorage.getItem(CLE_MARQUES_ENVOI)) return await enregistrerMarques(marquesLocales())
    const l = await api('liturgie.marques')
    garderLocales(l)
    return l
  } catch { return marquesLocales() }
}
let marquesDemo = [{ id: 'd1', livre: 'Jean', chapitre: 1, verset: 14, note: 'Prologue', date: '2026-11-20' }]
export async function enregistrerMarques(l) {
  if (estDemo()) { marquesDemo = l; return l }
  garderLocales(l)
  try {
    const r = await api('liturgie.marquesEcrire', { marques: l })
    localStorage.removeItem(CLE_MARQUES_ENVOI)
    garderLocales(r)
    return r
  } catch (e) {
    if (e.code === 'RESEAU') { localStorage.setItem(CLE_MARQUES_ENVOI, '1'); return l }
    throw e
  }
}
