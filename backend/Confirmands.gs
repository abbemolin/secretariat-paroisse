/**
 * Confirmands adultes : inscriptions par le formulaire Google « Confirmation adultes (année) ».
 *
 * L'appli lit la feuille de réponses (Réglages → Confirmands) et crée un dossier « Confirmand adulte »
 * par personne, ou complète le dossier existant (même e-mail + nom, ou même nom + prénom) sans écraser.
 * Les réponses en double sont fusionnées (la plus récente l'emporte).
 * Signalements : baptême à trouver, baptême dans une autre confession (profession de foi requise), mineur.
 * Accusé de réception automatique (réponse type « accuse_confirmation ») pour les inscriptions reçues
 * après la mise en service.
 */

var CONF_DEFAUT = { feuilles: [{ id: '1vO0NcDmaO9tLi1l_vTmcuCTJZ3ZzOH6GRq9WK9G8Pus', annee: '2026-2027', annee_confirmation: '2027' }], import_auto: false, accuse_depuis: '' };

// Lieu de baptême qui indique une autre confession chrétienne
var AUTRES_CONFESSIONS = [
  { re: /lutheri|luthéri/, nom: 'Luthérienne' }, { re: /confession d.augsbourg/, nom: 'Luthérienne (Confession d\'Augsbourg)' },
  { re: /reforme|réformé|calvini/, nom: 'Réformée' }, { re: /evangeli/, nom: 'Évangélique' }, { re: /protestant/, nom: 'Protestante' },
  { re: /orthodoxe/, nom: 'Orthodoxe' }, { re: /anglican/, nom: 'Anglicane' }, { re: /eglise baptiste|eglise evangelique baptiste|baptist church/, nom: 'Baptiste' }, { re: /pentec/, nom: 'Pentecôtiste' },
  { re: /temple /, nom: 'Protestante' }
];
function confessionDe_(lieu) {
  var t = sansAccents_(lieu);
  if (/catholique/.test(t)) return '';
  for (var i = 0; i < AUTRES_CONFESSIONS.length; i++) if (AUTRES_CONFESSIONS[i].re.test(t)) return AUTRES_CONFESSIONS[i].nom;
  return '';
}

function confReglages_() {
  var r = json2_(props_().getProperty('CONF'), {});
  Object.keys(CONF_DEFAUT).forEach(function (k) { if (r[k] === undefined) r[k] = JSON.parse(JSON.stringify(CONF_DEFAUT[k])); });
  return r;
}
function lireConfReglages_() {
  var r = confReglages_();
  return {
    import_auto: r.import_auto, accuse_depuis: r.accuse_depuis,
    feuilles: r.feuilles.map(function (f) {
      try { return { id: f.id, annee: f.annee, annee_confirmation: f.annee_confirmation, nom: SpreadsheetApp.openById(f.id).getName() }; }
      catch (e) { return { id: f.id, annee: f.annee, annee_confirmation: f.annee_confirmation, nom: '', erreur: 'Feuille introuvable' }; }
    })
  };
}
function ecrireConfReglages_(p, s) {
  var r = confReglages_(), avant = r.import_auto;
  if (p.feuilles) {
    r.feuilles = p.feuilles.map(function (f) {
      var id = idDeFeuille_(f.id);
      if (!id) throw erreur_('INVALIDE', 'Adresse de feuille de réponses invalide.');
      var annee = String(f.annee || '').trim();
      if (!/^\d{4}-\d{4}$/.test(annee)) {
        try { annee = (SpreadsheetApp.openById(id).getName().match(/(\d{4})\s*-\s*(\d{4})/) || []).slice(1, 3).join('-'); } catch (e) {}
      }
      if (!/^\d{4}-\d{4}$/.test(annee)) throw erreur_('INVALIDE', 'Année scolaire manquante pour une feuille (ex. 2027-2028).');
      var conf = String(f.annee_confirmation || '').trim() || annee.slice(5);
      if (!/^\d{4}$/.test(conf)) throw erreur_('INVALIDE', 'Année de confirmation invalide (ex. 2028).');
      return { id: id, annee: annee, annee_confirmation: conf };
    });
  }
  if (p.import_auto !== undefined) r.import_auto = p.import_auto === true;
  if (r.import_auto && !r.accuse_depuis) r.accuse_depuis = maintenant_();
  props_().setProperty('CONF', JSON.stringify(r));
  if (r.import_auto !== avant) {
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'importerConfirmands') ScriptApp.deleteTrigger(t); });
    if (r.import_auto) ScriptApp.newTrigger('importerConfirmands').timeBased().everyMinutes(15).create();
  }
  journaliser_(s, 'Confirmands : réglages modifiés', '');
  return lireConfReglages_();
}

