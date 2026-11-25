// node outils/publier-serveur.js <dossier> — copie les fichiers du serveur (backend/*.gs, appsscript.json)
// dans <dossier>/serveur/ avec manifeste.json, que le serveur lit pour se mettre à jour (MiseAJour.gs).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const src = path.join(__dirname, '..', 'backend'), dest = path.join(process.argv[2] || 'dist', 'serveur');
fs.mkdirSync(dest, { recursive: true });
const noms = fs.readdirSync(src).filter((f) => f.endsWith('.gs') || f === 'appsscript.json').sort();
const h = crypto.createHash('sha256'), fichiers = [];
for (const nom of noms) {
  const t = fs.readFileSync(path.join(src, nom), 'utf8');
  fs.writeFileSync(path.join(dest, nom), t);
  h.update(nom + '\0' + t + '\0');
  fichiers.push({ nom, lignes: t.split('\n').length });
}
const man = { empreinte: h.digest('hex'), commit: process.env.GITHUB_SHA || '', le: new Date().toISOString(), fichiers };
fs.writeFileSync(path.join(dest, 'manifeste.json'), JSON.stringify(man, null, 1));
console.log(`serveur/ : ${fichiers.length} fichiers, empreinte ${man.empreinte.slice(0, 12)}`);
