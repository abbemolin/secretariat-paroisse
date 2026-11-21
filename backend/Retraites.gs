/**
 * Retraites (première communion, profession de foi, confirmation jeunes, confirmation adultes + catéchumènes).
 * Une retraite : dates, heures, lieu, prix détaillé (lignes obligatoires + options), participation libre
 * aux frais de la cérémonie, programme, « à apporter », responsable, modalités de paiement.
 * Inscription par un lien public (page secretariat.croix-glorieuse.org/retraite/?r=…) ou un lien personnel
 * envoyé par « Inviter » (déjà rempli d'après le dossier). Une inscription = une famille (plusieurs enfants)
 * ou un adulte ; elle se modifie ou s'annule par le lien du mail de confirmation, jusqu'à la date limite.
 */

var TYPES_RETRAITE = {
  premiere_communion:   { nom: 'Première communion', public: 'enfants', dossiers: ['premiere_communion'] },
  profession_foi:       { nom: 'Profession de foi', public: 'enfants', dossiers: ['profession_foi'] },
  confirmation_jeunes:  { nom: 'Confirmation (jeunes)', public: 'enfants', dossiers: ['confirmation_jeune'] },
  confirmation_adultes: { nom: 'Confirmation (adultes et catéchumènes)', public: 'adultes', dossiers: ['confirmand', 'catechumene'] }
};
var COLONNES_RETRAITES = ['id', 'annee', 'type', 'titre', 'date_debut', 'date_fin', 'heure_debut', 'heure_fin', 'lieu', 'adresse',
  'prix', 'ceremonie_suggestion', 'ceremonie_texte', 'paiement_texte', 'programme', 'apporter', 'responsable_nom', 'responsable_tel',
  'date_limite', 'ouverte', 'jeton', 'cree_le', 'maj_le', 'maj_par', 'paiement_lieu'];
var COLONNES_RET_INSCR = ['id', 'retraite_id', 'jeton', 'statut', 'cree_le', 'maj_le', 'contact_nom', 'contact_email', 'contact_tel',
  'participants', 'ceremonie', 'urgence_nom', 'urgence_tel', 'autorisation', 'covoiturage', 'covoit_places', 'remarque', 'paiements', 'source'];

function feuilleRet_(nom, colonnes) {
  var f = db_().getSheetByName(nom);
  if (!f) {
    f = db_().insertSheet(nom);
    f.getRange('A:Z').setNumberFormat('@');
    f.appendRow(colonnes);
    f.setFrozenRows(1);
  }
  return f;
}
function feuillesRetraites_() { completerColonnes_(feuilleRet_('Retraites', COLONNES_RETRAITES), COLONNES_RETRAITES); feuilleRet_('RetraitesInscrits', COLONNES_RET_INSCR); }

// ─── Calculs ───

