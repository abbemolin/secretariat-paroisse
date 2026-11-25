// node tests/test-parrainage.js — formulaires « certificat parrain/marraine » et « lettre de recommandation » (services simulés)
const { SS, props } = require('./mocks.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'backend');
const fichiers = [];
const dossierDrive = () => ({ getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => dossierDrive(), createFile: (b) => { const f = { getId: () => 'f' + fichiers.length, getName: () => b.nom, getUrl: () => 'https://drive/f', getMimeType: () => b.type, getSize: () => 1, getBlob: () => b, setSharing() {} }; fichiers.push(b); return f; } });
global.DriveApp = { getFolderById: () => dossierDrive() };
global.Utilities.base64Decode = (s) => [...Buffer.from(s, 'base64')];
global.Utilities.newBlob = (t, type, nom) => { const b = { nom, type, getBytes: () => [...Buffer.from(String(t))], setName(n) { b.nom = n; return b; }, getAs() { return b; } }; return b; };
vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') +
  ';globalThis.__t={doPost,FEUILLES,hacher_,ecrireLigne_,lignes_,oublierLignes_,cocherEtapeCourrier_,trouverDossier_};');
const T = globalThis.__t;
let ok = 0, ko = 0; const verif = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', m); } };
const post = (action, payload, token) => JSON.parse(T.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).t);
Object.keys(T.FEUILLES).forEach(n => SS.insertSheet(n).appendRow(T.FEUILLES[n]));
props.DOSSIER_ID = 'racine';
T.ecrireLigne_('Utilisateurs', { id: 'cure', identifiant: 'cure', nom: 'abbé Florent', role: 'cure', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true', signature: 'cure' });
T.ecrireLigne_('Utilisateurs', { id: 'sec', identifiant: 'sec', nom: 'Marie', role: 'secretaire', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true', acces: JSON.stringify({ dossiers: { bapteme: 'm' }, reglages: [] }) });
T.ecrireLigne_('Utilisateurs', { id: 'cat', identifiant: 'cat', nom: 'Paul', role: 'diacre', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true', acces: JSON.stringify({ dossiers: { catechumene: 'm' }, reglages: [] }) });
props.CHARTES_EQUIPE = JSON.stringify({ cure: new Date().toISOString(), sec: new Date().toISOString(), cat: new Date().toISOString() });
const tokS = post('auth.login', { identifiant: 'sec', motdepasse: 'motdepasse' }).data.token;
const tokC = post('auth.login', { identifiant: 'cat', motdepasse: 'motdepasse' }).data.token;
const jet = (m) => (m.texte.match(/\?e=([a-f0-9]{32})/) || [])[1];

// ─── Catalogue et envoi ───
let cat = post('formulaires.liste', {}, tokS).data.catalogue.map(f => f.cle);
verif(cat.includes('parrainage') && cat.includes('recommandation'), 'la secrétaire (droits baptêmes) peut envoyer les deux nouveaux formulaires');
verif(!post('formulaires.liste', {}, tokC).data.catalogue.some(f => f.cle === 'parrainage'), 'sans droits baptêmes : pas de formulaire certificat');
global.mails = [];
let r = post('formulaires.envoyer', { formulaire: 'parrainage', email: 'julien@ex.fr', nom: 'Julien Roth', sujet: 'Certificat', texte: 'Bonjour\n[Bouton : Remplir le formulaire]' }, tokS);
verif(r.ok && /certificat-parrain\/\?e=/.test(global.mails[0].texte), 'lien personnel vers le formulaire « certificat-parrain »');
const e1 = jet(global.mails[0]);

// ─── Réponse : certificat ───
const base = { prenoms: 'Julien', nom: 'Roth', naissance_date: '1994-03-12', telephone: '0611', email: 'julien@ex.fr', bapteme_paroisse: 'Saint-Pierre-le-Jeune',
  confirmation: 'Oui', premiere_communion: 'Oui', charge: 'Parrain', charge_sacrement: 'Baptême', filleul_prenoms: 'Lucas', filleul_nom: 'Meyer', paroisse_prevue: 'Saint-Martin, Colmar' };
verif(post('public.demande', { type: 'parrainage', consentement: true, champs: { ...base, charge: 'Témoin' } }).code === 'INVALIDE', 'charge inconnue refusée');
verif(post('public.demande', { type: 'parrainage', consentement: true, champs: { ...base, paroisse_prevue: '' } }).code === 'INVALIDE', 'paroisse de la célébration obligatoire');
r = post('public.demande', { type: 'parrainage', consentement: true, envoi: e1, champs: base, fichier: { nom: 'extrait.pdf', type: 'application/pdf', base64: Buffer.from('%PDF').toString('base64') } });
verif(r.ok, 'demande de certificat reçue');
T.oublierLignes_();
const dp = T.lignes_('Dossiers').find(d => d.type === 'parrainage'), don = JSON.parse(dp.donnees);
verif(dp && dp.nom === 'Julien ROTH' && don.infos.filleul_prenoms === 'Lucas', 'dossier « Certificat parrain / marraine » créé avec les réponses');
verif(fichiers.length === 1 && don.documents.extrait_bapteme && don.documents.extrait_bapteme.recu, 'extrait de baptême rangé et coché');
verif(!don.etapes.certificat, 'l\'extrait ne coche pas « certificat signé »');
verif(T.lignes_('Envois').find(x => x.jeton === e1).rempli_le, 'suivi : formulaire rempli');
const l = post('dossiers.liste', {}, tokS).data;
verif(l.some(d => d.type === 'parrainage'), 'la secrétaire voit le dossier (droits des baptêmes)');
verif(!post('dossiers.liste', {}, tokC).data.some(d => d.type === 'parrainage'), 'sans droits baptêmes : invisible');
// étapes cochées par le courrier
T.cocherEtapeCourrier_(dp.id, 0, { nom: 'abbé Florent' }); T.cocherEtapeCourrier_(dp.id, 1, { nom: 'abbé Florent' }); T.oublierLignes_();
const et = JSON.parse(T.trouverDossier_(dp.id).donnees).etapes;
verif(et.certificat.fait && et.envoye.fait, 'certificat signé puis envoyé : étapes cochées');

// ─── Réponse : lettre de recommandation ───
const lr = { prenoms: 'Claire', nom: 'Weber', telephone: '0655', email: 'claire@ex.fr', motif: 'École catholique', enfant_prenoms: 'Hugo', destinataire_organisme: 'Collège Saint-Étienne' };
verif(post('public.demande', { type: 'recommandation', consentement: true, champs: { ...lr, motif: 'Autre' } }).code === 'INVALIDE', '« Autre » sans précision refusé');
verif(post('public.demande', { type: 'recommandation', consentement: true, champs: { ...lr, destinataire_organisme: '' } }).code === 'INVALIDE', 'destinataire obligatoire');
r = post('public.demande', { type: 'recommandation', consentement: true, champs: lr });
T.oublierLignes_();
const dr = T.lignes_('Dossiers').find(d => d.type === 'recommandation');
verif(r.ok && dr && dr.nom === 'Claire WEBER' && JSON.parse(dr.donnees).infos.enfant_prenoms === 'Hugo', 'dossier « Lettre de recommandation » créé');
T.cocherEtapeCourrier_(dr.id, 0, { nom: 'abbé Florent' }); T.oublierLignes_();
verif(JSON.parse(T.trouverDossier_(dr.id).donnees).etapes.lettre.fait, 'lettre signée : étape cochée');
// modèles
const m = post('modeles', {}, tokS).data.modeles;
verif(m.some(x => x.cle === 'recommandation') && /\{charge\}\{en_vue\}/.test(m.find(x => x.cle === 'aptitude').corps), 'modèles : recommandation ajoutée, certificat adapté (charge, en vue de…)');
console.log(`${ok} vérifications OK, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
