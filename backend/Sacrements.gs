/**
 * App des paroissiens — demandes de sacrements, acte de baptême, suivi des dossiers, dons.
 *  - Demandes depuis l'app (mêmes champs que les formulaires du site, coordonnées du compte déjà remplies) :
 *    baptême d'un enfant, mariage, baptême d'un adulte (catéchumène), confirmation d'un adulte.
 *    Elles passent par recevoirDemandePublique_ (même dossier, mêmes notifications que le site) ;
 *    le dossier est relié au compte (adresse e-mail, et dossier_id pour un catéchumène).
 *  - Acte de baptême pour soi ou ses enfants (baptisés à la paroisse) : demande dans « Extraits ».
 *  - Suivi : étapes faites et prochaine étape des dossiers de la personne, sans notes internes.
 *  - Dons : causes et formulaires de don HelloAsso réglés dans le secrétariat (reçu fiscal fait par HelloAsso).
 */

var TYPES_DEMANDE_APP = ['bapteme', 'mariage', 'catechumene', 'confirmand'];
// Étapes montrées dans l'app (mêmes clés que app/src/types.js ; les étapes conditionnelles ne s'affichent que faites)
var ETAPES_APP = {
  bapteme: [['recue', 'Demande reçue'], ['contact', 'Premier contact'], ['preparation', 'Rencontre de préparation'], ['date', 'Date fixée'], ['documents', 'Documents reçus'], ['celebration', 'Célébration'], ['registre', 'Inscription au registre']],
  premiere_communion: [['inscription', 'Inscription reçue'], ['certificat', 'Certificat de baptême reçu'], ['rdv_cure', 'Rendez-vous avec le curé'], ['confession', 'Première confession'], ['retraite', 'Retraite'], ['celebration', 'Célébration'], ['registre', 'Inscription au registre']],
  profession_foi: [['inscription', 'Inscription reçue'], ['certificat', 'Certificat de baptême reçu'], ['retraite', 'Retraite'], ['celebration', 'Célébration'], ['registre', 'Inscription au registre']],
  confirmation_jeune: [['inscription', 'Inscription reçue'], ['certificat', 'Certificat de baptême reçu'], ['lettre', 'Lettre à l\'évêque'], ['retraite', 'Retraite'], ['celebration', 'Confirmation'], ['registre', 'Inscription au registre']],
  mariage: [['recue', 'Demande reçue'], ['rdv', 'Premier rendez-vous avec le prêtre'], ['preparation', 'Préparation'], ['canonique', 'Dossier canonique'], ['bans', 'Publication des bans'], ['celebration', 'Célébration'], ['registre', 'Inscription au registre']],
  catechumene: [['accueil', 'Premier accueil'], ['accompagnateur', 'Accompagnateur désigné'], ['entree', 'Entrée en catéchuménat'], ['lettre', 'Lettre à l\'évêque'], ['appel', 'Appel décisif'], ['scrutins', 'Scrutins'], ['sacrements', 'Baptême, confirmation, eucharistie'], ['registre', 'Inscription au registre']],
  confirmand: [['accueil', 'Accueil'], ['parcours', 'Parcours de préparation'], ['lettre', 'Lettre à l\'évêque'], ['retraite', 'Retraite'], ['confirmation', 'Confirmation'], ['registre', 'Inscription au registre']]
};

/** Pièces que la personne apporte elle-même (les autres sont faites par la paroisse). */
var DOCS_APP = {
  bapteme: [['cert_parrain', 'certificat de baptême ou de confirmation du parrain'], ['cert_marraine', 'certificat de baptême ou de confirmation de la marraine']],
  premiere_communion: [['cert_bapteme', 'certificat de baptême']],
  profession_foi: [['cert_bapteme', 'certificat de baptême']],
  confirmation_jeune: [['cert_bapteme', 'certificat de baptême'], ['lettre_eveque', 'lettre à l\'évêque'], ['cert_parrain', 'certificat du parrain ou de la marraine']],
  mariage: [['bapteme_fiancee', 'acte de baptême récent de la fiancée'], ['bapteme_fiance', 'acte de baptême récent du fiancé'], ['intention_fiancee', 'déclaration d\'intention de la fiancée'], ['intention_fiance', 'déclaration d\'intention du fiancé']],
  confirmand: [['cert_bapteme', 'certificat de baptême'], ['lettre_eveque', 'lettre à l\'évêque'], ['cert_parrain', 'certificat du parrain ou de la marraine'], ['photo', 'photo d\'identité']]
};

