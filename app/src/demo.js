// Mode démonstration (?demo dans l'adresse) : données fictives en mémoire, rien n'est envoyé.
const jour = (d, h = 0, m = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString() }
import { accesDuRole, SORTES_ACCES } from './acces.js'

const TRI_DEMO = [{"cle":"extrait","nom":"Extrait de baptême","action":"extrait","type":"","mots":["extrait de bapteme","extrait d'acte de bapteme","acte de bapteme","certificat de bapteme","attestation de bapteme","preuve de bapteme","extrait baptistaire"]},{"cle":"intention","nom":"Intention de messe","action":"appmesse","type":"","mots":["intention de messe","intentions de messe","faire dire une messe","faire celebrer une messe","demander une messe","messe a l'intention","messe pour le repos","offrande de messe"]},{"cle":"obseques","nom":"Obsèques","action":"dossier","type":"obseques","mots":["obseques","enterrement","funerailles","pompes funebres","inhumation","deces","decede*"]},{"cle":"premiere_communion","nom":"Première communion","action":"dossier","type":"premiere_communion","mots":["premiere communion","1ere communion","1re communion"]},{"cle":"profession_foi","nom":"Profession de foi","action":"dossier","type":"profession_foi","mots":["profession de foi"]},{"cle":"confirmand","nom":"Confirmation","action":"dossier","type":"confirmand","mots":["sacrement de confirmation","preparation a la confirmation","recevoir la confirmation","etre confirme*","me faire confirmer","se faire confirmer","faire confirmer"]},{"cle":"catechumene","nom":"Catéchuménat","action":"dossier","type":"catechumene","mots":["catechumenat","catechumene","devenir chretien*","me faire baptiser","bapteme adulte","bapteme d'adulte","bapteme des adultes"]},{"cle":"mariage","nom":"Mariage","action":"dossier","type":"mariage","mots":["mariage","se marier","nous marier","marier a l'eglise","fiance*"]},{"cle":"bapteme","nom":"Baptême","action":"dossier","type":"bapteme","mots":["bapteme","baptis*"]},{"cle":"rendezvous","nom":"Rendez-vous","action":"rendezvous","type":"","mots":["rendez-vous","rendez vous","rdv","vous rencontrer","un entretien","vous voir","rencontrer un pretre","parler a un pretre","rencontrer monsieur le cure","rencontrer le cure"]},{"cle":"horaires","nom":"Horaires","action":"horaires","type":"","mots":["horaire*","a quelle heure","heure de la messe","heure des messes","heures des messes","heures de messe*","y a-t-il une messe","y a t il une messe","est-ce qu'il y a une messe","quand est la messe","heure des confessions","permanence*"]}]

