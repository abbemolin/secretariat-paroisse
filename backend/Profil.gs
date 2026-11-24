/**
 * App des paroissiens — « Mon profil » et « Mes inscriptions ».
 *  - Mon profil : prénom, nom, téléphone, adresse postale, adresse e-mail (confirmée par un code envoyé
 *    à la nouvelle adresse). Les changements sont reportés dans le compte, la fiche Cor Unum de l'année,
 *    les dossiers ouverts de la personne (coordonnées seulement, sauf son propre dossier de catéchumène)
 *    et la liste de la lettre (Brevo) ; historique dans les dossiers ; l'équipe est prévenue.
 *  - Mes inscriptions : retraites, catéchisme des enfants, livres commandés, paiements en ligne —
 *    retrouvés par l'adresse e-mail de la personne, avec ce qui reste à payer et les liens utiles.
 */

function contient_(liste, mail) { return !!mail && String(liste || '').toLowerCase().split(/[\s,;]+/).indexOf(mail) > -1; }
function remplacerMail_(liste, ancien, nouveau) {
  return String(liste || '').split(/([\s,;]+)/).map(function (m) { return m.toLowerCase() === ancien ? nouveau : m; }).join('');
}

// ─── Mon profil ───

function profilCompte_(x) { return { prenom: x.prenom || '', nom: x.nom || '', telephone: x.telephone || '', adresse: x.adresse || '', mail: x.mail || '' }; }

