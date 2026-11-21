/**
 * Espace personnel des catéchumènes et néophytes — app « Croix glorieuse » (app.croix-glorieuse.org).
 * Sans compte dans l'appli : lien personnel + mot de passe choisi par la personne (code reçu par mail),
 * session de 90 jours. La personne complète son dossier (identité, parents, parrain/marraine), dépose
 * ses pièces, rédige sa lettre à l'évêque ; elle voit son parcours, le calendrier de sa promotion et
 * les textes publiés pour elle. Notification sur le téléphone à chaque nouveau texte.
 */

var COLONNES_ESPACES = ['dossier_id', 'jeton', 'hash', 'sel', 'mdp_maj', 'cree_le', 'derniere_visite'];
var COLONNES_TEXTES = ['id', 'cree_le', 'auteur', 'titre', 'corps', 'cible', 'fichiers', 'liens', 'lus', 'maj_le'];
var COLONNES_CALENDRIER = ['id', 'date', 'heure_debut', 'heure_fin', 'titre', 'lieu', 'cible', 'note'];
var ESPACE_SESSION_JOURS = 90;
var CHAMPS_ESPACE = ['prenom_bapteme', 'prenoms', 'nom', 'sexe', 'nom_jeune_fille', 'naissance_date', 'naissance_lieu', 'adresse', 'nationalite', 'profession', 'telephone', 'email',
  'pere_prenom', 'pere_nom', 'mere_prenom', 'mere_nom_jeune_fille', 'situation', 'conjoint', 'parrain_marraine', 'parrain_contact'];
var PIECES_ESPACE = { acte_naissance: 'Acte de naissance', photo: 'Photo d\'identité', cert_parrain: 'Certificat du parrain / de la marraine' };

function feuilleEsp_(nom, colonnes) {
  var f = db_().getSheetByName(nom);
  if (!f) { f = db_().insertSheet(nom); f.getRange('A:Z').setNumberFormat('@'); f.appendRow(colonnes); f.setFrozenRows(1); }
  return f;
}
/**
 * Lit le calendrier en remettant au propre les dates et heures que Google Sheets aurait converties
 * (« 2027-02-21 » → date, « 15:00 » → 30/12/1899 15:00) ; les lignes touchées sont réécrites en texte.
 */
function lignesCal_() {
  var f = db_().getSheetByName('CalendrierCate');
  if (!f) return [];
  var tz = db_().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  var valeurs = f.getDataRange().getValues(), entetes = valeurs.shift(), res = [], aReparer = false;
  valeurs.forEach(function (r, i) {
    var o = { _ligne: i + 2 }, abime = false;
    entetes.forEach(function (h, j) {
      var v = r[j];
      if (v instanceof Date) {
        abime = true;
        v = (h === 'heure_debut' || h === 'heure_fin' || v.getFullYear() < 1901)
          ? Utilities.formatDate(v, tz, 'HH:mm') : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      }
      o[h] = v === null || v === undefined ? '' : String(v);
    });
    if (o[entetes[0]] === '') return;
    if (abime) { o._abime = true; aReparer = true; }
    res.push(o);
  });
  if (aReparer) {
    try {
      f.getRange('A:Z').setNumberFormat('@');
      res.forEach(function (o) { if (o._abime) { delete o._abime; ecrireLigne_('CalendrierCate', o); } });
    } catch (e) {}
  }
  return res;
}
function feuillesEspace_() { feuilleEsp_('Espaces', COLONNES_ESPACES); feuilleEsp_('Textes', COLONNES_TEXTES); feuilleEsp_('CalendrierCate', COLONNES_CALENDRIER); }
function urlEspace_(jeton) { return 'https://app.croix-glorieuse.org/?c=' + jeton; }

// ─── Promotion d'un dossier (pour les textes et le calendrier) ───

