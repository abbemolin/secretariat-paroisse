const { SS, props, cache } = require('./mocks.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = require('path').join(__dirname, '..', 'backend');
const SRC = fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
vm.runInThisContext(SRC + '\n;globalThis.__t={actionCompte_,actionEspace_,doPost,FEUILLES,hacher_,jeton_,uid_,ecrireLigne_,feuille_,lignes_,oublierLignes_,ecrireCorReglages_,corReglages_,COLONNES_COR,entretienComptes_,sessionChefValide_,etatCharte_,ROUTES,verifierSession_,maintenant_};');
const T = globalThis.__t;
let ok = 0, ko = 0;
function verif(c, msg) { if (c) { ok++; } else { ko++; console.log('ÉCHEC :', msg); } }
function err(fn, re, msg) { try { fn(); ko++; console.log('ÉCHEC (pas d\'erreur) :', msg); } catch (e) { if (re.test(e.message)) ok++; else { ko++; console.log('ÉCHEC :', msg, '→', e.message); } } }
const dernierCode = () => (mails[mails.length - 1].texte.match(/\b(\d{6})\b/) || [])[1];
const post = (action, payload, token) => JSON.parse(T.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).t);

// Base
Object.keys(T.FEUILLES).forEach(n => { SS.insertSheet(n).appendRow(T.FEUILLES[n]); });
const sel = 'abc'; const U = (id, role) => ({ id, identifiant: id, nom: id, role, signature: '', sel, hash: T.hacher_('motdepasse', sel), actif: 'true', cree_le: '', derniere_connexion: '', acces: '' });
['admin', 'cure', 'secretaire', 'diacre'].forEach(r => T.ecrireLigne_('Utilisateurs', U(r, r)));
// Dossier catéchumène + espace avec mot de passe
T.ecrireLigne_('Dossiers', { id: 'd1', type: 'catechumene', etat: 'ouvert', nom: 'Marie Martin', email: 'marie@ex.fr', telephone: '0611223344', donnees: JSON.stringify({ infos: { prenoms: 'Marie', nom: 'Martin', email: 'marie@ex.fr', telephone: '06 11 22 33 44' } }) });
T.ecrireLigne_('Dossiers', { id: 'd2', type: 'catechumene', etat: 'ouvert', nom: 'Paul Martin', email: 'marie@ex.fr', donnees: JSON.stringify({ infos: { prenoms: 'Paul', nom: 'Martin', email: 'marie@ex.fr' } }) });
const jEsp = T.jeton_();
vm.runInThisContext('feuillesEspace_()');
T.ecrireLigne_('Espaces', { dossier_id: 'd1', jeton: jEsp, hash: T.hacher_('ancienmdp1', 's1'), sel: 's1', mdp_maj: '', cree_le: '', derniere_visite: '' });
T.ecrireLigne_('Espaces', { dossier_id: 'd2', jeton: T.jeton_(), hash: '', sel: '', cree_le: '' });
// Cor Unum : une fraternité dont Claire est chef
vm.runInThisContext('feuilleCor_()');
const cor = (id, prenoms, nom, email, equipe) => { const o = {}; T.COLONNES_COR.forEach(k => o[k] = ''); Object.assign(o, { id, annee: '2026-2027', prenoms, nom, email, telephone: '0700000000', equipe_id: equipe, statut: 'actif' }); T.ecrireLigne_('CorUnum', o); };
cor('c1', 'Claire', 'Durand', 'claire@ex.fr', 'e1'); cor('c2', 'Hugo', 'Petit', 'hugo@ex.fr', 'e1'); cor('c3', 'Sans', 'Adresse', '', 'e1');
const r = T.corReglages_(); r.equipes = { '2026-2027': [{ id: 'e1', nom: 'Saint-Joseph', chefs: ['c1'] }] }; r.feuilles = [{ annee: '2026-2027' }]; T.ecrireCorReglages_(r);

