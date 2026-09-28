/**
 * @file Tegner app-ikonerne (PNG) ud fra icons/icon.svg, som er kilden.
 * Kør med: node scripts/render-icons.js  (kræver Playwrights Chromium: npx playwright install chromium)
 *
 * - favicon-32.png, icon-192.png, icon-512.png: med runde hjørner og gennemsigtig baggrund.
 * - apple-touch-icon.png: fuld firkant - iPhone runder selv hjørnerne.
 * - icon-maskable-512.png: fuld firkant, og mærket skaleret ned, så Android kan beskære
 *   ikonet til en cirkel eller en anden form uden at skære i det.
 *
 * App-ikonet findes i tre farver, som man vælger mellem i indstillingerne (se js/pwa.js):
 * grøn (standard, i icons/), sort (icons/black/) og hvid (icons/white/). Hver farve får
 * sit eget manifest (manifest-black.webmanifest ...), som peger på dens ikoner.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ICONS = path.join(__dirname, '..', 'icons');
const source = fs.readFileSync(path.join(ICONS, 'icon.svg'), 'utf8');

/** Farverne i hver variant: flade, O, kurslinje (luften om linjen har fladens farve). */
const VARIANTS = {
    green: {dir: '', tile: '#0B6B4F', glyph: '#FFFFFF', line: '#FFFFFF'},
    black: {dir: 'black', tile: '#151517', glyph: '#EDEDEE', line: '#3CC08E'},
    white: {dir: 'white', tile: '#FCFBF8', glyph: '#14231C', line: '#0B7A55'}
};

/** icon.svg (den grønne) omfarvet til en variant. */
function recolor(svg, {tile, glyph, line}){
    return svg
        .replace(/(<rect class="logo-tile"[^>]*fill=")#[0-9A-F]{6}/i, `$1${tile}`)
        .replace(/(<path class="logo-glyph"[^>]*fill=")#[0-9A-F]{6}/i, `$1${glyph}`)
        .replace(/<g class="logo-gap" fill="#[0-9A-F]{6}" stroke="#[0-9A-F]{6}"/i, `<g class="logo-gap" fill="${tile}" stroke="${tile}"`)
        .replace(/<g class="logo-line" fill="#[0-9A-F]{6}" stroke="#[0-9A-F]{6}"/i, `<g class="logo-line" fill="${line}" stroke="${line}"`);
}

/** @param {{full?:boolean, markScale?:number, colors?:object}} opts */
function variant({full = false, markScale = 1, colors = VARIANTS.green} = {}){
    let svg = recolor(source, colors);
    if(full) svg = svg.replace(/rx="\d+"/, 'rx="0"');
    if(markScale !== 1){
        const offset = 256 * (1 - markScale);
        svg = svg.replace('<g id="mark">', `<g id="mark" transform="translate(${offset} ${offset}) scale(${markScale})">`);
    }
    return svg;
}

// Faneikonet (favicon) findes kun i grøn; app-ikonerne i alle tre farver.
const APP_ICONS = [
    {file: 'icon-192.png', size: 192},
    {file: 'icon-512.png', size: 512},
    {file: 'apple-touch-icon.png', size: 180, full: true},
    {file: 'icon-maskable-512.png', size: 512, full: true, markScale: 0.8}
];
const OUTPUTS = [{file: 'favicon-32.png', size: 32, colors: VARIANTS.green}];
for(const colors of Object.values(VARIANTS)){
    for(const icon of APP_ICONS) OUTPUTS.push({...icon, colors, file: path.join(colors.dir, icon.file)});
}

/** Et manifest pr. farve, med samme indhold som manifest.webmanifest men dens egne ikoner. */
function writeVariantManifests(){
    const root = path.join(__dirname, '..');
    const base = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
    for(const [id, {dir}] of Object.entries(VARIANTS)){
        if(!dir) continue;
        const manifest = {...base, icons: base.icons.map(icon => ({...icon, src: icon.src.replace('icons/', `icons/${dir}/`)}))};
        fs.writeFileSync(path.join(root, `manifest-${id}.webmanifest`), JSON.stringify(manifest, null, 2) + '\n');
        console.log(`manifest-${id}.webmanifest`);
    }
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    for(const out of OUTPUTS){
        fs.mkdirSync(path.dirname(path.join(ICONS, out.file)), {recursive: true});
        const svg = variant(out).replace('<svg ', `<svg width="${out.size}" height="${out.size}" `);
        await page.setViewportSize({width: out.size, height: out.size});
        await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
        await page.screenshot({path: path.join(ICONS, out.file), omitBackground: true});
        console.log('icons/' + out.file);
    }
    await browser.close();
    writeVariantManifests();
})();
