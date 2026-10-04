// Service worker d'AccordGo : permet de l'ouvrir sans connexion.
// Réseau d'abord (les mises à jour arrivent tout de suite), cache en secours hors connexion.
const CACHE = "accordgo-v2";
const FICHIERS = [
  "./", "index.html", "manifest.webmanifest", "config.js", "cloud.js",
  "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(FICHIERS.map((f) => c.add(f).catch(() => null)))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // jamais de cache pour Supabase ni les polices
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) { const copie = res.clone(); caches.open(CACHE).then((c) => c.put(req, copie)); }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
  );
});
