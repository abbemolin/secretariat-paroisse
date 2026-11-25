/**
 * App des paroissiens — propositions spirituelles.
 *  - Parcours jour par jour (dates fixes : tout le monde avance ensemble ; celui qui s'abonne en retard rattrape)
 *    et textes isolés (vie de saint, temps liturgique…), préparés par le curé et les prêtres (page « Propositions »).
 *  - Étapes : texte, image, audio (MP3 envoyé, rangé dans le Drive de la paroisse), référence biblique.
 *  - Lecture : paroissiens connectés (comptes et espaces). Abonnement libre aux parcours ; notification
 *    de l'étape du jour à l'heure choisie par chacun (déclencheur toutes les heures) ; suivi pour la personne seule
 *    (la paroisse ne voit que le nombre d'abonnés). « Dupliquer » pour reprendre un parcours l'année suivante.
 */

var COLONNES_PROPS = ['id', 'type', 'titre', 'resume', 'image', 'debut', 'statut', 'auteur', 'cree_le', 'maj_le', 'maj_par'];
var COLONNES_ETAPES = ['id', 'proposition_id', 'ordre', 'jour', 'titre', 'texte', 'image', 'audio_id', 'audio_nom', 'bible'];
var COLONNES_SUIVIS = ['id', 'uid', 'proposition_id', 'abonne_le', 'faites'];
var AUDIO_MAX = 20 * 1024 * 1024;

function feuillesProps_() {
  [['Propositions', COLONNES_PROPS], ['PropEtapes', COLONNES_ETAPES], ['PropSuivis', COLONNES_SUIVIS]].forEach(function (x) { completerColonnes_(feuilleEsp_(x[0], x[1]), x[1]); });
}
function lignesProps_(nom) { feuillesProps_(); return lignes_(nom); }
function etapesDe_(pid) { return lignesProps_('PropEtapes').filter(function (e) { return e.proposition_id === pid; }).sort(function (a, b) { return Number(a.ordre) - Number(b.ordre); }); }
function urlAudio_(id) { return id ? 'https://drive.google.com/uc?export=download&id=' + id : ''; }
function finProp_(p, etapes) { var j = etapes.map(function (e) { return e.jour; }).filter(String).sort(); return j.length ? j[j.length - 1] : p.debut; }

// ─── Secrétariat (curé et prêtres) ───