function profilEspace_(d) {
  var don = json2_(d.donnees, {}), i = don.infos || {}, et = don.etapes || {};
  var neo = !!(et.sacrements && et.sacrements.fait);
  return { neo: neo, annee: String(i.annee_sacrements || ''), id: d.id };
}
function cibleConcerne_(cible, pr) {
  var c = String(cible || '');
  if (c === 'tous') return true;
  if (c === 'd:' + pr.id) return true;
  if (c === 'cat:attente') return !pr.neo && !pr.annee;
  if (c === 'neo:tous') return pr.neo;
  var m = c.match(/^(cat|neo):(\d{4})$/);
  return !!m && (m[1] === 'neo') === pr.neo && m[2] === pr.annee;
}
function libelleCible_(c) {
  if (c === 'tous') return 'Tous (catéchumènes et néophytes)';
  if (c === 'cat:attente') return 'Catéchumènes en attente';
  if (c === 'neo:tous') return 'Tous les néophytes';
  var m = String(c).match(/^(cat|neo):(\d{4})$/);
  if (m) return (m[1] === 'cat' ? 'Catéchumènes – baptême ' : 'Néophytes – baptisés en ') + m[2];
  if (/^d:/.test(c)) { try { return trouverDossier_(c.slice(2)).nom; } catch (e) { return 'Une personne'; } }
  return c;
}

// ─── Accès (lien + mot de passe) ───

function espaceParJeton_(c) {
  if (!/^[a-f0-9]{32}$/.test(String(c || ''))) throw erreur_('LIEN', 'Ce lien n\'est pas valable. Demandez un nouveau lien à la paroisse.');
  feuillesEspace_();
  var x = lignes_('Espaces').filter(function (y) { return y.jeton === c; })[0];
  if (!x) throw erreur_('LIEN', 'Ce lien n\'est plus valable. Demandez un nouveau lien à la paroisse.');
  var d = trouverDossier_(x.dossier_id);
  if (!d || d.type !== 'catechumene') throw erreur_('LIEN', 'Ce lien n\'est plus valable.');
  return { esp: x, d: d };
}
function signatureEsp_(id, exp, hash) {
  return hex_(Utilities.computeHmacSha256Signature('esp|' + id + '|' + exp + '|' + String(hash).slice(0, 16), secretChef_())).slice(0, 40);
}
function sessionEspValide_(esp, session) {
  var x = String(session || '').split('.');
  if (!esp.hash || x.length !== 2 || Number(x[0]) < Date.now()) return false;
  return x[1] === signatureEsp_(esp.dossier_id, x[0], esp.hash);
}
function nouvelleSessionEsp_(esp) {
  var exp = Date.now() + ESPACE_SESSION_JOURS * 86400000;
  return exp + '.' + signatureEsp_(esp.dossier_id, exp, esp.hash);
}
function mailDossier_(d) {
  var i = json2_(d.donnees, {}).infos || {};
  return String(i.email || d.email || '').toLowerCase().split(/[\s,;]+/).filter(function (m) { return /@/.test(m); })[0] || '';
}

