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
 *   Newsletter.gs tuile « Annonces et newsletter » (annonces, feuille de semaine, newsletter Brevo)
 *   Installation.gs  installer() à lancer une fois
 */

// ─────────────────────────────── CONFIGURATION ───────────────────────────────

var CONFIG = {
  ALIAS: 'secretariat@croix-glorieuse.org',     // adresse d'envoi (« Envoyer en tant que » dans Gmail)
  NOM_EXPEDITEUR: 'Paroisse La Croix glorieuse',
  DOSSIER_RACINE: 'Secrétariat – La Croix glorieuse',
  ROLES: ['admin', 'cure', 'vicaire', 'diacre', 'secretaire'],
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
    if (action === 'public.notif') return json_({ ok: true, data: derniereNotifPublique_() });
    if (action === 'public.dons') return json_({ ok: true, data: causesPubliques_() });
    if (/^par\./.test(action)) return json_({ ok: true, data: actionParrain_(action, p) });
    if (/^rej\./.test(action)) return json_({ ok: true, data: actionRejoindre_(action, p) });
    if (/^chef\./.test(action)) return json_({ ok: true, data: actionChef_(action, p) });
    if (/^ret\./.test(action)) return json_({ ok: true, data: actionRetraitePublique_(action, p) });
    if (/^esp\./.test(action)) return json_({ ok: true, data: actionEspace_(action, p) });
    if (/^cpt\./.test(action)) return json_({ ok: true, data: actionCompte_(action, p) });
    if (/^pay\./.test(action)) return json_({ ok: true, data: actionPaiementPublique_(action, p) });
    if (/^boutique\./.test(action)) return json_({ ok: true, data: actionBoutique_(action, p) });

    var session = verifierSession_(req.token);
    var route = ROUTES[action];
    if (!route) throw erreur_('ACTION_INCONNUE', 'Action inconnue : ' + action);
    verifierCharte_(action, session);   // pages avec données personnelles : charte de confidentialité de l'année
    verifierAcces_(action, p, session, route);
    return json_({ ok: true, data: route.fn(p, session) });
  } catch (err) {
    console.error(err && err.stack || err);
    return json_({ ok: false, code: err.code || 'ERREUR', message: err.message || String(err) });
  }
}

