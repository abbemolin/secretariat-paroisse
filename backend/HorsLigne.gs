/**
 * HorsLigne.gs — préparation de l'appli hors connexion.
 * Toutes les fiches que la personne a le droit de lire, en une fois, pour les garder sur l'appareil :
 * dossiers (ouverts, et fermés depuis moins de 18 mois), inscriptions au catéchisme (deux dernières années),
 * extraits de baptême (deux dernières années), retraites de l'année.
 * Version légère des dossiers : sans les mails liés ni la photo en grand (lus quand on ouvre la fiche en ligne).
 */
function horsLigneFiches_(p, s) {
  var r = { dossiers: {}, cate: {}, extraits: {}, retraites: {}, le: maintenant_() };
  var essai = function (fn) { try { fn(); } catch (e) { console.error('horsligne', e); } };
  var ilYa = function (mois) { var d = new Date(); d.setMonth(d.getMonth() - mois); return Utilities.formatDate(d, 'Europe/Paris', 'yyyy-MM-dd'); };
  if (s.droits.indexOf('dossiers') === -1) return r;
  essai(function () {
    var sortesOk = sortesLisibles_(s), limite = ilYa(18);
    lignes_('Dossiers').forEach(function (x) {
      if (sortesOk.indexOf(x.type) === -1 || !TYPES_DOSSIER[x.type]) return;
      if (x.etat !== 'ouvert' && String(x.maj_le || x.cree_le).slice(0, 10) < limite) return;
      essai(function () { r.dossiers[x.id] = dossierComplet_(x, true); });
    });
  });
  essai(function () {
    if (!peutLire_(s, 'catechisme') || !db_().getSheetByName('Catechisme')) return;
    var l = lignes_('Catechisme'), annees = {};
    l.forEach(function (x) { annees[x.annee] = 1; });
    var garder = Object.keys(annees).sort().reverse().slice(0, 2);
    l.forEach(function (x) { if (garder.indexOf(x.annee) > -1) essai(function () { r.cate[x.id] = inscriptionComplete_(x); }); });
  });
  essai(function () {
    if (!peutLire_(s, 'extraits') || !db_().getSheetByName('Extraits')) return;
    var limite = ilYa(24), signe = peutSigner_(s);
    lignes_('Extraits').forEach(function (x) {
      if (String(x.cree_le).slice(0, 10) < limite) return;
      essai(function () { var e = extraitPublic_(x); e.peutSigner = signe; r.extraits[x.id] = e; });
    });
  });
  essai(function () {
    if (!peutLire_(s, 'retraites') || !db_().getSheetByName('Retraites')) return;
    var annee = anneeScolaire_();
    lignes_('Retraites').forEach(function (x) { if (x.annee === annee) essai(function () { r.retraites[x.id] = lireRetraite_({ id: x.id }); }); });
  });
  return r;
}
