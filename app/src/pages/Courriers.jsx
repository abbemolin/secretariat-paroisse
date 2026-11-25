import { useEffect, useMemo, useRef, useState } from 'react'
import { FileSignature, Loader2, Printer, Send, FolderInput, ArrowLeft } from 'lucide-react'
import { api } from '../api.js'
import { useApp } from '../App.jsx'
import { htmlVersPdf } from '../pdf.js'
import { PadSignature, chargerSceau } from './Extraits.jsx'
import { Chargement, Erreur, Modale, useNotif } from '../ui.jsx'
import { TYPES } from '../types.js'

/** Variables utilisables dans les modèles (Réglages → Modèles). */
export const VARIABLES_COURRIER = [
  ['nom_complet', 'Prénoms et NOM'], ['prenoms', 'Prénoms'], ['nom', 'NOM'], ['ne_le', 'Date de naissance'], ['ne_a', '« , à » + lieu de naissance'],
  ['a_sacrement', '« au baptême », « à la confirmation »…'], ['du_sacrement', '« du baptême », « de la confirmation »…'],
  ['date_celebration', 'Date de la célébration'], ['lieu_celebration', 'Église de la célébration'], ['par_celebrant', '« , par » + célébrant'],
  ['charge', '« parrain », « marraine » (certificat)'], ['en_vue', '« , en vue du baptême de … » (certificat)'],
  ['recommande', 'Personne recommandée (lettre de recommandation)'], ['pour_motif', '« pour son inscription à … » (lettre de recommandation)'],
  ['paroisse', 'Paroisse'], ['diocese', 'Diocèse'], ['commune', 'Commune'], ['signataire', 'Nom du signataire'], ['fonction', 'Fonction du signataire'], ['date_du_jour', 'Date du jour']
]
const SACREMENTS = {
  bapteme: ['au baptême', 'du baptême'], catechumene: ['au baptême', 'du baptême'],
  premiere_communion: ['à la première communion', 'de la première communion'], profession_foi: ['à la profession de foi', 'de la profession de foi'],
  confirmation_jeune: ['à la confirmation', 'de la confirmation'], confirmand: ['à la confirmation', 'de la confirmation'],
  mariage: ['au mariage', 'du mariage'], obseques: ['aux obsèques', 'des obsèques']
}
const dateLongue = (s) => {
  if (!s) return ''
  const d = new Date(String(s).length === 10 ? s + 'T12:00:00' : s)
  return isNaN(d) ? String(s) : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}
const np = (p, n) => [p, String(n || '').toUpperCase()].filter(Boolean).join(' ')