function propEquipe_(p, avecEtapes) {
  var etapes = etapesDe_(p.id), abonnes = lignesProps_('PropSuivis').filter(function (s) { return s.proposition_id === p.id; }).length;
  var o = { id: p.id, type: p.type, titre: p.titre, resume: p.resume, image: p.image, debut: p.debut, fin: finProp_(p, etapes), statut: p.statut, auteur: p.auteur,
    maj_le: p.maj_le, maj_par: p.maj_par, nb_etapes: etapes.length, abonnes: abonnes };
  if (avecEtapes) o.etapes = etapes.map(function (e) { return { id: e.id, ordre: Number(e.ordre), jour: e.jour, titre: e.titre, texte: e.texte, image: e.image, audio_id: e.audio_id, audio_nom: e.audio_nom, bible: e.bible }; });
  return o;
}
function listerPropsRoute_() {
  return lignesProps_('Propositions').sort(function (a, b) { return String(b.debut).localeCompare(String(a.debut)); }).map(function (p) { return propEquipe_(p, false); });
}
function lirePropRoute_(p) {
  var x = lignesProps_('Propositions').filter(function (y) { return y.id === p.id; })[0];
  if (!x) throw erreur_('INTROUVABLE', 'Proposition introuvable.');
  return propEquipe_(x, true);
}
function dateIsoStricte_(v) { v = String(v || ''); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; }
function ecrirePropRoute_(p, s) {
  var court = function (v, n) { return String(v == null ? '' : v).trim().slice(0, n); };
  var type = p.type === 'texte' ? 'texte' : 'parcours';
  var titre = court(p.titre, 120);
  if (!titre) throw erreur_('INVALIDE', 'Le titre est obligatoire.');
  var debut = dateIsoStricte_(p.debut);
  if (!debut) throw erreur_('INVALIDE', type === 'parcours' ? 'Indiquez la date du premier jour.' : 'Indiquez la date de publication.');
  var etapes = (p.etapes || []).slice(0, 120);
  if (type === 'texte') etapes = etapes.slice(0, 1);
  if (!etapes.length) throw erreur_('INVALIDE', type === 'parcours' ? 'Ajoutez au moins une étape.' : 'Écrivez le texte.');
  var image = court(p.image, 500);
  if (image && !/^https:\/\//.test(image)) throw erreur_('INVALIDE', 'Image : une adresse https:// est attendue.');
  var id = verrou_(function () {
    feuillesProps_();
    var x = p.id ? lignes_('Propositions').filter(function (y) { return y.id === p.id; })[0] : null;
    if (p.id && !x) throw erreur_('INTROUVABLE', 'Proposition introuvable.');
    x = x || { id: uid_(), cree_le: maintenant_(), auteur: s.nom, statut: 'brouillon' };
    x.type = type; x.titre = titre; x.resume = court(p.resume, 600); x.image = image; x.debut = debut;
    if (p.statut === 'publiee' || p.statut === 'brouillon') x.statut = p.statut;
    x.maj_le = maintenant_(); x.maj_par = s.nom;
    ecrireLigne_('Propositions', x);
    // étapes : remplacées (les audios déjà envoyés sont gardés par leur identifiant)
    var avant = lignes_('PropEtapes').filter(function (e) { return e.proposition_id === x.id; });
    var gardes = {};
    etapes.forEach(function (e, k) {
      var jour = type === 'texte' ? debut : (dateIsoStricte_(e.jour) || ajouterJours_(debut, k));
      var y = avant.filter(function (a) { return a.id === e.id; })[0] || { id: uid_(), proposition_id: x.id };
      y.ordre = k + 1; y.jour = jour; y.titre = court(e.titre, 160); y.texte = court(e.texte, 20000); y.image = court(e.image, 500); y.bible = court(e.bible, 120);
      if (e.audio_id !== undefined) { y.audio_id = court(e.audio_id, 80); y.audio_nom = court(e.audio_nom, 160); }
      if (!y.titre && !y.texte) throw erreur_('INVALIDE', 'Étape ' + (k + 1) + ' : écrivez au moins un titre ou un texte.');
      ecrireLigne_('PropEtapes', y); gardes[y.id] = 1;
    });
    avant.filter(function (a) { return !gardes[a.id]; }).reverse().forEach(function (a) { oublierLignes_('PropEtapes'); var z = lignes_('PropEtapes').filter(function (b) { return b.id === a.id; })[0]; if (z) feuille_('PropEtapes').deleteRow(z._ligne); });
    oublierLignes_('PropEtapes');
    return x.id;
  });
  journaliser_(s, 'Proposition enregistrée', titre);
  assurerDeclencheurProps_();
  return lirePropRoute_({ id: id });
}
function dupliquerPropRoute_(p, s) {
  var src = lirePropRoute_({ id: p.id }), debut = dateIsoStricte_(p.debut);
  if (!debut) throw erreur_('INVALIDE', 'Indiquez la nouvelle date du premier jour.');
  var ecart = Math.round((new Date(debut + 'T12:00:00Z') - new Date(src.debut + 'T12:00:00Z')) / 86400000);
  return ecrirePropRoute_({ type: src.type, titre: src.titre, resume: src.resume, image: src.image, debut: debut, statut: 'brouillon',
    etapes: src.etapes.map(function (e) { return { titre: e.titre, texte: e.texte, image: e.image, bible: e.bible, audio_id: e.audio_id, audio_nom: e.audio_nom, jour: e.jour ? ajouterJours_(e.jour, ecart) : '' }; }) }, s);
}
function supprimerPropRoute_(p, s) {
  verrou_(function () {
    feuillesProps_();
    [['PropSuivis', 'proposition_id'], ['PropEtapes', 'proposition_id'], ['Propositions', 'id']].forEach(function (x) {
      lignes_(x[0]).filter(function (y) { return y[x[1]] === p.id; }).reverse().forEach(function (y) { feuille_(x[0]).deleteRow(y._ligne); });
      oublierLignes_(x[0]);
    });
  });
  journaliser_(s, 'Proposition supprimée', p.id);
  return listerPropsRoute_();
}
/** Audio d'une étape : MP3 rangé dans le Drive « Propositions », lisible par lien (pour le lecteur de l'app). */
function audioPropRoute_(p, s) {
  var type = String(p.type || '');
  if (!/^audio\/(mpeg|mp3|mp4|x-m4a|aac|ogg|wav|x-wav)$/.test(type)) throw erreur_('INVALIDE', 'Envoyez un fichier audio (MP3 de préférence).');
  var octets = Utilities.base64Decode(String(p.base64 || ''));
  if (octets.length > AUDIO_MAX) throw erreur_('TROP_GROS', 'Fichier trop lourd (20 Mo au plus).');
  var nom = String(p.nom || 'audio.mp3').slice(0, 160);
  var f = sousDossier_(racine_(), 'Propositions (audio)').createFile(Utilities.newBlob(octets, type, nom));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  journaliser_(s, 'Proposition : audio envoyé', nom);
  return { audio_id: f.getId(), audio_nom: nom };
}

// ─── App des paroissiens ───

function propsApp_(uid) {
  var auj = aujourdhui_(), suivis = lignesProps_('PropSuivis').filter(function (s) { return s.uid === uid; });
  return lignesProps_('Propositions').filter(function (p) { return p.statut === 'publiee' && p.debut <= ajouterJours_(auj, 30); }).map(function (p) {
    var etapes = etapesDe_(p.id), fin = finProp_(p, etapes), suivi = suivis.filter(function (s) { return s.proposition_id === p.id; })[0];
    var ouvertes = etapes.filter(function (e) { return e.jour <= auj; }).length;
    return { id: p.id, type: p.type, titre: p.titre, resume: p.resume, image: p.image, debut: p.debut, fin: fin, nb_etapes: etapes.length, ouvertes: ouvertes,
      abonne: !!suivi, faites: suivi ? json2_(suivi.faites, []).length : 0, a_venir: p.debut > auj, terminee: fin < ajouterJours_(auj, -60) };
  }).filter(function (p) { return !p.terminee || p.abonne; }).sort(function (a, b) { return String(b.debut).localeCompare(String(a.debut)); });
}
function propApp_(uid, id) {
  var p = lignesProps_('Propositions').filter(function (y) { return y.id === id && y.statut === 'publiee'; })[0];
  if (!p) throw erreur_('INTROUVABLE', 'Proposition introuvable.');
  var auj = aujourdhui_(), suivi = lignesProps_('PropSuivis').filter(function (s) { return s.uid === uid && s.proposition_id === id; })[0], faites = suivi ? json2_(suivi.faites, []) : [];
  var etapes = etapesDe_(id);
  return { id: p.id, type: p.type, titre: p.titre, resume: p.resume, image: p.image, debut: p.debut, fin: finProp_(p, etapes), abonne: !!suivi,
    etapes: etapes.map(function (e) {
      var ouverte = e.jour <= auj;
      return { id: e.id, ordre: Number(e.ordre), jour: e.jour, titre: e.titre, ouverte: ouverte, aujourdhui: e.jour === auj, faite: faites.indexOf(e.id) > -1,
        texte: ouverte ? e.texte : '', image: ouverte ? e.image : '', bible: ouverte ? e.bible : '', audio: ouverte ? urlAudio_(e.audio_id) : '' };
    }) };
}
function actionPropApp_(qui, action, p) {
  if (action === 'liste') return { propositions: propsApp_(qui.uid), heure: qui.heure };
  if (action === 'lire') return propApp_(qui.uid, p.id);
  if (action === 'suivre' || action === 'quitter' || action === 'fait') {
    propApp_(qui.uid, p.id);   // existe et publiée
    verrou_(function () {
      feuillesProps_();
      var s = lignes_('PropSuivis').filter(function (y) { return y.uid === qui.uid && y.proposition_id === p.id; })[0];
      if (action === 'quitter') { if (s) feuille_('PropSuivis').deleteRow(s._ligne); oublierLignes_('PropSuivis'); return; }
      s = s || { id: uid_(), uid: qui.uid, proposition_id: p.id, abonne_le: maintenant_(), faites: '[]' };
      if (action === 'fait') {
        var l = json2_(s.faites, []), k = l.indexOf(String(p.etape));
        if (k > -1) l.splice(k, 1); else l.push(String(p.etape));
        s.faites = JSON.stringify(l);
      }
      ecrireLigne_('PropSuivis', s);
    });
    return propApp_(qui.uid, p.id);
  }
  throw erreur_('ACTION', 'Action inconnue.');
}
function heureProps_(prefs) { var h = Number(json2_(prefs, {}).prop_heure); return h >= 5 && h <= 22 ? h : 8; }

// ─── Notification de l'étape du jour (toutes les heures) ───

function assurerDeclencheurProps_() {
  try {
    if (CacheService.getScriptCache().get('decl_props')) return;
    if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'envoyerEtapesDuJour'; })) ScriptApp.newTrigger('envoyerEtapesDuJour').timeBased().everyHours(1).create();
    CacheService.getScriptCache().put('decl_props', '1', 21600);
  } catch (e) { console.error('déclencheur propositions', e); }
}
function envoyerEtapesDuJour() {
  if (!db_().getSheetByName('PropSuivis') || !fonctionActive_('propositions')) return;
  var auj = aujourdhui_(), h = Number(Utilities.formatDate(new Date(), 'Europe/Paris', 'H'));
  var publiees = {}; lignes_('Propositions').forEach(function (p) { if (p.statut === 'publiee' && p.type === 'parcours') publiees[p.id] = p; });
  var duJour = {}; lignes_('PropEtapes').forEach(function (e) { if (publiees[e.proposition_id] && e.jour === auj) duJour[e.proposition_id] = e; });
  var ids = Object.keys(duJour); if (!ids.length) return;
  var heures = {};
  try { lignesComptes_().forEach(function (x) { if (x.statut === 'actif') heures['cpt:' + x.id] = heureProps_(x.prefs); }); } catch (e) {}
  try { lignes_('Espaces').forEach(function (y) { heures['esp:' + y.dossier_id] = heureProps_(y.prefs); }); } catch (e) {}
  var uids = {}, titre = '';
  lignes_('PropSuivis').forEach(function (s) { if (duJour[s.proposition_id] && heures[s.uid] === h) { uids[s.uid] = 1; titre = publiees[s.proposition_id].titre; } });
  var l = Object.keys(uids); if (!l.length) return;
  props_().setProperty('NOTIF_PUBLIQUE', JSON.stringify({ type: 'proposition', titre: ids.length === 1 ? titre : 'Votre étape du jour', le: maintenant_() }));
  envoyerPushMasse_(l);
}
