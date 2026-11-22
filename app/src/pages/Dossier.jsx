import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Upload, Loader2, Mail, Printer, FileText, Download, ExternalLink, Globe, Plus, Trash2, Save, History, Send, Church, AlertCircle } from 'lucide-react'
import { api, fichierEnBase64, telechargerBase64, enCache, vignetteImage } from '../api.js'
import { useApp } from '../App.jsx'
import { estOptionnel, ALERTES, TYPES, ETATS, documentsManquants, PAR_ANNEE, anneeSacrements, choixAnnees, etapesDe, documentsDe, TITRES_COLLECTIFS, choixAnneesScolaires, lieuPreparation, libelleAnnee } from '../types.js'
import { IMPRIMABLES } from '../imprimables.js'
import { Chargement, Erreur, Modale, useNotif, useConfirmer, useDifferer, useAutoEnregistrement, EtatEnregistrement, Aide, dateHeure, dateRelative, dateCourte, versLocal, jourLong, heure } from '../ui.jsx'
import { Redaction } from './Courrier.jsx'
import ChoixFraternite from './ChoixFraternite.jsx'
import { htmlVersPdf } from '../pdf.js'
import { creerExtrait, PadSignature, chargerSceau } from './Extraits.jsx'
import { PenLine, RefreshCw, HeartHandshake, Link2, Smartphone, Copy } from 'lucide-react'

const champsEditables = (d) => ({
  infos: d.infos, etapes: d.etapes, documents: d.documents, rencontres: d.rencontres,
  etat: d.etat, responsable: d.responsable, date_celebration: d.date_celebration
})

