/**
 * Contacts de la paroisse — Google Contacts du compte paroisse, lus et modifiés dans les deux sens (service avancé People).
 *
 *  - Google Contacts fait foi. La feuille « Contacts » n'en est qu'un miroir (recherche rapide, liens avec le reste de l'appli),
 *    tenu à jour par synchronisation incrémentale (jeton de synchronisation de l'API People).
 *  - Foyer et origine d'un contact sont rangés dans Google (champs personnalisés « Foyer » et « Origine ») : rien ne se perd
 *    si le miroir est reconstruit.
 *  - Liens automatiques : dossiers (sauf obsèques), catéchisme, Cor Unum, retraites, app des paroissiens. Toutes les heures
 *    (et sur demande), une personne qui y apparaît avec un e-mail ou un téléphone devient un contact, et les groupes
 *    automatiques (catéchisme, Cor Unum, catéchuménat, familles des dossiers) sont mis à jour.
 *    Un contact supprimé à la main n'est jamais recréé.
 *  - Envois groupés : jusqu'à 100 destinataires par Gmail (alias secretariat@), au-delà par Brevo.
 *  - Import du tableau nettoyé (Contacts → Importer) : fusion avec les contacts existants (même e-mail ou même téléphone).
 *  - Doublons probables (même e-mail, même téléphone, nom identique ou inversé) : fusion en un clic.
 *  - RGPD : pas de durée limite ; effacement à la demande (supprimer le contact).
 */

var COLONNES_CONTACTS = ['id', 'resource', 'etag', 'prenom', 'nom', 'civilite', 'organisation', 'emails', 'tels', 'adresse',
  'groupes', 'foyer', 'origine', 'note', 'maj_le'];
var CHAMPS_PEOPLE = 'names,emailAddresses,phoneNumbers,addresses,organizations,memberships,userDefined,biographies,metadata';
var CHAMPS_MAJ_PEOPLE = 'names,emailAddresses,phoneNumbers,addresses,organizations,biographies,userDefined';
var GROUPES_SYSTEME_ = ['myContacts', 'starred', 'friends', 'family', 'coworkers', 'chatBuddies', 'all', 'blocked'];
var ENVOI_GMAIL_MAX = 100;
var CONTACTS_ = null;   // miroir lu une fois par exécution

