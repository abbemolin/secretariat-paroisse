/**
 * Fraternités Cor Unum : inscriptions de l'année (formulaire Google), équipes et chefs.
 *
 * Une fiche par foyer (un couple inscrit sur une ligne reste une seule fiche).
 * L'appli lit la feuille de réponses (Réglages → Cor Unum) ; une réponse rejoint la fiche
 * existante de la même personne (e-mail + nom, ou nom + prénom, fautes de frappe tolérées),
 * sinon une nouvelle fiche est créée avec une équipe proposée (« rester dans la même équipe » +
 * nom du chef, ou personne qu'on souhaite retrouver). La proposition est validée dans l'appli.
 * Statuts : actif (inscrit cette année), ancien (membre d'une année passée, pas encore réinscrit).
 */

var COLONNES_COR = ['id', 'annee', 'cree_le', 'sources', 'nom', 'prenoms', 'email', 'telephone', 'adresse', 'profils', 'situation',
  'deja_participe', 'rester', 'chef_indique', 'chef_possible', 'souhait', 'groupe_service', 'equipe_id', 'equipe_proposee',
  'statut', 'note', 'maj_le', 'maj_par', 'dossiers_lies', 'dossiers_exclus'];
var PROFILS_COR = ['Catéchumène', 'Confirmand', 'Néophyte', 'Nouveau à la paroisse', 'Recommençant', 'Paroissien'];

function feuilleCor_() {
  var f = db_().getSheetByName('CorUnum');
  if (!f) {
    f = db_().insertSheet('CorUnum');
    f.getRange('A:Z').setNumberFormat('@');
    f.appendRow(COLONNES_COR);
    f.setFrozenRows(1);
  } else {
    // colonnes ajoutées depuis la création de la feuille
    var ent = f.getRange(1, 1, 1, f.getLastColumn()).getValues()[0];
    var manque = COLONNES_COR.filter(function (c) { return ent.indexOf(c) === -1; });
    if (manque.length) f.getRange(1, ent.length + 1, 1, manque.length).setValues([manque]); oublierLignes_();
  }
  return f;
}

// ─── Réglages et équipes (par année) ───

var COR_DEFAUT = { feuilles: [{ id: '1KbA5BV_qx7_nC_4G76fjN7TujtjabmLsVy8hHq1xafE', annee: '2026-2027' }], lien_formulaire: '', import_auto: false, equipes: {}, onglets_repris: {} };

function corReglages_() {
  var r = json2_(props_().getProperty('COR_UNUM'), {});
  Object.keys(COR_DEFAUT).forEach(function (k) { if (r[k] === undefined) r[k] = JSON.parse(JSON.stringify(COR_DEFAUT[k])); });
  return r;
}
function ecrireCorReglages_(r) { props_().setProperty('COR_UNUM', JSON.stringify(r)); }

function lireCorReglagesPublic_() {
  var r = corReglages_();
  return {
    feuilles: r.feuilles.map(function (f) {
      try { return { id: f.id, annee: f.annee, nom: SpreadsheetApp.openById(f.id).getName(), onglets_repris: !!r.onglets_repris[f.annee] }; }
      catch (e) { return { id: f.id, annee: f.annee, nom: '', erreur: 'Feuille introuvable' }; }
    }),
    lien_formulaire: r.lien_formulaire, import_auto: r.import_auto, profils: PROFILS_COR
  };
}
function ecrireCorReglagesRoute_(p, s) {
  var r = corReglages_(), avant = r.import_auto;
  if (p.lien_formulaire !== undefined) {
    var l = String(p.lien_formulaire || '').trim();
    if (l && !/^https:\/\//.test(l)) throw erreur_('INVALIDE', 'Le lien du formulaire doit commencer par https://');
    r.lien_formulaire = l;
  }
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
  ecrireCorReglages_(r);
  if (r.import_auto !== avant) {
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'importerCorUnum') ScriptApp.deleteTrigger(t); });
    if (r.import_auto) ScriptApp.newTrigger('importerCorUnum').timeBased().everyMinutes(15).create();
  }
  journaliser_(s, 'Cor Unum : réglages modifiés', '');
  return lireCorReglagesPublic_();
}

function equipesDe_(r, annee) { return (r.equipes[annee] || []).slice(); }

function equipeCor_(p, s) {
  var annee = String(p.annee || '');
  if (!/^\d{4}-\d{4}$/.test(annee)) throw erreur_('INVALIDE', 'Année invalide.');
  verrou_(function () {
    var r = corReglages_();
    var l = r.equipes[annee] || [];
    if (p.supprimer) {
      l = l.filter(function (e) { return e.id !== p.supprimer; });
      feuilleCor_();
      lignes_('CorUnum').forEach(function (x) {
        if (x.annee === annee && (x.equipe_id === p.supprimer || x.equipe_proposee === p.supprimer)) {
          if (x.equipe_id === p.supprimer) x.equipe_id = '';
          if (x.equipe_proposee === p.supprimer) x.equipe_proposee = '';
          ecrireLigne_('CorUnum', x);
        }
      });
    } else {
      var e = p.equipe || {};
      var nom = String(e.nom || '').trim();
      if (!nom) throw erreur_('INVALIDE', 'Nom de l\'équipe manquant.');
      var ex = l.filter(function (y) { return y.id === e.id; })[0];
      if (ex) { ex.nom = nom; ex.chefs = e.chefs || ex.chefs || []; }
      else {
        var n = { id: uid_(), nom: nom, chefs: e.chefs || [], fil: uid_(), jeton: jeton_() };
        l.push(n);
        // le chef choisi rejoint son équipe
        (n.chefs || []).forEach(function (id) {
          lignes_('CorUnum').forEach(function (x) { if (x.id === id) { x.equipe_id = n.id; x.equipe_proposee = ''; x.statut = x.statut || 'actif'; ecrireLigne_('CorUnum', x); } });
        });
      }
    }
    r.equipes[annee] = l;
    ecrireCorReglages_(r);
  });
  journaliser_(s, p.supprimer ? 'Cor Unum : équipe supprimée' : 'Cor Unum : équipe enregistrée', (p.equipe && p.equipe.nom) || '');
  return listerCor_({ annee: annee }, s);
}

// ─── Comparaison de noms ───

