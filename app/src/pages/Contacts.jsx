// Contacts de la paroisse (Google Contacts du compte paroisse, modifiés dans les deux sens).
// Liste, recherche, groupes (manuels et automatiques), fiche avec foyer et tout ce qui est relié, import du tableau, doublons, envois groupés.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Contact, Plus, Upload, Copy, Send, RefreshCw, Search, Mail, Phone, MessageSquare, MapPin, Home, Pencil, Trash2, Loader2, X, Users, Settings2, ArrowLeft, Link2, ChevronRight, Building2, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import { api } from '../api.js'
import { useApp } from '../App.jsx'
import { Chargement, Erreur, Vide, Modale, EnTete, Aide, useNotif, useDifferer, useCharger, useConfirmer, initiales, dateCourte, enSuppression, nb, pluriel, MenuPlusActions } from '../ui.jsx'
import { useSelection, BoutonSelection, Case, BarreSelection, MenuAction } from '../selection.jsx'
import { EnvoiContacts } from '../envoiContacts.jsx'
import { Redaction } from './Courrier.jsx'
import { lireFichierContacts, preparerImport, versLignes, lots } from '../importContacts.js'

const sa = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const nomContact = (c) => [c.civilite, c.prenom, String(c.nom || '').toUpperCase()].filter(Boolean).join(' ') || c.organisation || '(sans nom)'
const telLien = (t) => String(t).replace(/[^\d+]/g, '')

export default function Contacts() {
  const { id } = useParams()
  const charge = useCharger(() => api('contacts.liste'), [], ['contacts.liste', {}])
  if (id) return <FicheContact id={id} liste={charge.data} onChange={charge.recharger} />
  return <ListeContacts {...charge} />
}

// ─────────────────────────── Liste ───────────────────────────

