/**
 * @file Formue: aktiver og gæld, nettoformue og likvid formue, daterede
 * øjebliksbilleder (historik), formuesammensætning over tid, rekord og
 * milepæle, og sammenligning med andre danskere på samme alder. Felterne
 * gemmes under 'netWorthData', historikken under 'netWorthHistory'.
 */

const NET_WORTH_CATEGORIES = [
    {id:'netCatKontanter', label:'Kontanter & opsparingskonti', color:'#5FA894', liquid:true},
    {id:'netCatAktier', label:'Aktier & værdipapirer', color:'#C9973F', liquid:true},
    {id:'netCatPension', label:'Pension', color:'#8E7BB5', liquid:false},
    {id:'netCatFrivaerdi', label:'Friværdi i bolig', color:'#6E8FB8', liquid:false},
    {id:'netCatAndet', label:'Andet', color:'#8A93A6', liquid:false}
];
const MILESTONES = [100000, 250000, 500000, 1000000, 2000000, 5000000];

const netWorthCtx = document.getElementById('netWorthChart').getContext('2d');
let netWorthChart = new Chart(netWorthCtx, {
    type:'doughnut',
    data:{
        labels: NET_WORTH_CATEGORIES.map(c => c.label),
        datasets:[{
            data: NET_WORTH_CATEGORIES.map(() => 0),
            backgroundColor: NET_WORTH_CATEGORIES.map(c => c.color),
            borderColor:CHART_COLOR('--panel'),
            borderWidth:2
        }]
    },
    options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
            legend:{
                display:true,
                position:'bottom',
                labels:{
                    color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-sans'), size:11}, boxWidth:12, padding:12,
                    generateLabels: chart => {
                        const base = Chart.overrides.doughnut.plugins.legend.labels.generateLabels(chart);
                        const data = chart.data.datasets[0].data;
                        const total = data.reduce((a, b) => a + b, 0);
                        return base.map((item, i) => ({...item, fontColor: chart.options.plugins.legend.labels.color,
                            text: total > 0 ? `${item.text} ${Math.round(data[i] / total * 100)} %` : item.text}));
                    }
                }
            },
            tooltip:{
                backgroundColor:CHART_COLOR('--tooltip-bg'),
                borderColor:CHART_COLOR('--border'),
                borderWidth:1,
                titleColor:CHART_COLOR('--text'),
                bodyColor:CHART_COLOR('--text'),
                callbacks:{ label: c => {
                    const total = c.dataset.data.reduce((a, b) => a + b, 0);
                    return `${c.label}: ${DK.format(c.raw)} kr. (${total > 0 ? Math.round(c.raw / total * 100) : 0} %)`;
                }}
            }
        }
    }
});

/**
 * Gemmer felternes aktuelle værdier.
 */
function saveNetWorthToStorage(){
    const data = { netDebt: document.getElementById('netDebt').value };
    NET_WORTH_CATEGORIES.forEach(cat => data[cat.id] = document.getElementById(cat.id).value);
    localStorage.setItem('netWorthData', JSON.stringify(data));
}

/**
 * Genindlæser felterne. Ugyldige gemte data ignoreres.
 */
function loadNetWorthFromStorage(){
    const raw = localStorage.getItem('netWorthData');
    if(!raw) return;
    try{
        const data = JSON.parse(raw);
        NET_WORTH_CATEGORIES.forEach(cat => {
            if(data[cat.id] !== undefined) document.getElementById(cat.id).value = data[cat.id];
        });
        if(data.netDebt !== undefined) document.getElementById('netDebt').value = data.netDebt;
    } catch(e){
        // Korrupt eller ugyldig data i localStorage - ignorér, og start forfra
    }
}

/**
 * Tallene, Formue-siden regner med: felterne, eller det seneste
 * øjebliksbillede, hvis felterne er tomme (se pickNetWorthFigures i calc.js).
 */
function currentNetWorthFigures(){
    const fields = {debt: parseFloat(document.getElementById('netDebt').value) || 0};
    NET_WORTH_CATEGORIES.forEach(cat => { fields[cat.id] = parseFloat(document.getElementById(cat.id).value) || 0; });
    return pickNetWorthFigures(fields, readNetWorthHistory());
}