function lignesPrix_(r) { return json2_(r.prix, []).filter(function (l) { return l && l.libelle; }); }
/** Montant d'une inscription : pour chaque participant, lignes obligatoires + options cochées ; plus la participation libre. */
function montantInscription_(r, x) {
  var lignes = lignesPrix_(r);
  var parts = json2_(x.participants, []);
  var total = 0;
  parts.forEach(function (pa) {
    var opts = pa.options || [];
    lignes.forEach(function (l) { if (l.obligatoire || opts.indexOf(l.id) > -1) total += nombre_(l.montant); });
  });
  var ceremonie = nombre_(x.ceremonie);
  var arr = function (v) { return Math.round(v * 100) / 100; };
  // hébergement et repas réglés sur place, au lieu d'accueil : la paroisse n'encaisse que la participation
  var surPlace = r.paiement_lieu === 'sur_place' ? total : 0;
  var retraite = total - surPlace;
  var pc = 0, pr = 0, libre = 0;
  json2_(x.paiements, []).forEach(function (p) { if (p.part === 'ceremonie') pc += nombre_(p.montant); else if (p.part === 'retraite') pr += nombre_(p.montant); else libre += nombre_(p.montant); });
  var surR = Math.min(libre, Math.max(0, retraite - pr)); pr += surR; pc += libre - surR;
  var paye = pr + pc;
  return { retraite: arr(retraite), sur_place: arr(surPlace), ceremonie: arr(ceremonie), du: arr(retraite + ceremonie), paye: arr(paye), reste: arr(retraite + ceremonie - paye),
           reste_retraite: arr(Math.max(0, retraite - pr)), reste_ceremonie: arr(Math.max(0, ceremonie - pc)) };
}
function anneeAdultes_(annee) { return String(annee || '').split('-')[1] || String(annee || ''); }
function titreRetraite_(r) { return r.titre || ('Retraite – ' + ((TYPES_RETRAITE[r.type] || {}).nom || '')); }
function dateFr_(iso) {
  if (!iso) return '';
  var d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return Utilities.formatDate(d, 'Europe/Paris', 'dd/MM/yyyy');
}
function quandRetraite_(r) {
  var j = r.date_fin && r.date_fin !== r.date_debut ? 'du ' + dateFr_(r.date_debut) + ' au ' + dateFr_(r.date_fin) : 'le ' + dateFr_(r.date_debut);
  var h = r.heure_debut ? ' (' + r.heure_debut + (r.heure_fin ? ' → ' + r.heure_fin : '') + ')' : '';
  return j + h;
}
function retraitePublique_(r) {
  var t = TYPES_RETRAITE[r.type] || {};
  return {
    titre: titreRetraite_(r), type: r.type, type_nom: t.nom, public: t.public, annee: r.annee,
    date_debut: r.date_debut, date_fin: r.date_fin, heure_debut: r.heure_debut, heure_fin: r.heure_fin, lieu: r.lieu, adresse: r.adresse,
    prix: lignesPrix_(r), ceremonie_suggestion: nombre_(r.ceremonie_suggestion), ceremonie_texte: r.ceremonie_texte,
    programme: r.programme, apporter: r.apporter, responsable_nom: r.responsable_nom, responsable_tel: r.responsable_tel,
    paiement_texte: r.paiement_texte, date_limite: r.date_limite, ouverte: estOuverteRet_(r), paroisse: reglages_().paroisse,
    paiement_lieu: r.paiement_lieu || '', en_ligne: haActif_()
  };
}
function estOuverteRet_(r) {
  if (String(r.ouverte) === 'non') return false;
  if (r.date_limite && maintenant_().slice(0, 10) > r.date_limite) return false;
  return true;
}
function urlRetraite_(params) {
  var base = String(reglages_().url_formulaires || 'https://secretariat.croix-glorieuse.org/').replace(/\/?$/, '/');
  return base + 'retraite/?' + Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
}
function signerDossierRet_(rid, did) {
  return hex_(Utilities.computeHmacSha256Signature('ret|' + rid + '|' + did, secretChef_())).slice(0, 24);
}

// ─── Administration (appli) ───

function inscritsRet_(rid) { return lignes_('RetraitesInscrits').filter(function (x) { return x.retraite_id === rid; }); }
function resumeRetraite_(r, inscrits) {
  var actives = inscrits.filter(function (x) { return x.statut !== 'annule'; });
  var n = 0, du = 0, paye = 0;
  actives.forEach(function (x) { n += json2_(x.participants, []).length; var m = montantInscription_(r, x); du += m.du; paye += m.paye; });
  var o = {};
  COLONNES_RETRAITES.forEach(function (k) { o[k] = r[k]; });
  o.prix = lignesPrix_(r); o.titre = titreRetraite_(r); o.ouverte_maintenant = estOuverteRet_(r);
  o.nb_participants = n; o.nb_inscriptions = actives.length;
  o.du = Math.round(du * 100) / 100; o.paye = Math.round(paye * 100) / 100; o.reste = Math.round((du - paye) * 100) / 100;
  o.lien = r.jeton ? urlRetraite_({ r: r.jeton }) : '';
  return o;
}
function inscriptionPublique_(r, x, admin) {
  var o = {};
  COLONNES_RET_INSCR.forEach(function (k) { o[k] = x[k]; });
  o.participants = json2_(x.participants, []); o.paiements = json2_(x.paiements, []);
  o.ceremonie = nombre_(x.ceremonie); o.covoit_places = x.covoit_places;
  var m = montantInscription_(r, x);
  o.montant = m;
  if (!admin) { delete o.paiements; delete o.source; delete o.retraite_id; }
  return o;
}