/** Demande de sacrement depuis l'app. qui : { mail, prenom, nom, telephone, adresse, compte_id } */
function demanderSacrementApp_(qui, p) {
  var type = String(p.type || '');
  if (TYPES_DEMANDE_APP.indexOf(type) === -1) throw erreur_('INVALIDE', 'Demande inconnue.');
  var mail = normMail_(qui.mail);
  if (!mail) throw erreur_('INVALIDE', 'Aucune adresse e-mail n\'est connue : la paroisse ne pourrait pas vous répondre.');
  var champs = {};
  Object.keys(p.champs || {}).forEach(function (k) { champs[k] = p.champs[k]; });
  champs.email = mail; champs.telephone = champs.telephone || qui.telephone || '';
  if (!champs.adresse && qui.adresse) champs.adresse = qui.adresse;
  if (type === 'catechumene' || type === 'confirmand') { champs.prenoms = champs.prenoms || qui.prenom; champs.nom = champs.nom || qui.nom; }
  var avant = {}; lignes_('Dossiers').forEach(function (d) { avant[d.id] = 1; });
  recevoirDemandePublique_({ type: type, champs: champs, consentement: true });
  oublierLignes_('Dossiers');
  var d = lignes_('Dossiers').filter(function (x) { return !avant[x.id] && x.type === type && contient_(x.email, mail); })[0];
  if (d) verrou_(function () {
    var y = trouverDossier_(d.id);
    y.source = 'App des paroissiens';
    ajouterHistorique_(y, 'App des paroissiens', 'Demande faite depuis l\'app (compte de ' + ((qui.prenom || '') + ' ' + (qui.nom || '')).trim() + ')');
    ecrireLigne_('Dossiers', y);
  });
  // Catéchumène : le compte sera relié au dossier quand la paroisse ouvrira son espace (lienEspace_)
  return { recu: true };
}

/** Suivi des dossiers de la personne (par adresse), sans notes internes. */
function mesDossiers_(mail, dossierId) {
  mail = normMail_(mail);
  return lignes_('Dossiers').filter(function (d) {
    if (d.etat === 'annule' || !ETAPES_APP[d.type]) return false;
    var i = json2_(d.donnees, {}).infos || {};
    return (dossierId && d.id === dossierId) || (mail && (contient_(d.email, mail) || contient_(i.email, mail)));
  }).map(function (d) {
    var don = json2_(d.donnees, {}), et = don.etapes || {}, i = don.infos || {};
    var etapes = ETAPES_APP[d.type].map(function (e) {
      var x = et[e[0]] || {};
      if (!x.fait && (e[0] === 'recue' || e[0] === 'inscription')) x = { fait: true, date: d.cree_le };   // la demande existe : elle est reçue
      return { libelle: e[1], fait: !!x.fait, date: x.fait ? String(x.date || '').slice(0, 10) : '' };
    });
    var prochaine = etapes.filter(function (e) { return !e.fait; })[0];
    var qui = d.type === 'bapteme' ? [i.enfant_prenoms, i.enfant_nom].filter(Boolean).join(' ')
      : d.type === 'mariage' ? [i.fiancee_prenoms, i.fiance_prenoms].filter(Boolean).join(' et ') : d.nom;
    var docs = don.documents || {}, celebre = !!(et.celebration || {}).fait || !!(et.confirmation || {}).fait || !!(et.sacrements || {}).fait;
    var aFournir = d.etat === 'ouvert' && !celebre ? (DOCS_APP[d.type] || []).filter(function (k) { return !(docs[k[0]] && docs[k[0]].recu); }).map(function (k) { return k[1]; }) : [];
    if (d.type === 'bapteme' && !i.marraine_nom) aFournir = aFournir.filter(function (k) { return k.indexOf('marraine') === -1; });
    if (d.type === 'bapteme' && !i.parrain_nom) aFournir = aFournir.filter(function (k) { return k.indexOf('du parrain') === -1; });
    return { id: d.id, cle: d.type, a_fournir: aFournir, type: (TYPES_DOSSIER[d.type] || {}).nom || d.type, qui: qui, etat: d.etat === 'clos' ? 'termine' : 'en_cours', recu_le: String(d.cree_le || '').slice(0, 10),
      date_celebration: d.date_celebration || '', etapes: etapes, prochaine: prochaine ? prochaine.libelle : '' };
  }).sort(function (a, b) { return String(b.recu_le).localeCompare(String(a.recu_le)); });
}

