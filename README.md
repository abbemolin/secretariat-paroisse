# Secrétariat – Paroisse personnelle La Croix glorieuse

Appli de secrétariat paroissial pour **téléphone et ordinateur** (installable comme une appli).
Tout repose sur le **compte Gmail de la paroisse** (`saintlouisenville67@gmail.com`) : courrier, agenda public, Drive.
Les utilisateurs (curé, vicaire, secrétaire) ont leur **propre compte dans l'appli**, sans compte Google.

```
  Site croix-glorieuse.org                    Compte Gmail de la paroisse
 ┌──────────────────────────┐               ┌───────────────────────────────────────┐
 │ Formulaires de demande   │──── envoi ──▶ │ Script Apps Script (le « serveur »)   │
 │ baptême, mariage,        │               │  ├─ Gmail  : boîte + envoi en tant que │
 │ catéchumène, confirmand  │               │  │           secretariat@…            │
 └──────────────────────────┘               │  ├─ Agenda : agenda public            │
 ┌──────────────────────────┐               │  ├─ Drive  : Secrétariat – La Croix…  │
 │ Appli (GitHub Pages)     │◀── HTTPS ───▶ │  ├─ Contacts : groupes (envois)       │
 │ identifiant + mot de passe│              │  └─ Sheets : base de données          │
 └──────────────────────────┘               └───────────────────────────────────────┘
```

## Contenu

| Dossier | Rôle |
|---|---|
| `backend/` | Le serveur Apps Script (7 fichiers `.gs` + `appsscript.json`) |
| `app/` | L'appli (React), publiée sur GitHub Pages |
| `formulaires/` | Les 4 formulaires HTML à placer sur croix-glorieuse.org |

## Ce que fait l'appli

