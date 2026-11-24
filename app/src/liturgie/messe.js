// Messe du jour : copie fidèle de messe.js de l'AppMesse (propre de la Messe, Divinum Officium, rubriques 1960,
// plus le propre de la communauté SMMD). Amélioration : les références des lectures ouvrent la Bible.
import { lireFichier, deux } from './source.js'
import { calendrierPropre, chargerCalendrier, feteSmmd, jourCalendrier, smmdRemplace, titreFrancais } from './calendrier.js'
import { lireReference } from './bible.js'

export const LIBELLES = { Introitus: 'Introït', Oratio: 'Collecte', Lectio: 'Épître', Graduale: 'Graduel', Alleluia: 'Alléluia', Tractus: 'Trait',
  Sequentia: 'Séquence', Evangelium: 'Évangile', Offertorium: 'Offertoire', Secreta: 'Secrète', Prefatio: 'Préface',
  Communio: 'Communion', Gloria: 'Gloria', Credo: 'Credo', Postcommunio: 'Postcommunion', 'Oratio super populum': 'Oraison sur le peuple' }

export function formeMesse(html, nomPartie) {
  return html
    .replace(/\s*\{[^{}]*\}/g, '')
    .replace(/<span class="do-(?:titre|rubr)"><b><i>(.)<\/i><\/b><\/span>/gu, '<span class="do-initiale">$1</span>')
    .replace(/<span class="do-titre"><b><i>([^<]+)<\/i><\/b><\/span>/g, (t, nom) => `<span class="do-titre">${nomPartie(nom.trim())}</span>`)
    .replace(/^(<span class="do-titre">[^<]*<\/span>)\s*(?:<br>\s*)+/, '$1')
}

// Le bloc « Graduale » contient aussi l'Alléluia, le Trait et la Séquence : découpé en pièces distinctes.
const TITRE_PIECE = (n) => `<span class="do-titre"><b><i>${n}</i></b></span>`
const ALLELUIA2 = /All[eé]l+[uú][ij]a,\s*all+[eé]l+[uú][ij]a\.?/i
const REF_BIBLIQUE = /<span class="do-rubr"><i>[^<]*\d[^<]*<\/i><\/span>/g
const CHANTS = ['Graduale', 'Alleluia', 'Tractus']
const finPropre = (s) => s.replace(/(?:\s|<br>)+$/, '').replace(/,$/, '.')
const titreDe = (p) => (p.match(/^<span class="do-titre"><b><i>([^<]+)</) || [])[1] || ''
const corpsDe = (p) => p.slice(p.indexOf('</span>') + 7)
const estGraduel = (html) => /^\s*<span class="do-titre"><b><i>Graduale<\/i><\/b><\/span>/.test(html)

function parTitres(html) {
  return html.trim()
    .replace(/(?:\s|<br>)*<span class="do-rubr"><i>\s*Tract(?:us)?\.?\s*<\/i><\/span>(?:\s|<br>)*/g, ' ' + TITRE_PIECE('Tractus') + ' <br> ')
    .split(/(?=<span class="do-titre"><b><i>[^<]{2,}<\/i><\/b><\/span>)/)
    .map(finPropre).filter(Boolean)
}
function parMarqueurs(html) {
  const pieces = parTitres(html)
  let corps = corpsDe(pieces[0])
  let m = ALLELUIA2.exec(corps)
  if (!m) return pieces
  if (!corps.slice(0, m.index).replace(/<br>|\s/g, '')) {
    const suite = corps.slice(m.index + m[0].length)
    const m2 = ALLELUIA2.exec(suite)
    if (!m2) { pieces[0] = TITRE_PIECE('Alleluia') + corps; return pieces }
    corps = suite; m = m2
  }
  pieces.splice(0, 1, TITRE_PIECE('Graduale') + finPropre(corps.slice(0, m.index)), TITRE_PIECE('Alleluia') + ' <br> ' + corps.slice(m.index))
  return pieces
}
function parPosition(html, modele) {
  const pieces = parTitres(html)
  if (pieces.filter((p) => CHANTS.includes(titreDe(p))).length !== 1) return null
  const chants = modele.filter((p) => CHANTS.includes(titreDe(p)))
  const corps = corpsDe(pieces[0])
  if (chants.length === 1 && titreDe(chants[0]) === 'Alleluia') { pieces[0] = TITRE_PIECE('Alleluia') + corps; return pieces }
  if (chants.length !== 2 || titreDe(chants[0]) !== 'Graduale') return null
  const nb = (p) => (p.match(REF_BIBLIQUE) || []).length
  const avant = nb(chants[0]), refs = [...corps.matchAll(REF_BIBLIQUE)]
  if (!avant || refs.length !== avant + nb(chants[1])) return null
  const coupe = refs[avant].index
  pieces.splice(0, 1, TITRE_PIECE('Graduale') + finPropre(corps.slice(0, coupe)), TITRE_PIECE(titreDe(chants[1])) + ' <br> ' + corps.slice(coupe))
  return pieces
}
export function decouperGraduel(html, latin) {
  if (!estGraduel(html)) return [html]
  const pieces = parMarqueurs(html)
  if (!latin || latin === html || !estGraduel(latin)) return pieces
  const modele = parMarqueurs(latin)
  const forme = (p) => p.map(titreDe).join('+')
  if (forme(pieces) === forme(modele)) return pieces
  return parPosition(html, modele) || pieces
}

