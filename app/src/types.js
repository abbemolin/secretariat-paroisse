// Définition des dossiers de sacrements : étapes, informations, documents.
// Modifier ce fichier suffit pour ajouter une étape, un champ ou un document.
// Les clés des champs reçus des formulaires du site doivent rester identiques.

const T = (cle, label, type = 'texte', extra = {}) => ({ cle, label, type, ...extra })

const CELEBRATION = (lieu = 'Église') => [
  T('celebrant', 'Célébrant'),
  T('lieu_celebration', lieu),
  T('commune_celebration', 'Commune'),
  T('diocese_celebration', 'Diocèse')
]
const REGISTRE = { titre: 'Registre', champs: [T('registre_annee', 'Année du registre'), T('acte_numero', 'Acte n°')] }
const MESSAGE = { titre: 'Message de la demande', champs: [T('message', 'Message', 'paragraphe')] }


const HORS_PAROISSE = (i) => !!i?.preparation && i.preparation !== 'Paroisse'
const PREPARATION = ['', 'Paroisse', 'Herrade de Landsberg', 'Saints Louis et Zélie Martin', 'Autre école']
const PREPARATION_PF = ['', 'Paroisse', 'Saints Louis et Zélie Martin', 'Autre école']
const sectionsEnfant = (choixPrep, classe) => [
  { titre: 'Enfant', champs: [T('enfant_prenoms', 'Prénoms'), T('enfant_nom', 'Nom'), T('enfant_naissance_date', 'Né(e) le', 'date'), T('enfant_naissance_lieu', 'À'), T('classe', classe)] },
  { titre: 'Préparation', champs: [T('preparation', 'Lieu de préparation', 'choix', { choix: choixPrep }), T('ecole_autre', 'Nom de l\'école (si autre école)'), T('annee_scolaire', 'Année scolaire de la célébration', 'anneeScolaire')] },
  { titre: 'Parents', champs: [T('pere_prenom', 'Prénom du père'), T('pere_nom', 'Nom du père'), T('mere_prenom', 'Prénom de la mère'), T('mere_nom_jeune_fille', 'Nom de jeune fille de la mère'),
    T('adresse', 'Adresse'), T('telephone', 'Téléphone', 'tel'), T('email', 'E-mail', 'email')] },
  { titre: 'Baptême de l\'enfant', champs: [T('bapteme_ou', 'Baptisé(e)', 'choix', { choix: ['', 'À la paroisse La Croix glorieuse', 'Dans une autre paroisse'] }), T('bapteme_paroisse', 'Paroisse du baptême'), T('bapteme_date', 'Date du baptême', 'date')] },
  MESSAGE
]

