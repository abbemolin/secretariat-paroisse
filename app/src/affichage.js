// Réglages d'affichage propres à cet appareil : taille du texte et thème (clair / sombre / automatique).
const CLE = 'secretariat.affichage'
export const TAILLES = { normal: 'Normal', grand: 'Grand', tresgrand: 'Très grand' }
export const THEMES = { clair: 'Clair', sombre: 'Sombre', auto: 'Comme l\'appareil' }

export function lireAffichage() {
  try { return { taille: 'normal', theme: 'clair', ...JSON.parse(localStorage.getItem(CLE) || '{}') } } catch { return { taille: 'normal', theme: 'clair' } }
}
export function ecrireAffichage(a) {
  try { localStorage.setItem(CLE, JSON.stringify(a)) } catch { /* ignore */ }
  appliquerAffichage(a)
}
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
export function appliquerAffichage(a = lireAffichage()) {
  const h = document.documentElement
  h.classList.remove('texte-grand', 'texte-tresgrand')
  if (a.taille === 'grand') h.classList.add('texte-grand')
  if (a.taille === 'tresgrand') h.classList.add('texte-tresgrand')
  let sombre = a.theme === 'sombre' || (a.theme === 'auto' && media?.matches)
  // Tuile « Bible et bréviaire » : son propre choix (bouton ☾), sur cet appareil, l'emporte tant qu'on y est
  const lit = liturgieActive && themeLiturgie()
  if (lit) sombre = lit === 'sombre'
  h.classList.toggle('sombre', !!sombre)
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', sombre ? '#1f1517' : '#521a22')
  window.dispatchEvent(new Event('theme-liturgie'))
}
media?.addEventListener?.('change', () => appliquerAffichage())

// ─── Thème de la tuile « Bible et bréviaire » : par défaut celui du compte ; le bouton ☾ le change pour la tuile seule ───
const CLE_LIT = 'liturgie.theme'
let liturgieActive = false
export function themeLiturgie() { try { const t = localStorage.getItem(CLE_LIT); return t === 'sombre' || t === 'clair' ? t : null } catch { return null } }
export const estSombre = () => document.documentElement.classList.contains('sombre')
export function definirTuileLiturgie(actif) {
  if (liturgieActive === actif) return
  liturgieActive = actif
  appliquerAffichage()
}
/** Bouton ☾ : bascule clair / sombre pour la tuile ; revenir au choix du compte efface le réglage propre. */
export function basculerSombreLiturgie() {
  const voulu = estSombre() ? 'clair' : 'sombre'
  liturgieActive = false; appliquerAffichage(); const compte = estSombre() ? 'sombre' : 'clair'; liturgieActive = true
  try { if (voulu === compte) localStorage.removeItem(CLE_LIT); else localStorage.setItem(CLE_LIT, voulu) } catch { /* ignore */ }
  appliquerAffichage()
}
