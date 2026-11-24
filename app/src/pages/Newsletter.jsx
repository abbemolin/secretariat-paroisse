// Newsletter : reprise de newsletter.html (AppMesse) dans l'interface du secrétariat.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, RefreshCw, Smartphone, Monitor, Link2, Plus, RotateCcw, CalendarClock, Send, Trash2, Loader2, CheckCircle2, AlertTriangle, CalendarDays, MailCheck } from 'lucide-react'
import { api } from '../api.js'
import { Chargement, EnTete, Erreur, Modale, dateHeure, useConfirmer, useNotif } from '../ui.jsx'
import { bornesSemaine, calendrierHtml, construireSemaine, decalerSemaine, isoLocal, JOURS_FR, lundiDe, MOIS_FR } from '../annonces/semaine.js'
import { genEmailHTML, sujetNewsletter } from '../annonces/gabarit.js'
import { creerEditeur, migrerBrouillon } from '../annonces/editeur.js'

const dateFr = (iso) => { const d = new Date(iso + 'T12:00:00'); return JOURS_FR[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS_FR[d.getMonth()] }
function ajouter(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoLocal(d) }
const quandParis = (iso) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

export default function Newsletter() {
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const [params, setParams] = useSearchParams()
  const lundiCourant = lundiDe(new Date())
  const lundi = params.get('semaine') || decalerSemaine(lundiCourant, 1)   // par défaut : semaine suivante, comme l'AppMesse
  const choixAuto = useRef(!params.get('semaine'))

  const [data, setData] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [calHtml, setCalHtml] = useState(null)
  const [coches, setCoches] = useState({})
  const [modifie, setModifie] = useState(false)
  const [vue, setVue] = useState(600)
  const [format, setFormat] = useState({})
  const [panneau, setPanneau] = useState(null)   // { titre, url, peutRetirer }
  const [confirmation, setConfirmation] = useState(false)
  const [envoi, setEnvoi] = useState('')
  const [recharge, setRecharge] = useState(0)
  const frame = useRef(null)
  const editeur = useRef(null)
  const timer = useRef(null)
  const etatRef = useRef({})
  etatRef.current = { lundi, data, coches, modifie }

  const changerSemaine = (l) => { if (timer.current) sauverBrouillon(); choixAuto.current = false; setParams({ semaine: l }) }

  // Lecture : annonces « Newsletter », calendrier envoyé par la feuille de semaine, brouillon partagé, campagne
  useEffect(() => {
    let annule = false
    clearTimeout(timer.current); timer.current = null
    editeur.current = null
    setData(null); setCalHtml(null); setErreur(null); setModifie(false); setPanneau(null)
    api('newsletter.lire', { lundi }).then(async (d) => {
      if (annule) return
      // Pas de semaine choisie : celle préparée dans la feuille de semaine (comme l'AppMesse)
      if (choixAuto.current && !d.calendrier) {
        const prete = (d.semaines_envoyees || []).filter((l) => l >= lundiCourant).pop()
        choixAuto.current = false
        if (prete && prete !== lundi) { setParams({ semaine: prete }, { replace: true }); return }
      }
      choixAuto.current = false
      let html = d.calendrier?.html
      if (!html) {
        const s = await api('newsletter.semaine', { lundi, ...bornesSemaine(lundi) })
        html = calendrierHtml(construireSemaine(lundi, s.evenements, s.intentions))
      }
      if (annule) return
      setCoches(Object.fromEntries(d.annonces.map((a) => [String(a.id), true])))
      setData(d); setCalHtml(html)
    }).catch((e) => !annule && setErreur(e))
    return () => { annule = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lundi, recharge])

  const sauverBrouillon = useCallback(() => {
    clearTimeout(timer.current); timer.current = null
    const { lundi: l } = etatRef.current
    const html = editeur.current?.htmlFinal(false)
    if (html) api('newsletter.brouillon', { lundi: l, html }).catch((e) => notifier('Brouillon non enregistré : ' + e.message, 'erreur'))
  }, [notifier])

  // Éditeur de l'aperçu (un par cadre)
  const obtenirEditeur = () => {
    if (!editeur.current) {
      editeur.current = creerEditeur(frame.current, {
        onModifie: () => { setModifie(true); clearTimeout(timer.current); timer.current = setTimeout(sauverBrouillon, 600) },
        toast: (t) => notifier(t, 'erreur'),
        ouvrirPanneau: (p) => setPanneau(p),
        onFormat: () => setFormat(editeur.current?.etatFormat() || {}),
        decocher: (id) => {
          if (!(String(id) in etatRef.current.coches)) return false
          setCoches((c) => ({ ...c, [String(id)]: false }))
          return true
        }
      })
    }
    return editeur.current
  }

  const genererMail = (d, cal, c) => genEmailHTML(cal, d.annonces.filter((a) => c[String(a.id)] !== false))

  // Affichage de l'aperçu : brouillon partagé s'il y en a un, sinon généré
  useEffect(() => {
    if (!data || !calHtml || !frame.current) return
    const ed = obtenirEditeur()
    if (data.brouillon?.html) {
      ed.afficher(migrerBrouillon(data.brouillon.html))
      setModifie(true)
      const visibles = new Set(ed.annoncesVisibles())
      setCoches(Object.fromEntries(data.annonces.map((a) => [String(a.id), visibles.has(String(a.id))])))
    } else {
      ed.afficher(genererMail(data, calHtml, Object.fromEntries(data.annonces.map((a) => [String(a.id), true]))))
      setModifie(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, calHtml])

  useLayoutEffect(() => () => { if (timer.current) sauverBrouillon() }, [sauverBrouillon])

  function basculerAnnonce(id) {
    const k = String(id), coche = !(coches[k] !== false)
    const nouv = { ...coches, [k]: coche }
    if (!modifie) { setCoches(nouv); obtenirEditeur().afficher(genererMail(data, calHtml, nouv)); return }
    // Version modifiée : on masque / réaffiche l'annonce sans perdre les modifications
    if (!editeur.current.masquerAnnonce(k, !coche) && coche) {
      notifier('Cette annonce n\'est pas dans la version modifiée — « Annuler mes modifications » pour la récupérer', 'erreur', { duree: 6000 })
      return
    }
    setCoches(nouv)
    setModifie(true); clearTimeout(timer.current); timer.current = setTimeout(sauverBrouillon, 600)
    editeur.current.ajuster()
  }
  async function annulerModifications() {
    if (!(await confirmer({ titre: 'Annuler mes modifications', texte: 'Revenir aux annonces et au calendrier d\'origine ? Les modifications faites dans l\'aperçu seront perdues, pour tout le monde.', bouton: 'Annuler les modifications', danger: true }))) return
    clearTimeout(timer.current); timer.current = null
    try { await api('newsletter.brouillon', { lundi, html: null }) } catch (e) { notifier(e.message, 'erreur') }
    const tout = Object.fromEntries(data.annonces.map((a) => [String(a.id), true]))
    setCoches(tout); setModifie(false)
    setData({ ...data, brouillon: null })
    notifier('Modifications annulées')
  }

  const ed = () => obtenirEditeur()
  async function programmer() {
    setEnvoi('programmer')
    try {
      const c = await api('newsletter.programmer', { lundi, sujet: sujetNewsletter(lundi), html: ed().htmlFinal(true, genererMail(data, calHtml, coches)) })
      setConfirmation(false)
      setData({ ...data, campagne: c, autres_programmees: [...(data.autres_programmees || []), { id: c.id, sujet: c.sujet, envoi_le: c.envoi_le }] })
      notifier('Envoi programmé pour le ' + quandParis(c.envoi_le), 'ok', { duree: 6000 })
    } catch (e) { notifier(e.message, 'erreur', { duree: 7000 }) } finally { setEnvoi('') }
  }
  async function envoyerTest() {
    setEnvoi('test')
    try {
      const r = await api('newsletter.test', { sujet: sujetNewsletter(lundi), html: ed().htmlFinal(true, genererMail(data, calHtml, coches)) })
      notifier('Test envoyé à ' + r.adresses.join(', '), 'ok', { duree: 6000 })
    } catch (e) { notifier(e.message, 'erreur', { duree: 7000 }) } finally { setEnvoi('') }
  }
  async function annulerEnvoi(id) {
    if (!(await confirmer({ titre: 'Annuler l\'envoi', texte: 'Annuler l\'envoi programmé de cette newsletter ? Elle ne partira pas.', bouton: 'Oui, annuler', danger: true }))) return
    setEnvoi('annuler' + id)
    try {
      await api('newsletter.annuler', { id })
      setData({ ...data, campagne: String(data.campagne?.id) === String(id) ? null : data.campagne, autres_programmees: (data.autres_programmees || []).filter((c) => String(c.id) !== String(id)) })
      notifier('Envoi annulé')
    } catch (e) { notifier(e.message, 'erreur', { duree: 8000 }) } finally { setEnvoi('') }
  }

  const campagne = data?.campagne
  const programmee = campagne?.statut === 'queued'
  const autres = (data?.autres_programmees || []).filter((c) => String(c.id) !== String(campagne?.id))
  const nbCoches = data ? data.annonces.filter((a) => coches[String(a.id)] !== false).length : 0
  const fmt = (cle, contenu, titre, action) => (
    <button key={cle} type="button" title={titre} aria-label={titre} onMouseDown={(e) => e.preventDefault()} onClick={action}
      className={`min-w-9 rounded-md border px-2 py-1 text-sm ${format[cle] ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit hover:bg-nuit-50'}`}>{contenu}</button>
  )

  return (
    <div>
      <EnTete titre="Newsletter" sousTitre={sujetNewsletter(lundi)}
        actions={<button className="btn-clair" onClick={() => setRecharge((n) => n + 1)}><RefreshCw className="h-4 w-4" />Recharger</button>} />

      <div className="carte mb-4 flex items-center gap-2 p-3">
        <button className="btn-clair" onClick={() => changerSemaine(decalerSemaine(lundi, -1))} aria-label="Semaine précédente"><ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Précédente</span></button>
        <div className="flex-1 text-center text-sm font-medium">{dateFr(lundi)} – {dateFr(ajouter(lundi, 6))}</div>
        <button className="btn-clair" onClick={() => changerSemaine(decalerSemaine(lundi, 1))} aria-label="Semaine suivante"><span className="hidden sm:inline">Suivante</span><ChevronRight className="h-4 w-4" /></button>
      </div>

      <Erreur erreur={erreur} reessayer={() => setRecharge((n) => n + 1)} />
      {!data && !erreur && <Chargement texte="Chargement des annonces et du calendrier…" />}

      {data && (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-4">
            {/* Envoi */}
            <div className="carte space-y-3 p-4">
              <h2 className="text-lg font-semibold">Envoi</h2>
              {programmee ? (
                <div className="space-y-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                  <div className="flex items-start gap-2"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0" /><span>Envoi programmé le <strong>{quandParis(campagne.envoi_le)}</strong>{campagne.par ? ` (par ${campagne.par})` : ''}.<br /><span className="text-xs">{campagne.sujet}</span></span></div>
                  <button className="btn-danger w-full" disabled={!!envoi} onClick={() => annulerEnvoi(campagne.id)}>{envoi === 'annuler' + campagne.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Annuler l'envoi</button>
                </div>
              ) : campagne?.statut === 'sent' && campagne.lundi === lundi ? (
                <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Newsletter envoyée{campagne.envoyee_le ? ' le ' + dateHeure(campagne.envoyee_le) : ''}.</div>
              ) : null}
              {!data.brevo_ok ? (
                <p className="rounded-lg bg-or-50 p-3 text-sm text-or-600">La clé Brevo n'est pas encore enregistrée : Réglages → Newsletter.</p>
              ) : !programmee && (
                <button className="btn-principal w-full" disabled={!!envoi} onClick={() => setConfirmation(true)}><Send className="h-4 w-4" />Programmer l'envoi…</button>
              )}
              <button className="btn-clair w-full" disabled={!!envoi || !(data.adresses_test || []).length} onClick={envoyerTest}
                title={(data.adresses_test || []).length ? 'À ' + data.adresses_test.join(', ') : 'Adresses de test : Réglages → Newsletter'}>
                {envoi === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}Envoyer un test</button>
              {(data.adresses_test || []).length > 0 && <p className="-mt-1 text-center text-xs text-nuit-600/70">à {data.adresses_test.join(', ')}</p>}
              {autres.length > 0 && (
                <div className="space-y-2 rounded-lg border border-or/40 bg-or-50 p-3 text-xs text-nuit-700">
                  <div className="flex items-center gap-1.5 font-semibold text-or-600"><AlertTriangle className="h-4 w-4" />Autre campagne programmée dans Brevo</div>
                  {autres.map((c) => (
                    <div key={c.id} className="flex items-center gap-2"><span className="flex-1">{c.sujet || c.nom}{c.envoi_le ? ' — ' + quandParis(c.envoi_le) : ''}</span>
                      <button className="text-red-700 hover:underline" disabled={!!envoi} onClick={() => annulerEnvoi(c.id)}>Annuler</button></div>
                  ))}
                  <p>Peut-être programmée depuis l'AppMesse : les abonnés recevraient deux newsletters.</p>
                </div>
              )}
            </div>

            {/* Annonces */}
            <div className="carte p-4">
              <h2 className="mb-2 text-lg font-semibold">Annonces <span className="text-sm font-normal text-nuit-600/70">({nbCoches}/{data.annonces.length})</span></h2>
              {!data.annonces.length ? <p className="text-sm italic text-nuit-600/70">Aucune annonce marquée pour la newsletter.</p> : (
                <ul className="space-y-1">{data.annonces.map((a) => (
                  <li key={a.id}><label className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-sm hover:bg-nuit-50/60">
                    <input type="checkbox" className="mt-0.5 accent-[#521a22]" checked={coches[String(a.id)] !== false} onChange={() => basculerAnnonce(a.id)} />{a.titre}
                  </label></li>
                ))}</ul>
              )}
              <Link to="/annonces" className="mt-2 inline-block text-xs text-or-600 hover:underline">Gérer les annonces</Link>
            </div>

            {/* Calendrier */}
            <div className={`rounded-lg p-3 text-xs ${data.calendrier ? 'bg-emerald-50 text-emerald-900' : 'bg-sky-50 text-sky-900'}`}>
              {data.calendrier
                ? <>Calendrier repris de la feuille de semaine{data.calendrier.par ? ` (envoyé par ${data.calendrier.par}${data.calendrier.le ? ' le ' + dateHeure(data.calendrier.le) : ''})` : ''}.</>
                : <>Calendrier construit depuis l'agenda. Pour le retoucher avant, passez par la <Link className="underline" to={'/semaine?semaine=' + lundi}>feuille de semaine</Link>.</>}
            </div>
          </div>

          {/* Aperçu modifiable */}
          <div className="carte min-w-0 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {fmt('bold', <b>G</b>, 'Gras', () => ed().appliquerFormat('bold'))}
              {fmt('italic', <i>I</i>, 'Italique', () => ed().appliquerFormat('italic'))}
              {fmt('underline', <u>S</u>, 'Souligné', () => ed().appliquerFormat('underline'))}
              {fmt('caps', 'AA', 'Mettre le texte sélectionné en CAPITALES (recliquer pour repasser en minuscules)', () => ed().basculerCapitales())}
              {fmt('lien', <span className="inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" />Lien</span>, 'Ajouter, modifier ou retirer un lien sur le texte sélectionné', () => ed().ouvrirPanneauLien())}
              {fmt('effacer', 'Effacer', 'Retirer gras, italique et souligné du texte sélectionné', () => ed().appliquerFormat('removeFormat'))}
              <span className="mx-1 h-5 w-px bg-nuit-100" />
              {fmt('ajout', <span className="inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" />Annonce</span>, 'Ajouter une annonce à cette newsletter', () => ed().ajouterAnnonce())}
              {modifie && <button type="button" className="rounded-md px-2 py-1 text-sm text-red-700 hover:bg-red-50" onClick={annulerModifications}><RotateCcw className="mr-1 inline h-3.5 w-3.5" />Annuler mes modifications</button>}
              <span className="ml-auto flex gap-1">
                <button type="button" title="Vue téléphone" aria-label="Vue téléphone" className={`btn-icone ${vue === 375 ? 'bg-nuit text-white hover:bg-nuit' : ''}`} onClick={() => { setVue(375); setTimeout(() => editeur.current?.ajuster(), 350) }}><Smartphone className="h-4 w-4" /></button>
                <button type="button" title="Vue ordinateur" aria-label="Vue ordinateur" className={`btn-icone ${vue === 600 ? 'bg-nuit text-white hover:bg-nuit' : ''}`} onClick={() => { setVue(600); setTimeout(() => editeur.current?.ajuster(), 350) }}><Monitor className="h-4 w-4" /></button>
              </span>
            </div>
            {panneau && <PanneauLien panneau={panneau} onValider={(url) => { if (ed().validerLien(url)) setPanneau(null) }} onRetirer={() => { ed().retirerLien(); setPanneau(null) }} onAnnuler={() => { ed().fermerLien(); setPanneau(null) }} />}
            <p className={`mb-2 rounded-md px-2.5 py-1.5 text-xs ${modifie ? 'bg-or-50 text-or-600' : 'bg-nuit-50 text-nuit-600'}`}>
              {modifie ? <>Version modifiée — c'est elle qui sera envoyée (enregistrée pour tous{data.brouillon?.par ? `, dernière modification par ${data.brouillon.par}` : ''}).</> : 'Cliquez dans les annonces ou le calendrier pour les modifier avant l\'envoi.'}
            </p>
            <div className="overflow-x-auto rounded-lg bg-[#FBFBF9] p-2">
              <iframe ref={frame} title="Aperçu de la newsletter" className="apercu-clair mx-auto block border-0 bg-white transition-[width]" style={{ width: vue, maxWidth: '100%', minHeight: 600 }} />
            </div>
          </div>
        </div>
      )}

      {confirmation && data && (
        <Modale titre="Programmer l'envoi" onFermer={() => setConfirmation(false)}
          pied={<><button className="btn-clair" onClick={() => setConfirmation(false)}>Annuler</button>
            <button className="btn-principal" disabled={!!envoi} onClick={programmer}>{envoi === 'programmer' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}Programmer l'envoi</button></>}>
          <div className="space-y-3 text-sm">
            <p><span className="text-nuit-600/70">Objet :</span> {sujetNewsletter(lundi)}</p>
            <p><span className="text-nuit-600/70">Envoi prévu :</span> <strong>{quandParis(data.prochain_envoi)}</strong></p>
            <p className="text-nuit-600">C'est la version affichée dans l'aperçu, avec vos modifications, qui sera envoyée à la liste Brevo. Vous pourrez annuler l'envoi tant qu'il n'est pas parti.</p>
            {autres.length > 0 && <p className="rounded-lg bg-or-50 p-2.5 text-or-600"><AlertTriangle className="mr-1 inline h-4 w-4" />Une autre campagne est déjà programmée dans Brevo : les abonnés recevraient deux newsletters.</p>}
          </div>
        </Modale>
      )}
    </div>
  )
}

function PanneauLien({ panneau, onValider, onRetirer, onAnnuler }) {
  const [url, setUrl] = useState(panneau.url || '')
  return (
    <form className="mb-2 flex flex-wrap items-end gap-2 rounded-lg border border-nuit-100 bg-nuit-50/50 p-2.5" onSubmit={(e) => { e.preventDefault(); onValider(url) }}>
      <div className="min-w-[220px] flex-1"><label className="etiquette" htmlFor="nl-url">{panneau.titre}</label>
        <input id="nl-url" className="champ" autoFocus placeholder="https://… , adresse mail ou téléphone" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
      <button type="submit" className="btn-principal">OK</button>
      {panneau.peutRetirer && <button type="button" className="btn-danger" onClick={onRetirer}>Retirer le lien</button>}
      <button type="button" className="btn-clair" onClick={onAnnuler}>Annuler</button>
    </form>
  )
}
