/**
 * Onglet « Formulaires » : envoyer un formulaire en ligne par mail, et suivre les envois.
 * Chaque envoi a un lien personnel (?e=…) : on sait quand le formulaire est rempli et quel dossier il a créé.
 * Le dossier se crée à la réponse (comme pour les formulaires du site). Un envoi à une école sert à plusieurs familles.
 * Les envois du bouton « Formulaire « accord du curé » » d'un dossier apparaissent aussi dans le suivi.
 * Accès : chacun voit et envoie les formulaires des sortes de dossiers auxquelles il a accès.
 * RGPD : la liste garde l'adresse et le nom du destinataire ; un envoi est retiré à la demande, ou effacé après un an.
 *
 * « Remplir sur place » : le formulaire est rempli au secrétariat, avec la personne, sans mail.
 *  - lien à usage unique (?p=…), valable 24 h : sur l'écran du secrétariat (« Remplir ici ») ou par QR code sur son téléphone ;
 *  - l'adresse e-mail devient facultative ; la personne coche elle-même la case de consentement ;
 *  - accusé de réception par mail au choix (case cochée par défaut) ; le dossier créé s'ouvre au secrétariat ;
 *  - pas d'entrée dans le suivi des envois : le dossier garde la trace (« rempli au secrétariat avec … »).
 *  RGPD : le jeton (propriété « surplace_… ») ne contient ni nom ni adresse ; effacé 48 h après sa création.
 */

var FORMULAIRES_ENVOI = {
  bapteme:            { nom: 'Demande de baptême (enfant)', sorte: 'bapteme', slug: 'demande-bapteme' },
  mariage:            { nom: 'Demande de mariage', sorte: 'mariage', slug: 'demande-mariage' },
  premiere_communion: { nom: 'Inscription à la première communion', sorte: 'premiere_communion', slug: 'premiere-communion', ecole: true },
  profession_foi:     { nom: 'Inscription à la profession de foi', sorte: 'profession_foi', slug: 'profession-de-foi', ecole: true },
  catechumene:        { nom: 'Baptême d\'un adulte', sorte: 'catechumene', slug: 'bapteme-adulte' },
  confirmand:         { nom: 'Confirmation d\'un adulte', sorte: 'confirmand', slug: 'confirmation-adulte' },
  accord_ailleurs:    { nom: 'Accord du curé – baptême dans une autre paroisse', sorte: 'bapteme', slug: 'accord-bapteme' },
  accord_ici:         { nom: 'Accord du curé – famille d\'une autre paroisse', sorte: 'bapteme', slug: 'accord-bapteme' },
  parrainage:         { nom: 'Certificat de parrain / marraine', sorte: 'parrainage', slug: 'certificat-parrain' },
  recommandation:     { nom: 'Lettre de recommandation', sorte: 'recommandation', slug: 'lettre-recommandation' }
};
var COLONNES_ENVOIS = ['id', 'jeton', 'formulaire', 'email', 'nom', 'ecole', 'lien', 'sujet', 'texte', 'boutons', 'envoye_le', 'envoye_par',
  'relance_le', 'relances', 'rempli_le', 'reponses', 'dossier_ids'];

function feuilleEnvois_() {
  var f = feuilleEsp_('Envois', COLONNES_ENVOIS);
  completerColonnes_(f, COLONNES_ENVOIS);
  return f;
}
function lignesEnvois_() { feuilleEnvois_(); return lignes_('Envois'); }
function baseFormulaires_() { return String(reglages_().url_formulaires || 'https://secretariat.croix-glorieuse.org/').replace(/\/?$/, '/'); }
function envoiParJeton_(j) {
  if (!/^[a-f0-9]{32}$/.test(String(j || ''))) return null;
  return lignesEnvois_().filter(function (x) { return x.jeton === j; })[0] || null;
}
function peutEnvoyer_(s, cle) { var f = FORMULAIRES_ENVOI[cle]; return !!f && (s.role === 'admin' || peutModifier_(s, 'dossiers', f.sorte)); }
function envoiPublic_(x) {
  var f = FORMULAIRES_ENVOI[x.formulaire] || {};
  return { id: x.id, formulaire: x.formulaire, formulaire_nom: f.nom || x.formulaire, email: x.email, nom: x.nom, ecole: x.ecole,
    envoye_le: x.envoye_le, envoye_par: x.envoye_par, relance_le: x.relance_le, relances: Number(x.relances || 0),
    rempli_le: x.rempli_le, reponses: Number(x.reponses || 0), dossier_ids: json2_(x.dossier_ids, []) };
}