function cleNom_(t) { return sansAccents_(t).replace(/[^a-z]/g, ''); }
function motsNom_(t) { return sansAccents_(t).replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(function (m) { return m.length > 1 && ['et', 'de', 'du', 'la', 'le'].indexOf(m) === -1; }); }
function levenshtein_(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 9;
  var d = [], i, j;
  for (i = 0; i <= a.length; i++) d[i] = [i];
  for (j = 0; j <= b.length; j++) d[0][j] = j;
  for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function memeNom_(a, b) { var x = cleNom_(a), y = cleNom_(b); return !!x && !!y && (x === y || (x.length > 4 && levenshtein_(x, y) <= 1)); }
function prenomCommun_(a, b) {
  var x = motsNom_(a), y = motsNom_(b);
  return x.some(function (m) { return y.some(function (n) { return m === n || (m.length > 4 && levenshtein_(m, n) <= 1); }); });
}
/** La personne (nom, prénom, e-mail) correspond-elle à la fiche x ? Nom et prénom inversés tolérés. */
function correspond_(x, nom, prenom, email) {
  var mails = String(x.email || '').toLowerCase().split(/[\s,;]+/).filter(String);
  var parNom = (memeNom_(x.nom, nom) && prenomCommun_(x.prenoms, prenom)) || (memeNom_(x.nom, prenom) && prenomCommun_(x.prenoms, nom));
  if (parNom) return true;
  return !!email && mails.indexOf(String(email).toLowerCase().trim()) > -1 && memeNom_(x.nom, nom);
}

// ─── Lecture ───

function profilsDe_(t) {
  var v = sansAccents_(t);
  return PROFILS_COR.filter(function (p) { return v.indexOf(sansAccents_(p).split(' ')[0]) > -1; });
}

// ─── Lien fiches Cor Unum ↔ dossiers (catéchumènes, néophytes, confirmands) ───

var TYPES_LIES_COR = ['catechumene', 'confirmand'];
var PROFILS_DOSSIER = ['Catéchumène', 'Néophyte', 'Confirmand'];

function dossiersLies_() {
  return lignes_('Dossiers').filter(function (d) { return TYPES_LIES_COR.indexOf(d.type) > -1; })
    .map(function (d) {
      var don = json2_(d.donnees, {}), et = don.etapes || {};
      return { id: d.id, type: d.type, nom: d.nom, email: d.email, etat: d.etat, infos: don.infos || {},
               etapes: Object.keys(et).filter(function (k) { return et[k] && et[k].fait; }) };
    });
}
/** Le dossier d correspond-il (par le nom) à la fiche x ? Nom de jeune fille et nom/prénom inversés tolérés. */
function dossierCorrespond_(x, d) {
  var i = d.infos || {};
  return correspond_(x, i.nom || '', i.prenoms || '', d.email) || (!!i.nom_jeune_fille && correspond_(x, i.nom_jeune_fille, i.prenoms || '', ''));
}
/**
 * Calcule tous les liens. Un lien posé à la main (« Relier ») l'emporte ; sinon on reconnaît par le nom,
 * sauf si le lien a été défait (« Délier »). Un dossier n'est relié qu'à une fiche par année.
 */
function liensCor_(fiches, dossiers) {
  var parFiche = {}, parDossier = {}, manuels = {};
  var ajouter = function (x, d, mode) {
    (parFiche[x.id] = parFiche[x.id] || []).push({ d: d, mode: mode });
    (parDossier[d.id] = parDossier[d.id] || []).push({ x: x, mode: mode });
  };
  var parId = {}; dossiers.forEach(function (d) { parId[d.id] = d; });
  fiches.forEach(function (x) {
    json2_(x.dossiers_lies, []).forEach(function (id) { if (parId[id]) { ajouter(x, parId[id], 'manuel'); manuels[x.annee + '|' + id] = true; } });
  });
  fiches.forEach(function (x) {
    var lies = json2_(x.dossiers_lies, []), exclus = json2_(x.dossiers_exclus, []);
    dossiers.forEach(function (d) {
      if (lies.indexOf(d.id) > -1 || exclus.indexOf(d.id) > -1 || manuels[x.annee + '|' + d.id]) return;
      if (dossierCorrespond_(x, d)) ajouter(x, d, 'auto');
    });
  });
  return { parFiche: parFiche, parDossier: parDossier };
}
/** Profils affichés : ceux du dossier remplacent Catéchumène / Néophyte / Confirmand saisis. */
function profilsDossier_(liens) {
  var p = [];
  (liens || []).forEach(function (l) {
    var d = l.d;
    if (d.type === 'catechumene') p.push(d.etapes.indexOf('sacrements') > -1 ? 'Néophyte' : 'Catéchumène');
    if (d.type === 'confirmand' && d.etat === 'ouvert' && d.etapes.indexOf('confirmation') === -1) p.push('Confirmand');
  });
  return p.filter(function (v, k) { return p.indexOf(v) === k; });
}
function profilsEffectifs_(x, liens) {
  var saisis = json2_(x.profils, []);
  if (!liens || !liens.length) return saisis;
  var auto = profilsDossier_(liens);
  return auto.concat(saisis.filter(function (p) { return PROFILS_DOSSIER.indexOf(p) === -1 && auto.indexOf(p) === -1; }));
}

function corPublic_(x, liensFiche) {
  var o = {};
  COLONNES_COR.forEach(function (k) { o[k] = x[k]; });
  o.sources = undefined; o.dossiers_lies = undefined; o.dossiers_exclus = undefined;
  o.profils = profilsEffectifs_(x, liensFiche);
  o.profils_auto = liensFiche && liensFiche.length ? profilsDossier_(liensFiche) : [];
  o.nouveau = /non/i.test(x.deja_participe || '') || /non/i.test(x.rester || '');
  o.chef_possible = /oui/i.test(x.chef_possible || '');
  o.dossiers = (liensFiche || []).map(function (l) { return { id: l.d.id, type: l.d.type, nom: l.d.nom, etat: l.d.etat, etapes: l.d.etapes, mode: l.mode }; });
  return o;
}

function listerCor_(p) {
  feuilleCor_();
  var r = corReglages_();
  var toutes = lignes_('CorUnum');
  var annees = {};
  toutes.forEach(function (x) { annees[x.annee] = true; });
  r.feuilles.forEach(function (f) { annees[f.annee] = true; });
  Object.keys(r.equipes).forEach(function (a) { annees[a] = true; });
  var liste = Object.keys(annees).sort().reverse();
  var annee = p.annee || r.feuilles.map(function (f) { return f.annee; }).sort().reverse()[0] || anneeScolaire_();
  var liens = liensCor_(toutes, dossiersLies_());
  return {
    annee: annee, annees: liste, profils: PROFILS_COR, lien_formulaire: r.lien_formulaire,
    onglets_repris: !!r.onglets_repris[annee],
    equipes: equipesDe_(r, annee).map(function (e) { return { id: e.id, nom: e.nom, chefs: e.chefs || [], fil: !!e.fil }; }),
    fils: resumeFils_(equipesDe_(r, annee)),
    membres: toutes.filter(function (x) { return x.annee === annee; }).map(function (x) { return corPublic_(x, liens.parFiche[x.id]); })
      .sort(function (a, b) { return (a.nom + ' ' + a.prenoms).localeCompare(b.nom + ' ' + b.prenoms, 'fr'); })
  };
}

/** Fraternité d'un dossier à partir des liens calculés (année la plus récente, membre actif d'abord). */
function fraterniteDepuisLiens_(l, r) {
  if (!l || !l.length) return null;
  var x = l.slice().sort(function (a, b) {
    return String(b.x.annee).localeCompare(String(a.x.annee)) || ((a.x.statut === 'ancien') - (b.x.statut === 'ancien'));
  })[0];
  var e = equipesDe_(r, x.x.annee).filter(function (y) { return y.id === x.x.equipe_id; })[0];
  var chefs = e ? lignes_cache_('CorUnum').filter(function (y) { return (e.chefs || []).indexOf(y.id) > -1; }).map(function (y) { return (y.prenoms + ' ' + y.nom).trim(); }) : [];
  return { id: x.x.id, annee: x.x.annee, equipe: e ? e.nom : '', chefs: chefs, ancien: x.x.statut === 'ancien', mode: x.mode };
}
var CACHE_LIGNES_ = {};
function lignes_cache_(nom) { return CACHE_LIGNES_[nom] || (CACHE_LIGNES_[nom] = lignes_(nom)); }

/** Pour la page d'un dossier : la fraternité de la personne, s'il y en a une. */
function fraterniteDuDossier_(d) {
  if (TYPES_LIES_COR.indexOf(d.type) === -1) return null;
  if (!db_().getSheetByName('CorUnum')) return null;
  feuilleCor_();
  var liens = liensCor_(lignes_('CorUnum'), dossiersLies_());
  return fraterniteDepuisLiens_(liens.parDossier[d.id], corReglages_());
}
/** Pour la liste des dossiers : nom de la fraternité de chaque dossier relié. */
function fraternitesDesDossiers_() {
  if (!db_().getSheetByName('CorUnum')) return {};
  var r = corReglages_(), liens = liensCor_(lignes_('CorUnum'), dossiersLies_()), res = {};
  Object.keys(liens.parDossier).forEach(function (id) {
    var f = fraterniteDepuisLiens_(liens.parDossier[id], r);
    if (f) res[id] = { equipe: f.equipe, annee: f.annee, id: f.id, ancien: f.ancien };
  });
  return res;
}

/** « Relier » ou « Délier » à la main une fiche Cor Unum et un dossier. */
function relierCor_(p, s) {
  if (!p.fiche_id || !p.dossier_id) throw erreur_('PARAMETRE', 'Fiche ou dossier manquant.');
  var d = trouverDossier_(p.dossier_id);
  if (!d || TYPES_LIES_COR.indexOf(d.type) === -1) throw erreur_('INTROUVABLE', 'Seuls les dossiers de catéchumènes et de confirmands peuvent être reliés.');
  var nomFiche = '';
  verrou_(function () {
    feuilleCor_();
    var toutes = lignes_('CorUnum');
    var x = toutes.filter(function (y) { return y.id === p.fiche_id; })[0];
    if (!x) throw erreur_('INTROUVABLE', 'Fiche introuvable.');
    nomFiche = (x.prenoms + ' ' + x.nom).trim();
    var sans = function (l, v) { return l.filter(function (k) { return k !== v; }); };
    var avec = function (l, v) { return l.indexOf(v) > -1 ? l : l.concat([v]); };
    if (p.delier) {
      x.dossiers_lies = JSON.stringify(sans(json2_(x.dossiers_lies, []), d.id));
      x.dossiers_exclus = JSON.stringify(avec(json2_(x.dossiers_exclus, []), d.id));
      ecrireLigne_('CorUnum', x);
    } else {
      // une seule fiche par dossier et par année : les autres fiches de l'année sont déliées
      toutes.filter(function (y) { return y.annee === x.annee && y.id !== x.id; }).forEach(function (y) {
        var lies = json2_(y.dossiers_lies, []), excl = json2_(y.dossiers_exclus, []);
        if (lies.indexOf(d.id) > -1 || (excl.indexOf(d.id) === -1 && dossierCorrespond_(y, { infos: json2_(d.donnees, {}).infos || {}, email: d.email }))) {
          y.dossiers_lies = JSON.stringify(sans(lies, d.id)); y.dossiers_exclus = JSON.stringify(avec(excl, d.id));
          ecrireLigne_('CorUnum', y);
        }
      });
      x.dossiers_lies = JSON.stringify(avec(json2_(x.dossiers_lies, []), d.id));
      x.dossiers_exclus = JSON.stringify(sans(json2_(x.dossiers_exclus, []), d.id));
      ecrireLigne_('CorUnum', x);
    }
  });
  journaliser_(s, p.delier ? 'Cor Unum : lien défait' : 'Cor Unum : dossier relié', nomFiche + ' ↔ ' + d.nom);
  return { fraternite: fraterniteDuDossier_(d) };
}

// ─── Modification ───

var CHAMPS_COR_MODIF = ['nom', 'prenoms', 'email', 'telephone', 'adresse', 'situation', 'chef_possible', 'souhait', 'groupe_service', 'equipe_id', 'equipe_proposee', 'statut', 'note'];
function modifierCor_(p, s) {
  verrou_(function () {
    (p.ids || [p.id]).forEach(function (id) {
      var x = lignes_('CorUnum').filter(function (y) { return y.id === id; })[0];
      if (!x) throw erreur_('INTROUVABLE', 'Fiche introuvable.');
      CHAMPS_COR_MODIF.forEach(function (k) { if (p[k] !== undefined) x[k] = typeof p[k] === 'boolean' ? (p[k] ? 'Oui' : 'Non') : String(p[k]); });
      if (p.profils) x.profils = JSON.stringify(p.profils.filter(function (y) { return PROFILS_COR.indexOf(y) > -1; }));
      if (p.equipe_id !== undefined && p.equipe_id) { x.equipe_proposee = ''; if (x.statut !== 'ancien' || p.statut === undefined) x.statut = x.statut || 'actif'; }
      x.maj_le = maintenant_(); x.maj_par = s.nom;
      ecrireLigne_('CorUnum', x);
    });
  });
  return listerCor_({ annee: p.annee }, s);
}
function creerCor_(p, s) {
  verrou_(function () {
    feuilleCor_();
    ecrireLigne_('CorUnum', {
      id: uid_(), annee: p.annee || anneeScolaire_(), cree_le: maintenant_(), sources: '["saisie"]',
      nom: String(p.nom || '').trim(), prenoms: String(p.prenoms || '').trim(), email: p.email || '', telephone: p.telephone || '', adresse: p.adresse || '',
      profils: JSON.stringify(p.profils || []), situation: p.situation || '', deja_participe: '', rester: '', chef_indique: '', chef_possible: p.chef_possible ? 'Oui' : '', souhait: p.souhait || '',
      groupe_service: '', equipe_id: p.equipe_id || '', equipe_proposee: '', statut: 'actif', note: p.note || '', maj_le: maintenant_(), maj_par: s.nom
    });
  });
  journaliser_(s, 'Cor Unum : inscription', (p.prenoms || '') + ' ' + (p.nom || ''));
  return listerCor_({ annee: p.annee }, s);
}
function supprimerCor_(p, s) {
  verrou_(function () {
    var x = lignes_('CorUnum').filter(function (y) { return y.id === p.id; })[0];
    if (!x) throw erreur_('INTROUVABLE', 'Fiche introuvable.');
    feuilleCor_().deleteRow(x._ligne); oublierLignes_();
    journaliser_(s, 'Cor Unum : fiche supprimée', x.prenoms + ' ' + x.nom);
  });
  return listerCor_({ annee: p.annee }, s);
}

// ─── Import : réponses au formulaire ───

/** Équipe proposée : « rester dans la même équipe » + nom du chef, ou personne souhaitée. */
function equipeProposee_(x, equipes, membres) {
  var chefDe = function (eq) { return (eq.chefs || []).map(function (cid) { return membres.filter(function (m) { return m.id === cid; })[0]; }).filter(Boolean); };
  // texte qui nomme le chef : nom de l'équipe, nom du chef, ou prénom du chef (mot entier)
  var parChef = function (texte, prenomMin) {
    var cle = cleNom_(texte), mots = motsNom_(texte);
    if (!cle) return '';
    var e = equipes.filter(function (eq) {
      if (cle.indexOf(cleNom_(eq.nom)) > -1) return true;
      return chefDe(eq).some(function (c) {
        return cle.indexOf(cleNom_(c.nom)) > -1 || motsNom_(c.prenoms).some(function (pr) { return pr.length >= prenomMin && mots.indexOf(pr) > -1; });
      });
    })[0];
    return e ? e.id : '';
  };
  if (/oui/i.test(x.rester)) { var a = parChef(x.chef_indique, 3); if (a) return a; }
  if (x.souhait) {
    var cle = cleNom_(x.souhait);
    var m = membres.filter(function (y) { return y.equipe_id && y.id !== x.id && y.statut !== 'ancien' && cleNom_(y.nom).length > 2 && cle.indexOf(cleNom_(y.nom)) > -1; })[0];
    if (m) return m.equipe_id;
    var b = parChef(x.souhait, 5);
    if (b) return b;
  }
  return '';
}

function reponseCor_(rep) {
  var cles = Object.keys(rep);
  var col = function (re, exclure) {
    return cles.filter(function (h) { return re.test(sansAccents_(h)) && (!exclure || !exclure.test(sansAccents_(h))); })
      .map(function (h) { return String(rep[h] || '').trim(); });
  };
  var premier = function (re, exclure) { return col(re, exclure).filter(String)[0] || ''; };
  var jeSuis = col(/^je suis/);
  var profil = jeSuis.filter(function (v) { return profilsDe_(v).length; }).join(', ');
  var situation = jeSuis.filter(function (v) { return v && !profilsDe_(v).length; })[0] || '';
  return {
    horodateur: premier(/horodateur/), email: premier(/adresse e-?mail/).toLowerCase(),
    nom: premier(/^nom$/), prenoms: premier(/^prenom/), telephone: premier(/telephone/), adresse: premier(/adresse postale/),
    profils: profilsDe_(profil), situation: situation,
    deja_participe: premier(/deja participe/), rester: premier(/rester dans la meme equipe/), chef_indique: premier(/nom de mon chef/),
    chef_possible: premier(/devenir chef/), souhait: premier(/souhaiterais retrouver/), groupe_service: premier(/groupe ou d.un service/)
  };
}

function importerCorUnum() { return importerCor_({}, { nom: 'Formulaire Cor Unum', uid: '' }); }

function importerCor_(p, s) {
  var r = corReglages_();
  feuilleCor_();
  var res = { nouvelles: 0, fusionnees: 0, erreurs: [] };
  r.feuilles.forEach(function (f) {
    if (p.annee && p.annee !== f.annee) return;
    var ss;
    try { ss = SpreadsheetApp.openById(f.id); } catch (e) { res.erreurs.push('Feuille ' + f.annee + ' introuvable'); return; }
    var v = ss.getSheets()[0].getDataRange().getDisplayValues();
    var entetes = v.shift();
    var reps = v.filter(function (l) { return l.join('').trim(); }).map(function (l) {
      var rep = {};
      entetes.forEach(function (h, j) { rep[h + (rep[h] !== undefined ? ' #' + j : '')] = l[j]; });
      var x = reponseCor_(rep);
      x.cle = f.id + ':' + x.horodateur + ':' + x.email + ':' + cleNom_(x.prenoms);
      return x;
    });
    verrou_(function () {
      var membres = lignes_('CorUnum').filter(function (x) { return x.annee === f.annee; });
      var equipes = equipesDe_(r, f.annee);
      reps.forEach(function (rep) {
        if (!rep.nom && !rep.prenoms) return;
        if (membres.some(function (x) { return json2_(x.sources, []).indexOf(rep.cle) > -1; })) return;
        var x = membres.filter(function (y) { return correspond_(y, rep.nom, rep.prenoms, rep.email); })[0];
        var nouveau = !x;
        if (nouveau) {
          x = { id: uid_(), annee: f.annee, cree_le: maintenant_(), sources: '[]', nom: rep.nom, prenoms: rep.prenoms, email: '', telephone: '', adresse: '',
                profils: '[]', situation: '', deja_participe: '', rester: '', chef_indique: '', chef_possible: '', souhait: '', groupe_service: '',
                equipe_id: '', equipe_proposee: '', statut: 'actif', note: '' };
        }
        // La réponse la plus récente l'emporte ; les souhaits sont cumulés ; un foyer garde ses deux adresses
        var mails = String(x.email || '').split(/[\s,;]+/).filter(String);
        if (rep.email && mails.map(function (m) { return m.toLowerCase(); }).indexOf(rep.email) === -1) mails.push(rep.email);
        x.email = mails.join(', ');
        ['telephone', 'adresse', 'situation', 'deja_participe', 'rester', 'chef_indique', 'chef_possible', 'groupe_service'].forEach(function (k) { if (rep[k]) x[k] = rep[k]; });
        if (rep.souhait && String(x.souhait || '').indexOf(rep.souhait) === -1) x.souhait = [x.souhait, rep.souhait].filter(String).join(' ; ');
        var pr = json2_(x.profils, []);
        rep.profils.forEach(function (y) { if (pr.indexOf(y) === -1) pr.push(y); });
        x.profils = JSON.stringify(pr);
        x.sources = JSON.stringify(json2_(x.sources, []).concat([rep.cle]));
        if (x.statut === 'ancien') x.statut = 'actif';
        if (!x.equipe_id) x.equipe_proposee = equipeProposee_(x, equipes, membres);
        x.maj_le = maintenant_(); x.maj_par = s.nom;
        ecrireLigne_('CorUnum', x);
        if (nouveau) { membres.push(x); res.nouvelles++; } else res.fusionnees++;
      });
    });
  });
  if (res.nouvelles) {
    journaliser_(s, 'Cor Unum : inscriptions importées', res.nouvelles + ' nouvelles, ' + res.fusionnees + ' mises à jour');
    lignes_('Utilisateurs').filter(estActif_).forEach(function (u) {
      if (u.id !== s.uid) notifier_(u.id, 'Cor Unum : inscription reçue', res.nouvelles === 1 ? '1 nouvelle inscription à répartir' : res.nouvelles + ' nouvelles inscriptions', '#/cor-unum');
    });
  }
  return res;
}

/** Regroupe la fiche z dans x (même foyer). */
function fusionnerCor_(x, z) {
  var mails = String(x.email || '').split(/[\s,;]+/).filter(String);
  String(z.email || '').split(/[\s,;]+/).filter(String).forEach(function (e) { if (mails.map(function (m) { return m.toLowerCase(); }).indexOf(e.toLowerCase()) === -1) mails.push(e); });
  x.email = mails.join(', ');
  var pr = motsNom_(x.prenoms);
  if (!motsNom_(z.prenoms).every(function (m) { return pr.indexOf(m) > -1; })) x.prenoms = [x.prenoms, z.prenoms].filter(String).join(' et ');
  ['telephone', 'adresse', 'situation', 'deja_participe', 'rester', 'chef_indique', 'groupe_service'].forEach(function (k) { if (!x[k] && z[k]) x[k] = z[k]; });
  if (/oui/i.test(z.chef_possible)) x.chef_possible = 'Oui';
  if (z.souhait && String(x.souhait || '').indexOf(z.souhait) === -1) x.souhait = [x.souhait, z.souhait].filter(String).join(' ; ');
  var p1 = json2_(x.profils, []); json2_(z.profils, []).forEach(function (y) { if (p1.indexOf(y) === -1) p1.push(y); }); x.profils = JSON.stringify(p1);
  x.sources = JSON.stringify(json2_(x.sources, []).concat(json2_(z.sources, [])));
  ['dossiers_lies', 'dossiers_exclus'].forEach(function (k) {
    var l = json2_(x[k], []); json2_(z[k], []).forEach(function (y) { if (l.indexOf(y) === -1) l.push(y); }); x[k] = JSON.stringify(l);
  });
  if (z.statut === 'actif') x.statut = 'actif';
}

// ─── Reprise des onglets « Equipe … » de la feuille (une fois) ───

function nomEquipe_(t) {
  return String(t || '').trim().toLowerCase().split(/\s+/).map(function (m, i, l) {
    return (i === 0 && l.length > 1 && ['du', 'de', 'des', 'le', 'la'].indexOf(m) > -1) ? m : m.charAt(0).toUpperCase() + m.slice(1);
  }).join(' ');
}

function reprendreOngletsCor_(p, s) {
  var r = corReglages_();
  var f = r.feuilles.filter(function (y) { return y.annee === p.annee; })[0];
  if (!f) throw erreur_('INVALIDE', 'Aucune feuille de réponses pour ' + p.annee + '.');
  var ss = SpreadsheetApp.openById(f.id);
  var res = { equipes: 0, membres: 0, anciens: 0 };
  verrou_(function () {
    feuilleCor_();
    var membres = lignes_('CorUnum').filter(function (x) { return x.annee === p.annee; });
    var equipes = equipesDe_(r, p.annee);
    var places = {};
    ss.getSheets().filter(function (sh) { return /^\s*equipe/i.test(sansAccents_(sh.getName())); }).forEach(function (sh) {
      var lignes = sh.getDataRange().getDisplayValues();
      var nomOnglet = sh.getName().replace(/^\s*[ée]quipe\s*/i, '').trim();
      // En-tête (légende + « Nom, Prénom… ») puis membres ; une ligne vide sépare les anciens
      var i = 0;
      while (i < lignes.length && !/^nom$/i.test(String(lignes[i][0]).trim())) i++;
      i++;
      var personnes = [], ancien = false;
      for (; i < lignes.length; i++) {
        var l = lignes[i].map(function (c) { return String(c || '').trim(); });
        if (!l[0] && !l[1]) { if (personnes.length) ancien = true; continue; }
        personnes.push({ nom: l[0], prenom: l[1], tel: l[2], email: /@/.test(l[3]) ? l[3].toLowerCase() : '', note: l[4] || (l[3] && !/@/.test(l[3]) ? l[3] : ''), ancien: ancien });
      }
      // Foyers : lignes consécutives au même nom (avec la même adresse ou sans adresse)
      var foyers = [];
      personnes.forEach(function (x) {
        var prec = foyers[foyers.length - 1];
        if (prec && prec.ancien === x.ancien && memeNom_(prec.nom, x.nom) && (!x.email || !prec.emails.length || prec.emails.indexOf(x.email) > -1 || prec.prenoms.length === 1)) {
          prec.prenoms.push(x.prenom); if (x.email && prec.emails.indexOf(x.email) === -1) prec.emails.push(x.email);
          if (x.tel && prec.tels.indexOf(x.tel) === -1) prec.tels.push(x.tel); if (x.note) prec.notes.push(x.note);
        } else foyers.push({ nom: x.nom, prenoms: [x.prenom], emails: x.email ? [x.email] : [], tels: x.tel ? [x.tel] : [], notes: x.note ? [x.note] : [], ancien: x.ancien });
      });
      if (!foyers.length) return;
      var chef = foyers.filter(function (y) { return memeNom_(y.nom, nomOnglet); })[0] || foyers[0];
      var nom = nomEquipe_(chef.nom || nomOnglet);
      var eq = equipes.filter(function (e) { return memeNom_(e.nom, nom); })[0];
      if (!eq) { eq = { id: uid_(), nom: nom, chefs: [], fil: uid_(), jeton: jeton_() }; equipes.push(eq); res.equipes++; }
      foyers.forEach(function (y) {
        var prenoms = y.prenoms.filter(String).join(' et ');
        // Fiches déjà créées par le formulaire pour ce foyer (souvent une par conjoint) : regroupées en une seule
        var trouves = membres.filter(function (m) { return !m._supprime && y.prenoms.some(function (pr) { return correspond_(m, y.nom, pr, y.emails[0]); }); });
        var x = trouves.filter(function (m) { return !places[m.id]; })[0] || trouves[0];
        trouves.forEach(function (z) { if (z !== x && !places[z.id] && x) { fusionnerCor_(x, z); z._supprime = true; } });
        // déjà placé plus haut comme membre actif (ex. même personne listée aussi parmi les anciens d'une équipe) : on n'y touche plus
        if (x && places[x.id] && (y.ancien || places[x.id] === 'actif')) return;
        if (!x) {
          x = { id: uid_(), annee: p.annee, cree_le: maintenant_(), sources: '["onglet"]', nom: y.nom, prenoms: prenoms, email: y.emails.join(', '), telephone: y.tels.join(' / '),
                adresse: '', profils: '[]', situation: '', deja_participe: '', rester: '', chef_indique: '', chef_possible: '', souhait: '', groupe_service: '',
                equipe_id: '', equipe_proposee: '', statut: '', note: '' };
          membres.push(x);
        } else {
          if (!memeNom_(x.nom, y.nom) || motsNom_(prenoms).length > motsNom_(x.prenoms).length) { x.nom = y.nom; x.prenoms = prenoms; }
          y.emails.forEach(function (e) { if (String(x.email).toLowerCase().indexOf(e) === -1) x.email = [x.email, e].filter(String).join(', '); });
          if (!x.telephone) x.telephone = y.tels.join(' / ');
        }
        places[x.id] = y.ancien ? 'ancien' : 'actif';
        x.equipe_id = eq.id; x.equipe_proposee = '';
        x.statut = y.ancien && x.statut !== 'actif' ? 'ancien' : (x.statut || 'actif');
        if (y.ancien && json2_(x.sources, []).some(function (z) { return z !== 'onglet'; })) x.statut = 'actif';   // réinscrit par le formulaire
        if (y.notes.length) x.note = [x.note, y.notes.join(' ; ')].filter(String).join(' ; ');
        x.maj_le = maintenant_(); x.maj_par = s.nom;
        ecrireLigne_('CorUnum', x);
        if (y === chef && eq.chefs.indexOf(x.id) === -1) eq.chefs.push(x.id);
        if (x.statut === 'ancien') res.anciens++; else res.membres++;
      });
    });
    membres.filter(function (m) { return m._supprime && m._ligne; }).sort(function (a, b) { return b._ligne - a._ligne; })
      .forEach(function (m) { feuilleCor_().deleteRow(m._ligne); res.regroupees = (res.regroupees || 0) + 1; }); oublierLignes_();
    r.equipes[p.annee] = equipes;
    r.onglets_repris[p.annee] = true;
    ecrireCorReglages_(r);
  });
  journaliser_(s, 'Cor Unum : équipes reprises des onglets', res.equipes + ' équipes, ' + res.membres + ' membres, ' + res.anciens + ' anciens');
  // Les inscrits pas encore placés reçoivent une proposition d'équipe
  verrou_(function () {
    var eqs = equipesDe_(corReglages_(), p.annee);
    var ms = lignes_('CorUnum').filter(function (x) { return x.annee === p.annee; });
    ms.forEach(function (x) { if (!x.equipe_id) { var e = equipeProposee_(x, eqs, ms); if (e !== x.equipe_proposee) { x.equipe_proposee = e; ecrireLigne_('CorUnum', x); } } });
  });
  res.liste = listerCor_({ annee: p.annee }, s);
  return res;
}

// ─── Nouvelle année : équipes et chefs reconduits, membres « anciens » jusqu'à leur réinscription ───

function nouvelleAnneeCor_(p, s) {
  var de = String(p.de || ''), vers = String(p.vers || '');
  if (!/^\d{4}-\d{4}$/.test(de) || !/^\d{4}-\d{4}$/.test(vers) || de === vers) throw erreur_('INVALIDE', 'Années invalides.');
  verrou_(function () {
    var r = corReglages_();
    if ((r.equipes[vers] || []).length) throw erreur_('INVALIDE', 'Des équipes existent déjà pour ' + vers + '.');
    feuilleCor_();
    var anciens = lignes_('CorUnum').filter(function (x) { return x.annee === de && x.statut !== 'ancien' && x.equipe_id; });
    var corresp = {}, idsMembres = {};
    assurerJetons_(r);
    r.equipes[vers] = (r.equipes[de] || []).map(function (e) { var n = { id: uid_(), nom: e.nom, chefs: [], fil: e.fil, jeton: e.jeton }; corresp[e.id] = n; return n; });
    anciens.forEach(function (x) {
      var y = {};
      COLONNES_COR.forEach(function (k) { y[k] = x[k]; });
      y.id = uid_(); y.annee = vers; y.cree_le = maintenant_(); y.sources = '["reconduction"]';
      y.equipe_id = corresp[x.equipe_id] ? corresp[x.equipe_id].id : ''; y.equipe_proposee = '';
      y.statut = 'ancien'; y.deja_participe = ''; y.rester = ''; y.chef_indique = ''; y.souhait = '';
      y.maj_le = maintenant_(); y.maj_par = s.nom;
      ecrireLigne_('CorUnum', y);
      idsMembres[x.id] = y.id;
    });
    (r.equipes[de] || []).forEach(function (e) {
      if (corresp[e.id]) corresp[e.id].chefs = (e.chefs || []).map(function (c) { return idsMembres[c]; }).filter(String);
    });
    ecrireCorReglages_(r);
  });
  journaliser_(s, 'Cor Unum : nouvelle année', de + ' → ' + vers);
  return listerCor_({ annee: vers }, s);
}

// ─── Mails ───

/** Mail à une liste de fiches (copie cachée) ; p.boutons possibles (lien du formulaire). */
function envoyerCor_(p, s) {
  feuilleCor_();
  var ids = p.ids || [];
  var emails = [];
  lignes_('CorUnum').filter(function (x) { return ids.indexOf(x.id) > -1; }).forEach(function (x) {
    String(x.email || '').split(/[\s,;]+/).filter(function (e) { return /@/.test(e); }).forEach(function (e) {
      e = e.toLowerCase(); if (emails.indexOf(e) === -1) emails.push(e);
    });
  });
  if (!emails.length) throw erreur_('INVALIDE', 'Aucune adresse e-mail parmi les personnes choisies.');
  var quota = MailApp.getRemainingDailyQuota();
  if (emails.length + 1 > quota) throw erreur_('QUOTA', 'Quota Gmail insuffisant aujourd\'hui : ' + quota + ' destinataires restants.');
  var opts = optionsEnvoi_();
  for (var i = 0; i < emails.length; i += 90) {
    var o = { name: opts.name, from: opts.from, htmlBody: corpsHtml_(p.corps, p.signature, p.boutons), bcc: emails.slice(i, i + 90).join(',') };
    GmailApp.sendEmail(CONFIG.ALIAS, p.sujet || '', corpsTexte_(p.corps, p.signature, p.boutons), o);
  }
  journaliser_(s, 'Cor Unum : mail', (p.sujet || '') + ' → ' + emails.length + ' destinataires');
  return { nb: emails.length };
}

// ─────────────── Page des chefs de fraternité (sans compte : lien secret) ───────────────
// Chaque fraternité a un « jeton » (lien personnel du chef) et un « fil » (messages et rencontres),
// reconduits d'une année sur l'autre. La page publique fraternite/?c=<jeton> appelle les actions chef.*.

var COLONNES_FIL = ['id', 'fil', 'type', 'date', 'auteur', 'cote', 'texte', 'lieu', 'lu'];
function feuilleFil_() {
  var f = db_().getSheetByName('CorUnumFils');
  if (!f) {
    f = db_().insertSheet('CorUnumFils');
    f.getRange('A:Z').setNumberFormat('@');
    f.appendRow(COLONNES_FIL);
    f.setFrozenRows(1);
  }
  return f;
}
function jeton_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32); }

