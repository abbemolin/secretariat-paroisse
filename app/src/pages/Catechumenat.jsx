import { useState } from 'react'
import { Cake, BookOpen, CalendarDays, Check, Eye, Link2, Loader2, Paperclip, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
import { api, fichierEnBase64 } from '../api.js'
import { Chargement, Erreur, Modale, Vide, useCharger, useNotif, useConfirmer, Aide, dateCourte } from '../ui.jsx'

/** Textes publiés dans l'app « Croix glorieuse » et calendrier des catéchumènes / néophytes. */
import VoirComme from './VoirComme.jsx'
import { useApp } from '../App.jsx'

export default function Catechumenat() {
  const { peut } = useApp()
  const [vue, setVue] = useState('textes')
  const { data, erreur, setData } = useCharger(() => api('textes.liste'), [], ['textes.liste', {}])
  const [texte, setTexte] = useState(null)
  const [evt, setEvt] = useState(null)
  const [lus, setLus] = useState(null)
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-semibold">Catéchuménat</h1><p className="text-sm text-nuit-600/80">Textes et calendrier de l'app « Croix glorieuse » (app.croix-glorieuse.org)</p></div>
        <div className="flex gap-2">
          {peut('utilisateurs') && <VoirComme seulement={['catechumene', 'neophyte', 'parrain']} libelle="Aperçu" />}
          {vue === 'anniversaires' ? null : vue === 'textes' ? <button className="btn-principal" disabled={!data} onClick={() => setTexte({ titre: '', corps: '', cible: data.promotions[1]?.cle || 'tous', liens: [], fichiers: [] })}><Plus className="h-4 w-4" />Nouveau texte</button>
            : <button className="btn-principal" disabled={!data} onClick={() => setEvt({ date: '', heure_debut: '', heure_fin: '', titre: '', lieu: '', cible: data.promotions[1]?.cle || 'tous', note: '' })}><Plus className="h-4 w-4" />Nouvelle date</button>}
          <Aide>Les catéchumènes et néophytes voient ces textes et ces dates dans leur espace personnel (lien envoyé depuis leur dossier). Un nouveau texte déclenche une notification sur leur téléphone.</Aide>
        </div>
      </div>
      <div className="mb-4 flex gap-1.5">{[['textes', 'Textes', BookOpen], ['calendrier', 'Calendrier', CalendarDays], ['anniversaires', 'Anniversaires de baptême', Cake]].map(([k, l, I]) => (
        <button key={k} className={`pastille gap-1 border px-3 py-1.5 text-sm ${vue === k ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} onClick={() => setVue(k)}><I className="h-4 w-4" />{l}</button>))}</div>
      <Erreur erreur={erreur} />
      {vue === 'anniversaires' ? <Anniversaires /> : !data ? <Chargement /> : vue === 'textes' ? (
        !data.textes.length ? <Vide icone={BookOpen} texte="Aucun texte publié. « Nouveau texte » pour écrire un enseignement, une prière, une consigne…" /> : (
          <div className="carte divide-y divide-nuit-100">
            {data.textes.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1"><div className="font-medium">{t.titre}</div>
                  <div className="text-xs text-nuit-600/70">{dateCourte(t.cree_le)} · {t.auteur} · {t.cible_nom}{t.fichiers.length ? ` · ${t.fichiers.length} fichier${t.fichiers.length > 1 ? 's' : ''}` : ''}{t.liens.length ? ` · ${t.liens.length} lien${t.liens.length > 1 ? 's' : ''}` : ''}</div></div>
                <button className="pastille gap-1 border border-nuit-100 bg-white text-nuit-600" onClick={() => setLus(t)}><Eye className="h-3.5 w-3.5" />lu par {t.nb_lus}/{t.nb_dest}</button>
                <button className="btn-icone" title="Modifier" onClick={() => setTexte({ ...t, garder: t.fichiers.map((f) => f.id) })}><Pencil className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )
      ) : (
        !data.calendrier.length ? <Vide icone={CalendarDays} texte="Aucune date. Ajoutez les rencontres, l'appel décisif, les scrutins, la Vigile pascale…" /> : (
          <div className="carte divide-y divide-nuit-100">
            {data.calendrier.map((ev) => (
              <button key={ev.id} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-nuit-50/50" onClick={() => setEvt(ev)}>
                <span className="w-28 shrink-0 text-sm font-medium">{new Date(ev.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="flex-1"><span className="block font-medium">{ev.titre}</span><span className="text-xs text-nuit-600/70">{[ev.heure_debut && ev.heure_debut + (ev.heure_fin ? '–' + ev.heure_fin : ''), ev.lieu, ev.cible_nom, ev.parrains === 'oui' && 'parrains et marraines'].filter(Boolean).join(' · ')}</span></span>
              </button>
            ))}
          </div>
        )
      )}
      {texte && <EditionTexte t={texte} data={data} onFermer={() => setTexte(null)} onFait={(r) => { setData(r); setTexte(null) }} />}
      {evt && <EditionDate ev={evt} data={data} onFermer={() => setEvt(null)} onFait={(r) => { setData(r); setEvt(null) }} />}
      {lus && <Modale titre={`« ${lus.titre} » – lecture`} onFermer={() => setLus(null)} pied={<button className="btn-principal" onClick={() => setLus(null)}>Fermer</button>}>
        <ul className="divide-y divide-nuit-100 text-sm">{lus.lus.map((x, i) => <li key={i} className="flex justify-between py-1.5"><span>{x.nom}</span>{x.lu ? <span className="text-emerald-700"><Check className="mr-1 inline h-3.5 w-3.5" />{dateCourte(x.lu)}</span> : <span className="text-nuit-600/50">pas encore lu</span>}</li>)}</ul>
        <p className="mt-2 text-xs text-nuit-600/70">Seules les personnes qui ont ouvert leur espace personnel peuvent lire les textes.</p>
      </Modale>}
    </>
  )
}

function ChoixCible({ valeur, onChange, data }) {
  const personne = valeur.startsWith('d:')
  return (
    <div>
      <label className="etiquette">Pour qui</label>
      <div className="flex flex-wrap gap-1.5">
        {data.promotions.map((p) => <button key={p.cle} className={`pastille border py-1 ${valeur === p.cle ? 'border-or bg-or text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} onClick={() => onChange(p.cle)}>{p.nom}</button>)}
        <button className={`pastille border py-1 ${personne ? 'border-or bg-or text-white' : 'border-nuit-100 bg-white text-nuit-600'}`} onClick={() => onChange('d:' + (data.personnes[0]?.id || ''))}>Une personne</button>
      </div>
      {personne && <select className="champ mt-2" value={valeur.slice(2)} onChange={(ev) => onChange('d:' + ev.target.value)}>{data.personnes.map((x) => <option key={x.id} value={x.id}>{x.nom}{x.espace ? '' : ' (espace pas encore ouvert)'}</option>)}</select>}
    </div>
  )
}

function EditionTexte({ t, data, onFermer, onFait }) {
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const [v, setV] = useState({ ...t, liens: t.liens.map((l) => ({ ...l })) })
  const [nouveaux, setNouveaux] = useState([])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const maj = (k, x) => setV((w) => ({ ...w, [k]: x }))
  async function ajouterFichiers(liste) {
    for (const f of liste) {
      if (f.size > 20 * 1024 * 1024) { notifier(`${f.name} : trop lourd (20 Mo au plus)`, 'erreur'); continue }
      setNouveaux((n) => [...n, { nom: f.name, type: f.type, fichier: f }])
    }
  }
  async function publier() {
    setEnvoi(true); setErreur(null)
    try {
      const nv = await Promise.all(nouveaux.map(async (f) => ({ nom: f.nom, type: f.type, base64: await fichierEnBase64(f.fichier) })))
      onFait(await api('textes.ecrire', { texte: { id: v.id, titre: v.titre, corps: v.corps, cible: v.cible, liens: v.liens, garder: v.garder || [], nouveaux: nv } }))
      notifier(v.id ? 'Texte modifié' : 'Texte publié : les destinataires sont prévenus')
    } catch (err) { setErreur(err); setEnvoi(false) }
  }
  async function supprimer() {
    if (!(await confirmer({ titre: 'Supprimer le texte', texte: `« ${v.titre} » disparaîtra des espaces personnels.`, bouton: 'Supprimer', danger: true }))) return
    try { onFait(await api('textes.supprimer', { id: v.id })); notifier('Texte supprimé') } catch (err) { setErreur(err) }
  }
  const dest = data.promotions.find((p) => p.cle === v.cible)?.nom || data.personnes.find((p) => 'd:' + p.id === v.cible)?.nom || ''
  return (
    <Modale large titre={v.id ? 'Modifier le texte' : 'Nouveau texte'} onFermer={onFermer}
      pied={<>{v.id && <button className="btn-clair mr-auto text-red-700" onClick={supprimer}><Trash2 className="h-4 w-4" />Supprimer</button>}<button className="btn-clair" onClick={onFermer}>Annuler</button>
        <button className="btn-principal" disabled={envoi || !v.titre.trim() || !v.cible || v.cible === 'd:'} onClick={publier}>{envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{v.id ? 'Enregistrer' : 'Publier'}</button></>}>
      <div className="space-y-3">
        <ChoixCible valeur={v.cible} onChange={(x) => maj('cible', x)} data={data} />
        <div><label className="etiquette">Titre</label><input className="champ" value={v.titre} onChange={(ev) => maj('titre', ev.target.value)} placeholder="Le Notre Père – 3e rencontre" /></div>
        <div><label className="etiquette">Texte</label><textarea className="champ min-h-[260px] leading-relaxed" value={v.corps} onChange={(ev) => maj('corps', ev.target.value)} placeholder="Enseignement, prière, consigne… Les adresses web deviennent des liens." /></div>
        <div>
          <label className="etiquette">Fichiers (PDF, images…)</label>
          {(t.fichiers || []).filter((f) => (v.garder || []).includes(f.id)).map((f) => (
            <div key={f.id} className="flex items-center gap-2 text-sm"><Paperclip className="h-3.5 w-3.5 text-or" /><span className="flex-1">{f.nom}</span><button className="btn-icone p-1" onClick={() => maj('garder', v.garder.filter((x) => x !== f.id))}><X className="h-3.5 w-3.5" /></button></div>))}
          {nouveaux.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-sm"><Paperclip className="h-3.5 w-3.5 text-or" /><span className="flex-1">{f.nom}</span><button className="btn-icone p-1" onClick={() => setNouveaux((n) => n.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></button></div>))}
          <label className="btn-clair mt-1 inline-flex cursor-pointer py-1 text-xs"><Plus className="h-3.5 w-3.5" />Joindre un fichier<input type="file" multiple className="hidden" onChange={(ev) => { ajouterFichiers([...ev.target.files]); ev.target.value = '' }} /></label>
        </div>
        <div>
          <label className="etiquette">Liens (vidéo, site…)</label>
          {v.liens.map((l, i) => (
            <div key={i} className="mb-1.5 flex gap-1.5">
              <input className="champ flex-1 py-1.5" placeholder="https://…" value={l.url} onChange={(ev) => maj('liens', v.liens.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)))} />
              <input className="champ w-48 py-1.5" placeholder="Libellé" value={l.libelle} onChange={(ev) => maj('liens', v.liens.map((x, j) => (j === i ? { ...x, libelle: ev.target.value } : x)))} />
              <button className="btn-icone p-1 text-red-700" onClick={() => maj('liens', v.liens.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>))}
          <button className="btn-clair py-1 text-xs" onClick={() => maj('liens', [...v.liens, { url: '', libelle: '' }])}><Link2 className="h-3.5 w-3.5" />Ajouter un lien</button>
        </div>
        {!v.id && dest && <p className="rounded-lg bg-or-50 px-3 py-2 text-sm text-or-600">À la publication, une notification part sur le téléphone de : {dest}.</p>}
        <Erreur erreur={erreur} />
      </div>
    </Modale>
  )
}

function EditionDate({ ev, data, onFermer, onFait }) {
  const notifier = useNotif()
  const [v, setV] = useState({ ...ev })
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const maj = (k, x) => setV((w) => ({ ...w, [k]: x }))
  async function action(params, msg) {
    setEnvoi(true); setErreur(null)
    try { onFait(await api('calendrier.ecrire', params)); notifier(msg) } catch (err) { setErreur(err); setEnvoi(false) }
  }
  const champ = (k, l, type = 'text') => <div><label className="etiquette">{l}</label><input className="champ" type={type} value={v[k] || ''} onChange={(e) => maj(k, e.target.value)} /></div>
  return (
    <Modale titre={v.id ? 'Modifier la date' : 'Nouvelle date'} onFermer={onFermer}
      pied={<>{v.id && <button className="btn-clair mr-auto text-red-700" disabled={envoi} onClick={() => action({ supprimer: v.id }, 'Date supprimée')}><Trash2 className="h-4 w-4" />Supprimer</button>}<button className="btn-clair" onClick={onFermer}>Annuler</button>
        <button className="btn-principal" disabled={envoi || !v.date || !v.titre} onClick={() => action({ evenement: v }, 'Date enregistrée')}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button></>}>
      <div className="space-y-3">
        <ChoixCible valeur={v.cible} onChange={(x) => maj('cible', x)} data={data} />
        {champ('titre', 'Titre (rencontre, appel décisif, scrutin…)')}
        <div className="grid grid-cols-3 gap-2">{champ('date', 'Date', 'date')}{champ('heure_debut', 'De', 'time')}{champ('heure_fin', 'À', 'time')}</div>
        {champ('lieu', 'Lieu')}
        {champ('note', 'Note (facultatif)')}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#521a22]" checked={v.parrains === 'oui'} onChange={(e) => maj('parrains', e.target.checked ? 'oui' : '')} />Visible aussi par les parrains et marraines (sur leur page)</label>
        <p className="text-xs text-nuit-600/70">La retraite de confirmation de leur année s'ajoute toute seule à leur calendrier.</p>
        <Erreur erreur={erreur} />
      </div>
    </Modale>
  )
}

/** Anniversaire de baptême des néophytes : notification + mail chaque année (8 h), texte modèle modifiable. */
function Anniversaires() {
  const notifier = useNotif()
  const { data, erreur, setData } = useCharger(() => api('catechumenat.reglages', {}), [])
  const [v, setV] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  if (erreur) return <Erreur erreur={erreur} />
  if (!data) return <Chargement />
  const r = v || data
  async function enregistrer() {
    setEnvoi(true)
    try { const x = await api('catechumenat.reglages', { ecrire: true, anniv_actif: r.anniv_actif, anniv_texte: r.anniv_texte }); setData(x); setV(null); notifier(x.anniv_actif ? 'Anniversaires activés' : 'Anniversaires désactivés') }
    catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false) }
  }
  const maj = (k, x) => setV({ ...r, [k]: x })
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section className="carte space-y-3 p-4">
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" className="h-4 w-4 accent-[#521a22]" checked={!!r.anniv_actif} onChange={(e) => maj('anniv_actif', e.target.checked)} />Souhaiter l'anniversaire de baptême des néophytes</label>
        <p className="text-sm text-nuit-600/80">Chaque année, le jour anniversaire de l'étape « Baptême, confirmation, eucharistie » (vers 8 h) : notification sur leur téléphone, mail de la paroisse avec ce texte, et carte « Joyeux anniversaire de baptême » sur l'accueil de leur app toute la journée.</p>
        <div><label className="etiquette">Texte du mail ({'{prenom}'} et {'{annees}'} sont remplacés)</label>
          <textarea className="champ min-h-[220px]" value={r.anniv_texte} onChange={(e) => maj('anniv_texte', e.target.value)} /></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-clair" onClick={() => maj('anniv_texte', data.defaut)}>Rétablir le texte proposé</button>
          <button className="btn-principal ml-auto" disabled={envoi || !v} onClick={enregistrer}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
        </div>
      </section>
      <section className="carte p-4">
        <h2 className="mb-2 text-lg font-semibold">Prochains anniversaires (60 jours)</h2>
        {!data.prochains.length ? <p className="text-sm text-nuit-600/70">Aucun dans les 60 prochains jours.</p> : (
          <ul className="divide-y divide-nuit-50 text-sm">{data.prochains.map((x) => <li key={x.id} className="flex items-center gap-2 py-1.5">
            <span className="w-24 shrink-0 text-xs text-nuit-600/70">{dateCourte(x.date)}</span><span className="flex-1">{x.nom}</span>
            <span className="text-xs text-or-600">{x.annees} an{x.annees > 1 ? 's' : ''}</span>{!x.mail && <span title="Pas d'adresse e-mail" className="text-xs text-red-700">sans mail</span>}</li>)}</ul>
        )}
      </section>
    </div>
  )
}
