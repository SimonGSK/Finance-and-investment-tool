/**
 * @file Tegner app-ikonerne (PNG) ud fra icons/icon.svg, som er kilden.
 * Kør med: node scripts/render-icons.js  (kræver Playwrights Chromium: npx playwright install chromium)
 *
 * - favicon-32.png, icon-192.png, icon-512.png: med runde hjørner og gennemsigtig baggrund.
 * - apple-touch-icon.png: fuld firkant - iPhone runder selv hjørnerne.
 * - icon-maskable-512.png: fuld firkant, og mærket skaleret ned, så Android kan beskære
 *   ikonet til en cirkel eller en anden form uden at skære i det.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ICONS = path.join(__dirname, '..', 'icons');
const source = fs.readFileSync(path.join(ICONS, 'icon.svg'), 'utf8');

/** @param {{full?:boolean, markScale?:number}} opts */
function variant({full = false, markScale = 1} = {}){
    let svg = source;
    if(full) svg = svg.replace(/rx="\d+"/, 'rx="0"');
    if(markScale !== 1){
        const offset = 256 * (1 - markScale);
        svg = svg.replace('<g id="mark">', `<g id="mark" transform="translate(${offset} ${offset}) scale(${markScale})">`);
    }
    return svg;
}

const OUTPUTS = [
    {file: 'favicon-32.png', size: 32},
    {file: 'icon-192.png', size: 192},
    {file: 'icon-512.png', size: 512},
    {file: 'apple-touch-icon.png', size: 180, full: true},
    {file: 'icon-maskable-512.png', size: 512, full: true, markScale: 0.8}
];

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    for(const out of OUTPUTS){
        const svg = variant(out).replace('<svg ', `<svg width="${out.size}" height="${out.size}" `);
        await page.setViewportSize({width: out.size, height: out.size});
        await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
        await page.screenshot({path: path.join(ICONS, out.file), omitBackground: true});
        console.log('icons/' + out.file);
    }
    await browser.close();
})();
