/**
 * Actions groupées (cases à cocher + barre d'actions) : on agit sur plusieurs fiches en une fois.
 * Chaque fiche est traitée comme si on l'avait ouverte (mêmes contrôles de droits, historique, journal).
 * Les fiches qu'on ne peut pas traiter sont rendues dans « ignores » avec la raison.
 *  - Dossiers : étape, document reçu, état (clore, rouvrir, annuler), responsable, année ; réclamer les documents.
 *  - Registres : inscription en série (ordre choisi, numéros qui se suivent par année).
 *  - Catéchisme : cotisation soldée, livres remis, groupe.
 *  - Retraites : inscriptions soldées ; relance des impayés (un mail par inscription).
 *  - App des paroissiens : accepter plusieurs demandes ; mur de prière : publier / refuser plusieurs intentions.
 */

var LOT_MAX = 200;
function idsLot_(p) {
  var ids = (p.ids || []).map(String).filter(String);
  if (!ids.length) throw erreur_('INVALIDE', 'Aucune fiche choisie.');
  if (ids.length > LOT_MAX) throw erreur_('INVALIDE', 'Pas plus de ' + LOT_MAX + ' fiches à la fois.');
  return ids;
}

// ─── Dossiers ───

function dossiersLotRoute_(p, s) {
  var ids = idsLot_(p), op = String(p.op || ''), faits = 0, ignores = [];
  if (['etape', 'document', 'etat', 'responsable', 'annee'].indexOf(op) === -1) throw erreur_('INVALIDE', 'Action inconnue.');
  if (op === 'etat' && ['ouvert', 'clos', 'annule'].indexOf(p.valeur) === -1) throw erreur_('INVALIDE', 'État inconnu.');
  if (op === 'etape' && (p.cle === 'registre' || !p.cle)) throw erreur_('INVALIDE', 'L\'inscription au registre se fait depuis la page Registres (numéros d\'acte).');
  ids.forEach(function (id) {
    var d;
    try { d = trouverDossier_(id); } catch (e) { ignores.push({ id: id, nom: id, raison: 'introuvable' }); return; }
    if (!peutModifier_(s, 'dossiers', d.type)) { ignores.push({ id: id, nom: d.nom, raison: 'pas le droit de modifier' }); return; }
    var don = json2_(d.donnees, {}), q = { id: id };
    if (op === 'etape') {
      var et = don.etapes || {};
      if (p.fait === false) delete et[p.cle];
      else if (!(et[p.cle] || {}).fait) et[p.cle] = { fait: true, date: maintenant_(), par: s.nom, libelle: String(p.libelle || p.cle) };
      q.etapes = et;
    } else if (op === 'document') {
      var docs = don.documents || {};
      if (p.recu === false) delete docs[p.cle]; else if (!(docs[p.cle] || {}).recu) docs[p.cle] = { recu: true, date: maintenant_() };
      q.documents = docs;
    } else if (op === 'etat') q.etat = p.valeur;
    else if (op === 'responsable') q.responsable = String(p.valeur || '');
    else if (op === 'annee') {
      var inf = don.infos || {}, v = String(p.valeur || '');
      if (TYPES_DOSSIER[d.type].collectif) { if (!/^\d{4}-\d{4}$/.test(v)) { ignores.push({ id: id, nom: d.nom, raison: 'année scolaire attendue (ex. 2026-2027)' }); return; } inf.annee_scolaire = v; }
      else if (d.type === 'catechumene' || d.type === 'confirmand') { if (!/^\d{4}$/.test(v)) { ignores.push({ id: id, nom: d.nom, raison: 'année attendue (ex. 2027)' }); return; } inf.annee_sacrements = v; }
      else { ignores.push({ id: id, nom: d.nom, raison: 'pas d\'année pour ce type de dossier' }); return; }
      q.infos = inf;
    }
    try { modifierDossier_(q, s); faits++; } catch (e) { ignores.push({ id: id, nom: d.nom, raison: e.message }); }
  });
  journaliser_(s, 'Dossiers : action groupée (' + op + ')', faits + ' dossier(s)' + (p.cle ? ' – ' + (p.libelle || p.cle) : p.valeur ? ' – ' + p.valeur : ''));
  return { faits: faits, ignores: ignores };
}

