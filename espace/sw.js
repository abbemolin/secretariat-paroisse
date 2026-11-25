// Service worker de l'app « La Croix glorieuse » : page disponible hors ligne et notifications.
const CACHE = 'croix-glorieuse-v13'
const FICHIERS = ['./', 'index.html', 'agenda.js', 'bible.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting())) })
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE && x !== 'croix-glorieuse-infos').map((x) => caches.delete(x)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url)
  if (e.request.method !== 'GET' || u.origin !== location.origin) return
  // réseau d'abord (toujours la dernière version), cache si hors ligne
  e.respondWith(fetch(e.request).then((r) => { const copie = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copie)); return r })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))))
})
self.addEventListener('push', (e) => {
  // Le jour anniversaire du baptême (date gardée par la page), message de fête ;
  // une annonce notifiée par la paroisse : son titre (demandé au serveur) ; sinon message général
  const auj = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', month: '2-digit', day: '2-digit' }).format(new Date())
  const lire = (k) => caches.open('croix-glorieuse-infos').then((c) => c.match(k)).then((r) => (r ? r.text() : '')).catch(() => '')
  const annonce = () => lire('url').then((url) => (url ? fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'public.notif', payload: {} }) })
    .then((r) => r.json()).then((r) => (r && r.ok && r.data && (r.data.type === 'annonce' || r.data.type === 'proposition') ? r.data : null)).catch(() => null) : null))
  e.waitUntil(Promise.all([lire('anniv'), annonce()]).then(([anniv, a]) => {
    const fete = anniv && anniv === auj
    if (a && !fete) return self.registration.showNotification(a.type === 'proposition' ? 'Votre étape du jour' : 'La Croix glorieuse – annonce', { body: a.titre, icon: 'icon-192.png', badge: 'icon-192.png', tag: a.type })
    return self.registration.showNotification(fete ? 'Joyeux anniversaire de baptême !' : 'La Croix glorieuse',
      { body: fete ? 'La paroisse rend grâce avec vous. Ouvrez l\'app pour lire le mot de la paroisse.' : 'Du nouveau dans votre espace : un texte ou une réponse de la paroisse.', icon: 'icon-192.png', badge: 'icon-192.png', tag: fete ? 'anniversaire' : 'espace' })
  }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((l) => {
    for (const c of l) if ('focus' in c) return c.focus()
    return self.clients.openWindow('./')
  }))
})
