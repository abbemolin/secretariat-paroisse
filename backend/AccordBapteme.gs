/**
 * Accord du curé du domicile des parents (Form. B 15) — baptême d'un enfant hors de sa paroisse.
 * Deux cas :
 *  - « donne » : une famille de La Croix glorieuse fait baptiser son enfant dans une autre paroisse.
 *    Dossier « Baptême dans une autre paroisse » (bapteme_ailleurs) ; le curé signe l'accord dans l'appli
 *    (signature + sceau), le PDF est archivé et envoyé à la famille.
 *  - « demande » : une famille d'une autre paroisse fait baptiser son enfant ici (dossier de baptême).
 *    Le B15 est prérempli (« à M. le curé de La Croix glorieuse ») et envoyé à la famille, qui le fait
 *    signer par le curé de son domicile et le rapporte (document « Autorisation » du dossier).
 * Dans les deux cas, le secrétariat envoie d'abord au demandeur un lien vers un formulaire en ligne
 * (page accord-bapteme/ du site des formulaires) qui complète le dossier.
 * RGPD : les informations servent seulement à la préparation du baptême et au document ; le lien est personnel.
 */

var CHAMPS_ACCORD_COMMUNS = ['enfant_prenoms', 'enfant_nom', 'sexe', 'enfant_naissance_date', 'enfant_naissance_lieu',
  'pere_prenom', 'pere_nom', 'mere_prenom', 'mere_nom_jeune_fille', 'adresse', 'commune', 'telephone', 'date_souhaitee', 'message'];
var CHAMPS_ACCORD = {
  donne: CHAMPS_ACCORD_COMMUNS.concat(['paroisse_bapteme', 'commune_bapteme', 'diocese_bapteme', 'cure_bapteme']),
  demande: CHAMPS_ACCORD_COMMUNS.concat(['domicile_paroisse', 'domicile_commune', 'domicile_diocese', 'domicile_cure'])
};
var OBLIGATOIRES_ACCORD = {
  donne: ['enfant_prenoms', 'enfant_nom', 'sexe', 'adresse', 'commune', 'paroisse_bapteme', 'commune_bapteme'],
  demande: ['enfant_prenoms', 'enfant_nom', 'sexe', 'adresse', 'commune', 'domicile_paroisse', 'domicile_commune']
};

function sensAccord_(d) { return d.type === 'bapteme_ailleurs' ? 'donne' : 'demande'; }
function urlAccordBapteme_(j) {
  return String(reglages_().url_formulaires || 'https://secretariat.croix-glorieuse.org/').replace(/\/?$/, '/') + 'accord-bapteme/?j=' + j;
}
function dossierParJetonAccord_(j) {
  if (!/^[a-f0-9]{32}$/.test(String(j || ''))) throw erreur_('LIEN', 'Ce lien n\'est pas valable.');
  var d = lignes_('Dossiers').filter(function (x) {
    return (x.type === 'bapteme' || x.type === 'bapteme_ailleurs') && String(x.donnees || '').indexOf(j) > -1 && (json2_(x.donnees, {}).infos || {}).accord_jeton === j;
  })[0];
  if (!d || d.etat === 'annule') throw erreur_('LIEN', 'Ce lien n\'est plus valable. Contactez le secrétariat : secretariat@croix-glorieuse.org.');
  return d;
}

// ─── Secrétariat : envoyer le lien du formulaire ───

