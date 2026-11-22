/**
 * Paiements en ligne avec HelloAsso (API « Checkout »).
 *
 * L'appli calcule toujours le montant côté serveur, crée une « intention de paiement » HelloAsso et renvoie
 * vers la page de paiement HelloAsso. Au retour (page secretariat.croix-glorieuse.org/paiement/), à la
 * notification HelloAsso, ou au plus tard au passage du contrôle automatique (toutes les 15 min), le serveur
 * interroge lui-même HelloAsso : seul ce contrôle marque un paiement comme reçu (les paramètres de retour
 * peuvent être falsifiés).
 *
 * Objets payables : cotisation du catéchisme (par famille), commande de livres, retraite (partie retraite),
 * participation aux frais de la cérémonie d'une retraite.
 */

var HA_API = { prod: 'https://api.helloasso.com', sandbox: 'https://api.helloasso-sandbox.com' };
var COLONNES_PAIEMENTS = ['id', 'cree_le', 'objet', 'cible', 'montant', 'libelle', 'intent_id', 'statut', 'order_id', 'email', 'maj_le', 'detail'];

// ─── Réglages ───

function haReglages_() {
  var r = json2_(props_().getProperty('HELLOASSO'), {});
  return { actif: r.actif === true, slug: r.slug || '', client_id: r.client_id || '', sandbox: r.sandbox === true, hors_ligne: r.hors_ligne || '' };
}
function haActif_() { var r = haReglages_(); return r.actif && r.slug && r.client_id && !!props_().getProperty('HELLOASSO_SECRET'); }
function lireHaReglages_() {
  var r = haReglages_();
  r.secret_ok = !!props_().getProperty('HELLOASSO_SECRET');
  try { r.url_notification = ScriptApp.getService().getUrl(); } catch (e) { r.url_notification = ''; }
  r.url_boutique = urlPublique_('livres/');
  feuillePaiements_();
  r.derniers = lignes_('Paiements').slice(-30).reverse().map(function (x) {
    return { id: x.id, date: x.cree_le, objet: x.objet, libelle: x.libelle, montant: nombre_(x.montant), statut: x.statut, email: x.email };
  });
  return r;
}
function ecrireHaReglages_(p, s) {
  var r = haReglages_();
  ['slug', 'client_id', 'hors_ligne'].forEach(function (k) { if (p[k] !== undefined) r[k] = String(p[k] || '').trim(); });
  r.slug = r.slug.replace(/^https?:\/\/[^/]+\/associations\//, '').replace(/\/.*$/, '');
  if (p.sandbox !== undefined) r.sandbox = p.sandbox === true;
  if (p.actif !== undefined) r.actif = p.actif === true;
  if (p.client_secret) props_().setProperty('HELLOASSO_SECRET', String(p.client_secret).trim());
  props_().setProperty('HELLOASSO', JSON.stringify(r));
  CacheService.getScriptCache().remove('ha_token');
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'verifierPaiementsHelloAsso') ScriptApp.deleteTrigger(t); });
  if (r.actif) ScriptApp.newTrigger('verifierPaiementsHelloAsso').timeBased().everyMinutes(15).create();
  journaliser_(s, 'Paiements en ligne : réglages modifiés', r.actif ? 'activés' : 'désactivés');
  return lireHaReglages_();
}
/** Essai de connexion : jeton + lecture de l'association. */
function testerHelloAsso_() {
  var r = haReglages_();
  CacheService.getScriptCache().remove('ha_token');
  var o = haApi_('get', '/v5/organizations/' + encodeURIComponent(r.slug));
  return { nom: o.name || r.slug, ville: o.city || '', mode: r.sandbox ? 'essai (sandbox)' : 'réel' };
}

// ─── Accès à l'API ───

