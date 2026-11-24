/**
 * Comptes des paroissiens — app « La Croix glorieuse » (app.croix-glorieuse.org).
 *
 * Un compte par adulte (une adresse mail par compte), indépendant des dossiers :
 *  - demande d'accès depuis l'app (mail confirmé par code), rapprochée des fichiers de la paroisse,
 *    validée par le curé, un prêtre ou la secrétaire (page « App des paroissiens ») ;
 *  - ou invitation directe depuis le secrétariat (fiches Cor Unum, chefs de fraternité) ;
 *  - connexion par mail + mot de passe (10 caractères au moins), session de 90 jours signée,
 *    « Se déconnecter partout » ; les anciens liens personnels (?c=) restent valables.
 * Les catéchumènes et néophytes retrouvent leur espace (pont vers Espace.gs) ; les chefs ouvrent la page
 * de leur fraternité sans mot de passe commun (pont vers CorUnum.gs).
 * RGPD : page Confidentialité acceptée à l'inscription, « Mes données », « Supprimer mon compte »,
 * charte de confidentialité de l'équipe (une fois par an), effacements automatiques (Entretien.gs).
 */

var COLONNES_COMPTES = ['id', 'mail', 'prenom', 'nom', 'telephone', 'statut', 'dossier_id', 'cor_ids', 'hash', 'sel', 'mdp_maj', 'session_v',
  'jeton', 'jeton_exp', 'demande', 'rapprochement', 'cree_le', 'valide_par', 'valide_le', 'motif', 'derniere_visite', 'prefs', 'favoris',
  'confidentialite_le', 'statut_le', 'maj_le'];
// attente : demande à examiner · precisions : précisions demandées · invite : accès accordé, mot de passe à choisir
// actif · refuse · suspendu · desactive (18 mois sans connexion)
var STATUTS_COMPTE = { attente: 'Demande à examiner', precisions: 'Précisions demandées', invite: 'Invité (mot de passe à choisir)', actif: 'Actif',
  refuse: 'Refusé', suspendu: 'Suspendu', desactive: 'Désactivé (inactif)' };
var CPT_SESSION_JOURS = 90;
var CPT_MDP_MIN = 10;
var CPT_INVITATION_JOURS = 30;
var URL_APP_PAROISSIENS = 'https://app.croix-glorieuse.org/';

function feuilleComptes_() {
  var f = feuilleEsp_('Comptes', COLONNES_COMPTES);
  completerColonnes_(f, COLONNES_COMPTES);
  return f;
}
function lignesComptes_() { feuilleComptes_(); return lignes_('Comptes'); }
function compteParId_(id) { return lignesComptes_().filter(function (x) { return x.id === id; })[0] || null; }
function compteParMail_(m) { m = normMail_(m); return m ? lignesComptes_().filter(function (x) { return normMail_(x.mail) === m; })[0] || null : null; }
function compteParDossier_(id) { return id ? lignesComptes_().filter(function (x) { return x.dossier_id === id; })[0] || null : null; }

function normMail_(m) {
  m = String(m || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m) ? m : '';
}
/** Code à 6 chiffres tiré d'un identifiant aléatoire sûr (et non de Math.random). */
function codeSur_() {
  var h = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  return String(100000 + (parseInt(h, 16) % 900000));
}
function secretComptes_() {
  var P = props_(), x = P.getProperty('CPT_SECRET');
  if (!x) { x = jeton_() + jeton_(); P.setProperty('CPT_SECRET', x); }
  return x;
}
function signatureCpt_(texte) { return hex_(Utilities.computeHmacSha256Signature(texte, secretComptes_())).slice(0, 40); }
function verifierMdpCompte_(m) {
  if (String(m || '').length < CPT_MDP_MIN) throw erreur_('MDP', 'Le mot de passe doit contenir au moins ' + CPT_MDP_MIN + ' caractères.');
  if (String(m).length > 200) throw erreur_('MDP', 'Mot de passe trop long.');
}

// ─── Sessions (signées, sans stockage) ───

function nouvelleSessionCpt_(x) {
  var exp = Date.now() + CPT_SESSION_JOURS * 86400000;
  return x.id + '.' + exp + '.' + signatureCpt_('cpt|' + x.id + '|' + exp + '|' + (x.session_v || 0) + '|' + String(x.hash || '').slice(0, 16));
}
/** Compte de la session, ou erreur SESSION. */
function compteDeSession_(session) {
  var p = String(session || '').split('.');
  if (p.length !== 3 || Number(p[1]) < Date.now()) throw erreur_('SESSION', 'Connectez-vous avec votre adresse et votre mot de passe.');
  var x = compteParId_(p[0]);
  if (!x || x.statut !== 'actif' || !x.hash) throw erreur_('SESSION', 'Connectez-vous avec votre adresse et votre mot de passe.');
  if (p[2] !== signatureCpt_('cpt|' + x.id + '|' + p[1] + '|' + (x.session_v || 0) + '|' + String(x.hash).slice(0, 16))) throw erreur_('SESSION', 'Session expirée : reconnectez-vous.');
  return x;
}

// ─── Échecs de connexion : 5 erreurs → 15 minutes de blocage ───

function echecsCpt_(cle) { return Number(CacheService.getScriptCache().get('cptechec_' + cle) || 0); }
function noterEchecCpt_(cle) { var c = CacheService.getScriptCache(); c.put('cptechec_' + cle, String(echecsCpt_(cle) + 1), 900); }
function bloqueCpt_(cle) { if (echecsCpt_(cle) >= 5) throw erreur_('LIMITE', 'Trop d\'erreurs. Réessayez dans un quart d\'heure, ou utilisez « Mot de passe oublié ».'); }

// ─── Mails ───

function mailCompte_(dest, objet, texte, boutons) {
  var opts = optionsEnvoi_();
  GmailApp.sendEmail(dest, objet, corpsTexte_(texte, 'paroisse', boutons), { name: opts.name, from: opts.from, htmlBody: corpsHtml_(texte, 'paroisse', boutons) });
}
var FIN_MAIL_CPT = '\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
var MENTION_RGPD_MAIL = '\n\nVos données sont traitées par la paroisse La Croix glorieuse (responsable : le curé) uniquement pour la vie de la paroisse. ' +
  'Vous pouvez les consulter, les corriger ou demander leur effacement depuis l\'app (Réglages → Mes données) ou en écrivant à secretariat@croix-glorieuse.org.';
