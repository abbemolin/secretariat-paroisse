/**
 * À exécuter UNE FOIS depuis l'éditeur Apps Script, connecté au compte Gmail
 * de la paroisse. Peut être relancée sans risque : ce qui existe est conservé.
 * Le mot de passe provisoire du premier compte s'affiche dans le journal d'exécution.
 */

var FEUILLES = {
  Utilisateurs: ['id', 'identifiant', 'nom', 'role', 'signature', 'sel', 'hash', 'actif', 'cree_le', 'derniere_connexion', 'acces'],
  Dossiers: ['id', 'type', 'etat', 'cree_le', 'source', 'nom', 'email', 'telephone', 'date_celebration', 'evenement_id',
             'responsable', 'donnees', 'maj_le', 'maj_par'],
  SuiviMails: ['fil_id', 'statut', 'attribue_a', 'dossier_id', 'maj_le', 'maj_par'],
  Commentaires: ['id', 'cible', 'auteur', 'date', 'texte'],
  Notifications: ['id', 'uid', 'date', 'titre', 'texte', 'lien', 'lu'],
  Push: ['uid', 'endpoint', 'appareil', 'cree_le'],
  Journal: ['date', 'utilisateur', 'action', 'detail']
};

var SIGNATURES_DEFAUT = [
  { cle: 'cure', nom: 'abbé Florent Molin', fonction: 'Curé', email: 'cure@croix-glorieuse.org', telephone: '06 98 74 02 46' },
  { cle: 'paroisse', nom: 'Paroisse personnelle La Croix glorieuse', fonction: 'Strasbourg', email: 'secretariat@croix-glorieuse.org', telephone: '03 88 36 08 42' },
  { cle: 'secretaire', nom: 'Bertille BAUER', fonction: 'Secrétaire', email: 'secretariat@croix-glorieuse.org', telephone: '03 88 36 08 42' },
  { cle: 'vicaire', nom: 'Abbé Guillaume LE GALL', fonction: 'Vicaire', email: 'secretariat@croix-glorieuse.org', telephone: '03 88 36 08 42' }
];

var REPONSES_DEFAUT = [
  { cle: 'accuse_bapteme', titre: 'Accusé de réception – baptême', sujet: 'Votre demande de baptême',
    corps: 'Bonjour,\n\nNous avons bien reçu votre demande de baptême pour {nom} et nous nous en réjouissons avec vous.\n\n' +
      'Nous vous recontacterons prochainement pour convenir d\'une rencontre de préparation.\n\n' +
      'Pour préparer le dossier, merci de nous faire parvenir dès que possible :\n' +
      '- le certificat de baptême (ou de confirmation) du parrain et de la marraine ;\n' +
      '- si vous n\'habitez pas sur le territoire de la paroisse, l\'autorisation de votre paroisse.\n\n' +
      'Avec l\'assurance de nos prières à toutes vos intentions,' },
  { cle: 'accuse_mariage', titre: 'Accusé de réception – mariage', sujet: 'Votre demande de mariage',
    corps: 'Bonjour,\n\nNous avons bien reçu votre demande de mariage ({nom}) et nous nous en réjouissons avec vous.\n\n' +
      'Un prêtre vous recontactera prochainement pour un premier rendez-vous. Nous vous présenterons alors le chemin de préparation ' +
      'et les documents à réunir (notamment un acte de baptême de moins de six mois pour chacun).\n\n' +
      'Avec l\'assurance de nos prières à toutes vos intentions,' },
  { cle: 'horaires', titre: 'Horaires de la paroisse', sujet: 'Horaires de la paroisse La Croix glorieuse',
    corps: 'Bonjour,\n\nVous trouverez les horaires des messes, des confessions et des permanences, toujours à jour, sur notre site :\n{url_horaires}\n\n' +
      'Avec l\'assurance de nos prières à toutes vos intentions,' },
  { cle: 'accuse_confirmation', titre: 'Accusé de réception – confirmation', sujet: 'Votre inscription à la préparation à la confirmation',
    corps: 'Bonjour {prenom},\n\nNous avons bien reçu votre inscription à la préparation au sacrement de confirmation pour l\'année {annee}, et nous nous en réjouissons avec vous.\n\n' +
      'Pour recevoir la confirmation, un acte de baptême récent est indispensable : merci de le demander dès maintenant à la paroisse de votre baptême et de nous le transmettre.\n\n' +
      'Nous vous recontacterons prochainement pour la suite de la préparation.\n\nAvec l\'assurance de nos prières à toutes vos intentions,' },
  { cle: 'document_manquant', titre: 'Document manquant', sujet: 'Dossier de {type} – document(s) à fournir',
    corps: 'Bonjour,\n\nPour compléter le dossier de {type} ({nom}), il nous manque encore :\n{documents_manquants}\n\n' +
      'Vous pouvez nous les envoyer en réponse à ce message ou les déposer au secrétariat.\n\n' +
      'Merci d\'avance.\n\nAvec l\'assurance de nos prières à toutes vos intentions,' }
];