export const TYPES = {
  bapteme: {
    nom: 'Baptême', pluriel: 'Baptêmes', couleur: '#3b6fd6',
    etapes: [
      T('recue', 'Demande reçue'), T('contact', 'Premier contact'), T('preparation', 'Rencontre de préparation'),
      T('date', 'Date fixée'), T('documents', 'Documents reçus'), T('celebration', 'Célébration'), T('registre', 'Inscription au registre')
    ],
    sections: [
      { titre: 'Enfant', champs: [T('enfant_prenoms', 'Prénoms'), T('enfant_nom', 'Nom'), T('sexe', 'Garçon ou fille', 'choix', { choix: ['', 'Garçon', 'Fille'] }), T('enfant_naissance_date', 'Né(e) le', 'date'), T('enfant_naissance_lieu', 'À')] },
      { titre: 'Parents', champs: [T('pere_prenom', 'Prénom du père'), T('pere_nom', 'Nom du père'), T('mere_prenom', 'Prénom de la mère'), T('mere_nom_jeune_fille', 'Nom de jeune fille de la mère'),
        T('adresse', 'Adresse'), T('telephone', 'Téléphone', 'tel'), T('email', 'E-mail', 'email'), T('parents_noms', 'Autres informations sur les parents')] },
      { titre: 'Parrain et marraine', champs: [T('parrain_nom', 'Parrain'), T('parrain_bapteme', 'Baptême / confirmation du parrain (paroisse, date)'), T('marraine_nom', 'Marraine'), T('marraine_bapteme', 'Baptême / confirmation de la marraine (paroisse, date)')] },
      { titre: 'Célébration', champs: [T('date_souhaitee', 'Date souhaitée', 'date'), ...CELEBRATION()] },
      { titre: 'Paroisse du domicile (accord du curé, B15)', champs: [T('commune', 'Commune du domicile'), T('domicile_paroisse', 'Paroisse du domicile'), T('domicile_commune', 'Commune de cette paroisse'), T('domicile_diocese', 'Diocèse'), T('domicile_cure', 'Nom du curé')] },
      REGISTRE,
      { titre: 'Offrande', champs: [T('offrande', 'Montant reçu')] },
      MESSAGE
    ],
    documents: [
      T('cert_parrain', 'Certificat de baptême / confirmation du parrain'),
      T('cert_marraine', 'Certificat de baptême / confirmation de la marraine'),
      T('autorisation', 'Autorisation de la paroisse (si hors paroisse)'),
      T('offrande', 'Offrande / participation')
    ],
    generer: ['B14', 'B15'],
    accord: true,   // « Envoyer le formulaire » (accord du curé du domicile)
    reponses: ['accuse_bapteme', 'document_manquant']
  },

  // Famille de la paroisse qui fait baptiser son enfant ailleurs : le curé signe l'accord (Form. B 15)
  bapteme_ailleurs: {
    nom: 'Baptême dans une autre paroisse', pluriel: 'Baptêmes ailleurs', couleur: '#7d9bd9',
    etapes: [T('recue', 'Demande reçue'), T('formulaire', 'Formulaire rempli'), T('accord', 'Accord signé'), T('envoye', 'Accord envoyé à la famille')],
    sections: [
      { titre: 'Enfant', champs: [T('enfant_prenoms', 'Prénoms'), T('enfant_nom', 'Nom'), T('sexe', 'Garçon ou fille', 'choix', { choix: ['', 'Garçon', 'Fille'] }), T('enfant_naissance_date', 'Né(e) le', 'date'), T('enfant_naissance_lieu', 'À')] },
      { titre: 'Parents', champs: [T('pere_prenom', 'Prénom du père'), T('pere_nom', 'Nom du père'), T('mere_prenom', 'Prénom de la mère'), T('mere_nom_jeune_fille', 'Nom de jeune fille de la mère'),
        T('adresse', 'Adresse'), T('commune', 'Commune'), T('telephone', 'Téléphone', 'tel'), T('email', 'E-mail', 'email')] },
      { titre: 'Baptême prévu', champs: [T('paroisse_bapteme', 'Paroisse du baptême'), T('commune_bapteme', 'Commune'), T('diocese_bapteme', 'Diocèse'), T('cure_bapteme', 'Curé de cette paroisse'), T('date_souhaitee', 'Date prévue', 'date')] },
      MESSAGE
    ],
    documents: [],
    generer: ['B15'],
    accord: true,
    reponses: []
  },

  premiere_communion: {
    nom: 'Première communion', pluriel: 'Premières communions', couleur: '#2f8f83', collectif: true, rdvCure: true,
    etapes: [
      T('inscription', 'Inscription reçue'), T('certificat', 'Certificat de baptême reçu'),
      T('validation', 'Validation du curé (préparation hors paroisse)', 'texte', { si: HORS_PAROISSE }),
      T('rdv_cure', 'Rendez-vous avec le curé'),
      T('confession', 'Première confession'), T('retraite', 'Retraite'), T('celebration', 'Célébration'), T('registre', 'Inscription au registre')
    ],
    sections: sectionsEnfant(PREPARATION, 'Classe'),
    documents: [T('cert_bapteme', 'Certificat de baptême'), T('autorisation_image', 'Autorisation parentale / droit à l\'image'),
      T('participation', 'Participation financière'), T('attestation_ecole', 'Attestation de l\'école', 'texte', { si: HORS_PAROISSE })],
    generer: [],
    reponses: ['document_manquant']
  },

  profession_foi: {
    nom: 'Profession de foi', pluriel: 'Professions de foi', couleur: '#7a5cc2', collectif: true,
    etapes: [
      T('inscription', 'Inscription reçue'), T('certificat', 'Certificat de baptême reçu'),
      T('validation', 'Validation du curé (préparation hors paroisse)', 'texte', { si: HORS_PAROISSE }),
      T('retraite', 'Retraite'), T('celebration', 'Célébration'), T('registre', 'Inscription au registre')
    ],
    note: 'La profession de foi se fait en 3e.',
    sections: sectionsEnfant(PREPARATION_PF, 'Classe (la profession de foi se fait en 3e)'),
    documents: [T('cert_bapteme', 'Certificat de baptême'), T('participation', 'Participation financière'),
      T('attestation_ecole', 'Attestation de l\'école', 'texte', { si: HORS_PAROISSE })],
    generer: [],
    reponses: ['document_manquant']
  },

  confirmation_jeune: {
    nom: 'Confirmation (jeunes)', pluriel: 'Confirmations jeunes', couleur: '#b5532f', collectif: true,
    etapes: [
      T('inscription', 'Inscription reçue'), T('certificat', 'Certificat de baptême reçu'), T('lettre', "Lettre à l'évêque"),
      T('retraite', 'Retraite'), T('celebration', 'Confirmation'), T('registre', 'Inscription au registre'),
      T('notification', 'Notification à la paroisse de baptême')
    ],
    sections: [
      { titre: 'Jeune', champs: [T('enfant_prenoms', 'Prénoms'), T('enfant_nom', 'Nom'), T('enfant_naissance_date', 'Né(e) le', 'date'), T('enfant_naissance_lieu', 'À'), T('classe', 'Classe')] },
      { titre: 'Préparation', champs: [T('annee_scolaire', 'Année scolaire de la confirmation', 'anneeScolaire')] },
      { titre: 'Parents', champs: [T('pere_prenom', 'Prénom du père'), T('pere_nom', 'Nom du père'), T('mere_prenom', 'Prénom de la mère'), T('mere_nom_jeune_fille', 'Nom de jeune fille de la mère'),
        T('adresse', 'Adresse'), T('telephone', 'Téléphone', 'tel'), T('email', 'E-mail', 'email')] },
      { titre: 'Baptême', champs: [T('bapteme_paroisse', 'Paroisse du baptême'), T('bapteme_date', 'Date du baptême', 'date')] },
      { titre: 'Parrain / marraine de confirmation', champs: [T('parrain_marraine', 'Nom'), T('parrain_contact', 'Coordonnées')] },
      { titre: 'Confirmation', champs: [T('celebrant', 'Célébrant (évêque ou délégué)'), T('lieu_celebration', 'Lieu'), T('registre_annee', 'Année du registre'), T('acte_numero', 'Acte n°')] },
      MESSAGE
    ],
    documents: [T('cert_bapteme', 'Certificat de baptême'), T('lettre_eveque', "Lettre à l'évêque"), T('cert_parrain', 'Certificat du parrain / de la marraine')],
    generer: [],
    actions: ['notifier_paroisse_bapteme'],
    reponses: ['document_manquant']
  },

  mariage: {
    nom: 'Mariage', pluriel: 'Mariages', couleur: '#c2577a',
    etapes: [
      T('recue', 'Demande reçue'), T('rdv', 'Premier rendez-vous avec le prêtre'), T('preparation', 'Préparation (CPM / sessions)'),
      T('canonique', 'Dossier canonique'), T('bans', 'Publication des bans'), T('celebration', 'Célébration'),
      T('registre', 'Inscription au registre'), T('notifications', 'Notifications aux paroisses de baptême')
    ],
    sections: [
      { titre: 'Fiancée', champs: [T('fiancee_prenoms', 'Prénoms'), T('fiancee_nom', 'Nom'), T('fiancee_naissance_date', 'Née le', 'date'), T('fiancee_bapteme', 'Baptême (paroisse, date)')] },
      { titre: 'Fiancé', champs: [T('fiance_prenoms', 'Prénoms'), T('fiance_nom', 'Nom'), T('fiance_naissance_date', 'Né le', 'date'), T('fiance_bapteme', 'Baptême (paroisse, date)')] },
      { titre: 'Contact', champs: [T('telephone', 'Téléphone', 'tel'), T('email', 'E-mail', 'email'), T('adresse', 'Adresse')] },
      { titre: 'Célébration', champs: [T('date_souhaitee', 'Date souhaitée', 'date'), T('celebrant', 'Célébrant'), T('lieu_celebration', 'Église')] },
      { titre: 'Témoins', champs: [T('temoins', 'Témoins', 'paragraphe')] },
      { titre: 'Mariage civil', champs: [T('civil_date', 'Date', 'date'), T('civil_mairie', 'Mairie')] },
      REGISTRE,
      MESSAGE
    ],
    documents: [
      T('bapteme_fiancee', 'Acte de baptême récent – fiancée'), T('bapteme_fiance', 'Acte de baptême récent – fiancé'),
      T('intention_fiancee', "Déclaration d'intention – fiancée"), T('intention_fiance', "Déclaration d'intention – fiancé"),
      T('civil', 'Certificat de mariage civil')
    ],
    generer: [],
    actions: ['notifier_paroisses'],
    reponses: ['accuse_mariage', 'document_manquant']
  },

  obseques: {
    nom: 'Obsèques', pluriel: 'Obsèques', couleur: '#6b7280',
    etapes: [
      T('appel', 'Appel (pompes funèbres ou famille)'), T('date', 'Date fixée'), T('rencontre', 'Rencontre avec la famille'),
      T('celebration', 'Célébration'), T('registre', 'Inscription au registre')
    ],
    sections: [
      { titre: 'Défunt', champs: [T('defunt_prenoms', 'Prénoms'), T('defunt_nom', 'Nom'), T('defunt_naissance_date', 'Né(e) le', 'date'),
        T('defunt_deces_date', 'Décédé(e) le', 'date'), T('defunt_adresse', 'Domicile'), T('defunt_etat_civil', 'État civil (époux de, veuve de…)')] },
      { titre: 'Famille et pompes funèbres', champs: [T('famille_contact', 'Contact de la famille'), T('telephone', 'Téléphone', 'tel'), T('email', 'E-mail', 'email'), T('pompes_funebres', 'Pompes funèbres')] },
      { titre: 'Célébration', champs: [T('celebrant', 'Célébrant'), T('lieu_celebration', 'Église'), T('sepulture', 'Sépulture', 'choix', { choix: ['', 'Inhumation', 'Crémation'] }), T('cimetiere', 'Cimetière / lieu')] },
      { titre: 'Offrande / casuel', champs: [T('offrande', 'Montant reçu')] },
      REGISTRE
    ],
    documents: [],
    generer: ['sepulture'],
    actions: ['intention_messe'],
    reponses: []
  },

  catechumene: {
    nom: 'Catéchumène adulte', pluriel: 'Catéchumènes', couleur: '#c17f3e', rencontres: true,
    etapes: [
      T('accueil', 'Premier accueil'), T('accompagnateur', 'Accompagnateur désigné'), T('entree', 'Entrée en catéchuménat'),
      T('lettre', "Lettre à l'évêque"), T('appel', 'Appel décisif'), T('scrutins', 'Scrutins'),
      T('sacrements', 'Baptême, confirmation, eucharistie'), T('registre', 'Inscription au registre')
    ],
    sections: [
      { titre: 'Identité', champs: [T('prenoms', 'Prénoms'), T('nom', 'Nom'), T('sexe', 'Homme ou femme', 'choix', { choix: ['', 'Homme', 'Femme'] }), T('nom_jeune_fille', 'Nom de jeune fille'), T('naissance_date', 'Né(e) le', 'date'),
        T('naissance_lieu', 'À'), T('adresse', 'Domicilié(e) à'), T('nationalite', 'Nationalité'), T('profession', 'Profession'),
        T('telephone', 'Téléphone', 'tel'), T('email', 'E-mail', 'email')] },
      { titre: 'Parents', champs: [T('pere_prenom', 'Prénom du père'), T('pere_nom', 'Nom du père'), T('mere_prenom', 'Prénom de la mère'), T('mere_nom_jeune_fille', 'Nom de jeune fille de la mère')] },
      { titre: 'Situation familiale', champs: [T('situation', 'Situation', 'choix', { choix: ['', 'Célibataire', 'Marié(e)', 'Pacsé(e)', 'Vie maritale', 'Divorcé(e)', 'Veuf / veuve'] }),
        T('conjoint', 'Époux / épouse de'), T('conjoint_baptise', 'Conjoint baptisé ?'), T('enfants', 'Enfants')] },
      { titre: 'Parcours', champs: [T('religion_origine', "Religion d'origine"), T('motivations', 'Motivations', 'paragraphe'), T('accompagnateurs', 'Accompagnateurs'),
        T('disponibilite', 'Disponibilités'), T('en_attente', 'En attente (année non fixée)', 'choix', { choix: ['', 'oui'] }), T('remarques', 'Remarques', 'paragraphe')] },
      { titre: 'Service diocésain du catéchuménat', champs: [T('diocese_inscription', 'Inscrit(e) en ligne', 'choix', { choix: ['', 'oui', 'non'] }), T('diocese_mail', 'Mail envoyé au service', 'choix', { choix: ['', 'oui', 'non'] })] },
      { titre: 'Prénom de baptême', champs: [T('prenom_bapteme', 'Prénom de baptême (facultatif)')] },
      { titre: 'Parrain / marraine', champs: [T('parrain_marraine', 'Nom'), T('parrain_contact', 'Coordonnées')] },
      { titre: 'Entrée en catéchuménat (B6)', champs: [T('entree_date', "Date de l'accueil", 'date'), T('entree_ministre', 'Prêtre ou diacre'),
        T('service_diocesain', 'Membres du service diocésain présents', 'paragraphe'), T('b6_annee', 'Année (registre diocésain)'), T('b6_acte', 'Acte n° (B6)')] },
      { titre: 'Baptême', champs: [...CELEBRATION(), T('registre_annee', 'Année du registre des baptêmes'), T('acte_numero', 'Acte n°'),
        T('marie_religieusement_le', 'Marié(e) religieusement le', 'date'), T('marie_religieusement_a', 'À')] },
      MESSAGE
    ],
    documents: [T('acte_naissance', 'Acte de naissance'), T('lettre_eveque', "Lettre à l'évêque"), T('cert_parrain', 'Certificat du parrain / de la marraine'), T('photo', "Photo d'identité")],
    generer: ['B6', 'B14'],
    reponses: ['document_manquant']
  },

  confirmand: {
    nom: 'Confirmand adulte', pluriel: 'Confirmands', couleur: '#d1495b', rencontres: true,
    etapes: [
      T('accueil', 'Accueil'), T('parcours', 'Parcours de préparation'),
      T('profession_foi', 'Profession de foi (venant d\'une autre confession chrétienne)', 'texte', { optionnel: (i) => i?.autre_confession !== 'oui' }),
      T('lettre', "Lettre à l'évêque"), T('retraite', 'Retraite'), T('confirmation', 'Confirmation'),
      T('registre', 'Inscription au registre'), T('notification', 'Notification à la paroisse de baptême')
    ],
    sections: [
      { titre: 'Identité', champs: [T('prenoms', 'Prénoms'), T('nom', 'Nom'), T('naissance_date', 'Né(e) le', 'date'), T('naissance_lieu', 'À'),
        T('adresse', 'Adresse'), T('telephone', 'Téléphone', 'tel'), T('email', 'E-mail', 'email')] },
      { titre: 'Parents', champs: [T('pere', 'Père (prénom et nom)'), T('mere', 'Mère (prénom et nom)')] },
      { titre: 'Baptême', champs: [T('bapteme_paroisse', 'Paroisse / lieu du baptême'), T('bapteme_date', 'Date du baptême', 'date'),
        T('premiere_communion', 'Première communion'), T('autre_confession', 'Baptisé(e) dans une autre confession', 'choix', { choix: ['', 'oui'] }), T('confession_origine', "Confession d'origine (si autre confession chrétienne)")] },
      { titre: 'Parrain / marraine', champs: [T('parrain_marraine', 'Nom'), T('parrain_contact', 'Coordonnées')] },
      { titre: 'Confirmation', champs: [T('celebrant', 'Célébrant'), T('lieu_celebration', 'Lieu'), T('registre_annee', 'Année du registre'), T('acte_numero', 'Acte n°')] },
      MESSAGE
    ],
    documents: [T('cert_bapteme', 'Certificat de baptême'), T('lettre_eveque', "Lettre à l'évêque"), T('cert_parrain', 'Certificat du parrain / de la marraine'), T('photo', "Photo d'identité")],
    generer: [],
    actions: ['notifier_paroisse_bapteme'],
    reponses: ['document_manquant']
  }
}