/** Complète jeton et fil des fraternités qui n'en ont pas encore. */
function assurerJetons_(r) {
  var change = false;
  Object.keys(r.equipes).forEach(function (a) {
    r.equipes[a].forEach(function (e) {
      if (!e.fil) { e.fil = uid_(); change = true; }
      if (!e.jeton) { e.jeton = jeton_(); change = true; }
    });
  });
  return change;
}

// ─── Mot de passe des chefs (sans compte dans l'appli) ───
// Le lien secret reste nécessaire ; la page demande en plus le mot de passe de la fraternité.
// Le chef le choisit lui-même après avoir reçu un code par mail (première fois ou oubli).
// Rangé par fraternité (clé « fil », stable d'une année à l'autre et quand le lien change).

var CHEF_SESSION_JOURS = 90;
function mdpChefs_() { return json2_(props_().getProperty('CHEFS_MDP'), {}); }
function secretChef_() {
  var p = props_(), x = p.getProperty('CHEF_SECRET');
  if (!x) { x = jeton_() + jeton_(); p.setProperty('CHEF_SECRET', x); }
  return x;
}
function signatureChef_(fil, exp, hash) {
  return hex_(Utilities.computeHmacSha256Signature(fil + '|' + exp + '|' + String(hash).slice(0, 16), secretChef_())).slice(0, 40);
}
function nouvelleSessionChef_(fil, m) {
  var exp = Date.now() + CHEF_SESSION_JOURS * 86400000;
  return exp + '.' + signatureChef_(fil, exp, m.hash);
}
function sessionChefValide_(fil, session) {
  if (/\.k[a-z0-9]+\./.test(String(session || ''))) { try { return sessionChefCompteValide_(fil, session); } catch (e) { return false; } }   // chef connecté avec son compte (app)
  var m = mdpChefs_()[fil];
  var x = String(session || '').split('.');
  if (!m || x.length !== 2 || Number(x[0]) < Date.now()) return false;
  return x[1] === signatureChef_(fil, x[0], m.hash);
}
/** Adresses e-mail des chefs de la fraternité. */
function mailsChefs_(ctx) {
  var ids = ctx.equipe.chefs || [];
  var l = [];
  lignes_('CorUnum').forEach(function (y) {
    if (ids.indexOf(y.id) === -1) return;
    String(y.email || '').split(/[\s,;]+/).forEach(function (m) { if (/@/.test(m) && l.indexOf(m.toLowerCase()) === -1) l.push(m.toLowerCase()); });
  });
  return l;
}
function masquerMail_(m) { var x = String(m).split('@'); return x[0].slice(0, 2) + '…@' + x[1]; }
function compteurChef_(cle, max, secondes, message) {
  var cache = CacheService.getScriptCache(), n = Number(cache.get(cle) || 0);
  if (n >= max) throw erreur_('LIMITE', message);
  cache.put(cle, String(n + 1), secondes);
}

