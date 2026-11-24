/**
 * Tuile « Liturgie ».
 *
 * Les offices, la Messe du jour et la Bible sont lus directement par l'appli (données publiques de l'AppMesse).
 * Le serveur ne sert que :
 *   - les commentaires des Évangiles (usage privé : jamais publics, seulement aux utilisateurs de la tuile) ;
 *   - les marque-pages de la Bible, rangés sur le compte de chacun (Stockage : MARQUES_BIBLE = { idUtilisateur: [...] }).
 */

/** Commentaires (abrégé, chapitre, verset, texte), par pages de 500 à partir de p.de. L'appli les garde sur l'appareil. */
function commentairesBible_(p) {
  var de = Math.max(0, Number(p.de) || 0), PAGE = 500;
  var l = sb_('get', '/rest/v1/commentaires_bible?select=abrege,chapitre,verset,texte&order=abrege.asc,chapitre.asc,verset.asc&offset=' + de + '&limit=' + PAGE) || [];
  return { lignes: l, suite: l.length === PAGE ? de + PAGE : null };
}

function marquesTous_() { return json2_(props_().getProperty('MARQUES_BIBLE'), {}); }

/** Marque-pages de l'utilisateur connecté. */
function lireMarques_(p, s) { return marquesTous_()[s.uid] || []; }

/** Remplace la liste des marque-pages de l'utilisateur connecté (au plus 300). */
function ecrireMarques_(p, s) {
  var l = (p.marques || []).slice(0, 300).map(function (m) {
    return {
      id: String(m.id || '').slice(0, 40),
      livre: String(m.livre || '').slice(0, 40),
      chapitre: Number(m.chapitre) || 1,
      verset: m.verset ? Number(m.verset) : null,
      note: String(m.note || '').slice(0, 300),
      date: String(m.date || '').slice(0, 30)
    };
  }).filter(function (m) { return m.id && m.livre; });
  var verrou = LockService.getScriptLock(); verrou.waitLock(20000);
  try {
    var tous = marquesTous_();
    tous[s.uid] = l;
    props_().setProperty('MARQUES_BIBLE', JSON.stringify(tous));
  } finally { verrou.releaseLock(); }
  return l;
}

// ═══════════════════════════════ CALENDRIER PROPRE ═══════════════════════════════
// Source unique : propre/calendrier.json dans le dépôt AppMesse. Chaque enregistrement y est écrit
// (clé GitHub : Réglages → Liturgie) ; l'action « Calendrier propre » du dépôt recalcule alors les jours concernés.
// Historique : Stockage PROPRE_HISTORIQUE (200 dernières modifications, avec la version précédente de la fête).

var PROPRE_DEPOT = 'abbemolin/appMesse';
var PROPRE_FICHIER = 'propre/calendrier.json';
var PROPRE_COMMUNS = ['C1', 'C1a', 'C2', 'C2a', 'C2b', 'C3', 'C3a', 'C3b', 'C4', 'C4a', 'C4b', 'C4c', 'C5', 'C5a', 'C5b', 'C5c',
  'C6', 'C6a', 'C6b', 'C7', 'C7a', 'C7b', 'C8', 'C11'];
var PROPRE_PIECES = ['Oratio', 'Lectio4', 'Lectio5', 'Lectio6', 'Responsory4', 'Responsory5', 'Responsory6', 'Ant 1', 'Ant 2', 'Ant 3',
  'Ant Matutinum', 'Ant Laudes', 'Ant Vespera', 'Hymnus Vespera', 'Hymnus Matutinum', 'Hymnus Laudes', 'Capitulum Laudes', 'Capitulum Vespera', 'Invit',
  'Introitus', 'Lectio', 'Graduale', 'Tractus', 'Sequentia', 'Evangelium', 'Offertorium', 'Secreta', 'Communio', 'Postcommunio'];

function github_(methode, chemin, corps) {
  var cle = props_().getProperty('GITHUB_CLE');
  if (!cle) throw erreur_('CONFIG', 'Clé GitHub absente : Réglages → Liturgie.');
  var o = { method: methode, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + cle, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } };
  if (corps !== undefined) { o.contentType = 'application/json'; o.payload = JSON.stringify(corps); }
  var rep = UrlFetchApp.fetch('https://api.github.com' + chemin, o);
  var code = rep.getResponseCode(), txt = rep.getContentText();
  if (code === 401) throw erreur_('GITHUB', 'Clé GitHub refusée (expirée ou fausse) : Réglages → Liturgie.');
  if (code === 403 || code === 404) throw erreur_('GITHUB', 'La clé GitHub n\'a pas accès au dépôt ' + PROPRE_DEPOT + ' (droits « Contents » en écriture et « Actions » en lecture).');
  if (code === 409) throw erreur_('CONFLIT', 'Le calendrier vient d\'être modifié par quelqu\'un d\'autre : rechargez la page et recommencez.');
  if (code >= 300) throw erreur_('GITHUB', 'GitHub : erreur ' + code + ' ' + txt.slice(0, 200));
  return txt ? JSON.parse(txt) : null;
}