var ROUTES = {
  'auth.me':               { fn: function (p, s) { return utilisateurPublic_(trouverUtilisateur_(s.uid)); } },
  'auth.logout':           { fn: function (p, s) { return logout_(p, s); } },
  'auth.motdepasse':       { fn: function (p, s) { return changerMotDePasse_(p, s); } },
  'app.init':              { fn: function (p, s) { return initApp_(p, s); } },
  'app.demarrage':         { fn: function (p, s) { return demarrageApp_(p, s); } },
  'accueil.resume':        { fn: function (p, s) { return resumeAccueil_(p, s); } },
  'horsligne.fiches':      { fn: function (p, s) { return horsLigneFiches_(p, s); } },
  'journee.resume':        { fn: function (p, s) { return resumeJournee_(p, s); } },
  'accueil.blocs':         { fn: function (p, s) { return ecrirePrefsAccueil_(p, s); } },
  'registres':             { fn: function (p, s) { return registresRoute_(p, s); }, droit: 'dossiers' },
  'statistiques':          { fn: function (p, s) { return statistiquesRoute_(p, s); }, droit: 'utilisateurs' },
  'modeles':               { fn: function (p, s) { return modelesRoute_(p, s); }, droit: 'dossiers' },
  'dossiers.courrier':     { fn: function (p, s) { return courrierRoute_(p, s); }, droit: 'dossiers' },
  'sauvegardes':           { fn: function (p, s) { return sauvegardesRoute_(p, s); }, droit: 'utilisateurs' },
  'recherche':             { fn: function (p, s) { return rechercheGlobale_(p, s); } },

  'utilisateurs.liste':    { fn: function (p, s) { return listerUtilisateurs_(p, s); } },
  'utilisateurs.creer':    { fn: function (p, s) { return creerUtilisateur_(p, s); }, droit: 'utilisateurs' },
  'utilisateurs.modifier': { fn: function (p, s) { return modifierUtilisateur_(p, s); }, droit: 'utilisateurs' },
  'journal.liste':         { fn: function (p, s) { return listerJournal_(p, s); }, droit: 'reglages' },

  'reglages.lire':         { fn: function () { return reglages_(); } },
  'reglages.ecrire':       { fn: function (p, s) { return ecrireReglages_(p, s); }, droit: 'reglages' },
  'signatures.liste':      { fn: function (p, s) { return listerSignatures_(p, s); } },
  'signatures.ecrire':     { fn: function (p, s) { return ecrireSignatures_(p, s); }, droit: 'reglages' },
  'reponses.liste':        { fn: function (p, s) { return listerReponses_(p, s); } },
  'reponses.ecrire':       { fn: function (p, s) { return ecrireReponses_(p, s); }, droit: 'reglages' },

  'notifications.liste':   { fn: function (p, s) { return listerNotifications_(p, s); } },
  'notifications.lues':    { fn: function (p, s) { return marquerNotificationsLues_(p, s); } },
  'notifications.prefs':   { fn: function (p, s) { return p.ecrire ? ecrirePrefsNotif_(p, s) : lirePrefsNotif_(p, s); } },
  'push.cle':              { fn: function () { return clePubliquePush_(); } },
  'push.abonner':          { fn: function (p, s) { return abonnerPush_(p, s); } },
  'push.desabonner':       { fn: function (p, s) { return desabonnerPush_(p, s); } },
  'push.tester':           { fn: function (p, s) { notifier_(s.uid, 'Test de notification', 'Les notifications fonctionnent.', '#/'); return true; } },

  'mail.liste':            { fn: function (p, s) { return listerMails_(p, s); }, droit: 'mail' },
  'mail.fil':              { fn: function (p, s) { return lireFil_(p, s); }, droit: 'mail' },
  'mail.piecejointe':      { fn: function (p, s) { return pieceJointe_(p, s); }, droit: 'mail' },
  'mail.envoyer':          { fn: function (p, s) { return envoyerMail_(p, s); }, droit: 'mail' },
  'mail.libelles':         { fn: function (p, s) { return listerLibelles_(p, s); }, droit: 'mail' },
  'mail.modifier':         { fn: function (p, s) { return modifierFil_(p, s); }, droit: 'mail' },
  'mail.suivi':            { fn: function (p, s) { return modifierSuiviMail_(p, s); }, droit: 'mail' },
  'mail.lot':              { fn: function (p, s) { return lotMails_(p, s); }, droit: 'mail' },
  'mail.commenter':        { fn: function (p, s) { return commenterMail_(p, s); }, droit: 'mail' },
  'mail.groupes':          { fn: function (p, s) { return listerGroupesContacts_(p, s); }, droit: 'mail' },
  'mail.envoiGroupe':      { fn: function (p, s) { return envoyerAuGroupe_(p, s); }, droit: 'mail' },
  'tri.lire':              { fn: function (p, s) { return lireTri_(p, s); }, droit: 'mail' },
  'tri.ecrire':            { fn: function (p, s) { return ecrireTri_(p, s); }, droit: 'reglages' },
  'tri.tester':            { fn: function (p, s) { return testerTri_(p, s); }, droit: 'mail' },
  'mail.quota':            { fn: function () { return MailApp.getRemainingDailyQuota(); }, droit: 'mail' },

  'agenda.evenements':     { fn: function (p, s) { return listerEvenements_(p, s); }, droit: 'agenda' },
  'agenda.creer':          { fn: function (p, s) { return creerEvenement_(p, s); }, droit: 'agenda' },
  'agenda.modifier':       { fn: function (p, s) { return modifierEvenement_(p, s); }, droit: 'agenda' },
  'agenda.supprimer':      { fn: function (p, s) { return supprimerEvenement_(p, s); }, droit: 'agenda' },
  'agenda.rendezvous':     { fn: function (p, s) { return chercherRendezVous_(p, s); }, droit: 'dossiers' },

  'dossiers.liste':        { fn: function (p, s) { return listerDossiers_(p, s); }, droit: 'dossiers' },
  'dossiers.lire':         { fn: function (p, s) { return lireDossier_(p, s); }, droit: 'dossiers' },
  'dossiers.creer':        { fn: function (p, s) { return creerDossier_(p, s); }, droit: 'dossiers' },
  'dossiers.modifier':     { fn: function (p, s) { return modifierDossier_(p, s); }, droit: 'dossiers' },
  'dossiers.photo':        { fn: function (p, s) { return photoDossier_(p, s); }, droit: 'dossiers' },
  'dossiers.piece':        { fn: function (p, s) { return deposerPieceDossier_(p, s); }, droit: 'dossiers' },
  'dossiers.archiver':     { fn: function (p, s) { return archiverDocumentDossier_(p, s); }, droit: 'dossiers' },
  'dossiers.supprimer':    { fn: function (p, s) { return supprimerDossier_(p, s); }, droit: 'dossiers' },
  'dossiers.signerB6':     { fn: function (p, s) { return signerB6_(p, s); }, droit: 'dossiers' },
  'cate.liste':            { fn: function (p, s) { return listerCate_(p, s); }, droit: 'dossiers' },
  'cate.lire':             { fn: function (p, s) { return lireCate_(p, s); }, droit: 'dossiers' },
  'cate.creer':            { fn: function (p, s) { return creerCate_(p, s); }, droit: 'dossiers' },
  'cate.modifier':         { fn: function (p, s) { return modifierCate_(p, s); }, droit: 'dossiers' },
  'cate.paiement':         { fn: function (p, s) { return paiementCate_(p, s); }, droit: 'dossiers' },
  'cate.supprimer':        { fn: function (p, s) { return supprimerCate_(p, s); }, droit: 'dossiers' },
  'cate.dossier':          { fn: function (p, s) { return dossierCate_(p, s); }, droit: 'dossiers' },
  'cate.importer':         { fn: function (p, s) { return importerCate_(p, s); }, droit: 'dossiers' },
  'cate.envoyer':          { fn: function (p, s) { return envoyerCate_(p, s); }, droit: 'dossiers' },
  'cate.reglages':         { fn: function (p, s) { return lireCateReglages_(p, s); }, droit: 'dossiers' },
  'cate.reglagesEcrire':   { fn: function (p, s) { return ecrireCateReglages_(p, s); }, droit: 'reglages' },
  'conf.importer':         { fn: function (p, s) { return importerConf_(p, s); }, droit: 'dossiers' },
  'conf.relancer':         { fn: function (p, s) { return relancerConf_(p, s); }, droit: 'dossiers' },
  'conf.reglages':         { fn: function (p, s) { return lireConfReglages_(p, s); }, droit: 'dossiers' },
  'conf.reglagesEcrire':   { fn: function (p, s) { return ecrireConfReglages_(p, s); }, droit: 'reglages' },
  'dossiers.changerType':  { fn: function (p, s) { return changerTypeConf_(p, s); }, droit: 'dossiers' },
  'dossiers.importerCatechumenes': { fn: function (p, s) { return importerCatechumenes_(p, s); }, droit: 'dossiers' },
  'cor.liste':             { fn: function (p, s) { return listerCor_(p, s); }, droit: 'dossiers' },
  'retraites.liste':       { fn: function (p, s) { return listerRetraites_(p, s); }, droit: 'dossiers' },
  'espace.etat':           { fn: function (p, s) { return etatEspace_(p, s); }, droit: 'dossiers' },
  'espace.lien':           { fn: function (p, s) { return lienEspace_(p, s); }, droit: 'dossiers' },
  'espace.lettre':         { fn: function (p, s) { return lettreEspace_(p, s); }, droit: 'dossiers' },
  'cor.equipesCourantes':  { fn: function (p, s) { return equipesCorCourantes_(p, s); }, droit: 'dossiers' },
  'cor.menage':            { fn: function (p, s) { return menageCorRoute_(p, s); }, droit: 'dossiers' },
  'cor.placer':            { fn: function (p, s) { return placerCor_(p, s); }, droit: 'dossiers' },
  'cor.lienInscription':   { fn: function (p, s) { return lienInscriptionCor_(p, s); }, droit: 'dossiers' },
  'parrain.ecrire':        { fn: function (p, s) { return parrainEcrireRoute_(p, s); }, droit: 'dossiers' },
  'parrain.envoyer':       { fn: function (p, s) { return parrainEnvoyerRoute_(p, s); }, droit: 'dossiers' },
  'catechumenat.reglages': { fn: function (p, s) { return reglagesCatechumenatRoute_(p, s); }, droit: 'dossiers' },
  'catechumenat.mail':     { fn: function (p, s) { return mailCatechumenes_(p, s); }, droit: 'dossiers' },
  'catechumenat.export':   { fn: function (p, s) { return exportCatechumenes_(p, s); }, droit: 'dossiers' },
  'espace.signalement':    { fn: function (p, s) { return signalementEspace_(p, s); }, droit: 'dossiers' },
  'paroissiens.liste':     { fn: function (p, s) { return listerComptesRoute_(p, s); } },
  'paroissiens.modifier':  { fn: function (p, s) { return modifierCompteRoute_(p, s); } },
  'paroissiens.inviter':   { fn: function (p, s) { return inviterComptesRoute_(p, s); } },
  'paroissiens.migrer':    { fn: function (p, s) { return migrerEspacesRoute_(p, s); } },
  'paroissiens.dons':      { fn: function (p, s) { return causesDons_(); } },
  'paroissiens.donsEcrire': { fn: function (p, s) { return ecrireCausesDons_(p, s); } },
  'charte.etat':           { fn: function (p, s) { return etatCharte_(s.uid); } },
  'charte.accepter':       { fn: function (p, s) { return accepterCharte_(p, s); } },
  'textes.liste':          { fn: function (p, s) { return listerTextes_(p, s); }, droit: 'dossiers' },
  'textes.ecrire':         { fn: function (p, s) { return ecrireTexte_(p, s); }, droit: 'dossiers' },
  'textes.supprimer':      { fn: function (p, s) { return supprimerTexte_(p, s); }, droit: 'dossiers' },
  'calendrier.ecrire':     { fn: function (p, s) { return ecrireCalendrier_(p, s); }, droit: 'dossiers' },
  'paiements.reglages':    { fn: function (p, s) { return lireHaReglages_(p, s); }, droit: 'reglages' },
  'paiements.reglagesEcrire': { fn: function (p, s) { return ecrireHaReglages_(p, s); }, droit: 'reglages' },
  'paiements.tester':      { fn: function (p, s) { return testerHelloAsso_(p, s); }, droit: 'reglages' },
  'annonces.liste':        { fn: function (p, s) { return listerAnnonces_(p, s); }, droit: 'annonces' },
  'annonces.ecrire':       { fn: function (p, s) { return ecrireAnnonce_(p, s); }, droit: 'annonces' },
  'annonces.supprimer':    { fn: function (p, s) { return supprimerAnnonce_(p, s); }, droit: 'annonces' },
  'annonces.notifier':     { fn: function (p, s) { return notifierAnnonce_(p, s); }, droit: 'annonces' },
  'annonces.ordre':        { fn: function (p, s) { return ordonnerAnnonces_(p, s); }, droit: 'annonces' },
  'annonces.image':        { fn: function (p, s) { return imageAnnonce_(p, s); }, droit: 'annonces' },
  'newsletter.semaine':    { fn: function (p, s) { return semaineNewsletter_(p, s); }, droit: 'annonces' },
  'newsletter.semaineEcrire': { fn: function (p, s) { return ecrireSemaineNewsletter_(p, s); }, droit: 'annonces' },
  'newsletter.lire':       { fn: function (p, s) { return lireNewsletter_(p, s); }, droit: 'annonces' },
  'newsletter.brouillon':  { fn: function (p, s) { return ecrireBrouillonNewsletter_(p, s); }, droit: 'annonces' },
  'newsletter.programmer': { fn: function (p, s) { return programmerNewsletter_(p, s); }, droit: 'annonces' },
  'newsletter.annuler':    { fn: function (p, s) { return annulerNewsletter_(p, s); }, droit: 'annonces' },
  'newsletter.test':       { fn: function (p, s) { return testerEnvoiNewsletter_(p, s); }, droit: 'annonces' },
  'newsletter.reglages':   { fn: function (p, s) { return lireNlReglages_(p, s); }, droit: 'reglages' },
  'newsletter.reglagesEcrire': { fn: function (p, s) { return ecrireNlReglages_(p, s); }, droit: 'reglages' },
  'newsletter.tester':     { fn: function (p, s) { return testerNewsletter_(p, s); }, droit: 'reglages' },
  'liturgie.commentaires': { fn: function (p, s) { return commentairesBible_(p, s); }, droit: 'liturgie' },
  'liturgie.marques':      { fn: function (p, s) { return lireMarques_(p, s); }, droit: 'liturgie' },
  'liturgie.marquesEcrire': { fn: function (p, s) { return ecrireMarques_(p, s); }, droit: 'liturgie' },
  'intentions.liste':      { fn: function (p, s) { return listerIntentions_(p, s); }, droit: 'intentions' },
  'intentions.agenda':     { fn: function (p, s) { return agendaIntentions_(p, s); }, droit: 'intentions' },
  'intentions.ecrire':     { fn: function (p, s) { return ecrireIntention_(p, s); }, droit: 'intentions' },
  'intentions.valider':    { fn: function (p, s) { return validerIntention_(p, s); }, droit: 'intentions' },
  'intentions.apercu':     { fn: function (p, s) { return apercuMailIntention_(p, s); }, droit: 'intentions' },
  'intentions.mail':       { fn: function (p, s) { return mailIntention_(p, s); }, droit: 'intentions' },
  'intentions.refuser':    { fn: function (p, s) { return refuserIntention_(p, s); }, droit: 'intentions' },
  'intentions.annuler':    { fn: function (p, s) { return annulerIntention_(p, s); }, droit: 'intentions' },
  'intentions.celebrer':   { fn: function (p, s) { return celebrerIntention_(p, s); }, droit: 'intentions' },
  'liturgie.ordo':         { fn: function (p, s) { return ordoMesses_(p, s); }, droit: 'liturgie' },
  'propre.lire':           { fn: function (p, s) { return lirePropre_(p, s); }, droit: 'liturgie' },
  'propre.ecrire':         { fn: function (p, s) { return ecrirePropre_(p, s); }, droit: 'liturgie' },
  'propre.annuler':        { fn: function (p, s) { return annulerPropre_(p, s); }, droit: 'liturgie' },
  'liturgie.reglages':     { fn: function (p, s) { return lireLitReglages_(p, s); }, droit: 'reglages' },
  'liturgie.reglagesEcrire': { fn: function (p, s) { return ecrireLitReglages_(p, s); }, droit: 'reglages' },
  'liturgie.tester':       { fn: function (p, s) { return testerLitReglages_(p, s); }, droit: 'reglages' },
  'livres.liste':          { fn: function (p, s) { return listerLivres_(p, s); }, droit: 'dossiers' },
  'livres.catalogue':      { fn: function (p, s) { return ecrireCatalogue_(p, s); }, droit: 'dossiers' },
  'livres.commande':       { fn: function (p, s) { return modifierCommande_(p, s); }, droit: 'dossiers' },
  'retraites.lire':        { fn: function (p, s) { return lireRetraite_(p, s); }, droit: 'dossiers' },
  'retraites.ecrire':      { fn: function (p, s) { return ecrireRetraite_(p, s); }, droit: 'dossiers' },
  'retraites.supprimer':   { fn: function (p, s) { return supprimerRetraite_(p, s); }, droit: 'dossiers' },
  'retraites.inscription': { fn: function (p, s) { return modifierInscriptionRet_(p, s); }, droit: 'dossiers' },
  'retraites.invites':     { fn: function (p, s) { return invitesRetraite_(p, s); }, droit: 'dossiers' },
  'retraites.inviter':     { fn: function (p, s) { return inviterRetraite_(p, s); }, droit: 'dossiers' },
  'cor.relier':            { fn: function (p, s) { return relierCor_(p, s); }, droit: 'dossiers' },
  'cor.modifier':          { fn: function (p, s) { return modifierCor_(p, s); }, droit: 'dossiers' },
  'cor.creer':             { fn: function (p, s) { return creerCor_(p, s); }, droit: 'dossiers' },
  'cor.supprimer':         { fn: function (p, s) { return supprimerCor_(p, s); }, droit: 'dossiers' },
  'cor.equipe':            { fn: function (p, s) { return equipeCor_(p, s); }, droit: 'dossiers' },
  'cor.importer':          { fn: function (p, s) { return importerCor_(p, s); }, droit: 'dossiers' },
  'cor.onglets':           { fn: function (p, s) { return reprendreOngletsCor_(p, s); }, droit: 'dossiers' },
  'cor.nouvelleAnnee':     { fn: function (p, s) { return nouvelleAnneeCor_(p, s); }, droit: 'dossiers' },
  'cor.envoyer':           { fn: function (p, s) { return envoyerCor_(p, s); }, droit: 'dossiers' },
  'cor.lienChef':          { fn: function (p, s) { return lienChefCor_(p, s); }, droit: 'dossiers' },
  'cor.fil':               { fn: function (p, s) { return filCor_(p, s); }, droit: 'dossiers' },
  'cor.tousChefs':         { fn: function (p, s) { return messageTousChefsCor_(p, s); }, droit: 'dossiers' },
  'cor.reglages':          { fn: function (p, s) { return lireCorReglagesPublic_(p, s); }, droit: 'dossiers' },
  'cor.reglagesEcrire':    { fn: function (p, s) { return ecrireCorReglagesRoute_(p, s); }, droit: 'reglages' },
  'extraits.liste':        { fn: function (p, s) { return listerExtraits_(p, s); }, droit: 'dossiers' },
  'extraits.lire':         { fn: function (p, s) { return lireExtrait_(p, s); }, droit: 'dossiers' },
  'extraits.enregistrer':  { fn: function (p, s) { return enregistrerExtrait_(p, s); }, droit: 'dossiers' },
  'extraits.signer':       { fn: function (p, s) { return signerExtrait_(p, s); }, droit: 'dossiers' },
  'extraits.signature':    { fn: function (p, s) { return signatureExtrait_(p, s); }, droit: 'dossiers' },
  'extraits.envoyer':      { fn: function (p, s) { return envoyerExtrait_(p, s); }, droit: 'dossiers' },
  'extraits.supprimer':    { fn: function (p, s) { return supprimerExtrait_(p, s); }, droit: 'dossiers' },
  'sceau.lire':            { fn: function () { return lireSceau_(); } },
  'sceau.ecrire':          { fn: function (p, s) { return ecrireSceau_(p, s); }, droit: 'reglages' },
  'promotions.liste':      { fn: function (p, s) { return listerPromotions_(p, s); }, droit: 'dossiers' },
  'promotions.fixer':      { fn: function (p, s) { return fixerPromotion_(p, s); }, droit: 'dossiers' },

  'documents.liste':       { fn: function (p, s) { return listerDossierDrive_(p, s); }, droit: 'documents' },
  'documents.chercher':    { fn: function (p, s) { return chercherDocuments_(p, s); }, droit: 'documents' },
  'documents.telecharger': { fn: function (p, s) { return telechargerDocument_(p, s); }, droit: 'documents' },
  'documents.envoyer':     { fn: function (p, s) { return deposerDocument_(p, s); }, droit: 'documents' },
  'documents.dossier':     { fn: function (p, s) { return creerDossierDrive_(p, s); }, droit: 'documents' },
  'documents.renommer':    { fn: function (p, s) { return renommerDocument_(p, s); }, droit: 'documents' },
  'documents.deplacer':    { fn: function (p, s) { return deplacerDocument_(p, s); }, droit: 'documents' }
};