function listerRetraites_(p) {
  feuillesRetraites_();
  var toutes = lignes_('Retraites'), inscr = lignes_('RetraitesInscrits');
  var annees = {};
  toutes.forEach(function (r) { annees[r.annee] = true; });
  annees[anneeScolaire_()] = true;
  var annee = p.annee || anneeScolaire_();
  return {
    annee: annee, annees: Object.keys(annees).sort().reverse(), types: TYPES_RETRAITE,
    retraites: toutes.filter(function (r) { return r.annee === annee; })
      .map(function (r) { return resumeRetraite_(r, inscr.filter(function (x) { return x.retraite_id === r.id; })); })
      .sort(function (a, b) { return String(a.date_debut).localeCompare(String(b.date_debut)); })
  };
}
function trouverRetraite_(id) {
  var r = lignes_('Retraites').filter(function (y) { return y.id === id; })[0];
  if (!r) throw erreur_('INTROUVABLE', 'Retraite introuvable.');
  return r;
}
function lireRetraite_(p) {
  feuillesRetraites_();
  var r = trouverRetraite_(p.id);
  var ins = inscritsRet_(r.id);
  var res = resumeRetraite_(r, ins);
  res.inscriptions = ins.map(function (x) { return inscriptionPublique_(r, x, true); })
    .sort(function (a, b) { return String(a.cree_le).localeCompare(String(b.cree_le)); });
  return res;
}
function ecrireRetraite_(p, s) {
  feuillesRetraites_();
  var v = p.retraite || {};
  if (!TYPES_RETRAITE[v.type]) throw erreur_('INVALIDE', 'Type de retraite inconnu.');
  if (!v.date_debut) throw erreur_('INVALIDE', 'Date de début manquante.');
  var id = verrou_(function () {
    var r = v.id ? trouverRetraite_(v.id) : { id: uid_(), jeton: jeton_(), cree_le: maintenant_() };
    ['annee', 'type', 'titre', 'date_debut', 'date_fin', 'heure_debut', 'heure_fin', 'lieu', 'adresse', 'ceremonie_suggestion', 'ceremonie_texte',
     'paiement_texte', 'programme', 'apporter', 'responsable_nom', 'responsable_tel', 'date_limite', 'paiement_lieu'].forEach(function (k) {
      if (v[k] !== undefined) r[k] = String(v[k] == null ? '' : v[k]).slice(0, 4000);
    });
    if (!r.annee) r.annee = anneeScolaire_(r.date_debut);
    if (!r.date_fin) r.date_fin = r.date_debut;
    if (v.ouverte !== undefined) r.ouverte = v.ouverte ? 'oui' : 'non';
    if (v.prix) r.prix = JSON.stringify(v.prix.filter(function (l) { return l && String(l.libelle || '').trim(); }).map(function (l) {
      return { id: l.id || uid_().slice(0, 6), libelle: String(l.libelle).trim().slice(0, 120), montant: nombre_(l.montant), obligatoire: !!l.obligatoire };
    }));
    if (!r.jeton) r.jeton = jeton_();
    r.maj_le = maintenant_(); r.maj_par = s.nom;
    ecrireLigne_('Retraites', r);
    return r.id;
  });
  journaliser_(s, v.id ? 'Retraite modifiée' : 'Retraite créée', titreRetraite_(v) + ' – ' + v.date_debut);
  return lireRetraite_({ id: id });
}
function supprimerRetraite_(p, s) {
  verrou_(function () {
    var r = trouverRetraite_(p.id);
    var f = db_().getSheetByName('RetraitesInscrits');
    inscritsRet_(r.id).map(function (x) { return x._ligne; }).sort(function (a, b) { return b - a; }).forEach(function (l) { f.deleteRow(l); });
    db_().getSheetByName('Retraites').deleteRow(r._ligne);
  });
  journaliser_(s, 'Retraite supprimée', p.id);
  return true;
}
/** Modification d'une inscription depuis l'appli : statut, paiements, remarque, participation. */
function modifierInscriptionRet_(p, s) {
  var rid = verrou_(function () {
    var x = lignes_('RetraitesInscrits').filter(function (y) { return y.id === p.id; })[0];
    if (!x) throw erreur_('INTROUVABLE', 'Inscription introuvable.');
    var l = json2_(x.paiements, []);
    if (p.ajouter) {
      var montant = nombre_(p.ajouter.montant);
      if (!montant) throw erreur_('INVALIDE', 'Montant manquant.');
      l.push({ id: uid_(), date: p.ajouter.date || maintenant_().slice(0, 10), montant: montant, mode: String(p.ajouter.mode || ''), par: s.nom });
    }
    if (p.retirer) l = l.filter(function (y) { return y.id !== p.retirer; });
    x.paiements = JSON.stringify(l);
    if (p.statut) x.statut = p.statut === 'annule' ? 'annule' : 'inscrit';
    ['remarque', 'ceremonie'].forEach(function (k) { if (p[k] !== undefined) x[k] = String(p[k]); });
    x.maj_le = maintenant_();
    ecrireLigne_('RetraitesInscrits', x);
    return x.retraite_id;
  });
  return lireRetraite_({ id: rid });
}

