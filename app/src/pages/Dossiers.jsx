import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, FolderHeart, Loader2, Globe, Printer, CalendarCheck, ScrollText, Send, Download, BellRing, HeartHandshake, FileSpreadsheet } from 'lucide-react'
import { Redaction } from './Courrier.jsx'
import ChoixFraternite from './ChoixFraternite.jsx'
import { api, precharger } from '../api.js'
import { analyserClasseur, lireClasseur, STATUTS_IMPORT } from '../importCatechumenes.js'
import { useApp } from '../App.jsx'
import { TYPES, ORDRE_TYPES, ETATS, prochaineEtape, documentsManquants, PAR_ANNEE, anneeSacrements, etapesDe, documentsDe, libelleAnnee, TITRES_COLLECTIFS, anneeScolaireActuelle, estOptionnel, ALERTES, choixAnnees, choixAnneesScolaires } from '../types.js'
import { Chargement, Erreur, Modale, Vide, useCharger, enSuppression, Aide, useNotif, imprimerHtml, dateCourte, initiales, versLocal, jourLong, heure, COULEURS_STATUT } from '../ui.jsx'
import { useSelection, BoutonSelection, BarreSelection, MenuAction, useActionGroupee, texteRapport } from '../selection.jsx'

export default function Dossiers() {
  const nav = useNavigate()
  const { nomUtilisateur, reglages: reglagesApp, utilisateurs, ecrit } = useApp()
  const [params, setParams] = useSearchParams()
  const type = params.get('type') || ''
  const etat = params.get('etat') || 'ouvert'
  const annee = params.get('annee') || ''
  const parAnnee = PAR_ANNEE.includes(type)
  const [texte, setTexte] = useState('')
  const [nouveau, setNouveau] = useState(() => params.get('nouveau') === '1')   // ?nouveau=1 : depuis Catéchuménat
  const [envoiForm, setEnvoiForm] = useState(false)
  const s = useSelection()                     // actions groupées (cases à cocher)
  const sel = s.sel
  const [reclamer, setReclamer] = useState(null)
  const lancer = useActionGroupee()
  const [choixFrat, setChoixFrat] = useState(false)
  const notifier = useNotif()
  const placable = ['catechumene', 'confirmand'].includes(type)
  const { data, chargement, erreur, recharger } = useCharger(() => api('dossiers.liste', {}), [], ['dossiers.liste', {}])

  const [local, setLocal] = useState({})   // modifications groupées affichées avant l'envoi (annulables)
  const majLocale = (m) => setLocal(m || {})
  useEffect(() => { setLocal({}) }, [data])
  const tous = (data || []).filter((d) => !enSuppression.has(d.id)).map((d) => (local[d.id] ? { ...d, ...local[d.id](d) } : d))
  const liste = tous.filter((d) => (!type || d.type === type) && (etat === 'tous' || d.etat === etat) &&
    (!parAnnee || !annee || (annee === 'aucune' ? !anneeSacrements(d) : anneeSacrements(d) === annee)) &&
    (!texte || `${d.nom} ${d.email} ${d.telephone}`.toLowerCase().includes(texte.toLowerCase())))
  const compte = (t) => tous.filter((d) => d.type === t && (etat === 'tous' || d.etat === etat)).length
  const changer = (p) => setParams(Object.fromEntries(Object.entries({ type, etat, annee, ...p }).filter(([, v]) => v)))

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-semibold">Dossiers</h1><p className="text-sm text-nuit-600/80">Sacrements et célébrations</p></div>
        <div className="flex gap-2">
          {type === 'confirmand' && <ImportConfirmands dossiers={tous} onFait={recharger} />}
          {type === 'catechumene' && <ImportCatechumenes onFait={recharger} />}
          {type === 'catechumene' && data && <button className="btn-clair" onClick={() => imprimerCatechumenes(liste, annee, reglagesApp.paroisse)}><Printer className="h-4 w-4" /><span className="hidden sm:inline">Imprimer la liste</span></button>}
          <BoutonSelection s={s} />
          <button className="btn-clair" onClick={() => nav('/formulaires')}><Send className="h-4 w-4" /><span className="hidden sm:inline">Envoyer un formulaire</span></button>
          <button className="btn-clair" onClick={() => nav('/extraits')}><ScrollText className="h-4 w-4" />Extraits</button>
          <button className="btn-or" onClick={() => setNouveau(true)}><Plus className="h-4 w-4" />Nouveau dossier</button>
        </div>
      </div>

      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button onClick={() => changer({ type: '', annee: '' })} className={`pastille shrink-0 border py-1 ${!type ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>Tous</button>
        {ORDRE_TYPES.map((t) => (
          <button key={t} onClick={() => changer({ type: t, annee: '' })} className={`pastille shrink-0 gap-1.5 border py-1 ${type === t ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: TYPES[t].couleur }} />{TYPES[t].pluriel}{data && <span className="opacity-60">{compte(t)}</span>}
          </button>
        ))}
      </div>
      {parAnnee && data && (() => {
        const base = tous.filter((d) => d.type === type && (etat === 'tous' || d.etat === etat))
        const annees = [...new Set(base.map(anneeSacrements).filter(Boolean))].sort()
        const sans = base.filter((d) => !anneeSacrements(d)).length
        return (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-nuit-600">{type === 'confirmand' ? 'Année de confirmation :' : TYPES[type].collectif ? 'Année scolaire :' : 'Année des sacrements :'}</span>
            <button onClick={() => changer({ annee: '' })} className={`pastille border py-1 ${!annee ? 'border-or bg-or text-white' : 'border-or/40 bg-white text-or-600'}`}>Toutes</button>
            {annees.map((a) => <button key={a} onClick={() => changer({ annee: a })} className={`pastille border py-1 ${annee === a ? 'border-or bg-or text-white' : 'border-or/40 bg-white text-or-600'}`}>{a} <span className="ml-1 opacity-70">{base.filter((d) => anneeSacrements(d) === a).length}</span></button>)}
            {sans > 0 && <button onClick={() => changer({ annee: 'aucune' })} className={`pastille border py-1 ${annee === 'aucune' ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>Non fixée <span className="ml-1 opacity-70">{sans}</span></button>}
          </div>
        )
      })()}
      {TYPES[type]?.collectif && annee && annee !== 'aucune' && <Promotion type={type} annee={annee} dossiers={liste} />}
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-nuit-600/50" />
          <input className="champ pl-9" placeholder="Nom, e-mail, téléphone…" value={texte} onChange={(e) => setTexte(e.target.value)} /></div>
        <select className="champ" value={etat} onChange={(e) => changer({ etat: e.target.value })}>
          <option value="ouvert">En cours</option><option value="clos">Clos</option><option value="annule">Annulés</option><option value="tous">Tous</option>
        </select>
      </div>

      <Erreur erreur={erreur} reessayer={recharger} />
      {chargement && !data ? <Chargement /> : (
        <div className="carte overflow-hidden">
          {!liste.length ? <Vide icone={FolderHeart} texte="Aucun dossier." /> : (
            <div className="divide-y divide-nuit-50">
              {(parAnnee && !annee ? [...liste].sort((x, y) => (anneeSacrements(x) || '9999').localeCompare(anneeSacrements(y) || '9999')) : liste).map((d, i, arr) => {
                const entete = parAnnee && !annee && (i === 0 || anneeSacrements(arr[i - 1]) !== anneeSacrements(d))
                const t = TYPES[d.type], prochaine = prochaineEtape(d.type, d.etapes, d), manquants = documentsManquants(d.type, d.documents, d).length
                const et = etapesDe(d.type, d), total = et.filter((e) => !estOptionnel(e, d)).length, faites = et.filter((e) => !estOptionnel(e, d) && d.etapes.includes(e.cle)).length
                return (
                  <div key={d.id}>
                  {entete && <div className="bg-or-50 px-4 py-1.5 font-titre text-lg font-semibold text-or-600">{anneeSacrements(d) ? libelleAnnee(type) + anneeSacrements(d) : 'Année non fixée'}</div>}
                  <button onPointerEnter={() => !sel && precharger('dossiers.lire', { id: d.id })} onTouchStart={() => !sel && precharger('dossiers.lire', { id: d.id })} onClick={() => sel ? s.basculer(d.id) : nav(`/dossiers/${d.id}`)} className={`${sel?.has(d.id) ? 'bg-or-50 ' : ''}grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left text-sm hover:bg-nuit-50/50 md:grid-cols-[150px_1fr_200px_120px_40px]`}>
                    <span className="flex flex-col gap-0.5">{sel && <input type="checkbox" readOnly checked={sel.has(d.id)} className="mb-1 h-4 w-4 accent-[#521a22]" aria-label={`Choisir ${d.nom}`} />}<span className="pastille w-fit text-white" style={{ background: t.couleur }}>{t.nom}</span>
                      {PAR_ANNEE.includes(d.type) && !parAnnee && anneeSacrements(d) && <span className="pastille w-fit border border-or/40 py-0 text-[10px] text-or-600">{anneeSacrements(d)}</span>}</span>
                    <span className="min-w-0"><span className="flex items-center gap-2 truncate font-medium">{d.photo && <img src={d.photo} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />}<span className="truncate">{d.nom}</span></span>
                      <span className="block truncate text-xs text-nuit-600/60">{d.etat !== 'ouvert' ? <span className={`pastille py-0 ${COULEURS_STATUT[d.etat]}`}>{ETATS[d.etat]}</span> : prochaine ? '→ ' + prochaine.label : 'Toutes les étapes faites'}{manquants > 0 && d.etat === 'ouvert' && ` · ${manquants} document${manquants > 1 ? 's' : ''} manquant${manquants > 1 ? 's' : ''}`}</span>
                      {(d.alertes?.length > 0 || d.fraternite) && <span className="mt-0.5 flex flex-wrap gap-1">{d.alertes?.map((a) => <span key={a} className={`pastille py-0 text-[10px] ${ALERTES[a]?.classe}`}>{ALERTES[a]?.nom}</span>)}
                        {d.fraternite && <span className="pastille gap-0.5 bg-rose-50 py-0 text-[10px] text-rose-800"><HeartHandshake className="h-2.5 w-2.5" />Cor Unum : {d.fraternite.equipe || 'à répartir'}{d.fraternite.ancien ? ' (ancien)' : ''}</span>}</span>}
                      {t.collectif && d.preparation && <span className="mt-0.5 flex flex-wrap gap-1"><span className="pastille py-0 text-[10px] border border-nuit-100 text-nuit-600">{d.preparation}</span>{d.preparation !== 'Paroisse' && !d.etapes.includes('validation') && <span className="pastille bg-amber-100 py-0 text-[10px] text-amber-900">à valider par le curé</span>}</span>}</span>
                    <span className="hidden md:block"><span className="block h-1.5 overflow-hidden rounded-full bg-nuit-50"><span className="block h-full rounded-full" style={{ width: `${(faites / total) * 100}%`, background: t.couleur }} /></span><span className="text-[11px] text-nuit-600/60">{faites}/{total} étapes</span></span>
                    <span className="text-right text-xs text-nuit-600/70 md:text-left">{d.date_celebration ? <span className="inline-flex items-center gap-1 font-medium text-nuit"><Globe className="h-3 w-3 text-or" />{dateCourte(d.date_celebration)}</span> : d.date_souhaitee ? 'souhaité ' + dateCourte(d.date_souhaitee) : '—'}</span>
                    <span className="hidden justify-end md:flex">{d.responsable && <span title={nomUtilisateur(d.responsable)} className="flex h-7 w-7 items-center justify-center rounded-full bg-nuit text-[10px] font-semibold text-white">{initiales(nomUtilisateur(d.responsable))}</span>}</span>
                  </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      <BarreSelection s={s} tous={liste.map((d) => d.id)}
        raccourcis={[['Avec des documents manquants', liste.filter((d) => d.etat === 'ouvert' && documentsManquants(d.type, d.documents, d).length).map((d) => d.id)],
          ...(placable ? [['Sans fraternité', liste.filter((d) => !d.fraternite?.equipe || d.fraternite?.ancien).map((d) => d.id)]] : [])]}>
        <ActionsDossiers choisis={tous.filter((d) => sel?.has(d.id))} lancer={lancer} utilisateurs={utilisateurs} ecrit={ecrit}
          majLocale={majLocale} recharger={recharger} onReclamer={setReclamer} onFraternite={() => setChoixFrat(true)} />
      </BarreSelection>
      {choixFrat && sel && <ChoixFraternite titre={`Placer ${sel.size} personne${sel.size > 1 ? 's' : ''}`} sousTitre="Les fiches Cor Unum manquantes seront créées et reliées aux dossiers ; les autres seront déplacées."
        onFermer={() => setChoixFrat(false)} onChoisir={async (id) => {
          try {
            const r = await api('cor.placer', { dossiers: [...sel], equipe_id: id })
            const nom = r.fraternites[[...sel][0]]?.equipe || ''
            notifier(`${sel.size} personne${sel.size > 1 ? 's' : ''} placée${sel.size > 1 ? 's' : ''} dans ${nom || 'la fraternité'}`)
            setChoixFrat(false); s.quitter(); recharger()
          } catch (e) { notifier(e.message, 'erreur') }
        }} />}
      {reclamer && <Redaction mode="nouveau" sujet={'Documents à fournir – {nom}'}
        corps={"Bonjour,\n\nPour compléter le dossier de {nom}, il nous manque encore :\n{documents}\n\nVous pouvez les déposer en ligne (photo ou PDF) avec le bouton ci-dessous, les transmettre par retour de mail ou les apporter au secrétariat.\n[Bouton : Déposer mes documents]\n\nAvec l'assurance de nos prières à toutes vos intentions,"}
        destinataires={`Un mail personnel à chaque famille (${reclamer.length}). {nom} et {documents} sont remplis pour chacune. Exemple – ${reclamer[0].nom} : ${reclamer[0].documents.join(', ')}.`}
        envoiPersonnalise={({ sujet, corps, signature }) => api('dossiers.reclamer', { envois: reclamer.map((x) => ({ id: x.id, documents: x.documents, docs: x.docs })), sujet, corps, signature })}
        onFermer={() => setReclamer(null)} onEnvoye={(r) => { setReclamer(null); notifier(texteRapport(r, 'mail envoyé'), r.ignores?.length ? 'erreur' : undefined); s.quitter(); recharger() }} />}
      {envoiForm && <EnvoiFormulaire onFermer={() => setEnvoiForm(false)} />}
      {nouveau && <NouveauDossier typeInitial={type || 'bapteme'} onFermer={() => setNouveau(false)} onCree={(d) => nav(`/dossiers/${d.id}`)} />}
    </>
  )
}

function NouveauDossier({ typeInitial, onFermer, onCree }) {
  const { utilisateurs } = useApp()
  const [type, setType] = useState(typeInitial)
  const [infos, setInfos] = useState({})
  const [responsable, setResponsable] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const section = TYPES[type].sections[0]
  const contact = TYPES[type].sections.find((s) => s.champs.some((c) => c.cle === 'telephone'))
  const champs = [...section.champs.slice(0, 4), ...(contact && contact !== section ? contact.champs.filter((c) => ['telephone', 'email'].includes(c.cle)) : [])]

  async function creer() {
    setEnvoi(true); setErreur(null)
    try { onCree(await api('dossiers.creer', { type, infos, responsable })) } catch (e) { setErreur(e); setEnvoi(false) }
  }
  return (
    <Modale titre="Nouveau dossier" onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" onClick={creer} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Créer le dossier</button></>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">{ORDRE_TYPES.map((t) => (
          <button key={t} onClick={() => { setType(t); setInfos({}) }} className={`pastille gap-1.5 border py-1 ${type === t ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 text-nuit-600'}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: TYPES[t].couleur }} />{TYPES[t].nom}</button>
        ))}</div>
        <p className="text-xs text-nuit-600/70">{section.titre} — le reste se complète ensuite dans le dossier.</p>
        <div className="grid grid-cols-2 gap-3">
          {champs.map((c) => (
            <div key={c.cle}><label className="etiquette">{c.label}</label>
              <input className="champ" type={c.type === 'date' ? 'date' : c.type === 'email' ? 'email' : c.type === 'tel' ? 'tel' : 'text'} value={infos[c.cle] || ''} onChange={(e) => setInfos({ ...infos, [c.cle]: e.target.value })} /></div>
          ))}
        </div>
        <div><label className="etiquette">Responsable</label>
          <select className="champ" value={responsable} onChange={(e) => setResponsable(e.target.value)}><option value="">Personne pour l'instant</option>{utilisateurs.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}</select></div>
        <Erreur erreur={erreur} />
      </div>
    </Modale>
  )
}

/** Célébration commune d'une année scolaire (premières communions, professions de foi) + liste imprimable. */
function Promotion({ type, annee, dossiers }) {
  const notifier = useNotif()
  const { reglages } = useApp()
  const [promo, setPromo] = useState(null)
  const [date, setDate] = useState('')
  const [lieu, setLieu] = useState('')
  const [envoi, setEnvoi] = useState(false)
  useEffect(() => {
    api('promotions.liste').then((p) => { const x = p[`${type}|${annee}`] || {}; setPromo(x); setDate(x.date ? versLocal(x.date) : ''); setLieu(x.lieu || '') }).catch(() => setPromo({}))
  }, [type, annee])
  async function enregistrer() {
    setEnvoi(true)
    try { const p = await api('promotions.fixer', { type, annee, date: date ? new Date(date).toISOString() : '', lieu }); setPromo(p[`${type}|${annee}`]); notifier(date ? 'Date publiée dans l\'agenda public' : 'Date retirée') }
    catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  function imprimer() {
    const e = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const tries = dossiers.filter((d) => d.etat !== 'annule').slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    const lignes = tries.map((d, i) => {
      const prenoms = d.nom.split(' ').filter((m) => m !== m.toUpperCase()).join(' ')
      const nom = d.nom.split(' ').filter((m) => m === m.toUpperCase()).join(' ')
      return `<tr><td>${i + 1}</td><td><b>${e(nom)}</b></td><td>${e(prenoms)}</td><td>${e(d.preparation)}</td></tr>`
    }).join('')
    const quand = promo?.date ? `${jourLong(promo.date)} à ${heure(promo.date)}${promo.lieu ? ' – ' + promo.lieu : ''}` : ''
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${TITRES_COLLECTIFS[type]} ${annee}</title><style>
      @page{size:A4;margin:16mm} body{font-family:Arial,sans-serif;color:#222} h1{color:#521a22;font-size:20pt;margin:0 0 2mm}
      .sous{color:#666;margin:0 0 8mm} table{width:100%;border-collapse:collapse;font-size:11pt} th{text-align:left;border-bottom:2px solid #521a22;padding:2mm}
      td{border-bottom:1px solid #ddd;padding:2.2mm 2mm} td:first-child{color:#888;width:8mm} .total{margin-top:6mm;color:#666;font-size:10pt}</style></head><body>
      <h1>${TITRES_COLLECTIFS[type]} – ${annee}</h1><p class="sous">${e(reglages.paroisse)}${quand ? '<br>Célébration : ' + e(quand) : ''}</p>
      <table><thead><tr><th>N°</th><th>Nom</th><th>Prénom</th><th>Lieu de préparation</th></tr></thead><tbody>${lignes}</tbody></table>
      <p class="total">${tries.length} enfant${tries.length > 1 ? 's' : ''}</p></body></html>`
    imprimerHtml(html)
  }
  return (
    <div className="carte mb-4 flex flex-wrap items-end gap-3 border-or/40 bg-or-50/40 p-4">
      <div className="min-w-[200px] flex-1">
        <div className="mb-1 flex items-center gap-1.5 font-titre text-lg font-semibold"><CalendarCheck className="h-4 w-4 text-or" />Célébration {annee}</div>
        <p className="text-xs text-nuit-600/70">Une seule date pour tous les enfants (paroisse et écoles), publiée dans l'agenda public sous « {TITRES_COLLECTIFS[type]} ».</p>
      </div>
      {promo === null ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
        <div><label className="etiquette">Date et heure</label><input className="champ py-1.5" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="etiquette">Lieu</label><input className="champ py-1.5" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Église" /></div>
        <button className="btn-principal py-1.5" onClick={enregistrer} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
      </>}
      <button className="btn-clair py-1.5" onClick={imprimer} disabled={!dossiers.length}><Printer className="h-4 w-4" />Liste à imprimer</button>
    </div>
  )
}

const FORMULAIRES_ECOLES = {
  premiere_communion: { nom: 'Première communion', fichier: 'premiere_communion' },
  profession_foi: { nom: 'Profession de foi', fichier: 'profession_foi' },
  confirmation_jeune: { nom: 'Confirmation', fichier: 'confirmation_jeune' }
}
const PREPARATIONS_CONNUES = ['Herrade de Landsberg', 'Saints Louis et Zélie Martin']

/** Envoi par mail d'un formulaire d'inscription (première communion, profession de foi), avec un bouton qui l'ouvre. */
function EnvoiFormulaire({ onFermer }) {
  const notifier = useNotif()
  const [type, setType] = useState('premiere_communion')
  const [vers, setVers] = useState('parent')
  const [email, setEmail] = useState('')
  const [ecole, setEcole] = useState('')
  const [redaction, setRedaction] = useState(null)
  const { data } = useCharger(() => api('cate.reglages'), [])
  const promos = useCharger(() => api('promotions.liste'), [])
  const { reglages } = useApp()
  const ecoles = (data?.ecoles || []).filter((x) => x.nom)
  const choisie = ecoles.find((x) => x.nom === ecole)
  const f = FORMULAIRES_ECOLES[type]

  function rediger() {
    const base = location.href.split('#')[0].replace(/[?].*$/, '').replace(/[^/]*$/, '')
    const slug = { premiere_communion: 'premiere-communion', profession_foi: 'profession-de-foi', confirmation_jeune: 'confirmation-jeunes' }[type]
    const site = String(reglages.url_formulaires || '').trim()
    let url = site ? `${site.replace(/\/?$/, '/')}${slug}/` : `${base}formulaires/${f.fichier}.html`
    if (vers === 'ecole' && choisie) url += PREPARATIONS_CONNUES.includes(choisie.nom) ? `?preparation=${encodeURIComponent(choisie.nom)}` : `?preparation=${encodeURIComponent('Autre école')}&ecole=${encodeURIComponent(choisie.nom)}`
    // Date de la célébration de l'année, retraite, rendez-vous avec M. le curé (première communion)
    const annee = anneeScolaireActuelle()
    const promo = promos.data?.[`${type}|${annee}`]
    const quand = promo?.date
      ? `La ${f.nom.toLowerCase()} (année ${annee}) aura lieu le ${new Date(promo.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} à ${heure(promo.date).replace(':', ' h ')}${promo.lieu ? ', ' + promo.lieu : ''}.`
      : `La date et l'heure de la ${f.nom.toLowerCase()} (année ${annee}) vous seront communiquées prochainement.`
    const B_FORM = "Remplir le formulaire d'inscription", B_RDV = 'Prendre rendez-vous avec Monsieur le Curé'
    const rdv = type === 'premiere_communion' && reglages.url_rdv_cure
    const infos = `${quand}\nLes informations concernant la retraite vous seront communiquées plus tard.` +
      (rdv ? `\n\nRendez-vous avec Monsieur le Curé : merci de vous inscrire rapidement ici :\n[Bouton : ${B_RDV}]` : '')
    const corps = vers === 'ecole'
      ? `Bonjour,\n\nPour l'inscription des enfants de votre établissement à la ${f.nom.toLowerCase()}, voici le formulaire à transmettre aux familles. Il suffit de cliquer sur le bouton ci-dessous ; les réponses arrivent directement au secrétariat de la paroisse. Une copie de l'acte de baptême de l'enfant est demandée (sauf baptême à la paroisse La Croix glorieuse).\n[Bouton : ${B_FORM}]\n\n${infos}\n\nMerci beaucoup pour votre aide.\n\nAvec l'assurance de nos prières à toutes vos intentions,`
      : `Bonjour,\n\nPour inscrire votre enfant à la ${f.nom.toLowerCase()}, merci de remplir le formulaire en cliquant sur le bouton ci-dessous, en joignant une copie de son acte de baptême (sauf baptême à la paroisse La Croix glorieuse). Votre demande arrivera directement au secrétariat de la paroisse.\n[Bouton : ${B_FORM}]\n\n${infos}\n\nAvec l'assurance de nos prières à toutes vos intentions,`
    const boutons = [{ texte: B_FORM, url }, ...(rdv ? [{ texte: B_RDV, url: reglages.url_rdv_cure, image: `${base}mail/rdv-cure.png`, imageSeule: true }] : [])]
    setRedaction({ a: vers === 'ecole' ? choisie?.email || '' : email, sujet: `Inscription à la ${f.nom.toLowerCase()}`, corps, boutons })
  }
  if (redaction) return <Redaction mode="nouveau" {...redaction} onFermer={onFermer} onEnvoye={() => { onFermer(); notifier('Formulaire envoyé') }} />
  return (
    <Modale titre="Envoyer un formulaire d'inscription" onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={(vers === 'ecole' ? !choisie : !email) || promos.chargement} onClick={rediger}>Rédiger le mail</button></>}>
      <div className="space-y-4">
        <div><label className="etiquette">Formulaire</label>
          <div className="grid grid-cols-2 gap-2">{Object.entries(FORMULAIRES_ECOLES).map(([k, x]) => (
            <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${type === k ? 'border-or bg-or-50' : 'border-nuit-100'}`}><input type="radio" checked={type === k} onChange={() => setType(k)} />{x.nom}</label>
          ))}</div></div>
        <div><label className="etiquette">Destinataire</label>
          <div className="grid grid-cols-2 gap-2">{[['parent', 'Un parent'], ['ecole', 'Une école']].map(([k, l]) => (
            <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm ${vers === k ? 'border-or bg-or-50' : 'border-nuit-100'}`}><input type="radio" checked={vers === k} onChange={() => setVers(k)} />{l}</label>
          ))}</div></div>
        {vers === 'parent'
          ? <div><label className="etiquette">E-mail du parent</label><input className="champ" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@exemple.fr" /></div>
          : <div><label className="etiquette">École</label>
              <select className="champ" value={ecole} onChange={(e) => setEcole(e.target.value)}><option value="">Choisir…</option>{ecoles.map((x) => <option key={x.nom} value={x.nom}>{x.nom}{x.email ? '' : ' (pas d\'e-mail)'}</option>)}</select>
              <p className="mt-1 text-xs text-nuit-600/70">Les écoles et leurs adresses se règlent dans Réglages → Catéchisme. Le formulaire s'ouvrira avec l'école déjà choisie.</p></div>}
        {['profession_foi', 'confirmation_jeune'].includes(type) && vers === 'ecole' && ecole === 'Herrade de Landsberg' && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Herrade de Landsberg n'est pas proposée dans ce formulaire.</p>}
      </div>
    </Modale>
  )
}

/** Confirmands : import du formulaire Google et relance des baptêmes à trouver. */
function ImportConfirmands({ dossiers, onFait }) {
  const notifier = useNotif()
  const [occupe, setOccupe] = useState(false)
  const [relance, setRelance] = useState(false)
  const aTrouver = dossiers.filter((d) => d.etat === 'ouvert' && d.alertes?.includes('bapteme_a_trouver') && d.email)
  async function importer() {
    setOccupe(true)
    try {
      const r = await api('conf.importer')
      notifier(r.nouveaux || r.completes ? `${r.nouveaux} nouveau(x), ${r.completes} complété(s)${r.accuses ? `, ${r.accuses} accusé(s) envoyé(s)` : ''}` : 'Aucune nouvelle inscription')
      if (r.erreurs?.length) notifier(r.erreurs.slice(0, 2).join(' · '), 'erreur')
      onFait()
    } catch (e) { notifier(e.message, 'erreur') } finally { setOccupe(false) }
  }
  return (
    <>
      <button className="btn-clair" onClick={importer} disabled={occupe}>{occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="hidden sm:inline">Importer le formulaire</span></button>
      {aTrouver.length > 0 && <button className="btn-clair" onClick={() => setRelance(true)}><BellRing className="h-4 w-4" /><span className="hidden sm:inline">Baptêmes à trouver ({aTrouver.length})</span></button>}
      {relance && <Redaction mode="nouveau" sujet="Votre baptême – préparation à la confirmation"
        corps={"Bonjour {prenom},\n\nPour pouvoir recevoir le sacrement de confirmation, nous avons besoin de connaître la date et le lieu (paroisse et commune) de votre baptême.\n\nVos parents ou votre parrain et votre marraine pourront sans doute vous aider ; le livret de famille catholique l'indique aussi. Merci de nous répondre simplement par retour de mail.\n\nAvec l'assurance de nos prières à toutes vos intentions,"}
        destinataires={`Un mail personnel à chacun des ${aTrouver.length} confirmands dont le baptême est à trouver ({prenom} est rempli pour chacun)`}
        envoiPersonnalise={({ sujet, corps, signature }) => api('conf.relancer', { ids: aTrouver.map((d) => d.id), sujet, corps, signature })}
        onFermer={() => setRelance(false)} onEnvoye={(r) => { setRelance(false); notifier(`Envoyé à ${r?.nb} confirmand(s)`); onFait() }} />}
    </>
  )
}

/** Import du tableau Excel des catéchumènes : aperçu, statut corrigeable par personne, puis import. */
function ImportCatechumenes({ onFait }) {
  const notifier = useNotif()
  const fichier = useRef(null)
  const [occupe, setOccupe] = useState(false)
  const [apercu, setApercu] = useState(null)
  async function choisi(e) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setOccupe(true)
    try {
      const { personnes, onglets } = analyserClasseur(await lireClasseur(f))
      if (!personnes.length) throw new Error('Aucune personne trouvée : le tableau doit avoir des colonnes « Prénom » et « Nom ».')
      const sim = await api('dossiers.importerCatechumenes', { simuler: true, personnes })
      const ex = Object.fromEntries(sim.map((x) => [x.cle, x.existant]))
      setApercu({ fichier: f.name, onglets, personnes: personnes.map((p) => ({ ...p, existant: ex[p.cle] })) })
    } catch (err) { notifier(err.message, 'erreur') } finally { setOccupe(false) }
  }
  return (
    <>
      <input ref={fichier} type="file" accept=".xlsx" className="hidden" onChange={choisi} />
      <button className="btn-clair" onClick={() => fichier.current?.click()} disabled={occupe}>{occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}<span className="hidden sm:inline">Importer un tableau</span></button>
      <Aide>Choisissez le fichier Excel des catéchumènes (un onglet par année). Un aperçu s'ouvre : chaque personne a un statut proposé que vous pouvez corriger avant d'importer. Un dossier qui existe déjà n'est que complété.</Aide>
      {apercu && <ApercuImport apercu={apercu} onFermer={() => setApercu(null)} onFait={(r) => { setApercu(null); notifier(`${r.nouveaux} dossier(s) créé(s), ${r.completes} complété(s)`); onFait() }} />}
    </>
  )
}

function ApercuImport({ apercu, onFermer, onFait }) {
  const notifier = useNotif()
  const [personnes, setPersonnes] = useState(apercu.personnes)
  const [filtre, setFiltre] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const nb = (s) => personnes.filter((p) => p.statut === s).length
  const vus = personnes.filter((p) => !filtre || p.statut === filtre)
  const changer = (cle, statut) => setPersonnes((l) => l.map((p) => (p.cle === cle ? { ...p, statut } : p)))
  const aImporter = personnes.filter((p) => p.statut !== 'ignorer')
  async function importer() {
    setEnvoi(true)
    try { onFait(await api('dossiers.importerCatechumenes', { personnes: aImporter.map(({ existant: _e, ...p }) => p) })) }
    catch (e) { notifier(e.message, 'erreur'); setEnvoi(false) }
  }
  return (
    <Modale large titre={`Importer « ${apercu.fichier} »`} onFermer={onFermer}
      pied={<><span className="mr-auto text-xs text-nuit-600">{aImporter.filter((p) => !p.existant).length} nouveaux dossiers · {aImporter.filter((p) => p.existant).length} à compléter</span>
        <button className="btn-clair" onClick={onFermer}>Annuler</button>
        <button className="btn-principal" disabled={envoi || !aImporter.length} onClick={importer}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Importer {aImporter.length} personne{aImporter.length > 1 ? 's' : ''}</button></>}>
      <p className="mb-3 text-sm text-nuit-600">Onglets lus : {apercu.onglets.join(', ')}. Vérifiez le statut de chacun, surtout les baptisés de 2025 et 2026. Une personne présente dans plusieurs onglets n'apparaît qu'une fois.</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button className={`pastille border ${!filtre ? 'border-or bg-or text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} onClick={() => setFiltre('')}>Tous {personnes.length}</button>
        {STATUTS_IMPORT.filter(([s]) => nb(s)).map(([s, l]) => <button key={s} className={`pastille border ${filtre === s ? 'border-or bg-or text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} onClick={() => setFiltre(s)}>{l} {nb(s)}</button>)}
      </div>
      <ul className="divide-y divide-nuit-100">
        {vus.map((p) => (
          <li key={p.cle} className="grid gap-2 py-2.5 text-sm sm:grid-cols-[1fr_200px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5"><span className="font-medium">{p.prenoms} {String(p.nom).toUpperCase()}</span>
                <span className="text-[11px] text-nuit-600/60">{p.onglets.join(' · ')}</span>
                {p.existant ? <span className="pastille bg-sky-100 py-0 text-[10px] text-sky-900">complète le dossier existant</span> : <span className="pastille bg-emerald-100 py-0 text-[10px] text-emerald-900">nouveau</span>}
                {p.accompagnateur && <span className="text-[11px] text-nuit-600/70">· {p.accompagnateur}</span>}</div>
              {p.notes.length > 0 && <div className="mt-0.5 text-xs italic text-amber-800">{p.notes.join(' · ')}</div>}
              <div className="text-[11px] text-nuit-600/60">{[p.naissance_date && 'né(e) le ' + p.naissance_date.split('-').reverse().join('/'), p.email, p.telephone, p.entree_date && 'entrée ' + p.entree_date.split('-').reverse().join('/')].filter(Boolean).join(' · ')}</div>
            </div>
            <select className={`champ py-1.5 text-sm ${p.statut === 'ignorer' ? 'text-nuit-600/50' : ''}`} value={p.statut} onChange={(e) => changer(p.cle, e.target.value)}>
              {STATUTS_IMPORT.map(([s, l]) => <option key={s} value={s}>{l}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </Modale>
  )
}

/** Liste imprimable des catéchumènes (année choisie ou toutes) : prénom de baptême, parrain / marraine, accompagnateur. */
function imprimerCatechumenes(liste, annee, paroisse) {
  const e = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const tries = liste.filter((d) => d.etat !== 'annule').slice().sort((a, b) => (anneeSacrements(a) || '9999').localeCompare(anneeSacrements(b) || '9999') || a.nom.localeCompare(b.nom, 'fr'))
  let n = 0, prec = null
  const lignes = tries.map((d) => {
    const prenoms = d.nom.split(' ').filter((m) => m !== m.toUpperCase()).join(' ')
    const nom = d.nom.split(' ').filter((m) => m === m.toUpperCase()).join(' ')
    const a = anneeSacrements(d) || ''
    const tete = !annee && a !== prec ? `<tr><td colspan="6" class="annee">${a ? 'Baptême ' + e(a) : 'Année non fixée'}</td></tr>` : ''
    prec = a
    if (tete) n = 0
    n++
    return `${tete}<tr><td>${n}</td><td><b>${e(nom)}</b></td><td>${e(prenoms)}</td><td>${e(d.liste?.prenom_bapteme)}</td><td>${e(d.liste?.parrain)}</td><td>${e(d.liste?.accompagnateur)}</td></tr>`
  }).join('')
  const titre = annee && annee !== 'aucune' ? `Catéchumènes – baptême ${annee}` : annee === 'aucune' ? 'Catéchumènes – année non fixée' : 'Catéchumènes'
  imprimerHtml(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${titre}</title><style>
    @page{size:A4 landscape;margin:14mm} body{font-family:Arial,sans-serif;color:#222} h1{color:#521a22;font-size:19pt;margin:0 0 2mm}
    .sous{color:#666;margin:0 0 7mm} table{width:100%;border-collapse:collapse;font-size:10.5pt} th{text-align:left;border-bottom:2px solid #521a22;padding:2mm}
    td{border-bottom:1px solid #ddd;padding:2mm} td:first-child{color:#888;width:7mm} td.annee{font-weight:bold;color:#a8662e;padding-top:5mm;border-bottom:1px solid #a8662e}
    .total{margin-top:5mm;color:#666;font-size:10pt}</style></head><body>
    <h1>${titre}</h1><p class="sous">${e(paroisse)}</p>
    <table><thead><tr><th>N°</th><th>Nom</th><th>Prénom(s)</th><th>Prénom de baptême</th><th>Parrain / marraine</th><th>Accompagnateur</th></tr></thead><tbody>${lignes}</tbody></table>
    <p class="total">${tries.length} catéchumène${tries.length > 1 ? 's' : ''}</p></body></html>`)
}

/** Actions de la barre de sélection des dossiers. */
function ActionsDossiers({ choisis, lancer, utilisateurs, ecrit, majLocale, recharger, onReclamer, onFraternite }) {
  if (!choisis.length) return null
  const modifiables = choisis.filter((d) => ecrit('dossiers', d.type))
  const n = (l) => `${l.length} dossier${l.length > 1 ? 's' : ''}`
  // étapes et documents des types choisis (sans l'inscription au registre, qui se fait depuis Registres)
  const etapes = [], documents = []
  modifiables.forEach((d) => {
    etapesDe(d.type, d).forEach((e) => { if (e.cle !== 'registre' && !etapes.some((x) => x.cle === e.cle && x.label === e.label)) etapes.push(e) })
    documentsDe(d.type, d).forEach((e) => { if (!documents.some((x) => x.cle === e.cle && x.label === e.label)) documents.push(e) })
  })
  const avec = (cle, quoi) => modifiables.filter((d) => (quoi === 'etape' ? etapesDe : documentsDe)(d.type, d).some((e) => e.cle === cle))
  function groupe(titre, ids, payload, transformer) {
    const vise = new Set(ids)
    lancer({
      titre, texte: `${titre} : ${ids.length} dossier${ids.length > 1 ? 's' : ''}. Vous pourrez annuler pendant 10 secondes.`,
      appliquer: () => majLocale(Object.fromEntries([...vise].map((id) => [id, transformer]))),
      annuler: () => majLocale({}),
      executer: () => api('dossiers.lot', { ids, ...payload }), apres: () => recharger()
    })
  }
  const annees = modifiables.every((d) => TYPES[d.type]?.collectif) ? choixAnneesScolaires() : modifiables.every((d) => ['catechumene', 'confirmand'].includes(d.type)) ? choixAnnees() : null
  const aReclamer = modifiables.filter((d) => d.etat === 'ouvert' && d.email && documentsManquants(d.type, d.documents, d).length)
    .map((d) => { const m = documentsManquants(d.type, d.documents, d); return { id: d.id, nom: d.nom, documents: m.map((x) => x.label), docs: m.map((x) => ({ cle: x.cle, libelle: x.label })) } })
  return (
    <>
      {modifiables.length < choisis.length && <span className="text-xs text-nuit-600/70">{choisis.length - modifiables.length} en lecture seule</span>}
      <MenuAction libelle="Cocher une étape…" disabled={!etapes.length} choix={etapes.map((e) => [e.cle + '|' + e.label, e.label])}
        onChoix={(v) => { const [cle, label] = v.split('|'); const l = avec(cle, 'etape'); groupe(`Étape « ${label} » cochée`, l.map((d) => d.id), { op: 'etape', cle, libelle: label }, (d) => ({ etapes: [...new Set([...d.etapes, cle])] })) }} />
      <MenuAction libelle="Document reçu…" disabled={!documents.length} choix={documents.map((e) => [e.cle + '|' + e.label, e.label])}
        onChoix={(v) => { const [cle, label] = v.split('|'); const l = avec(cle, 'document'); groupe(`Document « ${label} » reçu`, l.map((d) => d.id), { op: 'document', cle }, (d) => ({ documents: [...new Set([...d.documents, cle])] })) }} />
      <MenuAction libelle="État…" choix={[['clos', 'Clore'], ['ouvert', 'Rouvrir'], ['annule', 'Annuler les dossiers']]}
        onChoix={(v, l) => groupe(`${l} (${n(modifiables)})`, modifiables.map((d) => d.id), { op: 'etat', valeur: v }, () => ({ etat: v }))} />
      <MenuAction libelle="Confier à…" choix={[...utilisateurs.map((u) => [u.id, u.nom]), ['-', 'Personne']]}
        onChoix={(v, l) => groupe(`Confiés à ${l}`, modifiables.map((d) => d.id), { op: 'responsable', valeur: v === '-' ? '' : v }, () => ({ responsable: v === '-' ? '' : v }))} />
      {annees && <MenuAction libelle="Année…" choix={annees.map((a) => [a, a])}
        onChoix={(v) => groupe(`Année ${v}`, modifiables.map((d) => d.id), { op: 'annee', valeur: v }, () => ({ annee: v }))} />}
      <button className="btn-clair py-1.5 text-xs" disabled={!aReclamer.length} title={aReclamer.length ? '' : 'Aucun dossier choisi n\'a de document manquant et une adresse e-mail'} onClick={() => onReclamer(aReclamer)}><BellRing className="h-3.5 w-3.5" />Réclamer les documents ({aReclamer.length})</button>
      {choisis.some((d) => ['catechumene', 'confirmand'].includes(d.type)) && <button className="btn-or py-1.5 text-xs" onClick={onFraternite}><HeartHandshake className="h-3.5 w-3.5" />Fraternité</button>}
    </>
  )
}
