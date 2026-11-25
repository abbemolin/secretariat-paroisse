/**
 * Lecture du tableau de contacts (google_contacts_import.xlsx) dans le navigateur.
 * Onglet « Source fusionnée » (de préférence) ou onglet au format Google Contacts (Given Name, E-mail 1 - Value…).
 * Règles choisies :
 *  - sans les contacts de Colmar : une ligne dont toutes les sources sont « …colmar » est retirée ;
 *    une ligne qui a aussi une autre source (csv_simple, google_contacts…) est gardée ;
 *  - couples et foyers : séparés en une fiche par personne, reliées par un foyer (à valider dans l'aperçu) ;
 *  - plusieurs e-mails ou téléphones : tous gardés ;
 *  - lignes sans e-mail, téléphone ni adresse : ignorées.
 * Seul le résultat (une fiche par personne) part vers le serveur, qui fusionne avec Google Contacts.
 */

const sa = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const texte = (v) => (v === null || v === undefined ? '' : String(v).replace(/[‪-‮]/g, '').replace(/\s+/g, ' ').trim())
const plusieurs = (v) => texte(v).split(/\s*\|\s*|\s*;\s*|\s*,\s*(?=\S+@)/).map(texte).filter(Boolean)
const estMail = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m)

export function telephone(v) {
  let t = texte(typeof v === 'number' ? Math.round(v) : v)
  if (!t) return ''
  let c = t.replace(/\D/g, '')
  if (/^\+?33/.test(t.replace(/\s/g, '')) && c.length === 11) c = '0' + c.slice(2)
  if (c.length === 9) c = '0' + c
  return c.length === 10 && c[0] === '0' ? c.replace(/(\d{2})(?=\d)/g, '$1 ') : t
}
export const estFixe = (t) => /^0[1-59]/.test(String(t).replace(/\D/g, '').replace(/^33/, '0'))
const CIVILITES = { mme: 'Mme', madame: 'Mme', m: 'M.', mr: 'M.', monsieur: 'M.', mlle: 'Mlle' }
const titre = (t) => texte(t).toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())

/** Lit le fichier choisi : lignes brutes normalisées. */
export async function lireFichierContacts(fichier) {
  const feuilles = await lireXlsx(fichier)
  const f = feuilles.find((x) => sa(x.nom) === 'source fusionnee') || feuilles[0]
  if (!f) throw new Error('aucun onglet trouvé')
  return lignesBrutes(f.lignes)
}

/**
 * Lecteur .xlsx minimal (dézippe et lit le XML) : accepte aussi les cellules « inlineStr » vides
 * que produisent certains outils d'export, et que read-excel-file refuse.
 */