function haBase_() { return haReglages_().sandbox ? HA_API.sandbox : HA_API.prod; }
function haToken_() {
  var cache = CacheService.getScriptCache(), t = cache.get('ha_token');
  if (t) return t;
  var r = haReglages_(), secret = props_().getProperty('HELLOASSO_SECRET');
  if (!r.client_id || !secret) throw erreur_('HELLOASSO', 'Paiement en ligne non configuré (Réglages → Paiements en ligne).');
  var rep = UrlFetchApp.fetch(haBase_() + '/oauth2/token', {
    method: 'post', muteHttpExceptions: true, contentType: 'application/x-www-form-urlencoded',
    payload: { grant_type: 'client_credentials', client_id: r.client_id, client_secret: secret }
  });
  if (rep.getResponseCode() !== 200) throw erreur_('HELLOASSO', 'Connexion à HelloAsso refusée : vérifiez l\'identifiant et le secret de l\'API.');
  var j = JSON.parse(rep.getContentText());
  cache.put('ha_token', j.access_token, Math.max(60, Number(j.expires_in || 1800) - 120));
  return j.access_token;
}
function haApi_(methode, chemin, corps) {
  var o = { method: methode, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + haToken_() }, contentType: 'application/json' };
  if (corps) o.payload = JSON.stringify(corps);
  var rep = UrlFetchApp.fetch(haBase_() + chemin, o);
  var code = rep.getResponseCode(), txt = rep.getContentText();
  if (code === 401) { CacheService.getScriptCache().remove('ha_token'); }
  if (code >= 300) {
    var msg = '';
    try { var j = JSON.parse(txt); msg = j.message || (j.errors && j.errors.map(function (e) { return e.message; }).join(' ; ')) || ''; } catch (e) {}
    if (code === 409) msg = 'Le compte HelloAsso ne peut pas encore recevoir de paiements (vérification du compte).';
    throw erreur_('HELLOASSO', 'HelloAsso (' + code + ') : ' + (msg || 'erreur'));
  }
  return txt ? JSON.parse(txt) : {};
}

// ─── Paiements (feuille « Paiements ») ───

function feuillePaiements_() {
  var f = db_().getSheetByName('Paiements');
  if (!f) { f = db_().insertSheet('Paiements'); f.getRange('A:Z').setNumberFormat('@'); f.appendRow(COLONNES_PAIEMENTS); f.setFrozenRows(1); }
  return f;
}
function urlPublique_(chemin) {
  return String(reglages_().url_formulaires || 'https://secretariat.croix-glorieuse.org/').replace(/\/?$/, '/') + chemin;
}
function urlPaiement_(params) {
  return urlPublique_('paiement/') + '?' + Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
}
/** Nom acceptable par HelloAsso (lettres, espaces, tirets, apostrophes ; prénom ≠ nom). */
function nomPayeur_(t) { var v = String(t || '').trim(); return /^[A-Za-zÀ-ÿ' -]{2,}$/.test(v) ? v : ''; }

/** Crée l'intention de paiement HelloAsso et renvoie l'adresse de la page de paiement. */
function creerPaiementEnLigne_(o) {
  if (!haActif_()) throw erreur_('HELLOASSO', 'Le paiement en ligne n\'est pas encore activé. Merci de payer par chèque ou en espèces auprès de la paroisse.');
  var centimes = Math.round(nombre_(o.montant) * 100);
  if (centimes < 100) throw erreur_('MONTANT', 'Il n\'y a rien à payer en ligne (ou moins d\'1 €).');
  feuillePaiements_();
  var x = { id: uid_(), cree_le: maintenant_(), objet: o.objet, cible: JSON.stringify(o.cible), montant: String(centimes / 100), libelle: String(o.libelle).slice(0, 240),
            intent_id: '', statut: 'cree', order_id: '', email: o.email || '', maj_le: maintenant_(), detail: '' };
  verrou_(function () { ecrireLigne_('Paiements', x); });
  var payer = {}, pr = nomPayeur_(o.prenom), nm = nomPayeur_(o.nom);
  if (pr && nm && pr.toLowerCase() !== nm.toLowerCase()) { payer.firstName = pr; payer.lastName = nm; }
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.email || '')) payer.email = o.email;
  var corps = {
    totalAmount: centimes, initialAmount: centimes, itemName: x.libelle, containsDonation: false,
    backUrl: urlPaiement_({ p: x.id, t: 'annule' }), errorUrl: urlPaiement_({ p: x.id, t: 'erreur' }), returnUrl: urlPaiement_({ p: x.id, t: 'retour' }),
    metadata: { paiement: x.id, objet: o.objet }
  };
  if (Object.keys(payer).length) corps.payer = payer;
  var rep;
  try { rep = haApi_('post', '/v5/organizations/' + encodeURIComponent(haReglages_().slug) + '/checkout-intents', corps); }
  catch (e) {
    // un nom refusé par HelloAsso ne doit pas bloquer le paiement : on réessaie sans pré-remplissage
    if (corps.payer && /payer|firstName|lastName|email/i.test(e.message)) { delete corps.payer; rep = haApi_('post', '/v5/organizations/' + encodeURIComponent(haReglages_().slug) + '/checkout-intents', corps); }
    else throw e;
  }
  verrou_(function () {
    var y = lignes_('Paiements').filter(function (z) { return z.id === x.id; })[0];
    y.intent_id = String(rep.id || rep.checkoutIntentId || ''); y.statut = 'en_attente'; y.maj_le = maintenant_();
    ecrireLigne_('Paiements', y);
  });
  return { url: rep.redirectUrl, paiement: x.id };
}

