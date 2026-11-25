// node tests/test-contacts.js — onglet Contacts : synchronisation Google Contacts, import, foyers, liens automatiques, doublons, envois (services simulés)
const { SS, props } = require('./mocks.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'backend');

// ─── Google Contacts simulé (API People) ───
const G = { personnes: {}, groupes: {}, journal: [], n: 0, appels: 0 };
const copie = (x) => JSON.parse(JSON.stringify(x));
function toucher(rn) { G.journal.push(rn); const p = G.personnes[rn]; if (p) p.etag = 'e' + G.journal.length; }
function memb(p) { return (p.memberships || []).map((m) => m.contactGroupMembership.contactGroupResourceName); }
function nouvellePersonne(p) {
  const rn = 'people/c' + (++G.n);
  G.personnes[rn] = { ...copie(p), resourceName: rn, memberships: [{ contactGroupMembership: { contactGroupResourceName: 'contactGroups/myContacts' } }], metadata: { sources: [{ updateTime: new Date().toISOString() }] } };
  toucher(rn); return copie(G.personnes[rn]);
}
function majPersonne(p, rn) {
  const ex = G.personnes[rn]; if (!ex) throw new Error('404');
  if (p.etag && p.etag !== ex.etag) throw new Error('etag périmé');
  ['names', 'emailAddresses', 'phoneNumbers', 'addresses', 'organizations', 'biographies', 'userDefined'].forEach((k) => { ex[k] = copie(p[k] || []); });
  toucher(rn); return copie(ex);
}
global.People = {
  People: {
    Connections: {
      list(rn, o) {
        G.appels++;
        let rns;
        if (o.syncToken) {
          const depuis = Number(o.syncToken.slice(1));
          if (isNaN(depuis)) throw new Error('EXPIRED_SYNC_TOKEN');
          rns = [...new Set(G.journal.slice(depuis))];
        } else rns = Object.keys(G.personnes);
        const connections = rns.map((r) => G.personnes[r] ? copie(G.personnes[r]) : { resourceName: r, metadata: { deleted: true } });
        return { connections, nextSyncToken: 't' + G.journal.length };
      }
    },
    get(rn) { if (!G.personnes[rn]) throw new Error('404'); return copie(G.personnes[rn]); },
    createContact(p) { return nouvellePersonne(p); },
    updateContact(p, rn) { return majPersonne(p, rn); },
    deleteContact(rn) { delete G.personnes[rn]; Object.values(G.groupes).forEach((g) => { g.membres = g.membres.filter((x) => x !== rn); }); toucher(rn); },
    getBatchGet(o) { return { responses: o.resourceNames.map((r) => ({ person: G.personnes[r] ? copie(G.personnes[r]) : null })) }; },
    batchCreateContacts(o) { return { createdPeople: o.contacts.map((c) => ({ person: nouvellePersonne(c.contactPerson) })) }; },
    batchUpdateContacts(o) { const r = {}; Object.keys(o.contacts).forEach((rn) => { r[rn] = { person: majPersonne(o.contacts[rn], rn) }; }); return { updateResult: r }; }
  },
  ContactGroups: {
    list() { return { contactGroups: Object.values(G.groupes).map((g) => ({ resourceName: g.rn, name: g.nom, groupType: 'USER_CONTACT_GROUP', memberCount: g.membres.length })) }; },
    create(o) { const rn = 'contactGroups/g' + (++G.n); G.groupes[rn] = { rn, nom: o.contactGroup.name, membres: [], etag: 'x' }; return { resourceName: rn }; },
    get(rn) { return { resourceName: rn, etag: G.groupes[rn].etag, memberResourceNames: G.groupes[rn].membres }; },
    update(o, rn) { G.groupes[rn].nom = o.contactGroup.name; },
    delete(rn) { delete G.groupes[rn]; Object.values(G.personnes).forEach((p) => { p.memberships = (p.memberships || []).filter((m) => m.contactGroupMembership.contactGroupResourceName !== rn); }); },
    Members: {
      modify(o, rn) {
        const g = G.groupes[rn];
        (o.resourceNamesToAdd || []).forEach((r) => { if (!g.membres.includes(r)) g.membres.push(r); const p = G.personnes[r]; if (p && !memb(p).includes(rn)) p.memberships.push({ contactGroupMembership: { contactGroupResourceName: rn } }); toucher(r); });
        (o.resourceNamesToRemove || []).forEach((r) => { g.membres = g.membres.filter((x) => x !== r); const p = G.personnes[r]; if (p) p.memberships = p.memberships.filter((m) => m.contactGroupMembership.contactGroupResourceName !== rn); toucher(r); });
      }
    }
  }
};
global.ScriptApp = { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyHours: () => ({ create() {} }), everyDays: () => ({ atHour: () => ({ inTimezone: () => ({ create() {} }) }) }), everyMinutes: () => ({ create() {} }) }) }) };
global.Utilities.sleep = () => {};
const brevo = [];
global.UrlFetchApp.fetch = function (url, o) {
  o = o || {}; brevo.push({ url, methode: o.method || 'get', corps: o.payload ? JSON.parse(o.payload) : null });
  const rep = (x) => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(x) });
  if (/folders/.test(url) && (o.method || 'get') === 'get') return rep({ folders: [] });
  if (/folders$/.test(url)) return rep({ id: 7 });
  if (/lists$/.test(url)) return rep({ id: 42 });
  if (/import$/.test(url)) return rep({ processId: 5 });
  if (/processes/.test(url)) return rep({ status: 'completed' });
  if (/emailCampaigns$/.test(url)) return rep({ id: 99 });
  return rep({});
};

