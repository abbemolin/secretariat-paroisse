// node tests/test-lots.js — actions groupées (dossiers, documents réclamés, registre en série, catéchisme, retraites, app des paroissiens)
const { SS, props } = require('./mocks.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'backend');
vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') +
  ';globalThis.__t={doPost,FEUILLES,hacher_,ecrireLigne_,lignes_,oublierLignes_,aujourdhui_,ajouterJours_};');
const T = globalThis.__t;
let ok = 0, ko = 0; const verif = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', m); } };
const post = (action, payload, token) => JSON.parse(T.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).t);
Object.keys(T.FEUILLES).forEach(n => SS.insertSheet(n).appendRow(T.FEUILLES[n]));
props.DOSSIER_ID = 'racine';
T.ecrireLigne_('Utilisateurs', { id: 'cure', identifiant: 'cure', nom: 'abbé Florent', role: 'cure', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true', signature: 'cure' });
T.ecrireLigne_('Utilisateurs', { id: 'sec', identifiant: 'sec', nom: 'Marie', role: 'secretaire', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true',
  acces: JSON.stringify({ dossiers: { bapteme: 'm' }, reglages: [], paroissiens: '' }) });
props.CHARTES_EQUIPE = JSON.stringify({ cure: new Date().toISOString(), sec: new Date().toISOString() });
const tok = post('auth.login', { identifiant: 'cure', motdepasse: 'motdepasse' }).data.token;
const tokS = post('auth.login', { identifiant: 'sec', motdepasse: 'motdepasse' }).data.token;
vm.runInThisContext('feuilleComptes_(); feuillesRetraites_(); feuilleCate_(); feuillePrieres_()');
const auj = T.aujourdhui_(), an = auj.slice(0, 4), plus = (n) => T.ajouterJours_(auj, n);
const dos = (id, type, nom, email, extra) => T.ecrireLigne_('Dossiers', Object.assign({ id, type, etat: 'ouvert', nom, email, cree_le: new Date().toISOString(),
  donnees: JSON.stringify({ infos: { enfant_prenoms: nom.split(' ')[0] }, etapes: {}, documents: {} }) }, extra || {}));
const don = (id) => { T.oublierLignes_(); return JSON.parse(T.lignes_('Dossiers').find(x => x.id === id).donnees); };
dos('b1', 'bapteme', 'Léa MARTIN', 'a@ex.fr'); dos('b2', 'bapteme', 'Tom DURAND', 'b@ex.fr'); dos('b3', 'bapteme', 'Zoé PETIT', '');
dos('m1', 'mariage', 'Jean et Anne', 'm@ex.fr');

// ─── Dossiers ───
let r = post('dossiers.lot', { op: 'etape', ids: ['b1', 'b2', 'm1'], cle: 'rencontre', libelle: 'Rencontre' }, tokS);
verif(r.ok && r.data.faits === 2 && r.data.ignores.length === 1 && /droit/.test(r.data.ignores[0].raison), 'étape cochée sur 2 baptêmes ; le mariage refusé (pas le droit)');
verif(don('b1').etapes.rencontre.fait && don('b2').etapes.rencontre.par === 'Marie', 'étape enregistrée avec l\'auteur');
r = post('dossiers.lot', { op: 'etape', ids: ['b1'], cle: 'registre' }, tok);
verif(!r.ok, 'l\'étape « registre » ne se coche pas en lot');
r = post('dossiers.lot', { op: 'document', ids: ['b1', 'b2'], cle: 'acte_naissance' }, tok);
verif(r.ok && r.data.faits === 2 && don('b2').documents.acte_naissance.recu, 'document reçu sur 2 dossiers');
r = post('dossiers.lot', { op: 'etat', ids: ['b2'], valeur: 'clos' }, tok);
T.oublierLignes_();
verif(r.ok && T.lignes_('Dossiers').find(x => x.id === 'b2').etat === 'clos', 'dossier clos');
r = post('dossiers.lot', { op: 'annee', ids: ['b1'], valeur: '2027' }, tok);
verif(r.ok && r.data.faits === 0 && /pas d'année/.test(r.data.ignores[0].raison), 'pas d\'année pour un baptême');
global.mails = [];
r = post('dossiers.reclamer', { envois: [{ id: 'b1', documents: ['Acte de naissance', 'Certificat'] }, { id: 'b3', documents: ['Acte'] }],
  sujet: 'Documents pour {enfant}', corps: 'Bonjour,\nIl manque :\n{documents}', signature: 'Le secrétariat' }, tok);
verif(r.ok && r.data.faits === 1 && /adresse/.test(r.data.ignores[0].raison), 'un mail envoyé, un dossier sans adresse signalé');
verif(global.mails.length === 1 && global.mails[0].sujet === 'Documents pour Léa' && /- Acte de naissance\n- Certificat/.test(global.mails[0].texte), 'mail personnalisé avec SA liste');
verif(JSON.stringify(don('b1')).includes('Documents réclamés'), 'trace dans l\'historique du dossier');

// ─── Registre en série ───
['c1', 'c2', 'c3'].forEach((id, k) => dos(id, 'bapteme', ['Anne A', 'Bruno B', 'Carla C'][k], '', { date_celebration: plus(-10 + k),
  donnees: JSON.stringify({ infos: {}, etapes: { celebration: { fait: true } } }) }));
r = post('registres', { serie: { registre: 'baptemes', ids: ['c3', 'c1', 'c2'], apercu: true } }, tok);
const a1 = plus(-10).slice(0, 4);
verif(r.ok && r.data.plan.map(x => x.id + x.numero).join() === (a1 === plus(-8).slice(0, 4) ? 'c31,c12,c23' : r.data.plan.map(x => x.id + x.numero).join()), 'aperçu : numéros dans l\'ordre choisi');
verif(r.ok && !don('c1').etapes.registre, 'l\'aperçu n\'inscrit rien');
r = post('registres', { serie: { registre: 'baptemes', ids: ['c3', 'c1', 'c2'] } }, tok);
verif(r.ok && r.data.faits === 3 && don('c3').infos.acte_numero === '1' && don('c3').etapes.registre.fait, 'trois actes inscrits, numéros qui se suivent');
r = post('registres', { serie: { registre: 'baptemes', ids: ['c1'] } }, tok);
verif(r.ok && r.data.faits === 0 && /plus à inscrire/.test(r.data.ignores[0].raison), 'un acte déjà inscrit est ignoré');

// ─── Catéchisme ───
T.ecrireLigne_('Catechisme', { id: 'k1', annee: '2026-2027', nom: 'Martin', prenoms: 'Léa', groupe: 'CE1', email: 'a@ex.fr', cotisation: '30', manuels: JSON.stringify([{ id: 'l', titre: 'Livre', prix: 10 }]), paiements: '[]' });
T.ecrireLigne_('Catechisme', { id: 'k2', annee: '2026-2027', nom: 'Durand', prenoms: 'Tom', groupe: 'CE1', email: 'b@ex.fr', cotisation: '30', manuels: '[]', paiements: JSON.stringify([{ id: 'x', montant: 30, mode: 'Chèque', date: auj }]) });
r = post('cate.lot', { op: 'solder', ids: ['k1', 'k2'], mode: 'Chèque', date: auj }, tok);
T.oublierLignes_();
const k1 = T.lignes_('Catechisme').find(x => x.id === 'k1');
verif(r.ok && r.data.faits === 1 && /déjà réglé/.test(r.data.ignores[0].raison), 'cotisation : une soldée, une déjà réglée');
verif(JSON.parse(k1.paiements)[0].mode === 'Chèque' && JSON.parse(k1.paiements)[0].montant > 0, 'paiement du reste dû avec le mode choisi');
r = post('cate.lot', { op: 'remis', ids: ['k1', 'k2'] }, tok);
T.oublierLignes_();
verif(r.ok && r.data.faits === 1 && JSON.parse(T.lignes_('Catechisme').find(x => x.id === 'k1').manuels)[0].remis === true, 'livres remis');
r = post('cate.lot', { op: 'groupe', ids: ['k1', 'k2'], valeur: 'CE2' }, tok);
T.oublierLignes_();
verif(r.ok && T.lignes_('Catechisme').every(x => x.groupe === 'CE2'), 'groupe changé pour les deux');

// ─── Retraites ───
T.ecrireLigne_('Retraites', { id: 'r1', type: 'premiere_communion', titre: 'Retraite de première communion', date_debut: plus(20), date_fin: plus(21), lieu: 'Abbaye',
  prix: JSON.stringify([{ id: 'l1', libelle: 'Pension', montant: 40, obligatoire: true }]), date_limite: plus(10) });
const ins = (id, mail, prenom, pay) => T.ecrireLigne_('RetraitesInscrits', { id, retraite_id: 'r1', jeton: id.repeat(16).slice(0, 32), statut: 'inscrit', contact_email: mail,
  participants: JSON.stringify([{ prenoms: prenom, nom: 'X' }]), paiements: JSON.stringify(pay || []), urgence_nom: 'P', urgence_tel: '06' });
ins('i1', 'a@ex.fr', 'Léa'); ins('i2', '', 'Tom'); ins('i3', 'c@ex.fr', 'Zoé', [{ id: 'p', montant: 40, mode: 'Chèque', date: auj }]);
global.mails = [];
r = post('retraites.lot', { retraite_id: 'r1', op: 'relancer', ids: ['i1', 'i2', 'i3'], sujet: '{retraite}', corps: 'Pour {participants} : reste {reste}.\n[Bouton : Payer en ligne]' }, tok);
verif(r.ok && r.data.faits === 1 && r.data.ignores.length === 2, 'relance : un mail ; sans adresse et déjà payé ignorés');
verif(global.mails[0] && /Pour Léa : reste 40/.test(global.mails[0].texte) && !/\[Bouton/.test(global.mails[0].texte), 'mail personnalisé, bouton retiré sans paiement en ligne');
r = post('retraites.lot', { retraite_id: 'r1', op: 'solder', ids: ['i1', 'i2', 'i3'], mode: 'Espèces' }, tok);
verif(r.ok && r.data.faits === 2 && r.data.retraite, 'deux inscriptions soldées, la retraite renvoyée');
T.oublierLignes_();
verif(JSON.parse(T.lignes_('RetraitesInscrits').find(x => x.id === 'i1').paiements)[0].mode === 'Espèces', 'mode de paiement enregistré');

// ─── App des paroissiens ───
T.ecrireLigne_('Comptes', { id: 'q1', mail: 'q1@ex.fr', prenom: 'Luc', nom: 'Morel', statut: 'attente', sel: 's', hash: 'h', session_v: 0, demande: JSON.stringify({ messe: '10h' }) });
T.ecrireLigne_('Comptes', { id: 'q2', mail: 'q2@ex.fr', prenom: 'Inès', nom: 'Roy', statut: 'attente', sel: 's', hash: 'h', session_v: 0, demande: JSON.stringify({ mineur: true, accord: { reponse: '' } }) });
global.mails = [];
r = post('paroissiens.lot', { op: 'valider', ids: ['q1', 'q2'] }, tok);
T.oublierLignes_();
verif(r.ok && r.data.faits === 1 && /accord du parent/.test(r.data.ignores[0].raison), 'une demande acceptée ; lycéenne sans accord exclue');
verif(T.lignes_('Comptes').find(x => x.id === 'q1').statut !== 'attente' && T.lignes_('Comptes').find(x => x.id === 'q2').statut === 'attente', 'statuts justes');
verif(global.mails.some(m => m.to === 'q1@ex.fr'), 'invitation envoyée');
verif(Array.isArray(r.data.liste?.comptes), 'liste renvoyée pour l\'affichage');
T.ecrireLigne_('Prieres', { id: 'pr1', cree_le: new Date().toISOString(), auteur: 'q1', auteur_nom: 'Luc', texte: 'Pour la paix', statut: 'relecture', raisons: '[]', priants: '[]', signalements: 0 });
T.ecrireLigne_('Prieres', { id: 'pr2', cree_le: new Date().toISOString(), auteur: 'q1', auteur_nom: 'Luc', texte: 'Pour ma mère', statut: 'relecture', raisons: '[]', priants: '[]', signalements: 0 });
r = post('paroissiens.lot', { op: 'publier', ids: ['pr1', 'pr2'] }, tok);
T.oublierLignes_();
verif(r.ok && r.data.faits === 2 && T.lignes_('Prieres').every(x => x.statut === 'publiee'), 'deux intentions publiées');
r = post('paroissiens.lot', { op: 'refuser', ids: ['pr2'] }, tok);
T.oublierLignes_();
verif(r.ok && T.lignes_('Prieres').find(x => x.id === 'pr2').statut === 'refusee' && Array.isArray(r.data.prieres), 'une intention retirée');
r = post('paroissiens.lot', { op: 'publier', ids: ['pr1'] }, tokS);
verif(!r.ok, 'sans le droit « App des paroissiens », pas de modération');

// ─── Garde-fous ───
verif(!post('dossiers.lot', { op: 'etat', ids: [], valeur: 'clos' }, tok).ok, 'sélection vide refusée');
verif(!post('dossiers.lot', { op: 'etat', ids: Array.from({ length: 201 }, (_, k) => 'x' + k), valeur: 'clos' }, tok).ok, 'plus de 200 fiches refusé');

console.log(`${ok} vérifications OK, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
