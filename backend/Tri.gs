/**
 * Tri automatique des mails entrants, par mots-clés (aucune IA, rien ne sort du compte Google).
 *
 * Toutes les 5 minutes, chaque nouveau mail de la boîte de réception est lu :
 *  - il reçoit une étiquette Gmail « Tri/… » par type de demande reconnu ;
 *  - l'appli propose l'action correspondante (créer l'extrait, le dossier, un rendez-vous…) ;
 *  - une demande d'horaires reçoit la réponse type « Horaires » automatiquement,
 *    sauf si le mail contient un mot sensible (décès, malade, urgent…) : il est alors
 *    étiqueté « Tri/Prioritaire », étoilé et mis « À traiter ».
 * Les envois automatiques (newsletters, no-reply, listes, notifications) sont ignorés.
 */

// Ordre = priorité : quand une catégorie est reconnue, ses mots sont retirés du texte
// avant de tester les suivantes (« extrait de baptême » ne compte pas aussi comme « baptême »).
var TRI_CATEGORIES = [
  { cle: 'extrait', nom: 'Extrait de baptême', action: 'extrait',
    mots: ['extrait de bapteme', "extrait d'acte de bapteme", 'acte de bapteme', 'certificat de bapteme', 'attestation de bapteme', 'preuve de bapteme', 'extrait baptistaire'] },
  { cle: 'intention', nom: 'Intention de messe', action: 'appmesse',
    mots: ['intention de messe', 'intentions de messe', 'faire dire une messe', 'faire celebrer une messe', 'demander une messe', "messe a l'intention", 'messe pour le repos', 'offrande de messe'] },
  { cle: 'obseques', nom: 'Obsèques', action: 'dossier', type: 'obseques',
    mots: ['obseques', 'enterrement', 'funerailles', 'pompes funebres', 'inhumation', 'deces', 'decede*'] },
  { cle: 'premiere_communion', nom: 'Première communion', action: 'dossier', type: 'premiere_communion',
    mots: ['premiere communion', '1ere communion', '1re communion'] },
  { cle: 'profession_foi', nom: 'Profession de foi', action: 'dossier', type: 'profession_foi',
    mots: ['profession de foi'] },
  { cle: 'confirmand', nom: 'Confirmation', action: 'dossier', type: 'confirmand',
    mots: ['sacrement de confirmation', 'preparation a la confirmation', 'recevoir la confirmation', 'etre confirme*', 'me faire confirmer', 'se faire confirmer', 'faire confirmer'] },
  { cle: 'catechumene', nom: 'Catéchuménat', action: 'dossier', type: 'catechumene',
    mots: ['catechumenat', 'catechumene', 'devenir chretien*', 'me faire baptiser', 'bapteme adulte', "bapteme d'adulte", 'bapteme des adultes'] },
  { cle: 'mariage', nom: 'Mariage', action: 'dossier', type: 'mariage', reponse: 'accuse_mariage',
    mots: ['mariage', 'se marier', 'nous marier', "marier a l'eglise", 'fiance*'] },
  { cle: 'bapteme', nom: 'Baptême', action: 'dossier', type: 'bapteme', reponse: 'accuse_bapteme',
    mots: ['bapteme', 'baptis*'] },
  { cle: 'rendezvous', nom: 'Rendez-vous', action: 'rendezvous',
    mots: ['rendez-vous', 'rendez vous', 'rdv', 'vous rencontrer', 'un entretien', 'vous voir', 'rencontrer un pretre', 'parler a un pretre', 'rencontrer monsieur le cure', 'rencontrer le cure'] },
  { cle: 'horaires', nom: 'Horaires', action: 'horaires', reponse: 'horaires',
    mots: ['horaire*', 'a quelle heure', 'heure de la messe', 'heure des messes', 'heures des messes', 'heures de messe*', 'y a-t-il une messe', 'y a t il une messe', "est-ce qu'il y a une messe", 'quand est la messe', 'heure des confessions', 'permanence*'] }
];

var TRI_SENSIBLES_DEFAUT = ['deces', 'decede*', 'obseques', 'enterrement', 'funerailles', 'malade*', 'maladie', 'hopital', 'mourant*', 'fin de vie',
  'soins palliatifs', 'onction', 'sacrement des malades', 'derniers sacrements', 'urgent*', 'urgence', 'detresse', 'suicide', 'abus', 'agression', 'plainte'];