/** Actions d'accès (état, connexion, code, choix du mot de passe) ; vérifie la session pour toutes les autres. */
function accesChef_(action, p, ctx) {
  var e = ctx.equipe, fil = e.fil;
  var tous = mdpChefs_(), m = tous[fil];
  if (action === 'chef.etat') {
    return { nom: e.nom, mot_de_passe: !!m, mails: mailsChefs_(ctx).map(masquerMail_), session: sessionChefValide_(fil, p.session) };
  }
  if (action === 'chef.connexion') {
    if (!m) throw erreur_('MDP', 'Aucun mot de passe n\'est encore choisi : utilisez « Choisir mon mot de passe ».');
    compteurChef_('chefmdp_' + fil, 10, 900, 'Trop d\'essais. Réessayez dans un quart d\'heure, ou utilisez « Mot de passe oublié ».');
    if (hacher_(String(p.mdp || ''), m.sel) !== m.hash) throw erreur_('MDP', 'Mot de passe incorrect.');
    return { session: nouvelleSessionChef_(fil, m) };
  }
  if (action === 'chef.code') {
    var mails = mailsChefs_(ctx);
    if (!mails.length) throw erreur_('MAIL', 'Aucune adresse e-mail n\'est connue pour le chef de cette fraternité. Contactez le secrétariat.');
    compteurChef_('chefenvoi_' + fil, 5, 3600, 'Trop de codes envoyés. Réessayez dans une heure.');
    var code = codeSur_();
    CacheService.getScriptCache().put('chefcode_' + fil, JSON.stringify({ code: code, essais: 0 }), 900);
    var texte = 'Bonjour,\n\nVoici le code pour choisir le mot de passe de la page de votre fraternité Cor Unum (' + e.nom + ') :\n\n' + code +
      '\n\nIl est valable 15 minutes. Si vous n\'avez rien demandé, ignorez ce message.\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
    var opts = optionsEnvoi_();
    opts.htmlBody = corpsHtml_(texte, 'paroisse');
    GmailApp.sendEmail(mails.join(','), 'Fraternité Cor Unum – votre code : ' + code, corpsTexte_(texte, 'paroisse'), opts);
    return { mails: mails.map(masquerMail_) };
  }
  if (action === 'chef.definir') {
    var cache = CacheService.getScriptCache();
    var c = json2_(cache.get('chefcode_' + fil), null);
    if (!c) throw erreur_('CODE', 'Code expiré. Demandez un nouveau code.');
    if (String(p.code || '').replace(/\s/g, '') !== c.code) {
      c.essais++;
      if (c.essais >= 5) cache.remove('chefcode_' + fil); else cache.put('chefcode_' + fil, JSON.stringify(c), 900);
      throw erreur_('CODE', c.essais >= 5 ? 'Trop d\'essais. Demandez un nouveau code.' : 'Code incorrect.');
    }
    if (String(p.mdp || '').length < 8) throw erreur_('MDP', 'Le mot de passe doit contenir au moins 8 caractères.');
    var sel = jeton_().slice(0, 16);
    var nv = { hash: hacher_(String(p.mdp), sel), sel: sel, maj: maintenant_() };
    verrou_(function () { var t = mdpChefs_(); t[fil] = nv; props_().setProperty('CHEFS_MDP', JSON.stringify(t)); });
    cache.remove('chefcode_' + fil);
    journaliser_({ nom: 'Chef – ' + e.nom, uid: '' }, 'Cor Unum : mot de passe du chef ' + (m ? 'changé' : 'choisi'), e.nom);
    return { session: nouvelleSessionChef_(fil, nv) };
  }
  if (!sessionChefValide_(fil, p.session)) throw erreur_('SESSION', 'Connectez-vous avec le mot de passe de votre fraternité.');
  return null;
}