/** Acte de baptême (pour soi ou ses enfants, baptisés à la paroisse) : demande rangée dans « Extraits ». */
function demanderActeApp_(qui, p) {
  var mail = normMail_(qui.mail);
  if (!mail) throw erreur_('MAIL', 'Aucune adresse e-mail n\'est connue : la paroisse ne pourrait pas vous envoyer l\'acte.');
  var court = function (v, n) { return String(v == null ? '' : v).trim().slice(0, n || 120); };
  var prenoms = court(p.prenoms, 120), nom = court(p.nom, 80), naissance = court(p.naissance, 10);
  if (!prenoms || !nom) throw erreur_('INVALIDE', 'Indiquez les prénoms et le nom de la personne baptisée.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(naissance)) throw erreur_('INVALIDE', 'Indiquez la date de naissance.');
  if (MOTIFS_ACTE.indexOf(p.motif) === -1) throw erreur_('INVALIDE', 'Choisissez le motif de la demande.');
  var pour = p.pour === 'enfant' ? 'enfant' : 'moi';
  feuilleExtraits_();
  var cle = sansAccents_(prenoms + ' ' + nom).toLowerCase();
  var deja = lignes_('Extraits').filter(function (x) { var dm = json2_(x.demande, null); return dm && dm.email === mail && !json2_(x.envois, []).length && sansAccents_(x.nom).toLowerCase() === cle; });
  if (deja.length) throw erreur_('DEJA', 'Une demande est déjà en cours pour ' + prenoms + ' ' + nom + ' : la paroisse va vous envoyer l\'acte.');
  compteurChef_('acteapp_' + mail, 5, 86400, 'Trop de demandes aujourd\'hui. Écrivez au secrétariat : secretariat@croix-glorieuse.org.');
  var r = reglages_();
  var id = verrou_(function () {
    var v = { paroisse: r.paroisse, diocese: r.diocese, annee: court(p.annee_bapteme, 4), acte: '', sexe: '', prenoms: prenoms, nom: nom.toUpperCase(), ne_le: dateLongueFr_(naissance), ne_a: court(p.lieu_naissance, 120),
      baptise_le: '', eglise: r.eglise, de: r.commune, diocese_de: r.diocese, confirme_le: '', confirme_a: '', marie_le: '', marie_a: '', fait_a: r.commune, fait_le: dateLongueFr_(maintenant_()) };
    var e = { id: uid_(), cree_le: maintenant_(), cree_par: 'App des paroissiens', dossier_id: '', nom: prenoms + ' ' + nom, valeurs: JSON.stringify(v), statut: 'brouillon', envois: '[]',
      maj_le: maintenant_(), maj_par: 'App des paroissiens',
      demande: JSON.stringify({ motif: p.motif, le: maintenant_(), email: mail, pour: pour, demandeur: ((qui.prenom || '') + ' ' + (qui.nom || '')).trim(), parents: court(p.parents, 200), annee_bapteme: court(p.annee_bapteme, 4), message: court(p.message, 500) }) };
    ecrireLigne_('Extraits', e);
    return e.id;
  });
  lignes_('Utilisateurs').filter(estActif_).forEach(function (u) { notifier_(u.id, 'Demande d\'acte de baptême (app)', prenoms + ' ' + nom + ' – ' + p.motif, '#/extraits/' + id); });
  return { recu: true };
}
function mesActes_(mail) {
  mail = normMail_(mail);
  if (!mail || !db_().getSheetByName('Extraits')) return [];
  return lignes_('Extraits').filter(function (x) { var dm = json2_(x.demande, null); return dm && dm.email === mail; })
    .sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); }).slice(0, 20)
    .map(function (x) { var dm = json2_(x.demande, {}), env = json2_(x.envois, []); return { nom: x.nom, motif: dm.motif, pour: dm.pour || 'moi', le: dm.le, envoye_le: env.length ? env[env.length - 1].date : '' }; });
}

// ─── Dons (formulaires de don HelloAsso) ───

function causesDons_() { return json2_(props_().getProperty('DONS_CAUSES'), []); }
function causesPubliques_() { return causesDons_().filter(function (c) { return c.actif !== false; }).map(function (c) { return { id: c.id, titre: c.titre, texte: c.texte, url: c.url }; }); }
function ecrireCausesDons_(p, s) {
  if (s.role !== 'admin' && s.role !== 'cure') throw interdit_('Réservé au curé et aux administrateurs.');
  var l = (p.causes || []).slice(0, 12).map(function (c) {
    var url = String(c.url || '').trim();
    if (!/^https:\/\/(www\.)?helloasso\.com\//.test(url)) throw erreur_('INVALIDE', 'Lien HelloAsso invalide pour « ' + (c.titre || '?') + ' » : il doit commencer par https://www.helloasso.com/');
    var titre = String(c.titre || '').trim().slice(0, 80);
    if (!titre) throw erreur_('INVALIDE', 'Chaque cause a besoin d\'un nom.');
    return { id: c.id || uid_(), titre: titre, texte: String(c.texte || '').trim().slice(0, 300), url: url, actif: c.actif !== false };
  });
  props_().setProperty('DONS_CAUSES', JSON.stringify(l));
  journaliser_(s, 'App des paroissiens : causes de dons modifiées', l.length + ' cause(s)');
  return l;
}
