// Feuille de semaine : reprise de calendrier_semaine.html (AppMesse) dans l'interface du secrétariat.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileDown, Send, RotateCcw, GripVertical, X, Plus, Loader2, AlignCenter } from 'lucide-react'
import { api } from '../api.js'
import { Chargement, EnTete, Erreur, EtatEnregistrement, dateHeure, useConfirmer, useNotif } from '../ui.jsx'
import { chargerCalendrier } from '../liturgie/calendrier.js'
import { bornesSemaine, calendrierHtml, construireSemaine, decalerSemaine, docxSemaine, escHtml, libelleSemaine, lundiDe, noteAlign, noteHtml, nomFichierSemaine, telecharger } from '../annonces/semaine.js'

const COULEUR_DOT = { Blanc: '#d4af37', Rouge: '#9b2020', Vert: '#3a6644', Violet: '#5c2d7a', Rose: '#d4688a', Noir: '#1a1108' }

/** Texte modifiable sur place (comme l'AppMesse) : le contenu n'est relu qu'à la sortie du champ. */
function Editable({ html, className = '', style, vide, ...data }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.innerHTML !== html) el.innerHTML = html
  })
  return <span ref={ref} contentEditable suppressContentEditableWarning data-editable="1" {...data} spellCheck lang="fr"
    className={`rounded px-0.5 outline-none transition focus:bg-or-50 focus:ring-1 focus:ring-or/40 ${vide ? 'opacity-40' : ''} ${className}`} style={style} />
}

