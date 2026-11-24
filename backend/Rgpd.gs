/**
 * Effacements RGPD avec confirmation (page « App des paroissiens » → RGPD).
 *  - Fiches Cor Unum : effacées 3 ans après la dernière activité de la personne. Comptent comme activité :
 *    la participation à une fraternité (fin de l'année Cor Unum où elle était dans une fraternité),
 *    la dernière connexion à l'app, et la date de sa dernière inscription.
 *    Les fiches d'une même personne sur plusieurs années sont regroupées (même adresse ou même nom).
 *  - Fiches santé et contacts d'urgence des retraites : effacés 1 mois après la fin de la retraite
 *    (l'inscription reste, pour les comptes et les paiements).
 * Une fois par mois, l'entretien de nuit prépare la liste et prévient le curé, les prêtres et la secrétaire.
 * Ils confirment d'un bouton (ou gardent une fiche un an de plus) ; ce qui n'est pas traité dans les 30 jours
 * est effacé automatiquement. Tout est noté au journal (sans le contenu effacé).
 */

var RGPD_COR_JOURS = 1095;      // 3 ans
var RGPD_SANTE_JOURS = 30;      // 1 mois après la fin de la retraite
var RGPD_DELAI_JOURS = 30;      // effacement automatique si personne ne confirme
var RGPD_GARDER_JOURS = 365;

function rgpdListe_() { return json2_(props_().getProperty('RGPD_LISTE'), null); }
function rgpdGarder_() { return json2_(props_().getProperty('RGPD_GARDER'), {}); }

/** Fin d'une année Cor Unum (« 2026-2027 » → 31 août 2027). */
function finAnneeCor_(annee) {
  var a = String(annee || '').match(/(\d{4})\D*(\d{4})?/);
  if (!a) return '';
  return (a[2] || a[1]) + '-08-31T23:59:59.000Z';
}

/** Personnes de Cor Unum sans activité depuis 3 ans. */
function candidatsCor_() {
  if (!db_().getSheetByName('CorUnum')) return [];
  var fiches = lignes_('CorUnum'), parent = {};
  var trouver = function (k) { while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; };
  var unir = function (a, b) { a = trouver(a); b = trouver(b); if (a !== b) parent[b] = a; };
  var cles = {};
  fiches.forEach(function (f) {
    parent[f.id] = parent[f.id] || f.id;
    var c = String(f.email || '').toLowerCase().split(/[\s,;]+/).filter(String).map(function (m) { return 'm:' + m; });
    var n = cleNom_(f.nom) + '|' + cleNom_(f.prenoms); if (n !== '|') c.push('n:' + n);
    c.forEach(function (k) { if (cles[k]) unir(cles[k], f.id); else cles[k] = f.id; });
  });
  var groupes = {};
  fiches.forEach(function (f) { var r = trouver(f.id); (groupes[r] = groupes[r] || []).push(f); });
  var comptes = []; try { if (db_().getSheetByName('Comptes')) comptes = lignesComptes_(); } catch (e) {}
  var limite = new Date(Date.now() - RGPD_COR_JOURS * 86400000).toISOString(), garder = rgpdGarder_(), now = maintenant_();
  var res = [];
  Object.keys(groupes).forEach(function (r) {
    var g = groupes[r], ids = g.map(function (f) { return f.id; }).sort(), cle = 'cor:' + ids[0];
    if (garder[cle] && garder[cle] > now) return;
    var mails = []; g.forEach(function (f) { String(f.email || '').toLowerCase().split(/[\s,;]+/).filter(String).forEach(function (m) { if (mails.indexOf(m) === -1) mails.push(m); }); });
    var dernier = '';
    var plus = function (d) { if (d && String(d) > dernier) dernier = String(d); };
    g.forEach(function (f) { plus(f.cree_le); if (f.equipe_id && f.statut !== 'ancien') plus(finAnneeCor_(f.annee)); });
    comptes.forEach(function (x) {
      var lie = json2_(x.cor_ids, []).some(function (id) { return ids.indexOf(id) > -1; }) || mails.indexOf(normMail_(x.mail)) > -1;
      if (lie) plus(x.derniere_visite || x.valide_le || x.cree_le);
    });
    if (!dernier || dernier >= limite) return;
    var recente = g.slice().sort(function (a, b) { return String(b.annee).localeCompare(String(a.annee)); })[0];
    res.push({ cle: cle, type: 'cor', nom: ((recente.prenoms || '') + ' ' + (recente.nom || '')).trim(), annees: g.map(function (f) { return f.annee; }).filter(function (a, k, l) { return a && l.indexOf(a) === k; }).sort(),
      derniere: dernier.slice(0, 10), ids: ids });
  });
  return res.sort(function (a, b) { return String(a.nom).localeCompare(String(b.nom), 'fr'); });
}