function urlInvitation_(j) { return URL_APP_PAROISSIENS + '?i=' + j; }
function envoyerInvitation_(x, motif) {
  var t = 'Bonjour ' + (x.prenom || '') + ',\n\n' + (motif === 'validee'
    ? 'Votre demande d\'accès à l\'application de la paroisse La Croix glorieuse est acceptée. Bienvenue !'
    : 'La paroisse La Croix glorieuse vous invite à rejoindre son application : annonces, agenda, votre fraternité, la Bible et bien d\'autres choses à venir.') +
    '\n\nPour ouvrir votre compte, choisissez votre mot de passe avec le bouton ci-dessous (lien valable ' + CPT_INVITATION_JOURS + ' jours).' +
    '\n\nEnsuite, vous vous connecterez avec votre adresse (' + x.mail + ') et ce mot de passe.' + FIN_MAIL_CPT + MENTION_RGPD_MAIL;
  mailCompte_(x.mail, 'La Croix glorieuse – ' + (motif === 'validee' ? 'votre accès est accepté' : 'invitation à l\'application de la paroisse'), t,
    [{ texte: 'Ouvrir mon compte', url: urlInvitation_(x.jeton) }]);
}

// ─── Rapprochement d'une demande avec les fichiers de la paroisse ───

function chiffres_(t) { return String(t || '').replace(/\D/g, '').replace(/^33/, '0').slice(-9); }
function simple_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, ''); }
function rapprocher_(mail, prenom, nom, tel) {
  var res = [], m = normMail_(mail), t = chiffres_(tel), n = simple_(nom), pr = simple_(prenom);
  var memePersonne = function (email, telephone, nom2, prenoms2) {
    var raisons = [];
    if (m && String(email || '').toLowerCase().split(/[\s,;]+/).indexOf(m) > -1) raisons.push('même adresse');
    if (t.length === 9 && String(telephone || '').split(/[,;/]+/).some(function (z) { return chiffres_(z) === t; })) raisons.push('même téléphone');
    if (n && simple_(nom2) === n && pr && simple_(prenoms2).indexOf(pr) > -1) raisons.push('même nom');
    return raisons;
  };
  try {
    if (db_().getSheetByName('CorUnum')) {
      var r = corReglages_(), vus = {};
      lignes_('CorUnum').sort(function (a, b) { return String(b.annee).localeCompare(String(a.annee)); }).forEach(function (x) {
        var raisons = memePersonne(x.email, x.telephone, x.nom, x.prenoms);
        if (!raisons.length || vus[x.nom + x.prenoms]) return;
        vus[x.nom + x.prenoms] = 1;
        var e = x.equipe_id ? equipesDe_(r, x.annee).filter(function (y) { return y.id === x.equipe_id; })[0] : null;
        res.push({ source: 'Cor Unum ' + x.annee, id: x.id, nom: (x.prenoms + ' ' + x.nom).trim(), detail: (e ? 'fraternité ' + e.nom : 'pas encore dans une fraternité') + (x.statut === 'ancien' ? ' (ancien membre)' : ''), raisons: raisons });
      });
    }
  } catch (e) { console.error('rapprocher Cor', e); }
  try {
    lignes_('Dossiers').forEach(function (d) {
      var i = json2_(d.donnees, {}).infos || {};
      var raisons = memePersonne([d.email, i.email].join(','), [d.telephone, i.telephone].join(','), i.nom || '', i.prenoms || '');
      if (!raisons.length) return;
      res.push({ source: 'Dossier', id: d.id, nom: d.nom, detail: (TYPES_DOSSIER[d.type] || {}).nom || d.type, raisons: raisons });
    });
  } catch (e) { console.error('rapprocher dossiers', e); }
  return res.slice(0, 12);
}

// ─── Personnes de l'équipe qui valident ───

function validateursComptes_() {
  return lignes_('Utilisateurs').filter(estActif_).filter(function (u) { return u.role === 'admin' || accesDe_(u).paroissiens === 'm'; });
}
function prevenirValidateurs_(titre, texte) {
  validateursComptes_().forEach(function (u) { notifier_(u.id, titre, texte, '#/paroissiens'); });
}

// ─── Liens avec Cor Unum (fiches de l'année en cours : par identifiant ou par adresse) ───

function fichesCorDuCompte_(x) {
  if (!db_().getSheetByName('CorUnum')) return [];
  var r = corReglages_(), annee = anneeCorCourante_(r), ids = json2_(x.cor_ids, []), m = normMail_(x.mail);
  return lignes_('CorUnum').filter(function (y) {
    if (y.annee !== annee || y.statut === 'ancien') return false;
    return ids.indexOf(y.id) > -1 || (m && String(y.email || '').toLowerCase().split(/[\s,;]+/).indexOf(m) > -1);
  });
}
/** Fraternités dont la personne est chef (année en cours). */
function equipesChefDuCompte_(x) {
  var fiches = fichesCorDuCompte_(x);
  if (!fiches.length) return [];
  var r = corReglages_(), annee = anneeCorCourante_(r);
  if (assurerJetons_(r)) ecrireCorReglages_(r);
  return equipesDe_(r, annee).filter(function (e) { return (e.chefs || []).some(function (id) { return fiches.some(function (f) { return f.id === id; }); }); });
}
/** Fraternité de la personne (même forme que pour les catéchumènes). */
function fraterniteCompte_(x) {
  var fiches = fichesCorDuCompte_(x);
  if (!fiches.length) return { etat: 'aucune' };
  var r = corReglages_(), annee = anneeCorCourante_(r), toutes = lignes_('CorUnum'), f = fiches[0];
  var e = f.equipe_id ? equipesDe_(r, annee).filter(function (y) { return y.id === f.equipe_id; })[0] : null;
  if (!e) return { etat: 'demande', annee: annee };
  var auj = aujourdhui_();
  return {
    etat: 'membre', annee: annee, equipe: e.nom, chefs: chefsInfos_(e, toutes),
    membres: toutes.filter(function (y) { return y.annee === annee && y.equipe_id === e.id && y.statut !== 'ancien'; })
      .map(function (y) { return { prenoms: y.prenoms, chef: (e.chefs || []).indexOf(y.id) > -1 }; })
      .sort(function (a, b) { return (b.chef - a.chef) || String(a.prenoms).localeCompare(String(b.prenoms), 'fr'); }),
    rencontres: elementsFil_(e.fil).filter(function (y) { return y.type === 'rencontre' && String(y.texte) >= auj; }).map(rencontrePublique_)
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })
  };
}
/** Session de chef signée pour un compte (remplace le mot de passe commun de la fraternité). */
function sessionChefCompte_(fil, x) {
  var exp = Date.now() + 7 * 86400000;
  return exp + '.k' + x.id + '.' + signatureCpt_('chefcpt|' + fil + '|' + exp + '|' + x.id);
}
function sessionChefCompteValide_(fil, session) {
  var p = String(session || '').split('.');
  if (p.length !== 3 || p[1].charAt(0) !== 'k' || Number(p[0]) < Date.now()) return false;
  var id = p[1].slice(1);
  if (p[2] !== signatureCpt_('chefcpt|' + fil + '|' + p[0] + '|' + id)) return false;
  var x = compteParId_(id);
  if (!x || x.statut !== 'actif') return false;
  return equipesChefDuCompte_(x).some(function (e) { return e.fil === fil; });
}

