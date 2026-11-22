import { useRef, useState } from 'react'
import { Folder, FileText, FileSpreadsheet, FileImage, File, Upload, FolderPlus, Search, Download, ExternalLink, ChevronRight, Loader2, X, MoveRight, Pencil, Inbox } from 'lucide-react'
import { api, fichierEnBase64, telechargerBase64 } from '../api.js'
import { Chargement, Erreur, Modale, Vide, useCharger, useNotif, dateRelative, taille } from '../ui.jsx'

const icone = (type) =>
  /folder/.test(type) ? Folder : /spreadsheet|excel|csv/.test(type) ? FileSpreadsheet : /image/.test(type) ? FileImage : /document|word|pdf|text/.test(type) ? FileText : File

export default function Documents() {
  const notifier = useNotif()
  const [dossierId, setDossierId] = useState('')
  const [recherche, setRecherche] = useState('')
  const [resultats, setResultats] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [telech, setTelech] = useState(null)
  const [nouveauDossier, setNouveauDossier] = useState(false)
  const [deplacer, setDeplacer] = useState(null)
  const [renommer, setRenommer] = useState(null)
  const input = useRef()
  const { data, chargement, erreur, recharger } = useCharger(() => api('documents.liste', { id: dossierId }), [dossierId], ['documents.liste', { id: dossierId }])

  async function chercher(e) {
    e.preventDefault()
    if (!recherche.trim()) { setResultats(null); return }
    try { setResultats(await api('documents.chercher', { texte: recherche })) } catch (err) { notifier(err.message, 'erreur') }
  }
  async function deposer(fichiers) {
    setEnvoi(true)
    try {
      for (const f of fichiers) {
        if (f.size > 20 * 1024 * 1024) { notifier(`${f.name} : trop volumineux (20 Mo max)`, 'erreur'); continue }
        await api('documents.envoyer', { dossierId: data.id, nom: f.name, type: f.type, base64: await fichierEnBase64(f) })
      }
      notifier('Document(s) déposé(s)'); recharger()
    } catch (e) { notifier(e.message, 'erreur') } finally { setEnvoi(false); input.current.value = '' }
  }
  async function telecharger(f) {
    setTelech(f.id)
    try { telechargerBase64(await api('documents.telecharger', { id: f.id })) } catch (e) { notifier(e.message, 'erreur') } finally { setTelech(null) }
  }

  const aRanger = data?.aRanger
  const fichiers = resultats ?? data?.fichiers ?? []
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-semibold">Documents</h1><p className="text-sm text-nuit-600/80">Drive du secrétariat</p></div>
        {!resultats && data && !aRanger && <div className="flex gap-2">
          <button className="btn-clair" onClick={() => setNouveauDossier(true)}><FolderPlus className="h-4 w-4" />Dossier</button>
          <button className="btn-or" onClick={() => input.current.click()} disabled={envoi}>{envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Déposer</button>
          <input ref={input} type="file" multiple className="hidden" onChange={(e) => deposer([...e.target.files])} />
        </div>}
      </div>

      <form onSubmit={chercher} className="relative mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-nuit-600/50" />
        <input className="champ pl-9 pr-9" placeholder="Rechercher un document par nom (tout le Drive)" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        {resultats && <button type="button" className="btn-icone absolute right-2 top-1.5 p-1" onClick={() => { setResultats(null); setRecherche('') }}><X className="h-4 w-4" /></button>}
      </form>

      {!resultats && data && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {data.ariane.map((a, i) => (
              <span key={a.id + i} className="flex items-center gap-1">{i > 0 && <ChevronRight className="h-3.5 w-3.5 text-nuit-600/40" />}
                <button className={i === data.ariane.length - 1 ? 'font-semibold' : 'text-or-600 hover:underline'} onClick={() => setDossierId(a.id)}>{a.nom}</button></span>
            ))}
          </nav>
          {!aRanger && !dossierId && <button className="btn-clair py-1.5 text-xs" onClick={() => setDossierId('a-ranger')}><Inbox className="h-4 w-4" />À ranger (reste du Drive)</button>}
        </div>
      )}
      {aRanger && <p className="mb-3 rounded-lg bg-or-50 p-3 text-xs text-or-600">Ces fichiers sont dans le Drive mais pas encore dans le dossier du secrétariat. Utilisez <MoveRight className="inline h-3.5 w-3.5" /> pour les ranger.</p>}

      <Erreur erreur={erreur} reessayer={recharger} />
      {chargement && !data ? <Chargement /> : (
        <div className={`carte divide-y divide-nuit-50 overflow-hidden ${chargement ? 'opacity-60' : ''}`}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!resultats && !aRanger) deposer([...e.dataTransfer.files]) }}>
          {!resultats && data?.dossiers.map((d) => (
            <div key={d.id} className="flex items-center gap-1 pr-2 hover:bg-nuit-50/50">
              <button onClick={() => setDossierId(d.id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left text-sm">
                <Folder className="h-5 w-5 shrink-0 fill-or-100 text-or" /><span className="flex-1 truncate font-medium">{d.nom}</span><ChevronRight className="h-4 w-4 text-nuit-600/40" />
              </button>
              {d.aRanger && <button className="btn-icone p-1" title="Ranger ce dossier" onClick={() => setDeplacer(d)}><MoveRight className="h-4 w-4" /></button>}
            </div>
          ))}
          {fichiers.map((f) => {
            const I = icone(f.type)
            return (
              <div key={f.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <I className="h-5 w-5 shrink-0 text-nuit-600/70" />
                <div className="min-w-0 flex-1"><div className="truncate">{f.nom}</div><div className="text-xs text-nuit-600/60">{dateRelative(f.modifie)}{f.taille ? ` · ${taille(f.taille)}` : ''}{resultats && f.aRanger ? ' · à ranger' : ''}</div></div>
                <button className="btn-icone p-1.5" title="Renommer" onClick={() => setRenommer(f)}><Pencil className="h-4 w-4" /></button>
                <button className="btn-icone p-1.5" title="Déplacer / ranger" onClick={() => setDeplacer(f)}><MoveRight className="h-4 w-4" /></button>
                <button className="btn-icone p-1.5" title="Télécharger" onClick={() => telecharger(f)}>{telech === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button>
                {f.lien && <a className="btn-icone hidden p-1.5 sm:inline-flex" title="Ouvrir dans Google Drive" href={f.lien} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>}
              </div>
            )
          })}
          {!fichiers.length && (resultats || !data?.dossiers.length) && <Vide icone={Folder} texte={resultats ? 'Aucun résultat.' : 'Dossier vide. Glissez des fichiers ici.'} />}
        </div>
      )}
      <p className="mt-3 text-xs text-nuit-600/60">Les documents Google (Docs, Sheets) sont téléchargés en PDF. « Ouvrir dans Drive » demande d'être connecté au compte Google de la paroisse.</p>

      {nouveauDossier && <NomModale titre="Nouveau dossier" onFermer={() => setNouveauDossier(false)} onValider={async (nom) => { await api('documents.dossier', { parentId: data.id, nom }); setNouveauDossier(false); notifier('Dossier créé'); recharger() }} />}
      {renommer && <NomModale titre="Renommer" initial={renommer.nom} onFermer={() => setRenommer(null)} onValider={async (nom) => { await api('documents.renommer', { id: renommer.id, nom }); setRenommer(null); notifier('Renommé'); if (resultats) setResultats(null); else recharger() }} />}
      {deplacer && <ChoisirDossier titre={`Ranger « ${deplacer.nom} »`} onFermer={() => setDeplacer(null)} onChoix={async (versId) => {
        try { await api('documents.deplacer', { id: deplacer.id, versId }); setDeplacer(null); notifier('Déplacé'); if (resultats) setResultats(null); else recharger() } catch (e) { notifier(e.message, 'erreur') }
      }} />}
    </>
  )
}

