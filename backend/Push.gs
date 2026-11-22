/**
 * Notifications sur téléphone (Web Push) — protocole VAPID.
 * Les notifications sont envoyées sans contenu chiffré : le téléphone est
 * « réveillé », puis l'appli (service worker) va chercher le texte elle-même.
 * La signature ES256 (courbe P-256) est calculée ici, en JavaScript pur.
 */

var P256 = (function () {
  var p = BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
  var n = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
  var Gx = BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296');
  var Gy = BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5');
  var ZERO = BigInt(0), ONE = BigInt(1), TWO = BigInt(2), THREE = BigInt(3), FOUR = BigInt(4), EIGHT = BigInt(8);

  function mod(a, m) { var r = a % m; return r < ZERO ? r + m : r; }
  function inv(a, m) {
    var lm = ONE, hm = ZERO, low = mod(a, m), high = m;
    while (low > ONE) {
      var r = high / low;
      var nm = hm - lm * r, nw = high - low * r;
      hm = lm; high = low; lm = nm; low = nw;
    }
    return mod(lm, m);
  }
  // Coordonnées jacobiennes [X, Y, Z] ; a = -3
  function dbl(P) {
    var X = P[0], Y = P[1], Z = P[2];
    if (Z === ZERO || Y === ZERO) return [ZERO, ONE, ZERO];
    var YY = mod(Y * Y, p), S = mod(FOUR * X * YY, p), ZZ = mod(Z * Z, p);
    var M = mod(THREE * (X - ZZ) * (X + ZZ), p);
    var X3 = mod(M * M - TWO * S, p);
    var Y3 = mod(M * (S - X3) - EIGHT * YY * YY, p);
    var Z3 = mod(TWO * Y * Z, p);
    return [X3, Y3, Z3];
  }
  function add(P, Q) {
    if (P[2] === ZERO) return Q;
    if (Q[2] === ZERO) return P;
    var Z1Z1 = mod(P[2] * P[2], p), Z2Z2 = mod(Q[2] * Q[2], p);
    var U1 = mod(P[0] * Z2Z2, p), U2 = mod(Q[0] * Z1Z1, p);
    var S1 = mod(P[1] * Q[2] * Z2Z2, p), S2 = mod(Q[1] * P[2] * Z1Z1, p);
    if (U1 === U2) return S1 === S2 ? dbl(P) : [ZERO, ONE, ZERO];
    var H = mod(U2 - U1, p), R = mod(S2 - S1, p);
    var HH = mod(H * H, p), HHH = mod(H * HH, p), V = mod(U1 * HH, p);
    var X3 = mod(R * R - HHH - TWO * V, p);
    var Y3 = mod(R * (V - X3) - S1 * HHH, p);
    var Z3 = mod(P[2] * Q[2] * H, p);
    return [X3, Y3, Z3];
  }
  function mul(k, P) {
    var R = [ZERO, ONE, ZERO], Q = P;
    while (k > ZERO) {
      if (k & ONE) R = add(R, Q);
      Q = dbl(Q);
      k >>= ONE;
    }
    return R;
  }
  function affine(P) {
    var zi = inv(P[2], p), zi2 = mod(zi * zi, p);
    return [mod(P[0] * zi2, p), mod(P[1] * zi2 * zi, p)];
  }
  function versBig(bytes) {
    var h = '0x0';
    for (var i = 0; i < bytes.length; i++) h += ('0' + (bytes[i] & 0xff).toString(16)).slice(-2);
    return BigInt(h);
  }
  function versOctets(x, len) {
    var h = x.toString(16);
    while (h.length < len * 2) h = '0' + h;
    var out = [];
    for (var i = 0; i < len; i++) { var v = parseInt(h.substr(i * 2, 2), 16); out.push(v > 127 ? v - 256 : v); }
    return out;
  }
  function clePublique(d) {
    var Q = affine(mul(d, [Gx, Gy, ONE]));
    return [4].concat(versOctets(Q[0], 32), versOctets(Q[1], 32));
  }
  /** Signature ECDSA brute (r‖s, 64 octets). hash : SHA-256 du message ; aleas : octets aléatoires. */
  function signer(d, hash, aleas) {
    var e = versBig(hash);
    for (var essai = 0; essai < 10; essai++) {
      var k = mod(versBig(aleas.concat([essai])), n - ONE) + ONE;
      var R = affine(mul(k, [Gx, Gy, ONE]));
      var r = mod(R[0], n);
      if (r === ZERO) continue;
      var s = mod(inv(k, n) * (e + r * d), n);
      if (s === ZERO) continue;
      return versOctets(r, 32).concat(versOctets(s, 32));
    }
    throw new Error('Signature impossible');
  }
  function nouvelleClePrivee(aleas) { return mod(versBig(aleas), n - ONE) + ONE; }
  return { clePublique: clePublique, signer: signer, nouvelleClePrivee: nouvelleClePrivee, versBig: versBig, versOctets: versOctets };
})();