// ─── Pont vers l'espace des catéchumènes et néophytes (Espace.gs) ───

function synchroEspace_(x) {
  if (!x.dossier_id || !x.hash) return;
  var d = null; try { d = trouverDossier_(x.dossier_id); } catch (e) {}
  if (!d || d.type !== 'catechumene') return;
  feuillesEspace_();
  var esp = lignes_('Espaces').filter(function (y) { return y.dossier_id === x.dossier_id; })[0];
  if (!esp) esp = { dossier_id: x.dossier_id, jeton: jeton_(), cree_le: maintenant_(), derniere_visite: '' };
  if (esp.hash === x.hash && esp.sel === x.sel) return;
  esp.hash = x.hash; esp.sel = x.sel; esp.mdp_maj = maintenant_();
  ecrireLigne_('Espaces', esp);
}
function pontEspace_(x) {
  if (!x.dossier_id) return null;
  var d = null; try { d = trouverDossier_(x.dossier_id); } catch (e) {}
  if (!d || d.type !== 'catechumene') return null;
  var esp = espaceDuDossier_(x.dossier_id);
  if (!esp || !esp.hash) { verrou_(function () { synchroEspace_(x); }); esp = espaceDuDossier_(x.dossier_id); }
  if (!esp || !esp.hash) return null;
  return { c: esp.jeton, s: nouvelleSessionEsp_(esp) };
}

// ─── Ce que voit la personne connectée ───

function prefsCompte_(x) { var pr = json2_(x.prefs, {}); return { textes: pr.textes !== false, reponses: pr.reponses !== false, annonces: pr.annonces !== false }; }
function vueCompte_(x) {
  var frat = { etat: 'aucune' }, chefs = [];
  try { frat = fraterniteCompte_(x); } catch (e) { console.error('fraterniteCompte_', e); }
  try {
    var base = (reglages_().url_formulaires || 'https://secretariat.croix-glorieuse.org/').replace(/\/?$/, '/');
    chefs = equipesChefDuCompte_(x).map(function (e) { return { equipe: e.nom, lien: base + 'fraternite/?c=' + e.jeton + '#s=' + sessionChefCompte_(e.fil, x) }; });
  } catch (e) { console.error('chefs compte', e); }
  var cal = (frat.rencontres || []).map(function (r) { return { date: r.date, heure_debut: '', titre: 'Fraternité Cor Unum ' + frat.equipe, lieu: r.lieu, note: r.note }; });
  var annonces = []; try { annonces = annoncesPubliques_(); } catch (e) {}
  return {
    paroissien: true, id: x.id, prenom: x.prenom || '', nom: x.nom || '', mail: x.mail, telephone: x.telephone || '',
    confidentialite_le: x.confidentialite_le || '', notifs: prefsCompte_(x), favoris: json2_(x.favoris, { liste: [], maj: '' }),
    fraternite: frat, chefs: chefs, calendrier: cal, textes: [], annonces: annonces, espace: pontEspace_(x),
    paroisse: reglages_().paroisse, cle_push: clePubliquePush_()
  };
}
function noterVisiteCompte_(x) {
  if (String(x.derniere_visite || '').slice(0, 10) === aujourdhui_()) return;   // une écriture par jour au plus
  try { verrou_(function () { var y = compteParId_(x.id); if (y) { y.derniere_visite = maintenant_(); ecrireLigne_('Comptes', y); } }); } catch (e) {}
}
/** « Mes données » : tout ce que la paroisse garde sur la personne dans l'app (sans le mot de passe). */
function mesDonnees_(x) {
  var r = { compte: {}, dossier: null, cor_unum: [] };
  ['mail', 'prenom', 'nom', 'telephone', 'statut', 'cree_le', 'valide_le', 'derniere_visite', 'confidentialite_le'].forEach(function (k) { r.compte[k] = x[k] || ''; });
  r.compte.demande = json2_(x.demande, null);
  r.compte.preferences = prefsCompte_(x);
  r.compte.versets_gardes = (json2_(x.favoris, {}).liste || []).length;
  if (x.dossier_id) try { var d = trouverDossier_(x.dossier_id); r.dossier = { type: (TYPES_DOSSIER[d.type] || {}).nom || d.type, informations: json2_(d.donnees, {}).infos || {} }; } catch (e) {}
  try { r.cor_unum = fichesCorDuCompte_(x).map(function (y) { return { annee: y.annee, nom: y.nom, prenoms: y.prenoms, email: y.email, telephone: y.telephone, adresse: y.adresse }; }); } catch (e) {}
  r.responsable = 'Paroisse La Croix glorieuse, représentée par le curé — secretariat@croix-glorieuse.org';
  r.genere_le = maintenant_();
  return r;
}

// ─── Actions de l'app (publiques, ou avec la session du compte) ───

