/**
 * Petite boutique de livres du catéchisme.
 * Catalogue (titre, prix, groupe, stock) dans les réglages du catéchisme ; commandes dans la feuille « Commandes ».
 * Page publique secretariat.croix-glorieuse.org/livres/ (lien public, ou lien personnel pré-rempli pour une famille).
 * Paiement en ligne (HelloAsso) ou au secrétariat ; livres à retirer à la paroisse (case « remis »).
 * Les livres choisis dans le formulaire d'inscription deviennent une commande à payer (quand le paiement en ligne est actif).
 */

var COLONNES_COMMANDES = ['id', 'jeton', 'cree_le', 'nom', 'email', 'telephone', 'lignes', 'total', 'statut', 'remis', 'source', 'famille', 'paiements', 'maj_le', 'note'];

function feuilleCommandes_() {
  var f = db_().getSheetByName('Commandes');
  if (!f) { f = db_().insertSheet('Commandes'); f.getRange('A:Z').setNumberFormat('@'); f.appendRow(COLONNES_COMMANDES); f.setFrozenRows(1); }
  return f;
}
/** Ajoute à une feuille existante les colonnes apparues depuis sa création. */
function completerColonnes_(f, colonnes) {
  var ent = f.getRange(1, 1, 1, f.getLastColumn()).getValues()[0];
  var manque = colonnes.filter(function (c) { return ent.indexOf(c) === -1; });
  if (manque.length) f.getRange(1, ent.length + 1, 1, manque.length).setValues([manque]); oublierLignes_();
  return f;
}

function catalogue_() { return (json2_(props_().getProperty('CATE'), {}).livres || []); }
function ecrireCatalogue_(p, s) {
  var r = json2_(props_().getProperty('CATE'), {});
  r.livres = (p.livres || []).filter(function (l) { return l && String(l.titre || '').trim(); }).map(function (l) {
    return { id: l.id || uid_().slice(0, 8), titre: String(l.titre).trim().slice(0, 160), prix: nombre_(l.prix), groupe: String(l.groupe || ''),
             stock: l.stock === '' || l.stock == null ? null : Math.max(0, Math.round(nombre_(l.stock))), actif: l.actif !== false };
  });
  props_().setProperty('CATE', JSON.stringify(r));
  journaliser_(s, 'Livres : catalogue modifié', r.livres.length + ' livres');
  return listerLivres_({});
}

function resteCommande_(c) {
  var paye = json2_(c.paiements, []).reduce(function (a, p) { return a + nombre_(p.montant); }, 0);
  return Math.round((nombre_(c.total) - paye) * 100) / 100;
}
function commandePublique_(c, admin) {
  var o = { id: c.id, cree_le: c.cree_le, nom: c.nom, email: c.email, telephone: c.telephone, lignes: json2_(c.lignes, []), total: nombre_(c.total),
            statut: c.statut, remis: c.remis === 'oui', source: c.source, reste: resteCommande_(c), note: c.note };
  if (admin) { o.paiements = json2_(c.paiements, []); o.famille = c.famille; o.lien_paiement = urlPaiement_({ o: 'livres', c: c.jeton }); }
  return o;
}
function commandeParJeton_(j) {
  if (!/^[a-f0-9]{32}$/.test(String(j || ''))) throw erreur_('LIEN', 'Ce lien n\'est pas valable.');
  feuilleCommandes_();
  var c = lignes_('Commandes').filter(function (y) { return y.jeton === j; })[0];
  if (!c) throw erreur_('LIEN', 'Commande introuvable.');
  return c;
}
/** Paiement reçu (en ligne ou à la main) : stock décompté au premier paiement complet. */
function payerCommande_(id, paiement) {
  feuilleCommandes_();
  var c = lignes_('Commandes').filter(function (y) { return y.id === id; })[0];
  if (!c) return;
  var l = json2_(c.paiements, []); l.push(paiement);
  c.paiements = JSON.stringify(l);
  var etaitPayee = c.statut === 'payee';
  if (resteCommande_(c) <= 0) c.statut = 'payee';
  c.maj_le = maintenant_();
  ecrireLigne_('Commandes', c);
  if (!etaitPayee && c.statut === 'payee') decompterStock_(json2_(c.lignes, []), -1);
}
function decompterStock_(lignes, sens) {
  var r = json2_(props_().getProperty('CATE'), {});
  (r.livres || []).forEach(function (l) {
    if (l.stock == null) return;
    lignes.forEach(function (x) { if (x.livre_id === l.id) l.stock = Math.max(0, l.stock + sens * (x.qte || 1)); });
  });
  props_().setProperty('CATE', JSON.stringify(r));
}