/** Un mail à chaque famille avec SA liste de documents manquants. p.envois : [{ id, documents: [libellés] }] ; {nom}, {documents} dans le texte. */
function reclamerDocumentsRoute_(p, s) {
  var envois = (p.envois || []).slice(0, LOT_MAX);
  if (!envois.length) throw erreur_('INVALIDE', 'Aucun dossier choisi.');
  var quota = MailApp.getRemainingDailyQuota();
  if (envois.length > quota) throw erreur_('QUOTA', 'Quota Gmail insuffisant aujourd\'hui : ' + quota + ' envois restants.');
  var opts = optionsEnvoi_(), faits = 0, ignores = [];
  envois.forEach(function (e) {
    var d;
    try { d = trouverDossier_(e.id); } catch (er) { ignores.push({ id: e.id, nom: e.id, raison: 'introuvable' }); return; }
    if (!peutModifier_(s, 'dossiers', d.type)) { ignores.push({ id: d.id, nom: d.nom, raison: 'pas le droit de modifier' }); return; }
    var mail = String(d.email || '').split(/[\s,;]+/).filter(String)[0];
    var docs = (e.documents || []).map(String).filter(String);
    if (!mail) { ignores.push({ id: d.id, nom: d.nom, raison: 'pas d\'adresse e-mail' }); return; }
    if (!docs.length) { ignores.push({ id: d.id, nom: d.nom, raison: 'aucun document manquant' }); return; }
    var i = json2_(d.donnees, {}).infos || {};
    var ctx = { nom: d.nom, enfant: i.enfant_prenoms || i.prenoms || '', documents: docs.map(function (x) { return '- ' + x; }).join('\n') };
    var corps = remplirModeleServeur_(p.corps, ctx), sujet = remplirModeleServeur_(p.sujet, ctx);
    try {
      // Bouton « Déposer mes documents » : lien personnel du dossier (pièces envoyées plus tard)
      var boutons = [];
      if ((e.docs || []).length) {
        boutons = [{ texte: 'Déposer mes documents', url: preparerDepot_(d.id, e.docs, s) }];
        if (corps.indexOf('[Bouton : Déposer mes documents]') === -1) corps += '\n\n[Bouton : Déposer mes documents]';
      }
      GmailApp.sendEmail(mail, sujet, corpsTexte_(corps, p.signature, boutons), { name: opts.name, from: opts.from, htmlBody: corpsHtml_(corps, p.signature, boutons) });
      verrou_(function () { var x = trouverDossier_(d.id); ajouterHistorique_(x, s.nom, 'Documents réclamés par mail : ' + docs.join(', ')); ecrireLigne_('Dossiers', x); });
      faits++;
    } catch (er) { ignores.push({ id: d.id, nom: d.nom, raison: er.message }); }
  });
  journaliser_(s, 'Dossiers : documents réclamés', faits + ' mail(s)');
  return { faits: faits, ignores: ignores };
}

// ─── Registres : inscription en série ───

/** p : { registre, ids: [ordre choisi], apercu } → numéros par année de célébration, à la suite. */
function registreSerie_(p, s) {
  if (!peutModifier_(s, 'registres')) throw erreur_('INTERDIT', 'Accès aux registres en lecture seulement.');
  var registre = REGISTRES[p.registre] ? p.registre : 'baptemes', ids = idsLot_(p);
  var dispo = {}; actesAInscrire_(registre).forEach(function (a) { dispo[a.id] = a; });
  var prochain = {}, plan = [], ignores = [];
  ids.forEach(function (id) {
    var a = dispo[id];
    if (!a) { ignores.push({ id: id, nom: id, raison: 'n\'est plus à inscrire' }); return; }
    var annee = String(a.date || aujourdhui_()).slice(0, 4);
    if (!prochain[annee]) prochain[annee] = prochainNumero_(registre, annee);
    plan.push({ id: id, nom: a.nom, date: a.date, annee: annee, numero: String(prochain[annee]++) });
  });
  if (p.apercu) return { plan: plan, ignores: ignores };
  var faits = 0;
  plan.forEach(function (x) {
    try { inscrireRegistre_({ id: x.id, annee: x.annee, numero: x.numero }, s); faits++; } catch (e) { x.erreur = e.message; ignores.push({ id: x.id, nom: x.nom, raison: e.message }); }
  });
  return { plan: plan, faits: faits, ignores: ignores };
}

