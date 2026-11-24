// node tests/test-foyers.js — foyers, accord parental, rejoindre une fraternité, « À faire », effacements RGPD (services simulés)
const { SS, props } = require('./mocks.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'backend');
const brevo = { contacts: { 'paul@ex.fr': { listIds: [3] }, 'anne@ex.fr': { listIds: [3] } } };
global.UrlFetchApp.fetch = function (url, o) {
  o = o || {}; const rep = (c, x) => ({ getResponseCode: () => c, getContentText: () => (x === undefined ? '' : JSON.stringify(x)) });
  const m = url.match(/contacts\/([^/?]+)$/);
  if (m && (o.method || 'get') === 'get') { const c = brevo.contacts[decodeURIComponent(m[1])]; return c ? rep(200, c) : rep(404, { message: 'x' }); }
  if (/\/contacts$/.test(url) && o.method === 'post') { const b = JSON.parse(o.payload); brevo.contacts[b.email] = { listIds: b.listIds }; return rep(201, {}); }
  if (/remove/.test(url)) { JSON.parse(o.payload).emails.forEach((x) => { if (brevo.contacts[x]) brevo.contacts[x].listIds = []; }); return rep(201, {}); }
  return rep(200, []);
};
vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') +
  ';globalThis.__t={doPost,FEUILLES,hacher_,ecrireLigne_,actionCompte_,lignes_,nouvelleSessionCpt_,oublierLignes_,COLONNES_COR,corReglages_,ecrireCorReglages_,aujourdhui_,ajouterJours_,entretienRgpd_,actionEspace_:typeof actionEspace_!=="undefined"?actionEspace_:null};');
