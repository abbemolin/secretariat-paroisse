import { useState } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { EnTete } from '../ui.jsx'
import { useApp } from '../App.jsx'

// « Comment faire » : guides courts, par rubrique, pour toute l'appli.
// Chacun voit les rubriques de ses accès (droit), avec « Tout afficher » pour le reste. Recherche dans les titres et les textes.
// droit : clé de peut() ; tableau = l'un des droits suffit ; absent = pour tout le monde.
const RUBRIQUES = [
  { titre: 'Pour commencer', guides: [
    ['Se repérer dans l\'appli', 'Sur ordinateur, le menu est à gauche, rangé en groupes (Sacrements, Catéchèse, Paroissiens, Gestion) : un clic sur le nom d\'un groupe le replie ou le déplie, et l\'appli s\'en souvient. Sur téléphone, les rubriques principales sont dans la barre du bas, toutes les autres sous « Plus ».'],
    ['L\'accueil', 'En haut : la date et la fête du jour. Pour les prêtres, « Ma journée » (messes et intentions, office de l\'heure) et « À traiter ». Puis les autres espaces de l\'appli (Intentions de messe, Annonces et newsletter, Liturgie, selon vos accès), puis le tableau de bord du secrétariat : chiffres, « À faire », nouvelles demandes, mes dossiers, notifications, les 7 prochains jours.'],
    ['Personnaliser mon accueil', 'Accueil → bouton de réglage en haut à droite : changez l\'ordre des blocs avec les flèches, masquez ceux qui ne vous servent pas, « Enregistrer ». C\'est retenu pour vous, sur tous vos appareils ; « Rétablir » revient à l\'ordre d\'origine.'],
    ['La liste « À faire » de l\'accueil', 'Elle rassemble ce qui attend une action : mails à traiter, nouvelles demandes, préparations à valider, baptêmes à trouver, inscrits Cor Unum à répartir, messages des chefs, impayés du catéchisme… Un clic ouvre la bonne page, déjà filtrée.'],
    ['Rechercher partout', 'La loupe (ou Ctrl K sur ordinateur) cherche dans les dossiers, le catéchisme, les extraits, Cor Unum, les retraites, les intentions et les annonces, ainsi que dans les fêtes et la Bible. Tapez un nom ou un mot, puis choisissez le résultat.'],
    ['Installer l\'appli sur mon téléphone', 'Ouvrez l\'adresse de l\'appli dans le navigateur du téléphone. iPhone : Safari → bouton Partager → « Sur l\'écran d\'accueil ». Android : Chrome → menu ⋮ → « Installer l\'application ». Mon compte → « Installer l\'appli » le rappelle.'],
    ['Recevoir les notifications', 'Mon compte → Notifications sur cet appareil → « Activer les notifications », puis « Tester ». Choisissez ensuite ce que vous voulez recevoir et, si vous le souhaitez, des heures calmes (rien ne sonne la nuit). La cloche en haut montre les dernières ; « Tout marquer lu » les vide.'],
    ['Agrandir le texte ou passer en mode sombre', 'Mon compte → Affichage. Le réglage vaut pour cet appareil seulement. La Liturgie a en plus son propre bouton ☾ / ☀.'],
    ['Changer mon mot de passe', 'Mon compte → « Changer mon mot de passe » : mot de passe actuel, puis le nouveau (8 caractères au moins), « Confirmer ».'],
    ['Enregistrer', 'Dans un dossier ou une fiche, les modifications sont enregistrées toutes seules (« Enregistré ✓ » s\'affiche). Les réglages et les fenêtres ont un bouton « Enregistrer ».'],
    ['Annuler une action', 'Après une suppression, un archivage, un placement ou une action groupée, un bouton « Annuler » apparaît en bas de l\'écran pendant quelques secondes. Un mail envoyé peut lui aussi être retenu pendant 10 secondes.'],
    ['Agir sur plusieurs éléments à la fois', 'Dans les listes (dossiers, courrier, catéchisme, contacts…) : « Sélectionner », cochez les lignes (ou un raccourci comme « Avec des documents manquants »), puis choisissez l\'action dans la barre du bas. Un récapitulatif s\'affiche avant d\'appliquer.'],
    ['Les boutons « Plus »', 'Quand une page a beaucoup d\'actions, les moins courantes sont rangées sous « ⋯ Plus » (par exemple Contacts : Groupes, Doublons, Importer, Mettre à jour).'],
    ['Couleur des boutons', 'Les boutons or créent quelque chose (« + Nouveau… », « Inscrire », « + Événement »). Les boutons bordeaux valident : enregistrer, envoyer, signer.'],
    ['Sans connexion', 'L\'appli continue de marcher avec ce qu\'elle a gardé sur l\'appareil : dossiers, catéchisme, extraits, agenda, annonces, bréviaire, Bible… Un nuage barré apparaît en haut. Les événements de l\'agenda et les annonces peuvent être créés ou modifiés : ils partent tout seuls au retour du réseau (appuyez sur le nuage pour « Envoyer maintenant »). Le courrier demande une connexion.'],
    ['Nouvelle version de l\'appli', 'Quand une mise à jour est publiée, un bandeau « Une nouvelle version de l\'appli est prête » propose « Mettre à jour ». Sinon, la page se recharge d\'elle-même dès que vous n\'êtes plus en train d\'écrire.'],
    ['Charte de confidentialité', 'Chaque année, chacun accepte la charte avant d\'ouvrir les pages qui contiennent des données personnelles. Les données ne servent qu\'au service de la paroisse et ne sortent pas de l\'appli.']
  ] },
  { titre: 'Ma journée (prêtres)', droit: ['liturgie', 'intentions'], guides: [
    ['Ce que montre « Ma journée »', 'Sur l\'accueil : la fête du jour et son rang, les messes du jour avec leur intention, l\'office de l\'heure (un clic l\'ouvre dans le bréviaire) et « À traiter » (mails attribués, extraits à signer, mes dossiers, demandes d\'intention, notifications).'],
    ['Déclarer une messe célébrée', '« ✝ J\'ai célébré cette messe » sous l\'intention : votre nom est inscrit comme célébrant. « Un autre prêtre… » pour indiquer qui l\'a célébrée. Cela marche aussi sans réseau.']
  ] },
  { titre: 'Courrier', droit: 'mail', guides: [
    ['Lire et trier les mails', 'Courrier montre la boîte de secretariat@. Filtres en haut : Boîte de réception, Non lus, Mes mails, À suivre, Suivis, Envoyés. Chaque fil a un statut (À traiter, En cours, Traité) et peut être marqué Prioritaire.'],
    ['Répondre vite', 'Sous le mail, la réponse rapide propose la réponse type qui convient (d\'après le tri automatique) ; choisissez la signature, puis Envoyer (ou Ctrl+Entrée). « Plus d\'options » ouvre la fenêtre complète (pièces jointes, copie…). Une réponse passe le mail en « Traité ».'],
    ['Répondre avec une réponse type', 'Ouvrez le mail → Répondre → choisissez la réponse type. Le nom, le lien des horaires et les documents manquants se remplissent seuls. Les réponses types se règlent dans Réglages → Réponses types.'],
    ['Retenir un envoi', 'Après « Envoyer », vous avez 10 secondes pour « Annuler » : le texte revient, rien n\'est parti.'],
    ['Attribuer un mail', 'Dans le mail : « Attribué à ». La personne reçoit une notification ; le mail apparaît dans « Mes mails ». Certaines personnes ne voient que les mails qui leur sont attribués (réglé dans Utilisateurs).'],
    ['Tri automatique', 'Les nouveaux mails reçoivent une étiquette (Horaires, Baptême, Extrait…) et l\'appli propose l\'action qui va avec. Les demandes d\'horaires reçoivent la réponse type automatiquement, sauf mail sensible (décès, maladie…). Réglages → Tri automatique.'],
    ['Ouvrir une pièce jointe', 'Les PDF et les images s\'ouvrent dans l\'appli, lisibles aussi sur téléphone ; « Télécharger » pour les garder.'],
    ['Plusieurs mails à la fois', '« Sélectionner » → cochez les fils → lu / non lu, attribuer, statut, archiver, corbeille. Annulable quelques secondes.'],
    ['Créer un dossier depuis un mail', 'Dans le mail : « Dossier » → « Créer un dossier depuis ce mail » (ou le bouton proposé par le tri automatique). Le mail reste rattaché au dossier.'],
    ['Noter un rendez-vous', 'Dans le mail : « Rendez-vous » (ou « Proposer un rendez-vous » suggéré par le tri automatique) crée un événement dans l\'agenda, avec le sujet du mail pour titre : ajustez la date, l\'heure et le lieu.'],
    ['Écrire à beaucoup de monde', 'Courrier → « Envoi groupé » (ou Contacts → un groupe). Jusqu\'à 100 personnes, le mail part de secretariat@ en copie cachée ; au-delà, il part par Brevo avec un lien de désinscription.']
  ] },
  { titre: 'Contacts', droit: 'contacts', guides: [
    ['Où sont les contacts ?', 'Dans Google Contacts du compte paroisse : une fiche modifiée dans l\'appli l\'est aussi dans Google, et inversement. N\'ajoutez pas le compte paroisse sur un téléphone personnel : consultez les contacts dans l\'appli.'],
    ['Ajouter un contact', 'Contacts → « + Nouveau » : nom, e-mails, téléphones, adresse, groupes. Une organisation (mairie, pompes funèbres…) a sa propre icône.'],
    ['Importer le tableau des contacts', 'Contacts → « Plus » → « Importer » → choisir le fichier .xlsx. Les couples deviennent deux fiches reliées par un foyer.'],
    ['Groupes automatiques', 'Toutes les heures (ou « Plus » → « Mettre à jour »), l\'appli crée les contacts des parents du catéchisme, des familles des dossiers, des catéchumènes, confirmands et membres Cor Unum, et tient à jour leurs groupes. Les groupes se gèrent dans « Plus » → « Groupes ».'],
    ['Écrire à un groupe', 'Contacts → choisir le groupe → « Envoi groupé ». Jusqu\'à 100 personnes, le mail part de secretariat@ en copie cachée ; au-delà, il part par Brevo avec un lien de désinscription.'],
    ['Fusionner des doublons', 'Contacts → « Plus » → « Doublons » : même e-mail, même téléphone ou même nom (même inversé). « Garder » réunit tout dans la fiche choisie et supprime l\'autre.'],
    ['Relier un foyer', 'Fiche → Foyer → « Relier à une personne », ou sélectionnez plusieurs contacts → « Relier en foyer ». L\'adresse peut être commune à tout le foyer.']
  ] },
  { titre: 'Agenda', droit: 'agenda', guides: [
    ['Les vues de l\'agenda', 'Liste (les trois semaines qui viennent, seulement les jours avec quelque chose : la vue par défaut sur téléphone), Jour, Semaine, Mois. Flèches ‹ › pour avancer, « Aujourd\'hui » pour revenir. L\'appli retient la vue choisie.'],
    ['Ajouter un événement', '« + Événement », ou un clic sur un jour : titre, début, fin (ou journée entière), lieu, description. C\'est l\'agenda public : il s\'affiche sur croix-glorieuse.org et dans la feuille de semaine.'],
    ['Dates des célébrations', 'La date fixée dans un dossier (baptême, mariage, obsèques…) est publiée dans l\'agenda public sans nom (« Baptême »). L\'événement montre une petite icône de dossier.'],
    ['Sans réseau', 'Un événement créé ou modifié hors connexion apparaît tout de suite avec « en attente d\'envoi », et part au retour du réseau.']
  ] },
  { titre: 'Dossiers et sacrements', droit: 'dossiers', guides: [
    ['Trouver un dossier', 'Dossiers : filtres par sorte (Baptêmes, Mariages…) et par année, recherche par nom, e-mail ou téléphone, menu « En cours / Clos / Annulés / Tous ». Chaque ligne montre la prochaine étape, les documents manquants et la date.'],
    ['Créer un dossier', 'Dossiers → « + Nouveau dossier » → la sorte → les premières informations → « Créer le dossier ». Un dossier se crée aussi tout seul quand un formulaire est rempli, ou depuis un mail.'],
    ['Suivre un dossier', 'Le bandeau en haut résume : prochaine étape, documents manquants, date de célébration. Cochez les étapes et les documents reçus ; déposez les pièces (photo, PDF) : elles vont dans le Drive du dossier. Choisissez le responsable et l\'état (en cours, clos, annulé) en haut.'],
    ['Les informations du dossier', 'Les sections déjà remplies sont affichées ; les sections vides sont repliées en petits boutons « + Section » : un clic en ouvre une. « Afficher toutes les sections » les ouvre toutes.'],
    ['Fixer la date d\'une célébration', 'Encadré « Date de célébration » : la date et l\'heure. Elle part dans l\'agenda public, sans nom.'],
    ['Premières communions, professions de foi, confirmations de jeunes', 'Une seule célébration par année scolaire : Dossiers → choisir la sorte et l\'année → « Fixer la date ». La liste de la promotion s\'imprime au même endroit.'],
    ['Courriers d\'un dossier', 'Bouton « Courriers » en haut du dossier : lettres et attestations préremplies (certificat de parrain ou marraine, lettre de recommandation, notifications…), à relire, signer, imprimer ou envoyer.'],
    ['Accusé de réception et réponses', 'Encadré « Actions » : accusé de réception, « Écrire », réponses types de cette sorte de dossier. Le mail envoyé est rattaché au dossier.'],
    ['Baptême hors de la paroisse (accord du curé, B15)', 'Famille d\'ici qui baptise ailleurs, ou famille d\'ailleurs qui baptise ici : « Formulaire « accord du curé » » envoie le formulaire à la famille ; ses réponses complètent le dossier. Puis « Accord du curé du domicile (B15) » : signé par le curé et envoyé, ou prérempli pour le curé du domicile.'],
    ['Certificat de parrain ou de marraine', 'Le formulaire « Certificat de parrain / marraine » crée le dossier ; vérifiez baptême, confirmation et communion, puis « Courriers » → le certificat, signé et envoyé par mail.'],
    ['Lettre de recommandation', 'Le formulaire « Lettre de recommandation » crée le dossier (destinataire, objet, enfant éventuel) ; « Courriers » ouvre la lettre préremplie à relire et signer.'],
    ['Changer un confirmand en confirmation de jeune', 'Dossier d\'un confirmand mineur : pastille « Mineur » → « Passer en Confirmation (jeunes) » (et inversement).'],
    ['Plusieurs dossiers à la fois', '« Sélectionner » → cochez → cocher une étape, changer le responsable ou l\'état, « Réclamer les documents »… Le raccourci « Avec des documents manquants » coche ceux qu\'il faut relancer.']
  ] },
  { titre: 'Documents à fournir', droit: 'dossiers', guides: [
    ['Réclamer les documents manquants', 'Dossier → encadré « Documents » → « Réclamer ». Le mail liste ce qui manque et contient un bouton « Déposer mes documents ». Pour plusieurs familles : Dossiers → « Sélectionner » → « Réclamer les documents ».'],
    ['Faire déposer les pièces sur place', 'Dossier → « QR code de dépôt » : la personne scanne le code avec son téléphone et dépose chaque pièce (photo ou PDF). Pratique au secrétariat.'],
    ['Ce que voit la famille', 'Une page « Documents à déposer » avec le prénom et seulement les pièces demandées : « Reçu » ou « Déposer ». Elle peut revenir plus tard avec le même lien. Le lien se ferme quand tout est reçu, ou quand le dossier est clos ou annulé.'],
    ['Quand une pièce arrive', 'Elle est rangée dans le dossier (et son Drive), le document est coché « reçu », et vous recevez une notification.']
  ] },
  { titre: 'Formulaires', droit: 'dossiers', guides: [
    ['Envoyer un formulaire par mail', 'Formulaires → le formulaire → « Envoyer par mail » : adresse, nom (pour le suivi), texte modifiable. La personne reçoit un bouton vers le formulaire ; le dossier se crée quand elle le remplit. Les inscriptions (communion, profession de foi, confirmation des jeunes) peuvent aussi être envoyées à une école : le lieu de préparation est déjà choisi, chaque famille crée son dossier.'],
    ['Remplir un formulaire avec la personne, sans mail', 'Formulaires → le formulaire → « Remplir sur place ». « Remplir ici, sur cet écran » ouvre le formulaire sur votre écran ; ou faites scanner le QR code : le formulaire s\'ouvre sur son téléphone, et le dossier s\'ouvre chez vous dès qu\'elle a envoyé. Le lien sert une seule fois, pendant 24 heures. L\'adresse e-mail est facultative ; si elle est donnée, une case propose un accusé de réception. La personne coche elle-même la case de consentement.'],
    ['Suivre les formulaires envoyés', 'Formulaires → « Suivi des envois » : pas encore rempli / rempli, lien vers le dossier créé, « Relancer » (un rappel par mail), « Retirer de la liste ». Les envois de plus d\'un an sont effacés automatiquement.'],
    ['Les formulaires disponibles', 'Demande de baptême (enfant), demande de mariage, inscription à la première communion, à la profession de foi, à la confirmation (jeunes), baptême et confirmation d\'un adulte, accord du curé (deux cas), certificat de parrain / marraine, lettre de recommandation. Chacun ne voit que ceux des dossiers auxquels il a accès.'],
    ['Inscription à la confirmation d\'un jeune déjà inscrit au catéchisme', 'Si le jeune a déjà son dossier (import du catéchisme), le formulaire complète ce dossier au lieu d\'en créer un second : même prénom, nom et année (et même date de naissance si elle est connue). Seuls les champs vides sont remplis.'],
    ['Documents à imprimer', 'Formulaires → « Documents à imprimer » : B14 (extrait de baptême), B15 (accord du curé), B6 (entrée en catéchuménat), extrait des sépultures — vierges, à remplir à l\'écran ou à la main, ou préremplis depuis un dossier.']
  ] },
  { titre: 'Extraits de baptême', droit: 'extraits', guides: [
    ['Délivrer un extrait', 'Extraits de baptême → « Nouvel extrait » (ou depuis un dossier) → compléter → « Signer » → imprimer, envoyer par e-mail ou télécharger. Le sceau de la paroisse est apposé (Réglages → Paroisse).'],
    ['Extraits à signer', 'Une demande préparée par le secrétariat apparaît « À signer » pour les prêtres, dans la liste et dans « À traiter ». « Sélectionner » permet de signer et envoyer plusieurs extraits d\'un coup.'],
    ['Registre des extraits délivrés', 'Chaque extrait signé est noté (registre B14) : qui, quand, à qui il a été envoyé.']
  ] },
  { titre: 'Registres', droit: 'registres', guides: [
    ['Inscrire un acte au registre', 'Depuis le dossier (étape « Inscription au registre ») ou Registres : l\'année et le numéro d\'acte suivant sont proposés, « Inscrire ».'],
    ['Inscrire en série', 'Registres → « Inscrire en série » : choisissez l\'ordre des actes de l\'année ; l\'appli donne les numéros à la suite et les inscrit d\'un coup.'],
    ['Table alphabétique', 'Registres → l\'année → « Imprimer la table » : la table alphabétique des actes de l\'année.']
  ] },
  { titre: 'Catéchisme', droit: 'catechisme', guides: [
    ['Inscriptions au catéchisme', 'Les réponses au formulaire Google arrivent seules (Réglages → Catéchisme), ou « Importer le formulaire ». Chaque enfant est placé dans son groupe d\'après sa classe ; une demande de sacrement crée le dossier. « + Inscrire » pour inscrire à la main.'],
    ['Encaisser un paiement', 'Catéchisme → l\'enfant → « Manuels et paiements » → montant, mode, « Encaisser ». « Plus » → « Relancer les impayés » écrit à chaque famille avec ce qui reste dû.'],
    ['Écrire aux parents ou imprimer une liste', 'Filtrez par groupe (ou « Impayés seulement »), puis « Mail aux parents ». « Plus » → « Imprimer la liste ».'],
    ['Gérer les livres du catéchisme', 'Catéchisme → onglet « Livres » : catalogue (titre, prix, groupe, stock), commandes à payer, à remettre, payées. Le lien public de la boutique se copie en haut ; les familles reçoivent un lien personnel prérempli.'],
    ['Paiements en ligne (HelloAsso)', 'Réglages → Paiements en ligne : nom de l\'association, identifiant et secret de l\'API, « Tester la connexion », puis activer. Les paiements arrivent ensuite tout seuls dans les fiches.']
  ] },
  { titre: 'Catéchuménat', droit: 'catechumenat', guides: [
    ['La page Catéchuménat', 'Onglets : les catéchumènes (avec l\'indicateur d\'app installée), les textes publiés, le calendrier des rencontres, les lettres à l\'évêque à traiter, les prochains anniversaires de baptême des néophytes.'],
    ['Importer le tableau Excel des catéchumènes', 'Dossiers → Catéchumènes → « Importer un tableau » → choisir le fichier .xlsx (un onglet par année). L\'aperçu propose un statut pour chacun ; vous validez avant la création.'],
    ['Donner à un catéchumène son espace personnel', 'Dossier du catéchumène → encadré « Espace personnel » → « Créer son espace » puis « Envoyer le lien ». À la première visite, il choisit son mot de passe. La liste montre qui a installé l\'app ; « Renvoyer le lien » pour plusieurs personnes à la fois.'],
    ['Publier un texte pour les catéchumènes', 'Catéchuménat → « Nouveau texte » : pour qui (une promotion, les néophytes, une personne), texte, fichiers ou liens, visible aussi par les parrains et marraines si vous le cochez, « Publier ». Les personnes concernées reçoivent une notification.'],
    ['Lettres à l\'évêque', 'Le catéchumène écrit sa lettre dans son espace ; elle arrive dans « À traiter » : la relire, demander une correction ou l\'accepter.'],
    ['Faire signer le B6 (entrée en catéchuménat)', 'Dossier du catéchumène → « L\'entrée en catéchuménat (B6) » → « Faire signer » : le prêtre ou le diacre signe, puis le catéchumène, sur le même appareil. Le PDF avec le sceau est rangé dans le dossier.'],
    ['Anniversaires de baptême', 'Catéchuménat → anniversaires : « Souhaiter l\'anniversaire de baptême des néophytes » envoie un mot à chacun.']
  ] },
  { titre: 'Confirmands adultes', droit: 'dossiers:confirmand', guides: [
    ['Confirmands adultes', 'Catéchèse → Confirmands. Les inscriptions du formulaire Google arrivent seules. Pastilles : « Baptême à trouver », « Autre confession » (profession de foi requise), « Mineur » (bouton « Passer en Confirmation (jeunes) »).'],
    ['Retrouver les baptêmes', 'Confirmands → « Baptêmes à trouver » : un mail personnel à chaque confirmand dont la date et le lieu du baptême manquent, avec des pistes pour les retrouver. « Importer le formulaire » relit les inscriptions sans attendre.']
  ] },
  { titre: 'Retraites', droit: 'retraites', guides: [
    ['Organiser une retraite', 'Retraites → « + Nouvelle retraite » : type, dates, heures, lieu, prix (lignes « compris » ou « option »), programme, à apporter, modalités. Le lien d\'inscription se copie ou s\'envoie.'],
    ['Suivre les inscriptions', 'La retraite → liste des inscrits : paiements, covoiturage (propose ou cherche une place), fiches santé et contacts d\'urgence (proposés à l\'effacement après la retraite : App des paroissiens → RGPD). Encaisser un paiement : « Ajouter ». Impression des listes pour le jour même.']
  ] },
  { titre: 'Cor Unum', droit: 'cor_unum', guides: [
    ['Répartir les inscrits', 'Les inscriptions arrivent dans « À répartir » avec une fraternité proposée : « Valider » ou « Tout valider ». Un membre peut être déplacé à tout moment.'],
    ['Faire vivre une fraternité', 'Chaque fraternité : liste au chef, mail à l\'équipe, relance des anciens, messages des chefs.'],
    ['Donner accès à un chef de fraternité', 'Cor Unum → la fraternité → « Lien du chef » → « Envoyer au chef ». Sans compte ni mot de passe, il voit ses membres, en ajoute, note les rencontres, écrit à son équipe et vous envoie des messages. « Nouveau lien » rend l\'ancien inutilisable.'],
    ['Relier un catéchumène, un néophyte ou un confirmand à sa fraternité', 'Le lien se fait tout seul par le nom (nom de jeune fille compris). S\'il manque ou s\'il est faux : dans le dossier, encadré « Fraternité Cor Unum » → « Relier ».']
  ] },
  { titre: 'App des paroissiens', droit: 'paroissiens', guides: [
    ['L\'app des paroissiens', 'app.croix-glorieuse.org : annonces, messes, inscriptions, demandes de sacrement, dons, mur de prière, propositions… Ce qui est ouvert se règle dans Réglages → App des paroissiens.'],
    ['Demandes d\'accès', 'App des paroissiens (onglets Demandes, Comptes, Prière, Inviter, Dons, RGPD) → Demandes : « Accepter », « Refuser » (effacée après 3 mois) ou « Demander des précisions ». Pour un mineur, l\'accord d\'un parent est demandé par mail. Plusieurs demandes peuvent être traitées d\'un coup avec « Sélectionner ».'],
    ['Comptes', 'Inviter quelqu\'un, renvoyer l\'invitation, suspendre, réactiver ou effacer un compte ; relier ou défaire un foyer.'],
    ['Mur de prière', 'Les intentions à relire attendent votre décision : « Publier » ou « Ne pas publier ».'],
    ['Causes de dons', 'Le curé et les administrateurs ajoutent les causes proposées dans l\'app (nom, texte court, lien du formulaire HelloAsso).'],
    ['Notifier une annonce', 'Annonces → l\'annonce → « Notifier » : une notification part sur les téléphones des paroissiens qui ont installé l\'app.'],
    ['Effacer les données anciennes (RGPD)', 'App des paroissiens → onglet RGPD : la liste de ce qui peut être effacé (anciennes fiches Cor Unum, fiches santé et contacts d\'urgence des retraites passées). Cochez, puis « Effacer définitivement » ou « Garder un an ».']
  ] },
  { titre: 'Propositions', droit: 'propositions', guides: [
    ['Créer un parcours', 'Propositions → « + Nouvelle proposition » : titre, présentation courte, image, dates ; « Ajouter un jour » pour chaque étape (texte, référence biblique, image). Les paroissiens abonnés la reçoivent jour après jour dans l\'app.'],
    ['Reprendre un parcours l\'année suivante', '« Dupliquer » → nouvelle date du premier jour : toutes les étapes sont décalées d\'autant ; la copie est un brouillon à relire avant publication.']
  ] },
  { titre: 'Documents', droit: 'documents', guides: [
    ['Le Drive du secrétariat', 'Documents montre les dossiers du Drive : « Joindre un document », « Nouveau dossier », « Renommer ». « À ranger » regroupe le reste du Drive : « Ranger ici » le classe.']
  ] },
  { titre: 'Statistiques', droit: 'statistiques', guides: [
    ['Le tableau de bord annuel', 'Statistiques : sacrements célébrés, préparations, catéchisme (enfants inscrits, cotisations reçues et à recevoir), Cor Unum (fraternités, membres, chefs), comparés à l\'année précédente, avec le détail par mois.']
  ] },
  { titre: 'Utilisateurs', droit: 'utilisateurs', guides: [
    ['Créer un compte', 'Utilisateurs → « Ajouter » : nom affiché, identifiant de connexion, rôle (curé, vicaire, diacre, secrétaire, administrateur…). Les comptes de l\'appli sont indépendants de Google.'],
    ['Régler les accès', 'Fiche → Accès : partir des « accès habituels du rôle », puis ajuster rubrique par rubrique (aucun, lecture, modification), le courrier (tout le courrier ou seulement les mails attribués), la signature des extraits.'],
    ['Couper un accès', 'Décocher « Compte actif » coupe l\'accès immédiatement, sans rien effacer.'],
    ['Voir l\'appli comme quelqu\'un d\'autre', '« Voir comme… » montre l\'appli telle que la voit une secrétaire, un prêtre ou un diacre, avec des données fictives : rien n\'est enregistré ni envoyé.']
  ] },
  { titre: 'Réglages', droit: 'reglages', guides: [
    ['Les rubriques des réglages', 'Sur ordinateur, les rubriques sont en colonne à gauche : Paroisse (noms, adresses, sceau, qui peut signer), App des paroissiens, Signatures, Réponses types, Modèles, Tri automatique, Catéchisme, Confirmands, Cor Unum, Paiements en ligne, Newsletter, Liturgie, Journal, Sauvegardes. Chacun ne voit que celles qui lui sont permises.'],
    ['Signatures et réponses types', 'Signatures : la signature des mails de chacun (nom, fonction, coordonnées). Réponses types : les textes prêts à l\'emploi, avec des variables ({nom}, {documents_manquants}…) remplies seules.'],
    ['Modèles de courriers', 'Réglages → Modèles : le texte des lettres et attestations des dossiers (certificat de parrain, lettre de recommandation…). « Rétablir » revient au texte proposé.'],
    ['Journal des actions', 'Réglages → Journal : qui a fait quoi et quand (envois, signatures, suppressions…).'],
    ['Sauvegardes', 'Réglages → Sauvegardes : les copies automatiques de la base ; « Restaurer » revient à une copie (avec confirmation).']
  ] },
  { titre: 'Intentions de messe', droit: 'intentions', guides: [
    ['Aujourd\'hui', 'Intentions → Aujourd\'hui : les messes du jour et leurs intentions, « J\'ai célébré », et ce qui reste à traiter : demandes en attente, confirmations à envoyer, messes passées non déclarées célébrées.'],
    ['Calendrier', 'Chaque messe de l\'agenda a une pastille : libre, en attente, attribuée. Un jour → détail : « + Intention », modifier, ajouter une messe privée, « J\'ai célébré », annuler.'],
    ['Valider ou refuser une demande', 'Intentions → Gérer : une demande en attente montre les créneaux (🔒 = déjà pris). « Valider » envoie la confirmation par mail ; « Refuser » montre d\'abord le mail (avec une date proposée si vous voulez), puis « Refuser et envoyer » ou « Refuser sans mail ».'],
    ['Modifier ou supprimer une intention', 'Modifier la date, l\'heure ou l\'intention remet la confirmation « à envoyer ». Supprimer la passe en « annulée » : la messe redevient libre. Les doublons sont signalés.'],
    ['Attribuer à un autre prêtre', 'Le curé et les administrateurs choisissent le célébrant (prêtres de la paroisse ou « Autre prêtre »).'],
    ['Relevé des messes célébrées', 'Gérer → « Relevé » : par mois, année ou dates, par prêtre ; en PDF ou en tableur.'],
    ['Nouvelles demandes du site', 'Les demandes faites sur le site arrivent toutes seules ; une notification prévient les prêtres de la tuile.']
  ] },
  { titre: 'Annonces et newsletter', droit: 'annonces', guides: [
    ['Créer une annonce', 'Annonces → « + Nouvelle annonce » : titre, description, date et heure de l\'événement, période d\'affichage, image (réduite automatiquement), lien, cases Prioritaire · Active · Newsletter · Feuille. L\'ordre se change en glissant les cartes.'],
    ['Dupliquer, désactiver, fin automatique', '« Dupliquer » copie l\'annonce (dates vidées) pour la corriger avant d\'enregistrer. Chaque nuit, les annonces dont la date de fin est passée deviennent inactives.'],
    ['Feuille du dimanche et WhatsApp', '« Feuille du dimanche » : choisissez le dimanche, cochez les annonces, « Copier ». « Texte WhatsApp » prépare le même contenu mis en forme pour WhatsApp.'],
    ['Notifier les paroissiens', 'Sur l\'annonce : « Notifier » envoie une notification sur les téléphones des paroissiens qui ont installé l\'app.'],
    ['Feuille de semaine', 'Feuille de semaine : construite toute seule depuis l\'agenda public (fête et couleur, événements, intentions avec ✝ pour les défunts). Retouchez (lignes, notes, mise en forme, glisser), puis « Générer le .docx » ou « Envoyer vers la newsletter ». « Repartir de l\'agenda » efface les retouches.'],
    ['Newsletter', 'Newsletter : la semaine, les annonces cochées « Newsletter », l\'aperçu modifiable (vue téléphone ou ordinateur). « Envoyer un test » l\'envoie aux adresses de test ; « Programmer l\'envoi » la confie à Brevo pour le dimanche à l\'heure réglée (date, heure et objet modifiables) ; « Annuler l\'envoi » tant qu\'elle n\'est pas partie. Le brouillon est partagé entre tous les utilisateurs de la tuile.']
  ] },
  { titre: 'Liturgie', droit: 'liturgie', guides: [
    ['Bréviaire', 'Les 8 heures, l\'heure du moment à l\'ouverture ; jour précédent / suivant ; Latin / Français ; une partie par écran (onglets) ; A− / A+ pour la taille, ☾ pour le mode sombre, ⤢ pour le plein écran. Aux Vêpres : partitions grégoriennes, écoute et traduction.'],
    ['Messe du jour', 'Le propre complet en latin et en français, avec le choix quand plusieurs messes sont possibles. Les références de l\'épître et de l\'évangile ouvrent le passage dans la Bible.'],
    ['Ordo', 'Le mois jour par jour : fête et rang, Gloria, Credo, préface, commémoraisons, Vêpres, pénitence, fêtes d\'obligation, messes et intentions. Toucher un jour → « Bréviaire de ce jour » ou « Messe de ce jour ». Le PDF du mois s\'imprime.'],
    ['Bible', 'La grille des livres (Ancien et Nouveau Testament), puis des chapitres ; ‹ › ou glisser le doigt pour changer de chapitre ; recherche par référence ou par mots ; commentaires 💬 des Évangiles ; marque-pages gardés sur votre compte.'],
    ['Calendrier propre', 'Les fêtes propres de la paroisse et de Strasbourg : « Ajouter une fête » (nom, rang, commun, pièces propres en latin et en français) ou une mention facultative. Le bréviaire et les messes sont recalculés (quelques minutes) ; une notification prévient à la fin. « Historique » permet de revenir en arrière.'],
    ['Sans réseau', 'Les offices et les messes des 30 prochains jours, la Bible entière et ses commentaires restent sur l\'appareil : tout marche hors connexion.']
  ] }
]

