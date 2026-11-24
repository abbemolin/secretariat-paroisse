// Données liturgiques publiques de l'AppMesse (offices, Messe du jour, calendrier).
// Une seule adresse à changer le jour où l'AppMesse passera sur messe.croix-glorieuse.org.
export const SOURCE = 'https://abbemolin.github.io/appMesse/'

export const CACHE_LITURGIE = 'liturgie-v1'
export const deux = (n) => String(n).padStart(2, '0')
export const isoJour = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
export const url = (chemin) => SOURCE + chemin

/** Lit un fichier de l'AppMesse : réseau d'abord, sinon la copie gardée sur l'appareil. */
export async function lireFichier(chemin, { garder = false } = {}) {
  const u = url(chemin)
  let rep = null
  try {
    rep = await fetch(u, { cache: 'no-cache' })
    if (rep.ok && garder && 'caches' in window) caches.open(CACHE_LITURGIE).then((c) => c.put(u, rep.clone())).catch(() => {})
  } catch {
    rep = 'caches' in window ? await caches.match(u) : null
    if (!rep) throw new Error('HORS_LIGNE')
  }
  if (rep.status === 404) return null
  if (!rep.ok) {
    const copie = 'caches' in window ? await caches.match(u) : null
    if (copie) return copie.json()
    throw new Error('HTTP ' + rep.status)
  }
  return rep.json()
}

// ─── Hors ligne : les 30 prochains jours, téléchargés automatiquement (comme l'AppMesse) ───
export const JOURS_HORS_LIGNE = 30
export const FICHIERS_JOUR = ['Matutinum', 'Laudes', 'Prima', 'Tertia', 'Sexta', 'Nona', 'Vespera', 'Vespera-gregorien', 'Completorium']
const cheminOffice = (d, f) => `data/breviaire/${d.getFullYear()}/${deux(d.getMonth() + 1)}-${deux(d.getDate())}/${f}.json`
const cheminMesse = (d) => `data/messe/${d.getFullYear()}/${deux(d.getMonth() + 1)}-${deux(d.getDate())}.json`
export { cheminOffice, cheminMesse }

let enCours = null
const abonnes = new Set()
let etat = ''
function annoncer(t) { etat = t; abonnes.forEach((f) => f(t)) }
/** fn(texte) à chaque étape du téléchargement ; renvoie la fonction pour se désabonner. */
export function suivrePrechargement(fn) { abonnes.add(fn); fn(etat); return () => abonnes.delete(fn) }

export function prechargerLiturgie() {
  if (enCours) return enCours
  if (!('caches' in window)) return Promise.resolve()
  if (navigator.onLine === false) { annoncer('Sans connexion : offices déjà téléchargés disponibles'); return Promise.resolve() }
  enCours = (async () => {
    try {
      navigator.storage?.persist?.().catch(() => {})
      const cache = await caches.open(CACHE_LITURGIE)
      const auj = new Date(); auj.setHours(0, 0, 0, 0)
      // Retire les jours passés
      const hier = new Date(auj); hier.setDate(hier.getDate() - 1)
      const limite = `${hier.getFullYear()}/${deux(hier.getMonth() + 1)}-${deux(hier.getDate())}`
      for (const req of await cache.keys()) {
        const m = req.url.match(/data\/(?:breviaire|messe)\/(\d{4}\/\d{2}-\d{2})/)
        if (m && m[1] < limite) await cache.delete(req)
      }
      // Calendrier et propre de la communauté : toujours rafraîchis
      const manquants = [url('data/messe/calendrier.json'), url('data/messe/smmd.json')]
      const jours = []
      for (let i = 0; i < JOURS_HORS_LIGNE; i++) {
        const d = new Date(auj); d.setDate(auj.getDate() + i)
        jours.push(d)
        for (const f of FICHIERS_JOUR) { const u = url(cheminOffice(d, f)); if (!(await cache.match(u))) manquants.push(u) }
        const um = url(cheminMesse(d)); if (!(await cache.match(um))) manquants.push(um)
      }
      let enEchec = 0, faits = 0
      const total = manquants.length
      if (total > 2) annoncer(`Hors ligne : téléchargement… 0 sur ${total}`)
      const ouvrier = async () => {
        while (manquants.length) {
          const u = manquants.shift()
          try {
            const r = await fetch(u, { cache: 'no-cache' })
            if (r.ok) await cache.put(u, r.clone())
            else if (r.status !== 404) enEchec++
          } catch { enEchec++ }
          faits++
          if (total > 2 && (faits % 10 === 0 || faits === total)) annoncer(`Hors ligne : téléchargement… ${faits} sur ${total}`)
        }
      }
      await Promise.all([ouvrier(), ouvrier(), ouvrier()])
      let prets = 0
      for (const d of jours) {
        const ok = await Promise.all(FICHIERS_JOUR.map((f) => cache.match(url(cheminOffice(d, f)))))
        if (ok.every(Boolean)) prets++; else break
      }
      annoncer(enEchec || prets < JOURS_HORS_LIGNE
        ? `Hors ligne : ${prets} jour${prets > 1 ? 's' : ''} prêt${prets > 1 ? 's' : ''} · toucher pour réessayer`
        : `Hors ligne : ${prets} jours prêts`)
    } catch (e) {
      console.error(e)
      annoncer('Hors ligne : téléchargement impossible · toucher pour réessayer')
    } finally { enCours = null }
  })()
  return enCours
}