// ─── Administration ───

function listerLivres_(p) {
  feuilleCommandes_();
  var cmds = lignes_('Commandes').map(function (c) { return commandePublique_(c, true); }).sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); });
  return { livres: catalogue_(), commandes: cmds, lien_boutique: lienBoutique_(''), groupes: GROUPES_CATE, en_ligne: haActif_() };
}
function modifierCommande_(p, s) {
  verrou_(function () {
    feuilleCommandes_();
    var c = lignes_('Commandes').filter(function (y) { return y.id === p.id; })[0];
    if (!c) throw erreur_('INTROUVABLE', 'Commande introuvable.');
    if (p.remis !== undefined) c.remis = p.remis ? 'oui' : '';
    if (p.note !== undefined) c.note = String(p.note || '').slice(0, 500);
    if (p.statut === 'annulee' || p.statut === 'en_attente') {
      if (c.statut === 'payee' && p.statut === 'annulee') decompterStock_(json2_(c.lignes, []), +1);
      c.statut = p.statut;
    }
    if (p.ajouter) {
      var montant = nombre_(p.ajouter.montant);
      if (!montant) throw erreur_('INVALIDE', 'Montant manquant.');
      c.maj_le = maintenant_(); ecrireLigne_('Commandes', c);
      payerCommande_(c.id, { id: uid_(), date: p.ajouter.date || aujourdhui_(), montant: montant, mode: String(p.ajouter.mode || ''), par: s.nom });
      return;
    }
    if (p.retirer) c.paiements = JSON.stringify(json2_(c.paiements, []).filter(function (y) { return y.id !== p.retirer; }));
    c.maj_le = maintenant_();
    ecrireLigne_('Commandes', c);
  });
  return listerLivres_({});
}

// ─── Commande depuis le formulaire d'inscription ───

/** Les livres choisis par une famille (formulaire Google) deviennent une commande « en attente ». */
function commandeDepuisInscriptions_(email, inscriptions) {
  var lignes = [];
  var cat = catalogue_();
  inscriptions.forEach(function (x) {
    json2_(x.manuels, []).forEach(function (m) {
      var livre = cat.filter(function (l) { return sansAccents_(m.libelle).indexOf(sansAccents_(l.titre)) > -1; })[0];
      lignes.push({ livre_id: livre ? livre.id : '', titre: livre ? livre.titre : m.libelle, prix: livre ? livre.prix : nombre_(m.prix), qte: 1, pour: x.prenoms });
    });
  });
  lignes = lignes.filter(function (l) { return l.prix > 0; });
  if (!lignes.length) return null;
  feuilleCommandes_();
  var x0 = inscriptions[0];
  var c = { id: uid_(), jeton: jeton_(), cree_le: maintenant_(), nom: x0.pere || x0.mere || x0.nom, email: email, telephone: x0.telephone || '',
            lignes: JSON.stringify(lignes), total: String(lignes.reduce(function (a, l) { return a + l.prix * l.qte; }, 0)), statut: 'en_attente', remis: '',
            source: 'Inscription au catéchisme', famille: email, paiements: '[]', maj_le: maintenant_(), note: '' };
  ecrireLigne_('Commandes', c);
  inscriptions.forEach(function (x) { x.commande_id = c.id; ecrireInscription_(x); });
  return c;
}

// ─── Page publique « livres » ───