/** @returns {number} aktiver minus gæld */
function computeLiveNetWorth(){
    return currentNetWorthFigures().value;
}

/** @returns {number} summen af de likvide aktiver (kontanter og aktier) */
function computeLiveLiquidTotal(){
    return currentNetWorthFigures().liquid;
}

/** Viser, når tallene kommer fra et øjebliksbillede, med en knap til at hente dem ind i felterne. */
function renderNetWorthSourceNote(figures){
    const note = document.getElementById('netWorthSourceNote');
    note.hidden = !figures.fromSnapshot;
    if(!figures.fromSnapshot) return;
    note.replaceChildren(
        `Felterne er tomme, så tallene er fra dit seneste øjebliksbillede (${formatDanishDate(figures.date)}). Udfyld felterne for at se dagens tal. `,
        el('button', {className:'link-btn', type:'button', textContent:'Hent tallene ind i felterne', onclick: () => {
            NET_WORTH_CATEGORIES.forEach(cat => { document.getElementById(cat.id).value = figures[cat.id]; });
            document.getElementById('netDebt').value = figures.debt;
            updateNetWorth();
            markSaved('netWorthSaveStatus');
        }})
    );
}

// Sjove, omtrentlige priser - juster frit efter smag. Bruges kun til
// "din formue svarer til X ting"-sammenligningen, ikke til noget seriøst.
const FUN_ITEMS = [
    {emoji:'🍌', label:'bananer', price:3},
    {emoji:'📱', label:'iPhone 17', price:7499},
    {emoji:'🏢', label:'kvadratmeters lejlighed i Kbh K', price:85760},
    {emoji:'🚗', label:'Fiat 500 (2026)', price:189990},
    {emoji:'🏎️', label:'Porsche 911 GT3 RS med danske afgifter', price:4910783}
];

/**
 * Den lette "din formue svarer til n bananer/iPhones/..."-liste.
 * @param {number} netWorth
 */
function renderPurchasingPower(netWorth){
    const container = document.getElementById('purchasingPowerContainer');
    if(netWorth <= 0){
        container.innerHTML = '<span style="color:var(--muted);">Udfyld dine aktiver ovenfor for at se det her.</span>';
        return;
    }
    container.innerHTML = FUN_ITEMS.map(item => {
        const qty = netWorth / item.price;
        const qtyDisplay = qty >= 10 ? Math.round(qty).toLocaleString('da-DK') : qty.toFixed(1).replace('.', ',');
        return `<div class="fun-item"><span class="fun-emoji">${item.emoji}</span><strong>${qtyDisplay}</strong> ${item.label}</div>`;
    }).join('');
}

/**
 * Opdaterer placeringen i forhold til aldersgruppen (CEPOS-tabellen i calc.js)
 * og købekraft-listen.
 */
function updateWealthComparison(){
    const figures = currentNetWorthFigures();
    const netWorth = figures.value;
    const pension = figures.netCatPension;
    const comparable = comparableNetWorth(netWorth, pension);
    const age = readNumber('wealthAge', 30);
    const row = findWealthRow(age);
    const percentile = estimatePercentile(comparable, row);

    document.getElementById('wealthCompareValue').textContent = DK.format(comparable) + ' kr.';
    document.getElementById('wealthCompareSub').textContent = pension > 0
        ? `pension talt med efter 40 % skat (${DK.format(netWorth)} kr. før)`
        : 'som CEPOS opgør den';
    document.getElementById('wealthPercentile').textContent = 'Top ' + Math.max(1, 100 - percentile) + '%';
    document.getElementById('wealthPercentileSub').textContent = `du har mere end ca. ${percentile}% af dem på ${row.age} år`;
    document.getElementById('wealthMedian').textContent = DK.format(row.p50) + ' kr.';
    document.getElementById('wealthAverage').textContent = `Gennemsnit: ${DK.format(row.avg)} kr.`;

    renderPurchasingPower(netWorth);
}

