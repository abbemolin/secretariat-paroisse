// Calendrier liturgique commun (Bréviaire, Messe du jour, feuille de semaine, newsletter).
// Copie fidèle de l'AppMesse : titres.js + messe.js (calendrier Divinum Officium, rubriques 1960,
// propre de la communauté SMMD et propre de Strasbourg), avec l'ancien calcul Ordo1962 en repli.
import Ordo1962 from '../annonces/ordo1962.js'
import { lireFichier } from './source.js'

// ─── titres.js ───
const TITRES_FR = {
  'Dominica II Passionis seu in Palmis': 'Dimanche des Rameaux',
  'Dominica Sanctissimæ Trinitatis': 'Dimanche de la Très Sainte Trinité',
  'Beatæ Mariæ Virginis Reginæ': 'Bienheureuse Vierge Marie Reine',
  'Die Quarta Januarii': '4 janvier',
  'Die Quinta Januarii': '5 janvier',
  'Die Duodecima Januarii': '12 janvier',
  'In Cathedra S. Petri Apostoli': 'Chaire de saint Pierre, Apôtre',
  'In Conceptione Immaculata Beatæ Mariæ Virginis': 'Immaculée Conception de la Bienheureuse Vierge Marie',
  'In Conversione S. Pauli Apostoli': 'Conversion de saint Paul, Apôtre',
  'In Purificatione Beatæ Mariæ Virginis': 'Purification de la Bienheureuse Vierge Marie',
  'In Visitatione B. Mariæ Virginis': 'Visitation de la Bienheureuse Vierge Marie',
  'Sabbato Sancto': 'Samedi saint',
  'Sanctæ Mariæ Sabbato': 'Sainte Marie au samedi',
  'S. Agathæ Virginis et Martyris': 'Ste Agathe, Vierge et Martyre',
  'S. Agnetis Virginis et Martyris': 'Ste Agnès, Vierge et Martyre',
  'S. Andreæ Corsini Episcopi et Confessoris': 'S. André Corsini, Évêque et Confesseur',
  'S. Anselmi Episcopi Confessoris et Ecclesiæ Doctoris': 'S. Anselme, Évêque, Confesseur et Docteur de l’Église',
  'S. Catharinæ Senensis Virginis': 'Ste Catherine de Sienne, Vierge',
  'S. Cyrilli Episc. Alexandrini Confessoris et Ecclesiæ Doctoris': 'S. Cyrille d’Alexandrie, Évêque, Confesseur et Docteur de l’Église',
  'S. Fidelis de Sigmaringa Martyris': 'S. Fidèle de Sigmaringen, Martyr',
  'S. Francisci Salesii Episcopi Confessoris et Ecclesiæ Doctoris': 'S. François de Sales, Évêque, Confesseur et Docteur de l’Église',
  'S. Hermenegildi Martyris': 'S. Herménégilde, Martyr',
  'S. Ignatii Episcopi et Martyris': 'S. Ignace, Évêque et Martyr',
  'S. Joannis Chrysostomi Episcopi Confessoris et Ecclesiæ Doctoris': 'S. Jean Chrysostome, Évêque, Confesseur et Docteur de l’Église',
  'S. Joannis de Matha Confessoris': 'S. Jean de Matha, Confesseur',
  'S. Joseph Sponsi B.M.V. Confessoris': 'S. Joseph, Époux de la Bienheureuse Vierge Marie, Confesseur',
  'S. Justini Martyris': 'S. Justin, Martyr',
  'S. Marie Madeleine de Pazzi Virginis': 'Ste Marie-Madeleine de Pazzi, Vierge',
  'S. Martinæ Virginis et Martyris': 'Ste Martine, Vierge et Martyre',
  'S. Matthiæ Apostoli': 'S. Matthias, Apôtre',
  'S. Pauli Primi Eremitae Confessoris': 'S. Paul, premier Ermite, Confesseur',
  'S. Pauli a Cruce Confessoris': 'S. Paul de la Croix, Confesseur',
  'S. Petri Nolasci Confessoris': 'S. Pierre Nolasque, Confesseur',
  'S. Polycarpi Episcopi et Martyris': 'S. Polycarpe, Évêque et Martyr',
  'S. Raymundi de Peñafort Confessoris': 'S. Raymond de Peñafort, Confesseur',
  'S. Stanislai Episcopi et Martyris': 'S. Stanislas, Évêque et Martyr',
  'S. Titi Episcopi et Confessoris': 'S. Tite, Évêque et Confesseur'
}
const JOURS_FERIE = { secunda: 'Lundi', ii: 'Lundi', tertia: 'Mardi', iii: 'Mardi', quarta: 'Mercredi', iv: 'Mercredi',
  quinta: 'Jeudi', v: 'Jeudi', sexta: 'Vendredi', vi: 'Vendredi' }
