// Catéchuménat › Catéchumènes : catéchumènes en chemin (par année des sacrements) et néophytes de l'année.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Mail, FileSpreadsheet, Phone, CalendarDays, FolderHeart, Loader2, Users } from 'lucide-react'
import { api, precharger } from '../api.js'
import { useApp } from '../App.jsx'
import { Chargement, Erreur, Vide, useCharger, useNotif, dateCourte } from '../ui.jsx'
import { ALERTES, TYPES, anneeSacrements, documentsManquants, estOptionnel, etapesDe, prochaineEtape } from '../types.js'
import { Redaction } from '../pages/Courrier.jsx'

const UN_AN = 365 * 86400000
/** Néophyte de l'année : sacrements reçus depuis moins d'un an. */
export function estNeophyte(d, maintenant = Date.now()) {
  const date = d.date_celebration ? new Date(d.date_celebration).getTime() : null
  if (date) return date <= maintenant && maintenant - date < UN_AN
  return d.etapes.includes('sacrements') && maintenant - new Date(d.maj_le || d.cree_le).getTime() < UN_AN
}
const enChemin = (d) => d.etat === 'ouvert' && !estNeophyte(d) && !d.etapes.includes('sacrements')
const telLien = (t) => 'tel:' + String(t || '').replace(/[^\d+]/g, '')

