/**
 * Foyers — deux conjoints relient leurs comptes de l'app (l'un propose, l'autre accepte).
 * Une fois reliés :
 *  - chacun voit les inscriptions (catéchisme, retraites, livres, paiements), les dossiers de sacrements des enfants
 *    et les actes de baptême demandés pour les enfants, faits avec l'adresse de l'autre ;
 *  - l'adresse postale est commune : la changer chez l'un la change chez l'autre (et sur ses fiches) ;
 *  - la lettre de la paroisse n'est envoyée qu'une fois par mail au foyer.
 * Chacun peut défaire le lien à tout moment (l'autre est prévenu). Pas de foyer pour un compte de lycéen.
 * RGPD : le lien est fait seulement à la demande des deux ; rien n'est montré à l'autre avant son accord.
 */

var TYPES_ENFANTS_FOYER = ['bapteme', 'premiere_communion', 'profession_foi', 'confirmation_jeune', 'mariage'];

function conjointDe_(x) {
  if (!x || !x.foyer) return null;
  var y = compteParId_(x.foyer);
  return y && y.foyer === x.id && y.statut === 'actif' ? y : null;
}
/** Adresses du foyer : la sienne d'abord, puis celle du conjoint relié. */
function mailsFoyer_(x) {
  var l = [normMail_(x.mail)], y = conjointDe_(x);
  if (y && normMail_(y.mail)) l.push(normMail_(y.mail));
  return l.filter(String);
}
function inviteFoyer_(x) { return json2_(x.foyer_invite, null); }
function estMineur_(x) { return !!(json2_(x.demande, {}) || {}).mineur; }

/** Ce que l'app montre du foyer. */
function vueFoyer_(x) {
  var y = conjointDe_(x), inv = inviteFoyer_(x), recues = [];
  if (!y) recues = lignesComptes_().filter(function (z) { var i = inviteFoyer_(z); return i && i.vers === x.id && z.statut === 'actif' && !conjointDe_(z); })
    .map(function (z) { return { id: z.id, prenom: z.prenom, nom: z.nom }; });
  return {
    possible: !estMineur_(x),
    conjoint: y ? { prenom: y.prenom, nom: y.nom } : null,
    envoyee: !y && inv ? { mail: masquerMail_(inv.mail), le: inv.le } : null,
    recues: recues
  };
}