const GROUPES_DEMO = ['Maternelle-CP', 'CE1-CE2', 'CM1-CM2', '6e-5e', '4e-3e', 'Lycéens']
const ins = (id, prenoms, nom, classe, groupe, email, extra = {}) => ({ id, annee: '2026-2027', cree_le: '2026-06-' + (10 + id.length) + 'T18:00:00Z', source: 'Formulaire', prenoms, nom, classe, groupe, email, telephone: '06 00 00 00 ' + id.slice(1).padStart(2, '0'), naissance: '', adresse: 'Strasbourg', pere: nom + ' Pierre', mere: 'Martin Claire', sacrement: '', demandes: [], bapteme: {}, manuels: [], cotisation: 30, paiements: [], notes: '', ...extra })
const cor = (id, prenoms, nom, equipe_id, extra = {}) => ({ id, annee: '2026-2027', prenoms, nom, email: cleDemo(nom) + '@example.fr', telephone: '06 11 22 33 ' + id.slice(1).padStart(2, '0'), adresse: 'Strasbourg', profils: ['Paroissien'], situation: 'Marié(e)', deja_participe: 'Oui', rester: 'Oui', chef_indique: '', chef_possible: false, souhait: '', groupe_service: 'Non', equipe_id, equipe_proposee: '', statut: 'actif', note: '', dossiers: [], ...extra })
function cleDemo(t) { return String(t).toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') }
const etat = {
  annoncesNl: [
    { id: 1, titre: 'Retraite de l\'Avent', description: 'Samedi 5 décembre, de 9 h à 16 h, à la crypte. Inscription au secrétariat.', event_date: '2026-12-05', event_heure: '09:00:00', date_debut: null, date_fin: '2026-12-05', image_url: '', lien: 'https://www.croix-glorieuse.org', lien_label: 'S\'inscrire', prioritaire: true, actif: true, dans_newsletter: true, dans_feuille: true, ordre: 0, created_at: '2026-11-20T10:00:00Z' },
    { id: 2, titre: 'Confessions avant Noël', description: 'Horaires élargis à partir du 14 décembre.', event_date: null, event_heure: null, date_debut: null, date_fin: null, image_url: '', lien: '', lien_label: '', prioritaire: false, actif: true, dans_newsletter: true, dans_feuille: false, ordre: 1, created_at: '2026-11-18T10:00:00Z' },
    { id: 3, titre: 'Quête pour le chauffage', description: 'Merci de votre générosité.', event_date: null, event_heure: null, date_debut: null, date_fin: null, image_url: '', lien: '', lien_label: '', prioritaire: false, actif: false, dans_newsletter: false, dans_feuille: true, ordre: 2, created_at: '2026-11-10T10:00:00Z' }
  ],
  nlSemaines: {}, nlBrouillons: {}, nlCampagne: null,
  retraites: [
    { id: 'r1', annee: '2026-2027', type: 'premiere_communion', titre: '', date_debut: '2027-05-15', date_fin: '2027-05-16', heure_debut: '09:30', heure_fin: '16:00', lieu: 'Mont Sainte-Odile', adresse: '67530 Ottrott',
      prix: [{ id: 'a', libelle: 'Repas (3)', montant: 30, obligatoire: true }, { id: 'b', libelle: 'Nuit au Mont (chambre partagée)', montant: 25, obligatoire: false }], ceremonie_suggestion: '15', ceremonie_texte: 'Cierge, fleurs, livret de la célébration',
      paiement_texte: 'Chèque à l\'ordre de « Paroisse La Croix glorieuse », à remettre au secrétariat.', programme: 'Samedi 9h30 : accueil\nDimanche 16h : messe avec les familles', apporter: 'Sac de couchage, Bible, tenue chaude', responsable_nom: 'Abbé Le Gall', responsable_tel: '06 12 34 56 78', date_limite: '2027-05-01', ouverte: 'oui', jeton: 'a'.repeat(32),
      inscriptions: [
        { id: 'i1', jeton: 'c'.repeat(32), statut: 'inscrit', cree_le: '2026-11-18T10:00:00Z', maj_le: '2026-11-18T10:00:00Z', contact_nom: 'Paul Martin', contact_email: 'paul.martin@example.fr', contact_tel: '06 11 22 33 44', participants: [{ prenoms: 'Léon', nom: 'Martin', classe: 'CM1', allergies: 'Arachide', image: 'oui', options: ['b'], dossier_id: 'd5' }, { prenoms: 'Zoé', nom: 'Martin', classe: 'CE2', allergies: '', image: 'non', options: [] }], ceremonie: 15, urgence_nom: 'Mamie Martin', urgence_tel: '06 99 88 77 66', autorisation: 'oui – Paul Martin – 2026-11-18', covoiturage: '', covoit_places: '', remarque: '', paiements: [{ id: 'p1', date: '2026-11-19', montant: 50, mode: 'Chèque', par: 'Bertille Bauer' }], source: 'Lien personnel' },
        { id: 'i2', jeton: 'd'.repeat(32), statut: 'inscrit', cree_le: '2026-11-19T18:00:00Z', maj_le: '2026-11-19T18:00:00Z', contact_nom: 'Claire Weber', contact_email: 'claire.w@example.fr', contact_tel: '06 55 44 33 22', participants: [{ prenoms: 'Hugo', nom: 'Weber', classe: 'CM1', allergies: '', image: 'oui', options: [] }], ceremonie: 10, urgence_nom: 'Marc Weber', urgence_tel: '06 10 20 30 40', autorisation: 'oui – Claire Weber – 2026-11-19', covoiturage: '', covoit_places: '', remarque: '', paiements: [], source: 'Lien public' }] },
    { id: 'r2', annee: '2026-2027', type: 'confirmation_adultes', titre: '', date_debut: '2027-03-06', date_fin: '2027-03-07', heure_debut: '09:00', heure_fin: '17:00', lieu: 'Abbaye de Marienthal', adresse: '', prix: [{ id: 'a', libelle: 'Pension complète', montant: 60, obligatoire: true }], ceremonie_suggestion: '20', ceremonie_texte: 'Cierge et fleurs', paiement_texte: 'Virement : IBAN FR76…', programme: '', apporter: '', responsable_nom: 'Abbé Molin', responsable_tel: '', date_limite: '2027-02-20', ouverte: 'oui', jeton: 'b'.repeat(32),
      inscriptions: [{ id: 'i3', jeton: 'e'.repeat(32), statut: 'inscrit', cree_le: '2026-11-20T09:00:00Z', maj_le: '2026-11-20T09:00:00Z', contact_nom: 'Léa Fischer', contact_email: 'fischer@example.fr', contact_tel: '06 11 22 33 06', participants: [{ prenoms: 'Léa', nom: 'Fischer', allergies: 'Végétarienne', options: [], dossier_id: 'd7' }], ceremonie: 20, urgence_nom: '', urgence_tel: '', autorisation: '', covoiturage: 'propose', covoit_places: '3', remarque: '', paiements: [], source: 'Lien personnel' }] }
  ],
  cor: {
    fils: { q1: { messages: [{ id: 'x1', date: '2026-11-18T19:02:00Z', auteur: 'Claire et Antoine Martin', cote: 'chef', texte: 'Bonjour Monsieur le Curé, pourriez-vous venir bénir notre prochaine rencontre du 4 décembre ? Merci !' }], rencontres: [{ id: 'r1', date: '2026-12-04', lieu: 'Chez les Martin, 5 rue des Juifs', note: 'Repas partagé' }, { id: 'r2', date: '2026-11-06', lieu: 'Chez Inès', note: '' }] } },
    reglages: { feuilles: [{ id: '1KbA5BV_qx7_nC_4G76fjN7TujtjabmLsVy8hHq1xafE', annee: '2026-2027', nom: 'Fraternité Cor Unum 2026-2027 (Strasbourg) (réponses)', onglets_repris: true }], lien_formulaire: 'https://forms.gle/exemple', import_auto: true, profils: ['Catéchumène', 'Confirmand', 'Néophyte', 'Nouveau à la paroisse', 'Recommençant', 'Paroissien'] },
    equipes: { '2026-2027': [{ id: 'q1', nom: 'Martin', chefs: ['c1'] }, { id: 'q2', nom: 'Lefèvre', chefs: ['c5'] }, { id: 'q3', nom: 'Roussel', chefs: ['c9'] }] },
    membres: [
      cor('c1', 'Claire et Antoine', 'Martin', 'q1', { chef_possible: true }),
      cor('c2', 'Sarah', 'Kessler', 'q1', { profils: ['Catéchumène'], situation: 'Célibataire', dossiers: [{ id: 'd2', type: 'catechumene', nom: 'Sarah KESSLER' }] }),
      cor('c3', 'Hugo', 'Bernard', 'q1', { deja_participe: 'Non', rester: '', profils: ['Nouveau à la paroisse'], souhait: 'Claire Martin', situation: 'Célibataire' }),
      cor('c4', 'Inès', 'Fontaine', 'q1', { profils: ['Néophyte'], situation: 'Célibataire' }),
      cor('c5', 'Paul et Marie', 'Lefèvre', 'q2', { chef_possible: true }),
      cor('c6', 'Léa', 'Fischer', 'q2', { profils: ['Confirmand'], situation: 'Célibataire', dossiers: [{ id: 'd7', type: 'confirmand', nom: 'Léa FISCHER' }] }),
      cor('c7', 'Thomas', 'Girard', 'q2', { profils: ['Recommençant', 'Paroissien'] }),
      cor('c8', 'Julie', 'Morel', 'q2', { statut: 'ancien', note: 'A déménagé' }),
      cor('c9', 'Anne et Luc', 'Roussel', 'q3'),
      cor('c10', 'Marc', 'Dubois', 'q3', { deja_participe: 'Non', rester: '' }),
      cor('c11', 'Sophie', 'Lambert', 'q3', { statut: 'ancien' }),
      cor('c12', 'Nicolas', 'Perrin', '', { deja_participe: 'Non', rester: '', souhait: 'Paul Lefèvre', equipe_proposee: 'q2', situation: 'Célibataire' }),
      cor('c13', 'Camille', 'Robert', '', { deja_participe: 'Non', rester: '', profils: ['Catéchumène', 'Nouveau à la paroisse'], situation: 'Célibataire' }),
      cor('c14', 'Élise', 'Garnier', '', { rester: 'Oui', chef_indique: 'Anne Roussel', equipe_proposee: 'q3', chef_possible: true })
    ]
  },
  cate: {
    reglages: { feuilles: [{ id: '1uMceNIzuF2F_S4ANgpaO3_5h4obqVJXlAvD9q8CWLW0', annee: '2026-2027', nom: "Inscription au catéchisme et à l'aumônerie (2026-2027) (réponses)" }], cotisation: 30, import_auto: true,
      ecoles: [{ nom: 'Herrade de Landsberg', email: 'direction@herrade.example' }, { nom: 'Saints Louis et Zélie Martin', email: 'secretariat@slzm.example' }] },
    inscriptions: [
      ins('k1', 'Hugo', 'Weber', 'CE2', 'CE1-CE2', 'julie.weber@example.fr', { sacrement: 'La première communion', demandes: [{ type: 'premiere_communion', dossier_id: 'd9' }], manuels: [{ libelle: 'Livret CE1-CE2 (12 €)', prix: 12, remis: true }], paiements: [{ id: 'p1', date: '2026-09-12', montant: 42, mode: 'Chèque', par: 'Bertille Bauer' }], bapteme: { ou: 'En dehors de la Paroisse personnelle', date: '2018-06-10', lieu: 'Saint-Pierre-le-Jeune' } }),
      ins('k2', 'Juliette', 'Heller', '3e', '4e-3e', 'd.heller@example.fr', { sacrement: 'La Profession de Foi', demandes: [{ type: 'profession_foi', dossier_id: 'd10' }], manuels: [{ libelle: 'Livre de leçons 4e-3e (17 €)', prix: 17, remis: false }] }),
      ins('k3', 'Eowyn', 'Arbogast', '5e', '6e-5e', 'arbogast@example.fr', { manuels: [{ libelle: 'Livre de leçons 6e-5e (17 €)', prix: 17, remis: true }], paiements: [{ id: 'p2', date: '2026-09-20', montant: 20, mode: 'Espèces', par: 'Bertille Bauer' }] }),
      ins('k4', 'Louve', 'Arbogast', 'CE1', 'CE1-CE2', 'arbogast@example.fr', { manuels: [{ libelle: 'Livret CE1-CE2 (12 €)', prix: 12, remis: true }] }),
      ins('k5', 'Sophie', 'Al Ashwal', 'GS', 'Maternelle-CP', 'alashwal@example.fr', { paiements: [{ id: 'p3', date: '2026-09-05', montant: 30, mode: 'Virement', par: 'Bertille Bauer' }] }),
      ins('k6', 'Constance', 'Dagenbach', 'CM2', 'CM1-CM2', 'dagenbach@example.fr', { sacrement: 'Le baptême', demandes: [] }),
      ins('k7', 'Armand', 'du Bourg', '1re', 'Lycéens', 'dubourg@example.fr', { sacrement: 'La confirmation', demandes: [] }),
      ins('k8', 'Etienne', 'Frank', '4e', '4e-3e', 'frank@example.fr', { paiements: [{ id: 'p4', date: '2026-09-15', montant: 47, mode: 'Chèque', par: 'Bertille Bauer' }], manuels: [{ libelle: 'Livre de leçons 4e-3e (17 €)', prix: 17, remis: true }] })
    ]
  },
  tri: { actif: true, envoi_auto: true, desactivees: [], sensibles: ["deces","decede*","obseques","enterrement","funerailles","malade*","maladie","hopital","mourant*","fin de vie","soins palliatifs","onction","sacrement des malades","derniers sacrements","urgent*","urgence","detresse","suicide","abus","agression","plainte"], ignores: ["no-reply","noreply","ne-pas-repondre","nepasrepondre","donotreply","mailer-daemon","postmaster","notification","newsletter","news@","info@mail."], mots: Object.fromEntries(TRI_DEMO.map((c) => [c.cle, c.mots])) },
  reglages: { paroisse: 'Paroisse personnelle La Croix glorieuse', paroisse_courte: 'La Croix glorieuse', diocese: 'Strasbourg', commune: 'Strasbourg', eglise: '', adresse: '2, quai Charles Frey 67000 Strasbourg', site: 'croix-glorieuse.org', url_horaires: 'https://www.croix-glorieuse.org/horaires', url_icones: '', url_rdv_cure: 'https://calendar.app.google/B8m9xbUJEaXQSDQQA', url_rdv_cure_integre: '' },
  utilisateurs: [
    { id: 'u1', identifiant: 'florent', nom: 'abbé Florent Molin', role: 'admin', signature: 'cure', actif: true, derniere_connexion: jour(0, 9) },
    { id: 'u2', identifiant: 'guillaume', nom: 'abbé Guillaume Le Gall', role: 'cure', signature: 'vicaire', actif: true, derniere_connexion: jour(-1, 18) },
    { id: 'u3', identifiant: 'bertille', nom: 'Bertille Bauer', role: 'secretaire', signature: 'secretaire', actif: true, derniere_connexion: jour(0, 8, 30) },
    { id: 'u4', identifiant: 'diacre', nom: 'Jean-Marc Diacre (fictif)', role: 'diacre', signature: 'paroisse', actif: true, derniere_connexion: jour(-3, 20),
      acces: { ...accesDuRole('diacre'), courrier: 'm', courrier_tout: false, extraits: 'l', registres: 'l', documents: 'l', dossiers: { ...accesDuRole('diacre').dossiers, mariage: 'l', obseques: 'l' } } }
  ],
  signatures: [
    { cle: 'cure', nom: 'abbé Florent Molin', fonction: 'Curé', email: 'cure@croix-glorieuse.org', telephone: '06 98 74 02 46' },
    { cle: 'paroisse', nom: 'Paroisse personnelle La Croix glorieuse', fonction: 'Strasbourg', email: 'secretariat@croix-glorieuse.org', telephone: '03 88 36 08 42' },
    { cle: 'secretaire', nom: 'Bertille BAUER', fonction: 'Secrétaire', email: 'secretariat@croix-glorieuse.org', telephone: '03 88 36 08 42' },
    { cle: 'vicaire', nom: 'Abbé Guillaume LE GALL', fonction: 'Vicaire', email: 'secretariat@croix-glorieuse.org', telephone: '03 88 36 08 42' }
  ],
  reponses: [
    { cle: 'accuse_bapteme', titre: 'Accusé de réception – baptême', sujet: 'Votre demande de baptême', corps: "Bonjour,\n\nNous avons bien reçu votre demande de baptême pour {nom} et nous nous en réjouissons avec vous.\n\nNous vous recontacterons prochainement pour convenir d'une rencontre de préparation.\n\nAvec l'assurance de nos prières à toutes vos intentions," },
    { cle: 'accuse_mariage', titre: 'Accusé de réception – mariage', sujet: 'Votre demande de mariage', corps: 'Bonjour,\n\nNous avons bien reçu votre demande de mariage ({nom}) et nous nous en réjouissons avec vous.\n\nAvec l\'assurance de nos prières à toutes vos intentions,' },
    { cle: 'horaires', titre: 'Horaires de la paroisse', sujet: 'Horaires de la paroisse La Croix glorieuse', corps: 'Bonjour,\n\nVous trouverez les horaires, toujours à jour, sur notre site :\n{url_horaires}\n\nAvec l\'assurance de nos prières à toutes vos intentions,' },
    { cle: 'document_manquant', titre: 'Document manquant', sujet: 'Dossier de {type} – document(s) à fournir', corps: 'Bonjour,\n\nPour compléter le dossier de {type} ({nom}), il nous manque encore :\n{documents_manquants}\n\nMerci d\'avance.\n\nAvec l\'assurance de nos prières à toutes vos intentions,' }
  ],
  notifications: [
    { id: 'n1', date: jour(0, 10, 13), titre: 'Nouvelle demande : Baptême', texte: 'Louise WEBER', lien: '#/dossiers/d1', lu: false },
    { id: 'n2', date: jour(0, 9, 2), titre: 'Mail attribué par Bertille Bauer', texte: 'Réservation salle – répétition chorale', lien: '#/courrier?fil=t2', lu: false }
  ],
  fils: [
    { id: 't1', sujet: 'Demande de baptême pour notre fille', de: 'Julie Weber <julie.weber@example.fr>', a: 'secretariat@croix-glorieuse.org', date: jour(0, 10, 12), extrait: 'Bonjour, nous souhaiterions faire baptiser notre fille Louise au printemps…', nonLu: true, nb: 1, important: false, libelles: [], tri: { categories: ['bapteme'], prioritaire: false, auto: false }, suivi: { statut: 'À traiter', attribue_a: 'u3', dossier_id: 'd1' } },
    { id: 't2', sujet: 'Réservation salle – répétition chorale', de: 'Marc Hoffmann <marc.h@example.fr>', a: 'secretariat@croix-glorieuse.org', date: jour(0, 8, 47), extrait: 'Serait-il possible de réserver la salle jeudi soir de 20h à 22h ?', nonLu: true, nb: 2, important: true, libelles: [], suivi: { statut: 'En cours', attribue_a: 'u1', dossier_id: '' } },
    { id: 't3', sujet: 'Obsèques de M. Schmitt', de: 'Pompes funèbres Klein <contact@pf-klein.example>', a: 'secretariat@croix-glorieuse.org', date: jour(-1, 16, 5), extrait: 'Nous vous confirmons la levée du corps samedi à 9h30, cérémonie à 10h…', nonLu: false, nb: 3, important: false, libelles: [], tri: { categories: ['obseques'], prioritaire: true, auto: false }, suivi: { statut: 'Traité', attribue_a: '', dossier_id: 'd3' } },
    { id: 't4', sujet: 'Horaires de Noël', de: 'Claire Muller <claire.m@example.fr>', a: 'secretariat@croix-glorieuse.org', date: jour(0, 7, 58), extrait: 'Bonjour, à quelle heure est la messe de la nuit de Noël ? Merci !', nonLu: false, nb: 2, important: false, libelles: [], tri: { categories: ['horaires'], prioritaire: false, auto: true }, suivi: { statut: 'Traité', attribue_a: '', dossier_id: '' } },
    { id: 't5', sujet: 'Demande d\'extrait de baptême', de: 'Thomas Roth <t.roth@example.fr>', a: 'secretariat@croix-glorieuse.org', date: jour(0, 7, 31), extrait: 'Bonjour, pour mon mariage je dois fournir un extrait de baptême de moins de 6 mois. J\'ai été baptisé en 1996…', nonLu: true, nb: 1, important: false, libelles: [], tri: { categories: ['extrait', 'mariage'], prioritaire: false, auto: false }, suivi: null },
    { id: 't4', sujet: 'Question sur les horaires de Noël', de: 'Anne Muller <anne.m@example.fr>', a: 'secretariat@croix-glorieuse.org', date: jour(-2, 21, 0), extrait: 'Bonjour, à quelle heure est la messe de la nuit de Noël ?', nonLu: false, nb: 1, important: false, libelles: [], suivi: null }
  ],
  commentaires: { t2: [{ id: 'c1', auteur: 'Bertille Bauer', date: jour(0, 9), texte: 'Monsieur le curé, je vous laisse voir avec la chorale ?' }] },
  evenements: [
    { id: 'e1', titre: 'Messe', lieu: 'Église', description: '', journee: false, debut: jour(0, 18, 30), fin: jour(0, 19, 15), recurrent: true, dossier: '' },
    { id: 'e3', titre: 'Répétition chorale', lieu: 'Salle paroissiale', description: '', journee: false, debut: jour(2, 20), fin: jour(2, 22), recurrent: false, dossier: '' },
    { id: 'e5', titre: 'Obsèques', lieu: 'Église', description: '', journee: false, debut: jour(2, 10), fin: jour(2, 11), recurrent: false, dossier: 'd3' },
    { id: 'e6', titre: 'Messe dominicale', lieu: 'Église', description: '', journee: false, debut: jour(4, 10, 30), fin: jour(4, 11, 45), recurrent: true, dossier: '' },
    { id: 'e7', titre: 'Mariage', lieu: 'Église', description: '', journee: false, debut: jour(23, 15), fin: jour(23, 16, 30), recurrent: false, dossier: 'd4' }
  ],
  dossiers: [
    { id: 'd1', type: 'bapteme', etat: 'ouvert', cree_le: jour(0, 10, 13), source: 'Formulaire du site', email: 'julie.weber@example.fr', telephone: '06 12 34 56 78', date_celebration: '', evenement_id: '', responsable: 'u3', maj_le: jour(0, 10, 13),
      infos: { enfant_prenoms: 'Louise', enfant_nom: 'Weber', enfant_naissance_date: '2026-08-02', enfant_naissance_lieu: 'Strasbourg', parents_noms: 'Julie et Marc Weber', adresse: '12 rue du Dôme, Strasbourg', telephone: '06 12 34 56 78', email: 'julie.weber@example.fr', parrain_nom: 'Thomas Weber', marraine_nom: 'Claire Roth', date_souhaitee: '2027-04-18', message: 'Nous souhaiterions un baptême au printemps, après Pâques si possible.' },
      etapes: { recue: { fait: true, date: jour(0, 10, 13), par: 'Formulaire', libelle: 'Demande reçue' } }, documents: {}, rencontres: [], pieces: [], fils: ['t1'],
      historique: [{ date: jour(0, 10, 13), par: 'Formulaire du site', texte: 'Demande reçue' }] },
    { id: 'd2', photo: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#e8c9a8"/><circle cx="40" cy="31" r="15" fill="#a8662e"/><ellipse cx="40" cy="75" rx="27" ry="21" fill="#a8662e"/></svg>'), type: 'catechumene', etat: 'ouvert', cree_le: jour(-60), source: 'Formulaire du site', email: 'sarah.k@example.fr', telephone: '06 55 44 33 22', date_celebration: '', evenement_id: '', responsable: 'u1', maj_le: jour(-3),
      infos: { prenoms: 'Sarah', nom: 'Kessler', naissance_date: '1994-03-12', naissance_lieu: 'Mulhouse', adresse: 'Strasbourg', telephone: '06 55 44 33 22', email: 'sarah.k@example.fr', situation: 'Célibataire', accompagnateurs: 'Marie et Paul Hirsch', entree_date: '2026-10-11', entree_ministre: 'abbé Florent Molin', b6_annee: '2026', annee_sacrements: '2027' },
      etapes: { accueil: { fait: true, date: jour(-60), par: 'abbé Florent Molin' }, accompagnateur: { fait: true, date: jour(-45), par: 'abbé Florent Molin' }, entree: { fait: true, date: jour(-39), par: 'abbé Florent Molin' } },
      documents: { acte_naissance: { recu: true, date: jour(-40) } },
      rencontres: [{ id: 'r1', date: '2026-09-20', titre: 'Qui est Jésus ?', present: true }, { id: 'r2', date: '2026-10-04', titre: 'La prière', present: true }, { id: 'r3', date: '2026-10-18', titre: "L'Église", present: false }, { id: 'r4', date: '2026-11-08', titre: 'Les sacrements', present: true }],
      pieces: [], fils: [], historique: [{ date: jour(-39), par: 'abbé Florent Molin', texte: 'Étape : Entrée en catéchuménat' }] },
    { id: 'd3', type: 'obseques', etat: 'ouvert', cree_le: jour(-1, 16), source: 'Saisie : Bertille Bauer', email: '', telephone: '03 88 00 00 00', date_celebration: jour(2, 10), evenement_id: 'e5', responsable: 'u2', maj_le: jour(-1, 17),
      infos: { defunt_prenoms: 'Joseph', defunt_nom: 'Schmitt', defunt_naissance_date: '1938-05-01', defunt_deces_date: '2026-11-17', famille_contact: 'Mme Roth (fille)', telephone: '03 88 00 00 00', pompes_funebres: 'PF Klein', celebrant: 'abbé Guillaume Le Gall', lieu_celebration: 'Église', sepulture: 'Inhumation', cimetiere: 'Cimetière Nord' },
      etapes: { appel: { fait: true, date: jour(-1, 16), par: 'Bertille Bauer' }, date: { fait: true, date: jour(-1, 16), par: 'Bertille Bauer' } }, documents: {}, rencontres: [], pieces: [], fils: ['t3'], historique: [] },
    { id: 'd5', type: 'catechumene', etat: 'ouvert', cree_le: jour(-300), source: 'Saisie : abbé Florent Molin', email: 'k.ndiaye@example.fr', telephone: '', date_celebration: '', evenement_id: '', responsable: 'u2', maj_le: jour(-20),
      infos: { prenoms: 'Khadija', nom: 'Ndiaye', annee_sacrements: '2026' }, etapes: { accueil: { fait: true }, accompagnateur: { fait: true }, entree: { fait: true }, lettre: { fait: true }, appel: { fait: true }, scrutins: { fait: true } }, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] },
    { id: 'd6', type: 'catechumene', etat: 'ouvert', cree_le: jour(-10), source: 'Formulaire du site', email: 'tom.b@example.fr', telephone: '', date_celebration: '', evenement_id: '', responsable: '', maj_le: jour(-10),
      infos: { prenoms: 'Tom', nom: 'Becker' }, etapes: { accueil: { fait: true } }, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] },
    { id: 'd11', type: 'confirmand', etat: 'ouvert', cree_le: jour(-30), source: 'Formulaire confirmation 2026-2027', email: 'gaspard.v@example.fr', telephone: '06 86 33 72 07', date_celebration: '', evenement_id: '', responsable: '', maj_le: jour(-30),
      infos: { prenoms: 'Gaspard', nom: 'Volmer', naissance_date: '2006-11-18', naissance_lieu: 'Paris', pere: 'Marc Volmer', mere: 'Luz Dans', annee_sacrements: '2027', bapteme_inconnu: 'oui', form_cles: ['x'] }, etapes: {}, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] },
    { id: 'd12', type: 'confirmand', etat: 'ouvert', cree_le: jour(-20), source: 'Formulaire confirmation 2026-2027', email: 'lucas.j@example.fr', telephone: '', date_celebration: '', evenement_id: '', responsable: '', maj_le: jour(-20),
      infos: { prenoms: 'Lucas', nom: 'Joost', naissance_date: '1993-02-10', naissance_lieu: 'Colmar', bapteme_paroisse: 'Église luthérienne de Kaysersberg', bapteme_date: '1993-07-24', autre_confession: 'oui', confession_origine: 'Luthérienne', annee_sacrements: '2027', form_cles: ['x'] }, etapes: {}, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] },
    { id: 'd13', type: 'confirmand', etat: 'ouvert', cree_le: jour(-10), source: 'Formulaire confirmation 2026-2027', email: 'jm.l@example.fr', telephone: '', date_celebration: '', evenement_id: '', responsable: '', maj_le: jour(-10),
      infos: { prenoms: 'Jeanne-Marie', nom: "L'Huillier", naissance_date: '2015-07-26', annee_sacrements: '2027', bapteme_paroisse: 'Dissay', bapteme_date: '2015-08-09', form_cles: ['x'] }, etapes: {}, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] },
    { id: 'd7', type: 'confirmand', etat: 'ouvert', cree_le: jour(-90), source: 'Formulaire du site', email: 'lea.f@example.fr', telephone: '', date_celebration: '', evenement_id: '', responsable: 'u1', maj_le: jour(-30),
      infos: { prenoms: 'Léa', nom: 'Fischer', annee_sacrements: '2027' }, etapes: { accueil: { fait: true }, parcours: { fait: true } }, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] },
    { id: 'd8', type: 'premiere_communion', etat: 'ouvert', cree_le: jour(-40), source: 'Formulaire du site', email: 'julie.weber@example.fr', telephone: '06 12 34 56 78', date_celebration: '', evenement_id: '', responsable: '', maj_le: jour(-2),
      infos: { enfant_prenoms: 'Hugo', enfant_nom: 'Weber', enfant_naissance_date: '2018-03-04', classe: 'CE2', preparation: 'Herrade de Landsberg', annee_scolaire: '2026-2027', pere_prenom: 'Marc', pere_nom: 'Weber', mere_prenom: 'Julie', mere_nom_jeune_fille: 'Lang', email: 'julie.weber@example.fr', bapteme_paroisse: 'Saint-Pierre-le-Jeune', bapteme_date: '2018-06-10' },
      etapes: { inscription: { fait: true, date: jour(-40), par: 'Formulaire' } }, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] },
    { id: 'd9', type: 'premiere_communion', etat: 'ouvert', cree_le: jour(-35), source: 'Saisie : Bertille Bauer', email: 'm.dupont@example.fr', telephone: '', date_celebration: '', evenement_id: '', responsable: '', maj_le: jour(-5),
      infos: { enfant_prenoms: 'Chloé', enfant_nom: 'Dupont', preparation: 'Paroisse', annee_scolaire: '2026-2027', mere_nom_jeune_fille: 'Martin', email: 'm.dupont@example.fr', rdv_cure_date: jour(3, 17), rdv_cure_lieu: 'Presbytère' },
      etapes: { inscription: { fait: true }, certificat: { fait: true }, rdv_cure: { fait: true } }, documents: { cert_bapteme: { recu: true } }, rencontres: [], pieces: [], fils: [], historique: [] },
    { id: 'd10', type: 'profession_foi', etat: 'ouvert', cree_le: jour(-20), source: 'Formulaire du site', email: 'n.roth@example.fr', telephone: '', date_celebration: '', evenement_id: '', responsable: '', maj_le: jour(-20),
      infos: { enfant_prenoms: 'Nathan', enfant_nom: 'Roth', preparation: 'Saints Louis et Zélie Martin', annee_scolaire: '2026-2027', pere_nom: 'Roth', email: 'n.roth@example.fr' },
      etapes: { inscription: { fait: true }, validation: { fait: true } }, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] },
    { id: 'd4', type: 'mariage', etat: 'ouvert', cree_le: jour(-200), source: 'Formulaire du site', email: 'sophie.klein@example.fr', telephone: '06 98 76 54 32', date_celebration: jour(23, 15), evenement_id: 'e7', responsable: 'u1', maj_le: jour(-5),
      infos: { fiancee_prenoms: 'Sophie', fiancee_nom: 'Klein', fiance_prenoms: 'Antoine', fiance_nom: 'Muller', email: 'sophie.klein@example.fr', telephone: '06 98 76 54 32', lieu_celebration: 'Église' },
      etapes: { recue: { fait: true, date: jour(-200), par: 'Formulaire' }, rdv: { fait: true, date: jour(-180), par: 'abbé Florent Molin' }, preparation: { fait: true, date: jour(-60), par: 'abbé Florent Molin' } },
      documents: { bapteme_fiancee: { recu: true }, intention_fiancee: { recu: true }, intention_fiance: { recu: true } }, rencontres: [], pieces: [], fils: [], historique: [] }
  ]
}