export default function ListeCatechumenes() {
  const { ecrit } = useApp()
  const notifier = useNotif()
  const { data, chargement, erreur, recharger } = useCharger(() => api('dossiers.liste', {}), [], ['dossiers.liste', {}])
  const [annee, setAnnee] = useState('')          // '' = toutes ; 'neophytes' ; 'aucune' ; '2027'…
  const [texte, setTexte] = useState('')
  const [mail, setMail] = useState(false)
  const [exporte, setExporte] = useState(false)

  const tous = (data || []).filter((d) => d.type === 'catechumene')
  const chemin = tous.filter(enChemin), neophytes = tous.filter((d) => estNeophyte(d))
  const annees = [...new Set(chemin.map(anneeSacrements).filter(Boolean))].sort()
  const sansAnnee = chemin.filter((d) => !anneeSacrements(d)).length
  const cherche = (d) => !texte || `${d.nom} ${d.email} ${d.telephone} ${d.liste?.prenom_bapteme || ''}`.toLowerCase().includes(texte.toLowerCase())
  // Groupes affichés
  const groupes = []
  if (annee !== 'neophytes') {
    for (const a of [...annees, '']) {
      if (annee && annee !== (a || 'aucune')) continue
      const l = chemin.filter((d) => (anneeSacrements(d) || '') === a && cherche(d)).sort((x, y) => x.nom.localeCompare(y.nom))
      if (l.length) groupes.push({ cle: a || 'aucune', titre: a ? `Sacrements ${a}` : 'Année non fixée', liste: l })
    }
  }
  if (!annee || annee === 'neophytes') {
    const l = neophytes.filter(cherche).sort((x, y) => String(y.date_celebration).localeCompare(String(x.date_celebration)))
    if (l.length) groupes.push({ cle: 'neophytes', titre: 'Néophytes de l\'année', sous: 'baptisés depuis moins d\'un an', liste: l })
  }
  const visibles = groupes.flatMap((g) => g.liste)
  const avecMail = visibles.filter((d) => d.email)
  const nomSelection = annee === 'neophytes' ? 'néophytes' : annee === 'aucune' ? 'catéchumènes sans année fixée' : annee ? `catéchumènes (sacrements ${annee})` : 'catéchumènes et néophytes'

  async function exporter() {
    setExporte(true)
    try {
      const lignes = await api('catechumenat.export', { ids: visibles.map((d) => d.id) })
      const { default: ecrireXlsx } = await import('write-excel-file/browser')
      const t = TYPES.catechumene
      // Intitulés précisés par leur rubrique quand ils seraient ambigus (« Nom » du parrain, « Acte n° » du baptême…)
      const PRECISER = ['Parrain / marraine', 'Baptême', 'Entrée en catéchuménat (B6)']
      const champs = t.sections.flatMap((s) => s.champs.map((c) => ({ ...c, label: PRECISER.includes(s.titre) ? `${s.titre.replace(/ \(B6\)$/, '')} – ${c.label}` : c.label }))).filter((c) => c.cle !== 'message')
      const ordre = Object.fromEntries(visibles.map((d, i) => [d.id, i]))
      lignes.sort((a, b) => ordre[a.id] - ordre[b.id])
      const entete = ['Nom', 'Groupe', 'Étape en cours', 'Étapes faites', 'E-mail', 'Téléphone', 'Date des sacrements', ...champs.map((c) => c.label)]
      const groupeDe = (id) => groupes.find((g) => g.liste.some((d) => d.id === id))?.titre || ''
      const corps = lignes.map((x) => {
        const et = etapesDe('catechumene', x.infos), suiv = prochaineEtape('catechumene', x.etapes, x.infos)
        const faites = et.filter((e) => !estOptionnel(e, x.infos) && x.etapes.includes(e.cle)).length, total = et.filter((e) => !estOptionnel(e, x.infos)).length
        return [x.nom, groupeDe(x.id), suiv ? suiv.label : 'Toutes les étapes faites', `${faites}/${total}`, x.email, x.telephone, x.date_celebration ? new Date(x.date_celebration).toLocaleDateString('fr-FR') : '',
          ...champs.map((c) => String(x.infos[c.cle] ?? ''))]
      })
      const cellule = (v, gras) => ({ value: String(v ?? ''), type: String, fontWeight: gras ? 'bold' : undefined, wrap: false })
      await ecrireXlsx([entete.map((v) => cellule(v, true)), ...corps.map((r) => r.map((v) => cellule(v)))], {
        sheet: 'Catéchumènes', stickyRowsCount: 1,
        columns: entete.map((h, i) => ({ width: i === 0 ? 28 : Math.min(40, Math.max(12, h.length + 2)) }))
      }).toFile(`Catéchumènes ${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.xlsx`)
    } catch (e) { notifier(e.message, 'erreur') } finally { setExporte(false) }
  }

  if (chargement && !data) return <Chargement />
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setAnnee('')} className={`pastille border py-1 ${!annee ? 'border-or bg-or text-white' : 'border-or/40 bg-white text-or-600'}`}>Tous <span className="ml-1 opacity-70">{chemin.length + neophytes.length}</span></button>
        {annees.map((a) => <button key={a} onClick={() => setAnnee(a)} className={`pastille border py-1 ${annee === a ? 'border-or bg-or text-white' : 'border-or/40 bg-white text-or-600'}`}>Sacrements {a} <span className="ml-1 opacity-70">{chemin.filter((d) => anneeSacrements(d) === a).length}</span></button>)}
        {sansAnnee > 0 && <button onClick={() => setAnnee('aucune')} className={`pastille border py-1 ${annee === 'aucune' ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>Année non fixée <span className="ml-1 opacity-70">{sansAnnee}</span></button>}
        {neophytes.length > 0 && <button onClick={() => setAnnee('neophytes')} className={`pastille border py-1 ${annee === 'neophytes' ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>Néophytes <span className="ml-1 opacity-70">{neophytes.length}</span></button>}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-nuit-600/50" />
          <input className="champ pl-9" placeholder="Nom, prénom de baptême, e-mail, téléphone…" value={texte} onChange={(e) => setTexte(e.target.value)} /></div>
        <button className="btn-clair" disabled={!avecMail.length || !ecrit('dossiers', 'catechumene')} onClick={() => setMail(true)} title={`Un mail personnel à chacun (${avecMail.length})`}><Mail className="h-4 w-4" />Écrire à {visibles.length > 1 ? `ces ${avecMail.length}` : 'ce catéchumène'}</button>
        <button className="btn-clair" disabled={!visibles.length || exporte} onClick={exporter}>{exporte ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}<span className="hidden sm:inline">Tableur</span></button>
      </div>
      <Erreur erreur={erreur} reessayer={recharger} />
      {!groupes.length ? <div className="carte"><Vide icone={Users} texte={texte ? 'Personne ne correspond.' : 'Aucun catéchumène pour le moment. Les dossiers « Catéchumène adulte » apparaissent ici.'} /></div> : (
        <div className="carte overflow-hidden">
          {groupes.map((g) => (
            <div key={g.cle}>
              <div className="flex items-baseline gap-2 bg-or-50 px-4 py-1.5"><span className="font-titre text-lg font-semibold text-or-600">{g.titre}</span>{g.sous && <span className="text-xs text-nuit-600/70">{g.sous}</span>}<span className="ml-auto text-xs text-nuit-600/60">{g.liste.length}</span></div>
              <div className="divide-y divide-nuit-50">{g.liste.map((d) => <Ligne key={d.id} d={d} neophyte={g.cle === 'neophytes'} />)}</div>
            </div>
          ))}
        </div>
      )}
      {mail && <Redaction mode="nouveau" sujet="" corps={'Bonjour {prenom},\n\n'}
        destinataires={`Un mail personnel à chacun des ${avecMail.length} ${nomSelection} qui ont une adresse ({prenom} est rempli pour chacun)${visibles.length > avecMail.length ? ` — ${visibles.length - avecMail.length} sans adresse` : ''}`}
        envoiPersonnalise={({ sujet, corps, signature }) => api('catechumenat.mail', { ids: avecMail.map((d) => d.id), sujet, corps, signature })}
        onFermer={() => setMail(false)} onEnvoye={(r) => { setMail(false); notifier(`Envoyé à ${r?.nb} personne${r?.nb > 1 ? 's' : ''}`) }} />}
    </>
  )
}

