/* Service Worker — Bride List.
   الاستراتيجية: «الشبكة أولًا» لكل الملفات الثابتة من نفس الموقع مع نسخة احتياطية في الكاش، فيحصل الزائر على أحدث نسخة دائمًا
   عند وجود اتصال، ويعمل التطبيق دون اتصال بآخر نسخة زارها. لا يُخزَّن شيء من بيانات المستخدم هنا (بياناته في localStorage فقط)،
   ولا تُخزَّن طلبات /api/ ولا أي طلب لموقع آخر (Google وغيرها). لتحديث النسخة: غيّري CACHE_VERSION عند كل نشر. */
const CACHE_VERSION = "bride-list-2026-10-30-v7";
const CORE = ["/", "/offline/", "/manifest.webmanifest", "/assets/css/style.css", "/assets/css/pages.css", "/assets/js/site-config.js", "/assets/js/consent.js",
  "/assets/js/icons.js", "/assets/js/catalog.js", "/assets/js/tips.js", "/assets/js/storage.js", "/assets/js/calc.js", "/assets/js/app.js", "/assets/js/pwa.js",
  "/assets/img/logo-120.webp", "/assets/img/logo-384.webp", "/assets/img/logo-192.png", "/assets/img/default-bride.webp"];
const NETWORK_TIMEOUT = 4000;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => Promise.all(CORE.map(url => cache.add(new Request(url, { cache: "reload" })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function networkFirst(request) {
  return new Promise(resolve => {
    let settled = false;
    const fallback = () => caches.match(request, { ignoreSearch: false }).then(hit => hit || caches.match(request, { ignoreSearch: true }));
    const timer = setTimeout(() => fallback().then(hit => { if (hit && !settled) { settled = true; resolve(hit); } }), NETWORK_TIMEOUT);
    fetch(request.mode === "navigate" ? request : new Request(request, { cache: "no-cache" })).then(response => {   /* no-cache = يتحقق من الخادم دائمًا ولا يعتمد على كاش المتصفح القديم */
      clearTimeout(timer);
      if (response && response.ok && response.type === "basic") { const copy = response.clone(); caches.open(CACHE_VERSION).then(c => c.put(request, copy)); }
      if (!settled) { settled = true; resolve(response); }
    }).catch(() => {
      clearTimeout(timer);
      fallback().then(hit => {
        if (settled) return; settled = true;
        if (hit) return resolve(hit);
        if (request.mode === "navigate") return caches.match("/offline/").then(o => resolve(o || Response.error()));
        resolve(Response.error());
      });
    });
  });
}
self.addEventListener("fetch", event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  event.respondWith(networkFirst(req));
});
self.addEventListener("message", event => { if (event.data === "skipWaiting") self.skipWaiting(); });
