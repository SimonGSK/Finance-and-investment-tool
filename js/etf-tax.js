/**
 * @file ETF'er og fonde: slå op på Skattestyrelsens positivliste (ABIS-listen).
 * Listen ligger i data/positivliste.json (bygget med scripts/build-positivliste.py)
 * og hentes først, når man søger. Skattereglerne står som tekst i index.html.
 */

// ---- Opslag på positivlisten ----

let positivliste = null;          // {year, published, count, funds:[[isin, name, country, since]]}
let positivlistePromise = null;

/** Henter listen én gang. */
function loadPositivliste(){
    positivlistePromise ??= fetch('data/positivliste.json')
        .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
        .then(data => {
            positivliste = data;
            data.funds.forEach(f => { f.search = (f[0] + ' ' + f[1]).toLowerCase(); });
            document.getElementById('etfSource').textContent =
                `Skattestyrelsens liste for ${data.year} (offentliggjort ${formatDanishDate(data.published)}) med ${DK.format(data.count)} fonde og ETF'er. Listen gælder hele indkomståret.`;
            return data;
        })
        .catch(e => { positivlistePromise = null; throw e; });
    return positivlistePromise;
}

const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/**
 * Finder fonde, hvis ISIN eller navn indeholder alle ord i søgningen.
 * @param {string} query
 * @returns {Array} højst 12 fund-rækker
 */
function searchPositivliste(query){
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if(!words.length) return [];
    const hits = [];
    for(const f of positivliste.funds){
        if(words.every(w => f.search.includes(w))){
            hits.push(f);
            if(hits.length >= 12) break;
        }
    }
    return hits;
}

/** Forklaringen, når en ISIN ikke står på listen. Danske udloddende fonde er et særtilfælde. */
function notOnListExplanation(isin){
    const parts = [
        el('p', {}, [el('strong', {textContent:`${isin} står ikke på listen for ${positivliste.year}.`})]),
        el('p', {textContent:'En udenlandsk ETF eller fond, der ikke står på listen, beskattes som kapitalindkomst hvert år (lagerbeskatning, ca. 37–42 %) og kan ikke ligge på en aktiesparekonto.'})
    ];
    if(isin.startsWith('DK')){
        parts.push(el('p', {textContent:'Er det en dansk udbyttebetalende (udloddende) investeringsforening, er det helt normalt, at den ikke står på listen: er den aktiebaseret, beskattes den som aktieindkomst efter realisationsprincippet – gevinsten ved salg og udbyttet hvert år. Tjek på fondens faktaark, om den er aktie- eller obligationsbaseret.'}));
    }
    return el('div', {className:'etf-verdict is-off'}, parts);
}

function renderEtfResults(){
    const box = document.getElementById('etfResults');
    const raw = document.getElementById('etfSearch').value.trim();
    if(!raw){ box.replaceChildren(); return; }
    if(!positivliste){
        box.replaceChildren(el('p', {className:'empty-note', textContent:'Henter positivlisten …'}));
        loadPositivliste().then(renderEtfResults).catch(() => {
            box.replaceChildren(el('p', {className:'empty-note', textContent:'Positivlisten kunne ikke hentes. Tjek din internetforbindelse og prøv igen.'}));
        });
        return;
    }
    const compact = raw.replace(/\s+/g, '').toUpperCase();
    const hits = searchPositivliste(ISIN_PATTERN.test(compact) ? compact : raw);
    if(!hits.length){
        box.replaceChildren(ISIN_PATTERN.test(compact)
            ? notOnListExplanation(compact)
            : el('p', {className:'empty-note', textContent:'Ingen fonde på listen matcher. Prøv med ISIN-koden, eller færre ord fra navnet.'}));
        return;
    }
    box.replaceChildren(
        el('ul', {className:'etf-hit-list'}, hits.map(([isin, name, country, since]) => el('li', {className:'etf-hit'}, [
            el('div', {className:'etf-hit-name', textContent: name}),
            el('div', {className:'etf-hit-meta', textContent: [isin || 'uden ISIN', country, `på listen siden ${since}`].filter(Boolean).join(' · ')}),
            el('span', {className:'etf-badge', textContent:`På positivlisten ${positivliste.year}`})
        ]))),
        el('p', {className:'etf-verdict is-on', textContent:
            `Står fonden på listen, beskattes den som aktieindkomst (${pctNumber(AKT_TAX_LOW)} % / ${pctNumber(AKT_TAX_HIGH)} %) efter lagerprincippet – altså af årets gevinst hvert år, også uden salg – og den kan ligge på en aktiesparekonto.`}),
        hits.length === 12 ? el('p', {className:'empty-note', textContent:'Viser de første 12 – skriv mere for at indsnævre.'}) : ''
    );
}

let etfSearchTimer = null;
document.getElementById('etfSearch').addEventListener('input', () => {
    clearTimeout(etfSearchTimer);
    etfSearchTimer = setTimeout(renderEtfResults, 120);
});
// Hent listen i baggrunden, så snart man sætter markøren i søgefeltet.
document.getElementById('etfSearch').addEventListener('focus', () => loadPositivliste().catch(() => {}), {once:true});
