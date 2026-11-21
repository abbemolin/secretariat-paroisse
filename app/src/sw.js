/* Service worker : appli hors ligne + notifications sur téléphone. */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

self.skipWaiting()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// Les formulaires publics (formulaires/*.html) ne passent pas par l'appli
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/\/(formulaires|premiere-communion|profession-de-foi|fraternite|retraite|paiement|livres)\//] }))
self.addEventListener('activate', () => self.clients.claim())

function lire(cle) {
  return new Promise((ok) => {
    const r = indexedDB.open('secretariat', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('kv')
    r.onsuccess = () => {
      const g = r.result.transaction('kv').objectStore('kv').get(cle)
      g.onsuccess = () => ok(g.result)
      g.onerror = () => ok(null)
    }
    r.onerror = () => ok(null)
  })
}

// Le serveur envoie une notification « vide » : on va chercher le texte.
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let titre = 'Secrétariat – La Croix glorieuse', texte = 'Nouvelle notification', lien = '#/'
    try {
      const [url, token] = await Promise.all([lire('apiUrl'), lire('token')])
      if (url && token) {
        const rep = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'notifications.liste', token, payload: { nonLues: true, limite: 1 } }) })
        const json = await rep.json()
        const n = json.ok && json.data[0]
        if (n) { titre = n.titre; texte = n.texte; lien = n.lien || lien }
      }
    } catch { /* texte générique */ }
    await self.registration.showNotification(titre, { body: texte, icon: 'icon-192.png', badge: 'icon-192.png', data: { lien }, tag: 'secretariat' })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const cible = new URL(self.registration.scope).href + (event.notification.data?.lien || '#/')
  event.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const f of fenetres) { if ('focus' in f) { await f.focus(); f.navigate?.(cible); return } }
    await self.clients.openWindow(cible)
  })())
})