/** Retraites finies depuis plus d'un mois qui gardent des fiches santé ou des contacts d'urgence. */
function candidatsSante_() {
  if (!db_().getSheetByName('RetraitesInscrits') || !db_().getSheetByName('Retraites')) return [];
  var limite = ajouterJours_(aujourdhui_(), -RGPD_SANTE_JOURS), garder = rgpdGarder_(), now = maintenant_();
  var retraites = {}; lignes_('Retraites').forEach(function (r) { retraites[r.id] = r; });
  var parRet = {};
  lignes_('RetraitesInscrits').forEach(function (x) {
    var r = retraites[x.retraite_id]; if (!r || String(r.date_fin || r.date_debut || '9') >= limite) return;
    var sante = json2_(x.participants, []).some(function (pa) { return String(pa.allergies || '').trim(); }) || String(x.urgence_nom || '').trim() || String(x.urgence_tel || '').trim();
    if (sante) parRet[r.id] = (parRet[r.id] || 0) + 1;
  });
  return Object.keys(parRet).filter(function (id) { var c = 'sante:' + id; return !(garder[c] && garder[c] > now); }).map(function (id) {
    var r = retraites[id];
    return { cle: 'sante:' + id, type: 'sante', nom: titreRetraite_(r), date: r.date_fin || r.date_debut, nb: parRet[id], retraite_id: id };
  });
}
function candidatsRgpd_() { return candidatsCor_().concat(candidatsSante_()); }

/** Efface les éléments donnés (recalculés : on n'efface que ce qui est encore à effacer). */
function effacerRgpd_(cles, par) {
  var aEffacer = candidatsRgpd_().filter(function (c) { return cles.indexOf(c.cle) > -1; });
  var nCor = 0, nSante = 0;
  verrou_(function () {
    var idsCor = [];
    aEffacer.filter(function (c) { return c.type === 'cor'; }).forEach(function (c) { idsCor = idsCor.concat(c.ids); });
    if (idsCor.length) {
      lignes_('CorUnum').filter(function (f) { return idsCor.indexOf(f.id) > -1; }).sort(function (a, b) { return b._ligne - a._ligne; })
        .forEach(function (f) { feuille_('CorUnum').deleteRow(f._ligne); nCor++; });
      oublierLignes_('CorUnum');
      try {
        if (db_().getSheetByName('Comptes')) lignesComptes_().forEach(function (x) {
          var l = json2_(x.cor_ids, []), l2 = l.filter(function (id) { return idsCor.indexOf(id) === -1; });
          if (l2.length !== l.length) { x.cor_ids = JSON.stringify(l2); ecrireLigne_('Comptes', x); }
        });
      } catch (e) { console.error('rgpd comptes', e); }
    }
    var rets = aEffacer.filter(function (c) { return c.type === 'sante'; }).map(function (c) { return c.retraite_id; });
    if (rets.length) lignes_('RetraitesInscrits').filter(function (x) { return rets.indexOf(x.retraite_id) > -1; }).forEach(function (x) {
      var parts = json2_(x.participants, []), change = false;
      parts.forEach(function (pa) { if (pa.allergies) { pa.allergies = ''; change = true; } });
      if (x.urgence_nom || x.urgence_tel) { x.urgence_nom = ''; x.urgence_tel = ''; change = true; }
      if (!change) return;
      x.participants = JSON.stringify(parts); x.maj_le = maintenant_();
      ecrireLigne_('RetraitesInscrits', x); nSante++;
    });
    // retirés de la liste en cours
    var liste = rgpdListe_();
    if (liste) { liste.elements = liste.elements.filter(function (c) { return cles.indexOf(c.cle) === -1; }); ecrireListeRgpd_(liste.elements.length ? liste : null); }
  });
  if (nCor || nSante) journaliser_(typeof par === 'object' ? par : { nom: par }, 'RGPD : effacement', (nCor ? nCor + ' fiche(s) Cor Unum' : '') + (nCor && nSante ? ', ' : '') + (nSante ? nSante + ' fiche(s) santé de retraite' : ''));
  return { cor: nCor, sante: nSante };
}
function ecrireListeRgpd_(l) { if (l) props_().setProperty('RGPD_LISTE', JSON.stringify(l)); else props_().deleteProperty('RGPD_LISTE'); }

