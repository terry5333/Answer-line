const CACHE_NAME = 'smartedu-admin-v2';
const ASSETS = [
  '/',
  '/login.html',
  '/admin.html',
  '/manifest.json'
];

// 安裝 Service Worker 並快取核心檔案
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 攔截網路請求，達成離線加速
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