/** Fraternité (année la plus récente) correspondant au jeton. */
function equipeParJeton_(c) {
  if (!/^[a-f0-9]{32}$/.test(String(c || ''))) throw erreur_('LIEN', 'Ce lien n\'est pas valable. Demandez un nouveau lien au secrétariat.');
  var r = corReglages_();
  var annees = Object.keys(r.equipes).sort().reverse();
  for (var i = 0; i < annees.length; i++) {
    var e = r.equipes[annees[i]].filter(function (y) { return y.jeton === c; })[0];
    if (e) return { r: r, annee: annees[i], equipe: e };
  }
  throw erreur_('LIEN', 'Ce lien n\'est plus valable. Demandez un nouveau lien au secrétariat.');
}

function elementsFil_(fil) {
  feuilleFil_();
  return lignes_('CorUnumFils').filter(function (x) { return x.fil === fil; })
    .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
}
function messagePublic_(x) { return { id: x.id, date: x.date, auteur: x.auteur, cote: x.cote, texte: x.texte }; }
function rencontrePublique_(x) { return { id: x.id, date: x.texte, lieu: x.lieu, note: x.auteur }; }

/** Vue du chef : sa fraternité, ses membres (coordonnées, profils), anciens, rencontres, messages. */
function vueChef_(ctx) {
  var e = ctx.equipe;
  var toutes = lignes_('CorUnum');
  var membres = toutes.filter(function (x) { return x.annee === ctx.annee && x.equipe_id === e.id; });
  var liens = { parFiche: {} };
  try { liens = liensCor_(membres, dossiersLies_()); } catch (er) { /* sans dossiers */ }
  var pub = function (x) {
    return { id: x.id, nom: x.nom, prenoms: x.prenoms, email: x.email, telephone: x.telephone, adresse: x.adresse,
             profils: profilsEffectifs_(x, liens.parFiche[x.id]), nouveau: /non/i.test(x.deja_participe || '') || /non/i.test(x.rester || ''),
             chef: (e.chefs || []).indexOf(x.id) > -1, statut: x.statut || 'actif', note: x.statut === 'ancien' ? x.note : '' };
  };
  var fil = elementsFil_(e.fil);
  return {
    annee: ctx.annee, nom: e.nom, paroisse: reglages_().paroisse, lien_inscription: e.jeton_inscr && ctx.annee === anneeCorCourante_(ctx.r) ? urlRejoindre_(e.jeton_inscr) : '',
    membres: membres.filter(function (x) { return x.statut !== 'ancien'; }).map(pub),
    anciens: membres.filter(function (x) { return x.statut === 'ancien'; }).map(pub),
    rencontres: fil.filter(function (x) { return x.type === 'rencontre'; }).map(rencontrePublique_),
    messages: fil.filter(function (x) { return x.type === 'message'; }).map(messagePublic_),
    profils: PROFILS_COR
  };
}

function nomsChefs_(ctx) {
  var ids = ctx.equipe.chefs || [];
  return lignes_('CorUnum').filter(function (x) { return ids.indexOf(x.id) > -1; });
}
function prevenirEquipeParoisse_(titre, texte, annee) {
  lignes_('Utilisateurs').filter(estActif_).forEach(function (u) { notifier_(u.id, titre, texte, '#/cor-unum?annee=' + annee); });
}

