/**
 * Dossiers de sacrements (baptême, mariage, obsèques, catéchumène, confirmand)
 * et réception des formulaires publics du site.
 *
 * Le détail des étapes, champs et documents de chaque type est défini dans
 * l'appli (fichier app/src/types.js) ; le serveur stocke le dossier tel quel.
 */

var TYPES_DOSSIER = {
  bapteme: { nom: 'Baptême', dossier: 'Baptêmes', public: true },
  mariage: { nom: 'Mariage', dossier: 'Mariages', public: true },
  obseques: { nom: 'Obsèques', dossier: 'Obsèques', public: false },
  catechumene: { nom: 'Catéchumène adulte', dossier: 'Catéchumènes', public: true, sansAgenda: true },  // seulement l'année des sacrements, aucun lien avec l'agenda
  confirmand: { nom: 'Confirmand adulte', dossier: 'Confirmands', public: true },
  premiere_communion: { nom: 'Première communion', dossier: 'Premières communions', public: true, collectif: true },
  profession_foi: { nom: 'Profession de foi', dossier: 'Professions de foi', public: true, collectif: true },
  confirmation_jeune: { nom: 'Confirmation (jeunes)', dossier: 'Confirmations jeunes', public: false, collectif: true }
};

// Lieux de préparation (premières communions, professions de foi)
var PREPARATIONS = ['Paroisse', 'Herrade de Landsberg', 'Saints Louis et Zélie Martin', 'Autre école'];

/** Année scolaire en cours (septembre → août), ex. « 2026-2027 ». */
function anneeScolaire_(date) {
  var d = date ? new Date(date) : new Date();
  var a = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return a + '-' + (a + 1);
}

var CHAMPS_ENFANT_ = ['enfant_nom', 'enfant_prenoms', 'enfant_naissance_date', 'enfant_naissance_lieu', 'classe',
  'pere_prenom', 'pere_nom', 'mere_prenom', 'mere_nom_jeune_fille', 'adresse', 'telephone', 'email',
  'bapteme_ou', 'bapteme_paroisse', 'bapteme_date', 'preparation', 'ecole_autre', 'message'];

// Première communion, profession de foi : copie de l'acte de baptême obligatoire, sauf baptême à la paroisse
var BAPTISE_A_LA_PAROISSE = 'À la paroisse La Croix glorieuse';
var CERTIFICAT_MAX = 10 * 1024 * 1024;

// Champs acceptés depuis les formulaires du site (et champs obligatoires)
var CHAMPS_PUBLICS = {
  bapteme: { tous: ['enfant_nom', 'enfant_prenoms', 'sexe', 'enfant_naissance_date', 'enfant_naissance_lieu',
                    'pere_prenom', 'pere_nom', 'mere_prenom', 'mere_nom_jeune_fille', 'adresse',
                    'telephone', 'email', 'parrain_nom', 'marraine_nom', 'date_souhaitee', 'message'],
             requis: ['enfant_nom', 'enfant_prenoms', 'enfant_naissance_date', 'telephone', 'email'] },
  mariage: { tous: ['fiancee_nom', 'fiancee_prenoms', 'fiance_nom', 'fiance_prenoms', 'telephone', 'email', 'date_souhaitee', 'message'],
             requis: ['fiancee_nom', 'fiancee_prenoms', 'fiance_nom', 'fiance_prenoms', 'telephone', 'email'] },
  catechumene: { tous: ['nom', 'prenoms', 'telephone', 'email', 'message'], requis: ['nom', 'prenoms', 'telephone', 'email'] },
  confirmand: { tous: ['nom', 'prenoms', 'telephone', 'email', 'message'], requis: ['nom', 'prenoms', 'telephone', 'email'] },
  premiere_communion: { tous: CHAMPS_ENFANT_, requis: ['enfant_nom', 'enfant_prenoms', 'enfant_naissance_date', 'telephone', 'email', 'preparation'] },
  profession_foi: { tous: CHAMPS_ENFANT_, requis: ['enfant_nom', 'enfant_prenoms', 'enfant_naissance_date', 'telephone', 'email', 'preparation'] }
};

