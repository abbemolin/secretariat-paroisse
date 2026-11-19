/**
 * Agenda : l'agenda public de la paroisse (agenda principal du compte Gmail),
 * affiché sur croix-glorieuse.org. Les célébrations des dossiers y sont placées
 * SANS NOM (ex. « Baptême »). Le lien avec le dossier est gardé dans une
 * étiquette privée de l'événement, invisible du public.
 */

var TITRES_PUBLICS = {
  bapteme: 'Baptême', mariage: 'Mariage', obseques: 'Obsèques',
  catechumene: "Baptême d'adulte", confirmand: 'Confirmation'
};
var DUREES_MIN = { bapteme: 60, mariage: 90, obseques: 60, catechumene: 120, confirmand: 120 };

function calendrier_() {
  var id = props_().getProperty('AGENDA_ID');
  return id ? CalendarApp.getCalendarById(id) : CalendarApp.getDefaultCalendar();
}

function evenementPublic_(ev) {
  return {
    id: ev.getId(), titre: ev.getTitle(), lieu: ev.getLocation(), description: ev.getDescription(),
    journee: ev.isAllDayEvent(), debut: ev.getStartTime().toISOString(), fin: ev.getEndTime().toISOString(),
    recurrent: ev.isRecurringEvent(), dossier: ev.getTag('dossier') || ''
  };
}

function listerEvenements_(p) {
  return calendrier_().getEvents(new Date(p.debut), new Date(p.fin)).map(evenementPublic_)
    .sort(function (a, b) { return a.debut.localeCompare(b.debut); });
}

function datesEvenement_(p) {
  var debut = new Date(p.debut), fin = new Date(p.fin || p.debut);
  if (isNaN(debut) || isNaN(fin)) throw erreur_('INVALIDE', 'Dates invalides.');
  if (fin < debut) throw erreur_('INVALIDE', 'La fin est avant le début.');
  return { debut: debut, fin: fin };
}

function creerEvenement_(p, s) {
  var d = datesEvenement_(p);
  var o = { location: p.lieu || '', description: p.description || '' };
  var ev;
  if (p.journee) { var f = new Date(d.fin); f.setDate(f.getDate() + 1); ev = calendrier_().createAllDayEvent(p.titre, d.debut, f, o); }
  else ev = calendrier_().createEvent(p.titre, d.debut, d.fin, o);
  journaliser_(s, 'Événement créé', p.titre);
  return evenementPublic_(ev);
}

function modifierEvenement_(p, s) {
  var ev = calendrier_().getEventById(p.id);
  if (!ev) throw erreur_('INTROUVABLE', 'Événement introuvable.');
  if (ev.isRecurringEvent()) throw erreur_('INVALIDE', 'Événement récurrent : à modifier dans Google Agenda.');
  var d = datesEvenement_(p);
  ev.setTitle(p.titre || '');
  ev.setLocation(p.lieu || '');
  ev.setDescription(p.description || '');
  if (p.journee) { var f = new Date(d.fin); f.setDate(f.getDate() + 1); ev.setAllDayDates(d.debut, f); }
  else ev.setTime(d.debut, d.fin);
  // Lien inverse : déplacer l'événement met à jour la date du dossier
  var dossierId = ev.getTag('dossier');
  if (dossierId) majDateDossierDepuisAgenda_(dossierId, d.debut.toISOString(), p.lieu, s);
  journaliser_(s, 'Événement modifié', p.titre);
  return evenementPublic_(ev);
}

function supprimerEvenement_(p, s) {
  var ev = calendrier_().getEventById(p.id);
  if (!ev) throw erreur_('INTROUVABLE', 'Événement introuvable.');
  if (ev.isRecurringEvent()) throw erreur_('INVALIDE', 'Événement récurrent : à supprimer dans Google Agenda.');
  var dossierId = ev.getTag('dossier');
  var titre = ev.getTitle();
  ev.deleteEvent();
  if (dossierId) majDateDossierDepuisAgenda_(dossierId, '', null, s);
  journaliser_(s, 'Événement supprimé', titre);
  return true;
}

/** Crée, déplace ou supprime l'événement public d'un dossier. Retourne l'id de l'événement ('' si aucun). */
function synchroniserEvenementDossier_(d) {
  var cal = calendrier_();
  var ev = d.evenement_id ? cal.getEventById(d.evenement_id) : null;
  if (!d.date_celebration || d.etat === 'annule') {
    if (ev) ev.deleteEvent();
    return '';
  }
  var debut = new Date(d.date_celebration);
  var fin = new Date(debut.getTime() + (DUREES_MIN[d.type] || 60) * 60000);
  var lieu = json2_(d.donnees, {}).infos ? (json2_(d.donnees, {}).infos.lieu_celebration || '') : '';
  if (ev) {
    ev.setTime(debut, fin);
    ev.setLocation(lieu);
  } else {
    ev = cal.createEvent(TITRES_PUBLICS[d.type] || 'Célébration', debut, fin, { location: lieu });
    ev.setTag('dossier', d.id);
  }
  return ev.getId();
}

/** Lit l'heure actuelle de l'événement lié (au cas où il a été déplacé dans Google Agenda). */
function dateEvenementDossier_(d) {
  if (!d.evenement_id) return null;
  try {
    var ev = calendrier_().getEventById(d.evenement_id);
    return ev ? ev.getStartTime().toISOString() : '';
  } catch (e) { return null; }
}