function ListeContacts({ data, chargement, erreur, recharger, setData }) {
  const { ecrit } = useApp()
  const peutEcrire = ecrit('contacts')
  const notifier = useNotif()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [groupe, setGroupe] = useState(() => sessionStorage.getItem('contacts.groupe') || '')
  const [limite, setLimite] = useState(150)
  const [fenetre, setFenetre] = useState(null)   // 'nouveau' | 'import' | 'doublons' | 'groupes' | 'envoi' | { envoiIds } | { nouveauGroupe: ids }
  const [auto, setAuto] = useState(false)
  const s = useSelection()
  useEffect(() => { try { sessionStorage.setItem('contacts.groupe', groupe) } catch { /* ignore */ } }, [groupe])

  const contacts = (data?.contacts || []).filter((c) => !enSuppression.has(c.id))
  const groupes = data?.groupes || []
  const nomGroupe = (g) => groupes.find((x) => x.id === g)?.nom
  const filtres = useMemo(() => {
    const mots = sa(q).split(/\s+/).filter(Boolean)
    const chiffres = q.replace(/\D/g, '')
    return contacts.filter((c) => {
      if (groupe === 'sans-mail' && c.emails.length) return false
      if (groupe === 'sans-groupe' && c.groupes.length) return false
      if (groupe === 'foyers' && !c.foyer) return false
      if (groupe && groupe.startsWith('contactGroups/') && !c.groupes.includes(groupe)) return false
      if (!mots.length) return true
      const t = sa([c.prenom, c.nom, c.organisation, c.ville, ...c.emails].join(' '))
      if (chiffres.length >= 4 && c.tels.some((x) => x.replace(/\D/g, '').replace(/^33/, '0').includes(chiffres.replace(/^33/, '0')))) return true
      return mots.every((m) => t.includes(m))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, groupe])
  const gManuel = groupes.find((g) => g.id === groupe && !g.auto)

  async function majAuto() {
    setAuto(true)
    try {
      const r = await api('contacts.auto')
      notifier(`${nb(r.crees, 'contact créé', 'contacts créés')}, ${nb(r.completes, 'complété', 'complétés')} · groupes : ${nb(r.groupes.ajouts, 'ajout', 'ajouts')}, ${nb(r.groupes.retraits, 'retrait', 'retraits')}`)
      recharger()
    } catch (e) { notifier(e.message, 'erreur') } finally { setAuto(false) }
  }
  async function membres(action, g, ids) {
    try {
      const gs = await api('contacts.groupe', { action, id: g, ids })
      setData((d) => ({ ...d, groupes: gs, contacts: d.contacts.map((c) => (ids.includes(c.id) ? { ...c, groupes: action === 'ajouter' ? [...new Set([...c.groupes, g])] : c.groupes.filter((x) => x !== g) } : c)) }))
      notifier(`${nb(ids.length, 'contact', 'contacts')} ${action === 'ajouter' ? pluriel(ids.length, 'ajouté à', 'ajoutés à') : pluriel(ids.length, 'retiré de', 'retirés de')} « ${nomGroupe(g)} »`)
      s.vider()
    } catch (e) { notifier(e.message, 'erreur') }
  }
  async function foyer(ids) {
    try { await api('contacts.foyer', { ids, adresseCommune: true }); notifier('Foyer créé'); s.quitter(); recharger() } catch (e) { notifier(e.message, 'erreur') }
  }

  return (
    <>
      <EnTete titre="Contacts" sousTitre={data ? `${contacts.length} contacts · Google Contacts du compte paroisse` : 'Google Contacts du compte paroisse'}
        actions={<>
          {peutEcrire && <button className="btn-or" onClick={() => setFenetre('nouveau')}><Plus className="h-4 w-4" />Nouveau</button>}
          <button className="btn-clair" onClick={() => setFenetre('envoi')}><Send className="h-4 w-4" /><span className="hidden sm:inline">Envoi groupé</span></button>
          <BoutonSelection s={s} />
          <MenuPlusActions actions={peutEcrire && [
            { icone: Settings2, libelle: 'Groupes', onClick: () => setFenetre('groupes') },
            { icone: Copy, libelle: 'Doublons', onClick: () => setFenetre('doublons') },
            { icone: Upload, libelle: 'Importer', onClick: () => setFenetre('import') },
            { icone: auto ? Loader2 : RefreshCw, libelle: auto ? 'Mise à jour…' : 'Mettre à jour', onClick: majAuto, disabled: auto, aide: 'Créer les contacts manquants et mettre à jour les groupes automatiques (fait aussi toutes les heures)' }
          ]} />
        </>} />

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-nuit-600/75" />
          <input className="champ pl-9" value={q} onChange={(e) => { setQ(e.target.value); setLimite(150) }} placeholder="Nom, e-mail, téléphone, ville…" />
        </div>
        <select className="champ w-auto max-w-full" value={groupe} onChange={(e) => { setGroupe(e.target.value); setLimite(150) }}>
          <option value="">Tous les contacts</option>
          <option value="foyers">Membres d'un foyer</option>
          <option value="sans-mail">Sans e-mail</option>
          <option value="sans-groupe">Dans aucun groupe</option>
          <optgroup label="Groupes">{groupes.filter((g) => !g.auto).map((g) => <option key={g.id} value={g.id}>{g.nom} ({g.nb})</option>)}</optgroup>
          <optgroup label="Groupes automatiques">{groupes.filter((g) => g.auto).map((g) => <option key={g.id} value={g.id}>{g.nom} ({g.nb})</option>)}</optgroup>
        </select>
        {groupe.startsWith('contactGroups/') && <button className="btn-clair" onClick={() => setFenetre({ envoiGroupe: groupe })}><Send className="h-4 w-4" />Écrire au groupe</button>}
      </div>

      <Erreur erreur={erreur} reessayer={recharger} />
      {!data && chargement ? <Chargement /> : !filtres.length ? <Vide icone={Contact} texte={contacts.length ? 'Aucun contact ne correspond.' : 'Aucun contact pour l\'instant. Importez le tableau des contacts (bouton « Importer »).'} /> : (
        <div className="carte divide-y divide-nuit-50 overflow-hidden">
          {filtres.slice(0, limite).map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-nuit-50/50">
              <Case s={s} id={c.id} nom={nomContact(c)} />
              <Link to={`/contacts/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3" onClick={(e) => { if (s.actif) { e.preventDefault(); s.basculer(c.id) } }}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-or-50 text-xs font-semibold text-or-600">{c.prenom || c.nom ? initiales(c.prenom + ' ' + c.nom) : <Building2 className="h-4 w-4" />}</span>
                <div className="min-w-0 flex-1 md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)] md:items-center md:gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{nomContact(c)}{c.foyer && <Home className="ml-1.5 inline h-3.5 w-3.5 text-or" aria-label="Foyer" />}</div>
                    {c.organisation && (c.prenom || c.nom) && <div className="truncate text-xs text-nuit-600/70">{c.organisation}</div>}
                  </div>
                  <div className="truncate text-sm text-nuit-600">{c.emails[0] || <span className="text-nuit-600/40">—</span>}{c.emails.length > 1 && <span className="text-xs text-nuit-600/75"> +{c.emails.length - 1}</span>}</div>
                  <div className="truncate text-sm text-nuit-600">{c.tels[0] || ''}{c.ville && <span className="text-xs text-nuit-600/75">{c.tels[0] ? ' · ' : ''}{c.ville}</span>}</div>
                </div>
                <div className="hidden w-[230px] shrink-0 flex-wrap justify-end gap-1 overflow-hidden xl:flex">
                  {c.groupes.slice(0, 2).map((g) => nomGroupe(g) && <span key={g} className="pastille max-w-[140px] truncate bg-nuit-50 text-nuit-600">{nomGroupe(g)}</span>)}
                  {c.groupes.length > 2 && <span className="pastille bg-nuit-50 text-nuit-600">+{c.groupes.length - 2}</span>}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-nuit-600/30" />
              </Link>
            </div>
          ))}
          {filtres.length > limite && <button className="w-full py-3 text-sm text-or-600 hover:bg-or-50" onClick={() => setLimite(limite + 300)}>Afficher plus ({filtres.length - limite} de plus)</button>}
        </div>
      )}

      <BarreSelection s={s} tous={filtres.map((c) => c.id)}>
        <button className="btn-clair py-1.5 text-xs" onClick={() => setFenetre({ envoiIds: s.ids() })}><Send className="h-3.5 w-3.5" />Écrire</button>
        {peutEcrire && <MenuAction libelle="Ajouter au groupe…" choix={[...groupes.filter((g) => !g.auto).map((g) => [g.id, g.nom]), ['__nouveau', '+ Nouveau groupe…']]}
          onChoix={(g) => (g === '__nouveau' ? setFenetre({ nouveauGroupe: s.ids() }) : membres('ajouter', g, s.ids()))} />}
        {peutEcrire && gManuel && <button className="btn-clair py-1.5 text-xs" onClick={() => membres('retirer', gManuel.id, s.ids())}>Retirer de « {gManuel.nom} »</button>}
        {peutEcrire && s.n >= 2 && s.n <= 8 && <button className="btn-clair py-1.5 text-xs" onClick={() => foyer(s.ids())}><Home className="h-3.5 w-3.5" />Relier en foyer</button>}
      </BarreSelection>

      {fenetre === 'nouveau' && <EditionContact groupes={groupes} onFermer={() => setFenetre(null)} onEnregistre={(c) => { setFenetre(null); recharger(); nav(`/contacts/${c.id}`) }} />}
      {fenetre === 'import' && <ImportContacts onFermer={() => setFenetre(null)} onFini={recharger} />}
      {fenetre === 'doublons' && <Doublons onFermer={() => { setFenetre(null); recharger() }} />}
      {fenetre === 'groupes' && <GererGroupes groupes={groupes} onFermer={() => setFenetre(null)} onChange={(gs) => setData((d) => ({ ...d, groupes: gs }))} />}
      {fenetre === 'envoi' && <EnvoiContacts onFermer={() => setFenetre(null)} />}
      {fenetre?.envoiGroupe && <EnvoiContacts groupe={fenetre.envoiGroupe} onFermer={() => setFenetre(null)} />}
      {fenetre?.envoiIds && <EnvoiContacts ids={fenetre.envoiIds} onFermer={() => setFenetre(null)} />}
      {fenetre?.nouveauGroupe && <NomGroupe onFermer={() => setFenetre(null)} onValider={async (nom) => {
        const gs = await api('contacts.groupe', { action: 'creer', nom, ids: fenetre.nouveauGroupe })
        setFenetre(null); notifier(`Groupe « ${nom} » créé`); s.quitter(); setData((d) => ({ ...d, groupes: gs })); recharger()
      }} />}
    </>
  )
}

function NomGroupe({ initial = '', titre = 'Nouveau groupe', onFermer, onValider }) {
  const [nom, setNom] = useState(initial)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const valider = async () => { setEnvoi(true); setErreur(null); try { await onValider(nom.trim()) } catch (e) { setErreur(e); setEnvoi(false) } }
  return (
    <Modale titre={titre} onFermer={onFermer} pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={!nom.trim() || envoi} onClick={valider}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button></>}>
      <label className="etiquette">Nom du groupe</label>
      <input className="champ" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && nom.trim() && valider()} placeholder="ex. Chorale, Conseil de fabrique…" />
      <div className="mt-3"><Erreur erreur={erreur} /></div>
    </Modale>
  )
}

function GererGroupes({ groupes, onFermer, onChange }) {
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const [edition, setEdition] = useState(null)   // { id?, nom }
  const manuels = groupes.filter((g) => !g.auto), autos = groupes.filter((g) => g.auto)
  async function supprimer(g) {
    if (!(await confirmer({ titre: 'Supprimer le groupe', texte: `Le groupe « ${g.nom} » sera supprimé de Google Contacts. Les ${g.nb} contacts restent.`, bouton: 'Supprimer', danger: true }))) return
    try { onChange(await api('contacts.groupe', { action: 'supprimer', id: g.id })); notifier('Groupe supprimé') } catch (e) { notifier(e.message, 'erreur') }
  }
  return (
    <Modale large titre="Groupes de contacts" onFermer={onFermer} pied={<><button className="btn-clair" onClick={() => setEdition({ nom: '' })}><Plus className="h-4 w-4" />Nouveau groupe</button><button className="btn-principal" onClick={onFermer}>Fermer</button></>}>
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 font-semibold">Groupes</h3>
          {!manuels.length ? <p className="text-sm text-nuit-600/70">Aucun groupe pour l'instant. Sélectionnez des contacts dans la liste puis « Ajouter au groupe… », ou créez un groupe ici.</p> : (
            <ul className="divide-y divide-nuit-50 rounded-lg border border-nuit-100">
              {manuels.map((g) => <li key={g.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-1">{g.nom} <span className="text-nuit-600/75">({g.nb})</span></span>
                <button className="btn-icone" title="Renommer" onClick={() => setEdition(g)}><Pencil className="h-4 w-4" /></button>
                <button className="btn-icone" title="Supprimer" onClick={() => supprimer(g)}><Trash2 className="h-4 w-4" /></button>
              </li>)}
            </ul>)}
        </section>
        <section>
          <h3 className="mb-1 flex items-center gap-2 font-semibold">Groupes automatiques <Aide>Tenus à jour par l'appli toutes les heures, d'après le catéchisme, Cor Unum, le catéchuménat et les dossiers (baptêmes, premières communions, professions de foi, confirmations, mariages). Un groupe vide est supprimé ; les contacts restent.</Aide></h3>
          {!autos.length ? <p className="text-sm text-nuit-600/70">Ils apparaîtront à la première mise à jour (bouton « Mettre à jour »).</p>
            : <div className="flex flex-wrap gap-1.5">{autos.map((g) => <span key={g.id} className="pastille bg-nuit-50 text-nuit-600">{g.nom} ({g.nb})</span>)}</div>}
        </section>
      </div>
      {edition && <NomGroupe titre={edition.id ? 'Renommer le groupe' : 'Nouveau groupe'} initial={edition.nom} onFermer={() => setEdition(null)} onValider={async (nom) => {
        onChange(await api('contacts.groupe', edition.id ? { action: 'renommer', id: edition.id, nom } : { action: 'creer', nom }))
        setEdition(null); notifier(edition.id ? 'Groupe renommé' : 'Groupe créé')
      }} />}
    </Modale>
  )
}

// ─────────────────────────── Fiche ───────────────────────────

function FicheContact({ id, liste, onChange }) {
  const { ecrit, peut } = useApp()
  const peutEcrire = ecrit('contacts')
  const nav = useNavigate()
  const notifier = useNotif()
  const differer = useDifferer()
  const { data: c, chargement, erreur, recharger, setData } = useCharger(() => api('contacts.lire', { id }), [id], ['contacts.lire', { id }])
  const [edition, setEdition] = useState(false)
  const [ecrire, setEcrire] = useState(null)
  const [choixFoyer, setChoixFoyer] = useState(false)
  const groupes = liste?.groupes || []
  if (!c) return chargement ? <Chargement /> : <><Retour /><Erreur erreur={erreur} reessayer={recharger} /></>
  const nomGroupe = (g) => groupes.find((x) => x.id === g)
  const apres = (x) => { setData(x); onChange() }

  async function groupeAction(action, g) {
    try {
      await api('contacts.groupe', { action, id: g, ids: [c.id] })
      setData((x) => ({ ...x, groupes: action === 'ajouter' ? [...x.groupes, g] : x.groupes.filter((y) => y !== g) })); onChange()
    } catch (e) { notifier(e.message, 'erreur') }
  }
  function supprimer() {
    differer(`${nomContact(c)} supprimé(e) de Google Contacts`, () => api('contacts.supprimer', { id: c.id }).then(onChange), { ids: [c.id] })
    nav('/contacts')
  }
  async function quitterFoyer() {
    try { apres(await api('contacts.foyer', { retirer: c.id })); notifier('Retiré(e) du foyer') } catch (e) { notifier(e.message, 'erreur') }
  }
  const manuels = groupes.filter((g) => !g.auto && !c.groupes.includes(g.id))

  return (
    <>
      <Retour />
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-or-50 text-lg font-semibold text-or-600">{c.prenom || c.nom ? initiales(c.prenom + ' ' + c.nom) : <Building2 className="h-6 w-6" />}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold leading-tight">{nomContact(c)}</h1>
          {c.organisation && (c.prenom || c.nom) && <div className="text-sm text-nuit-600/80">{c.organisation}</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          {c.emails[0] && peut('mail') && <button className="btn-principal" onClick={() => setEcrire(c.emails[0])}><Mail className="h-4 w-4" />Écrire</button>}
          {peutEcrire && <button className="btn-clair" onClick={() => setEdition(true)}><Pencil className="h-4 w-4" />Modifier</button>}
          {peutEcrire && <button className="btn-clair text-red-700" onClick={supprimer} title="Supprimer de Google Contacts"><Trash2 className="h-4 w-4" /></button>}
        </div>
      </div>
      <Erreur erreur={erreur} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="carte space-y-3 p-5">
          <h2 className="text-lg font-semibold">Coordonnées</h2>
          {!c.emails.length && !c.tels.length && !c.adresse && <p className="text-sm text-nuit-600/75">Aucune coordonnée.</p>}
          {c.emails.map((m) => <div key={m} className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-nuit-600/75" />
            {peut('mail') ? <button className="text-left text-or-600 hover:underline" onClick={() => setEcrire(m)}>{m}</button> : <a href={`mailto:${m}`} className="text-or-600 hover:underline">{m}</a>}</div>)}
          {c.tels.map((t) => <div key={t} className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-nuit-600/75" />
            <a href={`tel:${telLien(t)}`} className="text-or-600 hover:underline">{t}</a>
            <a href={`sms:${telLien(t)}`} className="btn-icone p-1" title="SMS"><MessageSquare className="h-3.5 w-3.5" /></a></div>)}
          {c.adresse && <div className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 text-nuit-600/75" />
            <a className="hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.adresse.rue, c.adresse.cp, c.adresse.ville].join(' '))}`}>
              {c.adresse.rue}{(c.adresse.cp || c.adresse.ville) && <><br />{c.adresse.cp} {c.adresse.ville}</>}</a></div>}
          {c.note && <p className="whitespace-pre-line rounded-lg bg-nuit-50/60 p-3 text-sm">{c.note}</p>}
          <p className="pt-1 text-xs text-nuit-600/75">{c.origine && <>Origine : {c.origine} · </>}{c.maj_le && <>modifié le {dateCourte(c.maj_le)}</>}</p>
        </section>

        <section className="carte space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Home className="h-5 w-5 text-or" />Foyer</h2>
          {c.foyer_membres.length ? <ul className="space-y-1">{c.foyer_membres.map((m) => <li key={m.id}><Link className="text-sm text-or-600 hover:underline" to={`/contacts/${m.id}`}>{nomContact(m)}</Link></li>)}</ul>
            : <p className="text-sm text-nuit-600/75">Pas de foyer.</p>}
          {peutEcrire && <div className="flex flex-wrap gap-2">
            <button className="btn-clair py-1.5 text-xs" onClick={() => setChoixFoyer(true)}><Link2 className="h-3.5 w-3.5" />{c.foyer ? 'Ajouter une personne' : 'Relier à une personne'}</button>
            {c.foyer && <button className="btn-clair py-1.5 text-xs" onClick={quitterFoyer}>Quitter le foyer</button>}
          </div>}

          <h2 className="flex items-center gap-2 pt-2 text-lg font-semibold"><Users className="h-5 w-5 text-or" />Groupes</h2>
          <div className="flex flex-wrap gap-1.5">
            {!c.groupes.length && <span className="text-sm text-nuit-600/75">Dans aucun groupe.</span>}
            {c.groupes.map((g) => { const x = nomGroupe(g); if (!x) return null
              return <span key={g} className={`pastille gap-1 ${x.auto ? 'bg-nuit-50 text-nuit-600' : 'bg-or-50 text-or-600'}`} title={x.auto ? 'Groupe automatique' : ''}>{x.nom}
                {!x.auto && peutEcrire && <button onClick={() => groupeAction('retirer', g)} aria-label="Retirer du groupe"><X className="h-3 w-3" /></button>}</span> })}
          </div>
          {peutEcrire && manuels.length > 0 && <MenuAction libelle="Ajouter à un groupe…" choix={manuels.map((g) => [g.id, g.nom])} onChoix={(g) => groupeAction('ajouter', g)} />}
        </section>
      </div>

      <section className="carte mt-4 p-5">
        <h2 className="mb-3 text-lg font-semibold">Dans l'appli</h2>
        {!c.liens.length ? <p className="text-sm text-nuit-600/75">Rien de relié (dossier, catéchisme, Cor Unum, retraite, app des paroissiens) avec ces coordonnées.</p> : (
          <ul className="divide-y divide-nuit-50">
            {c.liens.map((l, i) => <li key={i}><Link to={l.lien} className="flex items-center gap-3 py-2 text-sm hover:bg-nuit-50/50">
              <span className="pastille w-28 shrink-0 justify-center bg-or-50 text-or-600">{l.sorte}</span>
              <span className="min-w-0 flex-1 truncate">{l.libelle}</span>
              <span className="shrink-0 text-xs text-nuit-600/75">{l.detail}</span><ChevronRight className="h-4 w-4 text-nuit-600/30" />
            </Link></li>)}
          </ul>)}
      </section>

      {edition && <EditionContact contact={c} groupes={groupes} onFermer={() => setEdition(false)} onEnregistre={(x) => { setEdition(false); apres(x); notifier('Contact enregistré') }} />}
      {ecrire && <Redaction mode="nouveau" a={ecrire} onFermer={() => setEcrire(null)} onEnvoye={() => { setEcrire(null); notifier('Message envoyé') }} />}
      {choixFoyer && <ChoisirContact titre="Relier au foyer" exclure={[c.id, ...c.foyer_membres.map((m) => m.id)]} contacts={liste?.contacts || []} onFermer={() => setChoixFoyer(false)}
        onChoix={async (autre) => {
          setChoixFoyer(false)
          try { await api('contacts.foyer', { ids: [c.id, autre.id], adresseCommune: !!c.adresse || !!autre.ville }); recharger(); onChange(); notifier('Foyer mis à jour') } catch (e) { notifier(e.message, 'erreur') }
        }} />}
    </>
  )
}
const Retour = () => <Link to="/contacts" className="mb-3 inline-flex items-center gap-1 text-sm text-nuit-600 hover:text-nuit"><ArrowLeft className="h-4 w-4" />Contacts</Link>

function ChoisirContact({ titre, contacts, exclure = [], onFermer, onChoix }) {
  const [q, setQ] = useState('')
  const mots = sa(q).split(/\s+/).filter(Boolean)
  const l = mots.length ? contacts.filter((c) => !exclure.includes(c.id) && mots.every((m) => sa([c.prenom, c.nom, c.organisation, ...c.emails].join(' ')).includes(m))).slice(0, 30) : []
  return (
    <Modale titre={titre} onFermer={onFermer}>
      <input className="champ" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une personne…" autoFocus />
      <ul className="mt-2 divide-y divide-nuit-50">
        {l.map((c) => <li key={c.id}><button className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm hover:bg-nuit-50" onClick={() => onChoix(c)}>
          <span>{nomContact(c)}</span><span className="truncate text-xs text-nuit-600/75">{c.emails[0] || c.tels[0] || ''}</span></button></li>)}
        {mots.length > 0 && !l.length && <li className="py-3 text-sm text-nuit-600/75">Personne trouvé.</li>}
      </ul>
    </Modale>
  )
}

// ─────────────────────────── Édition ───────────────────────────

function ListeChamps({ etiquette, valeurs, onChange, type = 'text', placeholder }) {
  const l = valeurs.length ? valeurs : ['']
  return (
    <div><label className="etiquette">{etiquette}</label>
      <div className="space-y-1.5">
        {l.map((v, i) => <div key={i} className="flex gap-1.5">
          <input className="champ" type={type} value={v} placeholder={placeholder} onChange={(e) => onChange(l.map((x, j) => (j === i ? e.target.value : x)))} />
          {l.length > 1 && <button className="btn-icone" onClick={() => onChange(l.filter((_, j) => j !== i))} aria-label="Retirer"><X className="h-4 w-4" /></button>}
        </div>)}
        <button className="text-xs text-or-600 hover:underline" onClick={() => onChange([...l, ''])}>+ Ajouter</button>
      </div></div>
  )
}

function EditionContact({ contact, groupes = [], onFermer, onEnregistre }) {
  const c = contact || {}
  const [f, setF] = useState({ civilite: c.civilite || '', prenom: c.prenom || '', nom: c.nom || '', organisation: c.organisation || '', emails: c.emails || [], tels: c.tels || [],
    adresse: { rue: c.adresse?.rue || '', cp: c.adresse?.cp || '', ville: c.adresse?.ville || '', pays: c.adresse?.pays || '' }, note: c.note || '', adresseFoyer: true, groupes: [] })
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const majA = (k) => (e) => setF({ ...f, adresse: { ...f.adresse, [k]: e.target.value } })
  async function enregistrer() {
    setEnvoi(true); setErreur(null)
    try { onEnregistre(await api('contacts.ecrire', { ...f, id: c.id, emails: f.emails.filter((x) => x.trim()), tels: f.tels.filter((x) => x.trim()) })) }
    catch (e) { setErreur(e); setEnvoi(false) }
  }
  return (
    <Modale large titre={c.id ? 'Modifier le contact' : 'Nouveau contact'} onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" onClick={enregistrer} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button></>}>
      <div className="grid gap-3 sm:grid-cols-[110px_1fr_1fr]">
        <div><label className="etiquette">Civilité</label><select className="champ" value={f.civilite} onChange={maj('civilite')}><option value="" />{['M.', 'Mme', 'Mlle', 'Abbé', 'Père', 'Sœur', 'Frère'].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className="etiquette">Prénom</label><input className="champ" value={f.prenom} onChange={maj('prenom')} autoFocus /></div>
        <div><label className="etiquette">Nom</label><input className="champ" value={f.nom} onChange={maj('nom')} /></div>
      </div>
      <div className="mt-3"><label className="etiquette">Organisation</label><input className="champ" value={f.organisation} onChange={maj('organisation')} placeholder="Mairie, école, paroisse…" /></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ListeChamps etiquette="E-mails" type="email" valeurs={f.emails} onChange={(v) => setF({ ...f, emails: v })} />
        <ListeChamps etiquette="Téléphones" type="tel" valeurs={f.tels} onChange={(v) => setF({ ...f, tels: v })} />
      </div>
      <div className="mt-3"><label className="etiquette">Adresse</label>
        <input className="champ" value={f.adresse.rue} onChange={majA('rue')} placeholder="N° et rue" />
        <div className="mt-1.5 grid grid-cols-[110px_1fr] gap-1.5"><input className="champ" value={f.adresse.cp} onChange={majA('cp')} placeholder="Code postal" /><input className="champ" value={f.adresse.ville} onChange={majA('ville')} placeholder="Ville" /></div>
        {c.foyer && c.foyer_membres?.length > 0 && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#521a22]" checked={f.adresseFoyer} onChange={(e) => setF({ ...f, adresseFoyer: e.target.checked })} />Même adresse pour tout le foyer ({c.foyer_membres.map((m) => m.prenom || nomContact(m)).join(', ')})</label>}
      </div>
      <div className="mt-3"><label className="etiquette">Note</label><textarea className="champ min-h-[70px]" value={f.note} onChange={maj('note')} /></div>
      {!c.id && groupes.some((g) => !g.auto) && <div className="mt-3"><label className="etiquette">Groupes</label>
        <div className="flex flex-wrap gap-1.5">{groupes.filter((g) => !g.auto).map((g) => { const on = f.groupes.includes(g.id)
          return <button key={g.id} className={`pastille border ${on ? 'border-or bg-or-50 text-or-600' : 'border-nuit-100 text-nuit-600'}`} onClick={() => setF({ ...f, groupes: on ? f.groupes.filter((x) => x !== g.id) : [...f.groupes, g.id] })}>{g.nom}</button> })}</div></div>}
      <p className="mt-3 text-xs text-nuit-600/75">Enregistré dans Google Contacts du compte paroisse. Les informations restent dans la paroisse (charte de confidentialité).</p>
      <div className="mt-2"><Erreur erreur={erreur} /></div>
    </Modale>
  )
}

// ─────────────────────────── Import ───────────────────────────

function ImportContacts({ onFermer, onFini }) {
  const [brutes, setBrutes] = useState(null)
  const [sansColmar, setSansColmar] = useState(true)
  const [prep, setPrep] = useState(null)
  const [comparaison, setComparaison] = useState(null)
  const [progres, setProgres] = useState(null)   // { fait, total, rapport }
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  useEffect(() => { if (brutes) { setPrep(preparerImport(brutes, { sansColmar })); setComparaison(null) } }, [brutes, sansColmar])
  async function lire(fichier) {
    setErreur(null); setEnvoi(true)
    try { setBrutes(await lireFichierContacts(fichier)) } catch (e) { setErreur(new Error('Fichier illisible : ' + e.message)) } finally { setEnvoi(false) }
  }
  const majFiche = (cle, fn) => { setPrep((p) => ({ ...p, fiches: p.fiches.map((x) => (x.cle === cle ? fn(x) : x)) })); setComparaison(null) }
  async function comparer() {
    setEnvoi(true); setErreur(null)
    try { setComparaison(await api('contacts.importer', { lignes: versLignes(prep.fiches), essai: true })) } catch (e) { setErreur(e) } finally { setEnvoi(false) }
  }
  async function importer() {
    setEnvoi(true); setErreur(null)
    const ls = lots(prep.fiches)
    const total = ls.reduce((a, l) => a + l.length, 0)
    const rapport = { crees: 0, completes: 0, identiques: 0 }
    let fait = 0
    setProgres({ fait, total, rapport })
    try {
      for (const l of ls) {
        const r = await api('contacts.importer', { lignes: l })
        rapport.crees += r.crees; rapport.completes += r.completes; rapport.identiques += r.identiques
        fait += l.length; setProgres({ fait, total, rapport: { ...rapport } })
      }
      setProgres({ fait, total, rapport, fini: true }); onFini()
    } catch (e) { setErreur(new Error(e.message + ` — ${fait} personnes sur ${total} traitées. Relancez l'import : ce qui est déjà fait ne sera pas recréé.`)); setEnvoi(false) }
  }
  const couples = prep?.fiches.filter((f) => f.couple) || []
  const nbPersonnes = prep ? versLignes(prep.fiches).length : 0

  return (
    <Modale large titre="Importer des contacts" onFermer={onFermer}
      pied={progres?.fini ? <button className="btn-principal" onClick={onFermer}>Fermer</button> : <>
        <button className="btn-clair" onClick={onFermer} disabled={envoi && !!progres}>Annuler</button>
        {prep && !comparaison && <button className="btn-principal" onClick={comparer} disabled={envoi || !prep.fiches.length}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Comparer avec Google Contacts</button>}
        {comparaison && <button className="btn-or" onClick={importer} disabled={envoi}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Importer ({comparaison.nouveaux} nouveaux, {comparaison.fusions.length} complétés)</button>}
      </>}>
      {progres ? (
        <div className="space-y-3 py-4">
          {progres.fini ? <p className="flex items-center gap-2 text-lg font-semibold"><CheckCircle2 className="h-6 w-6 text-emerald-600" />Import terminé</p> : <p className="text-sm">Import en cours… ne fermez pas cette fenêtre.</p>}
          <div className="h-2 overflow-hidden rounded-full bg-nuit-50"><div className="h-full bg-or transition-all" style={{ width: `${Math.round((progres.fait / progres.total) * 100)}%` }} /></div>
          <p className="text-sm text-nuit-600">{progres.fait} / {progres.total} personnes · {progres.rapport.crees} créées, {progres.rapport.completes} complétées, {progres.rapport.identiques} déjà à jour.</p>
          {progres.fini && <p className="text-sm text-nuit-600">Pensez ensuite à « Doublons » pour vérifier les fiches en double, et à « Mettre à jour » pour relier les contacts au reste de l'appli.</p>}
          <Erreur erreur={erreur} />
        </div>
      ) : !prep ? (
        <div className="space-y-3">
          <p className="text-sm text-nuit-600">Choisissez le tableau des contacts (.xlsx). L'onglet « Source fusionnée » est lu de préférence ; un fichier au format d'import Google Contacts convient aussi. Le fichier est lu sur cet appareil : seules les fiches retenues partent vers Google Contacts.</p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-nuit-100 p-8 text-sm text-nuit-600 hover:border-or hover:bg-or-50/40">
            {envoi ? <Loader2 className="h-8 w-8 animate-spin text-or" /> : <FileSpreadsheet className="h-8 w-8 text-or" />}Choisir le fichier
            <input type="file" accept=".xlsx" className="hidden" onChange={(e) => e.target.files[0] && lire(e.target.files[0])} />
          </label>
          <Erreur erreur={erreur} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Chiffre n={prep.compte.lues} l="lignes lues" />
            <Chiffre n={prep.compte.colmar} l="seulement Colmar (retirées)" />
            <Chiffre n={prep.compte.vides} l="sans coordonnées (ignorées)" />
            <Chiffre n={nbPersonnes} l="personnes à importer" fort />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#521a22]" checked={sansColmar} onChange={(e) => setSansColmar(e.target.checked)} />Sans les contacts de Colmar <Aide>Une ligne est retirée quand toutes ses sources sont de Colmar (gmail_colmar, brevo_colmar, ACCTA Colmar). Si la personne est aussi dans une autre liste (csv_simple, google_contacts…), elle est gardée.</Aide></label>
          {couples.length > 0 && <div>
            <h3 className="mb-1 font-semibold">Couples et foyers ({couples.length})</h3>
            <p className="mb-2 text-xs text-nuit-600/70">Chaque couple devient deux fiches reliées par un foyer (même adresse). Cliquez sur un e-mail ou un téléphone pour le passer à l'autre personne ; décochez pour garder une seule fiche.</p>
            <div className="max-h-[45vh] divide-y divide-nuit-50 overflow-y-auto rounded-lg border border-nuit-100">
              {couples.map((f) => (
                <div key={f.cle} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <input type="checkbox" className="accent-[#521a22]" checked={f.separer} onChange={(e) => majFiche(f.cle, (x) => ({ ...x, separer: e.target.checked }))} title="Séparer en deux fiches" />
                  <span className="w-48 truncate font-medium" title={f.nomOriginal}>{f.nomOriginal}</span>
                  {f.separer ? f.personnes.map((p, i) => (
                    <span key={i} className="flex flex-wrap items-center gap-1 rounded-lg bg-nuit-50/70 px-2 py-1">
                      <span className="font-medium">{p.prenom || p.civilite || '?'}</span>
                      {[...f.emails.map((x, j) => ['emails', j, x]), ...f.tels.map((x, j) => ['tels', j, x])].filter(([, , x]) => x.a === i).map(([k, j, x]) => (
                        <button key={k + j} className="pastille border border-nuit-100 bg-white text-nuit-600 hover:border-or" title="Passer à l'autre personne"
                          onClick={() => majFiche(f.cle, (y) => ({ ...y, [k]: y[k].map((z, n) => (n === j ? { ...z, a: (z.a + 1) % y.personnes.length } : z)) }))}>{x.v}</button>))}
                    </span>)) : <span className="text-xs text-nuit-600/75">une seule fiche</span>}
                </div>))}
            </div>
          </div>}
          {comparaison && <div className="rounded-lg bg-or-50 p-3 text-sm text-or-600">
            <p><strong>{comparaison.nouveaux}</strong> nouveaux contacts · <strong>{comparaison.fusions.length}</strong> contacts existants complétés (même e-mail ou téléphone) · <strong>{comparaison.identiques}</strong> déjà à jour.</p>
            {comparaison.fusions.length > 0 && <details className="mt-2"><summary className="cursor-pointer">Voir les contacts complétés</summary>
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs">{comparaison.fusions.map((x, i) => <li key={i}>{x.nom} : + {[...x.emails, ...x.tels].join(', ')}{x.adresse ? ' + adresse' : ''}</li>)}</ul></details>}
          </div>}
          <Erreur erreur={erreur} />
        </div>
      )}
    </Modale>
  )
}
const Chiffre = ({ n, l, fort }) => <div className={`rounded-lg p-2.5 ${fort ? 'bg-or-50 text-or-600' : 'bg-nuit-50/60'}`}><div className="text-xl font-semibold">{n}</div><div className="text-xs">{l}</div></div>

// ─────────────────────────── Doublons ───────────────────────────

function Doublons({ onFermer }) {
  const notifier = useNotif()
  const { data, chargement, erreur, recharger, setData } = useCharger(() => api('contacts.doublons'), [])
  const [encours, setEncours] = useState(null)
  async function fusionner(garder, retirer, cle) {
    setEncours(cle)
    try {
      await api('contacts.fusionner', { garder: garder.id, retirer: retirer.id })
      setData((l) => l.filter((x) => x.a.id !== retirer.id && x.b.id !== retirer.id))
      notifier(`${nomContact(retirer)} fusionné(e) dans ${nomContact(garder)}`)
    } catch (e) { notifier(e.message, 'erreur') } finally { setEncours(null) }
  }
  async function pasDoublon(x, cle) {
    setEncours(cle)
    try { await api('contacts.pasDoublon', { a: x.a.id, b: x.b.id }); setData((l) => l.filter((y) => y !== x)) } catch (e) { notifier(e.message, 'erreur') } finally { setEncours(null) }
  }
  const Carte = ({ c }) => <div className="min-w-0 flex-1 rounded-lg border border-nuit-100 p-2.5 text-sm">
    <Link to={`/contacts/${c.id}`} className="font-medium hover:underline">{nomContact(c)}</Link>
    {c.organisation && <div className="text-xs text-nuit-600/70">{c.organisation}</div>}
    {[...c.emails, ...c.tels].map((x) => <div key={x} className="truncate text-xs text-nuit-600">{x}</div>)}
    {c.ville && <div className="text-xs text-nuit-600/70">{c.ville}</div>}
    {c.origine && <div className="mt-1 truncate text-xs text-nuit-600/75">{c.origine}</div>}
  </div>
  return (
    <Modale large titre="Doublons probables" onFermer={onFermer} pied={<button className="btn-principal" onClick={onFermer}>Fermer</button>}>
      <Erreur erreur={erreur} reessayer={recharger} />
      {!data ? <Chargement texte="Recherche des doublons…" /> : !data.length ? <Vide icone={CheckCircle2} texte="Aucun doublon probable." /> : (
        <div className="space-y-3">
          <p className="text-xs text-nuit-600/70">{nb(data.length, 'paire', 'paires')}. « Garder » réunit les deux fiches dans celle choisie (e-mails, téléphones, adresse, groupes, foyer) et supprime l'autre de Google Contacts.</p>
          {data.map((x) => { const cle = x.a.id + x.b.id
            return <div key={cle} className="rounded-xl border border-nuit-100 p-3">
              <div className="mb-2 flex flex-wrap gap-1">{x.raisons.map((r) => <span key={r} className="pastille bg-or-50 text-or-600">{r}</span>)}</div>
              <div className="flex flex-col gap-2 sm:flex-row"><Carte c={x.a} /><Carte c={x.b} /></div>
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                {encours === cle ? <Loader2 className="h-5 w-5 animate-spin text-or" /> : <>
                  <button className="btn-clair py-1.5 text-xs" onClick={() => pasDoublon(x, cle)}>Ce ne sont pas des doublons</button>
                  <button className="btn-clair py-1.5 text-xs" onClick={() => fusionner(x.a, x.b, cle)}>Garder la 1<sup>re</sup></button>
                  <button className="btn-clair py-1.5 text-xs" onClick={() => fusionner(x.b, x.a, cle)}>Garder la 2<sup>e</sup></button>
                </>}
              </div>
            </div> })}
        </div>)}
      {chargement && data && <Chargement />}
    </Modale>
  )
}
