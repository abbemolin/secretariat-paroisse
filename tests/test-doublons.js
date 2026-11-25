// node tests/test-doublons.js — dans Apps Script, tous les fichiers partagent les mêmes noms :
// une fonction définie dans deux fichiers est remplacée en silence par l'autre. Ce test l'interdit.
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'backend'), vus = {};
let ko = 0, n = 0;
fs.readdirSync(dir).filter((f) => f.endsWith('.gs')).forEach((f) => {
  for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/^function ([A-Za-z0-9_]+)\s*\(/gm)) {
    n++;
    if (vus[m[1]]) { ko++; console.log(`ÉCHEC : ${m[1]} défini dans ${vus[m[1]]} et ${f}`); } else vus[m[1]] = f;
  }
});
console.log(`${n - ko} vérifications OK, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
