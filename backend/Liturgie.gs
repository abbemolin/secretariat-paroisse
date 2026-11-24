/**
 * Tuile « Bible et bréviaire ».
 *
 * Les offices, la Messe du jour et la Bible sont lus directement par l'appli (données publiques de l'AppMesse).
 * Le serveur ne sert que :
 *   - les commentaires des Évangiles (usage privé : jamais publics, seulement aux utilisateurs de la tuile) ;
 *   - les marque-pages de la Bible, rangés sur le compte de chacun (Stockage : MARQUES_BIBLE = { idUtilisateur: [...] }).
 */

/** Commentaires (abrégé, chapitre, verset, texte), par pages de 500 à partir de p.de. L'appli les garde sur l'appareil. */
function commentairesBible_(p) {
  var de = Math.max(0, Number(p.de) || 0), PAGE = 500;
  var l = sb_('get', '/rest/v1/commentaires_bible?select=abrege,chapitre,verset,texte&order=abrege.asc,chapitre.asc,verset.asc&offset=' + de + '&limit=' + PAGE) || [];
  return { lignes: l, suite: l.length === PAGE ? de + PAGE : null };
}

function marquesTous_() { return json2_(props_().getProperty('MARQUES_BIBLE'), {}); }

/** Marque-pages de l'utilisateur connecté. */
function lireMarques_(p, s) { return marquesTous_()[s.uid] || []; }

/** Remplace la liste des marque-pages de l'utilisateur connecté (au plus 300). */
function ecrireMarques_(p, s) {
  var l = (p.marques || []).slice(0, 300).map(function (m) {
    return {
      id: String(m.id || '').slice(0, 40),
      livre: String(m.livre || '').slice(0, 40),
      chapitre: Number(m.chapitre) || 1,
      verset: m.verset ? Number(m.verset) : null,
      note: String(m.note || '').slice(0, 300),
      date: String(m.date || '').slice(0, 30)
    };
  }).filter(function (m) { return m.id && m.livre; });
  var verrou = LockService.getScriptLock(); verrou.waitLock(20000);
  try {
    var tous = marquesTous_();
    tous[s.uid] = l;
    props_().setProperty('MARQUES_BIBLE', JSON.stringify(tous));
  } finally { verrou.releaseLock(); }
  return l;
}
