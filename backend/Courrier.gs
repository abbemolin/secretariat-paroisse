/**
 * Courrier : boîte Gmail de la paroisse, envoi depuis l'alias secretariat@,
 * suivi (statut, attribution, commentaires internes), envois groupés.
 */

function aliasDisponible_() {
  var c = CacheService.getScriptCache();
  var v = c.get('alias_ok');
  if (v === null) {
    v = GmailApp.getAliases().map(function (a) { return a.toLowerCase(); }).indexOf(CONFIG.ALIAS.toLowerCase()) > -1 ? '1' : '0';
    c.put('alias_ok', v, 3600);
  }
  return v === '1';
}
function optionsEnvoi_() {
  var o = { name: CONFIG.NOM_EXPEDITEUR };
  if (aliasDisponible_()) o.from = CONFIG.ALIAS;
  else throw erreur_('ALIAS', "L'adresse " + CONFIG.ALIAS + " n'est pas configurée dans Gmail (« Envoyer des e-mails en tant que »). Envoi bloqué pour ne pas exposer l'adresse Gmail.");
  return o;
}

function suivisParFil_() {
  var m = {};
  lignes_('SuiviMails').forEach(function (x) { m[x.fil_id] = x; });
  return m;
}
function suiviPublic_(x) {
  return x ? { statut: x.statut || '', attribue_a: x.attribue_a || '', dossier_id: x.dossier_id || '', maj_le: x.maj_le, maj_par: x.maj_par } : null;
}

function resumeFil_(t, suivis) {
  var msgs = t.getMessages();
  var dernier = msgs[msgs.length - 1];
  var libelles = t.getLabels().map(function (l) { return l.getName(); });
  return {
    id: t.getId(), sujet: t.getFirstMessageSubject() || '(sans objet)', de: dernier.getFrom(), a: dernier.getTo(),
    date: t.getLastMessageDate().toISOString(),
    extrait: dernier.getPlainBody().replace(/\s+/g, ' ').slice(0, 140),
    nonLu: t.isUnread(), nb: t.getMessageCount(), important: t.hasStarredMessages(),
    libelles: libelles.filter(function (l) { return l.indexOf(TRI_RACINE + '/') !== 0; }),
    tri: triDuFil_(libelles),
    suivi: suiviPublic_(suivis[t.getId()])
  };
}

var FILTRES_MAIL = {
  boite: 'in:inbox', nonlus: 'in:inbox is:unread', envoyes: 'in:sent', suivis: 'is:starred'
};

function listerMails_(p, s) {
  var suivis = suivisParFil_();
  var debut = Number(p.debut || 0), taille = Math.min(Number(p.taille || 30), 50);
  var fils;
  if (p.filtre === 'mes' || p.filtre === 'atraiter') {
    var ids = Object.keys(suivis).filter(function (id) {
      var x = suivis[id];
      return p.filtre === 'mes' ? x.attribue_a === s.uid && x.statut !== 'Traité' : x.statut && x.statut !== 'Traité';
    }).sort(function (a, b) { return String(suivis[b].maj_le).localeCompare(String(suivis[a].maj_le)); });
    fils = ids.slice(debut, debut + taille).map(function (id) { try { return GmailApp.getThreadById(id); } catch (e) { return null; } })
      .filter(function (t) { return t; });
    return { fils: fils.map(function (t) { return resumeFil_(t, suivis); }), suivant: ids.length > debut + taille ? debut + taille : null };
  }
  var q = p.libelle ? 'label:"' + String(p.libelle).replace(/"/g, '') + '"' : (FILTRES_MAIL[p.filtre] || 'in:inbox');
  if (p.recherche) q += ' ' + p.recherche;
  fils = GmailApp.search(q, debut, taille);
  return { fils: fils.map(function (t) { return resumeFil_(t, suivis); }), suivant: fils.length === taille ? debut + taille : null };
}

function commentairesDe_(cible) {
  return lignes_('Commentaires').filter(function (c) { return c.cible === cible; })
    .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })
    .map(function (c) { return { id: c.id, auteur: c.auteur, date: c.date, texte: c.texte }; });
}

function lireFil_(p) {
  var t = GmailApp.getThreadById(p.id);
  if (!t) throw erreur_('INTROUVABLE', 'Message introuvable.');
  var res = resumeFil_(t, suivisParFil_());
  res.messages = t.getMessages().map(function (m) {
    return {
      id: m.getId(), de: m.getFrom(), a: m.getTo(), cc: m.getCc(), date: m.getDate().toISOString(),
      sujet: m.getSubject(), html: m.getBody(), texte: m.getPlainBody(),
      pieces: m.getAttachments({ includeInlineImages: false }).map(function (a, i) {
        return { index: i, nom: a.getName(), type: a.getContentType(), taille: a.getSize() };
      })
    };
  });
  res.commentaires = commentairesDe_('mail:' + t.getId());
  if (t.isUnread()) t.markRead();
  return res;
}

