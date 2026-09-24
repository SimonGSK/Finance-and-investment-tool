/**
 * Service worker: gør siden installerbar som app og brugbar uden internet.
 * Netværket først - så en ny version altid hentes, når man er online - og
 * gemte kopier, når man er offline. Ved installation gemmes alle filer, som
 * index.html henviser til, så appen virker offline allerede fra første besøg.
 * Brugerens data ligger i localStorage og røres ikke her.
 */
const CACHE = 'okonomi-v1';

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        const html = await (await fetch('index.html', {cache: 'reload'})).text();
        // Alle lokale scripts, stylesheets og ikoner, som siden henviser til, plus Chart.js og skrifttyperne.
        const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1])
            .filter(u => !u.startsWith('//') && !u.startsWith('mailto:') && !/^https:\/\/(?!cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/.test(u));
        await cache.addAll(['./', 'index.html', 'manifest.webmanifest']);
        await Promise.all([...new Set(refs)].map(u => cache.add(new Request(u, {mode: u.startsWith('http') ? 'no-cors' : 'same-origin'})).catch(() => {})));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if(request.method !== 'GET') return;           // fx feedbackformularen
    const url = new URL(request.url);
    const cacheable = url.origin === location.origin || /^(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);
    if(!cacheable) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        try{
            const response = await fetch(request);
            if(response.ok || response.type === 'opaque') cache.put(request, response.clone());
            return response;
        } catch(e){
            const cached = await cache.match(request, {ignoreSearch: request.mode === 'navigate'})
                || (request.mode === 'navigate' ? await cache.match('index.html') : undefined);
            if(cached) return cached;
            throw e;
        }
    })());
});
