/**
 * Accès de chaque utilisateur, choisis par l'administrateur (Utilisateurs → fiche).
 * Le rôle pré-coche des accès ; l'administrateur les ajuste ensuite personne par personne.
 *
 * acces = {
 *   courrier, agenda, extraits, registres, catechisme, catechumenat, cor_unum, retraites, documents, statistiques, annonces, liturgie, intentions : '' | 'l' | 'm'
 *   dossiers : { bapteme, premiere_communion, … : '' | 'l' | 'm' }     (par sorte de dossier)
 *   courrier_tout : true (toute la boîte) | false (seulement les mails qui lui sont attribués)
 *   reglages : ['Paroisse', 'Signatures', …]                         (onglets permis)
 *   signer : true | false                                            (extraits, B6, courriers)
 * }
 * Les administrateurs ont toujours tout (et seuls eux gèrent les utilisateurs).
 */
var PAGES_ACCES = ['courrier', 'agenda', 'extraits', 'registres', 'catechisme', 'catechumenat', 'cor_unum', 'retraites', 'documents', 'statistiques', 'annonces', 'liturgie', 'intentions', 'paroissiens'];
var SORTES_ACCES = ['bapteme', 'premiere_communion', 'profession_foi', 'confirmation_jeune', 'mariage', 'obseques', 'catechumene', 'confirmand'];
var ONGLETS_REGLAGES = ['Paroisse', 'Signatures', 'Réponses types', 'Modèles', 'Tri automatique', 'Catéchisme', 'Confirmands', 'Cor Unum', 'Paiements en ligne', 'Newsletter', 'Liturgie', 'Journal', 'Sauvegardes'];