function texteMailFormulaireAccord_(d) {
  var i = json2_(d.donnees, {}).infos || {}, r = reglages_(), enfant = i.enfant_prenoms ? ' de ' + i.enfant_prenoms : ' de votre enfant';
  return 'Bonjour,\n\n' + (sensAccord_(d) === 'donne'
    ? 'Vous souhaitez faire baptiser votre enfant dans une autre paroisse. Pour que le curé de ' + r.paroisse + ' puisse vous donner son accord (formulaire diocésain B 15), merci de compléter ce formulaire en ligne' + ' pour le baptême' + enfant + '.'
    : 'Vous souhaitez faire baptiser votre enfant à ' + r.paroisse + '. Comme vous habitez sur le territoire d\'une autre paroisse, l\'accord de votre curé est nécessaire (formulaire diocésain B 15). Merci de compléter ce formulaire en ligne : nous vous enverrons ensuite le document prérempli, à faire signer par votre curé.') +
    '\n\nCela prend quelques minutes.';
}
function envoyerFormulaireAccordRoute_(p, s) {
  var d0 = trouverDossier_(p.id);
  if (d0.type !== 'bapteme' && d0.type !== 'bapteme_ailleurs') throw erreur_('INVALIDE', 'Seulement pour un baptême.');
  var mail = normMail_(String(p.email || d0.email || '').split(/[\s,;]+/)[0]);
  if (!mail) throw erreur_('INVALIDE', 'Indiquez d\'abord l\'adresse e-mail du demandeur dans le dossier.');
  var d = verrou_(function () {
    var d = trouverDossier_(p.id), don = json2_(d.donnees, {}), i = don.infos = don.infos || {};
    if (!i.accord_jeton) i.accord_jeton = jeton_();
    i.accord_envoye_le = maintenant_();
    if (!i.email) { i.email = mail; d.email = mail; }
    d.donnees = JSON.stringify(don);
    ajouterHistorique_(d, s.nom, 'Formulaire « accord du curé » envoyé à ' + mail);
    d.maj_le = maintenant_(); d.maj_par = s.nom;
    ecrireLigne_('Dossiers', d);
    return d;
  });
  var i2 = json2_(d.donnees, {}).infos, texte = String(p.texte || '').trim() || texteMailFormulaireAccord_(d);
  var opts = optionsEnvoi_();
  texte += '\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
  var boutons = [{ texte: 'Remplir le formulaire', url: urlAccordBapteme_(i2.accord_jeton) }];
  var sujetA = String(p.sujet || 'Baptême – accord du curé de votre domicile');
  GmailApp.sendEmail(mail, sujetA, corpsTexte_(texte, 'paroisse', boutons),
    { name: opts.name, from: opts.from, htmlBody: corpsHtml_(texte, 'paroisse', boutons) });
  noterEnvoiDossier_(sensAccord_(d) === 'donne' ? 'accord_ailleurs' : 'accord_ici', d, mail, boutons[0].url, sujetA, texte, s);
  journaliser_(s, 'Baptême : formulaire « accord du curé » envoyé', d.nom);
  return dossierComplet_(d);
}

// ─── Page publique du formulaire (lien personnel) ───