function b64url_(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }
function b64urlTexte_(t) { return b64url_(Utilities.newBlob(t).getBytes()); }

function aleas_() {
  var a = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now() + Math.random());
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
  return a.concat(b);
}

/** Crée la paire de clés VAPID (une seule fois, à l'installation). */
function creerClesVapid_() {
  if (props_().getProperty('VAPID_PRIVEE')) return;
  var d = P256.nouvelleClePrivee(aleas_());
  props_().setProperty('VAPID_PRIVEE', d.toString(16));
  props_().setProperty('VAPID_PUBLIQUE', b64url_(P256.clePublique(d)));
}

function clePubliquePush_() { return props_().getProperty('VAPID_PUBLIQUE') || ''; }

function jetonVapid_(audience) {
  var cache = CacheService.getScriptCache();
  var cle = 'vapid_' + audience;
  var deja = cache.get(cle);
  if (deja) return deja;
  var d = BigInt('0x' + prop_('VAPID_PRIVEE'));
  var entete = b64urlTexte_(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  var corps = b64urlTexte_(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:' + CONFIG.ALIAS }));
  var aSigner = entete + '.' + corps;
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, aSigner, Utilities.Charset.UTF_8);
  var jeton = aSigner + '.' + b64url_(P256.signer(d, hash, aleas_()));
  cache.put(cle, jeton, 11 * 3600);
  return jeton;
}

function abonnerPush_(p, s) {
  if (!p.endpoint || !/^https:\/\//.test(p.endpoint)) throw erreur_('INVALIDE', 'Abonnement invalide.');
  return verrou_(function () {
    var deja = lignes_('Push').filter(function (x) { return x.endpoint === p.endpoint; })[0];
    if (deja) { deja.uid = s.uid; ecrireLigne_('Push', deja); }
    else ecrireLigne_('Push', { uid: s.uid, endpoint: p.endpoint, appareil: String(p.appareil || '').slice(0, 80), cree_le: maintenant_() });
    return true;
  });
}

function desabonnerPush_(p) {
  verrou_(function () {
    var f = feuille_('Push');
    lignes_('Push').reverse().forEach(function (x) { if (x.endpoint === p.endpoint) f.deleteRow(x._ligne); }); oublierLignes_();
  });
  return true;
}

/** Réveille tous les appareils d'un utilisateur. */
function envoyerPush_(uid) {
  var abonnements = lignes_('Push').filter(function (x) { return x.uid === uid; });
  var aSupprimer = [];
  abonnements.forEach(function (a) {
    try {
      var audience = a.endpoint.match(/^https:\/\/[^/]+/)[0];
      var rep = UrlFetchApp.fetch(a.endpoint, {
        method: 'post', muteHttpExceptions: true, payload: '',
        headers: { TTL: '86400', Urgency: 'high',
                   Authorization: 'vapid t=' + jetonVapid_(audience) + ', k=' + clePubliquePush_() }
      });
      var code = rep.getResponseCode();
      if (code === 404 || code === 410) aSupprimer.push(a.endpoint);
      else if (code >= 400) console.warn('Push ' + code + ' : ' + rep.getContentText().slice(0, 200));
    } catch (e) { console.warn('Push : ' + e); }
  });
  aSupprimer.forEach(function (ep) { desabonnerPush_({ endpoint: ep }); });
}