const T = globalThis.__t;
let ok = 0, ko = 0; const verif = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', m); } };
const err = (f, re, m) => { try { f(); ko++; console.log('ÉCHEC (pas d\'erreur) :', m); } catch (e) { if (re.test(e.message)) ok++; else { ko++; console.log('ÉCHEC :', m, '→', e.message); } } };
const post = (action, payload, token) => JSON.parse(T.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).t);
Object.keys(T.FEUILLES).forEach(n => SS.insertSheet(n).appendRow(T.FEUILLES[n]));
props.BREVO_CLE = 'cle';
T.ecrireLigne_('Utilisateurs', { id: 'sec', identifiant: 'sec', nom: 'sec', role: 'secretaire', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true' });
props.CHARTES_EQUIPE = JSON.stringify({ sec: new Date().toISOString() });
const tok = post('auth.login', { identifiant: 'sec', motdepasse: 'motdepasse' }).data.token;
vm.runInThisContext('feuilleComptes_(); feuilleCor_(); feuillesRetraites_(); feuilleCate_(); feuilleCommandes_(); feuillePaiements_(); feuillesProps_()');
const auj = T.aujourdhui_(), plus = (n) => T.ajouterJours_(auj, n);
T.ecrireLigne_('Comptes', { id: 'p1', mail: 'paul@ex.fr', prenom: 'Paul', nom: 'Martin', telephone: '0600000001', statut: 'actif', sel: 's', hash: 'h', session_v: 0, adresse: '2 rue des Lilas' });
T.ecrireLigne_('Comptes', { id: 'a1', mail: 'anne@ex.fr', prenom: 'Anne', nom: 'Martin', telephone: '0600000002', statut: 'actif', sel: 's', hash: 'h', session_v: 0 });
const cp = T.nouvelleSessionCpt_(T.lignes_('Comptes')[0]), ca = T.nouvelleSessionCpt_(T.lignes_('Comptes')[1]);

// ─── Foyer ───
let f = T.actionCompte_('cpt.foyer.inviter', { cs: cp, mail: 'inconnu@ex.fr' });
verif(f.envoyee && !global.mails.some(m => m.to === 'inconnu@ex.fr'), 'adresse sans compte : même réponse, aucun mail');
f = T.actionCompte_('cpt.foyer.inviter', { cs: cp, mail: 'Anne@ex.fr' });
verif(f.envoyee && global.mails.some(m => m.to === 'anne@ex.fr' && /relier vos comptes/.test(m.sujet)), 'proposition envoyée au conjoint');
let va = T.actionCompte_('cpt.lire', { cs: ca });
verif(va.foyer.recues.length === 1 && va.foyer.recues[0].prenom === 'Paul', 'le conjoint voit la proposition');
f = T.actionCompte_('cpt.foyer.accepter', { cs: ca, id: 'p1' });
verif(f.conjoint && f.conjoint.prenom === 'Paul', 'foyer relié');
T.oublierLignes_();
verif(T.lignes_('Comptes').find(x => x.id === 'a1').adresse === '2 rue des Lilas', 'adresse commune reprise');
verif(brevo.contacts['paul@ex.fr'].listIds.length === 1 && brevo.contacts['anne@ex.fr'].listIds.length === 0, 'une seule lettre par mail au foyer');
verif(T.actionCompte_('cpt.lettres', { cs: ca }).lettre_foyer === 'Paul', 'la lettre est envoyée à Paul pour le foyer');
T.actionCompte_('cpt.prefs', { cs: ca, notifs: { lettre_mail: true } });
verif(brevo.contacts['anne@ex.fr'].listIds.length === 1 && brevo.contacts['paul@ex.fr'].listIds.length === 0, 'Anne la reçoit à son tour : Paul ne la reçoit plus');
T.actionCompte_('cpt.profilModifier', { cs: ca, adresse: '5 place Kléber' });
T.oublierLignes_();
verif(T.lignes_('Comptes').find(x => x.id === 'p1').adresse === '5 place Kléber', 'adresse changée chez l\'un, changée chez l\'autre');
// enfants et inscriptions faits par Paul, vus par Anne
T.ecrireLigne_('Catechisme', { id: 'k1', annee: '2026-2027', nom: 'Martin', prenoms: 'Léa', groupe: 'CE1', email: 'paul@ex.fr', cotisation: '30', manuels: '[]', paiements: '[]' });
T.ecrireLigne_('Retraites', { id: 'r1', type: 'premiere_communion', titre: 'Retraite de première communion', date_debut: plus(20), date_fin: plus(21), lieu: 'Abbaye', prix: JSON.stringify([{ id: 'l1', libelle: 'Pension', montant: 40, obligatoire: true }]), date_limite: plus(10) });
T.ecrireLigne_('RetraitesInscrits', { id: 'i1', retraite_id: 'r1', jeton: 'a'.repeat(32), statut: 'inscrit', contact_email: 'paul@ex.fr', participants: JSON.stringify([{ prenoms: 'Léa', nom: 'Martin', allergies: 'arachide' }]), paiements: '[]', urgence_nom: 'Paul', urgence_tel: '06' });
T.ecrireLigne_('Dossiers', { id: 'd1', type: 'bapteme', etat: 'ouvert', nom: 'Tom Martin', email: 'paul@ex.fr', cree_le: new Date().toISOString(), donnees: JSON.stringify({ infos: { enfant_prenoms: 'Tom', enfant_nom: 'Martin', email: 'paul@ex.fr', parrain_nom: 'Luc' }, etapes: {}, documents: {} }) });
T.ecrireLigne_('Dossiers', { id: 'd2', type: 'confirmand', etat: 'ouvert', nom: 'Paul Martin', email: 'paul@ex.fr', donnees: JSON.stringify({ infos: { email: 'paul@ex.fr' } }) });
const I = T.actionCompte_('cpt.inscriptions', { cs: ca });
verif(I.catechisme.length === 1 && I.catechisme[0].par === 'Paul' && I.retraites.length === 1, 'Anne voit le catéchisme et la retraite inscrits par Paul');
const D = T.actionCompte_('cpt.dossiers', { cs: ca });
verif(D.dossiers.length === 1 && D.dossiers[0].qui === 'Tom Martin', 'Anne voit le baptême de leur enfant, pas la confirmation de Paul');
// À faire
T.ecrireLigne_('Propositions', { id: 'pr1', type: 'parcours', titre: 'Avent', debut: auj, statut: 'publiee' });
T.ecrireLigne_('PropEtapes', { id: 'e1', proposition_id: 'pr1', ordre: 1, jour: auj, titre: 'Veillez' });
T.actionCompte_('cpt.prop.suivre', { cs: ca, id: 'pr1' });
let A = T.actionCompte_('cpt.afaire', { cs: ca }).afaire;
verif(A.some(x => x.type === 'etape' && /Avent : Veillez/.test(x.texte)), 'à faire : étape du jour');
verif(A.some(x => x.type === 'paiement' && /Retraite de première communion : reste 40 €/.test(x.texte)) && A.some(x => /Catéchisme : reste 30 €/.test(x.texte)), 'à faire : paiements à finir');
verif(A.some(x => x.type === 'dossier' && /certificat de baptême ou de confirmation du parrain/.test(x.texte) && !/marraine/.test(x.texte)), 'à faire : pièce du dossier (parrain seulement : pas de marraine indiquée)');
T.actionCompte_('cpt.prop.fait', { cs: ca, id: 'pr1', etape: 'e1' });
verif(!T.actionCompte_('cpt.afaire', { cs: ca }).afaire.some(x => x.type === 'etape'), 'étape cochée : plus à faire');
// Défaire le foyer
f = T.actionCompte_('cpt.foyer.quitter', { cs: cp });
verif(!f.conjoint && global.mails.some(m => m.to === 'anne@ex.fr' && /défait/.test(m.sujet)), 'lien défait, l\'autre prévenu');
verif(T.actionCompte_('cpt.inscriptions', { cs: ca }).catechisme.length === 0, 'après : Anne ne voit plus les inscriptions de Paul');

// ─── Accord parental ───
const code = '123456';
vm.runInThisContext("CacheService.getScriptCache().put('cptdem_lea@ex.fr', JSON.stringify({ code: '123456', essais: 0 }), 900)");
err(() => T.actionCompte_('cpt.demande', { mail: 'lea@ex.fr', code, prenom: 'Léa', nom: 'Petit', telephone: '0611111111', confidentialite: true, parent: true, parent_mail: 'lea@ex.fr' }), /différente/, 'adresse du parent différente');
T.actionCompte_('cpt.demande', { mail: 'lea@ex.fr', code, prenom: 'Léa', nom: 'Petit', telephone: '0611111111', confidentialite: true, parent: true, parent_mail: 'maman@ex.fr' });
const mp = global.mails.filter(m => m.to === 'maman@ex.fr').pop();
const jet = (mp && mp.texte.match(/accord=([a-f0-9]{32})/) || [])[1];
verif(jet, 'mail au parent avec un lien');
const lea = T.lignes_('Comptes').find(x => x.mail === 'lea@ex.fr');
const pl = post('paroissiens.liste', {}, tok).data.comptes.find(x => x.id === lea.id);
verif(pl.demande.accord && !pl.demande.accord.jeton && !pl.demande.accord.reponse, 'secrétariat : accord attendu (sans le lien)');
verif(/donné son accord/.test(post('paroissiens.modifier', { id: lea.id, op: 'valider' }, tok).message || ''), 'validation impossible sans l\'accord');
verif(T.actionCompte_('cpt.accord', { a: jet }).prenom === 'Léa', 'le parent voit la demande');
err(() => T.actionCompte_('cpt.accordReponse', { a: jet, reponse: 'oui', nom_parent: '', engagement: true }), /prénom et votre nom/, 'nom du parent obligatoire');
const ra = T.actionCompte_('cpt.accordReponse', { a: jet, reponse: 'oui', nom_parent: 'Claire Petit', engagement: true });
verif(ra.reponse === 'oui', 'accord donné');
err(() => T.actionCompte_('cpt.accord', { a: jet }), /plus valable/, 'lien utilisable une fois');
verif(post('paroissiens.modifier', { id: lea.id, op: 'valider' }, tok).ok, 'validation possible après l\'accord');
T.oublierLignes_();
const lea2 = Object.assign({}, T.lignes_('Comptes').find(x => x.id === lea.id), { statut: 'actif', hash: 'h', sel: 's' }); T.ecrireLigne_('Comptes', lea2); T.oublierLignes_();
err(() => T.actionCompte_('cpt.foyer.inviter', { cs: T.nouvelleSessionCpt_(T.lignes_('Comptes').find(x => x.id === lea.id)), mail: 'paul@ex.fr' }), /lycéen/, 'pas de foyer pour un lycéen');

// ─── Rejoindre une fraternité ───
const r0 = T.corReglages_(); r0.equipes = { '2026-2027': [{ id: 'e1', nom: 'Saint-Joseph', chefs: [] }] }; r0.feuilles = [{ annee: '2026-2027' }]; T.ecrireCorReglages_(r0);
let v = T.actionCompte_('cpt.lire', { cs: cp });
verif(v.fraternite.etat === 'aucune', 'Paul n\'a pas de fraternité');
v = T.actionCompte_('cpt.corDemande', { cs: cp, preferences: 'le mardi soir' });
verif(v.fraternite.etat === 'demande', 'demande envoyée : « la paroisse va vous proposer une fraternité »');
const fiche = T.lignes_('CorUnum').find(x => x.nom === 'Martin' && x.prenoms === 'Paul');
verif(fiche && !fiche.equipe_id && /mardi/.test(fiche.souhait) && JSON.parse(T.lignes_('Comptes').find(x => x.id === 'p1').cor_ids).includes(fiche.id), 'fiche Cor Unum à répartir, reliée au compte');
verif(T.lignes_('Notifications').some(n => /rejoindre une fraternité/.test(n.titre)), 'secrétariat prévenu');

// ─── RGPD ───
const vieux = new Date(Date.now() - 4 * 365 * 86400000).toISOString();
const fc = (o) => { const x = {}; T.COLONNES_COR.forEach(k => x[k] = ''); T.ecrireLigne_('CorUnum', Object.assign(x, { statut: 'actif', cree_le: vieux }, o)); };
fc({ id: 'v1', annee: '2021-2022', prenoms: 'Marc', nom: 'Ancien', email: 'marc@ex.fr', equipe_id: 'x' });
fc({ id: 'v2', annee: '2022-2023', prenoms: 'Marc', nom: 'Ancien', email: 'marc@ex.fr' });
fc({ id: 'w1', annee: '2021-2022', prenoms: 'Rose', nom: 'Fidèle', email: 'rose@ex.fr', equipe_id: 'x' });
T.ecrireLigne_('Comptes', { id: 'rose', mail: 'rose@ex.fr', prenom: 'Rose', nom: 'Fidèle', statut: 'actif', derniere_visite: new Date().toISOString() });
T.ecrireLigne_('Retraites', { id: 'r0', type: 'premiere_communion', titre: 'Retraite passée', date_debut: plus(-60), date_fin: plus(-59) });
T.ecrireLigne_('RetraitesInscrits', { id: 'i0', retraite_id: 'r0', jeton: 'c'.repeat(32), statut: 'inscrit', contact_email: 'x@ex.fr', participants: JSON.stringify([{ prenoms: 'Jo', allergies: 'gluten' }]), urgence_nom: 'Mère', urgence_tel: '07', paiements: '[]' });
T.entretienRgpd_();
let L = vm.runInThisContext('rgpdListe_()');
verif(L.elements.length === 2 && L.elements.some(c => c.type === 'cor' && c.nom === 'Marc Ancien' && c.ids.length === 2) && L.elements.some(c => c.type === 'sante' && c.nom === 'Retraite passée'),
  'liste : Marc (2 fiches, 3 ans sans activité) et la retraite passée ; pas Rose (connectée à l\'app), pas la retraite à venir ' + JSON.stringify(L.elements.map(c => c.nom)));
verif(T.lignes_('Notifications').some(n => /RGPD/.test(n.titre)), 'équipe prévenue de la liste');
verif(T.lignes_('CorUnum').some(x => x.id === 'v1'), 'rien effacé sans confirmation');
let R = post('paroissiens.rgpd', { op: 'effacer', cles: [L.elements.find(c => c.type === 'sante').cle] }, tok).data;
T.oublierLignes_();
const i0 = T.lignes_('RetraitesInscrits').find(x => x.id === 'i0');
verif(R.efface.sante === 1 && !JSON.parse(i0.participants)[0].allergies && !i0.urgence_tel && i0.statut === 'inscrit', 'fiche santé effacée, inscription gardée');
verif(JSON.parse(T.lignes_('RetraitesInscrits').find(x => x.id === 'i1').participants)[0].allergies === 'arachide', 'retraite à venir intacte');
R = post('paroissiens.rgpd', { op: 'garder', cle: L.elements.find(c => c.type === 'cor').cle }, tok).data;
verif(!R.liste, 'gardée un an : retirée de la liste');
vm.runInThisContext("props_().deleteProperty('RGPD_PREPAREE')"); T.entretienRgpd_();
verif(!vm.runInThisContext('rgpdListe_()'), 'gardée : pas reproposée');
vm.runInThisContext("props_().setProperty('RGPD_GARDER', '{}')"); vm.runInThisContext("props_().deleteProperty('RGPD_PREPAREE')"); T.entretienRgpd_();
L = vm.runInThisContext('rgpdListe_()'); L.auto_le = new Date(Date.now() - 1000).toISOString(); vm.runInThisContext('ecrireListeRgpd_(' + JSON.stringify(L) + ')');
T.entretienRgpd_(); T.oublierLignes_();
verif(!T.lignes_('CorUnum').some(x => x.id === 'v1' || x.id === 'v2') && T.lignes_('CorUnum').some(x => x.id === 'w1'), 'sans réponse en 30 jours : effacement automatique (Rose gardée)');
verif(T.lignes_('Journal').some(j => /RGPD : effacement/.test(j.action)), 'noté au journal');
console.log(ok + ' vérifications réussies, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
