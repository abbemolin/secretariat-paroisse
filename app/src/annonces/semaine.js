// Feuille de semaine : reprise du fonctionnement de calendrier_semaine.html (AppMesse).
// Construction des 7 jours (ordo 1962 + agenda public + intentions validées), calendrier HTML de la newsletter, Word.
import Ordo1962 from './ordo1962.js'

export const JOURS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
export const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
/** AAAA-MM-JJ en heure locale (pas UTC). */
export function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function lundiDe(d) {
  const date = new Date(d)
  date.setHours(12, 0, 0, 0)
  const dow = date.getDay()
  date.setDate(date.getDate() + (dow === 0 ? -6 : 1 - dow))
  return isoLocal(date)
}
export function decalerSemaine(lundi, n) {
  const d = new Date(lundi + 'T12:00:00'); d.setDate(d.getDate() + n * 7); return isoLocal(d)
}
export function libelleSemaine(lundi) {
  const l = new Date(lundi + 'T12:00:00'), dim = new Date(l); dim.setDate(l.getDate() + 6)
  const f = (d) => d.getDate() + ' ' + MOIS_FR[d.getMonth()]
  return `Lundi ${f(l)} → Dimanche ${f(dim)} ${dim.getFullYear()}`
}
/** Bornes envoyées au serveur pour l'agenda (heure locale). */
export function bornesSemaine(lundi) {
  const debut = new Date(lundi + 'T00:00:00')
  const fin = new Date(debut); fin.setDate(debut.getDate() + 6); fin.setHours(23, 59, 59)
  return { debut: debut.toISOString(), fin: fin.toISOString() }
}

