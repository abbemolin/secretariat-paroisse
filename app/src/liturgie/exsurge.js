// Exsurge (rendu des partitions grégoriennes) : le même fichier que l'AppMesse, chargé seulement quand il sert.
// Il fait partie de l'appli (dossier public) : disponible hors ligne.
let promesse = null
export function chargerExsurge() {
  if (window.exsurge) return Promise.resolve(window.exsurge)
  if (!promesse) {
    promesse = new Promise((ok, ko) => {
      const s = document.createElement('script')
      s.src = './exsurge.js'
      s.onload = () => (window.exsurge ? ok(window.exsurge) : ko(new Error('Exsurge introuvable')))
      s.onerror = () => { promesse = null; ko(new Error('Exsurge indisponible')) }
      document.head.appendChild(s)
    })
  }
  return promesse
}
