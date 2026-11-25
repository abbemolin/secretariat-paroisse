/**
 * Modèles de courriers (attestation, autorisation, certificat d'aptitude, lettre libre) :
 * textes modifiables dans Réglages → Modèles ; le PDF signé (avec le sceau) est fabriqué par l'appli,
 * rangé dans les pièces du dossier et peut être envoyé par mail en un clic.
 * Variables : voir VARIABLES_COURRIER dans app/src/pages/Courriers.jsx
 */
var MODELES_DEFAUT = [
  { cle: 'attestation', titre: 'Attestation de préparation', objet: 'Attestation de préparation {a_sacrement}',
    corps: 'Je soussigné, {signataire}, {fonction} de la {paroisse}, atteste que\n\n{nom_complet}, né(e) le {ne_le}{ne_a},\n\na suivi la préparation {a_sacrement} dans notre paroisse.\n\nCette attestation est délivrée pour servir et valoir ce que de droit.' },
  { cle: 'autorisation', titre: 'Autorisation (licence)', objet: 'Autorisation pour la célébration {du_sacrement}',
    corps: 'Je soussigné, {signataire}, {fonction} de la {paroisse} (diocèse de {diocese}), donne licence pour la célébration {du_sacrement} de\n\n{nom_complet}\n\nle {date_celebration} en l\'église {lieu_celebration}{par_celebrant}.\n\nLe célébrant voudra bien nous faire parvenir les éléments nécessaires à l\'inscription au registre de notre paroisse.' },
  { cle: 'aptitude', titre: 'Certificat d\'aptitude (parrain / marraine)', objet: 'Certificat d\'aptitude à la charge de {charge}',
    corps: 'Je soussigné, {signataire}, {fonction} de la {paroisse}, certifie que\n\n{nom_complet}, né(e) le {ne_le}{ne_a},\n\nest connu(e) de notre communauté et remplit les conditions requises par le droit de l\'Église (canon 874) pour exercer la charge de {charge}{en_vue} : être baptisé(e) et confirmé(e), avoir reçu l\'eucharistie et mener une vie cohérente avec la foi et la charge à assumer.' },
  { cle: 'recommandation', titre: 'Lettre de recommandation', objet: 'Lettre de recommandation – {recommande}',
    corps: 'Madame, Monsieur,\n\nJe soussigné, {signataire}, {fonction} de la {paroisse}, recommande volontiers {recommande}{pour_motif}.\n\n[À compléter : depuis quand je connais la personne, sa participation à la vie de la paroisse, ce qui motive ma recommandation.]\n\nJe vous remercie de l\'attention que vous porterez à sa demande et vous prie d\'agréer, Madame, Monsieur, l\'expression de mes sentiments dévoués.' },
  { cle: 'lettre', titre: 'Lettre libre à en-tête', objet: '',
    corps: 'Madame, Monsieur,\n\n\n\nAvec l\'assurance de nos prières à toutes vos intentions,' }
];
function modeles_() {
  var stock = json2_(props_().getProperty('MODELES'), {});
  return MODELES_DEFAUT.map(function (m) {
    var x = stock[m.cle] || {};
    return { cle: m.cle, titre: m.titre, objet: x.objet != null ? x.objet : m.objet, corps: x.corps != null ? x.corps : m.corps, modifie: !!stock[m.cle] };
  });
}
function modelesRoute_(p, s) {
  if (p.ecrire) {
    var stock = json2_(props_().getProperty('MODELES'), {});
    (p.ecrire || []).forEach(function (m) {
      var defaut = MODELES_DEFAUT.filter(function (x) { return x.cle === m.cle; })[0];
      if (!defaut) return;
      if (m.retablir) delete stock[m.cle]; else stock[m.cle] = { objet: String(m.objet || ''), corps: String(m.corps || '') };
    });
    props_().setProperty('MODELES', JSON.stringify(stock));
    journaliser_(s, 'Modèles de courriers modifiés', '');
  }
  return { modeles: modeles_(), signatures: signaturesListe_() };
}
function signaturesListe_() {
  try { return json2_(props_().getProperty('SIGNATURES'), SIGNATURES_DEFAUT).map(function (x) { return { cle: x.cle, nom: x.nom, fonction: x.fonction }; }); } catch (e) { return []; }
}
/** Archive le PDF dans le dossier ; avec p.a, l'envoie aussi par mail en pièce jointe. */
/** Certificat parrain/marraine, lettre de recommandation : le courrier signé coche « signé » (0), puis « envoyé » (1). */
var ETAPES_COURRIER = { parrainage: [['certificat', 'Certificat signé'], ['envoye', 'Certificat envoyé']], recommandation: [['lettre', 'Lettre signée'], ['envoye', 'Lettre envoyée']] };
function cocherEtapeCourrier_(id, n, s) {
  var d = trouverDossier_(id), e = (ETAPES_COURRIER[d.type] || [])[n];
  if (!e) return;
  var don = json2_(d.donnees, {}); don.etapes = don.etapes || {};
  if (don.etapes[e[0]] && don.etapes[e[0]].fait) return;
  don.etapes[e[0]] = { fait: true, date: maintenant_(), par: s.nom, libelle: e[1] };
  d.donnees = JSON.stringify(don); ecrireLigne_('Dossiers', d);
}
function courrierRoute_(p, s) {
  if (!p.pdf || !p.dossierId) throw erreur_('PARAMETRE', 'Document manquant.');
  var res = verrou_(function () {
    var d = trouverDossier_(p.dossierId);
    var blob = Utilities.newBlob(Utilities.base64Decode(p.pdf), 'application/pdf', nomFichierDossier_(d, p.libelle || 'Courrier', 'pdf'));
    var f = dossierDriveDe_(d).createFile(blob);
    enregistrerPiece_(d, f, p.libelle || 'Courrier', '', s, true);
    cocherEtapeCourrier_(d.id, 0, s);
    return { d: d, fichier: f };
  });
  if (p.a) {
    var opts = optionsEnvoi_();
    opts.htmlBody = corpsHtml_(p.corps || '', p.signatureMail);
    opts.attachments = [res.fichier.getBlob()];
    GmailApp.sendEmail(p.a, p.sujet || p.libelle || 'Courrier', corpsTexte_(p.corps || '', p.signatureMail), opts);
    verrou_(function () {
      var d = trouverDossier_(p.dossierId);
      ajouterHistorique_(d, s.nom, 'Envoyé par mail : ' + (p.libelle || 'Courrier') + ' → ' + p.a);
      ecrireLigne_('Dossiers', d);
      cocherEtapeCourrier_(d.id, 1, s);
    });
    journaliser_(s, 'Courrier envoyé', (p.libelle || '') + ' → ' + p.a);
  }
  return dossierComplet_(trouverDossier_(p.dossierId));
}
