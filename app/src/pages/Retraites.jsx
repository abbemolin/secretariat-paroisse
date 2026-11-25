import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Copy, Loader2, MapPin, Mountain, Pencil, Plus, Printer, Send, Trash2, Users, Wallet, Car, HeartPulse, Check } from 'lucide-react'
import { api } from '../api.js'
import { TYPES } from '../types.js'
import { Chargement, Erreur, Modale, Vide, useCharger, useNotif, useDifferer, enSuppression, Aide, Interrupteur, imprimerHtml, dateCourte } from '../ui.jsx'
import { Redaction } from './Courrier.jsx'
import { useSelection, BoutonSelection, BarreSelection, MenuAction, Case, useActionGroupee, texteRapport } from '../selection.jsx'
import { BellRing } from 'lucide-react'

export const TYPES_RETRAITE = {
  premiere_communion: { nom: 'Première communion', public: 'enfants', couleur: TYPES.premiere_communion.couleur, texte: 'de première communion' },
  profession_foi: { nom: 'Profession de foi', public: 'enfants', couleur: TYPES.profession_foi.couleur, texte: 'de profession de foi' },
  confirmation_jeunes: { nom: 'Confirmation (jeunes)', public: 'enfants', couleur: TYPES.confirmation_jeune.couleur, texte: 'de confirmation des jeunes' },
  confirmation_adultes: { nom: 'Confirmation (adultes et catéchumènes)', public: 'adultes', couleur: TYPES.confirmand.couleur, texte: 'de confirmation' }
}
const euros = (n) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'
const e = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
const jj = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : '')
export function quand(r) {
  const j = r.date_fin && r.date_fin !== r.date_debut ? `du ${jj(r.date_debut)} au ${jj(r.date_fin)}` : jj(r.date_debut)
  return j + (r.heure_debut ? ` · ${r.heure_debut}${r.heure_fin ? ' → ' + r.heure_fin : ''}` : '')
}
const MODES = ['Espèces', 'Chèque', 'Virement', 'Carte']

export default function Retraites() {
  const { id } = useParams()
  return id ? <Fiche id={id} /> : <Liste />
}

function PastilleType({ type }) {
  const t = TYPES_RETRAITE[type] || {}
  return <span className="pastille w-fit text-white" style={{ background: t.couleur }}>{t.nom}</span>
}

