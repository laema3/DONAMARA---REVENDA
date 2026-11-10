// Service Worker for DONAMARA PWA
const CACHE_NAME = 'donamara-pwa-v1';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/manifest-tv.json',
  '/manifest-totem.json',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/screenshot-wide.png',
  '/screenshot-narrow.png',
  '/logo.svg',
  '/favicon.svg'
];

// Install event - pre-cache critical shell assets & activate immediately
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install event fired');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Precache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches & claim clients
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate event fired');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache for offline resilience
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET requests, dev server modules, and API/websocket/Firebase requests
  const url = request.url;
  if (
    request.method !== 'GET' ||
    url.includes('/src/') ||
    url.includes('/@vite/') ||
    url.includes('/@fs/') ||
    url.includes('/@id/') ||
    url.includes('/node_modules/') ||
    url.includes('?v=') ||
    url.includes('/api/') ||
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('ntfy.sh') ||
    url.startsWith('chrome-extension://')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Return valid network response
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        // If offline, attempt to serve from cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to offline root if HTML request
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

// Click em notificação do sistema
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Push notification para smartphone com tela bloqueada / app em segundo plano
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'DONAMARA Salgados', message: event.data ? event.data.text() : 'Atualização do seu pedido!' };
  }
  const title = data.title || 'DONAMARA - Atualização do Pedido';
  const isFrozen = (data.title && data.title.includes('Congelad')) || (data.alertType === 'frozen_48h') || (data.message && data.message.toLowerCase().includes('congelad'));
  const firstName = String(data.customerName || 'Cliente').trim().split(' ')[0];
  const notificationBody = data.shortMessage || (isFrozen 
    ? `Olá ${firstName}! Prazo de até 48h, podendo adiantar. Se ficar pronto antes, avisaremos você!`
    : (data.message || data.body || 'Seu pedido teve uma nova atualização!'));

  const options = {
    body: notificationBody,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [250, 100, 250],
    data: data,
    tag: data.orderId ? `order-${data.orderId}` : 'donamara-notification',
    renotify: true,
    requireInteraction: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
