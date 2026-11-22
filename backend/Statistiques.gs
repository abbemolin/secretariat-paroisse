/**
 * Tableau de bord annuel (administrateurs) : sacrements de l'année civile, catéchèse et Cor Unum de l'année scolaire,
 * chaque chiffre comparé à l'année précédente.
 */
var STAT_SACREMENTS = [
  { cle: 'bapteme', nom: 'Baptêmes d\'enfants', types: ['bapteme'] },
  { cle: 'catechumene', nom: 'Baptêmes d\'adultes', types: ['catechumene'] },
  { cle: 'premiere_communion', nom: 'Premières communions', types: ['premiere_communion'] },
  { cle: 'profession_foi', nom: 'Professions de foi', types: ['profession_foi'] },
  { cle: 'confirmation', nom: 'Confirmations', types: ['confirmation_jeune', 'confirmand'] },
  { cle: 'mariage', nom: 'Mariages', types: ['mariage'] },
  { cle: 'obseques', nom: 'Obsèques', types: ['obseques'] }
];
/** Sacrements célébrés : année civile, par type et par mois. */
function statSacrements_(annee) {
  var promos = promotions_(), auj = aujourdhui_();
  var res = {}, mois = [];
  for (var m = 0; m < 12; m++) mois.push(0);
  STAT_SACREMENTS.forEach(function (x) { res[x.cle] = 0; });
  lignes_('Dossiers').forEach(function (d) {
    if (d.etat === 'annule') return;
    var g = STAT_SACREMENTS.filter(function (x) { return x.types.indexOf(d.type) > -1; })[0];
    if (!g) return;
    var don = json2_(d.donnees, {}), date = dateActe_(d, don.infos || {}, promos);
    if (!date || date.slice(0, 4) !== String(annee)) return;
    if (date > auj && !((don.etapes || {}).celebration || {}).fait) return;   // pas encore célébré
    res[g.cle]++; mois[Number(date.slice(5, 7)) - 1]++;
  });
  return { par_type: res, par_mois: mois };
}
/** Catéchèse de l'année scolaire : inscriptions au catéchisme, classes, cotisations, préparations aux sacrements. */
function statCatechese_(annee) {
  var r = { inscriptions: 0, enfants: 0, classes: {}, du: 0, paye: 0, preparations: { premiere_communion: 0, profession_foi: 0, confirmation_jeune: 0, confirmand: 0, catechumene: 0 } };
  try {
    if (db_().getSheetByName('Catechisme')) lignes_('Catechisme').filter(function (x) { return x.annee === annee; }).forEach(function (x) {
      var s = resumeInscription_(x);
      r.inscriptions++; r.enfants++;
      var c = String(s.classe || 'Non précisée').trim() || 'Non précisée';
      r.classes[c] = (r.classes[c] || 0) + 1;
      r.du += s.du; r.paye += s.paye;
    });
  } catch (e) {}
  var a2 = annee.slice(5);
  lignes_('Dossiers').forEach(function (d) {
    if (d.etat === 'annule' || !(d.type in r.preparations)) return;
    var i = json2_(d.donnees, {}).infos || {};
    var an = String(i.annee_scolaire || i.annee_sacrements || '');
    // catéchumènes / confirmands adultes : année civile des sacrements (Pâques), comptée dans l'année scolaire qui la contient
    if (an === annee || an === a2) r.preparations[d.type]++;
  });
  r.du = Math.round(r.du); r.paye = Math.round(r.paye);
  return r;
}
/** Cor Unum de l'année scolaire : membres, ménages, fraternités, personnes non placées. */
function statCor_(annee) {
  var r = { membres: 0, places: 0, fraternites: 0, chefs: 0 };
  try {
    if (!db_().getSheetByName('CorUnum')) return r;
    var reg = corReglages_(), eq = equipesDe_(reg, annee);
    r.fraternites = eq.length;
    r.chefs = eq.reduce(function (a, e) { return a + (e.chefs || []).length; }, 0);
    lignes_('CorUnum').filter(function (x) { return x.annee === annee && x.statut !== 'ancien'; }).forEach(function (x) { r.membres++; if (x.equipe_id) r.places++; });
  } catch (e) {}
  return r;
}
function statistiquesRoute_(p, s) {
  var civile = Number(p.annee || aujourdhui_().slice(0, 4));
  var scolaire = /^\d{4}-\d{4}$/.test(String(p.scolaire || '')) ? p.scolaire : anneeScolaire_(aujourdhui_());
  var a = Number(scolaire.slice(0, 4)), precScol = (a - 1) + '-' + a;
  return {
    annee: civile, scolaire: scolaire, annee_prec: civile - 1, scolaire_prec: precScol,
    types: STAT_SACREMENTS.map(function (x) { return { cle: x.cle, nom: x.nom }; }),
    sacrements: statSacrements_(civile), sacrements_prec: statSacrements_(civile - 1),
    catechese: statCatechese_(scolaire), catechese_prec: statCatechese_(precScol),
    cor: statCor_(scolaire), cor_prec: statCor_(precScol)
  };
}