// ─── Catéchisme ───

function cateLotRoute_(p, s) {
  var ids = idsLot_(p), op = String(p.op || ''), faits = 0, ignores = [];
  feuilleCate_();
  verrou_(function () {
    ids.forEach(function (id) {
      var x;
      try { x = trouverInscription_(id); } catch (e) { ignores.push({ id: id, nom: id, raison: 'introuvable' }); return; }
      var nom = (x.prenoms + ' ' + x.nom).trim();
      if (op === 'solder') {
        var reste = resumeInscription_(x).reste;
        if (reste <= 0) { ignores.push({ id: id, nom: nom, raison: 'déjà réglé' }); return; }
        var l = json2_(x.paiements, []);
        l.push({ id: uid_(), date: /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : aujourdhui_(), montant: reste, mode: String(p.mode || 'Espèces'), par: s.nom });
        x.paiements = JSON.stringify(l);
      } else if (op === 'remis') {
        var m = json2_(x.manuels, []);
        if (!m.length) { ignores.push({ id: id, nom: nom, raison: 'pas de livres' }); return; }
        x.manuels = JSON.stringify(m.map(function (y) { y.remis = p.valeur !== false; return y; }));
      } else if (op === 'groupe') x.groupe = String(p.valeur || '');
      else throw erreur_('INVALIDE', 'Action inconnue.');
      x.maj_le = maintenant_(); x.maj_par = s.nom;
      ecrireInscription_(x); faits++;
    });
  });
  journaliser_(s, 'Catéchisme : action groupée (' + op + ')', faits + ' inscription(s)' + (op === 'solder' ? ' – ' + (p.mode || 'Espèces') : op === 'groupe' ? ' – ' + p.valeur : ''));
  return { faits: faits, ignores: ignores };
}

// ─── Retraites ───

