/**
 * Extraits de baptême (B14) : registre des extraits délivrés, signature dans
 * l'appli, PDF archivé dans le Drive (Extraits/<Année>), envoi par e-mail.
 * Le PDF est fabriqué par l'appli (rendu fidèle) puis envoyé ici pour archivage.
 */

var COLONNES_EXTRAITS = ['id', 'cree_le', 'cree_par', 'dossier_id', 'nom', 'valeurs', 'statut', 'signe_par', 'signe_le',
  'signature_id', 'pdf_id', 'envois', 'maj_le', 'maj_par'];

/** Feuille créée automatiquement au premier usage (pas besoin de relancer installer). */
function feuilleExtraits_() {
  var f = db_().getSheetByName('Extraits');
  if (!f) {
    f = db_().insertSheet('Extraits');
    f.getRange('A:Z').setNumberFormat('@');
    f.appendRow(COLONNES_EXTRAITS);
    f.setFrozenRows(1);
  }
  return f;
}

function dossierExtraits_(annee) {
  return sousDossier_(sousDossier_(racine_(), 'Extraits de baptême'), String(annee || new Date().getFullYear()));
}

function peutSigner_(s) {
  var liste = String(reglages_().signataires || '').split(',').filter(String);
  if (liste.length) return liste.indexOf(s.uid) > -1;
  return s.role === 'admin' || s.role === 'secretaire';
}

function extraitPublic_(x) {
  return {
    id: x.id, cree_le: x.cree_le, cree_par: x.cree_par, dossier_id: x.dossier_id, nom: x.nom,
    valeurs: json2_(x.valeurs, {}), statut: x.statut, signe_par: x.signe_par, signe_le: x.signe_le,
    signature_id: x.signature_id, pdf_id: x.pdf_id, envois: json2_(x.envois, []), maj_le: x.maj_le, maj_par: x.maj_par
  };
}

function trouverExtrait_(id) {
  feuilleExtraits_();
  var x = lignes_('Extraits').filter(function (e) { return e.id === id; })[0];
  if (!x) throw erreur_('INTROUVABLE', 'Extrait introuvable.');
  return x;
}

function listerExtraits_(p, s) {
  feuilleExtraits_();
  return {
    extraits: lignes_('Extraits').sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); }).map(extraitPublic_),
    peutSigner: peutSigner_(s)
  };
}

function lireExtrait_(p, s) {
  var x = extraitPublic_(trouverExtrait_(p.id));
  x.peutSigner = peutSigner_(s);
  return x;
}

/** Création ou modification. Modifier un extrait signé retire la signature (il faut re-signer). */
function enregistrerExtrait_(p, s) {
  var v = p.valeurs || {};
  var nom = [v.prenoms, String(v.nom || '').toUpperCase()].filter(String).join(' ') || '(sans nom)';
  var x = verrou_(function () {
    feuilleExtraits_();
    var e = p.id ? trouverExtrait_(p.id) : {
      id: uid_(), cree_le: maintenant_(), cree_par: s.nom, dossier_id: p.dossier_id || '', statut: 'brouillon', envois: '[]'
    };
    var avant = e.valeurs;
    e.valeurs = JSON.stringify(v);
    e.nom = nom;
    if (p.id && e.statut === 'signe' && avant !== e.valeurs) {
      e.statut = 'brouillon'; e.signe_par = ''; e.signe_le = ''; e.pdf_id = '';
    }
    e.maj_le = maintenant_(); e.maj_par = s.nom;
    return ecrireLigne_('Extraits', e);
  });
  journaliser_(s, p.id ? 'Extrait modifié' : 'Extrait créé', nom);
  return lireExtrait_({ id: x.id }, s);
}