const cateResume = (x) => { const du = Number(x.cotisation || 0) + x.manuels.reduce((a, m) => a + Number(m.prix || 0), 0); const paye = x.paiements.reduce((a, y) => a + Number(y.montant || 0), 0); return { id: x.id, annee: x.annee, cree_le: x.cree_le, source: x.source, nom: x.nom, prenoms: x.prenoms, classe: x.classe, groupe: x.groupe, email: x.email, telephone: x.telephone, demandes: x.demandes, du, paye, reste: Math.round((du - paye) * 100) / 100, manuels_remis: x.manuels.length > 0 && x.manuels.every((m) => m.remis), nb_manuels: x.manuels.length } }
const cateComplet = (x) => ({ ...x, ...cateResume(x), manuels: x.manuels.map((m) => ({ ...m })), paiements: [...x.paiements] })
const corListe = (a) => corListe2(a || '2026-2027')
const corListe2 = (annee) => ({ annee, fils: Object.fromEntries(Object.entries(etat.cor.fils).map(([k, f]) => [k, { non_lus: f.lu ? 0 : f.messages.filter((m) => m.cote === 'chef').length, prochaine: [...f.rencontres].filter((r) => r.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date))[0] || null }])), annees: [...new Set(['2026-2027', ...Object.keys(etat.cor.equipes)])].sort().reverse(), profils: etat.cor.reglages.profils, lien_formulaire: etat.cor.reglages.lien_formulaire, onglets_repris: true, equipes: (etat.cor.equipes[annee] || []).map((e) => ({ ...e })), membres: etat.cor.membres.filter((m) => m.annee === annee).map((m) => corMembre(m)).sort((x, y) => (x.nom + x.prenoms).localeCompare(y.nom + y.prenoms)) })
const PROF_DOS = ['Catéchumène', 'Néophyte', 'Confirmand']
function corMembre(m) {
  const ds = m.dossiers.map((l) => { const d = etat.dossiers.find((x) => x.id === l.id); return d && { id: d.id, type: d.type, nom: nomDe(d), etat: d.etat, etapes: Object.keys(d.etapes).filter((k) => d.etapes[k]?.fait), mode: l.mode || 'auto' } }).filter(Boolean)
  const auto = [...new Set(ds.flatMap((d) => d.type === 'catechumene' ? [d.etapes.includes('sacrements') ? 'Néophyte' : 'Catéchumène'] : d.etat === 'ouvert' && !d.etapes.includes('confirmation') ? ['Confirmand'] : []))]
  return { ...m, dossiers: ds, profils_auto: ds.length ? auto : [], profils: ds.length ? [...auto, ...m.profils.filter((p) => !PROF_DOS.includes(p))] : m.profils, nouveau: m.deja_participe === 'Non' || m.rester === 'Non' }
}
function fratDemo(id) {
  const m = etat.cor.membres.find((x) => x.dossiers.some((y) => y.id === id)); if (!m) return null
  const e = (etat.cor.equipes[m.annee] || []).find((q) => q.id === m.equipe_id)
  return { id: m.id, annee: m.annee, equipe: e?.nom || '', chefs: (e?.chefs || []).map((c) => { const x = etat.cor.membres.find((y) => y.id === c); return x ? x.prenoms + ' ' + x.nom.toUpperCase() : '' }).filter(Boolean), ancien: m.statut === 'ancien', mode: m.dossiers.find((y) => y.id === id).mode || 'auto' }
}

