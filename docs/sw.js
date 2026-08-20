/* Service Worker — macht die App startfähig, auch ohne Netz.
   Läuft sowohl unter / (eigener Server) als auch unter /Ladekarte/ (GitHub Pages):
   alle Pfade sind relativ zum Ort dieser Datei.
   Kartenkacheln und die Belegungsabfrage bleiben bewusst ungecacht. */
const CACHE = "ladekarte-v2";
const BASIS = new URL("./", self.location).pathname;   // "/" oder "/Ladekarte/"
const HUELLE = [
  "./", "./app.css", "./app.js", "./manifest.webmanifest",
  "./vendor/leaflet/leaflet.css", "./vendor/leaflet/leaflet.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(HUELLE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(namen => Promise.all(namen.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;          // Kacheln, Schriften: direkt ans Netz
  if(url.pathname.startsWith(BASIS + "api/")) return;      // Konto und Daten nie aus dem Cache

  if(req.mode === "navigate"){
    e.respondWith(fetch(req)
      .then(a => { caches.open(CACHE).then(c => c.put(BASIS, a.clone())); return a; })
      .catch(() => caches.match(BASIS)));
    return;
  }
  e.respondWith(caches.match(req).then(treffer => treffer || fetch(req).then(a => {
    if(a.ok) { const kopie = a.clone(); caches.open(CACHE).then(c => c.put(req, kopie)); }
    return a;
  })));
});
