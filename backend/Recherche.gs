/**
 * Recherche globale (barre en haut du menu, Ctrl+K) : dossiers, fiches Cor Unum, inscriptions au catéchisme,
 * extraits de baptême, inscriptions aux retraites. Insensible aux accents et à la casse ; tous les mots doivent figurer.
 * Et préférences d'accueil de chaque utilisateur (ordre et blocs masqués).
 */
function rechercheGlobale_(p, s) {
  var q = sansAccents_(String(p.q || '')).trim();
  if (q.length < 2) return { groupes: [] };
  var mots = q.split(/\s+/).filter(String);
  var ok = function (t) { var x = sansAccents_(t); return mots.every(function (m) { return x.indexOf(m) > -1; }); };
  var max = 8, groupes = [];
  var essai = function (fn) { try { fn(); } catch (e) { console.error('recherche', e); } };
  essai(function () {
    if (s.droits.indexOf('dossiers') === -1) return;
    var sortesOk = sortesLisibles_(s);
    var r = lignes_('Dossiers').filter(function (d) {
      if (sortesOk.indexOf(d.type) === -1) return false;
      var i = json2_(d.donnees, {}).infos || {};
      return ok([d.nom, d.email, d.telephone, i.nom_jeune_fille, i.prenom_bapteme, i.pere_nom, i.mere_nom_jeune_fille, i.fiancee_nom, i.fiance_nom, i.defunt_nom].join(' '));
    }).sort(function (a, b) { return (a.etat === 'ouvert' ? 0 : 1) - (b.etat === 'ouvert' ? 0 : 1) || String(b.maj_le).localeCompare(String(a.maj_le)); });
    if (r.length) groupes.push({ cle: 'dossiers', titre: 'Dossiers', total: r.length, items: r.slice(0, max).map(function (d) {
      return { titre: d.nom, sous: (TYPES_DOSSIER[d.type] ? TYPES_DOSSIER[d.type].nom : d.type) + (d.etat !== 'ouvert' ? ' · ' + d.etat : ''), lien: '/dossiers/' + d.id, type: d.type };
    }) });
  });
  essai(function () {
    if (s.droits.indexOf('dossiers') === -1) return;
    if (!peutLire_(s, 'cor_unum') || !db_().getSheetByName('CorUnum')) return;
    var r = corReglages_(), eq = {};
    Object.keys(r.equipes).forEach(function (a) { r.equipes[a].forEach(function (e) { eq[e.id] = e.nom; }); });
    var l = lignes_('CorUnum').filter(function (x) { return ok([x.prenoms, x.nom, x.email, x.telephone].join(' ')); })
      .sort(function (a, b) { return String(b.annee).localeCompare(String(a.annee)); });
    if (l.length) groupes.push({ cle: 'cor', titre: 'Cor Unum', total: l.length, items: l.slice(0, max).map(function (x) {
      return { titre: (x.prenoms + ' ' + String(x.nom).toUpperCase()).trim(), sous: x.annee + ' · ' + (eq[x.equipe_id] ? 'fraternité ' + eq[x.equipe_id] : 'à répartir') + (x.statut === 'ancien' ? ' · ancien' : ''), lien: '/cor-unum?annee=' + x.annee + '&vue=tous&fiche=' + x.id };
    }) });
  });
  essai(function () {
    if (!peutLire_(s, 'catechisme') || !db_().getSheetByName('Catechisme')) return;
    var l = lignes_('Catechisme').filter(function (x) { return ok([x.prenoms, x.nom, x.email, x.telephone, x.pere, x.mere].join(' ')); })
      .sort(function (a, b) { return String(b.annee).localeCompare(String(a.annee)); });
    if (l.length) groupes.push({ cle: 'cate', titre: 'Catéchisme', total: l.length, items: l.slice(0, max).map(function (x) {
      return { titre: (x.prenoms + ' ' + String(x.nom).toUpperCase()).trim(), sous: x.annee + ' · ' + (x.groupe || x.classe || ''), lien: '/catechisme/' + x.id };
    }) });
  });
  essai(function () {
    if (!peutLire_(s, 'extraits') || !db_().getSheetByName('Extraits')) return;
    var l = lignes_('Extraits').filter(function (x) { return ok(x.nom); }).sort(function (a, b) { return String(b.cree_le).localeCompare(String(a.cree_le)); });
    if (l.length) groupes.push({ cle: 'extraits', titre: 'Extraits de baptême', total: l.length, items: l.slice(0, max).map(function (x) {
      return { titre: x.nom, sous: 'Extrait du ' + String(x.cree_le).slice(0, 10).split('-').reverse().join('/') + (x.statut === 'signe' ? ' · signé' : ''), lien: '/extraits/' + x.id };
    }) });
  });
  essai(function () {
    if (!peutLire_(s, 'retraites') || !db_().getSheetByName('RetraitesInscrits')) return;
    var ret = {}; lignes_('Retraites').forEach(function (r) { ret[r.id] = r; });
    var l = lignes_('RetraitesInscrits').filter(function (x) {
      var parts = json2_(x.participants, []).map(function (y) { return (y.prenoms || y.prenom || '') + ' ' + (y.nom || ''); }).join(' ');
      return x.statut !== 'annulee' && ok([x.contact_nom, x.contact_email, x.contact_tel, parts].join(' '));
    });
    if (l.length) groupes.push({ cle: 'retraites', titre: 'Retraites', total: l.length, items: l.slice(0, max).map(function (x) {
      var r = ret[x.retraite_id] || {}, parts = json2_(x.participants, []).map(function (y) { return (y.prenoms || y.prenom || '') + ' ' + (y.nom || ''); }).join(', ');
      return { titre: parts || x.contact_nom, sous: (r.id ? titreRetraite_(r) : 'Retraite') + (x.contact_nom ? ' · ' + x.contact_nom : ''), lien: '/retraites/' + x.retraite_id };
    }) });
  });
  // Intentions de messe (tuile Intentions) : intention, donateur, adresse
  essai(function () {
    if (!peutLire_(s, 'intentions')) return;
    var cache = CacheService.getScriptCache(), c = cache.get('recherche_intentions'), l;
    if (c) l = JSON.parse(c);
    else {
      l = sb_('get', '/rest/v1/intentions?select=id,nom_intention,nom_donateur,email_donateur,date_messe,heure_messe,statut&statut=neq.annule&order=date_messe.desc') || [];
      try { cache.put('recherche_intentions', JSON.stringify(l), 120); } catch (e) { /* trop gros pour le cache */ }
    }
    var auj = aujourdhui_();
    l = l.filter(function (x) { return ok([x.nom_intention, x.nom_donateur, x.email_donateur].join(' ')); })
      .sort(function (a, b) { var fa = a.date_messe >= auj, fb = b.date_messe >= auj; return fa !== fb ? (fa ? -1 : 1) : fa ? String(a.date_messe).localeCompare(String(b.date_messe)) : String(b.date_messe).localeCompare(String(a.date_messe)); });
    if (l.length) groupes.push({ cle: 'intentions', titre: 'Intentions de messe', total: l.length, items: l.slice(0, max).map(function (x) {
      var dt = String(x.date_messe || '').split('-').reverse().join('/');
      return { titre: x.nom_intention || '(sans intention)', sous: dt + (x.heure_messe ? ' ' + String(x.heure_messe).slice(0, 5).replace(':', 'h') : '') + (x.nom_donateur ? ' · ' + x.nom_donateur : '') + (x.statut === 'en_attente' ? ' · en attente' : x.statut === 'refuse' ? ' · refusée' : ''), lien: '/intentions/gerer?id=' + x.id };
    }) });
  });
  // Annonces (tuile Annonces et newsletter)
  essai(function () {
    if (!peutLire_(s, 'annonces')) return;
    var l = (listerAnnonces_() || []).filter(function (x) { return ok([x.titre, x.description].join(' ')); })
      .sort(function (a, b) { return (b.actif ? 1 : 0) - (a.actif ? 1 : 0); });
    if (l.length) groupes.push({ cle: 'annonces', titre: 'Annonces', total: l.length, items: l.slice(0, max).map(function (x) {
      return { titre: x.titre || '(sans titre)', sous: (x.actif ? 'Active' : 'Inactive') + (x.event_date ? ' · ' + String(x.event_date).split('-').reverse().join('/') : ''), lien: '/annonces?id=' + x.id };
    }) });
  });
  return { groupes: groupes };
}