function variables(d, r, sig) {
  const i = d.infos || {}
  let prenoms = i.prenoms, nom = i.nom, ne = i.naissance_date, lieu = i.naissance_lieu
  if (['bapteme', 'premiere_communion', 'profession_foi', 'confirmation_jeune'].includes(d.type)) { prenoms = i.enfant_prenoms; nom = i.enfant_nom; ne = i.enfant_naissance_date; lieu = i.enfant_naissance_lieu }
  if (d.type === 'obseques') { prenoms = i.defunt_prenoms; nom = i.defunt_nom; ne = i.defunt_naissance_date; lieu = '' }
  const complet = d.type === 'mariage' ? [np(i.fiancee_prenoms, i.fiancee_nom), np(i.fiance_prenoms, i.fiance_nom)].filter(Boolean).join(' et ') : np(prenoms, nom)
  const s = SACREMENTS[d.type] || ['', '']
  // Certificat parrain/marraine
  const filleul = np(i.filleul_prenoms, i.filleul_nom)
  const enVue = d.type === 'parrainage' && filleul ? `, en vue ${i.charge_sacrement === 'Confirmation' ? 'de la confirmation' : 'du baptême'} de ${filleul}${i.date_prevue ? ', prévu' + (i.charge_sacrement === 'Confirmation' ? 'e' : '') + ' le ' + dateLongue(i.date_prevue) : ''}${i.paroisse_prevue ? ' (' + i.paroisse_prevue + ')' : ''}` : ''
  const charge = d.type === 'parrainage' && i.charge ? i.charge.toLowerCase() + (i.charge_sacrement === 'Confirmation' ? ' de confirmation' : '') : 'parrain ou de marraine'
  // Lettre de recommandation
  const enfant = np(i.enfant_prenoms, i.enfant_nom)
  const recommande = d.type === 'recommandation' && enfant ? `${enfant}, enfant de ${np(i.prenoms, i.nom)}` : np(i.prenoms, i.nom) || d.nom
  const org = i.destinataire_organisme || '…'
  const pourMotif = d.type !== 'recommandation' ? '' : ({
    'École catholique': ` pour son inscription à ${org}${i.classe ? ' (' + i.classe + ')' : ''}`,
    'Emploi ou bénévolat': ` pour sa candidature auprès de ${org}`,
    'Vie religieuse, séminaire': ` dans sa démarche auprès de ${org}`,
    'Foyer étudiant': ` pour son admission à ${org}`
  })[i.motif] ?? (i.motif_autre ? ` (${i.motif_autre}, ${org})` : ` auprès de ${org}`)
  return {
    charge, en_vue: enVue, recommande, pour_motif: pourMotif,
    nom_complet: complet || d.nom, prenoms: prenoms || '', nom: String(nom || '').toUpperCase(), ne_le: dateLongue(ne) || '…', ne_a: lieu ? ', à ' + lieu : '',
    a_sacrement: s[0], du_sacrement: s[1], date_celebration: dateLongue(d.date_celebration || i.date_souhaitee) || '…',
    lieu_celebration: i.lieu_celebration || r.eglise || '…', par_celebrant: i.celebrant ? ', par ' + i.celebrant : '',
    paroisse: r.paroisse || '', diocese: r.diocese || '', commune: r.commune || '', signataire: sig?.nom || '', fonction: (sig?.fonction || '').toLowerCase(),
    date_du_jour: dateLongue(new Date().toISOString())
  }
}
const remplir = (t, v) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m))
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Lettre A4 à en-tête de la paroisse. sign : { signature, sceau } (images) facultatif. */
function htmlLettre({ objet, corps, destinataire, signataire, fonction, fait }, r, sign = {}) {
  const logo = new URL('logo.png', location.href).href
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(objet || 'Courrier')}</title><style>
    @page{size:A4;margin:0} *{box-sizing:border-box} body{margin:0;font-family:Georgia,'Times New Roman',serif;color:#222}
    .page{width:210mm;min-height:297mm;padding:16mm 22mm 20mm;position:relative}
    .tete{display:flex;align-items:center;gap:5mm;border-bottom:0.5mm solid #521a22;padding-bottom:4mm}
    .tete img{width:20mm;height:20mm;object-fit:contain} .tete .p{font-size:15pt;color:#521a22;font-weight:bold} .tete .a{font-family:Arial,sans-serif;font-size:8.5pt;color:#666;margin-top:1mm}
    .dest{margin:12mm 0 0 95mm;white-space:pre-line;font-size:11pt;min-height:8mm} .fait{margin:8mm 0 0 95mm;font-size:11pt}
    .objet{margin:10mm 0 6mm;font-size:11.5pt} .objet b{font-family:Arial,sans-serif;font-size:9pt;text-transform:uppercase;letter-spacing:.5px;color:#521a22;margin-right:2mm}
    .corps{white-space:pre-line;font-size:11.5pt;line-height:1.55;text-align:justify}
    .sig{display:flex;justify-content:flex-end;gap:10mm;margin-top:12mm;align-items:flex-start}
    .sig .n{text-align:center;font-size:11pt;min-width:60mm} .sig .f{font-size:10pt;color:#555}
    .pied{position:absolute;bottom:10mm;left:22mm;right:22mm;border-top:0.3mm solid #ddd;padding-top:2mm;font-family:Arial,sans-serif;font-size:7.5pt;color:#888;text-align:center}
    @media screen{body{background:#e9e6df}.page{background:#fff;margin:0 auto;box-shadow:0 2px 12px rgba(0,0,0,.15)}}</style></head><body><div class="page">
    <div class="tete"><img src="${logo}" alt=""><div><div class="p">${esc(r.paroisse)}</div><div class="a">${esc(r.adresse || '')}${r.site ? ' · ' + esc(r.site) : ''} · Diocèse de ${esc(r.diocese)}</div></div></div>
    <div class="dest">${esc(destinataire)}</div>
    <div class="fait">${esc(r.commune)}, le ${esc(fait)}</div>
    ${objet ? `<div class="objet"><b>Objet</b>${esc(objet)}</div>` : '<div style="height:10mm"></div>'}
    <div class="corps">${esc(corps)}</div>
    <div class="sig">${sign.sceau ? `<img src="${sign.sceau}" style="max-width:32mm;max-height:32mm;opacity:.92">` : ''}
      <div class="n">${sign.signature ? `<img src="${sign.signature}" style="max-width:58mm;max-height:24mm;display:block;margin:0 auto 1mm">` : '<div style="height:20mm"></div>'}${esc(signataire)}<div class="f">${esc(fonction)}</div></div></div>
    <div class="pied">${esc(r.paroisse)} · ${esc(r.adresse || '')}</div>
  </div></body></html>`
}

/** Fenêtre « Courriers » d'un dossier : choix du modèle, texte pré-rempli modifiable, signature + sceau, rangement et envoi. */
/** Destinataire pré-rempli sur la lettre (certificat : paroisse de la célébration ; recommandation : organisme). */
function destinataireDe(d) {
  const i = d.infos || {}
  if (d.type === 'parrainage') return i.paroisse_prevue ? `Monsieur le Curé\n${i.paroisse_prevue}` : ''
  if (d.type === 'recommandation') return [i.destinataire_personne, i.destinataire_organisme, /@/.test(i.destinataire_adresse || '') ? '' : i.destinataire_adresse].filter(Boolean).join('\n')
  return ''
}
/** Adresse mail où envoyer le courrier signé (par défaut : celle du demandeur). */
function mailDe(d) {
  const i = d.infos || {}, m = (x) => (String(x || '').match(/[^\s<>,;]+@[^\s<>,;]+\.[^\s<>,;]+/) || [])[0]
  return (d.type === 'parrainage' && m(i.envoyer_a)) || (d.type === 'recommandation' && m(i.destinataire_adresse)) || i.email || d.email || ''
}

export default function Courriers({ dossier, onFermer, onFait }) {
  const { reglages: r, utilisateur } = useApp()
  const notifier = useNotif()
  const [data, setData] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [modele, setModele] = useState(null)
  const [v, setV] = useState(null)
  const [sigCle, setSigCle] = useState('cure')
  const [pad, setPad] = useState(false)
  const [signe, setSigne] = useState(null)   // { pdf (base64), html }
  const [a, setA] = useState(mailDe(dossier))
  const [occupe, setOccupe] = useState('')
  const cadre = useRef()
  const peutSigner = utilisateur.role === 'admin' || !!utilisateur.acces?.signer
  useEffect(() => { api('modeles').then(setData).catch(setErreur) }, [])
  // Certificat parrain/marraine, lettre de recommandation : le bon modèle s'ouvre directement
  const direct = TYPES[dossier.type]?.courrier
  useEffect(() => { if (direct && data && !modele) { const m = data.modeles.find((x) => x.cle === direct); if (m) choisir(m) } }, [data])   // eslint-disable-line react-hooks/exhaustive-deps
  const signataires = useMemo(() => (data?.signatures || []).filter((x) => x.cle !== 'paroisse'), [data])
  const sig = signataires.find((x) => x.cle === sigCle) || signataires[0]

  function choisir(m) {
    const vars = variables(dossier, r, sig)
    setModele(m)
    setV({ objet: remplir(m.objet, vars), corps: remplir(m.corps, vars), destinataire: destinataireDe(dossier), fait: vars.date_du_jour })
    setSigne(null)
  }
  function changerSignataire(cle) {
    const ancien = sig, nouveau = signataires.find((x) => x.cle === cle)
    setSigCle(cle)
    if (v && ancien && nouveau) setV({ ...v, corps: v.corps.split(ancien.nom).join(nouveau.nom).split((ancien.fonction || '').toLowerCase()).join((nouveau.fonction || '').toLowerCase()) })
  }
  const valeurs = v && { ...v, signataire: sig?.nom || '', fonction: sig?.fonction || '' }
  const html = valeurs ? htmlLettre(valeurs, r) : ''

  async function signer(png) {
    setPad(false); setOccupe('signer')
    try {
      const sceau = await chargerSceau()
      const h = htmlLettre(valeurs, r, { signature: png, sceau })
      const { base64 } = await htmlVersPdf(h)
      setSigne({ pdf: base64, html: h })
    } catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }
  async function ranger(envoyer) {
    setOccupe(envoyer ? 'envoyer' : 'ranger')
    try {
      const corps = `Bonjour,\n\nVous trouverez ci-joint : ${modele.titre.toLowerCase()}${v.objet ? ' (' + v.objet + ')' : ''}.\n\nAvec l'assurance de nos prières à toutes vos intentions,`
      const x = await api('dossiers.courrier', { dossierId: dossier.id, pdf: signe.pdf, libelle: v.objet || modele.titre, ...(envoyer ? { a, sujet: v.objet || modele.titre, corps, signatureMail: sigCle } : {}) })
      notifier(envoyer ? `Rangé dans le dossier et envoyé à ${a}` : 'Rangé dans les pièces du dossier')
      onFait?.(x); onFermer()
    } catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }

  if (!modele) return (
    <Modale titre="Courriers" onFermer={onFermer}>
      <Erreur erreur={erreur} />
      {!data ? <Chargement /> : (
        <div className="grid gap-2 sm:grid-cols-2">
          {data.modeles.map((m) => (
            <button key={m.cle} onClick={() => choisir(m)} className="carte flex items-start gap-3 p-3 text-left hover:border-or">
              <FileSignature className="mt-0.5 h-5 w-5 shrink-0 text-or" /><span><span className="block font-medium">{m.titre}</span><span className="text-xs text-nuit-600/70">{m.objet ? m.objet.replace(/\{\w+\}/g, '…') : 'Texte libre, à en-tête de la paroisse'}</span></span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-nuit-600/75">Les textes se modifient dans Réglages → Modèles.</p>
    </Modale>
  )

  return (
    <>
      <Modale large titre={modele.titre} onFermer={onFermer} pied={signe ? <>
        <button className="btn-clair mr-auto" onClick={() => setSigne(null)}><ArrowLeft className="h-4 w-4" />Modifier</button>
        <button className="btn-clair" disabled={!!occupe} onClick={() => ranger(false)}>{occupe === 'ranger' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderInput className="h-4 w-4" />}Ranger dans le dossier</button>
        <button className="btn-principal" disabled={!!occupe || !/\S+@\S+\.\S+/.test(a)} onClick={() => ranger(true)}>{occupe === 'envoyer' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Ranger et envoyer</button>
      </> : <>
        <button className="btn-clair mr-auto" onClick={() => setModele(null)}><ArrowLeft className="h-4 w-4" />Modèles</button>
        <button className="btn-clair" onClick={() => cadre.current.contentWindow.print()}><Printer className="h-4 w-4" />Imprimer sans signer</button>
        {peutSigner && <button className="btn-principal" disabled={!!occupe} onClick={() => setPad(true)}>{occupe === 'signer' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}Signer</button>}
      </>}>
        <div className="grid gap-4 md:grid-cols-[300px_1fr]">
          <div className="space-y-2 md:max-h-[62vh] md:overflow-y-auto md:pr-2">
            {signe ? (
              <>
                <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Signé, avec le sceau. Rangez-le dans les pièces du dossier, ou rangez-le et envoyez-le par mail en pièce jointe.</p>
                <label className="etiquette">Envoyer à</label>
                <input className="champ py-1.5 text-sm" type="email" value={a} onChange={(e) => setA(e.target.value)} placeholder="adresse@exemple.fr" />
              </>
            ) : (
              <>
                <label className="etiquette">Signataire</label>
                <select className="champ py-1.5 text-sm" value={sig?.cle || ''} onChange={(e) => changerSignataire(e.target.value)}>{signataires.map((x) => <option key={x.cle} value={x.cle}>{x.nom} — {x.fonction}</option>)}</select>
                <label className="etiquette">Destinataire (adresse sur la lettre, facultatif)</label>
                <textarea className="champ min-h-[64px] py-1.5 text-sm" value={v.destinataire} onChange={(e) => setV({ ...v, destinataire: e.target.value })} />
                <label className="etiquette">Objet</label>
                <input className="champ py-1.5 text-sm" value={v.objet} onChange={(e) => setV({ ...v, objet: e.target.value })} />
                <label className="etiquette">Texte</label>
                <textarea className="champ min-h-[260px] py-1.5 text-sm leading-relaxed" value={v.corps} onChange={(e) => setV({ ...v, corps: e.target.value })} />
              </>
            )}
          </div>
          <div className="overflow-hidden rounded-lg border border-nuit-100 bg-[#e9e6df]">
            <div style={{ height: 480, overflow: 'hidden' }}>
              <iframe ref={cadre} title="aperçu" srcDoc={signe ? signe.html : html} style={{ width: '210mm', height: '297mm', border: 0, transform: 'scale(0.51)', transformOrigin: 'top left' }} />
            </div>
          </div>
        </div>
      </Modale>
      {pad && <PadSignature titre={`Signer : ${modele.titre.toLowerCase()}`} nom={sig?.nom || utilisateur.nom}
        consigne={<>Signature de <strong>{sig?.nom || utilisateur.nom}</strong>.</>} onFermer={() => setPad(false)} onValider={signer} />}
    </>
  )
}
