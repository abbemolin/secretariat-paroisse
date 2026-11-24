// node tests/test-sacrements.js — demandes de sacrements, suivi, acte de baptême, dons (services simulés)
const { SS, props } = require('./mocks.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'backend');
vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') +
  ';globalThis.__t={doPost,FEUILLES,hacher_,ecrireLigne_,actionCompte_,lignes_,nouvelleSessionCpt_,oublierLignes_,lienEspace_};');
const T = globalThis.__t;
let ok = 0, ko = 0; const verif = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', m); } };
const err = (f, re, m) => { try { f(); ko++; console.log('ÉCHEC (pas d\'erreur) :', m); } catch (e) { if (re.test(e.message)) ok++; else { ko++; console.log('ÉCHEC :', m, '→', e.message); } } };
const post = (action, payload, token) => JSON.parse(T.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).t);
Object.keys(T.FEUILLES).forEach(n => SS.insertSheet(n).appendRow(T.FEUILLES[n]));
['cure', 'sec'].forEach((r, i) => T.ecrireLigne_('Utilisateurs', { id: r, identifiant: r, nom: r, role: i ? 'secretaire' : 'cure', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true' }));
vm.runInThisContext('feuilleComptes_()');
T.ecrireLigne_('Comptes', { id: 'j1', mail: 'jean@ex.fr', prenom: 'Jean', nom: 'Dupont', telephone: '0611223344', adresse: '1 rue A', statut: 'actif', sel: 's', hash: 'h', session_v: 0 });
const cs = T.nouvelleSessionCpt_(T.lignes_('Comptes')[0]);
// Baptême d'un enfant
err(() => T.actionCompte_('cpt.sacrement', { cs, type: 'bapteme', champs: { enfant_prenoms: 'Lucie', enfant_nom: 'Dupont', enfant_naissance_date: '2026-09-01' } }), /parents/, 'au moins un parent');
T.actionCompte_('cpt.sacrement', { cs, type: 'bapteme', champs: { enfant_prenoms: 'Lucie', enfant_nom: 'Dupont', enfant_naissance_date: '2026-09-01', pere_nom: 'Dupont', email: 'pirate@ex.fr' } });
T.oublierLignes_();
const d = T.lignes_('Dossiers').find(x => x.type === 'bapteme');
const inf = JSON.parse(d.donnees).infos;
verif(d && d.email === 'jean@ex.fr' && inf.telephone === '0611223344' && inf.adresse === '1 rue A' && d.source === 'App des paroissiens', 'dossier créé avec les coordonnées du compte (adresse du compte imposée)');
verif(JSON.parse(d.donnees).historique.some(h => /depuis l'app/.test(h.texte)), 'historique : demande depuis l\'app');
verif(T.lignes_('Notifications').filter(n => /Nouvelle demande : Baptême/.test(n.titre)).length === 2, 'équipe prévenue');
err(() => T.actionCompte_('cpt.sacrement', { cs, type: 'obseques', champs: {} }), /inconnue/, 'type non proposé refusé');
T.actionCompte_('cpt.sacrement', { cs, type: 'catechumene', champs: { message: 'Bonjour' } });
T.oublierLignes_();
const cat = T.lignes_('Dossiers').find(x => x.type === 'catechumene');
verif(cat && JSON.parse(cat.donnees).infos.prenoms === 'Jean', 'catéchumène : prénom et nom du compte');
// Suivi
let dossierB = T.lignes_('Dossiers').find(x => x.type === 'bapteme'); const don = JSON.parse(dossierB.donnees);
don.etapes = { recue: { fait: true, date: '2026-11-20T10:00:00Z' }, contact: { fait: true, date: '2026-11-22T10:00:00Z' } }; don.notes = 'note interne secrète'; dossierB.donnees = JSON.stringify(don); T.ecrireLigne_('Dossiers', dossierB);
const s = T.actionCompte_('cpt.dossiers', { cs });
const sb = s.dossiers.find(x => x.type === 'Baptême');
verif(sb && sb.qui === 'Lucie Dupont' && sb.etapes.filter(e => e.fait).length === 2 && sb.prochaine === 'Rencontre de préparation', 'suivi : étapes faites et prochaine');
verif(!JSON.stringify(s).includes('secrète'), 'pas de notes internes');
verif(s.dossiers.length === 2, 'deux demandes suivies');
// Espace du catéchumène relié au compte quand la paroisse l'ouvre
const tokC = post('auth.login', { identifiant: 'cure', motdepasse: 'motdepasse' }).data.token;
post('charte.accepter', {}, tokC);
post('espace.lien', { id: cat.id }, tokC);
T.oublierLignes_();
verif(T.lignes_('Comptes')[0].dossier_id === cat.id && T.lignes_('Espaces')[0].hash === 'h', 'espace ouvert par la paroisse : relié au compte, même mot de passe');
// Acte de baptême
err(() => T.actionCompte_('cpt.acteApp', { cs, prenoms: 'Lucie', nom: 'Dupont', naissance: '', motif: 'Mariage' }), /naissance/, 'date de naissance obligatoire');
err(() => T.actionCompte_('cpt.acteApp', { cs, prenoms: 'Lucie', nom: 'Dupont', naissance: '1990-01-01', motif: 'Rien' }), /motif/, 'motif obligatoire');
const a = T.actionCompte_('cpt.acteApp', { cs, pour: 'enfant', prenoms: 'Lucie', nom: 'Dupont', naissance: '1990-01-01', motif: 'Mariage', annee_bapteme: '1990' });
verif(a.actes.length === 1 && !a.actes[0].envoye_le, 'acte demandé, en préparation');
const ex = T.lignes_('Extraits')[0]; verif(ex && JSON.parse(ex.demande).email === 'jean@ex.fr' && JSON.parse(ex.valeurs).nom === 'DUPONT', 'demande rangée dans Extraits');
err(() => T.actionCompte_('cpt.acteApp', { cs, prenoms: 'Lucie', nom: 'Dupont', naissance: '1990-01-01', motif: 'Mariage' }), /déjà en cours/, 'pas deux demandes pour la même personne');
// Dons
const tokS = post('auth.login', { identifiant: 'sec', motdepasse: 'motdepasse' }).data.token; post('charte.accepter', {}, tokS);
verif(post('paroissiens.donsEcrire', { causes: [] }, tokS).code === 'INTERDIT', 'secrétaire : ne modifie pas les causes');
verif(post('paroissiens.donsEcrire', { causes: [{ titre: 'Chauffage', url: 'https://exemple.com/don' }] }, tokC).code === 'INVALIDE', 'lien non HelloAsso refusé');
post('paroissiens.donsEcrire', { causes: [{ titre: 'Chauffage', texte: 'Hiver', url: 'https://www.helloasso.com/associations/x/formulaires/10' }, { titre: 'Ancienne', url: 'https://www.helloasso.com/a', actif: false }] }, tokC);
const pub = JSON.parse(T.doPost({ postData: { contents: JSON.stringify({ action: 'public.dons' }) } }).t).data;
verif(pub.length === 1 && pub[0].titre === 'Chauffage', 'partie publique : causes actives seulement');
verif(T.actionCompte_('cpt.lire', { cs }).dons.length === 1, 'causes dans l\'espace du paroissien');
console.log(ok + ' vérifications réussies, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
