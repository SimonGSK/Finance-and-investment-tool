/**
 * @file Værktøj 4: Porteføljetracker. Datapunkter (dato, værdi, kontanter,
 * handler, indskud, udbytte) gemmes i localStorage under 'portfolioHistory'
 * og vises i fire grafer og en tabel. Kan importeres/eksporteres som CSV.
 */

const ptTooltipLabel = c => `${c.dataset.label}: ${DK.format(c.raw)} kr.`;

const ptCtx1 = document.getElementById('ptChart1').getContext('2d');
let ptChart1 = new Chart(ptCtx1, {
    type:'line',
    data:{labels:[], datasets:[
            {label:'Porteføljeværdi', data:[], borderColor:CHART_COLOR('--akt'), backgroundColor:CHART_COLOR('--akt'), themeVar:'--akt', tension:0.15, pointRadius:0, borderWidth:2.5},
            {label:'Kumuleret indskud/udbetaling', data:[], borderColor:CHART_COLOR('--ask'), backgroundColor:CHART_COLOR('--ask'), themeVar:'--ask', tension:0.15, pointRadius:0, borderWidth:2, borderDash:[4,4]}
        ]},
    options: lineChartOptions(ptTooltipLabel)
});

const ptCtx2 = document.getElementById('ptChart2').getContext('2d');
let ptChart2 = new Chart(ptCtx2, {
    data:{labels:[], datasets:[
            {type:'line', label:'Aktieværdi', data:[], borderColor:CHART_COLOR('--akt'), backgroundColor:CHART_COLOR('--akt'), themeVar:'--akt', tension:0.15, pointRadius:0, borderWidth:2.5, yAxisID:'y'},
            {type:'bar', label:'Køb/solgt (pr. måned)', data:[], backgroundColor:'#8E7BB5', yAxisID:'y1'}
        ]},
    options:{
        responsive:true,
        maintainAspectRatio:false,
        animation:{duration:250},
        interaction:{mode:'index', intersect:false},
        plugins:{
            legend:{display:false},
            tooltip:{
                backgroundColor:CHART_COLOR('--tooltip-bg'), borderColor:CHART_COLOR('--border'), borderWidth:1,
                titleColor:CHART_COLOR('--text'), bodyColor:CHART_COLOR('--text'),
                callbacks:{ label: ptTooltipLabel }
            }
        },
        scales:{
            x:{ grid:{color:CHART_COLOR('--chart-grid')}, ticks:{color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-mono'), size:11}} },
            y:{
                position:'left',
                grid:{color:CHART_COLOR('--chart-grid')},
                ticks:{color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-mono'), size:11}, callback: v => DK.format(v)}
            },
            y1:{
                position:'right',
                grid:{drawOnChartArea:false},
                ticks:{color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-mono'), size:11}, callback: v => DK.format(v)}
            }
        }
    }
});

const ptCtx3 = document.getElementById('ptChart3').getContext('2d');
let ptChart3 = new Chart(ptCtx3, {
    type:'line',
    data:{labels:[], datasets:[
            {label:'Aktieværdi', data:[], borderColor:CHART_COLOR('--akt'), backgroundColor:CHART_COLOR('--akt'), themeVar:'--akt', tension:0.15, pointRadius:0, borderWidth:2.5},
            {label:'Totalt investeret', data:[], borderColor:CHART_COLOR('--ask'), backgroundColor:CHART_COLOR('--ask'), themeVar:'--ask', tension:0.15, pointRadius:0, borderWidth:2, borderDash:[4,4]}
        ]},
    options: lineChartOptions(ptTooltipLabel)
});

const ptCtx4 = document.getElementById('ptChart4').getContext('2d');
let ptChart4 = new Chart(ptCtx4, {
    type:'line',
    data:{labels:[], datasets:[
            {label:'Totalt afkast', data:[], borderColor:CHART_COLOR('--akt'), backgroundColor:CHART_COLOR('--akt'), themeVar:'--akt', tension:0.15, pointRadius:0, borderWidth:2.5}
        ]},
    options: lineChartOptions(ptTooltipLabel)
});

/**
 * Porteføljeværdi = aktieværdi + kontanter. Feltet er skrivebeskyttet og
 * udregnes, når et af de to andre ændres.
 */
function updatePortfolioValueField(){
    const stockValue = parseFloat(document.getElementById('ptStockValue').value) || 0;
    const cash = parseFloat(document.getElementById('ptCash').value) || 0;
    document.getElementById('ptPortfolioValue').value = stockValue + cash;
}
document.getElementById('ptStockValue').addEventListener('input', updatePortfolioValueField);
document.getElementById('ptCash').addEventListener('input', updatePortfolioValueField);

/** @returns {Object[]} de gemte datapunkter, sorteret efter dato */
function readPortfolioHistory(){
    try{ return JSON.parse(localStorage.getItem('portfolioHistory') || '[]'); }
    catch(e){ return []; }
}

/** @param {Object[]} history */
function writePortfolioHistory(history){
    localStorage.setItem('portfolioHistory', JSON.stringify(history));
}

// Felterne i et datapunkt, som de vises når et punkt overskrives.
const PORTFOLIO_FIELDS = [
    ['stockValue', 'Aktieværdi'], ['cash', 'Kontanter i depot'], ['portfolioValue', 'Porteføljeværdi'],
    ['traded', 'Købt/solgt'], ['deposit', 'Indskud/udbetaling'], ['dividend', 'Udbytte']
];

/**
 * Bygger et datapunkt; porteføljeværdien er altid aktier + kontanter i depot.
 * @param {string} date ISO-dato
 * @param {{stockValue:number, cash:number, traded:number, deposit:number, dividend:number}} v
 * @returns {Object}
 */
function buildPortfolioEntry(date, v){
    const stockValue = v.stockValue || 0, cash = v.cash || 0;
    return {date, portfolioValue: stockValue + cash, stockValue, cash,
        traded: v.traded || 0, deposit: v.deposit || 0, dividend: v.dividend || 0};
}

/**
 * Indlæser datapunkter fra en CSV-fil (vores eget format eller genexporteret
 * fra Numbers/Excel). Datoer i danske formater forstås; rækker uden gyldig dato
 * springes over. Erstatter importen eksisterende datoer, spørges der først.
 * @param {Event} event change-eventet fra <input type="file">
 */
function importPortfolioCSV(event){
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
                await infoDialog({title:'Forkert filformat', message:'Filen mangler en "Dato"-kolonne. Brug en CSV-fil, der er downloadet fra porteføljetrackeren her på siden.'});
                return;
            }
            const headers = rows[headerIndex];
            const col = name => headers.indexOf(name);
            entries = [];
            rows.slice(headerIndex + 1).forEach(row => {
                const date = normalizeDate(row[col('Dato')]);
                if(!date){ skipped++; return; }
                entries.push(buildPortfolioEntry(date, {
                    stockValue: parseDanishAmount(row[col('Aktieværdi')]),
                    cash: parseDanishAmount(row[col('Kontant')]),
                    traded: parseDanishAmount(row[col('Købt/solgt')]),
                    deposit: parseDanishAmount(row[col('Indskud/udb.')]),
                    dividend: parseDanishAmount(row[col('Udbytte')])
                }));
            });
        } catch(err){
            await infoDialog({title:'Filen kunne ikke læses', message:'Tjek at det er en CSV-fil, der er downloadet fra porteføljetrackeren her på siden.'});
            return;
        }
        if(!entries.length){
            await infoDialog({title:'Ingen datapunkter fundet', message:'Filen indeholder ingen rækker med en gyldig dato. Intet er ændret.'});
            return;
        }
        const {history, replacedDates, addedCount} = mergeByDate(readPortfolioHistory(), entries);
        if(replacedDates.length && !(await confirmImportOverwrite(replacedDates, entries.length))) return;
        writePortfolioHistory(history);
        renderPortfolioHistory();
        notify(importSummary(addedCount, replacedDates.length, skipped));
    };
    reader.readAsText(file, 'UTF-8');
}

/**
 * Gemmer formularens værdier som et datapunkt for den valgte dato (i dag som
 * standard). Findes der allerede et punkt på datoen, vises hvad der ændres,
 * før det erstattes.
 */
async function savePortfolioSnapshot(){
    const date = document.getElementById('ptDate').value || todayIso();
    const num = id => parseFloat(document.getElementById(id).value) || 0;
    const entry = buildPortfolioEntry(date, {
        stockValue: num('ptStockValue'), cash: num('ptCash'),
        traded: num('ptTraded'), deposit: num('ptDeposit'), dividend: num('ptDividend')
    });
    const {history, replaced} = upsertByDate(readPortfolioHistory(), entry);
    if(replaced){
        const changes = changedFields(replaced, entry, PORTFOLIO_FIELDS);
        if(!changes.length){ notify(`Ingen ændringer – datapunktet for ${formatDanishDate(date)} var allerede gemt med de samme tal.`); return; }
        if(!(await confirmOverwrite(date, [{title:'Portefølje', changes}]))) return;
    }
    writePortfolioHistory(history);
    renderPortfolioHistory();
    notify(replaced ? `Datapunktet for ${formatDanishDate(date)} er opdateret.` : `Datapunktet er gemt for ${formatDanishDate(date)}.`);
}

/**
 * Sletter ét datapunkt - med fortryd.
 * @param {string} date ISO-dato, fx '2026-09-21'
 */
function deletePortfolioEntry(date){
    const history = readPortfolioHistory();
    const removed = history.find(h => h.date === date);
    if(!removed) return;
    writePortfolioHistory(history.filter(h => h.date !== date));
    renderPortfolioHistory();
    notify(`Datapunktet for ${formatDanishDate(date)} er slettet.`, {actionLabel:'Fortryd', onAction: () => {
        writePortfolioHistory(upsertByDate(readPortfolioHistory(), removed).history);
        renderPortfolioHistory();
    }});
}

/**
 * Sletter hele porteføljehistorikken efter bekræftelse - med fortryd.
 */
async function clearPortfolioHistory(){
    const history = readPortfolioHistory();
    if(!history.length){ notify('Der er ingen porteføljehistorik at slette.'); return; }
    const ok = await confirmDialog({
        title:'Slet hele porteføljehistorikken?',
        message:`Alle ${history.length} gemte datapunkter slettes.`,
        confirmLabel:'Slet historikken', danger:true
    });
    if(!ok) return;
    localStorage.removeItem('portfolioHistory');
    renderPortfolioHistory();
    notify('Porteføljehistorikken er slettet.', {actionLabel:'Fortryd', onAction: () => {
        writePortfolioHistory(history);
        renderPortfolioHistory();
    }});
}

/**
 * Læser historikken fra localStorage og opdaterer alle fire grafer, tabellen
 * og tomme-tilstandene.
 */
function renderPortfolioHistory(){
    const history = readPortfolioHistory();

    // Kumulerede tal - løbende sum hen over tid, i datorækkefølge
    let cumDeposit = 0, cumTraded = 0, cumDividend = 0;
    const enriched = history.map(h => {
        cumDeposit += h.deposit;
        cumTraded += h.traded;
        cumDividend += h.dividend;
        return {
            ...h,
            cumDeposit,
            cumTraded,
            cumDividend,
            totalReturn: h.portfolioValue - cumDeposit
        };
    });

    const labels = enriched.map(h => formatDanishDate(h.date));

    ptChart1.data.labels = labels;
    ptChart1.data.datasets[0].data = enriched.map(h => h.portfolioValue);
    ptChart1.data.datasets[1].data = enriched.map(h => h.cumDeposit);
    ptChart1.update();

    ptChart2.data.labels = labels;
    ptChart2.data.datasets[0].data = enriched.map(h => h.stockValue);
    ptChart2.data.datasets[1].data = enriched.map(h => h.traded);
    ptChart2.update();

    ptChart3.data.labels = labels;
    ptChart3.data.datasets[0].data = enriched.map(h => h.stockValue);
    ptChart3.data.datasets[1].data = enriched.map(h => h.cumTraded);
    ptChart3.update();

    ptChart4.data.labels = labels;
    ptChart4.data.datasets[0].data = enriched.map(h => h.totalReturn);
    ptChart4.update();

    if(enriched.length > 0){
        const latest = enriched[enriched.length-1];
        document.getElementById('ptLatestValue').textContent = DK.format(latest.portfolioValue) + ' kr.';
        document.getElementById('ptTotalInvested').textContent = DK.format(latest.cumTraded) + ' kr.';
        const returnEl = document.getElementById('ptTotalReturn');
        returnEl.textContent = DK.format(latest.totalReturn) + ' kr.';
        returnEl.classList.toggle('negative', latest.totalReturn < 0);
        document.getElementById('ptTotalDividend').textContent = DK.format(latest.cumDividend) + ' kr.';
    } else {
        document.getElementById('ptLatestValue').textContent = '–';
        document.getElementById('ptTotalInvested').textContent = '–';
        document.getElementById('ptTotalReturn').textContent = '–';
        document.getElementById('ptTotalDividend').textContent = '–';
    }

    const ptHasData = enriched.length > 0;
    ['ptChart1Empty', 'ptChart2Empty', 'ptChart3Empty', 'ptChart4Empty'].forEach(id => {
        document.getElementById(id).style.display = ptHasData ? 'none' : 'flex';
    });

    const ptTableBody = document.getElementById('ptTableBody');
    ptTableBody.innerHTML = enriched.map(h => `<tr>
            <td data-csv="${h.date}">${formatDanishDate(h.date)}</td>
            <td>${DK.format(h.portfolioValue)} kr.</td>
            <td>${DK.format(h.stockValue)} kr.</td>
            <td>${DK.format(h.cash)} kr.</td>
            <td>${DK.format(h.traded)} kr.</td>
            <td>${DK.format(h.deposit)} kr.</td>
            <td>${DK.format(h.dividend)} kr.</td>
            <td><button class="btn btn-secondary btn-sm" aria-label="Slet datapunktet for ${formatDanishDate(h.date)}" onclick="deletePortfolioEntry('${h.date}')">Slet</button></td>
        </tr>`).join('');
}

document.getElementById('ptDate').value = new Date().toISOString().slice(0,10);
renderPortfolioHistory();