import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookMarked, Loader2, Printer, PenLine } from 'lucide-react'
import { api } from '../api.js'
import { useApp } from '../App.jsx'
import { TYPES } from '../types.js'
import { Chargement, Erreur, EnTete, Modale, useNotif, imprimerHtml, dateCourte } from '../ui.jsx'

/** Fenêtre « Inscription au registre » : année et numéro d'acte proposés (modifiables), doublons refusés par le serveur. */
export function InscriptionRegistre({ id, nom, onFermer, onInscrit }) {
  const notifier = useNotif()
  const [p, setP] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [annee, setAnnee] = useState('')
  const [numero, setNumero] = useState('')
  useEffect(() => { api('registres', { dossier: id }).then((x) => { setP(x); setAnnee(x.annee); setNumero(x.numero) }).catch(setErreur) }, [id])
  async function changerAnnee(a) {
    setAnnee(a)
    if (/^\d{4}$/.test(a)) try { const x = await api('registres', { dossier: id, annee: a }); setNumero(x.numero) } catch { /* ignore */ }
  }
  async function inscrire() {
    setEnvoi(true); setErreur(null)
    try { const d = await api('registres', { inscrire: { id, annee, numero } }); notifier(`Inscrit au registre : ${annee} n° ${numero}`); onInscrit?.(d); onFermer() }
    catch (e) { setErreur(e) } finally { setEnvoi(false) }
  }
  return (
    <Modale titre="Inscription au registre" onFermer={onFermer} pied={<>
      <button className="btn-clair" onClick={onFermer}>Annuler</button>
      <button className="btn-principal" disabled={!p || envoi || !annee || !numero} onClick={inscrire}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Inscrire</button>
    </>}>
      {!p && !erreur ? <Chargement /> : (
        <div className="space-y-4">
          {p && <p className="text-sm text-nuit-600/80">Registre des <b>{p.nom_registre.toLowerCase()}</b> — {nom}</p>}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm"><span className="mb-1 block text-nuit-600/80">Année du registre</span><input className="champ" inputMode="numeric" value={annee} onChange={(e) => changerAnnee(e.target.value)} /></label>
            <label className="block text-sm"><span className="mb-1 block text-nuit-600/80">Acte n°</span><input className="champ" value={numero} onChange={(e) => setNumero(e.target.value)} autoFocus /></label>
          </div>
          <p className="text-xs text-nuit-600/60">Numéro proposé : le suivant de l'année. Vous pouvez le changer ; un numéro déjà attribué cette année est refusé.</p>
          <Erreur erreur={erreur} />
        </div>
      )}
    </Modale>
  )
}

