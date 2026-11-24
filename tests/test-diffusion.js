// node tests/test-diffusion.js — annonces notifiées, lettre dans l'app, abonnement Brevo (services simulés)
const { SS, props } = require('./mocks.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'backend');
// Supabase et Brevo simulés
const brevo = { contacts: { 'jean@ex.fr': { listIds: [3] } }, appels: [] };
global.UrlFetchApp.fetch = function (url, o) {
  o = o || {}; const rep = (code, x) => ({ getResponseCode: () => code, getContentText: () => (x === undefined ? '' : JSON.stringify(x)) });
  if (/supabase\.co\/rest\/v1\/annonces/.test(url)) return rep(200, /id=eq\.7/.test(url) ? [{ id: 7, titre: 'Retraite de l\'Avent', actif: true }] : /id=eq\.8/.test(url) ? [{ id: 8, titre: 'Vieille', actif: false }] : [{ id: 7, titre: 'Retraite de l\'Avent', actif: true }, { id: 8, titre: 'Vieille', actif: false }]);
  brevo.appels.push([o.method || 'get', url, o.payload]);
  if (/emailCampaigns\?status=sent/.test(url)) return rep(200, { campaigns: [{ id: 41, subject: 'Lettre du 22 novembre', sentDate: '2026-11-22T11:00:00Z', recipients: { lists: [3] } }, { id: 40, subject: 'Autre liste', recipients: { lists: [9] } }] });
  if (/emailCampaigns\/41$/.test(url)) return rep(200, { htmlContent: '<html><body>Bonjour {{ contact.PRENOM }} <a href="{{ unsubscribe }}">x</a></body></html>' });
  const m = url.match(/contacts\/([^/?]+)$/);
  if (m && (o.method || 'get') === 'get') { const c = brevo.contacts[decodeURIComponent(m[1])]; return c ? rep(200, c) : rep(404, { message: 'not found' }); }
  if (/\/contacts$/.test(url) && o.method === 'post') { const b = JSON.parse(o.payload); brevo.contacts[b.email] = { listIds: b.listIds }; return rep(201, {}); }
  if (/contacts\/lists\/3\/contacts\/remove/.test(url)) { JSON.parse(o.payload).emails.forEach((x) => { if (brevo.contacts[x]) brevo.contacts[x].listIds = []; }); return rep(201, {}); }
  return rep(200, {});
};
vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') +
  ';globalThis.__t={doPost,FEUILLES,hacher_,ecrireLigne_,actionCompte_,actionEspace_,lignes_,jeton_,nouvelleSessionCpt_,derniereNotifPublique_};');
