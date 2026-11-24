/**
 * Tuile « Annonces et newsletter » : reprise des pages Annonces, Feuille de semaine et Newsletter de l'AppMesse.
 *
 * Mêmes données que l'AppMesse : base Supabase de l'AppMesse (tables `annonces` et `intentions`,
 * stockage `annonces-images`), agenda public du compte paroisse, liste Brevo.
 * Tout passe par ce serveur : les clés (Supabase, Brevo) ne quittent jamais le script.
 *
 * Réglages → Newsletter : clé secrète Supabase, clé API Brevo, liste Brevo, jour et heure d'envoi.
 * Tant que la clé secrète Supabase n'est pas saisie, la clé publique de l'AppMesse est utilisée
 * (elle suffit aujourd'hui ; elle ne suffira plus quand la base sera fermée au public).
 *
 * Brouillons partagés (par semaine, clé = lundi AAAA-MM-JJ), rangés dans la feuille « Stockage » :
 *   NL_SEMAINES   : feuille de semaine préparée (jours retouchés) et calendrier envoyé vers la newsletter
 *   NL_BROUILLONS : version modifiée de la newsletter
 *   NL_CAMPAGNE   : campagne Brevo programmée depuis l'appli (pour pouvoir l'annuler)
 */

var NL_DEFAUT = {
  liste: 3, jour: 0, heure: '12:00', adresses_test: 'cure@croix-glorieuse.org',
  expediteur_nom: 'Paroisse La Croix Glorieuse', expediteur_email: 'secretariat@croix-glorieuse.org',
  supabase_url: 'https://pmeaimfcwtykhqtueomd.supabase.co'
};
// Clé publique (« anon ») de l'AppMesse — déjà publique dans l'AppMesse et le formulaire du site.
var SB_CLE_PUBLIQUE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZWFpbWZjd3R5a2hxdHVlb21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MzA4MzIsImV4cCI6MjA4MzMwNjgzMn0.X91Usnq8WtZYuY40UFIo7Xl8P1O46LKqe1GvJ7RIWYE';
var CHAMPS_ANNONCE = ['titre', 'description', 'event_date', 'event_heure', 'date_debut', 'date_fin', 'image_url', 'lien', 'lien_label',
  'prioritaire', 'actif', 'dans_newsletter', 'dans_feuille', 'ordre'];
var NL_SEMAINES_GARDEES = 10;   // semaines de brouillons gardées

// ─── Réglages ───