/** Interroge HelloAsso ; marque le paiement comme reçu et l'inscrit sur la cible (une seule fois). */
function verifierPaiement_(id) {
  var x = lignes_('Paiements').filter(function (z) { return z.id === id; })[0];
  if (!x) throw erreur_('INTROUVABLE', 'Paiement introuvable.');
  if (x.statut === 'paye' || !x.intent_id) return x;
  var r = haApi_('get', '/v5/organizations/' + encodeURIComponent(haReglages_().slug) + '/checkout-intents/' + encodeURIComponent(x.intent_id));
  var ordre = r.order;
  var ok = ordre && (ordre.payments || []).some(function (p) { return /^(Authorized|Registered)$/i.test(p.state || ''); });
  if (!ok && ordre && !(ordre.payments || []).length) ok = true;     // commande créée sans détail des paiements
  if (!ok) return x;
  var montant = ordre.amount && ordre.amount.total ? ordre.amount.total / 100 : nombre_(x.montant);
  verrou_(function () {
    var y = lignes_('Paiements').filter(function (z) { return z.id === id; })[0];
    if (y.statut === 'paye') return;
    y.statut = 'paye'; y.order_id = String(ordre.id || ''); y.maj_le = maintenant_(); y.montant = String(montant);
    ecrireLigne_('Paiements', y);
    appliquerPaiement_(y, montant);
    x = y;
  });
  try {
    lignes_('Utilisateurs').filter(estActif_).forEach(function (u) { notifier_(u.id, 'Paiement en ligne reçu', x.libelle + ' : ' + montant + ' €', lienObjetPaiement_(x)); });
  } catch (e) {}
  return x;
}
function lienObjetPaiement_(x) {
  var c = json2_(x.cible, {});
  if (x.objet === 'retraite' || x.objet === 'ceremonie') return '#/retraites/' + (c.retraite || '');
  if (x.objet === 'livres') return '#/catechisme?vue=livres';
  return '#/catechisme';
}
function appliquerPaiement_(x, montant) {
  var c = json2_(x.cible, {});
  var ligne = function (part) { return { id: uid_(), date: aujourdhui_(), montant: montant, mode: 'HelloAsso', par: 'Paiement en ligne', ref: x.order_id, part: part || '' }; };
  if (x.objet === 'cate') {
    // réparti entre les enfants de la famille, dans l'ordre, selon ce qui reste à payer
    var reste = montant;
    (c.ids || []).forEach(function (id, i) {
      var ins = lignes_('Catechisme').filter(function (z) { return z.id === id; })[0];
      if (!ins || reste <= 0) return;
      var r = resumeInscription_(ins);
      var part = i === c.ids.length - 1 ? reste : Math.min(reste, Math.max(0, r.reste));
      if (part <= 0) return;
      var l = json2_(ins.paiements, []); var p = ligne(); p.montant = Math.round(part * 100) / 100; l.push(p);
      ins.paiements = JSON.stringify(l); ins.maj_le = maintenant_(); ins.maj_par = 'Paiement en ligne';
      ecrireInscription_(ins);
      reste -= part;
    });
  } else if (x.objet === 'livres') {
    payerCommande_(c.commande, ligne());
  } else if (x.objet === 'retraite' || x.objet === 'ceremonie') {
    var y = lignes_('RetraitesInscrits').filter(function (z) { return z.id === c.inscription; })[0];
    if (!y) return;
    var l2 = json2_(y.paiements, []); l2.push(ligne(x.objet === 'ceremonie' ? 'ceremonie' : 'retraite'));
    y.paiements = JSON.stringify(l2); y.maj_le = maintenant_();
    ecrireLigne_('RetraitesInscrits', y);
  }
}

