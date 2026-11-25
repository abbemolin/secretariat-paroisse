/**
 * Vérification de l'installation : chaque fichier du serveur est-il présent et complet ?
 * Dans Apps Script : choisir la fonction « verifierFichiers » en haut, puis « Exécuter ».
 * Le journal (en bas) liste les fichiers manquants ou coupés au collage.
 * Pour chaque fichier : [première fonction, dernière fonction, nombre de lignes attendu].
 */
var FICHIERS_ATTENDUS = {
    'AFaire.gs': ['aFaireApp_', 'aFaireEspace_', 56],
    'Acces.gs': ['accesComplet_', 'verifierFilAttribue_', 195],
    'AccordBapteme.gs': ['sensAccord_', 'inf0Jeton_', 178],
    'Agenda.gs': ['calendrier_', 'chercherRendezVous_', 126],
    'Catechisme.gs': ['feuilleCate_', 'mailPaiementCate_', 474],
    'Catechumenes.gs': ['prenomNom_', 'exportCatechumenes_', 130],
    'Code.gs': ['doGet', 'marquerNotificationsLues_', 844],
    'Comptes.gs': ['feuilleComptes_', 'entretienComptes_', 790],
    'Confirmands.gs': ['confessionDe_', 'changerTypeConf_', 244],
    'Contacts.gs': ['sansAccentsC_', 'contactsRoute_', 984],
    'CorUnum.gs': ['feuilleCor_', 'menageCorRoute_', 1263],
    'Courrier.gs': ['aliasDisponible_', 'commenterMail_', 253],
    'Diffusion.gs': ['notifsAnnonces_', 'changerAbonnementNewsletter_', 103],
    'Documents.gs': ['racine_', 'deplacerDocument_', 142],
    'Dossiers.gs': ['anneeScolaire_', 'photoDossier_', 589],
    'Entretien.gs': ['assurerEntretien_', 'sauvegardesRoute_', 98],
    'Espace.gs': ['feuilleEsp_', 'pushEspace_', 953],
    'Extraits.gs': ['feuilleExtraits_', 'supprimerExtrait_', 178],
    'Fonctions.gs': ['fonctionsApp_', 'ecrireFonctionsRoute_', 62],
    'Formulaires.gs': ['feuilleEnvois_', 'entretienEnvois_', 140],
    'Foyers.gs': ['conjointDe_', 'actesFoyer_', 154],
    'HelloAsso.gs': ['haReglages_', 'separerPrenomNom_', 287],
    'HorsLigne.gs': ['horsLigneFiches_', 'horsLigneFiches_', 42],
    'Installation.gs': ['installer', 'reinitialiserAdmin', 179],
    'Intentions.gs': ['intId_', 'offrandeTexte_', 306],
    'Liturgie.gs': ['commentairesBible_', 'ordoMesses_', 261],
    'Livres.gs': ['feuilleCommandes_', 'mailCommande_', 194],
    'Lots.gs': ['idsLot_', 'paroissiensLotRoute_', 203],
    'MiseAJour.gs': ['mettreAJourServeur', 'majServeurRoute_', 104],
    'Modeles.gs': ['modeles_', 'courrierRoute_', 77],
    'Newsletter.gs': ['nlReglages_', 'annulerNewsletter_', 413],
    'Priere.gs': ['feuillePrieres_', 'entretienPrieres_', 158],
    'Profil.gs': ['contient_', 'mesInscriptions_', 173],
    'Propositions.gs': ['feuillesProps_', 'envoyerEtapesDuJour', 182],
    'Push.gs': ['b64url_', 'envoyerPushMasse_', 177],
    'Recherche.gs': ['rechercheGlobale_', 'ecrirePrefsAccueil_', 107],
    'Registres.gs': ['registreDuType_', 'registresRoute_', 108],
    'Retraites.gs': ['feuilleRet_', 'mailConfirmationRetraite_', 400],
    'Rgpd.gs': ['rgpdListe_', 'rgpdRoute_', 160],
    'Sacrements.gs': ['demanderSacrementApp_', 'ecrireCausesDons_', 137],
    'Statistiques.gs': ['statSacrements_', 'statistiquesRoute_', 77],
    'Stockage.gs': ['proprietesReelles_', 'ecrireStock_', 73],
    'Tri.gs': ['triReglages_', 'triDuFil_', 265]
};
function verifierFichiers() {
  var g = (function () { return this; })(), manquants = [], coupes = [];
  Object.keys(FICHIERS_ATTENDUS).forEach(function (f) {
    var x = FICHIERS_ATTENDUS[f], debut = typeof g[x[0]] === 'function', fin = typeof g[x[1]] === 'function';
    if (!debut && !fin) manquants.push(f + ' (' + x[2] + ' lignes)');
    else if (!fin) coupes.push(f + ' : la fin manque (le fichier complet fait ' + x[2] + ' lignes)');
  });
  var r = (manquants.length ? 'FICHIERS MANQUANTS (à créer : Fichier → + → Script, avec ce nom) :\n  ' + manquants.join('\n  ') + '\n' : '') +
          (coupes.length ? 'FICHIERS INCOMPLETS (tout sélectionner, supprimer, recoller le fichier entier) :\n  ' + coupes.join('\n  ') + '\n' : '') +
          (!manquants.length && !coupes.length ? 'Tout est en place : ' + Object.keys(FICHIERS_ATTENDUS).length + ' fichiers complets.' : '');
  Logger.log(r);
  return r;
}