export default function Dossier() {
  const { id } = useParams()
  const navDossier = useNavigate()
  const confirmer = useConfirmer()
  const notifier = useNotif()
  const app = useApp()
  const differer = useDifferer()
  const [d, setD] = useState(() => enCache('dossiers.lire', { id }) || null)
  const [b, setB] = useState(() => { const x = enCache('dossiers.lire', { id }); return x ? champsEditables(x) : null })           // brouillon
  const bActuel = useRef(b)
  bActuel.current = b
  const [erreur, setErreur] = useState(null)
  const [sauvegarde, setSauvegarde] = useState(false)
  const [mail, setMail] = useState(null)
  const [imprimer, setImprimer] = useState(null)
  const [envoiPiece, setEnvoiPiece] = useState(null)
  const fichierRef = useRef()
  const docCible = useRef(null)

  useEffect(() => {
    const c = enCache('dossiers.lire', { id })
    setD(c || null); setB(c ? champsEditables(c) : null)
    api('dossiers.lire', { id }).then((x) => { setD(x); setB(champsEditables(x)) }).catch(setErreur)
  }, [id])
  // Enregistrement automatique : 1 s après la dernière modification
  const etatAuto = useAutoEnregistrement(b, d && champsEditables(d), async (val) => {
    const x = await api('dossiers.modifier', { id: d.id, ...val })
    setD(x)
    if (JSON.stringify(bActuel.current) === JSON.stringify(val)) setB(champsEditables(x))
  })
  const [promotions, setPromotions] = useState({})
  useEffect(() => { api('promotions.liste').then(setPromotions).catch(() => {}) }, [])
  const modifie = useMemo(() => d && b && JSON.stringify(champsEditables(d)) !== JSON.stringify(b), [d, b])


  if (erreur) return <Erreur erreur={erreur} />
  if (!d || !b) return <Chargement />
  const t = TYPES[d.type]
  const dossierCourant = { ...d, ...b, nom: d.nom }

  function supprimerDossier() {
    const cible = d.id
    navDossier('/dossiers')
    differer(`Dossier « ${d.nom} » supprimé`, () => api('dossiers.supprimer', { id: cible }), { ids: [cible], onAnnule: () => navDossier(`/dossiers/${cible}`) })
  }
  async function enregistrer() {
    setSauvegarde(true)
    try { const x = await api('dossiers.modifier', { id: d.id, ...b }); setD(x); setB(champsEditables(x)); notifier('Dossier enregistré'); return x }
    catch (e) { notifier(e.message, 'erreur'); throw e } finally { setSauvegarde(false) }
  }
  const avantAction = async () => (modifie ? enregistrer() : d)
  const majInfo = (cle, v) => setB({ ...b, infos: { ...b.infos, [cle]: v } })
  function basculerEtape(e) {
    const fait = b.etapes[e.cle]?.fait
    const etapes = { ...b.etapes }
    if (fait) delete etapes[e.cle]; else etapes[e.cle] = { fait: true, date: new Date().toISOString(), par: app.utilisateur.nom, libelle: e.label }
    setB({ ...b, etapes })
  }
  function basculerDoc(doc) {
    const documents = { ...b.documents }
    if (documents[doc.cle]?.recu) delete documents[doc.cle]; else documents[doc.cle] = { recu: true, date: new Date().toISOString() }
    setB({ ...b, documents })
  }
  function changerDate(v) {
    const iso = v ? new Date(v).toISOString() : ''
    const etapes = { ...b.etapes }
    if (iso && t.etapes.some((e) => e.cle === 'date') && !etapes.date?.fait) etapes.date = { fait: true, date: new Date().toISOString(), par: app.utilisateur.nom, libelle: 'Date fixée' }
    setB({ ...b, date_celebration: iso, etapes })
  }
  async function deposer(fichiers) {
    const f = fichiers[0]
    if (!f) return
    const doc = docCible.current
    setEnvoiPiece(doc?.cle || 'autre')
    try {
      await avantAction()
      const x = await api('dossiers.piece', { dossierId: d.id, nom: f.name, type: f.type, base64: await fichierEnBase64(f), mini: doc?.cle === 'photo' ? await vignetteImage(f) : '', doc: doc?.cle || '', libelle: doc?.label || f.name.replace(/\.[^.]+$/, '') })
      setD(x); setB(champsEditables(x)); notifier('Pièce ajoutée au dossier')
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoiPiece(null); fichierRef.current.value = ''; docCible.current = null }
  }
  const choisirFichier = (doc) => { docCible.current = doc; fichierRef.current.click() }

  async function ouvrirMail(opts) {
    try { await avantAction() } catch { return }
    setMail({ mode: 'nouveau', a: d.email, dossier: dossierCourant, ...opts })
  }
  const manquants = documentsManquants(d.type, Object.keys(b.documents).filter((k) => b.documents[k]?.recu), b.infos)
  const contexteMail = { documents_manquants: manquants.map((m) => '- ' + m.label).join('\n') }

  function mailActeBapteme() {
    const i = b.infos, prenom = i.prenoms || i.enfant_prenoms || ''
    ouvrirMail({ sujet: 'Votre acte de baptême – préparation à la confirmation',
      corps: `Bonjour ${prenom},\n\nPour recevoir le sacrement de confirmation, un acte de baptême récent est indispensable. Merci de le demander dès maintenant à la paroisse de votre baptême${i.bapteme_paroisse ? ` (${i.bapteme_paroisse}${i.bapteme_date ? ', baptême du ' + dateCourte(i.bapteme_date) : ''})` : ''} et de nous le transmettre par retour de mail ou au secrétariat.\n\nPour faciliter la recherche, indiquez à la paroisse vos nom et prénoms, votre date de naissance et le nom de vos parents.\n\nAvec l'assurance de nos prières à toutes vos intentions,` })
  }
  async function changerTypeConf() {
    const vers = d.type === 'confirmand' ? 'confirmation_jeune' : 'confirmand'
    if (!(await confirmer({ titre: vers === 'confirmation_jeune' ? 'Passer en Confirmation (jeunes)' : 'Repasser en Confirmand adulte', texte: vers === 'confirmation_jeune' ? `${d.nom} rejoindra la célébration commune des jeunes de l'année scolaire. Les informations, étapes et pièces sont conservées.` : `${d.nom} redevient un dossier « Confirmand adulte ». Les informations, étapes et pièces sont conservées.`, bouton: 'Changer' }))) return
    try { await avantAction(); const x = await api('dossiers.changerType', { id: d.id, type: vers }); setD(x); setB(champsEditables(x)); notifier('Dossier changé') } catch (e) { notifier(e.message, 'erreur') }
  }
  function mailNotificationParoisse() {
    const i = b.infos
    const quand = b.date_celebration ? `le ${dateCourte(b.date_celebration)}` : ''
    const corps = d.type === 'mariage'
      ? `Bonjour,\n\nNous vous informons du mariage de ${d.nom}, célébré ${quand} (${i.lieu_celebration || app.reglages.paroisse}), inscrit au registre des mariages ${i.registre_annee || ''} sous l'acte n° ${i.acte_numero || '…'}.\n\nMerci de bien vouloir en porter mention en marge de l'acte de baptême.\n\nAvec l'assurance de nos prières à toutes vos intentions,`
      : `Bonjour,\n\nNous vous informons de la confirmation de ${d.nom}, célébrée ${quand} (${i.lieu_celebration || ''}), inscrite au registre des confirmations ${i.registre_annee || ''} sous l'acte n° ${i.acte_numero || '…'}.\n\nBaptême : ${i.bapteme_paroisse || '…'}, le ${i.bapteme_date ? dateCourte(i.bapteme_date) : '…'}.\n\nMerci de bien vouloir en porter mention en marge de l'acte de baptême.\n\nAvec l'assurance de nos prières à toutes vos intentions,`
    ouvrirMail({ a: '', sujet: d.type === 'mariage' ? `Notification de mariage – ${d.nom}` : `Notification de confirmation – ${d.nom}`, corps })
  }

  return (
    <>
      <input ref={fichierRef} type="file" className="hidden" onChange={(e) => deposer([...e.target.files])} />
      <Link to="/dossiers" className="mb-3 inline-flex items-center gap-1 text-sm text-nuit-600 hover:text-or-600"><ArrowLeft className="h-4 w-4" />Dossiers</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="mb-1 flex flex-wrap gap-1.5"><span className="pastille text-white" style={{ background: t.couleur }}>{t.nom}</span>
            {PAR_ANNEE.includes(d.type) && <span className="pastille border border-or bg-or-50 text-or-600">{anneeSacrements({ ...d, ...b, annee: '' }) ? libelleAnnee(d.type) + anneeSacrements({ ...d, ...b, annee: '' }) : 'Année non fixée'}</span>}
            {t.collectif && b.infos.preparation && <span className="pastille border border-nuit-100 bg-white text-nuit-600">Préparation : {lieuPreparation(b.infos)}</span>}
            {t.collectif && b.infos.preparation && b.infos.preparation !== 'Paroisse' && !b.etapes.validation?.fait && <span className="pastille bg-amber-100 text-amber-900">En attente de validation du curé</span>}</span>
          {d.alertes?.length > 0 && <span className="mb-1 flex flex-wrap gap-1.5">{d.alertes.map((a) => <span key={a} className={`pastille ${ALERTES[a]?.classe}`}>{ALERTES[a]?.nom}{a === 'autre_confession' && b.infos.confession_origine ? ` : ${b.infos.confession_origine}` : ''}</span>)}</span>}
          <h1 className="flex items-center gap-3 text-3xl font-semibold leading-tight">{d.photo && <PhotoDossier d={d} />}{d.nom || 'Sans nom'}</h1>
          <p className="text-xs text-nuit-600/70">Créé le {dateCourte(d.cree_le)} · {d.source}{t.note ? ` · ${t.note}` : ''}{b.infos.inscription_catechisme && <> · <Link to={`/catechisme/${b.infos.inscription_catechisme}`} className="text-or-600 hover:underline">Inscription au catéchisme →</Link></>}</p>
          {['catechumene', 'confirmand'].includes(d.type) && <FraterniteDossier d={d} onMaj={(f) => setD((x) => ({ ...x, fraternite: f }))} />}
          {d.type === 'catechumene' && <EspaceDossier d={d} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="champ w-auto" value={b.responsable} onChange={(e) => setB({ ...b, responsable: e.target.value })}>
            <option value="">Sans responsable</option>{app.utilisateurs.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
          </select>
          <select className="champ w-auto" value={b.etat} onChange={(e) => setB({ ...b, etat: e.target.value })}>
            {Object.entries(ETATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn-danger" title="Supprimer le dossier" onClick={supprimerDossier}><Trash2 className="h-4 w-4" /><span className="hidden sm:inline">Supprimer</span></button>
        </div>
      </div>

      {(etatAuto || modifie) && <div className="-mt-3 mb-3 flex justify-end"><EtatEnregistrement etat={etatAuto === 'erreur' ? 'erreur' : modifie || sauvegarde ? 'encours' : etatAuto} /></div>}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Colonne de suivi */}
        <div className="space-y-5">
          <section className="carte p-4">
            <h2 className="mb-2 text-xl font-semibold">Étapes</h2>
            <ol className="space-y-1">
              {etapesDe(d.type, b.infos).map((e, i) => {
                const fait = b.etapes[e.cle]?.fait
                return (
                  <li key={e.cle}><button onClick={() => basculerEtape(e)} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-nuit-50">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${fait ? 'border-transparent text-white' : 'border-nuit-100 text-nuit-600/60'}`} style={fait ? { background: t.couleur } : {}}>{fait ? <Check className="h-3 w-3" /> : i + 1}</span>
                    <span className="min-w-0"><span className={fait ? 'text-nuit-600/70' : 'font-medium'}>{e.label}</span>{estOptionnel(e, b.infos) && <span className="ml-1 text-[11px] italic text-nuit-600/50">facultatif</span>}
                      {fait && <span className="block text-[11px] text-nuit-600/50">{dateCourte(b.etapes[e.cle].date)} · {b.etapes[e.cle].par}</span>}</span>
                  </button></li>
                )
              })}
            </ol>
          </section>

          {t.collectif ? (
            <section className="carte p-4">
              <h2 className="mb-2 text-xl font-semibold">Célébration</h2>
              <p className="text-xs text-nuit-600/70">Célébration commune à toute l'année scolaire {b.infos.annee_scolaire || '(à choisir dans « Préparation »)'}.</p>
              {(() => {
                const pr = promotions[`${d.type}|${b.infos.annee_scolaire}`]
                return pr?.date
                  ? <p className="mt-2 text-sm font-medium first-letter:uppercase">{jourLong(pr.date)} à {heure(pr.date)}{pr.lieu ? ` — ${pr.lieu}` : ''}</p>
                  : <p className="mt-2 text-sm text-nuit-600/70">Date pas encore fixée.</p>
              })()}
              <Link to={`/dossiers?type=${d.type}&annee=${b.infos.annee_scolaire || ''}`} className="mt-2 inline-block text-xs text-or-600 hover:underline">Fixer la date et voir la liste de l'année →</Link>
            </section>
          ) : (
          <section className="carte p-4">
            <h2 className="mb-2 text-xl font-semibold">{d.type === 'catechumene' ? 'Année des sacrements' : d.type === 'confirmand' ? 'Date de confirmation' : 'Date de célébration'}</h2>
            {['catechumene', 'confirmand'].includes(d.type) && (
              <div className="mb-3">
                {d.type === 'confirmand' ? <label className="etiquette">Année de la confirmation</label> : <p className="mb-1 text-xs text-nuit-600/70">Baptême, confirmation et eucharistie à la veillée pascale de l'année choisie.</p>}
                <select className="champ" value={b.infos.annee_sacrements || ''} onChange={(e) => majInfo('annee_sacrements', e.target.value)}>
                  <option value="">{b.date_celebration ? `D'après la date : ${new Date(b.date_celebration).getFullYear()}` : 'Non fixée'}</option>
                  {choixAnnees().map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {d.type === 'confirmand' && <label className="etiquette mt-3">Date exacte</label>}
              </div>
            )}
            {d.type !== 'catechumene' && <>
            <input className="champ" type="datetime-local" value={b.date_celebration ? versLocal(b.date_celebration) : ''} onChange={(e) => changerDate(e.target.value)} />
            <p className="mt-2 flex gap-1.5 text-xs text-nuit-600/70"><Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-or" />Publiée dans l'agenda public comme « {({ bapteme: 'Baptême', mariage: 'Mariage', obseques: 'Obsèques', catechumene: "Baptême d'adulte", confirmand: 'Confirmation' })[d.type]} », sans nom{b.infos.lieu_celebration ? `, lieu : ${b.infos.lieu_celebration}` : ''}.</p>
            {b.date_celebration && <p className="mt-1 text-sm font-medium capitalize">{jourLong(b.date_celebration)} à {heure(b.date_celebration)}</p>}
            </>}
          </section>
          )}

          {t.rdvCure && <RendezVousCure infos={b.infos} email={d.email}
            onChoix={(ev) => setB({ ...b, infos: { ...b.infos, rdv_cure_date: ev?.debut || '', rdv_cure_lieu: ev?.lieu || '', rdv_cure_evenement: ev?.id || '' },
              etapes: ev && !b.etapes.rdv_cure?.fait ? { ...b.etapes, rdv_cure: { fait: true, date: new Date().toISOString(), par: app.utilisateur.nom, libelle: 'Rendez-vous avec le curé' } } : b.etapes })}
            onRappel={() => ouvrirMail({
              sujet: `Rappel : rendez-vous avec M. le curé – première communion de ${b.infos.enfant_prenoms || d.nom}`,
              corps: `Bonjour,\n\nNous vous rappelons votre rendez-vous avec M. le curé, dans le cadre de la préparation à la première communion de ${b.infos.enfant_prenoms || d.nom} :\n\n${jourLong(b.infos.rdv_cure_date).replace(/^./, (c) => c.toUpperCase())} à ${heure(b.infos.rdv_cure_date)}${b.infos.rdv_cure_lieu ? '\n' + b.infos.rdv_cure_lieu : ''}\n\nEn cas d'empêchement, merci de nous prévenir en répondant à ce message.\n\nAvec l'assurance de nos prières à toutes vos intentions,`
            })} />}

          {documentsDe(d.type, b.infos).length > 0 && (
            <section className="carte p-4">
              <h2 className="mb-2 text-xl font-semibold">Documents</h2>
              <ul className="space-y-1">
                {documentsDe(d.type, b.infos).map((doc) => {
                  const recu = b.documents[doc.cle]?.recu
                  return (
                    <li key={doc.cle} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-nuit-50/50">
                      <button onClick={() => basculerDoc(doc)} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${recu ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-nuit-100'}`}>{recu && <Check className="h-3 w-3" />}</button>
                      <span className={`min-w-0 flex-1 ${recu ? 'text-nuit-600/70' : ''}`}>{doc.label}</span>
                      <button className="btn-icone p-1" title="Joindre le document" onClick={() => choisirFichier(doc)}>{envoiPiece === doc.cle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</button>
                    </li>
                  )
                })}
              </ul>
              {manquants.length > 0 && d.email && (
                <button className="btn-clair mt-3 w-full text-xs" onClick={() => ouvrirMail({ reponse: 'document_manquant', contexte: contexteMail })}><Mail className="h-4 w-4" />Réclamer {manquants.length} document{manquants.length > 1 ? 's' : ''}</button>
              )}
            </section>
          )}

          {t.rencontres && <Rencontres liste={b.rencontres} onChange={(rencontres) => setB({ ...b, rencontres })} couleur={t.couleur} />}
        </div>

        {/* Colonne d'informations */}
        <div className="space-y-5 lg:col-span-2">
          <section className="carte p-4">
            <h2 className="mb-3 text-xl font-semibold">Actions</h2>
            <div className="flex flex-wrap gap-2">
              {t.reponses.filter((r) => r !== 'document_manquant').map((r) => {
                const rep = app.reponses.find((x) => x.cle === r)
                return rep && <button key={r} className="btn-clair" disabled={!d.email} onClick={() => ouvrirMail({ reponse: r, contexte: contexteMail })}><Send className="h-4 w-4" />{rep.titre}</button>
              })}
              <button className="btn-clair" disabled={!d.email} onClick={() => ouvrirMail({})}><Mail className="h-4 w-4" />Écrire{d.email ? '' : ' (pas d\'e-mail)'}</button>
              {t.generer.map((g) => <button key={g} className="btn-or" onClick={async () => { try { await avantAction(); setImprimer(g) } catch { /* */ } }}><Printer className="h-4 w-4" />{IMPRIMABLES[g].titre}</button>)}
              {(t.actions || []).includes('notifier_paroisses') && <button className="btn-clair" onClick={mailNotificationParoisse}><Church className="h-4 w-4" />Notifier les paroisses de baptême</button>}
              {['confirmand', 'confirmation_jeune'].includes(d.type) && <button className="btn-clair" onClick={mailActeBapteme}><Mail className="h-4 w-4" />Demander l'acte de baptême</button>}
              {(d.alertes?.includes('mineur') || (d.type === 'confirmation_jeune' && b.infos.form_cles?.length)) && <button className="btn-clair" onClick={changerTypeConf}><RefreshCw className="h-4 w-4" />{d.type === 'confirmand' ? 'Passer en Confirmation (jeunes)' : 'Repasser en Confirmand adulte'}</button>}
              {(t.actions || []).includes('notifier_paroisse_bapteme') && <button className="btn-clair" onClick={mailNotificationParoisse}><Church className="h-4 w-4" />Notifier la paroisse de baptême</button>}
              {(t.actions || []).includes('intention_messe') && <button className="btn-clair" disabled title="Liaison avec l'AppMESSE à venir"><Church className="h-4 w-4" />Intention de messe (AppMESSE, bientôt)</button>}
            </div>
          </section>

          <section className="carte p-4">
            <h2 className="mb-3 text-xl font-semibold">Informations</h2>
            <div className="space-y-5">
              {t.sections.map((s) => (
                <fieldset key={s.titre}>
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-or-600">{s.titre}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {s.champs.map((c) => (
                      <div key={c.cle} className={c.type === 'paragraphe' ? 'sm:col-span-2' : ''}>
                        <label className="etiquette">{c.label}</label>
                        {c.type === 'paragraphe' ? <textarea className="champ min-h-[70px]" value={b.infos[c.cle] || ''} onChange={(e) => majInfo(c.cle, e.target.value)} />
                          : c.type === 'anneeScolaire' ? <select className="champ" value={b.infos[c.cle] || ''} onChange={(e) => majInfo(c.cle, e.target.value)}><option value="">Non fixée</option>{choixAnneesScolaires().map((o) => <option key={o} value={o}>{o}</option>)}</select>
                          : c.type === 'annee' ? <select className="champ" value={b.infos[c.cle] || ''} onChange={(e) => majInfo(c.cle, e.target.value)}><option value="">{b.date_celebration ? `— (d'après la date : ${new Date(b.date_celebration).getFullYear()})` : 'Non fixée'}</option>{choixAnnees().map((o) => <option key={o} value={o}>{o}</option>)}</select>
                          : c.type === 'choix' ? <select className="champ" value={b.infos[c.cle] || ''} onChange={(e) => majInfo(c.cle, e.target.value)}>{c.choix.map((o) => <option key={o} value={o}>{o || '—'}</option>)}</select>
                          : <input className="champ" type={c.type === 'date' ? 'date' : c.type === 'email' ? 'email' : c.type === 'tel' ? 'tel' : 'text'} value={b.infos[c.cle] || ''} onChange={(e) => majInfo(c.cle, e.target.value)} />}
                      </div>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="carte p-4">
              <div className="mb-2 flex items-center justify-between"><h2 className="text-xl font-semibold">Pièces (Drive)</h2>
                <button className="btn-icone" title="Ajouter une pièce" onClick={() => choisirFichier(null)}>{envoiPiece === 'autre' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</button></div>
              {!d.pieces.length ? <p className="text-sm text-nuit-600/60">Aucune pièce.</p> : (
                <ul className="divide-y divide-nuit-50 text-sm">
                  {d.pieces.slice().reverse().map((p) => (
                    <li key={p.id} className="flex items-center gap-2 py-1.5">
                      <FileText className={`h-4 w-4 shrink-0 ${p.genere ? 'text-or' : 'text-nuit-600/60'}`} />
                      <span className="min-w-0 flex-1"><span className="block truncate">{p.libelle}</span><span className="text-[11px] text-nuit-600/50">{dateCourte(p.date)} · {p.par}</span></span>
                      <button className="btn-icone p-1" onClick={async () => { try { telechargerBase64(await api('documents.telecharger', { id: p.id })) } catch (e) { notifier(e.message, 'erreur') } }}><Download className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="carte p-4">
              <h2 className="mb-2 text-xl font-semibold">Mails</h2>
              {!d.fils.length ? <p className="text-sm text-nuit-600/60">Aucun mail rattaché.</p> : (
                <ul className="divide-y divide-nuit-50 text-sm">
                  {d.fils.map((f) => <li key={f.id}><Link to={`/courrier?fil=${f.id}`} className="flex items-center gap-2 py-1.5 hover:text-or-600"><Mail className="h-4 w-4 shrink-0 text-nuit-600/60" /><span className="min-w-0 flex-1 truncate">{f.sujet}</span><span className="text-[11px] text-nuit-600/50">{dateRelative(f.date)}</span><ExternalLink className="h-3 w-3 opacity-40" /></Link></li>)}
                </ul>
              )}
            </section>
          </div>

          <section className="carte p-4">
            <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold"><History className="h-4 w-4 text-or" />Historique</h2>
            <ul className="space-y-1 text-sm">
              {d.historique.slice(0, 30).map((h, i) => <li key={i} className="flex gap-3"><span className="w-32 shrink-0 text-xs text-nuit-600/60">{dateHeure(h.date)}</span><span className="min-w-0"><span className="text-nuit-600/70">{h.par} — </span>{h.texte}</span></li>)}
            </ul>
          </section>
        </div>
      </div>

      {mail && <Redaction {...mail} onFermer={() => setMail(null)} onEnvoye={async () => { setMail(null); notifier('Message envoyé et rattaché au dossier'); const x = await api('dossiers.lire', { id: d.id }); setD(x); setB(champsEditables(x)) }} />}
      {imprimer && <Imprimer modele={IMPRIMABLES[imprimer]} dossier={{ ...d, ...b }} reglages={app.reglages}
        onFermer={() => setImprimer(null)} onArchive={(x, msg) => { setD(x); setB(champsEditables(x)); notifier(msg || 'Document archivé dans le dossier') }} />}
    </>
  )
}

function Rencontres({ liste, onChange, couleur }) {
  const [date, setDate] = useState('')
  const [titre, setTitre] = useState('')
  const ajouter = () => { onChange([...liste, { id: Math.random().toString(36).slice(2, 9), date, titre, present: true }].sort((a, b) => String(a.date).localeCompare(String(b.date)))); setDate(''); setTitre('') }
  const presents = liste.filter((r) => r.present).length
  return (
    <section className="carte p-4">
      <h2 className="mb-1 text-xl font-semibold">Rencontres</h2>
      <p className="mb-2 text-xs text-nuit-600/60">{liste.length ? `Présent(e) à ${presents} sur ${liste.length}` : 'Aucune rencontre notée.'}</p>
      <ul className="space-y-1">
        {liste.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-sm">
            <button onClick={() => onChange(liste.map((x) => (x.id === r.id ? { ...x, present: !x.present } : x)))} className={`pastille w-16 justify-center border ${r.present ? 'border-transparent text-white' : 'border-red-200 bg-red-50 text-red-700'}`} style={r.present ? { background: couleur } : {}}>{r.present ? 'présent' : 'absent'}</button>
            <span className="w-20 shrink-0 text-xs text-nuit-600/70">{r.date ? dateCourte(r.date) : '—'}</span>
            <span className="min-w-0 flex-1 truncate">{r.titre}</span>
            <button className="btn-icone p-1 text-nuit-600/40 hover:text-red-700" onClick={() => onChange(liste.filter((x) => x.id !== r.id))}><Trash2 className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-1.5">
        <input className="champ w-36 px-2 py-1.5 text-xs" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="champ px-2 py-1.5 text-xs" placeholder="Thème / rencontre" value={titre} onChange={(e) => setTitre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && date && ajouter()} />
        <button className="btn-clair px-2 py-1.5" disabled={!date} onClick={ajouter}><Plus className="h-4 w-4" /></button>
      </div>
    </section>
  )
}

function Imprimer({ modele, dossier, reglages, onFermer, onArchive }) {
  const notifier = useNotif()
  const [v, setV] = useState(() => modele.depuis(dossier, reglages))
  const [archivage, setArchivage] = useState(false)
  const cadre = useRef()
  const html = modele.html(v)
  async function archiver() {
    setArchivage(true)
    try { const { base64 } = await htmlVersPdf(html); onArchive(await api('dossiers.archiver', { dossierId: dossier.id, libelle: modele.titre, pdf: base64 })) } catch (e) { notifier(e.message, 'erreur') } finally { setArchivage(false) }
  }
  const nav = useNavigate()
  const { utilisateur } = useApp()
  const [etapeSig, setEtapeSig] = useState(0)   // 0 : rien, 1 : prêtre, 2 : catéchumène
  const [sigPretre, setSigPretre] = useState('')
  async function signatureCatechumene(png) {
    setEtapeSig(0); setArchivage(true)
    try {
      const le = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
      const sceau = await chargerSceau()
      const vals = { ...v, ministre: v.ministre || utilisateur.nom }
      const { base64 } = await htmlVersPdf(modele.html(vals, { pretre: sigPretre, catechumene: png, sceau, le }))
      onArchive(await api('dossiers.signerB6', { dossierId: dossier.id, pdf: base64, ministre: vals.ministre }), 'B6 signé, archivé dans le dossier ; étape « Entrée en catéchuménat » cochée')
      onFermer()
    } catch (e) { notifier(e.message, 'erreur'); setArchivage(false) }
  }
  async function delivrer() {
    setArchivage(true)
    try { const x = await creerExtrait(v, dossier.id); nav(`/extraits/${x.id}`) } catch (e) { notifier(e.message, 'erreur'); setArchivage(false) }
  }
  return (
    <>
    <Modale large titre={modele.titre} onFermer={onFermer}
      pied={<><button className="btn-clair mr-auto" onClick={onFermer}>Fermer</button>
        {modele === IMPRIMABLES.B14 && <button className="btn-or" onClick={delivrer} disabled={archivage}><FileText className="h-4 w-4" />Délivrer un extrait signé</button>}
        {modele === IMPRIMABLES.B6 && <button className="btn-or" onClick={() => setEtapeSig(1)} disabled={archivage}>{archivage ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}Faire signer</button>}
        {modele === IMPRIMABLES.B6 && <Aide>Le prêtre ou le diacre signe, puis le catéchumène, sur le même appareil. Le PDF avec le sceau est archivé dans le Drive et l'étape cochée.</Aide>}
        <button className="btn-clair" onClick={archiver} disabled={archivage}>{archivage ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}Archiver (PDF)</button>
        <button className="btn-principal" onClick={() => cadre.current.contentWindow.print()}><Printer className="h-4 w-4" />Imprimer</button></>}>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="space-y-2 md:max-h-[60vh] md:overflow-y-auto md:pr-2">
          <p className="text-xs text-nuit-600/70">Vérifiez et complétez ; les modifications ici ne changent que ce document.</p>
          {modele.champs.map(([cle, label, genre]) => (
            <div key={cle}><label className="etiquette">{label}</label>
              {genre === 'sexe' ? <select className="champ py-1.5 text-xs" value={v[cle] || ''} onChange={(e) => setV({ ...v, [cle]: e.target.value })}><option value="">—</option><option>Garçon</option><option>Fille</option></select>
              : genre === 'zone' ? <textarea className="champ min-h-[60px] py-1.5 text-xs" value={v[cle] || ''} onChange={(e) => setV({ ...v, [cle]: e.target.value })} />
                : <input className="champ py-1.5 text-xs" value={v[cle] || ''} onChange={(e) => setV({ ...v, [cle]: e.target.value })} />}</div>
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-nuit-100 bg-[#e9e6df]">
          <div style={{ height: 560, overflow: 'hidden' }}>
            <iframe ref={cadre} title="aperçu" srcDoc={html} style={{ width: '210mm', height: '297mm', border: 0, transform: 'scale(0.6)', transformOrigin: 'top left' }} />
          </div>
        </div>
      </div>
    </Modale>
    {etapeSig === 1 && <PadSignature titre="B6 – signature 1/2 : prêtre ou diacre" nom={v.ministre || utilisateur.nom}
      consigne={<>Signature de <strong>{v.ministre || utilisateur.nom}</strong>, qui accueille le catéchumène.</>}
      note="Ensuite, passez l'appareil au catéchumène pour sa signature."
      onFermer={() => setEtapeSig(0)} onValider={(png) => { setSigPretre(png); setEtapeSig(2) }} />}
    {etapeSig === 2 && <PadSignature titre="B6 – signature 2/2 : catéchumène" nom={[v.prenoms, v.nom].filter(Boolean).join(' ')}
      consigne={<>Signature de <strong>{[v.prenoms, v.nom].filter(Boolean).join(' ')}</strong>, catéchumène.</>}
      note="Le B6 signé (avec le sceau) est archivé dans le dossier, et l'étape « Entrée en catéchuménat » est cochée."
      onFermer={() => setEtapeSig(0)} onValider={signatureCatechumene} />}
    </>
  )
}

function RendezVousCure({ infos, email, onChoix, onRappel }) {
  const [liste, setListe] = useState(null)
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState(null)
  useEffect(() => {
    if (infos.rdv_cure_date) return
    api('agenda.rendezvous', { email }).then(setListe).catch(setErreur)
  }, [email, infos.rdv_cure_date])
  const trouves = (liste || []).filter((e) => e.correspond)
  const passe = infos.rdv_cure_date && new Date(infos.rdv_cure_date) < new Date()
  return (
    <section className="carte p-4">
      <h2 className="mb-2 text-xl font-semibold">Rendez-vous avec le curé</h2>
      {infos.rdv_cure_date ? (
        <>
          <p className="text-sm font-medium first-letter:uppercase">{jourLong(infos.rdv_cure_date)} à {heure(infos.rdv_cure_date)}</p>
          {infos.rdv_cure_lieu && <p className="text-xs text-nuit-600/70">{infos.rdv_cure_lieu}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {!passe && <button className="btn-or py-1.5 text-xs" disabled={!email} onClick={onRappel}><Mail className="h-4 w-4" />Envoyer le rappel aux parents</button>}
            <button className="btn-clair py-1.5 text-xs" onClick={() => { setOuvert(true); if (!liste) api('agenda.rendezvous', { email }).then(setListe).catch(setErreur) }}>Changer</button>
            <button className="btn-clair py-1.5 text-xs" onClick={() => onChoix(null)}>Retirer</button>
          </div>
        </>
      ) : (
        <>
          {!liste && !erreur ? <p className="text-xs text-nuit-600/60">Recherche dans l'agenda…</p>
            : trouves.length ? (
              <div className="space-y-1.5">
                <p className="text-xs text-emerald-800">Trouvé dans l'agenda (réservé avec l'e-mail des parents) :</p>
                {trouves.slice(0, 3).map((e) => (
                  <button key={e.id} onClick={() => onChoix(e)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm hover:bg-emerald-100">
                    <span><span className="block font-medium first-letter:uppercase">{jourLong(e.debut)} à {heure(e.debut)}</span><span className="text-xs text-nuit-600/70">{e.titre}</span></span><span className="text-xs font-medium text-emerald-800">Associer</span>
                  </button>
                ))}
              </div>
            ) : <p className="text-xs text-nuit-600/60">Aucun rendez-vous trouvé avec l'e-mail des parents.</p>}
          <button className="btn-clair mt-2 w-full py-1.5 text-xs" onClick={() => setOuvert(true)}>Choisir dans l'agenda</button>
        </>
      )}
      <Erreur erreur={erreur} />
      {ouvert && (
        <Modale titre="Choisir le rendez-vous" onFermer={() => setOuvert(false)}>
          {!liste ? <Chargement /> : !liste.length ? <p className="text-sm text-nuit-600/70">Aucun rendez-vous dans les six prochains mois.</p> : (
            <ul className="max-h-[60vh] divide-y divide-nuit-50 overflow-y-auto">
              {liste.map((e) => (
                <li key={e.id}><button onClick={() => { onChoix(e); setOuvert(false) }} className={`flex w-full items-start gap-3 px-2 py-2 text-left text-sm hover:bg-nuit-50 ${e.correspond ? 'bg-emerald-50' : ''}`}>
                  <span className="w-36 shrink-0 text-xs text-nuit-600/80 first-letter:uppercase">{jourLong(e.debut)}<br /><b>{heure(e.debut)}</b></span>
                  <span className="min-w-0"><span className="block font-medium">{e.titre}</span><span className="block truncate text-xs text-nuit-600/60">{e.invites?.join(', ')}</span>{e.correspond && <span className="text-xs text-emerald-800">correspond à l'e-mail des parents</span>}</span>
                </button></li>
              ))}
            </ul>
          )}
        </Modale>
      )}
    </section>
  )
}

/** Fraternité Cor Unum du catéchumène / néophyte / confirmand, avec « Relier » et « Délier ». */
/** Photo d'identité : vignette, agrandie au clic. */
function PhotoDossier({ d }) {
  const [grande, setGrande] = useState(null)
  const notifier = useNotif()
  async function ouvrir() {
    setGrande({ src: d.photo })
    if (!d.photo_fichier) return
    try { const r = await api('dossiers.photo', { id: d.id }); setGrande({ src: `data:${r.type};base64,${r.base64}` }) } catch (e) { notifier(e.message, 'erreur') }
  }
  return <>
    <button onClick={ouvrir} title="Photo d'identité" className="shrink-0"><img src={d.photo} alt="" className="h-14 w-14 rounded-full border-2 border-white object-cover shadow" /></button>
    {grande && <Modale titre={d.nom} onFermer={() => setGrande(null)}><img src={grande.src} alt={`Photo de ${d.nom}`} className="mx-auto max-h-[70vh] rounded-lg" /></Modale>}
  </>
}

function FraterniteDossier({ d, onMaj }) {
  const notifier = useNotif()
  const [choix, setChoix] = useState(false)
  const [placer, setPlacer] = useState(false)
  const f = d.fraternite
  async function placerDans(equipeId) {
    const avant = f
    try {
      const r = await api('cor.placer', { dossiers: [d.id], equipe_id: equipeId }); onMaj(r.fraternite); setPlacer(false)
      notifier(equipeId ? `Placé(e) dans la fraternité ${r.fraternite?.equipe || ''}` : 'Retiré(e) de sa fraternité', 'ok',
        avant?.equipe && !avant.ancien ? { action: { label: 'Annuler', fn: () => remettre(avant) } } : undefined)
    } catch (e) { notifier(e.message, 'erreur') }
  }
  async function remettre(avant) {
    try {
      const E = await api('cor.equipesCourantes', {}); const eq = E.equipes.find((x) => x.nom === avant.equipe)
      const r = await api('cor.placer', { dossiers: [d.id], equipe_id: eq?.id || '' }); onMaj(r.fraternite); notifier('Fraternité rétablie')
    } catch (e) { notifier(e.message, 'erreur') }
  }
  async function relier(ficheId, message = 'Fiche Cor Unum reliée') {
    try { const r = await api('cor.relier', { fiche_id: ficheId, dossier_id: d.id }); onMaj(r.fraternite); notifier(message) } catch (e) { notifier(e.message, 'erreur') }
  }
  async function delier() {
    const ancien = f
    try {
      const r = await api('cor.relier', { fiche_id: f.id, dossier_id: d.id, delier: true }); onMaj(r.fraternite)
      notifier('Lien avec la fraternité défait', 'ok', { action: { label: 'Annuler', fn: () => relier(ancien.id, 'Lien rétabli') } })
    } catch (e) { notifier(e.message, 'erreur') }
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm">
      <HeartHandshake className="h-4 w-4 shrink-0 text-rose-700" />
      {f ? <>
        <span className="min-w-0 flex-1">Fraternité Cor Unum {f.annee} : <Link to={`/cor-unum?annee=${f.annee}&vue=tous&fiche=${f.id}`} className="font-semibold text-rose-800 hover:underline">{f.equipe || 'à répartir'}</Link>
          {f.chefs?.length > 0 && <span className="text-nuit-600/70"> · chef : {f.chefs.join(', ')}</span>}
          {f.ancien && <span className="pastille ml-1.5 bg-nuit-100 py-0 text-[10px] text-nuit-600">ancien membre</span>}
          {f.mode === 'auto' && <span className="ml-1.5 text-[11px] text-nuit-600/60">(reconnu par le nom)</span>}</span>
        <span className="flex flex-wrap gap-1.5"><button className="btn-or px-2.5 py-1 text-xs" onClick={() => setPlacer(true)}><HeartHandshake className="h-3.5 w-3.5" />{f.equipe && !f.ancien ? 'Changer de fraternité' : 'Placer dans une fraternité'}</button>
          <button className="btn-clair px-2.5 py-1 text-xs" title="Relier le dossier à une autre fiche Cor Unum" onClick={() => setChoix(true)}>Autre fiche</button><button className="btn-clair px-2.5 py-1 text-xs" onClick={delier}>Délier</button></span>
      </> : <>
        <span className="flex-1 text-nuit-600">Pas encore dans une fraternité Cor Unum.</span>
        <span className="flex flex-wrap gap-1.5"><button className="btn-or px-2.5 py-1 text-xs" onClick={() => setPlacer(true)}><HeartHandshake className="h-3.5 w-3.5" />Placer dans une fraternité</button>
          <button className="btn-clair px-2.5 py-1 text-xs" title="Si la personne a déjà une fiche Cor Unum sous un autre nom" onClick={() => setChoix(true)}><Link2 className="h-3.5 w-3.5" />Relier à une fiche existante</button></span>
      </>}
      {placer && <ChoixFraternite titre={`Fraternité de ${d.nom}`} sousTitre={f ? 'Sa fiche Cor Unum sera déplacée.' : 'Une fiche Cor Unum sera créée avec ses coordonnées et reliée au dossier.'}
        actuelle={f && !f.ancien ? f.equipe : ''} retirer={!!(f && f.equipe && !f.ancien)} onFermer={() => setPlacer(false)} onChoisir={placerDans} />}
      {choix && <ChoixFicheCor d={d} actuelle={f?.id} onFermer={() => setChoix(false)} onChoisir={(id) => { setChoix(false); relier(id) }} />}
    </div>
  )
}

function ChoixFicheCor({ d, actuelle, onFermer, onChoisir }) {
  const [data, setData] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [texte, setTexte] = useState(d.infos?.nom || '')
  useEffect(() => { api('cor.liste', {}).then(setData).catch(setErreur) }, [])
  const sa = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const equipes = Object.fromEntries((data?.equipes || []).map((e) => [e.id, e.nom]))
  const liste = (data?.membres || []).filter((m) => !texte || sa(`${m.prenoms} ${m.nom} ${m.email}`).includes(sa(texte)))
  return (
    <Modale titre="Relier à une fiche Cor Unum" onFermer={onFermer} pied={<button className="btn-clair" onClick={onFermer}>Fermer</button>}>
      <Erreur erreur={erreur} />
      {!data ? <Chargement /> : <>
        <p className="mb-2 text-sm text-nuit-600">Fraternités {data.annee} : choisissez la fiche de {d.nom}.</p>
        <input className="champ mb-3" placeholder="Nom, prénom ou e-mail…" value={texte} onChange={(e) => setTexte(e.target.value)} autoFocus />
        {!liste.length ? <p className="text-sm text-nuit-600/70">Aucune fiche. Effacez la recherche ou essayez le prénom.</p> : (
          <ul className="max-h-[50vh] divide-y divide-nuit-100 overflow-y-auto">
            {liste.slice(0, 80).map((m) => (
              <li key={m.id}><button className="flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-nuit-50/60 disabled:opacity-50" disabled={m.id === actuelle} onClick={() => onChoisir(m.id)}>
                <span className="flex-1"><span className="font-medium">{m.prenoms} {m.nom}</span><span className="block text-xs text-nuit-600/70">{m.email}</span></span>
                <span className="text-xs text-nuit-600">{equipes[m.equipe_id] || 'à répartir'}{m.statut === 'ancien' ? ' · ancien' : ''}</span>
              </button></li>
            ))}
          </ul>
        )}
      </>}
    </Modale>
  )
}

/** Espace personnel (app « La Croix glorieuse ») du catéchumène / néophyte : lien, envoi, lettre à l'évêque. */
/** Parrain et marraine : chacun a son lien (dépôt du certificat, dates importantes). */
function ParrainsEspace({ d, liste, occupe, action }) {
  const notifier = useNotif()
  const [ajout, setAjout] = useState(null)
  const ROLE = { parrain: 'Parrain', marraine: 'Marraine' }
  const copier = (l) => navigator.clipboard?.writeText(l).then(() => notifier('Lien copié'), () => notifier('Copie impossible', 'erreur'))
  return (
    <div className="mt-2 border-t border-nuit-100 pt-2">
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">Parrain et marraine</span>
        <span className="text-xs text-nuit-600/70">chacun reçoit un lien pour déposer son certificat et voir les dates « parrains »</span>
        {liste.length < 2 && !ajout && <button className="ml-auto text-xs text-or-600 underline" onClick={() => setAjout({ role: liste.some((z) => z.role === 'parrain') ? 'marraine' : 'parrain', nom: '', email: '' })}>Ajouter</button>}</div>
      {liste.map((z) => (
        <div key={z.id} className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="min-w-0 flex-1"><b>{ROLE[z.role]}</b> : {z.nom}{z.email && <span className="text-nuit-600/70"> · {z.email}</span>}
            <span className={`pastille ml-2 py-0 text-[11px] ${z.cert_le ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{z.cert_le ? `certificat reçu le ${dateCourte(z.cert_le)}` : z.envoye_le ? `lien envoyé le ${dateCourte(z.envoye_le)}` : 'lien pas envoyé'}</span></span>
          <span className="flex gap-1.5">
            {z.email && !z.cert_le && <button className="btn-clair px-2.5 py-1 text-xs" disabled={occupe} onClick={() => action('parrain.envoyer', { parrain_id: z.id }, 'Lien envoyé')}><Mail className="h-3.5 w-3.5" />{z.envoye_le ? 'Renvoyer' : 'Envoyer le lien'}</button>}
            <button className="btn-clair px-2.5 py-1 text-xs" onClick={() => copier(z.lien)}><Copy className="h-3.5 w-3.5" /></button>
            <button className="btn-clair px-2.5 py-1 text-xs text-red-700" disabled={occupe} onClick={() => action('parrain.ecrire', { parrain: { supprimer: z.id } }, 'Retiré(e)')}><Trash2 className="h-3.5 w-3.5" /></button>
          </span>
        </div>
      ))}
      {!liste.length && !ajout && <p className="mt-1 text-xs text-nuit-600/70">Pas encore indiqué{d.infos?.parrain_marraine ? ` (fiche : ${d.infos.parrain_marraine})` : ''}.</p>}
      {ajout && <div className="mt-2 flex flex-wrap gap-2">
        <select className="champ w-auto py-1.5" value={ajout.role} onChange={(ev) => setAjout({ ...ajout, role: ev.target.value })}><option value="parrain">Parrain</option><option value="marraine">Marraine</option></select>
        <input className="champ min-w-40 flex-1 py-1.5" placeholder="Prénom et nom" value={ajout.nom} onChange={(ev) => setAjout({ ...ajout, nom: ev.target.value })} />
        <input className="champ min-w-48 flex-1 py-1.5" type="email" placeholder="E-mail" value={ajout.email} onChange={(ev) => setAjout({ ...ajout, email: ev.target.value })} />
        <button className="btn-principal py-1.5 text-xs" disabled={occupe || !ajout.nom.trim()} onClick={() => action('parrain.ecrire', { parrain: ajout }, 'Enregistré').then(() => setAjout(null))}>Enregistrer</button>
        <button className="btn-clair py-1.5 text-xs" onClick={() => setAjout(null)}>Annuler</button>
      </div>}
    </div>
  )
}

/** Erreurs signalées par la personne depuis son espace : répondre et marquer comme corrigé. */
function Signalements({ liste, occupe, action }) {
  const [reponse, setReponse] = useState({})
  const [voirTraites, setVoirTraites] = useState(false)
  const ouverts = liste.filter((z) => z.statut === 'ouvert'), traites = liste.filter((z) => z.statut !== 'ouvert')
  return (
    <div className="mt-2 border-t border-nuit-100 pt-2">
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">Erreurs signalées</span>
        {ouverts.length > 0 ? <span className="pastille bg-amber-100 py-0 text-[11px] text-amber-900">{ouverts.length} à traiter</span> : <span className="text-xs text-nuit-600/70">tout est traité</span>}
        {traites.length > 0 && <button className="text-xs text-or-600 underline" onClick={() => setVoirTraites(!voirTraites)}>{voirTraites ? 'Masquer les traitées' : `Voir les traitées (${traites.length})`}</button>}
      </div>
      {[...ouverts, ...(voirTraites ? traites : [])].map((z) => (
        <div key={z.id} className={`mt-2 rounded-lg p-2.5 ${z.statut === 'ouvert' ? 'bg-amber-50/70' : 'bg-nuit-50/60'}`}>
          <div className="text-xs text-nuit-600/70"><b className="text-nuit-800">{z.sujet}</b> · {dateCourte(z.date)}{z.statut !== 'ouvert' && ` · corrigé le ${dateCourte(z.traite_le)}${z.traite_par ? ' par ' + z.traite_par : ''}`}</div>
          <p className="mt-1 whitespace-pre-wrap">{z.texte}</p>
          {z.statut === 'ouvert' ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <input className="champ min-w-48 flex-1 py-1.5" placeholder="Réponse (facultative, elle la verra dans son espace)" value={reponse[z.id] || ''} onChange={(ev) => setReponse({ ...reponse, [z.id]: ev.target.value })} />
              <button className="btn-or px-2.5 py-1 text-xs" disabled={occupe} onClick={() => action('espace.signalement', { signalement: z.id, reponse: reponse[z.id] || '' }, 'Marqué comme corrigé')}><Check className="h-3.5 w-3.5" />Marquer comme corrigé</button>
            </div>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">{z.reponse && <span className="text-nuit-600/80">Réponse : {z.reponse}</span>}
              <button className="text-or-600 underline" disabled={occupe} onClick={() => action('espace.signalement', { signalement: z.id, rouvrir: true }, 'Signalement rouvert')}>Rouvrir</button></div>
          )}
        </div>
      ))}
    </div>
  )
}

function EspaceDossier({ d }) {
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const [e, setE] = useState(null)
  const [mail, setMail] = useState(false)
  const [remarque, setRemarque] = useState(null)
  const [occupe, setOccupe] = useState(false)
  const [voirLettre, setVoirLettre] = useState(false)
  useEffect(() => { api('espace.etat', { id: d.id }).then(setE).catch(() => setE(false)) }, [d.id])
  if (!e) return null
  async function action(nom, params, msg) {
    setOccupe(true)
    try { setE(await api(nom, { id: d.id, ...params })); if (msg) notifier(msg) } catch (err) { notifier(err.message, 'erreur') } finally { setOccupe(false) }
  }
  async function nouveau() {
    if (!(await confirmer({ titre: 'Nouveau lien', texte: "L'ancien lien ne fonctionnera plus. Le mot de passe reste le même.", bouton: 'Créer un nouveau lien', danger: true }))) return
    action('espace.lien', { nouveau: true }, 'Nouveau lien créé')
  }
  const copier = () => navigator.clipboard?.writeText(e.lien).then(() => notifier('Lien copié'), () => notifier('Copie impossible', 'erreur'))
  const l = e.lettre
  const STATUTS = { brouillon: ['Brouillon en cours', 'bg-nuit-100 text-nuit-600'], envoyee: ['À relire', 'bg-amber-100 text-amber-900'], a_corriger: ['Correction demandée', 'bg-sky-100 text-sky-900'], validee: ['Validée', 'bg-emerald-100 text-emerald-900'] }
  const B = 'Ouvrir mon espace'
  return (
    <div className="mt-2 rounded-xl border border-nuit-100 bg-white px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Smartphone className="h-4 w-4 shrink-0 text-or" />
        <span className="min-w-0 flex-1"><b>Espace personnel</b> <span className="text-nuit-600/70">(app « La Croix glorieuse »)</span>
          {e.existe && <span className="block text-xs text-nuit-600/70">{e.mot_de_passe ? `Mot de passe choisi le ${dateCourte(e.mot_de_passe)}` : 'Mot de passe pas encore choisi'}{e.derniere_visite ? ` · dernière visite ${dateRelative(e.derniere_visite)}` : ''}{!e.mail ? ' · aucune adresse e-mail dans le dossier' : ''}</span>}</span>
        {!e.existe ? <button className="btn-clair px-2.5 py-1 text-xs" disabled={occupe} onClick={() => action('espace.lien', {}, 'Espace personnel créé')}>Créer son espace</button> : <span className="flex flex-wrap gap-1.5">
          <button className="btn-or px-2.5 py-1 text-xs" disabled={!e.mail} onClick={() => setMail(true)}><Mail className="h-3.5 w-3.5" />Envoyer le lien</button>
          <button className="btn-clair px-2.5 py-1 text-xs" onClick={copier}><Copy className="h-3.5 w-3.5" />Copier</button>
          <button className="btn-clair px-2.5 py-1 text-xs" disabled={occupe} onClick={nouveau}><RefreshCw className="h-3.5 w-3.5" />Nouveau lien</button></span>}
      </div>
      {l.texte && (
        <div className="mt-2 border-t border-nuit-100 pt-2">
          <div className="flex flex-wrap items-center gap-2"><span className="font-medium">Lettre à l'évêque</span><span className={`pastille py-0 text-[11px] ${STATUTS[l.statut]?.[1] || ''}`}>{STATUTS[l.statut]?.[0] || l.statut}</span>
            <button className="text-xs text-or-600 underline" onClick={() => setVoirLettre(!voirLettre)}>{voirLettre ? 'Masquer' : 'Lire'}</button>
            {l.statut !== 'validee' && <span className="ml-auto flex gap-1.5">
              <button className="btn-clair px-2.5 py-1 text-xs" disabled={occupe} onClick={() => setRemarque(remarque === null ? '' : null)}>Demander une correction</button>
              <button className="btn-or px-2.5 py-1 text-xs" disabled={occupe || l.statut === 'brouillon'} title={l.statut === 'brouillon' ? 'Pas encore envoyée par la personne' : ''} onClick={() => action('espace.lettre', { valider: true }, 'Lettre validée : PDF rangé dans le dossier')}>{occupe ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Valider</button></span>}
          </div>
          {voirLettre && <div className="mt-2 whitespace-pre-wrap rounded-lg bg-nuit-50/60 p-3 font-serif leading-relaxed">{l.texte}</div>}
          {remarque !== null && <div className="mt-2 flex gap-2"><input className="champ flex-1 py-1.5" placeholder="Ce qu'il faudrait revoir (s'affichera sur sa page)" value={remarque} onChange={(ev) => setRemarque(ev.target.value)} />
            <button className="btn-principal py-1.5 text-xs" disabled={occupe || !remarque.trim()} onClick={() => action('espace.lettre', { corriger: true, remarque }, 'Correction demandée').then(() => setRemarque(null))}>Envoyer</button></div>}
          {l.statut === 'a_corriger' && l.remarque && <p className="mt-1 text-xs text-nuit-600/70">Demandé : {l.remarque}</p>}
        </div>
      )}
      <ParrainsEspace d={d} liste={e.parrains || []} occupe={occupe} action={action} />
      {e.signalements?.length > 0 && <Signalements liste={e.signalements} occupe={occupe} action={action} />}
      {mail && <Redaction mode="nouveau" a={e.mail} sujet="Votre espace personnel – paroisse La Croix glorieuse"
        corps={`Bonjour ${d.infos?.prenoms || ''},\n\nVoici le lien de votre espace personnel « La Croix glorieuse ». Vous y trouverez votre parcours vers le baptême, le calendrier, les textes que nous vous enverrons, et vous pourrez compléter votre dossier (informations, pièces, lettre à l'évêque).\n[Bouton : ${B}]\n\nÀ la première visite, choisissez votre mot de passe : un code vous sera envoyé par mail. Vous pourrez ensuite installer l'application sur votre téléphone pour être prévenu(e) des nouveaux textes.\n\nAvec l'assurance de nos prières à toutes vos intentions,`}
        boutons={[{ texte: B, url: e.lien }]} dossier={d} onFermer={() => setMail(false)} onEnvoye={() => { setMail(false); notifier('Lien envoyé') }} />}
    </div>
  )
}