function imprimerTable(d, paroisse) {
  const e = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const nomReg = d.registres.find((r) => r.cle === d.registre)?.nom || ''
  let lettre = ''
  const lignes = d.table.map((x) => {
    const l = (x.nom || '?')[0].toUpperCase()
    const tete = l !== lettre ? `<tr><td colspan="4" class="lettre">${e(l)}</td></tr>` : ''
    lettre = l
    return `${tete}<tr><td><b>${e(x.nom)}</b></td><td>${e(x.prenoms)}</td><td>${x.date ? e(dateCourte(x.date)) : ''}</td><td class="n">${e(x.numero)}</td></tr>`
  }).join('')
  imprimerHtml(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Table alphabétique – ${e(nomReg)} ${e(d.annee)}</title><style>
    @page{size:A4;margin:16mm} body{font-family:Georgia,serif;color:#222} h1{color:#521a22;font-size:20pt;margin:0 0 1mm} .sous{color:#666;margin:0 0 7mm;font-family:Arial,sans-serif;font-size:10pt}
    table{width:100%;border-collapse:collapse;font-size:11pt} th{text-align:left;border-bottom:2px solid #521a22;padding:1.5mm 2mm;font-family:Arial,sans-serif;font-size:9pt;text-transform:uppercase;color:#521a22}
    td{border-bottom:1px solid #e3e3e3;padding:1.5mm 2mm} td.n,th.n{text-align:right;width:18mm} td.lettre{font-weight:bold;color:#a8662e;padding-top:4mm;border-bottom:1px solid #a8662e}
    .total{margin-top:5mm;color:#666;font-size:10pt;font-family:Arial,sans-serif}</style></head><body>
    <h1>Registre des ${e(nomReg.toLowerCase())} – ${e(d.annee)}</h1><p class="sous">Table alphabétique · ${e(paroisse)}</p>
    <table><thead><tr><th>Nom</th><th>Prénom(s)</th><th>Date</th><th class="n">Acte n°</th></tr></thead><tbody>${lignes}</tbody></table>
    <p class="total">${d.table.length} nom${d.table.length > 1 ? 's' : ''}</p></body></html>`)
}

export default function Registres() {
  const { reglages, ecrit } = useApp()
  const notifier = useNotif()
  const [params, setParams] = useSearchParams()
  const registre = params.get('r') || 'baptemes'
  const annee = params.get('a') || String(new Date().getFullYear())
  const [d, setD] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [inscrire, setInscrire] = useState(null)
  const [depart, setDepart] = useState('')
  const charger = () => api('registres', { registre, annee }).then((x) => { setD(x); setDepart(String(x.depart || 0)) }).catch(setErreur)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger() }, [registre, annee])
  const aller = (r, a) => setParams({ r, a }, { replace: true })
  async function enregistrerDepart() {
    try { setD(await api('registres', { registre, annee, depart: { registre, annee, numero: depart } })); notifier('Enregistré') } catch (e) { notifier(e.message, 'erreur') }
  }
  return (
    <>
      <EnTete titre="Registres" sousTitre="Numéros d'actes, actes à inscrire et table alphabétique de l'année"
        actions={d && <button className="btn-clair" disabled={!d.table.length} onClick={() => imprimerTable(d, reglages?.paroisse || '')}><Printer className="h-4 w-4" />Imprimer la table</button>} />
      <Erreur erreur={erreur} />
      {!d ? <Chargement /> : (
        <>
          <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1">
            {d.registres.map((r) => (
              <button key={r.cle} onClick={() => aller(r.cle, annee)} className={`pastille shrink-0 border px-3 py-1.5 text-sm ${r.cle === registre ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>
                {r.nom}{r.a_inscrire > 0 && <span className="ml-1.5 rounded-full bg-or px-1.5 text-[11px] text-white">{r.a_inscrire}</span>}
              </button>
            ))}
          </div>

          {d.a_inscrire.length > 0 && (
            <section className="carte mb-5 border-or/40 p-4">
              <h2 className="mb-2 text-xl font-semibold">Actes à inscrire</h2>
              <ul className="divide-y divide-nuit-50 text-sm">
                {d.a_inscrire.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-3 py-2">
                    <div className="min-w-0 flex-1"><Link to={`/dossiers/${x.id}`} className="block truncate font-medium hover:underline">{x.nom}</Link>
                      <span className="text-xs text-nuit-600/70">{TYPES[x.type]?.nom}{x.date ? ' · ' + dateCourte(x.date) : ''}</span></div>
                    <button className="btn-clair text-sm" onClick={() => setInscrire(x)}><PenLine className="h-4 w-4" />Inscrire</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="carte p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="flex-1 text-xl font-semibold">Table alphabétique</h2>
              <select className="champ w-auto" value={annee} onChange={(e) => aller(registre, e.target.value)}>
                {d.annees.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {!d.table.length ? <p className="py-6 text-center text-sm text-nuit-600/60"><BookMarked className="mx-auto mb-2 h-6 w-6 opacity-40" />Aucun acte inscrit en {annee}.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-nuit-100 text-left text-xs uppercase text-nuit-600/60"><th className="py-1.5">Nom</th><th>Prénom(s)</th><th className="hidden sm:table-cell">Date</th><th className="text-right">Acte n°</th></tr></thead>
                <tbody className="divide-y divide-nuit-50">
                  {d.table.map((x, i) => (
                    <tr key={i}><td className="py-1.5"><Link to={`/dossiers/${x.id}`} className="font-medium hover:underline">{x.nom}</Link></td><td>{x.prenoms}</td><td className="hidden text-nuit-600/70 sm:table-cell">{x.date ? dateCourte(x.date) : ''}</td><td className="text-right tabular-nums">{x.numero}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-nuit-600/60">Prochain numéro proposé en {annee} : <b>{d.prochain}</b></p>
            {ecrit('registres') && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-nuit-50 pt-3 text-sm">
                <span className="text-nuit-600/80">Dernier acte de {annee} inscrit avant l'application :</span>
                <input className="champ w-20" inputMode="numeric" value={depart} onChange={(e) => setDepart(e.target.value.replace(/\D/g, ''))} />
                <button className="btn-clair text-sm" onClick={enregistrerDepart}>Enregistrer</button>
              </div>
            )}
          </section>
        </>
      )}
      {inscrire && <InscriptionRegistre id={inscrire.id} nom={inscrire.nom} onFermer={() => setInscrire(null)} onInscrit={() => charger()} />}
    </>
  )
}
