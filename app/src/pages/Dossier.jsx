import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Upload, Loader2, Mail, Printer, FileText, Download, ExternalLink, Globe, Plus, Trash2, Save, History, Send, Church, AlertCircle } from 'lucide-react'
import { api, fichierEnBase64, telechargerBase64 } from '../api.js'
import { useApp } from '../App.jsx'
import { TYPES, ETATS, documentsManquants, PAR_ANNEE, anneeSacrements, choixAnnees } from '../types.js'
import { IMPRIMABLES } from '../imprimables.js'
import { Chargement, Erreur, Modale, useNotif, dateHeure, dateRelative, dateCourte, versLocal, jourLong, heure } from '../ui.jsx'
import { Redaction } from './Courrier.jsx'

const champsEditables = (d) => ({
  infos: d.infos, etapes: d.etapes, documents: d.documents, rencontres: d.rencontres,
  etat: d.etat, responsable: d.responsable, date_celebration: d.date_celebration
})

export default function Dossier() {
  const { id } = useParams()
  const notifier = useNotif()
  const app = useApp()
  const [d, setD] = useState(null)
  const [b, setB] = useState(null)           // brouillon
  const [erreur, setErreur] = useState(null)
  const [sauvegarde, setSauvegarde] = useState(false)
  const [mail, setMail] = useState(null)
  const [imprimer, setImprimer] = useState(null)
  const [envoiPiece, setEnvoiPiece] = useState(null)
  const fichierRef = useRef()
  const docCible = useRef(null)

  useEffect(() => { setD(null); api('dossiers.lire', { id }).then((x) => { setD(x); setB(champsEditables(x)) }).catch(setErreur) }, [id])
  const modifie = useMemo(() => d && b && JSON.stringify(champsEditables(d)) !== JSON.stringify(b), [d, b])

  useEffect(() => {
    const f = (e) => { if (modifie) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', f)
    return () => window.removeEventListener('beforeunload', f)
  }, [modifie])

  if (erreur) return <Erreur erreur={erreur} />
  if (!d || !b) return <Chargement />
  const t = TYPES[d.type]
  const dossierCourant = { ...d, ...b, nom: d.nom }

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
      const x = await api('dossiers.piece', { dossierId: d.id, nom: f.name, type: f.type, base64: await fichierEnBase64(f), doc: doc?.cle || '', libelle: doc?.label || f.name.replace(/\.[^.]+$/, '') })
      setD(x); setB(champsEditables(x)); notifier('Pièce ajoutée au dossier')
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoiPiece(null); fichierRef.current.value = ''; docCible.current = null }
  }
  const choisirFichier = (doc) => { docCible.current = doc; fichierRef.current.click() }

  async function ouvrirMail(opts) {
    try { await avantAction() } catch { return }
    setMail({ mode: 'nouveau', a: d.email, dossier: dossierCourant, ...opts })
  }
  const manquants = documentsManquants(d.type, Object.keys(b.documents).filter((k) => b.documents[k]?.recu))
  const contexteMail = { documents_manquants: manquants.map((m) => '- ' + m.label).join('\n') }

  function mailNotificationParoisse() {
    const i = b.infos
    const quand = b.date_celebration ? `le ${dateCourte(b.date_celebration)}` : ''
    const corps = d.type === 'mariage'
      ? `Bonjour,\n\nNous vous informons du mariage de ${d.nom}, célébré ${quand} (${i.lieu_celebration || app.reglages.paroisse}), inscrit au registre des mariages ${i.registre_annee || ''} sous l'acte n° ${i.acte_numero || '…'}.\n\nMerci de bien vouloir en porter mention en marge de l'acte de baptême.\n\nBien fraternellement,`
      : `Bonjour,\n\nNous vous informons de la confirmation de ${d.nom}, célébrée ${quand} (${i.lieu_celebration || ''}), inscrite au registre des confirmations ${i.registre_annee || ''} sous l'acte n° ${i.acte_numero || '…'}.\n\nBaptême : ${i.bapteme_paroisse || '…'}, le ${i.bapteme_date ? dateCourte(i.bapteme_date) : '…'}.\n\nMerci de bien vouloir en porter mention en marge de l'acte de baptême.\n\nBien fraternellement,`
    ouvrirMail({ a: '', sujet: d.type === 'mariage' ? `Notification de mariage – ${d.nom}` : `Notification de confirmation – ${d.nom}`, corps })
  }

  return (
    <>
      <input ref={fichierRef} type="file" className="hidden" onChange={(e) => deposer([...e.target.files])} />
      <Link to="/dossiers" className="mb-3 inline-flex items-center gap-1 text-sm text-nuit-600 hover:text-or-600"><ArrowLeft className="h-4 w-4" />Dossiers</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="mb-1 flex flex-wrap gap-1.5"><span className="pastille text-white" style={{ background: t.couleur }}>{t.nom}</span>
            {PAR_ANNEE.includes(d.type) && <span className="pastille border border-or bg-or-50 text-or-600">{anneeSacrements({ ...d, ...b }) ? (d.type === 'confirmand' ? 'Confirmation ' : 'Sacrements ') + anneeSacrements({ ...d, ...b }) : 'Année non fixée'}</span>}</span>
          <h1 className="text-3xl font-semibold leading-tight">{d.nom || 'Sans nom'}</h1>
          <p className="text-xs text-nuit-600/70">Créé le {dateCourte(d.cree_le)} · {d.source}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="champ w-auto" value={b.responsable} onChange={(e) => setB({ ...b, responsable: e.target.value })}>
            <option value="">Sans responsable</option>{app.utilisateurs.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
          </select>
          <select className="champ w-auto" value={b.etat} onChange={(e) => setB({ ...b, etat: e.target.value })}>
            {Object.entries(ETATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {modifie && (
        <div className="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-or/30 bg-or-50/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <span className="flex items-center gap-2 text-sm text-or-600"><AlertCircle className="h-4 w-4" />Modifications non enregistrées</span>
          <div className="flex gap-2"><button className="btn-clair py-1.5" onClick={() => setB(champsEditables(d))}>Annuler</button>
            <button className="btn-principal py-1.5" onClick={enregistrer} disabled={sauvegarde}>{sauvegarde ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Enregistrer</button></div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Colonne de suivi */}
        <div className="space-y-5">
          <section className="carte p-4">
            <h2 className="mb-2 text-xl font-semibold">Étapes</h2>
            <ol className="space-y-1">
              {t.etapes.map((e, i) => {
                const fait = b.etapes[e.cle]?.fait
                return (
                  <li key={e.cle}><button onClick={() => basculerEtape(e)} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-nuit-50">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${fait ? 'border-transparent text-white' : 'border-nuit-100 text-nuit-600/60'}`} style={fait ? { background: t.couleur } : {}}>{fait ? <Check className="h-3 w-3" /> : i + 1}</span>
                    <span className="min-w-0"><span className={fait ? 'text-nuit-600/70' : 'font-medium'}>{e.label}</span>{e.optionnel && <span className="ml-1 text-[11px] italic text-nuit-600/50">facultatif</span>}
                      {fait && <span className="block text-[11px] text-nuit-600/50">{dateCourte(b.etapes[e.cle].date)} · {b.etapes[e.cle].par}</span>}</span>
                  </button></li>
                )
              })}
            </ol>
          </section>

          <section className="carte p-4">
            <h2 className="mb-2 text-xl font-semibold">{d.type === 'catechumene' ? 'Date du baptême' : d.type === 'confirmand' ? 'Date de confirmation' : 'Date de célébration'}</h2>
            {PAR_ANNEE.includes(d.type) && (
              <div className="mb-3">
                <label className="etiquette">{d.type === 'confirmand' ? 'Année de la confirmation' : 'Année des sacrements (Pâques)'}</label>
                <select className="champ" value={b.infos.annee_sacrements || ''} onChange={(e) => majInfo('annee_sacrements', e.target.value)}>
                  <option value="">{b.date_celebration ? `D'après la date : ${new Date(b.date_celebration).getFullYear()}` : 'Non fixée'}</option>
                  {choixAnnees().map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <label className="etiquette mt-3">Date exacte</label>
              </div>
            )}
            <input className="champ" type="datetime-local" value={b.date_celebration ? versLocal(b.date_celebration) : ''} onChange={(e) => changerDate(e.target.value)} />
            <p className="mt-2 flex gap-1.5 text-xs text-nuit-600/70"><Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-or" />Publiée dans l'agenda public comme « {({ bapteme: 'Baptême', mariage: 'Mariage', obseques: 'Obsèques', catechumene: "Baptême d'adulte", confirmand: 'Confirmation' })[d.type]} », sans nom{b.infos.lieu_celebration ? `, lieu : ${b.infos.lieu_celebration}` : ''}.</p>
            {b.date_celebration && <p className="mt-1 text-sm font-medium capitalize">{jourLong(b.date_celebration)} à {heure(b.date_celebration)}</p>}
          </section>

          {t.documents.length > 0 && (
            <section className="carte p-4">
              <h2 className="mb-2 text-xl font-semibold">Documents</h2>
              <ul className="space-y-1">
                {t.documents.map((doc) => {
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
        onFermer={() => setImprimer(null)} onArchive={(x) => { setD(x); setB(champsEditables(x)); notifier('Document archivé dans le dossier') }} />}
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
    try { onArchive(await api('dossiers.archiver', { dossierId: dossier.id, libelle: modele.titre, html })) } catch (e) { notifier(e.message, 'erreur') } finally { setArchivage(false) }
  }
  return (
    <Modale large titre={modele.titre} onFermer={onFermer}
      pied={<><button className="btn-clair mr-auto" onClick={onFermer}>Fermer</button>
        <button className="btn-clair" onClick={archiver} disabled={archivage}>{archivage ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}Archiver (PDF)</button>
        <button className="btn-principal" onClick={() => cadre.current.contentWindow.print()}><Printer className="h-4 w-4" />Imprimer</button></>}>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="space-y-2 md:max-h-[60vh] md:overflow-y-auto md:pr-2">
          <p className="text-xs text-nuit-600/70">Vérifiez et complétez ; les modifications ici ne changent que ce document.</p>
          {modele.champs.map(([cle, label, genre]) => (
            <div key={cle}><label className="etiquette">{label}</label>
              {genre === 'zone' ? <textarea className="champ min-h-[60px] py-1.5 text-xs" value={v[cle] || ''} onChange={(e) => setV({ ...v, [cle]: e.target.value })} />
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
  )
}