/**
 * Hele CEPOS-tabellen i en dialog, med din alder fremhævet og rullet frem.
 */
function openWealthTable(){
    const age = findWealthRow(readNumber('wealthAge', 30)).age;
    const cols = [['avg', 'Gns.'], ['p10', 'Bund 10 %'], ['p25', 'Bund 25 %'], ['p50', 'Median'], ['p75', 'Top 25 %'], ['p90', 'Top 10 %'], ['p95', 'Top 5 %'], ['p99', 'Top 1 %']];
    const body = el('tbody', {}, CEPOS_WEALTH_TABLE.map(r => el('tr', {className: r.age === age ? 'is-highlight' : ''}, [
        el('td', {textContent: r.age + ' år'}),
        ...cols.map(([k]) => el('td', {textContent: DK.format(r[k])}))
    ])));
    const content = el('div', {}, [
        el('p', {className:'dialog-hint', textContent:`Nettoformue i kr. for hver alder. Din alder (${age} år) er fremhævet. Grænserne betyder fx, at 10 % af alle ${age}-årige har mindst det beløb, der står under "Top 10 %".`}),
        el('div', {className:'data-table-wrap wealth-table-wrap'}, [
            el('table', {className:'data-table'}, [
                el('thead', {}, [el('tr', {}, [el('th', {textContent:'Alder'}), ...cols.map(([, label]) => el('th', {textContent: label}))])]),
                body
            ])
        ]),
        el('p', {className:'explainer'}, [
            `CEPOS-beregninger på Danmarks Statistiks personregistre: ${CEPOS_SOURCE.dataYear}-data opregnet til ${CEPOS_SOURCE.level}-niveau med lønudviklingen. Pensionen er opgjort efter en beregnet skat på 40 %. Afrundet til nærmeste 1.000 kr. `,
            el('a', {href: CEPOS_SOURCE.url, target:'_blank', rel:'noopener', textContent:'Se kilden hos CEPOS'}), '.'
        ])
    ]);
    const {dialog} = openDialog({title:'Formue efter alder', content, wide:true, actions:[{label:'Luk', variant:'primary'}]});
    dialog.querySelector('tr.is-highlight')?.scrollIntoView({block:'center'});
}

/**
 * Hvor mange måneders udgifter kontanterne dækker. Udgifterne er budgettets
 * sum minus opsparingsposterne.
 */
function updateEmergencyFund(){
    const cash = currentNetWorthFigures().netCatKontanter;
    const {sum, groupSums} = budgetSummary(getBudgetCategories(), loadBudgetItems());
    const expenses = sum - groupSums.opsparing;
    const months = emergencyFundMonths(cash, expenses);
    const monthsEl = document.getElementById('bufferMonths');
    const text = document.getElementById('bufferText');
    const fill = document.getElementById('bufferFill');
    if(months === null){
        monthsEl.textContent = '–';
        text.replaceChildren('Udfyld dit budget for at se, hvor mange måneders udgifter dine kontanter dækker. ',
            el('button', {className:'link-btn', type:'button', textContent:'Gå til budget', onclick: () => showSection('budget')}));
        fill.style.width = '0%';
        return;
    }
    monthsEl.textContent = `${months.toFixed(1).replace('.', ',')} ${months >= 0.95 && months < 1.05 ? 'måned' : 'måneder'}`;
    monthsEl.classList.toggle('negative', months < 3);
    const verdict = months >= 6 ? 'Du har en solid buffer.' : months >= 3 ? 'Du er inden for anbefalingen.' : 'Under anbefalingen på 3 måneder.';
    text.textContent = `Dine kontanter på ${DK.format(cash)} kr. dækker dine udgifter på ${DK.format(expenses)} kr. om måneden. ${verdict}`;
    fill.style.width = Math.min(100, months / 6 * 100) + '%';
}

/**
 * Genberegner nøgletal, doughnut-grafen og sammenligningen ud fra felterne,
 * og gemmer dem. Kaldes ved hver ændring.
 */
