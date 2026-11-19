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

export const TYPES = {
  bapteme: {
    nom: 'Baptême', pluriel: 'Baptêmes', couleur: '#3b6fd6',
    etapes: [
      T('recue', 'Demande reçue'), T('contact', 'Premier contact'), T('preparation', 'Rencontre de préparation'),
      T('date', 'Date fixée'), T('documents', 'Documents reçus'), T('celebration', 'Célébration'), T('registre', 'Inscription au registre')
    ],
    sections: [
      { titre: 'Enfant', champs: [T('enfant_prenoms', 'Prénoms'), T('enfant_nom', 'Nom'), T('enfant_naissance_date', 'Né(e) le', 'date'), T('enfant_naissance_lieu', 'À')] },
      { titre: 'Parents', champs: [T('parents_noms', 'Noms des parents'), T('adresse', 'Adresse'), T('telephone', 'Téléphone', 'tel'), T('email', 'E-mail', 'email')] },
      { titre: 'Parrain et marraine', champs: [T('parrain_nom', 'Parrain'), T('parrain_bapteme', 'Baptême / confirmation du parrain (paroisse, date)'), T('marraine_nom', 'Marraine'), T('marraine_bapteme', 'Baptême / confirmation de la marraine (paroisse, date)')] },
      { titre: 'Célébration', champs: [T('date_souhaitee', 'Date souhaitée', 'date'), ...CELEBRATION()] },
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
    generer: ['B14'],
    reponses: ['accuse_bapteme', 'document_manquant']
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
    nom: 'Catéchumène adulte', pluriel: 'Catéchumènes', couleur: '#b08a3e', rencontres: true,
    etapes: [
      T('accueil', 'Premier accueil'), T('accompagnateur', 'Accompagnateur désigné'), T('entree', 'Entrée en catéchuménat'),
      T('lettre', "Lettre à l'évêque"), T('appel', 'Appel décisif'), T('scrutins', 'Scrutins'),
      T('sacrements', 'Baptême, confirmation, eucharistie'), T('registre', 'Inscription au registre')
    ],
    sections: [
      { titre: 'Identité', champs: [T('prenoms', 'Prénoms'), T('nom', 'Nom'), T('nom_jeune_fille', 'Nom de jeune fille'), T('naissance_date', 'Né(e) le', 'date'),
        T('naissance_lieu', 'À'), T('adresse', 'Domicilié(e) à'), T('nationalite', 'Nationalité'), T('profession', 'Profession'),
        T('telephone', 'Téléphone', 'tel'), T('email', 'E-mail', 'email')] },
      { titre: 'Situation familiale', champs: [T('situation', 'Situation', 'choix', { choix: ['', 'Célibataire', 'Marié(e)', 'Pacsé(e)', 'Vie maritale', 'Divorcé(e)', 'Veuf / veuve'] }),
        T('conjoint', 'Époux / épouse de'), T('conjoint_baptise', 'Conjoint baptisé ?'), T('enfants', 'Enfants')] },
      { titre: 'Parcours', champs: [T('religion_origine', "Religion d'origine"), T('motivations', 'Motivations', 'paragraphe'), T('accompagnateurs', 'Accompagnateurs')] },
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
      T('profession_foi', 'Profession de foi (venant d\'une autre confession chrétienne)', 'texte', { optionnel: true }),
      T('lettre', "Lettre à l'évêque"), T('retraite', 'Retraite'), T('confirmation', 'Confirmation'),
      T('registre', 'Inscription au registre'), T('notification', 'Notification à la paroisse de baptême')
    ],
    sections: [
      { titre: 'Identité', champs: [T('prenoms', 'Prénoms'), T('nom', 'Nom'), T('naissance_date', 'Né(e) le', 'date'), T('naissance_lieu', 'À'),
        T('adresse', 'Adresse'), T('telephone', 'Téléphone', 'tel'), T('email', 'E-mail', 'email')] },
      { titre: 'Baptême', champs: [T('bapteme_paroisse', 'Paroisse du baptême'), T('bapteme_date', 'Date du baptême', 'date'),
        T('premiere_communion', 'Première communion'), T('confession_origine', "Confession d'origine (si autre confession chrétienne)")] },
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

export const ORDRE_TYPES = ['bapteme', 'mariage', 'obseques', 'catechumene', 'confirmand']

export const ETATS = { ouvert: 'En cours', clos: 'Clos', annule: 'Annulé' }

/** Prochaine étape non franchie (hors étapes optionnelles). */
export function prochaineEtape(type, faites) {
  return TYPES[type]?.etapes.find((e) => !e.optionnel && !faites.includes(e.cle))
}

export function documentsManquants(type, recus) {
  return (TYPES[type]?.documents || []).filter((d) => !recus.includes(d.cle))
}

/** Remplit une réponse type avec les informations d'un dossier. */
export function remplirModele(texte, ctx = {}) {
  return String(texte || '').replace(/\{(\w+)\}/g, (m, k) => (ctx[k] !== undefined ? ctx[k] : m))
}
