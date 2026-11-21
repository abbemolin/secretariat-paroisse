/**
 * Secrétariat – Paroisse personnelle La Croix glorieuse
 * Backend Google Apps Script — fichier principal
 *
 * Tourne sous le compte Gmail de la paroisse. Fichiers du projet :
 *   Code.gs       point d'entrée, configuration, utilisateurs, réglages, notifications
 *   Courrier.gs   Gmail (alias secretariat@), suivi, réponses types, envois groupés
 *   Agenda.gs     agenda public + lien avec les dossiers
 *   Dossiers.gs   dossiers de sacrements + formulaires publics du site
 *   Documents.gs  Drive du secrétariat
 *   Push.gs       notifications sur téléphone (Web Push, VAPID)
 *   Extraits.gs   extraits de baptême signés (registre, PDF, envoi)
 *   Catechisme.gs inscriptions au catéchisme (formulaire Google), groupes, paiements
 *   Confirmands.gs formulaire Google des confirmands adultes
 *   CorUnum.gs    fraternités Cor Unum (formulaire Google, équipes, chefs, anciens)
 *   Tri.gs        tri automatique des mails entrants (mots-clés, réponse auto horaires)
 *   Installation.gs  installer() à lancer une fois
 */

// ─────────────────────────────── CONFIGURATION ───────────────────────────────

var CONFIG = {
  ALIAS: 'secretariat@croix-glorieuse.org',     // adresse d'envoi (« Envoyer en tant que » dans Gmail)
  NOM_EXPEDITEUR: 'Paroisse La Croix glorieuse',
  DOSSIER_RACINE: 'Secrétariat – La Croix glorieuse',
  ROLES: ['admin', 'cure', 'secretaire'],
  STATUTS_MAIL: ['À traiter', 'En cours', 'Traité'],
  DUREE_SESSION_JOURS: 30,
  ESSAIS_MAX: 5,
  // Origines autorisées pour les formulaires publics (vide = toutes)
  SITE: 'https://www.croix-glorieuse.org'
};

var DROITS = {
  admin: ['mail', 'agenda', 'dossiers', 'documents', 'utilisateurs', 'reglages'],
  cure: ['mail', 'agenda', 'dossiers', 'documents'],
  secretaire: ['mail', 'agenda', 'dossiers', 'documents', 'reglages']
};

// Réglages par défaut (modifiables dans l'appli → Réglages)
var REGLAGES_DEFAUT = {
  paroisse: 'Paroisse personnelle La Croix glorieuse',
  paroisse_courte: 'La Croix glorieuse',
  diocese: 'Strasbourg',
  commune: 'Strasbourg',
  eglise: '',
  adresse: '2, quai Charles Frey 67000 Strasbourg',
  site: 'croix-glorieuse.org',
  url_horaires: 'https://www.croix-glorieuse.org/horaires',
  url_formulaires: '',   // adresse du site des formulaires, ex. https://secretariat.croix-glorieuse.org/ (vide = hébergés avec l'appli)
  url_rdv_cure: 'https://calendar.app.google/B8m9xbUJEaXQSDQQA',   // prise de rendez-vous avec le curé (première communion)
  url_rdv_cure_integre: 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ19XHvXRpcqqDx7pdnUvlmlmIJNzWLQ65CAx0cKZMInSlwRxZ3gbAtEGx4jf2OC1AdF1gm6yuIg?gv=true',
  signataires: '', // ids des utilisateurs autorisés à signer les extraits (vide = administrateurs et secrétaires)
  url_icones: ''   // ex. https://<compte>.github.io/<depot>/signature (icônes des signatures)
};

// ─────────────────────────────── POINT D'ENTRÉE ──────────────────────────────

function doGet() {
  return json_({ ok: true, service: 'secretariat' });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!req.action && req.eventType) return notificationHelloAsso_(req);   // notification HelloAsso
    var action = String(req.action || '');
    var p = req.payload || {};

    if (action === 'auth.login') return json_({ ok: true, data: login_(p) });
    if (action === 'public.demande') return json_({ ok: true, data: recevoirDemandePublique_(p) });
    if (action === 'public.infos') return json_({ ok: true, data: infosPubliques_(p) });
    if (/^rej\./.test(action)) return json_({ ok: true, data: actionRejoindre_(action, p) });
    if (/^chef\./.test(action)) return json_({ ok: true, data: actionChef_(action, p) });
    if (/^ret\./.test(action)) return json_({ ok: true, data: actionRetraitePublique_(action, p) });
    if (/^esp\./.test(action)) return json_({ ok: true, data: actionEspace_(action, p) });
    if (/^pay\./.test(action)) return json_({ ok: true, data: actionPaiementPublique_(action, p) });
    if (/^boutique\./.test(action)) return json_({ ok: true, data: actionBoutique_(action, p) });

    var session = verifierSession_(req.token);
    var route = ROUTES[action];
    if (!route) throw erreur_('ACTION_INCONNUE', 'Action inconnue : ' + action);
    if (route.droit && DROITS[session.role].indexOf(route.droit) === -1) {
      throw erreur_('INTERDIT', "Vous n'avez pas accès à cette fonction.");
    }
    return json_({ ok: true, data: route.fn(p, session) });
  } catch (err) {
    console.error(err && err.stack || err);
    return json_({ ok: false, code: err.code || 'ERREUR', message: err.message || String(err) });
  }
}