function NomModale({ titre, initial = '', onFermer, onValider }) {
  const [nom, setNom] = useState(initial)
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const valider = async () => { setEnvoi(true); try { await onValider(nom) } catch (e) { setErreur(e); setEnvoi(false) } }
  return (
    <Modale titre={titre} onFermer={onFermer} pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={!nom || envoi} onClick={valider}>Valider</button></>}>
      <input className="champ" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && nom && valider()} />
      <div className="mt-3"><Erreur erreur={erreur} /></div>
    </Modale>
  )
}

/** Choix d'un dossier de destination dans le Drive du secrétariat. */
function ChoisirDossier({ titre, onFermer, onChoix }) {
  const [id, setId] = useState('')
  const { data, chargement, erreur } = useCharger(() => api('documents.liste', { id }), [id])
  return (
    <Modale titre={titre} onFermer={onFermer} pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={!data} onClick={() => onChoix(data.id)}><MoveRight className="h-4 w-4" />Ranger ici</button></>}>
      {data && <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm">{data.ariane.map((a, i) => (
        <span key={a.id + i} className="flex items-center gap-1">{i > 0 && <ChevronRight className="h-3.5 w-3.5 text-nuit-600/40" />}<button className="text-or-600 hover:underline" onClick={() => setId(a.id)}>{a.nom}</button></span>))}</nav>}
      <Erreur erreur={erreur} />
      {chargement ? <Chargement /> : (
        <div className="max-h-80 divide-y divide-nuit-50 overflow-y-auto rounded-lg border border-nuit-100">
          {data?.dossiers.map((d) => <button key={d.id} onClick={() => setId(d.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-nuit-50"><Folder className="h-4 w-4 text-or" />{d.nom}</button>)}
          {!data?.dossiers.length && <Vide texte="Pas de sous-dossier." />}
        </div>
      )}
    </Modale>
  )
}

/** Sélecteur de document du Drive (pour joindre à un e-mail). */
export function ChoisirDocument({ onFermer, onChoix }) {
  const [dossierId, setDossierId] = useState('')
  const { data, chargement, erreur } = useCharger(() => api('documents.liste', { id: dossierId }), [dossierId])
  return (
    <Modale titre="Joindre un document" onFermer={onFermer}>
      {data && <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm">{data.ariane.map((a, i) => (
        <span key={a.id + i} className="flex items-center gap-1">{i > 0 && <ChevronRight className="h-3.5 w-3.5 text-nuit-600/40" />}
          <button className="text-or-600 hover:underline" onClick={() => setDossierId(a.id)}>{a.nom}</button></span>))}</nav>}
      <Erreur erreur={erreur} />
      {chargement ? <Chargement /> : (
        <div className="max-h-96 divide-y divide-nuit-50 overflow-y-auto rounded-lg border border-nuit-100">
          {data?.dossiers.map((d) => <button key={d.id} onClick={() => setDossierId(d.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-nuit-50"><Folder className="h-4 w-4 text-or" />{d.nom}</button>)}
          {data?.fichiers.map((f) => { const I = icone(f.type); return <button key={f.id} onClick={() => onChoix(f)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-or-50"><I className="h-4 w-4 text-nuit-600/70" /><span className="truncate">{f.nom}</span></button> })}
          {!data?.dossiers.length && !data?.fichiers.length && <Vide texte="Dossier vide." />}
        </div>
      )}
    </Modale>
  )
}
