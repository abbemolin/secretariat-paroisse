// node tests/test-confirmation-depot.js — formulaire « Confirmation (jeunes) » et pièces envoyées plus tard (services simulés)
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
vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + ';globalThis.__t={doPost,FEUILLES,hacher_,ecrireLigne_,lignes_,entretienEnvois_,oublierLignes_,trouverDossier_};');
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

T.ecrireLigne_('Utilisateurs', { id: 'conf', identifiant: 'conf', nom: 'Anne', role: 'secretaire', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true', acces: JSON.stringify({ dossiers: { confirmation_jeune: 'm' }, reglages: [] }) });
props.CHARTES_EQUIPE = JSON.stringify(Object.assign(JSON.parse(props.CHARTES_EQUIPE), { conf: new Date().toISOString() }));
const tokF = post('auth.login', { identifiant: 'conf', motdepasse: 'motdepasse' }).data.token;
const annee = (() => { const d = new Date(); const a = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return a + '-' + (a + 1); })();
const don = (d) => JSON.parse(d.donnees);

// ─── Formulaire « Confirmation (jeunes) » ───
let r = post('formulaires.liste', {}, tokF).data;
verif(r.catalogue.some(f => f.cle === 'confirmation_jeune' && f.ecole), 'confirmation : au catalogue (parent ou école)');
const base = { enfant_prenoms: 'Hugo', enfant_nom: 'Bauer', enfant_naissance_date: '2011-03-02', telephone: '0611', email: 'bauer@ex.fr', pere_nom: 'Bauer', preparation: 'Paroisse', bapteme_ou: 'À la paroisse La Croix glorieuse', parrain_marraine: 'Luc Bauer' };
verif(post('public.demande', { type: 'confirmation_jeune', consentement: true, champs: Object.assign({}, base, { preparation: 'Herrade de Landsberg' }) }).code === 'INVALIDE', 'Herrade de Landsberg refusée (comme la profession de foi)');
verif(post('public.demande', { type: 'confirmation_jeune', consentement: true, champs: Object.assign({}, base, { bapteme_ou: 'Dans une autre paroisse' }) }).code === 'INVALIDE', 'acte de baptême obligatoire hors paroisse');
verif(post('public.infos', { type: 'confirmation_jeune' }).ok, 'infos publiques (date de la confirmation)');
let rep = post('public.demande', { type: 'confirmation_jeune', consentement: true, champs: base });
let dC = T.lignes_('Dossiers').find(d => d.type === 'confirmation_jeune');
verif(rep.ok && dC && dC.nom === 'Hugo BAUER' && don(dC).infos.parrain_marraine === 'Luc Bauer' && don(dC).infos.annee_scolaire === annee, 'dossier de confirmation créé (année, parrain) ' + (rep.message || ''));
// Un jeune déjà inscrit par l'import du catéchisme : le formulaire complète son dossier
T.ecrireLigne_('Dossiers', { id: 'imp1', type: 'confirmation_jeune', etat: 'ouvert', cree_le: '2026-09-10', source: 'Inscription au catéchisme', nom: 'Emma WEISS', email: '', telephone: '',
  donnees: JSON.stringify({ infos: { enfant_prenoms: 'Emma', enfant_nom: 'Weiss', annee_scolaire: annee, classe: '4e', inscription_catechisme: 'c1' }, etapes: {}, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] }) });
const n0 = T.lignes_('Dossiers').length;
rep = post('public.demande', { type: 'confirmation_jeune', consentement: true, champs: Object.assign({}, base, { enfant_prenoms: 'Émma Marie', enfant_nom: 'WEISS', classe: '3e', email: 'weiss@ex.fr', message: 'Bonjour' }) });
const imp = T.lignes_('Dossiers').find(d => d.id === 'imp1');
verif(rep.ok && T.lignes_('Dossiers').length === n0, 'pas de second dossier pour un jeune déjà inscrit');
verif(don(imp).infos.classe === '4e' && don(imp).infos.parrain_marraine === 'Luc Bauer' && imp.email === 'weiss@ex.fr' && don(imp).infos.message === 'Bonjour' && /dossier existant complété/.test(imp.donnees), 'dossier existant complété (champs vides seulement)');
rep = post('public.demande', { type: 'confirmation_jeune', consentement: true, champs: Object.assign({}, base, { enfant_prenoms: 'Emma', enfant_nom: 'Weiss', enfant_naissance_date: '2010-01-01' }) });
verif(rep.ok && T.lignes_('Dossiers').length === n0 + 1, 'autre date de naissance : nouveau dossier');

// ─── Pièces envoyées plus tard ───
const dB = post('dossiers.creer', { type: 'bapteme', infos: { enfant_prenoms: 'Paul Jean', enfant_nom: 'Roth', email: 'roth@ex.fr' } }, tokS).data;
verif(post('dossiers.lienDepot', { id: dB.id, docs: [{ cle: 'cert_parrain', libelle: 'Certificat du parrain' }] }, tokC).code === 'INTERDIT', 'lien de dépôt : seulement avec l\'accès au dossier');
const L = post('dossiers.lienDepot', { id: dB.id, docs: [{ cle: 'cert_parrain', libelle: 'Certificat du parrain' }, { cle: 'cert_marraine', libelle: 'Certificat de la marraine' }] }, tokS).data.lien;
const jD = (L.match(/depot\/\?d=([a-f0-9]{32})$/) || [])[1];
verif(jD, 'lien de dépôt créé');
verif(post('dossiers.lienDepot', { id: dB.id, docs: [{ cle: 'cert_parrain', libelle: 'Certificat du parrain' }] }, tokS).data.lien === L, 'le même lien est réutilisé');
let e = post('public.depot', { d: jD }).data;
verif(e.prenom === 'Paul' && e.docs.length === 2 && !e.complet && !JSON.stringify(e).includes('Roth') && !JSON.stringify(e).includes('roth@'), 'page : prénom et pièces seulement (ni nom ni adresse)');
verif(post('public.depotEnvoyer', { d: jD, cle: 'autre', fichier: { nom: 'x.pdf', type: 'application/pdf', base64: 'JVBERg==' } }).code === 'INVALIDE', 'seulement les pièces demandées');
verif(post('public.depotEnvoyer', { d: jD, cle: 'cert_parrain', fichier: { nom: 'x.exe', type: 'application/x-msdownload', base64: 'TVo=' } }).code === 'INVALIDE', 'seulement PDF ou photo');
const nNotif = T.lignes_('Notifications') ? T.lignes_('Notifications').length : 0;
e = post('public.depotEnvoyer', { d: jD, cle: 'cert_parrain', fichier: { nom: 'parrain.jpg', type: 'image/jpeg', base64: '/9j/' } }).data;
let x = T.trouverDossier_(dB.id);
verif(e.docs.find(d => d.cle === 'cert_parrain').recu && !e.complet && don(x).documents.cert_parrain.recu && don(x).pieces.some(p => p.doc === 'cert_parrain'), 'pièce rangée et cochée « reçue »');
verif((T.lignes_('Notifications') || []).length > nNotif, 'l\'équipe est prévenue');
e = post('public.depotEnvoyer', { d: jD, cle: 'cert_marraine', fichier: { nom: 'm.pdf', type: 'application/pdf', base64: 'JVBERg==' } }).data;
x = T.trouverDossier_(dB.id);
verif(e.complet && !don(x).depot && /lien de dépôt fermé/.test(x.donnees), 'tout est reçu : le lien se ferme');
verif(post('public.depot', { d: jD }).code === 'LIEN', 'lien fermé ensuite');
// Réclamer les documents : bouton « Déposer mes documents » dans le mail
const avant = envois.length;
r = post('dossiers.reclamer', { envois: [{ id: dB.id, documents: ['Autorisation'], docs: [{ cle: 'autorisation', libelle: 'Autorisation de la paroisse' }] }], sujet: 'Documents – {nom}', corps: 'Bonjour,\n{documents}\nMerci', signature: '' }, tokS).data;
const m = envois[envois.length - 1];
verif(r.faits === 1 && envois.length === avant + 1 && /Déposer mes documents : https:\/\/\S+depot\/\?d=[a-f0-9]{32}/.test(m.texte), 'mail « Réclamer les documents » avec le bouton de dépôt');
const j2 = m.texte.match(/depot\/\?d=([a-f0-9]{32})/)[1];
verif(post('public.depot', { d: j2 }).data.docs.map(d => d.cle).join() === 'autorisation', 'nouveau lien avec la pièce réclamée');
post('dossiers.modifier', { id: dB.id, etat: 'clos' }, tokS);
verif(post('public.depot', { d: j2 }).code === 'LIEN', 'dossier clos : lien fermé');
console.log(ok + ' vérifications réussies, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