/** Dossiers concernés par une retraite (pour « Inviter »). */
function dossiersRetraite_(r) {
  var t = TYPES_RETRAITE[r.type];
  var anAd = anneeAdultes_(r.annee);
  return lignes_('Dossiers').filter(function (d) {
    if (t.dossiers.indexOf(d.type) === -1 || d.etat !== 'ouvert') return false;
    var i = json2_(d.donnees, {}).infos || {};
    if (d.type === 'confirmand' || d.type === 'catechumene') return String(i.annee_sacrements || '') === anAd;
    return String(i.annee_scolaire || '') === r.annee;
  });
}
function invitesRetraite_(p) {
  var r = trouverRetraite_(p.id);
  var dejaInscrits = {};
  inscritsRet_(r.id).forEach(function (x) { if (x.statut !== 'annule') json2_(x.participants, []).forEach(function (pa) { if (pa.dossier_id) dejaInscrits[pa.dossier_id] = true; }); });
  return dossiersRetraite_(r).map(function (d) {
    var i = json2_(d.donnees, {}).infos || {};
    return { id: d.id, type: d.type, nom: d.nom, email: d.email || i.email || '', prenom: i.prenoms || i.enfant_prenoms || '', inscrit: !!dejaInscrits[d.id] };
  }).sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
}
function inviterRetraite_(p, s) {
  var r = trouverRetraite_(p.id);
  var ids = p.ids || [];
  var liste = invitesRetraite_(p).filter(function (d) { return ids.indexOf(d.id) > -1 && /@/.test(d.email); });
  if (!liste.length) throw erreur_('INVALIDE', 'Aucune adresse e-mail parmi les personnes choisies.');
  var quota = MailApp.getRemainingDailyQuota();
  if (liste.length > quota) throw erreur_('QUOTA', 'Quota Gmail insuffisant aujourd\'hui : ' + quota + ' envois restants.');
  var opts = optionsEnvoi_();
  var BOUTON = 'Inscription à la retraite';
  liste.forEach(function (d) {
    var url = urlRetraite_({ r: r.jeton, d: d.id, k: signerDossierRet_(r.id, d.id) });
    var ctx = { prenom: d.prenom };
    var corps = remplirModeleServeur_(p.corps, ctx), sujet = remplirModeleServeur_(p.sujet, ctx);
    var boutons = [{ texte: BOUTON, url: url }];
    GmailApp.sendEmail(d.email, sujet, corpsTexte_(corps, p.signature, boutons), { name: opts.name, from: opts.from, htmlBody: corpsHtml_(corps, p.signature, boutons) });
  });
  journaliser_(s, 'Retraite : invitations', titreRetraite_(r) + ' → ' + liste.length);
  return { nb: liste.length };
}

// ─── Page publique d'inscription ───

