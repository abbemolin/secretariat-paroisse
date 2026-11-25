// Accès par utilisateur (même logique que backend/Acces.gs).
export const PAGES_ACCES = [
  ['courrier', 'Courrier'], ['agenda', 'Agenda'], ['extraits', 'Extraits de baptême'], ['registres', 'Registres'],
  ['catechisme', 'Catéchisme (et livres)'], ['catechumenat', 'Catéchuménat (textes, calendrier, espaces)'], ['cor_unum', 'Cor Unum'],
  ['retraites', 'Retraites'], ['documents', 'Documents'], ['statistiques', 'Statistiques'], ['annonces', 'Annonces et newsletter'], ['liturgie', 'Liturgie'], ['intentions', 'Intentions de messe'], ['paroissiens', 'App des paroissiens (demandes d\'accès, comptes)'], ['propositions', 'Propositions spirituelles (parcours, textes)']
]
export const SORTES_ACCES = [
  ['bapteme', 'Baptêmes'], ['premiere_communion', 'Premières communions'], ['profession_foi', 'Professions de foi'], ['confirmation_jeune', 'Confirmations (jeunes)'],
  ['mariage', 'Mariages'], ['obseques', 'Obsèques'], ['catechumene', 'Catéchumènes'], ['confirmand', 'Confirmands adultes']
]
export const ONGLETS_REGLAGES = ['Paroisse', 'Signatures', 'Réponses types', 'Modèles', 'Tri automatique', 'Catéchisme', 'Confirmands', 'Cor Unum', 'Paiements en ligne', 'Newsletter', 'Liturgie', 'Journal', 'Sauvegardes']
const ANCIENS = ['mail', 'agenda', 'documents', 'utilisateurs', 'reglages']
const N = { '': 0, l: 1, m: 2 }

function complet(niveau, onglets, signer) {
  const a = { dossiers: {}, courrier_tout: true, reglages: onglets, signer }
  PAGES_ACCES.forEach(([k]) => { a[k] = niveau })
  SORTES_ACCES.forEach(([k]) => { a.dossiers[k] = niveau })
  return a
}
/** Accès pré-cochés par rôle. */
export function accesDuRole(role) {
  if (role === 'admin') return complet('m', [...ONGLETS_REGLAGES], true)
  const a = complet('m', [], role === 'cure' || role === 'vicaire')
  a.statistiques = ''
  a.annonces = role === 'cure' ? 'm' : ''   // tuile « Annonces et newsletter » : curé (et administrateurs)
  a.intentions = role === 'cure' || role === 'vicaire' ? 'm' : ''   // tuile « Intentions de messe »
  a.propositions = role === 'cure' || role === 'vicaire' ? 'm' : ''   // propositions spirituelles
  a.paroissiens = role === 'cure' || role === 'vicaire' || role === 'secretaire' ? 'm' : ''   // App des paroissiens
  a.liturgie = role === 'secretaire' ? '' : 'm'   // tuile « Liturgie » : prêtres et diacres
  if (role === 'secretaire') { a.reglages = ONGLETS_REGLAGES.filter((o) => o !== 'Sauvegardes' && o !== 'Newsletter' && o !== 'Liturgie'); a.signer = true }
  return a
}
export function niveau(u, zone, sorte) {
  if (!u || u.role === 'admin' || !u.acces) return 2
  const a = u.acces
  if (sorte === 'bapteme_ailleurs') sorte = 'bapteme'   // mêmes droits que les baptêmes
  if (zone === 'dossiers') return sorte ? N[a.dossiers?.[sorte] || ''] : Math.max(...SORTES_ACCES.map(([k]) => N[a.dossiers?.[k] || '']))
  return N[a[zone] || ''] || 0
}
/** peut('mail'), peut('cor_unum'), peut('dossiers:confirmand')… */
export function peutVoir(u, d) {
  if (!d) return true
  if (ANCIENS.includes(d)) return u.droits.includes(d)
  const [z, s] = d.split(':')
  return niveau(u, z, s) >= 1
}
export const peutModifier = (u, zone, sorte) => niveau(u, zone, sorte) >= 2
export const ongletPermis = (u, o) => u.role === 'admin' || (u.acces?.reglages || []).includes(o)