export const ORDRE_TYPES = ['bapteme', 'bapteme_ailleurs', 'premiere_communion', 'profession_foi', 'confirmation_jeune', 'mariage', 'obseques', 'catechumene', 'confirmand']

/** Types suivis par « promotion » (année de réception des sacrements). */
export const PAR_ANNEE = ['catechumene', 'confirmand', 'premiere_communion', 'profession_foi', 'confirmation_jeune']
export const anneeSacrements = (d) => String(d.annee || d.infos?.annee_sacrements || d.infos?.annee_scolaire || (!TYPES[d.type]?.collectif && d.date_celebration ? new Date(d.date_celebration).getFullYear() : ''))
export const libelleAnnee = (type) => ({ confirmand: 'Confirmations ', catechumene: 'Sacrements ', premiere_communion: 'Année ', profession_foi: 'Année ', confirmation_jeune: 'Année ' })[type] || ''
export const choixAnnees = () => { const a = new Date().getFullYear(); return Array.from({ length: 7 }, (_, i) => String(a - 2 + i)) }

/** Signalements calculés par le serveur (liste et dossier). */
export const ALERTES = {
  bapteme_a_trouver: { nom: 'Baptême à trouver', classe: 'bg-amber-100 text-amber-900' },
  autre_confession: { nom: 'Autre confession', classe: 'bg-violet-100 text-violet-900' },
  mineur: { nom: 'Mineur', classe: 'bg-sky-100 text-sky-900' },
  en_attente: { nom: 'En attente', classe: 'bg-slate-200 text-slate-800' }
}