function actionEspace_(action, p) {
  var cache = CacheService.getScriptCache(), cle = 'esp_' + String(p.c || '').slice(0, 32);
  var n = Number(cache.get(cle) || 0);
  if (n > 300) throw erreur_('LIMITE', 'Trop d\'actions en peu de temps. Réessayez dans une heure.');
  cache.put(cle, String(n + 1), 3600);

  var ctx = espaceParJeton_(p.c), esp = ctx.esp, d = ctx.d;
  var i0 = json2_(d.donnees, {}).infos || {};
  if (action === 'esp.etat') {
    var m = mailDossier_(d);
    return { prenom: i0.prenoms || '', mot_de_passe: !!esp.hash, mail: m ? masquerMail_(m) : '', session: sessionEspValide_(esp, p.session), cle_push: clePubliquePush_() };
  }
  if (action === 'esp.connexion') {
    if (!esp.hash) throw erreur_('MDP', 'Aucun mot de passe n\'est encore choisi : utilisez « Choisir mon mot de passe ».');
    compteurChef_('espmdp_' + esp.dossier_id, 10, 900, 'Trop d\'essais. Réessayez dans un quart d\'heure, ou utilisez « Mot de passe oublié ».');
    if (hacher_(String(p.mdp || ''), esp.sel) !== esp.hash) throw erreur_('MDP', 'Mot de passe incorrect.');
    return { session: nouvelleSessionEsp_(esp) };
  }
  if (action === 'esp.code') {
    var mail = mailDossier_(d);
    if (!mail) throw erreur_('MAIL', 'Aucune adresse e-mail n\'est connue dans votre dossier. Contactez la paroisse.');
    compteurChef_('espenvoi_' + esp.dossier_id, 5, 3600, 'Trop de codes envoyés. Réessayez dans une heure.');
    var code = String(Math.floor(100000 + Math.random() * 900000));
    CacheService.getScriptCache().put('espcode_' + esp.dossier_id, JSON.stringify({ code: code, essais: 0 }), 900);
    var t = 'Bonjour ' + (i0.prenoms || '') + ',\n\nVoici votre code pour choisir le mot de passe de votre espace personnel « Croix glorieuse » :\n\n' + code +
      '\n\nIl est valable 15 minutes. Si vous n\'avez rien demandé, ignorez ce message.\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
    var opts = optionsEnvoi_();
    GmailApp.sendEmail(mail, 'Croix glorieuse – votre code : ' + code, corpsTexte_(t, 'paroisse'), { name: opts.name, from: opts.from, htmlBody: corpsHtml_(t, 'paroisse') });
    return { mail: masquerMail_(mail) };
  }
  if (action === 'esp.definir') {
    var c = json2_(cache.get('espcode_' + esp.dossier_id), null);
    if (!c) throw erreur_('CODE', 'Code expiré. Demandez un nouveau code.');
    if (String(p.code || '').replace(/\s/g, '') !== c.code) {
      c.essais++;
      if (c.essais >= 5) cache.remove('espcode_' + esp.dossier_id); else cache.put('espcode_' + esp.dossier_id, JSON.stringify(c), 900);
      throw erreur_('CODE', c.essais >= 5 ? 'Trop d\'essais. Demandez un nouveau code.' : 'Code incorrect.');
    }
    if (String(p.mdp || '').length < 8) throw erreur_('MDP', 'Le mot de passe doit contenir au moins 8 caractères.');
    var nv = verrou_(function () {
      var x = lignes_('Espaces').filter(function (y) { return y.dossier_id === esp.dossier_id; })[0];
      x.sel = jeton_().slice(0, 16); x.hash = hacher_(String(p.mdp), x.sel); x.mdp_maj = maintenant_();
      ecrireLigne_('Espaces', x);
      return x;
    });
    cache.remove('espcode_' + esp.dossier_id);
    return { session: nouvelleSessionEsp_(nv) };
  }
  if (!sessionEspValide_(esp, p.session)) throw erreur_('SESSION', 'Connectez-vous avec votre mot de passe.');

  if (action === 'esp.lire') {
    verrou_(function () { var x = lignes_('Espaces').filter(function (y) { return y.dossier_id === esp.dossier_id; })[0]; x.derniere_visite = maintenant_(); ecrireLigne_('Espaces', x); });
    return vueEspace_(d);
  }
  if (action === 'esp.modifier') {
    verrou_(function () {
      var x = trouverDossier_(d.id), don = json2_(x.donnees, {});
      don.infos = don.infos || {};
      var changes = [];
      var neo = profilEspace_(x).neo;
      CHAMPS_ESPACE.forEach(function (k) {
        if (k === 'prenom_bapteme' && neo) return;   // après le baptême : lecture seule
        if (p.infos && p.infos[k] !== undefined) {
          var v = String(p.infos[k] == null ? '' : p.infos[k]).trim().slice(0, 300);
          if (v !== String(don.infos[k] || '')) { don.infos[k] = v; changes.push(k); }
        }
      });
      if (!changes.length) return;
      x.donnees = JSON.stringify(don);
      x.nom = nomDossier_('catechumene', don.infos) || x.nom;
      if (don.infos.email) x.email = don.infos.email;
      if (don.infos.telephone) x.telephone = don.infos.telephone;
      ajouterHistorique_(x, 'Espace personnel', 'Informations complétées par ' + (don.infos.prenoms || 'la personne') + ' (' + changes.length + ' champ' + (changes.length > 1 ? 's' : '') + ')');
      x.maj_le = maintenant_(); x.maj_par = 'Espace personnel';
      ecrireLigne_('Dossiers', x);
      prevenirEspace_(x, 'Espace personnel : informations complétées');
    });
    return vueEspace_(trouverDossier_(d.id));
  }
  if (action === 'esp.piece') {
    if (!PIECES_ESPACE[p.doc]) throw erreur_('INVALIDE', 'Pièce inconnue.');
    if (!/^(application\/pdf|image\/(jpeg|png|heic|heif|webp))$/.test(String(p.type || ''))) throw erreur_('INVALIDE', 'Envoyez une photo ou un PDF.');
    if (String(p.base64 || '').length > 14000000) throw erreur_('TROP_GROS', 'Fichier trop lourd (10 Mo au plus).');
    verrou_(function () {
      var x = trouverDossier_(d.id);
      var ext = (String(p.nom || '').match(/\.([a-z0-9]{1,5})$/i) || [])[1] || (p.type === 'application/pdf' ? 'pdf' : 'jpg');
      var f = dossierDriveDe_(x).createFile(Utilities.newBlob(Utilities.base64Decode(p.base64), p.type, nomFichierDossier_(x, PIECES_ESPACE[p.doc], ext)));
      enregistrerPiece_(x, f, PIECES_ESPACE[p.doc], p.doc, { nom: 'Espace personnel' }, false);
      prevenirEspace_(x, 'Espace personnel : pièce déposée (' + PIECES_ESPACE[p.doc] + ')');
    });
    return vueEspace_(trouverDossier_(d.id));
  }
  if (action === 'esp.lettre') {
    verrou_(function () {
      var x = trouverDossier_(d.id), don = json2_(x.donnees, {});
      var l = don.lettre || {};
      if (l.statut === 'validee') throw erreur_('VALIDEE', 'Votre lettre a déjà été validée.');
      l.texte = String(p.texte || '').slice(0, 12000);
      l.maj = maintenant_();
      if (p.envoyer) {
        if (l.texte.trim().length < 50) throw erreur_('COURT', 'Votre lettre est encore un peu courte.');
        l.statut = 'envoyee'; l.envoyee_le = maintenant_();
        ajouterHistorique_(x, 'Espace personnel', 'Lettre à l\'évêque envoyée pour relecture');
      } else if (l.statut !== 'a_corriger') l.statut = 'brouillon';
      don.lettre = l;
      x.donnees = JSON.stringify(don); x.maj_le = maintenant_(); x.maj_par = 'Espace personnel';
      ecrireLigne_('Dossiers', x);
      if (p.envoyer) prevenirEspace_(x, 'Lettre à l\'évêque à relire');
    });
    return vueEspace_(trouverDossier_(d.id));
  }
  if (action === 'esp.signaler') {
    var texteS = String(p.texte || '').trim().slice(0, 3000);
    if (texteS.length < 3) throw erreur_('VIDE', 'Décrivez l\'erreur en quelques mots.');
    verrou_(function () {
      var x = trouverDossier_(d.id), don = json2_(x.donnees, {});
      don.signalements = don.signalements || [];
      if (don.signalements.filter(function (z) { return z.statut === 'ouvert'; }).length >= 20) throw erreur_('LIMITE', 'Vous avez déjà beaucoup de signalements en attente : la paroisse va les traiter.');
      var sujet = String(p.sujet || 'Autre').slice(0, 120);
      don.signalements.push({ id: uid_(), date: maintenant_(), sujet: sujet, texte: texteS, statut: 'ouvert' });
      x.donnees = JSON.stringify(don);
      ajouterHistorique_(x, 'Espace personnel', 'Erreur signalée (' + sujet + ') : ' + texteS.slice(0, 200));
      x.maj_le = maintenant_(); x.maj_par = 'Espace personnel';
      ecrireLigne_('Dossiers', x);   // visible dans l'encadré « Espace personnel » du dossier (pas de notification)
    });
    return vueEspace_(trouverDossier_(d.id));
  }
  if (action === 'esp.lu') {
    verrou_(function () {
      var t = lignes_('Textes').filter(function (y) { return y.id === p.texte; })[0];
      if (!t || !cibleConcerne_(t.cible, profilEspace_(d))) return;
      var lus = json2_(t.lus, {});
      if (!lus[d.id]) { lus[d.id] = maintenant_(); t.lus = JSON.stringify(lus); ecrireLigne_('Textes', t); }
    });
    return true;
  }
  if (action === 'esp.fichier') {
    var t2 = lignes_('Textes').filter(function (y) { return y.id === p.texte; })[0];
    if (!t2 || !cibleConcerne_(t2.cible, profilEspace_(d))) throw erreur_('INTROUVABLE', 'Document introuvable.');
    var fi = json2_(t2.fichiers, []).filter(function (y) { return y.id === p.fichier; })[0];
    if (!fi) throw erreur_('INTROUVABLE', 'Document introuvable.');
    var b = DriveApp.getFileById(fi.id).getBlob();
    return { nom: fi.nom, type: b.getContentType(), base64: Utilities.base64Encode(b.getBytes()) };
  }
  if (action === 'esp.push') {
    if (p.desabonner) return desabonnerPush_({ endpoint: p.endpoint });
    return abonnerPush_({ endpoint: p.endpoint, appareil: p.appareil }, { uid: 'esp:' + d.id });
  }
  throw erreur_('ACTION', 'Action inconnue.');
}