function nomDossier_(type, i) {
  i = i || {};
  var np = function (prenoms, nom) { return [prenoms, String(nom || '').toUpperCase()].filter(String).join(' '); };
  if (type === 'bapteme' || type === 'premiere_communion' || type === 'profession_foi' || type === 'confirmation_jeune') return np(i.enfant_prenoms, i.enfant_nom);
  if (type === 'mariage') return [np(i.fiancee_prenoms, i.fiancee_nom), np(i.fiance_prenoms, i.fiance_nom)].filter(String).join(' & ');
  if (type === 'obseques') return np(i.defunt_prenoms, i.defunt_nom);
  return np(i.prenoms, i.nom);
}

function etapesFaites_(d) {
  var e = json2_(d.donnees, {}).etapes || {};
  return Object.keys(e).filter(function (k) { return e[k] && e[k].fait; }).length;
}

function dossierResume_(d) {
  var don = json2_(d.donnees, {});
  var etapes = don.etapes || {};
  var docs = don.documents || {};
  return {
    id: d.id, type: d.type, etat: d.etat, nom: d.nom, email: d.email, telephone: d.telephone,
    date_celebration: d.date_celebration, responsable: d.responsable, cree_le: d.cree_le, maj_le: d.maj_le, source: d.source,
    etapes: Object.keys(etapes).filter(function (k) { return etapes[k] && etapes[k].fait; }),
    documents: Object.keys(docs).filter(function (k) { return docs[k] && docs[k].recu; }),
    date_souhaitee: (don.infos || {}).date_souhaitee || '',
    annee: (don.infos || {}).annee_sacrements || (don.infos || {}).annee_scolaire || '',
    autre_confession: (don.infos || {}).autre_confession || '',
    alertes: alertesDossier_(d.type, don.infos || {}),
    liste: d.type === 'catechumene' ? { prenom_bapteme: (don.infos || {}).prenom_bapteme || '', parrain: (don.infos || {}).parrain_marraine || '', accompagnateur: (don.infos || {}).accompagnateurs || '' } : undefined,
    preparation: (don.infos || {}).preparation === 'Autre école' ? ((don.infos || {}).ecole_autre || 'Autre école') : ((don.infos || {}).preparation || '')
  };
}

/** Signalements affichés dans la liste et le dossier. */
function alertesDossier_(type, i) {
  var a = [];
  if (['confirmand', 'confirmation_jeune', 'catechumene'].indexOf(type) === -1) return a;
  if (i.bapteme_inconnu === 'oui' && !i.bapteme_date && !i.bapteme_paroisse) a.push('bapteme_a_trouver');
  if (i.autre_confession === 'oui') a.push('autre_confession');
  if (type === 'catechumene' && i.en_attente === 'oui' && !i.annee_sacrements) a.push('en_attente');
  var n = i.naissance_date || i.enfant_naissance_date;
  if (type === 'confirmand' && n) {
    var age = (new Date() - new Date(n + 'T12:00:00')) / (365.25 * 86400000);
    if (age < 18) a.push('mineur');
  }
  return a;
}

function trouverDossier_(id) {
  var d = lignes_('Dossiers').filter(function (x) { return x.id === id; })[0];
  if (!d) throw erreur_('INTROUVABLE', 'Dossier introuvable.');
  return d;
}

function listerDossiers_(p) {
  var ds = lignes_('Dossiers');
  if (p.type) ds = ds.filter(function (x) { return x.type === p.type; });
  if (p.etat) ds = ds.filter(function (x) { return x.etat === p.etat; });
  var frat = {};
  if (ds.some(function (x) { return TYPES_LIES_COR.indexOf(x.type) > -1; })) { try { frat = fraternitesDesDossiers_(); } catch (e) { frat = {}; } }
  return ds.sort(function (a, b) { return String(b.maj_le).localeCompare(String(a.maj_le)); }).map(function (d) {
    var r = dossierResume_(d);
    if (frat[d.id]) r.fraternite = frat[d.id];
    return r;
  });
}