function accesComplet_(niveau, onglets, signer) {
  var a = { dossiers: {}, courrier_tout: true, reglages: onglets || [], signer: !!signer };
  PAGES_ACCES.forEach(function (k) { a[k] = niveau; });
  SORTES_ACCES.forEach(function (k) { a.dossiers[k] = niveau; });
  return a;
}
/** Accès pré-cochés par rôle. */
function accesDuRole_(role) {
  var tous = ONGLETS_REGLAGES.slice();
  if (role === 'admin') { var a = accesComplet_('m', tous, true); a.statistiques = 'm'; return a; }
  var x = accesComplet_('m', [], role === 'cure' || role === 'vicaire');
  x.statistiques = '';
  x.annonces = role === 'cure' ? 'm' : '';   // tuile « Annonces et newsletter » : curé (et administrateurs)
  x.liturgie = role === 'secretaire' ? '' : 'm';
  x.paroissiens = role === 'cure' || role === 'vicaire' || role === 'secretaire' ? 'm' : '';   // App des paroissiens : demandes d'accès et comptes
  x.intentions = role === 'cure' || role === 'vicaire' ? 'm' : '';   // tuile « Intentions de messe » : prêtres (et administrateurs)   // tuile « Liturgie » : prêtres et diacres
  if (role === 'secretaire') { x.reglages = tous.filter(function (o) { return o !== 'Sauvegardes' && o !== 'Newsletter' && o !== 'Liturgie'; }); x.signer = true; }
  return x;
}
var NIVEAUX_ = { '': 0, l: 1, m: 2 };
/** Accès effectifs d'un utilisateur (fiche) : ceux enregistrés, sinon ceux de son rôle. */
function accesDe_(u) {
  if (u.role === 'admin') return accesDuRole_('admin');
  var base = accesDuRole_(u.role), a = json2_(u.acces, null);
  if (!a) {
    // comptes créés avant le choix des accès : signataires de Réglages → Paroisse, s'il y en a
    var liste = String(reglages_().signataires || '').split(',').filter(String);
    if (liste.length) base.signer = liste.indexOf(u.id) > -1;
    else base.signer = u.role === 'secretaire' || u.signature === 'cure';
    return base;
  }
  var r = { dossiers: {}, courrier_tout: a.courrier_tout !== false, reglages: (a.reglages || []).filter(function (o) { return ONGLETS_REGLAGES.indexOf(o) > -1; }), signer: !!a.signer };
  PAGES_ACCES.forEach(function (k) { r[k] = NIVEAUX_[a[k]] !== undefined ? a[k] : ''; });
  SORTES_ACCES.forEach(function (k) { r.dossiers[k] = NIVEAUX_[(a.dossiers || {})[k]] !== undefined ? a.dossiers[k] : ''; });
  if (a.annonces === undefined) r.annonces = base.annonces;   // accès choisis avant l'arrivée de la tuile : ceux du rôle
  if (a.liturgie === undefined) r.liturgie = base.liturgie;
  if (a.intentions === undefined) r.intentions = base.intentions;
  if (a.paroissiens === undefined) r.paroissiens = base.paroissiens;
  return r;
}
/** Nettoie les accès envoyés par l'administrateur. */
function accesValides_(a) {
  a = a || {};
  var r = { dossiers: {}, courrier_tout: a.courrier_tout !== false, reglages: (a.reglages || []).filter(function (o) { return ONGLETS_REGLAGES.indexOf(o) > -1; }), signer: !!a.signer };
  PAGES_ACCES.forEach(function (k) { r[k] = NIVEAUX_[a[k]] !== undefined ? a[k] : ''; });
  SORTES_ACCES.forEach(function (k) { r.dossiers[k] = NIVEAUX_[(a.dossiers || {})[k]] !== undefined ? a.dossiers[k] : ''; });
  return r;
}
/** Anciens « droits » (pour l'accueil, le menu…) déduits des accès. */
function droitsDe_(role, a) {
  var d = [];
  if (a.courrier) d.push('mail');
  if (a.agenda) d.push('agenda');
  if (SORTES_ACCES.some(function (k) { return a.dossiers[k]; }) || ['extraits', 'registres', 'catechisme', 'catechumenat', 'cor_unum', 'retraites'].some(function (k) { return a[k]; })) d.push('dossiers');
  if (a.documents) d.push('documents');
  if (a.annonces) d.push('annonces');
  if (a.liturgie) d.push('liturgie');
  if (a.intentions) d.push('intentions');
  if (a.paroissiens) d.push('paroissiens');
  if (role === 'admin') d.push('utilisateurs');
  if (a.reglages.length) d.push('reglages');
  return d;
}
function niveau_(s, zone, sorte) {
  var a = s.acces;
  if (!a) return 2;
  if (zone === 'dossiers') {
    if (sorte) return NIVEAUX_[a.dossiers[sorte] || ''] || 0;
    return Math.max.apply(null, SORTES_ACCES.map(function (k) { return NIVEAUX_[a.dossiers[k] || ''] || 0; }));
  }
  return NIVEAUX_[a[zone] || ''] || 0;
}
function peutLire_(s, zone, sorte) { return niveau_(s, zone, sorte) >= 1; }
function peutModifier_(s, zone, sorte) { return niveau_(s, zone, sorte) >= 2; }
function ongletPermis_(s, onglet) { return s.role === 'admin' || (s.acces && s.acces.reglages.indexOf(onglet) > -1); }
/** Sortes de dossiers visibles. */
function sortesLisibles_(s) { return SORTES_ACCES.filter(function (k) { return peutLire_(s, 'dossiers', k); }); }

var NOMS_ZONES_ = { courrier: 'Courrier', agenda: 'Agenda', dossiers: 'Dossiers', extraits: 'Extraits de baptême', registres: 'Registres',
  catechisme: 'Catéchisme', catechumenat: 'Catéchuménat', cor_unum: 'Cor Unum', retraites: 'Retraites', documents: 'Documents', statistiques: 'Statistiques', annonces: 'Annonces et newsletter', liturgie: 'Liturgie', intentions: 'Intentions de messe', paroissiens: 'App des paroissiens' };