function updateNetWorth(){
    const figures = currentNetWorthFigures();
    const values = NET_WORTH_CATEGORIES.map(cat => figures[cat.id]);
    const {assets: assetsTotal, liquid: liquidTotal, debt, value: netWorth} = figures;
    renderNetWorthSourceNote(figures);

    document.getElementById('netAssetsTotal').textContent = DK.format(assetsTotal) + ' kr.';
    document.getElementById('netLiquidTotal').textContent = DK.format(liquidTotal) + ' kr.';
    document.getElementById('netDebtTotal').textContent = DK.format(debt) + ' kr.';
    const netWorthEl = document.getElementById('netWorthTotal');
    netWorthEl.textContent = DK.format(netWorth) + ' kr.';
    netWorthEl.classList.toggle('negative', netWorth < 0);

    netWorthChart.data.datasets[0].data = values;
    netWorthChart.update();
    document.getElementById('netWorthChartEmpty').style.display = assetsTotal > 0 ? 'none' : 'flex';
    saveNetWorthToStorage();
    renderRecordAndMilestones();
    updateWealthComparison();
    updateEmergencyFund();
    if(typeof renderGoals === 'function') renderGoals();
}

const NET_WORTH_INPUT_IDS = NET_WORTH_CATEGORIES.map(c => c.id).concat(['netDebt']);

/**
 * Nulstiller alle felter efter bekræftelse - med fortryd. Historikken bevares.
 */
async function resetNetWorth(){
    const ok = await confirmDialog({
        title:'Nulstil formuefelterne?',
        message:'Felterne for aktiver og gæld sættes til 0. Din gemte formuehistorik bevares, og har du gemt øjebliksbilleder, viser siden det seneste, indtil du udfylder felterne igen.',
        confirmLabel:'Nulstil', danger:true
    });
    if(!ok) return;
    const previous = NET_WORTH_INPUT_IDS.map(id => [id, document.getElementById(id).value]);
    NET_WORTH_INPUT_IDS.forEach(id => document.getElementById(id).value = 0);
    updateNetWorth();
    notify('Formuefelterne er nulstillet.', {actionLabel:'Fortryd', onAction: () => {
        previous.forEach(([id, v]) => document.getElementById(id).value = v);
        updateNetWorth();
    }});
}

loadNetWorthFromStorage();
NET_WORTH_INPUT_IDS.forEach(id => document.getElementById(id).addEventListener('input', () => {
    updateNetWorth();
    markSaved('netWorthSaveStatus');
}));
document.getElementById('wealthAge').addEventListener('input', updateWealthComparison);
updateNetWorth();

let netWorthHistoryChart = null;

/** @returns {Object[]} de gemte øjebliksbilleder, sorteret efter dato */
function readNetWorthHistory(){
    try{ return JSON.parse(localStorage.getItem('netWorthHistory') || '[]'); }
    catch(e){ return []; }
}

/** @param {Object[]} history */
function writeNetWorthHistory(history){
    localStorage.setItem('netWorthHistory', JSON.stringify(history));
}

// Felterne i et øjebliksbillede, som de vises når et punkt overskrives.
const NET_WORTH_FIELDS = [
    ['netCatKontanter', 'Kontanter'], ['netCatAktier', 'Aktier'], ['netCatPension', 'Pension'],
    ['netCatFrivaerdi', 'Friværdi'], ['netCatAndet', 'Andet'], ['debt', 'Gæld'], ['value', 'Nettoformue']
];

/**
 * Bygger et øjebliksbillede ud fra tal for hver kategori og gælden.
 * @param {string} date ISO-dato
 * @param {{netCatKontanter:number, netCatAktier:number, netCatPension:number, netCatFrivaerdi:number, netCatAndet:number, debt:number}} amounts
 * @returns {Object} med nettoformue (value) og likvid formue (liquid) udregnet
 */