/** Dossiers ouverts de la personne : son dossier relié, ou ceux qui portent son adresse. */
function dossiersOuvertsDe_(x) {
  var m = normMail_(x.mail);
  return lignes_('Dossiers').filter(function (d) {
    if (d.etat !== 'ouvert') return false;
    if (x.dossier_id && d.id === x.dossier_id) return true;
    var i = json2_(d.donnees, {}).infos || {};
    return m && (contient_(d.email, m) || contient_(i.email, m));
  });
}
/** Report des changements (sous verrou). ch : { prenom, nom, telephone, adresse, mail: { ancien, nouveau } } */
function reporterProfil_(x, ch, qui) {
  var resume = [];
  try {
    fichesCorDuCompte_(x).forEach(function (f) {
      if (ch.prenom !== undefined) f.prenoms = ch.prenom;
      if (ch.nom !== undefined) f.nom = ch.nom;
      if (ch.telephone !== undefined) f.telephone = ch.telephone;
      if (ch.adresse !== undefined) f.adresse = ch.adresse;
      if (ch.mail) f.email = remplacerMail_(f.email, ch.mail.ancien, ch.mail.nouveau);
      f.maj_le = maintenant_(); f.maj_par = qui;
      ecrireLigne_('CorUnum', f);
      resume.push('fiche Cor Unum');
    });
  } catch (e) { console.error('profil → Cor Unum', e); }
  try {
    dossiersOuvertsDe_(x).forEach(function (d) {
      var don = json2_(d.donnees, {}), i = don.infos = don.infos || {}, sien = x.dossier_id === d.id, changes = [];
      if (sien && ch.prenom !== undefined && i.prenoms !== ch.prenom) { i.prenoms = ch.prenom; changes.push('prénom'); }
      if (sien && ch.nom !== undefined && i.nom !== ch.nom) { i.nom = ch.nom; changes.push('nom'); }
      if (ch.telephone !== undefined && i.telephone !== ch.telephone) { i.telephone = ch.telephone; d.telephone = ch.telephone; changes.push('téléphone'); }
      if (ch.adresse !== undefined && i.adresse !== undefined && i.adresse !== ch.adresse) { i.adresse = ch.adresse; changes.push('adresse'); }
      if (ch.mail) { i.email = remplacerMail_(i.email, ch.mail.ancien, ch.mail.nouveau); d.email = remplacerMail_(d.email, ch.mail.ancien, ch.mail.nouveau); changes.push('e-mail'); }
      if (!changes.length) return;
      d.donnees = JSON.stringify(don);
      if (sien) d.nom = nomDossier_(d.type, i) || d.nom;
      ajouterHistorique_(d, 'App des paroissiens', 'Coordonnées modifiées par la personne (' + changes.join(', ') + ')');
      d.maj_le = maintenant_(); d.maj_par = qui;
      ecrireLigne_('Dossiers', d);
      resume.push('dossier ' + ((TYPES_DOSSIER[d.type] || {}).nom || d.type).toLowerCase());
    });
  } catch (e) { console.error('profil → dossiers', e); }
  return resume;
}
function modifierProfil_(x, p) {
  var court = function (v, n) { return String(v == null ? '' : v).trim().slice(0, n || 120); };
  var ch = {};
  if (p.prenom !== undefined) { ch.prenom = court(p.prenom, 80); if (!ch.prenom) throw erreur_('INVALIDE', 'Le prénom est obligatoire.'); }
  if (p.nom !== undefined) { ch.nom = court(p.nom, 80); if (!ch.nom) throw erreur_('INVALIDE', 'Le nom est obligatoire.'); }
  if (p.telephone !== undefined) { ch.telephone = court(p.telephone, 40); if (chiffres_(ch.telephone).length < 9) throw erreur_('INVALIDE', 'Numéro de téléphone invalide.'); }
  if (p.adresse !== undefined) ch.adresse = court(p.adresse, 300);
  Object.keys(ch).forEach(function (k) { if (String(x[k] || '') === ch[k]) delete ch[k]; });
  if (!Object.keys(ch).length) return { profil: profilCompte_(x), reporte: [] };
  var res = verrou_(function () {
    var y = compteParId_(x.id);
    Object.keys(ch).forEach(function (k) { y[k] = ch[k]; });
    y.maj_le = maintenant_(); ecrireLigne_('Comptes', y);
    return { y: y, reporte: reporterProfil_(y, ch, 'App des paroissiens') };
  });
  prevenirValidateurs_('App des paroissiens : coordonnées modifiées', (res.y.prenom + ' ' + res.y.nom).trim() + (res.reporte.length ? ' – reporté : ' + res.reporte.join(', ') : ''));
  return { profil: profilCompte_(res.y), reporte: res.reporte };
}
function codeNouveauMail_(x, nouveau) {
  var m = normMail_(nouveau);
  if (!m) throw erreur_('INVALIDE', 'Adresse e-mail invalide.');
  if (m === normMail_(x.mail)) throw erreur_('INVALIDE', 'C\'est déjà votre adresse.');
  var autre = compteParMail_(m);
  if (autre) throw erreur_('EXISTE', 'Cette adresse est déjà celle d\'un autre compte (une adresse par adulte).');
  compteurChef_('cptmail_' + x.id, 3, 3600, 'Trop de codes envoyés. Réessayez dans une heure.');
  var code = codeSur_();
  CacheService.getScriptCache().put('cptmail_c_' + x.id, JSON.stringify({ code: code, essais: 0, mail: m }), 900);
  mailCompte_(m, 'La Croix glorieuse – votre code : ' + code, 'Bonjour ' + (x.prenom || '') + ',\n\nVoici votre code pour utiliser cette adresse dans l\'application de la paroisse :\n\n' + code +
    '\n\nIl est valable 15 minutes. Si vous n\'avez rien demandé, ignorez ce message.' + FIN_MAIL_CPT);
  return { mail: masquerMail_(m) };
}
function changerMail_(x, code) {
  var cache = CacheService.getScriptCache(), c = json2_(cache.get('cptmail_c_' + x.id), null);
  if (!c) throw erreur_('CODE', 'Code expiré. Demandez un nouveau code.');
  verifierCodeCache_('cptmail_c_' + x.id, code);
  var ancien = normMail_(x.mail), nouveau = c.mail;
  var abonne = false; try { abonne = abonnementNewsletter_(ancien) === true; } catch (e) {}
  var res = verrou_(function () {
    if (compteParMail_(nouveau)) throw erreur_('EXISTE', 'Cette adresse est déjà celle d\'un autre compte.');
    var y = compteParId_(x.id);
    var reporte = reporterProfil_(y, { mail: { ancien: ancien, nouveau: nouveau } }, 'App des paroissiens');
    y.mail = nouveau; y.maj_le = maintenant_(); ecrireLigne_('Comptes', y);
    return { y: y, reporte: reporte };
  });
  cache.remove('cptmail_c_' + x.id);
  if (abonne) try { changerAbonnementNewsletter_(nouveau, res.y.prenom, res.y.nom, true); changerAbonnementNewsletter_(ancien, '', '', false); } catch (e) { console.error('Brevo changement d\'adresse', e); }
  try { mailCompte_(ancien, 'La Croix glorieuse – adresse modifiée', 'Bonjour ' + (res.y.prenom || '') + ',\n\nL\'adresse de votre compte dans l\'application de la paroisse a été remplacée par ' + masquerMail_(nouveau) +
    '.\n\nSi ce n\'est pas vous, prévenez tout de suite la paroisse : secretariat@croix-glorieuse.org.' + FIN_MAIL_CPT); } catch (e) {}
  prevenirValidateurs_('App des paroissiens : adresse e-mail modifiée', (res.y.prenom + ' ' + res.y.nom).trim() + (res.reporte.length ? ' – reporté : ' + res.reporte.join(', ') : ''));
  return { profil: profilCompte_(res.y), reporte: res.reporte, session: nouvelleSessionCpt_(res.y) };
}

