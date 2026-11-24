/**
 * « À faire » sur l'accueil de l'app : ce qui attend la personne.
 *  - l'étape du jour d'un parcours suivi, pas encore cochée ;
 *  - un paiement à finir (retraite, cotisation du catéchisme, livres) ;
 *  - une pièce à fournir pour un dossier de sacrement en cours.
 * Pour un foyer, les inscriptions et les dossiers des enfants faits par le conjoint comptent aussi.
 * Calculé à la demande (l'accueil le charge à part, pour rester rapide).
 */

/** qui : { uid, mails: [..], inscriptions?, dossiers? } */
function aFaireApp_(qui) {
  var l = [], auj = aujourdhui_();
  // 1. Étape du jour des parcours suivis
  try {
    if (db_().getSheetByName('PropSuivis')) {
      var publiees = {}; lignes_('Propositions').forEach(function (p) { if (p.statut === 'publiee') publiees[p.id] = p; });
      var duJour = {}; lignes_('PropEtapes').forEach(function (e) { if (publiees[e.proposition_id] && e.jour === auj) duJour[e.proposition_id] = e; });
      lignes_('PropSuivis').filter(function (s) { return s.uid === qui.uid && duJour[s.proposition_id]; }).forEach(function (s) {
        var e = duJour[s.proposition_id];
        if (json2_(s.faites, []).indexOf(String(e.id)) > -1) return;
        l.push({ type: 'etape', texte: publiees[s.proposition_id].titre + ' : ' + (e.titre || 'étape du jour'), id: s.proposition_id });
      });
    }
  } catch (e) { console.error('à faire étapes', e); }
  // 2. Paiements à finir
  try {
    var ins = qui.inscriptions || { retraites: [], catechisme: [], livres: [] };
    ins.retraites.forEach(function (r) {
      if (r.reste > 0) l.push({ type: 'paiement', texte: r.titre + ' : reste ' + montantTexte_(r.reste) + ' à régler', lien: r.lien_payer || r.lien_ceremonie || '', vue: 'inscriptions' });
    });
    var resteCate = ins.catechisme.reduce(function (a, x) { return a + Math.max(0, Number(x.reste) || 0); }, 0);
    if (resteCate > 0) l.push({ type: 'paiement', texte: 'Catéchisme : reste ' + montantTexte_(resteCate) + ' de cotisation', lien: ins.lien_cotisation || '', vue: 'inscriptions' });
    ins.livres.forEach(function (c) {
      if (c.reste > 0) l.push({ type: 'paiement', texte: 'Livres commandés : reste ' + montantTexte_(c.reste) + ' à régler', lien: c.lien_payer || '', vue: 'inscriptions' });
    });
  } catch (e) { console.error('à faire paiements', e); }
  // 3. Pièces à fournir pour les dossiers de sacrements
  try {
    (qui.dossiers || []).forEach(function (d) {
      if (d.etat !== 'en_cours' || !(d.a_fournir || []).length) return;
      l.push({ type: 'dossier', texte: d.type + (d.qui ? ' de ' + d.qui : '') + ' : ' + d.a_fournir.join(', ') + ' à apporter ou envoyer au secrétariat', vue: 'sacrements' });
    });
  } catch (e) { console.error('à faire dossiers', e); }
  return l;
}
function montantTexte_(v) {
  v = Math.round(Number(v || 0) * 100) / 100;
  return (v % 1 ? v.toFixed(2).replace('.', ',') : String(v)) + ' €';
}
function aFaireCompte_(x) {
  return aFaireApp_({ uid: 'cpt:' + x.id, inscriptions: inscriptionsFoyer_(x), dossiers: dossiersFoyer_(x).filter(function (d) { return d.cle !== 'catechumene'; }) });
}
function aFaireEspace_(d) {
  var m = normMail_(mailDossier_(d));
  return aFaireApp_({ uid: 'esp:' + d.id, inscriptions: m ? mesInscriptions_(m) : null, dossiers: [] });
}