- **Courrier** : boîte du Gmail paroisse, tout le monde voit tout. Envoi toujours depuis **secretariat@croix-glorieuse.org**.
  Signatures au modèle de la paroisse (une par personne + une « Paroisse »), réponses types, **attribution** d'un mail
  avec notification, liste « Mes mails », statuts (À traiter / En cours / Traité), **commentaires internes**,
  transformer un mail en **dossier** ou en **rendez-vous**, **envois groupés** à un groupe de contacts (Gmail jusqu'à 100 personnes, Brevo au-delà).
- **Contacts** : Google Contacts du compte paroisse, modifiés dans les deux sens (fiches, **foyers**, groupes), **import** du tableau
  des contacts (sans Colmar, couples séparés), **doublons** à fusionner, contacts et **groupes automatiques** tenus à jour toutes les heures
  d'après le catéchisme, Cor Unum, le catéchuménat et les dossiers (jamais les obsèques), fiche reliée à tout ce qui la concerne dans l'appli.
- **Agenda** : l'agenda public (affiché sur le site), vues jour / semaine / mois. Fixer la date d'un dossier y crée
  l'événement **sans nom** (« Baptême », « Mariage », « Obsèques »…) ; déplacer l'événement met le dossier à jour, et inversement.
- **Dossiers** : baptême, mariage, obsèques, catéchumène adulte, confirmand adulte — étapes à cocher, informations,
  documents à recevoir (avec dépôt du fichier), rencontres avec présences (catéchumènes, confirmands), pièces rangées
  dans le Drive (`Dossiers/<Type>/<Année>`), mails rattachés, historique.
  Génère l'**extrait de baptême B14** et le **B6 – entrée en catéchuménat** (formulaires reproduits, sur papier blanc),
  et l'extrait du registre des sépultures. Le n° d'acte est saisi à la main.
- **Documents** : Drive du secrétariat (Dossiers, Modèles, Partage) + vue **« À ranger »** pour reclasser le reste du Drive.
- **Notifications** : dans l'appli (cloche) et **sur le téléphone** (à activer dans Mon compte).
- **Réglages** : paroisse, signatures, réponses types, journal de toutes les actions.
- Rôles : **Administrateur** (tout), **Curé / prêtre** (courrier, agenda, dossiers, documents), **Secrétaire** (idem + réglages).

---

## Installation (≈ 30 minutes, une seule fois)

### Avant de commencer — vérifier l'alias d'envoi

Dans Gmail (compte paroisse) → ⚙️ → *Voir tous les paramètres* → **Comptes et importation** → *Envoyer des e-mails en tant que* :
`secretariat@croix-glorieuse.org` doit y figurer. **Sans cet alias, l'appli refuse d'envoyer** (pour ne jamais exposer l'adresse @gmail.com).

### 1. Le serveur (Google Apps Script)

1. Connecté au **compte Gmail de la paroisse**, ouvrez <https://script.google.com> → **Nouveau projet** → nommez-le « Secrétariat paroisse ».
2. ⚙️ **Paramètres du projet** → cochez *Afficher le fichier manifeste « appsscript.json »*.
3. Dans l'éditeur, créez les fichiers (bouton **+** → Script) et collez le contenu de `backend/` :
   `Code.gs`, `Push.gs`, `Courrier.gs`, `Agenda.gs`, `Dossiers.gs`, `Documents.gs`, `Installation.gs`, puis remplacez `appsscript.json`.
   *(Ou, avec l'outil `clasp` : `clasp create --type webapp` puis `clasp push` dans `backend/`.)*
4. **Services** (+) → ajoutez **People API** (si ce n'est pas déjà fait par le manifeste).
5. Sélectionnez la fonction **`installer`** → **Exécuter**. Autorisez l'accès
   (« Google n'a pas validé cette application » : *Paramètres avancés → Accéder à Secrétariat paroisse*, c'est votre propre script).
   Le journal d'exécution affiche :
   - le **mot de passe provisoire** du compte `florent` (administrateur) ;
   - la vérification de l'alias, de l'agenda public et des groupes de contacts.
6. **Déployer → Nouveau déploiement** → **Application Web** — Exécuter en tant que : **Moi** — Accès : **Tout le monde** → copiez l'**URL** (finit par `/exec`).

> « Tout le monde » rend l'adresse joignable (nécessaire pour l'appli et les formulaires du site), pas les données : chaque action de l'appli exige une connexion.

### 2. L'appli (GitHub Pages)

1. Créez un dépôt GitHub (ex. `secretariat-paroisse`) et envoyez-y **tout ce dossier**.
2. **Settings → Secrets and variables → Actions → Variables** → nouvelle variable `API_URL` = l'URL `/exec`.
3. **Settings → Pages → Source : GitHub Actions**. Chaque envoi sur `main` redéploie (onglet *Actions*).
4. L'appli est à `https://<compte>.github.io/secretariat-paroisse/`.
5. Dans l'appli → **Réglages → Paroisse** → *Adresse des icônes de signature* :
   `https://<compte>.github.io/secretariat-paroisse/signature` (icônes bleues des signatures, comme vos signatures actuelles).

### 3. Les formulaires du site

```bash
cd formulaires
python3 generer.py "https://script.google.com/macros/s/…/exec"
```

Cela produit `formulaire-bapteme.html`, `formulaire-mariage.html`, `formulaire-catechumene.html`, `formulaire-confirmand.html`.
Dans l'éditeur IONOS, ajoutez sur chaque page un bloc **« Code HTML »** (ou *Widget HTML*) et collez-y le contenu du fichier.
Les demandes arrivent dans **Dossiers** et chaque utilisateur reçoit une notification. Pas de formulaire pour les obsèques (saisie dans l'appli).
Protection : case de consentement RGPD, champ piège anti-robots, 20 demandes par heure au maximum.

### 4. Premiers pas

1. Connectez-vous avec `florent` + mot de passe provisoire → **Mon compte** → changez-le, puis **Activer les notifications**.
2. **Utilisateurs** → créez `guillaume` (Curé / prêtre, signature « Abbé Guillaume LE GALL ») et `bertille` (Secrétaire, signature « Bertille BAUER »).
3. **Réglages** → vérifiez les signatures et les réponses types.
4. **Documents → À ranger** → reclassez peu à peu le Drive existant dans `Modèles`, `Partage`, etc.
5. Sur chaque téléphone : ouvrir l'adresse → *Ajouter à l'écran d'accueil* → ouvrir depuis l'icône → *Mon compte → Activer les notifications*.

---

## Mettre à jour

- **Serveur** : recollez dans l'éditeur Apps Script les fichiers modifiés (en ouvrant **le fichier du même nom** : jamais dans un autre),
  puis **Déployer → Gérer les déploiements → ✏️ → Nouvelle version**. L'URL reste la même (ne faites pas « Nouveau déploiement »).
  Contrôle : fonction `verifierFichiers` (Verification.gs) → « Tout est en place ». Si `FEUILLES` a changé, relancez `installer()`.
- **Après l'arrivée de Contacts.gs** (droit d'écrire dans Google Contacts) : dans l'éditeur, sélectionnez la fonction `autoriserContacts`, ▶ Exécuter, acceptez le nouveau droit, puis nouvelle version du déploiement.
- **Appli** : envoyez sur `main`, GitHub redéploie.
- **Ajouter une étape, un champ ou un document à un type de dossier** : `app/src/types.js` (un seul endroit).

## Bon à savoir

- **Quotas Gmail gratuits** : ~100 destinataires par jour pour les envois faits par script : au-delà de 100 destinataires, les envois groupés passent par Brevo (expéditeur secretariat@, lien de désinscription, sans pièce jointe).
- **Événements récurrents** (messes) : visibles, mais modifiables seulement dans Google Agenda.
- **Agenda public** : les célébrations des dossiers y apparaissent **sans nom** ; ne mettez rien de personnel dans le titre ou la description d'un événement.
- **Notifications téléphone** : iPhone = iOS 16.4 minimum, appli ajoutée à l'écran d'accueil. Android et ordinateur : Chrome, Edge, Firefox.
- **Sécurité** : mots de passe hachés, blocage après 5 essais, sessions de 30 jours, compte désactivé coupé immédiatement, journal de toutes les actions.
- **RGPD** : les dossiers de sacrements contiennent des données sensibles (appartenance religieuse). Ne créez des comptes qu'aux personnes qui en ont besoin et désactivez-les à leur départ.
- **Démonstration** : ajoutez `?demo` à l'adresse de l'appli pour la parcourir avec des données fictives.

## Développement local

```bash
cd app && npm install && npm run dev    # http://localhost:5173/?demo
```
