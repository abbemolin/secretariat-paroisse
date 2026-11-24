// Ordo du mois en PDF A4 (texte, plusieurs pages), pour l'afficher à la sacristie.
import { jsPDF } from 'jspdf'
import { CLASSE_COURTE, COULEURS } from './ordo.js'

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
// Les polices de base du PDF ne connaissent que l'alphabet latin courant
const propre = (t) => String(t || '').replace(/ǽ/g, 'æ').replace(/Ǽ/g, 'Æ').replace(/[✝✠]/g, '+').replace(/[℣]/g, 'V.').replace(/[℟]/g, 'R.')
  .replace(/[^\u0000-ÿŒœ‘’“”–—…€]/g, (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, ''))
const rvb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

export async function pdfOrdo(annee, mois, jours, details, messes) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const G = 14, D = 196, LARGE = D - G - 34
  let y = 0, page = 0
  const entete = () => {
    page++
    doc.setFont('times', 'bold'); doc.setFontSize(16); doc.setTextColor(82, 26, 34)
    doc.text(propre(`Ordo · ${MOIS[mois - 1]} ${annee}`), G, 16)
    doc.setFont('times', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 100, 100)
    doc.text('La Croix glorieuse — rubriques de 1960, calendrier propre', D, 16, { align: 'right' })
    doc.setDrawColor(208, 140, 76); doc.line(G, 19, D, 19)
    y = 26
  }
  const pied = () => { doc.setFontSize(8); doc.setTextColor(150, 140, 140); doc.text(`${page}`, D, 290, { align: 'right' }) }
  entete()
  for (const j of jours) {
    const x = details[j.iso] || {}
    const lignes = []
    const messe = x.messe ? 'Messe : ' + [x.messe.gloria ? 'Gloria' : 'sans Gloria', x.messe.credo ? 'Credo' : null, x.messe.preface ? 'Préface ' + x.messe.preface : null].filter(Boolean).join(' · ') : ''
    const l1 = [messe, x.vepres].filter(Boolean).join(' — ')
    if (l1) lignes.push([l1, 'normal'])
    if (j.comm) lignes.push([j.comm, 'italic'])
    const pen = [j.obligation, j.actuelle, j.ancienne ? '1962 : ' + j.ancienne : ''].filter(Boolean).join(' · ')
    if (pen) lignes.push([pen, 'bold'])
    const h = (messes[j.iso] || []).map((m) => `${m.heure} ${m.label}`).join(' · ')
    if (h) lignes.push([h, 'normal'])
    // Hauteur du bloc
    doc.setFont('times', 'bold'); doc.setFontSize(10.5)
    const titre = doc.splitTextToSize(propre(j.fete), LARGE - 16)
    doc.setFontSize(8.8)
    const corps = lignes.map(([t, s]) => { doc.setFont('times', s); return [doc.splitTextToSize(propre(t), LARGE), s] })
    const haut = titre.length * 4.2 + corps.reduce((n, [l]) => n + l.length * 3.5, 0) + 2
    if (y + haut > 284) { pied(); doc.addPage(); entete() }
    // Pastille de couleur, date, fête, rang
    doc.setFillColor(...rvb(COULEURS[j.couleur] || '#cccccc')); doc.setDrawColor(180, 170, 170); doc.circle(G + 1.5, y - 1.2, 1.4, 'FD')
    doc.setFont('times', j.dow === 0 ? 'bold' : 'normal'); doc.setFontSize(10); doc.setTextColor(60, 40, 44)
    doc.text(propre(`${JOURS[j.dow].slice(0, 3)}. ${j.d}`), G + 5, y)
    doc.setFont('times', 'bold'); doc.setFontSize(10.5); doc.setTextColor(82, 26, 34)
    doc.text(titre, G + 34, y)
    doc.setFont('times', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 100, 100)
    doc.text(CLASSE_COURTE[j.classe] || j.classe || '', D, y, { align: 'right' })
    y += titre.length * 4.2
    doc.setFontSize(8.8)
    for (const [l, s] of corps) {
      doc.setFont('times', s); doc.setTextColor(s === 'bold' ? 140 : 70, s === 'bold' ? 30 : 55, s === 'bold' ? 30 : 58)
      doc.text(l, G + 34, y - 0.6); y += l.length * 3.5
    }
    doc.setDrawColor(236, 216, 219); doc.line(G, y - 1, D, y - 1)
    y += 3.6
  }
  pied()
  doc.save(`Ordo ${MOIS[mois - 1]} ${annee}.pdf`)
}
