// node tests/test-profil.js — « Mon profil » et « Mes inscriptions » (services simulés)
const { SS, props, cache } = require('./mocks.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'backend');
const brevo = { contacts: { 'jean@ex.fr': { listIds: [3] } } };
global.UrlFetchApp.fetch = function (url, o) {
  o = o || {}; const rep = (c, x) => ({ getResponseCode: () => c, getContentText: () => (x === undefined ? '' : JSON.stringify(x)) });
  const m = url.match(/contacts\/([^/?]+)$/);
  if (m && (o.method || 'get') === 'get') { const c = brevo.contacts[decodeURIComponent(m[1])]; return c ? rep(200, c) : rep(404, { message: 'x' }); }
  if (/\/contacts$/.test(url) && o.method === 'post') { const b = JSON.parse(o.payload); brevo.contacts[b.email] = { listIds: b.listIds }; return rep(201, {}); }
  if (/remove/.test(url)) { JSON.parse(o.payload).emails.forEach((x) => { if (brevo.contacts[x]) brevo.contacts[x].listIds = []; }); return rep(201, {}); }
  return rep(200, []);
};
vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') +
  ';globalThis.__t={FEUILLES,hacher_,ecrireLigne_,actionCompte_,lignes_,nouvelleSessionCpt_,COLONNES_COR,corReglages_,ecrireCorReglages_,oublierLignes_};');