function actionCompte_(action, p) {
  var cache = CacheService.getScriptCache();
  // limite générale par adresse ou par session
  var cleL = 'cptl_' + String(p.cs || p.mail || p.i || '').slice(0, 60);
  var nL = Number(cache.get(cleL) || 0);
  if (nL > 300) throw erreur_('LIMITE', 'Trop d\'actions en peu de temps. Réessayez dans une heure.');
  cache.put(cleL, String(nL + 1), 3600);

  if (action === 'cpt.demandeCode') {
    if (p.piege) return { mail: '' };   // robot : champ invisible rempli
    var m = normMail_(p.mail);
    if (!m) throw erreur_('INVALIDE', 'Adresse e-mail invalide.');
    var ex = compteParMail_(m);
    if (ex && ex.statut === 'actif') throw erreur_('EXISTE', 'Un compte existe déjà avec cette adresse : connectez-vous, ou utilisez « Mot de passe oublié ».');
    if (ex && ex.statut === 'invite') throw erreur_('EXISTE', 'Votre accès est déjà accordé : utilisez le lien reçu par mail, ou « Mot de passe oublié ».');
    if (ex && (ex.statut === 'attente' || ex.statut === 'precisions')) throw erreur_('EXISTE', 'Votre demande est déjà en cours d\'examen. Vous recevrez un mail.');
    if (ex && ex.statut === 'suspendu') throw erreur_('EXISTE', 'Ce compte est suspendu. Contactez la paroisse : secretariat@croix-glorieuse.org.');
    compteurChef_('cptdemenvoi_' + m, 3, 3600, 'Trop de codes envoyés. Réessayez dans une heure.');
    var code = codeSur_();
    cache.put('cptdem_' + m, JSON.stringify({ code: code, essais: 0 }), 900);
    mailCompte_(m, 'La Croix glorieuse – votre code : ' + code, 'Bonjour,\n\nVoici votre code pour confirmer votre adresse et envoyer votre demande d\'accès à l\'application de la paroisse :\n\n' + code +
      '\n\nIl est valable 15 minutes. Si vous n\'avez rien demandé, ignorez ce message.' + FIN_MAIL_CPT);
    return { mail: masquerMail_(m) };
  }
  if (action === 'cpt.demande') {
    if (p.piege) return { ok: true };
    var m2 = normMail_(p.mail);
    if (!m2) throw erreur_('INVALIDE', 'Adresse e-mail invalide.');
    verifierCodeCache_('cptdem_' + m2, p.code);
    var court = function (v, n) { return String(v == null ? '' : v).trim().slice(0, n || 120); };
    var prenom = court(p.prenom, 80), nom = court(p.nom, 80), tel = court(p.telephone, 40);
    if (!prenom || !nom) throw erreur_('INVALIDE', 'Indiquez votre prénom et votre nom.');
    if (chiffres_(tel).length < 9) throw erreur_('INVALIDE', 'Indiquez votre numéro de téléphone.');
    if (p.confidentialite !== true) throw erreur_('INVALIDE', 'Merci de lire et d\'accepter la page Confidentialité.');
    var demande = { messe: court(p.messe, 120), liens: (p.liens || []).slice(0, 10).map(function (z) { return court(z, 80); }), connait: court(p.connait, 200), mot: court(p.mot, 600) };
    if (p.parent) { demande.mineur = true; demande.parent_mail = normMail_(p.parent_mail); if (!demande.parent_mail) throw erreur_('INVALIDE', 'Indiquez l\'adresse du parent qui donne son accord.'); }
    var rap = rapprocher_(m2, prenom, nom, tel);
    verrou_(function () {
      var x = compteParMail_(m2);
      if (x && ['actif', 'invite', 'attente', 'precisions', 'suspendu'].indexOf(x.statut) > -1) throw erreur_('EXISTE', 'Une demande ou un compte existe déjà pour cette adresse.');
      x = x || { id: uid_(), cree_le: maintenant_(), session_v: 0, cor_ids: '[]', prefs: '', favoris: '' };
      x.mail = m2; x.prenom = prenom; x.nom = nom; x.telephone = tel; x.statut = 'attente'; x.statut_le = maintenant_(); x.motif = '';
      x.demande = JSON.stringify(demande); x.rapprochement = JSON.stringify(rap); x.confidentialite_le = maintenant_(); x.maj_le = maintenant_();
      ecrireLigne_('Comptes', x);
    });
    cache.remove('cptdem_' + m2);
    prevenirValidateurs_('App des paroissiens : demande d\'accès', prenom + ' ' + nom + (rap.length ? ' – connu(e) : ' + rap[0].source : ' – inconnu(e) des fichiers'));
    return { ok: true };
  }
  if (action === 'cpt.connexion') {
    var m3 = normMail_(p.mail);
    if (!m3) throw erreur_('INVALIDE', 'Adresse e-mail invalide.');
    bloqueCpt_(m3);
    var x3 = compteParMail_(m3);
    if (x3 && x3.hash && (x3.statut === 'actif') && hacher_(String(p.mdp || ''), x3.sel) === x3.hash) {
      CacheService.getScriptCache().remove('cptechec_' + m3);
      noterVisiteCompte_(x3);
      return { session: nouvelleSessionCpt_(x3), vue: vueCompte_(x3) };
    }
    noterEchecCpt_(m3);
    if (x3 && x3.statut === 'invite') throw erreur_('MDP', 'Votre compte n\'est pas encore ouvert : utilisez le lien reçu par mail, ou « Mot de passe oublié ».');
    if (x3 && (x3.statut === 'attente' || x3.statut === 'precisions')) throw erreur_('MDP', 'Votre demande est en cours d\'examen : vous recevrez un mail.');
    if (x3 && x3.statut === 'suspendu') throw erreur_('MDP', 'Ce compte est suspendu. Contactez la paroisse : secretariat@croix-glorieuse.org.');
    if (x3 && x3.statut === 'desactive') throw erreur_('MDP', 'Ce compte a été désactivé faute de connexion. Utilisez « Mot de passe oublié » pour le rouvrir.');
    throw erreur_('MDP', 'Adresse ou mot de passe incorrect.');
  }
  if (action === 'cpt.oubli') {
    var m4 = normMail_(p.mail);
    if (!m4) throw erreur_('INVALIDE', 'Adresse e-mail invalide.');
    compteurChef_('cptoubli_' + m4, 5, 3600, 'Trop de codes envoyés. Réessayez dans une heure.');
    var x4 = compteParMail_(m4);
    if (x4 && ['actif', 'invite', 'desactive'].indexOf(x4.statut) > -1) {
      var c4 = codeSur_();
      cache.put('cptoubli_c_' + m4, JSON.stringify({ code: c4, essais: 0 }), 900);
      mailCompte_(m4, 'La Croix glorieuse – votre code : ' + c4, 'Bonjour ' + (x4.prenom || '') + ',\n\nVoici votre code pour choisir un nouveau mot de passe dans l\'application de la paroisse :\n\n' + c4 +
        '\n\nIl est valable 15 minutes. Si vous n\'avez rien demandé, ignorez ce message.' + FIN_MAIL_CPT);
    }
    return { mail: masquerMail_(m4) };   // même réponse que le compte existe ou non
  }
  if (action === 'cpt.reinit') {
    var m5 = normMail_(p.mail);
    if (!m5) throw erreur_('INVALIDE', 'Adresse e-mail invalide.');
    verifierCodeCache_('cptoubli_c_' + m5, p.code);
    verifierMdpCompte_(p.mdp);
    var x5 = verrou_(function () {
      var y = compteParMail_(m5);
      if (!y || ['actif', 'invite', 'desactive'].indexOf(y.statut) === -1) throw erreur_('CODE', 'Code incorrect.');
      y.sel = jeton_().slice(0, 16); y.hash = hacher_(String(p.mdp), y.sel); y.mdp_maj = maintenant_();
      if (y.statut !== 'actif') { y.statut = 'actif'; y.statut_le = maintenant_(); }
      y.jeton = ''; y.jeton_exp = ''; y.derniere_visite = maintenant_(); y.maj_le = maintenant_();
      ecrireLigne_('Comptes', y); synchroEspace_(y);
      return y;
    });
    cache.remove('cptoubli_c_' + m5);
    return { session: nouvelleSessionCpt_(x5), vue: vueCompte_(x5) };
  }
  if (action === 'cpt.invitation' || action === 'cpt.activer') {
    var xi = compteParJeton_(p.i);
    if (action === 'cpt.invitation') return { prenom: xi.prenom || '', mail: masquerMail_(xi.mail) };
    verifierMdpCompte_(p.mdp);
    if (p.confidentialite !== true) throw erreur_('INVALIDE', 'Merci de lire et d\'accepter la page Confidentialité.');
    var xa = verrou_(function () {
      var y = compteParId_(xi.id);
      y.sel = jeton_().slice(0, 16); y.hash = hacher_(String(p.mdp), y.sel); y.mdp_maj = maintenant_();
      y.statut = 'actif'; y.statut_le = maintenant_(); y.jeton = ''; y.jeton_exp = ''; y.confidentialite_le = y.confidentialite_le || maintenant_();
      y.derniere_visite = maintenant_(); y.maj_le = maintenant_();
      ecrireLigne_('Comptes', y); synchroEspace_(y);
      return y;
    });
    return { session: nouvelleSessionCpt_(xa), vue: vueCompte_(xa) };
  }

  // ─── Avec la session du compte ───
  var x = compteDeSession_(p.cs);
  if (action === 'cpt.lire') { noterVisiteCompte_(x); return vueCompte_(x); }
  if (action === 'cpt.prefs') {
    verrou_(function () {
      var y = compteParId_(x.id), pr = json2_(y.prefs, {});
      ['textes', 'reponses', 'annonces'].forEach(function (k) { if (p.notifs && typeof p.notifs[k] === 'boolean') pr[k] = p.notifs[k]; });
      y.prefs = JSON.stringify(pr); ecrireLigne_('Comptes', y);
    });
    if (p.notifs && typeof p.notifs.lettre_mail === 'boolean') changerAbonnementNewsletter_(x.mail, x.prenom, x.nom, p.notifs.lettre_mail);
    return vueCompte_(compteParId_(x.id));
  }
  if (action === 'cpt.favoris') {
    var liste = (p.favoris || []).slice(-200).map(function (f) {
      return { cle: String(f.cle || '').slice(0, 80), livre: String(f.livre || '').slice(0, 40), chap: Number(f.chap) || 0, v: Number(f.v) || 0, texte: String(f.texte || '').slice(0, 180) };
    }).filter(function (f) { return f.cle && f.livre; });
    var maj = /^\d{4}-\d\d-\d\dT/.test(String(p.maj || '')) ? String(p.maj) : maintenant_();
    verrou_(function () {
      var y = compteParId_(x.id), avant = json2_(y.favoris, {});
      if (avant.maj && avant.maj > maj) return;
      y.favoris = JSON.stringify({ liste: liste, maj: maj }); ecrireLigne_('Comptes', y);
    });
    return json2_(compteParId_(x.id).favoris, { liste: [], maj: '' });
  }
  if (action === 'cpt.push') {
    if (p.desabonner) return desabonnerPush_({ endpoint: p.endpoint });
    return abonnerPush_({ endpoint: p.endpoint, appareil: p.appareil }, { uid: 'cpt:' + x.id });
  }
  if (action === 'cpt.mesDonnees') return mesDonnees_(x);
  if (action === 'cpt.lettres') return { lettres: lettresApp_(), lettre_mail: abonnementNewsletter_(x.mail) };
  if (action === 'cpt.lettre') return lettreApp_(p.id);
  if (action === 'cpt.partout') {
    verrou_(function () { var y = compteParId_(x.id); y.session_v = Number(y.session_v || 0) + 1; ecrireLigne_('Comptes', y); });
    return true;
  }
  if (action === 'cpt.motdepasse') {
    if (hacher_(String(p.ancien || ''), x.sel) !== x.hash) throw erreur_('MDP', 'Mot de passe actuel incorrect.');
    verifierMdpCompte_(p.nouveau);
    var xm = verrou_(function () {
      var y = compteParId_(x.id);
      y.sel = jeton_().slice(0, 16); y.hash = hacher_(String(p.nouveau), y.sel); y.mdp_maj = maintenant_(); ecrireLigne_('Comptes', y); synchroEspace_(y);
      return y;
    });
    return { session: nouvelleSessionCpt_(xm) };
  }
  if (action === 'cpt.supprimer') {
    if (hacher_(String(p.mdp || ''), x.sel) !== x.hash) throw erreur_('MDP', 'Mot de passe incorrect.');
    supprimerCompte_(x, 'la personne elle-même');
    return true;
  }
  throw erreur_('ACTION', 'Action inconnue.');
}
function verifierCodeCache_(cle, code) {
  var cache = CacheService.getScriptCache(), c = json2_(cache.get(cle), null);
  if (!c) throw erreur_('CODE', 'Code expiré. Demandez un nouveau code.');
  if (String(code || '').replace(/\s/g, '') !== c.code) {
    c.essais++;
    if (c.essais >= 5) cache.remove(cle); else cache.put(cle, JSON.stringify(c), 900);
    throw erreur_('CODE', c.essais >= 5 ? 'Trop d\'essais. Demandez un nouveau code.' : 'Code incorrect.');
  }
}
function compteParJeton_(j) {
  if (!/^[a-f0-9]{32}$/.test(String(j || ''))) throw erreur_('LIEN', 'Ce lien n\'est pas valable.');
  var x = lignesComptes_().filter(function (y) { return y.jeton === j; })[0];
  if (!x || x.statut !== 'invite') throw erreur_('LIEN', 'Ce lien n\'est plus valable : connectez-vous, ou utilisez « Mot de passe oublié ».');
  if (x.jeton_exp && x.jeton_exp < maintenant_()) throw erreur_('LIEN', 'Ce lien a expiré : utilisez « Mot de passe oublié » avec votre adresse pour ouvrir votre compte.');
  return x;
}
/** Effacement d'un compte (app) : le compte, ses abonnements, son accès à l'espace ; dossiers et registres restent. */
function supprimerCompte_(x, par) {
  verrou_(function () {
    var y = compteParId_(x.id);
    if (!y) return;
    try { lignes_('Push').filter(function (z) { return z.uid === 'cpt:' + y.id || (y.dossier_id && z.uid === 'esp:' + y.dossier_id); }).forEach(function (z) { desabonnerPush_({ endpoint: z.endpoint }); }); } catch (e) {}
    if (y.dossier_id) try { var esp = espaceDuDossier_(y.dossier_id); if (esp) { feuille_('Espaces').deleteRow(esp._ligne); oublierLignes_('Espaces'); } } catch (e) {}
    oublierLignes_('Comptes');
    var z = compteParId_(y.id); if (z) feuille_('Comptes').deleteRow(z._ligne);
    oublierLignes_('Comptes');
  });
  journaliser_({ nom: 'App des paroissiens' }, 'Compte supprimé (' + par + ')', (x.prenom + ' ' + x.nom).trim());
  prevenirValidateurs_('App des paroissiens : compte supprimé', (x.prenom + ' ' + x.nom).trim() + ' – vérifier les fiches Cor Unum et les dossiers non sacramentels (RGPD)');
}