function nlReglages_() {
  var r = json2_(props_().getProperty('NEWSLETTER'), {});
  var x = {};
  Object.keys(NL_DEFAUT).forEach(function (k) { x[k] = r[k] !== undefined && r[k] !== '' ? r[k] : NL_DEFAUT[k]; });
  x.liste = Number(x.liste) || NL_DEFAUT.liste;
  x.jour = Number(x.jour);
  if (!(x.jour >= 0 && x.jour <= 6)) x.jour = NL_DEFAUT.jour;
  if (!/^\d{2}:\d{2}$/.test(x.heure)) x.heure = NL_DEFAUT.heure;
  return x;
}
function lireNlReglages_() {
  var r = nlReglages_();
  r.supabase_secret_ok = !!props_().getProperty('SUPABASE_CLE');
  r.brevo_ok = !!props_().getProperty('BREVO_CLE');
  r.prochain_envoi = prochainEnvoi_().toISOString();
  return r;
}
function ecrireNlReglages_(p, s) {
  var r = json2_(props_().getProperty('NEWSLETTER'), {});
  ['expediteur_nom', 'expediteur_email', 'supabase_url', 'heure', 'adresses_test'].forEach(function (k) { if (p[k] !== undefined) r[k] = String(p[k] || '').trim(); });
  if (p.liste !== undefined) r.liste = Number(p.liste) || NL_DEFAUT.liste;
  if (p.jour !== undefined) r.jour = Number(p.jour);
  if (r.supabase_url) r.supabase_url = r.supabase_url.replace(/\/+$/, '');
  if (r.expediteur_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.expediteur_email)) throw erreur_('INVALIDE', 'Adresse d\'expéditeur invalide.');
  if (r.heure && !/^\d{2}:\d{2}$/.test(r.heure)) throw erreur_('INVALIDE', 'Heure d\'envoi invalide (HH:MM).');
  props_().setProperty('NEWSLETTER', JSON.stringify(r));
  if (p.supabase_cle) props_().setProperty('SUPABASE_CLE', String(p.supabase_cle).trim());
  if (p.supabase_cle_effacer) props_().deleteProperty('SUPABASE_CLE');
  if (p.brevo_cle) props_().setProperty('BREVO_CLE', String(p.brevo_cle).trim());
  journaliser_(s, 'Newsletter : réglages modifiés', '');
  return lireNlReglages_();
}
/** Essai : lecture des annonces (Supabase) et du compte + de la liste Brevo. */
function testerNewsletter_() {
  var res = { supabase: '', brevo: '' };
  try {
    var l = sb_('get', '/rest/v1/annonces?select=id');
    res.supabase = '✓ Base des annonces : ' + l.length + ' annonce(s) lue(s) avec la ' + (props_().getProperty('SUPABASE_CLE') ? 'clé secrète' : 'clé publique') + '.';
  } catch (e) { res.supabase = '✗ ' + e.message; }
  try {
    var compte = brevo_('get', '/account');
    var liste = brevo_('get', '/contacts/lists/' + nlReglages_().liste);
    res.brevo = '✓ Brevo : compte ' + (compte.email || compte.companyName || '') + ' — liste « ' + (liste.name || nlReglages_().liste) + ' »'
      + (liste.uniqueSubscribers !== undefined ? ' (' + liste.uniqueSubscribers + ' abonnés)' : liste.totalSubscribers !== undefined ? ' (' + liste.totalSubscribers + ' abonnés)' : '') + '.';
  } catch (e) { res.brevo = '✗ ' + e.message; }
  return res;
}

// ─── Accès à Supabase (base de l'AppMesse) ───

function sbCle_() { return props_().getProperty('SUPABASE_CLE') || SB_CLE_PUBLIQUE; }
function sbEntetes_(extra) {
  var cle = sbCle_(), h = { apikey: cle };
  if (/^eyJ/.test(cle)) h.Authorization = 'Bearer ' + cle;   // anciennes clés (JWT) ; les nouvelles « sb_secret_… » se contentent d'apikey
  Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
  return h;
}
function sbMessage_(code, txt) {
  var j = json2_(txt, {});
  var m = j.message || j.error_description || j.error || j.msg || txt || ('HTTP ' + code);
  return 'Base des annonces (' + code + ') : ' + String(m).slice(0, 300);
}
function sb_(methode, chemin, corps, extra) {
  var o = { method: methode, muteHttpExceptions: true, headers: sbEntetes_(extra) };
  if (corps !== undefined) { o.contentType = 'application/json'; o.payload = JSON.stringify(corps); }
  var rep = UrlFetchApp.fetch(nlReglages_().supabase_url + chemin, o);
  var code = rep.getResponseCode(), txt = rep.getContentText();
  if (code >= 300) throw erreur_('SUPABASE', sbMessage_(code, txt));
  return txt ? JSON.parse(txt) : null;
}
/** Écriture contrôlée : la base ne renvoie pas d'erreur quand elle refuse, elle ne touche aucune ligne. */
function sbEcrire_(methode, chemin, corps) {
  var r = sb_(methode, chemin, corps, { Prefer: 'return=representation' });
  if (!r || !r.length) throw erreur_('SUPABASE', 'Aucune ligne modifiée : la base a refusé l\'écriture (clé ou droits).');
  return r;
}