// ─── Mes inscriptions ───

function mesInscriptions_(mail) {
  mail = normMail_(mail);
  var r = { retraites: [], catechisme: [], livres: [], paiements: [], en_ligne: false };
  if (!mail) return r;
  try { r.en_ligne = !!haActif_(); } catch (e) {}
  var auj = aujourdhui_(), limite = ajouterJours_(auj, -60);
  try {
    if (db_().getSheetByName('RetraitesInscrits')) {
      var retraites = {}; lignes_('Retraites').forEach(function (x) { retraites[x.id] = x; });
      lignes_('RetraitesInscrits').filter(function (x) { return x.statut !== 'annule' && contient_(x.contact_email, mail); }).forEach(function (x) {
        var t = retraites[x.retraite_id]; if (!t || (t.date_fin || t.date_debut) < limite) return;
        var m = montantInscription_(t, x), modifiable = !t.date_limite || t.date_limite >= auj;
        r.retraites.push({ titre: titreRetraite_(t), date: t.date_debut, date_fin: t.date_fin, lieu: t.lieu,
          participants: json2_(x.participants, []).map(function (p) { return ((p.prenom || p.prenoms || '') + ' ' + (p.nom || '')).trim(); }).filter(String),
          du: m.du, paye: m.paye, reste: m.reste, sur_place: m.sur_place,
          lien_modifier: modifiable ? urlRetraite_({ m: x.jeton }) : '',
          lien_payer: r.en_ligne && m.reste_retraite > 0 ? urlPaiement_({ o: 'retraite', m: x.jeton }) : '',
          lien_ceremonie: r.en_ligne && m.reste_ceremonie > 0 ? urlPaiement_({ o: 'ceremonie', m: x.jeton }) : '' });
      });
      r.retraites.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    }
  } catch (e) { console.error('mes retraites', e); }
  try {
    if (db_().getSheetByName('Catechisme')) {
      var toutes = lignes_('Catechisme').filter(function (x) { return contient_(x.email, mail); });
      var derniere = toutes.map(function (x) { return x.annee; }).sort().reverse()[0];
      toutes.filter(function (x) { return x.annee === derniere; }).forEach(function (x) {
        var s = resumeInscription_(x);
        r.catechisme.push({ annee: x.annee, enfant: ((x.prenoms || '') + ' ' + (x.nom || '')).trim(), groupe: x.groupe || x.classe || '', du: s.du, paye: s.paye, reste: s.reste });
      });
      var reste = r.catechisme.reduce(function (a, x) { return a + Math.max(0, x.reste); }, 0);
      if (r.catechisme.length) r.lien_cotisation = r.en_ligne && reste > 0 ? lienPaiementCate_(mail) : '';
    }
  } catch (e) { console.error('mon catéchisme', e); }
  try {
    if (db_().getSheetByName('Commandes')) {
      lignes_('Commandes').filter(function (c) { return contient_(c.email, mail) && c.statut !== 'annulee' && String(c.cree_le) >= ajouterJours_(auj, -365); }).forEach(function (c) {
        var reste = resteCommande_(c);
        r.livres.push({ date: c.cree_le, lignes: json2_(c.lignes, []).map(function (l) { return (l.qte > 1 ? l.qte + ' × ' : '') + (l.titre || ''); }).filter(String),
          total: nombre_(c.total), reste: reste, remis: c.remis === 'oui', lien_payer: r.en_ligne && reste > 0 ? urlPaiement_({ o: 'livres', c: c.jeton }) : '' });
      });
      r.livres.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    }
  } catch (e) { console.error('mes livres', e); }
  try {
    if (db_().getSheetByName('Paiements')) {
      var LIB = { paye: 'Reçu', en_attente: 'En attente', abandonne: 'Abandonné', cree: 'Commencé' };
      r.paiements = lignes_('Paiements').filter(function (x) { return contient_(x.email, mail) && x.statut !== 'cree'; })
        .sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); }).slice(0, 20)
        .map(function (x) { return { date: x.cree_le, libelle: x.libelle || x.objet, montant: nombre_(x.montant), etat: LIB[x.statut] || x.statut }; });
    }
  } catch (e) { console.error('mes paiements', e); }
  return r;
}
