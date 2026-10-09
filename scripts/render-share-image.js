/**
 * @file Tegner billedet, der vises, når et link til Økonomis deles (icons/share-image.png,
 * 1200 × 630 som Facebook, LinkedIn, Messenger, Slack og iMessage bruger): logoet, navnet
 * og en kort tekst i appens egne skrifttyper. Kør med: node scripts/render-share-image.js
 * (kræver Playwrights Chromium: npx playwright install chromium)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const url = file => pathToFileURL(path.join(ROOT, file)).href;
const icon = fs.readFileSync(path.join(ROOT, 'icons', 'icon.svg'), 'utf8');

// Navnet med kurslinjen gennem O'et - samme tegning og placering som i appens topbjælke.
const wordmark = `<span class="brand-o">O<svg viewBox="0 0 100 100"><g class="gap"><polyline points="13.0,87.0 44.0,46.0 55.0,55.0 76.1,27.3"/><polygon points="87.0,13.0 82.4,37.2 64.9,23.8"/></g><g class="line"><polyline points="13.0,87.0 44.0,46.0 55.0,55.0 76.1,27.3"/><polygon points="87.0,13.0 82.4,37.2 64.9,23.8"/></g></svg></span>konomis`;

const html = `<!DOCTYPE html><html lang="da"><head><meta charset="UTF-8"><style>
@font-face{ font-family:'Newsreader'; font-weight:400 600; src:url(${url('fonts/newsreader-variable.woff2')}) format('woff2'); }
@font-face{ font-family:'Manrope'; font-weight:400 700; src:url(${url('fonts/manrope-variable.woff2')}) format('woff2'); }
html, body{ margin:0; }
body{ width:1200px; height:630px; box-sizing:border-box; padding:96px 104px; background:#0B0B0C; color:#EDEDEE;
      display:flex; flex-direction:column; justify-content:center; font-family:'Manrope', sans-serif; }
.head{ display:flex; align-items:center; gap:36px; }
.head svg.logo{ width:150px; height:150px; flex-shrink:0; }
.name{ font-family:'Newsreader', serif; font-size:128px; font-weight:600; letter-spacing:-0.01em; line-height:1; }
.brand-o{ position:relative; display:inline-block; line-height:1; }
.brand-o svg{ position:absolute; left:50%; top:-0.172em; width:1.1em; height:1.1em; margin-left:-0.55em; overflow:visible; }
.brand-o polyline{ fill:none; stroke-linejoin:round; stroke-linecap:round; }
.brand-o .gap{ fill:#0B0B0C; stroke:#0B0B0C; } .brand-o .gap polyline{ stroke-width:16; } .brand-o .gap polygon{ stroke-width:9; stroke-linejoin:round; }
.brand-o .line{ fill:#3CC08E; stroke:#3CC08E; } .brand-o .line polyline{ stroke-width:7.5; } .brand-o .line polygon{ stroke-width:1.5; }
.tagline{ margin:56px 0 0; font-size:46px; font-weight:600; letter-spacing:-0.01em; }
.sub{ margin:18px 0 0; font-size:30px; color:#A3A3AB; }
</style></head><body>
<div class="head">${icon.replace('<svg', '<svg class="logo"')}<div class="name">${wordmark}</div></div>
<p class="tagline">Få overblik over din økonomi</p>
<p class="sub">Budget, formue, investering og lån – dine tal bliver på din egen enhed.</p>
</body></html>`;

(async () => {
    const file = path.join(os.tmpdir(), 'okonomis-share-image.html');
    fs.writeFileSync(file, html);
    const browser = await chromium.launch();
    const page = await browser.newPage({viewport: {width: 1200, height: 630}});
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path: path.join(ROOT, 'icons', 'share-image.png')});
    await browser.close();
    fs.unlinkSync(file);
    console.log('icons/share-image.png er tegnet.');
})();
