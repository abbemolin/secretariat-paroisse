/**
 * App des paroissiens — mur de prière.
 *  - Intentions de prière anonymes, visibles des paroissiens connectés ; gardées 6 mois (RGPD).
 *  - Modérateur automatique maison (sans IA) : coordonnées, liens, noms de personnes, mots déplacés,
 *    sujets graves → mise de côté pour relecture par le curé, un prêtre ou la secrétaire ; sinon publiée.
 *  - « Je prie pour cette intention » (compteur ; le déposant voit combien prient), « Signaler »
 *    (masquée après 2 signalements, en attendant la relecture), « Retirer », « Prière exaucée ».
 *  - 3 intentions par semaine et par personne ; les lycéens prient mais ne déposent pas.
 *  - L'équipe voit l'auteur dans le secrétariat ; les paroissiens jamais.
 */

var COLONNES_PRIERES = ['id', 'cree_le', 'auteur', 'auteur_nom', 'texte', 'statut', 'raisons', 'priants', 'signalements', 'exaucee_le', 'grace', 'relu_par', 'relu_le', 'maj_le'];
var PRIERE_MAX = 1000, PRIERE_SEMAINE = 3, PRIERE_JOURS = 183;
var MOTS_DEPLACES_ = ['con', 'conne', 'connard', 'connasse', 'salope', 'pute', 'putain', 'merde', 'encule', 'enculé', 'bite', 'nique', 'niquer', 'batard', 'bâtard', 'pd', 'nazi', 'fdp', 'ntm'];
var MOTS_RELECTURE_ = ['suicide', 'suicider', 'tuer', 'violence', 'viol', 'abus', 'agression', 'police', 'plainte', 'procès', 'avocat', 'argent', 'virement', 'cagnotte',
  'vote', 'voter', 'élection', 'election', 'parti', 'gouvernement', 'manifestation'];
// Mots à majuscule qui ne désignent pas une personne à protéger
var MOTS_SAINTS_ = ['dieu', 'jesus', 'christ', 'seigneur', 'marie', 'vierge', 'notre', 'dame', 'saint', 'sainte', 'saints', 'esprit', 'pere', 'fils', 'eglise', 'pape', 'joseph', 'michel', 'croix', 'glorieuse', 'sacre', 'coeur', 'immaculee', 'lourdes', 'fatima', 'noel', 'paques', 'avent', 'careme', 'toussaint', 'pentecote'];

function feuillePrieres_() { var f = feuilleEsp_('Prieres', COLONNES_PRIERES); completerColonnes_(f, COLONNES_PRIERES); return f; }
function lignesPrieres_() { feuillePrieres_(); return lignes_('Prieres'); }

/** Raisons de mettre une intention de côté (vide = publiable). */
function moderationPriere_(texte) {
  var t = String(texte || ''), bas = sansAccents_(t).toLowerCase(), r = [];
  var mots = bas.split(/[^a-z0-9]+/).filter(String);
  if (/(?:\+33|\b0)\s*[1-9](?:[\s.\-]*\d{2}){4}\b/.test(t) || /\b\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}\b/.test(t)) r.push('numéro de téléphone');
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t) || /\barobase\b/i.test(bas)) r.push('adresse e-mail');
  if (/(https?:\/\/|www\.|\.(fr|com|org|net)\b)/i.test(t)) r.push('lien');
  if (/\bFR\d{2}[\s]?\d{4}/i.test(t.replace(/\s/g, ' '))) r.push('coordonnées bancaires');
  // Prénom + nom (deux mots à majuscule qui se suivent, hors début de phrase) : la personne pourrait être reconnue
  var phrases = t.split(/[.!?\n]+/), nomTrouve = false;
  phrases.forEach(function (ph) {
    var m, re = /(\S)\s+([A-ZÀ-Ý][a-zà-ÿ'-]+)\s+([A-ZÀ-Ý][A-Za-zà-ÿ'-]+)/g, s = ph.trim();
    while ((m = re.exec(s))) { if (MOTS_SAINTS_.indexOf(sansAccents_(m[2])) === -1 && MOTS_SAINTS_.indexOf(sansAccents_(m[3])) === -1) nomTrouve = true; re.lastIndex = m.index + m[1].length + 1; }
  });
  if (nomTrouve) r.push('nom de personne');
  if (mots.some(function (m) { return MOTS_DEPLACES_.map(function (x) { return sansAccents_(x); }).indexOf(m) > -1; })) r.push('mot déplacé');
  var sujets = MOTS_RELECTURE_.filter(function (x) { var y = sansAccents_(x).toLowerCase(); return y.indexOf(' ') > -1 ? bas.indexOf(y) > -1 : mots.indexOf(y) > -1; });
  if (sujets.length) r.push('sujet à relire (' + sujets.slice(0, 3).join(', ') + ')');
  if ((t.match(/[A-ZÀ-Ý]/g) || []).length > 20 && t === t.toUpperCase()) r.push('tout en majuscules');
  return r;
}

