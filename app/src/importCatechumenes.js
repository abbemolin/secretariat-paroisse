/**
 * Lecture du tableau Excel des catéchumènes (« Baptisés adultes.xlsx ») :
 * un onglet par année (2024, 2025, 2026, 2027…) et éventuellement « Feuille 2 ».
 * Tout se fait dans le navigateur ; seul le résultat (une fiche par personne) part vers le serveur.
 */

export const STATUTS_IMPORT = [
  ['2027', 'Baptême 2027'], ['2028', 'Baptême 2028'], ['2029', 'Baptême 2029'], ['attente', 'En attente'],
  ['bapt2026', 'Baptisé(e) en 2026'], ['bapt2025', 'Baptisé(e) en 2025'], ['bapt2024', 'Baptisé(e) en 2024'], ['ignorer', 'Ne pas importer']
]

const sa = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const vide = (v) => v === null || v === undefined || String(v).trim() === ''
const texte = (v) => (vide(v) ? '' : String(v).replace(/\s+/g, ' ').trim())
const sansValeur = (v) => ['/', '-', '--', '---', '-----', 'non', '?'].includes(texte(v)) || /^#[A-Z/]+!?$/.test(texte(v))

function dateIso(v) {
  if (v instanceof Date && !isNaN(v)) { const a = v.getUTCFullYear(); return a > 1900 && a < 2100 ? v.toISOString().slice(0, 10) : '' }
  const m = texte(v).match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
}
function telephone(v) {
  if (vide(v)) return ''
  let c = String(typeof v === 'number' ? Math.round(v) : v).replace(/\D/g, '')
  if (c.length === 9) c = '0' + c
  return c.length === 10 ? c.replace(/(\d{2})(?=\d)/g, '$1 ') : texte(v)
}
const email = (v) => (/@/.test(texte(v)) ? texte(v).replace(/\s/g, '') : '')
const oui = (v) => !vide(v) && !sansValeur(v)

function lev(a, b) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 9
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}
const premierPrenom = (p) => sa(p).split(/[\s,()-]+/).filter(Boolean)[0] || ''
const cleNom = (n) => sa(n).replace(/[^a-z]/g, '')
export function memePersonne(a, b) {
  // même prénom, et même nom (une faute tolérée) ; si un nom manque, il faut la même adresse e-mail
  if (!premierPrenom(a.prenoms) || premierPrenom(a.prenoms) !== premierPrenom(b.prenoms)) return false
  const x = cleNom(a.nom), y = cleNom(b.nom)
  if (!x || !y) return !!a.email && !!b.email && a.email.toLowerCase() === b.email.toLowerCase()
  return x === y || lev(x, y) <= 1
}

/** Repère les colonnes d'un onglet d'après sa ligne d'en-tête. */
function colonnes(lignes) {
  const i = lignes.slice(0, 4).findIndex((l) => l.some((c) => sa(c) === 'prenom'))
  if (i < 0) return null
  const h = lignes[i].map(sa)
  const c = { entete: i }
  const cherche = (t) => h.findIndex((x) => x === t)
  Object.assign(c, {
    prenom: cherche('prenom'), nom: cherche('nom'), naissance: cherche('date de naissance'), lieu: cherche('lieu de naissance'),
    pere: cherche('pere'), mere: cherche('mere'), parrain: cherche('parrain/marraine'), telephone: cherche('telephone'), adresse: cherche('adresse'),
    entree: cherche('entree'), annee: cherche('bapteme prevu'), acte: cherche('acte de naissance'), b6: cherche('b6'), lettre: cherche('lettre'),
    inscription: cherche('inscription en ligne'), disponibilite: cherche('disponibilite')
  })
  // deux colonnes « Mail » possibles : celle qui contient des adresses, et (onglet 2027) la case « ok » du service diocésain
  const mails = h.map((x, j) => (x === 'mail' ? j : -1)).filter((j) => j >= 0)
  const avecArobase = (j) => lignes.slice(i + 1).some((l) => /@/.test(texte(l[j])))
  c.email = mails.find(avecArobase) ?? -1
  c.mailDiocese = mails.find((j) => j !== c.email) ?? -1
  // colonne A sans titre : accompagnateur (onglets 2025, 2026) ; colonne B sans titre dans 2027 : année / note
  if (c.annee === 0 && vide(lignes[i][1])) c.note = 1
  else if (c.entree > 0 && vide(h[0])) c.accompagnateur = 0
  return c
}