function retraiteParJeton_(j) {
  if (!/^[a-f0-9]{32}$/.test(String(j || ''))) throw erreur_('LIEN', 'Ce lien n\'est pas valable.');
  feuillesRetraites_();
  var r = lignes_('Retraites').filter(function (y) { return y.jeton === j; })[0];
  if (!r) throw erreur_('LIEN', 'Cette retraite n\'existe plus.');
  return r;
}
function prerempliDossier_(r, did, k) {
  if (!did || k !== signerDossierRet_(r.id, did)) return null;
  var d = trouverDossier_(did);
  if (!d) return null;
  var i = json2_(d.donnees, {}).infos || {};
  var enfant = TYPES_RETRAITE[r.type].public === 'enfants';
  if (enfant) {
    var parentNom = [i.pere_prenom, i.pere_nom].filter(String).join(' ') || [i.mere_prenom, i.mere_nom_jeune_fille].filter(String).join(' ') || i.pere || i.mere || '';
    return { dossier_id: d.id, contact_nom: parentNom, contact_email: d.email || i.email || '', contact_tel: d.telephone || i.telephone || '',
             participants: [{ prenoms: i.enfant_prenoms || '', nom: i.enfant_nom || '', classe: i.classe || '', dossier_id: d.id }] };
  }
  return { dossier_id: d.id, contact_nom: [i.prenoms, i.nom].filter(String).join(' '), contact_email: d.email || i.email || '', contact_tel: d.telephone || i.telephone || '',
           participants: [{ prenoms: i.prenoms || '', nom: i.nom || '', dossier_id: d.id }] };
}
function actionRetraitePublique_(action, p) {
  var cache = CacheService.getScriptCache(), cle = 'ret_' + String(p.r || p.m || '').slice(0, 32);
  var n = Number(cache.get(cle) || 0);
  if (n > 200) throw erreur_('LIMITE', 'Trop de demandes. Réessayez dans une heure.');
  cache.put(cle, String(n + 1), 3600);

  if (action === 'ret.public') {
    var r, x = null;
    if (p.m) { x = inscriptionParJeton_(p.m); r = trouverRetraite_(x.retraite_id); }
    else r = retraiteParJeton_(p.r);
    return { retraite: retraitePublique_(r), prerempli: x ? null : prerempliDossier_(r, p.d, p.k), inscription: x ? inscriptionPublique_(r, x, false) : null };
  }
  if (action === 'ret.inscrire') return inscrireRetraite_(p);
  if (action === 'ret.annuler') {
    var y = inscriptionParJeton_(p.m), rr = trouverRetraite_(y.retraite_id);
    if (!estOuverteRet_(rr)) throw erreur_('FERME', 'Les inscriptions sont closes : contactez la paroisse pour annuler.');
    verrou_(function () { var z = inscriptionParJeton_(p.m); z.statut = 'annule'; z.maj_le = maintenant_(); ecrireLigne_('RetraitesInscrits', z); });
    prevenirRetraite_(rr, 'Retraite : inscription annulée', y.contact_nom);
    return { annule: true };
  }
  throw erreur_('ACTION', 'Action inconnue.');
}
function inscriptionParJeton_(m) {
  if (!/^[a-f0-9]{32}$/.test(String(m || ''))) throw erreur_('LIEN', 'Ce lien n\'est pas valable.');
  feuillesRetraites_();
  var x = lignes_('RetraitesInscrits').filter(function (y) { return y.jeton === m; })[0];
  if (!x) throw erreur_('LIEN', 'Inscription introuvable.');
  return x;
}

