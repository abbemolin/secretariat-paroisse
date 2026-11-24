// Simulation minimale des services Apps Script pour tester le serveur dans Node.
const crypto = require('crypto');
function Sheet(name) { this.name = name; this.rows = []; }
Sheet.prototype.appendRow = function (r) { this.rows.push(r.map(v => v)); return this; };
Sheet.prototype.getLastRow = function () { return this.rows.length; };
Sheet.prototype.getLastColumn = function () { return Math.max(0, ...this.rows.map(r => r.length)); };
Sheet.prototype.deleteRow = function (n) { this.rows.splice(n - 1, 1); };
Sheet.prototype.setFrozenRows = function () {};
Sheet.prototype.getDataRange = function () { return this.getRange(1, 1, this.rows.length, this.getLastColumn()); };
Sheet.prototype.getRange = function (r, c, nr, nc) {
  const sh = this;
  if (typeof r === 'string') { return { setNumberFormat() { return this; }, getValues() { return sh.rows; } }; }
  nr = nr || 1; nc = nc || 1;
  return {
    setNumberFormat() { return this; },
    getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = sh.rows[r - 1 + i] || []; const o = []; for (let j = 0; j < nc; j++) o.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); out.push(o); } return out; },
    setValues(v) { for (let i = 0; i < v.length; i++) { while (sh.rows.length < r + i) sh.rows.push([]); const row = sh.rows[r - 1 + i]; for (let j = 0; j < v[i].length; j++) row[c - 1 + j] = v[i][j]; } return this; },
    clearContent() { for (let i = 0; i < nr; i++) { const row = sh.rows[r - 1 + i]; if (row) for (let j = 0; j < nc; j++) row[c - 1 + j] = ''; } return this; }
  };
};
const SS = { sheets: {}, getSheetByName(n) { return this.sheets[n] || null; }, insertSheet(n) { return (this.sheets[n] = new Sheet(n)); }, getSpreadsheetTimeZone() { return 'Europe/Paris'; } };
const props = { DB_ID: 'db' };
const cache = {};
global.mails = [];
global.fetches = [];
Object.assign(global, {
  SpreadsheetApp: { openById() { return SS; } },
  PropertiesService: { getScriptProperties() { return { getProperty: k => (k in props ? props[k] : null), setProperty(k, v) { props[k] = String(v); return this; }, deleteProperty(k) { delete props[k]; return this; }, getProperties: () => ({ ...props }) }; } },
  CacheService: { getScriptCache() { return { get: k => (k in cache ? cache[k] : null), put(k, v) { cache[k] = String(v); }, remove(k) { delete cache[k]; } }; } },
  LockService: { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (a, t) => [...crypto.createHash('sha256').update(String(t)).digest()].map(b => (b > 127 ? b - 256 : b)),
    computeHmacSha256Signature: (t, k) => [...crypto.createHmac('sha256', k).update(t).digest()].map(b => (b > 127 ? b - 256 : b)),
    formatDate: (d, tz, f) => { const s = new Date(d).toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }); if (f === 'yyyy-MM-dd') return s.slice(0, 10); if (f === 'HH:mm') return s.slice(11, 16); if (f === 'u') return String(new Date(d).getDay() || 7); if (f === 'H') return String(Number(s.slice(11, 13))); return s; },
    base64EncodeWebSafe: b => Buffer.from(b).toString('base64url'),
    newBlob: t => ({ getBytes: () => [...Buffer.from(String(t))] })
  },
  GmailApp: { sendEmail(to, sujet, texte, o) { global.mails.push({ to, sujet, texte }); }, getAliases: () => ['secretariat@croix-glorieuse.org'] },
  MailApp: { getRemainingDailyQuota: () => 100 },
  UrlFetchApp: { fetchAll(l) { global.fetches.push(...l); return l.map(() => ({ getResponseCode: () => 201, getContentText: () => '' })); }, fetch(u) { global.fetches.push(u); return { getResponseCode: () => 200, getContentText: () => '[]' }; } },
  ContentService: { createTextOutput: t => ({ setMimeType() { return { t }; } }), MimeType: { JSON: 'json' } },
  Session: { getScriptTimeZone: () => 'Europe/Paris' },
  console
});
module.exports = { SS, props, cache, Sheet };