var ROUTES = {
  'auth.me':               { fn: function (p, s) { return utilisateurPublic_(trouverUtilisateur_(s.uid)); } },
  'auth.logout':           { fn: logout_ },
  'auth.motdepasse':       { fn: changerMotDePasse_ },
  'app.init':              { fn: initApp_ },
  'accueil.resume':        { fn: resumeAccueil_ },

  'utilisateurs.liste':    { fn: listerUtilisateurs_ },
  'utilisateurs.creer':    { fn: creerUtilisateur_, droit: 'utilisateurs' },
  'utilisateurs.modifier': { fn: modifierUtilisateur_, droit: 'utilisateurs' },
  'journal.liste':         { fn: listerJournal_, droit: 'reglages' },

  'reglages.lire':         { fn: function () { return reglages_(); } },
  'reglages.ecrire':       { fn: ecrireReglages_, droit: 'reglages' },
  'signatures.liste':      { fn: listerSignatures_ },
  'signatures.ecrire':     { fn: ecrireSignatures_, droit: 'reglages' },
  'reponses.liste':        { fn: listerReponses_ },
  'reponses.ecrire':       { fn: ecrireReponses_, droit: 'reglages' },

  'notifications.liste':   { fn: listerNotifications_ },
  'notifications.lues':    { fn: marquerNotificationsLues_ },
  'notifications.prefs':   { fn: function (p, s) { return p.ecrire ? ecrirePrefsNotif_(p, s) : lirePrefsNotif_(p, s); } },
  'push.cle':              { fn: function () { return clePubliquePush_(); } },
  'push.abonner':          { fn: abonnerPush_ },
  'push.desabonner':       { fn: desabonnerPush_ },
  'push.tester':           { fn: function (p, s) { notifier_(s.uid, 'Test de notification', 'Les notifications fonctionnent.', '#/'); return true; } },

  'mail.liste':            { fn: listerMails_, droit: 'mail' },
  'mail.fil':              { fn: lireFil_, droit: 'mail' },
  'mail.piecejointe':      { fn: pieceJointe_, droit: 'mail' },
  'mail.envoyer':          { fn: envoyerMail_, droit: 'mail' },
  'mail.libelles':         { fn: listerLibelles_, droit: 'mail' },
  'mail.modifier':         { fn: modifierFil_, droit: 'mail' },
  'mail.suivi':            { fn: modifierSuiviMail_, droit: 'mail' },
  'mail.commenter':        { fn: commenterMail_, droit: 'mail' },
  'mail.groupes':          { fn: listerGroupesContacts_, droit: 'mail' },
  'mail.envoiGroupe':      { fn: envoyerAuGroupe_, droit: 'mail' },
  'tri.lire':              { fn: lireTri_, droit: 'mail' },
  'tri.ecrire':            { fn: ecrireTri_, droit: 'reglages' },
  'tri.tester':            { fn: testerTri_, droit: 'mail' },
  'mail.quota':            { fn: function () { return MailApp.getRemainingDailyQuota(); }, droit: 'mail' },

  'agenda.evenements':     { fn: listerEvenements_, droit: 'agenda' },
  'agenda.creer':          { fn: creerEvenement_, droit: 'agenda' },
  'agenda.modifier':       { fn: modifierEvenement_, droit: 'agenda' },
  'agenda.supprimer':      { fn: supprimerEvenement_, droit: 'agenda' },
  'agenda.rendezvous':     { fn: chercherRendezVous_, droit: 'dossiers' },

  'dossiers.liste':        { fn: listerDossiers_, droit: 'dossiers' },
  'dossiers.lire':         { fn: lireDossier_, droit: 'dossiers' },
  'dossiers.creer':        { fn: creerDossier_, droit: 'dossiers' },
  'dossiers.modifier':     { fn: modifierDossier_, droit: 'dossiers' },
  'dossiers.piece':        { fn: deposerPieceDossier_, droit: 'dossiers' },
  'dossiers.archiver':     { fn: archiverDocumentDossier_, droit: 'dossiers' },
  'dossiers.supprimer':    { fn: supprimerDossier_, droit: 'dossiers' },
  'dossiers.signerB6':     { fn: signerB6_, droit: 'dossiers' },
  'cate.liste':            { fn: listerCate_, droit: 'dossiers' },
  'cate.lire':             { fn: lireCate_, droit: 'dossiers' },
  'cate.creer':            { fn: creerCate_, droit: 'dossiers' },
  'cate.modifier':         { fn: modifierCate_, droit: 'dossiers' },
  'cate.paiement':         { fn: paiementCate_, droit: 'dossiers' },
  'cate.supprimer':        { fn: supprimerCate_, droit: 'dossiers' },
  'cate.dossier':          { fn: dossierCate_, droit: 'dossiers' },
  'cate.importer':         { fn: importerCate_, droit: 'dossiers' },
  'cate.envoyer':          { fn: envoyerCate_, droit: 'dossiers' },
  'cate.reglages':         { fn: lireCateReglages_, droit: 'dossiers' },
  'cate.reglagesEcrire':   { fn: ecrireCateReglages_, droit: 'reglages' },
  'conf.importer':         { fn: importerConf_, droit: 'dossiers' },
  'conf.relancer':         { fn: relancerConf_, droit: 'dossiers' },
  'conf.reglages':         { fn: lireConfReglages_, droit: 'dossiers' },
  'conf.reglagesEcrire':   { fn: ecrireConfReglages_, droit: 'reglages' },
  'dossiers.changerType':  { fn: changerTypeConf_, droit: 'dossiers' },
  'dossiers.importerCatechumenes': { fn: importerCatechumenes_, droit: 'dossiers' },
  'cor.liste':             { fn: listerCor_, droit: 'dossiers' },
  'retraites.liste':       { fn: listerRetraites_, droit: 'dossiers' },
  'espace.etat':           { fn: etatEspace_, droit: 'dossiers' },
  'espace.lien':           { fn: lienEspace_, droit: 'dossiers' },
  'espace.lettre':         { fn: lettreEspace_, droit: 'dossiers' },
  'cor.equipesCourantes':  { fn: equipesCorCourantes_, droit: 'dossiers' },
  'cor.placer':            { fn: placerCor_, droit: 'dossiers' },
  'cor.lienInscription':   { fn: lienInscriptionCor_, droit: 'dossiers' },
  'espace.signalement':    { fn: signalementEspace_, droit: 'dossiers' },
  'textes.liste':          { fn: listerTextes_, droit: 'dossiers' },
  'textes.ecrire':         { fn: ecrireTexte_, droit: 'dossiers' },
  'textes.supprimer':      { fn: supprimerTexte_, droit: 'dossiers' },
  'calendrier.ecrire':     { fn: ecrireCalendrier_, droit: 'dossiers' },
  'paiements.reglages':    { fn: lireHaReglages_, droit: 'reglages' },
  'paiements.reglagesEcrire': { fn: ecrireHaReglages_, droit: 'reglages' },
  'paiements.tester':      { fn: testerHelloAsso_, droit: 'reglages' },
  'livres.liste':          { fn: listerLivres_, droit: 'dossiers' },
  'livres.catalogue':      { fn: ecrireCatalogue_, droit: 'dossiers' },
  'livres.commande':       { fn: modifierCommande_, droit: 'dossiers' },
  'retraites.lire':        { fn: lireRetraite_, droit: 'dossiers' },
  'retraites.ecrire':      { fn: ecrireRetraite_, droit: 'dossiers' },
  'retraites.supprimer':   { fn: supprimerRetraite_, droit: 'dossiers' },
  'retraites.inscription': { fn: modifierInscriptionRet_, droit: 'dossiers' },
  'retraites.invites':     { fn: invitesRetraite_, droit: 'dossiers' },
  'retraites.inviter':     { fn: inviterRetraite_, droit: 'dossiers' },
  'cor.relier':            { fn: relierCor_, droit: 'dossiers' },
  'cor.modifier':          { fn: modifierCor_, droit: 'dossiers' },
  'cor.creer':             { fn: creerCor_, droit: 'dossiers' },
  'cor.supprimer':         { fn: supprimerCor_, droit: 'dossiers' },
  'cor.equipe':            { fn: equipeCor_, droit: 'dossiers' },
  'cor.importer':          { fn: importerCor_, droit: 'dossiers' },
  'cor.onglets':           { fn: reprendreOngletsCor_, droit: 'dossiers' },
  'cor.nouvelleAnnee':     { fn: nouvelleAnneeCor_, droit: 'dossiers' },
  'cor.envoyer':           { fn: envoyerCor_, droit: 'dossiers' },
  'cor.lienChef':          { fn: lienChefCor_, droit: 'dossiers' },
  'cor.fil':               { fn: filCor_, droit: 'dossiers' },
  'cor.tousChefs':         { fn: messageTousChefsCor_, droit: 'dossiers' },
  'cor.reglages':          { fn: lireCorReglagesPublic_, droit: 'dossiers' },
  'cor.reglagesEcrire':    { fn: ecrireCorReglagesRoute_, droit: 'reglages' },
  'extraits.liste':        { fn: listerExtraits_, droit: 'dossiers' },
  'extraits.lire':         { fn: lireExtrait_, droit: 'dossiers' },
  'extraits.enregistrer':  { fn: enregistrerExtrait_, droit: 'dossiers' },
  'extraits.signer':       { fn: signerExtrait_, droit: 'dossiers' },
  'extraits.signature':    { fn: signatureExtrait_, droit: 'dossiers' },
  'extraits.envoyer':      { fn: envoyerExtrait_, droit: 'dossiers' },
  'extraits.supprimer':    { fn: supprimerExtrait_, droit: 'dossiers' },
  'sceau.lire':            { fn: function () { return lireSceau_(); } },
  'sceau.ecrire':          { fn: ecrireSceau_, droit: 'reglages' },
  'promotions.liste':      { fn: listerPromotions_, droit: 'dossiers' },
  'promotions.fixer':      { fn: fixerPromotion_, droit: 'dossiers' },

  'documents.liste':       { fn: listerDossierDrive_, droit: 'documents' },
  'documents.chercher':    { fn: chercherDocuments_, droit: 'documents' },
  'documents.telecharger': { fn: telechargerDocument_, droit: 'documents' },
  'documents.envoyer':     { fn: deposerDocument_, droit: 'documents' },
  'documents.dossier':     { fn: creerDossierDrive_, droit: 'documents' },
  'documents.renommer':    { fn: renommerDocument_, droit: 'documents' },
  'documents.deplacer':    { fn: deplacerDocument_, droit: 'documents' }
};