function lireCalendrierDepot_() {
  var r = github_('get', '/repos/' + PROPRE_DEPOT + '/contents/' + PROPRE_FICHIER + '?ref=main');
  var texte = Utilities.newBlob(Utilities.base64Decode(r.content.replace(/\s/g, ''))).getDataAsString('UTF-8');
  return { calendrier: JSON.parse(texte), sha: r.sha };
}

function ecrireCalendrierDepot_(cal, sha, message) {
  var texte = JSON.stringify(cal, null, 1) + '\n';
  var r = github_('put', '/repos/' + PROPRE_DEPOT + '/contents/' + PROPRE_FICHIER, {
    message: message, sha: sha, branch: 'main',
    content: Utilities.base64Encode(Utilities.newBlob(texte, 'application/json').getBytes())
  });
  return r.commit.sha;
}

/** Calendrier, état du dernier calcul, historique. */
function lirePropre_(p, s) {
  var d = lireCalendrierDepot_();
  return { calendrier: d.calendrier, sha: d.sha, calcul: etatCalculPropre_(), historique: historiquePropre_().slice(0, 60) };
}

function historiquePropre_() { return json2_(props_().getProperty('PROPRE_HISTORIQUE'), []); }

/** État du dernier calcul (action « Calendrier propre » du dépôt). */
function etatCalculPropre_() {
  try {
    var r = github_('get', '/repos/' + PROPRE_DEPOT + '/actions/workflows/propre.yml/runs?per_page=1');
    var x = (r.workflow_runs || [])[0];
    if (!x) return null;
    return { statut: x.status, resultat: x.conclusion, debut: x.run_started_at || x.created_at, fin: x.updated_at, sha: x.head_sha, lien: x.html_url };
  } catch (e) { return { erreur: e.message }; }
}

function textePropre_(v, max) { return String(v == null ? '' : v).replace(/\r\n/g, '\n').slice(0, max || 300).trim(); }

/** Fête envoyée par la page → fête propre au format de propre/calendrier.json (contrôlée). */
function fetePropreValide_(f) {
  f = f || {};
  var date = String(f.date || '');
  if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) throw erreur_('INVALIDE', 'Date invalide (jour et mois).');
  var rang = f.rang === 'comm' ? 'comm' : Number(f.rang);
  if ([1, 2, 3, 'comm'].indexOf(rang) === -1) throw erreur_('INVALIDE', 'Rang invalide.');
  var base = f.base ? String(f.base) : null;
  if (base && !/^\d\d-\d\d$/.test(base)) throw erreur_('INVALIDE', 'Fête romaine reprise : date invalide.');
  var commun = String(f.commun || '');
  if (!base && PROPRE_COMMUNS.indexOf(commun) === -1) throw erreur_('INVALIDE', 'Choisissez un commun.');
  if (commun && PROPRE_COMMUNS.indexOf(commun) === -1) throw erreur_('INVALIDE', 'Commun inconnu.');
  var nomLa = textePropre_(f.nom_la, 200);
  if (!nomLa) throw erreur_('INVALIDE', 'Le nom latin est nécessaire (titre de l\'office).');
  var pieces = function (o) {
    var r = {};
    Object.keys(o || {}).forEach(function (k) {
      if (PROPRE_PIECES.indexOf(k) === -1) return;
      var la = textePropre_((o[k] || {}).la, 20000), fr = textePropre_((o[k] || {}).fr, 20000);
      if (la || fr) r[k] = { la: la, fr: fr };
    });
    return r;
  };
  var id = String(f.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)
    || (nomLa.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) + '-' + date);
  return {
    id: id, groupe: ['communaute', 'strasbourg', 'paroisse'].indexOf(f.groupe) > -1 ? f.groupe : 'paroisse', date: date,
    nom_la: nomLa, nom_fr: textePropre_(f.nom_fr, 200), rang: rang, commun: commun, base: base,
    romain: f.romain === 'omettre' ? 'omettre' : 'commemorer',
    nom_oraison: { la: textePropre_((f.nom_oraison || {}).la, 120), fr: textePropre_((f.nom_oraison || {}).fr, 120) },
    office: pieces(f.office), messe: pieces(f.messe), note: textePropre_(f.note, 500)
  };
}