/** « 18/02/2026 16:03:47 » → Date */
function dateHorodateur_(t) {
  var m = String(t || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] || 0)) : null;
}

function reponseConf_(rep) {
  var cles = Object.keys(rep);
  var premier = function (re, exclure) {
    return cles.filter(function (h) { return re.test(sansAccents_(h).trim()) && (!exclure || !exclure.test(sansAccents_(h))); })
      .map(function (h) { return String(rep[h] || '').trim(); }).filter(String)[0] || '';
  };
  var rue = premier(/^adresse$/), cp = premier(/code postal/), ville = premier(/^ville/);
  var connait = premier(/je connais mon lieu/);
  var lieuBap = premier(/mon lieu de bapteme/), dateBap = dateIso_(premier(/ma date de bapteme/));
  return {
    horodateur: premier(/horodateur/), email: premier(/adresse e-?mail/).toLowerCase(),
    prenoms: premier(/^prenom$/), nom: premier(/^nom$/),
    adresse: [rue, [cp, ville].filter(String).join(' ')].filter(String).join(', '),
    naissance_date: dateIso_(premier(/date de naissance/)), naissance_lieu: premier(/lieu de naissance/),
    telephone: premier(/telephone/), pere: premier(/du pere/), mere: premier(/de la mere/),
    bapteme_inconnu: /^non/i.test(connait) && !dateBap && !lieuBap,
    bapteme_date: dateBap, bapteme_paroisse: lieuBap
  };
}

function importerConfirmands() { return importerConf_({}, { nom: 'Formulaire confirmation', uid: '' }); }