function preparerListeRgpd_() {
  var el = candidatsRgpd_();
  props_().setProperty('RGPD_PREPAREE', maintenant_());
  ecrireListeRgpd_(el.length ? { le: maintenant_(), auto_le: new Date(Date.now() + RGPD_DELAI_JOURS * 86400000).toISOString(), elements: el } : null);
  if (el.length) {
    var nc = el.filter(function (c) { return c.type === 'cor'; }).length, ns = el.length - nc;
    prevenirValidateurs_('RGPD : données à effacer', [nc ? nc + ' personne(s) de Cor Unum sans activité depuis 3 ans' : '', ns ? ns + ' retraite(s) avec fiches santé' : ''].filter(String).join(' ; ') +
      ' – à confirmer dans les ' + RGPD_DELAI_JOURS + ' jours (sinon effacement automatique)');
  }
  return rgpdListe_();
}

/** Entretien de nuit : effacement automatique au bout de 30 jours, puis nouvelle liste chaque mois. */
function entretienRgpd_() {
  var liste = rgpdListe_();
  if (liste && liste.auto_le && liste.auto_le < maintenant_()) {
    effacerRgpd_(liste.elements.map(function (c) { return c.cle; }), 'Entretien automatique (RGPD, sans réponse en 30 jours)');
    ecrireListeRgpd_(null); liste = null;
  }
  var prep = props_().getProperty('RGPD_PREPAREE') || '';
  if (!liste && prep < new Date(Date.now() - 28 * 86400000).toISOString()) preparerListeRgpd_();
}

// ─── Routes du secrétariat ───

function rgpdRoute_(p, s) {
  if (p.op === 'preparer') preparerListeRgpd_();
  else if (p.op === 'effacer') {
    var cles = (p.cles || []).map(String);
    if (!cles.length) throw erreur_('INVALIDE', 'Rien à effacer.');
    var ef = effacerRgpd_(cles, s);
    return { liste: rgpdListe_(), preparee_le: props_().getProperty('RGPD_PREPAREE') || '', efface: ef };
  } else if (p.op === 'garder') {
    var g = rgpdGarder_(); g[String(p.cle)] = new Date(Date.now() + RGPD_GARDER_JOURS * 86400000).toISOString();
    props_().setProperty('RGPD_GARDER', JSON.stringify(g));
    var l = rgpdListe_();
    if (l) { l.elements = l.elements.filter(function (c) { return c.cle !== p.cle; }); ecrireListeRgpd_(l.elements.length ? l : null); }
    journaliser_(s, 'RGPD : fiche gardée un an de plus', String(p.cle).split(':')[0] === 'cor' ? 'Cor Unum' : 'fiche santé de retraite');
  }
  return { liste: rgpdListe_(), preparee_le: props_().getProperty('RGPD_PREPAREE') || '' };
}