// ─── Secrétariat : page « App des paroissiens » ───

function comptePublic_(x) {
  return {
    id: x.id, mail: x.mail, prenom: x.prenom, nom: x.nom, telephone: x.telephone, statut: x.statut, statut_le: x.statut_le || '', a_mot_de_passe: !!x.hash,
    dossier_id: x.dossier_id || '', demande: json2_(x.demande, null), rapprochement: json2_(x.rapprochement, []), cree_le: x.cree_le, valide_par: x.valide_par || '',
    valide_le: x.valide_le || '', motif: x.motif || '', derniere_visite: x.derniere_visite || '', confidentialite_le: x.confidentialite_le || '',
    invitation_exp: x.statut === 'invite' ? x.jeton_exp || '' : ''
  };
}
function listerComptesRoute_(p, s) {
  var lignes = lignesComptes_(), chefs = {}, fiches = [];
  try {
    if (db_().getSheetByName('CorUnum')) {
      var r = corReglages_(), annee = anneeCorCourante_(r);
      equipesDe_(r, annee).forEach(function (e) { (e.chefs || []).forEach(function (id) { chefs[id] = e.nom; }); });
      fiches = lignes_('CorUnum').filter(function (y) { return y.annee === annee && y.statut !== 'ancien'; });
    }
  } catch (e) { console.error('liste comptes cor', e); }
  var l = lignes.map(function (x) {
    var c = comptePublic_(x), m = normMail_(x.mail), ids = json2_(x.cor_ids, []);
    var fs = fiches.filter(function (y) { return ids.indexOf(y.id) > -1 || (m && String(y.email || '').toLowerCase().split(/[\s,;]+/).indexOf(m) > -1); });
    c.cor = fs.length > 0;
    c.chef = fs.map(function (y) { return chefs[y.id]; }).filter(Boolean)[0] || '';
    return c;
  });
  return { comptes: l, statuts: STATUTS_COMPTE, migration: props_().getProperty('CPT_MIGRATION') || '' };
}
function modifierCompteRoute_(p, s) {
  var op = String(p.op || '');
  var x = compteParId_(p.id);
  if (!x) throw erreur_('INTROUVABLE', 'Compte introuvable.');
  var nomX = (x.prenom + ' ' + x.nom).trim();
  if (op === 'supprimer') { supprimerCompte_(x, s.nom); return listerComptesRoute_(p, s); }
  verrou_(function () {
    var y = compteParId_(x.id);
    if (op === 'valider') {
      if (['attente', 'precisions', 'refuse'].indexOf(y.statut) === -1) throw erreur_('INVALIDE', 'Cette demande n\'est plus à examiner.');
      y.valide_par = s.nom; y.valide_le = maintenant_(); y.motif = '';
      if (y.hash) { y.statut = 'actif'; }
      else { y.statut = 'invite'; y.jeton = jeton_(); y.jeton_exp = new Date(Date.now() + CPT_INVITATION_JOURS * 86400000).toISOString(); }
    } else if (op === 'refuser') {
      y.statut = 'refuse'; y.motif = String(p.motif || '').slice(0, 500); y.valide_par = s.nom; y.valide_le = maintenant_();
    } else if (op === 'precisions') {
      if (!String(p.message || '').trim()) throw erreur_('INVALIDE', 'Écrivez votre question.');
      y.statut = 'precisions'; y.motif = String(p.message).slice(0, 1000);
    } else if (op === 'suspendre') {
      y.statut = 'suspendu'; y.motif = String(p.motif || '').slice(0, 500); y.session_v = Number(y.session_v || 0) + 1;
    } else if (op === 'reactiver') {
      y.statut = y.hash ? 'actif' : 'invite'; y.motif = '';
      if (!y.hash) { y.jeton = jeton_(); y.jeton_exp = new Date(Date.now() + CPT_INVITATION_JOURS * 86400000).toISOString(); }
    } else if (op === 'renvoyer') {
      if (y.statut !== 'invite') throw erreur_('INVALIDE', 'Ce compte n\'attend pas d\'invitation.');
      if (!normMail_(y.mail)) throw erreur_('INVALIDE', 'Ce compte n\'a pas d\'adresse : indiquez-en une d\'abord.');
      y.jeton = jeton_(); y.jeton_exp = new Date(Date.now() + CPT_INVITATION_JOURS * 86400000).toISOString();
    } else if (op === 'adresse') {
      var nm = normMail_(p.mail);
      if (!nm) throw erreur_('INVALIDE', 'Adresse e-mail invalide.');
      var autre = compteParMail_(nm);
      if (autre && autre.id !== y.id) throw erreur_('INVALIDE', 'Cette adresse est déjà celle d\'un autre compte (une adresse par adulte).');
      y.mail = nm;
      if (!y.hash && y.statut === 'invite') { y.jeton = jeton_(); y.jeton_exp = new Date(Date.now() + CPT_INVITATION_JOURS * 86400000).toISOString(); }
    } else if (op === 'lierDossier') {
      y.dossier_id = String(p.dossier_id || '');
    } else throw erreur_('INVALIDE', 'Opération inconnue.');
    y.statut_le = maintenant_(); y.maj_le = maintenant_();
    ecrireLigne_('Comptes', y);
    x = y;
  });
  if (op === 'valider' && x.statut === 'invite' && normMail_(x.mail)) envoyerInvitation_(x, 'validee');
  if (op === 'valider' && x.statut === 'actif') mailCompte_(x.mail, 'La Croix glorieuse – votre accès est accepté', 'Bonjour ' + x.prenom + ',\n\nVotre accès à l\'application de la paroisse est accepté. Connectez-vous avec votre adresse et votre mot de passe.' + FIN_MAIL_CPT, [{ texte: 'Ouvrir l\'application', url: URL_APP_PAROISSIENS }]);
  if (op === 'renvoyer' || (op === 'reactiver' && x.statut === 'invite' && normMail_(x.mail)) || (op === 'adresse' && x.statut === 'invite')) envoyerInvitation_(x, 'invitation');
  if (op === 'refuser' && p.prevenir) mailCompte_(x.mail, 'La Croix glorieuse – votre demande d\'accès', 'Bonjour ' + x.prenom + ',\n\nNous avons bien reçu votre demande d\'accès à l\'application de la paroisse, mais nous ne pouvons pas y donner suite pour le moment.' +
    (x.motif ? '\n\n' + x.motif : '') + '\n\nN\'hésitez pas à venir nous rencontrer, ou à répondre à ce message.' + FIN_MAIL_CPT);
  if (op === 'precisions') mailCompte_(x.mail, 'La Croix glorieuse – votre demande d\'accès', 'Bonjour ' + x.prenom + ',\n\nMerci pour votre demande d\'accès à l\'application de la paroisse. Avant de l\'accepter, pourriez-vous nous préciser :\n\n' + x.motif +
    '\n\nIl suffit de répondre à ce message.' + FIN_MAIL_CPT);
  journaliser_(s, 'App des paroissiens : ' + op, nomX);
  return listerComptesRoute_(p, s);
}
/** Invitations depuis Cor Unum : fiches choisies (ou toute une fraternité) de l'année en cours. */
function inviterComptesRoute_(p, s) {
  if (!db_().getSheetByName('CorUnum')) throw erreur_('INVALIDE', 'Pas encore de fiches Cor Unum.');
  var r = corReglages_(), annee = anneeCorCourante_(r), toutes = lignes_('CorUnum').filter(function (y) { return y.annee === annee && y.statut !== 'ancien'; });
  var ids = (p.ids || []).slice(0, 300);
  if (p.equipe_id) toutes.filter(function (y) { return y.equipe_id === p.equipe_id; }).forEach(function (y) { if (ids.indexOf(y.id) === -1) ids.push(y.id); });
  if (p.chefs) equipesDe_(r, annee).forEach(function (e) { (e.chefs || []).forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); }); });
  var fiches = toutes.filter(function (y) { return ids.indexOf(y.id) > -1; });
  if (!fiches.length) throw erreur_('INVALIDE', 'Aucune fiche choisie.');
  var rapport = { invites: [], deja: [], sans_adresse: [], refuses: [] }, aEnvoyer = [];
  verrou_(function () {
    fiches.forEach(function (f) {
      var nomF = (f.prenoms + ' ' + f.nom).trim(), m = normMail_(String(f.email || '').split(/[\s,;]+/)[0]);
      if (!m) { rapport.sans_adresse.push(nomF); return; }
      var x = compteParMail_(m);
      if (x) {
        var l = json2_(x.cor_ids, []); if (l.indexOf(f.id) === -1) { x.cor_ids = JSON.stringify(l.concat([f.id])); ecrireLigne_('Comptes', x); }
        if (x.statut === 'refuse' || x.statut === 'suspendu') { rapport.refuses.push(nomF); return; }
        if (x.statut === 'attente' || x.statut === 'precisions') {
          x.statut = 'invite'; x.statut_le = maintenant_(); x.valide_par = s.nom; x.valide_le = maintenant_();
          x.jeton = jeton_(); x.jeton_exp = new Date(Date.now() + CPT_INVITATION_JOURS * 86400000).toISOString(); ecrireLigne_('Comptes', x); aEnvoyer.push(x); rapport.invites.push(nomF); return;
        }
        rapport.deja.push(nomF); return;
      }
      x = { id: uid_(), mail: m, prenom: f.prenoms || '', nom: f.nom || '', telephone: f.telephone || '', statut: 'invite', statut_le: maintenant_(), dossier_id: '',
        cor_ids: JSON.stringify([f.id]), session_v: 0, jeton: jeton_(), jeton_exp: new Date(Date.now() + CPT_INVITATION_JOURS * 86400000).toISOString(),
        cree_le: maintenant_(), valide_par: s.nom, valide_le: maintenant_(), maj_le: maintenant_() };
      ecrireLigne_('Comptes', x); aEnvoyer.push(x); rapport.invites.push(nomF);
    });
  });
  if (aEnvoyer.length > MailApp.getRemainingDailyQuota()) throw erreur_('QUOTA', 'Trop d\'invitations pour le quota de mails du jour (' + MailApp.getRemainingDailyQuota() + ' restants). Les comptes sont créés : renvoyez les invitations demain depuis la liste.');
  aEnvoyer.forEach(function (x) { try { envoyerInvitation_(x, 'invitation'); } catch (e) { console.error('invitation', x.mail, e); } });
  journaliser_(s, 'App des paroissiens : invitations Cor Unum', rapport.invites.length + ' invitation(s)');
  return rapport;
}
/** Reprise des espaces des catéchumènes et néophytes (sans changer leur mot de passe). Peut être relancée. */
function migrerEspacesRoute_(p, s) {
  if (s.role !== 'admin' && s.role !== 'cure') throw interdit_('Réservé au curé et aux administrateurs.');
  feuillesEspace_();
  var rapport = { crees: 0, deja: 0, sans_adresse: [], adresse_prise: [] };
  verrou_(function () {
    lignes_('Espaces').forEach(function (esp) {
      if (compteParDossier_(esp.dossier_id)) { rapport.deja++; return; }
      var d = null; try { d = trouverDossier_(esp.dossier_id); } catch (e) {}
      if (!d) return;
      var i = json2_(d.donnees, {}).infos || {}, m = normMail_(mailDossier_(d)), nomD = ((i.prenoms || '') + ' ' + (i.nom || '')).trim() || d.nom;
      if (!m) rapport.sans_adresse.push(nomD);
      else if (compteParMail_(m)) { rapport.adresse_prise.push(nomD); m = ''; }
      ecrireLigne_('Comptes', {
        id: uid_(), mail: m, prenom: i.prenoms || '', nom: i.nom || '', telephone: i.telephone || d.telephone || '', statut: esp.hash && m ? 'actif' : 'invite', statut_le: maintenant_(),
        dossier_id: d.id, cor_ids: '[]', hash: m ? esp.hash || '' : '', sel: m ? esp.sel || '' : '', mdp_maj: esp.mdp_maj || '', session_v: 0, jeton: '', jeton_exp: '',
        cree_le: esp.cree_le || maintenant_(), valide_par: 'Reprise des espaces', valide_le: maintenant_(), derniere_visite: esp.derniere_visite || '',
        prefs: esp.prefs || '', favoris: esp.favoris || '', confidentialite_le: '', maj_le: maintenant_()
      });
      rapport.crees++;
    });
  });
  props_().setProperty('CPT_MIGRATION', maintenant_());
  journaliser_(s, 'App des paroissiens : reprise des espaces', rapport.crees + ' compte(s) créé(s)');
  return rapport;
}