/** Point d'entrée public des pages de chef (doPost, sans session). */
function actionChef_(action, p) {
  // limite simple : 120 actions par heure et par lien
  var cache = CacheService.getScriptCache(), cle = 'chef_' + String(p.c || '').slice(0, 32);
  var n = Number(cache.get(cle) || 0);
  if (n > 120) throw erreur_('LIMITE', 'Trop d\'actions en peu de temps. Réessayez dans une heure.');
  cache.put(cle, String(n + 1), 3600);

  var ctx = equipeParJeton_(p.c);
  var e = ctx.equipe;
  var acces = accesChef_(action, p, ctx);
  if (acces) return acces;
  var qui = 'Chef – ' + e.nom;
  var s = { nom: qui, uid: '' };
  feuilleCor_();
  var membreDeLEquipe = function (id) {
    var x = lignes_('CorUnum').filter(function (y) { return y.id === id && y.annee === ctx.annee && y.equipe_id === e.id; })[0];
    if (!x) throw erreur_('INTROUVABLE', 'Membre introuvable dans votre fraternité.');
    return x;
  };
  var court = function (t, max) { return String(t || '').trim().slice(0, max || 300); };

  if (action === 'chef.lire') {
    if (ctx.annee === anneeCorCourante_(ctx.r)) ctx.equipe.jeton_inscr = jetonInscription_(ctx.annee, e.id, false);
    return vueChef_(ctx);
  }
  if (action === 'chef.lienInscription') {
    if (ctx.annee !== anneeCorCourante_(ctx.r)) throw erreur_('ANNEE', 'Lien indisponible.');
    ctx.equipe.jeton_inscr = jetonInscription_(ctx.annee, e.id, true);
    journaliser_(s, 'Cor Unum : nouveau lien d\'inscription (chef)', e.nom);
    return vueChef_(ctx);
  }
  if (action === 'chef.inviter') {
    if (!e.jeton_inscr || ctx.annee !== anneeCorCourante_(ctx.r)) throw erreur_('ANNEE', 'Lien indisponible.');
    var dest = String(p.emails || '').toLowerCase().split(/[\s,;]+/).filter(function (m) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m); });
    dest = dest.filter(function (m, k) { return dest.indexOf(m) === k; });
    if (!dest.length) throw erreur_('INVALIDE', 'Indiquez au moins une adresse e-mail valable.');
    if (dest.length > 10) throw erreur_('INVALIDE', '10 adresses au plus par envoi.');
    if (dest.length > MailApp.getRemainingDailyQuota()) throw erreur_('QUOTA', 'Envoi impossible aujourd\'hui (quota de la paroisse atteint). Réessayez demain.');
    var chefsI = nomsChefs_(ctx), nomsI = chefsI.map(function (x) { return (x.prenoms + ' ' + x.nom).trim(); }).join(' et ') || 'Le chef de la fraternité';
    var repI = chefsI.map(function (x) { return String(x.email || '').split(/[\s,;]+/)[0]; }).filter(function (m) { return /@/.test(m); });
    var mot = court(p.mot, 2000);
    var tI = 'Bonjour,\n\n' + nomsI + (chefsI.length > 1 || /\s(et|&)\s/i.test(nomsI) ? ' vous invitent' : ' vous invite') + ' à rejoindre la fraternité Cor Unum ' + e.nom + ' de la paroisse La Croix glorieuse.' +
      (mot ? '\n\n' + mot : '') + '\n\nPour vous inscrire, il suffit de remplir ce court formulaire :\n[Bouton : Rejoindre la fraternité]\n\nAvec l\'assurance de nos prières à toutes vos intentions,\n' + nomsI;
    var bI = [{ texte: 'Rejoindre la fraternité', url: urlRejoindre_(e.jeton_inscr) }];
    var oI = optionsEnvoi_();
    var optI = { name: 'Fraternité Cor Unum ' + e.nom, from: oI.from, htmlBody: corpsHtml_(tI, '', bI) };
    if (repI.length) optI.replyTo = repI.join(',');
    dest.forEach(function (m) { GmailApp.sendEmail(m, 'Invitation à rejoindre la fraternité Cor Unum ' + e.nom, corpsTexte_(tI, '', bI), optI); });
    journaliser_(s, 'Cor Unum : invitation envoyée par le chef', dest.join(', '));
    return { nb: dest.length };
  }

  if (action === 'chef.ajouter') {
    if (!court(p.nom) && !court(p.prenoms)) throw erreur_('INVALIDE', 'Nom ou prénom manquant.');
    verrou_(function () {
      ecrireLigne_('CorUnum', {
        id: uid_(), annee: ctx.annee, cree_le: maintenant_(), sources: '["chef"]', nom: court(p.nom, 80), prenoms: court(p.prenoms, 80),
        email: court(p.email, 120), telephone: court(p.telephone, 40), adresse: court(p.adresse, 200),
        profils: JSON.stringify((p.profils || []).filter(function (y) { return PROFILS_COR.indexOf(y) > -1; })), situation: '',
        deja_participe: 'Non', rester: '', chef_indique: '', chef_possible: '', souhait: '', groupe_service: '',
        equipe_id: e.id, equipe_proposee: '', statut: 'actif', note: 'Ajouté par le chef', maj_le: maintenant_(), maj_par: qui
      });
    });
    journaliser_(s, 'Cor Unum : membre ajouté par le chef', court(p.prenoms) + ' ' + court(p.nom));
    prevenirEquipeParoisse_('Fraternité ' + e.nom + ' : nouveau membre', court(p.prenoms) + ' ' + court(p.nom) + ' ajouté par le chef', ctx.annee);
    return vueChef_(ctx);
  }

  if (action === 'chef.modifier') {
    verrou_(function () {
      var x = membreDeLEquipe(p.id);
      ['email', 'telephone', 'adresse'].forEach(function (k) { if (p[k] !== undefined) x[k] = court(p[k], k === 'adresse' ? 200 : 120); });
      x.maj_le = maintenant_(); x.maj_par = qui;
      ecrireLigne_('CorUnum', x);
    });
    return vueChef_(ctx);
  }

  if (action === 'chef.retirer') {
    var nomR = '';
    verrou_(function () {
      var x = membreDeLEquipe(p.id);
      if (x.statut !== 'ancien') throw erreur_('INVALIDE', 'Seuls les anciens membres peuvent être retirés.');
      x.equipe_id = '';
      x.note = [x.note, 'Ancien membre de la fraternité ' + e.nom + ', retiré de la liste par le chef le ' + aujourdhui_()].filter(String).join(' ; ');
      x.maj_le = maintenant_(); x.maj_par = qui;
      ecrireLigne_('CorUnum', x);
      nomR = x.prenoms + ' ' + x.nom;
    });
    journaliser_(s, 'Cor Unum : ancien retiré par le chef', nomR);
    return vueChef_(ctx);
  }

  if (action === 'chef.menage') {
    var nomM = '';
    verrou_(function () {
      var x = membreDeLEquipe(p.id), z = membreDeLEquipe(p.avec);
      menageCor_(x, z, lignes_('CorUnum'), corReglages_(), qui);
      nomM = x.prenoms + ' ' + x.nom;
    });
    journaliser_(s, 'Cor Unum : ménage lié par le chef', nomM);
    ctx = equipeParJeton_(p.c);   // les chefs ont pu changer
    return vueChef_(ctx);
  }

  if (action === 'chef.depart') {
    var nom = '';
    verrou_(function () {
      var x = membreDeLEquipe(p.id);
      x.statut = 'ancien';
      x.note = [x.note, 'Départ signalé par le chef le ' + aujourdhui_() + (court(p.note) ? ' : ' + court(p.note) : '')].filter(String).join(' ; ');
      x.maj_le = maintenant_(); x.maj_par = qui;
      ecrireLigne_('CorUnum', x);
      nom = x.prenoms + ' ' + x.nom;
    });
    journaliser_(s, 'Cor Unum : départ signalé', nom);
    prevenirEquipeParoisse_('Fraternité ' + e.nom + ' : départ signalé', nom + (court(p.note) ? ' – ' + court(p.note) : ''), ctx.annee);
    return vueChef_(ctx);
  }

  if (action === 'chef.rencontre') {
    verrou_(function () {
      feuilleFil_();
      if (p.supprimer) {
        var x = lignes_('CorUnumFils').filter(function (y) { return y.id === p.supprimer && y.fil === e.fil && y.type === 'rencontre'; })[0];
        if (x) feuilleFil_().deleteRow(x._ligne); oublierLignes_();
      } else {
        if (!/^\d{4}-\d{2}-\d{2}/.test(String(p.date || ''))) throw erreur_('INVALIDE', 'Date manquante.');
        ecrireLigne_('CorUnumFils', { id: uid_(), fil: e.fil, type: 'rencontre', date: maintenant_(), auteur: court(p.note, 300), cote: 'chef', texte: court(p.date, 20), lieu: court(p.lieu, 200), lu: '' });
      }
    });
    return vueChef_(ctx);
  }

  if (action === 'chef.message') {
    var texte = court(p.texte, 4000);
    if (!texte) throw erreur_('INVALIDE', 'Message vide.');
    var chefs = nomsChefs_(ctx).map(function (x) { return x.prenoms + ' ' + x.nom; }).join(', ') || qui;
    verrou_(function () { feuilleFil_(); ecrireLigne_('CorUnumFils', { id: uid_(), fil: e.fil, type: 'message', date: maintenant_(), auteur: chefs, cote: 'chef', texte: texte, lieu: '', lu: '' }); });
    prevenirEquipeParoisse_('Message de la fraternité ' + e.nom, texte.slice(0, 120), ctx.annee);
    return vueChef_(ctx);
  }

  if (action === 'chef.mail') {
    var sujet = court(p.sujet, 200), corps = court(p.corps, 8000);
    if (!sujet || !corps) throw erreur_('INVALIDE', 'Objet et message obligatoires.');
    var chefsX = nomsChefs_(ctx);
    var repondreA = chefsX.map(function (x) { return String(x.email || '').split(/[\s,;]+/)[0]; }).filter(function (m) { return /@/.test(m); });
    var emails = [];
    lignes_('CorUnum').filter(function (x) { return x.annee === ctx.annee && x.equipe_id === e.id && x.statut !== 'ancien'; }).forEach(function (x) {
      String(x.email || '').split(/[\s,;]+/).filter(function (m) { return /@/.test(m); }).forEach(function (m) { m = m.toLowerCase(); if (emails.indexOf(m) === -1) emails.push(m); });
    });
    if (!emails.length) throw erreur_('INVALIDE', 'Aucune adresse e-mail dans votre fraternité.');
    var quota = MailApp.getRemainingDailyQuota();
    if (emails.length + 1 > quota) throw erreur_('QUOTA', 'Envoi impossible aujourd\'hui (quota de la paroisse atteint). Réessayez demain.');
    var opts = optionsEnvoi_();
    var signe = '\n\n' + (chefsX.map(function (x) { return x.prenoms + ' ' + x.nom; }).join(' et ') || qui) + '\nFraternité Cor Unum ' + e.nom;
    var o = { name: 'Fraternité Cor Unum ' + e.nom, from: opts.from, bcc: emails.join(','), htmlBody: corpsHtml_(corps + signe, '') };
    if (repondreA.length) o.replyTo = repondreA.join(',');
    GmailApp.sendEmail(repondreA[0] || CONFIG.ALIAS, sujet, corps + signe, o);
    journaliser_(s, 'Cor Unum : mail du chef à son équipe', sujet + ' → ' + emails.length + ' destinataires');
    return { nb: emails.length };
  }
  throw erreur_('ACTION_INCONNUE', 'Action inconnue.');
}

// ─── Côté appli : lien du chef, fil de messages, message à tous les chefs ───

function lienChefCor_(p, s) {
  var res = verrou_(function () {
    var r = corReglages_();
    assurerJetons_(r);
    var e = (r.equipes[p.annee] || []).filter(function (y) { return y.id === p.equipe; })[0];
    if (!e) throw erreur_('INTROUVABLE', 'Fraternité introuvable.');
    if (p.nouveau) {
      var ancien = e.jeton;
      e.jeton = jeton_();
      Object.keys(r.equipes).forEach(function (a) { r.equipes[a].forEach(function (y) { if (y.jeton === ancien) y.jeton = e.jeton; }); });
    }
    ecrireCorReglages_(r);
    return e;
  });
  if (p.nouveau) journaliser_(s, 'Cor Unum : nouveau lien de chef', res.nom);
  var base = String(reglages_().url_formulaires || 'https://secretariat.croix-glorieuse.org/').replace(/\/?$/, '/');
  var m = mdpChefs_()[res.fil];
  var li = '';
  try { if (p.annee === anneeCorCourante_(corReglages_())) li = urlRejoindre_(jetonInscription_(p.annee, p.equipe, false)); } catch (er) {}
  return { lien: base + 'fraternite/?c=' + res.jeton, lien_inscription: li, mot_de_passe: m ? m.maj : '', mails: mailsChefs_({ equipe: res }) };
}

