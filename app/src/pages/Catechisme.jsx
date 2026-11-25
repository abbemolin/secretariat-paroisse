import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Check, Download, FolderHeart, FolderPlus, GraduationCap, Loader2, Mail, Plus, Printer, Search, Trash2, Wallet, BellRing, ExternalLink } from 'lucide-react'
import { api, enCache } from '../api.js'
import { TYPES } from '../types.js'
import { Chargement, Erreur, Modale, Vide, useCharger, useNotif, useDifferer, enSuppression, Aide, imprimerHtml, dateCourte, Interrupteur } from '../ui.jsx'
import { Redaction } from './Courrier.jsx'
import { useSelection, BoutonSelection, BarreSelection, MenuAction, Case, useActionGroupee } from '../selection.jsx'

/** Types de dossiers qu'une inscription peut ouvrir. */
export const DEMANDES_CATE = ['bapteme', 'premiere_communion', 'profession_foi', 'confirmation_jeune']
const euros = (n) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'
const e = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')

export default function Catechisme() {
  const { id } = useParams()
  return id ? <Fiche id={id} /> : <Liste />
}

function PastilleDemande({ d }) {
  const t = TYPES[d.type]
  if (!t) return null
  return (
    <Link to={`/dossiers/${d.dossier_id}`} onClick={(ev) => ev.stopPropagation()} className="pastille gap-1 border py-0 text-[10px] hover:underline" style={{ borderColor: t.couleur, color: t.couleur }}>
      <FolderHeart className="h-2.5 w-2.5" />{t.nom}
    </Link>
  )
}

function Paiement({ x }) {
  if (!x.du) return <span className="text-xs text-nuit-600/50">—</span>
  return x.reste > 0
    ? <span className="pastille bg-amber-100 py-0 text-[10px] text-amber-900">Reste {euros(x.reste)}</span>
    : <span className="pastille bg-emerald-50 py-0 text-[10px] text-emerald-700"><Check className="mr-0.5 h-2.5 w-2.5" />Payé</span>
}

