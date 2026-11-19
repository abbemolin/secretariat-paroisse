// Mode démonstration (?demo dans l'adresse) : données fictives en mémoire, rien n'est envoyé.
const jour = (d, h = 0, m = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString() }
const DROITS = { admin: ['mail', 'agenda', 'dossiers', 'documents', 'utilisateurs', 'reglages'], cure: ['mail', 'agenda', 'dossiers', 'documents'], secretaire: ['mail', 'agenda', 'dossiers', 'documents', 'reglages'] }

const etat = {
  reglages: { paroisse: 'Paroisse personnelle La Croix glorieuse', paroisse_courte: 'La Croix glorieuse', diocese: 'Strasbourg', commune: 'Strasbourg', eglise: '', adresse: '2, quai Charles Frey 67000 Strasbourg', site: 'croix-glorieuse.org', url_horaires: 'https://www.croix-glorieuse.org/horaires', url_icones: '' },
  utilisateurs: [
    { id: 'u1', identifiant: 'florent', nom: 'abbé Florent Molin', role: 'admin', signature: 'cure', actif: true, derniere_connexion: jour(0, 9) },
    { id: 'u2', identifiant: 'guillaume', nom: 'abbé Guillaume Le Gall', role: 'cure', signature: 'vicaire', actif: true, derniere_connexion: jour(-1, 18) },
    { id: 'u3', identifiant: 'bertille', nom: 'Bertille Bauer', role: 'secretaire', signature: 'secretaire', actif: true, derniere_connexion: jour(0, 8, 30) }
  ],
  signatures: [
    { cle: 'cure', nom: 'abbé Florent Molin', fonction: 'Curé', email: 'cure@croix-glorieuse.org', telephone: '06 98 74 02 46' },
    { cle: 'paroisse', nom: 'Paroisse personnelle La Croix glorieuse', fonction: 'Strasbourg', email: 'secretariat@croix-glorieuse.org', telephone: '03 88 36 08 42' },
    { cle: 'secretaire', nom: 'Bertille BAUER', fonction: 'Secrétaire', email: 'secretariat@croix-glorieuse.org', telephone: '03 88 36 08 42' },
    { cle: 'vicaire', nom: 'Abbé Guillaume LE GALL', fonction: 'Vicaire', email: 'secretariat@croix-glorieuse.org', telephone: '03 88 36 08 42' }
  ],
  reponses: [
    { cle: 'accuse_bapteme', titre: 'Accusé de réception – baptême', sujet: 'Votre demande de baptême', corps: "Bonjour,\n\nNous avons bien reçu votre demande de baptême pour {nom} et nous nous en réjouissons avec vous.\n\nNous vous recontacterons prochainement pour convenir d'une rencontre de préparation.\n\nBien fraternellement," },
    { cle: 'accuse_mariage', titre: 'Accusé de réception – mariage', sujet: 'Votre demande de mariage', corps: 'Bonjour,\n\nNous avons bien reçu votre demande de mariage ({nom}) et nous nous en réjouissons avec vous.\n\nBien fraternellement,' },
    { cle: 'horaires', titre: 'Horaires de la paroisse', sujet: 'Horaires de la paroisse La Croix glorieuse', corps: 'Bonjour,\n\nVous trouverez les horaires, toujours à jour, sur notre site :\n{url_horaires}\n\nBien fraternellement,' },
    { cle: 'document_manquant', titre: 'Document manquant', sujet: 'Dossier de {type} – document(s) à fournir', corps: 'Bonjour,\n\nPour compléter le dossier de {type} ({nom}), il nous manque encore :\n{documents_manquants}\n\nMerci d\'avance, bien fraternellement,' }
  ],
  notifications: [
    { id: 'n1', date: jour(0, 10, 13), titre: 'Nouvelle demande : Baptême', texte: 'Louise WEBER', lien: '#/dossiers/d1', lu: false },
    { id: 'n2', date: jour(0, 9, 2), titre: 'Mail attribué par Bertille Bauer', texte: 'Réservation salle – répétition chorale', lien: '#/courrier?fil=t2', lu: false }
  ],
  fils: [
    { id: 't1', sujet: 'Demande de baptême pour notre fille', de: 'Julie Weber <julie.weber@example.fr>', a: 'secretariat@croix-glorieuse.org', date: jour(0, 10, 12), extrait: 'Bonjour, nous souhaiterions faire baptiser notre fille Louise au printemps…', nonLu: true, nb: 1, important: false, libelles: [], suivi: { statut: 'À traiter', attribue_a: 'u3', dossier_id: 'd1' } },
    { id: 't2', sujet: 'Réservation salle – répétition chorale', de: 'Marc Hoffmann <marc.h@example.fr>', a: 'secretariat@croix-glorieuse.org', date: jour(0, 8, 47), extrait: 'Serait-il possible de réserver la salle jeudi soir de 20h à 22h ?', nonLu: true, nb: 2, important: true, libelles: [], suivi: { statut: 'En cours', attribue_a: 'u1', dossier_id: '' } },
    { id: 't3', sujet: 'Obsèques de M. Schmitt', de: 'Pompes funèbres Klein <contact@pf-klein.example>', a: 'secretariat@croix-glorieuse.org', date: jour(-1, 16, 5), extrait: 'Nous vous confirmons la levée du corps samedi à 9h30, cérémonie à 10h…', nonLu: false, nb: 3, important: false, libelles: [], suivi: { statut: 'Traité', attribue_a: '', dossier_id: 'd3' } },
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
    { id: 'd2', type: 'catechumene', etat: 'ouvert', cree_le: jour(-60), source: 'Formulaire du site', email: 'sarah.k@example.fr', telephone: '06 55 44 33 22', date_celebration: '', evenement_id: '', responsable: 'u1', maj_le: jour(-3),
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

const pub = (u) => ({ ...u, droits: DROITS[u.role] })
const resume = (d) => ({ ...d, nom: nomDe(d), preparation: d.infos.preparation === 'Autre école' ? d.infos.ecole_autre : d.infos.preparation || '', etapes: Object.keys(d.etapes).filter((k) => d.etapes[k]?.fait), documents: Object.keys(d.documents).filter((k) => d.documents[k]?.recu), date_souhaitee: d.infos.date_souhaitee || '', annee: d.infos.annee_sacrements || d.infos.annee_scolaire || '' })
const complet = (d) => ({ ...d, nom: nomDe(d), historique: [...d.historique].reverse(), fils: d.fils.map((id) => etat.fils.find((f) => f.id === id)).filter(Boolean).map((f) => ({ id: f.id, sujet: f.sujet, date: f.date })) })
function nomDe(d) {
  const i = d.infos, np = (p, n) => [p, String(n || '').toUpperCase()].filter(Boolean).join(' ')
  if (['bapteme', 'premiere_communion', 'profession_foi'].includes(d.type)) return np(i.enfant_prenoms, i.enfant_nom)
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
  const moi = etat.utilisateurs[0]
  switch (action) {
    case 'auth.login': return { token: 'demo', utilisateur: pub(moi) }
    case 'app.init': return { utilisateur: pub(moi), utilisateurs: etat.utilisateurs.map(({ id, nom, role }) => ({ id, nom, role })), reglages: etat.reglages, signatures: etat.signatures, reponses: etat.reponses, nonLues: etat.notifications.filter((n) => !n.lu).length }
    case 'auth.logout': case 'auth.motdepasse': case 'push.abonner': case 'push.desabonner': case 'push.tester': return true
    case 'push.cle': return ''
    case 'accueil.resume': {
      const ouverts = etat.dossiers.filter((d) => d.etat === 'ouvert')
      return { mailsNonLus: etat.fils.filter((f) => f.nonLu).length, mesMails: etat.fils.filter((f) => f.suivi?.attribue_a === moi.id && f.suivi.statut !== 'Traité').length,
        dossiersOuverts: ouverts.length, mesDossiers: ouverts.filter((d) => d.responsable === moi.id).map(resume),
        nouveaux: ouverts.filter((d) => Object.keys(d.etapes).length <= 1).map(resume),
        evenements: etat.evenements.filter((e) => new Date(e.debut) < Date.now() + 7 * 864e5 && new Date(e.fin) > new Date().setHours(0, 0, 0, 0)).sort((a, b) => a.debut.localeCompare(b.debut)),
        notifications: etat.notifications }
    }
    case 'notifications.liste': return etat.notifications.filter((n) => !p.nonLues || !n.lu).slice(0, p.limite || 50)
    case 'notifications.lues': etat.notifications.forEach((n) => { if (!p.ids || p.ids.includes(n.id)) n.lu = true }); return true
    case 'utilisateurs.liste': return etat.utilisateurs.map(pub)
    case 'utilisateurs.creer': { const u = { id: 'u' + Date.now(), ...p, actif: true, derniere_connexion: '' }; etat.utilisateurs.push(u); return pub(u) }
    case 'utilisateurs.modifier': { const u = etat.utilisateurs.find((x) => x.id === p.id); Object.assign(u, p); delete u.motdepasse; return pub(u) }
    case 'journal.liste': return [{ date: jour(0, 10, 13), utilisateur: 'système', action: 'Demande reçue (site)', detail: 'Baptême – Louise WEBER' }, { date: jour(0, 9), utilisateur: 'Bertille Bauer', action: 'Suivi mail', detail: 'Réservation salle → En cours' }]
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
    case 'dossiers.liste': return etat.dossiers.map(resume).sort((a, b) => b.maj_le.localeCompare(a.maj_le))
    case 'dossiers.lire': return complet(etat.dossiers.find((x) => x.id === p.id))
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
    case 'documents.chercher': return Object.values(dossiersDrive).flatMap((d) => d.fichiers).filter((f) => f.nom.toLowerCase().includes(String(p.texte).toLowerCase()))
    case 'documents.envoyer': case 'documents.dossier': case 'documents.renommer': case 'documents.deplacer': return true
    default: throw new Error('Démo : action non simulée ' + action)
  }
}