function retraitesLotRoute_(p, s) {
  var ids = idsLot_(p), op = String(p.op || ''), faits = 0, ignores = [];
  var r = trouverRetraite_(p.retraite_id);
  if (op === 'solder') {
    verrou_(function () {
      lignes_('RetraitesInscrits').filter(function (x) { return x.retraite_id === r.id && ids.indexOf(x.id) > -1; }).forEach(function (x) {
        var nom = json2_(x.participants, []).map(function (y) { return y.prenoms; }).join(', ') || x.contact_nom;
        var m = montantInscription_(r, x);
        if (x.statut === 'annule') { ignores.push({ id: x.id, nom: nom, raison: 'inscription annulée' }); return; }
        if (m.reste <= 0) { ignores.push({ id: x.id, nom: nom, raison: 'déjà réglé' }); return; }
        var l = json2_(x.paiements, []), date = /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : aujourdhui_(), mode = String(p.mode || 'Chèque');
        if (m.reste_retraite > 0) l.push({ id: uid_(), date: date, montant: m.reste_retraite, mode: mode, part: 'retraite', par: s.nom });
        if (m.reste_ceremonie > 0) l.push({ id: uid_(), date: date, montant: m.reste_ceremonie, mode: mode, part: 'ceremonie', par: s.nom });
        x.paiements = JSON.stringify(l); x.maj_le = maintenant_();
        ecrireLigne_('RetraitesInscrits', x); faits++;
      });
    });
    journaliser_(s, 'Retraite : inscriptions soldées', faits + ' – ' + titreRetraite_(r));
    return { faits: faits, ignores: ignores, retraite: lireRetraite_({ id: r.id }) };
  }
  if (op === 'relancer') {
    var xs = lignes_('RetraitesInscrits').filter(function (x) { return x.retraite_id === r.id && ids.indexOf(x.id) > -1; });
    var quota = MailApp.getRemainingDailyQuota();
    if (xs.length > quota) throw erreur_('QUOTA', 'Quota Gmail insuffisant aujourd\'hui : ' + quota + ' envois restants.');
    var opts = optionsEnvoi_(), enLigne = false; try { enLigne = !!haActif_(); } catch (e) {}
    var euro = function (v) { return (Math.round(v * 100) / 100).toLocaleString('fr-FR') + ' €'; };
    xs.forEach(function (x) {
      var nom = json2_(x.participants, []).map(function (y) { return y.prenoms; }).join(' et ') || x.contact_nom;
      var m = montantInscription_(r, x), mail = String(x.contact_email || '').split(/[\s,;]+/)[0];
      if (x.statut === 'annule' || m.reste <= 0) { ignores.push({ id: x.id, nom: nom, raison: 'rien à régler' }); return; }
      if (!/@/.test(mail)) { ignores.push({ id: x.id, nom: nom, raison: 'pas d\'adresse e-mail' }); return; }
      var ctx = { participants: nom, reste: euro(m.reste), du: euro(m.du), retraite: titreRetraite_(r) };
      var corps = remplirModeleServeur_(p.corps, ctx), sujet = remplirModeleServeur_(p.sujet, ctx);
      var boutons = [];
      if (enLigne && /\[Bouton : Payer en ligne\]/.test(corps)) boutons.push({ texte: 'Payer en ligne', url: urlPaiement_({ o: m.reste_retraite > 0 ? 'retraite' : 'ceremonie', m: x.jeton }) });
      else corps = corps.replace(/\n?\[Bouton : Payer en ligne\]\n?/, '\n');
      try { GmailApp.sendEmail(mail, sujet, corpsTexte_(corps, p.signature, boutons), { name: opts.name, from: opts.from, htmlBody: corpsHtml_(corps, p.signature, boutons) }); faits++; }
      catch (e) { ignores.push({ id: x.id, nom: nom, raison: e.message }); }
    });
    journaliser_(s, 'Retraite : relance des impayés', faits + ' mail(s) – ' + titreRetraite_(r));
    return { faits: faits, ignores: ignores };
  }
  throw erreur_('INVALIDE', 'Action inconnue.');
}

// ─── App des paroissiens ───

function paroissiensLotRoute_(p, s) {
  var ids = idsLot_(p), op = String(p.op || ''), faits = 0, ignores = [];
  if (op === 'valider') {
    ids.forEach(function (id) {
      var x = compteParId_(id);
      if (!x) { ignores.push({ id: id, nom: id, raison: 'introuvable' }); return; }
      var nom = (x.prenom + ' ' + x.nom).trim(), dm = json2_(x.demande, {}) || {};
      if (dm.mineur && (!dm.accord || dm.accord.reponse !== 'oui')) { ignores.push({ id: id, nom: nom, raison: 'lycéen(ne) : accord du parent attendu' }); return; }
      try { modifierCompteRoute_({ id: id, op: 'valider' }, s); faits++; } catch (e) { ignores.push({ id: id, nom: nom, raison: e.message }); }
    });
    return { faits: faits, ignores: ignores, liste: listerComptesRoute_({}, s) };
  }
  if (op === 'publier' || op === 'refuser') {
    ids.forEach(function (id) { try { modererPriere_({ id: id, op: op }, s); faits++; } catch (e) { ignores.push({ id: id, nom: id, raison: e.message }); } });
    return { faits: faits, ignores: ignores, prieres: prieresEquipe_() };
  }
  throw erreur_('INVALIDE', 'Action inconnue.');
}