function dossierComplet_(d) {
  var res = dossierResume_(d);
  var don = json2_(d.donnees, {});
  res.evenement_id = d.evenement_id;
  res.infos = don.infos || {};
  res.etapes = don.etapes || {};
  res.documents = don.documents || {};
  res.rencontres = don.rencontres || [];
  res.pieces = don.pieces || [];
  res.historique = (don.historique || []).slice().reverse();
  try { res.fraternite = fraterniteDuDossier_(d); } catch (e) { res.fraternite = null; }
  res.fils = (don.fils || []).slice(-30).map(function (id) {
    try {
      var t = GmailApp.getThreadById(id);
      return t ? { id: id, sujet: t.getFirstMessageSubject(), date: t.getLastMessageDate().toISOString(), nb: t.getMessageCount() } : null;
    } catch (e) { return null; }
  }).filter(function (x) { return x; }).reverse();
  return res;
}

function lireDossier_(p, s) {
  var d = trouverDossier_(p.id);
  // Si l'événement a été déplacé directement dans Google Agenda, on reprend sa date.
  var dateAgenda = TYPES_DOSSIER[d.type].sansAgenda ? null : dateEvenementDossier_(d);
  if (dateAgenda !== null && dateAgenda !== d.date_celebration) {
    verrou_(function () {
      d = trouverDossier_(p.id);
      d.date_celebration = dateAgenda;
      if (!dateAgenda) d.evenement_id = '';
      ajouterHistorique_(d, 'système', dateAgenda ? 'Date reprise de l\'agenda' : 'Événement supprimé de l\'agenda');
      ecrireLigne_('Dossiers', d);
    });
  }
  return dossierComplet_(d);
}

function ajouterHistorique_(d, par, texte) {
  var don = json2_(d.donnees, {});
  don.historique = (don.historique || []).concat([{ date: maintenant_(), par: par, texte: texte }]).slice(-200);
  d.donnees = JSON.stringify(don);
}

function creerDossier_(p, s) {
  if (!TYPES_DOSSIER[p.type]) throw erreur_('INVALIDE', 'Type de dossier inconnu.');
  var infos = p.infos || {};
  if (TYPES_DOSSIER[p.type].collectif && !infos.annee_scolaire) infos.annee_scolaire = anneeScolaire_();
  var d = verrou_(function () {
    var nouveau = {
      id: uid_(), type: p.type, etat: 'ouvert', cree_le: maintenant_(), source: p.source || 'Saisie : ' + s.nom,
      nom: nomDossier_(p.type, infos) || p.nom || '(sans nom)', email: infos.email || p.email || '', telephone: infos.telephone || p.telephone || '',
      date_celebration: '', evenement_id: '', responsable: p.responsable || '',
      donnees: JSON.stringify({ infos: infos, etapes: {}, documents: {}, rencontres: [], pieces: [], fils: p.filId ? [p.filId] : [], historique: [] }),
      maj_le: maintenant_(), maj_par: s.nom
    };
    ajouterHistorique_(nouveau, s.nom, 'Dossier créé' + (p.filId ? ' depuis un mail' : ''));
    return ecrireLigne_('Dossiers', nouveau);
  });
  if (p.filId) modifierSuiviMail_({ filId: p.filId, dossier_id: d.id }, s);
  if (d.responsable && d.responsable !== s.uid) {
    notifier_(d.responsable, 'Dossier confié par ' + s.nom, TYPES_DOSSIER[d.type].nom + ' – ' + d.nom, '#/dossiers/' + d.id);
  }
  journaliser_(s, 'Dossier créé', TYPES_DOSSIER[d.type].nom + ' – ' + d.nom);
  return dossierComplet_(d);
}

