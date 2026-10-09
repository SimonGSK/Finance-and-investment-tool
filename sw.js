/**
 * Service worker: gør siden installerbar som app og brugbar uden internet.
 * Netværket først - så en ny version altid hentes, når man er online - og
 * gemte kopier, når man er offline. Ved installation gemmes alle filer, som
 * index.html henviser til, så appen virker offline allerede fra første besøg.
 * Alt ligger på siden selv (også Chart.js og skrifttyperne), så kun egne filer gemmes.
 * Brugerens data ligger i localStorage og røres ikke her.
 */
const CACHE = 'okonomi-v3';

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        const html = await (await fetch('index.html', {cache: 'reload'})).text();
        // Alle egne scripts, stylesheets, skrifttyper og ikoner, som siden henviser til (ikke links til andre sider).
        const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1])
            .filter(u => !/^([a-z]+:|\/\/)/i.test(u));
        await cache.addAll(['./', 'index.html', 'manifest.webmanifest']);
        await Promise.all([...new Set(refs)].map(u => cache.add(u).catch(() => {})));
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
    if(url.origin !== location.origin) return;     // kun sidens egne filer
    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        try{
            // no-cache: spørg altid serveren, om filen er ændret (et billigt "uændret"-svar, hvis ikke).
            // Ellers kan browserens egen cache give en gammel CSS-fil til en ny side.
            const response = await fetch(request, {cache: 'no-cache'});
            if(response.ok) cache.put(request, response.clone());
            return response;
        } catch(e){
            const cached = await cache.match(request, {ignoreSearch: request.mode === 'navigate'})
                || (request.mode === 'navigate' ? await cache.match('index.html') : undefined);
            if(cached) return cached;
            throw e;
        }
    })());
});