// ─── Charte de confidentialité de l'équipe (une fois par an) ───

var CHARTE_EQUIPE = [
  'J\'utilise les informations personnelles (dossiers, coordonnées, Cor Unum, catéchisme, intentions, santé…) uniquement pour la mission de la paroisse.',
  'Je ne transmets aucune de ces informations hors de la paroisse, ni à des personnes qui n\'ont pas à les connaître.',
  'Je ne copie pas de listes sur mon téléphone, mon ordinateur personnel ou une clé USB ; les documents imprimés sont rangés et détruits après usage.',
  'Je verrouille mon téléphone et mon ordinateur, je ne partage pas mon mot de passe et je me déconnecte sur un appareil qui n\'est pas le mien.',
  'Je respecte le secret pastoral : ce qui concerne la vie spirituelle, les sacrements et la santé des personnes reste confidentiel.',
  'Si je perds un appareil ou si une information sort par erreur, je préviens le curé tout de suite.',
  'Je réponds sans attendre aux personnes qui demandent à voir, corriger ou effacer leurs données, ou je transmets leur demande au curé.'
];
function chartes_() { return json2_(props_().getProperty('CHARTES_EQUIPE'), {}); }
function etatCharte_(uid) {
  var le = chartes_()[uid] || '';
  return { acceptee_le: le, a_accepter: !le || le < new Date(Date.now() - 365 * 86400000).toISOString(), texte: CHARTE_EQUIPE,
    responsable: 'Paroisse La Croix glorieuse, représentée par le curé', contact: 'secretariat@croix-glorieuse.org' };
}
function accepterCharte_(p, s) {
  var c = chartes_(); c[s.uid] = maintenant_();
  props_().setProperty('CHARTES_EQUIPE', JSON.stringify(c));
  try { CacheService.getScriptCache().remove('charte_' + s.uid); } catch (e) {}
  journaliser_(s, 'Charte de confidentialité acceptée', '');
  return etatCharte_(s.uid);
}
var ZONES_DONNEES_ = ['courrier', 'dossiers', 'catechisme', 'catechumenat', 'cor_unum', 'retraites', 'extraits', 'registres', 'documents', 'intentions', 'paroissiens'];
/** Pages avec données personnelles : fermées tant que la charte de l'année n'est pas acceptée. */
function verifierCharte_(action, s) {
  var zone = zoneAction_(action);
  if (!zone || ZONES_DONNEES_.indexOf(zone) === -1) return;
  var cache = CacheService.getScriptCache();
  if (cache.get('charte_' + s.uid)) return;
  if (etatCharte_(s.uid).a_accepter) throw erreur_('CHARTE', 'Merci d\'accepter d\'abord la charte de confidentialité (protection des données des paroissiens).');
  cache.put('charte_' + s.uid, '1', 3600);
}