function modifierDossier_(p, s) {
  var notif = null;
  var d = verrou_(function () {
    var d = trouverDossier_(p.id);
    var don = json2_(d.donnees, {});
    var avant = { date: d.date_celebration, lieu: (don.infos || {}).lieu_celebration, etat: d.etat, resp: d.responsable };
    var etapesAvant = don.etapes || {};

    ['infos', 'etapes', 'documents', 'rencontres'].forEach(function (k) { if (p[k] !== undefined) don[k] = p[k]; });
    if (p.etat !== undefined) {
      if (['ouvert', 'clos', 'annule'].indexOf(p.etat) === -1) throw erreur_('INVALIDE', 'État inconnu.');
      d.etat = p.etat;
    }
    if (p.responsable !== undefined) d.responsable = p.responsable;
    if (p.date_celebration !== undefined) d.date_celebration = p.date_celebration;
    d.nom = nomDossier_(d.type, don.infos) || d.nom;
    d.email = (don.infos || {}).email || d.email;
    d.telephone = (don.infos || {}).telephone || d.telephone;

    // Historique : étapes nouvellement franchies
    Object.keys(don.etapes || {}).forEach(function (k) {
      var e = don.etapes[k];
      if (e && e.fait && !(etapesAvant[k] && etapesAvant[k].fait)) don.historique = (don.historique || []).concat([{ date: maintenant_(), par: s.nom, texte: 'Étape : ' + (e.libelle || k) }]);
    });
    d.donnees = JSON.stringify(don);
    if (d.etat !== avant.etat) ajouterHistorique_(d, s.nom, 'Dossier ' + { ouvert: 'rouvert', clos: 'clos', annule: 'annulé' }[d.etat]);
    if (d.responsable !== avant.resp) {
      ajouterHistorique_(d, s.nom, 'Responsable modifié');
      if (d.responsable && d.responsable !== s.uid) notif = d.responsable;
    }

    // Agenda public
    var lieu = (don.infos || {}).lieu_celebration;
    if (!TYPES_DOSSIER[d.type].collectif && !TYPES_DOSSIER[d.type].sansAgenda && (d.date_celebration !== avant.date || lieu !== avant.lieu || d.etat !== avant.etat)) {
      try {
        d.evenement_id = synchroniserEvenementDossier_(d);
        if (d.date_celebration !== avant.date) ajouterHistorique_(d, s.nom, d.date_celebration ? 'Date de célébration fixée (agenda public mis à jour)' : 'Date de célébration retirée');
      } catch (e) { console.error('agenda', e); }
    }
    d.maj_le = maintenant_(); d.maj_par = s.nom;
    return ecrireLigne_('Dossiers', d);
  });
  if (notif) notifier_(notif, 'Dossier confié par ' + s.nom, TYPES_DOSSIER[d.type].nom + ' – ' + d.nom, '#/dossiers/' + d.id);
  journaliser_(s, 'Dossier modifié', TYPES_DOSSIER[d.type].nom + ' – ' + d.nom);
  return dossierComplet_(d);
}

/** Suppression complète : ligne, événement de l'agenda public, pièces du Drive (corbeille), liens avec les mails et extraits. */
function supprimerDossier_(p, s) {
  var d = verrou_(function () {
    var d = trouverDossier_(p.id);
    var don = json2_(d.donnees, {});
    if (d.evenement_id) { try { var ev = calendrier_().getEventById(d.evenement_id); if (ev) ev.deleteEvent(); } catch (e) {} }
    (don.pieces || []).forEach(function (x) { try { DriveApp.getFileById(x.id).setTrashed(true); } catch (e) {} });
    lignes_('SuiviMails').forEach(function (x) { if (x.dossier_id === d.id) { x.dossier_id = ''; ecrireLigne_('SuiviMails', x); } });
    try {
      var fx = db_().getSheetByName('Extraits');
      if (fx) lignes_('Extraits').forEach(function (x) { if (x.dossier_id === d.id) { x.dossier_id = ''; ecrireLigne_('Extraits', x); } });
    } catch (e) {}
    // Inscription au catéchisme reliée : on retire le lien
    try {
      var idIns = (don.infos || {}).inscription_catechisme;
      if (idIns && db_().getSheetByName('Catechisme')) lignes_('Catechisme').forEach(function (x) {
        if (x.id !== idIns) return;
        x.demandes = JSON.stringify(json2_(x.demandes, []).filter(function (z) { return z.dossier_id !== d.id; }));
        ecrireLigne_('Catechisme', x);
      });
    } catch (e) {}
    feuille_('Dossiers').deleteRow(d._ligne);
    return d;
  });
  journaliser_(s, 'Dossier supprimé', TYPES_DOSSIER[d.type].nom + ' – ' + d.nom);
  return true;
}