var TRI_IGNORES_DEFAUT = ['no-reply', 'noreply', 'ne-pas-repondre', 'nepasrepondre', 'donotreply', 'mailer-daemon', 'postmaster', 'notification', 'newsletter', 'news@', 'info@mail.'];

var TRI_RACINE = 'Tri';
var TRI_LIBELLE_PRIORITAIRE = 'Prioritaire';
var TRI_LIBELLE_AUTO = 'Réponse auto envoyée';
var TRI_SESSION = { nom: 'Tri automatique', uid: '' };

// ─── Réglages ───

function triReglages_() {
  var stock = json2_(props_().getProperty('TRI'), {});
  var mots = {};
  TRI_CATEGORIES.forEach(function (c) { mots[c.cle] = (stock.mots && stock.mots[c.cle]) || c.mots.slice(); });
  return {
    actif: stock.actif === true,
    envoi_auto: stock.envoi_auto !== false,
    mots: mots,
    desactivees: stock.desactivees || [],
    sensibles: stock.sensibles || TRI_SENSIBLES_DEFAUT.slice(),
    ignores: stock.ignores || TRI_IGNORES_DEFAUT.slice()
  };
}
function lireTri_() {
  var r = triReglages_();
  r.categories = TRI_CATEGORIES.map(function (c) { return { cle: c.cle, nom: c.nom, action: c.action, type: c.type || '', defaut: c.mots }; });
  r.defaut = { sensibles: TRI_SENSIBLES_DEFAUT, ignores: TRI_IGNORES_DEFAUT };
  return r;
}
function nettoyerListe_(l) {
  return (Array.isArray(l) ? l : String(l || '').split(/[\n,;]/)).map(function (x) { return String(x).trim().toLowerCase(); }).filter(String);
}
function ecrireTri_(p, s) {
  var r = triReglages_();
  var avant = r.actif;
  if (p.actif !== undefined) r.actif = p.actif === true;
  if (p.envoi_auto !== undefined) r.envoi_auto = p.envoi_auto === true;
  if (p.mots) TRI_CATEGORIES.forEach(function (c) { if (p.mots[c.cle] !== undefined) r.mots[c.cle] = nettoyerListe_(p.mots[c.cle]); });
  if (p.desactivees) r.desactivees = p.desactivees.filter(function (k) { return TRI_CATEGORIES.some(function (c) { return c.cle === k; }); });
  if (p.sensibles !== undefined) r.sensibles = nettoyerListe_(p.sensibles);
  if (p.ignores !== undefined) r.ignores = nettoyerListe_(p.ignores);
  props_().setProperty('TRI', JSON.stringify(r));
  if (r.actif !== avant) {
    activerDeclencheurTri_(r.actif);
    if (r.actif) marquerExistantsCommeVus_();
    journaliser_(s, r.actif ? 'Tri automatique activé' : 'Tri automatique désactivé', '');
  } else journaliser_(s, 'Tri automatique : règles modifiées', '');
  return lireTri_();
}

function activerDeclencheurTri_(actif) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'trierMailsEntrants') ScriptApp.deleteTrigger(t);
  });
  if (actif) ScriptApp.newTrigger('trierMailsEntrants').timeBased().everyMinutes(5).create();
}

// ─── Analyse du texte ───