function buildNetWorthEntry(date, amounts){
    const entry = {date};
    NET_WORTH_CATEGORIES.forEach(cat => { entry[cat.id] = amounts[cat.id] || 0; });
    entry.debt = amounts.debt || 0;
    entry.value = NET_WORTH_CATEGORIES.reduce((sum, cat) => sum + entry[cat.id], 0) - entry.debt;
    entry.liquid = NET_WORTH_CATEGORIES.reduce((sum, cat) => cat.liquid ? sum + entry[cat.id] : sum, 0);
    return entry;
}

/**
 * Indlæser historik fra en CSV-fil (vores eget format eller genexporteret fra
 * Numbers/Excel). Datoer i danske formater forstås; rækker uden gyldig dato
 * springes over. Erstatter importen eksisterende datoer, spørges der først.
 * @param {Event} event change-eventet fra <input type="file">
 */
function importNetWorthCSV(event){
    const file = event.target.files[0];
    if(!file) return;
    event.target.value = '';
    const reader = new FileReader();
    reader.onload = async function(e){
        let entries, skipped = 0;
        try{
            const rows = parseCSV(e.target.result);
            const headerIndex = findHeaderRowIndex(rows);
            if(headerIndex === -1){
                await infoDialog({title:'Forkert filformat', message:'Filen mangler en "Dato"-kolonne. Brug en CSV-fil, der er downloadet fra formuehistorikken her på siden.'});
                return;
            }
            const headers = rows[headerIndex];
            const col = name => headers.indexOf(name);
            entries = [];
            rows.slice(headerIndex + 1).forEach(row => {
                const date = normalizeDate(row[col('Dato')]);
                if(!date){ skipped++; return; }
                const entry = buildNetWorthEntry(date, {
                    netCatKontanter: parseDanishAmount(row[col('Kontanter')]),
                    netCatAktier: parseDanishAmount(row[col('Aktier')]),
                    netCatPension: parseDanishAmount(row[col('Pension')]),
                    netCatFrivaerdi: parseDanishAmount(row[col('Friværdi')]),
                    netCatAndet: parseDanishAmount(row[col('Andet')]),
                    debt: parseDanishAmount(row[col('Gæld')])
                });
                // Filens egne totaler bruges, hvis de findes, så en import ikke ændrer gamle tal.
                if(col('Likvid') >= 0) entry.liquid = parseDanishAmount(row[col('Likvid')]);
                if(col('Nettoformue') >= 0) entry.value = parseDanishAmount(row[col('Nettoformue')]);
                entries.push(entry);
            });
        } catch(err){
            await infoDialog({title:'Filen kunne ikke læses', message:'Tjek at det er en CSV-fil, der er downloadet fra formuehistorikken her på siden.'});
            return;
        }
        if(!entries.length){
            await infoDialog({title:'Ingen datapunkter fundet', message:'Filen indeholder ingen rækker med en gyldig dato. Intet er ændret.'});
            return;
        }
        const {history, replacedDates, addedCount} = mergeByDate(readNetWorthHistory(), entries);
        if(replacedDates.length && !(await confirmImportOverwrite(replacedDates, entries.length))) return;
        writeNetWorthHistory(history);
        renderNetWorthHistory();
        notify(importSummary(addedCount, replacedDates.length, skipped));
    };
    reader.readAsText(file, 'UTF-8');
}

/**
 * Gemmer felternes værdier som et øjebliksbillede for den valgte dato (i dag
 * som standard). Findes der allerede et punkt på datoen, vises hvad der ændres,
 * før det erstattes.
 */
async function saveNetWorthSnapshot(){
    const date = document.getElementById('snapshotDate').value || todayIso();
    const amounts = {debt: parseFloat(document.getElementById('netDebt').value) || 0};
    NET_WORTH_CATEGORIES.forEach(cat => { amounts[cat.id] = parseFloat(document.getElementById(cat.id).value) || 0; });
    const entry = buildNetWorthEntry(date, amounts);

    const {history, replaced} = upsertByDate(readNetWorthHistory(), entry);
    if(replaced){
        const changes = changedFields(replaced, entry, NET_WORTH_FIELDS);
        if(!changes.length){ notify(`Ingen ændringer – formuen for ${formatDanishDate(date)} var allerede gemt med de samme tal.`); return; }
        if(!(await confirmOverwrite(date, [{title:'Formue', changes}]))) return;
    }
    writeNetWorthHistory(history);
    renderNetWorthHistory();
    notify(replaced ? `Formuen for ${formatDanishDate(date)} er opdateret.` : `Formuen er gemt for ${formatDanishDate(date)}.`);
}

