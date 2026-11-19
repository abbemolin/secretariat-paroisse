/**
 * Documents : dossier Drive « Secrétariat – La Croix glorieuse »
 *   Dossiers/<Type>/<Année>   pièces et documents générés des dossiers
 *   Modèles                   B14, B6, lettres types…
 *   Partage                   échange de fichiers entre utilisateurs
 * + une vue « À ranger » sur le reste du Drive, pour le réorganiser.
 */

var ID_A_RANGER = 'a-ranger';

function racine_() { return DriveApp.getFolderById(prop_('DOSSIER_ID')); }

function sousDossier_(parent, nom) {
  var it = parent.getFoldersByName(nom);
  return it.hasNext() ? it.next() : parent.createFolder(nom);
}

function dansRacine_(item) {
  var racineId = prop_('DOSSIER_ID');
  if (item.getId() === racineId) return true;
  var aVoir = [item];
  for (var prof = 0; prof < 15 && aVoir.length; prof++) {
    var suivants = [];
    for (var i = 0; i < aVoir.length; i++) {
      var ps = aVoir[i].getParents();
      while (ps.hasNext()) { var x = ps.next(); if (x.getId() === racineId) return true; suivants.push(x); }
    }
    aVoir = suivants;
  }
  return false;
}
function dossierDansRacine_(id) {
  var d = id ? DriveApp.getFolderById(id) : racine_();
  if (!dansRacine_(d)) throw erreur_('INTERDIT', 'Dossier hors du secrétariat.');
  return d;
}
function fichierDansRacine_(id) {
  var f = DriveApp.getFileById(id);
  if (!dansRacine_(f)) throw erreur_('INTERDIT', 'Fichier hors du secrétariat.');
  return f;
}
function fichierPublic_(f) {
  return { id: f.getId(), nom: f.getName(), type: f.getMimeType(), taille: f.getSize(), modifie: f.getLastUpdated().toISOString(), lien: f.getUrl() };
}

function listerDossierDrive_(p) {
  var dossiers = [], fichiers = [], d, ariane;
  if (p.id === ID_A_RANGER) {
    // Racine de « Mon Drive », sans le dossier du secrétariat
    d = DriveApp.getRootFolder();
    var racineId = prop_('DOSSIER_ID');
    var it0 = d.getFolders();
    while (it0.hasNext()) { var x0 = it0.next(); if (x0.getId() !== racineId) dossiers.push({ id: x0.getId(), nom: x0.getName(), aRanger: true }); }
    var itf0 = d.getFiles();
    while (itf0.hasNext() && fichiers.length < 300) { var f0 = fichierPublic_(itf0.next()); f0.aRanger = true; fichiers.push(f0); }
    ariane = [{ id: '', nom: 'Secrétariat' }, { id: ID_A_RANGER, nom: 'À ranger (Mon Drive)' }];
    return { id: ID_A_RANGER, nom: 'À ranger', aRanger: true, ariane: ariane, dossiers: tri_(dossiers), fichiers: tri_(fichiers) };
  }
  var dansSecretariat = true;
  d = p.id ? DriveApp.getFolderById(p.id) : racine_();
  if (!dansRacine_(d)) dansSecretariat = false;   // sous-dossier de « À ranger »
  var it = d.getFolders();
  while (it.hasNext()) { var x = it.next(); dossiers.push({ id: x.getId(), nom: x.getName(), aRanger: !dansSecretariat }); }
  var itf = d.getFiles();
  while (itf.hasNext() && fichiers.length < 500) { var f = fichierPublic_(itf.next()); f.aRanger = !dansSecretariat; fichiers.push(f); }
  ariane = [];
  var cur = d, racine = prop_('DOSSIER_ID'), racineDrive = DriveApp.getRootFolder().getId();
  for (var i = 0; i < 15; i++) {
    if (cur.getId() === racine) { ariane.unshift({ id: '', nom: 'Secrétariat' }); break; }
    if (cur.getId() === racineDrive) { ariane.unshift({ id: '', nom: 'Secrétariat' }, { id: ID_A_RANGER, nom: 'À ranger (Mon Drive)' }); break; }
    ariane.unshift({ id: cur.getId(), nom: cur.getName() });
    var ps = cur.getParents();
    if (!ps.hasNext()) break;
    cur = ps.next();
  }
  return { id: d.getId(), nom: d.getName(), aRanger: !dansSecretariat, ariane: ariane, dossiers: tri_(dossiers), fichiers: tri_(fichiers) };
}
function tri_(l) { return l.sort(function (a, b) { return a.nom.localeCompare(b.nom); }); }

function chercherDocuments_(p) {
  var q = String(p.texte || '').replace(/['\\]/g, ' ').trim();
  if (!q) return [];
  var it = DriveApp.searchFiles("title contains '" + q + "' and trashed = false");
  var res = [];
  while (it.hasNext() && res.length < 50) {
    var f = it.next(), pub = fichierPublic_(f);
    pub.aRanger = !dansRacine_(f);
    res.push(pub);
  }
  return res;
}

var EXPORTS_GOOGLE = {
  'application/vnd.google-apps.document': 'application/pdf',
  'application/vnd.google-apps.spreadsheet': 'application/pdf',
  'application/vnd.google-apps.presentation': 'application/pdf',
  'application/vnd.google-apps.drawing': 'application/pdf'
};
function blobExportable_(f) {
  var cible = EXPORTS_GOOGLE[f.getMimeType()];
  return cible ? f.getAs(cible).setName(f.getName() + '.pdf') : f.getBlob();
}

function telechargerDocument_(p) {
  var f = DriveApp.getFileById(p.id);
  if (f.getSize() > 25 * 1024 * 1024) throw erreur_('TROP_GROS', 'Fichier trop volumineux (25 Mo max) : ouvrez-le dans Drive.');
  var b = blobExportable_(f);
  return { nom: b.getName(), type: b.getContentType(), base64: Utilities.base64Encode(b.getBytes()) };
}

function deposerDocument_(p, s) {
  var d = dossierDansRacine_(p.dossierId);
  var f = d.createFile(Utilities.newBlob(Utilities.base64Decode(p.base64), p.type || 'application/octet-stream', p.nom));
  journaliser_(s, 'Document déposé', p.nom + ' → ' + d.getName());
  return fichierPublic_(f);
}

function creerDossierDrive_(p, s) {
  var n = dossierDansRacine_(p.parentId).createFolder(String(p.nom || 'Nouveau dossier'));
  journaliser_(s, 'Dossier créé', n.getName());
  return { id: n.getId(), nom: n.getName() };
}

function renommerDocument_(p, s) {
  var item;
  try { item = DriveApp.getFileById(p.id); } catch (e) { item = DriveApp.getFolderById(p.id); }
  var ancien = item.getName();
  item.setName(String(p.nom));
  journaliser_(s, 'Renommé', ancien + ' → ' + p.nom);
  return true;
}

/** Déplace un fichier ou dossier vers un dossier du secrétariat (sert aussi à ranger le Drive). */
function deplacerDocument_(p, s) {
  var cible = dossierDansRacine_(p.versId);
  var item;
  try { item = DriveApp.getFileById(p.id); } catch (e) { item = DriveApp.getFolderById(p.id); }
  if (item.getId() === prop_('DOSSIER_ID')) throw erreur_('INVALIDE', 'Impossible de déplacer le dossier du secrétariat.');
  item.moveTo(cible);
  journaliser_(s, 'Déplacé', item.getName() + ' → ' + cible.getName());
  return true;
}