function prevenirEspace_(d, titre) {
  lignes_('Utilisateurs').filter(estActif_).forEach(function (u) { notifier_(u.id, titre, d.nom, '#/dossiers/' + d.id); });
}

/** Ce que voit la personne. */
function vueEspace_(d) {
  var don = json2_(d.donnees, {}), i = don.infos || {}, pr = profilEspace_(d);
  var docs = don.documents || {};
  var auj = maintenant_().slice(0, 10);
  var cal = lignesCal_().filter(function (e) { return cibleConcerne_(e.cible, pr) && e.date >= auj; })
    .map(function (e) { return { date: e.date, heure_debut: e.heure_debut, heure_fin: e.heure_fin, titre: e.titre, lieu: e.lieu, note: e.note }; });
  if (!pr.neo && pr.annee) {
    try {
      lignes_('Retraites').filter(function (r) { return r.type === 'confirmation_adultes' && anneeAdultes_(r.annee) === pr.annee && r.date_debut >= auj; }).forEach(function (r) {
        cal.push({ date: r.date_debut, date_fin: r.date_fin, heure_debut: r.heure_debut, heure_fin: r.heure_fin, titre: titreRetraite_(r), lieu: r.lieu, lien: r.jeton ? urlRetraite_({ r: r.jeton }) : '' });
      });
    } catch (e) { /* pas encore de retraites */ }
  }
  cal.sort(function (a, b) { return String(a.date + a.heure_debut).localeCompare(String(b.date + b.heure_debut)); });
  var textes = lignes_('Textes').filter(function (t) { return cibleConcerne_(t.cible, pr); })
    .sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); })
    .map(function (t) { return { id: t.id, date: t.cree_le, titre: t.titre, corps: t.corps, auteur: t.auteur, liens: json2_(t.liens, []), fichiers: json2_(t.fichiers, []).map(function (f) { return { id: f.id, nom: f.nom, type: f.type }; }), lu: !!json2_(t.lus, {})[d.id] }; });
  var infos = {};
  CHAMPS_ESPACE.forEach(function (k) { infos[k] = i[k] || ''; });
  var l = don.lettre || {};
  return {
    prenom: i.prenoms || '', nom: i.nom || '', neophyte: pr.neo, annee: pr.annee, accompagnateur: i.accompagnateurs || '',
    etapes: don.etapes || {}, infos: infos,
    pieces: Object.keys(PIECES_ESPACE).map(function (k) { return { cle: k, nom: PIECES_ESPACE[k], recu: !!(docs[k] && docs[k].recu) }; }),
    lettre: { texte: l.texte || '', statut: l.statut || '', remarque: l.remarque || '', validee_le: l.validee_le || '' },
    signalements: (don.signalements || []).slice(-30).reverse().map(function (z) { return { id: z.id, date: z.date, sujet: z.sujet, texte: z.texte, statut: z.statut, reponse: z.reponse || '', traite_le: z.traite_le || '' }; }),
    calendrier: cal, textes: textes, paroisse: reglages_().paroisse
  };
}

