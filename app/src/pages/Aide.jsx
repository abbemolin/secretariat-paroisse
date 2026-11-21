import { useState } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { EnTete } from '../ui.jsx'

// « Comment faire » : guides courts, par rubrique. Recherche dans les titres et les textes.
const GUIDES = [
  ['Pour commencer', [
    ['Installer l\'appli sur mon téléphone', 'Ouvrez l\'adresse de l\'appli dans le navigateur du téléphone. iPhone : Safari → bouton Partager → « Sur l\'écran d\'accueil ». Android : Chrome → menu ⋮ → « Installer l\'application ». Ouvrez ensuite l\'appli depuis son icône.'],
    ['Recevoir les notifications', 'Mon compte → Notifications sur cet appareil → « Activer les notifications ». Choisissez ensuite ce que vous voulez recevoir et, si vous le souhaitez, des heures calmes (rien ne sonne la nuit).'],
    ['Agrandir le texte ou passer en mode sombre', 'Mon compte → Affichage. Le réglage vaut pour cet appareil seulement.'],
    ['La liste « À faire » de l\'accueil', 'Elle rassemble ce qui attend une action : mails à traiter, nouvelles demandes, préparations à valider, baptêmes à trouver, inscrits Cor Unum à répartir, messages des chefs, impayés du catéchisme. Touchez une ligne pour y aller.'],
    ['Annuler une action', 'Après une suppression, un archivage ou un placement, un bouton « Annuler » apparaît en bas de l\'écran pendant quelques secondes.'],
    ['Enregistrer', 'Dans un dossier ou une fiche, les modifications sont enregistrées toutes seules (« Enregistré ✓ » s\'affiche). Les réglages ont encore un bouton « Enregistrer ».']
  ]],
  ['Courrier', [
    ['Répondre avec une réponse type', 'Ouvrez le mail → Répondre → choisissez la réponse type à droite. Le nom, le lien des horaires et les documents manquants se remplissent seuls.'],
    ['Attribuer un mail', 'Dans le mail : « Attribué à ». La personne reçoit une notification ; le mail apparaît dans « Mes mails ».'],
    ['Tri automatique', 'Les nouveaux mails reçoivent une étiquette (Horaires, Baptême, Extrait…) et l\'appli propose l\'action qui va avec. Les demandes d\'horaires reçoivent la réponse type automatiquement, sauf mail sensible (décès, maladie…), signalé « Prioritaire ». Réglages → Tri automatique.'],
    ['Créer un dossier depuis un mail', 'Dans le mail : « Dossier » (ou le bouton proposé par le tri automatique). Le mail reste rattaché au dossier.']
  ]],
  ['Dossiers et sacrements', [
    ['Suivre un dossier', 'Cochez les étapes et les documents reçus ; déposez les pièces (photo, PDF). La date de célébration est publiée dans l\'agenda public, sans nom.'],
    ['Premières communions, professions de foi, confirmations de jeunes', 'Une seule célébration par année scolaire : Dossiers → choisir le type et l\'année → « Fixer la date ». La liste de la promotion s\'imprime au même endroit.'],
    ['Envoyer un formulaire d\'inscription à une école ou à un parent', 'Dossiers → « Envoyer un formulaire ». Le mail contient un bouton vers le formulaire ; pour une école, le lieu de préparation est déjà choisi. La copie de l\'acte de baptême est demandée.'],
    ['Faire signer le B6 (entrée en catéchuménat)', 'Dossier du catéchumène → « L\'entrée en catéchuménat (B6) » → « Faire signer » : le prêtre ou le diacre signe, puis le catéchumène, sur le même appareil. Le PDF avec le sceau est archivé et l\'étape cochée.'],
    ['Délivrer un extrait de baptême', 'Extraits de baptême → « Nouvel extrait » (ou depuis un dossier) → compléter → « Signer » → imprimer, envoyer ou télécharger.']
  ]],
  ['Catéchèse', [
    ['Inscriptions au catéchisme', 'Les réponses au formulaire Google arrivent seules (Réglages → Catéchisme). Chaque enfant est placé dans son groupe d\'après sa classe ; une demande de sacrement crée le dossier.'],
    ['Encaisser un paiement', 'Catéchisme → l\'enfant → « Manuels et paiements » → montant, mode, « Encaisser ». « Relancer les impayés » écrit à chaque famille avec ce qui reste dû.'],
    ['Confirmands adultes', 'Catéchèse → Confirmands. Les inscriptions du formulaire Google arrivent seules. Pastilles : « Baptême à trouver », « Autre confession » (profession de foi requise), « Mineur » (bouton « Passer en Confirmation (jeunes) »).'],
    ['Fraternités Cor Unum', 'Les inscriptions arrivent dans « À répartir » avec une fraternité proposée : « Valider » ou « Tout valider ». Chaque fraternité : liste au chef, mail à l\'équipe, relance des anciens, messages.'],
    ['Importer le tableau Excel des catéchumènes', 'Dossiers → Catéchumènes → « Importer un tableau » → choisir le fichier .xlsx (un onglet par année). L\'aperçu propose un statut pour chacun (baptême 2027, 2028, en attente, baptisé(e) en 2024/2025/2026, ne pas importer) : corrigez-le puis « Importer ». Les dossiers existants sont seulement complétés ; on peut réimporter sans créer de doublons.'],
    ['Relier un catéchumène, un néophyte ou un confirmand à sa fraternité', 'Le lien se fait tout seul par le nom (nom de jeune fille compris). S\'il manque ou s\'il est faux : dans le dossier, encadré « Fraternité Cor Unum » → « Relier » / « Changer » / « Délier » ; ou dans la fiche Cor Unum → « Dossier de sacrement ». Les profils Catéchumène, Néophyte (après le baptême) et Confirmand suivent alors le dossier.'],
    ['Organiser une retraite et inscrire les participants', 'Retraites → « Nouvelle retraite » : type, dates, heures, lieu, prix (lignes « compris » ou « option »), participation suggérée à la cérémonie, programme, à apporter, modalités de paiement. Puis « Inviter » : chaque dossier de l\'année reçoit un lien personnel déjà rempli (les parents pour les enfants ; confirmands et catéchumènes de la même année pour les adultes). Le lien public se copie pour les autres. L\'étape « Retraite » du dossier se coche à l\'inscription ; les paiements se saisissent dans chaque inscription.'],
    ['Paiements en ligne (HelloAsso)', 'Réglages → Paiements en ligne : nom de l\'association, identifiant et secret de l\'API (HelloAsso → Mon compte → Intégrations et API), « Tester la connexion », puis activer. Ensuite : mail automatique aux parents après chaque inscription au catéchisme (cotisation et livres) ; boutons « Payer » dans les relances, les mails des retraites et la boutique de livres. Les paiements s\'inscrivent tout seuls (mode « HelloAsso ») ; chèques et espèces se saisissent toujours à la main.'],
    ['Gérer les livres du catéchisme', 'Catéchisme → Livres : catalogue (titre, prix, groupe, stock), commandes à payer, à remettre, payées. Le lien public de la boutique se copie en haut ; les familles reçoivent un lien personnel pré-rempli. Case « Livres remis » quand ils sont donnés.'],
    ['Donner accès à un chef de fraternité', 'Cor Unum → la fraternité → « Lien du chef » → « Envoyer au chef ». Sans compte ni mot de passe, il voit ses membres, en ajoute, note les rencontres, écrit à son équipe et vous envoie des messages. « Nouveau lien » désactive l\'ancien.']
  ]]
]