vm.runInThisContext(fs.readdirSync(dir).filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') +
  ';globalThis.__t={doPost,FEUILLES,hacher_,ecrireLigne_,lignes_,oublierLignes_,corReglages_,ecrireCorReglages_,contactsAutomatique_,oublierContacts_};');
const T = globalThis.__t;
let ok = 0, ko = 0; const verif = (c, m) => { if (c) ok++; else { ko++; console.log('ÉCHEC :', m); } };
const post = (action, payload, token) => JSON.parse(T.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).t);
const appel = (action, payload) => { CacheServiceVider(); const r = post(action, payload, tok); if (!r.ok) throw new Error(action + ' : ' + r.message); return r.data; };
const CacheServiceVider = () => { const c = CacheService.getScriptCache(); c.remove('contacts_sync'); c.remove('charte_sec'); };
Object.keys(T.FEUILLES).forEach(n => SS.insertSheet(n).appendRow(T.FEUILLES[n]));
props.BREVO_CLE = 'cle';
T.ecrireLigne_('Utilisateurs', { id: 'sec', identifiant: 'sec', nom: 'sec', role: 'secretaire', sel: 's', hash: T.hacher_('motdepasse', 's'), actif: 'true' });
props.CHARTES_EQUIPE = JSON.stringify({ sec: new Date().toISOString() });
const tok = post('auth.login', { identifiant: 'sec', motdepasse: 'motdepasse' }).data.token;
vm.runInThisContext('feuilleComptes_(); feuilleCor_(); feuillesRetraites_(); feuilleCate_()');

// ─── 1. Contacts déjà dans Google ───
nouvellePersonne({ names: [{ givenName: 'Paul', familyName: 'Martin' }], emailAddresses: [{ value: 'paul@ex.fr' }], phoneNumbers: [{ value: '06 11 11 11 11' }] });
nouvellePersonne({ names: [{ givenName: 'Lucie', familyName: 'Durand' }], phoneNumbers: [{ value: '03 88 00 00 01' }], addresses: [{ formattedValue: '3 rue Haute, Strasbourg' }] });
let l = appel('contacts.liste', {});
verif(l.contacts.length === 2, 'liste initiale : 2 contacts');
verif(l.contacts.find((c) => c.prenom === 'Lucie'), 'Lucie lue');

