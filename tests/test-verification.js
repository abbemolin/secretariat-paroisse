// node tests/test-verification.js — Verification.gs connaît bien tous les fichiers du serveur (sinon : régénérer la liste FICHIERS_ATTENDUS)
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'backend');
const ctx = {}; vm.runInNewContext(fs.readFileSync(path.join(dir, 'Verification.gs'), 'utf8') + ';this.F=FICHIERS_ATTENDUS;', ctx);
let ok = 0, ko = 0;
fs.readdirSync(dir).filter((f) => f.endsWith('.gs') && f !== 'Verification.gs').forEach((f) => {
  const t = fs.readFileSync(path.join(dir, f), 'utf8'), fns = [...t.matchAll(/^function ([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]);
  const x = ctx.F[f];
  if (x && x[0] === fns[0] && x[1] === fns[fns.length - 1] && x[2] === t.split('\n').length - (t.endsWith('\n') ? 1 : 0)) ok++;
  else { ko++; console.log('ÉCHEC : Verification.gs pas à jour pour', f); }
});
console.log(`${ok} vérifications OK, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
