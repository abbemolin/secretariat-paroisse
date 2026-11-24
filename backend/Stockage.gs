/**
 * Réglages volumineux rangés dans une feuille « Stockage » plutôt que dans les propriétés du script
 * (limitées à 9 Ko par réglage) : fraternités de toutes les années, catalogue de livres, signatures, modèles…
 * Les secrets (clés, mots de passe, sessions) restent dans les propriétés.
 * Migration automatique : à la première lecture, un réglage encore dans les propriétés est recopié dans la feuille.
 * Écriture sans suppression de ligne (pas de décalage même si deux personnes enregistrent en même temps).
 */
var CLES_FEUILLE = ['ACCUEIL_PREFS', 'AGENDAS', 'CATE', 'CATECHUMENAT', 'CONF', 'COR_UNUM', 'FORMULAIRES', 'NOTIF_PREFS',
  'PROMOTIONS', 'REGLAGES', 'REPONSES', 'SIGNATURES', 'TRI', 'TRI_VUS', 'MODELES', 'REGISTRES',
  'NL_SEMAINES', 'NL_BROUILLONS', 'MARQUES_BIBLE'];
var MORCEAU_STOCK = 40000;   // une cellule contient au plus 50 000 caractères
var STOCKAGE_ = null;

function proprietesReelles_() { return PropertiesService.getScriptProperties(); }
function props_() {
  var P = proprietesReelles_();
  var enFeuille = function (k) { return CLES_FEUILLE.indexOf(k) > -1 && !!P.getProperty('DB_ID'); };
  return {
    getProperty: function (k) { return enFeuille(k) ? lireStock_(k) : P.getProperty(k); },
    setProperty: function (k, v) { if (enFeuille(k)) ecrireStock_(k, String(v == null ? '' : v)); else P.setProperty(k, v); return this; },
    deleteProperty: function (k) { if (enFeuille(k)) ecrireStock_(k, ''); P.deleteProperty(k); return this; },
    getProperties: function () { return P.getProperties(); }
  };
}
function feuilleStock_() {
  var f = db_().getSheetByName('Stockage');
  if (!f) {
    f = db_().insertSheet('Stockage');
    f.getRange('A:C').setNumberFormat('@');
    f.getRange(1, 1, 1, 3).setValues([['cle', 'morceau', 'valeur']]);
    f.setFrozenRows(1);
  }
  return f;
}
/** Tout le stockage, lu une fois par exécution. */
function stockage_() {
  if (STOCKAGE_) return STOCKAGE_;
  STOCKAGE_ = {};
  var f = db_().getSheetByName('Stockage');
  if (!f || f.getLastRow() < 2) return STOCKAGE_;
  var m = {};
  f.getRange(2, 1, f.getLastRow() - 1, 3).getValues().forEach(function (r) {
    var k = String(r[0] || ''); if (!k) return;
    (m[k] = m[k] || [])[Number(r[1]) || 0] = String(r[2] == null ? '' : r[2]);
  });
  Object.keys(m).forEach(function (k) { STOCKAGE_[k] = m[k].join(''); });
  return STOCKAGE_;
}
function lireStock_(cle) {
  var s = stockage_();
  if (s[cle] !== undefined) return s[cle] === '' ? null : s[cle];
  var P = proprietesReelles_(), v = P.getProperty(cle);
  if (v !== null && v !== undefined) {   // migration depuis les propriétés
    try { ecrireStock_(cle, v); P.deleteProperty(cle); } catch (e) { console.error('migration ' + cle, e); }
  }
  return v;
}
function ecrireStock_(cle, valeur) {
  var f = feuilleStock_();
  var morceaux = [];
  for (var i = 0; i < valeur.length; i += MORCEAU_STOCK) morceaux.push(valeur.slice(i, i + MORCEAU_STOCK));
  if (!morceaux.length) morceaux = [''];
  var n = f.getLastRow(), lignes = [];
  if (n >= 2) f.getRange(2, 1, n - 1, 1).getValues().forEach(function (r, i) { if (String(r[0]) === cle) lignes.push(i + 2); });
  morceaux.forEach(function (m, i) {
    var ligne = [cle, String(i), m];
    if (i < lignes.length) f.getRange(lignes[i], 1, 1, 3).setNumberFormat('@').setValues([ligne]);
    else { f.appendRow(ligne); }
  });
  for (var j = morceaux.length; j < lignes.length; j++) f.getRange(lignes[j], 1, 1, 3).setValues([['', '', '']]);   // morceaux en trop vidés
  stockage_()[cle] = valeur;
}
