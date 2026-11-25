import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, History, Loader2, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { api } from '../api.js'
import { Chargement, Erreur, Modale, useConfirmer, useNotif } from '../ui.jsx'
import BoutonSombre from '../liturgie/BoutonSombre.jsx'
import '../liturgie/liturgie.css'

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const RANGS = { 1: '1re classe', 2: '2e classe', 3: '3e classe', comm: 'Commémoraison' }
const GROUPES = { communaute: 'Communauté', strasbourg: 'Strasbourg', paroisse: 'Paroisse' }
const COMMUNS = [
  ['C1', 'Apôtres'], ['C1a', 'Évangélistes'], ['C2', 'Martyr pontife'], ['C2a', 'Martyr non pontife'], ['C2b', 'Pape martyr'],
  ['C3', 'Plusieurs martyrs pontifes'], ['C3a', 'Plusieurs martyrs non pontifes'], ['C3b', 'Plusieurs papes martyrs'],
  ['C4', 'Confesseur pontife (Statuit)'], ['C4a', 'Docteur pontife (In medio)'], ['C4b', 'Pape confesseur (Si diligis)'], ['C4c', 'Plusieurs confesseurs pontifes'],
  ['C5', 'Confesseur non pontife (Os justi)'], ['C5a', 'Docteur non pontife'], ['C5b', 'Abbé'], ['C5c', 'Plusieurs confesseurs non pontifes'],
  ['C6', 'Vierge martyre (Loquebar)'], ['C6a', 'Vierge non martyre (Dilexisti)'], ['C6b', 'Plusieurs vierges martyres'],
  ['C7', 'Sainte martyre non vierge'], ['C7a', 'Sainte ni vierge ni martyre (Cognovi)'], ['C7b', 'Plusieurs saintes martyres'],
  ['C8', 'Dédicace d\'une église (Terribilis)'], ['C11', 'Fêtes de la Sainte Vierge']
]
const nomCommun = (c) => (COMMUNS.find((x) => x[0] === c) || [c, c])[1]
// Pièces : l'essentiel visible, le reste sous « Plus de pièces »
const OFFICE = [['Oratio', 'Oraison'], ['Lectio4', 'Leçon 4 (2e nocturne)'], ['Lectio5', 'Leçon 5'], ['Lectio6', 'Leçon 6'],
  ['Ant 1', 'Antienne du Magnificat (1res Vêpres)'], ['Ant 2', 'Antienne du Benedictus'], ['Ant 3', 'Antienne du Magnificat (2es Vêpres)']]
const OFFICE_PLUS = [['Responsory4', 'Répons 4'], ['Responsory5', 'Répons 5'], ['Responsory6', 'Répons 6'], ['Invit', 'Invitatoire'],
  ['Hymnus Vespera', 'Hymne des Vêpres'], ['Hymnus Matutinum', 'Hymne des Matines'], ['Hymnus Laudes', 'Hymne des Laudes'],
  ['Ant Matutinum', 'Antiennes des Matines'], ['Ant Laudes', 'Antiennes des Laudes'], ['Ant Vespera', 'Antiennes des Vêpres'],
  ['Capitulum Laudes', 'Capitule des Laudes'], ['Capitulum Vespera', 'Capitule des Vêpres']]
const MESSE = [['Introitus', 'Introït'], ['Oratio', 'Collecte'], ['Lectio', 'Épître'], ['Graduale', 'Graduel et Alléluia'], ['Tractus', 'Trait'],
  ['Evangelium', 'Évangile'], ['Offertorium', 'Offertoire'], ['Secreta', 'Secrète'], ['Communio', 'Communion'], ['Postcommunio', 'Postcommunion']]
const MESSE_PLUS = [['Sequentia', 'Séquence']]

const deux = (n) => String(n).padStart(2, '0')
const dateFr = (d) => { const [m, j] = d.split('-').map(Number); return `${j === 1 ? '1er' : j} ${MOIS[m - 1]}` }
const quand = (iso) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const vide = () => ({ id: '', groupe: 'paroisse', date: '01-01', nom_la: '', nom_fr: '', rang: 3, commun: 'C5', base: null, romain: 'commemorer', nom_oraison: { la: '', fr: '' }, office: {}, messe: {}, note: '' })