/** Un formulaire envoyé a été rempli (appelé à la création ou au complément d'un dossier). */
function marquerEnvoi_(jeton, dossierId) {
  if (!jeton) return;
  try {
    verrou_(function () {
      var x = lignesEnvois_().filter(function (y) { return y.jeton === jeton; })[0];
      if (!x) return;
      var ids = json2_(x.dossier_ids, []);
      if (dossierId && ids.indexOf(dossierId) === -1) ids.push(dossierId);
      x.dossier_ids = JSON.stringify(ids); x.rempli_le = maintenant_(); x.reponses = Number(x.reponses || 0) + 1;
      ecrireLigne_('Envois', x);
    });
  } catch (e) { console.error('marquerEnvoi_', e); }
}
/** Envoi fait depuis un dossier (bouton « Formulaire accord du curé ») : noté dans le suivi. */
function noterEnvoiDossier_(cle, d, mail, lien, sujet, texte, s) {
  try {
    verrou_(function () {
      var i = json2_(d.donnees, {}).infos || {};
      var x = lignesEnvois_().filter(function (y) { return y.jeton === i.accord_jeton; })[0];
      if (!x) x = { id: uid_(), jeton: i.accord_jeton, formulaire: cle, relances: 0, reponses: 0, dossier_ids: JSON.stringify([d.id]) };
      else { x.relance_le = x.envoye_le ? maintenant_() : ''; x.relances = Number(x.relances || 0) + (x.envoye_le ? 1 : 0); }
      x.email = mail; x.nom = d.nom; x.lien = lien; x.sujet = sujet; x.texte = texte; x.boutons = '';
      if (!x.envoye_le) { x.envoye_le = maintenant_(); x.envoye_par = s.nom; }
      ecrireLigne_('Envois', x);
    });
  } catch (e) { console.error('noterEnvoiDossier_', e); }
}

// ─── Routes du secrétariat ───