// ─── 2. Import (aperçu puis réel) ───
const lignes = [
  { prenom: 'Paul', nom: 'Martin', emails: ['PAUL@ex.fr'], tels: ['+33 6 22 22 22 22'], adresse: { rue: '1 rue A', cp: '67000', ville: 'STRASBOURG' }, origine: 'Import : csv_simple' },   // fusion
  { prenom: 'Régis', nom: 'Anthonioz', emails: ['regis@ex.fr'], tels: ['06 65 53 38 06'], foyer: 'k1', origine: 'Import' },
  { prenom: 'Charlotte', nom: 'Anthonioz', emails: ['charlotte@ex.fr'], tels: ['06 71 92 43 93'], foyer: 'k1', origine: 'Import' },
  { prenom: 'Lucie', nom: 'Durand', tels: ['0388000001'], origine: 'Import' }   // identique
];
const ap = appel('contacts.importer', { lignes, essai: true });
verif(ap.nouveaux === 2 && ap.fusions.length === 1 && ap.identiques === 1, 'aperçu import : ' + JSON.stringify(ap));
verif(Object.keys(G.personnes).length === 2, 'aperçu : rien écrit dans Google');
const im = appel('contacts.importer', { lignes });
verif(im.crees === 2 && im.completes === 1, 'import : ' + JSON.stringify(im));
l = appel('contacts.liste', {});
verif(l.contacts.length === 4, 'après import : 4 contacts');
const paul = l.contacts.find((c) => c.prenom === 'Paul');
verif(paul.tels.length === 2 && paul.ville === 'STRASBOURG', 'Paul complété (2e téléphone, adresse) ' + JSON.stringify(paul));
const regis = l.contacts.find((c) => c.prenom === 'Régis'), charlotte = l.contacts.find((c) => c.prenom === 'Charlotte');
verif(regis.foyer && regis.foyer === charlotte.foyer, 'couple : même foyer');
let fiche = appel('contacts.lire', { id: regis.id });
verif(fiche.foyer_membres.length === 1 && fiche.foyer_membres[0].prenom === 'Charlotte', 'fiche : membre du foyer');
const lucie = l.contacts.find((c) => c.prenom === 'Lucie');
verif(appel('contacts.lire', { id: lucie.id }).adresse.rue === '3 rue Haute, Strasbourg', 'adresse non structurée gardée');

// ─── 3. Fiche : modification avec adresse commune au foyer ───
fiche = appel('contacts.ecrire', { id: regis.id, prenom: 'Régis', nom: 'Anthonioz', emails: ['regis@ex.fr'], tels: ['06 65 53 38 06'], adresse: { rue: '5 quai Kléber', cp: '67000', ville: 'Strasbourg' }, adresseFoyer: true, note: 'Chorale' });
verif(fiche.note === 'Chorale' && fiche.foyer === regis.foyer, 'fiche modifiée, foyer gardé');
verif(appel('contacts.lire', { id: charlotte.id }).adresse.rue === '5 quai Kléber', 'adresse recopiée au foyer');
// modification faite dans Google : vue par l'appli (synchronisation incrémentale)
majPersonne({ ...G.personnes['people/' + lucie.id], names: [{ givenName: 'Lucie', familyName: 'Durand-Klein' }] }, 'people/' + lucie.id);
verif(appel('contacts.liste', {}).contacts.find((c) => c.id === lucie.id).nom === 'Durand-Klein', 'modification faite dans Google visible');

// ─── 4. Liens automatiques ───
T.ecrireLigne_('Dossiers', { id: 'd1', type: 'bapteme', etat: 'ouvert', cree_le: '2026-10-01T10:00:00Z', nom: 'Léa MOREL', email: 'sophie.morel@ex.fr', telephone: '0612345678', date_celebration: '2027-03-14',
  donnees: JSON.stringify({ infos: { enfant_nom: 'Morel', mere_prenom: 'Sophie', mere_nom_jeune_fille: 'Lang', pere_prenom: 'Marc', pere_nom: 'Morel' } }) });