/**
 * Sletter ét øjebliksbillede - med fortryd.
 * @param {string} date ISO-dato, fx '2026-09-21'
 */
function deleteNetWorthEntry(date){
    const history = readNetWorthHistory();
    const removed = history.find(h => h.date === date);
    if(!removed) return;
    writeNetWorthHistory(history.filter(h => h.date !== date));
    renderNetWorthHistory();
    notify(`Datapunktet for ${formatDanishDate(date)} er slettet.`, {actionLabel:'Fortryd', onAction: () => {
        writeNetWorthHistory(upsertByDate(readNetWorthHistory(), removed).history);
        renderNetWorthHistory();
    }});
}

/**
 * Sletter hele formuehistorikken efter bekræftelse - med fortryd.
 */
async function clearNetWorthHistory(){
    const history = readNetWorthHistory();
    if(!history.length){ notify('Der er ingen formuehistorik at slette.'); return; }
    const ok = await confirmDialog({
        title:'Slet hele formuehistorikken?',
        message:`Alle ${history.length} gemte datapunkter slettes.`,
        confirmLabel:'Slet historikken', danger:true
    });
    if(!ok) return;
    localStorage.removeItem('netWorthHistory');
    renderNetWorthHistory();
    notify('Formuehistorikken er slettet.', {actionLabel:'Fortryd', onAction: () => {
        writeNetWorthHistory(history);
        renderNetWorthHistory();
    }});
}

/**
 * Læser historikken fra localStorage og opdaterer historik-grafen, tabellen,
 * sammensætningen samt rekord og milepæle.
 */