/** Contrôle automatique (toutes les 15 min) : paiements en attente de moins de 3 jours. */
function verifierPaiementsHelloAsso() {
  if (!haActif_()) return;
  var limite = new Date(Date.now() - 3 * 86400000).toISOString();
  lignes_('Paiements').filter(function (x) { return x.statut === 'en_attente'; }).forEach(function (x) {
    if (x.cree_le < limite) {
      verrou_(function () { var y = lignes_('Paiements').filter(function (z) { return z.id === x.id; })[0]; y.statut = 'abandonne'; y.maj_le = maintenant_(); ecrireLigne_('Paiements', y); });
      return;
    }
    try { verifierPaiement_(x.id); } catch (e) { console.error(e); }
  });
}

/** Notification envoyée par HelloAsso (Mon compte → Intégrations et API) : on revérifie nous-mêmes. */
function notificationHelloAsso_(req) {
  try {
    var id = (req.metadata && req.metadata.paiement) || '';
    if (!id && req.data && req.data.checkoutIntentId) {
      var x = lignes_('Paiements').filter(function (z) { return z.intent_id === String(req.data.checkoutIntentId); })[0];
      id = x ? x.id : '';
    }
    if (id) verifierPaiement_(id);
  } catch (e) { console.error(e); }
  return json_({ ok: true });
}

// ─── Actions publiques (pages « paiement » et « livres ») ───

function signerFamille_(email) {
  return hex_(Utilities.computeHmacSha256Signature('cate|' + String(email).toLowerCase().trim(), secretChef_())).slice(0, 24);
}
function lienPaiementCate_(email) { return urlPaiement_({ o: 'cate', e: String(email).toLowerCase().trim(), k: signerFamille_(email) }); }
function lienBoutique_(email) { return urlPublique_('livres/') + (email ? '?e=' + encodeURIComponent(String(email).toLowerCase().trim()) + '&k=' + signerFamille_(email) : ''); }

function familleCate_(email, k) {
  var e = String(email || '').toLowerCase().trim();
  if (!e || k !== signerFamille_(e)) throw erreur_('LIEN', 'Ce lien n\'est pas valable.');
  feuilleCate_();
  return lignes_('Catechisme').filter(function (x) { return String(x.email || '').toLowerCase().split(/[\s,;]+/).indexOf(e) > -1; });
}