// ─────────────────────────────── OUTILS ──────────────────────────────────────

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function erreur_(code, message) { var e = new Error(message); e.code = code; return e; }
// props_() : voir Stockage.gs (réglages volumineux dans une feuille)
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
/** Date du jour à Strasbourg (AAAA-MM-JJ) — et non en heure universelle, fausse entre minuit et 1 h / 2 h. */
function aujourdhui_() { return Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd'); }
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
  oublierLignes_();   // sous verrou, on relit toujours la feuille fraîche
  try { return fn(); } finally { oublierLignes_(); lock.releaseLock(); }
}
function json2_(v, defaut) { try { return v ? JSON.parse(v) : defaut; } catch (e) { return defaut; } }
function echapper_(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Lit une feuille en objets ({_ligne} = n° de ligne). Toutes les cellules sont au format texte. */
var VALEURS_ = {};
/** Chaque feuille n'est lue qu'une fois par requête ; toute écriture efface ce cache. */
function oublierLignes_(nom) { if (nom) delete VALEURS_[nom]; else VALEURS_ = {}; }
function lignes_(nom) {
  if (!VALEURS_[nom]) VALEURS_[nom] = feuille_(nom).getDataRange().getValues();
  var valeurs = VALEURS_[nom].slice();
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
  oublierLignes_(nom);
  return obj;
}
function journaliser_(session, action, detail) {
  try { feuille_('Journal').appendRow([maintenant_(), session ? session.nom : 'système', action, detail || '']); oublierLignes_('Journal'); } catch (e) {}
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
           actif: estActif_(u), droits: droitsDe_(u.role, accesDe_(u)), acces: accesDe_(u), acces_perso: !!u.acces, derniere_connexion: u.derniere_connexion };
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
  return { uid: u.id, role: u.role, nom: u.nom, signature: u.signature, token: token, acces: u.acces, droits: u.droits };
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
    completerColonnes_(feuille_('Utilisateurs'), FEUILLES.Utilisateurs); oublierLignes_();
    if (lignes_('Utilisateurs').some(function (x) { return String(x.identifiant).toLowerCase() === identifiant; })) {
      throw erreur_('INVALIDE', 'Cet identifiant existe déjà.');
    }
    var sel = uid_() + uid_();
    var u = ecrireLigne_('Utilisateurs', {
      id: uid_(), identifiant: identifiant, nom: String(p.nom || identifiant), role: p.role, signature: p.signature || '', acces: JSON.stringify(accesValides_(p.acces || accesDuRole_(p.role))),
      sel: sel, hash: hacher_(p.motdepasse, sel), actif: true, cree_le: maintenant_(), derniere_connexion: ''
    });
    journaliser_(s, 'Utilisateur créé', u.nom + ' (' + u.role + ')');
    return utilisateurPublic_(u);
  });
}