// ─── Administration (appli) ───

function espaceDuDossier_(id) {
  feuillesEspace_();
  return lignes_('Espaces').filter(function (y) { return y.dossier_id === id; })[0];
}
function etatEspace_(p) {
  var d = trouverDossier_(p.id);
  var x = espaceDuDossier_(d.id);
  var don0 = json2_(d.donnees, {}), l = don0.lettre || {};
  return { signalements: (don0.signalements || []).slice().reverse(), existe: !!x, lien: x ? urlEspace_(x.jeton) : '', mot_de_passe: x ? x.mdp_maj : '', derniere_visite: x ? x.derniere_visite : '', mail: mailDossier_(d),
           lettre: { texte: l.texte || '', statut: l.statut || '', remarque: l.remarque || '', envoyee_le: l.envoyee_le || '', validee_le: l.validee_le || '' } };
}
function lienEspace_(p, s) {
  var d = trouverDossier_(p.id);
  if (d.type !== 'catechumene') throw erreur_('INVALIDE', 'Réservé aux catéchumènes et néophytes.');
  verrou_(function () {
    var x = espaceDuDossier_(d.id);
    if (!x) { ecrireLigne_('Espaces', { dossier_id: d.id, jeton: jeton_(), hash: '', sel: '', mdp_maj: '', cree_le: maintenant_(), derniere_visite: '' }); return; }
    if (p.nouveau) { x.jeton = jeton_(); ecrireLigne_('Espaces', x); }
  });
  if (p.nouveau) journaliser_(s, 'Espace personnel : nouveau lien', d.nom);
  return etatEspace_(p);
}
/** Erreur signalée par la personne : marquer comme corrigée (avec une réponse qu'elle verra) ou la rouvrir. */
function signalementEspace_(p, s) {
  verrou_(function () {
    var d = trouverDossier_(p.id), don = json2_(d.donnees, {});
    var z = (don.signalements || []).filter(function (y) { return y.id === p.signalement; })[0];
    if (!z) throw erreur_('INTROUVABLE', 'Signalement introuvable.');
    if (p.rouvrir) { z.statut = 'ouvert'; z.traite_le = ''; z.traite_par = ''; }
    else {
      z.statut = 'traite'; z.traite_le = maintenant_(); z.traite_par = s.nom;
      z.reponse = String(p.reponse || '').trim().slice(0, 2000);
      ajouterHistorique_(d, s.nom, 'Erreur signalée traitée (' + z.sujet + ')' + (z.reponse ? ' : ' + z.reponse.slice(0, 200) : ''));
      var aPrevenir = true;
    }
    d.donnees = JSON.stringify(don); d.maj_le = maintenant_(); d.maj_par = s.nom;
    ecrireLigne_('Dossiers', d);
    if (aPrevenir) try { envoyerPush_('esp:' + d.id); } catch (e) {}   // « Du nouveau dans votre espace » sur son téléphone
  });
  return etatEspace_(p);
}
/** Lettre à l'évêque : demander une correction, ou valider (PDF rangé dans le dossier, étape et document cochés). */
function lettreEspace_(p, s) {
  verrou_(function () {
    var d = trouverDossier_(p.id), don = json2_(d.donnees, {});
    var l = don.lettre || {};
    if (!l.texte) throw erreur_('VIDE', 'Pas encore de lettre.');
    if (p.corriger) {
      l.statut = 'a_corriger'; l.remarque = String(p.remarque || '').slice(0, 2000);
      ajouterHistorique_(d, s.nom, 'Lettre à l\'évêque : correction demandée');
    } else if (p.valider) {
      var i = don.infos || {};
      var html = '<html><body style="font-family:Georgia,serif;font-size:12pt;line-height:1.55;margin:28mm 24mm">' +
        '<p style="text-align:right">' + echapper_((reglages_().commune || 'Strasbourg') + ', le ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy')) + '</p>' +
        '<p>' + echapper_([i.prenoms, String(i.nom || '').toUpperCase()].join(' ')) + '<br>' + echapper_(i.adresse || '') + '</p>' +
        '<div style="margin-top:14mm;white-space:pre-wrap">' + echapper_(l.texte) + '</div></body></html>';
      var pdf = Utilities.newBlob(html, 'text/html', 'lettre.html').getAs('application/pdf').setName(nomFichierDossier_(d, 'Lettre à l\'évêque', 'pdf'));
      var f = dossierDriveDe_(d).createFile(pdf);
      l.statut = 'validee'; l.validee_le = maintenant_(); l.remarque = '';
      don.lettre = l;
      don.etapes = don.etapes || {};
      if (!(don.etapes.lettre && don.etapes.lettre.fait)) don.etapes.lettre = { fait: true, date: maintenant_(), par: s.nom, libelle: 'Lettre à l\'évêque' };
      d.donnees = JSON.stringify(don);
      enregistrerPiece_(d, f, 'Lettre à l\'évêque', 'lettre_eveque', s, true);
      return;
    }
    don.lettre = l; d.donnees = JSON.stringify(don); d.maj_le = maintenant_(); d.maj_par = s.nom;
    ecrireLigne_('Dossiers', d);
  });
  return etatEspace_(p);
}

