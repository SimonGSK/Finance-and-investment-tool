// Tjekker, at index.html henviser til CSS/JS med et stempel, der passer til
// filernes indhold (se scripts/stamp-assets.js). Fejler testen: kør npm run stamp.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stamp } = require('../scripts/stamp-assets.js');

test('index.html har opdaterede versionsstempler på CSS og JS (kør "npm run stamp")', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.equal(html, stamp(html));
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
