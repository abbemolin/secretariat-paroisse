import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, HeartHandshake, Loader2, Mail, Plus, Search, Trash2, UserPlus, Users, Crown, Check, BellRing, Pencil, FolderHeart, CalendarPlus, Sparkles, Import, MessageSquare, Link2, Copy, RefreshCw, Send, CalendarDays } from 'lucide-react'
import { api } from '../api.js'
import { TYPES, prochaineEtape, ETATS } from '../types.js'
import { Chargement, Erreur, Modale, Vide, useCharger, useNotif, useConfirmer, useDifferer, enSuppression, Aide } from '../ui.jsx'
import { Redaction } from './Courrier.jsx'
import { useSelection, BoutonSelection, Case, BarreSelection, useActionGroupee } from '../selection.jsx'

export const COULEURS_PROFILS = {
  'Catéchumène': 'bg-amber-100 text-amber-900', 'Confirmand': 'bg-rose-100 text-rose-900', 'Néophyte': 'bg-emerald-100 text-emerald-900',
  'Nouveau à la paroisse': 'bg-sky-100 text-sky-900', 'Recommençant': 'bg-violet-100 text-violet-900', 'Paroissien': 'bg-nuit-50 text-nuit-600'
}
const COURT = { 'Nouveau à la paroisse': 'Nouveau', 'Paroissien': 'Paroissien' }
const anneeSuivante = (a) => { const n = Number(String(a).slice(0, 4)) + 1; return `${n}-${n + 1}` }
const nomComplet = (m) => `${m.prenoms} ${String(m.nom).toUpperCase()}`.trim()