/** Signature : image PNG de la signature + PDF signé fabriqué par l'appli. */
function signerExtrait_(p, s) {
  if (!peutSigner_(s)) throw erreur_('INTERDIT', "Vous n'êtes pas habilité(e) à signer les extraits.");
  if (!p.signature || !p.pdf) throw erreur_('INVALIDE', 'Signature ou document manquant.');
  var x = verrou_(function () {
    var e = trouverExtrait_(p.id);
    var annee = String(e.cree_le).slice(0, 4);
    var dossier = dossierExtraits_(annee);
    var base = maintenant_().slice(0, 10) + ' ' + String(e.nom).replace(/[\\/:*?"<>|]/g, '-');
    var sig = dossier.createFile(Utilities.newBlob(Utilities.base64Decode(p.signature), 'image/png', base + ' – signature.png'));
    var pdf = dossier.createFile(Utilities.newBlob(Utilities.base64Decode(p.pdf), 'application/pdf', base + ' – extrait de baptême.pdf'));
    // l'ancien PDF signé (si re-signature) est mis à la corbeille
    if (e.pdf_id) { try { DriveApp.getFileById(e.pdf_id).setTrashed(true); } catch (err) {} }
    if (e.signature_id) { try { DriveApp.getFileById(e.signature_id).setTrashed(true); } catch (err) {} }
    e.statut = 'signe'; e.signe_par = s.nom; e.signe_le = maintenant_();
    e.signature_id = sig.getId(); e.pdf_id = pdf.getId();
    e.maj_le = maintenant_(); e.maj_par = s.nom;
    ecrireLigne_('Extraits', e);
    if (e.dossier_id) {
      try {
        var d = trouverDossier_(e.dossier_id);
        enregistrerPiece_(d, pdf, 'Extrait de baptême (B14) signé', '', s, true);
      } catch (err) {}
    }
    return e;
  });
  journaliser_(s, 'Extrait signé', x.nom);
  return lireExtrait_({ id: x.id }, s);
}

/** Image de la signature d'un extrait (pour réafficher / réimprimer). */
function signatureExtrait_(p) {
  var e = trouverExtrait_(p.id);
  if (!e.signature_id) return '';
  return Utilities.base64Encode(DriveApp.getFileById(e.signature_id).getBlob().getBytes());
}

function envoyerExtrait_(p, s) {
  var e = trouverExtrait_(p.id);
  if (e.statut !== 'signe' || !e.pdf_id) throw erreur_('INVALIDE', "L'extrait doit d'abord être signé.");
  if (!p.a) throw erreur_('INVALIDE', 'Destinataire manquant.');
  var opts = optionsEnvoi_();
  opts.htmlBody = corpsHtml_(p.corps, p.signatureMail);
  opts.attachments = [DriveApp.getFileById(e.pdf_id).getBlob()];
  GmailApp.sendEmail(p.a, p.sujet || 'Extrait de baptême', corpsTexte_(p.corps, p.signatureMail), opts);
  verrou_(function () {
    var x = trouverExtrait_(p.id);
    x.envois = JSON.stringify(json2_(x.envois, []).concat([{ a: p.a, date: maintenant_(), par: s.nom }]));
    ecrireLigne_('Extraits', x);
  });
  journaliser_(s, 'Extrait envoyé', e.nom + ' → ' + p.a);
  return lireExtrait_({ id: p.id }, s);
}

// ─── Sceau paroissial (image stockée dans le Drive, dossier Modèles) ───

function lireSceau_() {
  var id = props_().getProperty('SCEAU_ID');
  if (!id) return '';
  try {
    var b = DriveApp.getFileById(id).getBlob();
    return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
  } catch (e) { return ''; }
}

function ecrireSceau_(p, s) {
  var ancien = props_().getProperty('SCEAU_ID');
  if (ancien) { try { DriveApp.getFileById(ancien).setTrashed(true); } catch (e) {} }
  if (!p.base64) { props_().deleteProperty('SCEAU_ID'); return ''; }
  var f = sousDossier_(racine_(), 'Modèles').createFile(Utilities.newBlob(Utilities.base64Decode(p.base64), p.type || 'image/png', 'Sceau paroissial.' + (/jpe?g/.test(p.type) ? 'jpg' : 'png')));
  props_().setProperty('SCEAU_ID', f.getId());
  journaliser_(s, 'Sceau paroissial modifié', '');
  return lireSceau_();
}