function fmtHeure(dateTime) {
  const d = new Date(dateTime)
  const h = d.getHours(), m = d.getMinutes()
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}
function estMesse(label) { return /^(messe|grand'?messe)/i.test(label.trim()) }

/** Les 7 jours de la semaine, comme calendrier_semaine.html. */
export function construireSemaine(lundi, evenements, intentions) {
  const intentionsMap = {}
  ;(intentions || []).forEach((i) => {
    intentionsMap[i.date_messe + '_' + (i.heure_messe || '').substring(0, 5)] = i
    if (i.google_event_id) intentionsMap['id_' + i.google_event_id] = i
  })
  const l = new Date(lundi + 'T12:00:00')
  const jours = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(l); d.setDate(l.getDate() + i)
    const dow = d.getDay(), iso = isoLocal(d)
    const dateFr = `${JOURS_FR[dow]} ${d.getDate()} ${MOIS_FR[d.getMonth()]}`
    const ordoJour = Ordo1962.getDay(d.getFullYear(), d.getMonth() + 1, d.getDate()) || null
    const evtsJour = (evenements || [])
      .filter((e) => (e.start.dateTime || e.start.date || '').startsWith(iso))
      .sort((a, b) => (a.start.dateTime || a.start.date).localeCompare(b.start.dateTime || b.start.date))
    const AVEC_FIN = /adoration|confession/i
    const horaires = evtsJour.map((e) => {
      const hDebut = e.start.dateTime ? fmtHeure(e.start.dateTime) : ''
      const hFin = e.end && e.end.dateTime ? fmtHeure(e.end.dateTime) : ''
      const avecFin = AVEC_FIN.test(e.summary) && hFin && hFin !== hDebut
      const heure = avecFin ? hDebut + '–' + hFin : hDebut
      const messe = estMesse(e.summary)
      let label = (e.summary || '').trim()
      if (messe) {
        const hdb = e.start.dateTime
          ? String(new Date(e.start.dateTime).getHours()).padStart(2, '0') + ':' + String(new Date(e.start.dateTime).getMinutes()).padStart(2, '0')
          : ''
        const intention = intentionsMap['id_' + e.id] || intentionsMap[iso + '_' + hdb] || null
        if (intention) label += ' (' + intention.nom_intention + (/^d[ée]funt/i.test(intention.type_intention || '') ? ' ✝' : '') + ')'
      }
      return { heure, label, labelHtml: escHtml(label), bold: messe }
    })
    jours.push({ dateFr, iso, dow, sousTitre: ordoJour ? ordoJour.fete : null, couleur: ordoJour ? ordoJour.couleur : null, notes: [], horaires })
  }
  return jours
}

// Note : texte brut (anciennes versions) ou { html, textAlign }
export function noteHtml(n) { return typeof n === 'object' && n ? (n.html || '') : (typeof n === 'string' && n.includes('<') ? n : escHtml(n || '')) }
export function noteAlign(n) { return typeof n === 'object' && n ? (n.textAlign || '') : '' }

/** Calendrier au format de la newsletter (copierHTML de calendrier_semaine.html). */
export function calendrierHtml(semaineData) {
  const C_BLEU = '#023199', C_BEIGE = '#F7F2EA', C_BEIGE_DIM = '#EADFCC', C_TEXTE = '#333333', C_GRIS = '#6D6D6C', C_NOTE = '#8b2020'
  const FONT = 'font-family:Palatino,Georgia,serif;'
  const PASTILLE = { Blanc: ['○', '#9A8F7F'], Rouge: ['●', '#B3261E'], Vert: ['●', '#2E7D32'], Violet: ['●', '#6A1B9A'], Rose: ['●', '#D46A92'], Noir: ['●', '#222222'] }
  let html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="${FONT}max-width:600px;font-size:16px;line-height:1.4;">`
  semaineData.forEach((jour) => {
    const dimanche = jour.dow === 0 || /^dimanche/i.test(jour.dateFr || '')
    const fond = dimanche ? C_BEIGE_DIM : C_BEIGE
    const fete = jour.sousTitre || ''
    html += `<tr><td colspan="2" bgcolor="${fond}" style="background-color:${fond};border-left:4px solid ${C_BLEU};padding:9px 12px;">`
      + `<span style="font-weight:bold;color:${C_BLEU};font-size:17px;">${escHtml(jour.dateFr || '')}</span>`
    if (fete) {
      const p = PASTILLE[jour.couleur]
      const pastille = p ? `<span style="color:${p[1]};font-size:14px;" title="Couleur liturgique : ${escHtml(jour.couleur.toLowerCase())}">${p[0]}</span> ` : ''
      html += `<br>${pastille}<span style="color:${C_GRIS};font-size:14px;font-style:italic;">${escHtml(fete)}</span>`
    }
    html += '</td></tr>'
    html += '<tr><td colspan="2" style="font-size:1px;line-height:6px;">&nbsp;</td></tr>'
    ;(jour.notes || []).forEach((note) => {
      const nAlign = noteAlign(note)
      html += `<tr><td colspan="2" style="padding:3px 0 3px 16px;color:${C_NOTE};font-size:16px;font-style:italic;${nAlign ? `text-align:${nAlign};` : ''}">${noteHtml(note)}</td></tr>`
    })
    ;(jour.horaires || []).forEach((h) => {
      const labelContent = h.labelHtml || escHtml(h.label || '')
      let styleHeure, styleLabel
      if (h.bold) { styleHeure = `color:${C_BLEU};font-weight:bold;`; styleLabel = `color:${C_BLEU};font-weight:bold;` }
      else { styleHeure = `color:${C_GRIS};`; styleLabel = `color:${C_TEXTE};` }
      if (!h.heure) styleLabel = `color:${C_GRIS};font-style:italic;`
      const align = h.textAlign ? `text-align:${h.textAlign};` : ''
      html += `<tr><td width="84" valign="top" style="width:84px;padding:3px 0 3px 16px;font-size:15px;${styleHeure}white-space:nowrap;">${escHtml(h.heure || '')}</td>`
        + `<td valign="top" style="padding:3px 0;font-size:16px;${styleLabel}${align}">${labelContent}</td></tr>`
    })
    html += '<tr><td colspan="2" style="font-size:1px;line-height:18px;">&nbsp;</td></tr>'
  })
  return html + '</table>'
}

export function nomFichierSemaine(lundi) {
  const l = new Date(lundi + 'T12:00:00'), dim = new Date(l); dim.setDate(l.getDate() + 6)
  return `CALENDRIER_${l.getDate()}_${dim.getDate()}_${MOIS_FR[dim.getMonth()]}.docx`
}

/** Document Word du programme de la semaine (même mise en page que l'AppMesse). */
export async function docxSemaine(semaineData) {
  const D = await import('docx')
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, VerticalAlign } = D

  const htmlToRuns = (html, baseOpts = {}) => {
    const r = (text, opts = {}) => new TextRun({ text, font: 'Calibri', size: 24, color: '000000', ...baseOpts, ...opts })
    if (!html) return [r('')]
    const div = document.createElement('div')
    div.innerHTML = html
    const runs = []
    const walk = (node, inherited = {}) => {
      if (node.nodeType === Node.TEXT_NODE) { if (node.textContent) runs.push(r(node.textContent, { ...inherited })); return }
      if (node.nodeType !== Node.ELEMENT_NODE) return
      const tag = node.tagName.toLowerCase()
      const style = node.getAttribute('style') || ''
      const opts = { ...inherited }
      if (tag === 'strong' || tag === 'b') opts.bold = true
      if (tag === 'em' || tag === 'i') opts.italics = true
      if (tag === 'u') opts.underline = { type: 'single', color: '000000' }
      if (tag === 'span') {
        if (/font-weight\s*:\s*bold/i.test(style)) opts.bold = true
        if (/font-style\s*:\s*italic/i.test(style)) opts.italics = true
        if (/text-decoration[^;]*underline/i.test(style)) opts.underline = { type: 'single', color: '000000' }
        if (/text-transform\s*:\s*uppercase/i.test(style)) opts.allCaps = true
      }
      node.childNodes.forEach((c) => walk(c, opts))
    }
    div.childNodes.forEach((c) => walk(c, {}))
    return runs.length ? runs : [r('')]
  }

  const PAGE_W = 11906, PAGE_H = 16838, MARGIN_TB = 142, MARGIN_LR = 720
  const CONTENT_W = PAGE_W - 2 * MARGIN_LR
  const COL_WIDTHS = [322, 1143, 2174, 1903, 2882, 71, 36]
  const scale = CONTENT_W / COL_WIDTHS.reduce((a, b) => a + b, 0)
  const COLS = COL_WIDTHS.map((c) => Math.round(c * scale))
  COLS[COLS.length - 1] += CONTENT_W - COLS.reduce((a, b) => a + b, 0)
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }
  const cellMar = { top: 15, bottom: 15, left: 115, right: 115 }
  const cell = (children, span = 1) => new TableCell({
    width: { size: COLS.slice(0, span).reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnSpan: span, borders: noBorders, margins: cellMar, verticalAlign: VerticalAlign.CENTER, children
  })
  const para = (runs) => new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 0, line: 240 }, children: runs })
  const r = (text, opts = {}) => new TextRun({ text, font: 'Calibri', size: 24, color: '000000', ...opts })
  const ligne = (children) => new TableRow({ height: { value: 20, rule: 'auto' }, children })

  const tableRows = []
  semaineData.forEach((jour) => {
    const headRuns = [r(jour.dateFr + ' ', { bold: true })]
    if (jour.sousTitre) { headRuns.push(r('– ', { italics: true })); headRuns.push(r(jour.sousTitre, { italics: true })) }
    tableRows.push(ligne([cell([para(headRuns)], 5), cell([para([])], 1), cell([para([])], 1)]))
    jour.notes.forEach((note) => {
      const nPara = new Paragraph({ alignment: noteAlign(note) === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 0, line: 240 }, children: htmlToRuns(noteHtml(note), { italics: true }) })
      tableRows.push(ligne([cell([nPara], 5), cell([para([])], 1), cell([para([])], 1)]))
    })
    jour.horaires.forEach((evt) => {
      const lPara = new Paragraph({ alignment: evt.textAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 0, line: 240 }, children: htmlToRuns(evt.labelHtml || escHtml(evt.label || ''), { bold: evt.bold }) })
      tableRows.push(ligne([cell([para([])], 1), cell([para([r(evt.heure, { bold: evt.bold })])], 1), cell([lPara], 4), cell([para([])], 1)]))
    })
  })
  const table = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: COLS, rows: tableRows,
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder }
  })
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 24, color: '000000' } } } },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN_TB, right: MARGIN_LR, bottom: MARGIN_TB, left: MARGIN_LR } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80, line: 240 }, children: [new TextRun({ text: 'CALENDRIER DE LA SEMAINE', bold: true, font: 'Calibri', size: 32, color: '000000' })] }),
        table
      ]
    }]
  })
  return Packer.toBlob(doc)
}

export function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nom
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