function Ligne({ d, neophyte }) {
  const t = TYPES.catechumene
  const prochaine = prochaineEtape(d.type, d.etapes, d), manquants = documentsManquants(d.type, d.documents, d).length
  const et = etapesDe(d.type, d), total = et.filter((e) => !estOptionnel(e, d)).length, faites = et.filter((e) => !estOptionnel(e, d) && d.etapes.includes(e.cle)).length
  const futur = d.date_celebration && new Date(d.date_celebration) > new Date()
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-nuit-50/40">
      <Link to={`/dossiers/${d.id}`} onPointerEnter={() => precharger('dossiers.lire', { id: d.id })} onTouchStart={() => precharger('dossiers.lire', { id: d.id })} className="flex min-w-0 flex-1 items-center gap-3">
        {d.photo ? <img src={d.photo} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-or-50 font-titre text-lg font-semibold text-or-600">{(d.nom.match(/\p{L}/u) || ['?'])[0]}</span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-nuit">{d.nom}{d.liste?.prenom_bapteme && <span className="font-normal text-nuit-600"> · {d.liste.prenom_bapteme}</span>}</span>
          <span className="block truncate text-xs text-nuit-600/70">{neophyte ? 'Néophyte' : prochaine ? '→ ' + prochaine.label : 'Toutes les étapes faites'}{manquants > 0 && !neophyte ? ` · ${manquants} document${manquants > 1 ? 's' : ''} manquant${manquants > 1 ? 's' : ''}` : ''}</span>
          {!neophyte && <span className="mt-1 flex items-center gap-2"><span className="block h-1.5 w-28 overflow-hidden rounded-full bg-nuit-50"><span className="block h-full rounded-full" style={{ width: `${total ? (faites / total) * 100 : 0}%`, background: t.couleur }} /></span><span className="text-[11px] text-nuit-600/60">{faites}/{total}</span>
            {d.alertes?.map((a) => <span key={a} className={`pastille py-0 text-[10px] ${ALERTES[a]?.classe}`}>{ALERTES[a]?.nom}</span>)}</span>}
        </span>
        {d.date_celebration && <span className={`hidden shrink-0 text-right text-xs sm:block ${futur ? 'text-nuit' : 'text-nuit-600/70'}`}><span className="inline-flex items-center gap-1 font-medium"><CalendarDays className="h-3.5 w-3.5 text-or" />{dateCourte(d.date_celebration)}</span>{d.liste?.lieu && <span className="block max-w-[11rem] truncate text-nuit-600/60">{d.liste.lieu}</span>}</span>}
      </Link>
      {d.telephone ? <a href={telLien(d.telephone)} className="btn-icone shrink-0 text-or-600" title={`Appeler ${d.telephone}`} aria-label={`Appeler ${d.nom}`}><Phone className="h-4 w-4" /><span className="ml-1 hidden text-xs lg:inline">{d.telephone}</span></a> : <span className="w-9 shrink-0" />}
      <Link to={`/dossiers/${d.id}`} className="hidden shrink-0 text-nuit-600/40 hover:text-or-600 sm:block" title="Ouvrir le dossier"><FolderHeart className="h-4 w-4" /></Link>
    </div>
  )
}
