// node outils/maj-verification.js — met à jour la liste FICHIERS_ATTENDUS de backend/Verification.gs
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'backend'), cible = path.join(dir, 'Verification.gs');
const lignes = fs.readdirSync(dir).filter((f) => f.endsWith('.gs') && f !== 'Verification.gs').sort().map((f) => {
  const t = fs.readFileSync(path.join(dir, f), 'utf8'), fns = [...t.matchAll(/^function ([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]);
  return fns.length ? `    '${f}': ['${fns[0]}', '${fns[fns.length - 1]}', ${t.split('\n').length - (t.endsWith('\n') ? 1 : 0)}]` : null;
}).filter(Boolean);
const v = fs.readFileSync(cible, 'utf8').replace(/var FICHIERS_ATTENDUS = \{[\s\S]*?\n\};/, 'var FICHIERS_ATTENDUS = {\n' + lignes.join(',\n') + '\n};');
fs.writeFileSync(cible, v);
console.log('Verification.gs : ' + lignes.length + ' fichiers');
