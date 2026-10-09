#!/usr/bin/env node
/**
 * En lille statisk webserver til udvikling og browsertestene: viser mappen på
 * http://localhost:<port> (standard 4173). Ingen pakker - kun Node selv.
 *     npm start                  (port 4173)
 *     node scripts/serve.js 4174 (bruges af Playwright)
 *
 * Pythons http.server tabte indimellem forespørgsler, når en side hentede mange
 * filer på én gang (scripts, skrifttyper, ikoner), så en test kunne fejle uden grund.
 * Svarene har "no-cache", så browseren altid spørger, om en fil er ændret - som på
 * GitHub Pages efter en ny version. Findes en adresse ikke, vises 404.html (også som der).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = Number(process.argv[2] || process.env.PORT || 4173);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
    let file;
    try{
        const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        file = path.join(root, urlPath.endsWith('/') ? urlPath + 'index.html' : urlPath);
    } catch(e){
        res.writeHead(400).end();
        return;
    }
    // Kun filer i projektmappen (ingen ../), og ikke skjulte mapper som .git.
    if(!file.startsWith(root + path.sep) || path.relative(root, file).split(path.sep).some(part => part.startsWith('.'))){
        res.writeHead(404).end('Ikke fundet');
        return;
    }
    fs.stat(file, (err, stat) => {
        if(err || !stat.isFile()){
            // Som GitHub Pages: 404.html, når en adresse ikke findes.
            fs.readFile(path.join(root, '404.html'), (e, page) => {
                if(e) res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end('Ikke fundet');
                else res.writeHead(404, {'Content-Type': TYPES['.html']}).end(page);
            });
            return;
        }
        const modified = stat.mtime.toUTCString();
        const headers = {
            'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Last-Modified': modified,
            'Cache-Control': 'no-cache'
        };
        if(req.headers['if-modified-since'] === modified){
            res.writeHead(304, headers).end();
            return;
        }
        res.writeHead(200, {...headers, 'Content-Length': stat.size});
        if(req.method === 'HEAD'){ res.end(); return; }
        fs.createReadStream(file).pipe(res);
    });
});

server.listen(port, () => console.log(`Økonomis kører på http://localhost:${port}`));
