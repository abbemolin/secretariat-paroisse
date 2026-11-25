// node tests/test-formulaires.js — onglet « Formulaires » : envoi, suivi, relance, droits (services simulés)
const { SS, props } = require('./mocks.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'backend');
// Drive et pièces jointes simulés
const fichiers = [];
const dossierDrive = () => ({ getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => dossierDrive(), createFile: (b) => { const f = { getId: () => 'f' + fichiers.length, getName: () => b.nom || 'x', getMimeType: () => 'application/pdf' }; fichiers.push(b); return f; } });
global.DriveApp = { getFolderById: () => dossierDrive() };
global.Utilities.base64Decode = (s) => [...Buffer.from(s, 'base64')];
global.Utilities.newBlob = (t, type, nom) => { const b = { nom, type, getBytes: () => [...Buffer.from(String(t))], setName(n) { b.nom = n; return b; }, getAs() { return b; } }; return b; };
const envois = []; global.GmailApp.sendEmail = (to, sujet, texte, o) => { global.mails.push({ to, sujet, texte }); envois.push({ to, sujet, texte, o }); };
vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + ';globalThis.__t={doPost,FEUILLES,hacher_,ecrireLigne_,lignes_,entretienEnvois_,oublierLignes_};');
const T = globalThis.__t;
let ok = 0, ko = 0; const verif = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', m); } };
const post = (action, payload, token) => JSON.parse(T.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).t);
Object.keys(T.FEUILLES).forEach(n => SS.insertSheet(n).appendRow(T.FEUILLES[n]));
props.DOSSIER_ID = 'racine';
const acces = (extra) => JSON.stringify(Object.assign({ dossiers: { bapteme: 'm' }, reglages: [], signer: false }, extra || {}));
T.ecrireLigne_('Utilisateurs', { id: 'cure', identifiant: 'cure', nom: 'abbé Florent', role: 'cure', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true', signature: 'cure' });
T.ecrireLigne_('Utilisateurs', { id: 'sec', identifiant: 'sec', nom: 'Marie', role: 'secretaire', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true', acces: acces() });
T.ecrireLigne_('Utilisateurs', { id: 'cat', identifiant: 'cat', nom: 'Paul', role: 'diacre', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true', acces: JSON.stringify({ dossiers: { catechumene: 'm' }, reglages: [] }) });
props.CHARTES_EQUIPE = JSON.stringify({ cure: new Date().toISOString(), sec: new Date().toISOString(), cat: new Date().toISOString() });
const tok = post('auth.login', { identifiant: 'cure', motdepasse: 'motdepasse' }).data.token;
const tokS = post('auth.login', { identifiant: 'sec', motdepasse: 'motdepasse' }).data.token;
const tokC = post('auth.login', { identifiant: 'cat', motdepasse: 'motdepasse' }).data.token;


const jet = (m) => (m.texte.match(/\?e=([a-f0-9]{32})/) || [])[1];
// Envoi à un parent : demande de baptême
let r = post('formulaires.liste', {}, tokS).data;
verif(r.catalogue.some(f => f.cle === 'bapteme') && !r.catalogue.some(f => f.cle === 'catechumene'), 'catalogue selon les accès (secrétaire : baptêmes seulement)');
verif(post('formulaires.envoyer', { formulaire: 'catechumene', email: 'a@ex.fr' }, tokS).code === 'INTERDIT', 'pas d\'envoi sans accès à la sorte de dossier');
r = post('formulaires.envoyer', { formulaire: 'bapteme', email: 'Famille@ex.fr', nom: 'Famille Roth', sujet: 'Demande de baptême', texte: 'Bonjour,\n\nMerci :\n[Bouton : Remplir le formulaire]\n\nFin' }, tokS).data;
let m = envois[envois.length - 1], e1 = jet(m);
verif(m.to === 'famille@ex.fr' && e1 && /demande-bapteme\/\?e=/.test(m.texte) && r.envois[0].nom === 'Famille Roth' && !r.envois[0].rempli_le, 'mail avec le lien personnel ; noté « pas encore rempli »');
verif(post('formulaires.liste', {}, tokC).data.envois.length === 0, 'le suivi n\'est visible qu\'avec l\'accès aux baptêmes');
// Le formulaire du site est rempli avec ce lien : le dossier se crée et l'envoi est marqué
const rep = post('public.demande', { type: 'bapteme', consentement: true, envoi: e1, champs: { enfant_prenoms: 'Paul', enfant_nom: 'Roth', enfant_naissance_date: '2026-06-01', telephone: '0600000000', email: 'famille@ex.fr', pere_nom: 'Roth' } });
verif(rep.ok, 'formulaire du site rempli ' + (rep.message || ''));
r = post('formulaires.liste', {}, tokS).data;
const x1 = r.envois.find(x => x.email === 'famille@ex.fr');
verif(x1.rempli_le && x1.dossier_ids.length === 1 && T.lignes_('Dossiers').some(d => d.id === x1.dossier_ids[0] && d.nom === 'Paul ROTH'), 'rempli : dossier créé et relié');
// École : plusieurs réponses
r = post('formulaires.envoyer', { formulaire: 'premiere_communion', email: 'ecole@ex.fr', ecole: 'Saints Louis et Zélie Martin', texte: 'Bonjour' }, tok).data;
m = envois[envois.length - 1];
verif(/premiere-communion\/\?e=[a-f0-9]{32}&preparation=Saints%20Louis/.test(m.texte), 'école : le formulaire s\'ouvre avec l\'école choisie');
// Relance
const x2 = r.envois.find(x => x.ecole);
r = post('formulaires.relancer', { id: x2.id }, tok).data;
m = envois[envois.length - 1];
verif(/^Rappel – /.test(m.sujet) && /pas encore été rempli/.test(m.texte) && r.envois.find(x => x.id === x2.id).relances === 1, 'relance envoyée et comptée');
// Accord du curé sans dossier : le dossier se crée à la réponse
post('formulaires.envoyer', { formulaire: 'accord_ailleurs', email: 'muller@ex.fr', nom: 'Famille Muller' }, tokS);
const e3 = jet(envois[envois.length - 1]);
let f = post('public.accordBapteme', { e: e3 }).data;
verif(f.sens === 'donne' && !Object.keys(f.valeurs).length, 'accord : formulaire vide, sans dossier');
verif(post('public.accordBaptemeEnvoyer', { e: e3, consentement: true, champs: { enfant_prenoms: 'Léa', enfant_nom: 'Muller', sexe: 'Fille', adresse: '1 rue A', commune: 'Strasbourg', paroisse_bapteme: 'Saint-Martin', commune_bapteme: 'Colmar' } }).ok, 'accord rempli');
const dA = T.lignes_('Dossiers').find(d => d.type === 'bapteme_ailleurs');
verif(dA && dA.email === 'muller@ex.fr' && JSON.parse(dA.donnees).etapes.formulaire.fait && JSON.parse(dA.donnees).infos.paroisse_bapteme === 'Saint-Martin', 'dossier « Baptême dans une autre paroisse » créé à la réponse');
verif(post('formulaires.liste', {}, tokS).data.envois.find(x => x.email === 'muller@ex.fr').dossier_ids[0] === dA.id, 'suivi relié au dossier');
verif(post('public.accordBapteme', { e: e3 }).data.valeurs.enfant_prenoms === 'Léa', 'le même lien rouvre le dossier (pas de doublon)');
// Envoi depuis un dossier : visible dans le suivi
const dB = post('dossiers.creer', { type: 'bapteme', infos: { enfant_prenoms: 'Tom', enfant_nom: 'Durand', email: 'durand@ex.fr' } }, tokS).data;
post('dossiers.formulaireAccord', { id: dB.id }, tokS);
r = post('formulaires.liste', {}, tokS).data;
verif(r.envois.some(x => x.formulaire === 'accord_ici' && x.email === 'durand@ex.fr' && x.dossier_ids[0] === dB.id && !x.rempli_le), 'envoi fait depuis un dossier : dans le suivi');
// Retirer, et effacement après un an
const x4 = r.envois.find(x => x.email === 'durand@ex.fr');
r = post('formulaires.retirer', { id: x4.id }, tokS).data;
verif(!r.envois.some(x => x.id === x4.id), 'retiré de la liste');
const vieux = T.lignes_('Envois')[0]; vieux.envoye_le = new Date(Date.now() - 400 * 86400000).toISOString(); T.ecrireLigne_('Envois', vieux);
const avant = T.lignes_('Envois').length; T.entretienEnvois_(); T.oublierLignes_('Envois');
verif(T.lignes_('Envois').length === avant - 1, 'envois de plus d\'un an effacés (RGPD)');
console.log(ok + ' vérifications réussies, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