function actionAccordBapteme_(action, p) {
  compteurChef_('accbap_' + String(p.j || p.e || '').slice(0, 32), 60, 3600, 'Trop de demandes en peu de temps. Réessayez dans une heure.');
  var d = null, sens, env = null;
  if (p.e && !p.j) {
    // lien envoyé depuis l'onglet « Formulaires » : le dossier se crée à la réponse
    env = envoiParJeton_(p.e);
    if (!env || ['accord_ailleurs', 'accord_ici'].indexOf(env.formulaire) === -1) throw erreur_('LIEN', 'Ce lien n\'est plus valable. Contactez le secrétariat : secretariat@croix-glorieuse.org.');
    var deja = json2_(env.dossier_ids, [])[0];
    if (deja) { try { d = trouverDossier_(deja); } catch (er) { d = null; } }
    sens = env.formulaire === 'accord_ailleurs' ? 'donne' : 'demande';
  } else {
    d = dossierParJetonAccord_(p.j); sens = sensAccord_(d);
  }
  var i = d ? json2_(d.donnees, {}).infos || {} : { enfant_prenoms: '', enfant_nom: '' }, r = reglages_();
  if (action === 'public.accordBapteme') {
    var valeurs = {};
    CHAMPS_ACCORD[sens].forEach(function (k) { if (i[k]) valeurs[k] = i[k]; });
    return { sens: sens, paroisse: r.paroisse, diocese: r.diocese, valeurs: valeurs, recu_le: i.accord_recu_le || '', obligatoires: OBLIGATOIRES_ACCORD[sens], courriel: !d && !(env && env.email) };
  }
  if (action !== 'public.accordBaptemeEnvoyer') throw erreur_('ACTION', 'Action inconnue.');
  if (p.consentement !== true) throw erreur_('INVALIDE', 'Merci d\'accepter l\'utilisation de ces informations pour la préparation du baptême.');
  var ch = {};
  CHAMPS_ACCORD[sens].forEach(function (k) {
    if (p.champs && p.champs[k] !== undefined) ch[k] = String(p.champs[k]).trim().slice(0, k === 'message' ? 1000 : 200);
  });
  if (ch.sexe && ['Garçon', 'Fille'].indexOf(ch.sexe) === -1) ch.sexe = '';
  ['enfant_naissance_date', 'date_souhaitee'].forEach(function (k) { if (ch[k] && !/^\d{4}-\d{2}-\d{2}$/.test(ch[k])) ch[k] = ''; });
  var manque = OBLIGATOIRES_ACCORD[sens].filter(function (k) { return !ch[k]; });
  if (manque.length) throw erreur_('INVALIDE', 'Merci de remplir tous les champs marqués d\'une étoile.');
  if (!d) {
    // création du dossier à la réponse
    var type = sens === 'donne' ? 'bapteme_ailleurs' : 'bapteme';
    d = verrou_(function () {
      var nv = { id: uid_(), type: type, etat: 'ouvert', cree_le: maintenant_(), source: 'Formulaire envoyé (accord du curé)', nom: '', email: env.email, telephone: '',
        date_celebration: '', evenement_id: '', responsable: '',
        donnees: JSON.stringify({ infos: { email: env.email, accord_jeton: jeton_(), accord_envoye_le: env.envoye_le }, etapes: { recue: { fait: true, date: maintenant_(), par: 'Formulaire', libelle: 'Demande reçue' } }, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] }),
        maj_le: maintenant_(), maj_par: 'Formulaire' };
      ajouterHistorique_(nv, 'Formulaire en ligne', 'Dossier créé par le formulaire « accord du curé » envoyé par ' + env.envoye_par);
      return ecrireLigne_('Dossiers', nv);
    });
  }
  var d2 = verrou_(function () {
    var x = trouverDossier_(d.id), don = json2_(x.donnees, {}), inf = don.infos = don.infos || {};
    Object.keys(ch).forEach(function (k) { if (ch[k] || k === 'message') inf[k] = ch[k]; });
    if (ch.message) inf.message = ch.message;
    inf.accord_recu_le = maintenant_();
    if (sens === 'donne') { don.etapes = don.etapes || {}; don.etapes.formulaire = { fait: true, date: maintenant_(), par: 'Formulaire en ligne', libelle: 'Formulaire rempli' }; }
    x.donnees = JSON.stringify(don);
    x.nom = nomDossier_(x.type, inf) || x.nom;
    ajouterHistorique_(x, 'Formulaire en ligne', 'Formulaire « accord du curé » rempli par la famille');
    x.maj_le = maintenant_(); x.maj_par = 'Formulaire en ligne';
    ecrireLigne_('Dossiers', x);
    return x;
  });
  lignes_('Utilisateurs').filter(estActif_).forEach(function (u) {
    var sx = { role: u.role, acces: accesDe_(u) };
    if (u.role === 'admin' || peutLire_(sx, 'dossiers', 'bapteme')) notifier_(u.id, 'Baptême : formulaire reçu', d2.nom + (sens === 'donne' ? ' – accord à signer' : ' – B15 à envoyer à la famille'), '#/dossiers/' + d2.id);
  });
  marquerEnvoi_(env ? env.jeton : inf0Jeton_(d2), d2.id);
  return { ok: true, sens: sens };
}