function priereVue_(x, uid, moi) {
  var priants = json2_(x.priants, []);
  var v = { id: x.id, date: String(x.cree_le).slice(0, 10), texte: x.texte, priants: priants.length, je_prie: priants.indexOf(uid) > -1,
    exaucee: !!x.exaucee_le, grace: x.grace || '', a_signale: json2_(x.signalements, []).indexOf(uid) > -1 };
  if (moi) { v.mienne = true; v.statut = x.statut; }
  return v;
}
/** Mur (publiées depuis 6 mois) et mes intentions. qui : { uid, nom, mineur } */
function murPriere_(qui) {
  var limite = new Date(Date.now() - PRIERE_JOURS * 86400000).toISOString(), toutes = lignesPrieres_();
  var mur = toutes.filter(function (x) { return x.statut === 'publiee' && x.cree_le >= limite; })
    .sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); }).slice(0, 200)
    .map(function (x) { return priereVue_(x, qui.uid, x.auteur === qui.uid); });
  var miennes = toutes.filter(function (x) { return x.auteur === qui.uid && x.statut !== 'retiree'; })
    .sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); }).map(function (x) { return priereVue_(x, qui.uid, true); });
  return { mur: mur, miennes: miennes, peut_deposer: !qui.mineur, par_semaine: PRIERE_SEMAINE };
}
function actionPriere_(qui, action, p) {
  if (action === 'mur') return murPriere_(qui);
  if (action === 'deposer') {
    if (qui.mineur) throw erreur_('INTERDIT', 'Les lycéens peuvent prier pour les intentions du mur, mais pas en déposer.');
    var texte = String(p.texte || '').trim();
    if (texte.length < 5) throw erreur_('INVALIDE', 'Écrivez votre intention en quelques mots.');
    if (texte.length > PRIERE_MAX) throw erreur_('INVALIDE', PRIERE_MAX + ' caractères au plus.');
    var semaine = new Date(Date.now() - 7 * 86400000).toISOString();
    if (lignesPrieres_().filter(function (x) { return x.auteur === qui.uid && x.cree_le >= semaine; }).length >= PRIERE_SEMAINE)
      throw erreur_('LIMITE', PRIERE_SEMAINE + ' intentions par semaine au plus. Vous pourrez en déposer une autre dans quelques jours.');
    var raisons = moderationPriere_(texte);
    verrou_(function () {
      ecrireLigne_('Prieres', { id: uid_(), cree_le: maintenant_(), auteur: qui.uid, auteur_nom: qui.nom, texte: texte, statut: raisons.length ? 'relecture' : 'publiee',
        raisons: JSON.stringify(raisons), priants: '[]', signalements: '[]', maj_le: maintenant_() });
    });
    if (raisons.length) prevenirValidateurs_('Mur de prière : intention à relire', raisons.join(', '));
    var r = murPriere_(qui); r.relecture = raisons.length > 0; return r;
  }
  var x = lignesPrieres_().filter(function (y) { return y.id === p.id; })[0];
  if (!x) throw erreur_('INTROUVABLE', 'Intention introuvable.');
  if (action === 'prier') {
    if (x.statut !== 'publiee') throw erreur_('INVALIDE', 'Cette intention n\'est plus sur le mur.');
    verrou_(function () {
      var y = lignesPrieres_().filter(function (z) { return z.id === p.id; })[0], l = json2_(y.priants, []), k = l.indexOf(qui.uid);
      if (k > -1) l.splice(k, 1); else l.push(qui.uid);
      y.priants = JSON.stringify(l); ecrireLigne_('Prieres', y);
    });
    return murPriere_(qui);
  }
  if (action === 'signaler') {
    if (x.auteur === qui.uid) throw erreur_('INVALIDE', 'Vous pouvez retirer votre intention.');
    var masquee = false;
    verrou_(function () {
      var y = lignesPrieres_().filter(function (z) { return z.id === p.id; })[0], l = json2_(y.signalements, []);
      if (l.indexOf(qui.uid) === -1) l.push(qui.uid);
      y.signalements = JSON.stringify(l);
      if (l.length >= 2 && y.statut === 'publiee') { y.statut = 'masquee'; masquee = true; }
      ecrireLigne_('Prieres', y);
    });
    prevenirValidateurs_('Mur de prière : intention signalée', masquee ? 'Masquée après 2 signalements : à relire.' : 'Un paroissien a signalé une intention.');
    return murPriere_(qui);
  }
  if (x.auteur !== qui.uid) throw erreur_('INTERDIT', 'Ce n\'est pas votre intention.');
  if (action === 'retirer') {
    verrou_(function () { var y = lignesPrieres_().filter(function (z) { return z.id === p.id; })[0]; feuille_('Prieres').deleteRow(y._ligne); oublierLignes_('Prieres'); });
    return murPriere_(qui);
  }
  if (action === 'exaucee') {
    var grace = String(p.grace || '').trim().slice(0, 500), rais = grace ? moderationPriere_(grace) : [];
    verrou_(function () {
      var y = lignesPrieres_().filter(function (z) { return z.id === p.id; })[0];
      y.exaucee_le = maintenant_(); y.grace = grace;
      if (rais.length && y.statut === 'publiee') { y.statut = 'relecture'; y.raisons = JSON.stringify(rais); }
      y.maj_le = maintenant_(); ecrireLigne_('Prieres', y);
    });
    if (rais.length) prevenirValidateurs_('Mur de prière : action de grâce à relire', rais.join(', '));
    return murPriere_(qui);
  }
  throw erreur_('ACTION', 'Action inconnue.');
}
function quiCompte_(x) { return { uid: 'cpt:' + x.id, nom: ((x.prenom || '') + ' ' + (x.nom || '')).trim(), mineur: !!(json2_(x.demande, {}) || {}).mineur }; }
function quiEspace_(d) { var i = json2_(d.donnees, {}).infos || {}; return { uid: 'esp:' + d.id, nom: ((i.prenoms || '') + ' ' + (i.nom || '')).trim() || d.nom, mineur: false }; }

