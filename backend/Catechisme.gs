/**
 * Catéchisme et aumônerie : inscriptions de l'année scolaire.
 *
 * Les parents inscrivent leurs enfants avec le formulaire Google habituel ; l'appli lit
 * la feuille de réponses (une par année, réglée dans Réglages → Catéchisme) et crée une
 * inscription par enfant. Chaque enfant est placé dans un groupe selon sa classe.
 * Une demande de sacrement (baptême, première communion, profession de foi, confirmation)
 * crée automatiquement le dossier correspondant, relié à l'inscription.
 * Suivi des manuels commandés (prix lus dans le texte du choix), de la cotisation et des paiements.
 */

var COLONNES_CATE = ['id', 'annee', 'cree_le', 'source', 'nom', 'prenoms', 'naissance', 'classe', 'groupe', 'email', 'telephone',
  'adresse', 'pere', 'mere', 'sacrement', 'demandes', 'bapteme', 'manuels', 'cotisation', 'paiements', 'notes', 'maj_le', 'maj_par', 'commande_id'];

var GROUPES_CATE = ['Maternelle-CP', 'CE1-CE2', 'CM1-CM2', '6e-5e', '4e-3e', 'Lycéens'];
var MODES_PAIEMENT = ['Espèces', 'Chèque', 'Virement', 'Carte', 'Autre'];

// Feuille de réponses 2026-2027 (formulaire « Inscription au catéchisme et à l'aumônerie »)
var CATE_DEFAUT = {
  feuilles: [{ id: '1uMceNIzuF2F_S4ANgpaO3_5h4obqVJXlAvD9q8CWLW0', annee: '2026-2027' }],
  cotisation: 0,
  ecoles: [{ nom: 'Herrade de Landsberg', email: '' }, { nom: 'Saints Louis et Zélie Martin', email: '' }],
  import_auto: false
};

function feuilleCate_() {
  var f = db_().getSheetByName('Catechisme');
  if (!f) {
    f = db_().insertSheet('Catechisme');
    f.getRange('A:Z').setNumberFormat('@');
    f.appendRow(COLONNES_CATE);
    f.setFrozenRows(1);
  } else completerColonnes_(f, COLONNES_CATE);
  return f;
}

// ─── Réglages ───

function cateReglages_() {
  var r = json2_(props_().getProperty('CATE'), {});
  return {
    feuilles: r.feuilles || CATE_DEFAUT.feuilles,
    cotisation: Number(r.cotisation || 0),
    ecoles: r.ecoles || CATE_DEFAUT.ecoles,
    import_auto: r.import_auto === true
  };
}
function lireCateReglages_() {
  var r = cateReglages_();
  r.feuilles = r.feuilles.map(function (f) {
    try { return { id: f.id, annee: f.annee, nom: SpreadsheetApp.openById(f.id).getName() }; } catch (e) { return { id: f.id, annee: f.annee, nom: '', erreur: 'Feuille introuvable' }; }
  });
  r.groupes = GROUPES_CATE; r.modes = MODES_PAIEMENT;
  return r;
}
function idDeFeuille_(t) {
  var m = String(t || '').match(/\/d\/([a-zA-Z0-9_-]{20,})/) || String(t || '').match(/^([a-zA-Z0-9_-]{20,})$/);
  return m ? m[1] : '';
}
function ecrireCateReglages_(p, s) {
  var r = cateReglages_(), avant = r.import_auto;
  if (p.cotisation !== undefined) r.cotisation = Math.max(0, Number(String(p.cotisation).replace(',', '.')) || 0);
  if (p.ecoles) r.ecoles = p.ecoles.map(function (e) { return { nom: String(e.nom || '').trim(), email: String(e.email || '').trim() }; }).filter(function (e) { return e.nom; });
  if (p.feuilles) {
    r.feuilles = p.feuilles.map(function (f) {
      var id = idDeFeuille_(f.id);
      if (!id) throw erreur_('INVALIDE', 'Adresse de feuille de réponses invalide.');
      var annee = String(f.annee || '').trim();
      if (!/^\d{4}-\d{4}$/.test(annee)) {
        try { annee = (SpreadsheetApp.openById(id).getName().match(/(\d{4})\s*-\s*(\d{4})/) || []).slice(1, 3).join('-'); } catch (e) {}
      }
      if (!/^\d{4}-\d{4}$/.test(annee)) throw erreur_('INVALIDE', 'Année scolaire manquante pour une feuille (ex. 2027-2028).');
      return { id: id, annee: annee };
    });
  }
  if (p.import_auto !== undefined) r.import_auto = p.import_auto === true;
  props_().setProperty('CATE', JSON.stringify(r));
  if (r.import_auto !== avant) {
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'importerCatechisme') ScriptApp.deleteTrigger(t); });
    if (r.import_auto) ScriptApp.newTrigger('importerCatechisme').timeBased().everyMinutes(15).create();
  }
  journaliser_(s, 'Catéchisme : réglages modifiés', '');
  return lireCateReglages_();
}