function Liste() {
  const nav = useNavigate()
  const notifier = useNotif()
  const [params, setParams] = useSearchParams()
  const annee = params.get('annee') || ''
  const groupe = params.get('groupe') || ''
  const impayes = params.get('impayes') === '1'
  const [texte, setTexte] = useState('')
  const [importe, setImporte] = useState(false)
  const [nouveau, setNouveau] = useState(false)
  const [mail, setMail] = useState(null)
  const { data, chargement, erreur, recharger, setData } = useCharger(() => api('cate.liste', { annee }), [annee], ['cate.liste', { annee }])
  const s = useSelection()
  const lancer = useActionGroupee()
  function actionLot(titre, op, extra, transformer, ids) {
    const avant = data
    lancer({ titre, texte: `${titre} : ${ids.length} inscription${ids.length > 1 ? 's' : ''}. Vous pourrez annuler pendant 10 secondes.`,
      appliquer: () => setData((d) => ({ ...d, inscriptions: d.inscriptions.map((x) => (ids.includes(x.id) ? { ...x, ...transformer(x) } : x)) })),
      annuler: () => setData(avant), executer: () => api('cate.lot', { ids, op, ...extra }), apres: () => { s.quitter(); recharger() } })
  }
  const changer = (p) => setParams(Object.fromEntries(Object.entries({ annee, groupe, impayes: impayes ? '1' : '', ...p }).filter(([, v]) => v)))

  const toutes = (data?.inscriptions || []).filter((x) => !enSuppression.has(x.id))
  const duGroupe = toutes.filter((x) => !groupe || (groupe === 'aucun' ? !x.groupe : x.groupe === groupe))
  const liste = duGroupe.filter((x) => (!impayes || x.reste > 0) && (!texte || `${x.nom} ${x.prenoms} ${x.email} ${x.classe}`.toLowerCase().includes(texte.toLowerCase())))
  const somme = (k) => duGroupe.reduce((a, x) => a + (x[k] > 0 ? x[k] : 0), 0)
  const nomListe = groupe ? (groupe === 'aucun' ? 'sans groupe' : groupe) : 'tous les groupes'

  async function importer() {
    setImporte(true)
    try {
      const r = await api('cate.importer')
      notifier(r.nouvelles ? `${r.nouvelles} inscription${r.nouvelles > 1 ? 's' : ''} importée${r.nouvelles > 1 ? 's' : ''}` : 'Aucune nouvelle inscription')
      if (r.erreurs?.length) notifier(r.erreurs.slice(0, 3).join(' · '), 'erreur')
      recharger()
    } catch (err) { notifier(err.message, 'erreur') } finally { setImporte(false) }
  }

  function imprimer() {
    const lignes = liste.map((x, i) => `<tr><td>${i + 1}</td><td>${e(String(x.nom).toUpperCase())}</td><td>${e(x.prenoms)}</td><td>${e(x.classe)}</td><td>${e(x.telephone)}</td><td>${e(x.demandes.map((d) => TYPES[d.type]?.nom).join(', '))}</td><td>${x.reste > 0 ? euros(x.reste) : x.du ? 'payé' : ''}</td></tr>`).join('')
    imprimerHtml(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Catéchisme ${e(data.annee)}</title><style>
      body{font-family:Georgia,serif;margin:16mm;color:#222} h1{font-size:20pt;margin:0} p{margin:2mm 0 6mm;color:#555}
      table{width:100%;border-collapse:collapse;font-size:10.5pt} th,td{border-bottom:1px solid #ccc;padding:2mm 1.5mm;text-align:left} th{border-bottom:2px solid #521a22}
      </style></head><body><h1>Catéchisme – ${e(nomListe)}</h1><p>Année ${e(data.annee)} · ${liste.length} inscrit${liste.length > 1 ? 's' : ''}</p>
      <table><thead><tr><th>N°</th><th>Nom</th><th>Prénom</th><th>Classe</th><th>Téléphone</th><th>Sacrement</th><th>Reste dû</th></tr></thead><tbody>${lignes}</tbody></table></body></html>`)
  }

  const vue = params.get('vue') || ''
  const ongletsVue = (
    <div className="mb-4 flex gap-1.5">{[['', 'Inscriptions'], ['livres', 'Livres']].map(([k, l]) => (
      <button key={k} className={`pastille border px-3 py-1.5 text-sm ${vue === k ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} onClick={() => setParams(k ? { vue: k } : {})}>{l}</button>))}</div>
  )
  if (vue === 'livres') return <>{ongletsVue}<Livres /></>
  return (
    <>
      {ongletsVue}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-semibold">Catéchisme</h1><p className="text-sm text-nuit-600/80">Inscriptions au catéchisme et à l'aumônerie</p></div>
        <div className="flex flex-wrap gap-2">
          {data && <select className="champ w-auto py-2" value={data.annee} onChange={(ev) => changer({ annee: ev.target.value, groupe: '' })}>{data.annees.map((a) => <option key={a}>{a}</option>)}</select>}
          <button className="btn-clair" onClick={importer} disabled={importe}>{importe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="hidden sm:inline">Importer le formulaire</span></button>
          <Aide>Lit les réponses du Google Form (Réglages → Catéchisme). Les nouvelles inscriptions sont ajoutées, celles déjà présentes mises à jour ; un dossier est créé pour chaque demande de sacrement.</Aide>
          <button className="btn-or" onClick={() => setNouveau(true)}><Plus className="h-4 w-4" />Inscrire</button>
        </div>
      </div>
      <Erreur erreur={erreur} reessayer={recharger} />
      {chargement && !data ? <Chargement /> : data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Inscrits', duGroupe.length, GraduationCap],
              ['Demandes de sacrements', duGroupe.filter((x) => x.demandes.length).length, FolderHeart],
              ['Encaissé', euros(somme('paye')), Wallet],
              ['Reste à encaisser', euros(somme('reste')), BellRing]
            ].map(([l, v, I]) => (
              <div key={l} className="carte flex items-center gap-3 p-4"><I className="h-6 w-6 shrink-0 text-or" /><div><div className="text-xl font-semibold">{v}</div><div className="text-xs text-nuit-600/70">{l}</div></div></div>
            ))}
          </div>
          <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {[['', 'Tous', toutes.length], ...data.groupes.map((g) => [g, g, toutes.filter((x) => x.groupe === g).length]),
              ...(toutes.some((x) => !x.groupe) ? [['aucun', 'Sans groupe', toutes.filter((x) => !x.groupe).length]] : [])].map(([cle, nom, n]) => (
              <button key={cle || 'tous'} onClick={() => changer({ groupe: cle })} className={`pastille shrink-0 gap-1.5 border py-1 ${groupe === cle ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>{nom}<span className="opacity-60">{n}</span></button>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-nuit-600/50" />
              <input className="champ pl-9" placeholder="Nom, prénom, e-mail, classe…" value={texte} onChange={(ev) => setTexte(ev.target.value)} /></div>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={impayes} onChange={(ev) => changer({ impayes: ev.target.checked ? '1' : '' })} />Impayés seulement</label>
            <button className="btn-clair" disabled={!liste.length} onClick={() => setMail({ ids: liste.map((x) => x.id), individuel: false })}><Mail className="h-4 w-4" />Mail aux parents</button>
            <button className="btn-clair" disabled={!liste.some((x) => x.reste > 0)} onClick={() => setMail({ ids: liste.filter((x) => x.reste > 0).map((x) => x.id), individuel: true })}><BellRing className="h-4 w-4" />Relancer les impayés</button>
            <button className="btn-clair" disabled={!liste.length} onClick={imprimer}><Printer className="h-4 w-4" /><span className="hidden sm:inline">Imprimer</span></button>
            <BoutonSelection s={s} />
          </div>
          <div className="carte divide-y divide-nuit-50 overflow-hidden">
            {!liste.length ? <Vide icone={GraduationCap} texte={toutes.length ? 'Aucune inscription ici.' : 'Aucune inscription pour cette année. Utilisez « Importer le formulaire ».'} /> : liste.map((x) => (
              <button key={x.id} onClick={() => (s.actif ? s.basculer(x.id) : nav(`/catechisme/${x.id}`))} className={`${s.a(x.id) ? 'bg-or-50 ' : ''}flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition hover:bg-nuit-50/60`}>
                <Case s={s} id={x.id} nom={x.prenoms + ' ' + x.nom} />
                <span className="min-w-[180px] flex-1"><span className="font-semibold">{String(x.nom).toUpperCase()}</span> {x.prenoms}
                  <span className="block text-xs text-nuit-600/70">{x.classe || 'classe ?'}{!groupe && x.groupe ? ` · ${x.groupe}` : ''}{x.email ? ` · ${x.email}` : ''}</span></span>
                <span className="flex flex-wrap gap-1">{x.demandes.map((d) => <PastilleDemande key={d.type} d={d} />)}</span>
                {x.nb_manuels > 0 && <span title={x.manuels_remis ? 'Manuels remis' : 'Manuels à remettre'}><BookOpen className={`h-4 w-4 ${x.manuels_remis ? 'text-emerald-600' : 'text-nuit-600/40'}`} /></span>}
                <Paiement x={x} />
              </button>
            ))}
          </div>
        </>
      )}
      {data && <BarreSelection s={s} tous={liste.map((x) => x.id)} raccourcis={[['Impayés', liste.filter((x) => x.reste > 0).map((x) => x.id)], ['Livres à remettre', liste.filter((x) => x.nb_manuels > 0 && !x.manuels_remis).map((x) => x.id)]]}>
        {(() => {
          const choisis = liste.filter((x) => s.a(x.id)), aSolder = choisis.filter((x) => x.reste > 0), livres = choisis.filter((x) => x.nb_manuels > 0)
          return <>
            <MenuAction libelle={`Cotisation payée (${aSolder.length})…`} disabled={!aSolder.length} choix={[['Espèces', 'En espèces'], ['Chèque', 'Par chèque'], ['Virement', 'Par virement']]}
              onChoix={(mode) => actionLot(`Cotisation soldée (${mode.toLowerCase()}, reste dû de chacun)`, 'solder', { mode }, () => ({ paye: undefined, reste: 0 }), aSolder.map((x) => x.id))} />
            <button className="btn-clair py-1.5 text-xs" disabled={!livres.length} onClick={() => actionLot('Livres remis', 'remis', { valeur: true }, () => ({ manuels_remis: true }), livres.map((x) => x.id))}><BookOpen className="h-3.5 w-3.5" />Livres remis ({livres.length})</button>
            <MenuAction libelle="Groupe…" choix={[...data.groupes.map((g) => [g, g]), ['-', 'Sans groupe']]}
              onChoix={(g, l) => actionLot(`Groupe : ${l}`, 'groupe', { valeur: g === '-' ? '' : g }, () => ({ groupe: g === '-' ? '' : g }), choisis.map((x) => x.id))} />
            <button className="btn-clair py-1.5 text-xs" disabled={!aSolder.length} onClick={() => setMail({ ids: aSolder.map((x) => x.id), individuel: true })}><BellRing className="h-3.5 w-3.5" />Relancer ({aSolder.length})</button>
          </>
        })()}
      </BarreSelection>}
      {nouveau && data && <NouvelleInscription annee={data.annee} groupes={data.groupes} onFermer={() => setNouveau(false)} onCree={(x) => nav(`/catechisme/${x.id}`)} />}
      {mail && <MailParents {...mail} nomListe={nomListe} onFermer={() => setMail(null)} />}
    </>
  )
}

function MailParents({ ids, individuel, nomListe, onFermer }) {
  const notifier = useNotif()
  const sujet = individuel ? 'Catéchisme – inscription de {enfants}' : `Catéchisme – ${nomListe}`
  const corps = individuel
    ? 'Bonjour,\n\nSauf erreur de notre part, il reste {reste} à régler pour l\'inscription au catéchisme de {enfants} :\n{detail}\n\nVous pouvez payer en ligne :\n[Bouton : Payer en ligne]\n\nou régler au secrétariat (espèces ou chèque à l\'ordre de la paroisse) ou par virement.\n\nMerci beaucoup.\n\nAvec l\'assurance de nos prières à toutes vos intentions,'
    : 'Bonjour,\n\n\n\nAvec l\'assurance de nos prières à toutes vos intentions,'
  return (
    <Redaction mode="nouveau" sujet={sujet} corps={corps} boutons={individuel ? [{ texte: 'Payer en ligne', url: 'https://secretariat.croix-glorieuse.org/paiement/' }] : undefined}
      destinataires={individuel ? `Un mail personnel à chaque famille qui doit encore régler (${ids.length} enfant${ids.length > 1 ? 's' : ''}). {enfants}, {reste} et {detail} sont remplis pour chacune.` : `Parents — ${nomListe} (${ids.length} enfant${ids.length > 1 ? 's' : ''}), en copie cachée`}
      envoiPersonnalise={({ sujet: s, corps: c, signature }) => api('cate.envoyer', { ids, sujet: s, corps: c, signature, individuel })}
      onFermer={onFermer} onEnvoye={(r) => { onFermer(); notifier(`Envoyé à ${r?.nb ?? ''} famille${r?.nb > 1 ? 's' : ''}`) }} />
  )
}

const CHAMPS_ENFANT = [['prenoms', 'Prénoms'], ['nom', 'Nom'], ['naissance', 'Né(e) le', 'date'], ['classe', 'Classe']]
const CHAMPS_FAMILLE = [['pere', 'Père (nom et prénom)'], ['mere', 'Mère (nom de jeune fille et prénom)'], ['email', 'E-mail', 'email'], ['telephone', 'Téléphone', 'tel'], ['adresse', 'Adresse']]

function NouvelleInscription({ annee, groupes, onFermer, onCree }) {
  const [v, setV] = useState({ annee, prenoms: '', nom: '', classe: '', groupe: '', email: '', telephone: '', demande: '' })
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const maj = (k) => (ev) => setV({ ...v, [k]: ev.target.value })
  async function creer() {
    setEnvoi(true); setErreur(null)
    try {
      const { demande, ...reste } = v
      onCree(await api('cate.creer', { ...reste, sacrement: demande ? TYPES[demande].nom : '' }))
    } catch (err) { setErreur(err); setEnvoi(false) }
  }
  return (
    <Modale titre={`Inscrire au catéchisme ${annee}`} onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={envoi || !(v.nom || v.prenoms)} onClick={creer}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Inscrire</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {[['prenoms', 'Prénoms'], ['nom', 'Nom'], ['classe', 'Classe (ex. CE2, 4e, 1re)'], ['email', 'E-mail des parents'], ['telephone', 'Téléphone']].map(([k, l]) => (
          <div key={k}><label className="etiquette">{l}</label><input className="champ" value={v[k]} onChange={maj(k)} /></div>
        ))}
        <div><label className="etiquette">Groupe</label><select className="champ" value={v.groupe} onChange={maj('groupe')}><option value="">D'après la classe</option>{groupes.map((g) => <option key={g}>{g}</option>)}</select></div>
        <div className="sm:col-span-2"><label className="etiquette">Demande cette année</label>
          <select className="champ" value={v.demande} onChange={maj('demande')}><option value="">Aucun sacrement particulier</option>{DEMANDES_CATE.map((t) => <option key={t} value={t}>{TYPES[t].nom}</option>)}</select>
          <p className="mt-1 text-xs text-nuit-600/70">Le dossier correspondant est créé automatiquement.</p></div>
      </div>
      <div className="mt-3"><Erreur erreur={erreur} /></div>
    </Modale>
  )
}

function Fiche({ id }) {
  const nav = useNavigate()
  const notifier = useNotif()
  const differer = useDifferer()
  const [x, setX] = useState(() => enCache('cate.lire', { id }) || null)   // affichage instantané (dernière copie)
  const [v, setV] = useState(() => enCache('cate.lire', { id }) || null)
  const [erreur, setErreur] = useState(null)
  const [occupe, setOccupe] = useState('')
  const listes = useCharger(() => api('cate.reglages'), [])
  useEffect(() => { api('cate.lire', { id }).then((r) => { setX(r); setV(r) }).catch(setErreur) }, [id])
  if (erreur) return <Erreur erreur={erreur} />
  if (!x || !v) return <Chargement />
  const groupes = listes.data?.groupes || ['Maternelle-CP', 'CE1-CE2', 'CM1-CM2', '6e-5e', '4e-3e', 'Lycéens']
  const modes = listes.data?.modes || ['Espèces', 'Chèque', 'Virement']
  const modifie = [...CHAMPS_ENFANT, ...CHAMPS_FAMILLE, ['groupe'], ['notes'], ['annee']].some(([k]) => (v[k] || '') !== (x[k] || ''))

  async function enregistrer(modif) {
    setOccupe('enreg')
    try { const r = await api('cate.modifier', { id, ...modif }); setX(r); setV((w) => ({ ...w, ...r, ...Object.fromEntries(Object.keys(modif).map((k) => [k, r[k]])) })); notifier('Enregistré') }
    catch (err) { notifier(err.message, 'erreur') } finally { setOccupe('') }
  }
  async function creerDossier(type) {
    setOccupe(type)
    try { const r = await api('cate.dossier', { id, type }); setX(r.inscription); notifier(`Dossier « ${TYPES[type].nom} » créé`) }
    catch (err) { notifier(err.message, 'erreur') } finally { setOccupe('') }
  }
  function supprimer() {
    nav('/catechisme')
    differer(`Inscription de ${x.prenoms} ${x.nom} supprimée`, () => api('cate.supprimer', { id }), { ids: [id], onAnnule: () => nav(`/catechisme/${id}`) })
  }
  const champ = ([k, l, type = 'text']) => (
    <div key={k}><label className="etiquette">{l}</label><input className="champ" type={type} value={v[k] || ''} onChange={(ev) => setV({ ...v, [k]: ev.target.value })} /></div>
  )
  const bap = x.bapteme || {}
  const faits = x.demandes.map((d) => d.type)

  return (
    <>
      <Link to={`/catechisme?annee=${x.annee}`} className="mb-3 inline-flex items-center gap-1 text-sm text-nuit-600 hover:underline"><ArrowLeft className="h-4 w-4" />Catéchisme</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap gap-1.5"><span className="pastille bg-or text-white">{x.annee}</span>{x.groupe && <span className="pastille border border-or text-or-600">{x.groupe}</span>}</div>
          <h1 className="text-3xl font-semibold">{x.prenoms} {String(x.nom).toUpperCase()}</h1>
          <p className="text-xs text-nuit-600/70">Inscrit le {dateCourte(x.cree_le)} · {x.source}</p>
        </div>
        <button className="btn-clair text-red-700" onClick={supprimer}><Trash2 className="h-4 w-4" />Supprimer</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="carte p-5">
            <h2 className="mb-3 text-xl font-semibold">Enfant</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {CHAMPS_ENFANT.map(champ)}
              <div><label className="etiquette">Groupe</label><select className="champ" value={v.groupe || ''} onChange={(ev) => setV({ ...v, groupe: ev.target.value })}><option value="">—</option>{groupes.map((g) => <option key={g}>{g}</option>)}</select></div>
              {champ(['annee', 'Année scolaire'])}
            </div>
            <h2 className="mb-3 mt-5 text-xl font-semibold">Famille</h2>
            <div className="grid gap-3 sm:grid-cols-2">{CHAMPS_FAMILLE.map(champ)}</div>
            <div className="mt-3"><label className="etiquette">Notes</label><textarea className="champ min-h-[70px]" value={v.notes || ''} onChange={(ev) => setV({ ...v, notes: ev.target.value })} /></div>
            <button className="btn-principal mt-3" disabled={!modifie || occupe === 'enreg'} onClick={() => enregistrer(Object.fromEntries([...CHAMPS_ENFANT, ...CHAMPS_FAMILLE, ['groupe'], ['notes'], ['annee']].map(([k]) => [k, v[k] || ''])))}>
              {occupe === 'enreg' && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
          </section>

          <section className="carte p-5">
            <h2 className="mb-2 text-xl font-semibold">Baptême</h2>
            {bap.ou || bap.date || bap.lieu || bap.certificat ? (
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[160px_1fr]">
                {bap.ou && <><dt className="text-nuit-600/70">Baptisé(e)</dt><dd>{bap.ou}</dd></>}
                {bap.date && <><dt className="text-nuit-600/70">Date</dt><dd>{dateCourte(bap.date)}</dd></>}
                {bap.lieu && <><dt className="text-nuit-600/70">Lieu</dt><dd>{bap.lieu}</dd></>}
                {bap.certificat && <><dt className="text-nuit-600/70">Certificat</dt><dd><a className="inline-flex items-center gap-1 text-or-600 hover:underline" href={bap.certificat} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />Fichier joint au formulaire</a></dd></>}
              </dl>
            ) : <p className="text-sm text-nuit-600/70">Pas d'information sur le baptême.</p>}
          </section>
        </div>

        <div className="space-y-5">
          <section className="carte p-5">
            <h2 className="mb-1 text-xl font-semibold">Sacrements</h2>
            <p className="mb-3 text-xs text-nuit-600/70">Demande : {x.sacrement || 'aucun sacrement particulier'}</p>
            <div className="space-y-2">
              {x.demandes.map((d) => (
                <Link key={d.type} to={`/dossiers/${d.dossier_id}`} className="flex items-center gap-2 rounded-lg border border-nuit-100 p-2.5 text-sm hover:bg-nuit-50/60">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPES[d.type]?.couleur }} /><span className="flex-1">{TYPES[d.type]?.nom}</span><span className="text-xs text-or-600">Ouvrir le dossier →</span>
                </Link>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {DEMANDES_CATE.filter((t) => !faits.includes(t)).map((t) => (
                <button key={t} className="btn-clair px-2.5 py-1 text-xs" disabled={!!occupe} onClick={() => creerDossier(t)}>{occupe === t ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}{TYPES[t].nom}</button>
              ))}
            </div>
          </section>
          <Finances x={x} modes={modes} onMaj={(r) => { setX(r); setV((w) => ({ ...w, manuels: r.manuels, cotisation: r.cotisation, paiements: r.paiements })) }} />
        </div>
      </div>
    </>
  )
}

function Finances({ x, modes, onMaj }) {
  const notifier = useNotif()
  const [manuels, setManuels] = useState(x.manuels)
  const [cotisation, setCotisation] = useState(String(x.cotisation ?? 0))
  const [p, setP] = useState({ montant: '', mode: modes[0], date: new Date().toISOString().slice(0, 10) })
  const [occupe, setOccupe] = useState(false)
  useEffect(() => { setManuels(x.manuels); setCotisation(String(x.cotisation ?? 0)) }, [x.manuels, x.cotisation])
  const modifie = JSON.stringify(manuels) !== JSON.stringify(x.manuels) || Number(String(cotisation).replace(',', '.')) !== Number(x.cotisation)

  async function appel(action, donnees, msg) {
    setOccupe(true)
    try { onMaj(await api(action, { id: x.id, ...donnees })); notifier(msg) } catch (err) { notifier(err.message, 'erreur') } finally { setOccupe(false) }
  }
  const majManuel = (i, k, val) => setManuels(manuels.map((m, j) => (j === i ? { ...m, [k]: val } : m)))

  return (
    <section className="carte p-5">
      <h2 className="mb-3 text-xl font-semibold">Manuels et paiements</h2>
      <div className="space-y-2">
        {manuels.map((m, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1.5" checked={!!m.remis} title="Remis" onChange={(ev) => majManuel(i, 'remis', ev.target.checked)} />
            <input className="champ flex-1 py-1 text-xs" value={m.libelle} onChange={(ev) => majManuel(i, 'libelle', ev.target.value)} />
            <input className="champ w-20 py-1 text-right text-xs" value={m.prix} onChange={(ev) => majManuel(i, 'prix', ev.target.value)} />
            <button className="btn-icone p-1 text-red-700" onClick={() => setManuels(manuels.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {!manuels.length && <p className="text-xs text-nuit-600/70">Aucun manuel commandé.</p>}
        <button className="text-xs text-or-600 hover:underline" onClick={() => setManuels([...manuels, { libelle: '', prix: 0, remis: false }])}><Plus className="mr-0.5 inline h-3 w-3" />Ajouter un manuel</button>
        <p className="text-[11px] text-nuit-600/60">Case cochée = manuel remis à la famille.</p>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm"><span className="flex-1">Cotisation d'inscription</span><input className="champ w-24 py-1 text-right" value={cotisation} onChange={(ev) => setCotisation(ev.target.value)} /> €</div>
      {modifie && <button className="btn-principal mt-2 w-full" disabled={occupe} onClick={() => appel('cate.modifier', { manuels, cotisation }, 'Enregistré')}>Enregistrer manuels et cotisation</button>}

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-nuit-50/60 p-3 text-center">
        <div><div className="font-semibold">{euros(x.du)}</div><div className="text-[11px] text-nuit-600/70">Dû</div></div>
        <div><div className="font-semibold text-emerald-700">{euros(x.paye)}</div><div className="text-[11px] text-nuit-600/70">Payé</div></div>
        <div><div className={`font-semibold ${x.reste > 0 ? 'text-amber-800' : ''}`}>{euros(x.reste)}</div><div className="text-[11px] text-nuit-600/70">Reste</div></div>
      </div>
      <ul className="mt-3 divide-y divide-nuit-50 text-sm">
        {x.paiements.map((y) => (
          <li key={y.id} className="flex items-center gap-2 py-1.5"><span className="w-24 text-xs text-nuit-600/70">{dateCourte(y.date)}</span><span className="flex-1">{euros(y.montant)} · {y.mode}</span>
            <button className="btn-icone p-1 text-red-700" title="Retirer" disabled={occupe} onClick={() => appel('cate.paiement', { retirer: y.id }, 'Paiement retiré')}><Trash2 className="h-3.5 w-3.5" /></button></li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-[1fr_1fr] gap-2">
        <input className="champ py-1.5" placeholder={x.reste > 0 ? `Montant (${x.reste})` : 'Montant'} value={p.montant} onChange={(ev) => setP({ ...p, montant: ev.target.value })} />
        <select className="champ py-1.5" value={p.mode} onChange={(ev) => setP({ ...p, mode: ev.target.value })}>{modes.map((m) => <option key={m}>{m}</option>)}</select>
        <input className="champ py-1.5" type="date" value={p.date} onChange={(ev) => setP({ ...p, date: ev.target.value })} />
        <button className="btn-or py-1.5" disabled={occupe || !(p.montant || x.reste > 0)} onClick={() => { appel('cate.paiement', { ajouter: { ...p, montant: p.montant || x.reste } }, 'Paiement enregistré'); setP({ ...p, montant: '' }) }}>
          {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}Encaisser</button>
      </div>
    </section>
  )
}

const STATUT_CMD = { en_attente: ['À payer', 'bg-amber-100 text-amber-900'], payee: ['Payée', 'bg-emerald-100 text-emerald-900'], annulee: ['Annulée', 'bg-nuit-100 text-nuit-600'] }

/** Boutique de livres : catalogue (titre, prix, groupe, stock) et commandes. */
function Livres() {
  const notifier = useNotif()
  const { data, chargement, erreur, setData } = useCharger(() => api('livres.liste'), [], ['livres.liste', {}])
  const [cat, setCat] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [filtre, setFiltre] = useState('en_attente')
  const [ouverte, setOuverte] = useState(null)
  useEffect(() => { if (data && !cat) setCat(data.livres.map((l) => ({ ...l, stock: l.stock == null ? '' : l.stock }))) }, [data, cat])
  if (!data) return chargement ? <Chargement /> : <Erreur erreur={erreur} />
  async function enregistrer() {
    setEnvoi(true)
    try { const r = await api('livres.catalogue', { livres: cat }); setData(r); setCat(r.livres.map((l) => ({ ...l, stock: l.stock == null ? '' : l.stock }))); notifier('Catalogue enregistré') } catch (err) { notifier(err.message, 'erreur') } finally { setEnvoi(false) }
  }
  const maj = (i, k, v) => setCat((c) => c.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const cmds = data.commandes.filter((c) => (filtre === 'a_remettre' ? c.statut === 'payee' && !c.remis : !filtre || c.statut === filtre))
  const copier = () => navigator.clipboard?.writeText(data.lien_boutique).then(() => notifier('Lien copié'), () => notifier('Copie impossible', 'erreur'))
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-semibold">Livres du catéchisme</h1><p className="text-sm text-nuit-600/80">Boutique : catalogue et commandes{data.en_ligne ? ' · paiement en ligne actif' : ' · paiement en ligne non activé (Réglages → Paiements en ligne)'}</p></div>
        <div className="flex gap-2"><input className="champ w-72 py-1.5 text-xs" readOnly value={data.lien_boutique} onFocus={(ev) => ev.target.select()} /><button className="btn-clair" onClick={copier}>Copier le lien</button></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="carte p-4">
          <h2 className="mb-2 text-lg font-semibold">Catalogue</h2>
          {cat?.map((l, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_70px_110px_70px_auto] items-center gap-1.5">
              <input className="champ py-1.5" placeholder="Titre" value={l.titre} onChange={(ev) => maj(i, 'titre', ev.target.value)} />
              <input className="champ py-1.5" inputMode="decimal" placeholder="€" value={l.prix} onChange={(ev) => maj(i, 'prix', ev.target.value)} />
              <select className="champ py-1.5 text-xs" value={l.groupe || ''} onChange={(ev) => maj(i, 'groupe', ev.target.value)}><option value="">Tous</option>{data.groupes.map((g) => <option key={g}>{g}</option>)}</select>
              <input className="champ py-1.5" inputMode="numeric" placeholder="Stock" title="Stock (vide = illimité)" value={l.stock} onChange={(ev) => maj(i, 'stock', ev.target.value)} />
              <button className="btn-icone p-1 text-red-700" onClick={() => setCat((c) => c.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button className="btn-clair py-1 text-xs" onClick={() => setCat((c) => [...c, { titre: '', prix: '', groupe: '', stock: '' }])}><Plus className="h-3.5 w-3.5" />Ajouter un livre</button>
            <button className="btn-principal py-1 text-xs" disabled={envoi} onClick={enregistrer}>{envoi && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Enregistrer le catalogue</button>
          </div>
          <p className="mt-2 text-xs text-nuit-600/70">Stock vide = illimité. Le stock baisse quand une commande est payée ; à 0, le livre est « épuisé » dans la boutique. Les livres choisis dans le formulaire d'inscription sont reconnus par leur titre.</p>
        </div>
        <div className="carte p-4">
          <div className="mb-2 flex flex-wrap items-center gap-1.5"><h2 className="mr-auto text-lg font-semibold">Commandes</h2>
            {[['en_attente', 'À payer'], ['a_remettre', 'À remettre'], ['payee', 'Payées'], ['', 'Toutes']].map(([k, l]) => (
              <button key={k} className={`pastille border ${filtre === k ? 'border-or bg-or text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} onClick={() => setFiltre(k)}>{l}</button>))}</div>
          {!cmds.length ? <Vide icone={BookOpen} texte="Aucune commande ici." /> : (
            <ul className="divide-y divide-nuit-100">{cmds.map((c) => (
              <li key={c.id}><button className="grid w-full grid-cols-[1fr_auto] gap-2 py-2.5 text-left text-sm hover:bg-nuit-50/50" onClick={() => setOuverte(c)}>
                <span><span className="font-medium">{c.nom}</span> <span className="text-xs text-nuit-600/60">· {dateCourte(c.cree_le)} · {c.source}</span>
                  <span className="block text-xs text-nuit-600/80">{c.lignes.map((l) => l.titre + (l.qte > 1 ? ' ×' + l.qte : '')).join(', ')}</span></span>
                <span className="text-right"><span className="block font-medium">{euros(c.total)}</span><span className={`pastille py-0 text-[10px] ${STATUT_CMD[c.statut]?.[1]}`}>{STATUT_CMD[c.statut]?.[0]}</span>{c.remis && <span className="pastille ml-1 bg-sky-100 py-0 text-[10px] text-sky-900">remis</span>}</span>
              </button></li>))}</ul>
          )}
        </div>
      </div>
      {ouverte && <Commande c={ouverte} onFermer={() => setOuverte(null)} onMaj={(r) => { setData(r); setOuverte(r.commandes.find((x) => x.id === ouverte.id)) }} />}
    </>
  )
}

function Commande({ c, onFermer, onMaj }) {
  const notifier = useNotif()
  const [p, setP] = useState({ montant: c.reste > 0 ? String(c.reste) : '', mode: 'Chèque' })
  const [occupe, setOccupe] = useState(false)
  async function action(params, msg) {
    setOccupe(true)
    try { onMaj(await api('livres.commande', { id: c.id, ...params })); if (msg) notifier(msg) } catch (err) { notifier(err.message, 'erreur') } finally { setOccupe(false) }
  }
  return (
    <Modale titre={`Commande de ${c.nom}`} onFermer={onFermer}
      pied={<>{c.statut !== 'annulee' ? <button className="btn-clair mr-auto text-red-700" disabled={occupe} onClick={() => action({ statut: 'annulee' }, 'Commande annulée')}>Annuler la commande</button>
        : <button className="btn-clair mr-auto" disabled={occupe} onClick={() => action({ statut: 'en_attente' }, 'Commande rétablie')}>Rétablir</button>}
        <button className="btn-principal" onClick={onFermer}>Fermer</button></>}>
      <p className="text-sm text-nuit-600">{c.email}{c.telephone ? ' · ' + c.telephone : ''} · {c.source}{c.note ? ' · ' + c.note : ''}</p>
      <div className="my-3 rounded-xl bg-nuit-50/60 p-3 text-sm">
        {c.lignes.map((l, i) => <div key={i} className="flex justify-between"><span>{l.titre}{l.qte > 1 ? ' × ' + l.qte : ''}{l.pour ? ` (${l.pour})` : ''}</span><span>{euros(l.prix * l.qte)}</span></div>)}
        <div className="mt-1 flex justify-between border-t border-nuit-100 pt-1 font-semibold"><span>Total</span><span>{euros(c.total)}</span></div>
        <div className="flex justify-between text-or-600"><span>Reste</span><span>{euros(c.reste)}</span></div>
      </div>
      <label className="flex items-center gap-3 text-sm"><Interrupteur actif={c.remis} onChange={(v) => action({ remis: v }, v ? 'Livres remis' : 'Marqué non remis')} />Livres remis</label>
      <h3 className="etiquette mt-4">Paiements</h3>
      {!c.paiements.length ? <p className="text-sm text-nuit-600/70">Aucun.</p> : c.paiements.map((q) => (
        <div key={q.id} className="flex items-center gap-2 border-b border-nuit-100 py-1.5 text-sm"><span className="flex-1">{dateCourte(q.date)} · {q.mode} · {q.par}</span><span className="font-medium">{euros(q.montant)}</span>
          {q.mode !== 'HelloAsso' && <button className="btn-icone p-1 text-red-700" disabled={occupe} onClick={() => action({ retirer: q.id }, 'Paiement retiré')}><Trash2 className="h-3.5 w-3.5" /></button>}</div>))}
      {c.reste > 0 && c.statut !== 'annulee' && <div className="mt-3 flex flex-wrap items-center gap-2">
        <input className="champ w-24" inputMode="decimal" value={p.montant} onChange={(ev) => setP({ ...p, montant: ev.target.value })} />
        {['Espèces', 'Chèque', 'Virement'].map((m) => <button key={m} className={`pastille border ${p.mode === m ? 'border-or bg-or text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} onClick={() => setP({ ...p, mode: m })}>{m}</button>)}
        <button className="btn-or" disabled={occupe || !Number(String(p.montant).replace(',', '.'))} onClick={() => action({ ajouter: { montant: String(p.montant).replace(',', '.'), mode: p.mode } }, 'Paiement enregistré')}><Wallet className="h-4 w-4" />Enregistrer</button>
      </div>}
      {c.reste > 0 && c.statut !== 'annulee' && <p className="mt-3 text-xs text-nuit-600/70">Lien de paiement en ligne de cette commande : <span className="break-all">{c.lien_paiement}</span></p>}
    </Modale>
  )
}