const RET_TYPES = { premiere_communion: 'Première communion', profession_foi: 'Profession de foi', confirmation_jeunes: 'Confirmation (jeunes)', confirmation_adultes: 'Confirmation (adultes et catéchumènes)' }
function retMontant(r, x) {
  let t = 0; x.participants.forEach((p) => r.prix.forEach((l) => { if (l.obligatoire || (p.options || []).includes(l.id)) t += Number(l.montant) || 0 }))
  const c = Number(x.ceremonie) || 0, paye = x.paiements.reduce((a, p) => a + Number(p.montant), 0)
  return { retraite: t, ceremonie: c, du: t + c, paye, reste: t + c - paye }
}
function retResume(r) {
  const act = r.inscriptions.filter((x) => x.statut !== 'annule'); const m = act.map((x) => retMontant(r, x))
  const { inscriptions: _i, ...o } = r
  return { ...o, titre: r.titre || 'Retraite – ' + RET_TYPES[r.type], ouverte_maintenant: r.ouverte !== 'non', nb_participants: act.reduce((a, x) => a + x.participants.length, 0), nb_inscriptions: act.length,
    du: m.reduce((a, x) => a + x.du, 0), paye: m.reduce((a, x) => a + x.paye, 0), reste: m.reduce((a, x) => a + x.reste, 0), lien: 'https://secretariat.croix-glorieuse.org/retraite/?r=' + r.jeton }
}
const retLire = (id) => { const r = etat.retraites.find((x) => x.id === id); return { ...retResume(r), inscriptions: r.inscriptions.map((x) => ({ ...x, montant: retMontant(r, x) })) } }
function pub(u) {
  const a = u.acces || accesDuRole(u.role)
  const dossiers = SORTES_ACCES.some(([k]) => a.dossiers[k]) || ['extraits', 'registres', 'catechisme', 'catechumenat', 'cor_unum', 'retraites'].some((k) => a[k])
  const droits = [a.courrier && 'mail', a.agenda && 'agenda', dossiers && 'dossiers', a.documents && 'documents', u.role === 'admin' && 'utilisateurs', a.reglages.length && 'reglages'].filter(Boolean)
  return { ...u, droits, acces: u.role === 'admin' ? accesDuRole('admin') : a, acces_perso: !!u.acces }
}
const alertesDemo = (d) => { const i = d.infos, a = []; if (!['confirmand', 'confirmation_jeune', 'catechumene'].includes(d.type)) return a; if (i.bapteme_inconnu === 'oui' && !i.bapteme_date && !i.bapteme_paroisse) a.push('bapteme_a_trouver'); if (i.autre_confession === 'oui') a.push('autre_confession'); if (d.type === 'catechumene' && i.en_attente === 'oui' && !i.annee_sacrements) a.push('en_attente'); if (d.type === 'confirmand' && i.naissance_date && (Date.now() - new Date(i.naissance_date)) / 3.156e10 < 18) a.push('mineur'); return a }
const resume = (d) => ({ ...d, alertes: alertesDemo(d), autre_confession: d.infos.autre_confession || '', nom: nomDe(d), preparation: d.infos.preparation === 'Autre école' ? d.infos.ecole_autre : d.infos.preparation || '', etapes: Object.keys(d.etapes).filter((k) => d.etapes[k]?.fait), documents: Object.keys(d.documents).filter((k) => d.documents[k]?.recu), date_souhaitee: d.infos.date_souhaitee || '', annee: d.infos.annee_sacrements || d.infos.annee_scolaire || '', liste: d.type === 'catechumene' ? { prenom_bapteme: d.infos.prenom_bapteme || '', parrain: d.infos.parrain_marraine || '', accompagnateur: d.infos.accompagnateurs || '' } : undefined })
const complet = (d) => ({ ...d, alertes: alertesDemo(d), nom: nomDe(d), historique: [...d.historique].reverse(), fils: d.fils.map((id) => etat.fils.find((f) => f.id === id)).filter(Boolean).map((f) => ({ id: f.id, sujet: f.sujet, date: f.date })) })
function nomDe(d) {
  const i = d.infos, np = (p, n) => [p, String(n || '').toUpperCase()].filter(Boolean).join(' ')
  if (['bapteme', 'premiere_communion', 'profession_foi', 'confirmation_jeune'].includes(d.type)) return np(i.enfant_prenoms, i.enfant_nom)
  if (d.type === 'mariage') return [np(i.fiancee_prenoms, i.fiancee_nom), np(i.fiance_prenoms, i.fiance_nom)].filter(Boolean).join(' & ')
  if (d.type === 'obseques') return np(i.defunt_prenoms, i.defunt_nom)
  return np(i.prenoms, i.nom) || d.nom || '(sans nom)'
}
const TITRES = { bapteme: 'Baptême', mariage: 'Mariage', obseques: 'Obsèques', catechumene: "Baptême d'adulte", confirmand: 'Confirmation' }
const dossiersDrive = {
  '': { nom: 'Secrétariat', dossiers: ['Dossiers', 'Modèles', 'Partage'], fichiers: [{ id: 'f0', nom: 'Base – Secrétariat (ne pas modifier à la main)', type: 'application/vnd.google-apps.spreadsheet', taille: 0, modifie: jour(0, 9) }] },
  'Modèles': { nom: 'Modèles', dossiers: [], fichiers: [{ id: 'f1', nom: 'Lettre de convocation préparation mariage', type: 'application/vnd.google-apps.document', taille: 0, modifie: jour(-12) }] },
  'a-ranger': { nom: 'À ranger', dossiers: ['Vieux documents 2019'], fichiers: [{ id: 'f9', nom: 'scan_0012.pdf', type: 'application/pdf', taille: 412000, modifie: jour(-400) }, { id: 'f10', nom: 'Planning kermesse.xlsx', type: 'application/vnd.ms-excel', taille: 22000, modifie: jour(-300) }] }
}
const attendre = () => new Promise((r) => setTimeout(r, 200))

