self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open('hb-v4').then(cache=>cache.addAll([
    './','index.html','styles.css','app.js','manifest.json'
  ])));
});
self.addEventListener('fetch', (e)=>{
  e.respondWith(caches.match(e.request).then(res=> res || fetch(e.request)));
});
