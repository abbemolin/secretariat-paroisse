// Relevé des messes célébrées, par prêtre et par période (honoraires de messe) : PDF et tableur.
import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { useApp } from '../App.jsx'
import { Modale } from '../ui.jsx'
import { MOIS, celebrants, dateCourte, heureFr, nomCelebrant } from './donnees.js'

const deux = (n) => String(n).padStart(2, '0')

export default function Releve({ intentions, onFermer }) {
  const { utilisateurs } = useApp()
  const now = new Date()
  const [sorte, setSorte] = useState('mois')
  const [annee, setAnnee] = useState(now.getFullYear())
  const [mois, setMois] = useState(now.getMonth() + 1)
  const [du, setDu] = useState(`${now.getFullYear()}-01-01`)
  const [au, setAu] = useState(`${now.getFullYear()}-${deux(now.getMonth() + 1)}-${deux(now.getDate())}`)
  const [pretre, setPretre] = useState('')
  const [debut, fin] = sorte === 'mois' ? [`${annee}-${deux(mois)}-01`, `${annee}-${deux(mois)}-${deux(new Date(annee, mois, 0).getDate())}`]
    : sorte === 'annee' ? [`${annee}-01-01`, `${annee}-12-31`] : [du, au]
  const titrePeriode = sorte === 'mois' ? `${MOIS[mois - 1]} ${annee}` : sorte === 'annee' ? `année ${annee}` : `du ${du.split('-').reverse().join('/')} au ${au.split('-').reverse().join('/')}`

  const lignes = useMemo(() => intentions
    .filter((i) => i.statut === 'valide' && i.celebrant && i.date_messe >= debut && i.date_messe <= fin && (!pretre || i.celebrant === pretre))
    .sort((a, b) => (nomCelebrant(a.celebrant, utilisateurs) + a.date_messe + a.heure_messe).localeCompare(nomCelebrant(b.celebrant, utilisateurs) + b.date_messe + b.heure_messe)),
  [intentions, debut, fin, pretre, utilisateurs])
  const totaux = {}
  lignes.forEach((i) => { const n = nomCelebrant(i.celebrant, utilisateurs); totaux[n] = (totaux[n] || 0) + 1 })
  const nomFichier = `Messes célébrées ${titrePeriode}${pretre ? ' ' + nomCelebrant(pretre, utilisateurs) : ''}`

  function tableur() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = ['Célébrant;Date;Heure;Intention;Type;Demandeur;Déclarée le',
      ...lignes.map((i) => [nomCelebrant(i.celebrant, utilisateurs), i.date_messe.split('-').reverse().join('/'), heureFr(i.heure_messe), i.nom_intention, i.type_intention, i.nom_donateur,
        i.celebre_le ? new Date(i.celebre_le).toLocaleDateString('fr-FR') : ''].map(esc).join(';'))].join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = nomFichier + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }
  async function pdf() {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const propre = (t) => String(t || '').replace(/[^\u0000-ÿŒœ’–—]/g, (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, ''))   // eslint-disable-line no-control-regex
    let y = 18
    const titre = () => {
      doc.setFont('times', 'bold'); doc.setFontSize(15); doc.setTextColor(82, 26, 34)
      doc.text(propre(`Messes célébrées — ${titrePeriode}`), 14, y)
      doc.setFont('times', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 100, 100)
      doc.text('Paroisse La Croix glorieuse', 196, y, { align: 'right' }); y += 8
    }
    titre()
    let courant = null
    for (const i of lignes) {
      const n = nomCelebrant(i.celebrant, utilisateurs)
      if (y > 280) { doc.addPage(); y = 18; titre() }
      if (n !== courant) {
        courant = n; y += 2
        doc.setFont('times', 'bold'); doc.setFontSize(11.5); doc.setTextColor(82, 26, 34)
        doc.text(propre(`${n} — ${totaux[n]} messe${totaux[n] > 1 ? 's' : ''}`), 14, y); y += 6
      }
      doc.setFont('times', 'normal'); doc.setFontSize(9.5); doc.setTextColor(50, 40, 40)
      doc.text(propre(`${i.date_messe.split('-').reverse().join('/')}  ${heureFr(i.heure_messe)}`), 16, y)
      doc.text(doc.splitTextToSize(propre(`${i.nom_intention} (${i.type_intention})`), 110)[0], 50, y)
      doc.text(doc.splitTextToSize(propre(i.nom_donateur || ''), 34)[0], 196, y, { align: 'right' })
      y += 5
    }
    y += 4; doc.setFont('times', 'bold'); doc.setFontSize(11); doc.text(propre(`Total : ${lignes.length} messe${lignes.length > 1 ? 's' : ''}`), 14, Math.min(y, 290))
    doc.save(nomFichier + '.pdf')
  }

  return (
    <Modale titre="Relevé des messes célébrées" onFermer={onFermer} large
      pied={<><button className="btn-clair mr-auto" onClick={onFermer}>Fermer</button>
        <button className="btn-clair" disabled={!lignes.length} onClick={tableur}><FileSpreadsheet className="h-4 w-4" />Tableur</button>
        <button className="btn-principal" disabled={!lignes.length} onClick={pdf}><Download className="h-4 w-4" />PDF</button></>}>
      <div className="grid gap-3 sm:grid-cols-4">
        <div><label className="etiquette">Période</label><select className="champ" value={sorte} onChange={(e) => setSorte(e.target.value)}><option value="mois">Un mois</option><option value="annee">Une année</option><option value="dates">Entre deux dates</option></select></div>
        {sorte === 'mois' && <div><label className="etiquette">Mois</label><select className="champ" value={mois} onChange={(e) => setMois(+e.target.value)}>{MOIS.map((m, k) => <option key={k} value={k + 1}>{m}</option>)}</select></div>}
        {sorte !== 'dates' && <div><label className="etiquette">Année</label><input type="number" className="champ" value={annee} onChange={(e) => setAnnee(+e.target.value)} /></div>}
        {sorte === 'dates' && <><div><label className="etiquette">Du</label><input type="date" className="champ" value={du} onChange={(e) => setDu(e.target.value)} /></div>
          <div><label className="etiquette">Au</label><input type="date" className="champ" value={au} onChange={(e) => setAu(e.target.value)} /></div></>}
        <div><label className="etiquette">Prêtre</label><select className="champ" value={pretre} onChange={(e) => setPretre(e.target.value)}><option value="">Tous</option>{celebrants(utilisateurs).map((c) => <option key={c.cle} value={c.cle}>{c.nom}</option>)}</select></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{Object.entries(totaux).map(([n, t]) => <span key={n} className="pastille bg-or-50 text-or-600">{n} : {t}</span>)}<span className="pastille bg-nuit-50 text-nuit">Total : {lignes.length}</span></div>
      <div className="mt-3 max-h-[45vh] overflow-y-auto rounded-xl border border-nuit-100">
        {!lignes.length ? <p className="p-3 text-sm text-nuit-600">Aucune messe déclarée célébrée sur cette période.</p> : (
          <table className="w-full text-sm"><tbody>{lignes.map((i) => (
            <tr key={i.id} className="border-b border-nuit-50"><td className="whitespace-nowrap px-2 py-1.5 text-nuit-600">{dateCourte(i.date_messe)} {heureFr(i.heure_messe)}</td><td className="px-2 py-1.5">{i.nom_intention}</td><td className="hidden px-2 py-1.5 text-nuit-600 sm:table-cell">{nomCelebrant(i.celebrant, utilisateurs)}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </Modale>
  )
}