function renderNetWorthHistory(){
    const history = readNetWorthHistory();
    const chartData = {
        labels: history.map(h => formatDanishDate(h.date)),
        datasets:[
            {
                label:'Nettoformue',
                data: history.map(h => h.value),
                borderColor:CHART_COLOR('--akt'),
                backgroundColor:CHART_COLOR('--akt'),
                themeVar:'--akt',
                tension:0.15,
                pointRadius:4,
                borderWidth:2.5
            },
            {
                label:'Likvid formue',
                data: history.map(h => h.liquid ?? null),
                borderColor:CHART_COLOR('--ask'),
                backgroundColor:CHART_COLOR('--ask'),
                themeVar:'--ask',
                tension:0.15,
                pointRadius:4,
                borderWidth:2,
                borderDash:[4,4]
            }
        ]
    };

    if(netWorthHistoryChart){
        netWorthHistoryChart.data = chartData;
        netWorthHistoryChart.update();
    } else {
        const ctx = document.getElementById('netWorthHistoryChart').getContext('2d');
        netWorthHistoryChart = new Chart(ctx, {
            type:'line',
            data:chartData,
            options:{
                responsive:true,
                maintainAspectRatio:false,
                plugins:{
                    legend:{
                        display:true,
                        position:'bottom',
                        labels:{ color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-sans'), size:11}, boxWidth:12, padding:12 }
                    },
                    tooltip:{
                        backgroundColor:CHART_COLOR('--tooltip-bg'),
                        borderColor:CHART_COLOR('--border'),
                        borderWidth:1,
                        titleColor:CHART_COLOR('--text'),
                        bodyColor:CHART_COLOR('--text'),
                        callbacks:{ label: c => `${c.dataset.label}: ${DK.format(c.raw)} kr.` }
                    }
                },
                scales:{
                    x:{ grid:{color:CHART_COLOR('--chart-grid')}, ticks:{color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-mono'), size:11}} },
                    y:{ grid:{color:CHART_COLOR('--chart-grid')}, ticks:{color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-mono'), size:11}, callback: v => DK.format(v)} }
                }
            }
        });
    }

    const historyTableBody = document.getElementById('netWorthHistoryTableBody');
    historyTableBody.innerHTML = history.map(h => `<tr>
            <td data-csv="${h.date}">${formatDanishDate(h.date)}</td>
            <td>${DK.format(h.netCatKontanter || 0)} kr.</td>
            <td>${DK.format(h.netCatAktier || 0)} kr.</td>
            <td>${DK.format(h.netCatPension || 0)} kr.</td>
            <td>${DK.format(h.netCatFrivaerdi || 0)} kr.</td>
            <td>${DK.format(h.netCatAndet || 0)} kr.</td>
            <td>${DK.format(h.debt || 0)} kr.</td>
            <td>${DK.format(h.liquid ?? 0)} kr.</td>
            <td>${DK.format(h.value)} kr.</td>
            <td><button class="btn btn-secondary btn-sm" aria-label="Slet datapunktet for ${formatDanishDate(h.date)}" onclick="deleteNetWorthEntry('${h.date}')">Slet</button></td>
        </tr>`).join('');

    const netWorthHasHistory = history.length > 0;
    document.getElementById('netWorthHistoryChartEmpty').style.display = netWorthHasHistory ? 'none' : 'flex';
    document.getElementById('netWorthCompositionChartEmpty').style.display = netWorthHasHistory ? 'none' : 'flex';

    renderNetWorthComposition(history);
    // Nøgletal, mål osv. kan bygge på det seneste øjebliksbillede, så de genberegnes også.
    updateNetWorth();
}

let netWorthCompositionChart = null;

/**
 * Stablet arealgraf over aktivtyper og gæld pr. øjebliksbillede.
 * @param {object[]} history øjebliksbillederne, sorteret efter dato
 */
function renderNetWorthComposition(history){
    const labels = history.map(h => formatDanishDate(h.date));
    const datasets = [
        {label:'Kontanter', data: history.map(h => h.netCatKontanter || 0), backgroundColor:'#5FA894', borderColor:'#5FA894', fill:true, stack:'formue', pointRadius:0, tension:0.1},
        {label:'Aktier', data: history.map(h => h.netCatAktier || 0), backgroundColor:'#C9973F', borderColor:'#C9973F', fill:true, stack:'formue', pointRadius:0, tension:0.1},
        {label:'Pension', data: history.map(h => h.netCatPension || 0), backgroundColor:'#8E7BB5', borderColor:'#8E7BB5', fill:true, stack:'formue', pointRadius:0, tension:0.1},
        {label:'Friværdi', data: history.map(h => h.netCatFrivaerdi || 0), backgroundColor:'#6E8FB8', borderColor:'#6E8FB8', fill:true, stack:'formue', pointRadius:0, tension:0.1},
        {label:'Andet', data: history.map(h => h.netCatAndet || 0), backgroundColor:'#8A93A6', borderColor:'#8A93A6', fill:true, stack:'formue', pointRadius:0, tension:0.1},
        {label:'Gæld', data: history.map(h => -(h.debt || 0)), backgroundColor:'#C96A54', borderColor:'#C96A54', fill:true, stack:'formue', pointRadius:0, tension:0.1}
    ];

    if(netWorthCompositionChart){
        netWorthCompositionChart.data = {labels, datasets};
        netWorthCompositionChart.update();
    } else {
        const ctx = document.getElementById('netWorthCompositionChart').getContext('2d');
        netWorthCompositionChart = new Chart(ctx, {
            type:'line',
            data:{labels, datasets},
            options:{
                responsive:true,
                maintainAspectRatio:false,
                // Hele sammensætningen for den dato, musen er over - ikke kun det
                // nærmeste punkt, som er usynligt og svært at ramme.
                interaction:{mode:'index', intersect:false},
                elements:{point:{hoverRadius:4}},
                plugins:{
                    legend:{display:false},
                    tooltip:{
                        backgroundColor:CHART_COLOR('--tooltip-bg'), borderColor:CHART_COLOR('--border'), borderWidth:1,
                        titleColor:CHART_COLOR('--text'), bodyColor:CHART_COLOR('--text'), footerColor:CHART_COLOR('--text'),
                        itemSort: (a, b) => b.datasetIndex === 5 ? -1 : a.datasetIndex === 5 ? 1 : b.raw - a.raw,
                        callbacks:{
                            label: c => {
                                if(c.dataset.label === 'Gæld') return `Gæld: −${DK.format(-c.raw)} kr.`;
                                const assets = c.chart.data.datasets.slice(0, 5).reduce((s, ds) => s + (ds.data[c.dataIndex] || 0), 0);
                                const share = assets > 0 ? Math.round(c.raw / assets * 100) : 0;
                                return `${c.dataset.label}: ${DK.format(c.raw)} kr. (${share} %)`;
                            },
                            footer: items => {
                                const i = items[0].dataIndex;
                                const net = items[0].chart.data.datasets.reduce((s, ds) => s + (ds.data[i] || 0), 0);
                                return `Nettoformue: ${DK.format(net)} kr.`;
                            }
                        }
                    }
                },
                scales:{
                    x:{ grid:{color:CHART_COLOR('--chart-grid')}, ticks:{color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-mono'), size:11}} },
                    y:{
                        stacked:true,
                        grid:{color:CHART_COLOR('--chart-grid')},
                        ticks:{color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-mono'), size:11}, callback: v => DK.format(v)}
                    }
                }
            }
        });
    }
}

/**
 * Højeste nettoformue og likvide formue nogensinde, samt fremdrift mod hver
 * milepæl i MILESTONES med dato for hvornår den blev nået.
 */
function renderRecordAndMilestones(){
    const history = readNetWorthHistory();
    const sortedByDate = history.slice().sort((a,b) => a.date.localeCompare(b.date));
    const latestEntry = sortedByDate.length > 0 ? sortedByDate[sortedByDate.length-1] : null;
    const liveNetWorth = latestEntry ? latestEntry.value : computeLiveNetWorth();

    if(history.length > 0){
        const record = history.reduce((best, h) => h.value > best.value ? h : best, history[0]);
        document.getElementById('recordValue').textContent = DK.format(record.value) + ' kr.';
        document.getElementById('recordDate').textContent = 'opnået ' + record.date;

        const historyWithLiquid = history.filter(h => h.liquid !== undefined && h.liquid !== null);
        if(historyWithLiquid.length > 0){
            const liquidRecord = historyWithLiquid.reduce((best, h) => h.liquid > best.liquid ? h : best, historyWithLiquid[0]);
            document.getElementById('recordLiquidValue').textContent = DK.format(liquidRecord.liquid) + ' kr.';
            document.getElementById('recordLiquidDate').textContent = 'opnået ' + liquidRecord.date;
        } else {
            document.getElementById('recordLiquidValue').textContent = '–';
            document.getElementById('recordLiquidDate').textContent = '';
        }
    } else {
        document.getElementById('recordValue').textContent = '–';
        document.getElementById('recordDate').textContent = 'Gem et øjebliksbillede for at starte din rekord';
        document.getElementById('recordLiquidValue').textContent = '–';
        document.getElementById('recordLiquidDate').textContent = '';
    }

    const sortedHistory = history.slice().sort((a,b) => a.date.localeCompare(b.date));
    const container = document.getElementById('milestonesContainer');
    container.innerHTML = MILESTONES.map(milestone => {
        const achievedEntry = sortedHistory.find(h => h.value >= milestone);
        const reached = liveNetWorth >= milestone;
        const pct = Math.max(0, Math.min(100, (liveNetWorth / milestone) * 100));
        const statusText = achievedEntry
            ? ('Opnået ' + achievedEntry.date)
            : (reached ? 'Nået – gem for at registrere datoen' : pct.toFixed(0) + '%');

        return `<div class="milestone-row">
                <div class="milestone-label">
                    <span>${DK.format(milestone)} kr.</span>
                    <span class="${achievedEntry ? 'achieved' : ''}">${statusText}</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width:${pct}%;"></div>
                </div>
            </div>`;
    }).join('');
}

document.getElementById('snapshotDate').value = todayIso();
renderNetWorthHistory();