T.ecrireLigne_('Dossiers', { id: 'd2', type: 'obseques', etat: 'ouvert', cree_le: '2026-10-02T10:00:00Z', nom: 'X', email: 'famille@ex.fr', telephone: '', donnees: '{}' });
T.ecrireLigne_('Dossiers', { id: 'd3', type: 'catechumene', etat: 'ouvert', cree_le: '2026-10-02T10:00:00Z', nom: 'Jean DUPUIS', email: 'jean@ex.fr', telephone: '', donnees: JSON.stringify({ infos: { prenoms: 'Jean', nom: 'Dupuis', annee_sacrements: '2027' } }) });
T.ecrireLigne_('Catechisme', { id: 'k1', annee: '2026-2027', nom: 'Morel', prenoms: 'Tom', groupe: 'CE1-CE2', email: 'sophie.morel@ex.fr', telephone: '0612345678', pere: 'Morel Marc', mere: 'Lang Sophie' });
T.ecrireLigne_('CorUnum', { id: 'cu1', annee: '2026-2027', nom: 'Martin', prenoms: 'Paul', email: 'paul@ex.fr', telephone: '', equipe_id: 'eq1', statut: '' });
const r = T.corReglages_(); r.equipes['2026-2027'] = [{ id: 'eq1', nom: 'Martin', chefs: ['cu1'] }]; T.ecrireCorReglages_(r);
let auto = appel('contacts.auto', {});
verif(auto.crees === 2, 'auto : 2 contacts créés (parent du baptême, catéchumène ; pas les obsèques) : ' + JSON.stringify(auto));
l = appel('contacts.liste', {});
const sophie = l.contacts.find((c) => c.prenom === 'Sophie');
verif(sophie && sophie.nom === 'Lang', 'parent reconnu par le prénom dans l\'adresse');
verif(!l.contacts.some((c) => c.emails.includes('famille@ex.fr')), 'obsèques : aucun contact');
const nomGroupes = (c) => c.groupes.map((g) => l.groupes.find((x) => x.id === g)?.nom).sort();
verif(JSON.stringify(nomGroupes(sophie)) === JSON.stringify(['Baptêmes 2027', 'Catéchisme 2026-2027 – CE1-CE2']), 'groupes de Sophie : ' + nomGroupes(sophie));
verif(JSON.stringify(nomGroupes(l.contacts.find((c) => c.prenom === 'Paul'))) === JSON.stringify(['Chefs Cor Unum 2026-2027', 'Cor Unum 2026-2027 – Martin']), 'groupes Cor Unum de Paul');
verif(l.groupes.filter((g) => g.auto).length === 5, 'groupes automatiques : ' + l.groupes.map((g) => g.nom));
fiche = appel('contacts.lire', { id: sophie.id });
verif(fiche.liens.some((x) => x.sorte === 'Dossier') && fiche.liens.some((x) => x.sorte === 'Catéchisme'), 'fiche : dossier et catéchisme reliés');
// un groupe automatique ne se modifie pas à la main
const gAuto = l.groupes.find((g) => g.auto);
verif(post('contacts.groupe', { action: 'renommer', id: gAuto.id, nom: 'x' }, tok).ok === false, 'groupe automatique protégé');
// le membre quitte la fraternité : retiré du groupe ; le groupe des chefs vide disparaît
T.oublierLignes_(); const cu = T.lignes_('CorUnum')[0]; cu.statut = 'ancien'; T.ecrireLigne_('CorUnum', cu);
appel('contacts.auto', {});
l = appel('contacts.liste', {});
verif(nomGroupes(l.contacts.find((c) => c.prenom === 'Paul')).length === 0, 'ancien membre retiré des groupes Cor Unum ' + nomGroupes(l.contacts.find((c) => c.prenom === 'Paul')));
verif(!l.groupes.some((g) => g.nom === 'Chefs Cor Unum 2026-2027'), 'groupe automatique vide supprimé');
// contact supprimé à la main : pas recréé
appel('contacts.supprimer', { id: sophie.id });
auto = appel('contacts.auto', {});
verif(auto.crees === 0 && !appel('contacts.liste', {}).contacts.some((c) => c.prenom === 'Sophie'), 'contact supprimé non recréé');