function inscrireRetraite_(p) {
  var modif = !!p.m;
  var r = modif ? trouverRetraite_(inscriptionParJeton_(p.m).retraite_id) : retraiteParJeton_(p.r);
  if (!estOuverteRet_(r)) throw erreur_('FERME', 'Les inscriptions à cette retraite sont closes.');
  var t = TYPES_RETRAITE[r.type], enfants = t.public === 'enfants';
  var court = function (v, max) { return String(v == null ? '' : v).trim().slice(0, max || 200); };
  var f = p.inscription || {};
  var ids = lignesPrix_(r).map(function (l) { return l.id; });
  var parts = (f.participants || []).slice(0, 8).map(function (pa) {
    return { prenoms: court(pa.prenoms, 80), nom: court(pa.nom, 80), classe: court(pa.classe, 40), allergies: court(pa.allergies, 300),
             image: enfants ? (pa.image === 'non' ? 'non' : 'oui') : '', options: (pa.options || []).filter(function (o) { return ids.indexOf(o) > -1; }),
             dossier_id: court(pa.dossier_id, 20) };
  }).filter(function (pa) { return pa.prenoms || pa.nom; });
  if (!parts.length) throw erreur_('INVALIDE', 'Indiquez au moins un participant.');
  if (!/@/.test(String(f.contact_email || ''))) throw erreur_('INVALIDE', 'Adresse e-mail manquante.');
  if (enfants) {
    if (!court(f.contact_nom)) throw erreur_('INVALIDE', 'Nom du parent manquant.');
    if (!court(f.urgence_nom) || !court(f.urgence_tel)) throw erreur_('INVALIDE', 'Contact d\'urgence manquant.');
    if (!f.autorisation) throw erreur_('INVALIDE', 'L\'autorisation parentale est nécessaire.');
  }
  // dossier_id : seulement ceux de dossiers concernés (lien personnel ou reconnaissance par le nom)
  var dossiers = dossiersRetraite_(r);
  parts.forEach(function (pa) {
    var d = dossiers.filter(function (y) { return y.id === pa.dossier_id; })[0];
    if (!d) d = dossiers.filter(function (y) {
      var i = json2_(y.donnees, {}).infos || {};
      return memeNom_(i.enfant_nom || i.nom || '', pa.nom) && prenomCommun_(i.enfant_prenoms || i.prenoms || '', pa.prenoms);
    })[0];
    pa.dossier_id = d ? d.id : '';
  });
  var res = verrou_(function () {
    var x = modif ? inscriptionParJeton_(p.m) : { id: uid_(), retraite_id: r.id, jeton: jeton_(), statut: 'inscrit', cree_le: maintenant_(), paiements: '[]', source: p.d ? 'Lien personnel' : 'Lien public' };
    x.contact_nom = court(f.contact_nom, 120); x.contact_email = court(f.contact_email, 120).replace(/\s/g, ''); x.contact_tel = court(f.contact_tel, 40);
    x.participants = JSON.stringify(parts);
    x.ceremonie = String(Math.max(0, nombre_(f.ceremonie)));
    x.urgence_nom = court(f.urgence_nom, 120); x.urgence_tel = court(f.urgence_tel, 40);
    x.autorisation = enfants && f.autorisation ? 'oui – ' + court(f.contact_nom, 120) + ' – ' + maintenant_().slice(0, 10) : '';
    x.covoiturage = ['propose', 'cherche'].indexOf(f.covoiturage) > -1 ? f.covoiturage : '';
    x.covoit_places = x.covoiturage === 'propose' ? String(Math.min(9, Math.max(0, Math.round(nombre_(f.covoit_places))))) : '';
    x.remarque = court(f.remarque, 1000);
    x.statut = 'inscrit'; x.maj_le = maintenant_();
    ecrireLigne_('RetraitesInscrits', x);
    return x;
  });
  // étape « Retraite » cochée dans les dossiers (à l'inscription)
  parts.forEach(function (pa) {
    if (!pa.dossier_id) return;
    try {
      verrou_(function () {
        var d = trouverDossier_(pa.dossier_id);
        var don = json2_(d.donnees, {}); don.etapes = don.etapes || {};
        var avait = don.etapes.retraite && don.etapes.retraite.fait;
        if (d.type !== 'catechumene' && !avait) don.etapes.retraite = { fait: true, date: maintenant_(), par: 'Inscription retraite', libelle: 'Retraite' };
        d.donnees = JSON.stringify(don);
        if (!avait) ajouterHistorique_(d, 'Inscription retraite', 'Inscrit(e) à la retraite du ' + dateFr_(r.date_debut) + ' (' + (r.lieu || '') + ')');
        d.maj_le = maintenant_(); d.maj_par = 'Inscription retraite';
        ecrireLigne_('Dossiers', d);
      });
    } catch (e) { /* dossier supprimé entre-temps */ }
  });
  try { mailConfirmationRetraite_(r, res, modif); } catch (e) { /* l'inscription reste valable */ }
  prevenirRetraite_(r, modif ? 'Retraite : inscription modifiée' : 'Retraite : nouvelle inscription',
    parts.map(function (pa) { return pa.prenoms + ' ' + pa.nom; }).join(', '));
  return { inscription: inscriptionPublique_(r, res, false), jeton: res.jeton };
}

