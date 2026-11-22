/**
 * Registres paroissiaux : numéro d'acte proposé, actes à inscrire, table alphabétique annuelle.
 * Réglage REGISTRES = { baptemes: { '2026': 14 }, … } : dernier numéro déjà inscrit hors de l'application (registre papier commencé avant).
 */
var REGISTRES = {
  baptemes: { nom: 'Baptêmes', types: ['bapteme', 'catechumene'] },
  communions: { nom: 'Premières communions', types: ['premiere_communion'] },
  professions: { nom: 'Professions de foi', types: ['profession_foi'] },
  confirmations: { nom: 'Confirmations', types: ['confirmation_jeune', 'confirmand'] },
  mariages: { nom: 'Mariages', types: ['mariage'] },
  sepultures: { nom: 'Sépultures', types: ['obseques'] }
};
function registreDuType_(type) {
  for (var k in REGISTRES) if (REGISTRES[k].types.indexOf(type) > -1) return k;
  return '';
}
function reglagesRegistres_() { return json2_(props_().getProperty('REGISTRES'), {}); }

/** Date de la célébration d'un dossier (date commune de l'année pour les célébrations collectives ; date du baptême pour un catéchumène). */
function dateActe_(d, i, promos) {
  if (TITRES_COLLECTIFS[d.type]) return ((promos[d.type + '|' + (i.annee_scolaire || '')] || {}).date || '').slice(0, 10);
  if (d.type === 'catechumene' && i.bapteme_date) return String(i.bapteme_date).slice(0, 10);
  return String(d.date_celebration || '').slice(0, 10);
}
/** Les personnes d'un acte, pour la table alphabétique (deux lignes pour un mariage). */
function personnesActe_(type, i) {
  var p = function (prenoms, nom) { return { nom: String(nom || '').toUpperCase().trim(), prenoms: String(prenoms || '').trim() }; };
  if (['bapteme', 'premiere_communion', 'profession_foi', 'confirmation_jeune'].indexOf(type) > -1) return [p(i.enfant_prenoms, i.enfant_nom)];
  if (type === 'mariage') return [p(i.fiancee_prenoms, i.fiancee_nom), p(i.fiance_prenoms, i.fiance_nom)].filter(function (x) { return x.nom || x.prenoms; });
  if (type === 'obseques') return [p(i.defunt_prenoms, i.defunt_nom)];
  return [p(i.prenoms, i.nom)];
}
/** Tous les dossiers d'un registre, avec leur acte. */
function actesRegistre_(registre) {
  var types = REGISTRES[registre].types, promos = promotions_();
  return lignes_('Dossiers').filter(function (d) { return types.indexOf(d.type) > -1; }).map(function (d) {
    var don = json2_(d.donnees, {}), i = don.infos || {}, e = don.etapes || {};
    return { id: d.id, type: d.type, nom: d.nom, etat: d.etat, date: dateActe_(d, i, promos), annee: String(i.registre_annee || ''), numero: String(i.acte_numero || ''),
             inscrit: !!(e.registre || {}).fait, celebre: !!(e.celebration || {}).fait, personnes: personnesActe_(d.type, i) };
  });
}
function prochainNumero_(registre, annee, sauf) {
  var max = Number(reglagesRegistres_()[registre] && reglagesRegistres_()[registre][annee]) || 0;
  actesRegistre_(registre).forEach(function (a) { if (a.id !== sauf && a.annee === String(annee)) max = Math.max(max, parseInt(a.numero, 10) || 0); });
  return max + 1;
}
/** Proposition pour l'étape « Inscription au registre » d'un dossier. */
function propositionRegistre_(p) {
  var d = trouverDossier_(p.id), registre = registreDuType_(d.type);
  if (!registre) throw erreur_('INVALIDE', 'Ce dossier ne s\'inscrit dans aucun registre.');
  var i = json2_(d.donnees, {}).infos || {};
  var annee = String(p.annee || i.registre_annee || (dateActe_(d, i, promotions_()) || aujourdhui_()).slice(0, 4));
  return { registre: registre, nom_registre: REGISTRES[registre].nom, annee: annee, numero: i.acte_numero && String(i.registre_annee) === annee ? String(i.acte_numero) : String(prochainNumero_(registre, annee, d.id)) };
}
/** Inscription : vérifie qu'aucun autre acte de l'année n'a ce numéro, remplit année + n° et coche l'étape. */
function inscrireRegistre_(p, s) {
  if (!/^\d{4}$/.test(String(p.annee || ''))) throw erreur_('INVALIDE', 'Année invalide.');
  if (!/^\d+[a-zA-Z]?$/.test(String(p.numero || '').trim())) throw erreur_('INVALIDE', 'Numéro d\'acte invalide.');
  var num = String(p.numero).trim();
  return verrou_(function () {
    var d = trouverDossier_(p.id), registre = registreDuType_(d.type);
    if (!registre) throw erreur_('INVALIDE', 'Ce dossier ne s\'inscrit dans aucun registre.');
    var doublon = actesRegistre_(registre).filter(function (a) { return a.id !== d.id && a.annee === String(p.annee) && a.numero.toLowerCase() === num.toLowerCase(); })[0];
    if (doublon) throw erreur_('DOUBLON', 'L\'acte n° ' + num + ' de ' + p.annee + ' est déjà attribué à ' + doublon.nom + '.');
    var don = json2_(d.donnees, {});
    don.infos = don.infos || {}; don.etapes = don.etapes || {};
    don.infos.registre_annee = String(p.annee); don.infos.acte_numero = num;
    don.etapes.registre = { fait: true, date: maintenant_(), par: s.nom, libelle: 'Inscription au registre' };
    d.donnees = JSON.stringify(don); d.maj_le = maintenant_();
    ecrireLigne_('Dossiers', d);
    journaliser_(s, 'Registre des ' + REGISTRES[registre].nom.toLowerCase(), p.annee + ' n° ' + num + ' – ' + d.nom);
    return dossierComplet_(d);
  });
}
/** Actes à inscrire : célébration passée (ou cochée), étape « Inscription au registre » non faite. */
function actesAInscrire_(registre) {
  var auj = aujourdhui_();
  return actesRegistre_(registre).filter(function (a) { return !a.inscrit && a.etat !== 'annule' && (a.celebre || (a.date && a.date <= auj)); });
}
function registresRoute_(p, s) {
  if (p.dossier) return propositionRegistre_({ id: p.dossier, annee: p.annee });
  if (p.inscrire) return inscrireRegistre_(p.inscrire, s);
  if (p.depart) {   // { registre, annee, numero }
    if (s.role !== 'admin') throw erreur_('INTERDIT', 'Réservé aux administrateurs.');
    var r = reglagesRegistres_(); r[p.depart.registre] = r[p.depart.registre] || {};
    r[p.depart.registre][p.depart.annee] = Number(p.depart.numero) || 0;
    props_().setProperty('REGISTRES', JSON.stringify(r));
  }
  var registre = REGISTRES[p.registre] ? p.registre : 'baptemes';
  var annee = String(p.annee || aujourdhui_().slice(0, 4));
  var tous = actesRegistre_(registre);
  var table = [];
  tous.filter(function (a) { return a.inscrit && a.annee === annee; }).forEach(function (a) {
    a.personnes.forEach(function (x) { table.push({ nom: x.nom, prenoms: x.prenoms, numero: a.numero, date: a.date, id: a.id, type: a.type }); });
  });
  table.sort(function (a, b) { return (a.nom + ' ' + a.prenoms).localeCompare(b.nom + ' ' + b.prenoms, 'fr', { sensitivity: 'base' }) || (parseInt(a.numero, 10) - parseInt(b.numero, 10)); });
  var annees = {}; tous.forEach(function (a) { if (a.annee) annees[a.annee] = 1; }); annees[aujourdhui_().slice(0, 4)] = 1;
  var compte = {}; Object.keys(REGISTRES).forEach(function (k) { compte[k] = actesAInscrire_(k).length; });
  return {
    registres: Object.keys(REGISTRES).map(function (k) { return { cle: k, nom: REGISTRES[k].nom, a_inscrire: compte[k] }; }),
    registre: registre, annee: annee, annees: Object.keys(annees).sort().reverse(),
    depart: Number((reglagesRegistres_()[registre] || {})[annee]) || 0,
    prochain: prochainNumero_(registre, annee),
    a_inscrire: actesAInscrire_(registre).map(function (a) { return { id: a.id, nom: a.nom, type: a.type, date: a.date }; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }),
    table: table
  };
}