export async function lireXlsx(fichier) {
  const { unzipSync, strFromU8 } = await import('fflate')
  const z = unzipSync(new Uint8Array(await fichier.arrayBuffer()))
  const xml = (n) => (z[n] ? new DOMParser().parseFromString(strFromU8(z[n]), 'application/xml') : null)
  const tous = (d, tag) => (d ? [...d.getElementsByTagNameNS('*', tag)] : [])
  const partages = tous(xml('xl/sharedStrings.xml'), 'si').map((si) => tous(si, 't').map((t) => t.textContent).join(''))
  const cibles = {}
  tous(xml('xl/_rels/workbook.xml.rels'), 'Relationship').forEach((r) => { cibles[r.getAttribute('Id')] = r.getAttribute('Target') })
  const chemin = (t) => (!t ? '' : t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, ''))
  const colonne = (ref) => [...String(ref).replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
  return tous(xml('xl/workbook.xml'), 'sheet').map((s) => {
    const doc = xml(chemin(cibles[s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')]))
    const lignes = []
    tous(doc, 'row').forEach((row, i) => {
      const n = Number(row.getAttribute('r')) - 1 || i
      const l = []
      tous(row, 'c').forEach((c, j) => {
        const t = c.getAttribute('t'), v = tous(c, 'v')[0]?.textContent
        const k = c.getAttribute('r') ? colonne(c.getAttribute('r')) : j
        let val = null
        if (t === 's') val = partages[Number(v)] ?? null
        else if (t === 'inlineStr') val = tous(c, 't').map((x) => x.textContent).join('') || null
        else if (t === 'b') val = v === '1'
        else if (t === 'str' || t === 'e') val = v ?? null
        else if (v !== undefined && v !== '') val = isNaN(Number(v)) ? v : Number(v)
        l[k] = val
      })
      lignes[n] = Array.from(l, (x) => (x === undefined ? null : x))
    })
    return { nom: s.getAttribute('name'), lignes: Array.from(lignes, (x) => x || []) }
  })
}

/** Tableau (première ligne = en-têtes) → lignes { onglet, prenom, nom, organisation, emails, tels, adresse, sources, raison }. */
export function lignesBrutes(tableau) {
  const [ent, ...rows] = tableau
  const h = (ent || []).map(sa)
  const col = (...noms) => { for (const n of noms) { const i = h.indexOf(sa(n)); if (i > -1) return i } return -1 }
  const google = col('Given Name') > -1
  const v = (r, i) => (i > -1 ? r[i] : '')
  if (google) {
    const cNotes = col('Notes')
    return rows.map((r) => {
      const notes = texte(v(r, cNotes))
      return {
        onglet: (notes.match(/Onglet d.origine:\s*([^;]+)/i) || [])[1]?.trim() || '',
        prenom: texte(v(r, col('Given Name'))), nom: texte(v(r, col('Family Name'))),
        organisation: texte(v(r, col('Organization 1 - Name'))),
        emails: plusieurs(v(r, col('E-mail 1 - Value'))).concat(plusieurs(v(r, col('E-mail 2 - Value')))),
        tels: plusieurs(v(r, col('Phone 1 - Value'))).concat(plusieurs(v(r, col('Phone 2 - Value')))),
        adresse: { rue: texte(v(r, col('Address 1 - Street'))), cp: texte(v(r, col('Address 1 - Postal Code'))), ville: texte(v(r, col('Address 1 - City'))) },
        sources: ((notes.match(/Sources fusionn[ée]es:\s*([^;]+)/i) || [])[1] || '').split(',').map(texte).filter(Boolean),
        raison: ''
      }
    })
  }
  return rows.map((r) => ({
    onglet: texte(v(r, col('Onglet d’origine', "Onglet d'origine"))),
    prenom: texte(v(r, col('Prénom'))), nom: texte(v(r, col('Nom'))), organisation: '',
    emails: plusieurs(v(r, col('Email', 'E-mail'))), tels: plusieurs(v(r, col('Téléphone', 'Telephone'))),
    adresse: { rue: texte(v(r, col('Adresse'))), cp: texte(v(r, col('CP', 'Code postal'))), ville: texte(v(r, col('Ville'))) },
    sources: texte(v(r, col('Sources fusionnées'))).split(',').map(texte).filter(Boolean),
    raison: texte(v(r, col('Raison exclusion v3')))
  }))
}

export const deColmarSeulement = (l) => l.sources.length > 0 && l.sources.every((s) => /colmar/i.test(s))

/** Sépare « Régis Et Charlotte », « Philippe & Laura-Laure », « Quentin Et Laure Araud », « Bernard Et Mme ». */
export function separerPrenoms(prenom, nom) {
  const parts = texte(prenom).split(/\s+(?:&|et|\+)\s+|\s*\/\s*/i).map(texte).filter(Boolean)
  if (parts.length < 2) return null
  const n = sa(nom)
  return parts.map((p) => {
    let x = p
    if (n && sa(x).endsWith(' ' + n)) x = x.slice(0, x.length - nom.length).trim()   // « Laure Araud » → « Laure »
    const civ = CIVILITES[sa(x).replace(/\./g, '')]
    return civ ? { prenom: '', civilite: civ } : { prenom: x, civilite: '' }
  })
}

/** La personne dont le prénom figure dans l'adresse e-mail (sinon -1). */
function proprietaireMail(mail, personnes) {
  const local = sa(mail.split('@')[0]).replace(/[^a-z]/g, '')
  return personnes.findIndex((p) => { const pr = sa(p.prenom).split(/[\s-]/)[0].replace(/[^a-z]/g, ''); return pr.length > 2 && local.includes(pr) })
}

/**
 * Prépare les fiches à importer.
 * Renvoie { fiches: [{ cle, personnes:[{prenom, nom, civilite}], organisation, emails:[{v, a}], tels:[{v, a}], adresse, origine, couple, separer }], compte }
 * (a = indice de la personne à qui appartient la coordonnée)
 */
export function preparerImport(brutes, { sansColmar = true, date = new Date().toISOString().slice(0, 10) } = {}) {
  const compte = { lues: brutes.length, colmar: 0, vides: 0, couples: 0, organisations: 0 }
  const fiches = []
  brutes.forEach((l, i) => {
    if (sansColmar && deColmarSeulement(l)) { compte.colmar++; return }
    const emails = [...new Set(l.emails.map((m) => m.replace(/\s/g, '').toLowerCase()).filter(estMail))]
    const tels = [...new Set(l.tels.map(telephone).filter((t) => t.replace(/\D/g, '').length >= 9))]
    const adresse = { rue: l.adresse.rue, cp: l.adresse.cp, ville: titre(l.adresse.ville), pays: 'France' }
    const aAdresse = !!(adresse.rue || adresse.ville)
    if (!emails.length && !tels.length && !aAdresse) { compte.vides++; return }
    const origine = ('Import ' + date + (l.sources.length ? ' : ' + l.sources.join(', ') : '')).slice(0, 200)
    let organisation = l.organisation, prenom = l.prenom, nom = l.nom
    if (sa(l.onglet) === 'organisations') {
      organisation = organisation || nom
      if (/\d{4}/.test(prenom) || sa(prenom) === sa(nom) || sa(organisation).startsWith(sa(prenom) + ' ' + sa(prenom))) prenom = ''
      nom = ''
      compte.organisations++
    }
    const separes = !organisation ? separerPrenoms(prenom, nom) : null
    const personnes = separes ? separes.map((p) => ({ ...p, nom })) : [{ prenom, nom, civilite: '' }]
    const couple = personnes.length > 1
    if (couple) compte.couples++
    // à qui appartient chaque coordonnée : prénom dans l'adresse ; sinon la première personne
    // (deux portables pour deux personnes sans indice : un chacun, dans l'ordre — à vérifier dans l'aperçu)
    const em = emails.map((v) => ({ v, a: couple ? Math.max(0, proprietaireMail(v, personnes)) : 0 }))
    const mobiles = tels.filter((t) => !estFixe(t))
    const tl = tels.map((v) => ({ v, a: couple && !estFixe(v) && mobiles.length === personnes.length ? mobiles.indexOf(v) : 0 }))
    fiches.push({ cle: 'l' + i, personnes, organisation, emails: em, tels: tl, adresse: aAdresse ? adresse : null, origine, couple, separer: couple, nomOriginal: [prenom, nom].filter(Boolean).join(' ') })
  })
  return { fiches, compte }
}

/** Fiches validées → lignes envoyées au serveur (un couple séparé : une ligne par personne, même clé de foyer). */
export function versLignes(fiches) {
  const out = []
  fiches.forEach((f) => {
    if (f.couple && !f.separer) {
      out.push({ prenom: f.personnes.map((p) => p.prenom || p.civilite).filter(Boolean).join(' et '), nom: f.personnes[0].nom, organisation: f.organisation,
        emails: f.emails.map((x) => x.v), tels: f.tels.map((x) => x.v), adresse: f.adresse, origine: f.origine })
      return
    }
    f.personnes.forEach((p, i) => {
      out.push({ prenom: p.prenom, nom: p.nom, civilite: p.civilite, organisation: f.organisation,
        emails: f.emails.filter((x) => x.a === i).map((x) => x.v), tels: f.tels.filter((x) => x.a === i).map((x) => x.v),
        adresse: f.adresse, origine: f.origine, foyer: f.couple ? f.cle : undefined })
    })
  })
  return out
}

/** Lots pour l'envoi : les membres d'un même couple restent ensemble. */
export function lots(fiches, taille = 150) {
  const r = []; let cur = [], n = 0
  fiches.forEach((f) => {
    const l = versLignes([f])
    if (n + l.length > taille && cur.length) { r.push(cur); cur = []; n = 0 }
    cur = cur.concat(l); n += l.length
  })
  if (cur.length) r.push(cur)
  return r
}