// ─── Entretien de nuit (RGPD) ───

function entretienComptes_() {
  if (!db_().getSheetByName('Comptes')) return;
  var now = Date.now(), iso = function (j) { return new Date(now - j * 86400000).toISOString(); };
  var prevenir = [], effaces = 0, desactives = 0;
  verrou_(function () {
    lignes_('Comptes').slice().reverse().forEach(function (x) {
      var vu = x.derniere_visite || x.valide_le || x.cree_le || '';
      // demande refusée : effacée après 3 mois
      if (x.statut === 'refuse' && (x.statut_le || x.valide_le || '') < iso(92)) { feuille_('Comptes').deleteRow(x._ligne); effaces++; return; }
      // désactivé depuis 30 jours : effacé (les dossiers restent)
      if (x.statut === 'desactive' && (x.statut_le || '') < iso(30)) { feuille_('Comptes').deleteRow(x._ligne); effaces++; return; }
      if (x.statut !== 'actif' && x.statut !== 'invite') return;
      var pr = json2_(x.prefs, {});
      if (vu < iso(548)) { x.statut = 'desactive'; x.statut_le = maintenant_(); x.session_v = Number(x.session_v || 0) + 1; ecrireLigne_('Comptes', x); desactives++; return; }
      if (vu < iso(518) && !pr.prevenu_inactif && normMail_(x.mail)) { pr.prevenu_inactif = maintenant_(); x.prefs = JSON.stringify(pr); ecrireLigne_('Comptes', x); prevenir.push(x); }
      else if (vu >= iso(518) && pr.prevenu_inactif) { delete pr.prevenu_inactif; x.prefs = JSON.stringify(pr); ecrireLigne_('Comptes', x); }
    });
    oublierLignes_('Comptes');
  });
  prevenir.forEach(function (x) {
    try {
      mailCompte_(x.mail, 'La Croix glorieuse – votre compte va être désactivé', 'Bonjour ' + (x.prenom || '') + ',\n\nVous ne vous êtes pas connecté(e) à l\'application de la paroisse depuis longtemps. Pour protéger vos données, votre compte sera désactivé dans un mois, puis effacé un mois plus tard.' +
        '\n\nPour le garder, il suffit d\'ouvrir l\'application et de vous connecter.' + FIN_MAIL_CPT, [{ texte: 'Ouvrir l\'application', url: URL_APP_PAROISSIENS }]);
    } catch (e) { console.error('prévenir inactif', e); }
  });
  if (effaces || desactives) journaliser_(null, 'App des paroissiens : entretien RGPD', desactives + ' désactivé(s), ' + effaces + ' effacé(s)');
}
