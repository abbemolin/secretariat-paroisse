// node tests/test-miseajour.js — mise à jour automatique du serveur (site et API Apps Script simulés)
const { SS, props } = require('./mocks.js');
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os'), cp = require('child_process');
const dir = path.join(__dirname, '..', 'backend');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maj-'));
cp.execFileSync('node', [path.join(__dirname, '..', 'outils', 'publier-serveur.js'), tmp]);
let site = path.join(tmp, 'serveur'), appels = [], versions = 0, coupe = null;
global.ScriptApp = Object.assign(global.ScriptApp || {}, { getOAuthToken: () => 'jeton', getScriptId: () => 'script1', getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => {} }) }) }) });
global.LockService = { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) };
global.Logger = { log: () => {} };
global.UrlFetchApp.fetch = function (url, o) {
  o = o || {}; const rep = (c, t) => ({ getResponseCode: () => c, getContentText: () => t });
  if (url.startsWith('https://secretariat.croix-glorieuse.org/serveur/')) {
    const nom = url.split('/serveur/')[1].split('?')[0], f = path.join(site, nom);
    if (!fs.existsSync(f)) return rep(404, '');
    let t = fs.readFileSync(f, 'utf8'); if (nom === coupe) t = t.split('\n').slice(0, 10).join('\n');
    return rep(200, t);
  }
  if (url.startsWith('https://script.googleapis.com/v1/projects/script1')) {
    const chemin = url.split('script1')[1]; appels.push([o.method, chemin, o.payload ? JSON.parse(o.payload) : null]);
    if (chemin === '/versions') return rep(200, JSON.stringify({ versionNumber: ++versions + 10 }));
    if (chemin === '/deployments' && o.method === 'get') return rep(200, JSON.stringify({ deployments: [
      { deploymentId: 'AKfyc-web', deploymentConfig: { versionNumber: 9 }, entryPoints: [{ entryPointType: 'WEB_APP' }] },
      { deploymentId: 'HEAD', deploymentConfig: {}, entryPoints: [{ entryPointType: 'WEB_APP' }] }] }));
    return rep(200, '{}');
  }
  return rep(200, '{}');
};
vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + ';globalThis.__t={FEUILLES,majServeur_,verifierMiseAJour,revenirVersion};');
const T = globalThis.__t;
Object.keys(T.FEUILLES).forEach(n => SS.insertSheet(n).appendRow(T.FEUILLES[n]));
let ok = 0, ko = 0; const verif = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', m); } };
const nb = fs.readdirSync(dir).filter(f => f.endsWith('.gs') || f === 'appsscript.json').length;

let r = T.majServeur_({ forcer: false });
const put = appels.find(a => a[1] === '/content');
verif(r.fait && r.version === 11, 'première mise à jour : version 11');
verif(put && put[2].files.length === nb && put[2].files.some(f => f.name === 'appsscript' && f.type === 'JSON') && put[2].files.some(f => f.name === 'MiseAJour' && f.type === 'SERVER_JS'), 'tous les fichiers envoyés (' + nb + '), manifeste compris');
const deps = appels.filter(a => a[0] === 'put' && a[1].startsWith('/deployments/'));
verif(deps.length === 1 && deps[0][1] === '/deployments/AKfyc-web' && deps[0][2].deploymentConfig.versionNumber === 11, 'le déploiement web (même adresse) passe à la nouvelle version ; HEAD non touché');
appels = [];
r = T.majServeur_({ forcer: false });
verif(!r.fait && !appels.length, 'rien de changé sur GitHub : aucune mise à jour');
// fichier coupé sur le site : rien n'est envoyé
const m = JSON.parse(fs.readFileSync(path.join(site, 'manifeste.json'))); m.empreinte = 'nouvelle'; fs.writeFileSync(path.join(site, 'manifeste.json'), JSON.stringify(m));
coupe = 'Comptes.gs'; appels = [];
let err = ''; try { T.majServeur_({ forcer: false }); } catch (e) { err = e.message; }
verif(/Comptes.gs incomplet/.test(err) && !appels.some(a => a[1] === '/content'), 'fichier incomplet : mise à jour annulée, rien envoyé');
T.verifierMiseAJour();
verif(/incomplet/.test(props.MAJ_ERREUR || ''), 'erreur du déclencheur gardée pour Réglages');
coupe = null; appels = [];
r = T.majServeur_({ forcer: false });
verif(r.fait && r.version === 12 && !props.MAJ_ERREUR, 'nouveau changement : version 12, erreur effacée');
appels = []; T.revenirVersion(11);
verif(appels.some(a => a[1] === '/deployments/AKfyc-web' && a[2].deploymentConfig.versionNumber === 11), 'retour à la version 11');
appels = []; r = T.majServeur_({ forcer: false });
verif(!r.fait, 'après un retour en arrière, pas de remise automatique tant que GitHub ne change pas');
fs.rmSync(tmp, { recursive: true });
console.log(`${ok} vérifications OK, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
