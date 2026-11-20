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
  const sombre = a.theme === 'sombre' || (a.theme === 'auto' && media?.matches)
  h.classList.toggle('sombre', !!sombre)
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', sombre ? '#1f1517' : '#521a22')
}
media?.addEventListener?.('change', () => appliquerAffichage())