function actionPaiementPublique_(action, p) {
  var cache = CacheService.getScriptCache(), cle = 'pay_' + String(p.e || p.m || p.c || p.p || 'x').slice(0, 40);
  var n = Number(cache.get(cle) || 0);
  if (n > 60) throw erreur_('LIMITE', 'Trop de demandes. Réessayez dans une heure.');
  cache.put(cle, String(n + 1), 3600);

  if (action === 'pay.creer') {
    if (p.o === 'cate') {
      var fam = familleCate_(p.e, p.k);
      var annee = fam.map(function (x) { return x.annee; }).sort().reverse()[0];
      var enfants = fam.filter(function (x) { return x.annee === annee && resumeInscription_(x).reste > 0; });
      var total = enfants.reduce(function (a, x) { return a + resumeInscription_(x).reste; }, 0);
      if (total <= 0) return { rien: true, message: 'La cotisation est déjà réglée. Merci !' };
      return creerPaiementEnLigne_({ objet: 'cate', cible: { ids: enfants.map(function (x) { return x.id; }) }, montant: total,
        libelle: 'Catéchisme ' + annee + ' – ' + enfants.map(function (x) { return x.prenoms; }).join(', '), email: String(p.e), prenom: '', nom: '' });
    }
    if (p.o === 'livres') {
      var cmd = commandeParJeton_(p.c);
      var reste = resteCommande_(cmd);
      if (cmd.statut === 'annulee') throw erreur_('ANNULE', 'Cette commande est annulée.');
      if (reste <= 0) return { rien: true, message: 'Cette commande est déjà réglée. Merci !' };
      var noms = separerPrenomNom_(cmd.nom);
      return creerPaiementEnLigne_({ objet: 'livres', cible: { commande: cmd.id }, montant: reste, libelle: 'Livres du catéchisme – commande ' + cmd.id.slice(0, 6), email: cmd.email, prenom: noms.prenom, nom: noms.nom });
    }
    if (p.o === 'retraite' || p.o === 'ceremonie') {
      var y = inscriptionParJeton_(p.m), r = trouverRetraite_(y.retraite_id);
      if (y.statut === 'annule') throw erreur_('ANNULE', 'Cette inscription est annulée.');
      var m = montantInscription_(r, y);
      var du = p.o === 'ceremonie' ? m.reste_ceremonie : m.reste_retraite;
      if (du <= 0) return { rien: true, message: p.o === 'ceremonie' ? 'La participation est déjà réglée. Merci !' : 'La retraite est déjà réglée. Merci !' };
      var np = separerPrenomNom_(y.contact_nom);
      return creerPaiementEnLigne_({ objet: p.o, cible: { inscription: y.id, retraite: r.id }, montant: du, email: y.contact_email, prenom: np.prenom, nom: np.nom,
        libelle: (p.o === 'ceremonie' ? 'Participation aux frais de la cérémonie – ' : '') + titreRetraite_(r) + ' – ' + json2_(y.participants, []).map(function (q) { return q.prenoms; }).join(', ') });
    }
    throw erreur_('ACTION', 'Paiement inconnu.');
  }
  if (action === 'pay.verifier') {
    var x = lignes_('Paiements').filter(function (z) { return z.id === String(p.p || ''); })[0];
    if (!x) throw erreur_('INTROUVABLE', 'Paiement introuvable.');
    try { x = verifierPaiement_(x.id); } catch (e) { console.error(e); }
    return { statut: x.statut, montant: nombre_(x.montant), libelle: x.libelle, objet: x.objet, paroisse: reglages_().paroisse };
  }
  throw erreur_('ACTION', 'Action inconnue.');
}
function separerPrenomNom_(t) {
  var m = String(t || '').trim().split(/\s+/);
  if (m.length < 2) return { prenom: '', nom: m[0] || '' };
  var i = m.findIndex(function (w) { return w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w); });
  if (i > 0) return { prenom: m.slice(0, i).join(' '), nom: m.slice(i).join(' ') };
  return { prenom: m.slice(0, -1).join(' '), nom: m[m.length - 1] };
}