var LECTURE_ = /\.(liste|lire|semaine|fil|piecejointe|libelles|groupes|evenements|etat|reglages|catalogue|invites|equipesCourantes|telecharger|chercher|quota|equipe|onglets|lienChef|lienInscription|invites)$/;
var ONGLET_ROUTE_ = {
  'reglages.ecrire': 'Paroisse', 'sceau.ecrire': 'Paroisse', 'signatures.ecrire': 'Signatures', 'reponses.ecrire': 'Réponses types', 'tri.ecrire': 'Tri automatique',
  'cate.reglagesEcrire': 'Catéchisme', 'conf.reglagesEcrire': 'Confirmands', 'cor.reglagesEcrire': 'Cor Unum', 'journal.liste': 'Journal',
  'paiements.reglages': 'Paiements en ligne', 'paiements.reglagesEcrire': 'Paiements en ligne', 'paiements.tester': 'Paiements en ligne', 'sauvegardes': 'Sauvegardes',
  'newsletter.reglages': 'Newsletter', 'newsletter.reglagesEcrire': 'Newsletter', 'newsletter.tester': 'Newsletter',
  'liturgie.reglages': 'Liturgie', 'liturgie.reglagesEcrire': 'Liturgie', 'liturgie.tester': 'Liturgie'
};
/** Zone d'une action (null = pas de contrôle particulier). */
function zoneAction_(action) {
  if (/^(mail\.|tri\.)/.test(action)) return 'courrier';
  if (action === 'agenda.rendezvous') return 'agenda';
  if (/^agenda\./.test(action)) return 'agenda';
  if (/^(dossiers\.|promotions\.|conf\.)/.test(action)) return 'dossiers';
  if (/^(cate\.|livres\.)/.test(action)) return 'catechisme';
  if (/^(espace\.|textes\.|calendrier\.|catechumenat\.|parrain\.)/.test(action)) return 'catechumenat';
  if (/^cor\./.test(action)) return 'cor_unum';
  if (/^retraites\./.test(action)) return 'retraites';
  if (/^extraits\./.test(action)) return 'extraits';
  if (/^documents\./.test(action)) return 'documents';
  if (action === 'registres') return 'registres';
  if (action === 'statistiques') return 'statistiques';
  if (/^(annonces|newsletter)\./.test(action)) return 'annonces';
  if (/^(liturgie|propre)\./.test(action)) return 'liturgie';
  if (/^intentions\./.test(action)) return 'intentions';
  if (/^paroissiens\./.test(action)) return 'paroissiens';
  return null;
}
function interdit_(texte) { return erreur_('INTERDIT', texte || 'Vous n\'avez pas accès à cette fonction.'); }