// ─── Outils propres à ce fichier (copies : Contacts.gs ne dépend pas des autres modules pour comparer noms et coordonnées) ───
function sansAccentsC_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function chiffresC_(t) { return String(t || '').replace(/\D/g, '').replace(/^33/, '0').slice(-9); }
function simpleC_(t) { return sansAccentsC_(t).replace(/[^a-z]/g, ''); }
function normMailC_(m) { m = String(m || '').trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m) ? m : ''; }
function cleNomC_(t) { return sansAccentsC_(t).replace(/[^a-z]/g, ''); }
function motsNomC_(t) { return sansAccentsC_(t).replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(function (m) { return m.length > 1 && ['et', 'de', 'du', 'la', 'le'].indexOf(m) === -1; }); }
function levenshteinC_(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 9;
  var d = [], i, j;
  for (i = 0; i <= a.length; i++) d[i] = [i];
  for (j = 0; j <= b.length; j++) d[0][j] = j;
  for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function memeNomC_(a, b) { var x = cleNomC_(a), y = cleNomC_(b); return !!x && !!y && (x === y || (x.length > 4 && levenshteinC_(x, y) <= 1)); }
function prenomCommunC_(a, b) {
  var x = motsNomC_(a), y = motsNomC_(b);
  return x.some(function (m) { return y.some(function (n) { return m === n || (m.length > 4 && levenshteinC_(m, n) <= 1); }); });
}
/** « Heller David » → { nom: 'Heller', prenom: 'David' } (le prénom est le dernier mot). */
function separerNomPrenomC_(t) {
  var mots = String(t || '').trim().split(/\s+/).filter(String);
  if (mots.length < 2) return { nom: mots[0] || '', prenom: '' };
  return { prenom: mots.pop(), nom: mots.join(' ') };
}
function existe_(nom) { try { return typeof globalThis[nom] === 'function'; } catch (e) { return false; } }

// ─────────────────────────────── MIROIR ───────────────────────────────

function feuilleContacts_() {
  var f = db_().getSheetByName('Contacts');
  if (!f) { f = db_().insertSheet('Contacts'); f.getRange('A:Z').setNumberFormat('@'); f.appendRow(COLONNES_CONTACTS); f.setFrozenRows(1); }
  return f;
}
function idContact_(rn) { return String(rn || '').replace(/^people\//, ''); }
function rnContact_(id) { id = String(id || ''); return /^people\//.test(id) ? id : 'people/' + id; }
function groupeUtilisateur_(rn) { var k = String(rn || '').replace(/^contactGroups\//, ''); return !!k && GROUPES_SYSTEME_.indexOf(k) === -1; }
function telCle_(t) { var c = chiffresC_(t); return c.length === 9 ? c : ''; }

/** Personne de l'API People → ligne de la feuille. */
function ligneDepuisPersonne_(pe) {
  var n = (pe.names || [])[0] || {}, ud = {}, a = (pe.addresses || [])[0];
  (pe.userDefined || []).forEach(function (u) { ud[u.key] = u.value; });
  var maj = ((pe.metadata && pe.metadata.sources) || []).map(function (x) { return x.updateTime || ''; }).sort().pop() || '';
  return {
    id: idContact_(pe.resourceName), resource: pe.resourceName, etag: pe.etag || '',
    prenom: n.givenName || '', nom: n.familyName || (!n.givenName ? n.displayName || '' : ''), civilite: n.honorificPrefix || '',
    organisation: ((pe.organizations || [])[0] || {}).name || '',
    emails: JSON.stringify((pe.emailAddresses || []).map(function (e) { return e.value; }).filter(String)),
    tels: JSON.stringify((pe.phoneNumbers || []).map(function (t) { return t.value; }).filter(String)),
    adresse: a ? JSON.stringify({ rue: a.streetAddress || (!a.city && !a.postalCode ? a.formattedValue || '' : ''), cp: a.postalCode || '', ville: a.city || '', pays: a.country || '', texte: a.formattedValue || '' }) : '',
    groupes: JSON.stringify((pe.memberships || []).map(function (m) { return (m.contactGroupMembership || {}).contactGroupResourceName; }).filter(groupeUtilisateur_)),
    foyer: ud.Foyer || '', origine: ud.Origine || '', note: ((pe.biographies || [])[0] || {}).value || '', maj_le: maj
  };
}
function contactDepuisLigne_(r) {
  return {
    id: String(r.id), resource: r.resource, etag: r.etag, prenom: String(r.prenom || ''), nom: String(r.nom || ''), civilite: String(r.civilite || ''),
    organisation: String(r.organisation || ''), emails: json2_(r.emails, []), tels: json2_(r.tels, []), adresse: json2_(r.adresse, null),
    groupes: json2_(r.groupes, []), foyer: String(r.foyer || ''), origine: String(r.origine || ''), note: String(r.note || ''), maj_le: String(r.maj_le || '')
  };
}
/** Tout le miroir (objets). */
function contactsMiroir_() {
  if (CONTACTS_) return CONTACTS_;
  feuilleContacts_();
  CONTACTS_ = lignes_('Contacts').map(contactDepuisLigne_);
  return CONTACTS_;
}
function oublierContacts_() { CONTACTS_ = null; oublierLignes_('Contacts'); }

/** Réécrit toute la feuille (≈ 1 000 lignes : une seule écriture). */
function ecrireMiroir_(lignes) {
  var f = feuilleContacts_();
  var ent0 = f.getRange(1, 1, 1, f.getLastColumn()).getValues()[0];
  var manque = COLONNES_CONTACTS.filter(function (c) { return ent0.indexOf(c) === -1; });
  if (manque.length) f.getRange(1, ent0.length + 1, 1, manque.length).setValues([manque]);
  var ent = f.getRange(1, 1, 1, f.getLastColumn()).getValues()[0];
  var n = f.getLastRow();
  if (n > 1) f.getRange(2, 1, n - 1, ent.length).clearContent();
  lignes.sort(function (a, b) { return (cleTri_(a)).localeCompare(cleTri_(b)); });
  if (lignes.length) {
    var v = lignes.map(function (o) { return ent.map(function (h) { var x = o[h]; return x == null ? '' : typeof x === 'object' ? JSON.stringify(x) : String(x); }); });
    f.getRange(2, 1, v.length, ent.length).setNumberFormat('@').setValues(v);
  }
  oublierContacts_();
}
function cleTri_(o) { return sansAccentsC_((o.nom || o.organisation || '') + ' ' + (o.prenom || '')); }

/** Lignes brutes (format feuille) indexées par id. */
function miroirBrut_() {
  feuilleContacts_();
  var m = {};
  lignes_('Contacts').forEach(function (r) { var o = {}; COLONNES_CONTACTS.forEach(function (k) { o[k] = r[k]; }); m[String(r.id)] = o; });
  return m;
}
/** Met à jour le miroir après une écriture dans Google (personnes renvoyées par l'API, ids supprimés). */
function miroirMaj_(personnes, supprimes) {
  verrou_(function () {
    var m = miroirBrut_();
    (personnes || []).forEach(function (pe) { if (pe && pe.resourceName) m[idContact_(pe.resourceName)] = ligneDepuisPersonne_(pe); });
    (supprimes || []).forEach(function (id) { delete m[idContact_(id)]; });
    ecrireMiroir_(Object.keys(m).map(function (k) { return m[k]; }));
  });
}

/**
 * Synchronisation avec Google Contacts : incrémentale (jeton), complète la première fois ou si le jeton a expiré (7 jours).
 * Au plus une fois toutes les 30 s, sauf o.forcer.
 */
function syncContacts_(o) {
  o = o || {};
  var cache = CacheService.getScriptCache();
  if (!o.forcer && !o.complet && cache.get('contacts_sync')) return;
  var P = proprietesReelles_();
  var jeton = o.complet ? null : P.getProperty('CONTACTS_SYNC');
  var res = lireConnexions_(jeton);
  if (!res) { jeton = null; res = lireConnexions_(null); }
  var vus = [];
  verrou_(function () {
    var m = jeton ? miroirBrut_() : {};
    res.personnes.forEach(function (pe) {
      var id = idContact_(pe.resourceName);
      if (pe.metadata && pe.metadata.deleted) delete m[id];
      else { m[id] = ligneDepuisPersonne_(pe); vus.push(contactDepuisLigne_(m[id])); }
    });
    if (!jeton || res.personnes.length) ecrireMiroir_(Object.keys(m).map(function (k) { return m[k]; }));
  });
  if (res.jeton) P.setProperty('CONTACTS_SYNC', res.jeton);
  memoriserVus_(vus);   // toute coordonnée passée par Google Contacts : un contact supprimé ensuite ne sera pas recréé
  if (!jeton || res.personnes.length || !props_().getProperty('CONTACTS_GROUPES')) lireGroupesGoogle_();
  cache.put('contacts_sync', '1', 30);
}
function lireConnexions_(jeton) {
  var tout = [], page = null, suivant = null;
  do {
    var opt = { pageSize: 1000, personFields: CHAMPS_PEOPLE, requestSyncToken: true };
    if (jeton) opt.syncToken = jeton;
    if (page) opt.pageToken = page;
    var r;
    try { r = People.People.Connections.list('people/me', opt); }
    catch (e) { if (jeton) return null; throw erreurPeople_(e); }   // jeton expiré : synchronisation complète
    tout = tout.concat(r.connections || []);
    page = r.nextPageToken;
    suivant = r.nextSyncToken || suivant;
  } while (page);
  return { personnes: tout, jeton: suivant };
}
function erreurPeople_(e) {
  var m = String(e && e.message || e);
  if (/insufficient|scope|permission|PERMISSION_DENIED/i.test(m)) return erreur_('CONTACTS', 'Le serveur n\'a pas le droit de modifier Google Contacts : dans l\'éditeur Apps Script, lancez une fois la fonction autoriserContacts, acceptez, puis redéployez.');
  return erreur_('CONTACTS', 'Google Contacts : ' + m.slice(0, 300));
}

// ─────────────────────────────── GROUPES ───────────────────────────────

function lireGroupesGoogle_() {
  var r = People.ContactGroups.list({ pageSize: 1000, groupFields: 'name,groupType,memberCount' });
  var l = (r.contactGroups || []).filter(function (g) { return g.groupType === 'USER_CONTACT_GROUP'; })
    .map(function (g) { return { id: g.resourceName, nom: g.name, nb: g.memberCount || 0 }; });
  props_().setProperty('CONTACTS_GROUPES', JSON.stringify(l));
  return l;
}
function groupesAuto_() { return json2_(props_().getProperty('CONTACTS_AUTO'), {}); }   // { nom : resourceName }
/** Groupes (avec le nombre de membres d'après le miroir, et la marque « automatique »). */
function groupesContacts_() {
  var l = json2_(props_().getProperty('CONTACTS_GROUPES'), null) || lireGroupesGoogle_();
  var auto = {}, ga = groupesAuto_();
  Object.keys(ga).forEach(function (k) { auto[ga[k]] = true; });
  var nb = {};
  contactsMiroir_().forEach(function (c) { c.groupes.forEach(function (g) { nb[g] = (nb[g] || 0) + 1; }); });
  return l.map(function (g) { return { id: g.id, nom: g.nom, nb: nb[g.id] || 0, auto: !!auto[g.id] }; })
    .sort(function (a, b) { return (a.auto - b.auto) || a.nom.localeCompare(b.nom); });
}
/** Ancienne route du Courrier (envois groupés). */
function listerGroupesContacts_() { syncContacts_(); return groupesContacts_(); }

function creerGroupeGoogle_(nom) {
  var g = People.ContactGroups.create({ contactGroup: { name: nom } });
  props_().deleteProperty('CONTACTS_GROUPES');
  return g.resourceName;
}
/** acc (facultatif) : changements gardés pour une seule réécriture du miroir (appliquerMembres_). */
function modifierMembres_(groupe, ajouter, retirer, acc) {
  ajouter = (ajouter || []).map(rnContact_); retirer = (retirer || []).map(rnContact_);
  for (var i = 0; i < Math.max(ajouter.length, retirer.length); i += 500) {
    var corps = {};
    if (ajouter.slice(i, i + 500).length) corps.resourceNamesToAdd = ajouter.slice(i, i + 500);
    if (retirer.slice(i, i + 500).length) corps.resourceNamesToRemove = retirer.slice(i, i + 500);
    People.ContactGroups.Members.modify(corps, groupe);
  }
  // miroir : groupes des contacts touchés
  if (!ajouter.length && !retirer.length) return;
  var x = acc || [];
  x.push({ groupe: groupe, ajouter: ajouter.map(idContact_), retirer: retirer.map(idContact_) });
  if (!acc) appliquerMembres_(x);
}
function appliquerMembres_(changements) {
  if (!changements.length) return;
  verrou_(function () {
    var m = miroirBrut_();
    changements.forEach(function (ch) {
      ch.retirer.concat(ch.ajouter).forEach(function (id) {
        if (!m[id]) return;
        var g = json2_(m[id].groupes, []).filter(function (x) { return x !== ch.groupe; });
        if (ch.ajouter.indexOf(id) > -1) g.push(ch.groupe);
        m[id].groupes = JSON.stringify(g);
      });
    });
    ecrireMiroir_(Object.keys(m).map(function (k) { return m[k]; }));
  });
  props_().deleteProperty('CONTACTS_GROUPES');
}

function groupeRoute_(p, s) {
  var auto = groupesAuto_(), estAuto = Object.keys(auto).some(function (k) { return auto[k] === p.id; });
  var nomOk = function () { var n = String(p.nom || '').trim().slice(0, 80); if (!n) throw erreur_('INVALIDE', 'Nom du groupe manquant.'); return n; };
  if (p.action === 'creer') {
    var nom = nomOk();
    if (groupesContacts_().some(function (g) { return g.nom.toLowerCase() === nom.toLowerCase(); })) throw erreur_('INVALIDE', 'Ce groupe existe déjà.');
    var rn = creerGroupeGoogle_(nom);
    if ((p.ids || []).length) modifierMembres_(rn, p.ids, []);
    journaliser_(s, 'Contacts : groupe créé', nom);
  } else {
    if (!/^contactGroups\//.test(String(p.id || ''))) throw erreur_('INVALIDE', 'Groupe inconnu.');
    if (estAuto) throw erreur_('INVALIDE', 'Ce groupe est tenu à jour automatiquement par l\'appli : il ne se modifie pas à la main.');
    if (p.action === 'renommer') {
      var g = People.ContactGroups.get(p.id, { maxMembers: 0 });
      People.ContactGroups.update({ contactGroup: { name: nomOk(), etag: g.etag } }, p.id);
      journaliser_(s, 'Contacts : groupe renommé', p.nom);
    } else if (p.action === 'supprimer') {
      People.ContactGroups.remove(p.id, { deleteContacts: false });
      verrou_(function () {
        var m = miroirBrut_();
        Object.keys(m).forEach(function (id) { m[id].groupes = JSON.stringify(json2_(m[id].groupes, []).filter(function (x) { return x !== p.id; })); });
        ecrireMiroir_(Object.keys(m).map(function (k) { return m[k]; }));
      });
      journaliser_(s, 'Contacts : groupe supprimé', '');
    } else if (p.action === 'ajouter' || p.action === 'retirer') {
      modifierMembres_(p.id, p.action === 'ajouter' ? p.ids : [], p.action === 'retirer' ? p.ids : []);
    } else throw erreur_('INVALIDE', 'Action inconnue.');
  }
  props_().deleteProperty('CONTACTS_GROUPES');
  lireGroupesGoogle_();
  return groupesContacts_();
}

// ─────────────────────────────── LECTURE ───────────────────────────────

function resumeContact_(c) {
  return { id: c.id, prenom: c.prenom, nom: c.nom, civilite: c.civilite, organisation: c.organisation, emails: c.emails, tels: c.tels,
    ville: c.adresse ? c.adresse.ville || '' : '', groupes: c.groupes, foyer: c.foyer, origine: c.origine };
}
function nomContact_(c) { return [c.civilite, c.prenom, String(c.nom || '').toUpperCase()].filter(String).join(' ') || c.organisation || '(sans nom)'; }

function listerContacts_(p, s) {
  syncContacts_({ forcer: !!p.actualiser });
  return { contacts: contactsMiroir_().map(resumeContact_), groupes: groupesContacts_(), synchro: maintenant_() };
}

function trouverContact_(id) {
  var c = contactsMiroir_().filter(function (x) { return x.id === idContact_(id); })[0];
  if (!c) throw erreur_('INTROUVABLE', 'Contact introuvable (supprimé dans Google Contacts ?).');
  return c;
}

function lireContact_(p, s) {
  syncContacts_();
  var c = trouverContact_(p.id);
  var foyer = c.foyer ? contactsMiroir_().filter(function (x) { return x.foyer === c.foyer && x.id !== c.id; }).map(resumeContact_) : [];
  var r = JSON.parse(JSON.stringify(c));
  r.foyer_membres = foyer;
  r.liens = liensContact_(c, s);
  return r;
}

/** Tout ce qui, dans l'appli, se rapporte à ce contact (e-mail, téléphone, ou nom pour les personnes elles-mêmes). */
function liensContact_(c, s) {
  var mails = {}, tels = {}, l = [];
  c.emails.forEach(function (m) { var x = normMailC_(m); if (x) mails[x] = 1; });
  c.tels.forEach(function (t) { var x = telCle_(t); if (x) tels[x] = 1; });
  var coord = function (mail, tel) {
    var ok = false;
    String(mail || '').split(/[,;\s|]+/).forEach(function (m) { if (mails[normMailC_(m)]) ok = true; });
    String(tel || '').split(/[,;/|]+/).forEach(function (t) { if (tels[telCle_(t)]) ok = true; });
    return ok;
  };
  var memePersonne = function (prenom, nom) { return !!c.nom && memeNomC_(nom, c.nom) && prenomCommunC_(prenom, c.prenom); };
  var essayer = function (f) { try { f(); } catch (e) { console.error('liens contact', e); } };

  if (s.droits.indexOf('dossiers') > -1) essayer(function () {
    var sortes = sortesLisibles_(s);
    lignes_('Dossiers').forEach(function (d) {
      if (sortes.indexOf(d.type) === -1) return;
      var i = json2_(d.donnees, {}).infos || {};
      var lui = (d.type === 'catechumene' || d.type === 'confirmand') && memePersonne(i.prenoms, i.nom);
      if (!lui && !coord(d.email, d.telephone)) return;
      l.push({ sorte: 'Dossier', libelle: ((typeof TYPES_DOSSIER !== 'undefined' && TYPES_DOSSIER[d.type]) || {}).nom || d.type + ' – ' + d.nom, detail: d.etat === 'ouvert' ? 'en cours' : 'clos', lien: '/dossiers/' + d.id, date: d.cree_le });
    });
  });
  if (peutLire_(s, 'catechisme') && db_().getSheetByName('Catechisme')) essayer(function () {
    lignes_('Catechisme').forEach(function (x) {
      if (!coord(x.email, x.telephone)) return;
      l.push({ sorte: 'Catéchisme', libelle: (x.prenoms + ' ' + x.nom).trim() + (x.groupe ? ' (' + x.groupe + ')' : ''), detail: x.annee, lien: '/catechisme/' + x.id, date: x.cree_le });
    });
  });
  if (peutLire_(s, 'cor_unum') && existe_('corReglages_') && db_().getSheetByName('CorUnum')) essayer(function () {
    var r = corReglages_();
    lignes_('CorUnum').forEach(function (x) {
      if (!coord(x.email, x.telephone) && !memePersonne(x.prenoms, x.nom)) return;
      var e = (r.equipes[x.annee] || []).filter(function (q) { return q.id === x.equipe_id; })[0];
      var chef = e && (e.chefs || []).indexOf(x.id) > -1;
      l.push({ sorte: 'Cor Unum', libelle: e ? 'Fraternité ' + e.nom + (chef ? ' (chef)' : '') : 'À répartir', detail: x.annee + (x.statut === 'ancien' ? ' · ancien membre' : ''), lien: '/cor-unum', date: x.cree_le });
    });
  });
  if (peutLire_(s, 'retraites') && db_().getSheetByName('RetraitesInscrits')) essayer(function () {
    var ret = {};
    lignes_('Retraites').forEach(function (x) { ret[x.id] = x; });
    lignes_('RetraitesInscrits').forEach(function (x) {
      if (!coord(x.contact_email, x.contact_tel)) return;
      var r = ret[x.retraite_id] || {};
      var parts = json2_(x.participants, []).map(function (pa) { return pa.prenoms; }).filter(String).join(', ');
      l.push({ sorte: 'Retraite', libelle: (r.titre || 'Retraite') + (parts ? ' – ' + parts : ''), detail: (r.annee || '') + (x.statut === 'annule' ? ' · annulée' : ''), lien: '/retraites/' + x.retraite_id, date: x.cree_le });
    });
  });
  if (peutLire_(s, 'paroissiens') && db_().getSheetByName('Comptes')) essayer(function () {
    lignes_('Comptes').forEach(function (x) {
      if (!coord(x.mail, x.telephone)) return;
      var st = { actif: 'compte actif', invite: 'invité(e)', attente: 'demande en attente', precisions: 'précisions demandées', refuse: 'demande refusée', desactive: 'désactivé' }[x.statut] || x.statut;
      l.push({ sorte: 'App des paroissiens', libelle: (x.prenom + ' ' + x.nom).trim(), detail: st, lien: '/paroissiens', date: x.cree_le });
    });
  });
  l.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
  return l;
}

/** Contacts connus parmi des adresses (Courrier : expéditeur et destinataires d'un fil). */
function contactsDesAdresses_(textes) {
  var vus = {}, r = [];
  var index = {};
  contactsMiroir_().forEach(function (c) { c.emails.forEach(function (m) { var x = normMailC_(m); if (x) index[x] = c; }); });
  (textes || []).join(',').replace(/[^\s<>,;"]+@[^\s<>,;"]+/g, function (m) {
    var x = normMailC_(m), c = index[x];
    if (c && !vus[c.id]) { vus[c.id] = 1; r.push({ email: x, id: c.id, nom: nomContact_(c) }); }
    return m;
  });
  return r;
}

// ─────────────────────────────── ÉCRITURE ───────────────────────────────

function nettoyerListe_(l, norm) {
  var vus = {}, r = [];
  (Array.isArray(l) ? l : String(l || '').split(/[,;|\n]+/)).forEach(function (v) {
    v = String(v || '').trim(); var k = norm(v);
    if (v && k && !vus[k]) { vus[k] = 1; r.push(v); }
  });
  return r;
}
var cleTelOuTexte_ = function (t) { return telCle_(t) || String(t).replace(/\s/g, ''); };
function typeTel_(t) { return /^(\+33\s?|0)[67]/.test(String(t).replace(/[\s.]/g, '')) ? 'mobile' : 'home'; }

/** Fiche de l'appli → personne de l'API People (en gardant les types et les champs personnalisés existants). */
function personneDepuisFiche_(f, ex) {
  ex = ex || {};
  var typeMail = {}, typeTel = {};
  (ex.emailAddresses || []).forEach(function (e) { typeMail[normMailC_(e.value)] = e.type; });
  (ex.phoneNumbers || []).forEach(function (t) { typeTel[cleTelOuTexte_(t.value)] = t.type; });
  var ud = (ex.userDefined || []).filter(function (u) { return u.key !== 'Foyer' && u.key !== 'Origine'; });
  if (f.foyer) ud.push({ key: 'Foyer', value: String(f.foyer) });
  if (f.origine) ud.push({ key: 'Origine', value: String(f.origine).slice(0, 200) });
  var a = f.adresse || {};
  var adresse = [a.rue, a.cp, a.ville].some(function (x) { return String(x || '').trim(); })
    ? [{ streetAddress: String(a.rue || '').trim(), postalCode: String(a.cp || '').trim(), city: String(a.ville || '').trim(), country: String(a.pays || '').trim() || 'France', type: 'home' }] : [];
  return {
    resourceName: ex.resourceName, etag: ex.etag,
    names: (f.prenom || f.nom || f.civilite) ? [{ givenName: String(f.prenom || '').trim(), familyName: String(f.nom || '').trim(), honorificPrefix: String(f.civilite || '').trim() }] : [],
    emailAddresses: nettoyerListe_(f.emails, normMail_).map(function (m) { return { value: m, type: typeMail[normMailC_(m)] || 'home' }; }),
    phoneNumbers: nettoyerListe_(f.tels, cleTelOuTexte_).map(function (t) { return { value: t, type: typeTel[cleTelOuTexte_(t)] || typeTel_(t) }; }),
    addresses: adresse,
    organizations: String(f.organisation || '').trim() ? [{ name: String(f.organisation).trim() }] : [],
    biographies: String(f.note || '').trim() ? [{ value: String(f.note).trim().slice(0, 3000), contentType: 'TEXT_PLAIN' }] : [],
    userDefined: ud
  };
}
/** Personne de l'API → fiche (pour la compléter). */
function ficheDepuisPersonne_(pe) { return contactDepuisLigne_(ligneDepuisPersonne_(pe)); }

function verifierFiche_(f) {
  if (!String(f.prenom || f.nom || f.organisation || '').trim()) throw erreur_('INVALIDE', 'Indiquez au moins un nom ou une organisation.');
  (Array.isArray(f.emails) ? f.emails : []).forEach(function (m) {
    if (String(m || '').trim() && !normMailC_(m)) throw erreur_('INVALIDE', 'Adresse e-mail invalide : ' + m);
  });
}

function ecrireContact_(p, s) {
  verifierFiche_(p);
  var pe;
  try {
    if (p.id) {
      var ex = People.People.get(rnContact_(p.id), { personFields: CHAMPS_PEOPLE });
      var f = JSON.parse(JSON.stringify(p));
      f.foyer = ficheDepuisPersonne_(ex).foyer;
      f.origine = ficheDepuisPersonne_(ex).origine;
      pe = People.People.updateContact(personneDepuisFiche_(f, ex), ex.resourceName, { updatePersonFields: CHAMPS_MAJ_PEOPLE, personFields: CHAMPS_PEOPLE });
    } else {
      pe = People.People.createContact(personneDepuisFiche_({ prenom: p.prenom, nom: p.nom, civilite: p.civilite, organisation: p.organisation, emails: p.emails, tels: p.tels, adresse: p.adresse, note: p.note, origine: 'Saisie : ' + s.nom }), { personFields: CHAMPS_PEOPLE });
    }
  } catch (e) { throw erreurPeople_(e); }
  var maj = [pe];
  // adresse commune au foyer
  var c = ficheDepuisPersonne_(pe);
  if (p.id && p.adresseFoyer && c.foyer) {
    var autres = contactsMiroir_().filter(function (x) { return x.foyer === c.foyer && x.id !== c.id; }).map(function (x) { return x.id; });
    maj = maj.concat(majPersonnes_(autres, function (f) { f.adresse = p.adresse; return f; }));
  }
  miroirMaj_(maj);
  journaliser_(s, p.id ? 'Contact modifié' : 'Contact créé', nomContact_(c));
  if (!p.id && (p.groupes || []).length) p.groupes.forEach(function (g) { modifierMembres_(g, [c.id], []); });
  return lireContact_({ id: c.id }, s);
}

function supprimerContact_(p, s) {
  var c = trouverContact_(p.id);
  try { People.People.deleteContact(rnContact_(c.id)); } catch (e) { throw erreurPeople_(e); }
  miroirMaj_([], [c.id]);
  journaliser_(s, 'Contact supprimé', nomContact_(c));
  return true;
}

/**
 * Modifie plusieurs contacts : fn(fiche, personne) renvoie la fiche modifiée (ou null pour ne rien changer).
 * Renvoie les personnes mises à jour (pour le miroir).
 */
function majPersonnes_(ids, fn) {
  var maj = [];
  ids = (ids || []).map(rnContact_);
  for (var i = 0; i < ids.length; i += 200) {
    var lot = People.People.getBatchGet({ resourceNames: ids.slice(i, i + 200), personFields: CHAMPS_PEOPLE });
    var aEcrire = {};
    (lot.responses || []).forEach(function (r) {
      if (!r.person) return;
      var f = fn(ficheDepuisPersonne_(r.person), r.person);
      if (f) aEcrire[r.person.resourceName] = personneDepuisFiche_(f, r.person);
    });
    if (!Object.keys(aEcrire).length) continue;
    var rep = People.People.batchUpdateContacts({ contacts: aEcrire, updateMask: CHAMPS_MAJ_PEOPLE, readMask: CHAMPS_PEOPLE });
    Object.keys(rep.updateResult || {}).forEach(function (k) { var x = rep.updateResult[k]; if (x && x.person) maj.push(x.person); });
  }
  return maj;
}
/** Crée des contacts (fiches) par lots de 200 ; renvoie les personnes créées, dans l'ordre. */
function creerPersonnes_(fiches) {
  var crees = [];
  for (var i = 0; i < fiches.length; i += 200) {
    var rep = People.People.batchCreateContacts({
      contacts: fiches.slice(i, i + 200).map(function (f) { return { contactPerson: personneDepuisFiche_(f) }; }),
      readMask: CHAMPS_PEOPLE
    });
    (rep.createdPeople || []).forEach(function (x) { crees.push(x.person || null); });
    if (i + 200 < fiches.length) Utilities.sleep(1000);
  }
  return crees;
}

// ─── Foyers ───

function foyerRoute_(p, s) {
  var ids = (p.ids || []).map(idContact_);
  if (p.retirer) {
    var m1 = majPersonnes_([p.retirer], function (f) { if (!f.foyer) return null; f.foyer = ''; return f; });
    miroirMaj_(m1);
    journaliser_(s, 'Contacts : retiré du foyer', '');
    return lireContact_({ id: p.retirer }, s);
  }
  if (ids.length < 2) throw erreur_('INVALIDE', 'Choisissez au moins deux personnes.');
  var cs = ids.map(trouverContact_);
  var foyer = (cs.filter(function (c) { return c.foyer; })[0] || {}).foyer || 'f' + uid_();
  // les autres membres des foyers qu'on réunit rejoignent aussi le foyer
  var anciens = {};
  cs.forEach(function (c) { if (c.foyer && c.foyer !== foyer) anciens[c.foyer] = 1; });
  contactsMiroir_().forEach(function (x) { if (anciens[x.foyer] && ids.indexOf(x.id) === -1) ids.push(x.id); });
  var adresse = p.adresse || (cs.filter(function (c) { return c.adresse; })[0] || {}).adresse || null;
  var maj = majPersonnes_(ids, function (f) {
    if (f.foyer === foyer && (!p.adresseCommune || !adresse)) return null;
    f.foyer = foyer;
    if (p.adresseCommune && adresse) f.adresse = adresse;
    return f;
  });
  miroirMaj_(maj);
  journaliser_(s, 'Contacts : foyer', ids.length + ' personnes');
  return lireContact_({ id: ids[0] }, s);
}

// ─────────────────────────────── IMPORT ───────────────────────────────

/** Index e-mail / téléphone → contact (miroir + contacts en attente de création). */
function indexContacts_(liste) {
  var ix = { mail: {}, tel: {} };
  liste.forEach(function (c) { indexer_(ix, c); });
  return ix;
}
function indexer_(ix, c) {
  (c.emails || []).forEach(function (m) { var k = normMailC_(m); if (k && !ix.mail[k]) ix.mail[k] = c; });
  (c.tels || []).forEach(function (t) { var k = telCle_(t); if (k && !ix.tel[k]) ix.tel[k] = c; });
}
function chercherIndex_(ix, emails, tels) {
  var r = null;
  (emails || []).some(function (m) { r = ix.mail[normMailC_(m)] || null; return !!r; });
  if (!r) (tels || []).some(function (t) { var k = telCle_(t); r = k ? ix.tel[k] || null : null; return !!r; });
  return r;
}
/** Ce qu'une fiche apporte de nouveau à un contact existant. */
function apportsFiche_(c, f) {
  var mails = {}, tels = {}, a = { emails: [], tels: [] };
  c.emails.forEach(function (m) { mails[normMailC_(m)] = 1; });
  c.tels.forEach(function (t) { tels[cleTelOuTexte_(t)] = 1; });
  (f.emails || []).forEach(function (m) { var k = normMailC_(m); if (k && !mails[k]) { mails[k] = 1; a.emails.push(m); } });
  (f.tels || []).forEach(function (t) { var k = cleTelOuTexte_(t); if (k && !tels[k]) { tels[k] = 1; a.tels.push(t); } });
  var fa = f.adresse || {};
  if (!c.adresse && (fa.rue || fa.ville)) a.adresse = fa;
  if (!c.organisation && f.organisation) a.organisation = f.organisation;
  if (!c.prenom && !c.nom && (f.prenom || f.nom)) { a.prenom = f.prenom; a.nom = f.nom; }
  return a;
}
function apportVide_(a) { return !a.emails.length && !a.tels.length && !a.adresse && !a.organisation && !a.nom && !a.prenom && !a.foyer; }

/**
 * Import du tableau (préparé par l'appli : sans Colmar, couples séparés).
 * p.lignes : [{ prenom, nom, civilite, organisation, emails, tels, adresse, origine, foyer (clé commune aux membres d'un couple) }]
 * p.essai : aperçu seulement.
 */
function importerContacts_(p, s) {
  var lignes = (p.lignes || []).slice(0, p.essai ? 3000 : 400);
  syncContacts_({ forcer: true });
  var existants = JSON.parse(JSON.stringify(contactsMiroir_()));   // copies : le miroir n'est pas touché
  var ix = indexContacts_(existants);
  var foyers = {};   // clé du fichier → id de foyer
  var nouveaux = [], fusions = {}, identiques = 0, rapport = [];
  lignes.forEach(function (f) {
    f.emails = nettoyerListe_(f.emails, normMail_); f.tels = nettoyerListe_(f.tels, cleTelOuTexte_);
    var c = chercherIndex_(ix, f.emails, f.tels);
    if (c && c._nouveau) {   // déjà dans ce lot : on complète
      var a0 = apportsFiche_(c, f);
      c.emails = c.emails.concat(a0.emails); c.tels = c.tels.concat(a0.tels);
      if (a0.adresse) c.adresse = a0.adresse;
      indexer_(ix, c);
      return;
    }
    if (c) {
      var a = apportsFiche_(c, f);
      if (f.foyer) { foyers[f.foyer] = foyers[f.foyer] || c.foyer || ''; if (!c.foyer) a.foyer = f.foyer; }
      if (apportVide_(a)) { identiques++; return; }
      var fu = fusions[c.id] || (fusions[c.id] = { id: c.id, nom: nomContact_(c), emails: [], tels: [], adresse: null, organisation: '', foyer: '' });
      fu.emails = fu.emails.concat(a.emails); fu.tels = fu.tels.concat(a.tels);
      if (a.adresse) fu.adresse = a.adresse; if (a.organisation) fu.organisation = a.organisation; if (a.foyer) fu.foyer = a.foyer;
      if (a.nom || a.prenom) { fu.prenom = a.prenom; fu.nom2 = a.nom; }
      c.emails = c.emails.concat(a.emails); c.tels = c.tels.concat(a.tels); indexer_(ix, c);
      return;
    }
    var n = { _nouveau: true, prenom: f.prenom || '', nom: f.nom || '', civilite: f.civilite || '', organisation: f.organisation || '', emails: f.emails, tels: f.tels,
      adresse: f.adresse && (f.adresse.rue || f.adresse.ville || f.adresse.cp) ? f.adresse : null, origine: String(f.origine || 'Import').slice(0, 200), foyerCle: f.foyer || '', note: f.note || '' };
    nouveaux.push(n); indexer_(ix, n);
  });
  var listeFusions = Object.keys(fusions).map(function (k) { return fusions[k]; });
  if (p.essai) {
    return { nouveaux: nouveaux.length, fusions: listeFusions.map(function (f) { return { nom: f.nom, emails: f.emails, tels: f.tels, adresse: !!f.adresse }; }), identiques: identiques };
  }
  // foyers : clé du fichier → id (celui d'un membre déjà existant, sinon nouveau)
  Object.keys(foyers).forEach(function (k) { if (!foyers[k]) foyers[k] = 'f' + uid_(); });
  nouveaux.forEach(function (n) { if (n.foyerCle) { foyers[n.foyerCle] = foyers[n.foyerCle] || 'f' + uid_(); n.foyer = foyers[n.foyerCle]; } });
  var personnes = [];
  try {
    personnes = creerPersonnes_(nouveaux).filter(Boolean);
    if (listeFusions.length) {
      var parId = {};
      listeFusions.forEach(function (f) { parId[rnContact_(f.id)] = f; });
      personnes = personnes.concat(majPersonnes_(listeFusions.map(function (f) { return f.id; }), function (fi, pe) {
        var f = parId[pe.resourceName]; if (!f) return null;
        fi.emails = fi.emails.concat(f.emails); fi.tels = fi.tels.concat(f.tels);
        if (f.adresse && !fi.adresse) fi.adresse = f.adresse;
        if (f.organisation && !fi.organisation) fi.organisation = f.organisation;
        if (f.foyer && !fi.foyer) fi.foyer = foyers[f.foyer];
        if (f.nom2 || f.prenom) { fi.prenom = fi.prenom || f.prenom; fi.nom = fi.nom || f.nom2; }
        return fi;
      }));
    }
  } catch (e) { throw erreurPeople_(e); }
  miroirMaj_(personnes);
  memoriserVus_(nouveaux);
  journaliser_(s, 'Contacts : import', nouveaux.length + ' créé(s), ' + listeFusions.length + ' complété(s), ' + identiques + ' déjà à jour');
  return { crees: nouveaux.length, completes: listeFusions.length, identiques: identiques };
}

/** Coordonnées déjà passées par Google Contacts : un contact supprimé ensuite n'est pas recréé automatiquement. */
function vus_() { return json2_(props_().getProperty('CONTACTS_VUS'), {}); }
function memoriserVus_(fiches) {
  var v = vus_(), n = 0;
  (fiches || []).forEach(function (f) {
    (f.emails || []).forEach(function (m) { var k = normMailC_(m); if (k && !v[k]) { v[k] = 1; n++; } });
    (f.tels || []).forEach(function (t) { var k = telCle_(t); if (k && !v[k]) { v[k] = 1; n++; } });
  });
  if (n) props_().setProperty('CONTACTS_VUS', JSON.stringify(v));
}

// ─────────────────────────────── DOUBLONS ───────────────────────────────

function pasDoublons_() { return json2_(props_().getProperty('CONTACTS_PAS_DOUBLONS'), {}); }
function clePaire_(a, b) { return [a, b].sort().join('|'); }

function doublonsContacts_(p, s) {
  syncContacts_();
  var cs = contactsMiroir_(), ignores = pasDoublons_(), paires = {};
  var ajouter = function (a, b, raison) {
    if (a.id === b.id || (a.foyer && a.foyer === b.foyer)) return;   // un foyer partage souvent le téléphone fixe
    var k = clePaire_(a.id, b.id);
    if (ignores[k]) return;
    var x = paires[k] || (paires[k] = { a: a, b: b, raisons: [] });
    if (x.raisons.indexOf(raison) === -1) x.raisons.push(raison);
  };
  var grouper = function (cle, raison) {
    var m = {};
    cs.forEach(function (c) { cle(c).forEach(function (k) { if (k) (m[k] = m[k] || []).push(c); }); });
    Object.keys(m).forEach(function (k) { var l = m[k]; if (l.length > 1 && l.length < 6) for (var i = 1; i < l.length; i++) ajouter(l[0], l[i], raison); });
  };
  grouper(function (c) { return c.emails.map(normMail_); }, 'même e-mail');
  grouper(function (c) { return c.tels.map(telCle_); }, 'même téléphone');
  grouper(function (c) { var a = cleNomC_(c.prenom), b = cleNomC_(c.nom); return a && b ? [[a, b].sort().join('|')] : []; }, 'même nom');   // nom et prénom inversés compris
  // noms proches (une lettre d'écart), même prénom
  var parPrenom = {};
  cs.forEach(function (c) { var pr = cleNomC_(c.prenom); if (pr && cleNomC_(c.nom).length > 4) (parPrenom[pr] = parPrenom[pr] || []).push(c); });
  Object.keys(parPrenom).forEach(function (k) {
    var l = parPrenom[k];
    if (l.length > 80) return;
    for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++) {
      var x = cleNomC_(l[i].nom), y = cleNomC_(l[j].nom);
      if (x !== y && levenshteinC_(x, y) <= 1) ajouter(l[i], l[j], 'nom proche');
    }
  });
  var r = Object.keys(paires).map(function (k) { var x = paires[k]; return { a: resumeContact_(x.a), b: resumeContact_(x.b), raisons: x.raisons }; });
  r.sort(function (a, b) { return b.raisons.length - a.raisons.length || cleTri_(a.a).localeCompare(cleTri_(b.a)); });
  return r.slice(0, 300);
}

function pasDoublonRoute_(p, s) {
  var x = pasDoublons_(); x[clePaire_(idContact_(p.a), idContact_(p.b))] = 1;
  props_().setProperty('CONTACTS_PAS_DOUBLONS', JSON.stringify(x));
  return true;
}

/** Fusionne « retirer » dans « garder » : coordonnées, adresse, organisation, note, groupes, foyer ; puis supprime « retirer ». */
function fusionnerContacts_(p, s) {
  var A = trouverContact_(p.garder), B = trouverContact_(p.retirer);
  if (A.id === B.id) throw erreur_('INVALIDE', 'Choisissez deux contacts différents.');
  var maj;
  try {
    maj = majPersonnes_([A.id], function (f) {
      f.emails = f.emails.concat(B.emails); f.tels = f.tels.concat(B.tels);
      if (!f.prenom && !f.nom) { f.prenom = B.prenom; f.nom = B.nom; }
      if (!f.civilite) f.civilite = B.civilite;
      if (!f.adresse && B.adresse) f.adresse = B.adresse;
      if (!f.organisation) f.organisation = B.organisation;
      if (B.note && f.note.indexOf(B.note) === -1) f.note = (f.note ? f.note + '\n' : '') + B.note;
      if (!f.foyer) f.foyer = B.foyer;
      if (B.origine && f.origine.indexOf(B.origine) === -1) f.origine = (f.origine ? f.origine + ' ; ' : '') + B.origine;
      return f;
    });
    B.groupes.filter(function (g) { return A.groupes.indexOf(g) === -1; }).forEach(function (g) {
      People.ContactGroups.Members.modify({ resourceNamesToAdd: [rnContact_(A.id)] }, g);
    });
    People.People.deleteContact(rnContact_(B.id));
  } catch (e) { throw erreurPeople_(e); }
  // la personne relue après l'ajout aux groupes
  try { maj = [People.People.get(rnContact_(A.id), { personFields: CHAMPS_PEOPLE })]; } catch (e) {}
  miroirMaj_(maj, [B.id]);
  journaliser_(s, 'Contacts : fusion', nomContact_(B) + ' → ' + nomContact_(A));
  return lireContact_({ id: A.id }, s);
}

// ─────────────────────────────── LIENS AUTOMATIQUES ───────────────────────────────

/** Le parent à qui appartient l'adresse (prénom dans l'adresse), sinon le premier nommé. */
function parentDe_(email, parents) {
  parents = parents.filter(function (x) { return x && (x.prenom || x.nom); });
  var local = simpleC_(String(email || '').split('@')[0]);
  var trouve = parents.filter(function (x) {
    var pr = simpleC_(String(x.prenom || '').split(/[\s-]/)[0]);
    return pr.length > 2 && local.indexOf(pr) > -1;
  })[0];
  return trouve || parents[0] || null;
}
function anneeDe_(d) { return String(d.date_celebration || d.cree_le || '').slice(0, 4); }

/** Personnes qui doivent être des contacts, avec leurs groupes automatiques. */
function personnesDesModules_() {
  var l = [];
  var ajouter = function (pers, email, tel, adresse, groupes, source) {
    var emails = [normMailC_(email)].filter(String), tels = String(tel || '').split(/[,;/|]+/).map(function (t) { return t.trim(); }).filter(telCle_);
    if (!emails.length && !tels.length) return;
    l.push({ prenom: (pers && pers.prenom) || '', nom: (pers && pers.nom) || '', emails: emails, tels: tels,
      adresse: adresse ? { rue: String(adresse).slice(0, 200), cp: '', ville: '', pays: '' } : null, groupes: groupes.filter(String), origine: 'Appli : ' + source });
  };
  // Dossiers (sauf obsèques et baptêmes dans une autre paroisse)
  lignes_('Dossiers').forEach(function (d) {
    var don = json2_(d.donnees, {}), i = don.infos || {}, et = don.etapes || {};
    var enfant = { prenom: '', nom: i.enfant_nom || '' };
    var parents = [{ prenom: i.mere_prenom, nom: i.mere_nom_jeune_fille }, { prenom: i.pere_prenom, nom: i.pere_nom }];
    switch (d.type) {
      case 'bapteme': ajouter(parentDe_(d.email, parents) || enfant, d.email, d.telephone, i.adresse, ['Baptêmes ' + anneeDe_(d)], 'baptême'); break;
      case 'premiere_communion': ajouter(parentDe_(d.email, parents) || enfant, d.email, d.telephone, i.adresse, i.annee_scolaire ? ['Premières communions ' + i.annee_scolaire] : [], 'première communion'); break;
      case 'profession_foi': ajouter(parentDe_(d.email, parents) || enfant, d.email, d.telephone, i.adresse, i.annee_scolaire ? ['Professions de foi ' + i.annee_scolaire] : [], 'profession de foi'); break;
      case 'confirmation_jeune': ajouter(parentDe_(d.email, parents) || enfant, d.email, d.telephone, i.adresse, i.annee_scolaire ? ['Confirmations (jeunes) ' + i.annee_scolaire] : [], 'confirmation'); break;
      case 'mariage': ajouter(parentDe_(d.email, [{ prenom: i.fiancee_prenoms, nom: i.fiancee_nom }, { prenom: i.fiance_prenoms, nom: i.fiance_nom }]), d.email, d.telephone, i.adresse, ['Mariages ' + anneeDe_(d)], 'mariage'); break;
      case 'catechumene':
        var neo = !!(et.sacrements && et.sacrements.fait);
        ajouter({ prenom: i.prenoms, nom: i.nom }, d.email, d.telephone, i.adresse,
          [neo ? 'Néophytes ' + (i.annee_sacrements || '') : i.annee_sacrements ? 'Catéchumènes ' + i.annee_sacrements : 'Catéchumènes en attente'], neo ? 'néophyte' : 'catéchumène'); break;
      case 'confirmand':
        var an = i.annee_sacrements || String(i.annee_scolaire || '').slice(5);
        ajouter({ prenom: i.prenoms, nom: i.nom }, d.email, d.telephone, i.adresse, an ? ['Confirmands ' + an] : [], 'confirmand'); break;
    }
  });
  // Catéchisme : un parent par inscription
  if (db_().getSheetByName('Catechisme')) lignes_('Catechisme').forEach(function (x) {
    var pere = separerNomPrenomC_(x.pere), mere = separerNomPrenomC_(x.mere);
    ajouter(parentDe_(x.email, [mere, pere]) || { nom: x.nom }, x.email, x.telephone, x.adresse,
      x.groupe ? ['Catéchisme ' + x.annee + ' – ' + x.groupe] : [], 'catéchisme');
  });
  // Cor Unum : membres actuels par fraternité, et chefs
  if (existe_('corReglages_') && db_().getSheetByName('CorUnum')) {
    var r = corReglages_();
    lignes_('CorUnum').forEach(function (x) {
      var e = (r.equipes[x.annee] || []).filter(function (q) { return q.id === x.equipe_id; })[0];
      var g = [];
      if (e && x.statut !== 'ancien') {
        g.push('Cor Unum ' + x.annee + ' – ' + e.nom);
        if ((e.chefs || []).indexOf(x.id) > -1) g.push('Chefs Cor Unum ' + x.annee);
      }
      ajouter({ prenom: x.prenoms, nom: x.nom }, x.email, x.telephone, x.adresse, g, 'Cor Unum');
    });
  }
  // Retraites : la personne qui inscrit
  if (db_().getSheetByName('RetraitesInscrits')) lignes_('RetraitesInscrits').forEach(function (x) {
    if (x.statut === 'annule') return;
    ajouter(separerNomPrenomInverse_(x.contact_nom), x.contact_email, x.contact_tel, '', [], 'retraite');
  });
  // App des paroissiens : comptes validés
  if (db_().getSheetByName('Comptes')) lignes_('Comptes').forEach(function (x) {
    if (x.statut !== 'actif' && x.statut !== 'invite') return;
    ajouter({ prenom: x.prenom, nom: x.nom }, x.mail, x.telephone, x.adresse, [], 'app des paroissiens');
  });
  return l;
}
/** « Marie Dupont » → { prenom: 'Marie', nom: 'Dupont' } (le prénom est le premier mot). */
function separerNomPrenomInverse_(t) {
  var mots = String(t || '').trim().split(/\s+/).filter(String);
  return { prenom: mots.length > 1 ? mots.shift() : '', nom: mots.join(' ') };
}

/** Déclencheur toutes les heures. */
function majContactsAuto() {
  try { contactsAutomatique_(null); } catch (e) { console.error('contacts auto', e); }
}
function assurerContactsAuto_() {
  if (ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'majContactsAuto'; })) return;
  ScriptApp.newTrigger('majContactsAuto').timeBased().everyHours(1).create();
}

/**
 * Crée les contacts manquants, complète les existants (e-mail ou téléphone nouveau) et met à jour les groupes automatiques.
 */
function contactsAutomatique_(s) {
  var cache = CacheService.getScriptCache();
  if (cache.get('contacts_auto')) throw erreur_('OCCUPE', 'La mise à jour des contacts est déjà en cours.');
  cache.put('contacts_auto', '1', 300);
  try {
    syncContacts_({ forcer: true });
    var existants = JSON.parse(JSON.stringify(contactsMiroir_())), ix = indexContacts_(existants), vus = vus_();
    var aCreer = [], aCompleter = {}, membres = {};
    personnesDesModules_().forEach(function (pers) {
      var c = chercherIndex_(ix, pers.emails, pers.tels);
      if (!c) {
        var cles = pers.emails.map(normMail_).concat(pers.tels.map(telCle_)).filter(String);
        if (cles.some(function (k) { return vus[k]; })) return;   // contact supprimé à la main : pas recréé
        c = { _nouveau: true, prenom: pers.prenom, nom: pers.nom, emails: pers.emails.slice(), tels: pers.tels.slice(), adresse: pers.adresse, origine: pers.origine };
        aCreer.push(c); indexer_(ix, c);
      } else {
        var a = apportsFiche_(c, pers);
        if (c._nouveau) { c.emails = c.emails.concat(a.emails); c.tels = c.tels.concat(a.tels); if (!c.prenom && !c.nom) { c.prenom = pers.prenom; c.nom = pers.nom; } }
        else if (a.emails.length || a.tels.length) {
          var x = aCompleter[c.id] || (aCompleter[c.id] = { emails: [], tels: [] });
          x.emails = x.emails.concat(a.emails); x.tels = x.tels.concat(a.tels);
          c.emails = c.emails.concat(a.emails); c.tels = c.tels.concat(a.tels);
        }
        indexer_(ix, c);
      }
      pers.groupes.forEach(function (g) { (membres[g] = membres[g] || []).push(c); });
    });
    // créations, puis compléments
    var personnes = [];
    try {
      var crees = creerPersonnes_(aCreer);
      crees.forEach(function (pe, i) { if (pe) { aCreer[i].id = idContact_(pe.resourceName); personnes.push(pe); } });
      var ids = Object.keys(aCompleter);
      if (ids.length) personnes = personnes.concat(majPersonnes_(ids, function (f, pe) {
        var x = aCompleter[idContact_(pe.resourceName)]; if (!x) return null;
        f.emails = f.emails.concat(x.emails); f.tels = f.tels.concat(x.tels); return f;
      }));
    } catch (e) { throw erreurPeople_(e); }
    if (personnes.length) miroirMaj_(personnes);
    memoriserVus_(aCreer);
    // groupes automatiques
    var reg = groupesAuto_(), parNom = {}, rapportGroupes = { crees: 0, ajouts: 0, retraits: 0, supprimes: 0 };
    lireGroupesGoogle_().forEach(function (g) { parNom[g.nom] = g.id; });
    var actuels = {}, changements = [];
    contactsMiroir_().forEach(function (c) { c.groupes.forEach(function (g) { (actuels[g] = actuels[g] || {})[c.id] = 1; }); });
    Object.keys(membres).forEach(function (nom) {
      var rn = reg[nom];
      if (rn && !Object.keys(parNom).some(function (k) { return parNom[k] === rn; })) rn = '';   // supprimé dans Google
      if (!rn) rn = parNom[nom] || '';
      if (!rn) { rn = creerGroupeGoogle_(nom); rapportGroupes.crees++; }
      reg[nom] = rn;
      var voulus = {};
      membres[nom].forEach(function (c) { if (c.id) voulus[c.id] = 1; });
      var deja = actuels[rn] || {};
      var plus = Object.keys(voulus).filter(function (id) { return !deja[id]; });
      var moins = Object.keys(deja).filter(function (id) { return !voulus[id]; });
      if (plus.length || moins.length) { modifierMembres_(rn, plus, moins, changements); rapportGroupes.ajouts += plus.length; rapportGroupes.retraits += moins.length; }
    });
    // groupes automatiques devenus vides : supprimés (les contacts restent)
    Object.keys(reg).forEach(function (nom) {
      if (membres[nom]) return;
      try { People.ContactGroups.remove(reg[nom], { deleteContacts: false }); rapportGroupes.supprimes++; } catch (e) {}
      changements.push({ groupe: reg[nom], ajouter: [], retirer: Object.keys(actuels[reg[nom]] || {}) });
      delete reg[nom];
    });
    appliquerMembres_(changements);
    props_().setProperty('CONTACTS_AUTO', JSON.stringify(reg));
    props_().deleteProperty('CONTACTS_GROUPES');
    var rapport = { crees: aCreer.filter(function (c) { return c.id; }).length, completes: Object.keys(aCompleter).length, groupes: rapportGroupes, le: maintenant_() };
    props_().setProperty('CONTACTS_AUTO_RAPPORT', JSON.stringify(rapport));
    if (rapport.crees || rapport.completes || rapportGroupes.crees || rapportGroupes.ajouts || rapportGroupes.retraits)
      journaliser_(s, 'Contacts : mise à jour automatique', rapport.crees + ' créé(s), ' + rapport.completes + ' complété(s), groupes : +' + rapportGroupes.ajouts + ' / −' + rapportGroupes.retraits);
    return rapport;
  } finally { cache.remove('contacts_auto'); }
}
function autoRoute_(p, s) {
  assurerContactsAuto_();
  if (p.lire) return json2_(props_().getProperty('CONTACTS_AUTO_RAPPORT'), null);
  return contactsAutomatique_(s);
}

// ─────────────────────────────── ENVOIS GROUPÉS ───────────────────────────────

/** Adresses d'un groupe ou d'une sélection (première adresse de chaque contact). */
function adressesEnvoi_(p) {
  syncContacts_();
  var cs = contactsMiroir_(), l = [];
  if (p.groupe) cs = cs.filter(function (c) { return c.groupes.indexOf(p.groupe) > -1; });
  else if ((p.ids || []).length) { var ids = {}; p.ids.forEach(function (i) { ids[idContact_(i)] = 1; }); cs = cs.filter(function (c) { return ids[c.id]; }); }
  else throw erreur_('INVALIDE', 'Choisissez un groupe ou des contacts.');
  var vus = {}, sans = 0;
  cs.forEach(function (c) {
    var m = c.emails.map(normMail_).filter(String)[0];
    if (!m) { sans++; return; }
    if (!vus[m]) { vus[m] = 1; l.push(m); }
  });
  return { emails: l, sans: sans };
}

function envoyerContacts_(p, s) {
  if (s.acces && s.acces.courrier_tout === false) throw interdit_('Les envois groupés sont réservés aux personnes qui voient tout le courrier.');
  if (s.droits.indexOf('mail') === -1 && s.role !== 'admin') throw interdit_('Les envois groupés demandent l\'accès au Courrier.');
  var a = adressesEnvoi_(p), emails = a.emails;
  if (!emails.length) throw erreur_('INVALIDE', 'Aucune adresse e-mail parmi ces contacts.');
  var brevo = emails.length > ENVOI_GMAIL_MAX;
  if (brevo && ((p.fichiers || []).length || (p.documentsDrive || []).length)) throw erreur_('INVALIDE', 'Au-delà de ' + ENVOI_GMAIL_MAX + ' destinataires, l\'envoi passe par Brevo, qui ne joint pas de fichiers : mettez plutôt un lien (Documents → Partage).');
  if (!brevo) {
    var quota = MailApp.getRemainingDailyQuota();
    if (emails.length + 1 > quota) throw erreur_('QUOTA', 'Quota Gmail insuffisant aujourd\'hui : ' + quota + ' destinataires restants.');
    if (p.essai) return { nb: emails.length, sans: a.sans, quota: quota, canal: 'gmail' };
    var opts = optionsEnvoi_();
    opts.htmlBody = corpsHtml_(p.corps, p.signature, p.boutons);
    opts.attachments = piecesPourEnvoi_(p);
    opts.bcc = emails.join(',');
    GmailApp.sendEmail(CONFIG.ALIAS, p.sujet || '', corpsTexte_(p.corps, p.signature, p.boutons), opts);
    journaliser_(s, 'Envoi groupé', (p.sujet || '') + ' → ' + emails.length + ' destinataires (Gmail)');
    return { nb: emails.length, sans: a.sans, canal: 'gmail' };
  }
  if (!existe_('brevo_') || !proprietesReelles_().getProperty('BREVO_CLE')) throw erreur_('BREVO', 'Plus de ' + ENVOI_GMAIL_MAX + ' destinataires : l\'envoi passe par Brevo, mais la clé Brevo n\'est pas enregistrée (Réglages → Newsletter).');
  if (p.essai) return { nb: emails.length, sans: a.sans, canal: 'brevo' };
  var r = envoyerParBrevo_(emails, String(p.sujet || '').trim() || 'Paroisse La Croix glorieuse', corpsHtml_(p.corps, p.signature, p.boutons));
  journaliser_(s, 'Envoi groupé', (p.sujet || '') + ' → ' + emails.length + ' destinataires (Brevo, campagne ' + r.campagne + ')');
  return { nb: emails.length, sans: a.sans, canal: 'brevo', campagne: r.campagne };
}

/** Liste Brevo temporaire (dossier « Secrétariat – envois groupés ») + campagne envoyée tout de suite depuis secretariat@. */
function envoyerParBrevo_(emails, sujet, html) {
  var nomDossier = 'Secrétariat – envois groupés';
  var dossiers = (brevo_('get', '/contacts/folders?limit=50&offset=0') || {}).folders || [];
  var dossier = dossiers.filter(function (d) { return d.name === nomDossier; })[0];
  var dossierId = dossier ? dossier.id : brevo_('post', '/contacts/folders', { name: nomDossier }).id;
  var date = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd HH:mm');
  var liste = brevo_('post', '/contacts/lists', { name: 'Envoi ' + date + ' – ' + sujet.slice(0, 50), folderId: dossierId }).id;
  var imp = brevo_('post', '/contacts/import', { listIds: [liste], jsonBody: emails.map(function (m) { return { email: m }; }), updateExistingContacts: false, emptyContactsAttributes: false });
  // attendre la fin de l'import (quelques secondes)
  for (var i = 0; i < 30 && imp && imp.processId; i++) {
    Utilities.sleep(2000);
    var st = brevo_('get', '/processes/' + imp.processId) || {};
    if (st.status === 'completed') break;
    if (i === 29) throw erreur_('BREVO', 'Brevo met trop de temps à préparer la liste : réessayez dans quelques minutes.');
  }
  var pied = '<p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999;margin-top:24px">Vous recevez ce message de la paroisse La Croix glorieuse. ' +
    '<a href="{{ unsubscribe }}" style="color:#999">Ne plus recevoir ces messages</a></p>';
  var camp = brevo_('post', '/emailCampaigns', {
    name: 'Secrétariat – ' + date + ' – ' + sujet.slice(0, 60), subject: sujet,
    sender: { name: CONFIG.NOM_EXPEDITEUR, email: CONFIG.ALIAS }, replyTo: CONFIG.ALIAS,
    htmlContent: '<!DOCTYPE html><html><body>' + html + pied + '</body></html>', recipients: { listIds: [liste] }
  });
  brevo_('post', '/emailCampaigns/' + camp.id + '/sendNow');
  return { campagne: camp.id, liste: liste };
}

// ─────────────────────────────── AUTORISATION ───────────────────────────────

/**
 * À lancer une fois dans l'éditeur Apps Script après la mise à jour (bouton ▶ Exécuter) :
 * Google demande le nouveau droit « modifier vos contacts ». Ensuite : Déployer → Gérer les déploiements → nouvelle version.
 */
function autoriserContacts() {
  // ancien groupe d'essai laissé par une première version de cette fonction
  lireGroupesGoogle_().forEach(function (g) { if (g.nom === 'Test autorisation (à supprimer)') People.ContactGroups.remove(g.id, { deleteContacts: false }); });
  syncContacts_({ complet: true });
  assurerContactsAuto_();
  Logger.log('Google Contacts : écriture autorisée, ' + contactsMiroir_().length + ' contacts lus.');
}

// ─────────────────────────────── ROUTE ───────────────────────────────

function contactsRoute_(action, p, s) {
  switch (action) {
    case 'contacts.liste': return listerContacts_(p, s);
    case 'contacts.lire': return lireContact_(p, s);
    case 'contacts.ecrire': return ecrireContact_(p, s);
    case 'contacts.supprimer': return supprimerContact_(p, s);
    case 'contacts.groupe': return groupeRoute_(p, s);
    case 'contacts.foyer': return foyerRoute_(p, s);
    case 'contacts.importer': return importerContacts_(p, s);
    case 'contacts.doublons': return doublonsContacts_(p, s);
    case 'contacts.fusionner': return fusionnerContacts_(p, s);
    case 'contacts.pasDoublon': return pasDoublonRoute_(p, s);
    case 'contacts.auto': return autoRoute_(p, s);
    case 'contacts.envoyer': return envoyerContacts_(p, s);
  }
  throw erreur_('ACTION_INCONNUE', 'Action inconnue : ' + action);
}