function Liste() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const annee = params.get('annee') || ''
  const [edition, setEdition] = useState(null)
  const { data, chargement, erreur } = useCharger(() => api('retraites.liste', { annee }), [annee], ['retraites.liste', { annee }])
  const liste = (data?.retraites || []).filter((r) => !enSuppression.has(r.id))
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-semibold leading-tight">Retraites</h1><p className="mt-0.5 text-sm text-nuit-600/80">Première communion, profession de foi, confirmation</p></div>
        <button className="btn-principal" onClick={() => setEdition({ annee: data?.annee })}><Plus className="h-4 w-4" />Nouvelle retraite</button>
      </div>
      {data && <div className="mb-4 flex flex-wrap gap-1.5">{data.annees.map((a) => (
        <button key={a} className={`pastille border ${a === data.annee ? 'border-or bg-or text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} onClick={() => setParams({ annee: a })}>{a}</button>))}</div>}
      <Erreur erreur={erreur} />
      {!data && chargement ? <Chargement /> : !liste.length ? <Vide icone={Mountain} texte={`Aucune retraite pour ${data?.annee || 'cette année'}. Utilisez « Nouvelle retraite ».`} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {liste.map((r) => (
            <button key={r.id} onClick={() => nav(`/retraites/${r.id}`)} className="carte flex flex-col gap-2 p-4 text-left hover:shadow-md">
              <div className="flex flex-wrap items-center gap-1.5"><PastilleType type={r.type} />
                {!r.ouverte_maintenant && <span className="pastille bg-nuit-100 text-nuit-600">Inscriptions closes</span>}</div>
              <span className="font-titre text-xl font-semibold">{r.titre}</span>
              <span className="flex items-center gap-1.5 text-sm text-nuit-600"><CalendarDays className="h-4 w-4 text-or" />{quand(r)}</span>
              {r.lieu && <span className="flex items-center gap-1.5 text-sm text-nuit-600"><MapPin className="h-4 w-4 text-or" />{r.lieu}</span>}
              <span className="mt-1 flex flex-wrap gap-3 text-sm"><span className="flex items-center gap-1"><Users className="h-4 w-4 text-or" />{r.nb_participants} inscrit{r.nb_participants > 1 ? 's' : ''}</span>
                {r.du > 0 && <span className="flex items-center gap-1"><Wallet className="h-4 w-4 text-or" />{euros(r.paye)} / {euros(r.du)}</span>}</span>
            </button>
          ))}
        </div>
      )}
      {edition && <EditionRetraite r={edition} onFermer={() => setEdition(null)} onFait={(x) => { setEdition(null); nav(`/retraites/${x.id}`) }} />}
    </>
  )
}

function Fiche({ id }) {
  const nav = useNavigate()
  const notifier = useNotif()
  const differer = useDifferer()
  const { data: r, erreur, setData } = useCharger(() => api('retraites.lire', { id }), [id], ['retraites.lire', { id }])
  const [edition, setEdition] = useState(false)
  const [invit, setInvit] = useState(false)
  const [ouverte, setOuverte] = useState(null)
  const [filtre, setFiltre] = useState('')
  const s = useSelection()
  const lancer = useActionGroupee()
  const [relance, setRelance] = useState(null)
  if (erreur) return <Erreur erreur={erreur} />
  if (!r) return <Chargement />
  const t = TYPES_RETRAITE[r.type] || {}
  const actives = r.inscriptions.filter((x) => x.statut !== 'annule')
  const vues = r.inscriptions.filter((x) => (filtre === 'impayes' ? x.statut !== 'annule' && x.montant.reste > 0 : filtre === 'annulees' ? x.statut === 'annule' : x.statut !== 'annule'))
  function copier() { navigator.clipboard?.writeText(r.lien).then(() => notifier('Lien copié'), () => notifier('Copie impossible', 'erreur')) }
  function supprimer() {
    nav('/retraites')
    differer(`Retraite supprimée (${r.nb_inscriptions} inscription${r.nb_inscriptions > 1 ? 's' : ''})`, () => api('retraites.supprimer', { id: r.id }), { ids: [r.id], onAnnule: () => nav(`/retraites/${r.id}`) })
  }
  const lignesParticipants = actives.flatMap((x) => x.participants.map((p) => ({ p, x })))
  const opts = (p) => r.prix.filter((l) => l.obligatoire || (p.options || []).includes(l.id)).map((l) => l.libelle).join(', ')
  const page = (titre, entete, lignes) => `<!doctype html><html><head><meta charset="utf-8"><title>${e(titre)}</title><style>body{font-family:Arial;font-size:11pt;margin:14mm}h1{font-size:15pt;margin:0}p{margin:2px 0 10px;color:#555}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f3ece6}</style></head><body><h1>${e(titre)}</h1><p>${e(r.titre)} — ${e(quand(r))}${r.lieu ? ' — ' + e(r.lieu) : ''}</p><table><tr>${entete.map((h) => `<th>${e(h)}</th>`).join('')}</tr>${lignes.map((l) => `<tr>${l.map((c) => `<td>${e(c)}</td>`).join('')}</tr>`).join('')}</table></body></html>`
  function imprimer(quoi) {
    if (quoi === 'participants') imprimerHtml(page(`Participants (${lignesParticipants.length})`, ['', 'Nom', 'Prénom', t.public === 'enfants' ? 'Classe' : 'Contact', 'Formule', 'Inscription : dû / reste'],
      lignesParticipants.map(({ p, x }, i) => [i + 1, String(p.nom).toUpperCase(), p.prenoms, t.public === 'enfants' ? p.classe : x.contact_tel, opts(p), x.participants[0] === p ? `${euros(x.montant.du)} / ${euros(x.montant.reste)}` : '〃'])))
    if (quoi === 'sante') imprimerHtml(page('Fiche santé et urgence', ['Participant', 'Allergies / régime', 'Contact d\'urgence', ...(t.public === 'enfants' ? ['Autorisation parentale', 'Photos'] : []), 'Parent / contact'],
      lignesParticipants.map(({ p, x }) => [`${p.prenoms} ${String(p.nom).toUpperCase()}`, p.allergies || '—', [x.urgence_nom, x.urgence_tel].filter(Boolean).join(' – ') || '—', ...(t.public === 'enfants' ? [x.autorisation ? 'Oui' : 'NON', p.image === 'non' ? 'NON' : 'oui'] : []), `${x.contact_nom} – ${x.contact_tel}`])))
    if (quoi === 'covoiturage') imprimerHtml(page('Covoiturage', ['Qui', 'Téléphone', 'Propose / cherche'],
      actives.filter((x) => x.covoiturage).sort((a, b) => a.covoiturage.localeCompare(b.covoiturage)).map((x) => [x.contact_nom, x.contact_tel, x.covoiturage === 'propose' ? `Propose ${x.covoit_places || '?'} place(s)` : 'Cherche une place'])))
  }
  return (
    <>
      <Link to={`/retraites?annee=${r.annee}`} className="mb-3 inline-flex items-center gap-1 text-sm text-nuit-600 hover:text-or-600"><ArrowLeft className="h-4 w-4" />Retraites</Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap gap-1.5"><PastilleType type={r.type} /><span className={`pastille ${r.ouverte_maintenant ? 'bg-emerald-100 text-emerald-900' : 'bg-nuit-100 text-nuit-600'}`}>{r.ouverte_maintenant ? 'Inscriptions ouvertes' : 'Inscriptions closes'}{r.date_limite ? ` (jusqu'au ${dateCourte(r.date_limite)})` : ''}</span></div>
          <h1 className="text-3xl font-semibold leading-tight">{r.titre}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-nuit-600"><span className="flex items-center gap-1"><CalendarDays className="h-4 w-4 text-or" />{quand(r)}</span>{r.lieu && <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-or" />{r.lieu}{r.adresse ? ', ' + r.adresse : ''}</span>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-clair" onClick={() => setEdition(true)}><Pencil className="h-4 w-4" />Modifier</button>
          <button className="btn-or" onClick={() => setInvit(true)}><Send className="h-4 w-4" />Inviter</button>
          <button className="btn-danger" title="Supprimer la retraite" onClick={supprimer}><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="carte p-4"><div className="text-2xl font-semibold">{r.nb_participants}</div><div className="text-sm text-nuit-600">participant{r.nb_participants > 1 ? 's' : ''} ({r.nb_inscriptions} inscription{r.nb_inscriptions > 1 ? 's' : ''})</div></div>
        <div className="carte p-4"><div className="text-2xl font-semibold">{euros(r.paye)} <span className="text-base font-normal text-nuit-600">/ {euros(r.du)}</span></div><div className="text-sm text-nuit-600">payé · reste {euros(r.reste)}</div></div>
        <div className="carte p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium">Lien d'inscription public<Aide>À diffuser (newsletter, mail, écoles). Les personnes qui ont un dossier reçoivent plutôt un lien personnel déjà rempli avec « Inviter ».</Aide></div>
          <div className="flex gap-2"><input className="champ py-1 text-xs" readOnly value={r.lien} onFocus={(ev) => ev.target.select()} /><button className="btn-clair px-2" onClick={copier}><Copy className="h-4 w-4" /></button></div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[['', `Inscrits (${actives.length})`], ['impayes', `Reste à payer (${actives.filter((x) => x.montant.reste > 0).length})`], ['annulees', `Annulées (${r.inscriptions.length - actives.length})`]].map(([k, l]) => (
          <button key={k} className={`pastille border ${filtre === k ? 'border-or bg-or text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} onClick={() => setFiltre(k)}>{l}</button>))}
        <span className="ml-auto flex flex-wrap gap-2">
          <button className="btn-clair py-1.5 text-sm" disabled={!actives.length} onClick={() => imprimer('participants')}><Printer className="h-4 w-4" />Participants</button>
          <button className="btn-clair py-1.5 text-sm" disabled={!actives.length} onClick={() => imprimer('sante')}><HeartPulse className="h-4 w-4" />Santé / urgence</button>
          {t.public === 'adultes' && <button className="btn-clair py-1.5 text-sm" disabled={!actives.some((x) => x.covoiturage)} onClick={() => imprimer('covoiturage')}><Car className="h-4 w-4" />Covoiturage</button>}
          <BoutonSelection s={s} className="btn-clair py-1.5 text-sm" />
        </span>
      </div>
      <div className="carte divide-y divide-nuit-100">
        {!vues.length ? <div className="p-6"><Vide icone={Users} texte="Personne ici pour l'instant." /></div> : vues.map((x) => (
          <button key={x.id} onClick={() => (s.actif ? s.basculer(x.id) : setOuverte(x))} className={`${s.a(x.id) ? 'bg-or-50 ' : ''}grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left text-sm hover:bg-nuit-50/50`}>
            <span className="flex min-w-0 items-start gap-3"><Case s={s} id={x.id} nom={x.contact_nom} /><span className="min-w-0"><span className="block font-medium">{x.participants.map((p) => `${p.prenoms} ${String(p.nom).toUpperCase()}`).join(', ')}</span>
              <span className="block truncate text-xs text-nuit-600/70">{t.public === 'enfants' ? `Parent : ${x.contact_nom} · ` : ''}{x.contact_email} · inscrit le {dateCourte(x.cree_le)}{x.participants.some((p) => p.allergies) ? ' · ⚠ allergies / régime' : ''}{x.covoiturage === 'propose' ? ` · propose ${x.covoit_places} place(s)` : x.covoiturage === 'cherche' ? ' · cherche une place' : ''}</span>
              {x.participants.some((p) => p.dossier_id) && <span className="mt-0.5 flex flex-wrap gap-1">{x.participants.filter((p) => p.dossier_id).map((p) => <span key={p.dossier_id} className="pastille bg-nuit-50 py-0 text-[10px] text-nuit-600">dossier de {p.prenoms}</span>)}</span>}</span></span>
            <span className="text-right">{x.statut === 'annule' ? <span className="pastille bg-nuit-100 text-nuit-600">Annulée</span> : x.montant.reste > 0 ? <><span className="block font-medium">{euros(x.montant.reste)}</span><span className="text-xs text-nuit-600/70">reste sur {euros(x.montant.du)}</span></> : x.montant.du > 0 ? <span className="pastille bg-emerald-100 text-emerald-900"><Check className="h-3 w-3" />Payé</span> : null}</span>
          </button>
        ))}
      </div>
      <BarreSelection s={s} tous={vues.map((x) => x.id)} raccourcis={[['Reste à payer', actives.filter((x) => x.montant.reste > 0).map((x) => x.id)]]}>
        {(() => {
          const impayes = vues.filter((x) => s.a(x.id) && x.statut !== 'annule' && x.montant.reste > 0)
          return <>
            <MenuAction libelle={`Payé (${impayes.length})…`} disabled={!impayes.length} choix={[['Chèque', 'Par chèque'], ['Espèces', 'En espèces'], ['Virement', 'Par virement'], ['Sur place', 'Réglé sur place']]}
              onChoix={(mode) => {
                const ids = impayes.map((x) => x.id), avant = r
                lancer({ titre: `Inscriptions soldées (${mode.toLowerCase()})`, texte: `Reste dû de chacun réglé ${mode === 'Sur place' ? 'sur place' : 'par ' + mode.toLowerCase()} : ${ids.length} inscription${ids.length > 1 ? 's' : ''}. Vous pourrez annuler pendant 10 secondes.`,
                  appliquer: () => setData((d) => ({ ...d, inscriptions: d.inscriptions.map((x) => (ids.includes(x.id) ? { ...x, montant: { ...x.montant, paye: x.montant.du, reste: 0 } } : x)) })),
                  annuler: () => setData(avant), executer: () => api('retraites.lot', { retraite_id: r.id, ids, op: 'solder', mode }),
                  apres: (res) => { s.quitter(); if (res?.retraite) setData(res.retraite) } })
              }} />
            <button className="btn-clair py-1.5 text-xs" disabled={!impayes.length} onClick={() => setRelance(impayes)}><BellRing className="h-3.5 w-3.5" />Relancer ({impayes.length})</button>
          </>
        })()}
      </BarreSelection>
      {relance && <Redaction mode="nouveau" sujet={`${r.titre} – participation à régler`}
        corps={"Bonjour,\n\nPour l'inscription de {participants} à la retraite « {retraite} », il reste {reste} à régler (sur {du}).\n\nVous pouvez payer en ligne :\n[Bouton : Payer en ligne]\n\nou par chèque ou en espèces auprès de la paroisse.\n\nAvec l'assurance de nos prières à toutes vos intentions,"}
        boutons={[{ texte: 'Payer en ligne', url: 'https://secretariat.croix-glorieuse.org/paiement/' }]}
        destinataires={`Un mail personnel pour chaque inscription (${relance.length}). {participants}, {reste}, {du} et {retraite} sont remplis pour chacune. Exemple – ${relance[0].participants.map((p) => p.prenoms).join(' et ')} : reste ${euros(relance[0].montant.reste)}.`}
        envoiPersonnalise={({ sujet, corps, signature }) => api('retraites.lot', { retraite_id: r.id, ids: relance.map((x) => x.id), op: 'relancer', sujet, corps, signature })}
        onFermer={() => setRelance(null)} onEnvoye={(res) => { setRelance(null); s.quitter(); notifier(texteRapport(res, 'mail envoyé'), res.ignores?.length ? 'erreur' : undefined) }} />}
      {edition && <EditionRetraite r={r} onFermer={() => setEdition(false)} onFait={(x) => { setData(x); setEdition(false); notifier('Retraite enregistrée') }} />}
      {ouverte && <Inscription r={r} x={ouverte} onFermer={() => setOuverte(null)} onMaj={(nr) => { setData(nr); setOuverte(nr.inscriptions.find((y) => y.id === ouverte.id)) }} />}
      {invit && <Inviter r={r} onFermer={() => setInvit(false)} />}
    </>
  )
}

function Inscription({ r, x, onFermer, onMaj }) {
  const notifier = useNotif()
  const [p, setP] = useState({ montant: x.montant.reste > 0 ? String(x.montant.reste) : '', mode: 'Chèque', date: new Date().toISOString().slice(0, 10) })
  const [occupe, setOccupe] = useState(false)
  const t = TYPES_RETRAITE[r.type] || {}
  async function action(params, msg) {
    setOccupe(true)
    try { onMaj(await api('retraites.inscription', { id: x.id, ...params })); if (msg) notifier(msg) } catch (err) { notifier(err.message, 'erreur') } finally { setOccupe(false) }
  }
  const ligne = (l, v) => v ? <div className="flex gap-2 text-sm"><span className="w-40 shrink-0 text-nuit-600/70">{l}</span><span>{v}</span></div> : null
  return (
    <Modale large titre={x.participants.map((q) => q.prenoms).join(', ') + ' ' + String(x.participants[0]?.nom || '').toUpperCase()} onFermer={onFermer}
      pied={<>{x.statut === 'annule'
        ? <button className="btn-clair mr-auto" disabled={occupe} onClick={() => action({ statut: 'inscrit' }, 'Inscription rétablie')}>Rétablir l'inscription</button>
        : <button className="btn-clair mr-auto text-red-700" disabled={occupe} onClick={() => action({ statut: 'annule' }, 'Inscription annulée', )}>Annuler l'inscription</button>}
        <button className="btn-principal" onClick={onFermer}>Fermer</button></>}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          {x.participants.map((q, i) => (
            <div key={i} className="rounded-xl border border-nuit-100 p-3">
              <div className="font-medium">{q.prenoms} {String(q.nom).toUpperCase()}{q.dossier_id && <Link to={`/dossiers/${q.dossier_id}`} className="ml-2 text-xs text-or-600 hover:underline">dossier →</Link>}</div>
              {ligne('Classe', q.classe)}
              {ligne('Formule', r.prix.filter((l) => l.obligatoire || (q.options || []).includes(l.id)).map((l) => `${l.libelle} (${euros(l.montant)})`).join(', '))}
              {ligne('Allergies / régime', q.allergies)}
              {t.public === 'enfants' && ligne('Photos', q.image === 'non' ? 'Refusées' : 'Acceptées')}
            </div>
          ))}
          <div className="space-y-1">
            {ligne(t.public === 'enfants' ? 'Parent' : 'Contact', x.contact_nom)}
            {ligne('E-mail', x.contact_email)}{ligne('Téléphone', x.contact_tel)}
            {ligne('Contact d\'urgence', [x.urgence_nom, x.urgence_tel].filter(Boolean).join(' – '))}
            {t.public === 'enfants' && ligne('Autorisation parentale', x.autorisation || 'NON')}
            {ligne('Covoiturage', x.covoiturage === 'propose' ? `Propose ${x.covoit_places} place(s)` : x.covoiturage === 'cherche' ? 'Cherche une place' : '')}
            {ligne('Remarque', x.remarque)}{ligne('Inscription', `${x.source} · ${dateCourte(x.cree_le)}${x.maj_le !== x.cree_le ? ' · modifiée le ' + dateCourte(x.maj_le) : ''}`)}
          </div>
        </div>
        <div>
          <div className="rounded-xl bg-nuit-50/60 p-3 text-sm">
            {x.montant.sur_place > 0 && <div className="flex justify-between text-nuit-600"><span>Réglé sur place (lieu d'accueil)</span><span>{euros(x.montant.sur_place)}</span></div>}
            <div className="flex justify-between"><span>Retraite</span><span>{euros(x.montant.retraite)}</span></div>
            <div className="flex justify-between"><span>Participation cérémonie</span><span>{euros(x.montant.ceremonie)}</span></div>
            <div className="mt-1 flex justify-between border-t border-nuit-100 pt-1 font-semibold"><span>Total</span><span>{euros(x.montant.du)}</span></div>
            <div className="flex justify-between text-nuit-600"><span>Payé</span><span>{euros(x.montant.paye)}</span></div>
            <div className="flex justify-between font-semibold text-or-600"><span>Reste</span><span>{euros(x.montant.reste)}</span></div>
          </div>
          <h3 className="etiquette mt-4">Paiements</h3>
          {!x.paiements.length ? <p className="text-sm text-nuit-600/70">Aucun paiement.</p> : x.paiements.map((q) => (
            <div key={q.id} className="flex items-center gap-2 border-b border-nuit-100 py-1.5 text-sm"><span className="flex-1">{dateCourte(q.date)} · {q.mode}{q.part === 'ceremonie' ? ' (cérémonie)' : q.part === 'retraite' ? ' (retraite)' : ''} · {q.par}</span><span className="font-medium">{euros(q.montant)}</span>
              <button className="btn-icone p-1 text-red-700" disabled={occupe} onClick={() => action({ retirer: q.id }, 'Paiement retiré')}><Trash2 className="h-3.5 w-3.5" /></button></div>
          ))}
          <div className="mt-3 grid grid-cols-[1fr_1fr] gap-2">
            <input className="champ" inputMode="decimal" placeholder="Montant" value={p.montant} onChange={(ev) => setP({ ...p, montant: ev.target.value })} />
            <input className="champ" type="date" value={p.date} onChange={(ev) => setP({ ...p, date: ev.target.value })} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">{MODES.map((m) => <button key={m} className={`pastille border ${p.mode === m ? 'border-or bg-or text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} onClick={() => setP({ ...p, mode: m })}>{m}</button>)}</div>
          <button className="btn-or mt-2 w-full" disabled={occupe || !Number(String(p.montant).replace(',', '.'))} onClick={() => action({ ajouter: { ...p, montant: String(p.montant).replace(',', '.') } }, 'Paiement enregistré').then(() => setP({ ...p, montant: '' }))}>{occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}Enregistrer le paiement</button>
        </div>
      </div>
    </Modale>
  )
}

const VIDE = { type: 'premiere_communion', titre: '', date_debut: '', date_fin: '', heure_debut: '', heure_fin: '', lieu: '', adresse: '', prix: [], ceremonie_suggestion: '', ceremonie_texte: 'Cierge, fleurs, livret de la célébration…', paiement_texte: '', programme: '', apporter: '', responsable_nom: '', responsable_tel: '', date_limite: '', ouverte: true, paiement_lieu: '' }

function EditionRetraite({ r, onFermer, onFait }) {
  const [v, setV] = useState(() => ({ ...VIDE, ...r, ouverte: r.ouverte !== 'non' && r.ouverte !== false, prix: (r.prix || []).map((l) => ({ ...l })) }))
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const maj = (k, x) => setV((w) => ({ ...w, [k]: x }))
  const majPrix = (i, k, x) => setV((w) => ({ ...w, prix: w.prix.map((l, j) => (j === i ? { ...l, [k]: x } : l)) }))
  async function enregistrer() {
    setEnvoi(true); setErreur(null)
    try { onFait(await api('retraites.ecrire', { retraite: { ...v, prix: v.prix.map((l) => ({ ...l, montant: String(l.montant).replace(',', '.') })) } })) } catch (err) { setErreur(err); setEnvoi(false) }
  }
  const champ = (k, l, type = 'text', extra = {}) => <div><label className="etiquette">{l}</label><input className="champ" type={type} value={v[k] || ''} onChange={(ev) => maj(k, ev.target.value)} {...extra} /></div>
  const zone = (k, l, ph) => <div><label className="etiquette">{l}</label><textarea className="champ min-h-[80px]" placeholder={ph} value={v[k] || ''} onChange={(ev) => maj(k, ev.target.value)} /></div>
  const total = v.prix.filter((l) => l.obligatoire).reduce((a, l) => a + (Number(String(l.montant).replace(',', '.')) || 0), 0)
  return (
    <Modale large titre={r.id ? 'Modifier la retraite' : 'Nouvelle retraite'} onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={envoi || !v.date_debut} onClick={enregistrer}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button></>}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <div><label className="etiquette">Retraite de</label><div className="flex flex-wrap gap-1.5">{Object.entries(TYPES_RETRAITE).map(([k, t]) => (
            <button key={k} className={`pastille border py-1 ${v.type === k ? 'border-transparent text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} style={v.type === k ? { background: t.couleur } : {}} onClick={() => maj('type', k)}>{t.nom}</button>))}</div>
            <p className="mt-1 text-xs text-nuit-600/70">{TYPES_RETRAITE[v.type].public === 'enfants' ? 'Formulaire pour les parents (plusieurs enfants possibles), autorisation parentale, contact d\'urgence, photos.' : 'Formulaire pour les adultes : régime, covoiturage, remarque. « Inviter » propose les confirmands et les catéchumènes de la même année.'}</p></div>
          {champ('titre', 'Titre (facultatif)', 'text', { placeholder: 'Retraite – ' + TYPES_RETRAITE[v.type].nom })}
          <div className="grid grid-cols-2 gap-3">{champ('date_debut', 'Du', 'date')}{champ('date_fin', 'Au (si plusieurs jours)', 'date')}</div>
          <div className="grid grid-cols-2 gap-3">{champ('heure_debut', 'Heure de début', 'time')}{champ('heure_fin', 'Heure de fin', 'time')}</div>
          {champ('lieu', 'Lieu', 'text', { placeholder: 'Mont Sainte-Odile' })}
          {champ('adresse', 'Adresse')}
          <div className="grid grid-cols-2 gap-3">{champ('responsable_nom', 'Responsable')}{champ('responsable_tel', 'Son téléphone', 'tel')}</div>
          {champ('date_limite', 'Date limite d\'inscription', 'date')}
          <label className="flex items-center gap-3 text-sm"><Interrupteur actif={v.ouverte} onChange={(x) => maj('ouverte', x)} />Inscriptions ouvertes</label>
        </div>
        <div className="space-y-3">
          <div>
            <label className="etiquette">Prix (par participant)</label>
            {v.prix.map((l, i) => (
              <div key={i} className="mb-1.5 flex items-center gap-1.5">
                <input className="champ flex-1 py-1.5" placeholder="Repas, chambre (2 nuits)…" value={l.libelle} onChange={(ev) => majPrix(i, 'libelle', ev.target.value)} />
                <input className="champ w-20 py-1.5" inputMode="decimal" placeholder="€" value={l.montant} onChange={(ev) => majPrix(i, 'montant', ev.target.value)} />
                <button className={`pastille border py-1 text-xs ${l.obligatoire ? 'border-or bg-or text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} onClick={() => majPrix(i, 'obligatoire', !l.obligatoire)}>{l.obligatoire ? 'Compris' : 'Option'}</button>
                <button className="btn-icone p-1 text-red-700" onClick={() => setV((w) => ({ ...w, prix: w.prix.filter((_, j) => j !== i) }))}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <button className="btn-clair py-1 text-xs" onClick={() => setV((w) => ({ ...w, prix: [...w.prix, { libelle: '', montant: '', obligatoire: true }] }))}><Plus className="h-3.5 w-3.5" />Ajouter une ligne</button>
            <p className="mt-1 text-xs text-nuit-600/70">« Compris » : toujours compté. « Option » : le participant la coche (ex. nuitée). Prix de base : {euros(total)}.</p>
          </div>
          <div><label className="etiquette">Ce prix (hébergement, repas…) se règle</label>
            <div className="flex flex-wrap gap-1.5">{[['', 'À la paroisse (en ligne ou à la main)'], ['sur_place', 'Sur place, au lieu d\'accueil']].map(([k, l]) => (
              <button key={k} className={`pastille border py-1 ${(v.paiement_lieu || '') === k ? 'border-or bg-or text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} onClick={() => maj('paiement_lieu', k)}>{l}</button>))}</div>
            {v.paiement_lieu === 'sur_place' && <p className="mt-1 text-xs text-nuit-600/70">Le participant voit le montant à régler sur place ; la paroisse n'encaisse que la participation à la cérémonie.</p>}</div>
          <div className="grid grid-cols-[110px_1fr] gap-3">{champ('ceremonie_suggestion', 'Cérémonie : suggéré (€)', 'text', { inputMode: 'decimal' })}{champ('ceremonie_texte', 'Ce que cela couvre')}</div>
          {zone('paiement_texte', 'Modalités de paiement (dans le mail de confirmation)', 'Chèque à l\'ordre de « Paroisse La Croix glorieuse », à remettre au secrétariat ; ou virement : IBAN…')}
          {zone('programme', 'Programme / horaires détaillés')}
          {zone('apporter', 'À apporter', 'Sac de couchage, Bible, tenue chaude…')}
        </div>
      </div>
      <div className="mt-3"><Erreur erreur={erreur} /></div>
    </Modale>
  )
}

function Inviter({ r, onFermer }) {
  const notifier = useNotif()
  const [liste, setListe] = useState(null)
  const [choix, setChoix] = useState([])
  const [redaction, setRedaction] = useState(false)
  const t = TYPES_RETRAITE[r.type]
  useEffect(() => { api('retraites.invites', { id: r.id }).then((l) => { setListe(l); setChoix(l.filter((d) => d.email && !d.inscrit).map((d) => d.id)) }).catch((err) => notifier(err.message, 'erreur')) }, [r.id, notifier])
  const basculer = (id) => setChoix((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  if (redaction) {
    const enfants = t.public === 'enfants'
    const corps = `Bonjour,\n\n${enfants ? 'En préparation' : 'Pour vous préparer'} ${t.texte.replace(/^de /, 'à la ').replace(/^à la confirmation des jeunes/, 'à la confirmation')}, une retraite aura lieu ${quand(r).replace(' · ', ', ').replace(' → ', ' à ')}${r.lieu ? ', ' + r.lieu : ''}.\n\n${enfants ? 'Merci d\'inscrire {prenom}' : '{prenom}, merci de vous inscrire'} dès que possible${r.date_limite ? ' (avant le ' + new Date(r.date_limite + 'T12:00:00').toLocaleDateString('fr-FR') + ')' : ''} :\n[Bouton : Inscription à la retraite]\n\nAvec l'assurance de nos prières à toutes vos intentions,`
    return <Redaction mode="nouveau" sujet={r.titre} corps={corps} boutons={[{ texte: 'Inscription à la retraite', url: r.lien }]}
      destinataires={`Un mail personnel à chacun des ${choix.length} destinataires, avec son lien déjà rempli ({prenom} est remplacé pour chacun)`}
      envoiPersonnalise={({ sujet, corps: c, signature }) => api('retraites.inviter', { id: r.id, ids: choix, sujet, corps: c, signature })}
      onFermer={() => setRedaction(false)} onEnvoye={(x) => { notifier(`Invitation envoyée à ${x?.nb} personne${x?.nb > 1 ? 's' : ''}`); onFermer() }} />
  }
  return (
    <Modale titre="Inviter à la retraite" onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={!choix.length} onClick={() => setRedaction(true)}><Send className="h-4 w-4" />Rédiger le mail ({choix.length})</button></>}>
      <p className="mb-3 text-sm text-nuit-600">{t.public === 'enfants' ? `Dossiers ${t.nom.toLowerCase()} de ${r.annee} (le mail part aux parents).` : `Confirmands et catéchumènes dont les sacrements sont prévus en ${String(r.annee).split('-')[1]}.`} Chacun reçoit un lien personnel, déjà rempli.</p>
      {!liste ? <Chargement /> : !liste.length ? <Vide icone={Users} texte="Aucun dossier en cours pour cette année." /> : (
        <ul className="max-h-[55vh] divide-y divide-nuit-100 overflow-y-auto">
          {liste.map((d) => (
            <li key={d.id}><button className="flex w-full items-center gap-3 py-2 text-left text-sm disabled:opacity-50" disabled={!d.email} onClick={() => basculer(d.id)}>
              <span className={`flex h-5 w-5 items-center justify-center rounded border ${choix.includes(d.id) ? 'border-or bg-or text-white' : 'border-nuit-200'}`}>{choix.includes(d.id) && <Check className="h-3.5 w-3.5" />}</span>
              <span className="flex-1"><span className="font-medium">{d.nom}</span>{d.type === 'catechumene' && <span className="pastille ml-1.5 bg-amber-100 py-0 text-[10px] text-amber-900">catéchumène</span>}<span className="block text-xs text-nuit-600/70">{d.email || 'pas d\'adresse e-mail'}</span></span>
              {d.inscrit && <span className="pastille bg-emerald-100 py-0 text-[10px] text-emerald-900">déjà inscrit</span>}
            </button></li>
          ))}
        </ul>
      )}
    </Modale>
  )
}