const omise = (cellule) => /^\s*<span class="do-titre">[^]*?<\/span>\s*(?:<br>\s*)*(?:<[^>]+>\s*)*omit\.?\s*(?:<[^>]+>\s*)*$/i.test(cellule)

export function nomMesse(messes, i) {
  if (messes[i].smmd) return 'Communauté'
  if (messes.some((m) => m.smmd) && messes.filter((m) => !m.smmd).length === 1) return 'Calendrier romain'
  const noms = messes.map((m) => titreFrancais(m.titre_fr || m.titre))
  const tous = new Set(noms).size === noms.length
  if (/chrism/i.test(messes[i].titre)) return 'Messe chrismale'
  if (/C.na Domini/.test(messes[i].titre)) return 'Messe du soir'
  if (/in nocte/.test(messes[i].titre)) return 'Nuit'
  if (/in aurora/.test(messes[i].titre)) return 'Aurore'
  if (/In die Nativitatis/.test(messes[i].titre)) return 'Jour'
  if (/Quattuor Temporum/.test(messes[i].titre)) {
    const taille = (m) => JSON.stringify(m.lignes).length
    return taille(messes[i]) >= Math.max(...messes.map(taille)) ? 'Forme longue' : 'Forme courte'
  }
  return tous ? noms[i] : `${i + 1}${i ? 'e' : 're'} Messe`
}

// Références des lectures (Épître, leçons, Évangile) : liens vers la Bible
function lierReferences(html) {
  return html.replace(/<span class="do-rubr"><i>([^<]*\d[^<]*)<\/i><\/span>/g, (tout, ref) => {
    const r = lireReference(ref.replace(/^\s*\d\.\s*/, (x) => x.replace('.', '')))
    if (!r) return tout
    const q = new URLSearchParams({ livre: r.livre, chapitre: r.chapitre, ...(r.verset ? { verset: r.verset } : {}), ...(r.fin ? { fin: r.fin } : {}) })
    return `<span class="do-rubr"><i><a class="ref-bible" href="#/bible?${q}">${ref}</a></i></span>`
  })
}

/** Pièces HTML de la messe choisie, dans la langue voulue. */
export function piecesMesse(messe, fr) {
  const lignes = messe.lignes.filter((l) => !omise(l[0]))
  const nbLectures = lignes.filter((l) => />Lectio</.test(l[0])).length
  let lecture = 0
  return lignes.flatMap((l) => {
    const lectureOuEvangile = />(Lectio|Evangelium)</.test(l[0])
    const nomPartie = (n) => {
      if (!fr) return n
      if (n === 'Lectio') return ++lecture < nbLectures ? 'Leçon' : 'Épître'
      return LIBELLES[n] || n
    }
    return decouperGraduel(fr ? l[1] : l[0], l[0]).map((piece) => {
      const h = formeMesse(piece, nomPartie)
      return lectureOuEvangile ? lierReferences(h) : h
    })
  })
}

/** { messes, active } pour une date « AAAA-MM-JJ » ; null si aucun propre ; lève HORS_LIGNE si rien n'est disponible. */
export async function chargerMesse(date) {
  const [y, m, d] = date.split('-').map(Number)
  let messe = null, active = 0, hs = false
  try {
    const j = await lireFichier(`data/messe/${y}/${deux(m)}-${deux(d)}.json`)
    if (j) {
      messe = j
      active = j.principal || 0
      // Jeudi saint : la Messe chrismale et la Messe du soir (la 3e entrée n'est pas de 1960)
      if (/chrism/i.test(messe.messes[0].titre)) messe.messes = messe.messes.slice(0, 2)
    }
  } catch (e) { console.error(e); hs = true }
  await chargerCalendrier()
  const f = calendrierPropre() ? null : feteSmmd(m, d)   // calendrier propre : la messe de la communauté est déjà dans le fichier du jour
  if (f) {
    try {
      const toutes = await lireFichier('data/messe/smmd.json', { garder: true })
      const pm = toutes && toutes[`${deux(m)}-${deux(d)}`]
      if (pm) {
        const c = jourCalendrier(date)
        const lignes = pm.lignes.slice()
        // Depuis la Septuagésime : le Trait remplace le Graduel et l'Alléluia
        if (pm.trait && c && /gesim|Quadragesim/i.test(c.titre || '')) {
          const i = lignes.findIndex((l) => />Graduale</.test(l[0]))
          if (i >= 0) lignes[i] = pm.trait
        }
        messe = messe || { messes: [], principal: 0 }
        messe.messes.unshift({ titre: pm.titre, titre_fr: pm.titre_fr, lignes, smmd: true })
        active = smmdRemplace(f, c) ? 0 : (messe.principal || 0) + 1
      }
    } catch (e) { console.error(e); hs = hs && !messe }
  }
  if (!messe && hs) throw new Error('HORS_LIGNE')
  return messe ? { messes: messe.messes, active } : null
}
