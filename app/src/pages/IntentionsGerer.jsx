import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronRight, FileText, Loader2, Mail, Pencil, Search, Trash2 } from 'lucide-react'
import { api } from '../api.js'
import { useApp } from '../App.jsx'
import { Chargement, useConfirmer, useNotif } from '../ui.jsx'
import { FenetreMail, FicheIntention, ZoneCelebration } from '../intentions/composants.jsx'
import { MOIS, celebrants, chargerIntentions, dateCourte, dateLongue, doublons, estMesse, estPrivee, heureDe, heureFr, intentionsEnCache, messePassee, nomCelebrant, sansAdresse } from '../intentions/donnees.js'
import Releve from '../intentions/Releve.jsx'

/** Gérer les intentions : reprise d'intentions.html d'AppMesse. */
export default function IntentionsGerer() {
  const { utilisateurs } = useApp()
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const [params] = useSearchParams()
  const [liste, setListe] = useState(() => intentionsEnCache() || null)
  const [filtre, setFiltre] = useState('')
  const [pretre, setPretre] = useState(params.get('filtre') === 'non' ? 'non' : '')
  const [ouverts, setOuverts] = useState({})
  const [fiche, setFiche] = useState(null)
  const [mail, setMail] = useState(null)
  const [releve, setReleve] = useState(false)
  const [eclaire, setEclaire] = useState(params.get('id') || null)

  const recharger = () => chargerIntentions().then(setListe).catch((e) => notifier(e.message, 'erreur'))
  useEffect(() => { recharger() }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  const maj = (r) => setListe((l) => l.map((x) => (x.id === r.id ? { ...x, ...r } : x)).filter((x) => x.statut !== 'annule'))

  // Ouvert sur une intention (depuis Aujourd'hui ou une notification) : son mois déplié, la carte éclairée
  useEffect(() => {
    const id = params.get('id'); const i = id && liste?.find((x) => String(x.id) === id)
    if (i) { setOuverts((o) => ({ ...o, [i.date_messe.slice(0, 7)]: true })); setTimeout(() => document.querySelector(`[data-intention="${i.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200) }
  }, [!!liste])   // eslint-disable-line react-hooks/exhaustive-deps
  const pretres = useMemo(() => celebrants(utilisateurs).filter((c) => c.cle !== 'autre'), [utilisateurs])
  if (!liste) return <Chargement />

  const annee = new Date().getFullYear()
  const enAttente = liste.filter((i) => i.statut === 'en_attente' || i.en_edition)
  const aApprouver = liste.filter((i) => i.statut === 'valide' && !i.mail_envoye && !sansAdresse(i))
  const nonCelebrees = liste.filter((i) => i.statut === 'valide' && !i.celebrant && messePassee(i))
  const dbl = doublons(liste)
  let l = liste
  if (pretre === 'non') l = nonCelebrees
  else if (pretre) l = l.filter((i) => i.celebrant === pretre)
  const q = filtre.toLowerCase().trim()
  if (q) l = l.filter((i) => (i.nom_intention || '').toLowerCase().includes(q) || (i.nom_donateur || '').toLowerCase().includes(q))
  const actives = l.filter((i) => i.statut !== 'refuse')
  const refusees = l.filter((i) => i.statut === 'refuse')
  // 13 mois : le mois en cours et les 12 suivants (mois passés : seulement en recherche ou en filtre)
  const now = new Date()
  const cles = Array.from({ length: 13 }, (_, k) => { const d = new Date(now.getFullYear(), now.getMonth() + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
  const groupes = {}
  actives.forEach((i) => { (groupes[i.date_messe.slice(0, 7)] ||= []).push(i) })
  const moisVus = (q || pretre) ? [...new Set([...Object.keys(groupes)])].sort() : cles
  const tri = (a, b) => (a.date_messe + a.heure_messe).localeCompare(b.date_messe + b.heure_messe) || ((a.statut === 'en_attente' || a.en_edition) ? -1 : 1)
  const parCelebrant = {}
  liste.filter((i) => i.statut === 'valide' && i.celebrant).forEach((i) => { parCelebrant[i.celebrant] = (parCelebrant[i.celebrant] || 0) + 1 })

  const aller = (i) => { setPretre(''); setFiltre(''); setOuverts((o) => ({ ...o, [i.date_messe.slice(0, 7)]: true })); setEclaire(String(i.id)); setTimeout(() => document.querySelector(`[data-intention="${i.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120) }
  async function annuler(i) {
    if (!(await confirmer({ titre: 'Annuler l\'intention ?', texte: 'L\'intention sera masquée (statut « annulé ») ; rien n\'est effacé.', bouton: 'Annuler l\'intention', danger: true }))) return
    try { maj(await api('intentions.annuler', { id: i.id })); notifier('🗑️ Intention annulée') } catch (e) { notifier(e.message, 'erreur') }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold text-nuit">Gérer les intentions</h1>
          <p className="text-sm text-nuit-600"><b>{liste.filter((i) => i.statut === 'valide' && i.date_messe.startsWith(annee)).length}</b> messes en {annee}
            {Object.entries(parCelebrant).map(([c, n]) => <span key={c}> · {n} célébrée{n > 1 ? 's' : ''} ({nomCelebrant(c, utilisateurs)})</span>)}</p>
        </div>
        <button className="btn-clair" onClick={() => setReleve(true)}><FileText className="h-4 w-4" />Relevé</button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {[['', 'Toutes'], ...pretres.map((p) => [p.cle, p.nom]), ['non', 'Non célébrées']].map(([k, n]) => (
          <button key={k} onClick={() => setPretre(k)} className={`rounded-full px-3 py-1 text-sm ${pretre === k ? 'bg-nuit text-white' : 'bg-white text-nuit-700 ring-1 ring-nuit-100 hover:bg-nuit-50'}`}>{n}{k === 'non' && nonCelebrees.length ? ` (${nonCelebrees.length})` : ''}</button>
        ))}
      </div>
      <div className="relative mb-4"><Search className="absolute left-3 top-2.5 h-4 w-4 text-nuit-600/60" /><input className="champ pl-9" placeholder="Rechercher par nom, donateur…" value={filtre} onChange={(e) => setFiltre(e.target.value)} /></div>

      {dbl.length > 0 && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          <AlertTriangle className="mr-1 inline h-4 w-4" />Deux intentions validées sur la même messe :
          {dbl.map((g, k) => <div key={k} className="ml-5">{dateLongue(g[0].date_messe)} à {heureFr(g[0].heure_messe)} : {g.map((i) => <button key={i.id} className="mr-2 underline" onClick={() => aller(i)}>{i.nom_intention}</button>)}</div>)}
        </div>
      )}

      {!q && !pretre && (enAttente.length > 0 || aApprouver.length > 0) && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {enAttente.length > 0 && <Alerte couleur="red" titre={`⏳ ${enAttente.length} en attente de validation`} sous="Ces demandes n'ont pas encore été traitées" items={enAttente} onClic={aller} />}
          {aApprouver.length > 0 && <Alerte couleur="or" titre={`📧 ${aApprouver.length} confirmation${aApprouver.length > 1 ? 's' : ''} à envoyer`} sous="Vérifiez le texte, puis envoyez" items={aApprouver} onClic={(i) => { aller(i); setMail({ i }) }} />}
        </div>
      )}

      <div className="space-y-2">
        {moisVus.map((m) => {
          const items = (groupes[m] || []).slice().sort(tri)
          const nbAtt = items.filter((i) => i.statut === 'en_attente' || i.en_edition).length
          const ouvert = ouverts[m] ?? ((q || pretre) ? true : nbAtt > 0)
          const [a, mo] = m.split('-')
          return (
            <section key={m} className="carte overflow-hidden">
              <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-nuit-50/50" onClick={() => setOuverts((o) => ({ ...o, [m]: !ouvert }))}>
                {ouvert ? <ChevronDown className="h-4 w-4 text-nuit-600" /> : <ChevronRight className="h-4 w-4 text-nuit-600" />}
                <span className="flex-1 font-titre text-lg font-semibold capitalize text-nuit">{MOIS[+mo - 1]} {a}</span>
                <span className={`pastille ${!items.length ? 'bg-nuit-50 text-nuit-600/60' : nbAtt ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{items.length}</span>
                {nbAtt > 0 && <span className="pastille bg-red-50 text-red-700">{nbAtt} en attente</span>}
              </button>
              {ouvert && (items.length ? <div className="divide-y divide-nuit-50 border-t border-nuit-50">{items.map((i) => <Carte key={i.id} i={i} eclaire={eclaire === String(i.id)} liste={liste} onMaj={maj} onModifier={() => setFiche(i)} onMail={() => setMail({ i })} onRefuser={() => setMail({ i, refus: true })} onAnnuler={() => annuler(i)} />)}</div>
                : <p className="border-t border-nuit-50 px-4 py-3 text-sm text-nuit-600/70">Aucune intention.</p>)}
            </section>
          )
        })}
        {refusees.length > 0 && (
          <section className="carte overflow-hidden">
            <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left" onClick={() => setOuverts((o) => ({ ...o, refusees: !o.refusees }))}>
              {ouverts.refusees ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<span className="flex-1 font-titre text-lg font-semibold text-nuit">✖ Demandes refusées</span><span className="pastille bg-nuit-50 text-nuit-600">{refusees.length}</span>
            </button>
            {ouverts.refusees && <div className="divide-y divide-nuit-50 border-t border-nuit-50">{refusees.map((i) => <Carte key={i.id} i={i} liste={liste} onMaj={maj} onAnnuler={() => annuler(i)} />)}</div>}
          </section>
        )}
      </div>

      {fiche && <FicheIntention titre={'Modifier — ' + dateLongue(fiche.date_messe)} initiale={{ ...fiche }} onFermer={() => setFiche(null)} onEnregistree={(r) => { setFiche(null); maj(r); recharger() }} />}
      {mail && <FenetreMail intention={mail.i} refus={mail.refus} onFermer={() => setMail(null)} onFait={(r) => { setMail(null); maj(r) }} />}
      {releve && <Releve intentions={liste} onFermer={() => setReleve(false)} />}
    </div>
  )
}

function Alerte({ couleur, titre, sous, items, onClic }) {
  const c = couleur === 'red' ? 'border-red-200 bg-red-50/70' : 'border-or-100 bg-or-50'
  return (
    <div className={`rounded-xl border p-3 ${c}`}>
      <div className="font-semibold text-nuit">{titre}</div><div className="mb-1 text-xs text-nuit-600">{sous}</div>
      {items.slice(0, 8).map((i) => <button key={i.id} className="flex w-full justify-between gap-2 py-0.5 text-left text-sm hover:underline" onClick={() => onClic(i)}><span className="truncate">{i.nom_intention}</span><span className="shrink-0 text-nuit-600">{dateCourte(i.date_messe)} →</span></button>)}
      {items.length > 8 && <div className="text-xs text-nuit-600">… et {items.length - 8} autres</div>}
    </div>
  )
}

/** Une intention : en attente (choix du créneau), validée, ou refusée. */
function Carte({ i, eclaire, liste, onMaj, onModifier, onMail, onRefuser, onAnnuler }) {
  const { utilisateurs } = useApp()
  const enCours = i.statut === 'en_attente' || i.en_edition
  const statut = enCours ? ['En attente', 'bg-red-50 text-red-700'] : i.statut === 'valide' ? ['Confirmée', 'bg-emerald-50 text-emerald-700'] : ['Refusée', 'bg-nuit-50 text-nuit-600']
  return (
    <div data-intention={i.id} className={`px-4 py-3 ${eclaire ? 'bg-or-50/70' : ''}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium text-nuit-700">{dateCourte(i.date_messe)}{i.heure_messe ? ' · ' + heureFr(i.heure_messe) : ''}</span>
        {estPrivee(i) && <span className="pastille bg-or-50 text-or-600">Privée</span>}
        <span className={`pastille ${statut[1]}`}>{statut[0]}</span>
        <span className="ml-auto text-xs text-nuit-600">{i.type_intention}</span>
      </div>
      <div className="mt-0.5 font-titre text-lg font-semibold text-nuit">{i.nom_intention}</div>
      <div className="text-sm text-nuit-600">{i.nom_donateur}{' · '}{sansAdresse(i) ? <span className="italic text-nuit-600/60">sans adresse</span> : i.email_donateur}</div>
      {i.commentaire && <div className="mt-1 rounded-lg bg-nuit-50/60 px-2 py-1 text-sm text-nuit-700">🗒 {i.commentaire}</div>}
      {!enCours && i.statut === 'valide' && !sansAdresse(i) && <div className="mt-1 text-xs">{i.mail_envoye ? <span className="text-emerald-700">✅ Mail envoyé</span> : <span className="text-or-600">⚠ Confirmation à envoyer</span>}</div>}
      {enCours && <Validation i={i} liste={liste} onMaj={onMaj} onRefuser={onRefuser} onAnnuler={onAnnuler} />}
      {i.statut === 'valide' && !enCours && (
        <>
          <ZoneCelebration intention={i} onMaj={onMaj} />
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-clair py-1 text-sm" onClick={onModifier}><Pencil className="h-3.5 w-3.5" />Modifier</button>
            {!i.mail_envoye && !sansAdresse(i) && <button className="btn-clair py-1 text-sm" onClick={onMail}><Mail className="h-3.5 w-3.5" />Mail</button>}
            <button className="btn-danger py-1 text-sm" onClick={onAnnuler}><Trash2 className="h-3.5 w-3.5" />Supprimer</button>
          </div>
        </>
      )}
      {i.statut === 'refuse' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {i.date_alternative && <span className="text-sm text-nuit-600">Proposé : {dateLongue(i.date_alternative)}{i.heure_alternative ? ' à ' + heureFr(i.heure_alternative) : ''}</span>}
          <button className="btn-danger ml-auto py-1 text-sm" onClick={onAnnuler}><Trash2 className="h-3.5 w-3.5" />Supprimer</button>
        </div>
      )}
      {i.celebrant && i.statut !== 'valide' && <div className="text-xs text-nuit-600">Célébrée — {nomCelebrant(i.celebrant, utilisateurs)}</div>}
    </div>
  )
}

/** Demande en attente : créneaux de l'agenda ce jour-là (🔒 pris), ou messe privée à l'heure choisie. */
function Validation({ i, liste, onMaj, onRefuser, onAnnuler }) {
  const notifier = useNotif()
  const [date, setDate] = useState(i.date_messe)
  const [messes, setMesses] = useState(null)
  const [heure, setHeure] = useState(null)
  const [privee, setPrivee] = useState(false)
  const [hPrivee, setHPrivee] = useState(/^\d{2}:\d{2}$/.test(i.heure_messe || '') ? i.heure_messe : '09:00')
  const [envoi, setEnvoi] = useState(false)
  useEffect(() => {
    let annule = false
    setMesses(null)
    const d = new Date(date + 'T00:00:00'), f = new Date(date + 'T23:59:59')
    api('intentions.agenda', { debut: d.toISOString(), fin: f.toISOString() }).then((ev) => {
      if (annule) return
      const m = ev.filter(estMesse).map(heureDe)
      setMesses(m); setPrivee(!m.length)
      const pris = (h) => liste.some((x) => x.date_messe === date && x.heure_messe === h && x.statut === 'valide' && x.id !== i.id)
      setHeure(m.find((h) => h === i.heure_messe && !pris(h)) || m.find((h) => !pris(h)) || null)
    }).catch(() => !annule && (setMesses([]), setPrivee(true)))
    return () => { annule = true }
  }, [date])   // eslint-disable-line react-hooks/exhaustive-deps
  const pris = (h) => liste.some((x) => x.date_messe === date && x.heure_messe === h && x.statut === 'valide' && x.id !== i.id)
  async function valider() {
    const h = privee ? hPrivee : heure
    if (!h) { notifier('Sélectionnez un créneau.', 'erreur'); return }
    setEnvoi(true)
    try { onMaj(await api('intentions.valider', { id: i.id, date, heure: h })); notifier('✅ Intention validée') } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  return (
    <div className="mt-2 rounded-xl border border-nuit-100 bg-white/60 p-3">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-or-600">📅 Disponibilités — choisir un créneau</div>
      <input type="date" className="champ mb-2 w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="flex flex-wrap items-center gap-1.5">
        {messes === null ? <Loader2 className="h-4 w-4 animate-spin text-nuit-600" /> : privee ? (
          <>
            <span className="text-sm text-nuit-600">Messe privée{!messes.length ? ' — aucun créneau' : ''}</span>
            <input type="time" className="champ w-auto py-1" value={hPrivee} onChange={(e) => setHPrivee(e.target.value)} />
            {messes.length > 0 && <button className="rounded-full px-3 py-1 text-sm ring-1 ring-nuit-100" onClick={() => setPrivee(false)}>↩ Créneaux</button>}
          </>
        ) : (
          <>
            {messes.map((h) => pris(h)
              ? <span key={h} className="rounded-full bg-nuit-50 px-3 py-1 text-sm text-nuit-600/60" title="Déjà réservé">🔒 {heureFr(h)}</span>
              : <button key={h} onClick={() => setHeure(h)} className={`rounded-full px-3 py-1 text-sm ${heure === h ? 'bg-nuit text-white' : 'ring-1 ring-nuit-100 hover:bg-nuit-50'}`}>{heureFr(h)}</button>)}
            <button className="rounded-full px-3 py-1 text-sm italic text-or-600 ring-1 ring-or-100" onClick={() => setPrivee(true)}>+ Privée</button>
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-principal py-1.5" disabled={envoi} onClick={valider}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}✅ Valider</button>
        <button className="btn-clair py-1.5" onClick={onRefuser}>✖ Refuser</button>
        <button className="btn-danger py-1.5" onClick={onAnnuler} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

