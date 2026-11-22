/**
 * Import du tableau des catéchumènes (« Baptisés adultes.xlsx »).
 * Le fichier est lu dans l'appli ; le serveur reçoit une fiche par personne avec le statut choisi dans l'aperçu
 * (baptême 2027 / 2028…, en attente, baptisé(e) en 2024 / 2025 / 2026, ne pas importer).
 * Un dossier existant n'est que complété (cases vides, étapes et documents ajoutés).
 */

var VIGILES_PASCALES = { '2023': '2023-04-08', '2024': '2024-03-30', '2025': '2025-04-19', '2026': '2026-04-04', '2027': '2027-03-27', '2028': '2028-04-15', '2029': '2029-03-31' };

/** « Jérôme ERNENWEIN » → prénom Jérôme, nom ERNENWEIN ; « Gilles Grosborne » → dernier mot = nom. */
function prenomNom_(t) {
  var mots = String(t || '').replace(/\s+/g, ' ').trim().split(' ').filter(String);
  if (mots.length < 2) return { prenom: '', nom: mots[0] || '' };
  var maj = function (m) { return m.replace(/[^A-Za-zÀ-ÿ]/g, '').length > 1 && m === m.toUpperCase() && /[A-ZÀ-Þ]/.test(m); };
  var i = mots.findIndex ? mots.findIndex(maj) : -1;
  if (i > 0) return { prenom: mots.slice(0, i).join(' '), nom: mots.slice(i).join(' ') };
  // particules : « Jennifer Van Vooren », « Marie de La Tour »
  var k = mots.length - 1;
  while (k > 1 && /^(van|von|de|der|den|du|des|la|le|da|di|del|della|ben|el|al|mac|mc|st|saint|sainte)$/i.test(mots[k - 1])) k--;
  return { prenom: mots.slice(0, k).join(' '), nom: mots.slice(k).join(' ') };
}
function accompagnateur_(t) {
  var v = String(t || '').trim();
  if (!v) return '';
  if (/^(molin|le gall)$/i.test(v)) return 'abbé ' + v;
  return v.replace(/carbonnieres/i, 'Carbonnières');
}
function premierPrenom_(t) { return (sansAccents_(t).split(/[\s,()-]+/).filter(String)[0]) || ''; }
function memePersonneImport_(i, x) {
  if (!premierPrenom_(i.prenoms) || premierPrenom_(i.prenoms) !== premierPrenom_(x.prenoms)) return false;
  var a = cleNom_(i.nom), b = cleNom_(x.nom);
  if (!a || !b) return !!i.email && !!x.email && String(i.email).toLowerCase() === String(x.email).toLowerCase();
  return a === b || levenshtein_(a, b) <= 1;
}