function actionFoyer_(x, action, p) {
  if (estMineur_(x)) throw erreur_('INTERDIT', 'Le foyer n\'est pas possible pour un compte de lycéen.');
  if (action === 'inviter') {
    var m = normMail_(p.mail);
    if (!m) throw erreur_('INVALIDE', 'Adresse e-mail invalide.');
    if (m === normMail_(x.mail)) throw erreur_('INVALIDE', 'Indiquez l\'adresse de votre conjoint, pas la vôtre.');
    if (conjointDe_(x)) throw erreur_('DEJA', 'Votre compte est déjà relié à celui de votre conjoint.');
    compteurChef_('foyerinv_' + x.id, 5, 86400, 'Trop de propositions aujourd\'hui. Réessayez demain.');
    var y = compteParMail_(m);
    verrou_(function () {
      var z = compteParId_(x.id);
      z.foyer_invite = JSON.stringify({ vers: y && y.statut === 'actif' && !estMineur_(y) && !conjointDe_(y) ? y.id : '', mail: m, le: maintenant_() });
      ecrireLigne_('Comptes', z);
    });
    // La réponse est la même que l'adresse ait un compte ou non (on ne révèle pas qui a un compte)
    if (y && y.statut === 'actif' && !estMineur_(y) && !conjointDe_(y)) {
      try {
        mailCompte_(y.mail, 'La Croix glorieuse – ' + x.prenom + ' propose de relier vos comptes', 'Bonjour ' + (y.prenom || '') + ',\n\n' + (x.prenom + ' ' + x.nom).trim() +
          ' vous propose de relier vos deux comptes de l\'application de la paroisse, comme un foyer.\n\nUne fois reliés, vous verrez chacun les inscriptions et les démarches pour vos enfants, votre adresse postale sera commune, et la lettre de la paroisse ne sera envoyée qu\'une fois par mail.' +
          '\n\nPour accepter ou refuser, ouvrez l\'application (Réglages → Mon foyer). Si vous ne connaissez pas cette personne, ignorez ce message.' + FIN_MAIL_CPT, [{ texte: 'Ouvrir l\'application', url: URL_APP_PAROISSIENS }]);
      } catch (e) { console.error('mail foyer', e); }
    }
    return vueFoyer_(compteParId_(x.id));
  }
  if (action === 'annuler') {
    verrou_(function () { var z = compteParId_(x.id); z.foyer_invite = ''; ecrireLigne_('Comptes', z); });
    return vueFoyer_(compteParId_(x.id));
  }
  if (action === 'accepter' || action === 'refuser') {
    var autre = compteParId_(p.id), inv = autre ? inviteFoyer_(autre) : null;
    if (!autre || !inv || inv.vers !== x.id || autre.statut !== 'actif') throw erreur_('INTROUVABLE', 'Cette proposition n\'est plus valable.');
    if (action === 'refuser') {
      verrou_(function () { var z = compteParId_(autre.id); z.foyer_invite = ''; ecrireLigne_('Comptes', z); });
      return vueFoyer_(compteParId_(x.id));
    }
    if (conjointDe_(x) || conjointDe_(autre)) throw erreur_('DEJA', 'L\'un des deux comptes est déjà relié à un foyer.');
    var copierAdresse = '';
    verrou_(function () {
      var a = compteParId_(autre.id), b = compteParId_(x.id);
      a.foyer = b.id; b.foyer = a.id; a.foyer_invite = ''; b.foyer_invite = '';
      // adresse commune : celle de celui qui a proposé, si l'autre n'en a pas
      if (a.adresse && !b.adresse) { b.adresse = a.adresse; copierAdresse = a.adresse; }
      a.maj_le = b.maj_le = maintenant_();
      ecrireLigne_('Comptes', a); ecrireLigne_('Comptes', b);
      if (copierAdresse) reporterProfil_(b, { adresse: copierAdresse }, 'App des paroissiens (foyer)');
    });
    // une seule lettre par mail : on garde l'abonnement de celui qui a proposé
    try { if (abonnementNewsletter_(autre.mail) === true && abonnementNewsletter_(x.mail) === true) changerAbonnementNewsletter_(x.mail, '', '', false); } catch (e) { console.error('foyer lettre', e); }
    try { mailCompte_(autre.mail, 'La Croix glorieuse – vos comptes sont reliés', 'Bonjour ' + (autre.prenom || '') + ',\n\n' + x.prenom + ' a accepté : vos deux comptes de l\'application de la paroisse sont maintenant reliés comme un foyer.' +
      '\n\nChacun peut défaire ce lien à tout moment (Réglages → Mon foyer).' + FIN_MAIL_CPT); } catch (e) {}
    journaliser_({ nom: 'App des paroissiens' }, 'Foyer relié', (autre.prenom + ' ' + autre.nom).trim() + ' et ' + (x.prenom + ' ' + x.nom).trim());
    return vueFoyer_(compteParId_(x.id));
  }
  if (action === 'quitter') {
    var y2 = conjointDe_(x);
    delierFoyer_(x);
    if (y2) try { mailCompte_(y2.mail, 'La Croix glorieuse – lien de foyer défait', 'Bonjour ' + (y2.prenom || '') + ',\n\n' + x.prenom + ' a défait le lien entre vos deux comptes de l\'application de la paroisse. ' +
      'Chacun garde son compte, ses inscriptions et ses réglages. Si vous souhaitez recevoir la lettre de la paroisse par mail, vérifiez vos réglages.' + FIN_MAIL_CPT); } catch (e) {}
    return vueFoyer_(compteParId_(x.id));
  }
  throw erreur_('ACTION', 'Action inconnue.');
}
/** Défait le lien des deux côtés (et les propositions qui visent ce compte). */
function delierFoyer_(x) {
  verrou_(function () {
    lignesComptes_().forEach(function (z) {
      var i = inviteFoyer_(z), change = false;
      if (z.id === x.id || z.foyer === x.id) { if (z.foyer) { z.foyer = ''; change = true; } }
      if (i && i.vers === x.id) { z.foyer_invite = ''; change = true; }
      if (z.id === x.id && z.foyer_invite) { z.foyer_invite = ''; change = true; }
      if (change) ecrireLigne_('Comptes', z);
    });
  });
  journaliser_({ nom: 'App des paroissiens' }, 'Foyer : lien défait', (x.prenom + ' ' + x.nom).trim());
}
/** Après un changement d'adresse postale : le conjoint reçoit la même (compte et fiches). Sous verrou. */
function adresseAuConjoint_(x, adresse, qui) {
  var y = conjointDe_(x);
  if (!y || y.adresse === adresse) return '';
  y.adresse = adresse; y.maj_le = maintenant_(); ecrireLigne_('Comptes', y);
  reporterProfil_(y, { adresse: adresse }, qui);
  return y.prenom;
}

// ─── Ce que le foyer partage ───

function inscriptionsFoyer_(x) {
  var mails = mailsFoyer_(x), r = mesInscriptions_(mails[0]);
  if (mails.length < 2) return r;
  var r2 = mesInscriptions_(mails[1]), y = conjointDe_(x);
  ['retraites', 'catechisme', 'livres', 'paiements'].forEach(function (k) {
    (r2[k] || []).forEach(function (z) { z.par = y.prenom; r[k].push(z); });
  });
  if (!r.lien_cotisation && r2.lien_cotisation) r.lien_cotisation = r2.lien_cotisation;
  r.retraites.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  r.livres.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  r.paiements.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  r.foyer = y.prenom;
  return r;
}
function dossiersFoyer_(x) {
  var l = mesDossiers_(x.mail, x.dossier_id), y = conjointDe_(x);
  if (!y) return l;
  var vus = {}; l.forEach(function (d) { vus[d.id] = 1; });
  mesDossiers_(y.mail, '').filter(function (d) { return !vus[d.id] && TYPES_ENFANTS_FOYER.indexOf(d.cle) > -1; })
    .forEach(function (d) { d.par = y.prenom; l.push(d); });
  return l.sort(function (a, b) { return String(b.recu_le).localeCompare(String(a.recu_le)); });
}
function actesFoyer_(x) {
  var l = mesActes_(x.mail), y = conjointDe_(x);
  if (!y) return l;
  return l.concat(mesActes_(y.mail).filter(function (a) { return a.pour === 'enfant'; }).map(function (a) { a.par = y.prenom; return a; }))
    .sort(function (a, b) { return String(b.le).localeCompare(String(a.le)); });
}
