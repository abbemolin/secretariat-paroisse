// Ordo liturgique : pour chaque jour, la fête (calendrier propre compris), la messe (Gloria, Credo, préface),
// les commémoraisons, les Vêpres, la pénitence et les fêtes d'obligation. Tout vient des fichiers déjà calculés par l'AppMesse.
import { deux, lireFichier } from './source.js'
import { jourCalendrier, jourLiturgique, titreFrancais } from './calendrier.js'
import Ordo1962 from '../annonces/ordo1962.js'

const PREFACES = {
  Communis: 'commune', 'de Adventu': 'de l’Avent', 'de Nativitate Domini': 'de la Nativité', 'de Epiphania Domini': 'de l’Épiphanie',
  'de Quadragesima': 'du Carême', 'de Sancta Cruce': 'de la Croix', 'de Cruce': 'de la Croix', Paschalis: 'de Pâques', 'de Ascensione Domini': 'de l’Ascension',
  'de Spiritu Sancto': 'du Saint-Esprit', 'de Sanctissima Trinitate': 'de la Sainte Trinité', 'de Trinitate': 'de la Sainte Trinité',
  'de Beata Maria Virgine': 'de la Sainte Vierge', 'de Apostolis': 'des Apôtres', 'de Sancto Joseph': 'de saint Joseph', 'de S. Joseph': 'de saint Joseph',
  'de Sacratissimo Corde Jesu': 'du Sacré-Cœur', 'de Sacratissimo Corde Iesu': 'du Sacré-Cœur', 'de D.N. Jesu Christi Rege': 'du Christ-Roi',
  'de D.N. Iesu Christi Rege': 'du Christ-Roi', Defunctorum: 'des défunts'
}
const sansBalises = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

/** { gloria, credo, preface } d'après le propre de la messe principale. */
export function detailsMesse(fichier) {
  if (!fichier?.messes?.length) return null
  const m = fichier.messes[fichier.principal || 0]
  const res = { gloria: false, credo: false, preface: '' }
  for (const [la] of m.lignes) {
    const t = (la.match(/^\s*<span class="do-titre"><b><i>([^<]+)</) || [])[1]?.trim()
    if (!t) continue
    const corps = sansBalises(la.replace(/^\s*<span class="do-titre">[^]*?<\/span>/, ''))
    if (t === 'Gloria') res.gloria = !/^omit/i.test(corps)
    else if (t === 'Credo') res.credo = !/^omit/i.test(corps)
    else if (/^Prefatio/.test(t)) {
      const nom = t.replace(/^Prefatio\s*/, '').trim() || 'Communis'
      res.preface = PREFACES[nom] || nom
    }
  }
  return res
}

/** « Comm. (à Laudes seulement) : S. Chrysogone » d'après la ligne du calendrier. */
export function commemoraisons(c) {
  const t = String(c?.comm || '').trim()
  // « Tempora » / « Scriptura » : simple indication des leçons de l'Écriture de la férie, sans commémoraison
  if (!t || /^(Tempora|Scriptura)\b/i.test(t)) return ''
  return t.replace(/^Commemoratio ad Laudes tantum\s*:?\s*/i, 'Comm. à Laudes seulement : ')
    .replace(/^Commemoratio\s*:?\s*/i, 'Comm. : ')
    .replace(/^Tempora\s*:?\s*/i, 'Férie : ').replace(/^Scriptura\s*:?\s*/i, 'Écriture de la férie : ')
}

/** Vêpres : de la fête, ou du jour suivant, avec leurs commémoraisons. */
export function detailsVepres(v, demain) {
  if (!v) return ''
  const sous = String(v.sous || '')
  const comm = (sous.match(/Commemoratio[^:]*:\s*(.*)$/i) || [])[1]
  let t
  if (/de sequenti/i.test(sous)) t = `Vêpres du suivant${demain ? ' (' + demain + ')' : ''}`
  else if (/a capitulo de sequenti/i.test(sous)) t = 'Vêpres : à partir du capitule, du suivant'
  else t = 'Vêpres du jour'
  return comm ? `${t} · comm. ${comm.replace(/\s*\.\s*$/, '')}` : t
}