function importerCatechumenes_(p, s) {
  var personnes = (p.personnes || []).filter(function (x) { return x && (x.nom || x.prenoms); });
  var dossiers = lignes_('Dossiers').filter(function (d) { return d.type === 'catechumene'; });
  var trouver = function (x) {
    return dossiers.filter(function (d) { return memePersonneImport_(json2_(d.donnees, {}).infos || {}, x); })[0];
  };
  if (p.simuler) {
    return personnes.map(function (x) { var d = trouver(x); return { cle: x.cle, existant: d ? { id: d.id, nom: d.nom, etat: d.etat } : null }; });
  }
  var res = { nouveaux: 0, completes: 0, ignores: 0 };
  verrou_(function () {
    dossiers = lignes_('Dossiers').filter(function (d) { return d.type === 'catechumene'; });
    personnes.forEach(function (x) {
      if (!x.statut || x.statut === 'ignorer') { res.ignores++; return; }
      var baptise = /^bapt(\d{4})$/.exec(x.statut);
      var annee = baptise ? baptise[1] : (/^\d{4}$/.test(x.statut) ? x.statut : '');
      var d = trouver(x), nouveau = !d;
      if (nouveau) {
        d = { id: uid_(), type: 'catechumene', etat: 'ouvert', cree_le: maintenant_(), source: 'Fichier « Baptisés adultes »',
              nom: '', email: '', telephone: '', date_celebration: '', evenement_id: '', responsable: '',
              donnees: JSON.stringify({ infos: {}, etapes: {}, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] }), maj_le: '', maj_par: '' };
        dossiers.push(d);
      }
      var don = json2_(d.donnees, {});
      var i = don.infos = don.infos || {};
      don.etapes = don.etapes || {}; don.documents = don.documents || {};
      var pere = prenomNom_(x.pere), mere = prenomNom_(x.mere);
      var champs = {
        prenoms: x.prenoms, nom: x.nom, naissance_date: x.naissance_date, naissance_lieu: x.naissance_lieu, adresse: x.adresse,
        telephone: x.telephone, email: x.email, pere_prenom: pere.prenom, pere_nom: pere.nom, mere_prenom: mere.prenom, mere_nom_jeune_fille: mere.nom,
        parrain_marraine: x.parrain, accompagnateurs: accompagnateur_(x.accompagnateur), situation: x.situation, entree_date: x.entree_date,
        disponibilite: x.disponibilite, diocese_inscription: x.diocese_inscription ? 'oui' : '', diocese_mail: x.diocese_mail ? 'oui' : '',
        annee_sacrements: annee
      };
      Object.keys(champs).forEach(function (k) { if (champs[k] && !i[k]) i[k] = String(champs[k]); });
      if (x.statut === 'attente' && !i.annee_sacrements) i.en_attente = 'oui';
      if (i.annee_sacrements) delete i.en_attente;
      if (x.notes && x.notes.length) {
        var deja = String(i.remarques || '');
        var aj = x.notes.filter(function (n) { return deja.indexOf(n) === -1; });
        if (aj.length) i.remarques = [deja].concat(aj).filter(String).join('\n');
      }

      var quand = function (date) { return (date || aujourdhui_()) + 'T12:00:00.000Z'; };
      var entree = x.entree_date || (x.entree_annee ? x.entree_annee + '-09-01' : '');
      var cocher = function (cle, libelle, date) {
        if (don.etapes[cle] && don.etapes[cle].fait) return;
        don.etapes[cle] = { fait: true, date: quand(date), par: 'Import', libelle: libelle };
      };
      cocher('accueil', 'Premier accueil', entree);
      if (x.accompagnateur) cocher('accompagnateur', 'Accompagnateur désigné', entree);
      if (entree || x.b6 || baptise) cocher('entree', 'Entrée en catéchuménat', entree);
      if (x.lettre || baptise) cocher('lettre', "Lettre à l'évêque", '');
      if (baptise) {
        var vigile = VIGILES_PASCALES[baptise[1]] || (baptise[1] + '-04-01');
        cocher('appel', 'Appel décisif', vigile); cocher('scrutins', 'Scrutins', vigile);
        cocher('sacrements', 'Baptême, confirmation, eucharistie', vigile);
        if (d.etat === 'ouvert') d.etat = 'clos';
      }
      var recu = function (cle) { if (!(don.documents[cle] && don.documents[cle].recu)) don.documents[cle] = { recu: true, date: maintenant_(), par: 'Import' }; };
      if (x.acte_naissance) recu('acte_naissance');
      if (x.lettre) recu('lettre_eveque');

      d.email = d.email || i.email || ''; d.telephone = d.telephone || i.telephone || '';
      d.nom = nomDossier_('catechumene', i) || d.nom;
      d.donnees = JSON.stringify(don);
      ajouterHistorique_(d, s.nom, (nouveau ? 'Créé' : 'Complété') + ' par l\'import du fichier « Baptisés adultes » (onglets ' + (x.onglets || []).join(', ') + ')'
        + (baptise ? ' — baptisé(e) à Pâques ' + baptise[1] : ''));
      d.maj_le = maintenant_(); d.maj_par = s.nom;
      ecrireLigne_('Dossiers', d);
      if (nouveau) res.nouveaux++; else res.completes++;
    });
  });
  journaliser_(s, 'Import des catéchumènes', res.nouveaux + ' créés, ' + res.completes + ' complétés');
  return res;
}
