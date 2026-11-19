import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Search, ScrollText, PenLine, Printer, Download, Send, Loader2, Save, Eraser, CheckCircle2, FolderHeart, AlertCircle, Trash2 } from 'lucide-react'
import { api } from '../api.js'
import { useApp } from '../App.jsx'
import { B14 } from '../imprimables.js'
import { htmlVersPdf, telechargerBlob } from '../pdf.js'
import { Chargement, Erreur, Modale, Vide, useCharger, useNotif, useConfirmer, dateHeure, dateCourte } from '../ui.jsx'
import { Redaction } from './Courrier.jsx'

const dateLongue = (d) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d ? new Date(d) : new Date())

/** Image du sceau, chargée une fois. */
let sceauCache = null
export async function chargerSceau() {
  if (sceauCache === null) sceauCache = await api('sceau.lire').catch(() => '')
  // Sceau fourni avec l'appli, si aucun n'a été enregistré dans les réglages
  if (!sceauCache) sceauCache = await fetch('./sceau.png').then((r) => r.blob()).then((b) => new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b) })).catch(() => '')
  return sceauCache
}
export function oublierSceau() { sceauCache = null }

/** Crée un extrait à partir des valeurs d'un B14 (appelé depuis un dossier). */
export async function creerExtrait(valeurs, dossierId) {
  return api('extraits.enregistrer', { valeurs, dossier_id: dossierId || '' })
}

export default function Extraits() {
  const { id } = useParams()
  return id ? <Extrait id={id} /> : <Registre />
}