const est = (c, re) => re.test(c?.titre || '')
const JOUR = 86400000
/** Pénitence et obligation. actuelle : discipline en vigueur en France ; ancienne : discipline de 1962 (dévotion). */
export function penitence(date, c, o) {
  const j = new Date(date + 'T12:00:00')
  const p = Ordo1962.paques(j.getFullYear())
  const paques = new Date(p.getFullYear(), p.getMonth(), p.getDate(), 12)
  const ecart = Math.round((j - paques) / JOUR)            // jours depuis Pâques
  const cendres = ecart === -46, vendrediSaint = ecart === -2, samediSaint = ecart === -1
  const dow = j.getDay()
  const solennite = (c?.rang || o?.rang) === 1
  const actuelle = cendres || vendrediSaint ? 'Jeûne et abstinence' : dow === 5 && !solennite ? 'Abstinence' : ''
  // Discipline de 1962 : jeûne en Carême (sauf dimanche), aux Quatre-Temps et aux vigiles ; abstinence complète les vendredis,
  // le mercredi des Cendres, le vendredi des Quatre-Temps et les vigiles ; partielle les autres jours de jeûne.
  const careme = ecart >= -46 && ecart <= -2 && dow !== 0
  const quatreTemps = est(c, /Quatt?uor Temporum/)
  const vigile = est(c, /Vigilia (Nativitatis|Pentecostes|Assumptionis)/)
  let ancienne = ''
  if (samediSaint) ancienne = 'Jeûne et abstinence jusqu’à midi'
  else if (careme || quatreTemps || vigile) ancienne = dow === 5 || cendres || vigile ? 'Jeûne et abstinence' : 'Jeûne (abstinence partielle)'
  else if (dow === 5 && !solennite) ancienne = 'Abstinence'
  // Fêtes d'obligation en France (en plus des dimanches)
  const md = date.slice(5)
  const obligation = md === '12-25' || md === '08-15' || md === '11-01' || ecart === 39 ? 'Fête d’obligation' : ''
  return { actuelle, ancienne: ancienne && ancienne !== actuelle ? ancienne : '', obligation }
}

/** Les jours d'un mois : base immédiate (calendrier), puis détails lus dans les fichiers de l'AppMesse. */
export function joursDuMois(annee, mois) {
  const n = new Date(annee, mois, 0).getDate()
  return Array.from({ length: n }, (_, i) => {
    const d = i + 1
    const iso = `${annee}-${deux(mois)}-${deux(d)}`
    const o = jourLiturgique(annee, mois, d) || {}
    const c = jourCalendrier(iso)
    return { iso, d, dow: new Date(annee, mois - 1, d).getDay(), fete: o.fete || '', classe: o.classe || '', couleur: o.couleur || '', c, o, comm: commemoraisons(c), ...penitence(iso, c, o) }
  })
}

/** Détails messe + Vêpres d'un jour (lecture réseau, sinon la copie hors ligne). */
export async function details(iso) {
  const [y, m, d] = iso.split('-')
  const [messe, vepres] = await Promise.all([
    lireFichier(`data/messe/${y}/${m}-${d}.json`).catch(() => null),
    lireFichier(`data/breviaire/${y}/${m}-${d}/Vespera.json`).catch(() => null)
  ])
  const demain = new Date(+y, +m - 1, +d + 1)
  const cd = jourCalendrier(`${demain.getFullYear()}-${deux(demain.getMonth() + 1)}-${deux(demain.getDate())}`)
  return { messe: detailsMesse(messe), vepres: vepres ? detailsVepres(vepres, cd ? titreFrancais(cd.titre_fr || cd.titre) : '') : '' }
}

export const CLASSE_COURTE = { '1re classe': 'I cl.', '2e classe': 'II cl.', '3e classe': 'III cl.', '4e classe': 'IV cl.' }
export const COULEURS = { Blanc: '#d9cfae', Rouge: '#b3261e', Vert: '#2e7d4f', Violet: '#6c3483', Rose: '#e48aa8', Noir: '#222222' }
