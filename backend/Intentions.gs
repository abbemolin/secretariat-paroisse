/**
 * Tuile « Intentions de messe » : reprise de Calendrier et Gérer d'AppMesse.
 * Même table Supabase `intentions` (lue et écrite par le serveur, clé secrète si elle est enregistrée) ;
 * AppMesse continue de fonctionner en parallèle sur les mêmes données.
 * Mails envoyés depuis l'alias secretariat@ (mêmes objets et mêmes textes que l'Apps Script d'AppMesse).
 * Notification des nouvelles demandes du formulaire du site : vérification toutes les 10 minutes.
 */

var INT_CHAMPS = 'id,created_at,nom_donateur,email_donateur,type_intention,nom_intention,date_messe,heure_messe,statut,commentaire,google_event_id,'
  + 'reponse_pretre,mail_envoye,en_edition,date_originale_mail,mail_approuve,date_alternative,heure_alternative,celebrant,celebre_le';
var INT_SANS_ADRESSE = 'non@renseigne.fr';
var INT_FROM_NAME = 'Paroisse La Croix Glorieuse';
var INT_SIGNATURE = 'Secrétariat de la Paroisse personnelle La Croix glorieuse à Strasbourg';

function intId_(id) { var n = Number(id); if (!n) throw erreur_('INVALIDE', 'Intention inconnue.'); return n; }
function intHeure_(h) {
  h = String(h || '').replace('h', ':').trim();
  var m = h.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw erreur_('INVALIDE', 'Heure invalide (HH:MM).');
  return ('0' + m[1]).slice(-2) + ':' + m[2];
}
function intDate_(d) { d = String(d || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw erreur_('INVALIDE', 'Date invalide.'); return d; }
function intLire_(id) {
  var r = sb_('get', '/rest/v1/intentions?select=' + INT_CHAMPS + '&id=eq.' + intId_(id));
  if (!r || !r.length) throw erreur_('INTROUVABLE', 'Intention introuvable.');
  return r[0];
}
function intMaj_(id, champs) { return sbEcrire_('patch', '/rest/v1/intentions?id=eq.' + intId_(id), champs)[0]; }

/** Refus d'une 2e intention validée à la même date et heure. */
function intVerifierCreneau_(date, heure, sauf) {
  var r = sb_('get', '/rest/v1/intentions?select=id,nom_intention&statut=eq.valide&date_messe=eq.' + date + '&heure_messe=eq.' + encodeURIComponent(heure)
    + (sauf ? '&id=neq.' + intId_(sauf) : ''));
  if (r && r.length) throw erreur_('DOUBLON', 'Ce créneau est déjà pris (' + r[0].nom_intention + ').');
}

/** Toutes les intentions sauf les annulées (comme Gérer). */
function listerIntentions_() {
  verifierDeclencheurIntentions_();
  return sb_('get', '/rest/v1/intentions?select=' + INT_CHAMPS + '&statut=neq.annule&order=date_messe.asc,heure_messe.asc') || [];
}

/** Événements de l'agenda public (le client garde les messes). */
function agendaIntentions_(p) {
  var debut = String(p.debut || ''), fin = String(p.fin || '');
  if (!debut || !fin) throw erreur_('INVALIDE', 'Période invalide.');
  if (new Date(fin) - new Date(debut) > 400 * 86400000) throw erreur_('INVALIDE', 'Période trop longue.');
  return evenementsAgendaApi_(debut, fin);
}

/** Clé du célébrant : les anciennes valeurs d'AppMesse pour les prêtres qu'elle connaît, sinon l'identifiant du compte. */
function cleCelebrant_(u) {
  var nom = String(u && u.nom || '');
  if (/molin/i.test(nom)) return 'molin';
  if (/le\s*gall/i.test(nom)) return 'legall';
  if (/carbonni/i.test(nom)) return 'carbonnieres';
  return u ? u.id : 'autre';
}

/** Saisie ou modification (Calendrier, Gérer → Modifier) : intention validée par le prêtre. */
function ecrireIntention_(p, s) {
  var date = intDate_(p.date_messe), heure = intHeure_(p.heure_messe);
  var nom = String(p.nom_intention || '').trim();
  if (!nom) throw erreur_('INVALIDE', 'Veuillez indiquer une intention.');
  var champs = {
    date_messe: date, heure_messe: heure, nom_intention: nom,
    type_intention: ['Défunt', 'Vivant', 'Action de grâce'].indexOf(p.type_intention) > -1 ? p.type_intention : 'Défunt',
    nom_donateur: String(p.nom_donateur || '').trim() || 'Paroisse',
    commentaire: String(p.commentaire || '').trim()
  };
  var verrou = LockService.getScriptLock(); verrou.waitLock(20000);
  try {
    if (p.id) {
      var avant = intLire_(p.id);
      if (avant.statut === 'valide' || p.valider) intVerifierCreneau_(date, heure, p.id);
      // Comme AppMesse : une modification d'une intention validée remet le mail « à approuver »
      if (avant.statut === 'valide' && (avant.date_messe !== date || avant.heure_messe !== heure || avant.nom_intention !== nom)) { champs.mail_approuve = false; champs.mail_envoye = avant.email_donateur === INT_SANS_ADRESSE; }
      var r = intMaj_(p.id, champs);
      journaliser_(s, 'Intention modifiée', nom + ' — ' + date + ' ' + heure);
      return r;
    }
    intVerifierCreneau_(date, heure);
    // Identifiant propre à chaque intention (AppMesse donnait « libre » à toutes : la 2e écrasait la 1re)
    var gid = String(p.google_event_id || '');
    if (!gid || gid === 'libre') gid = 'libre_' + date + '_' + Date.now();
    if (gid === 'prive') gid = 'prive_' + date + '_' + Date.now();
    var existe = sb_('get', '/rest/v1/intentions?select=id,statut&google_event_id=eq.' + encodeURIComponent(gid));
    if (existe && existe.length && existe[0].statut !== 'annule' && existe[0].statut !== 'refuse') throw erreur_('DOUBLON', 'Une intention est déjà liée à cette messe.');
    champs.google_event_id = gid; champs.statut = 'valide'; champs.email_donateur = INT_SANS_ADRESSE; champs.mail_envoye = true; champs.en_edition = false;
    var res;
    if (existe && existe.length) res = intMaj_(existe[0].id, champs);   // ancienne intention annulée de cette messe : reprise
    else res = sbEcrire_('post', '/rest/v1/intentions', champs)[0];
    journaliser_(s, 'Intention saisie', nom + ' — ' + date + ' ' + heure);
    return res;
  } finally { verrou.releaseLock(); }
}

/** Demande en attente → validée sur un créneau. */
function validerIntention_(p, s) {
  var date = intDate_(p.date), heure = intHeure_(p.heure);
  var verrou = LockService.getScriptLock(); verrou.waitLock(20000);
  try {
    intVerifierCreneau_(date, heure, p.id);
    var it = intLire_(p.id);
    var dateFr = date.split('-').reverse().join('/');
    var txt = 'La Messe à votre intention (' + it.nom_intention + ') sera célébrée le ' + dateFr + ' à ' + heure.replace(':', 'h') + '.';
    var r = intMaj_(p.id, { date_messe: date, heure_messe: heure, statut: 'valide', reponse_pretre: txt, en_edition: false,
      mail_envoye: !intAdresse_(it), mail_approuve: false });
    journaliser_(s, 'Intention validée', it.nom_intention + ' — ' + date + ' ' + heure);
    return r;
  } finally { verrou.releaseLock(); }
}

function intAdresse_(it) {
  var e = String(it.email_donateur || '').replace(/[^a-zA-Z0-9@._\-\+]/g, '').toLowerCase().trim();
  return e.indexOf('@') > 0 && e !== INT_SANS_ADRESSE ? e : '';
}

/** Texte du mail de confirmation (même modèle que l'Apps Script d'AppMesse). */
function texteConfirmation_(it) {
  var nom = String(it.nom_donateur || '').replace(/\*/g, '').trim();
  var intention = String(it.nom_intention || 'votre intention').replace(/\*/g, '').trim();
  var d = it.date_messe.split('-'), dateFr = d[2] + '/' + d[1] + '/' + d[0];
  var heure = String(it.heure_messe || 'à confirmer').replace(':', 'h');
  var dem = it.date_originale_mail || '';
  var phrase = dem && dem !== 'Non précisée' && dem !== dateFr
    ? 'Le créneau du ' + dem + ' étant déjà réservé, nous avons dû décaler votre demande pour "' + intention + '".'
    : 'La Messe pour "' + intention + '" a bien été enregistrée.';
  var msg = String(it.reponse_pretre || '').replace(/\*/g, '').trim();
  if (msg && msg.length < 120 && msg.indexOf('La Messe') !== 0 && msg.indexOf('Bonjour') !== 0 && msg.indexOf('sera célébrée') === -1)
    phrase = 'Concernant votre demande pour "' + intention + '", ' + msg + '.';
  return 'Bonjour ' + nom + ',\n\n' + phrase + '\n\nLa Messe sera célébrée le ' + dateFr + ' à ' + heure + '.\n\n'
    + 'Vous pouvez déposer votre offrande de Messe à l\'église Saint-Louis-en-Ville de Strasbourg, ou l\'envoyer au Presbytère, 2 quai Charles Frey, 67000 Strasbourg.\n\n'
    + INT_SIGNATURE + '\n\n---\n[Ce message est envoyé automatiquement suite à la validation de votre demande par la paroisse.]';
}
/** Texte du mail de refus (même modèle ; AppMesse n'en envoyait que s'il y avait une date proposée). */
function texteRefus_(it, reponse) {
  return 'Bonjour ' + String(it.nom_donateur || '').replace(/\*/g, '').trim() + ',\n\n'
    + 'Concernant votre demande pour "' + String(it.nom_intention || 'votre intention').replace(/\*/g, '').trim() + '" :\n\n'
    + reponse + '\n\n' + INT_SIGNATURE + '\n\n---\n[Ce message est envoyé automatiquement par le secrétariat de la paroisse.]';
}
function reponseRefus_(dateAlt, heureAlt) {
  if (!dateAlt) return 'Nous sommes désolés de ne pouvoir honorer votre demande pour cette date. N\'hésitez pas à nous recontacter pour une autre date.';
  var j = new Date(dateAlt + 'T12:00:00');
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return 'Nous ne pouvons pas honorer votre demande pour cette date. Nous vous proposons le ' + JOURS[j.getDay()] + ' ' + j.getDate() + ' ' + MOIS[j.getMonth()] + ' ' + j.getFullYear()
    + (heureAlt ? ' à ' + String(heureAlt).replace(':', 'h') : '') + '.';
}

/** Aperçu d'un mail : { sorte, destinataire, objet, texte }. */
function apercuMailIntention_(p) {
  var it = intLire_(p.id);
  if (p.refus) {
    var rep = reponseRefus_(p.date_alternative, p.heure_alternative);
    return { sorte: 'refus', destinataire: intAdresse_(it), objet: 'Concernant votre demande d\'intention de Messe', texte: texteRefus_(it, rep), reponse: rep };
  }
  var msg = String(it.reponse_pretre || '');
  return { sorte: 'confirmation', destinataire: intAdresse_(it), objet: 'Confirmation de votre intention de Messe', texte: msg.indexOf('Bonjour') === 0 ? msg : texteConfirmation_(it) };
}

function envoyerMailIntention_(it, objet, texte) {
  var a = intAdresse_(it);
  if (!a) throw erreur_('INVALIDE', 'Pas d\'adresse pour ce demandeur.');
  GmailApp.sendEmail(a, objet, texte, { from: CONFIG.ALIAS, name: INT_FROM_NAME });
  return a;
}

/** Confirmation : envoi immédiat du texte (modifiable), comme « Approuver » puis 📤 dans AppMesse. */
function mailIntention_(p, s) {
  var it = intLire_(p.id);
  if (it.statut !== 'valide') throw erreur_('INVALIDE', 'Seule une intention validée reçoit une confirmation.');
  var texte = String(p.texte || '').trim() || texteConfirmation_(it);
  var a = envoyerMailIntention_(it, 'Confirmation de votre intention de Messe', texte);
  var r = intMaj_(p.id, { reponse_pretre: texte, mail_approuve: true, mail_envoye: true });
  journaliser_(s, 'Intention : confirmation envoyée', it.nom_intention + ' → ' + a);
  return r;
}

/** Refus (date proposée ou non), avec envoi du mail si p.envoyer. */
function refuserIntention_(p, s) {
  var it = intLire_(p.id);
  var dateAlt = p.date_alternative ? intDate_(p.date_alternative) : null;
  var heureAlt = p.heure_alternative ? intHeure_(p.heure_alternative) : null;
  var rep = reponseRefus_(dateAlt, heureAlt);
  var envoye = false;
  if (p.envoyer) { envoyerMailIntention_(it, 'Concernant votre demande d\'intention de Messe', String(p.texte || '').trim() || texteRefus_(it, rep)); envoye = true; }
  // mail_envoye : true dans tous les cas, pour que l'Apps Script d'AppMesse n'envoie pas un second mail
  var r = intMaj_(p.id, { statut: 'refuse', en_edition: false, reponse_pretre: rep, date_alternative: dateAlt, heure_alternative: heureAlt, mail_approuve: true, mail_envoye: true });
  journaliser_(s, 'Intention refusée' + (envoye ? ' (mail envoyé)' : ''), it.nom_intention);
  return r;
}

/** Supprimer = statut « annulé » (rien n'est effacé), comme AppMesse. */
function annulerIntention_(p, s) {
  var r = intMaj_(p.id, { statut: 'annule', en_edition: false });
  journaliser_(s, 'Intention annulée', r.nom_intention);
  return r;
}

/** « J'ai célébré » (célébrant = le prêtre connecté ou celui choisi), ou annulation (celebrant vide). */
function celebrerIntention_(p, s) {
  var cle = p.celebrant === undefined ? cleCelebrant_(trouverUtilisateur_(s.uid)) : (p.celebrant ? String(p.celebrant).slice(0, 40) : null);
  var r = intMaj_(p.id, { celebrant: cle, celebre_le: cle ? (p.le || new Date().toISOString()) : null });
  journaliser_(s, cle ? 'Messe déclarée célébrée' : 'Déclaration de célébration annulée', r.nom_intention + ' — ' + r.date_messe);
  return r;
}

// ─── Nouvelles demandes du formulaire du site : notification ───
function verifierDeclencheurIntentions_() {
  try {
    if (CacheService.getScriptCache().get('decl_int')) return;
    var existe = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'verifierNouvellesIntentions'; });
    if (!existe) ScriptApp.newTrigger('verifierNouvellesIntentions').timeBased().everyMinutes(10).create();
    CacheService.getScriptCache().put('decl_int', '1', 21600);
  } catch (e) { console.error('déclencheur intentions', e); }
}
function verifierNouvellesIntentions() {
  var P = props_(), depuis = P.getProperty('INT_DERNIERE_VUE');
  if (!depuis) { P.setProperty('INT_DERNIERE_VUE', new Date().toISOString()); return; }
  var l = sb_('get', '/rest/v1/intentions?select=id,nom_intention,date_messe,created_at&statut=eq.en_attente&created_at=gt.' + encodeURIComponent(depuis) + '&order=created_at.asc') || [];
  if (!l.length) return;
  P.setProperty('INT_DERNIERE_VUE', l[l.length - 1].created_at);
  var texte = l.length === 1 ? l[0].nom_intention + ' — ' + l[0].date_messe.split('-').reverse().join('/') : l.length + ' nouvelles demandes';
  listerUtilisateurs_().forEach(function (u) {
    if (!u.actif) return;
    if (u.role === 'admin' || (u.acces || {}).intentions) notifier_(u.id, 'Intention de messe : nouvelle demande', texte, '#/intentions/gerer');
  });
}