// ─── Secrétariat : relecture ───

function prieresEquipe_() {
  var limite = new Date(Date.now() - PRIERE_JOURS * 86400000).toISOString();
  return lignesPrieres_().filter(function (x) { return x.cree_le >= limite || x.statut === 'relecture' || x.statut === 'masquee'; })
    .sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); })
    .map(function (x) { return { id: x.id, cree_le: x.cree_le, auteur: x.auteur_nom, texte: x.texte, statut: x.statut, raisons: json2_(x.raisons, []), priants: json2_(x.priants, []).length,
      signalements: json2_(x.signalements, []).length, exaucee_le: x.exaucee_le, grace: x.grace, relu_par: x.relu_par }; });
}
function modererPriere_(p, s) {
  var op = String(p.op || '');
  verrou_(function () {
    var y = lignesPrieres_().filter(function (z) { return z.id === p.id; })[0];
    if (!y) throw erreur_('INTROUVABLE', 'Intention introuvable.');
    if (op === 'publier') { y.statut = 'publiee'; y.signalements = '[]'; }
    else if (op === 'refuser') y.statut = 'refusee';
    else if (op === 'supprimer') { feuille_('Prieres').deleteRow(y._ligne); oublierLignes_('Prieres'); return; }
    else throw erreur_('INVALIDE', 'Opération inconnue.');
    y.relu_par = s.nom; y.relu_le = maintenant_(); y.maj_le = maintenant_();
    ecrireLigne_('Prieres', y);
  });
  journaliser_(s, 'Mur de prière : ' + op, '');
  return prieresEquipe_();
}
/** Entretien de nuit : intentions de plus de 6 mois effacées (RGPD). */
function entretienPrieres_() {
  if (!db_().getSheetByName('Prieres')) return;
  var limite = new Date(Date.now() - PRIERE_JOURS * 86400000).toISOString(), n = 0;
  verrou_(function () {
    lignes_('Prieres').slice().reverse().forEach(function (x) { if (x.cree_le < limite) { feuille_('Prieres').deleteRow(x._ligne); n++; } });
    oublierLignes_('Prieres');
  });
  if (n) journaliser_(null, 'Mur de prière : entretien RGPD', n + ' intention(s) effacée(s)');
}
