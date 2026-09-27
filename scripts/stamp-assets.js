#!/usr/bin/env node
/**
 * Giver styles.css og alle js/-filer i index.html et versionsstempel ud fra
 * filens indhold (?v=<8 tegn af sha256>). Så henter en ny index.html altid de
 * matchende filer - en browser kan ikke blande en ny side med en gammel,
 * cachet CSS- eller JS-fil. Kør efter ændringer i CSS/JS:
 *     npm run stamp
 * Testen tests/assets.test.js fejler, hvis et stempel ikke passer.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const hashOf = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 8);

/** Erstatter src="js/x.js" / href="styles.css" (med eller uden ?v=) med det aktuelle stempel. */
function stamp(html){
    return html.replace(/(src|href)="((?:js\/[\w.-]+\.js)|styles\.css)(?:\?v=[\w]+)?"/g, (_, attr, file) => `${attr}="${file}?v=${hashOf(file)}"`);
}

if(require.main === module){
    const file = path.join(root, 'index.html');
    const before = fs.readFileSync(file, 'utf8');
    const after = stamp(before);
    fs.writeFileSync(file, after);
    console.log(before === after ? 'Stemplerne passer allerede.' : 'index.html er opdateret med nye versionsstempler.');
}

module.exports = { stamp, hashOf };