/** Contrôle d'accès d'une action (appelé avant chaque route connectée). */
function verifierAcces_(action, p, s, route) {
  if (s.role === 'admin') return;
  if (/^utilisateurs\.(creer|modifier)$/.test(action)) throw interdit_('Réservé aux administrateurs.');
  // onglets des réglages
  var onglet = ONGLET_ROUTE_[action];
  if (onglet) { if (!ongletPermis_(s, onglet)) throw interdit_('Vous n\'avez pas accès à l\'onglet « ' + onglet + ' » des réglages.'); return; }
  if (action === 'modeles') {
    if (p.ecrire && !ongletPermis_(s, 'Modèles')) throw interdit_('Vous n\'avez pas accès à l\'onglet « Modèles » des réglages.');
    if (!p.ecrire && !peutLire_(s, 'dossiers')) throw interdit_();
    return;
  }
  // signature
  if (/^(extraits\.signer|extraits\.signature|dossiers\.signerB6|dossiers\.courrier)$/.test(action) && !s.acces.signer) throw interdit_('Vous n\'êtes pas autorisé(e) à signer.');
  var zone = zoneAction_(action);
  if (!zone) { if (route.droit && s.droits.indexOf(route.droit) === -1) throw interdit_(); return; }
  var ecrit = !LECTURE_.test(action);
  if (action === 'registres') ecrit = !!(p.inscrire || p.depart);
  if (action === 'statistiques') ecrit = false;
  if (action === 'tri.tester') ecrit = false;
  if (/^liturgie\./.test(action) || action === 'propre.lire') ecrit = false;
  if (/^intentions\.(liste|agenda|apercu)$/.test(action)) ecrit = false;   // lecture, et ses propres marque-pages : l'accès en lecture suffit
  if (action === 'catechumenat.export') ecrit = false;
  if (action === 'catechumenat.reglages' && (p.ecrire || p.consigne_lettre !== undefined)) ecrit = true;
  if (zone === 'dossiers') return verifierDossier_(action, p, s, ecrit);
  if (!(ecrit ? peutModifier_ : peutLire_)(s, zone)) {
    throw interdit_(ecrit && peutLire_(s, zone) ? 'Lecture seule : vous ne pouvez pas modifier (' + NOMS_ZONES_[zone] + ').' : 'Vous n\'avez pas accès à cette partie de l\'appli (' + NOMS_ZONES_[zone] + ').');
  }
  if (zone === 'courrier' && !s.acces.courrier_tout) verifierFilAttribue_(action, p, s);
  if (action === 'registres' && p.inscrire) verifierDossier_('dossiers.modifier', { id: p.inscrire.id }, s, true);
}
function verifierDossier_(action, p, s, ecrit) {
  var id = p.id || p.dossierId || p.dossier_id;
  var sorte = '';
  if (action === 'dossiers.creer' || action === 'promotions.fixer' || action === 'promotions.liste') sorte = p.type || '';
  else if (/^conf\./.test(action)) sorte = 'confirmand';
  else if (action === 'dossiers.importerCatechumenes') sorte = 'catechumene';
  else if (id && action !== 'dossiers.liste') { var d = lignes_('Dossiers').filter(function (x) { return x.id === id; })[0]; if (d) sorte = d.type; }
  if (action === 'dossiers.changerType' && p.type && !peutModifier_(s, 'dossiers', p.type)) throw interdit_('Vous ne pouvez pas modifier les dossiers de cette sorte.');
  var ok = sorte ? (ecrit ? peutModifier_ : peutLire_)(s, 'dossiers', sorte) : (ecrit ? peutModifier_ : peutLire_)(s, 'dossiers');
  if (!ok) throw interdit_(ecrit && (sorte ? peutLire_(s, 'dossiers', sorte) : peutLire_(s, 'dossiers')) ? 'Lecture seule : vous ne pouvez pas modifier ces dossiers.' : 'Vous n\'avez pas accès à ces dossiers.');
}
/** Courrier limité : seulement les fils attribués à la personne. */
function filsAttribues_(s) {
  var r = {};
  lignes_('SuiviMails').forEach(function (x) { if (x.attribue_a === s.uid) r[x.fil_id] = 1; });
  return r;
}
function verifierFilAttribue_(action, p, s) {
  if (/^(mail\.liste|mail\.libelles|mail\.groupes|mail\.quota|tri\.lire|tri\.tester)$/.test(action)) return;
  if (action === 'mail.envoiGroupe') throw interdit_('Les envois groupés sont réservés aux personnes qui voient tout le courrier.');
  if (action === 'mail.lot') { var a = filsAttribues_(s); if ((p.ids || []).some(function (id) { return !a[id]; })) throw interdit_('Certains de ces mails ne vous sont pas attribués.'); return; }
  var fil = p.filId || (action === 'mail.fil' || action === 'mail.modifier' ? p.id : '');
  if (!fil && action === 'mail.piecejointe' && p.messageId) { try { fil = GmailApp.getMessageById(p.messageId).getThread().getId(); } catch (e) {} }
  if (!fil && action === 'mail.envoyer') return;   // nouveau message
  if (!fil || !filsAttribues_(s)[fil]) throw interdit_('Ce mail ne vous est pas attribué.');
}