/** Ajoute, modifie ou supprime une fête (p.fete, ou p.supprimer = id) ou une mention (p.mention / p.supprimerMention = date). */
function ecrirePropre_(p, s) {
  var verrou = LockService.getScriptLock(); verrou.waitLock(30000);
  try {
    var d = lireCalendrierDepot_(), cal = d.calendrier;
    if (p.sha && p.sha !== d.sha) throw erreur_('CONFLIT', 'Le calendrier vient d\'être modifié par quelqu\'un d\'autre : rechargez la page et recommencez.');
    cal.fetes = cal.fetes || []; cal.mentions = cal.mentions || [];
    var action, nom, id, avant = null, sorte = 'fete';
    if (p.fete) {
      var f = fetePropreValide_(p.fete);
      var i = -1;
      cal.fetes.forEach(function (x, k) { if (x.id === (p.fete.idAvant || f.id)) i = k; });
      var autre = cal.fetes.filter(function (x, k) { return k !== i && x.date === f.date; })[0];
      if (autre) throw erreur_('INVALIDE', 'Il y a déjà une fête du calendrier propre le ' + f.date + ' : ' + (autre.nom_fr || autre.nom_la) + '.');
      if (i > -1) { avant = cal.fetes[i]; f.id = avant.id; cal.fetes[i] = f; action = 'modifiée'; }
      else { if (cal.fetes.some(function (x) { return x.id === f.id; })) f.id += '-' + Date.now().toString(36); cal.fetes.push(f); action = 'ajoutée'; }
      id = f.id; nom = f.nom_fr || f.nom_la;
    } else if (p.supprimer) {
      var j = -1;
      cal.fetes.forEach(function (x, k) { if (x.id === p.supprimer) j = k; });
      if (j === -1) throw erreur_('INTROUVABLE', 'Fête introuvable.');
      avant = cal.fetes[j]; cal.fetes.splice(j, 1);
      action = 'supprimée'; id = avant.id; nom = avant.nom_fr || avant.nom_la;
    } else if (p.mention || p.supprimerMention) {
      sorte = 'mention';
      var date = String((p.mention || {}).date || p.supprimerMention || '');
      if (!/^\d\d-\d\d$/.test(date)) throw erreur_('INVALIDE', 'Date invalide.');
      var m = -1;
      cal.mentions.forEach(function (x, k) { if (x.date === date) m = k; });
      avant = m > -1 ? cal.mentions[m] : null;
      if (p.supprimerMention) { if (m === -1) throw erreur_('INTROUVABLE', 'Mention introuvable.'); cal.mentions.splice(m, 1); action = 'supprimée'; nom = avant.nom; }
      else {
        var mn = { date: date, nom: textePropre_(p.mention.nom, 200), groupe: p.mention.groupe === 'paroisse' ? 'paroisse' : 'strasbourg' };
        if (!mn.nom) throw erreur_('INVALIDE', 'Nom de la mention vide.');
        var ancienne = String(p.mention.avant || '');
        if (ancienne && ancienne !== date) {   // mention déplacée : l'ancienne date est libérée
          cal.mentions = cal.mentions.filter(function (x) { return x.date !== ancienne; });
          m = -1; cal.mentions.forEach(function (x, k) { if (x.date === date) m = k; });
        }
        if (m > -1) cal.mentions[m] = mn; else cal.mentions.push(mn);
        action = m > -1 ? 'modifiée' : 'ajoutée'; nom = mn.nom;
      }
      id = date;
      cal.mentions.sort(function (a, b) { return a.date.localeCompare(b.date); });
    } else throw erreur_('INVALIDE', 'Rien à enregistrer.');
    cal.fetes.sort(function (a, b) { return a.date.localeCompare(b.date); });
    var sha = ecrireCalendrierDepot_(cal, d.sha, 'Calendrier propre : ' + (sorte === 'mention' ? 'mention ' : '') + nom + ' ' + action + ' (' + s.nom + ')');
    var h = historiquePropre_();
    h.unshift({ date: new Date().toISOString(), par: s.nom, sorte: sorte, action: action, id: id, nom: nom, avant: avant, sha: sha });
    props_().setProperty('PROPRE_HISTORIQUE', JSON.stringify(h.slice(0, 200)));
    journaliser_(s, 'Calendrier propre : ' + nom + ' ' + action, '');
    suivreCalculPropre_(sha, s.uid, nom);
    return lirePropre_(p, s);
  } finally { verrou.releaseLock(); }
}