function modifierUtilisateur_(p, s) {
  return verrou_(function () {
    completerColonnes_(feuille_('Utilisateurs'), FEUILLES.Utilisateurs); oublierLignes_();
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
    if (p.acces !== undefined) u.acces = p.acces ? JSON.stringify(accesValides_(p.acces)) : '';
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
    nonLues: compterNotificationsNonLues_(s.uid),
    charte: etatCharte_(s.uid)
  };
}

/** Ouverture de l'appli en un seul aller-retour : session et, au choix, l'accueil ou « Ma journée ». */
function demarrageApp_(p, s) {
  try { assurerEntretien_(); } catch (e) {}
  var r = { init: initApp_(p, s) };
  if (p.accueil) try { r.accueil = resumeAccueil_({}, s); } catch (e) { console.error('demarrage accueil', e); }
  if (p.journee && (s.droits.indexOf('liturgie') > -1 || s.droits.indexOf('intentions') > -1)) try { r.journee = resumeJournee_({}, s); } catch (e) { console.error('demarrage journee', e); }
  return r;
}

function resumeAccueil_(p, s) {
  var d = s.droits, res = {};
  try { res.blocs = prefsAccueil_(s.uid); } catch (e) {}
  assurerEntretien_();
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
    var sortesOk = sortesLisibles_(s);
    var ds = lignes_('Dossiers').filter(function (x) { return x.etat === 'ouvert' && sortesOk.indexOf(x.type) > -1; });
    res.dossiersOuverts = ds.length;
    res.mesDossiers = ds.filter(function (x) { return x.responsable === s.uid; }).map(dossierResume_);
    res.nouveaux = ds.filter(function (x) { return !json2_(x.donnees, {}).etapes || etapesFaites_(x) === 0; }).map(dossierResume_);
  }
  res.notifications = listerNotifications_({ limite: 8 }, s);
  res.afaire = aFaire_(s);
  return res;
}