// ─────────────────────────────── OUTILS ──────────────────────────────────────

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function erreur_(code, message) { var e = new Error(message); e.code = code; return e; }
function props_() { return PropertiesService.getScriptProperties(); }
function prop_(cle) {
  var v = props_().getProperty(cle);
  if (!v) throw erreur_('NON_INSTALLE', "L'installation n'a pas été faite (fonction installer()).");
  return v;
}
function db_() {
  if (!db_.cache) db_.cache = SpreadsheetApp.openById(prop_('DB_ID'));
  return db_.cache;
}
function feuille_(nom) { return db_().getSheetByName(nom); }
function uid_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 12); }
function maintenant_() { return new Date().toISOString(); }
function hex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join(''); }
function hacher_(mdp, sel) {
  var h = sel + '|' + mdp;
  for (var i = 0; i < 2000; i++) {
    h = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8));
  }
  return h;
}
function verrou_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function json2_(v, defaut) { try { return v ? JSON.parse(v) : defaut; } catch (e) { return defaut; } }
function echapper_(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Lit une feuille en objets ({_ligne} = n° de ligne). Toutes les cellules sont au format texte. */
function lignes_(nom) {
  var f = feuille_(nom);
  var valeurs = f.getDataRange().getValues();
  var entetes = valeurs.shift();
  return valeurs.map(function (r, i) {
    var o = { _ligne: i + 2 };
    entetes.forEach(function (h, j) { o[h] = r[j] instanceof Date ? dateCellule_(r[j]) : r[j]; });
    return o;
  }).filter(function (o) { return o[entetes[0]] !== ''; });
}
/**
 * Une cellule que Google Sheets a convertie en date : « 30/12/1899 hh:mm » était une heure saisie (« 15:00 »),
 * minuit pile était une date seule (« 2027-02-21 ») ; le reste est un horodatage.
 */
var TZ_FEUILLE_ = null;
function dateCellule_(d) {
  var tz = TZ_FEUILLE_ || (TZ_FEUILLE_ = (function () { try { return db_().getSpreadsheetTimeZone(); } catch (e) { return Session.getScriptTimeZone(); } })());
  if (d.getFullYear() < 1901) return Utilities.formatDate(d, tz, 'HH:mm');
  if (Utilities.formatDate(d, tz, 'HH:mm:ss') === '00:00:00') return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  return d.toISOString();
}
function ecrireLigne_(nom, obj) {
  var f = feuille_(nom);
  var entetes = f.getRange(1, 1, 1, f.getLastColumn()).getValues()[0];
  var row = entetes.map(function (h) {
    var v = obj[h];
    if (v === undefined || v === null) return '';
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  });
  // Cellules forcées en texte avant l'écriture : « 2027-02-21 » ou « 15:00 » ne deviennent jamais des dates.
  if (!obj._ligne) {
    f.appendRow(row);   // ajout atomique (deux écritures simultanées ne se marchent pas dessus)
    var n = f.getLastRow(), debut = Math.max(2, n - 20);
    var ids = f.getRange(debut, 1, n - debut + 1, 1).getValues();
    for (var k = ids.length - 1; k >= 0; k--) if (String(ids[k][0]) === String(row[0])) { n = debut + k; break; }
    obj._ligne = n;
  }
  f.getRange(obj._ligne, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  return obj;
}
function journaliser_(session, action, detail) {
  try { feuille_('Journal').appendRow([maintenant_(), session ? session.nom : 'système', action, detail || '']); } catch (e) {}
}

// ─────────────────────────────── AUTHENTIFICATION ────────────────────────────

function estActif_(u) { return u.actif === true || u.actif === 'true' || u.actif === 'TRUE'; }

function trouverUtilisateur_(id) {
  var u = lignes_('Utilisateurs').filter(function (x) { return x.id === id; })[0];
  if (!u) throw erreur_('INTROUVABLE', 'Utilisateur introuvable.');
  return u;
}
function utilisateurPublic_(u) {
  return { id: u.id, identifiant: u.identifiant, nom: u.nom, role: u.role, signature: u.signature,
           actif: estActif_(u), droits: DROITS[u.role] || [], derniere_connexion: u.derniere_connexion };
}

function login_(p) {
  var identifiant = String(p.identifiant || '').trim().toLowerCase();
  var cache = CacheService.getScriptCache();
  var cle = 'essais_' + identifiant;
  var essais = Number(cache.get(cle) || 0);
  if (essais >= CONFIG.ESSAIS_MAX) throw erreur_('BLOQUE', 'Trop de tentatives. Réessayez dans 15 minutes.');
  var u = lignes_('Utilisateurs').filter(function (x) { return String(x.identifiant).toLowerCase() === identifiant; })[0];
  if (!u || !estActif_(u) || hacher_(String(p.motdepasse || ''), u.sel) !== u.hash) {
    cache.put(cle, String(essais + 1), 900);
    throw erreur_('IDENTIFIANTS', 'Identifiant ou mot de passe incorrect.');
  }
  cache.remove(cle);
  nettoyerSessions_();
  var token = Utilities.getUuid() + Utilities.getUuid();
  props_().setProperty('sess_' + token, JSON.stringify({ uid: u.id, exp: Date.now() + CONFIG.DUREE_SESSION_JOURS * 86400000 }));
  u.derniere_connexion = maintenant_();
  ecrireLigne_('Utilisateurs', u);
  journaliser_({ nom: u.nom }, 'Connexion', '');
  return { token: token, utilisateur: utilisateurPublic_(u) };
}

function verifierSession_(token) {
  if (!token) throw erreur_('SESSION', 'Veuillez vous connecter.');
  var brut = props_().getProperty('sess_' + token);
  if (!brut) throw erreur_('SESSION', 'Session expirée, veuillez vous reconnecter.');
  var s = JSON.parse(brut);
  if (s.exp < Date.now()) { props_().deleteProperty('sess_' + token); throw erreur_('SESSION', 'Session expirée, veuillez vous reconnecter.'); }
  var cache = CacheService.getScriptCache();
  var u = json2_(cache.get('u_' + s.uid), null);
  if (!u) { u = utilisateurPublic_(trouverUtilisateur_(s.uid)); cache.put('u_' + s.uid, JSON.stringify(u), 60); }
  if (!u.actif) throw erreur_('SESSION', 'Compte désactivé.');
  return { uid: u.id, role: u.role, nom: u.nom, signature: u.signature, token: token };
}

function nettoyerSessions_() {
  var tout = props_().getProperties();
  Object.keys(tout).forEach(function (k) {
    if (k.indexOf('sess_') === 0 && json2_(tout[k], { exp: 0 }).exp < Date.now()) props_().deleteProperty(k);
  });
}
function fermerSessionsDe_(uid) {
  var tout = props_().getProperties();
  Object.keys(tout).forEach(function (k) {
    if (k.indexOf('sess_') === 0 && json2_(tout[k], {}).uid === uid) props_().deleteProperty(k);
  });
}
function logout_(p, s) { props_().deleteProperty('sess_' + s.token); return true; }

function verifierMotDePasse_(m) {
  if (String(m || '').length < 8) throw erreur_('INVALIDE', 'Le mot de passe doit faire au moins 8 caractères.');
}
function changerMotDePasse_(p, s) {
  verifierMotDePasse_(p.nouveau);
  return verrou_(function () {
    var u = trouverUtilisateur_(s.uid);
    if (hacher_(String(p.ancien || ''), u.sel) !== u.hash) throw erreur_('IDENTIFIANTS', 'Ancien mot de passe incorrect.');
    u.sel = uid_() + uid_();
    u.hash = hacher_(p.nouveau, u.sel);
    ecrireLigne_('Utilisateurs', u);
    journaliser_(s, 'Mot de passe modifié', '');
    return true;
  });
}

// ─────────────────────────────── UTILISATEURS ────────────────────────────────

function listerUtilisateurs_() { return lignes_('Utilisateurs').map(utilisateurPublic_); }

function creerUtilisateur_(p, s) {
  var identifiant = String(p.identifiant || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(identifiant)) throw erreur_('INVALIDE', 'Identifiant : 3 à 30 caractères (lettres, chiffres, point, tiret).');
  if (CONFIG.ROLES.indexOf(p.role) === -1) throw erreur_('INVALIDE', 'Rôle inconnu.');
  verifierMotDePasse_(p.motdepasse);
  return verrou_(function () {
    if (lignes_('Utilisateurs').some(function (x) { return String(x.identifiant).toLowerCase() === identifiant; })) {
      throw erreur_('INVALIDE', 'Cet identifiant existe déjà.');
    }
    var sel = uid_() + uid_();
    var u = ecrireLigne_('Utilisateurs', {
      id: uid_(), identifiant: identifiant, nom: String(p.nom || identifiant), role: p.role, signature: p.signature || '',
      sel: sel, hash: hacher_(p.motdepasse, sel), actif: true, cree_le: maintenant_(), derniere_connexion: ''
    });
    journaliser_(s, 'Utilisateur créé', u.nom + ' (' + u.role + ')');
    return utilisateurPublic_(u);
  });
}

function modifierUtilisateur_(p, s) {
  return verrou_(function () {
    var tous = lignes_('Utilisateurs');
    var u = tous.filter(function (x) { return x.id === p.id; })[0];
    if (!u) throw erreur_('INTROUVABLE', 'Utilisateur introuvable.');
    if (p.nom !== undefined) u.nom = String(p.nom);
    if (p.signature !== undefined) u.signature = String(p.signature);
    if (p.role !== undefined) {
      if (CONFIG.ROLES.indexOf(p.role) === -1) throw erreur_('INVALIDE', 'Rôle inconnu.');
      u.role = p.role;
    }
    if (p.actif !== undefined) u.actif = !!p.actif;
    if (p.motdepasse) { verifierMotDePasse_(p.motdepasse); u.sel = uid_() + uid_(); u.hash = hacher_(p.motdepasse, u.sel); }
    var admins = tous.filter(function (x) { var y = x.id === u.id ? u : x; return y.role === 'admin' && estActif_(y); });
    if (!admins.length) throw erreur_('INVALIDE', 'Il doit rester au moins un administrateur actif.');
    ecrireLigne_('Utilisateurs', u);
    CacheService.getScriptCache().remove('u_' + u.id);
    if (!estActif_(u) || p.motdepasse) fermerSessionsDe_(u.id);
    journaliser_(s, 'Utilisateur modifié', u.nom);
    return utilisateurPublic_(u);
  });
}

function listerJournal_(p) {
  var f = feuille_('Journal');
  var n = f.getLastRow() - 1;
  if (n <= 0) return [];
  var nb = Math.min(n, p.limite || 300);
  return f.getRange(f.getLastRow() - nb + 1, 1, nb, 4).getValues().reverse()
    .map(function (r) { return { date: String(r[0]), utilisateur: r[1], action: r[2], detail: r[3] }; });
}

// ─────────────────────────────── RÉGLAGES, SIGNATURES, RÉPONSES TYPES ────────

function reglages_() {
  var r = {};
  Object.keys(REGLAGES_DEFAUT).forEach(function (k) { r[k] = REGLAGES_DEFAUT[k]; });
  var stock = json2_(props_().getProperty('REGLAGES'), {});
  Object.keys(stock).forEach(function (k) { r[k] = stock[k]; });
  return r;
}
function ecrireReglages_(p, s) {
  var r = reglages_();
  Object.keys(REGLAGES_DEFAUT).forEach(function (k) { if (p[k] !== undefined) r[k] = String(p[k]); });
  props_().setProperty('REGLAGES', JSON.stringify(r));
  journaliser_(s, 'Réglages modifiés', '');
  return r;
}

function listerSignatures_() { return json2_(props_().getProperty('SIGNATURES'), []); }
function ecrireSignatures_(p, s) {
  var liste = (p.signatures || []).map(function (x) {
    return { cle: x.cle || uid_(), nom: String(x.nom || ''), fonction: String(x.fonction || ''),
             email: String(x.email || ''), telephone: String(x.telephone || '') };
  });
  props_().setProperty('SIGNATURES', JSON.stringify(liste));
  journaliser_(s, 'Signatures modifiées', '');
  return liste;
}

/** HTML de signature, reproduisant le modèle de la paroisse. */
function signatureHtml_(cle) {
  var sig = listerSignatures_().filter(function (x) { return x.cle === cle; })[0];
  if (!sig) return '';
  var r = reglages_();
  var bleu = '#1a73e8', gris = '#777';
  var ic = function (nom, repli) {
    return r.url_icones
      ? '<img src="' + r.url_icones.replace(/\/$/, '') + '/' + nom + '.png" width="16" height="16" style="vertical-align:middle;margin-right:8px" alt="">'
      : '<span style="color:' + bleu + ';margin-right:8px">' + repli + '</span>';
  };
  var tel = sig.telephone.replace(/\s/g, '');
  var ligne = function (contenu) { return '<tr><td style="padding:3px 0;font-size:13px;color:' + gris + '">' + contenu + '</td></tr>'; };
  return '<br><table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;border-collapse:collapse;min-width:260px">' +
    '<tr><td style="font-size:14px;font-weight:bold;color:#222;padding-bottom:2px">' + echapper_(sig.nom) + '</td></tr>' +
    (sig.fonction ? '<tr><td style="font-size:13px;color:' + gris + '">' + echapper_(sig.fonction) + '</td></tr>' : '') +
    '<tr><td style="padding:10px 0"><div style="border-top:2px solid ' + bleu + ';width:100%"></div></td></tr>' +
    ligne(ic('mail', '✉') + '<a href="mailto:' + echapper_(sig.email) + '" style="color:' + gris + '">' + echapper_(sig.email) + '</a>') +
    ligne(ic('tel', '☎') + '<a href="tel:' + echapper_(tel) + '" style="color:' + gris + '">' + echapper_(sig.telephone) + '</a>') +
    ligne(ic('lieu', '⌖') + echapper_(r.adresse)) +
    ligne(ic('lien', '🔗') + '<a href="https://' + echapper_(r.site) + '" style="color:' + bleu + ';font-weight:bold">' + echapper_(r.site) + '</a>') +
    '<tr><td style="padding-top:10px"><div style="border-top:2px solid ' + bleu + ';width:100%"></div></td></tr>' +
    '</table>';
}

var FORMULE_FIN = 'Avec l\'assurance de nos prières à toutes vos intentions,';
function avecFormuleFin_(t) {
  return String(t || '').replace(/,\s*bien fraternellement,/gi, '.\n\n' + FORMULE_FIN).replace(/Bien fraternellement,/g, FORMULE_FIN);
}
function listerReponses_() {
  var l = json2_(props_().getProperty('REPONSES'), []);
  // Une seule fois : « Bien fraternellement, » devient la formule de la paroisse dans les réponses types enregistrées
  if (!props_().getProperty('FORMULE_FIN_OK')) {
    l = l.map(function (x) { x.corps = avecFormuleFin_(x.corps); return x; });
    props_().setProperty('REPONSES', JSON.stringify(l));
    props_().setProperty('FORMULE_FIN_OK', '1');
  }
  // Réponses types ajoutées après l'installation
  var ajout = REPONSES_DEFAUT.filter(function (r) { return r.cle === 'accuse_confirmation' && !l.some(function (x) { return x.cle === r.cle; }); });
  if (ajout.length) { l = l.concat(ajout); props_().setProperty('REPONSES', JSON.stringify(l)); }
  return l;
}
function ecrireReponses_(p, s) {
  var liste = (p.reponses || []).map(function (x) {
    return { cle: x.cle || uid_(), titre: String(x.titre || ''), sujet: String(x.sujet || ''), corps: String(x.corps || '') };
  });
  props_().setProperty('REPONSES', JSON.stringify(liste));
  journaliser_(s, 'Réponses types modifiées', '');
  return liste;
}

// ─────────────────────────────── INIT APPLI / ACCUEIL ────────────────────────

function initApp_(p, s) {
  return {
    utilisateur: utilisateurPublic_(trouverUtilisateur_(s.uid)),
    utilisateurs: listerUtilisateurs_().filter(function (u) { return u.actif; })
      .map(function (u) { return { id: u.id, nom: u.nom, role: u.role, signature: u.signature }; }),
    reglages: reglages_(),
    signatures: listerSignatures_(),
    reponses: listerReponses_(),
    nonLues: compterNotificationsNonLues_(s.uid)
  };
}

function resumeAccueil_(p, s) {
  var d = DROITS[s.role], res = {};
  if (d.indexOf('mail') > -1) {
    res.mailsNonLus = GmailApp.getInboxUnreadCount();
    var suivis = lignes_('SuiviMails');
    res.mesMails = suivis.filter(function (x) { return x.attribue_a === s.uid && x.statut !== 'Traité'; }).length;
    res.mailsATraiter = suivis.filter(function (x) { return x.statut === 'À traiter'; }).length;
  }
  if (d.indexOf('agenda') > -1) {
    var debut = new Date(); debut.setHours(0, 0, 0, 0);
    res.evenements = listerEvenements_({ debut: debut.toISOString(), fin: new Date(debut.getTime() + 7 * 86400000).toISOString() });
  }
  if (d.indexOf('dossiers') > -1) {
    var ds = lignes_('Dossiers').filter(function (x) { return x.etat === 'ouvert'; });
    res.dossiersOuverts = ds.length;
    res.mesDossiers = ds.filter(function (x) { return x.responsable === s.uid; }).map(dossierResume_);
    res.nouveaux = ds.filter(function (x) { return !json2_(x.donnees, {}).etapes || etapesFaites_(x) === 0; }).map(dossierResume_);
  }
  res.notifications = listerNotifications_({ limite: 8 }, s);
  res.afaire = aFaire_(s);
  return res;
}

/** Liste « À faire » de l'accueil : tout ce qui attend une action, avec le lien pour y aller. */
function aFaire_(s) {
  var d = DROITS[s.role], l = [];
  var essai = function (fn) { try { fn(); } catch (e) { console.error('aFaire', e); } };
  if (d.indexOf('mail') > -1) essai(function () {
    var n = lignes_('SuiviMails').filter(function (x) { return x.statut === 'À traiter'; }).length;
    if (n) l.push({ cle: 'mails', nombre: n, texte: n > 1 ? 'mails à traiter' : 'mail à traiter', lien: '/courrier?filtre=atraiter' });
  });
  if (d.indexOf('dossiers') > -1) {
    essai(function () {
      var ds = lignes_('Dossiers').filter(function (x) { return x.etat === 'ouvert'; });
      var nouv = ds.filter(function (x) { return etapesFaites_(x) <= 1 && (json2_(x.donnees, {}).historique || []).length <= 2; }).length;
      if (nouv) l.push({ cle: 'demandes', nombre: nouv, texte: nouv > 1 ? 'nouvelles demandes à prendre en charge' : 'nouvelle demande à prendre en charge', lien: '/dossiers' });
      var valider = ds.filter(function (x) {
        if (!TYPES_DOSSIER[x.type].collectif) return false;
        var don = json2_(x.donnees, {}), i = don.infos || {};
        return i.preparation && i.preparation !== 'Paroisse' && !((don.etapes || {}).validation || {}).fait;
      }).length;
      if (valider) l.push({ cle: 'valider', nombre: valider, texte: valider > 1 ? 'préparations hors paroisse à valider par le curé' : 'préparation hors paroisse à valider par le curé', lien: '/dossiers?type=premiere_communion' });
      var bap = ds.filter(function (x) { return alertesDossier_(x.type, json2_(x.donnees, {}).infos || {}).indexOf('bapteme_a_trouver') > -1; }).length;
      if (bap) l.push({ cle: 'bapteme', nombre: bap, texte: bap > 1 ? 'confirmands dont le baptême est à trouver' : 'confirmand dont le baptême est à trouver', lien: '/dossiers?type=confirmand' });
    });
    essai(function () {
      if (!db_().getSheetByName('CorUnum')) return;
      var r = corReglages_();
      var annee = r.feuilles.map(function (f) { return f.annee; }).sort().reverse()[0];
      var n = lignes_('CorUnum').filter(function (x) { return x.annee === annee && x.statut !== 'ancien' && !x.equipe_id; }).length;
      if (n) l.push({ cle: 'cor', nombre: n, texte: n > 1 ? 'inscrits Cor Unum à répartir' : 'inscrit Cor Unum à répartir', lien: '/cor-unum?vue=repartir' });
      var fils = resumeFils_(equipesDe_(r, annee));
      var m = Object.keys(fils).reduce(function (a, k) { return a + fils[k].non_lus; }, 0);
      if (m) l.push({ cle: 'chefs', nombre: m, texte: m > 1 ? 'messages de chefs de fraternité non lus' : 'message de chef de fraternité non lu', lien: '/cor-unum' });
    });
    essai(function () {
      if (!db_().getSheetByName('Catechisme')) return;
      var annee = cateReglages_().feuilles.map(function (f) { return f.annee; }).sort().reverse()[0] || anneeScolaire_();
      var imp = lignes_('Catechisme').filter(function (x) { return x.annee === annee; }).map(resumeInscription_).filter(function (x) { return x.reste > 0; });
      if (imp.length) {
        var total = Math.round(imp.reduce(function (a, x) { return a + x.reste; }, 0));
        l.push({ cle: 'impayes', nombre: imp.length, texte: (imp.length > 1 ? 'inscriptions au catéchisme non réglées' : 'inscription au catéchisme non réglée') + ' (' + total + ' €)', lien: '/catechisme?impayes=1' });
      }
    });
  }
  return l;
}

// ─────────────────────────────── NOTIFICATIONS ───────────────────────────────

// Catégories que chaque utilisateur peut couper (Mon compte → Notifications)
var CATEGORIES_NOTIF = [
  { cle: 'demandes', nom: 'Nouvelles demandes (formulaires du site)' },
  { cle: 'courrier', nom: 'Courrier : mails attribués, commentaires' },
  { cle: 'dossiers', nom: 'Dossiers qui me sont confiés' },
  { cle: 'catechisme', nom: 'Inscriptions au catéchisme' },
  { cle: 'confirmands', nom: 'Inscriptions des confirmands' },
  { cle: 'cor_unum', nom: 'Cor Unum : inscriptions, messages des chefs, ajouts et départs' }
];
function categorieNotif_(titre, lien) {
  var t = String(titre || ''), l = String(lien || '');
  if (/^Nouvelle demande/.test(t)) return 'demandes';
  if (/^Confirmation : inscription/.test(t)) return 'confirmands';
  if (l.indexOf('#/courrier') === 0) return 'courrier';
  if (l.indexOf('#/catechisme') === 0) return 'catechisme';
  if (l.indexOf('#/cor-unum') === 0) return 'cor_unum';
  if (l.indexOf('#/dossiers') === 0) return 'dossiers';
  return '';
}
function prefsNotif_() { return json2_(props_().getProperty('NOTIF_PREFS'), {}); }
function lirePrefsNotif_(p, s) {
  var r = prefsNotif_()[s.uid] || {};
  return { categories: CATEGORIES_NOTIF, coupees: r.coupees || [], calme: r.calme || { actif: false, de: '21:30', a: '07:30' } };
}
function ecrirePrefsNotif_(p, s) {
  verrou_(function () {
    var tout = prefsNotif_();
    var ok = CATEGORIES_NOTIF.map(function (c) { return c.cle; });
    var h = function (t, d) { return /^\d{2}:\d{2}$/.test(String(t || '')) ? String(t) : d; };
    tout[s.uid] = {
      coupees: (p.coupees || []).filter(function (c) { return ok.indexOf(c) > -1; }),
      calme: { actif: !!(p.calme && p.calme.actif), de: h(p.calme && p.calme.de, '21:30'), a: h(p.calme && p.calme.a, '07:30') }
    };
    props_().setProperty('NOTIF_PREFS', JSON.stringify(tout));
  });
  return lirePrefsNotif_(p, s);
}
/** Heures calmes : la notification reste dans l'appli, mais rien ne sonne sur le téléphone. */
function enHeuresCalmes_(calme) {
  if (!calme || !calme.actif) return false;
  var maintenant = Utilities.formatDate(new Date(), 'Europe/Paris', 'HH:mm');
  return calme.de <= calme.a ? (maintenant >= calme.de && maintenant < calme.a) : (maintenant >= calme.de || maintenant < calme.a);
}

/** Crée une notification pour un utilisateur et l'envoie sur ses téléphones. */
function notifier_(uid, titre, texte, lien) {
  if (!uid) return;
  try {
    var pr = prefsNotif_()[uid] || {};
    var cat = categorieNotif_(titre, lien);
    if (cat && (pr.coupees || []).indexOf(cat) > -1) return;
    ecrireLigne_('Notifications', { id: uid_(), uid: uid, date: maintenant_(), titre: titre, texte: texte || '', lien: lien || '', lu: 'non' });
    if (enHeuresCalmes_(pr.calme)) return;
    envoyerPush_(uid);
  } catch (e) { console.error('notifier_', e); }
}

function listerNotifications_(p, s) {
  var n = lignes_('Notifications').filter(function (x) { return x.uid === s.uid; });
  if (p.nonLues) n = n.filter(function (x) { return x.lu !== 'oui'; });
  n.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  return n.slice(0, p.limite || 50).map(function (x) {
    return { id: x.id, date: x.date, titre: x.titre, texte: x.texte, lien: x.lien, lu: x.lu === 'oui' };
  });
}
function compterNotificationsNonLues_(uid) {
  return lignes_('Notifications').filter(function (x) { return x.uid === uid && x.lu !== 'oui'; }).length;
}
function marquerNotificationsLues_(p, s) {
  verrou_(function () {
    lignes_('Notifications').forEach(function (x) {
      if (x.uid === s.uid && x.lu !== 'oui' && (!p.ids || p.ids.indexOf(x.id) > -1)) { x.lu = 'oui'; ecrireLigne_('Notifications', x); }
    });
  });
  return true;
}
