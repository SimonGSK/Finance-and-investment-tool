// Tjekker, at index.html henviser til CSS/JS med et stempel, der passer til
// filernes indhold (se scripts/stamp-assets.js). Fejler testen: kør npm run stamp.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stamp, PAGES } = require('../scripts/stamp-assets.js');

test('index.html har opdaterede versionsstempler på CSS og JS (kør "npm run stamp")', () => {
    for(const page of PAGES){
        const text = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
        assert.equal(text, stamp(text), page);
    }
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.match(html, /href="styles\.css\?v=[0-9a-f]{8}"/);
    assert.equal((html.match(/src="js\/[\w.-]+\.js\?v=[0-9a-f]{8}"/g) || []).length, (html.match(/src="js\//g) || []).length);
    assert.match(html, /<meta name="app-version" content="[0-9a-f]{8}">/);
});

test('sidens versionsnummer følger hele index.html, og stemplet er det samme, når intet er ændret', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const version = h => /<meta name="app-version" content="([0-9a-f]*)">/.exec(h)[1];
    assert.equal(stamp(stamp(html)), stamp(html));
    const changed = stamp(html.replace('Økonomis er låst', 'Økonomis er låst nu'));
    assert.notEqual(version(changed), version(stamp(html)));
});

test('app-ikonet i tre farver: hvert manifest peger på sine egne ikoner, og de findes', () => {
    const root = path.join(__dirname, '..');
    const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
    const base = read('manifest.webmanifest');
    for(const [file, dir] of [['manifest.webmanifest', 'icons/'], ['manifest-black.webmanifest', 'icons/black/'], ['manifest-white.webmanifest', 'icons/white/']]){
        const m = read(file);
        assert.deepEqual({...m, icons: null}, {...base, icons: null}, `${file} må kun afvige i ikonerne`);
        for(const icon of m.icons){
            assert.ok(icon.src.startsWith(dir) && !icon.src.slice(dir.length).includes('/'), `${file}: ${icon.src}`);
            assert.ok(fs.existsSync(path.join(root, icon.src)), `${file}: ${icon.src} findes ikke`);
        }
        assert.ok(fs.existsSync(path.join(root, dir, 'apple-touch-icon.png')), `${dir}apple-touch-icon.png findes ikke`);
    }
});

test('Chart.js ligger på siden selv og er den uændrede fil fra cdnjs (se vendor/README.md)', () => {
    const root = path.join(__dirname, '..');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /<script src="vendor\/chart-4\.4\.0\.umd\.min\.js"><\/script>/);
    const file = fs.readFileSync(path.join(root, 'vendor', 'chart-4.4.0.umd.min.js'));
    const sri = 'sha512-' + require('crypto').createHash('sha512').update(file).digest('base64');
    assert.equal(sri, 'sha512-SIMGYRUjwY8+gKg7nn9EItdD8LCADSDfJNutF9TPrvEo86sQmFMh6MyralfIyhADlajSxqc7G0gs7+MwWF/ogQ==');
});

test('siden henter ingen scripts, stylesheets eller skrifttyper fra andre servere', () => {
    const root = path.join(__dirname, '..');
    for(const page of ['index.html', 'privatliv.html']){
        const html = fs.readFileSync(path.join(root, page), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
        const external = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="((?:https?:)?\/\/[^"]+)"/g)].map(m => m[1]);
        assert.deepEqual(external, [], page);
    }
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    assert.doesNotMatch(css, /url\(["']?(https?:)?\/\//);
});
