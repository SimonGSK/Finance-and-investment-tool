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
});