function installer() {
  var P = props_();

  // 1. Dossier Drive
  var racine;
  if (P.getProperty('DOSSIER_ID')) racine = DriveApp.getFolderById(P.getProperty('DOSSIER_ID'));
  else {
    var it = DriveApp.getFoldersByName(CONFIG.DOSSIER_RACINE);
    racine = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.DOSSIER_RACINE);
    P.setProperty('DOSSIER_ID', racine.getId());
  }
  var dossiers = sousDossier_(racine, 'Dossiers');
  Object.keys(TYPES_DOSSIER).forEach(function (t) { sousDossier_(dossiers, TYPES_DOSSIER[t].dossier); });
  sousDossier_(racine, 'Modèles');
  sousDossier_(racine, 'Partage');

  // 2. Base de données
  var ss;
  if (P.getProperty('DB_ID')) ss = SpreadsheetApp.openById(P.getProperty('DB_ID'));
  else {
    ss = SpreadsheetApp.create('Base – Secrétariat (ne pas modifier à la main)');
    DriveApp.getFileById(ss.getId()).moveTo(racine);
    P.setProperty('DB_ID', ss.getId());
  }
  Object.keys(FEUILLES).forEach(function (nom, i) {
    var f = ss.getSheetByName(nom);
    if (!f) f = i === 0 && ss.getSheets().length === 1 && ss.getSheets()[0].getLastRow() === 0 ? ss.getSheets()[0].setName(nom) : ss.insertSheet(nom);
    f.getRange('A:Z').setNumberFormat('@');   // tout en texte : téléphones, dates, empreintes restent intacts
    if (f.getLastRow() === 0) f.appendRow(FEUILLES[nom]);
    else {
      // ajoute les colonnes manquantes (mise à jour)
      var entetes = f.getRange(1, 1, 1, f.getLastColumn()).getValues()[0];
      FEUILLES[nom].forEach(function (c) { if (entetes.indexOf(c) === -1) f.getRange(1, f.getLastColumn() + 1).setValue(c); });
    }
    f.setFrozenRows(1);
  });

  // 3. Signatures, réponses types, clés de notification
  if (!P.getProperty('SIGNATURES')) P.setProperty('SIGNATURES', JSON.stringify(SIGNATURES_DEFAUT));
  if (!P.getProperty('REPONSES')) P.setProperty('REPONSES', JSON.stringify(REPONSES_DEFAUT));
  creerClesVapid_();

  // 4. Premier compte (administrateur)
  var fu = ss.getSheetByName('Utilisateurs');
  if (fu.getLastRow() < 2) {
    var mdp = 'Croix-' + Math.random().toString(36).slice(2, 8) + '!';
    var sel = uid_() + uid_();
    fu.appendRow([uid_(), 'florent', 'abbé Florent Molin', 'admin', 'cure', sel, hacher_(mdp, sel), 'true', maintenant_(), '']);
    Logger.log('Premier compte créé → identifiant : florent   mot de passe provisoire : ' + mdp);
    Logger.log('Changez-le dès la première connexion (Mon compte).');
  }

  // 5. Vérifications
  var alias = GmailApp.getAliases();
  if (alias.map(function (a) { return a.toLowerCase(); }).indexOf(CONFIG.ALIAS) === -1) {
    Logger.log('⚠ L\'alias ' + CONFIG.ALIAS + ' n\'est pas configuré dans Gmail (Paramètres → Comptes → Envoyer des e-mails en tant que). ' +
               'L\'appli refusera d\'envoyer tant qu\'il manque. Alias trouvés : ' + (alias.join(', ') || 'aucun'));
  } else Logger.log('Alias d\'envoi OK : ' + CONFIG.ALIAS);
  Logger.log('Agenda public : ' + calendrier_().getName() + ' (' + calendrier_().getId() + ')');
  try { Logger.log('Groupes de contacts trouvés : ' + listerGroupesContacts_().length); }
  catch (e) { Logger.log('⚠ Service « People API » non activé : ajoutez-le dans Services (+), sinon les envois groupés ne marcheront pas.'); }
  Logger.log('Installation terminée. Dossier Drive : ' + racine.getUrl());
}