function importerConf_(p, s) {
  var r = confReglages_();
  if (!r.accuse_depuis) { r.accuse_depuis = maintenant_(); props_().setProperty('CONF', JSON.stringify(r)); }
  var depuis = new Date(r.accuse_depuis);
  var res = { nouveaux: 0, completes: 0, accuses: 0, erreurs: [] };
  var accuses = [];
  r.feuilles.forEach(function (f) {
    var ss;
    try { ss = SpreadsheetApp.openById(f.id); } catch (e) { res.erreurs.push('Feuille ' + f.annee + ' introuvable'); return; }
    var v = ss.getSheets()[0].getDataRange().getDisplayValues();
    var entetes = v.shift();
    var reps = v.filter(function (l) { return l.join('').trim(); }).map(function (l) {
      var rep = {};
      entetes.forEach(function (h, j) { rep[h + (rep[h] !== undefined ? ' #' + j : '')] = l[j]; });
      var x = reponseConf_(rep);
      x.cle = f.id + ':' + x.horodateur + ':' + x.email + ':' + cleNom_(x.prenoms);
      x.quand = dateHorodateur_(x.horodateur);
      return x;
    }).filter(function (x) { return x.nom || x.prenoms; })
      .sort(function (a, b) { return (a.quand || 0) - (b.quand || 0); });   // la plus récente en dernier : elle l'emporte

    verrou_(function () {
      var dossiers = lignes_('Dossiers').filter(function (d) { return d.type === 'confirmand' || d.type === 'confirmation_jeune'; });
      var vues = {};
      dossiers.forEach(function (d) { (json2_(d.donnees, {}).infos || {}).form_cles && json2_(d.donnees, {}).infos.form_cles.forEach(function (k) { vues[k] = true; }); });
      reps.forEach(function (rep) {
        if (vues[rep.cle]) return;
        vues[rep.cle] = true;
        var d = dossiers.filter(function (y) {
          var i = json2_(y.donnees, {}).infos || {};
          var nom = i.nom || i.enfant_nom || '', prenom = i.prenoms || i.enfant_prenoms || '';
          // même nom + même prénom (un parent et son enfant peuvent partager l'adresse e-mail)
          return memeNom_(nom, rep.nom) && prenomCommun_(prenom, rep.prenoms);
        })[0];
        var nouveau = !d;
        var confession = confessionDe_(rep.bapteme_paroisse);
        var champs = {
          prenoms: rep.prenoms, nom: rep.nom, adresse: rep.adresse, naissance_date: rep.naissance_date, naissance_lieu: rep.naissance_lieu,
          telephone: rep.telephone, email: rep.email, pere: rep.pere, mere: rep.mere, bapteme_date: rep.bapteme_date, bapteme_paroisse: rep.bapteme_paroisse
        };
        if (nouveau) {
          d = { id: uid_(), type: 'confirmand', etat: 'ouvert', cree_le: maintenant_(), source: 'Formulaire confirmation ' + f.annee,
                nom: '', email: rep.email, telephone: rep.telephone, date_celebration: '', evenement_id: '', responsable: '',
                donnees: JSON.stringify({ infos: {}, etapes: {}, documents: {}, rencontres: [], pieces: [], fils: [], historique: [] }), maj_le: '', maj_par: '' };
          dossiers.push(d);
        }
        var don = json2_(d.donnees, {});
        var i = don.infos = don.infos || {};
        var jeune = d.type === 'confirmation_jeune';
        Object.keys(champs).forEach(function (k) {
          if (!champs[k]) return;
          var cle = jeune ? ({ prenoms: 'enfant_prenoms', nom: 'enfant_nom', naissance_date: 'enfant_naissance_date', naissance_lieu: 'enfant_naissance_lieu', pere: 'pere_nom', mere: 'mere_nom_jeune_fille' })[k] || k : k;
          // nouveau dossier ou doublon plus récent : la réponse l'emporte ; dossier saisi autrement : on ne fait que compléter
          if (nouveau || !i[cle] || (i.form_cles || []).length) i[cle] = champs[k];
        });
        if (rep.bapteme_date || rep.bapteme_paroisse) delete i.bapteme_inconnu;
        else if (rep.bapteme_inconnu && !i.bapteme_date && !i.bapteme_paroisse) i.bapteme_inconnu = 'oui';
        if (confession) { i.autre_confession = 'oui'; if (!i.confession_origine) i.confession_origine = confession; }
        if (!i.annee_sacrements && !jeune) i.annee_sacrements = f.annee_confirmation;
        i.form_cles = (i.form_cles || []).concat([rep.cle]);
        d.email = d.email || rep.email; d.telephone = d.telephone || rep.telephone;
        d.nom = nomDossier_(d.type, i) || d.nom;
        d.donnees = JSON.stringify(don);
        ajouterHistorique_(d, 'Formulaire', nouveau ? 'Inscription reçue (formulaire confirmation ' + f.annee + ')' : 'Complété par le formulaire de confirmation');
        d.maj_le = maintenant_(); d.maj_par = 'Formulaire';
        ecrireLigne_('Dossiers', d);
        if (nouveau) {
          res.nouveaux++;
          if (rep.quand && rep.quand >= depuis && rep.email) accuses.push({ email: rep.email, prenom: rep.prenoms, annee: f.annee, id: d.id });
        } else res.completes++;
      });
    });
  });

  // Accusés de réception (inscriptions arrivées après la mise en service)
  if (accuses.length) {
    var modele = listerReponses_().filter(function (x) { return x.cle === 'accuse_confirmation'; })[0];
    if (modele) accuses.forEach(function (a) {
      try {
        var ctx = { nom: a.prenom, prenom: a.prenom, annee: a.annee, type: 'confirmation' };
        var corps = remplirModeleServeur_(modele.corps, ctx), sujet = remplirModeleServeur_(modele.sujet, ctx);
        var opts = optionsEnvoi_();
        opts.htmlBody = corpsHtml_(corps, 'paroisse');
        GmailApp.sendEmail(a.email, sujet, corpsTexte_(corps, 'paroisse'), opts);
        verrou_(function () { var d = trouverDossier_(a.id); ajouterHistorique_(d, 'système', 'Accusé de réception envoyé à ' + a.email); ecrireLigne_('Dossiers', d); });
        res.accuses++;
      } catch (e) { res.erreurs.push('Accusé ' + a.email + ' : ' + e.message); }
    });
  }
  if (res.nouveaux) {
    journaliser_(s, 'Confirmands : inscriptions importées', res.nouveaux + ' nouvelles, ' + res.completes + ' complétées, ' + res.accuses + ' accusés');
    lignes_('Utilisateurs').filter(estActif_).forEach(function (u) {
      if (u.id !== s.uid) notifier_(u.id, 'Confirmation : inscription reçue', res.nouveaux === 1 ? '1 nouveau confirmand' : res.nouveaux + ' nouveaux confirmands', '#/dossiers?type=confirmand');
    });
  }
  return res;
}