// 1. Demande d'accès
err(() => T.actionCompte_('cpt.demandeCode', { mail: 'pas-une-adresse' }), /invalide/i, 'adresse invalide refusée');
verif(T.actionCompte_('cpt.demandeCode', { mail: 'x@ex.fr', piege: 'robot' }).mail === '', 'champ piège : rien envoyé');
const n0 = mails.length;
T.actionCompte_('cpt.demandeCode', { mail: 'Jean@Ex.fr' });
verif(mails.length === n0 + 1 && mails[n0].to === 'jean@ex.fr', 'code envoyé à l\'adresse normalisée');
const code = dernierCode();
err(() => T.actionCompte_('cpt.demande', { mail: 'jean@ex.fr', code: '000000', prenom: 'Jean', nom: 'Dupont', telephone: '0612345678', confidentialite: true }), /Code incorrect/, 'mauvais code');
err(() => T.actionCompte_('cpt.demande', { mail: 'jean@ex.fr', code, prenom: 'Jean', nom: 'Dupont', telephone: '06', confidentialite: true }), /téléphone/, 'téléphone obligatoire');
err(() => T.actionCompte_('cpt.demande', { mail: 'jean@ex.fr', code, prenom: 'Jean', nom: 'Dupont', telephone: '0612345678' }), /Confidentialité/, 'confidentialité obligatoire');
T.actionCompte_('cpt.demande', { mail: 'jean@ex.fr', code, prenom: 'Jean', nom: 'Dupont', telephone: '0612345678', confidentialite: true, messe: '10 h 30', liens: ['Messe le dimanche'] });
let jean = T.lignes_('Comptes').find(x => x.mail === 'jean@ex.fr');
verif(jean && jean.statut === 'attente', 'demande enregistrée en attente');
const notifs = T.lignes_('Notifications').filter(n => /demande d'accès/.test(n.titre)).map(n => n.uid).sort();
verif(JSON.stringify(notifs) === JSON.stringify(['admin', 'cure', 'secretaire']), 'validateurs prévenus (pas le diacre) : ' + notifs);
err(() => T.actionCompte_('cpt.demandeCode', { mail: 'jean@ex.fr' }), /en cours d'examen/, 'pas de seconde demande');
err(() => T.actionCompte_('cpt.connexion', { mail: 'jean@ex.fr', mdp: 'x' }), /en cours d'examen/, 'pas de connexion avant validation');
// rapprochement : Hugo est connu de Cor Unum
T.actionCompte_('cpt.demandeCode', { mail: 'hugo@ex.fr' });
T.actionCompte_('cpt.demande', { mail: 'hugo@ex.fr', code: dernierCode(), prenom: 'Hugo', nom: 'Petit', telephone: '07 00 00 00 00', confidentialite: true });
const hugo = T.lignes_('Comptes').find(x => x.mail === 'hugo@ex.fr');
verif(JSON.parse(hugo.rapprochement).some(z => /Cor Unum/.test(z.source) && /Saint-Joseph/.test(z.detail)), 'rapprochement avec Cor Unum');

// 2. Secrétariat : charte puis validation
const loginS = post('auth.login', { identifiant: 'secretaire', motdepasse: 'motdepasse' }).data.token;
const listeAvant = post('paroissiens.liste', {}, loginS);
verif(!listeAvant.ok && listeAvant.code === 'CHARTE', 'page fermée tant que la charte n\'est pas acceptée');
verif(post('charte.accepter', {}, loginS).data.a_accepter === false, 'charte acceptée');
const liste = post('paroissiens.liste', {}, loginS);
verif(liste.ok && liste.data.comptes.length === 2, 'liste des comptes');
verif(liste.data.comptes.every(c => !('hash' in c) && !('sel' in c)), 'jamais de hash dans la liste');
const loginD = post('auth.login', { identifiant: 'diacre', motdepasse: 'motdepasse' }).data.token;
post('charte.accepter', {}, loginD);
verif(post('paroissiens.liste', {}, loginD).code === 'INTERDIT', 'diacre : pas d\'accès à la page');
const m1 = mails.length;
post('paroissiens.modifier', { id: jean.id, op: 'valider' }, loginS);
jean = T.lignes_('Comptes').find(x => x.mail === 'jean@ex.fr');
verif(jean.statut === 'invite' && /^[a-f0-9]{32}$/.test(jean.jeton), 'validée → invitation');
verif(mails.length === m1 + 1 && mails[m1].to === 'jean@ex.fr' && mails[m1].texte.includes('?i=' + jean.jeton), 'mail d\'invitation avec lien');
verif(/secretariat@croix-glorieuse.org/.test(mails[m1].texte), 'mention RGPD dans le mail');
// 3. Activation
verif(T.actionCompte_('cpt.invitation', { i: jean.jeton }).mail.startsWith('je…@'), 'invitation : adresse masquée');
err(() => T.actionCompte_('cpt.activer', { i: jean.jeton, mdp: 'court', confidentialite: true }), /10 caractères/, 'mot de passe trop court');
const act = T.actionCompte_('cpt.activer', { i: jean.jeton, mdp: 'motdepasse-jean', confidentialite: true });
verif(act.session && act.vue.prenom === 'Jean' && act.vue.paroissien, 'compte ouvert, session donnée');
err(() => T.actionCompte_('cpt.activer', { i: jean.jeton, mdp: 'motdepasse-jean', confidentialite: true }), /plus valable|pas valable/, 'lien d\'invitation à usage unique');
// 4. Connexion
delete cache['cptechec_jean@ex.fr'];
for (let k = 0; k < 5; k++) err(() => T.actionCompte_('cpt.connexion', { mail: 'jean@ex.fr', mdp: 'faux' + k }), /incorrect/, 'mauvais mot de passe ' + k);
err(() => T.actionCompte_('cpt.connexion', { mail: 'jean@ex.fr', mdp: 'motdepasse-jean' }), /quart d'heure/, 'bloqué après 5 erreurs');
delete cache['cptechec_jean@ex.fr'];
const cx = T.actionCompte_('cpt.connexion', { mail: 'JEAN@ex.fr ', mdp: 'motdepasse-jean' });
verif(cx.session, 'connexion par mail');
verif(T.actionCompte_('cpt.lire', { cs: cx.session }).mail === 'jean@ex.fr', 'lecture avec la session');
err(() => T.actionCompte_('cpt.lire', { cs: cx.session.replace(/.$/, c => c === 'a' ? 'b' : 'a') }), /reconnectez|Connectez/, 'session falsifiée refusée');
// Se déconnecter partout
T.actionCompte_('cpt.partout', { cs: cx.session });
err(() => T.actionCompte_('cpt.lire', { cs: cx.session }), /reconnectez|Connectez/, 'déconnecté partout');
// Mot de passe oublié (même réponse si inconnu)
const n2 = mails.length;
verif(T.actionCompte_('cpt.oubli', { mail: 'inconnu@ex.fr' }).mail.startsWith('in…@') && mails.length === n2, 'oubli : rien envoyé à une adresse inconnue, même réponse');
T.actionCompte_('cpt.oubli', { mail: 'jean@ex.fr' });
const re = T.actionCompte_('cpt.reinit', { mail: 'jean@ex.fr', code: dernierCode(), mdp: 'nouveau-mdp-jean' });
verif(re.session, 'nouveau mot de passe');
// Mes données
const md = T.actionCompte_('cpt.mesDonnees', { cs: re.session });
verif(md.compte.mail === 'jean@ex.fr' && !JSON.stringify(md).includes(T.lignes_('Comptes').find(x => x.mail === 'jean@ex.fr').hash), 'Mes données sans le mot de passe');

// 5. Reprise des espaces
const loginC = post('auth.login', { identifiant: 'cure', motdepasse: 'motdepasse' }).data.token;
post('charte.accepter', {}, loginC);
const mig = post('paroissiens.migrer', {}, loginC).data;
verif(mig.crees === 2 && mig.adresse_prise.length === 1, 'reprise : 2 comptes, adresse partagée signalée ' + JSON.stringify(mig));
verif(post('paroissiens.migrer', {}, loginC).data.crees === 0, 'reprise relançable sans doublon');
const marie = T.lignes_('Comptes').find(x => x.dossier_id === 'd1');
verif(marie.statut === 'actif' && marie.mail === 'marie@ex.fr', 'Marie : compte actif');
const cm = T.actionCompte_('cpt.connexion', { mail: 'marie@ex.fr', mdp: 'ancienmdp1' });
verif(cm.session, 'Marie se connecte avec son ancien mot de passe');
verif(cm.vue.espace && cm.vue.espace.c === jEsp && cm.vue.espace.s, 'pont vers son espace de catéchumène');
const vEsp = T.actionEspace_('esp.lire', { c: cm.vue.espace.c, session: cm.vue.espace.s });
verif(vEsp.prenom === 'Marie', 'l\'espace s\'ouvre avec la session donnée par le compte');
const paul = T.lignes_('Comptes').find(x => x.dossier_id === 'd2');
verif(paul.mail === '' && paul.statut === 'invite', 'Paul (adresse partagée) : sans adresse, garde son lien');
// ancien lien : mot de passe choisi → aussi celui du compte
T.actionCompte_('cpt.partout', { cs: cm.session });

// 6. Invitations Cor Unum + chef
const inv = post('paroissiens.inviter', { equipe_id: 'e1' }, loginS).data;
verif(inv.invites.includes('Claire Durand') && inv.sans_adresse.includes('Sans Adresse') && inv.invites.includes('Hugo Petit'), 'invitations : ' + JSON.stringify(inv));
const claire = T.lignes_('Comptes').find(x => x.mail === 'claire@ex.fr');
const cc = T.actionCompte_('cpt.activer', { i: claire.jeton, mdp: 'motdepasse-claire', confidentialite: true });
verif(cc.vue.chefs.length === 1 && /fraternite\/\?c=.+#s=/.test(cc.vue.chefs[0].lien), 'Claire : lien vers sa page de chef');
const sChef = cc.vue.chefs[0].lien.split('#s=')[1];
const fil = T.corReglages_().equipes['2026-2027'][0].fil;
verif(T.sessionChefValide_(fil, sChef) === true, 'session de chef acceptée par la page de la fraternité');
verif(T.sessionChefValide_('autre', sChef) === false, 'pas valable pour une autre fraternité');
verif(cc.vue.fraternite.etat === 'membre' && cc.vue.fraternite.equipe === 'Saint-Joseph', 'Claire voit sa fraternité');
const hugo2 = T.lignes_('Comptes').find(x => x.mail === 'hugo@ex.fr');
verif(hugo2.statut === 'invite', 'Hugo (demande en attente) invité directement');
const ch = T.actionCompte_('cpt.activer', { i: hugo2.jeton, mdp: 'motdepasse-hugo', confidentialite: true });
verif(ch.vue.chefs.length === 0, 'Hugo n\'est pas chef');

// 7. Suspendre, supprimer
post('paroissiens.modifier', { id: hugo2.id, op: 'suspendre' }, loginS);
err(() => T.actionCompte_('cpt.lire', { cs: ch.session }), /Connectez|reconnectez/, 'compte suspendu : session coupée');
T.actionCompte_('cpt.supprimer', { cs: cc.session, mdp: 'motdepasse-claire' });
verif(!T.lignes_('Comptes').find(x => x.mail === 'claire@ex.fr'), 'Claire a supprimé son compte');
verif(T.lignes_('Notifications').some(n => /compte supprimé/.test(n.titre)), 'secrétariat prévenu de la suppression');

// 8. Entretien RGPD
const vieux = new Date(Date.now() - 600 * 86400000).toISOString(), presque = new Date(Date.now() - 530 * 86400000).toISOString();
T.ecrireLigne_('Comptes', { id: 'v1', mail: 'vieux@ex.fr', prenom: 'Vieux', statut: 'actif', hash: 'h', derniere_visite: vieux, prefs: '' });
T.ecrireLigne_('Comptes', { id: 'v2', mail: 'presque@ex.fr', prenom: 'Presque', statut: 'actif', hash: 'h', derniere_visite: presque, prefs: '' });
T.ecrireLigne_('Comptes', { id: 'v3', mail: 'refuse@ex.fr', statut: 'refuse', statut_le: vieux });
const n3 = mails.length;
T.entretienComptes_();
T.oublierLignes_();
verif(T.lignes_('Comptes').find(x => x.id === 'v1').statut === 'desactive', '18 mois : désactivé');
verif(mails.slice(n3).some(m => m.to === 'presque@ex.fr'), '17 mois : prévenu par mail');
verif(!T.lignes_('Comptes').find(x => x.id === 'v3'), 'demande refusée effacée après 3 mois');

// 9. Push groupé
T.ecrireLigne_('Push', { uid: 'cpt:x', endpoint: 'https://fcm.googleapis.com/a', appareil: '', cree_le: '' });
T.ecrireLigne_('Push', { uid: 'cpt:y', endpoint: 'https://fcm.googleapis.com/b', appareil: '', cree_le: '' });
props.VAPID_PRIVEE = 'c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721'; props.VAPID_PUBLIQUE = 'x';
vm.runInThisContext("envoyerPushMasse_(['cpt:x','cpt:y'])");
verif(fetches.filter(f => f.url).length === 2, 'notifications envoyées en un seul paquet');

console.log(ok + ' vérifications réussies, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
