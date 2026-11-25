/**
 * Mise à jour automatique du serveur depuis GitHub (dépôt abbemolin/secretariat-paroisse, branche main).
 * À chaque fusion sur main, GitHub lance les tests puis publie les fichiers du serveur avec le site
 * (secretariat.croix-glorieuse.org/serveur/) — jamais si un test échoue.
 * Plus de copier-coller : le serveur lit serveur/manifeste.json, et si le code a changé depuis la dernière fois,
 * il remplace TOUS ses fichiers par ceux de GitHub, crée une nouvelle version et met à jour le déploiement
 * (même adresse /exec). Les fichiers qui ne sont plus dans GitHub sont retirés du projet.
 *
 * Mise en route (une seule fois) :
 *  1. https://script.google.com/home/usersettings → « API Google Apps Script » : Activé.
 *  2. Lancer mettreAJourServeur depuis l'éditeur et accepter les autorisations.
 * Ensuite : vérification toutes les 15 minutes (déclencheur), ou bouton « Mettre à jour le serveur » dans Réglages.
 * En cas de problème : revenirVersion(numéro) remet le déploiement sur une version précédente
 * (les numéros sont dans Déployer → Gérer les déploiements, ou dans le journal).
 */
var MAJ_SOURCE = 'https://secretariat.croix-glorieuse.org/serveur/';
var MAJ_API = 'https://script.googleapis.com/v1/projects/';

/** À lancer depuis l'éditeur : première mise en route, ou mise à jour forcée. */
function mettreAJourServeur() {
  var r = majServeur_({ forcer: true });
  assurerDeclencheurMaj_();
  Logger.log(r.message);
  return r.message;
}
/** Déclencheur (toutes les 15 minutes) : met à jour seulement si GitHub a changé. */
function verifierMiseAJour() {
  try { majServeur_({ forcer: false }); } catch (e) { console.error('mise à jour automatique', e); props_().setProperty('MAJ_ERREUR', String(e.message || e).slice(0, 500)); }
}
function assurerDeclencheurMaj_() {
  if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'verifierMiseAJour'; }))
    ScriptApp.newTrigger('verifierMiseAJour').timeBased().everyMinutes(15).create();
}