function romainVersEntier(r) {
  const v = { I: 1, V: 5, X: 10, L: 50 }
  return [...r].reduce((t, c, i, a) => t + (v[c] < (v[a[i + 1]] || 0) ? -v[c] : v[c]), 0)
}
const rangFr = (n) => (n === 1 ? '1re' : n + 'e')

export function titreFrancais(t) {
  t = String(t || '').replace(/\s+\d+(?:er|e) d(?:e |’|')\S+$/, '').replace('dans l’Octave de la Pentecôte', 'après l’Octave de la Pentecôte').trim()
  if (TITRES_FR[t]) return TITRES_FR[t]
  let m = t.match(/^Feria (\w+) infra Hebdomadam ([IVXL]+) post Octavam Pentecostes$/i)
  if (m && JOURS_FERIE[m[1].toLowerCase()]) {
    return `${JOURS_FERIE[m[1].toLowerCase()]} de la ${rangFr(romainVersEntier(m[2]))} semaine après l’Octave de la Pentecôte`
  }
  m = t.match(/^Dominica ([IVXL]+)\.? Post (Pentecosten|Pascha)$/i)
  if (m) {
    const n = romainVersEntier(m[1])
    return `${n === 1 ? '1er' : n + 'e'} dimanche après ${/pascha/i.test(m[2]) ? 'Pâques' : 'la Pentecôte'}`
  }
  return t
}

// ─── messe.js : calendrier ───
const pad = (n) => String(n).padStart(2, '0')
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

// Propre de la communauté (SMMD), à côté du calendrier romain
const SMMD = {
  '12-01': { fete: 'S. Charles de Foucauld', classe: '3e classe', rang: 3 },
  '02-15': { fete: 'B. Michel Sopocko', classe: '3e classe', rang: 3 },
  '10-05': { fete: 'Ste Faustine', classe: '1re classe', rang: 1 },
  '10-22': { fete: 'S. Jean-Paul II', classe: '3e classe', rang: 3 },
  '11-16': { fete: 'Notre-Dame de la Miséricorde', classe: '3e classe', rang: 3 }
}

// Propre de Strasbourg, calendrier seul : le propre de la Messe reste celui du jour.
// Fête = 2e classe, mémoire = 3e classe, mémoire facultative = simple mention.
const DIOCESE = {
  '04-19': ['S. Léon IX, pape', 2], '07-21': ['S. Arbogast, évêque, patron du diocèse', 2],
  '09-07': ['Dédicace de la Cathédrale', 2], '12-13': ['Ste Odile, abbesse, patronne de l’Alsace', 2],
  '07-07': ['Translation des reliques de Ste Odile', 3], '09-12': ['S. Materne et les premiers apôtres de l’Alsace', 3],
  '09-25': ['Stes Eugénie et Attale, vierges', 3], '10-26': ['S. Amand, premier évêque de Strasbourg', 3],
  '11-07': ['S. Florent, évêque', 3], '12-15': ['Ste Lucie, vierge et martyre', 3],
  '01-27': ['S. Amarin, abbé', 0], '02-01': ['Ste Brigide, abbesse', 0], '02-12': ['S. Ludan, pèlerin', 0],
  '02-13': ['S. Benoît d’Aniane, abbé', 0], '03-06': ['S. Fridolin, moine missionnaire', 0],
  '05-25': ['S. Urbain Ier, pape', 0],
  '06-04': ['S. Morand, moine', 0], '06-19': ['Ss. Modeste Andlauer et André Bauer, martyrs', 0],
  '07-04': ['S. Ulrich, évêque', 0], '07-20': ['S. Apollinaire, évêque et martyr', 0],
  '08-12': ['B. Jean-Georges Rehm, prêtre et martyr', 0], '08-30': ['S. Adelphe, évêque', 0],
  '09-09': ['Bse Mère Alphonse-Marie', 0], '09-11': ['Saint Nom de Marie', 0],
  '09-17': ['S. Lambert, évêque et martyr', 0], '09-18': ['Ste Richarde, impératrice', 0],
  '09-22': ['S. Maurice et ses compagnons, martyrs', 0], '10-05': ['S. Léger, évêque et martyr', 0],
  '10-13': ['Ste Aurélie, vierge', 0], '10-16': ['S. Gall, missionnaire', 0],
  '11-03': ['S. Pirmin, évêque', 0], '12-16': ['Ste Adélaïde, impératrice', 0]
}
const CLASSE_DIOCESE = { 2: '2e classe', 3: '3e classe' }
const ROUGE_DIOCESE = new Set(['12-15'])

// 1re classe : remplace tout sauf une 1re classe. 3e classe : cède aux 1re et 2e classes et aux féries de Carême.
export function smmdRemplace(f, c) {
  if (!f) return false
  if (!c) return true
  if (f.rang === 1) return c.rang !== 1
  if (c.rang < 3) return false
  return !/^Feria.*(Quadragesim|Passion|Cinerum)/.test(c.titre || '')
}
export const feteSmmd = (m, d) => SMMD[`${pad(m)}-${pad(d)}`] || null

// ─── Calendrier généré (data/messe/calendrier.json de l'AppMesse) ───
const CLE_LOCALE = 'liturgie.calendrier'
let CALENDRIER = null
try { CALENDRIER = JSON.parse(localStorage.getItem(CLE_LOCALE) || 'null') } catch { /* ignore */ }
let chargement = null
/** Charge (ou rafraîchit) le calendrier ; sans connexion, la dernière copie gardée sert. */
export function chargerCalendrier() {
  if (!chargement) {
    chargement = lireFichier('data/messe/calendrier.json', { garder: true }).then((c) => {
      if (c && typeof c === 'object') {
        CALENDRIER = c
        try { localStorage.setItem(CLE_LOCALE, JSON.stringify(c)) } catch { /* plein */ }
      }
      return CALENDRIER
    }).catch(() => CALENDRIER)
  }
  return chargement
}
export const jourCalendrier = (date) => (CALENDRIER || {})[date] || null

/** Même résultat que Ordo1962.getDay de l'AppMesse (avec messe.js). */
export function jourLiturgique(y, m, d) {
  const base = Ordo1962.getDay(y, m, d)
  const c = (CALENDRIER || {})[iso(y, m, d)]
  const f = feteSmmd(m, d)
  const r = c ? Object.assign({}, base, {
    date: iso(y, m, d), fete: titreFrancais(c.titre_fr || c.titre), classe: c.classe, rang: c.rang,
    couleur: c.couleur, commemoration: c.comm || null, autres: [], source: 'divinum'
  }) : base
  const dio = DIOCESE[`${pad(m)}-${pad(d)}`]
  const mention = (n) => `${n} (facultatif)`
  if (f && smmdRemplace(f, c)) {
    return Object.assign({}, r, { date: iso(y, m, d), fete: dio ? `${f.fete} · ${mention(dio[0])}` : f.fete,
      classe: f.classe, rang: f.rang, couleur: 'Blanc', commemoration: null, autres: [], source: 'smmd', romain: r && r.fete })
  }
  if (!c || !dio) return r
  const [nom, rang] = dio
  if (rang) {
    const peut = rang === 2 ? c.rang >= 3 : smmdRemplace({ rang }, c)
    if (peut) return Object.assign({}, r, { fete: nom, classe: CLASSE_DIOCESE[rang], rang,
      couleur: ROUGE_DIOCESE.has(`${pad(m)}-${pad(d)}`) ? 'Rouge' : 'Blanc', source: 'diocese', romain: r.fete })
    return r
  }
  return c.rang >= 3 ? Object.assign({}, r, { fete: `${r.fete} · ${mention(nom)}`, mention: nom }) : r
}