function filCor_(p, s) {
  var r = corReglages_();
  if (assurerJetons_(r)) ecrireCorReglages_(r);
  var e = (r.equipes[p.annee] || []).filter(function (y) { return y.id === p.equipe; })[0];
  if (!e) throw erreur_('INTROUVABLE', 'Fraternité introuvable.');
  if (p.texte) {
    var t = String(p.texte).trim().slice(0, 4000);
    verrou_(function () { feuilleFil_(); ecrireLigne_('CorUnumFils', { id: uid_(), fil: e.fil, type: 'message', date: maintenant_(), auteur: s.nom, cote: 'paroisse', texte: t, lieu: '', lu: 'oui' }); });
  }
  var fil = elementsFil_(e.fil);
  // ouvrir le fil dans l'appli = messages du chef lus
  verrou_(function () { fil.forEach(function (x) { if (x.type === 'message' && x.cote === 'chef' && x.lu !== 'oui') { x.lu = 'oui'; ecrireLigne_('CorUnumFils', x); } }); });
  return { messages: fil.filter(function (x) { return x.type === 'message'; }).map(messagePublic_), rencontres: fil.filter(function (x) { return x.type === 'rencontre'; }).map(rencontrePublique_) };
}

function messageTousChefsCor_(p, s) {
  var t = String(p.texte || '').trim().slice(0, 4000);
  if (!t) throw erreur_('INVALIDE', 'Message vide.');
  var r = corReglages_();
  if (assurerJetons_(r)) ecrireCorReglages_(r);
  var eqs = r.equipes[p.annee] || [];
  verrou_(function () {
    feuilleFil_();
    eqs.forEach(function (e) { ecrireLigne_('CorUnumFils', { id: uid_(), fil: e.fil, type: 'message', date: maintenant_(), auteur: s.nom, cote: 'paroisse', texte: t, lieu: '', lu: 'oui' }); });
  });
  journaliser_(s, 'Cor Unum : message à tous les chefs', t.slice(0, 80));
  return { nb: eqs.length };
}

/** Pour la liste : messages non lus et prochaine rencontre de chaque fraternité. */
function resumeFils_(equipes) {
  if (!db_().getSheetByName('CorUnumFils')) return {};
  var parFil = {};
  var auj = aujourdhui_();
  lignes_('CorUnumFils').forEach(function (x) {
    var f = parFil[x.fil] = parFil[x.fil] || { non_lus: 0, prochaine: null, nb_rencontres: 0 };
    if (x.type === 'message' && x.cote === 'chef' && x.lu !== 'oui') f.non_lus++;
    if (x.type === 'rencontre') { f.nb_rencontres++; if (x.texte >= auj && (!f.prochaine || x.texte < f.prochaine.date)) f.prochaine = rencontrePublique_(x); }
  });
  var res = {};
  equipes.forEach(function (e) { if (e.fil && parFil[e.fil]) res[e.id] = parFil[e.fil]; });
  return res;
}

// ─── Placer un adulte (dossier) dans une fraternité ───

/** Année Cor Unum en cours : celle des fraternités les plus récentes (comme la page des chefs). */
function anneeCorCourante_(r) {
  return Object.keys(r.equipes).filter(function (a) { return (r.equipes[a] || []).length; }).sort().reverse()[0]
    || r.feuilles.map(function (f) { return f.annee; }).sort().reverse()[0] || anneeScolaire_();
}
function nomsChefsEquipe_(e, toutes) {
  return toutes.filter(function (y) { return (e.chefs || []).indexOf(y.id) > -1; }).map(function (y) { return (y.prenoms + ' ' + y.nom).trim(); });
}
/** Fraternités de l'année en cours (pour choisir où placer quelqu'un). */
function equipesCorCourantes_(p) {
  feuilleCor_();
  var r = corReglages_(), annee = anneeCorCourante_(r), toutes = lignes_('CorUnum');
  return { annee: annee, equipes: equipesDe_(r, annee).map(function (e) {
    return { id: e.id, nom: e.nom, chefs: nomsChefsEquipe_(e, toutes),
             membres: toutes.filter(function (x) { return x.annee === annee && x.equipe_id === e.id && x.statut !== 'ancien'; }).length };
  }).sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); }) };
}
/**
 * Place des dossiers (catéchumènes, néophytes, confirmands) dans une fraternité de l'année en cours.
 * Fiche Cor Unum de l'année reliée → déplacée ; sinon fiche créée (coordonnées et profil du dossier) et reliée.
 * equipe_id vide : la personne est retirée de sa fraternité (fiche gardée, « à répartir »).
 */
function placerCor_(p, s) {
  var ids = (p.dossiers || []).filter(String), equipeId = String(p.equipe_id || '');
  if (!ids.length) throw erreur_('PARAMETRE', 'Aucun dossier choisi.');
  var r = corReglages_(), annee = anneeCorCourante_(r);
  var e = equipesDe_(r, annee).filter(function (y) { return y.id === equipeId; })[0];
  if (equipeId && !e) throw erreur_('INTROUVABLE', 'Fraternité introuvable pour ' + annee + '.');
  var noms = [];
  verrou_(function () {
    feuilleCor_();
    var toutes = lignes_('CorUnum'), doss = dossiersLies_(), liens = liensCor_(toutes, doss);
    ids.forEach(function (id) {
      var d = doss.filter(function (z) { return z.id === id; })[0];
      if (!d) throw erreur_('INTROUVABLE', 'Seuls les catéchumènes, néophytes et confirmands peuvent être placés.');
      var i = d.infos || {};
      noms.push(d.nom);
      var l = (liens.parDossier[id] || []).filter(function (z) { return z.x.annee === annee; });
      var x = l.length ? l[0].x : null;
      if (!x) {
        if (!equipeId) return;
        ecrireLigne_('CorUnum', {
          id: uid_(), annee: annee, cree_le: maintenant_(), sources: '["dossier"]', nom: i.nom || d.nom, prenoms: i.prenoms || '',
          email: i.email || d.email || '', telephone: i.telephone || '', adresse: i.adresse || '',
          profils: JSON.stringify(profilsDossier_([{ d: d }])), situation: '', deja_participe: 'Non', rester: '', chef_indique: '', chef_possible: '',
          souhait: '', groupe_service: '', equipe_id: equipeId, equipe_proposee: '', statut: 'actif', note: '', maj_le: maintenant_(), maj_par: s.nom,
          dossiers_lies: JSON.stringify([id]), dossiers_exclus: '[]'
        });
        return;
      }
      x.equipe_id = equipeId; x.equipe_proposee = '';
      if (equipeId) x.statut = 'actif';
      var lies = json2_(x.dossiers_lies, []);
      if (lies.indexOf(id) === -1) x.dossiers_lies = JSON.stringify(lies.concat([id]));   // le lien tient même si le nom change
      x.maj_le = maintenant_(); x.maj_par = s.nom;
      ecrireLigne_('CorUnum', x);
    });
  });
  journaliser_(s, equipeId ? 'Cor Unum : placé(s) dans ' + e.nom : 'Cor Unum : retiré(s) de leur fraternité', noms.join(', '));
  return { fraternites: fraternitesDesDossiers_(), fraternite: ids.length === 1 ? fraterniteDuDossier_(trouverDossier_(ids[0])) : null };
}

// ─── Lien d'inscription d'une fraternité (envoyé par le chef) ───
// Valable pour l'année en cours : la préparation de l'année suivante crée de nouvelles fraternités, sans ce lien.

function urlRejoindre_(j) {
  return String(reglages_().url_formulaires || 'https://secretariat.croix-glorieuse.org/').replace(/\/?$/, '/') + 'rejoindre/?i=' + j;
}
/** Jeton d'inscription de la fraternité (créé au besoin, ou renouvelé). */
function jetonInscription_(annee, equipeId, nouveau) {
  return verrou_(function () {
    var r = corReglages_();
    var e = (r.equipes[annee] || []).filter(function (y) { return y.id === equipeId; })[0];
    if (!e) throw erreur_('INTROUVABLE', 'Fraternité introuvable.');
    if (!e.jeton_inscr || nouveau) { e.jeton_inscr = jeton_(); ecrireCorReglages_(r); }
    return e.jeton_inscr;
  });
}
function lienInscriptionCor_(p, s) {
  var r = corReglages_();
  if (p.annee !== anneeCorCourante_(r)) throw erreur_('ANNEE', 'Le lien d\'inscription n\'existe que pour l\'année en cours (' + anneeCorCourante_(r) + ').');
  var j = jetonInscription_(p.annee, p.equipe, !!p.nouveau);
  if (p.nouveau) journaliser_(s, 'Cor Unum : nouveau lien d\'inscription', p.equipe);
  return { lien: urlRejoindre_(j) };
}
function equipeParInscription_(i) {
  if (!/^[a-f0-9]{32}$/.test(String(i || ''))) throw erreur_('LIEN', 'Ce lien n\'est pas valable.');
  var r = corReglages_(), annee = anneeCorCourante_(r);
  var e = (r.equipes[annee] || []).filter(function (y) { return y.jeton_inscr === i; })[0];
  if (!e) throw erreur_('LIEN', 'Ce lien d\'inscription n\'est plus valable. Demandez-en un nouveau au chef de la fraternité.');
  return { r: r, annee: annee, equipe: e };
}
function chefsInfos_(e, toutes) {
  return toutes.filter(function (y) { return (e.chefs || []).indexOf(y.id) > -1; }).map(function (y) {
    return { nom: (y.prenoms + ' ' + y.nom).trim(), email: String(y.email || '').split(/[\s,;]+/).filter(function (m) { return /@/.test(m); })[0] || '',
             telephone: String(y.telephone || '').split('/')[0].trim() };
  });
}