/** Un mail à chaque confirmand choisi ({prenom} remplacé). */
function relancerConf_(p, s) {
  var ids = p.ids || [];
  var ds = lignes_('Dossiers').filter(function (d) { return ids.indexOf(d.id) > -1 && d.email; });
  if (!ds.length) throw erreur_('INVALIDE', 'Aucune adresse e-mail parmi les dossiers choisis.');
  var quota = MailApp.getRemainingDailyQuota();
  if (ds.length + 1 > quota) throw erreur_('QUOTA', 'Quota Gmail insuffisant aujourd\'hui : ' + quota + ' destinataires restants.');
  var opts = optionsEnvoi_();
  ds.forEach(function (d) {
    var i = json2_(d.donnees, {}).infos || {};
    var ctx = { prenom: i.prenoms || i.enfant_prenoms || '', nom: d.nom };
    var corps = remplirModeleServeur_(p.corps, ctx);
    GmailApp.sendEmail(d.email, remplirModeleServeur_(p.sujet, ctx), corpsTexte_(corps, p.signature), { name: opts.name, from: opts.from, htmlBody: corpsHtml_(corps, p.signature) });
    verrou_(function () { var x = trouverDossier_(d.id); ajouterHistorique_(x, s.nom, 'Mail envoyé : ' + remplirModeleServeur_(p.sujet, ctx)); ecrireLigne_('Dossiers', x); });
  });
  journaliser_(s, 'Confirmands : relance', (p.sujet || '') + ' → ' + ds.length);
  return { nb: ds.length };
}

/** Confirmand mineur → dossier « Confirmation (jeunes) » (et l'inverse). */
function changerTypeConf_(p, s) {
  var vers = p.type;
  if (['confirmand', 'confirmation_jeune'].indexOf(vers) === -1) throw erreur_('INVALIDE', 'Type invalide.');
  var d = verrou_(function () {
    var d = trouverDossier_(p.id);
    if (['confirmand', 'confirmation_jeune'].indexOf(d.type) === -1 || d.type === vers) throw erreur_('INVALIDE', 'Changement impossible pour ce dossier.');
    var don = json2_(d.donnees, {}), i = don.infos = don.infos || {};
    var C = { prenoms: 'enfant_prenoms', nom: 'enfant_nom', naissance_date: 'enfant_naissance_date', naissance_lieu: 'enfant_naissance_lieu', pere: 'pere_nom', mere: 'mere_nom_jeune_fille' };
    var E = { accueil: 'inscription', confirmation: 'celebration' };
    var tr = function (obj, table) { Object.keys(table).forEach(function (a) { if (obj[a] !== undefined && obj[table[a]] === undefined) { obj[table[a]] = obj[a]; delete obj[a]; } }); };
    var inverse = function (t) { var o = {}; Object.keys(t).forEach(function (k) { o[t[k]] = k; }); return o; };
    if (vers === 'confirmation_jeune') {
      tr(i, C); tr(don.etapes = don.etapes || {}, E);
      if (!i.annee_scolaire) i.annee_scolaire = i.annee_sacrements ? (Number(i.annee_sacrements) - 1) + '-' + i.annee_sacrements : anneeScolaire_();
    } else {
      tr(i, inverse(C)); tr(don.etapes = don.etapes || {}, inverse(E));
      if (!i.annee_sacrements && i.annee_scolaire) i.annee_sacrements = String(i.annee_scolaire).slice(5);
    }
    var avant = TYPES_DOSSIER[d.type].nom;
    d.type = vers;
    d.nom = nomDossier_(vers, i) || d.nom;
    d.donnees = JSON.stringify(don);
    ajouterHistorique_(d, s.nom, 'Dossier passé de « ' + avant + ' » à « ' + TYPES_DOSSIER[vers].nom + ' »');
    d.maj_le = maintenant_(); d.maj_par = s.nom;
    return ecrireLigne_('Dossiers', d);
  });
  journaliser_(s, 'Dossier : changement de type', d.nom + ' → ' + TYPES_DOSSIER[vers].nom);
  return dossierComplet_(d);
}