/** « Ma journée » (écran des tuiles, pour les prêtres) : mails qui me sont attribués, extraits à signer, mes dossiers, notifications.
 *  Les messes et intentions sont lues à part (intentions.liste, intentions.agenda), comme dans la tuile Intentions. */
function resumeJournee_(p, s) {
  var d = s.droits, r = { mesMails: 0, aSigner: 0, mesDossiers: 0, nonLues: 0 };
  var essai = function (fn) { try { fn(); } catch (e) { console.error('journee', e); } };
  if (d.indexOf('mail') > -1) essai(function () {
    r.mesMails = lignes_('SuiviMails').filter(function (x) { return x.attribue_a === s.uid && x.statut !== 'Traité'; }).length;
  });
  essai(function () {
    if (!peutSigner_(s) || !peutLire_(s, 'extraits') || !db_().getSheetByName('Extraits')) return;
    r.aSigner = lignes_('Extraits').filter(function (x) { return x.statut !== 'signe' && x.nom && x.nom !== '(sans nom)'; }).length;
  });
  if (d.indexOf('dossiers') > -1) essai(function () {
    var sortesOk = sortesLisibles_(s);
    r.mesDossiers = lignes_('Dossiers').filter(function (x) { return x.etat === 'ouvert' && x.responsable === s.uid && sortesOk.indexOf(x.type) > -1; }).length;
  });
  essai(function () { r.nonLues = compterNotificationsNonLues_(s.uid); });
  return r;
}