/** B6 signé (prêtre/diacre + catéchumène) : PDF archivé dans le dossier, étape « Entrée en catéchuménat » cochée. */
function signerB6_(p, s) {
  if (!p.pdf) throw erreur_('INVALIDE', 'Document manquant.');
  var d = verrou_(function () {
    var d = trouverDossier_(p.dossierId);
    if (d.type !== 'catechumene') throw erreur_('INVALIDE', 'Le B6 ne concerne que les catéchumènes.');
    var f = dossierDriveDe_(d).createFile(Utilities.newBlob(Utilities.base64Decode(p.pdf), 'application/pdf', nomFichierDossier_(d, 'B6 – entrée en catéchuménat (signé)', 'pdf')));
    enregistrerPiece_(d, f, 'B6 – entrée en catéchuménat (signé)', '', s, true);
    d = trouverDossier_(p.dossierId);
    var don = json2_(d.donnees, {});
    don.infos = don.infos || {};
    don.infos.b6_signe_le = maintenant_();
    don.infos.b6_signe_par = s.nom;
    don.infos.b6_pdf_id = f.getId();
    if (!don.infos.entree_ministre) don.infos.entree_ministre = p.ministre || s.nom;
    if (!don.infos.entree_date) don.infos.entree_date = maintenant_().slice(0, 10);
    don.etapes = don.etapes || {};
    if (!(don.etapes.entree && don.etapes.entree.fait)) {
      don.etapes.entree = { fait: true, date: maintenant_(), par: s.nom, libelle: 'Entrée en catéchuménat' };
      don.historique = (don.historique || []).concat([{ date: maintenant_(), par: s.nom, texte: 'Étape : Entrée en catéchuménat (B6 signé)' }]);
    }
    d.donnees = JSON.stringify(don);
    d.maj_le = maintenant_(); d.maj_par = s.nom;
    return ecrireLigne_('Dossiers', d);
  });
  journaliser_(s, 'B6 signé', d.nom);
  return dossierComplet_(d);
}

function majDateDossierDepuisAgenda_(id, iso, lieu, s) {
  verrou_(function () {
    var d = trouverDossier_(id);
    if (TYPES_DOSSIER[d.type].sansAgenda) return;
    d.date_celebration = iso;
    if (!iso) d.evenement_id = '';
    var don = json2_(d.donnees, {});
    if (lieu !== null && lieu !== undefined) { don.infos = don.infos || {}; don.infos.lieu_celebration = lieu; d.donnees = JSON.stringify(don); }
    ajouterHistorique_(d, s.nom, iso ? 'Date modifiée depuis l\'agenda' : 'Événement supprimé de l\'agenda');
    d.maj_le = maintenant_(); d.maj_par = s.nom;
    ecrireLigne_('Dossiers', d);
  });
}

function lierFilAuDossier_(dossierId, filId, s, texte) {
  verrou_(function () {
    var d = trouverDossier_(dossierId);
    var don = json2_(d.donnees, {});
    don.fils = don.fils || [];
    if (don.fils.indexOf(filId) === -1) don.fils.push(filId);
    d.donnees = JSON.stringify(don);
    ajouterHistorique_(d, s.nom, texte);
    d.maj_le = maintenant_(); d.maj_par = s.nom;
    ecrireLigne_('Dossiers', d);
  });
  try { modifierSuiviMail_({ filId: filId, dossier_id: dossierId }, s); } catch (e) {}
}

/** Dossier Drive Dossiers/<Type>/<Année> du dossier (créé si besoin). */
function dossierDriveDe_(d) {
  var annee = String(d.cree_le).slice(0, 4);
  return sousDossier_(sousDossier_(sousDossier_(racine_(), 'Dossiers'), TYPES_DOSSIER[d.type].dossier), annee);
}

