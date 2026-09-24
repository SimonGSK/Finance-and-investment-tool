/**
 * @file ETF'er og fonde: slå op på Skattestyrelsens positivliste (ABIS-listen)
 * og sammenlign, hvad den samme investering giver efter skat alt efter
 * beskatningen. Listen ligger i data/positivliste.json (bygget med
 * scripts/build-positivliste.py) og hentes først, når man søger.
 * Beregningen ligger i calc.js (simulateFundTaxation).
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
        parts.push(el('p', {textContent:'Er det en dansk udloddende (udbyttebetalende) investeringsforening, står den ikke på listen. Er den aktiebaseret, beskattes den som aktieindkomst, når du sælger – og udbytterne hvert år. Tjek fondens faktaark.'}));
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

// ---- Sammenligning af beskatningen ----

const ETF_MODES = [
    {key:'abis', label:'På positivlisten', color:'--akt', id:'etfAbis'},
    {key:'capital', label:'Ikke på listen', color:'--cross', id:'etfCapital'},
    {key:'realisation', label:'Aktier (skat ved salg)', color:'--neutral-series', id:'etfRealisation'},
    {key:'ask', label:'Aktiesparekonto', color:'--ask', id:'etfAsk'}
];

const etfChart = new Chart(document.getElementById('etfChart').getContext('2d'), {
    type:'line',
    data:{labels:[], datasets: ETF_MODES.map(m => ({
        label: m.label, data:[], borderColor:CHART_COLOR(m.color), backgroundColor:CHART_COLOR(m.color), themeVar:m.color,
        tension:0.15, pointRadius:0, borderWidth: m.key === 'realisation' ? 2 : 2.5, borderDash: m.key === 'realisation' ? [4, 4] : undefined
    }))},
    options: lineChartOptions(c => `${c.dataset.label}: ${DK.format(c.raw)} kr. efter skat`)
});
etfChart.options.scales.x.title = {display:true, text:'År', color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-sans'), size:12}};

function updateEtfTax(){
    const years = Math.max(1, Math.min(60, Math.round(readNumber('etfYears', 20))));
    const r = simulateFundTaxation({
        start: Math.max(0, readNumber('etfStart')),
        monthly: Math.max(0, readNumber('etfMonthly')),
        years,
        yearlyReturn: 1 + readPercent('etfReturn'),
        capitalTaxRate: Math.min(1, Math.max(0, readPercent('etfCapitalTax'))),
        taxLimit: TAX_LIMIT_27 * (document.getElementById('etfDouble').checked ? 2 : 1)
    });

    etfChart.data.labels = Array.from({length: years + 1}, (_, y) => y);
    ETF_MODES.forEach((m, i) => { etfChart.data.datasets[i].data = r.modes[m.key].values.map(Math.round); });
    etfChart.update();

    // ASK med indskud over loftet er ikke muligt i virkeligheden - vises dæmpet.
    document.getElementById('etfAsk').closest('.stat').classList.toggle('is-dim', r.askOverLimit);
    ETF_MODES.forEach(m => {
        const mode = r.modes[m.key];
        document.getElementById(m.id).textContent = DK.format(mode.finalAfterTax) + ' kr.';
        document.getElementById(m.id + 'Sub').textContent = m.key === 'ask' && r.askOverLimit
            ? `kræver indskud over loftet på ${DK.format(ASK_DEPOSIT_LIMIT)} kr.`
            : `${DK.format(mode.totalTax)} kr. i skat${m.key === 'realisation' ? ' ved salg' : ''}`;
    });

    const diff = r.modes.abis.finalAfterTax - r.modes.capital.finalAfterTax;
    document.getElementById('etfNote').textContent = diff > 0
        ? `Efter ${years} år står du med ${DK.format(diff)} kr. mere, hvis ETF'en er på positivlisten, end hvis den ikke er – for de samme ${DK.format(r.deposited)} kr. indskudt.`
        : '';
}

document.getElementById('tool6').addEventListener('input', e => { if(e.target.id !== 'etfSearch') updateEtfTax(); });
updateEtfTax();