/** Liste « À faire » de l'accueil : tout ce qui attend une action, avec le lien pour y aller. */
function aFaire_(s) {
  var d = s.droits, l = [];
  var essai = function (fn) { try { fn(); } catch (e) { console.error('aFaire', e); } };
  if (d.indexOf('mail') > -1) essai(function () {
    var n = lignes_('SuiviMails').filter(function (x) { return x.statut === 'À traiter'; }).length;
    if (n) l.push({ cle: 'mails', nombre: n, texte: n > 1 ? 'mails à traiter' : 'mail à traiter', lien: '/courrier?filtre=atraiter' });
  });
  if (d.indexOf('dossiers') > -1) {
    essai(function () {
      var sortesOk = sortesLisibles_(s);
      var ds = lignes_('Dossiers').filter(function (x) { return x.etat === 'ouvert' && sortesOk.indexOf(x.type) > -1; });
      var nouv = ds.filter(function (x) { return etapesFaites_(x) <= 1 && (json2_(x.donnees, {}).historique || []).length <= 2; }).length;
      if (nouv) l.push({ cle: 'demandes', nombre: nouv, texte: nouv > 1 ? 'nouvelles demandes à prendre en charge' : 'nouvelle demande à prendre en charge', lien: '/dossiers' });
      var valider = ds.filter(function (x) {
        if (!TYPES_DOSSIER[x.type].collectif) return false;
        var don = json2_(x.donnees, {}), i = don.infos || {};
        return i.preparation && i.preparation !== 'Paroisse' && !((don.etapes || {}).validation || {}).fait;
      }).length;
      if (valider) l.push({ cle: 'valider', nombre: valider, texte: valider > 1 ? 'préparations hors paroisse à valider par le curé' : 'préparation hors paroisse à valider par le curé', lien: '/dossiers?type=premiere_communion' });
      var bap = ds.filter(function (x) { return alertesDossier_(x.type, json2_(x.donnees, {}).infos || {}).indexOf('bapteme_a_trouver') > -1; }).length;
      try {
        if (peutLire_(s, 'extraits') && db_().getSheetByName('Extraits')) {
          var actes = lignes_('Extraits').filter(function (x) { return json2_(x.demande, null) && !json2_(x.envois, []).length; });
          if (actes.length) l.push({ cle: 'actes', nombre: actes.length, texte: actes.length > 1 ? 'demandes d\'acte de baptême à envoyer' : 'demande d\'acte de baptême à envoyer', lien: actes.length > 1 ? '/extraits' : '/extraits/' + actes[0].id });
        }
      } catch (e) {}
      try {
        var nReg = 0, premier = '';
        if (peutLire_(s, 'registres')) Object.keys(REGISTRES).forEach(function (k) { var n = actesAInscrire_(k).length; if (n && !premier) premier = k; nReg += n; });
        if (nReg) l.push({ cle: 'registres', nombre: nReg, texte: nReg > 1 ? 'actes à inscrire au registre' : 'acte à inscrire au registre', lien: '/registres?r=' + premier });
      } catch (e) {}
      if (peutLire_(s, 'catechumenat')) try {
        var lt = lettresATraiter_(), rel = lt.filter(function (x) { return x.statut !== 'annoncee'; }).length, ann = lt.length - rel;
        if (rel) l.push({ cle: 'lettres', nombre: rel, texte: rel > 1 ? 'lettres à l\'évêque à relire' : 'lettre à l\'évêque à relire', lien: '/catechumenat?vue=lettres' });
        if (ann) l.push({ cle: 'lettres_presbytere', nombre: ann, texte: ann > 1 ? 'lettres à l\'évêque déposées au presbytère, à confirmer' : 'lettre à l\'évêque déposée au presbytère, à confirmer', lien: '/catechumenat?vue=lettres' });
      } catch (e) {}
      if (bap) l.push({ cle: 'bapteme', nombre: bap, texte: bap > 1 ? 'confirmands dont le baptême est à trouver' : 'confirmand dont le baptême est à trouver', lien: '/dossiers?type=confirmand' });
    });
    essai(function () {
      if (!peutLire_(s, 'cor_unum') || !db_().getSheetByName('CorUnum')) return;
      var r = corReglages_();
      var annee = r.feuilles.map(function (f) { return f.annee; }).sort().reverse()[0];
      var n = lignes_('CorUnum').filter(function (x) { return x.annee === annee && x.statut !== 'ancien' && !x.equipe_id; }).length;
      if (n) l.push({ cle: 'cor', nombre: n, texte: n > 1 ? 'inscrits Cor Unum à répartir' : 'inscrit Cor Unum à répartir', lien: '/cor-unum?vue=repartir' });
      var fils = resumeFils_(equipesDe_(r, annee));
      var m = Object.keys(fils).reduce(function (a, k) { return a + fils[k].non_lus; }, 0);
      if (m) l.push({ cle: 'chefs', nombre: m, texte: m > 1 ? 'messages de chefs de fraternité non lus' : 'message de chef de fraternité non lu', lien: '/cor-unum' });
    });
    essai(function () {
      if (!peutLire_(s, 'catechisme') || !db_().getSheetByName('Catechisme')) return;
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