// ─── Accueil personnalisé (par utilisateur, sur tous ses appareils) ───
var BLOCS_ACCUEIL = ['chiffres', 'afaire', 'fete', 'demandes', 'notifications', 'agenda'];
function prefsAccueil_(uid) {
  var t = json2_(props_().getProperty('ACCUEIL_PREFS'), {})[uid] || {};
  var ordre = (t.ordre || []).filter(function (b) { return BLOCS_ACCUEIL.indexOf(b) > -1; });
  BLOCS_ACCUEIL.forEach(function (b) { if (ordre.indexOf(b) === -1) ordre.push(b); });
  return { ordre: ordre, masques: (t.masques || []).filter(function (b) { return BLOCS_ACCUEIL.indexOf(b) > -1; }) };
}
function ecrirePrefsAccueil_(p, s) {
  verrou_(function () {
    var tout = json2_(props_().getProperty('ACCUEIL_PREFS'), {});
    tout[s.uid] = { ordre: (p.ordre || []).filter(function (b) { return BLOCS_ACCUEIL.indexOf(b) > -1; }), masques: (p.masques || []).filter(function (b) { return BLOCS_ACCUEIL.indexOf(b) > -1; }) };
    props_().setProperty('ACCUEIL_PREFS', JSON.stringify(tout));
  });
  return prefsAccueil_(s.uid);
}