/** Calendrier propre : fêtes de la communauté, du diocèse et de la paroisse, calculées par le moteur de l'AppMesse. */
export default function CalendrierPropre() {
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const [d, setD] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [fiche, setFiche] = useState(null)
  const [mention, setMention] = useState(null)
  const [histo, setHisto] = useState(false)
  const [occupe, setOccupe] = useState(false)

  const charger = () => api('propre.lire').then((x) => { setD(x); setErreur(null) }).catch(setErreur)
  useEffect(() => { charger() }, [])
  // Pendant un calcul : état rafraîchi toutes les 30 s
  const enCours = d?.calcul && d.calcul.statut && d.calcul.statut !== 'completed'
  useEffect(() => { if (!enCours) return; const t = setInterval(charger, 30000); return () => clearInterval(t) }, [enCours])

  const parMois = useMemo(() => {
    const m = {}
    ;(d?.calendrier.fetes || []).forEach((f) => { (m[+f.date.slice(0, 2)] ||= []).push({ ...f, sorte: 'fete' }) })
    ;(d?.calendrier.mentions || []).forEach((x) => { (m[+x.date.slice(0, 2)] ||= []).push({ ...x, sorte: 'mention' }) })
    Object.values(m).forEach((l) => l.sort((a, b) => a.date.localeCompare(b.date)))
    return m
  }, [d])

  async function envoyer(payload, message) {
    setOccupe(true)
    try { setD(await api('propre.ecrire', { ...payload, sha: d.sha })); notifier(message); return true }
    catch (e) { notifier(e.message, 'erreur'); if (e.code === 'CONFLIT') charger(); return false }
    finally { setOccupe(false) }
  }
  async function supprimer(f) {
    if (!(await confirmer({ titre: 'Supprimer la fête', texte: `« ${f.nom_fr || f.nom_la} » sera retirée du calendrier propre ; le ${dateFr(f.date)} reviendra au calendrier romain. On peut revenir en arrière avec l'historique.`, bouton: 'Supprimer', danger: true }))) return
    if (await envoyer({ supprimer: f.id }, 'Fête supprimée : recalcul en cours')) setFiche(null)
  }
  async function annuler(i, h) {
    if (!(await confirmer({ titre: 'Revenir en arrière', texte: h.avant ? `« ${h.nom} » reprendra sa version d'avant le ${quand(h.date)}.` : `« ${h.nom} », ajoutée le ${quand(h.date)}, sera retirée.`, bouton: 'Revenir en arrière' }))) return
    setOccupe(true)
    try { setD(await api('propre.annuler', { index: i })); notifier('Retour en arrière : recalcul en cours') } catch (e) { notifier(e.message, 'erreur') } finally { setOccupe(false) }
  }

  if (erreur) return <Erreur erreur={erreur} reessayer={charger} />
  if (!d) return <Chargement />
  const c = d.calcul
  return (
    <div className="liturgie">
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold text-nuit">Calendrier propre</h1>
          <p className="text-sm text-nuit-600">Fêtes de la communauté, du diocèse et de la paroisse. Le moteur du bréviaire en tient compte (rang, commémoraisons, premières Vêpres) pour l'office, la messe, la feuille de semaine et AppMesse.</p>
        </div>
        <BoutonSombre />
        <button className="btn-clair" onClick={() => setHisto(true)}><History className="h-4 w-4" />Historique</button>
        <button className="btn-or" onClick={() => setFiche(vide())}><Plus className="h-4 w-4" />Ajouter une fête</button>
      </div>

      {c && (
        <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${c.erreur ? 'bg-red-50 text-red-700' : enCours ? 'bg-or-50 text-or-600' : c.resultat === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {c.erreur ? c.erreur
            : enCours ? <><Loader2 className="mr-1 inline h-4 w-4 animate-spin" />Recalcul du bréviaire et de la messe en cours (quelques minutes). Une notification arrivera à la fin.</>
              : c.resultat === 'success' ? `Dernier recalcul terminé le ${quand(c.fin)} : tout est à jour.`
                : <>Le dernier recalcul ({quand(c.fin)}) a échoué. <a className="underline" href={c.lien} target="_blank" rel="noreferrer">Voir le détail</a></>}
        </div>
      )}

      <div className="space-y-4">
        {Object.keys(parMois).sort((a, b) => a - b).map((m) => (
          <section key={m} className="carte overflow-hidden">
            <h2 className="border-b border-nuit-50 bg-nuit-50/50 px-4 py-2 text-lg font-semibold capitalize text-nuit">{MOIS[m - 1]}</h2>
            <ul className="divide-y divide-nuit-50">
              {parMois[m].map((x) => x.sorte === 'fete' ? (
                <li key={x.id}>
                  <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-nuit-50/60" onClick={() => setFiche(JSON.parse(JSON.stringify(x)))}>
                    <span className="w-14 shrink-0 text-sm leading-tight tabular-nums text-nuit-600 sm:w-28">{dateFr(x.date)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-titre text-lg font-semibold text-nuit">{x.nom_fr || x.nom_la}</span>
                      <span className="block truncate text-xs text-nuit-600/80">{RANGS[x.rang]} · {x.base ? 'textes de la fête romaine' : nomCommun(x.commun)}{((n) => (n ? ` · ${n} pièce${n > 1 ? 's' : ''} propre${n > 1 ? 's' : ''}` : ''))(Object.keys(x.office || {}).length + Object.keys(x.messe || {}).length)}{x.note ? ' · ⚠ ' + x.note : ''}</span></span>
                    <span className={`pastille shrink-0 ${x.groupe === 'communaute' ? 'bg-or-50 text-or-600' : 'bg-nuit-50 text-nuit-600'}`}>{GROUPES[x.groupe]}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-nuit-600/75" />
                  </button>
                </li>
              ) : (
                <li key={'m' + x.date}>
                  <button className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-nuit-50/60" onClick={() => setMention({ ...x, avant: x.date })}>
                    <span className="w-14 shrink-0 text-sm leading-tight tabular-nums text-nuit-600 sm:w-28">{dateFr(x.date)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm italic text-nuit-700">{x.nom} <span className="not-italic text-nuit-600/70">(facultatif, mention seule)</span></span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-nuit-600/75" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <button className="btn-clair mt-4" onClick={() => setMention({ date: '01-01', nom: '', groupe: 'strasbourg' })}><Plus className="h-4 w-4" />Ajouter une mention facultative</button>

      {fiche && <Fiche f={fiche} occupe={occupe} onFermer={() => setFiche(null)} onSupprimer={supprimer}
        onEnregistrer={async (f) => { if (await envoyer({ fete: { ...f, idAvant: f.id || undefined } }, 'Fête enregistrée : recalcul en cours')) setFiche(null) }} />}
      {mention && <FicheMention m={mention} occupe={occupe} onFermer={() => setMention(null)}
        onSupprimer={async () => { if (await envoyer({ supprimerMention: mention.avant }, 'Mention supprimée')) setMention(null) }}
        onEnregistrer={async (m) => { if (await envoyer({ mention: { ...m, avant: mention.avant } }, 'Mention enregistrée')) setMention(null) }} />}
      {histo && (
        <Modale titre="Historique" onFermer={() => setHisto(false)}>
          {!d.historique.length ? <p className="text-sm text-nuit-600">Aucune modification pour l'instant.</p> : (
            <ul className="divide-y divide-nuit-50">
              {d.historique.map((h, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1 text-sm"><div className="font-medium text-nuit">{h.sorte === 'mention' ? 'Mention : ' : ''}{h.nom} — {h.action}</div><div className="text-xs text-nuit-600/70">{quand(h.date)} · {h.par}</div></div>
                  <button className="btn-clair py-1 text-xs" disabled={occupe} onClick={() => annuler(i, h)}><RotateCcw className="h-3.5 w-3.5" />Revenir avant</button>
                </li>
              ))}
            </ul>
          )}
        </Modale>
      )}
    </div>
  )
}

function Fiche({ f: initial, occupe, onFermer, onEnregistrer, onSupprimer }) {
  const [f, setF] = useState(initial)
  const [plus, setPlus] = useState(false)
  const maj = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const [mois, jour] = f.date.split('-').map(Number)
  const nouvelle = !initial.id
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-nuit-800/40 sm:items-center sm:p-4" onClick={onFermer}>
      <div className="carte flex max-h-full w-full max-w-4xl flex-col overflow-hidden sm:max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-nuit-50 px-5 py-3">
          <h2 className="flex-1 truncate text-2xl font-semibold text-nuit">{nouvelle ? 'Nouvelle fête' : f.nom_fr || f.nom_la}</h2>
          <button className="btn-icone" onClick={onFermer} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div><label className="etiquette">Jour</label>
              <select className="champ" value={jour} onChange={(e) => maj('date', `${deux(mois)}-${deux(e.target.value)}`)}>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></div>
            <div><label className="etiquette">Mois</label>
              <select className="champ" value={mois} onChange={(e) => maj('date', `${deux(e.target.value)}-${deux(jour)}`)}>{MOIS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
            <div><label className="etiquette">Rang</label>
              <select className="champ" value={f.rang} onChange={(e) => maj('rang', e.target.value === 'comm' ? 'comm' : +e.target.value)}>{Object.entries(RANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="etiquette">Calendrier</label>
              <select className="champ" value={f.groupe} onChange={(e) => maj('groupe', e.target.value)}>{Object.entries(GROUPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="etiquette">Nom latin (titre de l'office)</label><input className="champ font-titre text-lg" value={f.nom_la} placeholder="S. Odiliæ Abbatissæ Virginis" onChange={(e) => maj('nom_la', e.target.value)} /></div>
            <div><label className="etiquette">Nom français</label><input className="champ font-titre text-lg" value={f.nom_fr} placeholder="Sainte Odile, abbesse" onChange={(e) => maj('nom_fr', e.target.value)} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="etiquette">Textes de départ</label>
              <select className="champ" value={f.base ? 'base' : 'commun'} onChange={(e) => maj('base', e.target.value === 'base' ? (f.base || f.date) : null)}>
                <option value="commun">Un commun</option><option value="base">Ceux d'une fête du calendrier romain</option></select></div>
            {f.base ? (
              <div><label className="etiquette">Fête romaine reprise (jour et mois de la fête romaine)</label>
                <input className="champ" value={f.base} placeholder="12-13" onChange={(e) => maj('base', e.target.value.trim())} />
                <p className="mt-1 text-xs text-nuit-600/70">Format MM-JJ, par exemple 12-13 pour Ste Lucie : ses textes sont repris, vos pièces propres les remplacent.</p></div>
            ) : (
              <div><label className="etiquette">Commun</label>
                <select className="champ" value={f.commun} onChange={(e) => maj('commun', e.target.value)}>{COMMUNS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="etiquette">La fête romaine de ce jour</label>
              <select className="champ" value={f.romain} onChange={(e) => maj('romain', e.target.value)}><option value="commemorer">reste en commémoraison</option><option value="omettre">est omise (déplacée ou supprimée)</option></select></div>
            <div><label className="etiquette">Nom dans les oraisons du commun (latin)</label><input className="champ" value={f.nom_oraison?.la || ''} placeholder="Odíliæ Vírginis tuæ" onChange={(e) => maj('nom_oraison', { ...f.nom_oraison, la: e.target.value })} /></div>
            <div><label className="etiquette">… (français)</label><input className="champ" value={f.nom_oraison?.fr || ''} placeholder="Odile, votre vierge" onChange={(e) => maj('nom_oraison', { ...f.nom_oraison, fr: e.target.value })} /></div>
          </div>
          <div><label className="etiquette">Note (pour mémoire)</label><input className="champ" value={f.note || ''} onChange={(e) => maj('note', e.target.value)} /></div>

          <div className="rounded-xl bg-nuit-50/60 p-3 text-xs leading-relaxed text-nuit-600">
            Une pièce laissée vide vient du {f.base ? 'texte romain repris' : 'commun'}. Si le français manque, le latin s'affiche. Mise en forme du moteur :
            une ligne commençant par <b>!</b> est une rubrique en rouge (référence : <code>!Ps 44:8</code>) ; <b>V.</b> et <b>R.</b> en début de ligne : verset et répons ;
            <b>&amp;Gloria</b> : Gloire au Père ; <b>$Per Dominum</b> : conclusion de l'oraison (ajoutée d'office).
          </div>

          <Pieces titre="Office" liste={OFFICE} plus={plus ? OFFICE_PLUS : []} valeurs={f.office} onChange={(v) => maj('office', v)} />
          <Pieces titre="Messe" liste={MESSE} plus={plus ? MESSE_PLUS : []} valeurs={f.messe} onChange={(v) => maj('messe', v)} />
          <button className="btn-clair" onClick={() => setPlus(!plus)}>{plus ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{plus ? 'Moins de pièces' : 'Plus de pièces (répons, hymnes, antiennes, capitules, séquence)'}</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-nuit-50 px-5 py-3">
          {!nouvelle && <button className="btn-danger" disabled={occupe} onClick={() => onSupprimer(initial)}><Trash2 className="h-4 w-4" />Supprimer</button>}
          <span className="flex-1 text-xs text-nuit-600/70">« Publier » enregistre et lance le recalcul des jours concernés (quelques minutes).</span>
          <button className="btn-clair" onClick={onFermer}>Annuler</button>
          <button className="btn-principal" disabled={occupe || !f.nom_la.trim()} onClick={() => onEnregistrer(f)}>{occupe && <Loader2 className="h-4 w-4 animate-spin" />}Publier</button>
        </div>
      </div>
    </div>
  )
}

function Pieces({ titre, liste, plus, valeurs, onChange }) {
  const [ouverte, setOuverte] = useState(null)
  const v = valeurs || {}
  const changer = (cle, langue, texte) => onChange({ ...v, [cle]: { la: v[cle]?.la || '', fr: v[cle]?.fr || '', [langue]: texte } })
  return (
    <section>
      <h3 className="mb-1.5 text-xl font-semibold text-nuit">{titre}</h3>
      <div className="divide-y divide-nuit-50 rounded-xl border border-nuit-100">
        {[...liste, ...plus].map(([cle, nom]) => {
          const propre = !!(v[cle]?.la || v[cle]?.fr)
          const ouvert = ouverte === cle
          return (
            <div key={cle}>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-nuit-50/60" onClick={() => setOuverte(ouvert ? null : cle)}>
                {ouvert ? <ChevronDown className="h-4 w-4 text-nuit-600/75" /> : <ChevronRight className="h-4 w-4 text-nuit-600/75" />}
                <span className="flex-1 font-medium text-nuit-700">{nom}</span>
                <span className={`pastille ${propre ? 'bg-or-50 text-or-600' : 'bg-nuit-50 text-nuit-600/70'}`}>{propre ? 'propre' : 'du commun'}</span>
              </button>
              {ouvert && (
                <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
                  <div><label className="etiquette">Latin</label><textarea className="champ min-h-[140px] font-titre text-base" value={v[cle]?.la || ''} onChange={(e) => changer(cle, 'la', e.target.value)} /></div>
                  <div><label className="etiquette">Français</label><textarea className="champ min-h-[140px] font-titre text-base" value={v[cle]?.fr || ''} onChange={(e) => changer(cle, 'fr', e.target.value)} /></div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function FicheMention({ m: initial, occupe, onFermer, onEnregistrer, onSupprimer }) {
  const [m, setM] = useState(initial)
  const [mois, jour] = m.date.split('-').map(Number)
  return (
    <Modale titre={initial.avant ? 'Mention facultative' : 'Nouvelle mention facultative'} onFermer={onFermer}
      pied={<>
        {initial.avant && <button className="btn-danger mr-auto" disabled={occupe} onClick={onSupprimer}><Trash2 className="h-4 w-4" />Supprimer</button>}
        <button className="btn-clair" onClick={onFermer}>Annuler</button>
        <button className="btn-principal" disabled={occupe || !m.nom.trim()} onClick={() => onEnregistrer({ date: m.date, nom: m.nom, groupe: m.groupe })}>{occupe && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
      </>}>
      <p className="mb-3 text-sm text-nuit-600">Le nom s'affiche « (facultatif) » à côté de la férie ; les textes restent ceux du jour.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="etiquette">Jour</label><select className="champ" value={jour} onChange={(e) => setM({ ...m, date: `${deux(mois)}-${deux(e.target.value)}` })}>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></div>
        <div><label className="etiquette">Mois</label><select className="champ" value={mois} onChange={(e) => setM({ ...m, date: `${deux(e.target.value)}-${deux(jour)}` })}>{MOIS.map((x, i) => <option key={i} value={i + 1}>{x}</option>)}</select></div>
      </div>
      <div className="mt-3"><label className="etiquette">Nom</label><input className="champ" value={m.nom} onChange={(e) => setM({ ...m, nom: e.target.value })} /></div>
    </Modale>
  )
}
