// node tests/test-priere.js — mur de prière (services simulés)
const { SS } = require('./mocks.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'backend');
vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') +
  ';globalThis.__t={doPost,FEUILLES,hacher_,ecrireLigne_,actionCompte_,lignes_,nouvelleSessionCpt_,oublierLignes_,moderationPriere_,entretienPrieres_};');
const T = globalThis.__t;
let ok = 0, ko = 0; const verif = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', m); } };
const err = (f, re, m) => { try { f(); ko++; console.log('ÉCHEC (pas d\'erreur) :', m); } catch (e) { if (re.test(e.message)) ok++; else { ko++; console.log('ÉCHEC :', m, '→', e.message); } } };
const post = (action, payload, token) => JSON.parse(T.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).t);
// Modérateur
const M = T.moderationPriere_;
verif(M('Pour ma maman qui est malade, qu\'elle guérisse.').length === 0, 'intention simple publiée');
verif(M('Seigneur Jésus, protège notre curé et la Vierge Marie veille sur nous.').length === 0, 'noms saints acceptés');
verif(M('Pour mon père qui va mourir bientôt').length === 0, 'la mort n\'est pas un sujet à relire');
verif(M('Priez pour Paul Dupont qui est malade').some(r => /nom/.test(r)), 'prénom + nom mis de côté');
verif(M('Appelez-moi au 06 12 34 56 78').some(r => /téléphone/.test(r)), 'téléphone mis de côté');
verif(M('écrivez à jean@ex.fr').some(r => /e-mail/.test(r)), 'adresse mis de côté');
verif(M('voir www.exemple.fr').some(r => /lien/.test(r)), 'lien mis de côté');
verif(M('quel con ce voisin').some(r => /déplacé/.test(r)), 'mot déplacé mis de côté');
verif(M('pour que le bon parti gagne l\'élection').some(r => /sujet/.test(r)), 'politique mise de côté');
// Comptes
Object.keys(T.FEUILLES).forEach(n => SS.insertSheet(n).appendRow(T.FEUILLES[n]));
T.ecrireLigne_('Utilisateurs', { id: 'sec', identifiant: 'sec', nom: 'sec', role: 'secretaire', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true' });
vm.runInThisContext('feuilleComptes_()');
const C = (id, extra) => T.ecrireLigne_('Comptes', Object.assign({ id, mail: id + '@ex.fr', prenom: id, nom: 'X', statut: 'actif', sel: 's', hash: 'h', session_v: 0 }, extra || {}));
C('a'); C('b'); C('c'); C('ly', { demande: JSON.stringify({ mineur: true }) });
const s = {}; T.lignes_('Comptes').forEach(x => { s[x.id] = T.nouvelleSessionCpt_(x); });
const A = (q, act, p) => T.actionCompte_('cpt.priere.' + act, Object.assign({ cs: s[q] }, p || {}));
let r = A('a', 'deposer', { texte: 'Pour ma maman malade' });
verif(r.mur.length === 1 && r.mur[0].mienne && !r.relecture, 'publiée sur le mur');
verif(!JSON.stringify(A('b', 'mur')).includes('a@ex.fr') && !JSON.stringify(A('b', 'mur')).match(/"auteur/), 'anonyme pour les autres');
r = A('a', 'deposer', { texte: 'Pour Paul Dupont qui souffre' });
verif(r.relecture && r.mur.length === 1 && r.miennes.find(m => m.statut === 'relecture'), 'mise de côté : pas sur le mur, visible dans mes intentions');
verif(T.lignes_('Notifications').some(n => n.uid === 'sec' && /à relire/.test(n.titre)), 'équipe prévenue');
A('a', 'deposer', { texte: 'Pour la paix' });
err(() => A('a', 'deposer', { texte: 'Une quatrième intention' }), /3 intentions/, '3 par semaine');
err(() => A('ly', 'deposer', { texte: 'Pour mes amis' }), /lycéens/, 'lycéen ne dépose pas');
const id = A('b', 'mur').mur.find(m => m.texte === 'Pour ma maman malade').id;
r = A('b', 'prier', { id }); verif(r.mur.find(m => m.id === id).priants === 1 && r.mur.find(m => m.id === id).je_prie, 'je prie');
A('ly', 'prier', { id }); verif(A('a', 'mur').miennes.find(m => m.id === id).priants === 2, 'le déposant voit combien prient (lycéen compris)');
r = A('b', 'prier', { id }); verif(r.mur.find(m => m.id === id).priants === 1, 'je ne prie plus (bascule)');
A('b', 'signaler', { id }); verif(A('c', 'mur').mur.some(m => m.id === id), 'un signalement : reste');
A('c', 'signaler', { id }); verif(!A('c', 'mur').mur.some(m => m.id === id), 'deux signalements : masquée');
err(() => A('b', 'retirer', { id }), /pas votre/, 'on ne retire que la sienne');
// Secrétariat
const tok = post('auth.login', { identifiant: 'sec', motdepasse: 'motdepasse' }).data.token; post('charte.accepter', {}, tok);
const eq = post('paroissiens.prieres', {}, tok).data;
verif(eq.find(x => x.id === id).auteur === 'a X' && eq.find(x => x.id === id).statut === 'masquee', 'l\'équipe voit l\'auteur et le statut');
post('paroissiens.moderer', { id, op: 'publier' }, tok);
verif(A('c', 'mur').mur.some(m => m.id === id), 'republiée après relecture');
A('a', 'exaucee', { id, grace: 'Elle est guérie, merci !' });
verif(A('b', 'mur').mur.find(m => m.id === id).exaucee, 'prière exaucée affichée');
A('a', 'retirer', { id }); verif(!A('b', 'mur').mur.some(m => m.id === id), 'retirée par le déposant');
// Entretien : 6 mois
T.ecrireLigne_('Prieres', { id: 'v', cree_le: new Date(Date.now() - 200 * 86400000).toISOString(), auteur: 'cpt:a', texte: 'vieille', statut: 'publiee', priants: '[]', signalements: '[]' });
T.entretienPrieres_(); T.oublierLignes_();
verif(!T.lignes_('Prieres').some(x => x.id === 'v'), 'effacée après 6 mois');
console.log(ok + ' vérifications réussies, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