function listerFormulairesRoute_(p, s) {
  var catalogue = Object.keys(FORMULAIRES_ENVOI).filter(function (k) { return peutEnvoyer_(s, k); })
    .map(function (k) { var f = FORMULAIRES_ENVOI[k]; return { cle: k, nom: f.nom, sorte: f.sorte, ecole: !!f.ecole }; });
  var lisibles = function (x) { var f = FORMULAIRES_ENVOI[x.formulaire]; return f && (s.role === 'admin' || peutLire_(s, 'dossiers', f.sorte)); };
  var envois = lignesEnvois_().filter(lisibles).sort(function (a, b) { return String(b.envoye_le).localeCompare(String(a.envoye_le)); }).slice(0, 300).map(envoiPublic_);
  return { catalogue: catalogue, envois: envois };
}
function envoyerFormulaireRoute_(p, s) {
  var cle = String(p.formulaire || ''), f = FORMULAIRES_ENVOI[cle];
  if (!f) throw erreur_('INVALIDE', 'Formulaire inconnu.');
  if (!peutEnvoyer_(s, cle)) throw interdit_('Vous n\'avez pas accès à ces dossiers.');
  var mail = normMail_(p.email);
  if (!mail) throw erreur_('INVALIDE', 'Adresse e-mail invalide.');
  var jeton = jeton_(), lien = baseFormulaires_() + f.slug + '/?e=' + jeton;
  var ecole = f.ecole ? String(p.ecole || '').trim().slice(0, 120) : '';
  if (ecole) lien += PREPARATIONS.indexOf(ecole) > -1 ? '&preparation=' + encodeURIComponent(ecole) : '&preparation=' + encodeURIComponent('Autre école') + '&ecole=' + encodeURIComponent(ecole);
  var B = 'Remplir le formulaire';
  var boutons = [{ texte: B, url: lien }].concat((p.boutons || []).filter(function (b) { return b && /^https:\/\//.test(b.url || '') && b.texte !== B; }).slice(0, 3)
    .map(function (b) { return { texte: String(b.texte).slice(0, 80), url: b.url, image: /^https:\/\//.test(b.image || '') ? b.image : '', imageSeule: !!b.imageSeule }; }));
  var sujet = String(p.sujet || f.nom).slice(0, 200), texte = String(p.texte || '').trim() || 'Bonjour,\n\nMerci de remplir ce formulaire en ligne :\n[Bouton : ' + B + ']\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
  if (texte.indexOf('[Bouton : ' + B + ']') === -1) texte += '\n\n[Bouton : ' + B + ']';
  var x = { id: uid_(), jeton: jeton, formulaire: cle, email: mail, nom: String(p.nom || '').trim().slice(0, 120), ecole: ecole, lien: lien,
    sujet: sujet, texte: texte, boutons: JSON.stringify(boutons), envoye_le: maintenant_(), envoye_par: s.nom, relance_le: '', relances: 0, rempli_le: '', reponses: 0, dossier_ids: '[]' };
  envoyerMailFormulaire_(x, false);
  verrou_(function () { feuilleEnvois_(); ecrireLigne_('Envois', x); });
  journaliser_(s, 'Formulaire envoyé', f.nom + ' – ' + mail);
  return listerFormulairesRoute_(p, s);
}
function envoyerMailFormulaire_(x, relance) {
  var opts = optionsEnvoi_(), boutons = json2_(x.boutons, null) || [{ texte: 'Remplir le formulaire', url: x.lien }];
  var texte = x.texte, sujet = x.sujet;
  if (relance) {
    texte = 'Bonjour,\n\nNous nous permettons de vous rappeler ce formulaire, qui n\'a pas encore été rempli.\n\n— Message du ' + dateFr_(x.envoye_le) + ' —\n\n' + String(texte).replace(/^Bonjour,?\s*/, '');
    sujet = 'Rappel – ' + sujet;
  }
  if (!/\[Bouton : /.test(texte) && boutons.length) texte += '\n\n[Bouton : ' + boutons[0].texte + ']';
  GmailApp.sendEmail(x.email, sujet, corpsTexte_(texte, 'paroisse', boutons), { name: opts.name, from: opts.from, htmlBody: corpsHtml_(texte, 'paroisse', boutons) });
}
function relancerFormulaireRoute_(p, s) {
  var x = lignesEnvois_().filter(function (y) { return y.id === p.id; })[0];
  if (!x) throw erreur_('INTROUVABLE', 'Envoi introuvable.');
  if (!peutEnvoyer_(s, x.formulaire)) throw interdit_('Vous n\'avez pas accès à ces dossiers.');
  envoyerMailFormulaire_(x, true);
  verrou_(function () { var y = lignesEnvois_().filter(function (z) { return z.id === p.id; })[0]; y.relance_le = maintenant_(); y.relances = Number(y.relances || 0) + 1; ecrireLigne_('Envois', y); });
  journaliser_(s, 'Formulaire relancé', (FORMULAIRES_ENVOI[x.formulaire] || {}).nom + ' – ' + x.email);
  return listerFormulairesRoute_(p, s);
}
function retirerEnvoiRoute_(p, s) {
  verrou_(function () {
    var x = lignesEnvois_().filter(function (y) { return y.id === p.id; })[0];
    if (!x) return;
    if (!peutEnvoyer_(s, x.formulaire)) throw interdit_('Vous n\'avez pas accès à ces dossiers.');
    feuille_('Envois').deleteRow(x._ligne); oublierLignes_('Envois');
  });
  return listerFormulairesRoute_(p, s);
}
// ─── Remplir sur place ───

var DUREE_SUR_PLACE = 24 * 3600000;
function lienSurPlace_(cle, jeton) {
  var f = FORMULAIRES_ENVOI[cle];
  return baseFormulaires_() + (/^accord_/.test(cle) ? 'accord-bapteme' : f.slug) + '/?p=' + jeton;
}
function surPlaceRoute_(p, s) {
  var cle = String(p.formulaire || ''), f = FORMULAIRES_ENVOI[cle];
  if (!f) throw erreur_('INVALIDE', 'Formulaire inconnu.');
  if (!peutEnvoyer_(s, cle)) throw interdit_('Vous n\'avez pas accès à ces dossiers.');
  var jeton = jeton_(), le = new Date();
  props_().setProperty('surplace_' + jeton, JSON.stringify({ f: cle, par: s.nom, uid: s.uid, le: le.toISOString(), dossier: '' }));
  journaliser_(s, 'Formulaire à remplir sur place', f.nom);
  return { jeton: jeton, formulaire: cle, slug: /^accord_/.test(cle) ? 'accord-bapteme' : f.slug, lien: lienSurPlace_(cle, jeton),
    expire_le: new Date(le.getTime() + DUREE_SUR_PLACE).toISOString() };
}
function lireSurPlace_(jeton) {
  if (!/^[a-f0-9]{32}$/.test(String(jeton || ''))) return null;
  return json2_(props_().getProperty('surplace_' + jeton), null);
}
/** Jeton valable (24 h, une seule réponse) pour l'un des formulaires donnés ; sinon erreur LIEN. */
function exigerSurPlace_(jeton, cles) {
  var x = lireSurPlace_(jeton);
  if (!x || cles.indexOf(x.f) === -1) throw erreur_('LIEN', 'Ce lien n\'est pas valable. Demandez un nouveau code au secrétariat.');
  if (x.dossier) throw erreur_('LIEN', 'Ce formulaire a déjà été rempli. Demandez un nouveau code au secrétariat.');
  if (Date.now() - new Date(x.le).getTime() > DUREE_SUR_PLACE) throw erreur_('LIEN', 'Ce lien a expiré (24 h). Demandez un nouveau code au secrétariat.');
  return x;
}
/** Le formulaire sur place a été rempli : jeton marqué (plus réutilisable), dossier retenu pour l'ouvrir au secrétariat. */
function finirSurPlace_(jeton, dossierId) {
  var x = lireSurPlace_(jeton);
  if (!x) return;
  x.dossier = dossierId; x.rempli_le = maintenant_();
  props_().setProperty('surplace_' + jeton, JSON.stringify(x));
}
/** Page publique : le lien sur place est-il valable ? (sans donnée personnelle) */
function infosSurPlacePublic_(p) {
  compteurChef_('surplace_' + String(p.p || '').slice(0, 32), 60, 3600, 'Trop de demandes en peu de temps. Réessayez dans une heure.');
  var x = exigerSurPlace_(p.p, Object.keys(FORMULAIRES_ENVOI));
  return { formulaire: x.f, nom: FORMULAIRES_ENVOI[x.f].nom, expire_le: new Date(new Date(x.le).getTime() + DUREE_SUR_PLACE).toISOString() };
}
/** Secrétariat : le formulaire a-t-il été rempli (pour ouvrir le dossier créé) ? */
function etatSurPlaceRoute_(p, s) {
  var x = lireSurPlace_(p.jeton);
  if (!x) return { existe: false };
  if (!peutEnvoyer_(s, x.f)) throw interdit_('Vous n\'avez pas accès à ces dossiers.');
  return { existe: true, dossier_id: x.dossier || '', expire: Date.now() - new Date(x.le).getTime() > DUREE_SUR_PLACE };
}
/** Accusé de réception (formulaire sur place, si la personne a donné son adresse et que la case est cochée). */
function accuseSurPlace_(cle, mail) {
  if (!normMail_(mail)) return;
  try {
    var opts = optionsEnvoi_(), nom = (FORMULAIRES_ENVOI[cle] || {}).nom || 'votre demande';
    var texte = 'Bonjour,\n\nNous avons bien reçu votre demande : « ' + nom + ' ». Le secrétariat de la paroisse reviendra vers vous pour la suite.' +
      '\n\nAvec l\'assurance de nos prières à toutes vos intentions,';
    GmailApp.sendEmail(normMail_(mail), 'Accusé de réception – ' + nom, corpsTexte_(texte, 'paroisse'), { name: opts.name, from: opts.from, htmlBody: corpsHtml_(texte, 'paroisse') });
  } catch (e) { console.error('accuseSurPlace_', e); }
}
/** Clé du formulaire d'envoi correspondant à une sorte de dossier du site (hors accords). */
function cleFormulaireDeType_(type) {
  return Object.keys(FORMULAIRES_ENVOI).filter(function (k) { return !/^accord_/.test(k) && FORMULAIRES_ENVOI[k].sorte === type; })[0] || '';
}

/** Entretien de nuit (RGPD) : envois de plus d'un an effacés ; liens « sur place » de plus de 48 h effacés. */
function entretienEnvois_() {
  var tout = props_().getProperties(), lim = Date.now() - 2 * DUREE_SUR_PLACE;
  Object.keys(tout).forEach(function (k) {
    if (k.indexOf('surplace_') === 0 && !(new Date(json2_(tout[k], {}).le).getTime() > lim)) props_().deleteProperty(k);
  });
  if (!db_().getSheetByName('Envois')) return;
  var limite = new Date(Date.now() - 365 * 86400000).toISOString(), n = 0;
  verrou_(function () {
    lignes_('Envois').slice().reverse().forEach(function (x) { if (String(x.envoye_le) < limite) { feuille_('Envois').deleteRow(x._ligne); n++; } });
    oublierLignes_('Envois');
  });
  if (n) journaliser_(null, 'Formulaires : envois de plus d\'un an effacés', String(n));
}