// ─── Secrétariat : envoi du B15 (signé par La Croix glorieuse, ou prérempli à faire signer) ───

function envoyerB15Route_(p, s) {
  var d0 = trouverDossier_(p.dossierId);
  if (d0.type !== 'bapteme' && d0.type !== 'bapteme_ailleurs') throw erreur_('INVALIDE', 'Seulement pour un baptême.');
  var sens = sensAccord_(d0);
  if (sens === 'donne' && !peutSigner_(s)) throw erreur_('INTERDIT', 'Vous n\'êtes pas habilité(e) à signer.');
  if (!p.pdf) throw erreur_('INVALIDE', 'Document manquant.');
  var mail = normMail_(String(d0.email || '').split(/[\s,;]+/)[0]);
  if (!mail) throw erreur_('INVALIDE', 'Le dossier n\'a pas d\'adresse e-mail.');
  var libelle = sens === 'donne' ? 'Accord du curé (B15) signé' : 'Accord du curé du domicile (B15) à faire signer';
  var res = verrou_(function () {
    var d = trouverDossier_(p.dossierId);
    var blob = Utilities.newBlob(Utilities.base64Decode(p.pdf), 'application/pdf', nomFichierDossier_(d, libelle, 'pdf'));
    var f = dossierDriveDe_(d).createFile(blob);
    enregistrerPiece_(d, f, libelle, '', s, true);
    d = trouverDossier_(p.dossierId);
    var don = json2_(d.donnees, {});
    don.etapes = don.etapes || {};
    var marque = function (k, l) { if (!(don.etapes[k] || {}).fait) don.etapes[k] = { fait: true, date: maintenant_(), par: s.nom, libelle: l }; };
    if (sens === 'donne') { marque('accord', 'Accord signé'); marque('envoye', 'Accord envoyé à la famille'); }
    don.infos = don.infos || {}; don.infos.accord_b15_envoye_le = maintenant_();
    d.donnees = JSON.stringify(don);
    ajouterHistorique_(d, s.nom, 'B15 envoyé par mail à ' + mail);
    ecrireLigne_('Dossiers', d);
    return { d: d, blob: blob };
  });
  var i = json2_(res.d.donnees, {}).infos || {}, r = reglages_(), opts = optionsEnvoi_();
  var texte = String(p.texte || '').trim() || ('Bonjour,\n\n' + (sens === 'donne'
    ? 'Vous trouverez ci-joint l\'accord du curé de ' + r.paroisse + ' pour le baptême de ' + (i.enfant_prenoms || 'votre enfant') + (i.paroisse_bapteme ? ' à ' + i.paroisse_bapteme : '') + '. Remettez-le à la paroisse où aura lieu le baptême.'
    : 'Vous trouverez ci-joint le formulaire B 15 prérempli pour le baptême de ' + (i.enfant_prenoms || 'votre enfant') + ' à ' + r.paroisse + '. Merci de le faire signer (avec le sceau) par le curé de votre paroisse' + (i.domicile_paroisse ? ', ' + i.domicile_paroisse : '') + ', puis de nous le rapporter ou de nous le renvoyer par mail.'));
  texte += '\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
  GmailApp.sendEmail(mail, 'Baptême de ' + (i.enfant_prenoms || 'votre enfant') + ' – accord du curé (B 15)', corpsTexte_(texte, 'paroisse'),
    { name: opts.name, from: opts.from, htmlBody: corpsHtml_(texte, 'paroisse'), attachments: [res.blob.setName('B15 – accord du curé – ' + (i.enfant_prenoms || '') + ' ' + (i.enfant_nom || '') + '.pdf')] });
  journaliser_(s, 'Baptême : B15 envoyé', res.d.nom);
  return dossierComplet_(trouverDossier_(p.dossierId));
}

function inf0Jeton_(d) { return (json2_(d.donnees, {}).infos || {}).accord_jeton || ''; }
