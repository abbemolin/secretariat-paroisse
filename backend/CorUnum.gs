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
  'statut', 'note', 'maj_le', 'maj_par'];
var PROFILS_COR = ['Catéchumène', 'Confirmand', 'Néophyte', 'Nouveau à la paroisse', 'Recommençant', 'Paroissien'];

function feuilleCor_() {
  var f = db_().getSheetByName('CorUnum');
  if (!f) {
    f = db_().insertSheet('CorUnum');
    f.getRange('A:Z').setNumberFormat('@');
    f.appendRow(COLONNES_COR);
    f.setFrozenRows(1);
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

function corPublic_(x, dossiers) {
  var o = {};
  COLONNES_COR.forEach(function (k) { o[k] = x[k]; });
  o.profils = json2_(x.profils, []);
  o.sources = undefined;
  o.nouveau = /non/i.test(x.deja_participe || '') || /non/i.test(x.rester || '');
  o.chef_possible = /oui/i.test(x.chef_possible || '');
  o.dossiers = (dossiers || []).filter(function (d) {
    var i = d.infos || {};
    var emailOk = d.email && String(x.email || '').toLowerCase().indexOf(String(d.email).toLowerCase()) > -1;
    var nomD = i.nom || i.enfant_nom || '', prenD = i.prenoms || i.enfant_prenoms || '';
    return (emailOk && memeNom_(x.nom, nomD)) || (memeNom_(x.nom, nomD) && prenomCommun_(x.prenoms, prenD));
  }).map(function (d) { return { id: d.id, type: d.type, nom: d.nom }; });
  return o;
}
function dossiersLies_() {
  return lignes_('Dossiers').filter(function (d) { return ['catechumene', 'confirmand', 'confirmation_jeune'].indexOf(d.type) > -1; })
    .map(function (d) { return { id: d.id, type: d.type, nom: d.nom, email: d.email, infos: json2_(d.donnees, {}).infos || {} }; });
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
  var dossiers = dossiersLies_();
  return {
    annee: annee, annees: liste, profils: PROFILS_COR, lien_formulaire: r.lien_formulaire,
    onglets_repris: !!r.onglets_repris[annee],
    equipes: equipesDe_(r, annee).map(function (e) { return { id: e.id, nom: e.nom, chefs: e.chefs || [], fil: !!e.fil }; }),
    fils: resumeFils_(equipesDe_(r, annee)),
    membres: toutes.filter(function (x) { return x.annee === annee; }).map(function (x) { return corPublic_(x, dossiers); })
      .sort(function (a, b) { return (a.nom + ' ' + a.prenoms).localeCompare(b.nom + ' ' + b.prenoms, 'fr'); })
  };
}

/** Pour la page d'un dossier : la fraternité de la personne, s'il y en a une. */
function fraterniteDuDossier_(d) {
  if (['catechumene', 'confirmand', 'confirmation_jeune'].indexOf(d.type) === -1) return null;
  if (!db_().getSheetByName('CorUnum')) return null;
  var i = json2_(d.donnees, {}).infos || {};
  var r = corReglages_();
  var x = lignes_('CorUnum').filter(function (y) { return y.statut !== 'ancien' && correspond_(y, i.nom || i.enfant_nom || '', i.prenoms || i.enfant_prenoms || '', d.email); })
    .sort(function (a, b) { return String(b.annee).localeCompare(String(a.annee)); })[0];
  if (!x) return null;
  var e = equipesDe_(r, x.annee).filter(function (y) { return y.id === x.equipe_id; })[0];
  return { id: x.id, annee: x.annee, equipe: e ? e.nom : '' };
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
    feuilleCor_().deleteRow(x._ligne);
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
      .forEach(function (m) { feuilleCor_().deleteRow(m._ligne); res.regroupees = (res.regroupees || 0) + 1; });
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
  var membres = lignes_('CorUnum').filter(function (x) { return x.annee === ctx.annee && x.equipe_id === e.id; });
  var pub = function (x) {
    return { id: x.id, nom: x.nom, prenoms: x.prenoms, email: x.email, telephone: x.telephone, adresse: x.adresse,
             profils: json2_(x.profils, []), nouveau: /non/i.test(x.deja_participe || '') || /non/i.test(x.rester || ''),
             chef: (e.chefs || []).indexOf(x.id) > -1, statut: x.statut || 'actif', note: x.statut === 'ancien' ? x.note : '' };
  };
  var fil = elementsFil_(e.fil);
  return {
    annee: ctx.annee, nom: e.nom, paroisse: reglages_().paroisse,
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
  var qui = 'Chef – ' + e.nom;
  var s = { nom: qui, uid: '' };
  feuilleCor_();
  var membreDeLEquipe = function (id) {
    var x = lignes_('CorUnum').filter(function (y) { return y.id === id && y.annee === ctx.annee && y.equipe_id === e.id; })[0];
    if (!x) throw erreur_('INTROUVABLE', 'Membre introuvable dans votre fraternité.');
    return x;
  };
  var court = function (t, max) { return String(t || '').trim().slice(0, max || 300); };

  if (action === 'chef.lire') return vueChef_(ctx);

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

  if (action === 'chef.depart') {
    var nom = '';
    verrou_(function () {
      var x = membreDeLEquipe(p.id);
      x.statut = 'ancien';
      x.note = [x.note, 'Départ signalé par le chef le ' + maintenant_().slice(0, 10) + (court(p.note) ? ' : ' + court(p.note) : '')].filter(String).join(' ; ');
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
        if (x) feuilleFil_().deleteRow(x._ligne);
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
  return { lien: base + 'fraternite/?c=' + res.jeton };
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
  var auj = maintenant_().slice(0, 10);
  lignes_('CorUnumFils').forEach(function (x) {
    var f = parFil[x.fil] = parFil[x.fil] || { non_lus: 0, prochaine: null, nb_rencontres: 0 };
    if (x.type === 'message' && x.cote === 'chef' && x.lu !== 'oui') f.non_lus++;
    if (x.type === 'rencontre') { f.nb_rencontres++; if (x.texte >= auj && (!f.prochaine || x.texte < f.prochaine.date)) f.prochaine = rencontrePublique_(x); }
  });
  var res = {};
  equipes.forEach(function (e) { if (e.fil && parFil[e.fil]) res[e.id] = parFil[e.fil]; });
  return res;
}