/** Test rapide des notifications téléphone pour un identifiant. */
function testerPush() {
  var u = lignes_('Utilisateurs')[0];
  notifier_(u.id, 'Test', 'Notification de test', '#/');
  Logger.log('Envoyé à ' + u.nom);
}

/**
 * À lancer UNE FOIS si la toute première version (v1) a été installée avant celle-ci.
 * Supprime ce que la v1 avait créé et qui ne sert plus : formulaires Google et leurs
 * déclencheurs, sous-dossiers Drive vides « 01 … 07 ». Ne supprime AUCUN agenda ni mail :
 * les agendas créés par la v1 sont seulement listés, à supprimer à la main si besoin.
 */
function nettoyerAncienneVersion() {
  var P = props_();
  // 1. Déclencheurs de l'ancienne version
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'surReponseFormulaire') { ScriptApp.deleteTrigger(t); Logger.log('Déclencheur supprimé'); }
  });
  // 2. Formulaires Google créés par la v1
  var formulaires = json2_(P.getProperty('FORMULAIRES'), {});
  Object.keys(formulaires).forEach(function (id) {
    try { DriveApp.getFileById(id).setTrashed(true); Logger.log('Formulaire mis à la corbeille : ' + formulaires[id].titre); } catch (e) {}
  });
  P.deleteProperty('FORMULAIRES');
  // 3. Sous-dossiers vides de la v1
  if (P.getProperty('DOSSIER_ID')) {
    var racine = DriveApp.getFolderById(P.getProperty('DOSSIER_ID'));
    ['01 Sacrements', '02 Demandes', '03 Annonces et newsletter', '04 Fabrique et comptabilité', '05 Modèles', '06 Communication', '07 Formulaires']
      .forEach(function (nom) {
        var it = racine.getFoldersByName(nom);
        while (it.hasNext()) {
          var d = it.next();
          if (!d.getFiles().hasNext() && !d.getFolders().hasNext()) { d.setTrashed(true); Logger.log('Dossier vide supprimé : ' + nom); }
          else Logger.log('Dossier conservé (non vide) : ' + nom + ' — à ranger via Documents → À ranger');
        }
      });
  }
  // 4. Agendas : liste seulement
  json2_(P.getProperty('AGENDAS'), []).forEach(function (a) {
    var c = CalendarApp.getCalendarById(a.id);
    if (c && !c.isMyPrimaryCalendar()) Logger.log('Agenda de la v1, plus utilisé par l\'appli : « ' + c.getName() + ' » (' +
      c.getEvents(new Date(2000, 0, 1), new Date(2100, 0, 1)).length + ' événements). À supprimer à la main dans Google Agenda si vous n\'en voulez plus.');
  });
  P.deleteProperty('AGENDAS');
  Logger.log('Nettoyage terminé. Les libellés Gmail « Secrétariat/… » sont conservés (ils ne gênent pas).');
}

/**
 * Mot de passe oublié de l'administrateur : génère un nouveau mot de passe provisoire
 * pour le premier compte administrateur (et le réactive). Le résultat s'affiche dans le journal.
 */
function reinitialiserAdmin() {
  var admin = lignes_('Utilisateurs').filter(function (u) { return u.role === 'admin'; })[0];
  if (!admin) { Logger.log('Aucun administrateur trouvé : relancez installer().'); return; }
  var mdp = 'Croix-' + Math.random().toString(36).slice(2, 8) + '!';
  admin.sel = uid_() + uid_();
  admin.hash = hacher_(mdp, admin.sel);
  admin.actif = true;
  ecrireLigne_('Utilisateurs', admin);
  CacheService.getScriptCache().remove('u_' + admin.id);
  CacheService.getScriptCache().remove('essais_' + String(admin.identifiant).toLowerCase());
  fermerSessionsDe_(admin.id);
  Logger.log('Identifiant : ' + admin.identifiant + '   nouveau mot de passe provisoire : ' + mdp);
}