const T = globalThis.__t;
let ok = 0, ko = 0; const verif = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', m); } };
const err = (f, re, m) => { try { f(); ko++; console.log('ÉCHEC (pas d\'erreur) :', m); } catch (e) { if (re.test(e.message)) ok++; else { ko++; console.log('ÉCHEC :', m, '→', e.message); } } };
Object.keys(T.FEUILLES).forEach(n => SS.insertSheet(n).appendRow(T.FEUILLES[n]));
props.BREVO_CLE = 'cle';
T.ecrireLigne_('Utilisateurs', { id: 'sec', identifiant: 'sec', nom: 'sec', role: 'secretaire', sel: 's', hash: 'h', actif: 'true' });
vm.runInThisContext('feuilleComptes_(); feuilleCor_(); feuillesRetraites_(); feuilleCate_(); feuilleCommandes_(); feuillePaiements_()');
T.ecrireLigne_('Comptes', { id: 'j1', mail: 'jean@ex.fr', prenom: 'Jean', nom: 'Dupont', telephone: '0600000000', statut: 'actif', sel: 's', hash: 'h', session_v: 0 });
const o = {}; T.COLONNES_COR.forEach(k => o[k] = ''); Object.assign(o, { id: 'c1', annee: '2026-2027', prenoms: 'Jean', nom: 'Dupont', email: 'jean@ex.fr', telephone: '0600000000', statut: 'actif' }); T.ecrireLigne_('CorUnum', o);
const r0 = T.corReglages_(); r0.equipes = { '2026-2027': [{ id: 'e1', nom: 'Saint-Joseph', chefs: [] }] }; r0.feuilles = [{ annee: '2026-2027' }]; T.ecrireCorReglages_(r0);
T.ecrireLigne_('Dossiers', { id: 'd1', type: 'bapteme', etat: 'ouvert', nom: 'Lucie Dupont', email: 'jean@ex.fr', telephone: '0600000000', donnees: JSON.stringify({ infos: { enfant_prenoms: 'Lucie', email: 'jean@ex.fr', telephone: '0600000000', adresse: '1 rue A' } }) });
T.ecrireLigne_('Dossiers', { id: 'd2', type: 'mariage', etat: 'clos', nom: 'Ancien', email: 'jean@ex.fr', donnees: JSON.stringify({ infos: { email: 'jean@ex.fr', telephone: '0600000000' } }) });
// Inscriptions
const auj = new Date().toISOString().slice(0, 10), plus = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
T.ecrireLigne_('Retraites', { id: 'r1', type: 'premiere_communion', titre: 'Retraite de première communion', date_debut: plus(20), date_fin: plus(21), lieu: 'Abbaye', prix: JSON.stringify([{ id: 'l1', libelle: 'Pension', montant: 40, obligatoire: true }]), date_limite: plus(10) });
T.ecrireLigne_('RetraitesInscrits', { id: 'i1', retraite_id: 'r1', jeton: 'a'.repeat(32), statut: 'inscrit', contact_email: 'Jean@ex.fr', participants: JSON.stringify([{ prenoms: 'Lucie', nom: 'Dupont' }]), paiements: JSON.stringify([{ montant: 10, part: 'retraite' }]) });
T.ecrireLigne_('RetraitesInscrits', { id: 'i2', retraite_id: 'r1', jeton: 'b'.repeat(32), statut: 'annule', contact_email: 'jean@ex.fr', participants: '[]', paiements: '[]' });
T.ecrireLigne_('Catechisme', { id: 'k1', annee: '2026-2027', nom: 'Dupont', prenoms: 'Lucie', groupe: 'CE1-CE2', email: 'jean@ex.fr', cotisation: '30', manuels: '[]', paiements: '[]' });
T.ecrireLigne_('Catechisme', { id: 'k0', annee: '2025-2026', nom: 'Dupont', prenoms: 'Lucie', email: 'jean@ex.fr', cotisation: '30', manuels: '[]', paiements: '[]' });
T.ecrireLigne_('Commandes', { id: 'o1', jeton: 'c'.repeat(32), cree_le: new Date().toISOString(), email: 'jean@ex.fr', lignes: JSON.stringify([{ titre: 'Catéchisme', prix: 12, qte: 2 }]), total: '24', statut: 'en_attente', paiements: '[]' });
T.ecrireLigne_('Paiements', { id: 'p1', cree_le: new Date().toISOString(), objet: 'livres', libelle: 'Livres', montant: '24', statut: 'abandonne', email: 'jean@ex.fr' });
T.ecrireLigne_('Paiements', { id: 'p2', cree_le: new Date().toISOString(), objet: 'livres', libelle: 'Autre', montant: '5', statut: 'paye', email: 'autre@ex.fr' });
const cs = T.nouvelleSessionCpt_(T.lignes_('Comptes')[0]);
const I = T.actionCompte_('cpt.inscriptions', { cs });
verif(I.retraites.length === 1 && I.retraites[0].reste === 30 && I.retraites[0].participants[0] === 'Lucie Dupont' && I.retraites[0].lien_modifier, 'retraite : reste 30 €, lien de modification ' + JSON.stringify(I.retraites));
verif(I.catechisme.length === 1 && I.catechisme[0].annee === '2026-2027' && I.catechisme[0].reste === 30, 'catéchisme de l\'année en cours');
verif(I.livres.length === 1 && I.livres[0].reste === 24 && I.livres[0].lignes[0] === '2 × Catéchisme', 'livres commandés');
verif(I.paiements.length === 1 && I.paiements[0].etat === 'Abandonné', 'seulement mes paiements');
// Profil
err(() => T.actionCompte_('cpt.profilModifier', { cs, telephone: '12' }), /téléphone/i, 'téléphone invalide');
const p = T.actionCompte_('cpt.profilModifier', { cs, telephone: '07 11 22 33 44', adresse: '3 rue B, Strasbourg', prenom: 'Jean-Marie' });
verif(p.profil.telephone === '07 11 22 33 44' && p.profil.prenom === 'Jean-Marie', 'profil enregistré');
T.oublierLignes_();
verif(T.lignes_('CorUnum')[0].telephone === '07 11 22 33 44' && T.lignes_('CorUnum')[0].prenoms === 'Jean-Marie', 'fiche Cor Unum mise à jour');
const d1 = T.lignes_('Dossiers').find(d => d.id === 'd1'), i1 = JSON.parse(d1.donnees).infos;
verif(i1.telephone === '07 11 22 33 44' && i1.adresse === '3 rue B, Strasbourg' && i1.enfant_prenoms === 'Lucie' && d1.nom === 'Lucie Dupont', 'dossier ouvert : coordonnées seulement, pas le nom de l\'enfant');
verif(JSON.parse(T.lignes_('Dossiers').find(d => d.id === 'd2').donnees).infos.telephone === '0600000000', 'dossier clos inchangé');
verif(JSON.parse(d1.donnees).historique.some(h => /Coordonnées modifiées/.test(h.texte)), 'historique du dossier');
verif(T.lignes_('Notifications').some(n => n.uid === 'sec' && /coordonnées/.test(n.titre)), 'secrétariat prévenu');
// Adresse e-mail
T.ecrireLigne_('Comptes', { id: 'z1', mail: 'pris@ex.fr', statut: 'actif' });
err(() => T.actionCompte_('cpt.mailCode', { cs, nouveau: 'pris@ex.fr' }), /autre compte/, 'adresse déjà prise refusée');
T.actionCompte_('cpt.mailCode', { cs, nouveau: 'Nouveau@Ex.fr' });
const code = (global.mails[global.mails.length - 1].texte.match(/\b(\d{6})\b/) || [])[1];
verif(global.mails[global.mails.length - 1].to === 'nouveau@ex.fr', 'code envoyé à la nouvelle adresse');
err(() => T.actionCompte_('cpt.mailChanger', { cs, code: '000000' }), /incorrect/, 'mauvais code');
const mc = T.actionCompte_('cpt.mailChanger', { cs, code });
T.oublierLignes_();
verif(mc.profil.mail === 'nouveau@ex.fr' && T.lignes_('Comptes').find(x => x.id === 'j1').mail === 'nouveau@ex.fr', 'adresse du compte changée');
verif(T.lignes_('CorUnum')[0].email === 'nouveau@ex.fr' && JSON.parse(T.lignes_('Dossiers').find(d => d.id === 'd1').donnees).infos.email === 'nouveau@ex.fr', 'adresse reportée (Cor Unum, dossier)');
verif(brevo.contacts['nouveau@ex.fr'] && brevo.contacts['nouveau@ex.fr'].listIds[0] === 3 && brevo.contacts['jean@ex.fr'].listIds.length === 0, 'abonnement à la lettre transféré');
verif(global.mails.some(m => m.to === 'jean@ex.fr' && /adresse modifiée/.test(m.sujet)), 'ancienne adresse prévenue');
verif(T.actionCompte_('cpt.lire', { cs: mc.session }).mail === 'nouveau@ex.fr', 'nouvelle session valable');
console.log(ok + ' vérifications réussies, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