function pieceJointe_(p) {
  var m = GmailApp.getMessageById(p.messageId);
  var a = m.getAttachments({ includeInlineImages: false })[p.index];
  if (!a) throw erreur_('INTROUVABLE', 'Pièce jointe introuvable.');
  return { nom: a.getName(), type: a.getContentType(), base64: Utilities.base64Encode(a.getBytes()) };
}

function piecesPourEnvoi_(p) {
  var blobs = [];
  (p.fichiers || []).forEach(function (f) {
    blobs.push(Utilities.newBlob(Utilities.base64Decode(f.base64), f.type || 'application/octet-stream', f.nom));
  });
  (p.documentsDrive || []).forEach(function (id) { blobs.push(blobExportable_(fichierDansRacine_(id))); });
  return blobs;
}

function corpsHtml_(texte, signature) {
  var t = echapper_(texte || '').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>');
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222">' + t + '</div>' + (signature ? signatureHtml_(signature) : '');
}
function corpsTexte_(texte, signatureCle) {
  var sig = listerSignatures_().filter(function (x) { return x.cle === signatureCle; })[0];
  var r = reglages_();
  return (texte || '') + (sig ? '\n\n' + [sig.nom, sig.fonction, sig.email, sig.telephone, r.adresse, r.site].filter(String).join('\n') : '');
}

/** Envoi d'un nouveau mail ou d'une réponse (p.filId). Retourne l'id du fil. */
function envoyerMail_(p, s) {
  var opts = optionsEnvoi_();
  opts.htmlBody = corpsHtml_(p.corps, p.signature);
  opts.attachments = piecesPourEnvoi_(p);
  var texte = corpsTexte_(p.corps, p.signature);
  var message;
  if (p.filId) {
    var t = GmailApp.getThreadById(p.filId);
    if (!t) throw erreur_('INTROUVABLE', 'Message introuvable.');
    var msgs = t.getMessages(), dernier = msgs[msgs.length - 1];
    if (p.cc) opts.cc = p.cc;
    var brouillon = p.tous ? dernier.createDraftReplyAll(texte, opts) : dernier.createDraftReply(texte, opts);
    message = brouillon.send();
  } else {
    if (!p.a) throw erreur_('INVALIDE', 'Destinataire manquant.');
    if (p.cc) opts.cc = p.cc;
    if (p.cci) opts.bcc = p.cci;
    message = GmailApp.createDraft(p.a, p.sujet || '', texte, opts).send();
  }
  var filId = message.getThread().getId();
  if (p.dossierId) lierFilAuDossier_(p.dossierId, filId, s, 'Mail envoyé : ' + (p.sujet || message.getSubject()));
  journaliser_(s, 'E-mail envoyé', (p.sujet || message.getSubject()) + ' → ' + (p.a || message.getTo()));
  return { filId: filId };
}

function listerLibelles_() {
  return GmailApp.getUserLabels().map(function (l) { return l.getName(); })
    .filter(function (n) { return n !== TRI_RACINE && n.indexOf(TRI_RACINE + '/') !== 0; }).sort();
}

function modifierFil_(p) {
  var t = GmailApp.getThreadById(p.id);
  if (!t) throw erreur_('INTROUVABLE', 'Message introuvable.');
  if (p.ajouterLibelle) (GmailApp.getUserLabelByName(p.ajouterLibelle) || GmailApp.createLabel(p.ajouterLibelle)).addToThread(t);
  if (p.retirerLibelle) { var l = GmailApp.getUserLabelByName(p.retirerLibelle); if (l) l.removeFromThread(t); }
  if (p.archiver) t.moveToArchive();
  if (p.boiteReception) t.moveToInbox();
  if (p.corbeille) t.moveToTrash();
  if (p.nonLu) t.markUnread();
  if (p.important === true) t.getMessages()[0].star();
  if (p.important === false) t.getMessages().forEach(function (m) { m.unstar(); });
  return true;
}