/** Revient à la version d'avant une modification de l'historique (p.index). */
function annulerPropre_(p, s) {
  var h = historiquePropre_()[Number(p.index)];
  if (!h) throw erreur_('INTROUVABLE', 'Modification introuvable.');
  var d = lireCalendrierDepot_();
  if (h.sorte === 'mention') {
    return ecrirePropre_(h.avant ? { mention: h.avant, sha: d.sha } : { supprimerMention: h.id, sha: d.sha }, s);
  }
  if (!h.avant) return ecrirePropre_({ supprimer: h.id, sha: d.sha }, s);     // fête ajoutée : on la retire
  var f = JSON.parse(JSON.stringify(h.avant));
  f.idAvant = f.id;
  return ecrirePropre_({ fete: f, sha: d.sha }, s);
}

// ─── Notification « calcul fini » : vérification toutes les 5 minutes tant qu'un calcul est attendu ───
function suivreCalculPropre_(sha, uid, nom) {
  var att = json2_(props_().getProperty('PROPRE_ATTENTE'), []);
  att.push({ sha: sha, uid: uid, nom: nom, depuis: Date.now() });
  props_().setProperty('PROPRE_ATTENTE', JSON.stringify(att));
  var existe = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'verifierCalculPropre'; });
  if (!existe) ScriptApp.newTrigger('verifierCalculPropre').timeBased().everyMinutes(5).create();
}

function verifierCalculPropre() {
  var att = json2_(props_().getProperty('PROPRE_ATTENTE'), []), reste = [];
  var runs = [];
  try { runs = github_('get', '/repos/' + PROPRE_DEPOT + '/actions/workflows/propre.yml/runs?per_page=20').workflow_runs || []; } catch (e) { reste = att; }
  if (!reste.length) {
    att.forEach(function (a) {
      var r = runs.filter(function (x) { return x.head_sha === a.sha; })[0];
      if (r && r.status === 'completed') {
        notifier_(a.uid, r.conclusion === 'success' ? 'Calendrier propre : calcul terminé' : 'Calendrier propre : le calcul a échoué',
          r.conclusion === 'success' ? a.nom + ' — bréviaire et messe à jour d\'ici une minute.' : a.nom + ' — le recalcul n\'a pas abouti, voir la page Calendrier propre.', '#/calendrier-propre');
      } else if (Date.now() - a.depuis < 3 * 3600 * 1000) reste.push(a);   // au-delà de 3 h, on abandonne
    });
  }
  props_().setProperty('PROPRE_ATTENTE', JSON.stringify(reste));
  if (!reste.length) ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'verifierCalculPropre') ScriptApp.deleteTrigger(t); });
}

// ─── Réglages → Liturgie ───
function lireLitReglages_() { return { github_ok: !!props_().getProperty('GITHUB_CLE'), depot: PROPRE_DEPOT }; }
function ecrireLitReglages_(p, s) {
  if (p.github_cle) props_().setProperty('GITHUB_CLE', String(p.github_cle).trim());
  if (p.github_cle_effacer) props_().deleteProperty('GITHUB_CLE');
  journaliser_(s, 'Liturgie : réglages modifiés', '');
  return lireLitReglages_();
}
function testerLitReglages_() {
  try {
    var d = lireCalendrierDepot_();
    var e = etatCalculPropre_();
    return { github: '✓ Dépôt ' + PROPRE_DEPOT + ' : ' + d.calendrier.fetes.length + ' fêtes lues'
      + (e && e.erreur ? ' — mais état des calculs illisible (droit « Actions » en lecture ?)' : '') + '.' };
  } catch (e) { return { github: '✗ ' + e.message }; }
}

// ═══════════════════════════════ ORDO ═══════════════════════════════
/** Messes de l'agenda public et intentions validées, du p.debut au p.fin (AAAA-MM-JJ, 45 jours au plus). */
function ordoMesses_(p) {
  var debut = String(p.debut || ''), fin = String(p.fin || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(debut) || !/^\d{4}-\d{2}-\d{2}$/.test(fin) || fin < debut) throw erreur_('INVALIDE', 'Période invalide.');
  if (ajouterJours_(debut, 45) < fin) throw erreur_('INVALIDE', 'Période trop longue.');
  var intentions = sb_('get', '/rest/v1/intentions?select=date_messe,heure_messe,nom_intention,type_intention,google_event_id'
    + '&statut=eq.valide&date_messe=gte.' + debut + '&date_messe=lte.' + fin);
  return { evenements: evenementsAgendaApi_(p.debutIso || debut + 'T00:00:00', p.finIso || fin + 'T23:59:59'), intentions: intentions || [] };
}