function actionBoutique_(action, p) {
  var cache = CacheService.getScriptCache(), cle = 'bout_' + String(p.e || p.c || 'public').slice(0, 40);
  var n = Number(cache.get(cle) || 0);
  if (n > 120) throw erreur_('LIMITE', 'Trop de demandes. Réessayez dans une heure.');
  cache.put(cle, String(n + 1), 3600);
  var livres = catalogue_().filter(function (l) { return l.actif !== false; }).map(function (l) { return { id: l.id, titre: l.titre, prix: l.prix, groupe: l.groupe, epuise: l.stock === 0 }; });

  if (action === 'boutique.public') {
    var res = { livres: livres, en_ligne: haActif_(), hors_ligne: haReglages_().hors_ligne, paroisse: reglages_().paroisse, prerempli: null, commande: null };
    if (p.c) res.commande = commandePublique_(commandeParJeton_(p.c), false);
    else if (p.e) {
      var fam = familleCate_(p.e, p.k), x = fam[0];
      if (x) res.prerempli = { nom: x.pere || x.mere || '', email: String(p.e), telephone: x.telephone || '', enfants: fam.map(function (y) { return { prenoms: y.prenoms, groupe: y.groupe }; }) };
    }
    return res;
  }
  if (action === 'boutique.commander') {
    var court = function (v, m) { return String(v == null ? '' : v).trim().slice(0, m || 120); };
    if (!court(p.nom)) throw erreur_('INVALIDE', 'Nom manquant.');
    if (!/@/.test(court(p.email))) throw erreur_('INVALIDE', 'Adresse e-mail manquante.');
    var cat = catalogue_();
    var lignes = (p.lignes || []).map(function (l) {
      var livre = cat.filter(function (y) { return y.id === l.id && y.actif !== false; })[0];
      var q = Math.max(0, Math.min(20, Math.round(nombre_(l.qte))));
      if (!livre || !q) return null;
      if (livre.stock != null && livre.stock < q) throw erreur_('STOCK', '« ' + livre.titre + ' » : plus que ' + livre.stock + ' exemplaire(s).');
      return { livre_id: livre.id, titre: livre.titre, prix: livre.prix, qte: q };
    }).filter(Boolean);
    if (!lignes.length) throw erreur_('INVALIDE', 'Choisissez au moins un livre.');
    var famille = '';
    if (p.e) { familleCate_(p.e, p.k); famille = String(p.e).toLowerCase(); }
    var c = verrou_(function () {
      feuilleCommandes_();
      var y = { id: uid_(), jeton: jeton_(), cree_le: maintenant_(), nom: court(p.nom), email: court(p.email).replace(/\s/g, ''), telephone: court(p.telephone, 40),
                lignes: JSON.stringify(lignes), total: String(lignes.reduce(function (a, l) { return a + l.prix * l.qte; }, 0)), statut: 'en_attente', remis: '',
                source: famille ? 'Lien famille' : 'Boutique', famille: famille, paiements: '[]', maj_le: maintenant_(), note: court(p.note, 500) };
      ecrireLigne_('Commandes', y);
      return y;
    });
    try { mailCommande_(c, !p.en_ligne); } catch (e) {}
    lignes_('Utilisateurs').filter(estActif_).forEach(function (u) { notifier_(u.id, 'Livres : nouvelle commande', c.nom + ' – ' + c.total + ' €', '#/catechisme?vue=livres'); });
    var r = { commande: commandePublique_(c, false), jeton: c.jeton };
    if (p.en_ligne) {
      var np = separerPrenomNom_(c.nom);
      var pay = creerPaiementEnLigne_({ objet: 'livres', cible: { commande: c.id }, montant: nombre_(c.total), libelle: 'Livres du catéchisme – commande ' + c.id.slice(0, 6), email: c.email, prenom: np.prenom, nom: np.nom });
      r.url = pay.url;
    }
    return r;
  }
  throw erreur_('ACTION', 'Action inconnue.');
}

function mailCommande_(c, horsLigne) {
  var l = json2_(c.lignes, []);
  var t = 'Bonjour,\n\nNous avons bien reçu votre commande de livres :\n' + l.map(function (x) { return '- ' + x.titre + (x.qte > 1 ? ' × ' + x.qte : '') + ' : ' + (x.prix * x.qte) + ' €'; }).join('\n') +
    '\n\nTotal : ' + c.total + ' €' +
    (horsLigne ? '\n\n' + (haReglages_().hors_ligne || 'Vous pouvez régler par chèque ou en espèces au secrétariat.') + (haActif_() ? '\nVous pouvez aussi payer en ligne :\n[Bouton : Payer en ligne]' : '') : '') +
    '\n\nLes livres sont à retirer à la paroisse (secrétariat ou catéchisme).\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
  var boutons = horsLigne && haActif_() ? [{ texte: 'Payer en ligne', url: urlPaiement_({ o: 'livres', c: c.jeton }) }] : [];
  var opts = optionsEnvoi_();
  GmailApp.sendEmail(c.email, 'Commande de livres – catéchisme', corpsTexte_(t, 'paroisse', boutons), { name: opts.name, from: opts.from, htmlBody: corpsHtml_(t, 'paroisse', boutons) });
}
