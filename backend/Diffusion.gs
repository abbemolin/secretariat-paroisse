/**
 * App des paroissiens — annonces et newsletter.
 *  - « Notifier » une annonce depuis la tuile Annonces : notification sur les téléphones des paroissiens
 *    (comptes et espaces des catéchumènes) qui n'ont pas coupé les annonces ; une seule fois par annonce
 *    sauf confirmation. Le téléphone affiche le titre de l'annonce (lu par le service worker, public.notif).
 *  - Newsletter lisible dans l'app : les dernières lettres envoyées par Brevo à la liste de la paroisse.
 *  - « Recevoir aussi par mail » : inscription / désinscription de la liste Brevo depuis les réglages de l'app.
 */

var NL_APP_NOMBRE = 12;   // lettres proposées dans l'app

// ─── Notifier une annonce ───

function notifsAnnonces_() { return json2_(props_().getProperty('NOTIFS_ANNONCES'), {}); }
/** Destinataires : comptes actifs (sauf annonces coupées) et espaces des catéchumènes (même réglage). */
function destinatairesAnnonces_() {
  var uids = [];
  try { lignesComptes_().forEach(function (x) { if (x.statut === 'actif' && prefsCompte_(x).annonces !== false) uids.push('cpt:' + x.id); }); } catch (e) { console.error('dest comptes', e); }
  try {
    feuillesEspace_();
    lignes_('Espaces').forEach(function (y) { if (y.hash && prefsNotifsEspace_(y.dossier_id).annonces !== false) uids.push('esp:' + y.dossier_id); });
  } catch (e) { console.error('dest espaces', e); }
  return uids;
}
function notifierAnnonce_(p, s) {
  var a = (sb_('get', '/rest/v1/annonces?select=id,titre,actif&id=eq.' + encodeURIComponent(p.id)) || [])[0];
  if (!a) throw erreur_('INTROUVABLE', 'Annonce introuvable.');
  if (!a.actif) throw erreur_('INVALIDE', 'Activez d\'abord l\'annonce : les paroissiens ne voient que les annonces actives.');
  var deja = notifsAnnonces_()[a.id];
  if (deja && !p.encore) throw erreur_('DEJA', 'Cette annonce a déjà été notifiée le ' + Utilities.formatDate(new Date(deja.le), 'Europe/Paris', 'dd/MM à HH:mm') + ' (' + deja.par + ').');
  var uids = destinatairesAnnonces_();
  var voulu = {}; uids.forEach(function (k) { voulu[k] = 1; });
  var appareils = lignes_('Push').filter(function (x) { return voulu[x.uid]; }).length;
  // texte lu par les téléphones au moment de la notification
  props_().setProperty('NOTIF_PUBLIQUE', JSON.stringify({ type: 'annonce', titre: String(a.titre || '').slice(0, 120), le: maintenant_() }));
  envoyerPushMasse_(uids);
  var m = notifsAnnonces_(); m[a.id] = { le: maintenant_(), par: s.nom, appareils: appareils };
  Object.keys(m).sort(function (x, y) { return String(m[y].le).localeCompare(String(m[x].le)); }).slice(200).forEach(function (k) { delete m[k]; });
  props_().setProperty('NOTIFS_ANNONCES', JSON.stringify(m));
  CacheService.getScriptCache().remove('annonces_publiques');
  journaliser_(s, 'Annonce notifiée aux paroissiens', a.titre + ' (' + appareils + ' appareil(s))');
  return { appareils: appareils, personnes: uids.length, le: m[a.id].le };
}
/** Pour le service worker : ce que la dernière notification annonce (public, sans donnée personnelle). */
function derniereNotifPublique_() {
  var n = json2_(props_().getProperty('NOTIF_PUBLIQUE'), null);
  if (!n || n.le < new Date(Date.now() - 15 * 60000).toISOString()) return null;
  return n;
}

// ─── Newsletter dans l'app ───

function lettresApp_() {
  var cache = CacheService.getScriptCache(), c = cache.get('nl_app_liste');
  if (c) return JSON.parse(c);
  if (!props_().getProperty('BREVO_CLE')) return [];
  var liste = nlReglages_().liste, l = [];
  try {
    l = (brevo_('get', '/emailCampaigns?status=sent&limit=40&sort=desc').campaigns || [])
      .filter(function (x) { return ((x.recipients || {}).lists || (x.recipients || {}).listIds || []).map(Number).indexOf(Number(liste)) > -1; })
      .slice(0, NL_APP_NOMBRE)
      .map(function (x) { return { id: x.id, sujet: x.subject || x.name, envoyee_le: x.sentDate || x.scheduledAt || '' }; });
  } catch (e) { console.error('lettresApp_', e); return []; }
  cache.put('nl_app_liste', JSON.stringify(l), 1800);
  return l;
}
function lettreApp_(id) {
  id = Number(id);
  if (!lettresApp_().some(function (x) { return Number(x.id) === id; })) throw erreur_('INTROUVABLE', 'Lettre introuvable.');
  var cache = CacheService.getScriptCache(), c = cache.get('nl_app_' + id);
  if (c) return { id: id, html: c };
  var html = String((brevo_('get', '/emailCampaigns/' + id) || {}).htmlContent || '');
  // liens personnels de désinscription retirés (la lettre est lue dans l'app)
  html = html.replace(/\{\{\s*unsubscribe\s*\}\}/gi, '#').replace(/\{\{[^}]*\}\}/g, '');
  if (html.length < 95000) cache.put('nl_app_' + id, html, 21600);
  return { id: id, html: html };
}

// ─── « Recevoir aussi par mail » (liste Brevo) ───

function abonnementNewsletter_(mail) {
  mail = normMail_(mail);
  if (!mail || !props_().getProperty('BREVO_CLE')) return null;
  var cache = CacheService.getScriptCache(), cle = 'nl_abo_' + mail, c = cache.get(cle);
  if (c) return c === '1';
  var abonne = false;
  try {
    var x = brevo_('get', '/contacts/' + encodeURIComponent(mail));
    abonne = (x.listIds || []).map(Number).indexOf(Number(nlReglages_().liste)) > -1 && !x.emailBlacklisted;
  } catch (e) { if (!/\(404\)/.test(e.message)) { console.error('abonnement', e); return null; } }
  cache.put(cle, abonne ? '1' : '0', 3600);
  return abonne;
}
function changerAbonnementNewsletter_(mail, prenom, nom, oui) {
  mail = normMail_(mail);
  if (!mail) throw erreur_('INVALIDE', 'Aucune adresse e-mail pour ce compte.');
  var liste = Number(nlReglages_().liste);
  if (oui) brevo_('post', '/contacts', { email: mail, listIds: [liste], updateEnabled: true, emailBlacklisted: false, attributes: { PRENOM: prenom || '', NOM: nom || '' } });
  else { try { brevo_('post', '/contacts/lists/' + liste + '/contacts/remove', { emails: [mail] }); } catch (e) { if (!/\(400\)|\(404\)/.test(e.message)) throw e; } }
  CacheService.getScriptCache().put('nl_abo_' + mail, oui ? '1' : '0', 3600);
  return oui;
}
