/* Bible (traduction Crampon) pour l'app « La Croix glorieuse » — reprise de la Bible de l'AppMesse (mêmes données).
   Usage : var b = creerBible(); parent.appendChild(b.element); b.ouvrir('Jean', 3, 16, 18);
   Lecture : base de l'AppMesse ; hors connexion : toute la Bible téléchargée dans le téléphone (IndexedDB).
   Mes versets et le dernier chapitre lu restent sur le téléphone. */
(function () {
  var URL_DB = 'https://pmeaimfcwtykhqtueomd.supabase.co/rest/v1/';
  var CLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZWFpbWZjd3R5a2hxdHVlb21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MzA4MzIsImV4cCI6MjA4MzMwNjgzMn0.X91Usnq8WtZYuY40UFIo7Xl8P1O46LKqe1GvJ7RIWYE';
  var CANON = {
    AT: {
      'Pentateuque': ['Genèse', 'Exode', 'Lévitique', 'Nombres', 'Deutéronome'],
      'Historiques': ['Josué', 'Juges', 'Ruth', '1 Samuel', '2 Samuel', '1 Rois', '2 Rois', '1 Chroniques', '2 Chroniques', 'Esdras', 'Néhémie', 'Tobie', 'Judith', 'Esther', '1 Macchabées', '2 Macchabées'],
      'Sapientiaux': ['Job', 'Psaumes', 'Proverbes', 'Ecclésiaste', 'Cantique des Cantiques', 'Sagesse', 'Ecclésiastique'],
      'Prophètes': ['Isaïe', 'Jérémie', 'Lamentations', 'Baruch', 'Ézéchiel', 'Daniel', 'Osée', 'Joël', 'Amos', 'Abdias', 'Jonas', 'Michée', 'Nahum', 'Habacuc', 'Sophonie', 'Aggée', 'Zacharie', 'Malachie']
    },
    NT: {
      'Évangiles': ['Matthieu', 'Marc', 'Luc', 'Jean'],
      'Actes et lettres de saint Paul': ['Actes', 'Romains', '1 Corinthiens', '2 Corinthiens', 'Galates', 'Éphésiens', 'Philippiens', 'Colossiens', '1 Thessaloniciens', '2 Thessaloniciens', '1 Timothée', '2 Timothée', 'Tite', 'Philémon', 'Hébreux'],
      'Lettres catholiques': ['Jacques', '1 Pierre', '2 Pierre', '1 Jean', '2 Jean', '3 Jean', 'Jude'],
      'Apocalypse': ['Apocalypse']
    }
  };
  var TOUS = [];
  Object.keys(CANON).forEach(function (t) { Object.keys(CANON[t]).forEach(function (g) { TOUS = TOUS.concat(CANON[t][g]); }); });
  var ABREV = {
    gn: 'Genèse', gen: 'Genèse', ex: 'Exode', lv: 'Lévitique', nb: 'Nombres', dt: 'Deutéronome', jos: 'Josué', jg: 'Juges', rt: 'Ruth',
    '1s': '1 Samuel', '2s': '2 Samuel', '1r': '1 Rois', '2r': '2 Rois', '1ch': '1 Chroniques', '2ch': '2 Chroniques', esd: 'Esdras', ne: 'Néhémie',
    tb: 'Tobie', jdt: 'Judith', est: 'Esther', '1m': '1 Macchabées', '2m': '2 Macchabées', jb: 'Job', ps: 'Psaumes', pr: 'Proverbes', qo: 'Ecclésiaste',
    ct: 'Cantique des Cantiques', sg: 'Sagesse', si: 'Ecclésiastique', is: 'Isaïe', jr: 'Jérémie', lm: 'Lamentations', ba: 'Baruch', ez: 'Ézéchiel',
    dn: 'Daniel', os: 'Osée', jl: 'Joël', am: 'Amos', ab: 'Abdias', jon: 'Jonas', mi: 'Michée', na: 'Nahum', ha: 'Habacuc', so: 'Sophonie',
    ag: 'Aggée', za: 'Zacharie', ml: 'Malachie', mt: 'Matthieu', mc: 'Marc', lc: 'Luc', jn: 'Jean', ac: 'Actes', rm: 'Romains',
    '1co': '1 Corinthiens', '2co': '2 Corinthiens', ga: 'Galates', ep: 'Éphésiens', ph: 'Philippiens', col: 'Colossiens',
    '1th': '1 Thessaloniciens', '2th': '2 Thessaloniciens', '1tm': '1 Timothée', '2tm': '2 Timothée', tt: 'Tite', phm: 'Philémon', he: 'Hébreux',
    jc: 'Jacques', '1p': '1 Pierre', '2p': '2 Pierre', '1jn': '1 Jean', '2jn': '2 Jean', '3jn': '3 Jean', jude: 'Jude', ap: 'Apocalypse'
  };
  function sa(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function e(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /** Livre à partir d'une abréviation ou d'un nom (« Mt », « 1 Co », « Jean », « Psaume »…). exact : pas de début de nom. */
  function livreDe(t, exact) {
    var k = sa(t).replace(/\./g, '').replace(/\s+/g, '');
    if (!k) return null;
    if (ABREV[k]) return ABREV[k];
    var plein = TOUS.filter(function (l) { return sa(l).replace(/\s+/g, '') === k; })[0];
    if (plein) return plein;
    if (k === 'psaume') return 'Psaumes';
    if (exact) return null;
    return TOUS.filter(function (l) { return sa(l).replace(/\s+/g, '').indexOf(k) === 0; })[0] || null;
  }
  // « Mt 6, 9-13 », « Jean 3,16 », « 1 Co 13, 4-7 », « Ps 22 »
  var RE_REF = /((?:[123]\s?)?[A-ZÉ][a-zéèêëïîôûüç]{0,13}\.?)\s(\d{1,3})(?:\s?[,:]\s?(\d{1,3})(?:\s?[-–]\s?(\d{1,3}))?)?/g;
  /** Transforme les références bibliques d'un texte déjà échappé en liens (data-bible="livre|chap|v1|v2"). */
  function lierReferences(html) {
    return html.split(/(<a\b[\s\S]*?<\/a>|https?:\/\/[^\s<]+)/).map(function (morceau, i) {
      if (i % 2) return morceau;
      return morceau.replace(RE_REF, function (m, liv, c, v1, v2) {
        var l = livreDe(liv, true);
        if (!l || !/^[A-ZÉ123]/.test(liv)) return m;
        return '<a href="#" class="bible-ref" data-bible="' + e(l + '|' + c + '|' + (v1 || '') + '|' + (v2 || '')) + '">' + m + '</a>';
      });
    }).join('');
  }

  // ─── Données : réseau (base de l'AppMesse) ou téléphone ───
  function requete(chemin) {
    return fetch(URL_DB + chemin, { headers: { apikey: CLE, Authorization: 'Bearer ' + CLE } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  var Locale = {
    _db: null,
    ouvrir: function () {
      if (this._db) return this._db;
      this._db = new Promise(function (ok, ko) {
        var r = indexedDB.open('bible-croix-glorieuse', 1);
        r.onupgradeneeded = function () { var d = r.result; d.createObjectStore('versets', { keyPath: ['livre', 'chapitre', 'verset_num'] }); d.createObjectStore('meta'); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { ko(r.error); };
      });
      return this._db;
    },
    meta: function (cle, valeur) {
      return this.ouvrir().then(function (d) {
        return new Promise(function (ok, ko) {
          var s = d.transaction('meta', valeur === undefined ? 'readonly' : 'readwrite').objectStore('meta');
          var r = valeur === undefined ? s.get(cle) : s.put(valeur, cle);
          r.onsuccess = function () { ok(r.result); }; r.onerror = function () { ko(r.error); };
        });
      });
    },
    ecrire: function (lignes) {
      return this.ouvrir().then(function (d) {
        return new Promise(function (ok, ko) {
          var t = d.transaction('versets', 'readwrite');
          lignes.forEach(function (l) { t.objectStore('versets').put(l); });
          t.oncomplete = ok; t.onerror = function () { ko(t.error); };
        });
      });
    },
    plage: function (debut, fin) {
      return this.ouvrir().then(function (d) {
        return new Promise(function (ok, ko) {
          var r = d.transaction('versets').objectStore('versets').getAll(IDBKeyRange.bound(debut, fin));
          r.onsuccess = function () { ok(r.result); }; r.onerror = function () { ko(r.error); };
        });
      });
    },
    versets: function (livre, c) { return this.plage([livre, +c, -Infinity], [livre, +c, []]); },
    chapitres: function (livre) {
      return this.plage([livre, -Infinity, -Infinity], [livre, [], []]).then(function (l) { return l.filter(function (v) { return v.verset_num === 1; }).map(function (v) { return v.chapitre; }); });
    },
    recherche: function (q) {
      var cible = sa(q);
      return this.ouvrir().then(function (d) {
        return new Promise(function (ok, ko) {
          var res = [], r = d.transaction('versets').objectStore('versets').openCursor();
          r.onsuccess = function () { var c = r.result; if (!c || res.length >= 200) return ok(res); if (sa(c.value.texte).indexOf(cible) > -1) res.push(c.value); c.continue(); };
          r.onerror = function () { ko(r.error); };
        });
      });
    }
  };
  function complete() { try { return Locale.meta('complet').then(function (v) { return v === true; }).catch(function () { return false; }); } catch (x) { return Promise.resolve(false); } }
  /** Bible téléchargée : lecture dans le téléphone ; sinon réseau, et à défaut ce qui est déjà dans le téléphone. */
  function lire(local, reseau) {
    return complete().then(function (c) {
      if (c) return local();
      return reseau().catch(function () { return local().catch(function () { return []; }); });
    });
  }
  var DB = {
    chapitres: function (livre) {
      return lire(function () { return Locale.chapitres(livre); },
        function () { return requete('bible_crampon?select=chapitre&verset_num=eq.1&livre=eq.' + encodeURIComponent(livre) + '&order=chapitre.asc').then(function (l) { return l.map(function (x) { return +x.chapitre; }); }); });
    },
    versets: function (livre, c) {
      return lire(function () { return Locale.versets(livre, c); },
        function () { return requete('bible_crampon?select=verset_num,texte&livre=eq.' + encodeURIComponent(livre) + '&chapitre=eq.' + c + '&order=verset_num.asc'); });
    },
    recherche: function (q) {
      return lire(function () { return Locale.recherche(q); },
        function () { return requete('bible_crampon?select=livre,chapitre,verset_num,texte&texte=ilike.' + encodeURIComponent('*' + q + '*') + '&order=id.asc&limit=200'); });
    }
  };

  // ─── Mes versets et dernier chapitre lu (sur le téléphone) ───
  function lireLS(cle, defaut) { try { return JSON.parse(localStorage.getItem(cle) || 'null') || defaut; } catch (x) { return defaut; } }
  function ecrireLS(cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (x) {} }

  var CSS = '.bb{background:#fff;border-radius:14px;box-shadow:0 1px 8px rgba(82,26,34,.07);margin-bottom:14px;overflow:hidden}' +
    '.bb-barre{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px;border-bottom:1px solid #f1e8e1;position:sticky;top:0;background:#fff;z-index:2}' +
    '.bb-livre{flex:1;min-width:120px;text-align:left;border:1px solid #e6d8cc;background:#faf7f2;border-radius:10px;padding:9px 12px;font:inherit;font-family:Georgia,serif;font-weight:bold;color:#521a22;cursor:pointer}' +
    '.bb-livre::after{content:" ▾";font-size:.8em;color:#a8662e}' +
    '.bb select{border:1px solid #e6d8cc;border-radius:10px;padding:9px 6px;font:inherit;background:#fff;color:#2b2224;width:auto}' +
    '.bb-b{border:1px solid #e6d8cc;background:#fff;color:#521a22;border-radius:10px;min-width:40px;padding:8px 10px;font-size:16px;cursor:pointer;line-height:1}' +
    '.bb-b:disabled{opacity:.35}.bb-b.actif{background:#521a22;color:#fff;border-color:#521a22}' +
    '.bb-texte{padding:6px 16px 18px;font-family:Georgia,"EB Garamond",serif;font-size:18px;line-height:1.7;color:#2b2224}' +
    '.bb-texte h3{font-family:Georgia,serif;color:#521a22;font-size:21px;margin:10px 0 6px;text-align:center}' +
    '.bb-v{cursor:pointer;border-radius:4px;padding:1px 0;transition:background .2s}' +
    '.bb-v sup{color:#a8662e;font-family:Arial,sans-serif;font-size:.62em;font-weight:bold;margin:0 2px 0 4px}' +
    '.bb-v.fav{background:#fdf0d8}.bb-v.fav sup::before{content:"★";margin-right:2px;color:#d08c4c}' +
    '.bb-v.choisi{background:#f3dfe2;outline:1px solid #e3b9c0}.bb-v.vise{background:#fff4d6}' +
    '.bb-outil{position:sticky;bottom:72px;margin:0 10px 10px;background:#521a22;color:#fff;border-radius:12px;padding:8px 10px;display:flex;gap:8px;align-items:center;font-size:14px;z-index:3;box-shadow:0 4px 14px rgba(0,0,0,.2)}' +
    '.bb-outil span{flex:1}.bb-outil button{border:1px solid rgba(255,255,255,.5);background:none;color:#fff;border-radius:8px;padding:7px 10px;font:inherit;cursor:pointer}' +
    '.bb-panneau{padding:10px 14px 14px;border-bottom:1px solid #f1e8e1;background:#fffdfa}' +
    '.bb-onglets{display:flex;gap:6px;margin-bottom:8px}.bb-onglets button{flex:1;border:1px solid #e6d8cc;background:#fff;border-radius:999px;padding:7px;font:inherit;font-size:14px;color:#521a22;cursor:pointer}.bb-onglets button.actif{background:#521a22;color:#fff;border-color:#521a22}' +
    '.bb-groupe{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#a8662e;margin:10px 0 4px}' +
    '.bb-livres{display:flex;flex-wrap:wrap;gap:5px}.bb-livres button{border:1px solid #eee2d8;background:#fff;border-radius:8px;padding:6px 9px;font:inherit;font-size:14px;cursor:pointer;color:#2b2224}.bb-livres button.actif{background:#faf3ea;border-color:#d08c4c;font-weight:bold}' +
    '.bb-res{border-top:1px solid #f1e8e1;padding:9px 0;cursor:pointer;font-size:15px;line-height:1.45}.bb-res b{color:#521a22;font-size:13px;display:block}.bb-res mark{background:#fdf0d8;padding:0 1px}' +
    '.bb-etat{font-size:13px;color:#7a6a64;padding:8px 16px 12px;border-top:1px solid #f1e8e1}.bb-etat button{border:0;background:none;color:#a8662e;text-decoration:underline;font:inherit;cursor:pointer;padding:0}' +
    '.bb-vide{color:#7a6a64;font-style:italic;text-align:center;padding:24px 0;font-family:inherit;font-size:15px}' +
    '.bb input[type=search]{width:100%;border:1px solid #e0d2c6;border-radius:10px;padding:10px;font:inherit;font-size:16px}' +
    '.bb-g{animation:bbg .25s ease-out}.bb-d{animation:bbd .25s ease-out}@keyframes bbg{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:none}}@keyframes bbd{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}' +
    'a.bible-ref{color:#a8662e;text-decoration:none;border-bottom:1px dotted #a8662e}';

  window.lierReferencesBibliques = lierReferences;
  window.creerBible = function () {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var R = document.createElement('div'); R.className = 'bb';
    var pos = lireLS('bible_position', { livre: 'Matthieu', chap: 1 });
    var livre = pos.livre, chap = pos.chap, chaps = [], versets = [], panneau = '', onglet = TOUS.indexOf(livre) >= TOUS.indexOf('Matthieu') ? 'NT' : 'AT';
    var choisis = [], vise = null, recherche = '', resultats = null, sens = '', telechargement = '', bibleLocale = false;
    var favoris = lireLS('bible_favoris', []), demarre = false;
    function cleV(n) { return livre + '|' + chap + '|' + n; }
    function estFav(n) { return favoris.some(function (f) { return f.cle === cleV(n); }); }

    function barre() {
      return '<div class="bb-barre"><button class="bb-livre" data-bb="livres">' + e(livre) + '</button>' +
        '<select data-bb="chap" aria-label="Chapitre">' + chaps.map(function (c) { return '<option value="' + c + '"' + (c === chap ? ' selected' : '') + '>' + (livre === 'Psaumes' ? 'Ps. ' : 'Ch. ') + c + '</option>'; }).join('') + '</select>' +
        '<button class="bb-b" data-bb="prec" aria-label="Chapitre précédent"' + (chaps.indexOf(chap) <= 0 ? ' disabled' : '') + '>‹</button>' +
        '<button class="bb-b" data-bb="suiv" aria-label="Chapitre suivant"' + (chaps.indexOf(chap) === chaps.length - 1 ? ' disabled' : '') + '>›</button>' +
        '<button class="bb-b' + (panneau === 'cherche' ? ' actif' : '') + '" data-bb="cherche" aria-label="Rechercher">⌕</button>' +
        '<button class="bb-b' + (panneau === 'favoris' ? ' actif' : '') + '" data-bb="favoris" aria-label="Mes versets">★</button></div>';
    }
    function panneauHtml() {
      if (panneau === 'livres') return '<div class="bb-panneau"><div class="bb-onglets"><button data-bb="at" class="' + (onglet === 'AT' ? 'actif' : '') + '">Ancien Testament</button><button data-bb="nt" class="' + (onglet === 'NT' ? 'actif' : '') + '">Nouveau Testament</button></div>' +
        Object.keys(CANON[onglet]).map(function (g) { return '<div class="bb-groupe">' + e(g) + '</div><div class="bb-livres">' + CANON[onglet][g].map(function (l) { return '<button data-livre="' + e(l) + '" class="' + (l === livre ? 'actif' : '') + '">' + e(l) + '</button>'; }).join('') + '</div>'; }).join('') + '</div>';
      if (panneau === 'cherche') {
        return '<div class="bb-panneau"><input type="search" data-bb="q" placeholder="Référence (Mt 5, 3) ou mots" value="' + e(recherche) + '" enterkeyhint="search">' +
          (resultats === null ? '<p class="bb-vide" style="padding:10px 0 0">Ex. : « Jn 3, 16 », « Ps 23 », « bienheureux ».</p>' : resultats === 'charge' ? '<p class="bb-vide">Recherche…</p>' :
            !resultats.length ? '<p class="bb-vide">Aucun résultat.</p>' : '<div style="max-height:50vh;overflow-y:auto;margin-top:6px">' + (resultats.length >= 200 ? '<p class="bb-vide" style="padding:6px 0">200 premiers résultats</p>' : '') + resultats.map(function (r) {
              var t = e(r.texte), q = sa(recherche);
              if (q.length > 1) { var idx = sa(r.texte).indexOf(q); if (idx > -1) t = e(r.texte.slice(0, idx)) + '<mark>' + e(r.texte.slice(idx, idx + recherche.length)) + '</mark>' + e(r.texte.slice(idx + recherche.length)); }
              return '<div class="bb-res" data-aller="' + e(r.livre + '|' + r.chapitre + '|' + r.verset_num) + '"><b>' + e(r.livre) + ' ' + r.chapitre + ', ' + r.verset_num + '</b>' + t + '</div>';
            }).join('') + '</div>') + '</div>';
      }
      if (panneau === 'favoris') {
        return '<div class="bb-panneau"><div class="bb-groupe" style="margin-top:0">Mes versets</div>' + (favoris.length ? favoris.slice().reverse().map(function (f) {
          return '<div class="bb-res" data-aller="' + e(f.livre + '|' + f.chap + '|' + f.v) + '"><b>' + e(f.livre) + ' ' + f.chap + ', ' + f.v + '</b>' + e(f.texte) + '</div>';
        }).join('') : '<p class="bb-vide">Touchez un verset pendant la lecture, puis « ★ Garder », pour le retrouver ici.</p>') + '</div>';
      }
      return '';
    }
    function texteHtml() {
      if (!versets) return '<div class="bb-texte"><p class="bb-vide">Chargement…</p></div>';
      if (!versets.length) return '<div class="bb-texte"><p class="bb-vide">Ce chapitre n\'est pas disponible' + (navigator.onLine === false ? ' hors connexion (téléchargez la Bible pour la lire sans réseau).' : '.') + '</p></div>';
      return '<div class="bb-texte ' + sens + '"><h3>' + e(livre) + ' ' + chap + '</h3>' + versets.map(function (v) {
        var n = +v.verset_num;
        return '<span class="bb-v' + (estFav(n) ? ' fav' : '') + (choisis.indexOf(n) > -1 ? ' choisi' : '') + (vise && n >= vise[0] && n <= vise[1] ? ' vise' : '') + '" data-v="' + n + '" id="bbv' + n + '"><sup>' + n + '</sup>' + e(v.texte) + '</span> ';
      }).join('') + '</div>';
    }
    function outilHtml() {
      if (!choisis.length) return '';
      var tousFav = choisis.every(estFav);
      return '<div class="bb-outil"><span>' + e(livre) + ' ' + chap + ', ' + plage(choisis) + '</span><button data-bb="garder">' + (tousFav ? '☆ Retirer' : '★ Garder') + '</button>' +
        (navigator.share ? '<button data-bb="partager">Partager</button>' : '') + '<button data-bb="deselect" aria-label="Fermer">✕</button></div>';
    }
    function plage(l) { l = l.slice().sort(function (a, b) { return a - b; }); return l.length > 1 && l[l.length - 1] - l[0] === l.length - 1 ? l[0] + '-' + l[l.length - 1] : l.join('.'); }
    function etatHtml() {
      return '<div class="bb-etat">Traduction du chanoine Crampon. ' + (bibleLocale ? '✓ Bible téléchargée : lisible hors connexion.' : telechargement ? e(telechargement) : '<button data-bb="telecharger">Télécharger la Bible pour la lire hors connexion</button> (environ 6 Mo).') + '</div>';
    }
    function rendre() {
      R.innerHTML = barre() + panneauHtml() + texteHtml() + outilHtml() + etatHtml();
      sens = '';
      var q = R.querySelector('[data-bb=q]');
      if (q) { q.oninput = function () { recherche = q.value; }; q.onkeydown = function (ev) { if (ev.key === 'Enter') chercher(); }; }
    }
    function chargerChapitre(c, v1, v2) {
      chap = +c; versets = null; choisis = []; vise = v1 ? [+v1, +(v2 || v1)] : null;
      ecrireLS('bible_position', { livre: livre, chap: chap });
      rendre();
      return DB.versets(livre, chap).then(function (l) {
        versets = (l || []).sort(function (a, b) { return a.verset_num - b.verset_num; }); rendre();
        if (vise) setTimeout(function () { var el = document.getElementById('bbv' + vise[0]); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60);
      });
    }
    function choisirLivre(l, c, v1, v2) {
      livre = l; panneau = ''; onglet = TOUS.indexOf(l) >= TOUS.indexOf('Matthieu') ? 'NT' : 'AT';
      chaps = []; versets = null; rendre();
      return DB.chapitres(l).then(function (cs) {
        chaps = (cs || []).map(Number).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
        var cc = +c || 1; if (chaps.length && chaps.indexOf(cc) === -1) cc = chaps[0];
        return chargerChapitre(cc, v1, v2);
      });
    }
    function changerChapitre(delta) {
      var i = chaps.indexOf(chap) + delta;
      if (i < 0 || i >= chaps.length) return;
      sens = delta < 0 ? 'bb-g' : 'bb-d'; chargerChapitre(chaps[i]);
      R.scrollIntoView({ block: 'start' });
    }
    function chercher() {
      var q = recherche.trim(); if (q.length < 2) return;
      var m = /^(.+?)\s*(\d{1,3})(?:\s*[,:;.]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?$/.exec(q), l = m && livreDe(m[1], false);
      if (l) { panneau = ''; recherche = ''; resultats = null; choisirLivre(l, m[2], m[3], m[4]); return; }
      resultats = 'charge'; rendre();
      DB.recherche(q).then(function (r) { resultats = r || []; rendre(); }).catch(function () { resultats = []; rendre(); });
    }
    function telecharger() {
      if (!('indexedDB' in window)) return;
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      var PAGE = 1000;
      function page(de) {
        telechargement = 'Téléchargement… ' + de.toLocaleString('fr-FR') + ' versets sur environ 36 000'; rendre();
        return requete('bible_crampon?select=livre,chapitre,verset_num,texte&order=id.asc&offset=' + de + '&limit=' + PAGE).then(function (l) {
          if (!l.length) return de;
          return Locale.ecrire(l.map(function (x) { return { livre: x.livre, chapitre: +x.chapitre, verset_num: +x.verset_num, texte: x.texte }; }))
            .then(function () { return Locale.meta('reprise', de + l.length); })
            .then(function () { return l.length < PAGE ? de + l.length : page(de + l.length); });
        });
      }
      Locale.meta('reprise').then(function (n) { return page(n || 0); })
        .then(function () { return Locale.meta('complet', true); })
        .then(function () { bibleLocale = true; telechargement = ''; rendre(); })
        .catch(function () { telechargement = 'Téléchargement interrompu : touchez de nouveau pour reprendre.'; rendre(); setTimeout(function () { telechargement = ''; rendre(); }, 4000); });
    }

    R.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-bb],[data-livre],[data-aller],[data-v]'); if (!b) return;
      if (b.dataset.livre) { choisirLivre(b.dataset.livre, 1); return; }
      if (b.dataset.aller) { var p = b.dataset.aller.split('|'); panneau = ''; choisirLivre(p[0], p[1], p[2], p[2]); return; }
      if (b.dataset.v) { var n = +b.dataset.v, i = choisis.indexOf(n); if (i > -1) choisis.splice(i, 1); else choisis.push(n); vise = null; rendre(); return; }
      var a = b.dataset.bb;
      if (a === 'livres' || a === 'cherche' || a === 'favoris') { panneau = panneau === a ? '' : a; rendre(); if (panneau === 'cherche') { var q = R.querySelector('[data-bb=q]'); if (q) q.focus(); } return; }
      if (a === 'at' || a === 'nt') { onglet = a.toUpperCase(); rendre(); return; }
      if (a === 'prec') { changerChapitre(-1); return; }
      if (a === 'suiv') { changerChapitre(1); return; }
      if (a === 'deselect') { choisis = []; rendre(); return; }
      if (a === 'telecharger') { telecharger(); return; }
      if (a === 'garder') {
        var tousFav = choisis.every(estFav);
        choisis.slice().sort(function (x, y) { return x - y; }).forEach(function (n) {
          favoris = favoris.filter(function (f) { return f.cle !== cleV(n); });
          if (!tousFav) { var v = versets.filter(function (x) { return +x.verset_num === n; })[0]; favoris.push({ cle: cleV(n), livre: livre, chap: chap, v: n, texte: v ? v.texte : '' }); }
        });
        ecrireLS('bible_favoris', favoris); choisis = []; rendre(); return;
      }
      if (a === 'partager') {
        var l = choisis.slice().sort(function (x, y) { return x - y; });
        var t = l.map(function (n) { var v = versets.filter(function (x) { return +x.verset_num === n; })[0]; return v ? v.texte : ''; }).join(' ');
        navigator.share({ text: '« ' + t + ' » (' + livre + ' ' + chap + ', ' + plage(l) + ')' }).catch(function () {});
        return;
      }
    });
    R.addEventListener('change', function (ev) { if (ev.target.dataset.bb === 'chap') chargerChapitre(ev.target.value); });
    // Glisser du doigt : chapitre précédent / suivant
    var x0 = null, y0 = null;
    R.addEventListener('touchstart', function (ev) { if (ev.target.closest('.bb-panneau,.bb-barre')) return; x0 = ev.touches[0].clientX; y0 = ev.touches[0].clientY; }, { passive: true });
    R.addEventListener('touchend', function (ev) {
      if (x0 === null) return;
      var dx = ev.changedTouches[0].clientX - x0, dy = ev.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) changerChapitre(dx < 0 ? 1 : -1);
    });

    complete().then(function (c) { bibleLocale = c; if (!demarre) choisirLivre(livre, chap); else rendre(); });
    return {
      element: R,
      ouvrir: function (l, c, v1, v2) { demarre = true; panneau = ''; return choisirLivre(l, c, v1, v2); }
    };
  };
})();