// Textes
function promotionsEspace_() {
  var cat = {}, neo = {}, attente = false;
  lignes_('Dossiers').filter(function (d) { return d.type === 'catechumene' && d.etat !== 'annule'; }).forEach(function (d) {
    var pr = profilEspace_(d);
    if (pr.neo) { if (pr.annee) neo[pr.annee] = true; }
    else if (pr.annee) cat[pr.annee] = true; else attente = true;
  });
  var l = [{ cle: 'tous', nom: libelleCible_('tous') }];
  Object.keys(cat).sort().forEach(function (a) { l.push({ cle: 'cat:' + a, nom: libelleCible_('cat:' + a) }); });
  if (attente) l.push({ cle: 'cat:attente', nom: libelleCible_('cat:attente') });
  Object.keys(neo).sort().reverse().forEach(function (a) { l.push({ cle: 'neo:' + a, nom: libelleCible_('neo:' + a) }); });
  l.push({ cle: 'neo:tous', nom: libelleCible_('neo:tous') });
  return l;
}
function destinatairesCible_(cible) {
  return lignes_('Dossiers').filter(function (d) { return d.type === 'catechumene' && d.etat !== 'annule' && cibleConcerne_(cible, profilEspace_(d)); });
}
function listerTextes_() {
  feuillesEspace_();
  var espaces = {};
  lignes_('Espaces').forEach(function (x) { espaces[x.dossier_id] = x; });
  return {
    promotions: promotionsEspace_(),
    personnes: lignes_('Dossiers').filter(function (d) { return d.type === 'catechumene' && d.etat !== 'annule'; })
      .map(function (d) { return { id: d.id, nom: d.nom, espace: !!(espaces[d.id] && espaces[d.id].hash) }; }).sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); }),
    textes: lignes_('Textes').sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); }).map(function (t) {
      var dest = destinatairesCible_(t.cible);
      var lus = json2_(t.lus, {});
      return { id: t.id, cree_le: t.cree_le, auteur: t.auteur, titre: t.titre, corps: t.corps, cible: t.cible, cible_nom: libelleCible_(t.cible),
               fichiers: json2_(t.fichiers, []), liens: json2_(t.liens, []), nb_dest: dest.length, nb_lus: dest.filter(function (d) { return lus[d.id]; }).length,
               lus: dest.map(function (d) { return { nom: d.nom, lu: lus[d.id] || '' }; }) };
    }),
    calendrier: lignesCal_().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })
      .map(function (e) { var o = {}; COLONNES_CALENDRIER.forEach(function (k) { o[k] = e[k]; }); o.cible_nom = libelleCible_(e.cible); return o; })
  };
}
function ecrireTexte_(p, s) {
  feuillesEspace_();
  var v = p.texte || {};
  if (!String(v.titre || '').trim()) throw erreur_('INVALIDE', 'Titre manquant.');
  if (!v.cible) throw erreur_('INVALIDE', 'Choisissez à qui s\'adresse le texte.');
  var nouveau = !v.id;
  var t = verrou_(function () {
    var x = v.id ? lignes_('Textes').filter(function (y) { return y.id === v.id; })[0] : { id: uid_(), cree_le: maintenant_(), auteur: s.nom, lus: '{}', fichiers: '[]' };
    if (!x) throw erreur_('INTROUVABLE', 'Texte introuvable.');
    x.titre = String(v.titre).trim().slice(0, 200); x.corps = String(v.corps || '').slice(0, 30000); x.cible = String(v.cible);
    x.liens = JSON.stringify((v.liens || []).filter(function (l) { return /^https?:\/\//.test(l.url || ''); }).map(function (l) { return { url: l.url, libelle: String(l.libelle || '').slice(0, 120) }; }));
    var fichiers = json2_(x.fichiers, []).filter(function (f) { return (v.garder || []).indexOf(f.id) > -1 || !v.id; });
    (v.nouveaux || []).forEach(function (f) {
      var dossier = sousDossier_(racine_(), 'Textes catéchuménat');
      var fi = dossier.createFile(Utilities.newBlob(Utilities.base64Decode(f.base64), f.type || 'application/octet-stream', f.nom));
      fichiers.push({ id: fi.getId(), nom: f.nom, type: f.type || '' });
    });
    x.fichiers = JSON.stringify(fichiers);
    x.maj_le = maintenant_();
    ecrireLigne_('Textes', x);
    return x;
  });
  if (nouveau) {
    journaliser_(s, 'Texte publié', t.titre + ' → ' + libelleCible_(t.cible));
    destinatairesCible_(t.cible).forEach(function (d) { try { envoyerPush_('esp:' + d.id); } catch (e) {} });
  }
  return listerTextes_();
}
function supprimerTexte_(p, s) {
  verrou_(function () {
    var t = lignes_('Textes').filter(function (y) { return y.id === p.id; })[0];
    if (!t) return;
    json2_(t.fichiers, []).forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} });
    db_().getSheetByName('Textes').deleteRow(t._ligne);
  });
  return listerTextes_();
}
function ecrireCalendrier_(p, s) {
  feuillesEspace_();
  verrou_(function () {
    if (p.supprimer) {
      var y = lignesCal_().filter(function (z) { return z.id === p.supprimer; })[0];
      if (y) db_().getSheetByName('CalendrierCate').deleteRow(y._ligne);
      return;
    }
    var e = p.evenement || {};
    if (!e.date || !String(e.titre || '').trim() || !e.cible) throw erreur_('INVALIDE', 'Date, titre et destinataires obligatoires.');
    var x = e.id ? lignesCal_().filter(function (z) { return z.id === e.id; })[0] : { id: uid_() };
    COLONNES_CALENDRIER.forEach(function (k) { if (k !== 'id' && e[k] !== undefined) x[k] = String(e[k]).slice(0, 500); });
    db_().getSheetByName('CalendrierCate').getRange('A:Z').setNumberFormat('@');
    ecrireLigne_('CalendrierCate', x);
  });
  return listerTextes_();
}
