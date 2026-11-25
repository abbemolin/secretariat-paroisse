/**
 * Interrupteurs des fonctions de l'app des paroissiens (Réglages → App des paroissiens ; curé et administrateurs).
 * Rien n'est supprimé : une fonction désactivée disparaît de l'app (paroissiens et espace des catéchumènes),
 * ses actions sont refusées par le serveur et ses envois automatiques s'arrêtent.
 * Les effacements RGPD continuent dans tous les cas (demandes refusées, comptes désactivés, intentions de prière,
 * fiches Cor Unum, fiches santé des retraites).
 * Au départ, tout est désactivé : l'app est comme avant (Bible, agenda, espace des catéchumènes par leur lien).
 */

var FONCTIONS_APP = [
  { cle: 'comptes', nom: 'Comptes des paroissiens', aide: 'Connexion par adresse e-mail, « Demander un accès », invitations, accord des parents des lycéens. Sans cela, seuls les catéchumènes et néophytes entrent, par leur lien.' },
  { cle: 'annonces', nom: 'Notifications d\'annonces et lettre de la paroisse', aide: 'Bouton « Notifier » des annonces ; lettre lisible dans l\'app et réglage « Recevoir aussi la lettre par mail ». Les annonces restent affichées dans tous les cas.' },
  { cle: 'messe', nom: 'Demander une messe', aide: 'Demande d\'intention de messe depuis l\'app, « Mes intentions ».' },
  { cle: 'inscriptions', nom: 'Mes inscriptions', aide: 'Retraites, catéchisme des enfants, livres, paiements en ligne.' },
  { cle: 'sacrements', nom: 'Sacrements', aide: 'Demandes (baptême, mariage, adultes), suivi des dossiers, acte de baptême.' },
  { cle: 'dons', nom: 'Dons (HelloAsso)', aide: 'Carte « Soutenir la paroisse » (accueil et partie publique), bouton « Faire un don » dans une annonce.' },
  { cle: 'priere', nom: 'Mur de prière', aide: 'Déposer une intention, « Je prie ».' },
  { cle: 'propositions', nom: 'Propositions spirituelles', aide: 'Parcours et textes ; notification de l\'étape du jour.' },
  { cle: 'foyers', nom: 'Foyers', aide: 'Relier les comptes de deux conjoints (avec les comptes des paroissiens).' },
  { cle: 'afaire', nom: '« À faire » sur l\'accueil', aide: 'Étape du jour, paiement à finir, pièce à fournir.' },
  { cle: 'fraternite', nom: '« Je veux rejoindre une fraternité »', aide: 'Pour un paroissien sans fiche Cor Unum (avec les comptes des paroissiens). Les catéchumènes gardent leur bouton comme avant.' }
];

function fonctionsApp_() {
  var x = json2_(props_().getProperty('APP_FONCTIONS'), {}), r = {};
  FONCTIONS_APP.forEach(function (f) { r[f.cle] = x[f.cle] === true; });
  return r;
}
function fonctionActive_(cle) { return fonctionsApp_()[cle] === true; }
function exigerFonction_(cle) {
  if (!fonctionActive_(cle)) throw erreur_('FERME', 'Cette fonction de l\'application n\'est pas ouverte pour le moment.');
}
/** Action de l'app → fonction qui doit être active (null : toujours permise). */
function fonctionDeAction_(action) {
  var a = String(action || '').replace(/^(cpt|esp)\./, '');
  if (/^priere\./.test(a)) return 'priere';
  if (/^prop\./.test(a)) return 'propositions';
  if (/^foyer\./.test(a)) return 'foyers';
  var m = {
    lettres: 'annonces', messes: 'messe', demanderMesse: 'messe', inscriptions: 'inscriptions',
    sacrement: 'sacrements', dossiers: 'sacrements', acteApp: 'sacrements', afaire: 'afaire'
  };
  if (m[a]) return m[a];
  if (action === 'cpt.lettre') return 'annonces';            // lettre de la paroisse (dans l'espace, esp.lettre est la lettre à l'évêque)
  if (action === 'cpt.corDemande') return 'fraternite';
  return null;
}

// ─── Réglages (secrétariat) ───

function lireFonctionsRoute_(p, s) {
  return { fonctions: FONCTIONS_APP, etat: fonctionsApp_(), modifiable: s.role === 'admin' || s.role === 'cure' };
}
function ecrireFonctionsRoute_(p, s) {
  if (s.role !== 'admin' && s.role !== 'cure') throw interdit_('Réservé au curé et aux administrateurs.');
  var avant = fonctionsApp_(), x = {};
  FONCTIONS_APP.forEach(function (f) { x[f.cle] = p.etat && typeof p.etat[f.cle] === 'boolean' ? p.etat[f.cle] : avant[f.cle]; });
  props_().setProperty('APP_FONCTIONS', JSON.stringify(x));
  var chg = FONCTIONS_APP.filter(function (f) { return x[f.cle] !== avant[f.cle]; }).map(function (f) { return f.nom + (x[f.cle] ? ' activé' : ' désactivé'); });
  if (chg.length) journaliser_(s, 'App des paroissiens : fonctions', chg.join(' ; '));
  return lireFonctionsRoute_(p, s);
}
