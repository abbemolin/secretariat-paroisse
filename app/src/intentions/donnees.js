// Tuile « Intentions de messe » : données et règles communes (reprises de calendrier.html et intentions.html d'AppMesse).
import { api, enCache } from '../api.js'

export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
export const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
export const TYPES = [['Défunt', '✝ Défunt'], ['Vivant', '🙏 Vivant'], ['Action de grâce', '✨ Action de grâce']]
export const SANS_ADRESSE = 'non@renseigne.fr'
const deux = (n) => String(n).padStart(2, '0')
export const isoLocal = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
export const dateCourte = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
export const dateLongue = (iso) => { const d = new Date(iso + 'T12:00:00'); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}` }
export const heureFr = (h) => String(h || '').replace(':', 'h')

// ─── Chargement (dernière réponse gardée sur l'appareil : lecture hors ligne) ───
export async function chargerIntentions() { return api('intentions.liste') }
export const intentionsEnCache = () => enCache('intentions.liste', {})
/** Agenda du mois (début et fin en heure locale), gardé lui aussi. */
export function bornesMois(annee, mois0) {
  return { debut: new Date(annee, mois0, 1).toISOString(), fin: new Date(annee, mois0 + 1, 1).toISOString() }
}
export async function chargerAgenda(annee, mois0) { return api('intentions.agenda', bornesMois(annee, mois0)) }
export const agendaEnCache = (annee, mois0) => enCache('intentions.agenda', bornesMois(annee, mois0))

// ─── Messes de l'agenda ───
export const estMesse = (e) => /^(messe|grand.?messe)/i.test((e.summary || '').trim())
export const heureDe = (e) => { const d = new Date(e.start.dateTime || e.start.date); return `${deux(d.getHours())}:${deux(d.getMinutes())}` }
export function typeMesse(e) {
  const s = e.summary || ''
  return e._prive ? 'Messe privée' : /grand.?messe/i.test(s) ? 'Grand-Messe' : /solennelle/i.test(s) ? 'Messe solennelle' : /chantée/i.test(s) ? 'Messe chantée'
    : /paul\s*vi/i.test(s) ? 'Messe (Missel de Paul VI)' : /anticipée/i.test(s) ? 'Messe anticipée' : 'Messe lue'
}
/** Une intention qui compte encore (validée ou en attente) ; annulée et refusée : la messe reste libre. */
export const intentionActive = (i) => i.statut === 'valide' || i.statut === 'en_attente' || i.en_edition
export const estPrivee = (i) => /^prive_/.test(i.google_event_id || '')
export const estLibre = (i) => /^libre/.test(i.google_event_id || '')

/** Messes de l'agenda d'un jour, plus les messes privées et libres enregistrées dans les intentions. */
export function messesDuJour(iso, evenements, intentions) {
  const agenda = (evenements || []).filter((e) => (e.start.dateTime || e.start.date || '').startsWith(iso) && estMesse(e))
  const heures = new Set(agenda.map(heureDe))
  // Messes privées ; intentions libres à une heure où l'agenda n'a pas de messe
  const autres = (intentions || []).filter((i) => i.date_messe === iso && intentionActive(i) && (estPrivee(i) || (estLibre(i) && !heures.has(i.heure_messe))))
    .map((i) => ({ id: i.google_event_id, summary: estPrivee(i) ? 'Messe privée' : 'Messe', start: { dateTime: `${iso}T${i.heure_messe || '09:00'}:00` }, _prive: estPrivee(i), _libre: estLibre(i) }))
  return [...agenda, ...autres].sort((a, b) => heureDe(a).localeCompare(heureDe(b)))
}
/** Intention d'une messe : par identifiant de l'agenda, sinon par date et heure (séries dont l'identifiant varie). */
export function intentionDeLaMesse(e, iso, intentions, deja) {
  const heure = heureDe(e)
  const parId = intentions.find((i) => i.google_event_id === e.id && intentionActive(i))
  const c = parId || (!e._prive ? intentions.find((i) => i.date_messe === iso && i.heure_messe === heure && !estPrivee(i) && intentionActive(i) && !(deja && deja.has(i.id))) : null)
  if (c && deja) deja.add(c.id)
  return c || null
}
/** Messe passée (sans heure connue : à partir du lendemain). */
export function messePassee(i) {
  if (!i.date_messe) return false
  const m = /^(\d{1,2}):(\d{2})/.exec(i.heure_messe || '')
  return new Date(i.date_messe + 'T' + (m ? deux(m[1]) + ':' + m[2] : '23:59') + ':00') < new Date()
}
export const sansAdresse = (i) => !i.email_donateur || i.email_donateur === SANS_ADRESSE || !/@/.test(i.email_donateur)

// ─── Prêtres ───
const ANCIENS = { molin: 'Abbé Molin', legall: 'Abbé Le Gall', carbonnieres: 'Abbé de Carbonnières', autre: 'Autre prêtre' }
/** Célébrants proposés : curé et vicaires du secrétariat (et administrateurs prêtres), plus « Autre prêtre ». */
export function celebrants(utilisateurs) {
  const l = (utilisateurs || []).filter((u) => u.role === 'cure' || u.role === 'vicaire' || (u.role === 'admin' && /^(abbé|père|mgr|chanoine)/i.test(u.nom || '')))
  return [...l.map((u) => ({ cle: cleCelebrant(u), nom: u.nom })), { cle: 'autre', nom: 'Autre prêtre' }]
}
/** Même clé que le serveur : anciennes valeurs d'AppMesse pour les prêtres qu'elle connaît. */
export function cleCelebrant(u) {
  const n = u?.nom || ''
  if (/molin/i.test(n)) return 'molin'
  if (/le\s*gall/i.test(n)) return 'legall'
  if (/carbonni/i.test(n)) return 'carbonnieres'
  return u?.id || 'autre'
}
export function nomCelebrant(cle, utilisateurs) {
  if (!cle) return ''
  const u = (utilisateurs || []).find((x) => x.id === cle || cleCelebrant(x) === cle)
  return u ? u.nom : ANCIENS[cle] || 'Autre prêtre'
}

/** Doublons : plusieurs intentions validées à la même date et heure. */
export function doublons(intentions) {
  const m = {}
  intentions.filter((i) => i.statut === 'valide').forEach((i) => { const k = i.date_messe + ' ' + i.heure_messe; (m[k] ||= []).push(i) })
  return Object.values(m).filter((l) => l.length > 1)
}