function majLire_(url) {
  var r = UrlFetchApp.fetch(url + (url.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now(), { muteHttpExceptions: true, headers: { 'Cache-Control': 'no-cache' } });
  if (r.getResponseCode() !== 200) throw new Error('Site : ' + url.replace(MAJ_SOURCE, '') + ' introuvable (' + r.getResponseCode() + ').');
  return r.getContentText('UTF-8');
}
function majAppel_(methode, chemin, corps) {
  var o = { method: methode, muteHttpExceptions: true, contentType: 'application/json', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
  if (corps) o.payload = JSON.stringify(corps);
  var r = UrlFetchApp.fetch(MAJ_API + ScriptApp.getScriptId() + chemin, o), code = r.getResponseCode(), t = r.getContentText();
  if (code >= 300) {
    var detail = ''; try { detail = JSON.parse(t).error.message; } catch (e) { detail = t.slice(0, 300); }
    if (code === 403 && /usersettings/i.test(t)) throw new Error('Activez « API Google Apps Script » sur https://script.google.com/home/usersettings (avec le compte propriétaire du projet), attendez quelques minutes puis relancez. Détail : ' + detail);
    throw new Error('Apps Script API ' + code + ' : ' + t.slice(0, 300));
  }
  return t ? JSON.parse(t) : {};
}

/** Cœur de la mise à jour. Renvoie { fait, message, version }. */
function majServeur_(o) {
  var verrou = LockService.getScriptLock();
  if (!verrou.tryLock(5000)) return { fait: false, message: 'Une mise à jour est déjà en cours.' };
  try {
    var man = JSON.parse(majLire_(MAJ_SOURCE + 'manifeste.json'));
    var P = props_(), avant = P.getProperty('MAJ_EMPREINTE') || '';
    if (!o.forcer && man.empreinte === avant) return { fait: false, message: 'Le serveur est déjà à jour.' };
    // 1. Tous les fichiers de GitHub (contrôle : présents, non vides, comme annoncés dans le manifeste)
    var fichiers = man.fichiers.map(function (f) {
      var src = majLire_(MAJ_SOURCE + f.nom);
      if (src.length < 20) throw new Error(f.nom + ' est vide sur GitHub : mise à jour annulée.');
      if (src.split('\n').length < f.lignes - 1) throw new Error(f.nom + ' incomplet (' + src.split('\n').length + ' lignes au lieu de ' + f.lignes + ') : mise à jour annulée.');
      return f.nom === 'appsscript.json' ? { name: 'appsscript', type: 'JSON', source: src } : { name: f.nom.replace(/\.gs$/, ''), type: 'SERVER_JS', source: src };
    });
    if (!fichiers.some(function (f) { return f.name === 'Code'; }) || !fichiers.some(function (f) { return f.name === 'appsscript'; })) throw new Error('Code.gs ou appsscript.json manquant sur GitHub : mise à jour annulée.');
    // 2. Contenu du projet remplacé, nouvelle version, déploiement web mis à jour (même adresse)
    majAppel_('put', '/content', { files: fichiers });
    var description = 'GitHub ' + String(man.commit || man.empreinte).slice(0, 7) + ' – ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy HH:mm');
    var v = majAppel_('post', '/versions', { description: description }).versionNumber;
    var deps = (majAppel_('get', '/deployments').deployments || []).filter(function (d) {
      return (d.entryPoints || []).some(function (e) { return e.entryPointType === 'WEB_APP'; }) && d.deploymentConfig && d.deploymentConfig.versionNumber;
    });
    if (!deps.length) throw new Error('Aucun déploiement « Application Web » trouvé : créez-en un une fois (Déployer → Nouveau déploiement).');
    deps.forEach(function (d) {
      majAppel_('put', '/deployments/' + d.deploymentId, { deploymentConfig: { scriptId: ScriptApp.getScriptId(), versionNumber: v, manifestFileName: 'appsscript', description: description } });
    });
    P.setProperty('MAJ_EMPREINTE', man.empreinte);
    P.setProperty('MAJ_DERNIERE', JSON.stringify({ le: maintenant_(), version: v, fichiers: fichiers.length, commit: man.commit || '' }));
    P.deleteProperty('MAJ_ERREUR');
    try { journaliser_(null, 'Serveur mis à jour depuis GitHub', 'version ' + v + ' · ' + fichiers.length + ' fichiers'); } catch (e) {}
    return { fait: true, version: v, message: 'Serveur mis à jour : version ' + v + ', ' + fichiers.length + ' fichiers (' + deps.length + ' déploiement' + (deps.length > 1 ? 's' : '') + ').' };
  } finally { verrou.releaseLock(); }
}

/** Retour en arrière : le déploiement web reprend la version indiquée (le code de l'éditeur ne change pas). */
function revenirVersion(numero) {
  numero = Number(numero);
  if (!numero) throw new Error('Indiquez le numéro de version, par exemple revenirVersion(12).');
  var deps = (majAppel_('get', '/deployments').deployments || []).filter(function (d) { return (d.entryPoints || []).some(function (e) { return e.entryPointType === 'WEB_APP'; }) && d.deploymentConfig.versionNumber; });
  deps.forEach(function (d) { majAppel_('put', '/deployments/' + d.deploymentId, { deploymentConfig: { scriptId: ScriptApp.getScriptId(), versionNumber: numero, manifestFileName: 'appsscript', description: 'Retour à la version ' + numero } }); });
  // L'empreinte n'est pas changée : la vérification automatique ne remettra la dernière version qu'au prochain changement sur GitHub.
  Logger.log('Déploiement remis sur la version ' + numero + '.');
}

/** Réglages → « Serveur » (administrateur) : état et bouton « Mettre à jour maintenant ». */
function majServeurRoute_(p, s) {
  if (s.role !== 'admin') throw erreur_('INTERDIT', 'Réservé à l\'administrateur.');
  var res = null;
  if (p.maintenant) { res = majServeur_({ forcer: true }); journaliser_(s, 'Mise à jour du serveur demandée', res.message); }
  var P = props_();
  return { derniere: json2_(P.getProperty('MAJ_DERNIERE'), null), erreur: P.getProperty('MAJ_ERREUR') || '', resultat: res ? res.message : '' };
}
