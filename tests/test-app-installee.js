// node tests/test-app-installee.js — app personnelle installée : signal à l'ouverture, état dans la liste, liens renvoyés en groupe
const { SS, props } = require('./mocks.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'backend');
vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') +
  ';globalThis.__t={doPost,FEUILLES,hacher_,ecrireLigne_,lignes_,oublierLignes_,noterVisiteEspace_};');
const T = globalThis.__t;
let ok = 0, ko = 0; const verif = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', m); } };
const post = (action, payload, token) => JSON.parse(T.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).t);
Object.keys(T.FEUILLES).forEach(n => SS.insertSheet(n).appendRow(T.FEUILLES[n]));
props.DOSSIER_ID = 'racine';
T.ecrireLigne_('Utilisateurs', { id: 'cure', identifiant: 'cure', nom: 'abbé Florent', role: 'cure', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true' });
props.CHARTES_EQUIPE = JSON.stringify({ cure: new Date().toISOString() });
const tok = post('auth.login', { identifiant: 'cure', motdepasse: 'motdepasse' }).data.token;
vm.runInThisContext('feuillesEspace_(); feuilleComptes_()');
const dos = (id, nom, email) => T.ecrireLigne_('Dossiers', { id, type: 'catechumene', etat: 'ouvert', nom, email, cree_le: new Date().toISOString(), maj_le: new Date().toISOString(),
  donnees: JSON.stringify({ infos: { prenoms: nom.split(' ')[0], email }, etapes: {}, documents: {} }) });
dos('k1', 'Anne A', 'anne@ex.fr'); dos('k2', 'Bruno B', 'bruno@ex.fr'); dos('k3', 'Carla C', 'carla@ex.fr'); dos('k4', 'Denis D', '');
T.ecrireLigne_('Espaces', { dossier_id: 'k1', jeton: 'j'.repeat(32), cree_le: new Date().toISOString(), derniere_visite: '' });
T.ecrireLigne_('Espaces', { dossier_id: 'k2', jeton: 'm'.repeat(32), cree_le: new Date().toISOString(), derniere_visite: '' });
T.noterVisiteEspace_('k1', true, true);    // ouvert depuis l'écran d'accueil
T.noterVisiteEspace_('k2', false, true);   // ouvert dans le navigateur
T.oublierLignes_();
let l = post('dossiers.liste', {}, tok).data, app = (id) => l.find((d) => d.id === id).app;
verif(app('k1').etat === 'installee' && app('k1').installee_le, 'ouverte depuis l\'écran d\'accueil : « App installée »');
verif(app('k2').etat === 'ouverte', 'ouverte dans le navigateur : « Ouvert, pas installée »');
verif(app('k3').etat === 'aucun', 'pas d\'espace : « Espace pas encore créé »');
T.ecrireLigne_('Espaces', { dossier_id: 'k3', jeton: 'z'.repeat(32), cree_le: new Date().toISOString(), derniere_visite: '' }); T.oublierLignes_();
l = post('dossiers.liste', {}, tok).data;
verif(app('k3').etat === 'jamais', 'espace créé mais jamais ouvert : « Jamais ouvert »');
// renvoyer le lien en groupe
global.mails = [];
const r = post('espace.envoyerLiens', { ids: ['k2', 'k4', 'k5'], sujet: 'Votre espace', corps: 'Bonjour {prenom},\n[Bouton : Ouvrir mon espace]', signature: 'Le secrétariat' }, tok);
verif(r.ok && r.data.faits === 1 && r.data.ignores.length === 2, 'un lien envoyé ; sans adresse et introuvable signalés');
verif(global.mails[0] && global.mails[0].to === 'bruno@ex.fr' && /Bonjour Bruno/.test(global.mails[0].texte) && /\?c=m{32}/.test(global.mails[0].texte), 'mail personnel avec SON lien');
dos('k6', 'Élise E', 'elise@ex.fr'); global.mails = [];
const r2 = post('espace.envoyerLiens', { ids: ['k6'], sujet: 'x', corps: 'Bonjour {prenom}' }, tok);
T.oublierLignes_();
const esp6 = T.lignes_('Espaces').find((x) => x.dossier_id === 'k6');
verif(r2.ok && r2.data.crees === 1 && esp6 && global.mails[0].texte.includes('?c=' + esp6.jeton), 'espace créé puis lien envoyé (bouton ajouté s\'il manquait)');
verif(JSON.stringify(T.lignes_('Dossiers').find((x) => x.id === 'k6').donnees).includes('Lien de l'), 'trace dans l\'historique');
console.log(`${ok} vérifications OK, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