// ─── Annonces ───

function listerAnnonces_() {
  return sb_('get', '/rest/v1/annonces?select=*&order=prioritaire.desc,ordre.asc.nullslast,created_at.desc');
}
function champsAnnonce_(p) {
  var x = {};
  CHAMPS_ANNONCE.forEach(function (k) {
    if (p[k] === undefined) return;
    var v = p[k];
    if (['prioritaire', 'actif', 'dans_newsletter', 'dans_feuille'].indexOf(k) > -1) v = v === true;
    else if (k === 'ordre') v = v === null || v === '' ? null : Number(v);
    else { v = String(v == null ? '' : v).trim(); if (v === '') v = null; }
    if (v && (k === 'event_date' || k === 'date_debut' || k === 'date_fin') && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw erreur_('INVALIDE', 'Date invalide.');
    if (v && k === 'event_heure' && !/^\d{2}:\d{2}(:\d{2})?$/.test(v)) throw erreur_('INVALIDE', 'Heure invalide.');
    x[k] = v;
  });
  return x;
}
/** Annonces publiques (actives, dans leur période d'affichage) : pour l'app des paroissiens. Gardées 10 minutes. */
function annoncesPubliques_() {
  var cache = CacheService.getScriptCache(), c = cache.get('annonces_publiques');
  if (c) return JSON.parse(c);
  var auj = aujourdhui_(), l = [];
  try {
    l = sb_('get', '/rest/v1/annonces?select=id,titre,description,event_date,event_heure,image_url,lien,lien_label,prioritaire'
      + '&actif=eq.true&or=(date_debut.is.null,date_debut.lte.' + auj + ')&or=(date_fin.is.null,date_fin.gte.' + auj + ')'
      + '&order=prioritaire.desc,ordre.asc.nullslast,created_at.desc') || [];
  } catch (e) { console.error('annoncesPubliques_', e); return []; }
  try { cache.put('annonces_publiques', JSON.stringify(l), 600); } catch (e) { /* trop gros pour le cache */ }
  return l;
}
/** Chaque nuit (entretien) : les annonces dont la date de fin est passée deviennent inactives. */
function desactiverAnnoncesExpirees_() {
  var r = sb_('patch', '/rest/v1/annonces?actif=eq.true&date_fin=lt.' + aujourdhui_(), { actif: false }, { Prefer: 'return=representation' }) || [];
  if (r.length) journaliser_({ nom: 'Entretien' }, 'Annonces expirées désactivées', r.map(function (a) { return a.titre; }).join(', '));
  CacheService.getScriptCache().remove('annonces_publiques');
  return r.length;
}
function ecrireAnnonce_(p, s) {
  var x = champsAnnonce_(p);
  if (!p.id) {
    if (!x.titre) throw erreur_('INVALIDE', 'Le titre est obligatoire.');
    var cree = sbEcrire_('post', '/rest/v1/annonces', x)[0];
    CacheService.getScriptCache().remove('annonces_publiques');
    journaliser_(s, 'Annonce créée', x.titre);
    return cree;
  }
  if (x.titre === null) throw erreur_('INVALIDE', 'Le titre est obligatoire.');
  var r = sbEcrire_('patch', '/rest/v1/annonces?id=eq.' + encodeURIComponent(p.id), x)[0];
  CacheService.getScriptCache().remove('annonces_publiques');
  journaliser_(s, 'Annonce modifiée', r.titre || '');
  return r;
}
function supprimerAnnonce_(p, s) {
  var r = sbEcrire_('delete', '/rest/v1/annonces?id=eq.' + encodeURIComponent(p.id));
  CacheService.getScriptCache().remove('annonces_publiques');
  journaliser_(s, 'Annonce supprimée', (r[0] || {}).titre || '');
  return true;
}
/** Nouvel ordre : ids dans l'ordre voulu → ordre = 0, 1, 2… (comme l'AppMesse). */
function ordonnerAnnonces_(p, s) {
  var ids = (p.ids || []).map(String);
  if (!ids.length) return true;
  var base = nlReglages_().supabase_url;
  var reps = UrlFetchApp.fetchAll(ids.map(function (id, i) {
    return { url: base + '/rest/v1/annonces?id=eq.' + encodeURIComponent(id), method: 'patch', muteHttpExceptions: true,
      headers: sbEntetes_({ Prefer: 'return=representation' }), contentType: 'application/json', payload: JSON.stringify({ ordre: i }) };
  }));
  reps.forEach(function (rep) {
    if (rep.getResponseCode() >= 300) throw erreur_('SUPABASE', sbMessage_(rep.getResponseCode(), rep.getContentText()));
    if (!(json2_(rep.getContentText(), []) || []).length) throw erreur_('SUPABASE', 'Ordre non enregistré : la base a refusé l\'écriture.');
  });
  CacheService.getScriptCache().remove('annonces_publiques');
  journaliser_(s, 'Annonces réordonnées', '');
  return true;
}
/** Image d'une annonce : rangée dans le stockage « annonces-images » (comme l'AppMesse), renvoie son adresse publique. */
function imageAnnonce_(p) {
  var b64 = String(p.base64 || '').replace(/^data:[^,]+,/, '');
  if (!b64) throw erreur_('INVALIDE', 'Image vide.');
  var octets = Utilities.base64Decode(b64);
  if (octets.length > 8 * 1024 * 1024) throw erreur_('INVALIDE', 'Image trop lourde (8 Mo au plus).');
  var type = String(p.type || 'image/jpeg');
  if (!/^image\//.test(type)) throw erreur_('INVALIDE', 'Ce fichier n\'est pas une image.');
  var ext = (String(p.nom || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  var nom = 'annonce_' + Date.now() + '.' + ext;
  var base = nlReglages_().supabase_url;
  var rep = UrlFetchApp.fetch(base + '/storage/v1/object/annonces-images/' + nom, {
    method: 'post', muteHttpExceptions: true, headers: sbEntetes_({ 'cache-control': '3600', 'x-upsert': 'false' }),
    contentType: type, payload: Utilities.newBlob(octets, type, nom)
  });
  if (rep.getResponseCode() >= 300) throw erreur_('SUPABASE', sbMessage_(rep.getResponseCode(), rep.getContentText()));
  return { url: base + '/storage/v1/object/public/annonces-images/' + nom };
}

// ─── Feuille de semaine ───

/**
 * Événements de l'agenda public, au format de l'API Google Agenda (celui que lisait l'AppMesse).
 * Lus avec CalendarApp (aucun service à activer) ; les identifiants sont reconstruits comme ceux de l'API,
 * pour retrouver les intentions rattachées à un événement (google_event_id) :
 *   événement simple → « abc123 » ; occurrence d'une série → « abc123_20261124T173000Z » (journée : « abc123_20261124 »).
 */
function evenementsAgendaApi_(debut, fin) {
  var fmt = function (d) { return Utilities.formatDate(d, 'Europe/Paris', "yyyy-MM-dd'T'HH:mm:ssXXX"); };
  var jour = function (d) { return Utilities.formatDate(d, 'Europe/Paris', 'yyyy-MM-dd'); };
  return calendrier_().getEvents(new Date(debut), new Date(fin)).map(function (ev) {
    var base = String(ev.getId()).replace(/@google\.com$/, '');
    var journee = ev.isAllDayEvent();
    var d = journee ? ev.getAllDayStartDate() : ev.getStartTime();
    var f = journee ? ev.getAllDayEndDate() : ev.getEndTime();
    var id = base;
    if (ev.isRecurringEvent()) id += '_' + (journee ? Utilities.formatDate(d, 'Europe/Paris', 'yyyyMMdd') : Utilities.formatDate(d, 'UTC', "yyyyMMdd'T'HHmmss'Z'"));
    return {
      id: id, summary: ev.getTitle() || '',
      start: journee ? { date: jour(d) } : { dateTime: fmt(d) },
      end: journee ? { date: jour(f) } : { dateTime: fmt(f) }
    };
  }).sort(function (a, b) { return (a.start.dateTime || a.start.date).localeCompare(b.start.dateTime || b.start.date); });
}
function lundiValide_(l) {
  l = String(l || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(l)) throw erreur_('INVALIDE', 'Semaine invalide.');
  return l;
}
function ajouterJours_(iso, n) {
  var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}
/** Données brutes d'une semaine : agenda, intentions validées, et la semaine préparée (partagée) s'il y en a une. */
function semaineNewsletter_(p) {
  var lundi = lundiValide_(p.lundi), dimanche = ajouterJours_(lundi, 6);
  var intentions = sb_('get', '/rest/v1/intentions?select=date_messe,heure_messe,nom_intention,type_intention,google_event_id'
    + '&statut=eq.valide&date_messe=gte.' + lundi + '&date_messe=lte.' + dimanche);
  return {
    lundi: lundi,
    evenements: evenementsAgendaApi_(p.debut || lundi + 'T00:00:00', p.fin || dimanche + 'T23:59:59'),
    intentions: intentions || [],
    preparee: json2_(props_().getProperty('NL_SEMAINES'), {})[lundi] || null
  };
}
function garderRecentes_(m) {
  var limite = ajouterJours_(aujourdhui_(), -7 * NL_SEMAINES_GARDEES);
  Object.keys(m).forEach(function (k) { if (k < limite) delete m[k]; });
  return m;
}
/** Enregistre la semaine préparée (jours retouchés) ; avec html : calendrier envoyé vers la newsletter. */
function ecrireSemaineNewsletter_(p, s) {
  var lundi = lundiValide_(p.lundi);
  return verrou_(function () {
    var m = json2_(props_().getProperty('NL_SEMAINES'), {});
    if (p.effacer) delete m[lundi];
    else {
      var x = m[lundi] || {};
      if (p.jours !== undefined) { x.jours = p.jours; x.par = s.nom; x.le = maintenant_(); }
      if (p.html !== undefined) { x.html = String(p.html || ''); x.envoye_par = s.nom; x.envoye_le = maintenant_(); }
      m[lundi] = x;
    }
    props_().setProperty('NL_SEMAINES', JSON.stringify(garderRecentes_(m)));
    if (p.html) journaliser_(s, 'Feuille de semaine envoyée vers la newsletter', lundi);
    return m[lundi] || null;
  });
}

// ─── Newsletter ───

function lireNewsletter_(p) {
  var lundi = lundiValide_(p.lundi);
  var annonces = sb_('get', '/rest/v1/annonces?select=*&actif=eq.true&dans_newsletter=eq.true&order=prioritaire.desc,ordre.asc.nullslast,created_at.desc');
  var semaines = json2_(props_().getProperty('NL_SEMAINES'), {});
  var x = semaines[lundi] || {};
  return {
    lundi: lundi,
    annonces: annonces || [],
    calendrier: x.html ? { html: x.html, par: x.envoye_par || '', le: x.envoye_le || '' } : null,
    semaines_envoyees: Object.keys(semaines).filter(function (k) { return semaines[k] && semaines[k].html; }).sort(),
    brouillon: json2_(props_().getProperty('NL_BROUILLONS'), {})[lundi] || null,
    campagne: etatCampagne_(),
    autres_programmees: campagnesProgrammees_(),
    brevo_ok: !!props_().getProperty('BREVO_CLE'),
    adresses_test: adressesTest_(),
    prochain_envoi: prochainEnvoi_().toISOString()
  };
}
function ecrireBrouillonNewsletter_(p, s) {
  var lundi = lundiValide_(p.lundi);
  return verrou_(function () {
    var m = json2_(props_().getProperty('NL_BROUILLONS'), {});
    if (p.html) m[lundi] = { html: String(p.html), par: s.nom, le: maintenant_() };
    else delete m[lundi];
    props_().setProperty('NL_BROUILLONS', JSON.stringify(garderRecentes_(m)));
    return m[lundi] || null;
  });
}

/** Mail de test : la newsletter telle qu'elle partira, envoyée par Gmail (alias secretariat@) aux adresses de test. */
function adressesTest_() {
  return String(nlReglages_().adresses_test || '').split(/[\s,;]+/).map(function (x) { return x.trim(); })
    .filter(function (x) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x); });
}
function testerEnvoiNewsletter_(p, s) {
  var html = String(p.html || '');
  if (!/<html/i.test(html)) throw erreur_('INVALIDE', 'Newsletter vide.');
  var a = adressesTest_();
  if (!a.length) throw erreur_('INVALIDE', 'Aucune adresse de test (Réglages → Newsletter).');
  html = html.replace(/\{\{\s*mirror\s*\}\}/g, '#').replace(/\{\{\s*unsubscribe\s*\}\}/g, '#');
  GmailApp.sendEmail(a.join(','), '[TEST] ' + (String(p.sujet || '').trim() || 'Annonces paroissiales'),
    'Ouvrez ce message dans une messagerie qui affiche le HTML.', { htmlBody: html, from: CONFIG.ALIAS, name: nlReglages_().expediteur_nom });
  journaliser_(s, 'Newsletter : test envoyé', a.join(', '));
  return { adresses: a };
}

// ─── Brevo ───

function brevo_(methode, chemin, corps) {
  var cle = props_().getProperty('BREVO_CLE');
  if (!cle) throw erreur_('BREVO', 'Clé Brevo non enregistrée (Réglages → Newsletter).');
  var o = { method: methode, muteHttpExceptions: true, headers: { 'api-key': cle, Accept: 'application/json' } };
  if (corps !== undefined) { o.contentType = 'application/json'; o.payload = JSON.stringify(corps); }
  var rep = UrlFetchApp.fetch('https://api.brevo.com/v3' + chemin, o);
  var code = rep.getResponseCode(), txt = rep.getContentText();
  if (code >= 300) {
    var j = json2_(txt, {});
    var m = j.message || txt || ('HTTP ' + code);
    if (code === 401 && /unrecognised IP|IP address/i.test(m)) m = 'Brevo refuse l\'adresse du serveur Google : dans Brevo → Sécurité → Adresses IP autorisées, désactivez le blocage.';
    throw erreur_('BREVO', 'Brevo (' + code + ') : ' + String(m).slice(0, 300));
  }
  return txt ? JSON.parse(txt) : null;
}
/** Prochain envoi : jour et heure réglés, heure de Paris (si c'est aujourd'hui, la semaine suivante, comme l'AppMesse). */
function prochainEnvoi_() {
  var r = nlReglages_();
  var maintenant = new Date();
  var auj = Utilities.formatDate(maintenant, 'Europe/Paris', 'yyyy-MM-dd');
  var jourSemaine = Number(Utilities.formatDate(maintenant, 'Europe/Paris', 'u')) % 7;   // 0 = dimanche
  var ecart = (r.jour - jourSemaine + 7) % 7 || 7;
  var j = ajouterJours_(auj, ecart);
  var decalage = Utilities.formatDate(new Date(j + 'T12:00:00Z'), 'Europe/Paris', 'XXX');
  return new Date(j + 'T' + r.heure + ':00' + decalage);
}
function etatCampagne_() {
  var c = json2_(props_().getProperty('NL_CAMPAGNE'), null);
  if (!c || !c.id) return null;
  if (!props_().getProperty('BREVO_CLE')) return c;
  try {
    var b = brevo_('get', '/emailCampaigns/' + c.id + '?statistics=globalStats');
    c.statut = b.status || '';
    if (b.sentDate) c.envoyee_le = b.sentDate;
  } catch (e) { c.statut = c.statut || 'inconnu'; c.erreur = e.message; }
  return c;
}
/** Campagnes Brevo en attente d'envoi (y compris celles programmées depuis l'AppMesse). */
function campagnesProgrammees_() {
  if (!props_().getProperty('BREVO_CLE')) return [];
  try {
    return (brevo_('get', '/emailCampaigns?status=queued&limit=20').campaigns || []).map(function (c) {
      return { id: c.id, nom: c.name, sujet: c.subject, envoi_le: c.scheduledAt || '' };
    });
  } catch (e) { return []; }
}
function programmerNewsletter_(p, s) {
  var lundi = lundiValide_(p.lundi);
  var html = String(p.html || '');
  if (!/<html/i.test(html)) throw erreur_('INVALIDE', 'Newsletter vide.');
  var dejaLa = etatCampagne_();
  if (dejaLa && dejaLa.statut === 'queued') throw erreur_('DEJA', 'Une newsletter est déjà programmée (envoi le ' + Utilities.formatDate(new Date(dejaLa.envoi_le), 'Europe/Paris', 'dd/MM à HH:mm') + '). Annulez-la d\'abord.');
  var r = nlReglages_(), envoi = prochainEnvoi_();
  if (p.envoi_le) {   // date et heure choisies pour cet envoi
    envoi = new Date(p.envoi_le);
    if (isNaN(envoi)) throw erreur_('INVALIDE', 'Date d\'envoi invalide.');
    if (envoi.getTime() < Date.now() + 5 * 60000) throw erreur_('INVALIDE', 'L\'envoi doit être programmé au moins 5 minutes à l\'avance.');
    if (envoi.getTime() > Date.now() + 90 * 86400000) throw erreur_('INVALIDE', 'Date d\'envoi trop lointaine.');
  }
  var sujet = String(p.sujet || '').trim() || 'Annonces paroissiales';
  var cree = brevo_('post', '/emailCampaigns', {
    name: 'Newsletter ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy'),
    subject: sujet,
    sender: { name: r.expediteur_nom, email: r.expediteur_email },
    type: 'classic',
    htmlContent: html,
    recipients: { listIds: [r.liste] },
    scheduledAt: envoi.toISOString()
  });
  var c = { id: cree.id, lundi: lundi, sujet: sujet, envoi_le: envoi.toISOString(), par: s.nom, le: maintenant_(), statut: 'queued' };
  props_().setProperty('NL_CAMPAGNE', JSON.stringify(c));
  journaliser_(s, 'Newsletter programmée', sujet + ' — envoi ' + Utilities.formatDate(envoi, 'Europe/Paris', 'dd/MM/yyyy HH:mm'));
  return c;
}
/** Annulation : suspendre puis supprimer (Brevo refuse de supprimer une campagne programmée). */
function annulerNewsletter_(p, s) {
  var c = json2_(props_().getProperty('NL_CAMPAGNE'), null);
  var id = p.id || (c && c.id);
  if (!id) throw erreur_('INTROUVABLE', 'Aucune newsletter programmée.');
  try { brevo_('put', '/emailCampaigns/' + id + '/status', { status: 'suspended' }); } catch (e) { console.warn('suspension', e.message); }
  try { brevo_('delete', '/emailCampaigns/' + id); }
  catch (e) {
    throw erreur_('BREVO', 'Suppression refusée par Brevo : annulez-la à la main sur https://app.brevo.com/campaign/email/' + id + '/report (' + e.message + ')');
  }
  if (c && String(c.id) === String(id)) props_().deleteProperty('NL_CAMPAGNE');
  journaliser_(s, 'Newsletter annulée', 'campagne ' + id);
  return true;
}