function normaliser_(t) {
  return ' ' + String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`]/g, "'").replace(/\s+/g, ' ') + ' ';
}
function motifMot_(mot) {
  var m = normaliser_(mot).trim();
  var joker = /\*$/.test(m);
  m = m.replace(/\*$/, '').replace(/[.?+^$()[\]{}|\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp('(^|[^a-z0-9])(' + m + (joker ? '[a-z0-9]*' : '') + ')(?=[^a-z0-9]|$)', 'g');
}
/** Retire la partie citée d'une réponse (« Le … a écrit : », lignes « > »). */
function texteUtile_(corps) {
  var t = String(corps || '');
  var coupe = t.search(/\n\s*(le .{5,120}a [ée]crit ?:|on .{5,120}wrote ?:|-{2,} ?(message d'origine|original message|forwarded message)|de ?: .+\n.*envoy[ée] ?:)/i);
  if (coupe > 0) t = t.slice(0, coupe);
  return t.split('\n').filter(function (l) { return !/^\s*>/.test(l); }).join('\n').slice(0, 8000);
}
function trouverMots_(texte, mots) {
  var trouves = [];
  (mots || []).forEach(function (mot) {
    if (!mot) return;
    var re = motifMot_(mot);
    if (re.test(texte)) trouves.push(mot);
  });
  return trouves;
}
function masquer_(texte, mots) {
  (mots || []).forEach(function (mot) { texte = texte.replace(motifMot_(mot), '$1 '); });
  return texte;
}

/** Classe un texte. Retourne { categories: [cle], mots: {cle: [...]}, sensibles: [...] }. */
function classerTexte_(sujet, corps, r) {
  r = r || triReglages_();
  var brut = normaliser_((sujet || '') + '\n' + texteUtile_(corps));
  var texte = brut, res = { categories: [], mots: {}, sensibles: trouverMots_(brut, r.sensibles) };
  TRI_CATEGORIES.forEach(function (c) {
    if (r.desactivees.indexOf(c.cle) > -1) return;
    var t = trouverMots_(texte, r.mots[c.cle]);
    if (t.length) { res.categories.push(c.cle); res.mots[c.cle] = t; texte = masquer_(texte, t); }
  });
  return res;
}
function testerTri_(p) {
  var res = classerTexte_(p.sujet || '', p.texte || '');
  res.envoiAuto = triReglages_().envoi_auto && res.categories.indexOf('horaires') > -1 && !res.sensibles.length;
  return res;
}

// ─── Mails ───

function adresseDe_(de) { var m = String(de || '').match(/<([^>]+)>/); return (m ? m[1] : String(de || '')).trim().toLowerCase(); }
function nomDe_(de) { var m = String(de || '').match(/^\s*"?([^"<]+?)"?\s*</); return m ? m[1].trim() : ''; }

/** Adresse Gmail du compte qui fait tourner le serveur.
 *  Session.getEffectiveUser() exige l'autorisation userinfo.email, absente du manifeste :
 *  on lit d'abord l'identifiant de l'agenda principal (= l'adresse du compte), autorisé par le scope calendar. */
function adresseDuCompte_() {
  try { var id = CalendarApp.getDefaultCalendar().getId(); if (/@/.test(id)) return id; } catch (e) {}
  try { return Session.getEffectiveUser().getEmail(); } catch (e) {}
  return '';
}

function mesAdresses_() {
  var c = CacheService.getScriptCache(), v = c.get('mes_adresses');
  if (v) return JSON.parse(v);
  var l = [adresseDuCompte_(), CONFIG.ALIAS].concat(GmailApp.getAliases()).filter(Boolean).map(function (a) { return String(a).toLowerCase(); });
  c.put('mes_adresses', JSON.stringify(l), 21600);
  return l;
}

/** Vrai pour newsletters, listes, notifications, no-reply et adresses ignorées. */
function estEnvoiAutomatique_(m, r) {
  var de = adresseDe_(m.getFrom());
  if ((r.ignores || []).some(function (x) { return x && de.indexOf(x) > -1; })) return true;
  var h = function (n) { try { return String(m.getHeader(n) || '').toLowerCase(); } catch (e) { return ''; } };
  if (h('List-Unsubscribe') || h('List-Id')) return true;
  if (/bulk|list|junk/.test(h('Precedence'))) return true;
  var auto = h('Auto-Submitted');
  if (auto && auto !== 'no') return true;
  if (h('X-Autoreply') || h('X-Autorespond')) return true;
  return false;
}

function libelleTri_(nom) {
  var complet = TRI_RACINE + '/' + nom;
  var l = GmailApp.getUserLabelByName(complet);
  if (l) return l;
  if (!GmailApp.getUserLabelByName(TRI_RACINE)) GmailApp.createLabel(TRI_RACINE);
  return GmailApp.createLabel(complet);
}

function remplirModeleServeur_(t, ctx) {
  return String(t || '').replace(/\{(\w+)\}/g, function (m, k) { return ctx[k] !== undefined ? ctx[k] : ''; });
}

/** Messages déjà analysés (ids), pour ne jamais traiter deux fois le même. */
function vusTri_() { return json2_(props_().getProperty('TRI_VUS'), []); }
function enregistrerVus_(l) { props_().setProperty('TRI_VUS', JSON.stringify(l.slice(-400))); }
function marquerExistantsCommeVus_() {
  var vus = vusTri_();
  GmailApp.search('in:inbox newer_than:2d', 0, 100).forEach(function (t) {
    t.getMessages().forEach(function (m) { if (vus.indexOf(m.getId()) === -1) vus.push(m.getId()); });
  });
  enregistrerVus_(vus);
}

/** Point d'entrée du déclencheur (toutes les 5 minutes). */
function trierMailsEntrants() {
  var r = triReglages_();
  if (!r.actif) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var vus = vusTri_(), moi = mesAdresses_();
    GmailApp.search('in:inbox newer_than:1d', 0, 40).reverse().forEach(function (t) {
      var msgs = t.getMessages(), m = msgs[msgs.length - 1];
      if (vus.indexOf(m.getId()) > -1) return;
      vus.push(m.getId());
      try { traiterMessage_(t, m, msgs.length, r, moi); } catch (e) { console.error('tri', t.getId(), e); }
    });
    enregistrerVus_(vus);
  } finally { lock.releaseLock(); }
}

function traiterMessage_(t, m, nbMessages, r, moi) {
  var de = adresseDe_(m.getFrom());
  if (moi.indexOf(de) > -1) return null;          // nos propres messages
  if (estEnvoiAutomatique_(m, r)) return null;
  var res = classerTexte_(m.getSubject(), m.getPlainBody(), r);
  res.categories.forEach(function (cle) {
    var c = TRI_CATEGORIES.filter(function (x) { return x.cle === cle; })[0];
    libelleTri_(c.nom).addToThread(t);
  });

  if (res.sensibles.length) {
    libelleTri_(TRI_LIBELLE_PRIORITAIRE).addToThread(t);
    m.star();
    var suivi = suivisParFil_()[t.getId()];
    if (!suivi || !suivi.statut) modifierSuiviMail_({ filId: t.getId(), statut: 'À traiter' }, TRI_SESSION);
    return res;
  }

  // Réponse automatique : demande d'horaires, nouvelle conversation, pas déjà répondu à cette adresse aujourd'hui
  if (r.envoi_auto && res.categories.indexOf('horaires') > -1 && nbMessages === 1) {
    var cache = CacheService.getScriptCache(), cleCache = 'tri_auto_' + de;
    if (cache.get(cleCache)) return res;
    var modele = listerReponses_().filter(function (x) { return x.cle === 'horaires'; })[0];
    if (!modele) return res;
    var ctx = { nom: nomDe_(m.getFrom()), url_horaires: reglages_().url_horaires, type: '', documents_manquants: '' };
    var opts = optionsEnvoi_();
    var texte = remplirModeleServeur_(modele.corps, ctx);
    opts.htmlBody = corpsHtml_(texte, 'paroisse');
    m.createDraftReply(corpsTexte_(texte, 'paroisse'), opts).send();
    cache.put(cleCache, '1', 21600);
    libelleTri_(TRI_LIBELLE_AUTO).addToThread(t);
    modifierSuiviMail_({ filId: t.getId(), statut: 'Traité' }, TRI_SESSION);
    journaliser_(TRI_SESSION, 'Réponse auto envoyée', 'Horaires → ' + de + ' (« ' + m.getSubject() + ' »)');
    res.envoye = true;
  }
  return res;
}

/** Résumé du tri d'un fil, d'après ses étiquettes « Tri/… ». */
function triDuFil_(libelles) {
  var res = { categories: [], prioritaire: false, auto: false };
  (libelles || []).forEach(function (l) {
    if (l.indexOf(TRI_RACINE + '/') !== 0) return;
    var nom = l.slice(TRI_RACINE.length + 1);
    if (nom === TRI_LIBELLE_PRIORITAIRE) res.prioritaire = true;
    else if (nom === TRI_LIBELLE_AUTO) res.auto = true;
    else TRI_CATEGORIES.forEach(function (c) { if (c.nom === nom) res.categories.push(c.cle); });
  });
  return res;
}