export async function demoApi(action, p) {
  await attendre()
  const role = new URLSearchParams(location.search).get('role')
  const moi = etat.utilisateurs.find((u) => u.role === role) || etat.utilisateurs[0]
  switch (action) {
    case 'auth.login': return { token: 'demo', utilisateur: pub(moi) }
    case 'app.init': return { utilisateur: pub(moi), utilisateurs: etat.utilisateurs.map(pub), reglages: etat.reglages, signatures: etat.signatures, reponses: etat.reponses, nonLues: etat.notifications.filter((n) => !n.lu).length }
    case 'auth.logout': case 'auth.motdepasse': case 'push.abonner': case 'push.desabonner': case 'push.tester': return true
    case 'push.cle': return ''
    case 'accueil.blocs': return (etat.blocs = { ordre: p.ordre, masques: p.masques })
    case 'recherche': {
      const sa = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), mots = sa(p.q).split(/\s+/).filter(Boolean), ok = (t) => mots.every((m) => sa(t).includes(m))
      const g = []
      const ds = etat.dossiers.filter((d) => ok(`${nomDe(d)} ${d.email} ${d.telephone}`)); if (ds.length) g.push({ cle: 'dossiers', titre: 'Dossiers', total: ds.length, items: ds.slice(0, 8).map((d) => ({ titre: nomDe(d), sous: d.type, lien: '/dossiers/' + d.id })) })
      const cs = etat.cor.membres.filter((m) => ok(`${m.prenoms} ${m.nom} ${m.email}`)); if (cs.length) g.push({ cle: 'cor', titre: 'Cor Unum', total: cs.length, items: cs.slice(0, 8).map((m) => ({ titre: `${m.prenoms} ${m.nom.toUpperCase()}`, sous: m.annee, lien: `/cor-unum?annee=${m.annee}&vue=tous&fiche=${m.id}` })) })
      return { groupes: g }
    }
    case 'accueil.resume': {
      const ouverts = etat.dossiers.filter((d) => d.etat === 'ouvert')
      return { blocs: etat.blocs || { ordre: ['chiffres', 'afaire', 'fete', 'demandes', 'notifications', 'agenda'], masques: [] }, mailsNonLus: etat.fils.filter((f) => f.nonLu).length, mesMails: etat.fils.filter((f) => f.suivi?.attribue_a === moi.id && f.suivi.statut !== 'Traité').length,
        dossiersOuverts: ouverts.length, mesDossiers: ouverts.filter((d) => d.responsable === moi.id).map(resume),
        nouveaux: ouverts.filter((d) => Object.keys(d.etapes).length <= 1).map(resume),
        evenements: etat.evenements.filter((e) => new Date(e.debut) < Date.now() + 7 * 864e5 && new Date(e.fin) > new Date().setHours(0, 0, 0, 0)).sort((a, b) => a.debut.localeCompare(b.debut)),
        notifications: etat.notifications,
        afaire: [
          { cle: 'mails', nombre: 3, texte: 'mails à traiter', lien: '/courrier?filtre=atraiter' },
          { cle: 'demandes', nombre: 2, texte: 'nouvelles demandes à prendre en charge', lien: '/dossiers' },
          { cle: 'bapteme', nombre: 1, texte: 'confirmand dont le baptême est à trouver', lien: '/dossiers?type=confirmand' },
          { cle: 'cor', nombre: 3, texte: 'inscrits Cor Unum à répartir', lien: '/cor-unum?vue=repartir' },
          { cle: 'impayes', nombre: 4, texte: 'inscriptions au catéchisme non réglées (185 €)', lien: '/catechisme?impayes=1' }]}
    }
    case 'notifications.prefs': {
      const CAT = [['demandes', 'Nouvelles demandes'], ['courrier', 'Courrier et mails attribués'], ['dossiers', 'Dossiers'], ['catechisme', 'Catéchisme'], ['confirmands', 'Confirmands'], ['cor_unum', 'Cor Unum (messages des chefs)']].map(([cle, nom]) => ({ cle, nom }))
      if (p.ecrire) etat.prefs = { coupees: p.coupees, calme: p.calme }
      const r = etat.prefs || { coupees: [], calme: { actif: false, de: '21:30', a: '07:30' } }
      return { categories: CAT, ...r }
    }
    case 'notifications.liste': return etat.notifications.filter((n) => !p.nonLues || !n.lu).slice(0, p.limite || 50)
    case 'notifications.lues': etat.notifications.forEach((n) => { if (!p.ids || p.ids.includes(n.id)) n.lu = true }); return true
    case 'utilisateurs.liste': return etat.utilisateurs.map(pub)
    case 'utilisateurs.creer': { const u = { id: 'u' + Date.now(), ...p, actif: true, derniere_connexion: '' }; delete u.motdepasse; etat.utilisateurs.push(u); return pub(u) }
    case 'utilisateurs.modifier': { const u = etat.utilisateurs.find((x) => x.id === p.id); Object.assign(u, p); delete u.motdepasse; return pub(u) }
    case 'modeles': return { signatures: [{ cle: 'cure', nom: 'abbé Florent Molin', fonction: 'Curé' }, { cle: 'vicaire', nom: 'Abbé Guillaume LE GALL', fonction: 'Vicaire' }],
      modeles: [
        { cle: 'attestation', titre: 'Attestation de préparation', objet: 'Attestation de préparation {a_sacrement}', corps: 'Je soussigné, {signataire}, {fonction} de la {paroisse}, atteste que\n\n{nom_complet}, né(e) le {ne_le}{ne_a},\n\na suivi la préparation {a_sacrement} dans notre paroisse.\n\nCette attestation est délivrée pour servir et valoir ce que de droit.' },
        { cle: 'autorisation', titre: 'Autorisation (licence)', objet: 'Autorisation pour la célébration {du_sacrement}', corps: 'Je soussigné, {signataire}, {fonction} de la {paroisse} (diocèse de {diocese}), donne licence pour la célébration {du_sacrement} de\n\n{nom_complet}\n\nle {date_celebration} en l\'église {lieu_celebration}{par_celebrant}.' },
        { cle: 'aptitude', titre: 'Certificat d\'aptitude (parrain / marraine)', objet: 'Certificat d\'aptitude à la charge de parrain ou de marraine', corps: 'Je soussigné, {signataire}, {fonction} de la {paroisse}, certifie que\n\n{nom_complet}, né(e) le {ne_le}{ne_a},\n\nremplit les conditions requises par le droit de l\'Église (canon 874) pour exercer la charge de parrain ou de marraine.' },
        { cle: 'lettre', titre: 'Lettre libre à en-tête', objet: '', corps: 'Madame, Monsieur,\n\n\n\nAvec l\'assurance de nos prières à toutes vos intentions,' }] }
    case 'dossiers.courrier': return demoApi('dossiers.lire', { id: p.dossierId })
    case 'registres': {
      if (p.dossier) return { registre: 'baptemes', nom_registre: 'Baptêmes', annee: String(new Date().getFullYear()), numero: '15' }
      if (p.inscrire) return demoApi('dossiers.lire', { id: p.inscrire.id })
      const noms = [['ARNOLD', 'Paul', 6], ['BAUER', 'Léa', 11], ['KLEIN', 'Hugo', 3], ['MARTIN', 'Zoé', 9], ['WEBER', 'Louise', 5]]
      return { registres: [['baptemes', 'Baptêmes', 2], ['communions', 'Premières communions', 0], ['professions', 'Professions de foi', 0], ['confirmations', 'Confirmations', 1], ['mariages', 'Mariages', 0], ['sepultures', 'Sépultures', 1]].map(([cle, nom, a]) => ({ cle, nom, a_inscrire: a })),
        registre: p.registre || 'baptemes', annee: p.annee || String(new Date().getFullYear()), annees: [String(new Date().getFullYear()), String(new Date().getFullYear() - 1)], depart: 2, prochain: 15,
        a_inscrire: [{ id: 'd1', nom: 'Louise WEBER', type: 'bapteme', date: jour(-10).slice(0, 10) }, { id: 'd2', nom: 'Gabriel HOFFMANN', type: 'bapteme', date: jour(-3).slice(0, 10) }],
        table: noms.map(([nom, prenoms, n]) => ({ nom, prenoms, numero: String(n), date: jour(-n * 20).slice(0, 10), id: 'd1', type: 'bapteme' })) }
    }
    case 'statistiques': {
      const t = (k) => ({ bapteme: 23 - k * 3, catechumene: 4 + k, premiere_communion: 31 - k, profession_foi: 18 + k, confirmation: 27 - k * 2, mariage: 9 + k, obseques: 42 - k * 4 })
      const m = (k) => [1, 0, 2, 9, 11, 14, 12, 8, 13, 6, 3, 4].map((x) => Math.max(0, x - k * 2 + (x % 3)))
      return { annee: Number(p.annee), annee_prec: Number(p.annee) - 1, scolaire: p.scolaire, scolaire_prec: '',
        types: [['bapteme', 'Baptêmes d\'enfants'], ['catechumene', 'Baptêmes d\'adultes'], ['premiere_communion', 'Premières communions'], ['profession_foi', 'Professions de foi'], ['confirmation', 'Confirmations'], ['mariage', 'Mariages'], ['obseques', 'Obsèques']].map(([cle, nom]) => ({ cle, nom })),
        sacrements: { par_type: t(0), par_mois: m(0) }, sacrements_prec: { par_type: t(1), par_mois: m(1) },
        catechese: { enfants: 87, du: 2610, paye: 2245, classes: { CE1: 14, CE2: 16, CM1: 19, CM2: 15, '6e': 12, '5e': 11 }, preparations: { premiere_communion: 31, profession_foi: 18, confirmation_jeune: 24, confirmand: 9, catechumene: 6 } },
        catechese_prec: { enfants: 79, preparations: { premiere_communion: 28, profession_foi: 20, confirmation_jeune: 22, confirmand: 7, catechumene: 4 } },
        cor: { membres: 146, places: 138, fraternites: 17, chefs: 31 }, cor_prec: { membres: 121, fraternites: 14, chefs: 26 } }
    }
    case 'sauvegardes': return { entretien: jour(0, 3), sauvegardes: [0, 7, 14, 21].map((n, i) => ({ id: 'sv' + i, nom: 'Sauvegarde secrétariat ' + jour(-n, 3).slice(0, 10) + ' 03.00', date: jour(-n, 3), url: '#' })) }
    case 'journal.liste': return [{ date: jour(0, 10, 13), utilisateur: 'système', action: 'Demande reçue (site)', detail: 'Baptême – Louise WEBER' }, { date: jour(0, 8, 2), utilisateur: 'Tri automatique', action: 'Réponse auto envoyée', detail: 'Horaires → claire.m@example.fr (« Horaires de Noël »)' }, { date: jour(0, 9), utilisateur: 'Bertille Bauer', action: 'Suivi mail', detail: 'Réservation salle → En cours' }]
    case 'reglages.ecrire': Object.assign(etat.reglages, p); return etat.reglages
    case 'signatures.ecrire': etat.signatures = p.signatures; return p.signatures
    case 'reponses.ecrire': etat.reponses = p.reponses; return p.reponses
    case 'mail.liste': {
      let fils = etat.fils
      if (p.filtre === 'nonlus') fils = fils.filter((f) => f.nonLu)
      if (p.filtre === 'mes') fils = fils.filter((f) => f.suivi?.attribue_a === moi.id && f.suivi.statut !== 'Traité')
      if (p.filtre === 'atraiter') fils = fils.filter((f) => f.suivi?.statut && f.suivi.statut !== 'Traité')
      if (p.filtre === 'suivis') fils = fils.filter((f) => f.important)
      if (p.filtre === 'envoyes') fils = []
      if (p.recherche) fils = fils.filter((f) => (f.sujet + f.de + f.extrait).toLowerCase().includes(p.recherche.toLowerCase()))
      return { fils, suivant: null }
    }
    case 'mail.fil': {
      const f = etat.fils.find((x) => x.id === p.id); f.nonLu = false
      return { ...f, commentaires: etat.commentaires[f.id] || [], messages: [{ id: 'm' + f.id, de: f.de, a: f.a, cc: '', date: f.date, sujet: f.sujet, html: `<p>Bonjour,</p><p>${f.extrait}</p><p>Bien cordialement,<br>${f.de.split('<')[0]}</p>`, texte: f.extrait, pieces: f.id === 't1' ? [{ index: 0, nom: 'livret-de-famille.pdf', type: 'application/pdf', taille: 182344 }] : [] }] }
    }
    case 'conf.reglages': case 'conf.reglagesEcrire': return { import_auto: true, accuse_depuis: '2026-11-20T22:00:00Z', feuilles: [{ id: '1vO0NcDmaO9tLi1l_vTmcuCTJZ3ZzOH6GRq9WK9G8Pus', annee: '2026-2027', annee_confirmation: '2027', nom: 'Confirmation adultes (2026-2027) (réponses)' }] }
    case 'conf.importer': return { nouveaux: 0, completes: 0, accuses: 0, erreurs: [] }
    case 'conf.relancer': return { nb: p.ids.length }
    case 'dossiers.changerType': { const d = etat.dossiers.find((x) => x.id === p.id); d.type = p.type; if (p.type === 'confirmation_jeune') { d.infos.enfant_prenoms = d.infos.prenoms; d.infos.enfant_nom = d.infos.nom; d.infos.annee_scolaire = '2026-2027' } return complet(d) }
    case 'cor.reglages': return etat.cor.reglages
    case 'cor.reglagesEcrire': Object.assign(etat.cor.reglages, p); return etat.cor.reglages
    case 'cor.liste': case 'cor.importer': case 'cor.onglets': {
      if (action !== 'cor.liste') return action === 'cor.importer' ? { nouvelles: 0, fusionnees: 0, erreurs: [] } : { equipes: 0, membres: 0, anciens: 0, liste: corListe(p.annee) }
      return corListe(p.annee)
    }
    case 'cor.modifier': { (p.ids || [p.id]).forEach((id) => { const m = etat.cor.membres.find((x) => x.id === id); ['nom', 'prenoms', 'email', 'telephone', 'adresse', 'situation', 'profils', 'equipe_id', 'statut', 'note', 'souhait', 'chef_possible'].forEach((k) => { if (p[k] !== undefined) m[k] = p[k] }); if (p.equipe_id) m.equipe_proposee = '' }); return corListe(p.annee) }
    case 'cor.creer': etat.cor.membres.push(cor('c' + Date.now(), p.prenoms, p.nom, p.equipe_id || '', { ...p, annee: p.annee || '2026-2027', dossiers: [] })); return corListe(p.annee)
    case 'cor.supprimer': etat.cor.membres = etat.cor.membres.filter((x) => x.id !== p.id); return corListe(p.annee)
    case 'cor.equipe': { const l = etat.cor.equipes[p.annee] ||= []; if (p.supprimer) { etat.cor.equipes[p.annee] = l.filter((e) => e.id !== p.supprimer); etat.cor.membres.forEach((m) => { if (m.equipe_id === p.supprimer) m.equipe_id = '' }) } else { const e = l.find((x) => x.id === p.equipe.id); if (e) Object.assign(e, p.equipe); else { const n = { ...p.equipe, id: 'q' + Date.now() }; l.push(n); n.chefs.forEach((c) => { const m = etat.cor.membres.find((x) => x.id === c); if (m) m.equipe_id = n.id }) } } return corListe(p.annee) }
    case 'cor.nouvelleAnnee': etat.cor.equipes[p.vers] = (etat.cor.equipes[p.de] || []).map((e) => ({ ...e, id: e.id + 'b' })); etat.cor.membres.filter((m) => m.annee === p.de && m.statut !== 'ancien' && m.equipe_id).forEach((m) => etat.cor.membres.push({ ...m, id: m.id + 'b', annee: p.vers, equipe_id: m.equipe_id + 'b', statut: 'ancien' })); etat.cor.equipes[p.vers].forEach((e) => { e.chefs = e.chefs.map((c) => c + 'b') }); return corListe(p.vers)
    case 'catechumenat.reglages': { const d = etat.anniv ||= { anniv_actif: false, anniv_texte: 'Bonjour {prenom},\n\nIl y a {annees}…', defaut: 'Bonjour {prenom},\n\nIl y a {annees}…', prochains: [{ id: 'd5', nom: 'Khadija NDIAYE', date: '2026-12-05', annees: 1, mail: true }],
      consigne_lettre: 'Écrivez à la main votre lettre à Mgr Pascal Delannoy, archevêque de Strasbourg…\n\nEnsuite, déposez-la ici (une photo nette de chaque page, ou un PDF), ou bien au presbytère : {adresse}.', consigne_defaut: 'Écrivez à la main votre lettre…',
      lettres: [{ id: 'd2', nom: 'Sarah KESSLER', statut: 'deposee', date: '2026-11-22T18:00:00Z' }, { id: 'd5', nom: 'Khadija NDIAYE', statut: 'annoncee', date: '2026-11-21T10:00:00Z' }] }; if (p.consigne_lettre !== undefined) d.consigne_lettre = p.consigne_lettre; if (p.ecrire) Object.assign(d, { anniv_actif: p.anniv_actif, anniv_texte: p.anniv_texte }); return { ...d } }
    case 'cor.menage': {
      const x = etat.cor.membres.find((y) => y.id === p.id), z = etat.cor.membres.find((y) => y.id === p.avec)
      if (x.nom.toLowerCase() === z.nom.toLowerCase()) x.prenoms = x.prenoms + ' et ' + z.prenoms; else { x.prenoms = `${x.prenoms} ${x.nom.toUpperCase()} et ${z.prenoms}`; x.nom = z.nom }
      x.email = [x.email, z.email].filter(Boolean).join(', '); x.telephone = [x.telephone, z.telephone].filter(Boolean).join(' / '); x.dossiers = [...x.dossiers, ...z.dossiers]
      etat.cor.membres = etat.cor.membres.filter((y) => y.id !== z.id)
      Object.values(etat.cor.equipes).flat().forEach((e) => { e.chefs = e.chefs.map((c) => c === z.id ? x.id : c) })
      return corListe(p.annee)
    }
    case 'cor.equipesCourantes': return { annee: '2026-2027', equipes: (etat.cor.equipes['2026-2027'] || []).map((e) => ({ id: e.id, nom: e.nom, chefs: (e.chefs || []).map((c) => { const x = etat.cor.membres.find((y) => y.id === c); return x ? x.prenoms + ' ' + x.nom.toUpperCase() : '' }).filter(Boolean), membres: etat.cor.membres.filter((m) => m.annee === '2026-2027' && m.equipe_id === e.id && m.statut !== 'ancien').length })) }
    case 'cor.placer': {
      p.dossiers.forEach((id) => {
        const d = etat.dossiers.find((x) => x.id === id)
        let m = etat.cor.membres.find((x) => x.annee === '2026-2027' && x.dossiers.some((y) => y.id === id))
        if (!m && p.equipe_id) { m = cor('c' + Date.now() + id, d.infos.prenoms || '', d.infos.nom || nomDe(d), p.equipe_id, { annee: '2026-2027', email: d.email || '', telephone: d.telephone || '', dossiers: [{ id, mode: 'manuel' }], deja_participe: 'Non' }); etat.cor.membres.push(m) }
        else if (m) { m.equipe_id = p.equipe_id; if (p.equipe_id) m.statut = 'actif'; const l = m.dossiers.find((y) => y.id === id); l.mode = 'manuel' }
      })
      return { fraternites: Object.fromEntries(p.dossiers.map((id) => [id, fratDemo(id)])), fraternite: p.dossiers.length === 1 ? fratDemo(p.dossiers[0]) : null }
    }
    case 'cor.lienInscription': return { lien: 'https://secretariat.croix-glorieuse.org/rejoindre/?i=' + 'd'.repeat(32) }
    case 'cor.lienChef': return { lien_inscription: 'https://secretariat.croix-glorieuse.org/rejoindre/?i=' + 'c'.repeat(32), lien: 'https://secretariat.croix-glorieuse.org/fraternite/?c=' + (p.nouveau ? 'b' : 'a').repeat(32), mot_de_passe: p.equipe === 'q1' ? '2026-11-02T10:00:00Z' : '', mails: ['claire.martin@example.fr'] }
    case 'cor.fil': { const f = etat.cor.fils[p.equipe] ||= { messages: [], rencontres: [] }; if (p.texte) f.messages.push({ id: 'x' + Date.now(), date: new Date().toISOString(), auteur: moi.nom, cote: 'paroisse', texte: p.texte }); f.lu = true; return f }
    case 'cor.tousChefs': (etat.cor.equipes[p.annee] || []).forEach((e) => { (etat.cor.fils[e.id] ||= { messages: [], rencontres: [] }).messages.push({ id: 'x' + Date.now() + e.id, date: new Date().toISOString(), auteur: moi.nom, cote: 'paroisse', texte: p.texte }) }); return { nb: (etat.cor.equipes[p.annee] || []).length }
    case 'cor.envoyer': return { nb: new Set(etat.cor.membres.filter((m) => p.ids.includes(m.id)).map((m) => m.email)).size }
    case 'cate.reglages': return { ...etat.cate.reglages, groupes: GROUPES_DEMO, modes: ['Espèces', 'Chèque', 'Virement', 'Carte', 'Autre'] }
    case 'cate.reglagesEcrire': Object.assign(etat.cate.reglages, p, { cotisation: Number(p.cotisation) || 0 }); return { ...etat.cate.reglages, groupes: GROUPES_DEMO, modes: ['Espèces', 'Chèque', 'Virement'] }
    case 'cate.liste': { const annee = p.annee || '2026-2027'; return { annee, annees: ['2026-2027', '2025-2026'], groupes: GROUPES_DEMO, cotisation: etat.cate.reglages.cotisation, ecoles: etat.cate.reglages.ecoles, inscriptions: etat.cate.inscriptions.filter((x) => x.annee === annee).map(cateResume).sort((a, b) => (a.nom + a.prenoms).localeCompare(b.nom + b.prenoms)) } }
    case 'cate.lire': return cateComplet(etat.cate.inscriptions.find((x) => x.id === p.id))
    case 'cate.creer': { const x = ins('k' + Date.now(), p.prenoms, p.nom, p.classe, p.groupe || '', p.email, { annee: p.annee, telephone: p.telephone || '', sacrement: p.sacrement || '', source: 'Saisie : ' + moi.nom, cotisation: etat.cate.reglages.cotisation, pere: '', mere: '' }); etat.cate.inscriptions.push(x); return cateComplet(x) }
    case 'cate.modifier': { const x = etat.cate.inscriptions.find((y) => y.id === p.id); Object.assign(x, Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'id'))); x.cotisation = Number(String(x.cotisation).replace(',', '.')) || 0; x.manuels = x.manuels.map((m) => ({ ...m, prix: Number(String(m.prix).replace(',', '.')) || 0 })); return cateComplet(x) }
    case 'cate.paiement': { const x = etat.cate.inscriptions.find((y) => y.id === p.id); if (p.ajouter) x.paiements.push({ id: 'p' + Date.now(), ...p.ajouter, montant: Number(p.ajouter.montant), par: moi.nom }); if (p.retirer) x.paiements = x.paiements.filter((y) => y.id !== p.retirer); return cateComplet(x) }
    case 'cate.supprimer': etat.cate.inscriptions = etat.cate.inscriptions.filter((x) => x.id !== p.id); return true
    case 'cate.dossier': { const x = etat.cate.inscriptions.find((y) => y.id === p.id); const d = { id: 'd' + Date.now(), type: p.type, etat: 'ouvert', cree_le: new Date().toISOString(), source: 'Inscription au catéchisme ' + x.annee, email: x.email, telephone: x.telephone, date_celebration: '', evenement_id: '', responsable: '', maj_le: new Date().toISOString(), infos: { enfant_prenoms: x.prenoms, enfant_nom: x.nom, classe: x.classe, email: x.email, annee_scolaire: x.annee, ...(['premiere_communion', 'profession_foi'].includes(p.type) ? { preparation: 'Paroisse' } : {}), inscription_catechisme: x.id }, etapes: { inscription: { fait: true } }, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] }; etat.dossiers.unshift(d); x.demandes.push({ type: p.type, dossier_id: d.id }); return { inscription: cateComplet(x), dossier_id: d.id } }
    case 'cate.importer': return { nouvelles: 0, erreurs: [] }
    case 'cate.envoyer': return { nb: new Set(etat.cate.inscriptions.filter((x) => p.ids.includes(x.id)).map((x) => x.email)).size }
    case 'tri.lire': return { ...etat.tri, categories: TRI_DEMO.map(({ cle, nom, action, type, mots }) => ({ cle, nom, action, type, defaut: mots })), defaut: { sensibles: etat.tri.sensibles, ignores: etat.tri.ignores } }
    case 'tri.ecrire': Object.assign(etat.tri, p); return etat.tri
    case 'tri.tester': {
      const n = (t) => ' ' + String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ') + ' '
      const tr = (txt, l) => (l || []).filter((m) => n(txt).includes(' ' + m.replace(/\*$/, '')))
      let txt = n(p.sujet + ' ' + p.texte); const res = { categories: [], mots: {}, sensibles: tr(txt, etat.tri.sensibles) }
      TRI_DEMO.forEach((c) => { if (etat.tri.desactivees.includes(c.cle)) return; const t = tr(txt, etat.tri.mots[c.cle]); if (t.length) { res.categories.push(c.cle); res.mots[c.cle] = t; t.forEach((m) => { txt = txt.split(m.replace(/\*$/, '')).join(' ') }) } })
      res.envoiAuto = etat.tri.envoi_auto && res.categories.includes('horaires') && !res.sensibles.length
      return res
    }
    case 'mail.libelles': return ['Paroisse/Chorale', 'Paroisse/Factures']
    case 'mail.modifier': { const f = etat.fils.find((x) => x.id === p.id); if (p.nonLu) f.nonLu = true; if (p.important !== undefined) f.important = p.important; if (p.archiver || p.corbeille) etat.fils = etat.fils.filter((x) => x.id !== p.id); return true }
    case 'mail.suivi': { const f = etat.fils.find((x) => x.id === p.filId); f.suivi = { statut: '', attribue_a: '', dossier_id: '', ...f.suivi }; ['statut', 'attribue_a', 'dossier_id'].forEach((k) => { if (p[k] !== undefined) f.suivi[k] = p[k] }); if (p.attribue_a && !f.suivi.statut) f.suivi.statut = 'À traiter'; return f.suivi }
    case 'mail.commenter': { const c = { id: 'c' + Date.now(), auteur: moi.nom, date: new Date().toISOString(), texte: p.texte }; (etat.commentaires[p.filId] ||= []).push(c); return c }
    case 'mail.envoyer': { if (p.dossierId) { const d = etat.dossiers.find((x) => x.id === p.dossierId); d.historique.push({ date: new Date().toISOString(), par: moi.nom, texte: 'Mail envoyé : ' + (p.sujet || '') }) } return { filId: 't1' } }
    case 'mail.groupes': return [{ id: 'g1', nom: 'Chorale', nb: 24 }, { id: 'g2', nom: 'Conseil pastoral', nb: 11 }, { id: 'g3', nom: 'Équipe d\'accueil', nb: 8 }]
    case 'mail.envoiGroupe': return { nb: 24, quota: 96 }
    case 'mail.piecejointe': case 'documents.telecharger': return { nom: 'exemple.txt', type: 'text/plain', base64: btoa('Fichier de demonstration') }
    case 'agenda.evenements': return etat.evenements.filter((e) => e.debut < p.fin && e.fin > p.debut).sort((a, b) => a.debut.localeCompare(b.debut))
    case 'agenda.creer': { const e = { ...p, id: 'e' + Date.now(), recurrent: false, dossier: '' }; etat.evenements.push(e); return e }
    case 'agenda.modifier': { const e = etat.evenements.find((x) => x.id === p.id); Object.assign(e, p); if (e.dossier) etat.dossiers.find((d) => d.id === e.dossier).date_celebration = p.debut; return e }
    case 'agenda.supprimer': { const e = etat.evenements.find((x) => x.id === p.id); if (e?.dossier) etat.dossiers.find((d) => d.id === e.dossier).date_celebration = ''; etat.evenements = etat.evenements.filter((x) => x.id !== p.id); return true }
    case 'dossiers.liste': return etat.dossiers.map((d) => ({ ...resume(d), fraternite: fratDemo(d.id) || undefined })).sort((a, b) => b.maj_le.localeCompare(a.maj_le))
    case 'dossiers.lire': { const d = complet(etat.dossiers.find((x) => x.id === p.id)); return { ...d, fraternite: fratDemo(d.id) } }
    case 'dossiers.importerCatechumenes': {
      const trouve = (x) => etat.dossiers.find((d) => d.type === 'catechumene' && String(d.infos.nom || '').toLowerCase() === String(x.nom).toLowerCase() && String(d.infos.prenoms || '').split(' ')[0].toLowerCase() === String(x.prenoms).split(' ')[0].toLowerCase())
      if (p.simuler) return p.personnes.map((x) => { const d = trouve(x); return { cle: x.cle, existant: d ? { id: d.id, nom: nomDe(d), etat: d.etat } : null } })
      let nouveaux = 0, completes = 0
      p.personnes.forEach((x) => {
        const b = /^bapt(\d{4})$/.exec(x.statut), an = b ? b[1] : /^\d{4}$/.test(x.statut) ? x.statut : ''
        let d = trouve(x)
        if (!d) { d = { id: 'i' + Math.random().toString(36).slice(2, 8), type: 'catechumene', etat: 'ouvert', cree_le: new Date().toISOString(), maj_le: new Date().toISOString(), source: 'Fichier « Baptisés adultes »', responsable: '', infos: {}, etapes: {}, documents: {}, rencontres: [], pieces: [], historique: [], fils: [] }; etat.dossiers.push(d); nouveaux++ } else completes++
        Object.assign(d.infos, Object.fromEntries(Object.entries({ prenoms: x.prenoms, nom: x.nom, email: x.email, telephone: x.telephone, naissance_date: x.naissance_date, annee_sacrements: an, en_attente: x.statut === 'attente' ? 'oui' : '', remarques: x.notes.join('\n') }).filter(([k, v]) => v && !d.infos[k])))
        d.email = d.email || x.email
        const t = (k, l) => { d.etapes[k] = d.etapes[k] || { fait: true, date: new Date().toISOString(), par: 'Import', libelle: l } }
        t('accueil', 'Premier accueil'); if (x.entree_date || x.b6) t('entree', 'Entrée en catéchuménat'); if (b) { t('sacrements', 'Baptême, confirmation, eucharistie'); d.etat = 'clos' }
      })
      return { nouveaux, completes, ignores: 0 }
    }
    case 'paiements.reglages': return etat.ha ||= { actif: true, slug: 'paroisse-la-croix-glorieuse', client_id: 'abc123', sandbox: true, secret_ok: true, hors_ligne: 'Vous pouvez aussi régler par chèque à l\'ordre de « Paroisse La Croix glorieuse » ou en espèces au secrétariat.', url_notification: 'https://script.google.com/macros/s/…/exec', url_boutique: 'https://secretariat.croix-glorieuse.org/livres/',
      derniers: [{ id: 'y1', date: '2026-11-20T18:12:00Z', objet: 'cate', libelle: 'Catéchisme 2026-2027 – Hugo, Lina', montant: 60, statut: 'paye', email: 'claire.w@example.fr' }, { id: 'y2', date: '2026-11-21T09:02:00Z', objet: 'retraite', libelle: 'Retraite – Première communion – Léon, Zoé', montant: 85, statut: 'en_attente', email: 'paul.martin@example.fr' }] }
    case 'paiements.reglagesEcrire': Object.assign(etat.ha, p); return etat.ha
    case 'paiements.tester': return { nom: 'Paroisse La Croix glorieuse', ville: 'Strasbourg', mode: 'essai (sandbox)' }
    case 'livres.liste': return etat.livres ||= { en_ligne: true, lien_boutique: 'https://secretariat.croix-glorieuse.org/livres/', groupes: ['Maternelle-CP', 'CE1-CE2', 'CM1-CM2', '6e-5e', '4e-3e', 'Lycéens'],
      livres: [{ id: 'l1', titre: 'Parcours « Viens, suis-moi » CM1', prix: 12, groupe: 'CM1-CM2', stock: 14 }, { id: 'l2', titre: 'Bible des enfants', prix: 20, groupe: '', stock: null }, { id: 'l3', titre: 'Cahier de première communion', prix: 8, groupe: 'CE1-CE2', stock: 0 }],
      commandes: [{ id: 'k1', cree_le: '2026-11-19T10:00:00Z', nom: 'Claire Weber', email: 'claire.w@example.fr', telephone: '06 55 44 33 22', lignes: [{ titre: 'Parcours « Viens, suis-moi » CM1', prix: 12, qte: 1, pour: 'Hugo' }], total: 12, statut: 'en_attente', remis: false, source: 'Inscription au catéchisme', reste: 12, paiements: [], lien_paiement: 'https://secretariat.croix-glorieuse.org/paiement/?o=livres&c=…' },
        { id: 'k2', cree_le: '2026-11-20T15:00:00Z', nom: 'Jean Dupont', email: 'jean@example.fr', telephone: '', lignes: [{ titre: 'Bible des enfants', prix: 20, qte: 2 }], total: 40, statut: 'payee', remis: false, source: 'Boutique', reste: 0, paiements: [{ id: 'q', date: '2026-11-20', montant: 40, mode: 'HelloAsso', par: 'Paiement en ligne' }] }] }
    case 'livres.catalogue': etat.livres.livres = p.livres.map((l, i) => ({ ...l, id: l.id || 'n' + i, prix: Number(l.prix) || 0, stock: l.stock === '' ? null : Number(l.stock) })); return etat.livres
    case 'livres.commande': { const c = etat.livres.commandes.find((x) => x.id === p.id); if (p.remis !== undefined) c.remis = p.remis; if (p.statut) c.statut = p.statut; if (p.ajouter) { c.paiements.push({ id: 'q' + Date.now(), date: new Date().toISOString(), montant: Number(p.ajouter.montant), mode: p.ajouter.mode, par: moi.nom }); c.reste = c.total - c.paiements.reduce((a, x) => a + x.montant, 0); if (c.reste <= 0) c.statut = 'payee' } return etat.livres }
    case 'espace.etat': case 'espace.lien': case 'espace.lettre': case 'espace.signalement': case 'parrain.ecrire': case 'parrain.envoyer': {
      etat.esp ||= {}
      const e = etat.esp[p.id] ||= { existe: p.id === 'd2', lien: 'https://app.croix-glorieuse.org/?c=' + 'f'.repeat(32), mot_de_passe: p.id === 'd2' ? '2026-11-20T10:00:00Z' : '', derniere_visite: p.id === 'd2' ? new Date(Date.now() - 3 * 3600e3).toISOString() : '', mail: 'sarah.k@example.fr',
        lettre: p.id === 'd2' ? { texte: '', statut: 'deposee', mode: 'app', deposee_le: '2026-11-22T18:00:00Z', fichier: '#', remarque: '' } : p.id === 'd5' ? { texte: '', statut: 'annoncee', mode: 'presbytere', annoncee_le: '2026-11-21T10:00:00Z', remarque: '' } : { texte: '', statut: '' } }
      e.signalements ||= p.id === 'd2' ? [{ id: 's1', date: '2026-11-21T09:00:00Z', sujet: 'Mon parcours', texte: "L'étape « Entrée en catéchuménat » est cochée mais je ne l'ai pas encore vécue.", statut: 'ouvert' }] : []
      if (action === 'espace.signalement') { const z = e.signalements.find((x) => x.id === p.signalement); if (p.rouvrir) Object.assign(z, { statut: 'ouvert', traite_le: '' }); else Object.assign(z, { statut: 'traite', traite_le: new Date().toISOString(), traite_par: moi.nom, reponse: p.reponse }) }
      e.parrains ||= p.id === 'd2' ? [{ id: 'p1', role: 'marraine', nom: 'Anne Roth', email: 'anne.roth@example.fr', envoye_le: '2026-11-15T10:00:00Z', cert_le: '', lien: 'https://app.croix-glorieuse.org/parrain/?p=' + 'e'.repeat(32) }] : []
      if (action === 'parrain.ecrire') { if (p.parrain.supprimer) e.parrains = e.parrains.filter((z) => z.id !== p.parrain.supprimer); else e.parrains.push({ ...p.parrain, id: 'p' + Date.now(), envoye_le: '', cert_le: '', lien: 'https://app.croix-glorieuse.org/parrain/?p=' + 'f'.repeat(32) }) }
      if (action === 'parrain.envoyer') e.parrains.find((z) => z.id === p.parrain_id).envoye_le = new Date().toISOString()
      if (action === 'espace.lien') e.existe = true
      if (p.corriger) { e.lettre.statut = 'a_corriger'; e.lettre.remarque = p.remarque }
      if (p.valider || p.recue) e.lettre.statut = 'validee'
      return e
    }
    case 'textes.liste': return etat.textes ||= { promotions: [{ cle: 'tous', nom: 'Tous (catéchumènes et néophytes)' }, { cle: 'cat:2027', nom: 'Catéchumènes – baptême 2027' }, { cle: 'cat:attente', nom: 'Catéchumènes en attente' }, { cle: 'neo:2026', nom: 'Néophytes – baptisés en 2026' }, { cle: 'neo:tous', nom: 'Tous les néophytes' }],
      personnes: [{ id: 'd2', nom: 'Sarah KESSLER', espace: true }, { id: 'd4', nom: 'Tom BECKER', espace: false }],
      textes: [{ id: 't1', cree_le: '2026-11-18T09:00:00Z', auteur: 'abbé Florent Molin', titre: 'Le Notre Père – 3e rencontre', corps: 'Relisez Matthieu 6, 9-13…', cible: 'cat:2027', cible_nom: 'Catéchumènes – baptême 2027', fichiers: [{ id: 'f1', nom: 'Notre-Pere.pdf' }], liens: [{ url: 'https://youtu.be/x', libelle: 'Vidéo' }], nb_dest: 19, nb_lus: 7, lus: [{ nom: 'Sarah KESSLER', lu: '2026-11-18T20:00:00Z' }, { nom: 'Tom BECKER', lu: '' }] }],
      calendrier: [{ id: 'c1', date: '2027-02-14', heure_debut: '10:30', heure_fin: '', titre: 'Appel décisif', lieu: 'Cathédrale de Strasbourg', cible: 'cat:2027', cible_nom: 'Catéchumènes – baptême 2027', note: '' }] }
    case 'textes.ecrire': { const v = p.texte; if (v.id) Object.assign(etat.textes.textes.find((t) => t.id === v.id), v); else etat.textes.textes.unshift({ ...v, id: 't' + Date.now(), cree_le: new Date().toISOString(), auteur: moi.nom, cible_nom: etat.textes.promotions.find((x) => x.cle === v.cible)?.nom || 'Une personne', fichiers: (v.nouveaux || []).map((f, i) => ({ id: 'n' + i, nom: f.nom })), nb_dest: 3, nb_lus: 0, lus: [] }); return etat.textes }
    case 'textes.supprimer': etat.textes.textes = etat.textes.textes.filter((t) => t.id !== p.id); return etat.textes
    case 'calendrier.ecrire': { if (p.supprimer) etat.textes.calendrier = etat.textes.calendrier.filter((x) => x.id !== p.supprimer); else { const e = p.evenement; const x = etat.textes.calendrier.find((y) => y.id === e.id); if (x) Object.assign(x, e); else etat.textes.calendrier.push({ ...e, id: 'c' + Date.now(), cible_nom: etat.textes.promotions.find((y) => y.cle === e.cible)?.nom }) } return etat.textes }
    case 'retraites.liste': return { annee: p.annee || '2026-2027', annees: ['2026-2027'], retraites: etat.retraites.filter((r) => r.annee === (p.annee || '2026-2027')).map(retResume) }
    case 'retraites.lire': return retLire(p.id)
    case 'retraites.ecrire': {
      const v = p.retraite; let r = etat.retraites.find((x) => x.id === v.id)
      if (!r) { r = { id: 'r' + Date.now(), jeton: Math.random().toString(16).slice(2).padEnd(32, '0'), inscriptions: [] }; etat.retraites.push(r) }
      Object.assign(r, v, { ouverte: v.ouverte ? 'oui' : 'non', annee: v.annee || '2026-2027', date_fin: v.date_fin || v.date_debut, prix: v.prix.filter((l) => l.libelle).map((l, i) => ({ ...l, id: l.id || 'l' + i + Date.now(), montant: Number(l.montant) || 0 })) })
      return retLire(r.id)
    }
    case 'retraites.supprimer': etat.retraites = etat.retraites.filter((r) => r.id !== p.id); return true
    case 'retraites.inscription': {
      const r = etat.retraites.find((y) => y.inscriptions.some((x) => x.id === p.id)), x = r.inscriptions.find((y) => y.id === p.id)
      if (p.ajouter) x.paiements.push({ id: 'p' + Date.now(), date: p.ajouter.date, montant: Number(p.ajouter.montant), mode: p.ajouter.mode, par: moi.nom })
      if (p.retirer) x.paiements = x.paiements.filter((y) => y.id !== p.retirer)
      if (p.statut) x.statut = p.statut
      return retLire(r.id)
    }
    case 'retraites.invites': {
      const r = etat.retraites.find((x) => x.id === p.id)
      const types = r.type === 'confirmation_adultes' ? ['confirmand', 'catechumene'] : [{ premiere_communion: 'premiere_communion', profession_foi: 'profession_foi', confirmation_jeunes: 'confirmation_jeune' }[r.type]]
      const inscrits = r.inscriptions.flatMap((x) => x.participants.map((q) => q.dossier_id)).filter(Boolean)
      return etat.dossiers.filter((d) => types.includes(d.type) && d.etat === 'ouvert').map((d) => ({ id: d.id, type: d.type, nom: nomDe(d), email: d.email, inscrit: inscrits.includes(d.id) }))
    }
    case 'retraites.inviter': return { nb: p.ids.length }
    case 'cor.relier': {
      const m = etat.cor.membres.find((x) => x.id === p.fiche_id)
      if (p.delier) m.dossiers = m.dossiers.filter((y) => y.id !== p.dossier_id)
      else { etat.cor.membres.forEach((x) => { if (x.annee === m.annee) x.dossiers = x.dossiers.filter((y) => y.id !== p.dossier_id) }); m.dossiers.push({ id: p.dossier_id, mode: 'manuel' }) }
      return { fraternite: fratDemo(p.dossier_id) }
    }
    case 'dossiers.creer': { const d = { id: 'd' + Date.now(), type: p.type, etat: 'ouvert', cree_le: new Date().toISOString(), source: 'Saisie : ' + moi.nom, email: p.infos?.email || '', telephone: p.infos?.telephone || '', date_celebration: '', evenement_id: '', responsable: p.responsable || '', maj_le: new Date().toISOString(), infos: p.infos || {}, etapes: {}, documents: {}, rencontres: [], pieces: [], fils: p.filId ? [p.filId] : [], historique: [{ date: new Date().toISOString(), par: moi.nom, texte: 'Dossier créé' }] }; etat.dossiers.unshift(d); if (p.filId) { const f = etat.fils.find((x) => x.id === p.filId); f.suivi = { ...(f.suivi || {}), dossier_id: d.id } } return complet(d) }
    case 'dossiers.modifier': {
      const d = etat.dossiers.find((x) => x.id === p.id)
      const avant = d.date_celebration
      Object.assign(d, p, { maj_le: new Date().toISOString() })
      if (d.date_celebration !== avant) {
        etat.evenements = etat.evenements.filter((e) => e.dossier !== d.id)
        if (d.date_celebration && d.etat !== 'annule') { const e = { id: 'e' + Date.now(), titre: TITRES[d.type], lieu: d.infos.lieu_celebration || '', description: '', journee: false, debut: d.date_celebration, fin: new Date(new Date(d.date_celebration).getTime() + 3600000).toISOString(), recurrent: false, dossier: d.id }; etat.evenements.push(e); d.evenement_id = e.id }
        d.historique.push({ date: new Date().toISOString(), par: moi.nom, texte: d.date_celebration ? 'Date de célébration fixée (agenda public mis à jour)' : 'Date retirée' })
      }
      d.email = d.infos.email || d.email; d.telephone = d.infos.telephone || d.telephone
      return complet(d)
    }
    case 'dossiers.piece': case 'dossiers.archiver': {
      const d = etat.dossiers.find((x) => x.id === p.dossierId)
      d.pieces.push({ id: 'p' + Date.now(), libelle: p.libelle, date: new Date().toISOString(), par: moi.nom, genere: action === 'dossiers.archiver' })
      if (p.doc) d.documents[p.doc] = { recu: true, date: new Date().toISOString() }
      if (p.doc === 'photo' && p.mini) d.photo = p.mini
      d.historique.push({ date: new Date().toISOString(), par: moi.nom, texte: (action === 'dossiers.archiver' ? 'Document généré : ' : 'Pièce ajoutée : ') + p.libelle })
      return complet(d)
    }
    case 'documents.liste': {
      const cle = p.id || ''; const d = dossiersDrive[cle] || { nom: cle, dossiers: [], fichiers: [] }
      const ariane = cle === '' ? [{ id: '', nom: 'Secrétariat' }] : cle === 'a-ranger' ? [{ id: '', nom: 'Secrétariat' }, { id: 'a-ranger', nom: 'À ranger (Mon Drive)' }] : [{ id: '', nom: 'Secrétariat' }, { id: cle, nom: d.nom }]
      return { id: cle || 'root', nom: d.nom, aRanger: cle === 'a-ranger', ariane, dossiers: d.dossiers.map((n) => ({ id: n, nom: n, aRanger: cle === 'a-ranger' })), fichiers: d.fichiers.map((f) => ({ ...f, aRanger: cle === 'a-ranger' })) }
    }
    case 'promotions.liste': return etat.promotions ||= { 'premiere_communion|2026-2027': { date: jour(178, 10, 30), lieu: 'Église', evenement_id: 'ep' } }
    case 'promotions.fixer': { etat.promotions ||= {}; etat.promotions[p.type + '|' + p.annee] = { date: p.date, lieu: p.lieu, evenement_id: 'ep' }; return etat.promotions }
    case 'agenda.rendezvous': return [
      { id: 'r1', titre: 'Rendez-vous M. le curé – Julie Weber', lieu: 'Presbytère', debut: jour(5, 17, 30), fin: jour(5, 18), invites: ['julie.weber@example.fr'], correspond: p.email === 'julie.weber@example.fr' },
      { id: 'r2', titre: 'Rendez-vous M. le curé', lieu: 'Presbytère', debut: jour(6, 18), fin: jour(6, 18, 30), invites: ['autre@example.fr'], correspond: false }
    ].sort((a, b) => b.correspond - a.correspond)
    case 'extraits.liste': return { extraits: (etat.extraits ||= [{ id: 'x1', cree_le: jour(-3), cree_par: 'Bertille Bauer', dossier_id: '', nom: 'Marie LAMBERT', valeurs: { paroisse: 'Paroisse personnelle La Croix glorieuse', diocese: 'Strasbourg', annee: '1994', acte: '27', prenoms: 'Marie', nom: 'LAMBERT', ne_le: '3 mars 1994', ne_a: 'Strasbourg', baptise_le: '15 mai 1994', eglise: 'Saint-Louis', de: 'Strasbourg', diocese_de: 'Strasbourg', marie_le: '', marie_a: '', fait_a: 'Strasbourg', fait_le: '17 novembre 2026' }, statut: 'brouillon', envois: [] }]), peutSigner: true }
    case 'extraits.lire': { (etat.extraits ||= []); const x = etat.extraits.find((e) => e.id === p.id); return { ...x, peutSigner: true } }
    case 'extraits.enregistrer': {
      etat.extraits ||= []
      let x = p.id && etat.extraits.find((e) => e.id === p.id)
      if (!x) { x = { id: 'x' + Date.now(), cree_le: new Date().toISOString(), cree_par: moi.nom, dossier_id: p.dossier_id || '', statut: 'brouillon', envois: [] }; etat.extraits.unshift(x) }
      if (x.statut === 'signe' && JSON.stringify(x.valeurs) !== JSON.stringify(p.valeurs)) x.statut = 'brouillon'
      x.valeurs = p.valeurs; x.nom = [p.valeurs.prenoms, String(p.valeurs.nom || '').toUpperCase()].filter(Boolean).join(' ') || '(sans nom)'
      return { ...x, peutSigner: true }
    }
    case 'extraits.signer': { const x = etat.extraits.find((e) => e.id === p.id); Object.assign(x, { statut: 'signe', signe_par: moi.nom, signe_le: new Date().toISOString(), sig: p.signature }); return { ...x, peutSigner: true } }
    case 'extraits.signature': return etat.extraits.find((e) => e.id === p.id)?.sig || ''
    case 'extraits.envoyer': { const x = etat.extraits.find((e) => e.id === p.id); x.envois = [...x.envois, { a: p.a, date: new Date().toISOString(), par: moi.nom }]; return { ...x, peutSigner: true } }
    case 'dossiers.signerB6': {
      const d = etat.dossiers.find((x) => x.id === p.dossierId)
      d.pieces.push({ id: 'b6' + Date.now(), libelle: 'B6 – entrée en catéchuménat (signé)', date: new Date().toISOString(), par: moi.nom, genere: true })
      d.etapes.entree = { fait: true, date: new Date().toISOString(), par: moi.nom, libelle: 'Entrée en catéchuménat' }
      d.infos.b6_signe_le = new Date().toISOString(); etat.dernierB6 = p.pdf
      return complet(d)
    }
    case 'dossiers.supprimer': etat.dossiers = etat.dossiers.filter((d) => d.id !== p.id); etat.evenements = etat.evenements.filter((e) => e.dossier !== p.id); return true
    case 'extraits.supprimer': etat.extraits = etat.extraits.filter((e) => e.id !== p.id); return true
    case 'sceau.lire': return etat.sceau || ''
    case 'sceau.ecrire': etat.sceau = 'data:' + p.type + ';base64,' + p.base64; return etat.sceau
    case 'documents.chercher': return Object.values(dossiersDrive).flatMap((d) => d.fichiers).filter((f) => f.nom.toLowerCase().includes(String(p.texte).toLowerCase()))
    case 'documents.envoyer': case 'documents.dossier': case 'documents.renommer': case 'documents.deplacer': return true
    case 'annonces.liste': return etat.annoncesNl.slice().sort((a, b) => (b.prioritaire ? 1 : 0) - (a.prioritaire ? 1 : 0) || (a.ordre ?? 1e9) - (b.ordre ?? 1e9))
    case 'annonces.ecrire': { if (p.id) { const a = etat.annoncesNl.find((x) => x.id === p.id); Object.assign(a, p); return a } const a = { id: Date.now(), created_at: new Date().toISOString(), ordre: null, ...p }; etat.annoncesNl.push(a); return a }
    case 'annonces.supprimer': etat.annoncesNl = etat.annoncesNl.filter((x) => x.id !== p.id); return true
    case 'annonces.ordre': p.ids.forEach((id, i) => { const a = etat.annoncesNl.find((x) => x.id === id); if (a) a.ordre = i }); return true
    case 'annonces.image': return { url: './logo.png' }
    case 'newsletter.semaine': {
      const j = (n, h, m = 0) => { const d = new Date(p.lundi + 'T12:00:00'); d.setDate(d.getDate() + n); d.setHours(h, m, 0, 0); return d.toISOString() }
      const ev = []
      for (let n = 0; n < 6; n++) ev.push({ id: 'm' + n, summary: 'Messe', start: { dateTime: j(n, 18, 30) }, end: { dateTime: j(n, 19, 15) } })
      ev.push({ id: 'c5', summary: 'Confessions', start: { dateTime: j(5, 10) }, end: { dateTime: j(5, 12) } })
      ev.push({ id: 'a3', summary: 'Adoration', start: { dateTime: j(3, 20) }, end: { dateTime: j(3, 21) } })
      ev.push({ id: 'd1', summary: 'Grand\'messe', start: { dateTime: j(6, 10, 30) }, end: { dateTime: j(6, 12) } }, { id: 'd2', summary: 'Messe', start: { dateTime: j(6, 18, 30) }, end: { dateTime: j(6, 19, 30) } })
      ev.sort((a, b) => a.start.dateTime.localeCompare(b.start.dateTime))
      const iso = (n) => { const d = new Date(p.lundi + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
      return { lundi: p.lundi, evenements: ev, intentions: [{ date_messe: iso(1), heure_messe: '18:30', nom_intention: 'Joseph M.', type_intention: 'Défunt', google_event_id: 'm1' }, { date_messe: iso(3), heure_messe: '18:30', nom_intention: 'Pour une naissance', type_intention: 'Action de grâce', google_event_id: '' }], preparee: etat.nlSemaines[p.lundi] || null }
    }
    case 'newsletter.semaineEcrire': { if (p.effacer) { delete etat.nlSemaines[p.lundi]; return null } const x = etat.nlSemaines[p.lundi] ||= {}; if (p.jours) Object.assign(x, { jours: p.jours, par: moi.nom, le: new Date().toISOString() }); if (p.html) Object.assign(x, { html: p.html, envoye_par: moi.nom, envoye_le: new Date().toISOString() }); return x }
    case 'newsletter.lire': return { lundi: p.lundi, annonces: etat.annoncesNl.filter((a) => a.actif && a.dans_newsletter), calendrier: etat.nlSemaines[p.lundi]?.html ? { html: etat.nlSemaines[p.lundi].html, par: etat.nlSemaines[p.lundi].envoye_par, le: etat.nlSemaines[p.lundi].envoye_le } : null, semaines_envoyees: Object.keys(etat.nlSemaines).filter((k) => etat.nlSemaines[k].html), brouillon: etat.nlBrouillons[p.lundi] || null, campagne: etat.nlCampagne, autres_programmees: etat.nlCampagne ? [{ id: etat.nlCampagne.id, sujet: etat.nlCampagne.sujet, envoi_le: etat.nlCampagne.envoi_le }] : [], brevo_ok: true, adresses_test: ['cure@croix-glorieuse.org'], prochain_envoi: (() => { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); d.setHours(12, 0, 0, 0); return d.toISOString() })() }
    case 'newsletter.brouillon': if (p.html) etat.nlBrouillons[p.lundi] = { html: p.html, par: moi.nom, le: new Date().toISOString() }; else delete etat.nlBrouillons[p.lundi]; return etat.nlBrouillons[p.lundi] || null
    case 'newsletter.programmer': { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); d.setHours(12, 0, 0, 0); return (etat.nlCampagne = { id: 101, lundi: p.lundi, sujet: p.sujet, envoi_le: d.toISOString(), par: moi.nom, statut: 'queued' }) }
    case 'newsletter.annuler': etat.nlCampagne = null; return true
    case 'newsletter.test': return { adresses: ['cure@croix-glorieuse.org'] }
    case 'newsletter.reglages': case 'newsletter.reglagesEcrire': return { liste: 3, jour: 0, heure: '12:00', expediteur_nom: 'Paroisse La Croix Glorieuse', expediteur_email: 'secretariat@croix-glorieuse.org', supabase_url: 'https://pmeaimfcwtykhqtueomd.supabase.co', adresses_test: 'cure@croix-glorieuse.org', supabase_secret_ok: false, brevo_ok: true, prochain_envoi: new Date(Date.now() + 3 * 86400000).toISOString() }
    case 'newsletter.tester': return { supabase: '✓ Base des annonces : 3 annonce(s) lue(s) avec la clé publique.', brevo: '✓ Brevo : compte secretariat@croix-glorieuse.org — liste « Newsletter » (412 abonnés).' }
    default: throw new Error('Démo : action non simulée ' + action)
  }
}