function prevenirRetraite_(r, titre, texte) {
  lignes_('Utilisateurs').filter(estActif_).forEach(function (u) { notifier_(u.id, titre, texte + ' – ' + titreRetraite_(r), '#/retraites/' + r.id); });
}

function mailConfirmationRetraite_(r, x, modif) {
  var m = montantInscription_(r, x);
  var parts = json2_(x.participants, []);
  var lignes = lignesPrix_(r);
  var euro = function (v) { return (Math.round(v * 100) / 100).toLocaleString('fr-FR') + ' €'; };
  var det = parts.map(function (pa) {
    var l = lignes.filter(function (y) { return y.obligatoire || (pa.options || []).indexOf(y.id) > -1; });
    return '- ' + pa.prenoms + ' ' + pa.nom + (l.length ? ' : ' + l.map(function (y) { return y.libelle + ' (' + euro(y.montant) + ')'; }).join(', ') : '');
  }).join('\n');
  var nomTexte = r.titre ? 'la retraite « ' + r.titre + ' »' : ({ premiere_communion: 'la retraite de première communion', profession_foi: 'la retraite de profession de foi',
    confirmation_jeunes: 'la retraite de confirmation des jeunes', confirmation_adultes: 'la retraite de confirmation' })[r.type];
  var t = 'Bonjour,\n\n' + (modif ? 'Votre inscription a bien été modifiée' : 'Nous avons bien reçu votre inscription') + ' à ' + nomTexte +
    ', ' + quandRetraite_(r) + (r.lieu ? ', ' + r.lieu + (r.adresse ? ' (' + r.adresse + ')' : '') : '') + '.\n\n' +
    'Participant(s) :\n' + det + '\n\n' +
    (m.sur_place ? 'Hébergement et repas : ' + euro(m.sur_place) + ', à régler sur place' + (r.lieu ? ' (' + r.lieu + ')' : '') + '.\n' : '') +
    (m.retraite ? 'Retraite : ' + euro(m.retraite) + '\n' : '') + (m.ceremonie ? 'Participation aux frais de la cérémonie : ' + euro(m.ceremonie) + '\n' : '') +
    (m.du ? 'Total à régler à la paroisse : ' + euro(m.du) : '') +
    (haActif_() && m.reste_retraite > 0 ? '\n[Bouton : Payer la retraite en ligne]' : '') +
    (haActif_() && m.reste_ceremonie > 0 ? '\n[Bouton : Participer aux frais de la cérémonie]' : '') +
    (r.paiement_texte ? '\n\nPaiement : ' + r.paiement_texte : '') +
    (r.programme ? '\n\nProgramme :\n' + r.programme : '') +
    (r.apporter ? '\n\nÀ apporter :\n' + r.apporter : '') +
    (r.responsable_nom ? '\n\nResponsable : ' + r.responsable_nom + (r.responsable_tel ? ' – ' + r.responsable_tel : '') : '') +
    '\n\nPour modifier ou annuler votre inscription' + (r.date_limite ? ' (jusqu\'au ' + dateFr_(r.date_limite) + ')' : '') + ' :\n[Bouton : Modifier mon inscription]' +
    '\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
  var boutons = [{ texte: 'Modifier mon inscription', url: urlRetraite_({ m: x.jeton }) },
    { texte: 'Payer la retraite en ligne', url: urlPaiement_({ o: 'retraite', m: x.jeton }) },
    { texte: 'Participer aux frais de la cérémonie', url: urlPaiement_({ o: 'ceremonie', m: x.jeton }) }];
  boutons = boutons.filter(function (b) { return t.indexOf('[Bouton : ' + b.texte + ']') > -1; });
  var opts = optionsEnvoi_();
  GmailApp.sendEmail(x.contact_email, (modif ? 'Inscription modifiée – ' : 'Inscription reçue – ') + titreRetraite_(r), corpsTexte_(t, 'paroisse', boutons),
    { name: opts.name, from: opts.from, htmlBody: corpsHtml_(t, 'paroisse', boutons) });
}