/** Statut, attribution, dossier lié. */
function modifierSuiviMail_(p, s) {
  var t = GmailApp.getThreadById(p.filId);
  if (!t) throw erreur_('INTROUVABLE', 'Message introuvable.');
  var avant, apres;
  verrou_(function () {
    var x = lignes_('SuiviMails').filter(function (y) { return y.fil_id === p.filId; })[0] || { fil_id: p.filId, statut: '', attribue_a: '', dossier_id: '' };
    avant = x.attribue_a;
    if (p.statut !== undefined) {
      if (p.statut && CONFIG.STATUTS_MAIL.indexOf(p.statut) === -1) throw erreur_('INVALIDE', 'Statut inconnu.');
      x.statut = p.statut;
    }
    if (p.attribue_a !== undefined) { x.attribue_a = p.attribue_a; if (p.attribue_a && !x.statut) x.statut = 'À traiter'; }
    if (p.dossier_id !== undefined) x.dossier_id = p.dossier_id;
    x.maj_le = maintenant_(); x.maj_par = s.nom;
    ecrireLigne_('SuiviMails', x);
    apres = x;
  });
  if (p.attribue_a && p.attribue_a !== avant && p.attribue_a !== s.uid) {
    notifier_(p.attribue_a, 'Mail attribué par ' + s.nom, t.getFirstMessageSubject(), '#/courrier?fil=' + p.filId);
  }
  journaliser_(s, 'Suivi mail', t.getFirstMessageSubject() + ' → ' + (apres.statut || '—'));
  return suiviPublic_(apres);
}

function commenterMail_(p, s) {
  if (!String(p.texte || '').trim()) throw erreur_('INVALIDE', 'Commentaire vide.');
  var t = GmailApp.getThreadById(p.filId);
  if (!t) throw erreur_('INTROUVABLE', 'Message introuvable.');
  var c = ecrireLigne_('Commentaires', { id: uid_(), cible: 'mail:' + p.filId, auteur: s.nom, date: maintenant_(), texte: String(p.texte) });
  var suivi = suivisParFil_()[p.filId];
  if (suivi && suivi.attribue_a && suivi.attribue_a !== s.uid) {
    notifier_(suivi.attribue_a, 'Commentaire de ' + s.nom, t.getFirstMessageSubject() + ' : ' + String(p.texte).slice(0, 80), '#/courrier?fil=' + p.filId);
  }
  return { id: c.id, auteur: c.auteur, date: c.date, texte: c.texte };
}

// ─── Envois groupés (groupes Google Contacts, via le service avancé People) ───

function listerGroupesContacts_() {
  var r = People.ContactGroups.list({ pageSize: 200, groupFields: 'name,groupType,memberCount' });
  return (r.contactGroups || []).filter(function (g) { return g.groupType === 'USER_CONTACT_GROUP'; })
    .map(function (g) { return { id: g.resourceName, nom: g.name, nb: g.memberCount || 0 }; })
    .sort(function (a, b) { return a.nom.localeCompare(b.nom); });
}

function emailsDuGroupe_(resourceName) {
  var g = People.ContactGroups.get(resourceName, { maxMembers: 1000 });
  var membres = g.memberResourceNames || [];
  var emails = [];
  for (var i = 0; i < membres.length; i += 200) {
    var lot = People.People.getBatchGet({ resourceNames: membres.slice(i, i + 200), personFields: 'emailAddresses' });
    (lot.responses || []).forEach(function (r) {
      var e = r.person && r.person.emailAddresses && r.person.emailAddresses[0];
      if (e && e.value && emails.indexOf(e.value) === -1) emails.push(e.value);
    });
  }
  return emails;
}

function envoyerAuGroupe_(p, s) {
  var emails = emailsDuGroupe_(p.groupe);
  if (!emails.length) throw erreur_('INVALIDE', 'Ce groupe ne contient aucune adresse e-mail.');
  if (emails.length > 99) throw erreur_('INVALIDE', 'Groupe trop grand (' + emails.length + ' adresses) : 99 maximum.');
  var quota = MailApp.getRemainingDailyQuota();
  if (emails.length + 1 > quota) throw erreur_('QUOTA', 'Quota Gmail insuffisant aujourd\'hui : ' + quota + ' destinataires restants.');
  if (p.essai) return { nb: emails.length, quota: quota };
  var opts = optionsEnvoi_();
  opts.htmlBody = corpsHtml_(p.corps, p.signature);
  opts.attachments = piecesPourEnvoi_(p);
  opts.bcc = emails.join(',');
  GmailApp.sendEmail(CONFIG.ALIAS, p.sujet || '', corpsTexte_(p.corps, p.signature), opts);
  journaliser_(s, 'Envoi groupé', (p.sujet || '') + ' → ' + emails.length + ' destinataires');
  return { nb: emails.length };
}