const sansAccents = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function Aide() {
  const { peut } = useApp()
  const [q, setQ] = useState('')
  const [ouvert, setOuvert] = useState(null)
  const [tout, setTout] = useState(false)
  const permise = (r) => !r.droit || [].concat(r.droit).some((d) => peut(d))
  const rubriques = RUBRIQUES.filter((r) => tout || permise(r))
  const cachees = RUBRIQUES.length - RUBRIQUES.filter(permise).length
  return (
    <>
      <EnTete titre="Aide" sousTitre="Comment faire, rubrique par rubrique" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] max-w-xl flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-nuit-600/75" />
          <input className="champ pl-9" placeholder="Que voulez-vous faire ?" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher dans l'aide" /></div>
        {cachees > 0 && <button className="text-sm text-or-600 hover:underline" onClick={() => setTout(!tout)}>{tout ? 'Seulement mes rubriques' : `Tout afficher (${cachees} rubrique${cachees > 1 ? 's' : ''} de plus)`}</button>}
      </div>
      {!q && (
        <nav aria-label="Rubriques de l'aide" className="barre-onglets mb-5">
          {rubriques.map((r) => <a key={r.titre} href={`#aide-${sansAccents(r.titre).replace(/[^a-z]+/g, '-')}`} onClick={(e) => { e.preventDefault(); document.getElementById(`aide-${sansAccents(r.titre).replace(/[^a-z]+/g, '-')}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
            className="rounded-full border border-nuit-100 bg-white px-3 py-1 text-sm text-nuit-600 hover:border-or hover:text-or-600">{r.titre}</a>)}
        </nav>
      )}
      <div className="space-y-5">
        {rubriques.map((r) => {
          const l = r.guides.filter(([t, x]) => !q || sansAccents(r.titre + ' ' + t + ' ' + x).includes(sansAccents(q)))
          if (!l.length) return null
          return (
            <section key={r.titre} id={`aide-${sansAccents(r.titre).replace(/[^a-z]+/g, '-')}`} className="carte scroll-mt-4 divide-y divide-nuit-50">
              <h2 className="px-4 py-3 text-xl font-semibold">{r.titre}</h2>
              {l.map(([t, x]) => {
                const k = r.titre + t, o = ouvert === k || !!q
                return (
                  <div key={t}>
                    <button className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-nuit-50/50" aria-expanded={o} onClick={() => setOuvert(o && !q ? null : k)}>
                      <span className="flex-1">{t}</span><ChevronDown className={`h-4 w-4 text-nuit-600/75 transition ${o ? 'rotate-180' : ''}`} /></button>
                    {o && <p className="px-4 pb-3 text-sm leading-relaxed text-nuit-600">{x}</p>}
                  </div>
                )
              })}
            </section>
          )
        })}
        {q && !rubriques.some((r) => r.guides.some(([t, x]) => sansAccents(r.titre + ' ' + t + ' ' + x).includes(sansAccents(q)))) && (
          <p className="text-sm text-nuit-600">Rien trouvé pour « {q} ».{!tout && cachees > 0 && <> <button className="text-or-600 hover:underline" onClick={() => setTout(true)}>Chercher dans toute l'aide</button></>}</p>
        )}
      </div>
    </>
  )
}
