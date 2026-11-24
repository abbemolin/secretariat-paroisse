// Préparation hors connexion : à chaque ouverture de l'appli (au plus toutes les 30 minutes), en arrière-plan,
// tout ce que la personne peut lire est gardé sur l'appareil : fiches, listes, agenda élargi, annonces et feuille de semaine.
import { api, enCache, estDemo, memoriser } from './api.js'
import { bornesSemaine, decalerSemaine, lundiDe } from './annonces/semaine.js'

const CLE = 'horsligne.le'
const INTERVALLE = 30 * 60000
let enCours = false

/** Date de la dernière préparation réussie (ISO) ou ''. */
export const derniereMiseAJour = () => { try { return localStorage.getItem(CLE) || '' } catch { return '' } }

/** peut(zone) : droits de la personne. forcer : sans attendre les 30 minutes. */
export async function preparerHorsLigne(peut, { forcer = false } = {}) {
  if (enCours || estDemo() || navigator.onLine === false) return
  const le = derniereMiseAJour()
  if (!forcer && le && Date.now() - new Date(le).getTime() < INTERVALLE) return
  enCours = true
  const essai = (p) => p.catch((e) => console.warn('hors ligne', e?.message || e))
  try {
    const t = []
    if (peut('dossiers')) {
      t.push(essai(api('horsligne.fiches').then((r) => {
        const l = []
        Object.entries(r.dossiers || {}).forEach(([id, d]) => {
          const avant = enCache('dossiers.lire', { id })
          l.push(['dossiers.lire', { id }, { ...d, fils: d.fils || avant?.fils || [] }])   // les mails liés restent ceux de la dernière ouverture
        })
        Object.entries(r.cate || {}).forEach(([id, x]) => l.push(['cate.lire', { id }, x]))
        Object.entries(r.extraits || {}).forEach(([id, x]) => l.push(['extraits.lire', { id }, x]))
        Object.entries(r.retraites || {}).forEach(([id, x]) => l.push(['retraites.lire', { id }, x]))
        memoriser(l)
      })))
      // Listes (avec leurs réglages) : api() les garde d'elle-même
      t.push(essai(api('dossiers.liste', {})))
      if (peut('extraits')) t.push(essai(api('extraits.liste')))
      if (peut('catechisme')) t.push(essai(api('cate.liste', { annee: '' })), essai(api('cate.reglages')))
      if (peut('cor_unum')) t.push(essai(api('cor.liste', { annee: '' })))
      if (peut('retraites')) t.push(essai(api('retraites.liste', { annee: '' })))
      t.push(essai(api('promotions.liste')))
    }
    // Agenda : du début du mois dernier à la fin du 3e mois qui vient
    if (peut('agenda')) {
      const n = new Date(), debut = new Date(n.getFullYear(), n.getMonth() - 1, 1).toISOString(), fin = new Date(n.getFullYear(), n.getMonth() + 4, 1).toISOString()
      t.push(essai(api('agenda.evenements', { debut, fin }).then((evenements) => memoriser('agenda.horsligne', {}, { debut, fin, evenements }))))
    }
    // Annonces, feuille de la semaine (cette semaine et la suivante), newsletter
    if (peut('annonces')) {
      const lundi = lundiDe(new Date()), suivant = decalerSemaine(lundi, 1)
      t.push(essai(api('annonces.liste')))
      for (const l of [lundi, suivant]) t.push(essai(api('newsletter.semaine', { lundi: l, ...bornesSemaine(l) })))
      t.push(essai(api('newsletter.lire', { lundi: suivant })))
    }
    // Intentions : le mois prochain aussi (le mois en cours est gardé à l'ouverture de la tuile)
    if (peut('intentions')) {
      const { chargerAgenda, chargerIntentions } = await import('./intentions/donnees.js')
      const n = new Date(), s = new Date(n.getFullYear(), n.getMonth() + 1, 1)
      t.push(essai(chargerIntentions()), essai(chargerAgenda(n.getFullYear(), n.getMonth())), essai(chargerAgenda(s.getFullYear(), s.getMonth())))
    }
    await Promise.all(t)
    if (navigator.onLine !== false) localStorage.setItem(CLE, new Date().toISOString())
    window.dispatchEvent(new Event('horsligne-pret'))
  } finally { enCours = false }
}