// ─── 5. Doublons et fusion ───
nouvellePersonne({ names: [{ givenName: 'Martin', familyName: 'Paul' }], phoneNumbers: [{ value: '0611111111' }], emailAddresses: [{ value: 'p.martin@ex.fr' }] });
const dbl = appel('contacts.doublons', {});
const paire = dbl.find((x) => [x.a.prenom, x.b.prenom].sort().join() === 'Martin,Paul');
verif(paire && paire.raisons.includes('même téléphone') && paire.raisons.includes('même nom'), 'doublon trouvé (téléphone, nom inversé) : ' + JSON.stringify(paire && paire.raisons));
const garder = paire.a.prenom === 'Paul' ? paire.a : paire.b, retirer = garder === paire.a ? paire.b : paire.a;
fiche = appel('contacts.fusionner', { garder: garder.id, retirer: retirer.id });
verif(fiche.emails.includes('p.martin@ex.fr') && !G.personnes['people/' + retirer.id], 'fusion : e-mail repris, doublon supprimé');
verif(!appel('contacts.doublons', {}).some((x) => x.a.id === retirer.id || x.b.id === retirer.id), 'plus de doublon');

// ─── 6. Groupes manuels et envois ───
let gs = appel('contacts.groupe', { action: 'creer', nom: 'Chorale', ids: [regis.id, charlotte.id] });
const chorale = gs.find((g) => g.nom === 'Chorale');
verif(chorale && chorale.nb === 2 && !chorale.auto, 'groupe manuel créé avec 2 membres');
global.mails.length = 0;
const essai = appel('contacts.envoyer', { groupe: chorale.id, sujet: 'Répétition', corps: 'Bonjour', signature: 'paroisse', essai: true });
verif(essai.nb === 2 && essai.canal === 'gmail' && global.mails.length === 0, 'essai : 2 adresses, Gmail, rien envoyé');
appel('contacts.envoyer', { groupe: chorale.id, sujet: 'Répétition', corps: 'Bonjour', signature: 'paroisse' });
verif(global.mails.length === 1, 'envoi Gmail');
// plus de 100 : Brevo
const grand = [];
for (let i = 0; i < 120; i++) grand.push({ prenom: 'P' + i, nom: 'Test', emails: ['p' + i + '@ex.fr'], origine: 'Import' });
appel('contacts.importer', { lignes: grand });
const ids = appel('contacts.liste', {}).contacts.filter((c) => c.nom === 'Test').map((c) => c.id);
verif(ids.length === 120, '120 contacts importés');
verif(appel('contacts.envoyer', { ids, sujet: 'Grand envoi', corps: 'Bonjour', essai: true }).canal === 'brevo', 'au-delà de 100 : Brevo');
verif(post('contacts.envoyer', { ids, sujet: 'x', corps: 'y', fichiers: [{ nom: 'a.pdf', base64: '' }] }, tok).ok === false, 'Brevo : pas de pièce jointe');
const rb = appel('contacts.envoyer', { ids, sujet: 'Grand envoi', corps: 'Bonjour', signature: 'paroisse' });
const camp = brevo.find((x) => /emailCampaigns$/.test(x.url));
verif(rb.canal === 'brevo' && camp && camp.corps.sender.email === 'secretariat@croix-glorieuse.org' && brevo.some((x) => /sendNow/.test(x.url)), 'campagne Brevo envoyée depuis secretariat@');
verif(brevo.find((x) => /import$/.test(x.url)).corps.jsonBody.length === 120, 'liste Brevo de 120 adresses');
// ancienne route du Courrier
verif(post('mail.groupes', {}, tok).data.some((g) => g.nom === 'Chorale'), 'mail.groupes : groupes de contacts');

// ─── 7. Courrier : contacts reconnus ───
vm.runInThisContext('globalThis.__c = contactsDesAdresses_');
const reco = globalThis.__c(['"Régis" <regis@ex.fr>', 'inconnu@ex.fr']);
verif(reco.length === 1 && reco[0].id === regis.id, 'expéditeur reconnu dans le Courrier');

// ─── 8. Synchronisation complète si le jeton a expiré ───
props.CONTACTS_SYNC = 'expire';
verif(appel('contacts.liste', {}).contacts.length === Object.keys(G.personnes).length, 'jeton expiré : relecture complète');

console.log(`${ok} vérifications réussies, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
