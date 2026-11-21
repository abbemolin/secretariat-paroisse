// Service worker de l'app « Croix glorieuse » : page disponible hors ligne et notifications.
const CACHE = 'croix-glorieuse-v1'
const FICHIERS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting())) })
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url)
  if (e.request.method !== 'GET' || u.origin !== location.origin) return
  // réseau d'abord (toujours la dernière version), cache si hors ligne
  e.respondWith(fetch(e.request).then((r) => { const copie = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copie)); return r })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))))
})
self.addEventListener('push', (e) => {
  e.waitUntil(self.registration.showNotification('Croix glorieuse', { body: 'Du nouveau dans votre espace : un texte ou une réponse de la paroisse.', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'espace' }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((l) => {
    for (const c of l) if ('focus' in c) return c.focus()
    return self.clients.openWindow('./')
  }))
})
