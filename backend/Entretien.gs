/**
 * Entretien automatique (chaque nuit, ~3 h) et sauvegardes.
 * - Notifications de plus de 6 mois supprimées ; journal de plus de 2 ans archivé dans le Drive (fichier CSV) puis retiré.
 * - Sauvegarde : chaque dimanche, copie complète de la base dans Drive « Sauvegardes » ; les 8 dernières sont gardées.
 * - Restaurer (administrateur) : une copie de la sauvegarde devient la base ; l'ancienne base est gardée et renommée.
 */
var SAUVEGARDES_GARDEES = 8;

/** Installe le déclencheur de nuit s'il n'existe pas (appelé au chargement de l'accueil, au plus une fois toutes les 6 h). */
function assurerEntretien_() {
  var c = CacheService.getScriptCache();
  if (c.get('entretien_ok')) return;
  try {
    var existe = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'entretienNocturne'; });
    if (!existe) ScriptApp.newTrigger('entretienNocturne').timeBased().everyDays(1).atHour(3).inTimezone('Europe/Paris').create();
    c.put('entretien_ok', '1', 21600);
  } catch (e) { console.error('assurerEntretien_', e); }
}
function entretienNocturne() {
  try { purgerFeuille_('Notifications', 'date', 183, false); } catch (e) { console.error('purge notifications', e); }
  try { purgerFeuille_('Journal', 'date', 730, true); } catch (e) { console.error('purge journal', e); }
  var jour = Utilities.formatDate(new Date(), 'Europe/Paris', 'u');   // 7 = dimanche
  if (jour === '7') try { sauvegarder_('automatique'); } catch (e) { console.error('sauvegarde', e); }
  props_().setProperty('ENTRETIEN_DERNIER', maintenant_());
}
/** Retire les lignes plus anciennes que « jours » (archivées en CSV si demandé). */
function purgerFeuille_(nom, colonneDate, jours, archiver) {
  var f = db_().getSheetByName(nom);
  if (!f || f.getLastRow() < 3) return 0;
  var limite = new Date(Date.now() - jours * 86400000).toISOString();
  return verrou_(function () {
    var v = f.getDataRange().getValues(), entetes = v.shift(), j = entetes.indexOf(colonneDate);
    if (j < 0) return 0;
    var iso = function (x) { return x instanceof Date ? x.toISOString() : String(x || ''); };
    var garder = v.filter(function (r) { return !iso(r[j]) || iso(r[j]) >= limite; });
    var anciens = v.filter(function (r) { return iso(r[j]) && iso(r[j]) < limite; });
    if (!anciens.length) return 0;
    if (archiver) {
      var csv = [entetes].concat(anciens).map(function (r) { return r.map(function (c) { return '"' + iso(c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
      sousDossier_(racine_(), 'Archives').createFile(Utilities.newBlob('﻿' + csv, 'text/csv', nom + ' archivé ' + aujourdhui_() + '.csv'));
    }
    f.getRange(2, 1, v.length, entetes.length).clearContent();
    if (garder.length) f.getRange(2, 1, garder.length, entetes.length).setNumberFormat('@').setValues(garder.map(function (r) { return r.map(iso); }));
    return anciens.length;
  });
}

// ─── Sauvegardes ───
function dossierSauvegardes_() { return sousDossier_(racine_(), 'Sauvegardes'); }
function sauvegarder_(origine) {
  var nom = 'Sauvegarde secrétariat ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd HH.mm') + (origine === 'manuelle' ? ' (manuelle)' : '');
  var copie = DriveApp.getFileById(prop_('DB_ID')).makeCopy(nom, dossierSauvegardes_());
  // garder les 8 plus récentes
  var l = [], it = dossierSauvegardes_().getFiles();
  while (it.hasNext()) { var x = it.next(); if (/^Sauvegarde secrétariat /.test(x.getName())) l.push(x); }
  l.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  l.slice(SAUVEGARDES_GARDEES).forEach(function (x) { x.setTrashed(true); });
  return copie;
}
function listerSauvegardes_() {
  var l = [], it = dossierSauvegardes_().getFiles();
  while (it.hasNext()) { var x = it.next(); if (/^Sauvegarde secrétariat /.test(x.getName())) l.push({ id: x.getId(), nom: x.getName(), date: x.getDateCreated().toISOString(), taille: x.getSize(), url: x.getUrl() }); }
  l.sort(function (a, b) { return b.date.localeCompare(a.date); });
  return { sauvegardes: l, entretien: props_().getProperty('ENTRETIEN_DERNIER') || '' };
}
function sauvegardesRoute_(p, s) {
  if (s.role !== 'admin') throw erreur_('INTERDIT', 'Réservé aux administrateurs.');
  if (p.sauvegarder) { sauvegarder_('manuelle'); journaliser_(s, 'Sauvegarde manuelle', ''); }
  if (p.restaurer) {
    var src = DriveApp.getFileById(p.restaurer);
    if (!/^Sauvegarde secrétariat /.test(src.getName())) throw erreur_('INVALIDE', 'Ce fichier n\'est pas une sauvegarde.');
    verrou_(function () {
      var ancienne = DriveApp.getFileById(prop_('DB_ID'));
      sauvegarder_('manuelle');   // filet de sécurité : l'état actuel est sauvegardé avant
      var nouvelle = src.makeCopy('Secrétariat – base (restaurée du ' + src.getName().replace('Sauvegarde secrétariat ', '') + ')', ancienne.getParents().hasNext() ? ancienne.getParents().next() : racine_());
      ancienne.setName(ancienne.getName() + ' – remplacée le ' + aujourdhui_());
      proprietesReelles_().setProperty('DB_ID', nouvelle.getId());
      db_.cache = null; STOCKAGE_ = null;
    });
    journaliser_(s, 'Base restaurée', src.getName());
  }
  return listerSauvegardes_();
}