// ─── Lecture / résumé ───

function nombre_(v) { return Number(String(v || '0').replace(',', '.')) || 0; }

function resumeInscription_(x) {
  var manuels = json2_(x.manuels, []), paiements = json2_(x.paiements, []);
  // livres passés en commande (boutique) : payés à part, hors de l'inscription
  var du = nombre_(x.cotisation) + (x.commande_id ? 0 : manuels.reduce(function (a, m) { return a + nombre_(m.prix); }, 0));
  var paye = paiements.reduce(function (a, p) { return a + nombre_(p.montant); }, 0);
  return {
    id: x.id, annee: x.annee, cree_le: x.cree_le, source: String(x.source).indexOf(':') > -1 ? 'Formulaire' : x.source,
    nom: x.nom, prenoms: x.prenoms, classe: x.classe, groupe: x.groupe, email: x.email, telephone: x.telephone,
    demandes: json2_(x.demandes, []),
    du: Math.round(du * 100) / 100, paye: Math.round(paye * 100) / 100, reste: Math.round((du - paye) * 100) / 100,
    manuels_remis: manuels.length > 0 && manuels.every(function (m) { return m.remis; }), nb_manuels: manuels.length
  };
}
function inscriptionComplete_(x) {
  var r = resumeInscription_(x);
  ['naissance', 'adresse', 'pere', 'mere', 'sacrement', 'notes', 'maj_le', 'maj_par'].forEach(function (k) { r[k] = x[k]; });
  r.cotisation = nombre_(x.cotisation);
  r.bapteme = json2_(x.bapteme, {});
  r.manuels = json2_(x.manuels, []);
  r.paiements = json2_(x.paiements, []);
  return r;
}
function trouverInscription_(id) {
  feuilleCate_();
  var x = lignes_('Catechisme').filter(function (y) { return y.id === id; })[0];
  if (!x) throw erreur_('INTROUVABLE', 'Inscription introuvable.');
  return x;
}

function listerCate_(p) {
  feuilleCate_();
  var toutes = lignes_('Catechisme');
  var annees = {};
  toutes.forEach(function (x) { annees[x.annee] = true; });
  cateReglages_().feuilles.forEach(function (f) { annees[f.annee] = true; });
  annees[anneeScolaire_()] = true;
  var liste = Object.keys(annees).sort().reverse();
  var annee = p.annee || (cateReglages_().feuilles.map(function (f) { return f.annee; }).sort().reverse()[0]) || anneeScolaire_();
  var r = cateReglages_();
  return {
    annee: annee, annees: liste, groupes: GROUPES_CATE, modes: MODES_PAIEMENT, cotisation: r.cotisation, ecoles: r.ecoles,
    inscriptions: toutes.filter(function (x) { return x.annee === annee; }).map(resumeInscription_)
      .sort(function (a, b) { return (a.nom + ' ' + a.prenoms).localeCompare(b.nom + ' ' + b.prenoms, 'fr'); })
  };
}
function lireCate_(p) { return inscriptionComplete_(trouverInscription_(p.id)); }

// ─── Analyse des réponses ───

function sansAccents_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

/** Groupe d'après la classe (« CE2 », « 4e », « 1re », « Terminale »…). */
function groupeDe_(classe) {
  var c = sansAccents_(classe).replace(/\s+/g, ' ').trim();
  if (!c) return '';
  if (/maternelle|\bps\b|\bms\b|\bgs\b|petite|moyenne|grande section|\bcp\b/.test(c)) return 'Maternelle-CP';
  if (/ce ?1|ce ?2/.test(c)) return 'CE1-CE2';
  if (/cm ?1|cm ?2/.test(c)) return 'CM1-CM2';
  if (/(^|\D)[65] ?(e|eme|°|ème)?(\D|$)/.test(c) || /sixieme|cinquieme/.test(c)) return '6e-5e';
  if (/(^|\D)[43] ?(e|eme|°)?(\D|$)/.test(c) || /quatrieme|troisieme/.test(c)) return '4e-3e';
  if (/seconde|2nde|2de|premiere|1re|1ere|terminale|tle|lycee|(^|\D)2 ?(e|nde|de)(\D|$)|(^|\D)1 ?(re|ere)(\D|$)/.test(c)) return 'Lycéens';
  return '';
}