export default function Aide() {
  const [q, setQ] = useState('')
  const [ouvert, setOuvert] = useState(null)
  const n = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return (
    <>
      <EnTete titre="Aide" sousTitre="Comment faire, rubrique par rubrique" />
      <div className="relative mb-4 max-w-xl"><Search className="absolute left-3 top-2.5 h-4 w-4 text-nuit-600/50" />
        <input className="champ pl-9" placeholder="Que voulez-vous faire ?" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="space-y-5">
        {GUIDES.map(([rubrique, items]) => {
          const l = items.filter(([t, x]) => !q || n(t + ' ' + x).includes(n(q)))
          if (!l.length) return null
          return (
            <section key={rubrique} className="carte divide-y divide-nuit-50">
              <h2 className="px-4 py-3 text-xl font-semibold">{rubrique}</h2>
              {l.map(([t, x]) => {
                const k = rubrique + t, o = ouvert === k || !!q
                return (
                  <div key={t}>
                    <button className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-nuit-50/50" onClick={() => setOuvert(o && !q ? null : k)}>
                      <span className="flex-1">{t}</span><ChevronDown className={`h-4 w-4 text-nuit-600/60 transition ${o ? 'rotate-180' : ''}`} /></button>
                    {o && <p className="px-4 pb-3 text-sm leading-relaxed text-nuit-600">{x}</p>}
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>
    </>
  )
}