export const ETATS = { ouvert: 'En cours', clos: 'Clos', annule: 'Annulé' }

/** L'élément (étape, document) s'applique-t-il à ce dossier ? (ex. validation du curé seulement hors paroisse) */
export const applicable = (item, infos) => !item.si || item.si(infos || {})
export const etapesDe = (type, infos) => (TYPES[type]?.etapes || []).filter((e) => applicable(e, infos))
export const documentsDe = (type, infos) => (TYPES[type]?.documents || []).filter((d) => applicable(d, infos))

/** Prochaine étape non franchie (hors étapes facultatives). infos : au moins { preparation }. */
/** Étape facultative ? (peut dépendre du dossier, ex. profession de foi si baptisé dans une autre confession) */
export const estOptionnel = (e, infos) => (typeof e.optionnel === 'function' ? e.optionnel(infos || {}) : !!e.optionnel)
export function prochaineEtape(type, faites, infos) {
  return etapesDe(type, infos).find((e) => !estOptionnel(e, infos) && !faites.includes(e.cle))
}

export function documentsManquants(type, recus, infos) {
  return documentsDe(type, infos).filter((d) => !recus.includes(d.cle))
}

export const TITRES_COLLECTIFS = { premiere_communion: 'Premières communions', profession_foi: 'Professions de foi', confirmation_jeune: 'Confirmations' }
export const anneeScolaireActuelle = () => { const d = new Date(); const a = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return `${a}-${a + 1}` }
export const choixAnneesScolaires = () => { const a = Number(anneeScolaireActuelle().slice(0, 4)); return Array.from({ length: 5 }, (_, i) => `${a - 1 + i}-${a + i}`) }
export const lieuPreparation = (i) => (i?.preparation === 'Autre école' ? i.ecole_autre || 'Autre école' : i?.preparation || '')

/** Remplit une réponse type avec les informations d'un dossier. */
export function remplirModele(texte, ctx = {}) {
  return String(texte || '').replace(/\{(\w+)\}/g, (m, k) => (ctx[k] !== undefined ? ctx[k] : m))
}