/** Types de dossiers demandés dans la réponse « Cette année, je souhaite que mon enfant… ». */
function demandesDe_(texte) {
  var t = sansAccents_(texte);
  if (!t || /^aucun/.test(t.trim())) return [];
  var l = [];
  if (/bapteme|baptise/.test(t)) l.push('bapteme');
  if (/communion/.test(t)) l.push('premiere_communion');
  if (/profession de foi/.test(t)) l.push('profession_foi');
  if (/confirmation|confirme/.test(t)) l.push('confirmation_jeune');
  return l.filter(function (x, i) { return l.indexOf(x) === i; });
}

/** Manuels cochés : « Livre de leçons 6e-5e (17€) - …, Cahier … (8 €) ». */
function manuelsDe_(texte) {
  var t = String(texte || '').trim();
  if (!t) return [];
  return t.split(/,\s+(?=[A-ZÀ-ÝŒ0-9])/).map(function (x) { return x.trim(); }).filter(function (x) {
    return x && !/^(aucun|non|je ne|pas d|deja|déjà)/i.test(x);
  }).map(function (x) {
    var m = x.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/i);
    return { libelle: x, prix: m ? Number(m[1].replace(',', '.')) : 0, remis: false };
  });
}

/** « Heller David » → { nom: 'Heller', prenom: 'David' } (le prénom est le dernier mot). */
function separerNomPrenom_(t) {
  var mots = String(t || '').trim().split(/\s+/).filter(String);
  if (mots.length < 2) return { nom: mots[0] || '', prenom: '' };
  return { prenom: mots.pop(), nom: mots.join(' ') };
}
function dateIso_(t) {
  var m = String(t || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = String(t || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}
function idDrive_(url) { var m = String(url || '').match(/[?&]id=([a-zA-Z0-9_-]{20,})|\/d\/([a-zA-Z0-9_-]{20,})/); return m ? (m[1] || m[2]) : ''; }

/** Transforme une ligne de réponse (objet en-tête → valeur affichée) en inscription. */
function inscriptionDepuisReponse_(rep, annee, feuilleId) {
  var cles = Object.keys(rep);
  var col = function (re, exclure) {
    var k = cles.filter(function (h) { return re.test(sansAccents_(h)) && (!exclure || !exclure.test(sansAccents_(h))); });
    return k.map(function (h) { return String(rep[h] || '').trim(); }).filter(String);
  };
  var premier = function (re, exclure) { return col(re, exclure)[0] || ''; };
  // Questions à branches : la réponse « sacrement » et les manuels peuvent tomber dans des colonnes différentes
  var libres = cles.filter(function (h) { return /souhaite|sacrement|^colonne|manuel|achat/.test(sansAccents_(h)); })
    .map(function (h) { return String(rep[h] || '').trim(); }).filter(String);
  var sacrement = libres.filter(function (v) { return /aucun sacrement|bapteme|communion|profession|confirmation/.test(sansAccents_(v)) && !/€/.test(v); })[0] || '';
  var manuels = libres.filter(function (v) { return /€|euro/i.test(v); }).join(', ');
  var bapOu = premier(/ou votre enfant a-t-il ete baptise|ou .*baptise/);
  return {
    source: feuilleId + ':' + premier(/horodateur/) + ':' + premier(/adresse e-?mail|^e-?mail/) + ':' + premier(/prenom de l.enfant/),
    annee: annee,
    nom: premier(/nom de l.enfant/, /prenom/), prenoms: premier(/prenom de l.enfant/),
    naissance: dateIso_(premier(/naissance/)), classe: premier(/classe|niveau/),
    email: premier(/adresse e-?mail|^e-?mail/).toLowerCase(), telephone: premier(/telephone/), adresse: premier(/adresse complete|adresse des parents|^adresse(?!.*mail)/, /mail/),
    pere: premier(/pere/), mere: premier(/mere|jeune fille/, /pere/),
    sacrement: sacrement,
    bapteme: { ou: bapOu, date: dateIso_(premier(/date du bapteme/)), lieu: premier(/lieu du bapteme/), certificat: premier(/photocopie|joindre|certificat/) },
    manuels: manuelsDe_(manuels)
  };
}

// ─── Création / modification ───

function ecrireInscription_(x) { feuilleCate_(); return ecrireLigne_('Catechisme', x); }

function nouvelleInscription_(v, s) {
  var x = {
    id: uid_(), annee: v.annee || anneeScolaire_(), cree_le: maintenant_(), source: v.source || ('Saisie : ' + s.nom),
    nom: String(v.nom || '').trim(), prenoms: String(v.prenoms || '').trim(), naissance: v.naissance || '', classe: v.classe || '',
    groupe: v.groupe || groupeDe_(v.classe), email: v.email || '', telephone: v.telephone || '', adresse: v.adresse || '',
    pere: v.pere || '', mere: v.mere || '', sacrement: v.sacrement || '', demandes: '[]',
    bapteme: JSON.stringify(v.bapteme || {}), manuels: JSON.stringify(v.manuels || []),
    cotisation: String(v.cotisation !== undefined ? v.cotisation : cateReglages_().cotisation), paiements: '[]', notes: v.notes || '',
    maj_le: maintenant_(), maj_par: s.nom
  };
  if (!x.nom && !x.prenoms) throw erreur_('INVALIDE', 'Nom ou prénom de l\'enfant manquant.');
  return ecrireInscription_(x);
}

/** Informations du dossier de sacrement, reprises de l'inscription. */
function infosDossierDepuis_(x, type) {
  var pere = separerNomPrenom_(x.pere), mere = separerNomPrenom_(x.mere);
  var bap = json2_(x.bapteme, {});
  var aLaParoisse = /paroisse personnelle|croix glorieuse|a la paroisse/.test(sansAccents_(bap.ou)) && !/en dehors/.test(sansAccents_(bap.ou));
  var i = {
    enfant_nom: x.nom, enfant_prenoms: x.prenoms, enfant_naissance_date: x.naissance, classe: x.classe,
    pere_prenom: pere.prenom, pere_nom: pere.nom, mere_prenom: mere.prenom, mere_nom_jeune_fille: mere.nom,
    adresse: x.adresse, telephone: x.telephone, email: x.email,
    bapteme_paroisse: aLaParoisse ? reglages_().paroisse : (bap.lieu || ''), bapteme_date: bap.date || '',
    inscription_catechisme: x.id
  };
  if (type === 'premiere_communion' || type === 'profession_foi') { i.preparation = 'Paroisse'; i.annee_scolaire = x.annee; }
  if (type === 'confirmation_jeune') i.annee_scolaire = x.annee;
  if (type === 'bapteme') { delete i.bapteme_paroisse; delete i.bapteme_date; delete i.classe; i.message = 'Inscrit(e) au catéchisme ' + x.annee + ' (' + (x.classe || '') + ').'; }
  return i;
}

/** Crée le dossier d'une demande et le relie à l'inscription. */
function creerDossierDemande_(x, type, s) {
  var infos = infosDossierDepuis_(x, type);
  var bap = json2_(x.bapteme, {});
  var d = verrou_(function () {
    var etapes = {}, documents = {};
    var premiere = type === 'bapteme' ? 'recue' : 'inscription';
    etapes[premiere] = { fait: true, date: maintenant_(), par: s.nom, libelle: type === 'bapteme' ? 'Demande reçue' : 'Inscription reçue' };
    var nouveau = {
      id: uid_(), type: type, etat: 'ouvert', cree_le: maintenant_(), source: 'Inscription au catéchisme ' + x.annee,
      nom: nomDossier_(type, infos), email: x.email, telephone: x.telephone, date_celebration: '', evenement_id: '', responsable: '',
      donnees: JSON.stringify({ infos: infos, etapes: etapes, documents: documents, rencontres: [], pieces: [], fils: [], historique: [] }),
      maj_le: maintenant_(), maj_par: s.nom
    };
    ajouterHistorique_(nouveau, s.nom, 'Dossier créé depuis l\'inscription au catéchisme');
    return ecrireLigne_('Dossiers', nouveau);
  });
  // Certificat de baptême joint au formulaire : copie dans le dossier Drive
  var idCert = idDrive_(bap.certificat);
  if (idCert && type !== 'bapteme') {
    try {
      var copie = DriveApp.getFileById(idCert).makeCopy(nomFichierDossier_(d, 'Certificat de baptême', (DriveApp.getFileById(idCert).getName().match(/\.([a-z0-9]{1,5})$/i) || [])[1] || ''), dossierDriveDe_(d));
      verrou_(function () {
        var dd = trouverDossier_(d.id);
        enregistrerPiece_(dd, copie, 'Certificat de baptême (joint à l\'inscription)', 'cert_bapteme', s, false);
        dd = trouverDossier_(d.id);
        var don = json2_(dd.donnees, {});
        don.etapes.certificat = { fait: true, date: maintenant_(), par: s.nom, libelle: 'Certificat de baptême reçu' };
        dd.donnees = JSON.stringify(don); ecrireLigne_('Dossiers', dd);
      });
    } catch (e) { console.error('certificat', e); }
  }
  verrou_(function () {
    var y = trouverInscription_(x.id);
    var dem = json2_(y.demandes, []).filter(function (z) { return z.type !== type; });
    dem.push({ type: type, dossier_id: d.id });
    y.demandes = JSON.stringify(dem); y.maj_le = maintenant_(); y.maj_par = s.nom;
    ecrireInscription_(y);
  });
  journaliser_(s, 'Dossier créé (catéchisme)', TYPES_DOSSIER[type].nom + ' – ' + d.nom);
  return d;
}

function creerDemandesAuto_(x, s) {
  var faits = json2_(x.demandes, []).map(function (z) { return z.type; });
  demandesDe_(x.sacrement).forEach(function (type) {
    if (faits.indexOf(type) === -1 && TYPES_DOSSIER[type]) creerDossierDemande_(trouverInscription_(x.id), type, s);
  });
}

function creerCate_(p, s) {
  var x = verrou_(function () { return nouvelleInscription_(p, s); });
  creerDemandesAuto_(x, s);
  journaliser_(s, 'Inscription catéchisme', x.prenoms + ' ' + x.nom + ' (' + x.annee + ')');
  return lireCate_({ id: x.id });
}

var CHAMPS_MODIFIABLES_CATE = ['nom', 'prenoms', 'naissance', 'classe', 'groupe', 'email', 'telephone', 'adresse', 'pere', 'mere', 'sacrement', 'notes', 'cotisation', 'annee'];
function modifierCate_(p, s) {
  verrou_(function () {
    var x = trouverInscription_(p.id);
    CHAMPS_MODIFIABLES_CATE.forEach(function (k) { if (p[k] !== undefined) x[k] = String(p[k]); });
    if (p.classe !== undefined && p.groupe === undefined && !x.groupe) x.groupe = groupeDe_(p.classe);
    if (p.manuels) x.manuels = JSON.stringify(p.manuels.map(function (m) { return { libelle: String(m.libelle || ''), prix: nombre_(m.prix), remis: !!m.remis }; }));
    if (p.bapteme) x.bapteme = JSON.stringify(p.bapteme);
    x.maj_le = maintenant_(); x.maj_par = s.nom;
    ecrireInscription_(x);
  });
  return lireCate_({ id: p.id });
}

function paiementCate_(p, s) {
  verrou_(function () {
    var x = trouverInscription_(p.id);
    var l = json2_(x.paiements, []);
    if (p.ajouter) {
      var montant = nombre_(p.ajouter.montant);
      if (!montant) throw erreur_('INVALIDE', 'Montant manquant.');
      l.push({ id: uid_(), date: p.ajouter.date || aujourdhui_(), montant: montant, mode: String(p.ajouter.mode || ''), par: s.nom });
      journaliser_(s, 'Paiement catéchisme', x.prenoms + ' ' + x.nom + ' : ' + montant + ' € (' + (p.ajouter.mode || '') + ')');
    }
    if (p.retirer) l = l.filter(function (y) { return y.id !== p.retirer; });
    x.paiements = JSON.stringify(l); x.maj_le = maintenant_(); x.maj_par = s.nom;
    ecrireInscription_(x);
  });
  return lireCate_({ id: p.id });
}

function supprimerCate_(p, s) {
  var x = trouverInscription_(p.id);
  feuilleCate_().deleteRow(x._ligne); oublierLignes_();
  journaliser_(s, 'Inscription catéchisme supprimée', x.prenoms + ' ' + x.nom + ' (' + x.annee + ')');
  return true;
}

function dossierCate_(p, s) {
  if (!TYPES_DOSSIER[p.type]) throw erreur_('INVALIDE', 'Type de dossier inconnu.');
  var x = trouverInscription_(p.id);
  if (json2_(x.demandes, []).some(function (z) { return z.type === p.type; })) throw erreur_('INVALIDE', 'Ce dossier existe déjà.');
  var d = creerDossierDemande_(x, p.type, s);
  return { inscription: lireCate_({ id: p.id }), dossier_id: d.id };
}

// ─── Import depuis le formulaire Google ───

/** Point d'entrée du déclencheur (toutes les 15 minutes) et du bouton « Importer ». */
function importerCatechisme() { return importerCate_({}, { nom: 'Formulaire catéchisme', uid: '' }); }

function importerCate_(p, s) {
  var r = cateReglages_();
  feuilleCate_();
  var deja = {};
  lignes_('Catechisme').forEach(function (x) { deja[x.source] = true; });
  var nouvelles = [], erreurs = [];
  r.feuilles.forEach(function (f) {
    var ss;
    try { ss = SpreadsheetApp.openById(f.id); } catch (e) { erreurs.push('Feuille ' + f.annee + ' introuvable'); return; }
    var feuille = ss.getSheets()[0];   // « Réponses au formulaire 1 »
    var v = feuille.getDataRange().getDisplayValues();
    var entetes = v.shift();
    v.forEach(function (ligne) {
      if (!ligne.join('').trim()) return;
      var rep = {};
      entetes.forEach(function (h, j) { rep[h + (rep[h] !== undefined ? ' ' + j : '')] = ligne[j]; });
      var ins = inscriptionDepuisReponse_(rep, f.annee, f.id);
      if (!ins.nom && !ins.prenoms) return;
      if (deja[ins.source]) return;
      deja[ins.source] = true;
      try {
        var x = verrou_(function () { return nouvelleInscription_(ins, s); });
        nouvelles.push(x);
      } catch (e) { erreurs.push((ins.prenoms + ' ' + ins.nom) + ' : ' + e.message); }
    });
  });
  nouvelles.forEach(function (x) { try { creerDemandesAuto_(x, s); } catch (e) { erreurs.push(x.prenoms + ' ' + x.nom + ' (dossier) : ' + e.message); } });
  // paiement en ligne actif : livres choisis → commande ; mail aux parents avec les liens de paiement
  if (nouvelles.length && haActif_()) {
    var familles = {};
    nouvelles.forEach(function (x) { var e = String(x.email || '').toLowerCase().split(/[\s,;]+/)[0]; if (/@/.test(e)) (familles[e] = familles[e] || []).push(x); });
    Object.keys(familles).forEach(function (e) {
      try {
        var cmd = verrou_(function () { return commandeDepuisInscriptions_(e, familles[e]); });
        mailPaiementCate_(e, familles[e], cmd);
      } catch (err) { erreurs.push('Mail de paiement ' + e + ' : ' + err.message); }
    });
  }
  if (nouvelles.length) {
    journaliser_(s, 'Inscriptions catéchisme importées', String(nouvelles.length));
    var texte = nouvelles.length === 1 ? nouvelles[0].prenoms + ' ' + nouvelles[0].nom + ' (' + (nouvelles[0].classe || '') + ')' : nouvelles.length + ' nouvelles inscriptions';
    lignes_('Utilisateurs').filter(estActif_).forEach(function (u) {
      if (u.id !== s.uid) notifier_(u.id, 'Catéchisme : inscription reçue', texte, '#/catechisme');
    });
  }
  return { nouvelles: nouvelles.length, erreurs: erreurs };
}

// ─── Mails aux parents ───

/**
 * p.ids : inscriptions visées. p.individuel : un mail par famille, avec {enfants} et {reste} remplis
 * (relance des impayés) ; sinon un seul mail en copie cachée.
 */
function envoyerCate_(p, s) {
  feuilleCate_();
  var ids = p.ids || [];
  var xs = lignes_('Catechisme').filter(function (x) { return ids.indexOf(x.id) > -1 && x.email; });
  var familles = {};
  xs.forEach(function (x) {
    var e = String(x.email).toLowerCase().trim();
    (familles[e] = familles[e] || []).push(x);
  });
  var emails = Object.keys(familles);
  if (!emails.length) throw erreur_('INVALIDE', 'Aucune adresse e-mail parmi les inscriptions choisies.');
  var quota = MailApp.getRemainingDailyQuota();
  if (emails.length + 1 > quota) throw erreur_('QUOTA', 'Quota Gmail insuffisant aujourd\'hui : ' + quota + ' destinataires restants.');
  if (p.essai) return { nb: emails.length, quota: quota };
  var opts = optionsEnvoi_();
  if (p.individuel) {
    emails.forEach(function (e) {
      var enfants = familles[e];
      var reste = enfants.reduce(function (a, x) { return a + resumeInscription_(x).reste; }, 0);
      var ctx = {
        enfants: enfants.map(function (x) { return x.prenoms; }).join(' et '),
        reste: (Math.round(reste * 100) / 100).toLocaleString('fr-FR') + ' €',
        detail: enfants.map(function (x) { var r = resumeInscription_(x); return '- ' + x.prenoms + ' : ' + r.reste + ' € restant (sur ' + r.du + ' €)'; }).join('\n')
      };
      var corps = remplirModeleServeur_(p.corps, ctx), sujet = remplirModeleServeur_(p.sujet, ctx);
      var boutons = /\[Bouton : Payer en ligne\]/.test(corps) && haActif_() ? [{ texte: 'Payer en ligne', url: lienPaiementCate_(e) }] : [];
      if (!boutons.length) corps = corps.replace(/\n?\[Bouton : Payer en ligne\]\n?/, '\n');
      var o = { name: opts.name, from: opts.from, htmlBody: corpsHtml_(corps, p.signature, boutons) };
      GmailApp.sendEmail(e, sujet, corpsTexte_(corps, p.signature, boutons), o);
    });
  } else {
    for (var i = 0; i < emails.length; i += 90) {
      var o = { name: opts.name, from: opts.from, htmlBody: corpsHtml_(p.corps, p.signature), bcc: emails.slice(i, i + 90).join(',') };
      GmailApp.sendEmail(CONFIG.ALIAS, p.sujet || '', corpsTexte_(p.corps, p.signature), o);
    }
  }
  journaliser_(s, p.individuel ? 'Catéchisme : relance' : 'Catéchisme : mail aux parents', (p.sujet || '') + ' → ' + emails.length + ' familles');
  return { nb: emails.length };
}

/** Mail aux parents après l'inscription : cotisation (et livres) à payer en ligne, ou au secrétariat. */
function mailPaiementCate_(email, enfants, commande) {
  var du = enfants.reduce(function (a, x) { return a + resumeInscription_(x).du; }, 0);
  var euro = function (v) { return (Math.round(v * 100) / 100).toLocaleString('fr-FR') + ' €'; };
  var boutons = [], t = 'Bonjour,\n\nNous avons bien reçu l\'inscription de ' + enfants.map(function (x) { return x.prenoms; }).join(' et ') + ' au catéchisme (' + enfants[0].annee + ').';
  if (du > 0) { t += '\n\nCotisation : ' + euro(du) + '\n[Bouton : Payer la cotisation en ligne]'; boutons.push({ texte: 'Payer la cotisation en ligne', url: lienPaiementCate_(email) }); }
  if (commande) {
    t += '\n\nLivres commandés :\n' + json2_(commande.lignes, []).map(function (l) { return '- ' + l.titre + (l.pour ? ' (' + l.pour + ')' : '') + ' : ' + euro(l.prix * l.qte); }).join('\n') +
      '\nTotal des livres : ' + euro(nombre_(commande.total)) + '\n[Bouton : Payer les livres en ligne]';
    boutons.push({ texte: 'Payer les livres en ligne', url: urlPaiement_({ o: 'livres', c: commande.jeton }) });
  }
  t += '\n\n' + (haReglages_().hors_ligne || 'Vous pouvez aussi régler par chèque ou en espèces au secrétariat.') +
    '\n\nD\'autres livres sont disponibles dans notre boutique :\n[Bouton : Voir les livres]\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
  boutons.push({ texte: 'Voir les livres', url: lienBoutique_(email) });
  if (du <= 0 && !commande) return;
  var opts = optionsEnvoi_();
  GmailApp.sendEmail(email, 'Inscription au catéchisme – paiement', corpsTexte_(t, 'paroisse', boutons), { name: opts.name, from: opts.from, htmlBody: corpsHtml_(t, 'paroisse', boutons) });
}