function Profils({ m, sansParoissien = true }) {
  return (
    <>
      {m.profils.filter((p) => !sansParoissien || p !== 'Paroissien').map((p) => <span key={p} className={`pastille py-0 text-xs ${COULEURS_PROFILS[p] || ''}`}>{COURT[p] || p}</span>)}
      {m.nouveau && m.statut !== 'ancien' && <span className="pastille bg-or text-white py-0 text-xs">Nouveau dans l'équipe</span>}
      {m.chef_possible && <span className="pastille gap-0.5 border border-or py-0 text-xs text-or-600"><Crown className="h-2.5 w-2.5" />chef possible</span>}
      {m.dossiers.map((d) => <Link key={d.id} to={`/dossiers/${d.id}`} onClick={(e) => e.stopPropagation()} className="pastille gap-0.5 border py-0 text-xs hover:underline" style={{ borderColor: TYPES[d.type]?.couleur, color: TYPES[d.type]?.couleur }}><FolderHeart className="h-2.5 w-2.5" />{TYPES[d.type]?.nom}</Link>)}
    </>
  )
}

export default function CorUnum() {
  const notifier = useNotif()
  const differer = useDifferer()
  const confirmer = useConfirmer()
  const [params, setParams] = useSearchParams()
  const annee = params.get('annee') || ''
  const onglet = params.get('vue') || 'equipes'
  const [texte, setTexte] = useState('')
  const [occupe, setOccupe] = useState('')
  const [fiche, setFiche] = useState(null)
  const [equipeEdit, setEquipeEdit] = useState(null)
  const [mail, setMail] = useState(null)
  const [fil, setFil] = useState(null)
  const [lien, setLien] = useState(null)
  const [tousChefs, setTousChefs] = useState(false)
  const { data, setData, chargement, erreur, recharger } = useCharger(() => api('cor.liste', { annee }), [annee], ['cor.liste', { annee }])
  const changer = (p) => setParams(Object.fromEntries(Object.entries({ annee, vue: onglet, ...p }).filter(([, v]) => v)))
  useEffect(() => { const id = params.get('fiche'); if (id && data) { const m = data.membres.find((x) => x.id === id); if (m) setFiche(m) } }, [params, data])

  const membres = (data?.membres || []).filter((m) => !enSuppression.has(m.id))
  const equipes = data?.equipes || []
  const nomEquipe = (id) => equipes.find((e) => e.id === id)?.nom || ''
  const actifs = membres.filter((m) => m.statut !== 'ancien')
  const aRepartir = actifs.filter((m) => !m.equipe_id)
  const chefsPossibles = actifs.filter((m) => m.chef_possible)
  const filtre = (l) => l.filter((m) => !texte || `${m.nom} ${m.prenoms} ${m.email}`.toLowerCase().includes(texte.toLowerCase()))

  async function action(nom, fn, msg) {
    setOccupe(nom)
    try { const r = await fn(); if (r?.membres) setData(r); else if (r?.liste) setData(r.liste); if (msg) notifier(typeof msg === 'function' ? msg(r) : msg) }
    catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }
  const s = useSelection()
  const lancer = useActionGroupee()
  useEffect(() => { if (onglet !== 'tous') s.quitter() }, [onglet])  // eslint-disable-line react-hooks/exhaustive-deps
  function statutLot(statut) {
    const ids = s.ids().filter((id) => { const m = membres.find((x) => x.id === id); return m && (statut === 'ancien' ? m.statut !== 'ancien' : m.statut === 'ancien') })
    const n = ids.length
    if (!n) { notifier(statut === 'ancien' ? 'Ces personnes sont déjà anciennes.' : 'Aucun ancien dans la sélection.', 'erreur'); return }
    const avant = data
    lancer({
      titre: statut === 'ancien' ? `Passer ${n} personne${n > 1 ? 's' : ''} en « ancien »` : `Réactiver ${n} personne${n > 1 ? 's' : ''}`,
      texte: (statut === 'ancien' ? 'Elles ne seront plus comptées dans les fraternités de cette année (fiches conservées) : ' : 'Elles redeviennent actives : ') + ids.map((id) => nomComplet(membres.find((x) => x.id === id))).slice(0, 12).join(', ') + (n > 12 ? '…' : ''),
      appliquer: () => { setData((d) => ({ ...d, membres: d.membres.map((x) => ids.includes(x.id) ? { ...x, statut } : x) })); s.vider() },
      annuler: () => setData(avant),
      executer: async () => { const r = await api('cor.modifier', { ids, annee: data.annee, statut }); setData(r); return { faits: n } },
      verbe: statut === 'ancien' ? 'passé en ancien' : 'réactivé'
    })
  }
  const placer = (ids, equipe_id) => action('placer', () => api('cor.modifier', { ids, annee: data.annee, equipe_id }), ids.length > 1 ? `${ids.length} personnes placées` : 'Placé dans l\'équipe')

  function mailChef(e) {
    const ms = actifs.filter((m) => m.equipe_id === e.id)
    const chefs = membres.filter((m) => e.chefs.includes(m.id))
    const ligne = (m) => `- ${nomComplet(m)}${m.telephone ? ' – ' + m.telephone : ''}${m.email ? ' – ' + m.email : ''}${m.profils.filter((p) => p !== 'Paroissien').length ? ' (' + m.profils.filter((p) => p !== 'Paroissien').join(', ').toLowerCase() + ')' : ''}`
    const nouveaux = ms.filter((m) => m.nouveau)
    const corps = `Bonjour ${chefs.map((c) => c.prenoms).join(' et ') || ''},\n\nVoici la liste de votre fraternité Cor Unum pour l'année ${data.annee} (${ms.length} inscrit${ms.length > 1 ? 's' : ''}) :\n\n${ms.map(ligne).join('\n')}` +
      (nouveaux.length ? `\n\nNouveaux dans votre équipe cette année, à bien accueillir :\n${nouveaux.map((m) => `- ${nomComplet(m)}${m.souhait ? ' (souhaitait retrouver : ' + m.souhait + ')' : ''}`).join('\n')}` : '') +
      '\n\nMerci pour votre service.\n\nAvec l\'assurance de nos prières à toutes vos intentions,'
    setMail({ a: chefs.map((c) => c.email).filter(Boolean).join(', '), sujet: `Fraternité Cor Unum ${data.annee} – votre équipe`, corps })
  }
  function mailEquipe(e) {
    const ids = actifs.filter((m) => m.equipe_id === e.id).map((m) => m.id)
    setMail({ destinataires: `Fraternité ${e.nom} — ${ids.length} fiche${ids.length > 1 ? 's' : ''}, en copie cachée`, sujet: `Fraternité Cor Unum – équipe ${e.nom}`, corps: 'Bonjour à tous,\n\n\n\nAvec l\'assurance de nos prières à toutes vos intentions,', ids })
  }
  function relancer(e) {
    const ids = membres.filter((m) => m.statut === 'ancien' && (!e || m.equipe_id === e.id)).map((m) => m.id)
    if (!data.lien_formulaire) { notifier('Ajoutez d\'abord le lien du formulaire dans Réglages → Cor Unum.', 'erreur'); return }
    const B = "S'inscrire aux fraternités Cor Unum"
    setMail({ destinataires: `Anciens membres${e ? ' de la fraternité ' + e.nom : ''} pas encore réinscrits — ${ids.length} fiche${ids.length > 1 ? 's' : ''}, en copie cachée`, ids,
      sujet: `Fraternités Cor Unum ${data.annee}`,
      corps: `Bonjour,\n\nLes fraternités Cor Unum reprennent pour l'année ${data.annee}${e ? ', et votre équipe (' + e.nom + ') serait heureuse de vous retrouver' : ''}. Pour vous réinscrire, il suffit de cliquer ici :\n[Bouton : ${B}]\n\nAvec l'assurance de nos prières à toutes vos intentions,`,
      boutons: [{ texte: B, url: data.lien_formulaire }] })
  }
  async function supprimerEquipe(e) {
    if (!(await confirmer({ titre: 'Supprimer la fraternité', texte: `La fraternité ${e.nom} sera supprimée ; ses membres passent « à répartir ».`, bouton: 'Supprimer', danger: true }))) return
    action('suppr', () => api('cor.equipe', { annee: data.annee, supprimer: e.id }), 'Fraternité supprimée')
  }
  async function nouvelleAnnee() {
    const vers = anneeSuivante(data.annee)
    if (!(await confirmer({ titre: `Préparer ${vers}`, texte: `Les fraternités et leurs chefs sont reconduits en ${vers}. Les membres actuels y apparaissent comme « anciens » jusqu'à leur réinscription par le formulaire.\n\nPensez à ajouter la feuille de réponses ${vers} dans Réglages → Cor Unum.`, bouton: 'Préparer' }))) return
    setOccupe('annee')
    try { await api('cor.nouvelleAnnee', { de: data.annee, vers }); changer({ annee: vers }); notifier(`Année ${vers} préparée`) } catch (e) { notifier(e.message, 'erreur') } finally { setOccupe('') }
  }

  const ONGLETS = [['equipes', 'Fraternités', equipes.length], ['repartir', 'À répartir', aRepartir.length], ['chefs', 'Chefs possibles', chefsPossibles.length], ['tous', 'Tout le monde', membres.length]]

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-semibold">Fraternités Cor Unum</h1><p className="text-sm text-nuit-600/80">Inscriptions, équipes et chefs</p></div>
        <div className="flex flex-wrap gap-2">
          {data && <select className="champ w-auto py-2" value={data.annee} onChange={(e) => changer({ annee: e.target.value })}>{data.annees.map((a) => <option key={a}>{a}</option>)}</select>}
          <button className="btn-clair" disabled={!!occupe} onClick={() => action('import', () => api('cor.importer', { annee: data?.annee }).then(async (r) => { const l = await api('cor.liste', { annee: data?.annee }); return { ...l, _r: r } }), (r) => r._r.nouvelles || r._r.fusionnees ? `${r._r.nouvelles} nouvelle(s), ${r._r.fusionnees} mise(s) à jour` : 'Aucune nouvelle réponse')}>
            {occupe === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="hidden sm:inline">Importer le formulaire</span></button>
          <button className="btn-clair" onClick={() => setFiche({ nouveau: true })}><UserPlus className="h-4 w-4" /><span className="hidden sm:inline">Ajouter</span></button>
          <button className="btn-or" onClick={() => setEquipeEdit({ nom: '', chefs: [] })}><Plus className="h-4 w-4" />Fraternité</button>
        </div>
      </div>
      <Erreur erreur={erreur} reessayer={recharger} />
      {chargement && !data ? <Chargement /> : data && (
        <>
          {!data.onglets_repris && (
            <div className="carte mb-4 flex flex-wrap items-center gap-3 border-l-4 border-l-or p-4">
              <Import className="h-5 w-5 text-or" />
              <p className="flex-1 text-sm">Reprendre une fois les fraternités des onglets « Equipe … » de la feuille {data.annee} : chefs, membres (et anciens sous la ligne vide). Les fiches d'un même foyer sont regroupées.</p>
              <button className="btn-principal" disabled={!!occupe} onClick={() => action('onglets', () => api('cor.onglets', { annee: data.annee }), (r) => `${r.equipes} fraternités, ${r.membres} membres, ${r.anciens} anciens repris`)}>{occupe === 'onglets' && <Loader2 className="h-4 w-4 animate-spin" />}Reprendre les fraternités</button>
              <Aide>Une seule fois : lit les onglets « Equipe … » de la feuille. Les personnes sous la ligne vide deviennent « anciens ». Les fiches déjà venues du formulaire sont fusionnées.</Aide>
            </div>
          )}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[['Inscrits cette année', actifs.length, Users], ['Fraternités', equipes.length, HeartHandshake], ['À répartir', aRepartir.length, Sparkles], ['Anciens à relancer', membres.filter((m) => m.statut === 'ancien').length, BellRing]].map(([l, v, I]) => (
              <div key={l} className="carte flex items-center gap-3 p-4"><I className="h-6 w-6 shrink-0 text-or" /><div><div className="text-xl font-semibold">{v}</div><div className="text-xs text-nuit-600/70">{l}</div></div></div>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="barre-onglets flex-1">
              {ONGLETS.map(([k, l, n]) => <button key={k} onClick={() => changer({ vue: k })} className={`pastille shrink-0 gap-1.5 border py-1 ${onglet === k ? 'border-nuit bg-nuit text-white' : 'border-nuit-100 bg-white text-nuit-600'}`}>{l}<span className="opacity-60">{n}</span></button>)}
            </div>
            <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-nuit-600/75" /><input className="champ pl-9" placeholder="Rechercher…" value={texte} onChange={(e) => setTexte(e.target.value)} /></div>
          </div>

          {onglet === 'equipes' && (
            <div className="grid gap-4 lg:grid-cols-2">
              {!equipes.length && <div className="carte lg:col-span-2"><Vide icone={HeartHandshake} texte="Aucune fraternité pour cette année." /></div>}
              {equipes.map((e) => {
                const ms = filtre(actifs.filter((m) => m.equipe_id === e.id))
                const anciens = filtre(membres.filter((m) => m.statut === 'ancien' && m.equipe_id === e.id))
                const chefs = membres.filter((m) => e.chefs.includes(m.id))
                return (
                  <section key={e.id} className="carte flex flex-col p-4">
                    <div className="mb-2 flex items-start gap-2">
                      <div className="flex-1"><h2 className="text-xl font-semibold">Fraternité {e.nom}</h2>
                        <p className="text-xs text-nuit-600/70"><Crown className="mr-1 inline h-3 w-3 text-or" />{chefs.map(nomComplet).join(', ') || 'chef à choisir'} · {ms.length} inscrit{ms.length > 1 ? 's' : ''}{ms.filter((m) => m.nouveau).length ? ` · ${ms.filter((m) => m.nouveau).length} nouveau(x)` : ''}</p></div>
                      <button className="btn-icone" title="Modifier" onClick={() => setEquipeEdit(e)}><Pencil className="h-4 w-4" /></button>
                      <button className="btn-icone text-red-700" title="Supprimer" onClick={() => supprimerEquipe(e)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <ul className="flex-1 divide-y divide-nuit-50">
                      {ms.map((m) => (
                        <li key={m.id}><button className="flex w-full flex-wrap items-center gap-1.5 py-1.5 text-left text-sm hover:bg-nuit-50/50" onClick={() => setFiche(m)}>
                          {e.chefs.includes(m.id) && <Crown className="h-3.5 w-3.5 text-or" />}<span className="mr-1">{nomComplet(m)}</span><Profils m={m} /></button></li>
                      ))}
                    </ul>
                    {anciens.length > 0 && (
                      <details className="mt-2 text-sm"><summary className="cursor-pointer text-xs text-nuit-600/70">{anciens.length} ancien{anciens.length > 1 ? 's' : ''} pas encore réinscrit{anciens.length > 1 ? 's' : ''}</summary>
                        <ul className="mt-1 space-y-0.5">{anciens.map((m) => <li key={m.id}><button className="text-left text-nuit-600/75 hover:underline" onClick={() => setFiche(m)}>{nomComplet(m)}{m.note ? <span className="text-xs italic"> — {m.note}</span> : ''}</button></li>)}</ul>
                      </details>
                    )}
                    {data.fils?.[e.id]?.prochaine && <p className="mt-2 flex items-center gap-1.5 text-xs text-nuit-600"><CalendarDays className="h-3.5 w-3.5 text-or" />Prochaine rencontre : {new Date(data.fils[e.id].prochaine.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}{data.fils[e.id].prochaine.lieu ? ` — ${data.fils[e.id].prochaine.lieu}` : ''}</p>}
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-nuit-50 pt-3">
                      <button className={`btn-clair px-2.5 py-1 text-xs ${data.fils?.[e.id]?.non_lus ? 'border-or bg-or-50' : ''}`} onClick={() => setFil(e)}><MessageSquare className="h-3.5 w-3.5" />Messages{data.fils?.[e.id]?.non_lus ? <span className="rounded-full bg-or px-1.5 text-xs font-semibold text-white">{data.fils[e.id].non_lus}</span> : ''}</button>
                      <button className="btn-clair px-2.5 py-1 text-xs" onClick={() => setLien(e)}><Link2 className="h-3.5 w-3.5" />Lien du chef</button>
                      <Aide>Lien secret, sans compte : le chef voit ses membres, en ajoute, note les rencontres et vous écrit. « Nouveau lien » désactive l'ancien.</Aide>
                      <button className="btn-clair px-2.5 py-1 text-xs" disabled={!chefs.some((c) => c.email)} onClick={() => mailChef(e)}><Crown className="h-3.5 w-3.5" />Liste au chef</button>
                      <button className="btn-clair px-2.5 py-1 text-xs" disabled={!ms.length} onClick={() => mailEquipe(e)}><Mail className="h-3.5 w-3.5" />Mail à l'équipe</button>
                      {anciens.length > 0 && <button className="btn-clair px-2.5 py-1 text-xs" onClick={() => relancer(e)}><BellRing className="h-3.5 w-3.5" />Relancer les anciens</button>}
                    </div>
                  </section>
                )
              })}
              <div className="flex flex-wrap gap-2 lg:col-span-2">
                {equipes.length > 0 && <button className="btn-clair" onClick={() => setTousChefs(true)}><Send className="h-4 w-4" />Message à tous les chefs</button>}
                {membres.some((m) => m.statut === 'ancien') && <button className="btn-clair" onClick={() => relancer(null)}><BellRing className="h-4 w-4" />Relancer tous les anciens</button>}
                <button className="btn-clair" disabled={!!occupe || !equipes.length} onClick={nouvelleAnnee}>{occupe === 'annee' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}Préparer {anneeSuivante(data.annee)}</button>
              </div>
            </div>
          )}

          {onglet === 'repartir' && (
            <div className="carte divide-y divide-nuit-50">
              {!aRepartir.length ? <Vide icone={Check} texte="Tout le monde est dans une fraternité." /> : (
                <>
                  {aRepartir.some((m) => m.equipe_proposee) && (
                    <div className="flex items-center gap-2 bg-or-50/60 p-3 text-sm"><Sparkles className="h-4 w-4 text-or" /><span className="flex-1">{aRepartir.filter((m) => m.equipe_proposee).length} proposition(s) d'après les réponses au formulaire.</span>
                      <button className="btn-or py-1.5 text-xs" disabled={!!occupe} onClick={async () => { for (const eq of new Set(aRepartir.filter((m) => m.equipe_proposee).map((m) => m.equipe_proposee))) await placer(aRepartir.filter((m) => m.equipe_proposee === eq).map((m) => m.id), eq) }}>Tout valider</button></div>
                  )}
                  {filtre(aRepartir).map((m) => <ARepartir key={m.id} m={m} equipes={equipes} occupe={!!occupe} onPlacer={(eq) => placer([m.id], eq)} onOuvrir={() => setFiche(m)} />)}
                </>
              )}
            </div>
          )}

          {onglet === 'chefs' && (
            <div className="carte divide-y divide-nuit-50">
              {!chefsPossibles.length ? <Vide icone={Crown} texte="Personne ne s'est encore proposé." /> : filtre(chefsPossibles).map((m) => {
                const estChef = equipes.find((e) => e.chefs.includes(m.id))
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                    <button className="flex-1 text-left" onClick={() => setFiche(m)}><span className="font-medium">{nomComplet(m)}</span> <span className="text-xs text-nuit-600/70">{m.telephone} {m.email}</span>
                      <span className="block text-xs text-nuit-600/70">{estChef ? `Chef de la fraternité ${estChef.nom}` : m.equipe_id ? `Membre de la fraternité ${nomEquipe(m.equipe_id)}` : 'Pas encore dans une fraternité'}</span></button>
                    {!estChef && <button className="btn-clair px-2.5 py-1 text-xs" onClick={() => setEquipeEdit({ nom: m.nom.charAt(0).toUpperCase() + m.nom.slice(1).toLowerCase(), chefs: [m.id] })}><Plus className="h-3.5 w-3.5" />Créer une fraternité avec ce chef</button>}
                  </div>
                )
              })}
            </div>
          )}

          {onglet === 'tous' && (
            <div className="carte divide-y divide-nuit-50">
              <div className="flex justify-end px-4 py-2"><BoutonSelection s={s} /></div>
              {filtre(membres).map((m) => (
                <button key={m.id} className={`flex w-full flex-wrap items-center gap-1.5 px-4 py-2.5 text-left text-sm hover:bg-nuit-50/50 ${m.statut === 'ancien' ? 'text-nuit-600/75' : ''}`} onClick={() => s.actif ? s.basculer(m.id) : setFiche(m)}>
                  <Case s={s} id={m.id} nom={nomComplet(m)} />
                  <span className="min-w-[180px] flex-1">{nomComplet(m)}<span className="block text-xs text-nuit-600/75">{m.equipe_id ? `Fraternité ${nomEquipe(m.equipe_id)}` : 'À répartir'}{m.statut === 'ancien' ? ' · ancien, pas réinscrit' : ''}</span></span>
                  <Profils m={m} />
                </button>
              ))}
            </div>
          )}
          {onglet === 'tous' && (
            <BarreSelection s={s} tous={filtre(membres).map((m) => m.id)} raccourcis={[['Pas d\'équipe cette année', filtre(actifs).filter((m) => !m.equipe_id).map((m) => m.id)], ['Anciens', filtre(membres).filter((m) => m.statut === 'ancien').map((m) => m.id)]]}>
              <button className="btn-clair py-1.5 text-xs" onClick={() => statutLot('ancien')}>Passer en ancien</button>
              <button className="btn-clair py-1.5 text-xs" onClick={() => statutLot('actif')}>Réactiver</button>
            </BarreSelection>
          )}
        </>
      )}
      {fiche && <Fiche m={fiche} membres={data?.membres || []} annee={data?.annee} equipes={equipes} profils={data?.profils || []} onFermer={() => { setFiche(null); if (params.get('fiche')) changer({ fiche: '' }) }} onMaj={(r) => { setData(r); setFiche(null) }} onLiens={(r) => setData(r)}
        onSupprimer={(m) => { setFiche(null); differer(`${nomComplet(m)} retiré(e) des fraternités`, async () => setData(await api('cor.supprimer', { id: m.id, annee: data.annee })), { ids: [m.id], onAnnule: () => setData((d) => ({ ...d })) }); setData((d) => ({ ...d })) }} />}
      {equipeEdit && <EquipeEdit e={equipeEdit} annee={data.annee} membres={actifs} onFermer={() => setEquipeEdit(null)} onMaj={(r) => { setData(r); setEquipeEdit(null); notifier('Fraternité enregistrée') }} />}
      {fil && <Fil e={fil} annee={data.annee} onFermer={() => { setFil(null); recharger() }} />}
      {lien && <LienChef e={lien} annee={data.annee} chefs={membres.filter((m) => lien.chefs.includes(m.id))} onFermer={() => setLien(null)} onMail={(m) => { setLien(null); setMail(m) }} />}
      {tousChefs && <TousChefs annee={data.annee} nb={equipes.length} onFermer={() => setTousChefs(false)} />}
      {mail && <Redaction mode="nouveau" a={mail.a || ''} sujet={mail.sujet} corps={mail.corps} destinataires={mail.destinataires} boutons={mail.boutons}
        envoiPersonnalise={mail.ids ? ({ sujet, corps, signature }) => api('cor.envoyer', { ids: mail.ids, sujet, corps, signature, boutons: mail.boutons }) : undefined}
        onFermer={() => setMail(null)} onEnvoye={(r) => { setMail(null); notifier(r?.nb ? `Envoyé à ${r.nb} adresse${r.nb > 1 ? 's' : ''}` : 'Message envoyé') }} />}
    </>
  )
}

function ARepartir({ m, equipes, occupe, onPlacer, onOuvrir }) {
  const [eq, setEq] = useState(m.equipe_proposee || '')
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
      <button className="min-w-[200px] flex-1 text-left" onClick={onOuvrir}>
        <span className="mr-1 font-medium">{nomComplet(m)}</span><Profils m={m} />
        <span className="block text-xs text-nuit-600/70">{[m.rester && `rester dans la même équipe : ${m.rester}`, m.chef_indique && `chef indiqué : ${m.chef_indique}`, m.souhait && `souhaite retrouver : ${m.souhait}`].filter(Boolean).join(' · ') || 'Aucune indication'}</span>
      </button>
      <select className={`champ w-auto py-1.5 text-sm ${eq && eq === m.equipe_proposee ? 'border-or bg-or-50' : ''}`} value={eq} onChange={(e) => setEq(e.target.value)}>
        <option value="">Choisir…</option>{equipes.map((e) => <option key={e.id} value={e.id}>{e.nom}{e.id === m.equipe_proposee ? ' (proposée)' : ''}</option>)}
      </select>
      <button className="btn-principal py-1.5 text-xs" disabled={!eq || occupe} onClick={() => onPlacer(eq)}><Check className="h-3.5 w-3.5" />Valider</button>
    </div>
  )
}

function EquipeEdit({ e, annee, membres, onFermer, onMaj }) {
  const [nom, setNom] = useState(e.nom)
  const [chefs, setChefs] = useState(e.chefs || [])
  const [choix, setChoix] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const candidats = useMemo(() => [...membres].sort((a, b) => (b.chef_possible - a.chef_possible) || nomComplet(a).localeCompare(nomComplet(b))), [membres])
  async function enregistrer() {
    setEnvoi(true); setErreur(null)
    try { onMaj(await api('cor.equipe', { annee, equipe: { id: e.id, nom, chefs } })) } catch (err) { setErreur(err); setEnvoi(false) }
  }
  return (
    <Modale titre={e.id ? `Fraternité ${e.nom}` : 'Nouvelle fraternité'} onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={envoi || !nom.trim()} onClick={enregistrer}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button></>}>
      <div className="space-y-3">
        <div><label className="etiquette">Nom (en général le nom du chef)</label><input className="champ" value={nom} onChange={(ev) => setNom(ev.target.value)} /></div>
        <div><label className="etiquette">Chef(s) d'équipe</label>
          <div className="mb-2 flex flex-wrap gap-1.5">{chefs.map((id) => { const m = membres.find((x) => x.id === id); return <span key={id} className="pastille gap-1 bg-or-50 text-or-600"><Crown className="h-3 w-3" />{m ? nomComplet(m) : '?'}<button onClick={() => setChefs(chefs.filter((x) => x !== id))}>×</button></span> })}</div>
          <div className="flex gap-2"><select className="champ" value={choix} onChange={(ev) => setChoix(ev.target.value)}><option value="">Ajouter un chef…</option>{candidats.filter((m) => !chefs.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{nomComplet(m)}{m.chef_possible ? ' — chef possible' : ''}</option>)}</select>
            <button className="btn-clair" disabled={!choix} onClick={() => { setChefs([...chefs, choix]); setChoix('') }}><Plus className="h-4 w-4" /></button></div>
          {!e.id && <p className="mt-1 text-xs text-nuit-600/70">Le chef rejoint automatiquement sa nouvelle fraternité.</p>}
        </div>
        <Erreur erreur={erreur} />
      </div>
    </Modale>
  )
}

const CHAMPS_FICHE = [['prenoms', 'Prénom(s) — « Paul et Marie » pour un foyer'], ['nom', 'Nom'], ['email', 'E-mail(s)'], ['telephone', 'Téléphone'], ['adresse', 'Adresse'], ['situation', 'Situation (marié, célibataire…)']]

function Fiche({ m, annee, equipes, profils, membres = [], onFermer, onMaj, onSupprimer, onLiens }) {
  const [menage, setMenage] = useState(false)
  const confirmer = useConfirmer()
  const nouveau = !!m.nouveau && !m.id
  const [v, setV] = useState(nouveau ? { prenoms: '', nom: '', email: '', telephone: '', adresse: '', situation: '', profils: [], equipe_id: '', statut: 'actif', note: '', souhait: '', chef_possible: false } : { ...m })
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [liens, setLiens] = useState({ dossiers: m.dossiers || [], auto: m.profils_auto || [] })
  const [choix, setChoix] = useState(false)
  const maj = (k, val) => setV({ ...v, [k]: val })
  const notifierL = useNotif()
  async function lier(dossierId, delier, message) {
    try {
      await api('cor.relier', { fiche_id: m.id, dossier_id: dossierId, delier })
      const r = await api('cor.liste', { annee }); onLiens?.(r)
      const x = r.membres.find((y) => y.id === m.id)
      if (x) { setLiens({ dossiers: x.dossiers, auto: x.profils_auto }); setV((w) => ({ ...w, profils: x.profils })) }
      notifierL(message, 'ok', delier ? { action: { label: 'Annuler', fn: () => lier(dossierId, false, 'Lien rétabli') } } : {})
    } catch (err) { notifierL(err.message, 'erreur') }
  }
  async function enregistrer() {
    setEnvoi(true); setErreur(null)
    try {
      const champs = { nom: v.nom, prenoms: v.prenoms, email: v.email, telephone: v.telephone, adresse: v.adresse, situation: v.situation, profils: v.profils, equipe_id: v.equipe_id, statut: v.statut, note: v.note, souhait: v.souhait, chef_possible: !!v.chef_possible }
      onMaj(await api(nouveau ? 'cor.creer' : 'cor.modifier', { ...champs, id: m.id, annee }))
    } catch (err) { setErreur(err); setEnvoi(false) }
  }
  function supprimer() { onSupprimer(m) }
  return (
    <Modale large titre={nouveau ? 'Ajouter une personne' : nomComplet(m)} onFermer={onFermer}
      pied={<>{!nouveau && <button className="btn-clair text-red-700" onClick={supprimer}><Trash2 className="h-4 w-4" />Supprimer</button>}{!nouveau && <button className="btn-clair mr-auto" onClick={() => setMenage(true)}><Users className="h-4 w-4" />Lier en ménage</button>}<button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={envoi || !(v.nom || v.prenoms)} onClick={enregistrer}>{envoi && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          {CHAMPS_FICHE.map(([k, l]) => <div key={k}><label className="etiquette">{l}</label><input className="champ" value={v[k] || ''} onChange={(e) => maj(k, e.target.value)} /></div>)}
        </div>
        <div className="space-y-3">
          <div><label className="etiquette">Fraternité</label><select className="champ" value={v.equipe_id || ''} onChange={(e) => maj('equipe_id', e.target.value)}><option value="">À répartir</option>{equipes.map((e) => <option key={e.id} value={e.id}>{e.nom}{e.id === m.equipe_proposee ? ' (proposée)' : ''}</option>)}</select></div>
          <div><label className="etiquette">Statut</label><select className="champ" value={v.statut || 'actif'} onChange={(e) => maj('statut', e.target.value)}><option value="actif">Inscrit cette année</option><option value="ancien">Ancien, pas encore réinscrit</option></select></div>
          <div><label className="etiquette">Profil</label><div className="flex flex-wrap gap-1.5">{profils.map((p) => (
            liens.dossiers.length > 0 && ['Catéchumène', 'Néophyte', 'Confirmand'].includes(p)
              ? <span key={p} title="D'après le dossier" className={`pastille gap-1 border py-1 ${liens.auto.includes(p) ? 'border-transparent ' + COULEURS_PROFILS[p] : 'border-dashed border-nuit-100 bg-white text-nuit-600/40'}`}>{p}{liens.auto.includes(p) && <FolderHeart className="h-3 w-3" />}</span>
              : <label key={p} className={`pastille cursor-pointer gap-1 border py-1 ${v.profils.includes(p) ? 'border-transparent ' + COULEURS_PROFILS[p] : 'border-nuit-100 bg-white text-nuit-600'}`}><input type="checkbox" className="hidden" checked={v.profils.includes(p)} onChange={(e) => maj('profils', e.target.checked ? [...v.profils, p] : v.profils.filter((x) => x !== p))} />{p}</label>
          ))}</div>
            {liens.dossiers.length > 0 && <p className="mt-1 text-xs text-nuit-600/75">Catéchumène, néophyte et confirmand suivent le dossier.</p>}</div>
          {!nouveau && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2"><span className="etiquette mb-0">Dossier de sacrement</span>
                <button className="btn-clair px-2.5 py-1 text-xs" onClick={() => setChoix(true)}><Link2 className="h-3.5 w-3.5" />{liens.dossiers.length ? 'Relier un autre' : 'Relier à un dossier'}</button></div>
              {!liens.dossiers.length ? <p className="text-sm text-nuit-600/70">Aucun dossier de catéchumène ou de confirmand trouvé.</p> : liens.dossiers.map((d) => {
                const pe = d.etat === 'ouvert' ? prochaineEtape(d.type, d.etapes || [], {}) : null
                return (
                  <div key={d.id} className="flex flex-wrap items-center gap-2 py-1 text-sm">
                    <Link to={`/dossiers/${d.id}`} className="pastille gap-1 border bg-white py-0.5 hover:underline" style={{ borderColor: TYPES[d.type]?.couleur, color: TYPES[d.type]?.couleur }}><FolderHeart className="h-3 w-3" />{TYPES[d.type]?.nom}</Link>
                    <span className="flex-1 text-xs text-nuit-600">{d.etat !== 'ouvert' ? ETATS[d.etat] : pe ? '→ ' + pe.label : 'Toutes les étapes faites'}{d.mode === 'auto' && <span className="text-nuit-600/75"> · reconnu par le nom</span>}</span>
                    <button className="btn-clair px-2 py-0.5 text-xs" onClick={() => lier(d.id, true, 'Lien avec le dossier défait')}>Délier</button>
                  </div>
                )
              })}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.chef_possible} onChange={(e) => maj('chef_possible', e.target.checked)} />Peut devenir chef de fraternité</label>
          <div><label className="etiquette">Souhaite retrouver</label><input className="champ" value={v.souhait || ''} onChange={(e) => maj('souhait', e.target.value)} /></div>
          <div><label className="etiquette">Note</label><textarea className="champ min-h-[60px]" value={v.note || ''} onChange={(e) => maj('note', e.target.value)} /></div>
          {!nouveau && (
            <div className="rounded-lg bg-nuit-50/60 p-3 text-xs text-nuit-600">
              {[['Déjà participé l\'an dernier', m.deja_participe], ['Rester dans la même équipe', m.rester], ['Chef indiqué', m.chef_indique], ['Groupe / service à la paroisse', m.groupe_service]].filter(([, x]) => x).map(([l, x]) => <div key={l}>{l} : <strong>{x}</strong></div>)}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3"><Erreur erreur={erreur} /></div>
      {menage && <ChoixMenage m={m} membres={membres} onFermer={() => setMenage(false)} onChoisir={async (z) => {
        if (!(await confirmer({ titre: 'Lier en ménage', texte: `${nomComplet(m)} et ${nomComplet(z)} deviendront une seule fiche foyer (noms, e-mails, téléphones, liens aux dossiers et rôle de chef gardés). Cette action ne peut pas être annulée.`, bouton: 'Lier en ménage' }))) return
        try { onMaj(await api('cor.menage', { id: m.id, avec: z.id, annee })); notifierL('Fiches réunies en un foyer') } catch (err) { notifierL(err.message, 'erreur') }
      }} />}
      {choix && <ChoixDossier nom={nomComplet(m)} deja={liens.dossiers.map((d) => d.id)} onFermer={() => setChoix(false)} onChoisir={(id) => { setChoix(false); lier(id, false, 'Dossier relié') }} />}
    </Modale>
  )
}

function ChoixMenage({ m, membres, onFermer, onChoisir }) {
  const [texte, setTexte] = useState('')
  const sa = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const liste = membres.filter((x) => x.id !== m.id && (!texte || sa(`${x.prenoms} ${x.nom} ${x.email}`).includes(sa(texte))))
  return (
    <Modale titre={`${nomComplet(m)} vit en couple avec…`} onFermer={onFermer} pied={<button className="btn-clair" onClick={onFermer}>Fermer</button>}>
      <input className="champ mb-3" placeholder="Nom, prénom ou e-mail…" value={texte} onChange={(e) => setTexte(e.target.value)} autoFocus />
      <ul className="max-h-[50vh] divide-y divide-nuit-100 overflow-y-auto">
        {liste.slice(0, 80).map((x) => <li key={x.id}><button className="flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-nuit-50/60" onClick={() => onChoisir(x)}>
          <span className="flex-1"><span className="font-medium">{nomComplet(x)}</span><span className="block text-xs text-nuit-600/70">{x.email}</span></span>
          <span className="text-xs text-nuit-600">{x.statut === 'ancien' ? 'ancien' : ''}</span></button></li>)}
      </ul>
    </Modale>
  )
}

function ChoixDossier({ nom, deja, onFermer, onChoisir }) {
  const [liste, setListe] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [texte, setTexte] = useState('')
  useEffect(() => { api('dossiers.liste', {}).then((l) => setListe(l.filter((d) => ['catechumene', 'confirmand'].includes(d.type)))).catch(setErreur) }, [])
  const sa = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const vus = (liste || []).filter((d) => !texte || sa(`${d.nom} ${d.email}`).includes(sa(texte)))
  return (
    <Modale titre={`Relier ${nom} à un dossier`} onFermer={onFermer} pied={<button className="btn-clair" onClick={onFermer}>Fermer</button>}>
      <Erreur erreur={erreur} />
      {!liste ? <Chargement /> : <>
        <input className="champ mb-3" placeholder="Nom ou e-mail…" value={texte} onChange={(e) => setTexte(e.target.value)} autoFocus />
        {!vus.length ? <p className="text-sm text-nuit-600/70">Aucun dossier de catéchumène ou de confirmand.</p> : (
          <ul className="max-h-[50vh] divide-y divide-nuit-100 overflow-y-auto">
            {vus.map((d) => (
              <li key={d.id}><button className="flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-nuit-50/60 disabled:opacity-50" disabled={deja.includes(d.id)} onClick={() => onChoisir(d.id)}>
                <span className="pastille w-fit text-white" style={{ background: TYPES[d.type]?.couleur }}>{TYPES[d.type]?.nom}</span>
                <span className="flex-1 font-medium">{d.nom}</span>
                <span className="text-xs text-nuit-600/70">{d.fraternite ? 'Cor Unum : ' + (d.fraternite.equipe || 'à répartir') : ''}</span>
              </button></li>
            ))}
          </ul>
        )}
      </>}
    </Modale>
  )
}

const dateFil = (d) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function Fil({ e, annee, onFermer }) {
  const notifier = useNotif()
  const [d, setD] = useState(null)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  useEffect(() => { api('cor.fil', { annee, equipe: e.id }).then(setD).catch((err) => notifier(err.message, 'erreur')) }, [annee, e.id, notifier])
  async function envoyer() {
    setEnvoi(true)
    try { setD(await api('cor.fil', { annee, equipe: e.id, texte })); setTexte('') } catch (err) { notifier(err.message, 'erreur') } finally { setEnvoi(false) }
  }
  return (
    <Modale large titre={`Fraternité ${e.nom} — messages`} onFermer={onFermer}>
      {!d ? <Chargement /> : (
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-lg bg-nuit-50/40 p-3">
              {!d.messages.length && <p className="text-sm text-nuit-600/70">Aucun message. Le chef voit ce fil sur sa page.</p>}
              {d.messages.map((m) => (
                <div key={m.id} className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.cote === 'chef' ? 'bg-white' : 'ml-auto bg-nuit text-white'}`}>
                  <div className="mb-0.5 text-xs opacity-70">{m.cote === 'chef' ? `${m.auteur} (chef)` : m.auteur} · {dateFil(m.date)}</div>{m.texte}
                </div>
              ))}
            </div>
            <textarea className="champ mt-3 min-h-[90px]" value={texte} onChange={(ev) => setTexte(ev.target.value)} placeholder="Votre réponse…" />
            <div className="mt-2 flex items-center gap-2"><button className="btn-principal" disabled={envoi || !texte.trim()} onClick={envoyer}>{envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Envoyer</button>
              <span className="text-xs text-nuit-600/70">Le chef le verra en ouvrant sa page (pas de mail).</span></div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Rencontres notées par le chef</h3>
            {!d.rencontres.length ? <p className="text-xs text-nuit-600/70">Aucune.</p> : (
              <ul className="space-y-1.5 text-sm">{[...d.rencontres].sort((a, b) => b.date.localeCompare(a.date)).map((r) => <li key={r.id}><div className="font-medium first-letter:uppercase">{new Date(r.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>{(r.lieu || r.note) && <div className="text-xs text-nuit-600/70">{[r.lieu, r.note].filter(Boolean).join(' — ')}</div>}</li>)}</ul>
            )}
          </div>
        </div>
      )}
    </Modale>
  )
}

import VoirComme from './VoirComme.jsx'
import { useApp } from '../App.jsx'

function LienChef({ e, annee, chefs, onFermer, onMail }) {
  const { peut } = useApp()
  const notifier = useNotif()
  const confirmer = useConfirmer()
  const [lien, setLien] = useState('')
  const [infos, setInfos] = useState(null)
  const [occupe, setOccupe] = useState(false)
  useEffect(() => { api('cor.lienChef', { annee, equipe: e.id }).then((r) => { setLien(r.lien); setInfos(r) }).catch((err) => notifier(err.message, 'erreur')) }, [annee, e.id, notifier])
  async function nouveau() {
    if (!(await confirmer({ titre: 'Nouveau lien', texte: "L'ancien lien ne fonctionnera plus. Il faudra envoyer le nouveau au chef.", bouton: 'Créer un nouveau lien', danger: true }))) return
    setOccupe(true)
    try { setLien((await api('cor.lienChef', { annee, equipe: e.id, nouveau: true })).lien); notifier('Nouveau lien créé') } catch (err) { notifier(err.message, 'erreur') } finally { setOccupe(false) }
  }
  function copier() { navigator.clipboard?.writeText(lien).then(() => notifier('Lien copié'), () => notifier('Copie impossible : sélectionnez le lien', 'erreur')) }
  function envoyer() {
    const B = 'Ouvrir la page de ma fraternité'
    onMail({ a: chefs.map((c) => String(c.email || '').split(/[\s,;]+/)[0]).filter(Boolean).join(', '), sujet: `Fraternité Cor Unum ${e.nom} – votre page de chef`,
      corps: `Bonjour ${chefs.map((c) => c.prenoms).join(' et ')},\n\nVoici le lien personnel de votre fraternité Cor Unum. Il vous permet de voir les membres et leurs coordonnées, d'ajouter un membre, de corriger un téléphone ou une adresse, de signaler un départ, de noter vos rencontres, d'écrire à toute l'équipe, d'échanger avec le curé et le secrétariat, et d'inviter de nouvelles personnes à rejoindre la fraternité (onglet « Inviter » : lien, mail ou QR code).\n[Bouton : ${B}]\n\nLa page est protégée par un mot de passe que vous choisissez vous-même : à votre première visite, cliquez sur « Choisir mon mot de passe » ; un code vous sera envoyé par mail. Vous resterez ensuite connecté(e) 90 jours sur cet appareil.\n\nConseil : ajoutez cette page à vos favoris ou à l'écran d'accueil de votre téléphone. Ce lien est personnel : merci de ne pas le transférer.\n\nAvec l'assurance de nos prières à toutes vos intentions,`,
      boutons: [{ texte: B, url: lien }] })
  }
  return (
    <Modale titre={`Lien du chef — ${e.nom}`} onFermer={onFermer}
      pied={<><button className="btn-clair mr-auto text-red-700" disabled={occupe || !lien} onClick={nouveau}><RefreshCw className="h-4 w-4" />Nouveau lien</button><button className="btn-principal" disabled={!lien || !chefs.some((c) => c.email)} onClick={envoyer}><Mail className="h-4 w-4" />Envoyer au chef</button></>}>
      {peut('utilisateurs') && <div className="mb-2 flex justify-end"><VoirComme seulement={['chef']} libelle="Aperçu de la page du chef (fictive)" className="btn-clair px-2.5 py-1 text-xs" /></div>}
      <p className="mb-3 text-sm text-nuit-600">Page personnelle du chef, sans compte dans l'appli, protégée par un mot de passe : membres, ajout, corrections, départs, rencontres, mail à l'équipe et messages avec la paroisse.</p>
      {!lien ? <Chargement /> : (
        <div className="flex gap-2"><input className="champ text-xs" readOnly value={lien} onFocus={(ev) => ev.target.select()} /><button className="btn-clair" onClick={copier}><Copy className="h-4 w-4" /></button></div>
      )}
      {infos && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${infos.mot_de_passe ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
        {infos.mot_de_passe ? `Mot de passe choisi par le chef le ${new Date(infos.mot_de_passe).toLocaleDateString('fr-FR')}.` : 'Le chef n\'a pas encore choisi son mot de passe.'}
        {!infos.mails?.length && <><br /><strong>Aucune adresse e-mail connue pour le chef</strong> : ajoutez-la dans sa fiche, sinon il ne pourra pas recevoir le code.</>}</p>}
      {infos && (infos.lien_inscription ? <div className="mt-4 border-t border-nuit-100 pt-3">
        <p className="mb-1.5 text-sm font-medium">Lien d'inscription dans la fraternité</p>
        <p className="mb-2 text-xs text-nuit-600/80">À donner aux nouveaux : court formulaire, inscription directe dans la fraternité, mail de bienvenue avec les coordonnées du chef. Le chef le trouve aussi sur sa page (onglet « Inviter », avec QR code). Valable toute l'année {annee}.</p>
        <div className="flex gap-2"><input className="champ text-xs" readOnly value={infos.lien_inscription} onFocus={(ev) => ev.target.select()} />
          <button className="btn-clair" title="Copier" onClick={() => navigator.clipboard?.writeText(infos.lien_inscription).then(() => notifier('Lien copié'), () => notifier('Copie impossible', 'erreur'))}><Copy className="h-4 w-4" /></button>
          <button className="btn-clair" title="Nouveau lien d'inscription (l'ancien ne fonctionnera plus)" disabled={occupe} onClick={async () => {
            if (!(await confirmer({ titre: "Nouveau lien d'inscription", texte: "L'ancien lien d'inscription ne fonctionnera plus.", bouton: 'Créer un nouveau lien', danger: true }))) return
            setOccupe(true)
            try { const r = await api('cor.lienInscription', { annee, equipe: e.id, nouveau: true }); setInfos((x) => ({ ...x, lien_inscription: r.lien })); notifier("Nouveau lien d'inscription créé") } catch (err) { notifier(err.message, 'erreur') } finally { setOccupe(false) }
          }}><RefreshCw className="h-4 w-4" /></button></div>
      </div> : <p className="mt-3 text-xs text-nuit-600/70">Le lien d'inscription n'existe que pour l'année en cours.</p>)}
      <p className="mt-2 text-xs text-nuit-600/70">Le lien seul ne suffit pas : la page demande aussi le mot de passe de la fraternité, choisi par le chef grâce à un code reçu par mail (aussi en cas d'oubli). « Nouveau lien » désactive immédiatement l'ancien lien ; le mot de passe reste le même.</p>
    </Modale>
  )
}

function TousChefs({ annee, nb, onFermer }) {
  const notifier = useNotif()
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  async function envoyer() {
    setEnvoi(true)
    try { const r = await api('cor.tousChefs', { annee, texte }); notifier(`Message ajouté au fil de ${r.nb} fraternité${r.nb > 1 ? 's' : ''}`); onFermer() } catch (err) { notifier(err.message, 'erreur'); setEnvoi(false) }
  }
  return (
    <Modale titre="Message à tous les chefs" onFermer={onFermer}
      pied={<><button className="btn-clair" onClick={onFermer}>Annuler</button><button className="btn-principal" disabled={envoi || !texte.trim()} onClick={envoyer}>{envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Envoyer aux {nb} fraternités</button></>}>
      <textarea className="champ min-h-[160px]" value={texte} onChange={(ev) => setTexte(ev.target.value)} placeholder="Message…" autoFocus />
      <p className="mt-2 text-xs text-nuit-600/70">Le message s'ajoute au fil de chaque fraternité ; les chefs le voient en ouvrant leur page.</p>
    </Modale>
  )
}