/** Pages publiques « rejoindre » (doPost, sans session). */
function actionRejoindre_(action, p) {
  var cache = CacheService.getScriptCache(), cle = 'rej_' + String(p.i || '').slice(0, 32);
  var n = Number(cache.get(cle) || 0);
  if (n > 60) throw erreur_('LIMITE', 'Trop de demandes en peu de temps. Réessayez dans une heure.');
  cache.put(cle, String(n + 1), 3600);
  var ctx = equipeParInscription_(p.i), e = ctx.equipe;
  feuilleCor_();
  var toutes = lignes_('CorUnum'), chefs = chefsInfos_(e, toutes);
  if (action === 'rej.public') {
    return { equipe: e.nom, annee: ctx.annee, chefs: chefs.map(function (c) { return c.nom; }), profils: PROFILS_COR, paroisse: reglages_().paroisse };
  }
  if (action !== 'rej.inscrire') throw erreur_('ACTION', 'Action inconnue.');

  var court = function (t, max) { return String(t || '').trim().replace(/\s+/g, ' ').slice(0, max || 100); };
  var personne = function (x, qui) {
    var o = { prenoms: court(x.prenoms, 60), nom: court(x.nom, 60), email: court(x.email, 120).toLowerCase(), telephone: court(x.telephone, 30) };
    if (!o.prenoms || !o.nom) throw erreur_('INVALIDE', 'Prénom et nom' + (qui ? ' ' + qui : '') + ' obligatoires.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) throw erreur_('INVALIDE', 'Adresse e-mail' + (qui ? ' ' + qui : '') + ' invalide.');
    return o;
  };
  var p1 = personne(p, ''), p2 = p.couple ? personne(p.conjoint || {}, 'du conjoint') : null;
  var profils = (p.profils || []).filter(function (y) { return PROFILS_COR.indexOf(y) > -1; });
  // Couple au même nom : une fiche foyer ; noms différents : deux fiches
  var foyers = p2 && memeNom_(p1.nom, p2.nom)
    ? [{ prenoms: p1.prenoms + ' et ' + p2.prenoms, nom: p1.nom, emails: [p1.email, p2.email], tels: [p1.telephone, p2.telephone], gens: [p1, p2] }]
    : [p1].concat(p2 ? [p2] : []).map(function (x) { return { prenoms: x.prenoms, nom: x.nom, emails: [x.email], tels: [x.telephone], gens: [x] }; });
  var uniq = function (l) { return l.filter(function (v, k) { return v && l.indexOf(v) === k; }); };
  var qui = 'Inscription – lien du chef';
  verrou_(function () {
    var fiches = lignes_('CorUnum').filter(function (x) { return x.annee === ctx.annee; });
    foyers.forEach(function (f) {
      var x = fiches.filter(function (y) { return f.gens.some(function (g) { return correspond_(y, g.nom, g.prenoms, g.email); }); })[0];
      if (x) {
        var ancienneEquipe = x.equipe_id;
        x.equipe_id = e.id; x.equipe_proposee = ''; x.statut = 'actif';
        x.email = uniq(String(x.email || '').split(/[\s,;]+/).concat(f.emails).map(function (m) { return m.toLowerCase(); })).join(', ');
        if (!x.telephone) x.telephone = uniq(f.tels).join(' / ');
        x.profils = JSON.stringify(uniq(json2_(x.profils, []).concat(profils)));
        x.sources = JSON.stringify(uniq(json2_(x.sources, []).concat(['lien_chef'])));
        if (ancienneEquipe && ancienneEquipe !== e.id) x.deja_participe = 'Non';
        x.note = [x.note, 'Inscrit(e) par le lien du chef le ' + aujourdhui_()].filter(String).join(' ; ');
        x.maj_le = maintenant_(); x.maj_par = qui;
        ecrireLigne_('CorUnum', x);
      } else {
        ecrireLigne_('CorUnum', {
          id: uid_(), annee: ctx.annee, cree_le: maintenant_(), sources: '["lien_chef"]', nom: f.nom, prenoms: f.prenoms,
          email: uniq(f.emails).join(', '), telephone: uniq(f.tels).join(' / '), adresse: '', profils: JSON.stringify(profils), situation: p2 ? 'En couple' : '',
          deja_participe: 'Non', rester: '', chef_indique: '', chef_possible: '', souhait: '', groupe_service: '', equipe_id: e.id, equipe_proposee: '',
          statut: 'actif', note: 'Inscrit(e) par le lien du chef', maj_le: maintenant_(), maj_par: qui, dossiers_lies: '[]', dossiers_exclus: '[]'
        });
      }
    });
  });
  var noms = foyers.map(function (f) { return f.prenoms + ' ' + f.nom; }).join(', ');
  journaliser_({ nom: qui }, 'Cor Unum : inscription par le lien du chef (' + e.nom + ')', noms);
  prevenirEquipeParoisse_('Fraternité ' + e.nom + ' : nouvelle inscription', noms + ' (lien du chef)', ctx.annee);
  try { mailsInscriptionRejoindre_(e, chefs, [p1].concat(p2 ? [p2] : []), profils); } catch (er) { console.error('mail rejoindre', er); }
  return { equipe: e.nom, chefs: chefs };
}

function mailsInscriptionRejoindre_(e, chefs, gens, profils) {
  var opts = optionsEnvoi_(), fin = '\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
  var mailsChefs = chefs.map(function (c) { return c.email; }).filter(String);
  // À la personne (et au conjoint) : bienvenue + coordonnées du chef
  var coord = chefs.length ? chefs.map(function (c) { return '• ' + c.nom + (c.telephone ? ' – ' + c.telephone : '') + (c.email ? ' – ' + c.email : ''); }).join('\n')
    : '• le secrétariat de la paroisse vous mettra en relation avec l\'équipe.';
  var prenoms = gens.map(function (g) { return g.prenoms; }).join(' et ');
  var plur = chefs.length > 1 || chefs.some(function (c) { return /\s(et|&)\s/i.test(c.nom); });
  var t = 'Bonjour ' + prenoms + ',\n\nVotre inscription dans la fraternité Cor Unum ' + e.nom + ' est bien enregistrée. Bienvenue !\n\n' +
    (plur ? 'Vos chefs de fraternité :' : 'Votre chef de fraternité :') + '\n' + coord + '\n\n' +
    (chefs.length ? (plur ? 'Ils vous contacteront pour la prochaine rencontre ; n\'hésitez pas à les joindre d\'ici là.' : 'Votre chef vous contactera pour la prochaine rencontre ; n\'hésitez pas à le joindre d\'ici là.') : '') + fin;
  var o = { name: opts.name, from: opts.from, htmlBody: corpsHtml_(t, 'paroisse') };
  if (mailsChefs.length) o.replyTo = mailsChefs.join(',');
  GmailApp.sendEmail(gens.map(function (g) { return g.email; }).filter(function (m, k, l) { return l.indexOf(m) === k; }).join(','), 'Bienvenue dans la fraternité Cor Unum ' + e.nom, corpsTexte_(t, 'paroisse'), o);
  // Aux chefs : la nouvelle inscription
  if (mailsChefs.length) {
    var t2 = 'Bonjour,\n\nNouvelle inscription dans votre fraternité Cor Unum ' + e.nom + ' :\n' +
      gens.map(function (g) { return '• ' + g.prenoms + ' ' + g.nom + (g.telephone ? ' – ' + g.telephone : '') + ' – ' + g.email; }).join('\n') +
      (profils.length ? '\nProfil : ' + profils.join(', ') : '') + '\n\nElle apparaît désormais sur la page de votre fraternité.' + fin;
    GmailApp.sendEmail(mailsChefs.join(','), 'Nouvelle inscription dans votre fraternité', corpsTexte_(t2, 'paroisse'),
      { name: opts.name, from: opts.from, htmlBody: corpsHtml_(t2, 'paroisse'), replyTo: gens[0].email });
  }
}

// ─── Lier deux personnes en ménage : une seule fiche foyer ───

/** z est fusionnée dans x (même année). Noms différents : « Claire DUPONT et Antoine » + MARTIN. Les liens aux dossiers et le rôle de chef sont gardés. */
function menageCor_(x, z, toutes, r, qui) {
  if (x.id === z.id) throw erreur_('INVALIDE', 'Choisissez deux personnes différentes.');
  if (x.annee !== z.annee) throw erreur_('INVALIDE', 'Les deux fiches doivent être de la même année.');
  try {
    var liens = liensCor_(toutes.filter(function (a) { return a.annee === x.annee; }), dossiersLies_());
    var lies = json2_(x.dossiers_lies, []);
    [x, z].forEach(function (f) { (liens.parFiche[f.id] || []).forEach(function (l) { if (lies.indexOf(l.d.id) === -1) lies.push(l.d.id); }); });
    x.dossiers_lies = JSON.stringify(lies);
  } catch (e) { /* sans dossiers */ }
  if (!memeNom_(x.nom, z.nom)) {
    x.prenoms = (String(x.prenoms || '').trim() + ' ' + String(x.nom || '').toUpperCase()).trim() + ' et ' + String(z.prenoms || '').trim();
    x.nom = z.nom;
  }
  fusionnerCor_(x, z);
  if (!x.equipe_id && z.equipe_id) x.equipe_id = z.equipe_id;
  if (z.statut !== 'ancien') x.statut = x.statut === 'ancien' ? 'actif' : (x.statut || 'actif');
  x.note = [x.note, z.note].filter(String).join(' ; ');
  x.maj_le = maintenant_(); x.maj_par = qui;
  // chef : la fiche foyer remplace la fiche fusionnée
  var change = false;
  (r.equipes[x.annee] || []).forEach(function (e) {
    var i = (e.chefs || []).indexOf(z.id);
    if (i > -1) { e.chefs.splice(i, 1); if (e.chefs.indexOf(x.id) === -1) e.chefs.push(x.id); change = true; }
  });
  if (change) ecrireCorReglages_(r);
  ecrireLigne_('CorUnum', x);
  var zz = lignes_('CorUnum').filter(function (y) { return y.id === z.id; })[0];
  if (zz) feuilleCor_().deleteRow(zz._ligne); oublierLignes_();
}
function menageCorRoute_(p, s) {
  var nom = '';
  verrou_(function () {
    feuilleCor_();
    var toutes = lignes_('CorUnum');
    var x = toutes.filter(function (y) { return y.id === p.id; })[0], z = toutes.filter(function (y) { return y.id === p.avec; })[0];
    if (!x || !z) throw erreur_('INTROUVABLE', 'Fiche introuvable.');
    menageCor_(x, z, toutes, corReglages_(), s.nom);
    nom = x.prenoms + ' ' + x.nom;
  });
  journaliser_(s, 'Cor Unum : ménage lié', nom);
  return listerCor_({ annee: p.annee }, s);
}