function Registre() {
  const nav = useNavigate()
  const { reglages } = useApp()
  const [texte, setTexte] = useState('')
  const [creation, setCreation] = useState(false)
  const { data, chargement, erreur, recharger } = useCharger(() => api('extraits.liste'), [])
  const liste = (data?.extraits || []).filter((x) => !texte || `${x.nom} ${x.valeurs.annee} ${x.valeurs.acte}`.toLowerCase().includes(texte.toLowerCase()))

  async function nouveau() {
    setCreation(true)
    try {
      const v = Object.fromEntries(B14.champs.map(([k]) => [k, '']))
      Object.assign(v, { paroisse: reglages.paroisse, diocese: reglages.diocese, fait_a: reglages.commune, fait_le: dateLongue() })
      const x = await creerExtrait(v)
      nav(`/extraits/${x.id}`)
    } catch { setCreation(false) }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-semibold">Extraits de baptême</h1><p className="text-sm text-nuit-600/80">Registre des extraits délivrés (B14)</p></div>
        <button className="btn-or" onClick={nouveau} disabled={creation}>{creation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Nouvel extrait</button>
      </div>
      <div className="relative mb-4"><Search className="absolute left-3 top-2.5 h-4 w-4 text-nuit-600/50" />
        <input className="champ pl-9" placeholder="Nom, année, n° d'acte…" value={texte} onChange={(e) => setTexte(e.target.value)} /></div>
      <Erreur erreur={erreur} reessayer={recharger} />
      {chargement && !data ? <Chargement /> : (
        <div className="carte overflow-hidden">
          {!liste.length ? <Vide icone={ScrollText} texte="Aucun extrait pour l'instant." /> : (
            <div className="divide-y divide-nuit-50">
              {liste.map((x) => (
                <button key={x.id} onClick={() => nav(`/extraits/${x.id}`)} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 text-left text-sm hover:bg-nuit-50/50 md:grid-cols-[1fr_170px_140px_120px]">
                  <span className="min-w-0"><span className="block truncate font-medium">{x.nom}</span>
                    <span className="block text-xs text-nuit-600/60">Registre {x.valeurs.annee || '—'} · acte n° {x.valeurs.acte || '—'}{x.dossier_id && ' · depuis un dossier'}</span></span>
                  <span className="hidden text-xs text-nuit-600/70 md:block">Créé le {dateCourte(x.cree_le)}<br />par {x.cree_par}</span>
                  <span className="hidden text-xs text-nuit-600/70 md:block">{x.envois.length ? `Envoyé ${x.envois.length} fois` : '—'}</span>
                  <span className="justify-self-end">{x.statut === 'signe'
                    ? <span className="pastille gap-1 bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-3 w-3" />Signé</span>
                    : <span className="pastille bg-amber-100 text-amber-900">À signer</span>}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function Extrait({ id }) {
  const nav = useNavigate()
  const confirmer = useConfirmer()
  const notifier = useNotif()
  const { utilisateur, reglages } = useApp()
  const [x, setX] = useState(null)
  const [v, setV] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [sceau, setSceau] = useState('')
  const [signatureImg, setSignatureImg] = useState('')
  const [occupe, setOccupe] = useState('')
  const [pad, setPad] = useState(false)
  const [mail, setMail] = useState(false)
  const cadre = useRef()

  useEffect(() => {
    api('extraits.lire', { id }).then((r) => {
      setX(r); setV(r.valeurs)
      if (r.statut === 'signe') api('extraits.signature', { id }).then((b) => setSignatureImg(b ? 'data:image/png;base64,' + b : '')).catch(() => {})
    }).catch(setErreur)
    chargerSceau().then(setSceau)
  }, [id])

  if (erreur) return <Erreur erreur={erreur} />
  if (!x || !v) return <Chargement />
  const modifie = JSON.stringify(v) !== JSON.stringify(x.valeurs)
  const signe = x.statut === 'signe' && !modifie
  const signInfo = signe ? { signature: signatureImg, sceau, par: x.signe_par, le: dateLongue(x.signe_le) } : { sceau }
  const html = B14.html(v, signInfo)

  async function enregistrer() {
    setOccupe('save')
    try {
      const r = await api('extraits.enregistrer', { id, valeurs: v })
      setX(r); setV(r.valeurs)
      if (x.statut === 'signe' && r.statut !== 'signe') { setSignatureImg(''); notifier('Enregistré — l\'extrait doit être signé à nouveau') } else notifier('Enregistré')
      return r
    } catch (e) { notifier(e.message, 'erreur'); throw e } finally { setOccupe('') }
  }
  async function signer(png) {
    setPad(false); setOccupe('sign')
    try {
      if (modifie) await enregistrer()
      const le = dateLongue()
      const { base64 } = await htmlVersPdf(B14.html(v, { signature: png, sceau, par: utilisateur.nom, le }))
      const r = await api('extraits.signer', { id, signature: png.split(',')[1], pdf: base64 })
      setX(r); setV(r.valeurs); setSignatureImg(png)
      notifier('Extrait signé et archivé dans le Drive')
    } catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }
  async function supprimer() {
    if (!(await confirmer({ titre: "Supprimer l'extrait", texte: `L'extrait de ${x.nom} sera retiré du registre, et le PDF signé mis à la corbeille du Drive.`, bouton: 'Supprimer définitivement', danger: true }))) return
    setOccupe('suppr')
    try { await api('extraits.supprimer', { id }); notifier('Extrait supprimé'); nav('/extraits') } catch (e) { notifier(e.message, 'erreur'); setOccupe('') }
  }
  async function telecharger() {
    setOccupe('pdf')
    try { const { blob } = await htmlVersPdf(html); telechargerBlob(blob, `Extrait de baptême – ${x.nom}.pdf`) } catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }

  return (
    <>
      <Link to="/extraits" className="mb-3 inline-flex items-center gap-1 text-sm text-nuit-600 hover:text-or-600"><ArrowLeft className="h-4 w-4" />Extraits</Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold leading-tight">{x.nom}</h1>
          <p className="text-xs text-nuit-600/70">Extrait de baptême · créé le {dateCourte(x.cree_le)} par {x.cree_par}
            {x.dossier_id && <> · <Link to={`/dossiers/${x.dossier_id}`} className="text-or-600 hover:underline"><FolderHeart className="inline h-3 w-3" /> dossier</Link></>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {signe
            ? <span className="pastille gap-1 bg-emerald-100 py-1.5 text-emerald-800"><CheckCircle2 className="h-4 w-4" />Signé par {x.signe_par} le {dateCourte(x.signe_le)}</span>
            : <span className="pastille gap-1 bg-amber-100 py-1.5 text-amber-900"><AlertCircle className="h-4 w-4" />{x.statut === 'signe' ? 'Modifié : à signer de nouveau' : 'Non signé'}</span>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <section className="carte space-y-2 p-4">
            <h2 className="text-xl font-semibold">Informations</h2>
            {B14.champs.map(([cle, label, genre]) => (
              <div key={cle}><label className="etiquette">{label}</label>
                {genre === 'sexe'
                  ? <div className="flex gap-2">{['Garçon', 'Fille'].map((o) => <button key={o} onClick={() => setV({ ...v, [cle]: o })} className={`btn flex-1 border py-1.5 ${(v[cle] === o || (o === 'Garçon' && v[cle] === 'Homme') || (o === 'Fille' && v[cle] === 'Femme')) ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>{o}</button>)}</div>
                  : <input className="champ py-1.5" value={v[cle] || ''} onChange={(e) => setV({ ...v, [cle]: e.target.value })} />}</div>
            ))}
            {modifie && <button className="btn-principal w-full" onClick={enregistrer} disabled={!!occupe}>{occupe === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Enregistrer{x.statut === 'signe' ? ' (retire la signature)' : ''}</button>}
          </section>
          {x.envois.length > 0 && (
            <section className="carte p-4 text-sm">
              <h2 className="mb-1 text-lg font-semibold">Envois</h2>
              <ul className="space-y-1 text-xs text-nuit-600">{x.envois.map((e, i) => <li key={i}>{dateHeure(e.date)} → {e.a} ({e.par})</li>)}</ul>
            </section>
          )}
        </div>

        <div className="space-y-3">
          <div className="carte flex flex-wrap gap-2 p-3">
            {x.peutSigner
              ? <button className="btn-or" onClick={() => setPad(true)} disabled={!!occupe}>{occupe === 'sign' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}{signe ? 'Signer à nouveau' : 'Signer'}</button>
              : <span className="self-center rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Votre compte n'est pas autorisé à signer. Un administrateur peut l'ajouter dans Réglages → Paroisse → « Peuvent signer les extraits ».</span>}
            <button className="btn-clair" onClick={() => cadre.current.contentWindow.print()}><Printer className="h-4 w-4" />Imprimer</button>
            <button className="btn-clair" onClick={telecharger} disabled={!!occupe}>{occupe === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}PDF</button>
            <button className="btn-clair" onClick={() => setMail(true)} disabled={!signe} title={signe ? '' : "Signez d'abord l'extrait"}><Send className="h-4 w-4" />Envoyer par e-mail</button>
            <button className="btn-danger ml-auto" onClick={supprimer} disabled={!!occupe}>{occupe === 'suppr' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Supprimer</button>
          </div>
          {!sceau && <p className="rounded-lg bg-or-50 p-2.5 text-xs text-or-600">Le sceau paroissial n'est pas encore enregistré : ajoutez-le dans Réglages → Paroisse.</p>}
          <div className="overflow-hidden rounded-xl border border-nuit-100 bg-[#e9e6df]">
            <div style={{ height: 'min(1000px, 140vw)', overflow: 'hidden' }} className="relative">
              <iframe ref={cadre} title="extrait" srcDoc={html} className="origin-top-left" style={{ width: '210mm', height: '297mm', border: 0, transform: 'scale(var(--e, .85))' }} />
            </div>
          </div>
          <style>{`:root{--e:.85} @media (max-width:1100px){:root{--e:.62}} @media (max-width:640px){:root{--e:.44}}`}</style>
        </div>
      </div>

      {pad && <PadSignature nom={utilisateur.nom} onFermer={() => setPad(false)} onValider={signer} />}
      {mail && <Redaction mode="nouveau" a={x.valeurs?._demandeur || ''} sujet={`Extrait de baptême – ${x.nom}`}
        corps={`Bonjour,\n\nVeuillez trouver ci-joint l'extrait de baptême de ${x.nom}.\n\nBien fraternellement,`}
        envoiPersonnalise={async ({ a, sujet, corps, signature }) => api('extraits.envoyer', { id, a, sujet, corps, signatureMail: signature })}
        onFermer={() => setMail(false)} onEnvoye={(r) => { setMail(false); if (r?.envois) setX(r); notifier('Extrait envoyé') }}
        noteJointe={`Extrait de baptême – ${x.nom}.pdf (signé)`} />}
    </>
  )
}

/** Signature au doigt, au stylet ou à la souris. */
export function PadSignature({ nom, titre = "Signer l'extrait", consigne, note, onFermer, onValider }) {
  const canvas = useRef()
  const [vide, setVide] = useState(true)
  useEffect(() => {
    const c = canvas.current, ctx = c.getContext('2d')
    const ratio = window.devicePixelRatio || 1
    const l = c.offsetWidth
    c.width = l * ratio; c.height = l * 0.4 * ratio
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1b2a5c'
    let dessine = false, dernier = null
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
    const bas = (e) => { dessine = true; dernier = pos(e); c.setPointerCapture(e.pointerId); e.preventDefault() }
    const bouge = (e) => {
      if (!dessine) return
      const p = pos(e)
      ctx.beginPath(); ctx.moveTo(...dernier)
      const m = [(dernier[0] + p[0]) / 2, (dernier[1] + p[1]) / 2]
      ctx.quadraticCurveTo(dernier[0], dernier[1], m[0], m[1]); ctx.lineTo(...p); ctx.stroke()
      dernier = p; setVide(false); e.preventDefault()
    }
    const haut = () => { dessine = false }
    c.addEventListener('pointerdown', bas); c.addEventListener('pointermove', bouge)
    c.addEventListener('pointerup', haut); c.addEventListener('pointercancel', haut)
    return () => { c.removeEventListener('pointerdown', bas); c.removeEventListener('pointermove', bouge); c.removeEventListener('pointerup', haut); c.removeEventListener('pointercancel', haut) }
  }, [])

  function effacer() { const c = canvas.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); setVide(true) }
  function valider() {
    // recadre la signature sur la zone dessinée
    const c = canvas.current, ctx = c.getContext('2d')
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
    let x0 = width, y0 = height, x1 = 0, y1 = 0
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
    const m = 12, w = Math.min(width, x1 - x0 + 2 * m), h = Math.min(height, y1 - y0 + 2 * m)
    const sortie = document.createElement('canvas'); sortie.width = w; sortie.height = h
    sortie.getContext('2d').drawImage(c, Math.max(0, x0 - m), Math.max(0, y0 - m), w, h, 0, 0, w, h)
    onValider(sortie.toDataURL('image/png'))
  }
  return (
    <Modale titre={titre} onFermer={onFermer}
      pied={<><button className="btn-clair mr-auto" onClick={effacer}><Eraser className="h-4 w-4" />Effacer</button><button className="btn-clair" onClick={onFermer}>Annuler</button>
        <button className="btn-principal" onClick={valider} disabled={vide}><PenLine className="h-4 w-4" />Valider la signature</button></>}>
      <p className="mb-2 text-sm text-nuit-600">{consigne || <>Signez dans le cadre, au doigt, au stylet ou à la souris. Signature de <strong>{nom}</strong>.</>}</p>
      <canvas ref={canvas} className="w-full touch-none rounded-lg border-2 border-dashed border-nuit-100 bg-white" style={{ aspectRatio: '5 / 2' }} />
      <p className="mt-2 text-xs text-nuit-600/60">{note || "La signature est apposée avec le sceau sur l'extrait, puis le PDF signé est archivé dans le Drive."}</p>
    </Modale>
  )
}
