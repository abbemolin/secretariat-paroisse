// node tests/test-accord.js — accord du curé du domicile (B15) : formulaire en ligne, envoi, droits (services simulés)
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
vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + ';globalThis.__t={doPost,FEUILLES,hacher_,ecrireLigne_,lignes_};');
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

// ─── Cas 1 : famille de la paroisse, baptême ailleurs ───
let d = post('dossiers.creer', { type: 'bapteme_ailleurs', infos: { enfant_prenoms: 'Léa', enfant_nom: 'Martin', email: 'famille@ex.fr' } }, tokS);
verif(d.ok && d.data.type === 'bapteme_ailleurs' && d.data.nom === 'Léa MARTIN', 'dossier « Baptême dans une autre paroisse » créé (mêmes droits que les baptêmes)');
const id1 = d.data.id;
verif(post('dossiers.liste', {}, tokS).data.some(x => x.id === id1) && !post('dossiers.liste', {}, tokC).data.some(x => x.id === id1), 'visible avec l\'accès aux baptêmes seulement');
verif(post('dossiers.lire', { id: id1 }, tokC).code === 'INTERDIT', 'sans accès aux baptêmes : refusé');
d = post('dossiers.formulaireAccord', { id: id1 }, tokS);
const m1 = envois[envois.length - 1], j1 = (m1.texte.match(/accord-bapteme\/\?j=([a-f0-9]{32})/) || [])[1];
verif(d.ok && m1.to === 'famille@ex.fr' && j1 && /autre paroisse/.test(m1.texte), 'mail au demandeur avec le lien du formulaire');
let f = post('public.accordBapteme', { j: j1 }).data;
verif(f.sens === 'donne' && f.valeurs.enfant_prenoms === 'Léa' && f.obligatoires.includes('paroisse_bapteme'), 'formulaire : sens, valeurs connues, champs obligatoires');
verif(post('public.accordBaptemeEnvoyer', { j: j1, champs: { enfant_prenoms: 'Léa' }, consentement: true }).code === 'INVALIDE', 'champs obligatoires vérifiés');
verif(post('public.accordBaptemeEnvoyer', { j: j1, champs: {}, consentement: false }).code === 'INVALIDE', 'consentement obligatoire');
const rep = { enfant_prenoms: 'Léa Marie', enfant_nom: 'Martin', sexe: 'Fille', adresse: '3 rue des Fleurs', commune: '67000 Strasbourg', paroisse_bapteme: 'Saint-Pierre', commune_bapteme: 'Colmar', diocese_bapteme: 'Strasbourg', date_souhaitee: '2027-05-02', email: 'pirate@ex.fr' };
verif(post('public.accordBaptemeEnvoyer', { j: j1, champs: rep, consentement: true }).ok, 'formulaire envoyé');
d = post('dossiers.lire', { id: id1 }, tokS).data;
verif(d.infos.paroisse_bapteme === 'Saint-Pierre' && d.infos.email === 'famille@ex.fr' && d.etapes.formulaire?.fait && d.infos.accord_recu_le && d.nom === 'Léa Marie MARTIN', 'dossier rempli, étape cochée ; l\'adresse e-mail ne change pas');
verif(T.lignes_('Notifications').some(n => /formulaire reçu/.test(n.titre) && n.uid === 'sec') && !T.lignes_('Notifications').some(n => /formulaire reçu/.test(n.titre) && n.uid === 'cat'), 'notification aux personnes qui voient les baptêmes');
const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
verif(post('dossiers.envoyerB15', { dossierId: id1, pdf }, tokS).code === 'INTERDIT', 'signer l\'accord : seulement les personnes habilitées');
d = post('dossiers.envoyerB15', { dossierId: id1, pdf }, tok).data;
const m2 = envois[envois.length - 1];
verif(d.etapes.accord?.fait && d.etapes.envoye?.fait && d.pieces.some(p => /B15\) signé/.test(p.libelle)), 'accord signé : archivé, étapes cochées');
verif(m2.to === 'famille@ex.fr' && m2.o.attachments.length === 1 && /Saint-Pierre/.test(m2.texte), 'PDF envoyé à la famille seulement');

// ─── Cas 2 : famille d'une autre paroisse, baptême ici ───
d = post('dossiers.creer', { type: 'bapteme', infos: { enfant_prenoms: 'Tom', enfant_nom: 'Durand', email: 'durand@ex.fr' } }, tokS).data;
post('dossiers.formulaireAccord', { id: d.id }, tokS);
const j2 = (envois[envois.length - 1].texte.match(/j=([a-f0-9]{32})/) || [])[1];
f = post('public.accordBapteme', { j: j2 }).data;
verif(f.sens === 'demande' && f.obligatoires.includes('domicile_paroisse'), 'baptême ici : on demande la paroisse du domicile');
post('public.accordBaptemeEnvoyer', { j: j2, consentement: true, champs: { enfant_prenoms: 'Tom', enfant_nom: 'Durand', sexe: 'Garçon', adresse: '1 rue A', commune: 'Illkirch', domicile_paroisse: 'Saints-Pierre-et-Paul', domicile_commune: 'Illkirch' } });
const lu = post('dossiers.lire', { id: d.id }, tokS).data;
verif(lu.infos.domicile_paroisse === 'Saints-Pierre-et-Paul' && !lu.etapes.formulaire, 'dossier de baptême complété (sans changer ses étapes)');
const r2 = post('dossiers.envoyerB15', { dossierId: d.id, pdf }, tokS);
verif(r2.ok && envois[envois.length - 1].to === 'durand@ex.fr' && /faire signer/.test(envois[envois.length - 1].texte) && r2.data.infos.accord_b15_envoye_le, 'B15 prérempli envoyé à la famille, à faire signer');
verif(post('public.accordBapteme', { j: 'f'.repeat(32) }).code === 'LIEN', 'lien inconnu refusé');
console.log(ok + ' vérifications réussies, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