function nomFichierDossier_(d, libelle, ext) {
  var propre = function (t) { return String(t).replace(/[\\/:*?"<>|]/g, '-').trim(); };
  return maintenant_().slice(0, 10) + ' ' + propre(d.nom) + ' – ' + propre(libelle) + (ext ? '.' + ext : '');
}

function enregistrerPiece_(d, fichier, libelle, doc, s, genere) {
  var don = json2_(d.donnees, {});
  don.pieces = (don.pieces || []).concat([{ id: fichier.getId(), nom: fichier.getName(), libelle: libelle, doc: doc || '', date: maintenant_(), par: s.nom, genere: !!genere }]);
  if (doc) { don.documents = don.documents || {}; don.documents[doc] = { recu: true, date: maintenant_() }; }
  d.donnees = JSON.stringify(don);
  ajouterHistorique_(d, s.nom, (genere ? 'Document généré : ' : 'Pièce ajoutée : ') + libelle);
  d.maj_le = maintenant_(); d.maj_par = s.nom;
  ecrireLigne_('Dossiers', d);
}

function deposerPieceDossier_(p, s) {
  return verrou_(function () {
    var d = trouverDossier_(p.dossierId);
    var ext = (String(p.nom).match(/\.([a-z0-9]{1,5})$/i) || [])[1] || '';
    var nom = nomFichierDossier_(d, p.libelle || p.nom.replace(/\.[^.]+$/, ''), ext);
    var f = dossierDriveDe_(d).createFile(Utilities.newBlob(Utilities.base64Decode(p.base64), p.type || 'application/octet-stream', nom));
    enregistrerPiece_(d, f, p.libelle || p.nom, p.doc, s, false);
    return dossierComplet_(d);
  });
}

/** Archive un document généré (B14, B6, extrait…) en PDF dans le dossier Drive. */
function archiverDocumentDossier_(p, s) {
  return verrou_(function () {
    var d = trouverDossier_(p.dossierId);
    var pdf;
    if (p.pdf) {
      // PDF fabriqué par l'appli (rendu fidèle du formulaire)
      pdf = Utilities.newBlob(Utilities.base64Decode(p.pdf), 'application/pdf', nomFichierDossier_(d, p.libelle, 'pdf'));
    } else {
      var html = String(p.html || '');
      if (html.indexOf('<html') === -1) html = '<html><head><meta charset="utf-8"></head><body>' + html + '</body></html>';
      pdf = Utilities.newBlob(html, 'text/html', 'doc.html').getAs('application/pdf').setName(nomFichierDossier_(d, p.libelle, 'pdf'));
    }
    var f = dossierDriveDe_(d).createFile(pdf);
    enregistrerPiece_(d, f, p.libelle, '', s, true);
    return dossierComplet_(d);
  });
}

// ─────────────────────────────── FORMULAIRES PUBLICS ─────────────────────────

function recevoirDemandePublique_(p) {
  var conf = CHAMPS_PUBLICS[p.type];
  if (!conf) throw erreur_('INVALIDE', 'Formulaire inconnu.');
  if (p.site_web) return { recu: true };                // pot de miel anti-robots : on ignore sans le dire
  if (!p.consentement) throw erreur_('INVALIDE', 'Merci d\'accepter l\'utilisation de vos données.');
  // Limite : 20 demandes par heure au total
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('public_n') || 0);
  if (n >= 20) throw erreur_('LIMITE', 'Trop de demandes en ce moment. Merci de réessayer plus tard ou d\'écrire à ' + CONFIG.ALIAS + '.');
  cache.put('public_n', String(n + 1), 3600);

  var infos = {};
  conf.tous.forEach(function (k) {
    var v = p.champs && p.champs[k];
    if (v !== undefined && v !== null) infos[k] = String(v).slice(0, k === 'message' ? 3000 : 300).trim();
  });
  conf.requis.forEach(function (k) { if (!infos[k]) throw erreur_('INVALIDE', 'Champ obligatoire manquant.'); });
  if (['bapteme', 'premiere_communion', 'profession_foi'].indexOf(p.type) > -1 && !(infos.pere_nom || infos.mere_nom_jeune_fille)) throw erreur_('INVALIDE', 'Merci d\'indiquer au moins un des parents.');
  if (infos.sexe && ['Garçon', 'Fille'].indexOf(infos.sexe) === -1) delete infos.sexe;
  if (infos.preparation && PREPARATIONS.indexOf(infos.preparation) === -1) throw erreur_('INVALIDE', 'Lieu de préparation inconnu.');
  if (p.type === 'profession_foi' && infos.preparation === 'Herrade de Landsberg') throw erreur_('INVALIDE', 'La profession de foi se prépare en 3e : Herrade de Landsberg n\'est pas proposée.');
  if (infos.preparation === 'Autre école' && !infos.ecole_autre) throw erreur_('INVALIDE', 'Merci de préciser le nom de l\'école.');
  if (TYPES_DOSSIER[p.type].collectif) infos.annee_scolaire = anneeScolaire_();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(infos.email || '')) throw erreur_('INVALIDE', 'Adresse e-mail invalide.');
  var certificat = null;
  if (p.type === 'premiere_communion' || p.type === 'profession_foi') {
    if (infos.bapteme_ou && infos.bapteme_ou !== BAPTISE_A_LA_PAROISSE && infos.bapteme_ou !== 'Dans une autre paroisse') delete infos.bapteme_ou;
    var aLaParoisse = infos.bapteme_ou === BAPTISE_A_LA_PAROISSE;
    if (aLaParoisse && !infos.bapteme_paroisse) infos.bapteme_paroisse = reglages_().paroisse;
    if (p.fichier && p.fichier.base64 && !aLaParoisse) {
      var octets = Utilities.base64Decode(String(p.fichier.base64));
      if (octets.length > CERTIFICAT_MAX) throw erreur_('INVALIDE', 'Le fichier est trop lourd (10 Mo maximum).');
      var nomF = String(p.fichier.nom || 'certificat').slice(0, 120);
      var ext = ((nomF.match(/\.([a-z0-9]{2,5})$/i) || [])[1] || '').toLowerCase();
      var typeF = String(p.fichier.type || '').toLowerCase();
      if (!/^(application\/pdf|image\/)/.test(typeF) && ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'].indexOf(ext) === -1) throw erreur_('INVALIDE', 'Merci de joindre un PDF ou une photo.');
      certificat = { octets: octets, type: typeF || 'application/octet-stream', ext: ext };
    }
    if (!aLaParoisse && !certificat) throw erreur_('INVALIDE', 'Merci de joindre une copie de l\'acte de baptême (sauf si l\'enfant a été baptisé à la paroisse La Croix glorieuse).');
  }

  var d = verrou_(function () {
    var nouveau = {
      id: uid_(), type: p.type, etat: 'ouvert', cree_le: maintenant_(), source: 'Formulaire du site',
      nom: nomDossier_(p.type, infos), email: infos.email, telephone: infos.telephone || '',
      date_celebration: '', evenement_id: '', responsable: '',
      donnees: JSON.stringify({ infos: infos, etapes: {}, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] }),
      maj_le: maintenant_(), maj_par: 'Formulaire'
    };
    ajouterHistorique_(nouveau, 'Formulaire du site', 'Demande reçue');
    return ecrireLigne_('Dossiers', nouveau);
  });
  if (certificat) {
    try {
      var systeme = { nom: 'Formulaire', uid: '' };
      var f = dossierDriveDe_(d).createFile(Utilities.newBlob(certificat.octets, certificat.type, nomFichierDossier_(d, 'Acte de baptême', certificat.ext)));
      verrou_(function () {
        var dd = trouverDossier_(d.id);
        enregistrerPiece_(dd, f, 'Copie de l\'acte de baptême (jointe au formulaire)', 'cert_bapteme', systeme, false);
        dd = trouverDossier_(d.id);
        var don = json2_(dd.donnees, {});
        don.etapes = don.etapes || {};
        don.etapes.certificat = { fait: true, date: maintenant_(), par: 'Formulaire', libelle: 'Certificat de baptême reçu' };
        dd.donnees = JSON.stringify(don);
        ecrireLigne_('Dossiers', dd);
      });
    } catch (e) { console.error('certificat formulaire', e); }
  }
  journaliser_(null, 'Demande reçue (site)', TYPES_DOSSIER[d.type].nom + ' – ' + d.nom);
  lignes_('Utilisateurs').filter(estActif_).forEach(function (u) {
    notifier_(u.id, 'Nouvelle demande : ' + TYPES_DOSSIER[d.type].nom, d.nom, '#/dossiers/' + d.id);
  });
  return { recu: true };
}

// ─────────────────────────────── CÉLÉBRATIONS COLLECTIVES ────────────────────
// Premières communions et professions de foi : une date par année scolaire,
// un seul événement public (« Premières communions », « Professions de foi »).

var TITRES_COLLECTIFS = { premiere_communion: 'Premières communions', profession_foi: 'Professions de foi', confirmation_jeune: 'Confirmations' };

/** Pour les formulaires (sans connexion) : date de la célébration de l'année et prise de rendez-vous avec le curé. */
function infosPubliques_(p) {
  if (p.type !== 'premiere_communion' && p.type !== 'profession_foi') throw erreur_('INVALIDE', 'Formulaire inconnu.');
  var annee = anneeScolaire_();
  var promo = promotions_()[p.type + '|' + annee] || {};
  var r = reglages_();
  return {
    annee: annee, date: promo.date || '', lieu: promo.lieu || '',
    rdv: p.type === 'premiere_communion' ? { url: r.url_rdv_cure || '', integre: r.url_rdv_cure_integre || '' } : null
  };
}

function promotions_() { return json2_(props_().getProperty('PROMOTIONS'), {}); }

function listerPromotions_() {
  var p = promotions_();
  // Reprend la date si l'événement a été déplacé ou supprimé dans Google Agenda
  Object.keys(p).forEach(function (cle) {
    if (!p[cle].evenement_id) return;
    try {
      var ev = calendrier_().getEventById(p[cle].evenement_id);
      if (!ev) { p[cle].date = ''; p[cle].evenement_id = ''; }
      else { p[cle].date = ev.getStartTime().toISOString(); p[cle].lieu = ev.getLocation(); }
    } catch (e) {}
  });
  props_().setProperty('PROMOTIONS', JSON.stringify(p));
  return p;
}

function fixerPromotion_(p, s) {
  if (!TITRES_COLLECTIFS[p.type]) throw erreur_('INVALIDE', 'Type inconnu.');
  if (!/^\d{4}-\d{4}$/.test(String(p.annee))) throw erreur_('INVALIDE', 'Année scolaire invalide.');
  return verrou_(function () {
    var tout = promotions_();
    var cle = p.type + '|' + p.annee;
    var promo = tout[cle] || { date: '', lieu: '', evenement_id: '' };
    var cal = calendrier_();
    var ev = promo.evenement_id ? cal.getEventById(promo.evenement_id) : null;
    if (!p.date) {
      if (ev) ev.deleteEvent();
      promo = { date: '', lieu: p.lieu || '', evenement_id: '' };
    } else {
      var debut = new Date(p.date), fin = new Date(debut.getTime() + 2 * 3600000);
      if (ev) { ev.setTime(debut, fin); ev.setLocation(p.lieu || ''); }
      else {
        ev = cal.createEvent(TITRES_COLLECTIFS[p.type], debut, fin, { location: p.lieu || '' });
        ev.setTag('promotion', cle);
      }
      promo = { date: debut.toISOString(), lieu: p.lieu || '', evenement_id: ev.getId() };
    }
    tout[cle] = promo;
    props_().setProperty('PROMOTIONS', JSON.stringify(tout));
    journaliser_(s, 'Célébration ' + TITRES_COLLECTIFS[p.type], p.annee + ' → ' + (promo.date || 'retirée'));
    return tout;
  });
}