const T = globalThis.__t;
let ok = 0, ko = 0;
const verif = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', m); } };
const post = (action, payload, token) => JSON.parse(T.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).t);
Object.keys(T.FEUILLES).forEach(n => SS.insertSheet(n).appendRow(T.FEUILLES[n]));
props.BREVO_CLE = 'cle'; props.VAPID_PRIVEE = 'c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721'; props.VAPID_PUBLIQUE = 'x';
T.ecrireLigne_('Utilisateurs', { id: 'cure', identifiant: 'cure', nom: 'cure', role: 'cure', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true' });
T.ecrireLigne_('Utilisateurs', { id: 'sec', identifiant: 'sec', nom: 'sec', role: 'secretaire', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true' });
vm.runInThisContext('feuilleComptes_(); feuillesEspace_()');
const jean = T.ecrireLigne_('Comptes', { id: 'j1', mail: 'jean@ex.fr', prenom: 'Jean', nom: 'D', statut: 'actif', sel: 's', hash: T.hacher_('motdepasse-jean', 's'), session_v: 0, prefs: '' });
T.ecrireLigne_('Comptes', { id: 'k1', mail: 'karl@ex.fr', prenom: 'Karl', statut: 'actif', sel: 's', hash: 'h', prefs: JSON.stringify({ annonces: false }) });
T.ecrireLigne_('Comptes', { id: 'z1', mail: 'zoe@ex.fr', prenom: 'Zoé', statut: 'suspendu', sel: 's', hash: 'h', prefs: '' });
T.ecrireLigne_('Dossiers', { id: 'd1', type: 'catechumene', etat: 'ouvert', nom: 'Marie', email: 'marie@ex.fr', donnees: JSON.stringify({ infos: { prenoms: 'Marie', email: 'marie@ex.fr' } }) });
const jEsp = T.jeton_(); T.ecrireLigne_('Espaces', { dossier_id: 'd1', jeton: jEsp, hash: T.hacher_('motdepasse-marie', 's'), sel: 's' });
['cpt:j1', 'cpt:k1', 'cpt:z1', 'esp:d1'].forEach((u, i) => T.ecrireLigne_('Push', { uid: u, endpoint: 'https://fcm.googleapis.com/' + i, appareil: '', cree_le: '' }));

const cure = post('auth.login', { identifiant: 'cure', motdepasse: 'motdepasse' }).data.token;
const sec = post('auth.login', { identifiant: 'sec', motdepasse: 'motdepasse' }).data.token;
verif(post('annonces.notifier', { id: 7 }, sec).code === 'INTERDIT', 'secrétaire : pas de tuile Annonces');
global.fetches.length = 0;
const r = post('annonces.notifier', { id: 7 }, cure);
verif(r.ok && r.data.appareils === 2, 'notifiée à 2 appareils (Jean et Marie ; pas Karl qui a coupé, pas Zoé suspendue) : ' + JSON.stringify(r));
verif(global.fetches.map(f => f.url).sort().join() === 'https://fcm.googleapis.com/0,https://fcm.googleapis.com/3', 'bons téléphones réveillés');
verif(post('annonces.notifier', { id: 7 }, cure).code === 'DEJA', 'pas deux fois sans confirmation');
verif(post('annonces.notifier', { id: 7, encore: true }, cure).ok, 'deux fois avec confirmation');
verif(post('annonces.notifier', { id: 8 }, cure).code === 'INVALIDE', 'annonce inactive refusée');
verif(JSON.parse(T.doPost({ postData: { contents: JSON.stringify({ action: 'public.notif' }) } }).t).data.titre === 'Retraite de l\'Avent', 'le téléphone lit le titre de l\'annonce');
verif(post('annonces.liste', {}, cure).data.find(a => a.id === 7).notifie_le, 'liste : annonce marquée notifiée');

// Lettre et abonnement (compte)
const cs = T.nouvelleSessionCpt_(T.lignes_('Comptes').find(x => x.id === 'j1'));
const l = T.actionCompte_('cpt.lettres', { cs });
verif(l.lettres.length === 1 && l.lettres[0].id === 41 && l.lettre_mail === true, 'lettres de la liste de la paroisse seulement ; Jean abonné');
const h = T.actionCompte_('cpt.lettre', { cs, id: 41 }).html;
verif(h.includes('Bonjour') && !h.includes('{{'), 'lettre sans champs personnels Brevo');
let refus = false; try { T.actionCompte_('cpt.lettre', { cs, id: 40 }); } catch (e) { refus = true; } verif(refus, 'lettre d\'une autre liste refusée');
T.actionCompte_('cpt.prefs', { cs, notifs: { lettre_mail: false } });
verif(brevo.contacts['jean@ex.fr'].listIds.length === 0, 'désabonné de la liste Brevo');
T.actionCompte_('cpt.prefs', { cs, notifs: { lettre_mail: true, annonces: false } });
verif(brevo.contacts['jean@ex.fr'].listIds[0] === 3, 'réabonné');
verif(T.actionCompte_('cpt.lire', { cs }).notifs.annonces === false, 'annonces coupées pour Jean');
// Catéchumène (espace)
const esp = T.actionEspace_('esp.connexion', { c: jEsp, mdp: 'motdepasse-marie' }).session;
verif(T.actionEspace_('esp.lettres', { c: jEsp, session: esp }).lettre_mail === false, 'Marie pas encore abonnée');
T.actionEspace_('esp.prefs', { c: jEsp, session: esp, notifs: { lettre_mail: true, annonces: false } });
verif(brevo.contacts['marie@ex.fr'] && brevo.contacts['marie@ex.fr'].listIds[0] === 3, 'Marie abonnée depuis son espace');
global.fetches.length = 0; post('annonces.notifier', { id: 7, encore: true }, cure);
verif(global.fetches.length === 0, 'plus personne ne veut les annonces : aucun envoi');
console.log(ok + ' vérifications réussies, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