export default function Semaine() {
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const lundi = params.get('semaine') || lundiDe(new Date())
  const [donnees, setDonnees] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [jours, setJours] = useState(null)
  const [etat, setEtat] = useState('')
  const [occupe, setOccupe] = useState('')
  const [barre, setBarre] = useState(null)        // { x, y } de la barre de mise en forme
  const [glisse, setGlisse] = useState(null)      // { type, jour, idx, x, y, texte, dest: { jour, idx } }
  const touche = useRef(false)
  const actif = useRef(null)
  const zone = useRef(null)

  const changerSemaine = (l) => setParams(l === lundiDe(new Date()) ? {} : { semaine: l })

  // Chargement : semaine préparée (partagée) s'il y en a une, sinon construite depuis l'agenda
  useEffect(() => {
    let annule = false
    setDonnees(null); setJours(null); setErreur(null); setEtat(''); touche.current = false
    Promise.all([api('newsletter.semaine', { lundi, ...bornesSemaine(lundi) }), chargerCalendrier()]).then(([d]) => {
      if (annule) return
      setDonnees(d)
      setJours(d.preparee?.jours?.length === 7 ? d.preparee.jours : construireSemaine(lundi, d.evenements, d.intentions))
    }).catch((e) => !annule && setErreur(e))
    return () => { annule = true }
  }, [lundi])

  // Enregistrement partagé de la semaine préparée
  useEffect(() => {
    if (!jours || !touche.current) return
    setEtat('encours')
    const t = setTimeout(() => {
      api('newsletter.semaineEcrire', { lundi, jours }).then(() => setEtat('ok')).catch(() => setEtat('erreur'))
    }, 1200)
    return () => clearTimeout(t)
  }, [jours, lundi])

  function modifier(fn) {
    touche.current = true
    setJours((js) => { const x = structuredClone(js); fn(x); return x })
  }
  // Champ modifiable → données (comme syncElToData)
  function synchroniser(el) {
    const j = Number(el.dataset.jour), champ = el.dataset.champ
    const jr = jours?.[j]
    if (!jr) return
    const txt = el.innerText.trim(), aligne = el.style.textAlign || ''
    const e0 = jr.horaires[Number(el.dataset.evt)], n0 = jr.notes[Number(el.dataset.note)]
    const inchange = champ === 'dateFr' ? jr.dateFr === txt
      : champ === 'sousTitre' ? (jr.sousTitre || '') === (txt === '—' ? '' : txt)
        : champ === 'heure' ? e0?.heure === txt
          : champ === 'label' ? e0 && (e0.labelHtml || escHtml(e0.label)) === el.innerHTML && (e0.textAlign || '') === aligne
            : champ === 'note' ? noteHtml(n0) === el.innerHTML && noteAlign(n0) === aligne : true
    if (inchange) return
    modifier((x) => {
      const jour = x[j]
      if (champ === 'dateFr') jour.dateFr = el.innerText.trim()
      else if (champ === 'sousTitre') jour.sousTitre = el.innerText.trim() === '—' ? '' : el.innerText.trim()
      else if (champ === 'heure') { const e = jour.horaires[Number(el.dataset.evt)]; if (e) e.heure = el.innerText.trim() }
      else if (champ === 'label') { const e = jour.horaires[Number(el.dataset.evt)]; if (e) { e.labelHtml = el.innerHTML; e.textAlign = el.style.textAlign || '' } }
      else if (champ === 'note') { const n = Number(el.dataset.note); if (jour.notes[n] !== undefined) jour.notes[n] = { html: el.innerHTML, textAlign: el.style.textAlign || '' } }
    })
  }

  // Barre de mise en forme au-dessus de la sélection
  useEffect(() => {
    const surSelection = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) { setBarre(null); return }
      const n = sel.anchorNode
      const ce = n && (n.nodeType === 3 ? n.parentElement : n).closest?.('[data-editable]')
      if (!ce || !zone.current?.contains(ce)) { setBarre(null); return }
      actif.current = ce
      const r = sel.getRangeAt(0).getBoundingClientRect()
      setBarre({ x: r.left + r.width / 2, y: r.top })
    }
    document.addEventListener('selectionchange', surSelection)
    return () => document.removeEventListener('selectionchange', surSelection)
  }, [])
  function formater(type) {
    const el = actif.current
    if (!el) return
    if (type === 'caps') {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) return
      const t = sel.toString()
      document.execCommand('insertText', false, t === t.toUpperCase() ? t.toLowerCase() : t.toUpperCase())
    } else if (type === 'centre') el.style.textAlign = el.style.textAlign === 'center' ? '' : 'center'
    else document.execCommand(type, false, null)
    synchroniser(el)
  }

  const ajouterLigne = (j) => modifier((x) => { x[j].horaires.push({ heure: '', label: 'Nouvel événement', labelHtml: 'Nouvel événement', bold: false }) })
  const ajouterNote = (j) => modifier((x) => { x[j].notes.push({ html: 'Note…', textAlign: '' }) })
  const supprimerLigne = (j, i) => modifier((x) => { x[j].horaires.splice(i, 1) })
  const supprimerNote = (j, i) => modifier((x) => { x[j].notes.splice(i, 1) })

  // Glisser-déposer d'un événement ou d'une note vers un autre jour (souris et doigt)
  function destination(x, y, type) {
    const jourEl = document.elementFromPoint(x, y)?.closest('[data-zone-jour]')
    if (!jourEl) return null
    const items = [...jourEl.querySelectorAll(`[data-glisse="${type}"]`)]
    let idx = items.length
    for (let i = 0; i < items.length; i++) { const r = items[i].getBoundingClientRect(); if (y < r.top + r.height / 2) { idx = i; break } }
    return { jour: Number(jourEl.dataset.zoneJour), idx }
  }
  function debutGlisse(e, type, j, i, texte) {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setGlisse({ type, jour: j, idx: i, x: e.clientX, y: e.clientY, texte, dest: null })
  }
  function mouvementGlisse(e) { if (glisse) setGlisse({ ...glisse, x: e.clientX, y: e.clientY, dest: destination(e.clientX, e.clientY, glisse.type) }) }
  function finGlisse() {
    const g = glisse
    setGlisse(null)
    if (!g?.dest) return
    const { type, jour: js, idx: is } = g, { jour: jd, idx: id } = g.dest
    const liste = type === 'evt' ? 'horaires' : 'notes'
    modifier((x) => {
      const [item] = x[js][liste].splice(is, 1)
      const reel = js === jd && is < id ? Math.max(0, id - 1) : id
      x[jd][liste].splice(reel, 0, item)
    })
    notifier(js === jd ? 'Réorganisé' : `Déplacé vers ${jours[jd].dateFr.split(' ')[0]}`)
  }
  const poignee = (type, j, i, texte) => ({
    onPointerDown: (e) => debutGlisse(e, type, j, i, texte), onPointerMove: mouvementGlisse, onPointerUp: finGlisse, onPointerCancel: () => setGlisse(null)
  })

  async function repartir() {
    if (!(await confirmer({ titre: 'Repartir de l\'agenda', texte: 'Les retouches de cette semaine (lignes ajoutées, notes, textes modifiés) seront perdues, pour tout le monde.', bouton: 'Repartir de l\'agenda', danger: true }))) return
    setOccupe('agenda')
    try {
      const d = await api('newsletter.semaine', { lundi, ...bornesSemaine(lundi) })
      await api('newsletter.semaineEcrire', { lundi, effacer: true })
      touche.current = false
      setDonnees({ ...d, preparee: null }); setJours(construireSemaine(lundi, d.evenements, d.intentions)); setEtat('')
      notifier('Semaine reconstruite depuis l\'agenda')
    } catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }
  async function genererWord() {
    setOccupe('docx')
    try { telecharger(await docxSemaine(jours), nomFichierSemaine(lundi)); notifier('Document Word téléchargé') }
    catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }
  async function versNewsletter() {
    setOccupe('nl')
    try {
      await api('newsletter.semaineEcrire', { lundi, jours, html: calendrierHtml(jours) })
      touche.current = false; setEtat('ok')
      notifier('Calendrier envoyé vers la newsletter', 'ok', { action: { label: 'Ouvrir', fn: () => nav('/newsletter?semaine=' + lundi) } })
    } catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }

  const courant = lundi === lundiDe(new Date())
  const prep = donnees?.preparee
  return (
    <div>
      <EnTete titre="Feuille de semaine" sousTitre="Programme de la semaine : agenda public, fête du jour et intentions de messe"
        actions={<>
          <button className="btn-clair" disabled={!jours || !!occupe} onClick={genererWord}>{occupe === 'docx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}Générer le .docx</button>
          <button className="btn-principal" disabled={!jours || !!occupe} onClick={versNewsletter}>{occupe === 'nl' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Envoyer vers la newsletter</button>
        </>} />

      <div className="carte mb-4 flex flex-wrap items-center gap-2 p-3">
        <button className="btn-clair" onClick={() => changerSemaine(decalerSemaine(lundi, -1))}><ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Semaine précédente</span></button>
        <button className={courant ? 'btn-principal' : 'btn-clair'} onClick={() => changerSemaine(lundiDe(new Date()))}>Semaine en cours</button>
        <button className="btn-clair" onClick={() => changerSemaine(decalerSemaine(lundi, 1))}><span className="hidden sm:inline">Semaine suivante</span><ChevronRight className="h-4 w-4" /></button>
        <label className="sr-only" htmlFor="se-date">Aller à la semaine du</label>
        <input id="se-date" type="date" className="champ w-auto" value={lundi} onChange={(e) => e.target.value && changerSemaine(lundiDe(e.target.value + 'T12:00:00'))} />
        <div className="w-full text-sm font-medium text-nuit-700 sm:ml-auto sm:w-auto">{libelleSemaine(lundi)}</div>
      </div>

      {jours && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-nuit-600/80">
          {prep?.jours ? <span>Semaine préparée{prep.par ? ` par ${prep.par}` : ''}{prep.le ? ` le ${dateHeure(prep.le)}` : ''}</span> : <span>Construite depuis l'agenda public.</span>}
          {prep?.envoye_le && <span className="pastille bg-emerald-50 text-emerald-800">Envoyée vers la newsletter le {dateHeure(prep.envoye_le)}</span>}
          <EtatEnregistrement etat={etat} />
          {prep?.jours && <button className="inline-flex items-center gap-1 text-or-600 hover:underline" disabled={!!occupe} onClick={repartir}><RotateCcw className="h-3.5 w-3.5" />Repartir de l'agenda</button>}
          <span className="ml-auto hidden sm:inline">Cliquez sur un texte pour le modifier · sélectionnez-le pour la mise en forme · ⠿ pour déplacer</span>
        </div>
      )}

      <Erreur erreur={erreur} />
      {!jours && !erreur ? <Chargement texte="Chargement de l'agenda et des intentions…" /> : jours && (
        <div ref={zone} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" onBlur={(e) => { if (e.target.dataset?.editable) synchroniser(e.target) }}>
          {jours.map((jour, j) => {
            const dest = glisse?.dest?.jour === j ? glisse.dest : null
            const indicateur = (type, i) => dest && glisse.type === type && dest.idx === i && <div className="my-0.5 h-0.5 rounded bg-or" />
            return (
              <div key={j} data-zone-jour={j} className={`carte p-3 transition ${jour.horaires.some((e) => e.bold) ? 'border-t-2 border-t-nuit' : ''} ${dest ? 'ring-2 ring-or/60' : ''} ${jour.dow === 0 ? 'bg-or-50/40' : ''}`}>
                <div className="mb-1.5 border-b border-nuit-50 pb-1.5">
                  <div className="font-titre text-lg font-semibold"><Editable html={escHtml(jour.dateFr)} data-jour={j} data-champ="dateFr" /></div>
                  <div className="flex items-center gap-1.5 text-sm italic text-nuit-600">
                    {COULEUR_DOT[jour.couleur] && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COULEUR_DOT[jour.couleur] }} title={'Couleur liturgique : ' + jour.couleur.toLowerCase()} />}
                    <Editable html={escHtml(jour.sousTitre || '—')} vide={!jour.sousTitre} data-jour={j} data-champ="sousTitre" />
                  </div>
                </div>
                {jour.notes.map((n, i) => (
                  <div key={'n' + i}>{indicateur('note', i)}
                    <div data-glisse="note" className={`group flex items-center gap-1 py-0.5 text-sm italic text-[#8b2020] ${glisse?.type === 'note' && glisse.jour === j && glisse.idx === i ? 'opacity-30' : ''}`}>
                      <button type="button" aria-label="Déplacer la note" className="cursor-grab touch-none text-nuit-600/40 hover:text-nuit-600" {...poignee('note', j, i, 'Note')}><GripVertical className="h-4 w-4" /></button>
                      <span aria-hidden="true">✦</span>
                      <Editable html={noteHtml(n)} className="flex-1" style={{ textAlign: noteAlign(n) || 'left' }} data-jour={j} data-champ="note" data-note={i} />
                      <button type="button" aria-label="Supprimer la note" className="rounded p-0.5 text-nuit-600/40 hover:bg-red-50 hover:text-red-700" onMouseDown={(e) => e.preventDefault()} onClick={() => supprimerNote(j, i)}><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
                {indicateur('note', jour.notes.length)}
                {!jour.horaires.length && <div className="py-1 text-sm italic text-nuit-600/50">Aucun événement</div>}
                {jour.horaires.map((ev, i) => (
                  <div key={'e' + i}>{indicateur('evt', i)}
                    <div data-glisse="evt" className={`flex items-center gap-1 py-0.5 text-sm ${ev.bold ? 'font-semibold text-nuit' : 'text-nuit-700'} ${glisse?.type === 'evt' && glisse.jour === j && glisse.idx === i ? 'opacity-30' : ''}`}>
                      <button type="button" aria-label="Déplacer la ligne" className="cursor-grab touch-none text-nuit-600/40 hover:text-nuit-600" {...poignee('evt', j, i, (ev.heure ? ev.heure + ' — ' : '') + ev.label)}><GripVertical className="h-4 w-4" /></button>
                      <Editable html={escHtml(ev.heure || '')} className={`w-16 shrink-0 tabular-nums ${ev.bold ? '' : 'text-nuit-600'}`} data-jour={j} data-evt={i} data-champ="heure" />
                      <Editable html={ev.labelHtml || escHtml(ev.label)} className="min-w-0 flex-1" style={{ textAlign: ev.textAlign || 'left' }} data-jour={j} data-evt={i} data-champ="label" />
                      <button type="button" aria-label="Supprimer la ligne" className="rounded p-0.5 text-nuit-600/40 hover:bg-red-50 hover:text-red-700" onMouseDown={(e) => e.preventDefault()} onClick={() => supprimerLigne(j, i)}><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
                {indicateur('evt', jour.horaires.length)}
                <div className="mt-1.5 flex gap-1 border-t border-dashed border-nuit-100 pt-1.5">
                  <button className="btn px-2 py-1 text-xs text-nuit hover:bg-nuit-50" onClick={() => ajouterLigne(j)}><Plus className="h-3.5 w-3.5" />événement</button>
                  <button className="btn px-2 py-1 text-xs text-or-600 hover:bg-or-50" onClick={() => ajouterNote(j)}><Plus className="h-3.5 w-3.5" />note</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {barre && (
        <div className="fixed z-50 flex -translate-x-1/2 -translate-y-full gap-0.5 rounded-lg bg-nuit p-1 shadow-lg" style={{ left: barre.x, top: Math.max(8, barre.y - 8) }} onMouseDown={(e) => e.preventDefault()}>
          {[['caps', 'AA', 'Majuscules'], ['italic', <em key="i">I</em>, 'Italique'], ['underline', <u key="u">S</u>, 'Souligné'], ['centre', <AlignCenter key="c" className="h-4 w-4" />, 'Centrer']].map(([t, l, titre]) => (
            <button key={t} type="button" title={titre} aria-label={titre} className="min-w-8 rounded px-2 py-1 text-sm font-semibold text-white hover:bg-white/15" onClick={() => formater(t)}>{l}</button>
          ))}
        </div>
      )}
      {glisse && <div className="pointer-events-none fixed z-50 max-w-xs truncate rounded-lg bg-nuit px-3 py-1.5 text-xs text-white shadow-lg" style={{ left: glisse.x + 14, top: glisse.y - 16 }}>{glisse.texte}</div>}
    </div>
  )
}
