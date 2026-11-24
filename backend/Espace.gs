/**
 * Espace personnel des catéchumènes et néophytes — app « La Croix glorieuse » (app.croix-glorieuse.org).
 * Sans compte dans l'appli : lien personnel + mot de passe choisi par la personne (code reçu par mail),
 * session de 90 jours. La personne complète son dossier (identité, parents, parrain/marraine), dépose
 * ses pièces, rédige sa lettre à l'évêque ; elle voit son parcours, le calendrier de sa promotion et
 * les textes publiés pour elle. Notification sur le téléphone à chaque nouveau texte.
 */

var COLONNES_ESPACES = ['dossier_id', 'jeton', 'hash', 'sel', 'mdp_maj', 'cree_le', 'derniere_visite', 'prefs', 'favoris'];
var COLONNES_TEXTES = ['id', 'cree_le', 'auteur', 'titre', 'corps', 'cible', 'fichiers', 'liens', 'lus', 'maj_le'];
var COLONNES_CALENDRIER = ['id', 'date', 'heure_debut', 'heure_fin', 'titre', 'lieu', 'cible', 'note', 'parrains'];
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
function feuillesEspace_() { completerColonnes_(feuilleEsp_('Espaces', COLONNES_ESPACES), COLONNES_ESPACES); feuilleEsp_('Textes', COLONNES_TEXTES); completerColonnes_(feuilleEsp_('CalendrierCate', COLONNES_CALENDRIER), COLONNES_CALENDRIER); }
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
    var code = codeSur_();
    CacheService.getScriptCache().put('espcode_' + esp.dossier_id, JSON.stringify({ code: code, essais: 0 }), 900);
    var t = 'Bonjour ' + (i0.prenoms || '') + ',\n\nVoici votre code pour choisir le mot de passe de votre espace personnel « La Croix glorieuse » :\n\n' + code +
      '\n\nIl est valable 15 minutes. Si vous n\'avez rien demandé, ignorez ce message.\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
    var opts = optionsEnvoi_();
    GmailApp.sendEmail(mail, 'La Croix glorieuse – votre code : ' + code, corpsTexte_(t, 'paroisse'), { name: opts.name, from: opts.from, htmlBody: corpsHtml_(t, 'paroisse') });
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
    verifierMdpCompte_(p.mdp);
    var nv = verrou_(function () {
      var x = lignes_('Espaces').filter(function (y) { return y.dossier_id === esp.dossier_id; })[0];
      x.sel = jeton_().slice(0, 16); x.hash = hacher_(String(p.mdp), x.sel); x.mdp_maj = maintenant_();
      ecrireLigne_('Espaces', x);
      try {   // même mot de passe pour le compte de l'app (connexion par adresse mail)
        var cp = compteParDossier_(x.dossier_id);
        if (cp && cp.statut !== 'suspendu') { cp.hash = x.hash; cp.sel = x.sel; cp.mdp_maj = x.mdp_maj; if (cp.statut === 'invite' && normMail_(cp.mail)) { cp.statut = 'actif'; cp.statut_le = maintenant_(); } ecrireLigne_('Comptes', cp); }
      } catch (e) { console.error('synchro compte', e); }
      return x;
    });
    cache.remove('espcode_' + esp.dossier_id);
    return { session: nouvelleSessionEsp_(nv) };
  }
  if (!sessionEspValide_(esp, p.session)) throw erreur_('SESSION', 'Connectez-vous avec votre mot de passe.');

  if (action === 'esp.lire') {
    // dernière visite écrite une fois par jour au plus (pas de verrou général à chaque ouverture)
    if (String(esp.derniere_visite || '').slice(0, 10) !== aujourdhui_()) verrou_(function () { var x = lignes_('Espaces').filter(function (y) { return y.dossier_id === esp.dossier_id; })[0]; x.derniere_visite = maintenant_(); ecrireLigne_('Espaces', x); });
    try { var cpv = compteParDossier_(esp.dossier_id); if (cpv) noterVisiteCompte_(cpv); } catch (e) {}
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
      enregistrerPiece_(x, f, PIECES_ESPACE[p.doc], p.doc, { nom: 'Espace personnel' }, false, p.mini);
      prevenirEspace_(x, 'Espace personnel : pièce déposée (' + PIECES_ESPACE[p.doc] + ')');
    });
    return vueEspace_(trouverDossier_(d.id));
  }
  if (action === 'esp.lettre') throw erreur_('ANCIEN', 'La lettre ne s\'écrit plus dans l\'app : déposez-la (photo ou PDF) ou indiquez que vous l\'avez déposée au presbytère.');
  if (action === 'esp.lettreDepot') {
    var pages = (p.pages || []).slice(0, 12);
    if (!p.pdf && !pages.length) throw erreur_('VIDE', 'Choisissez le PDF ou les photos de votre lettre.');
    var poids = String(p.pdf || '').length + pages.reduce(function (a, x) { return a + String(x || '').length; }, 0);
    if (poids > 14000000) throw erreur_('TROP_GROS', 'Fichiers trop lourds (10 Mo au plus en tout).');
    verrou_(function () {
      var x = trouverDossier_(d.id), don = json2_(x.donnees, {});
      var l = don.lettre || {};
      if (l.statut === 'validee') throw erreur_('VALIDEE', 'Votre lettre a déjà été reçue et validée.');
      var nom = nomFichierDossier_(x, 'Lettre à l\'évêque (déposée)', 'pdf'), blob;
      if (p.pdf) blob = Utilities.newBlob(Utilities.base64Decode(p.pdf), 'application/pdf', nom);
      else {
        var html = '<html><head><style>@page{margin:0}body{margin:0}img{display:block;width:100%;page-break-after:always}</style></head><body>' +
          pages.map(function (b) { return '<img src="data:image/jpeg;base64,' + String(b).replace(/[^A-Za-z0-9+/=]/g, '') + '">'; }).join('') + '</body></html>';
        blob = Utilities.newBlob(html, 'text/html', 'lettre.html').getAs('application/pdf').setName(nom);
      }
      var f = dossierDriveDe_(x).createFile(blob);
      l.statut = 'deposee'; l.mode = 'app'; l.deposee_le = maintenant_(); l.fichier = f.getId(); l.remarque = '';
      don.lettre = l; x.donnees = JSON.stringify(don);
      enregistrerPiece_(x, f, 'Lettre à l\'évêque (déposée, à relire)', '', { nom: 'Espace personnel' }, false);
      prevenirEspace_(x, 'Lettre à l\'évêque déposée : à relire');
    });
    return vueEspace_(trouverDossier_(d.id));
  }
  if (action === 'esp.lettrePresbytere') {
    verrou_(function () {
      var x = trouverDossier_(d.id), don = json2_(x.donnees, {});
      var l = don.lettre || {};
      if (l.statut === 'validee') throw erreur_('VALIDEE', 'Votre lettre a déjà été reçue et validée.');
      l.statut = 'annoncee'; l.mode = 'presbytere'; l.annoncee_le = maintenant_(); l.remarque = '';
      don.lettre = l; x.donnees = JSON.stringify(don);
      ajouterHistorique_(x, 'Espace personnel', 'Lettre à l\'évêque déposée au presbytère (à confirmer)');
      x.maj_le = maintenant_(); x.maj_par = 'Espace personnel';
      ecrireLigne_('Dossiers', x);
      prevenirEspace_(x, 'Lettre à l\'évêque déposée au presbytère : réception à confirmer');
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
  if (action === 'esp.parrain') {
    if (profilEspace_(d).neo) throw erreur_('FINI', 'Le baptême a déjà été célébré.');
    verrou_(function () { ecrireParrain_(trouverDossier_(d.id), p.parrain, 'Espace personnel'); });
    return vueEspace_(trouverDossier_(d.id));
  }
  if (action === 'esp.parrainEnvoyer') {
    verrou_(function () { envoyerLienParrain_(trouverDossier_(d.id), p.parrain_id, 'Espace personnel'); });
    return vueEspace_(trouverDossier_(d.id));
  }
  if (action === 'esp.corDemande') {
    demandeCorEspace_(d, p.preferences);
    return vueEspace_(trouverDossier_(d.id));
  }
  if (action === 'esp.acte') {
    if (!profilEspace_(d).neo) throw erreur_('INVALIDE', 'L\'acte de baptême se demande après le baptême.');
    demanderActe_(d, p.motif);
    return vueEspace_(trouverDossier_(d.id));
  }
  if (action === 'esp.favoris') {
    // versets de la Bible gardés (« ★ Garder ») : la liste la plus récente l'emporte
    var liste = (p.favoris || []).slice(-200).map(function (f) {
      return { cle: String(f.cle || '').slice(0, 80), livre: String(f.livre || '').slice(0, 40), chap: Number(f.chap) || 0, v: Number(f.v) || 0, texte: String(f.texte || '').slice(0, 180) };
    }).filter(function (f) { return f.cle && f.livre; });
    var maj = /^\d{4}-\d\d-\d\dT/.test(String(p.maj || '')) ? String(p.maj) : maintenant_();
    verrou_(function () {
      feuillesEspace_(); oublierLignes_();
      var x = lignes_('Espaces').filter(function (y) { return y.dossier_id === esp.dossier_id; })[0];
      if (!x) return;
      var avant = json2_(x.favoris, {});
      if (avant.maj && avant.maj > maj) return;   // une version plus récente est déjà là (autre appareil)
      x.favoris = JSON.stringify({ liste: liste, maj: maj }); ecrireLigne_('Espaces', x);
    });
    return favorisEspace_(esp.dossier_id);
  }
  if (action === 'esp.prefs') {
    verrou_(function () {
      var x = lignes_('Espaces').filter(function (y) { return y.dossier_id === esp.dossier_id; })[0];
      var pr = json2_(x.prefs, {});
      ['textes', 'reponses', 'anniversaire', 'annonces'].forEach(function (k) { if (p.notifs && typeof p.notifs[k] === 'boolean') pr[k] = p.notifs[k]; });
      if (p.notifs && p.notifs.prop_heure !== undefined) { var hh = Number(p.notifs.prop_heure); if (hh >= 5 && hh <= 22) pr.prop_heure = hh; }
      x.prefs = JSON.stringify(pr); ecrireLigne_('Espaces', x);
    });
    if (p.notifs && typeof p.notifs.lettre_mail === 'boolean') { var i1 = json2_(d.donnees, {}).infos || {}; changerAbonnementNewsletter_(mailDossier_(d), i1.prenoms, i1.nom, p.notifs.lettre_mail); }
    return vueEspace_(d);
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
  if (action === 'esp.lettres') return { lettres: lettresApp_(), lettre_mail: abonnementNewsletter_(mailDossier_(d)) };
  if (action === 'esp.lettre') return lettreApp_(p.id);
  if (action === 'esp.sacrement') return demanderSacrementApp_({ mail: mailDossier_(d), prenom: i0.prenoms, nom: i0.nom, telephone: i0.telephone, adresse: i0.adresse }, p);
  if (action === 'esp.dossiers') return { dossiers: mesDossiers_(mailDossier_(d)).filter(function (z) { return z.id !== d.id; }), actes: mesActes_(mailDossier_(d)), motifs: MOTIFS_ACTE };
  if (action === 'esp.acteApp') { demanderActeApp_({ mail: mailDossier_(d), prenom: i0.prenoms, nom: i0.nom }, p); return { actes: mesActes_(mailDossier_(d)) }; }
  if (/^esp\.prop\./.test(action)) return actionPropApp_({ uid: 'esp:' + d.id, heure: heureProps_(esp.prefs) }, action.slice(9), p);
  if (/^esp\.priere\./.test(action)) return actionPriere_(quiEspace_(d), action.slice(11), p);
  if (action === 'esp.inscriptions') return mesInscriptions_(mailDossier_(d));
  if (action === 'esp.afaire') return { afaire: aFaireEspace_(d) };
  if (action === 'esp.messes') return { messes: messesProposees_(), mes_intentions: mesIntentions_(mailDossier_(d)), offrande: offrandeTexte_(), max: INT_APP_MAX };
  if (action === 'esp.demanderMesse') {
    var rm = demanderMessesApp_({ mail: mailDossier_(d), nom: ((i0.prenoms || '') + ' ' + (i0.nom || '')).trim() || d.nom }, p);
    return { nombre: rm.nombre, mes_intentions: mesIntentions_(mailDossier_(d)), messes: messesProposees_() };
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
  var auj = aujourdhui_();
  var cal = lignesCal_().filter(function (e) { return cibleConcerne_(e.cible, pr) && e.date >= auj; })
    .map(function (e) { return { date: e.date, heure_debut: e.heure_debut, heure_fin: e.heure_fin, titre: e.titre, lieu: e.lieu, note: e.note }; });
  if (!pr.neo && pr.annee) {
    try {
      lignes_('Retraites').filter(function (r) { return r.type === 'confirmation_adultes' && anneeAdultes_(r.annee) === pr.annee && r.date_debut >= auj; }).forEach(function (r) {
        cal.push({ date: r.date_debut, date_fin: r.date_fin, heure_debut: r.heure_debut, heure_fin: r.heure_fin, titre: titreRetraite_(r), lieu: r.lieu, lien: r.jeton ? urlRetraite_({ r: r.jeton }) : '' });
      });
    } catch (e) { /* pas encore de retraites */ }
  }
  var frat = { etat: 'aucune' };
  try { frat = fraterniteEspace_(d); } catch (er) { console.error('fraterniteEspace_', er); }
  (frat.rencontres || []).forEach(function (r) { cal.push({ date: r.date, heure_debut: '', titre: 'Fraternité Cor Unum ' + frat.equipe, lieu: r.lieu, note: r.note }); });
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
    lettre: { texte: l.texte || '', statut: l.statut || '', remarque: l.remarque || '', validee_le: l.validee_le || '', mode: l.mode || '',
              deposee_le: l.deposee_le || '', annoncee_le: l.annoncee_le || '', consigne: consigneLettre_(), adresse: reglages_().adresse || '' },
    signalements: (don.signalements || []).slice(-30).reverse().map(function (z) { return { id: z.id, date: z.date, sujet: z.sujet, texte: z.texte, statut: z.statut, reponse: z.reponse || '', traite_le: z.traite_le || '' }; }),
    photo: photoMini_(d),
    notifs: prefsNotifsEspace_(d.id),
    favoris: favorisEspace_(d.id),
    bapteme: pr.neo ? { date: dateBapteme_(d), lieu: [i.lieu_celebration, i.commune_celebration].filter(Boolean).join(', '), prenom_bapteme: i.prenom_bapteme || '', actes: actesEspace_(d), motifs: MOTIFS_ACTE, mail: mailDossier_(d) ? masquerMail_(mailDossier_(d)) : '' } : null,
    anniversaire: (function () { var n = pr.neo ? anniversaireDuJour_(d) : 0; return n ? { annees: n, texte: texteAnniversaire_(d, n) } : null; })(),
    parrains: (don.parrains || []).map(function (z) { return parrainVue_(z, true); }), fraternite: frat,
    calendrier: cal, textes: textes, paroisse: reglages_().paroisse,
    annonces: annoncesPubliques_(),
    dons: causesPubliques_()
  };
}

// ─── Parrain / marraine : jusqu'à deux, chacun avec son lien (dépôt du certificat, dates importantes) ───

var ROLES_PARRAIN = { parrain: 'Parrain', marraine: 'Marraine' };
function urlParrain_(j) { return 'https://app.croix-glorieuse.org/parrain/?p=' + j; }
function parrainVue_(z, avecLien) {
  return { id: z.id, role: z.role, nom: z.nom, email: z.email, envoye_le: z.envoye_le || '', cert_le: (z.cert && z.cert.date) || '', lien: avecLien ? urlParrain_(z.jeton) : undefined };
}
/** Reporte la liste dans les champs « Parrain / marraine » du dossier. */
function syncParrains_(don) {
  var l = don.parrains || [];
  don.infos = don.infos || {};
  if (!l.length) return;
  don.infos.parrain_marraine = l.map(function (z) { return z.nom + ' (' + ROLES_PARRAIN[z.role].toLowerCase() + ')'; }).join(' et ');
  don.infos.parrain_contact = l.map(function (z) { return z.email; }).filter(String).join(', ');
}
/** Ajoute, modifie ou retire un parrain (x : ligne du dossier, modifiée en place). */
function ecrireParrain_(x, v, qui) {
  var don = json2_(x.donnees, {});
  var l = don.parrains = don.parrains || [];
  v = v || {};
  if (v.supprimer) {
    don.parrains = l.filter(function (z) { return z.id !== v.supprimer; });
    if (!don.parrains.length) { don.infos = don.infos || {}; don.infos.parrain_marraine = ''; don.infos.parrain_contact = ''; }
    else if (don.parrains.every(function (y) { return y.cert && y.cert.date; })) { don.documents = don.documents || {}; if (!(don.documents.cert_parrain || {}).recu) don.documents.cert_parrain = { recu: true, date: maintenant_() }; }
  } else {
    var role = ROLES_PARRAIN[v.role] ? v.role : '';
    var nom = String(v.nom || '').trim().replace(/\s+/g, ' ').slice(0, 80), email = String(v.email || '').trim().toLowerCase().slice(0, 120);
    if (!role) throw erreur_('INVALIDE', 'Parrain ou marraine ?');
    if (!nom) throw erreur_('INVALIDE', 'Prénom et nom obligatoires.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw erreur_('INVALIDE', 'Adresse e-mail invalide.');
    var z = v.id ? l.filter(function (y) { return y.id === v.id; })[0] : null;
    if (v.id && !z) throw erreur_('INTROUVABLE', 'Parrain introuvable.');
    if (!z) {
      if (l.length >= 2) throw erreur_('LIMITE', 'Deux personnes au plus : un parrain et/ou une marraine.');
      z = { id: uid_(), jeton: jeton_(), cree_le: maintenant_() }; l.push(z);
    }
    z.role = role; z.nom = nom; z.email = email;
  }
  syncParrains_(don);
  x.donnees = JSON.stringify(don);
  ajouterHistorique_(x, qui, v.supprimer ? 'Parrain / marraine retiré(e)' : 'Parrain / marraine : ' + String(v.nom || '').trim());
  x.maj_le = maintenant_(); x.maj_par = qui;
  ecrireLigne_('Dossiers', x);
}
/** Envoie au parrain son lien personnel. */
function envoyerLienParrain_(x, pid, qui) {
  var don = json2_(x.donnees, {}), i = don.infos || {};
  var z = (don.parrains || []).filter(function (y) { return y.id === pid; })[0];
  if (!z) throw erreur_('INTROUVABLE', 'Parrain introuvable.');
  if (!z.email) throw erreur_('INVALIDE', 'Indiquez d\'abord son adresse e-mail.');
  var r = z.role === 'marraine', filleul = [i.prenoms, i.nom].filter(Boolean).join(' ');
  var B = r ? 'Ma page de marraine' : 'Ma page de parrain';
  var t = 'Bonjour ' + z.nom + ',\n\n' + filleul + ' vous a choisi' + (r ? 'e comme marraine' : ' comme parrain') + ' pour ' + (i.sexe === 'Femme' ? 'sa' : 'son') + ' baptême à la paroisse La Croix glorieuse. Merci d\'accepter cette belle mission !\n\n' +
    'Pour le dossier, nous avons besoin de votre certificat de baptême et de confirmation : demandez-le à la paroisse où vous avez été baptisé' + (r ? 'e' : '') + ', puis déposez-le sur votre page (photo ou PDF). Vous y trouverez aussi les dates importantes de la préparation.\n[Bouton : ' + B + ']\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
  var bs = [{ texte: B, url: urlParrain_(z.jeton) }], o = optionsEnvoi_();
  GmailApp.sendEmail(z.email, (r ? 'Marraine' : 'Parrain') + ' de ' + filleul + ' – paroisse La Croix glorieuse', corpsTexte_(t, 'paroisse', bs), { name: o.name, from: o.from, htmlBody: corpsHtml_(t, 'paroisse', bs) });
  z.envoye_le = maintenant_();
  x.donnees = JSON.stringify(don);
  ajouterHistorique_(x, qui, 'Lien envoyé ' + (r ? 'à la marraine' : 'au parrain') + ' (' + z.email + ')');
  ecrireLigne_('Dossiers', x);
}
function parrainEcrireRoute_(p, s) { verrou_(function () { ecrireParrain_(trouverDossier_(p.id), p.parrain, s.nom); }); return etatEspace_(p); }
function parrainEnvoyerRoute_(p, s) { verrou_(function () { envoyerLienParrain_(trouverDossier_(p.id), p.parrain_id, s.nom); }); return etatEspace_(p); }

/** Dossier + parrain correspondant au lien. */
function parrainParJeton_(j) {
  if (!/^[a-f0-9]{32}$/.test(String(j || ''))) throw erreur_('LIEN', 'Ce lien n\'est pas valable.');
  var ds = lignes_('Dossiers').filter(function (d) { return d.type === 'catechumene' && String(d.donnees).indexOf(j) > -1; });
  for (var k = 0; k < ds.length; k++) {
    var z = (json2_(ds[k].donnees, {}).parrains || []).filter(function (y) { return y.jeton === j; })[0];
    if (z) return { d: ds[k], z: z };
  }
  throw erreur_('LIEN', 'Ce lien n\'est plus valable. Demandez-en un nouveau à votre filleul(e) ou à la paroisse.');
}
function vueParrain_(ctx) {
  var d = ctx.d, z = ctx.z, i = json2_(d.donnees, {}).infos || {}, pr = profilEspace_(d), auj = aujourdhui_();
  var dates = lignesCal_().filter(function (e) { return e.parrains === 'oui' && cibleConcerne_(e.cible, pr) && e.date >= auj; })
    .sort(function (a, b) { return String(a.date + a.heure_debut).localeCompare(String(b.date + b.heure_debut)); })
    .map(function (e) { return { date: e.date, heure_debut: e.heure_debut, heure_fin: e.heure_fin, titre: e.titre, lieu: e.lieu, note: e.note }; });
  return { role: z.role, nom: z.nom, filleul: i.prenoms || '', filleul_nom: i.nom || '', annee: pr.annee, baptise: pr.neo, cert_le: (z.cert && z.cert.date) || '', dates: dates, paroisse: reglages_().paroisse };
}
/** Page publique du parrain (doPost, sans session). */
function actionParrain_(action, p) {
  var cache = CacheService.getScriptCache(), cle = 'par_' + String(p.p || '').slice(0, 32);
  var n = Number(cache.get(cle) || 0);
  if (n > 60) throw erreur_('LIMITE', 'Trop d\'actions en peu de temps. Réessayez dans une heure.');
  cache.put(cle, String(n + 1), 3600);
  feuillesEspace_();
  var ctx = parrainParJeton_(p.p);
  if (action === 'par.lire') return vueParrain_(ctx);
  if (action !== 'par.certificat') throw erreur_('ACTION', 'Action inconnue.');
  if (profilEspace_(ctx.d).neo) throw erreur_('FINI', 'Le baptême a déjà été célébré : plus rien à déposer. Merci !');
  if (!/^(application\/pdf|image\/(jpeg|png|heic|heif|webp))$/.test(String(p.type || ''))) throw erreur_('INVALIDE', 'Envoyez une photo ou un PDF.');
  if (String(p.base64 || '').length > 14000000) throw erreur_('TROP_GROS', 'Fichier trop lourd (10 Mo au plus).');
  var qui = '';
  verrou_(function () {
    var x = trouverDossier_(ctx.d.id), don = json2_(x.donnees, {});
    var z = (don.parrains || []).filter(function (y) { return y.id === ctx.z.id; })[0];
    if (!z) throw erreur_('LIEN', 'Ce lien n\'est plus valable.');
    qui = ROLES_PARRAIN[z.role] + ' ' + z.nom;
    var ext = (String(p.nom || '').match(/\.([a-z0-9]{1,5})$/i) || [])[1] || (p.type === 'application/pdf' ? 'pdf' : 'jpg');
    var libelle = 'Certificat de baptême et de confirmation – ' + qui;
    var f = dossierDriveDe_(x).createFile(Utilities.newBlob(Utilities.base64Decode(p.base64), p.type, nomFichierDossier_(x, libelle, ext)));
    z.cert = { date: maintenant_(), fichier: f.getId() };
    x.donnees = JSON.stringify(don);
    var tous = (don.parrains || []).every(function (y) { return y.cert && y.cert.date; });
    enregistrerPiece_(x, f, libelle, tous ? 'cert_parrain' : '', { nom: qui }, false);
    prevenirEspace_(x, 'Certificat déposé par ' + (z.role === 'marraine' ? 'la marraine' : 'le parrain'));
  });
  return vueParrain_(parrainParJeton_(p.p));
}

// ─── Fraternité Cor Unum de la personne ───

function fraterniteEspace_(d) {
  if (!db_().getSheetByName('CorUnum')) return { etat: 'aucune' };
  feuilleCor_();
  var r = corReglages_(), annee = anneeCorCourante_(r), toutes = lignes_('CorUnum');
  var liens = liensCor_(toutes.filter(function (x) { return x.annee === annee; }), dossiersLies_());
  var l = liens.parDossier[d.id] || [], x = l.length ? l[0].x : null;
  if (!x || x.statut === 'ancien') return { etat: 'aucune', annee: annee };
  var e = x.equipe_id ? equipesDe_(r, annee).filter(function (y) { return y.id === x.equipe_id; })[0] : null;
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
/** « Je veux rejoindre une fraternité » : fiche Cor Unum « à répartir », reliée au dossier ; la paroisse est notifiée. */
function demandeCorEspace_(d, preferences) {
  var f = fraterniteEspace_(d);
  if (f.etat === 'membre') throw erreur_('DEJA', 'Vous êtes déjà dans une fraternité.');
  if (f.etat === 'demande') return;
  var prefs = String(preferences || '').trim().slice(0, 500);
  verrou_(function () {
    feuilleCor_();
    var r = corReglages_(), annee = anneeCorCourante_(r), toutes = lignes_('CorUnum');
    var doss = dossiersLies_(), dd = doss.filter(function (z) { return z.id === d.id; })[0];
    var l = (liensCor_(toutes.filter(function (x) { return x.annee === annee; }), doss).parDossier[d.id] || []);
    var x = l.length ? l[0].x : null, i = dd.infos || {};
    var note = 'Demande depuis l\'espace personnel le ' + aujourdhui_();
    if (x) {
      x.statut = 'actif'; x.equipe_id = ''; x.equipe_proposee = '';
      if (prefs) x.souhait = [x.souhait, prefs].filter(String).join(' ; ');
      x.note = [x.note, note].filter(String).join(' ; ');
      var lies = json2_(x.dossiers_lies, []); if (lies.indexOf(d.id) === -1) x.dossiers_lies = JSON.stringify(lies.concat([d.id]));
      x.maj_le = maintenant_(); x.maj_par = 'Espace personnel';
      ecrireLigne_('CorUnum', x);
    } else {
      ecrireLigne_('CorUnum', {
        id: uid_(), annee: annee, cree_le: maintenant_(), sources: '["espace"]', nom: i.nom || dd.nom, prenoms: i.prenoms || '',
        email: i.email || dd.email || '', telephone: i.telephone || '', adresse: i.adresse || '', profils: JSON.stringify(profilsDossier_([{ d: dd }])),
        situation: '', deja_participe: 'Non', rester: '', chef_indique: '', chef_possible: '', souhait: prefs, groupe_service: '', equipe_id: '', equipe_proposee: '',
        statut: 'actif', note: note, maj_le: maintenant_(), maj_par: 'Espace personnel', dossiers_lies: JSON.stringify([d.id]), dossiers_exclus: '[]'
      });
    }
    prevenirEquipeParoisse_('Cor Unum : demande pour rejoindre une fraternité', d.nom + (prefs ? ' – ' + prefs.slice(0, 100) : ''), annee);
  });
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
  return { parrains: (don0.parrains || []).map(function (z) { return parrainVue_(z, true); }), signalements: (don0.signalements || []).slice().reverse(), existe: !!x, lien: x ? urlEspace_(x.jeton) : '', mot_de_passe: x ? x.mdp_maj : '', derniere_visite: x ? x.derniere_visite : '', mail: mailDossier_(d),
           lettre: { texte: l.texte || '', statut: l.statut || '', remarque: l.remarque || '', envoyee_le: l.envoyee_le || '', validee_le: l.validee_le || '',
                     mode: l.mode || '', deposee_le: l.deposee_le || '', annoncee_le: l.annoncee_le || '', fichier: l.fichier ? 'https://drive.google.com/file/d/' + l.fichier + '/view' : '' } };
}
function lienEspace_(p, s) {
  var d = trouverDossier_(p.id);
  if (d.type !== 'catechumene') throw erreur_('INVALIDE', 'Réservé aux catéchumènes et néophytes.');
  verrou_(function () {
    var x = espaceDuDossier_(d.id);
    if (!x) {
      // la personne a déjà un compte dans l'app (même adresse) : son espace s'y rattache, avec son mot de passe
      var cp = null; try { var m0 = normMail_(mailDossier_(d)); cp = m0 ? compteParMail_(m0) : null; } catch (e) {}
      if (cp && !cp.dossier_id) { cp.dossier_id = d.id; ecrireLigne_('Comptes', cp); }
      ecrireLigne_('Espaces', { dossier_id: d.id, jeton: jeton_(), hash: cp && cp.statut === 'actif' ? cp.hash : '', sel: cp && cp.statut === 'actif' ? cp.sel : '', mdp_maj: '', cree_le: maintenant_(), derniere_visite: '' });
      return;
    }
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
    if (aPrevenir) pushEspace_(d.id, 'reponses');   // « Du nouveau dans votre espace » sur son téléphone
  });
  return etatEspace_(p);
}
/** Lettre à l'évêque : demander une correction, ou valider (PDF rangé dans le dossier, étape et document cochés). */
function lettreEspace_(p, s) {
  verrou_(function () {
    var d = trouverDossier_(p.id), don = json2_(d.donnees, {});
    var l = don.lettre || {};
    if (!l.texte && !l.statut) throw erreur_('VIDE', 'Pas encore de lettre.');
    var marquerRecue = function (texteHisto) {
      l.statut = 'validee'; l.validee_le = maintenant_(); l.remarque = '';
      don.etapes = don.etapes || {}; don.documents = don.documents || {};
      if (!(don.etapes.lettre && don.etapes.lettre.fait)) don.etapes.lettre = { fait: true, date: maintenant_(), par: s.nom, libelle: 'Lettre à l\'évêque' };
      don.documents.lettre_eveque = { recu: true, date: maintenant_() };
      ajouterHistorique_(d, s.nom, texteHisto);
    };
    if (p.recue || (p.valider && (l.statut === 'deposee' || l.statut === 'annoncee'))) {
      don.lettre = l; d.donnees = JSON.stringify(don);
      if (p.fichier && p.fichier.base64) {   // scan facultatif de la lettre reçue au presbytère
        var ext = p.fichier.type === 'application/pdf' ? 'pdf' : 'jpg';
        var fs = dossierDriveDe_(d).createFile(Utilities.newBlob(Utilities.base64Decode(p.fichier.base64), p.fichier.type || 'application/pdf', nomFichierDossier_(d, 'Lettre à l\'évêque', ext)));
        l.fichier = fs.getId();
        enregistrerPiece_(d, fs, 'Lettre à l\'évêque (reçue au presbytère)', '', s, false);
        don = json2_(d.donnees, {}); don.lettre = l;
      }
      marquerRecue(l.mode === 'presbytere' ? 'Lettre à l\'évêque reçue au presbytère' : 'Lettre à l\'évêque relue et validée');
      don.lettre = l; d.donnees = JSON.stringify(don); d.maj_le = maintenant_(); d.maj_par = s.nom;
      ecrireLigne_('Dossiers', d);
      pushEspace_(d.id, 'reponses');
      return;
    }
    if (p.corriger) {
      l.statut = 'a_corriger'; l.remarque = String(p.remarque || '').slice(0, 2000);
      ajouterHistorique_(d, s.nom, 'Lettre à l\'évêque : correction demandée');
      var prevenirCorr = true;
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
    if (prevenirCorr) pushEspace_(d.id, 'reponses');
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
    envoyerPushMasse_(destinatairesCible_(t.cible).filter(function (d) { return prefsNotifsEspace_(d.id).textes !== false; }).map(function (d) { return 'esp:' + d.id; }));
  }
  return listerTextes_();
}
function supprimerTexte_(p, s) {
  verrou_(function () {
    var t = lignes_('Textes').filter(function (y) { return y.id === p.id; })[0];
    if (!t) return;
    json2_(t.fichiers, []).forEach(function (f) { try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {} });
    db_().getSheetByName('Textes').deleteRow(t._ligne); oublierLignes_();
  });
  return listerTextes_();
}
function ecrireCalendrier_(p, s) {
  feuillesEspace_();
  verrou_(function () {
    if (p.supprimer) {
      var y = lignesCal_().filter(function (z) { return z.id === p.supprimer; })[0];
      if (y) db_().getSheetByName('CalendrierCate').deleteRow(y._ligne); oublierLignes_();
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

// ─── Néophytes : « Mon baptême » et demande d'acte de baptême ───

var MOTIFS_ACTE = ['Mariage', 'Parrainage', 'Confirmation', 'Profession religieuse ou ordination', 'Autre'];
function dateLongueFr_(iso) {
  if (!iso) return '';
  var d = new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso);
  return isNaN(d) ? String(iso) : Utilities.formatDate(d, 'Europe/Paris', 'd MMMM yyyy').replace(/January|February|March|April|May|June|July|August|September|October|November|December/, function (m) {
    return { January: 'janvier', February: 'février', March: 'mars', April: 'avril', May: 'mai', June: 'juin', July: 'juillet', August: 'août', September: 'septembre', October: 'octobre', November: 'novembre', December: 'décembre' }[m];
  });
}
/** Extrait B14 pré-rempli depuis le dossier d'un catéchumène (mêmes règles que l'appli). */
function valeursB14Catechumene_(d) {
  var don = json2_(d.donnees, {}), i = don.infos || {}, r = reglages_();
  var p = String(i.prenoms || '').trim(), b = String(i.prenom_bapteme || '').trim();
  var sansAcc = function (t) { return sansAccents_(t); };
  var prenoms = !b || sansAcc(p).split(/[\s,-]+/).indexOf(sansAcc(b)) > -1 ? p : [p, b].filter(String).join(' ');
  return {
    paroisse: r.paroisse, diocese: r.diocese, annee: i.registre_annee || '', acte: i.acte_numero || '', sexe: i.sexe || '',
    prenoms: prenoms, nom: String(i.nom || '').toUpperCase(), ne_le: dateLongueFr_(i.naissance_date), ne_a: i.naissance_lieu || '',
    baptise_le: '', eglise: i.lieu_celebration || r.eglise, de: i.commune_celebration || r.commune, diocese_de: i.diocese_celebration || r.diocese,
    confirme_le: '', confirme_a: [i.lieu_celebration, i.commune_celebration].filter(Boolean).join(', '),
    marie_le: dateLongueFr_(i.marie_religieusement_le), marie_a: i.marie_religieusement_a || '', fait_a: r.commune, fait_le: dateLongueFr_(maintenant_())
  };
}
function demanderActe_(d, motif) {
  if (MOTIFS_ACTE.indexOf(motif) === -1) throw erreur_('INVALIDE', 'Choisissez le motif de la demande.');
  if (!mailDossier_(d)) throw erreur_('MAIL', 'Aucune adresse e-mail dans votre dossier : écrivez au secrétariat.');
  feuilleExtraits_();
  var enCours = lignes_('Extraits').filter(function (x) { return x.dossier_id === d.id && json2_(x.demande, null) && !json2_(x.envois, []).length; });
  if (enCours.length) throw erreur_('DEJA', 'Une demande est déjà en cours : la paroisse va vous envoyer votre acte.');
  var id = verrou_(function () {
    var v = valeursB14Catechumene_(d);
    var e = { id: uid_(), cree_le: maintenant_(), cree_par: 'Espace personnel', dossier_id: d.id, nom: [v.prenoms, v.nom].filter(String).join(' '), valeurs: JSON.stringify(v),
              statut: 'brouillon', envois: '[]', maj_le: maintenant_(), maj_par: 'Espace personnel', demande: JSON.stringify({ motif: motif, le: maintenant_(), email: mailDossier_(d) }) };
    ecrireLigne_('Extraits', e);
    var x = trouverDossier_(d.id);
    ajouterHistorique_(x, 'Espace personnel', 'Demande d\'acte de baptême (' + motif + ')');
    ecrireLigne_('Dossiers', x);
    return e.id;
  });
  lignes_('Utilisateurs').filter(estActif_).forEach(function (u) { notifier_(u.id, 'Demande d\'acte de baptême', d.nom + ' – ' + motif, '#/extraits/' + id); });
}
function actesEspace_(d) {
  try {
    if (!db_().getSheetByName('Extraits')) return [];
    return lignes_('Extraits').filter(function (x) { return x.dossier_id === d.id && json2_(x.demande, null); })
      .sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); })
      .map(function (x) { var dm = json2_(x.demande, {}), env = json2_(x.envois, []); return { motif: dm.motif, le: dm.le, envoye_le: env.length ? env[env.length - 1].date : '' }; });
  } catch (e) { return []; }
}

// ─── Anniversaire de baptême des néophytes (chaque jour, 8 h) ───

var ANNIV_DEFAUT = 'Bonjour {prenom},\n\nIl y a {annees}, lors de la Vigile pascale, vous receviez le baptême, la confirmation et l\'eucharistie à la paroisse La Croix glorieuse. Toute la paroisse rend grâce avec vous pour ce jour où vous êtes devenu(e) enfant de Dieu !\n\nPourquoi ne pas renouveler aujourd\'hui les promesses de votre baptême, et allumer votre cierge de baptême ?\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
var CONSIGNE_LETTRE_DEFAUT = 'Écrivez à la main votre lettre à Mgr Pascal Delannoy, archevêque de Strasbourg, pour lui demander le baptême : qui vous êtes, votre chemin vers le Christ, ce que vous attendez de l\'Église. Commencez par « Monseigneur, » et n\'oubliez pas de la signer.\n\nEnsuite, déposez-la ici (une photo nette de chaque page, ou un PDF), ou bien au presbytère : {adresse}.';
function consigneLettre_() {
  var r = json2_(props_().getProperty('CATECHUMENAT'), {});
  return String(r.consigne_lettre || CONSIGNE_LETTRE_DEFAUT).replace(/\{adresse\}/g, reglages_().adresse || '');
}
/** Lettres à l'évêque à traiter : déposées dans l'app (à relire) ou annoncées au presbytère (à confirmer). */
function lettresATraiter_() {
  return lignes_('Dossiers').filter(function (d) { return d.type === 'catechumene' && d.etat !== 'annule'; }).map(function (d) {
    var l = json2_(d.donnees, {}).lettre || {};
    return { id: d.id, nom: d.nom, statut: l.statut || '', date: l.deposee_le || l.annoncee_le || l.envoyee_le || '' };
  }).filter(function (x) { return x.statut === 'deposee' || x.statut === 'annoncee' || x.statut === 'envoyee'; });
}
function reglagesCatechumenat_() {
  var r = json2_(props_().getProperty('CATECHUMENAT'), {});
  return { anniv_actif: r.anniv_actif === true, anniv_texte: r.anniv_texte || ANNIV_DEFAUT };
}
/** Date (AAAA-MM-JJ) du baptême, d'après l'étape « Baptême, confirmation, eucharistie ». */
function dateBapteme_(d) {
  var et = (json2_(d.donnees, {}).etapes || {}).sacrements;
  return et && et.fait && et.date ? Utilities.formatDate(new Date(et.date), 'Europe/Paris', 'yyyy-MM-dd') : '';
}
function anniversaireDuJour_(d, auj) {
  var b = dateBapteme_(d); auj = auj || Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
  if (!b || b.slice(5) !== auj.slice(5) || b.slice(0, 4) >= auj.slice(0, 4)) return 0;
  return Number(auj.slice(0, 4)) - Number(b.slice(0, 4));
}
function texteAnniversaire_(d, n) {
  var i = json2_(d.donnees, {}).infos || {};
  return reglagesCatechumenat_().anniv_texte.replace(/\{prenom\}/g, i.prenoms || '').replace(/\{annees\}/g, n + (n > 1 ? ' ans' : ' an'));
}
/** Déclencheur quotidien : notification + mail aux néophytes dont c'est l'anniversaire de baptême. */
function anniversairesBapteme() {
  var r = reglagesCatechumenat_();
  if (!r.anniv_actif) return;
  var auj = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd'), opts = optionsEnvoi_();
  lignes_('Dossiers').filter(function (d) { return d.type === 'catechumene' && d.etat !== 'annule'; }).forEach(function (d) {
    var n = anniversaireDuJour_(d, auj);
    if (!n) return;
    pushEspace_(d.id, 'anniversaire');
    var m = mailDossier_(d);
    if (m) try {
      var t = texteAnniversaire_(d, n);
      GmailApp.sendEmail(m, 'Joyeux anniversaire de baptême !', corpsTexte_(t, 'paroisse'), { name: opts.name, from: opts.from, htmlBody: corpsHtml_(t, 'paroisse') });
    } catch (e) { console.error('anniversaire', e); }
  });
}
function reglagesCatechumenatRoute_(p, s) {
  if (p.consigne_lettre !== undefined) {
    var rc = json2_(props_().getProperty('CATECHUMENAT'), {});
    rc.consigne_lettre = String(p.consigne_lettre || '').slice(0, 3000);
    props_().setProperty('CATECHUMENAT', JSON.stringify(rc));
    journaliser_(s, 'Catéchuménat : consigne de la lettre à l\'évêque', '');
  } else if (p.ecrire) {
    var r0 = json2_(props_().getProperty('CATECHUMENAT'), {});
    var r = { consigne_lettre: r0.consigne_lettre || '', anniv_actif: !!p.anniv_actif, anniv_texte: String(p.anniv_texte || '').slice(0, 4000) || ANNIV_DEFAUT };
    props_().setProperty('CATECHUMENAT', JSON.stringify(r));
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'anniversairesBapteme') ScriptApp.deleteTrigger(t); });
    if (r.anniv_actif) ScriptApp.newTrigger('anniversairesBapteme').timeBased().everyDays(1).atHour(8).inTimezone('Europe/Paris').create();
    journaliser_(s, 'Catéchuménat : anniversaires de baptême', r.anniv_actif ? 'activés' : 'désactivés');
  }
  var res = reglagesCatechumenat_();
  // prochains anniversaires (60 jours)
  var auj = new Date(), proch = [];
  lignes_('Dossiers').filter(function (d) { return d.type === 'catechumene' && d.etat !== 'annule'; }).forEach(function (d) {
    var b = dateBapteme_(d); if (!b) return;
    for (var k = 0; k < 60; k++) {
      var j = new Date(auj.getTime() + k * 86400000), js = Utilities.formatDate(j, 'Europe/Paris', 'yyyy-MM-dd');
      var n = anniversaireDuJour_(d, js);
      if (n) { proch.push({ id: d.id, nom: d.nom, date: js, annees: n, mail: !!mailDossier_(d) }); break; }
    }
  });
  res.prochains = proch.sort(function (a, b) { return a.date.localeCompare(b.date); });
  res.defaut = ANNIV_DEFAUT;
  var rl = json2_(props_().getProperty('CATECHUMENAT'), {});
  res.consigne_lettre = rl.consigne_lettre || CONSIGNE_LETTRE_DEFAUT; res.consigne_defaut = CONSIGNE_LETTRE_DEFAUT;
  try { res.lettres = lettresATraiter_(); } catch (e) { res.lettres = []; }
  return res;
}

// ─── Notifications de l'espace, par sorte (réglages de la personne) ───
function favorisEspace_(id) {
  var x = null;
  try { x = lignes_('Espaces').filter(function (y) { return y.dossier_id === id; })[0]; } catch (e) {}
  return json2_(x && x.favoris, { liste: [], maj: '' });
}
function prefsNotifsEspace_(id) {
  var x = null;
  try { x = lignes_('Espaces').filter(function (y) { return y.dossier_id === id; })[0]; } catch (e) {}
  var pr = json2_(x && x.prefs, {});
  return { textes: pr.textes !== false, reponses: pr.reponses !== false, anniversaire: pr.anniversaire !== false, annonces: pr.annonces !== false };
}
function pushEspace_(id, sorte) {
  try { if (prefsNotifsEspace_(id)[sorte] === false) return; envoyerPush_('esp:' + id); } catch (e) {}
}