const CONNUES = ['prenom', 'nom', 'naissance', 'lieu', 'pere', 'mere', 'parrain', 'telephone', 'adresse', 'entree', 'annee', 'acte', 'b6', 'lettre', 'inscription', 'disponibilite', 'email', 'mailDiocese', 'note', 'accompagnateur']

function rangOnglet(nom) {
  const a = Number(String(nom).match(/\d{4}/)?.[0])
  return a || 0
}

/**
 * feuilles : [{ nom, lignes: [[...cellules]] }] → { personnes: [...], onglets: [...] }
 */
export function analyserClasseur(feuilles) {
  const annees = feuilles.filter((f) => rangOnglet(f.nom))
  const autres = feuilles.filter((f) => !rangOnglet(f.nom))
  const plusRecente = Math.max(...annees.map((f) => rangOnglet(f.nom)))
  // un onglet sans en-tête (« Feuille 2 ») reprend la disposition de l'onglet qui lui ressemble (même nombre de colonnes utiles)
  const dispo = {}
  annees.forEach((f) => { dispo[f.nom] = colonnes(f.lignes) })
  const ordre = [...annees.sort((a, b) => rangOnglet(a.nom) - rangOnglet(b.nom))]
  autres.forEach((f) => {
    const c = colonnes(f.lignes)
    if (c) { dispo[f.nom] = c; ordre.splice(ordre.length - 1, 0, f); return }
    // sans en-tête : on cherche un onglet-année dont les noms se retrouvent
    const modele = annees.filter((a) => dispo[a.nom]?.accompagnateur === 0).sort((a, b) => rangOnglet(b.nom) - rangOnglet(a.nom))
      .find((a) => f.lignes.some((l) => a.lignes.some((m) => texte(m[dispo[a.nom].nom]) && texte(m[dispo[a.nom].nom]) === texte(l[dispo[a.nom].nom]))))
    if (modele) { dispo[f.nom] = { ...dispo[modele.nom], entete: -1, rangModele: rangOnglet(modele.nom) }; ordre.splice(ordre.indexOf(modele) + 1, 0, f) }
  })

  const personnes = []
  ordre.forEach((f) => {
    const c = dispo[f.nom]
    if (!c) return
    const annee = rangOnglet(f.nom) || c.rangModele || plusRecente
    const liste = !rangOnglet(f.nom)                      // onglet de liste (ex. « Feuille 2 »)
    f.lignes.slice(c.entete + 1).forEach((l) => {
      const v = (k) => (c[k] >= 0 && c[k] !== undefined ? l[c[k]] : null)
      const prenoms = texte(v('prenom')), nom = texte(v('nom'))
      if (!prenoms && !nom) return
      const x = {
        prenoms, nom, naissance_date: dateIso(v('naissance')), naissance_lieu: sansValeur(v('lieu')) ? '' : texte(v('lieu')),
        pere: sansValeur(v('pere')) ? '' : texte(v('pere')), mere: sansValeur(v('mere')) ? '' : texte(v('mere')),
        parrain: sansValeur(v('parrain')) ? '' : texte(v('parrain')).replace(/^\(\s*|\s*\)$/g, ''),
        email: email(v('email')), telephone: telephone(v('telephone')), adresse: texte(v('adresse')),
        accompagnateur: texte(v('accompagnateur')).replace(/^anciennement\s*:\s*/i, ''), disponibilite: texte(v('disponibilite')),
        entree_date: dateIso(v('entree')), entree_annee: typeof v('entree') === 'number' && v('entree') > 1900 && v('entree') < 2100 ? String(v('entree')) : '',
        acte_naissance: oui(v('acte')), b6: oui(v('b6')), lettre: oui(v('lettre')), diocese_inscription: oui(v('inscription')), diocese_mail: oui(v('mailDiocese')),
        notes: []
      }
      // cases sans titre après les colonnes connues : suite de l'adresse, ou note
      const connues = new Set(CONNUES.map((k) => c[k]).filter((j) => j >= 0))
      l.forEach((cell, j) => {
        if (connues.has(j) || j <= Math.max(c.prenom, c.nom)) return
        const t = texte(cell)
        if (!t || !/[a-zà-ÿ]{3,}/i.test(t) || sa(t) === 'message') return
        if (j === c.adresse + 1) x.adresse = [x.adresse, t].filter(Boolean).join(', ')
        else x.notes.push(t)
      })
      // onglet 2027 : année prévue (A ou B) et note
      if (c.annee >= 0) {
        const a = [v('annee'), v('note')].map((y) => Number(y)).find((y) => y > 2000 && y < 2100)
        x.annee_prevue = a ? String(a) : ''
        const n = texte(v('note'))
        if (n && !Number(n)) {
          if (/^c[eé]lib/i.test(n)) x.situation = 'Célibataire'
          else if (!/^en attente$/i.test(n)) x.notes.push(n)
        }
      }
      if (x.pere && x.pere === x.mere) x.pere = ''          // même nom recopié dans les deux colonnes
      x.notes = x.notes.map((n) => `${f.nom} : ${n}`)
      const d = personnes.find((p) => memePersonne(p, x))
      if (!d) { personnes.push({ ...x, onglets: [f.nom], annee, liste }); return }
      // l'onglet le plus récent l'emporte ; les plus anciens complètent les cases vides
      Object.keys(x).forEach((k) => {
        if (k === 'notes') d.notes = [...d.notes, ...x.notes.filter((n) => !d.notes.includes(n))]
        else if (typeof x[k] === 'boolean') d[k] = d[k] || x[k]
        else if (x[k] && (!liste || !d[k])) d[k] = x[k]
      })
      if (!d.onglets.includes(f.nom)) d.onglets.push(f.nom)
      if (liste) d.liste = true
      else if (annee >= d.annee) { d.annee = annee; if (x.annee_prevue === undefined) delete d.annee_prevue }
    })
  })

  personnes.forEach((p, i) => {
    if (p.pere && sa(p.pere) === sa(p.mere)) p.pere = ''   // le même nom dans les deux colonnes (onglets différents)
    p.cle = 'p' + i
    p.statut = statutPropose(p, plusRecente)
  })
  return { personnes: personnes.sort((a, b) => `${a.nom} ${a.prenoms}`.localeCompare(`${b.nom} ${b.prenoms}`, 'fr')), onglets: ordre.map((f) => f.nom) }
}

function statutPropose(p, plusRecente) {
  if (p.annee === plusRecente) return p.annee_prevue || 'attente'
  const notes = sa(p.notes.join(' '))
  if (/baptise(e)? en (\d{4})/.test(notes)) return 'bapt' + notes.match(/baptise(e)? en (\d{4})/)[2]
  if (/arret|sans nouvelles|questionnement|baptisable|plus tard/.test(notes)) return 'attente'
  if (p.annee === plusRecente - 1) return p.liste ? 'bapt' + p.annee : 'attente'
  return 'bapt' + p.annee
}

/** Ouvre le fichier .xlsx choisi et renvoie ses onglets. */
export async function lireClasseur(fichier) {
  const { default: lire, readSheetNames } = await import('read-excel-file')
  const noms = await readSheetNames(fichier)
  const feuilles = []
  for (const nom of noms) feuilles.push({ nom, lignes: await lire(fichier, { sheet: nom }) })
  return feuilles
}
