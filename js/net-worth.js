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
                labels:{ color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-sans'), size:11}, boxWidth:12, padding:12 }
            },
            tooltip:{
                backgroundColor:CHART_COLOR('--tooltip-bg'),
                borderColor:CHART_COLOR('--border'),
                borderWidth:1,
                titleColor:CHART_COLOR('--text'),
                bodyColor:CHART_COLOR('--text'),
                callbacks:{ label: c => `${c.label}: ${DK.format(c.raw)} kr.` }
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
 * @returns {number} aktiver minus gæld ud fra felternes aktuelle værdier
 */
function computeLiveNetWorth(){
    const assetsTotal = NET_WORTH_CATEGORIES.reduce((sum, cat) => sum + (parseFloat(document.getElementById(cat.id).value) || 0), 0);
    const debt = parseFloat(document.getElementById('netDebt').value) || 0;
    return assetsTotal - debt;
}

/**
 * @returns {number} summen af de likvide aktiver (kontanter og aktier)
 */
function computeLiveLiquidTotal(){
    return NET_WORTH_CATEGORIES.reduce((sum, cat) => cat.liquid ? sum + (parseFloat(document.getElementById(cat.id).value) || 0) : sum, 0);
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
    const netWorth = computeLiveNetWorth();
    const age = parseInt(document.getElementById('wealthAge').value) || 30;
    const row = findNearestWealthRow(age);
    const percentile = estimatePercentile(netWorth, row);

    document.getElementById('wealthCompareValue').textContent = DK.format(netWorth) + ' kr.';
    document.getElementById('wealthPercentile').textContent = 'Top ' + Math.max(1, 100-percentile) + '%';
    document.getElementById('wealthPercentileSub').textContent = 'du har mere end ca. ' + percentile + '% af din aldersgruppe';
    document.getElementById('wealthMedian').textContent = DK.format(row.p50) + ' kr.';

    renderPurchasingPower(netWorth);
}

/**
 * Genberegner nøgletal, doughnut-grafen og sammenligningen ud fra felterne,
 * og gemmer dem. Kaldes ved hver ændring.
 */
function updateNetWorth(){
    const values = NET_WORTH_CATEGORIES.map(cat => parseFloat(document.getElementById(cat.id).value) || 0);
    const assetsTotal = values.reduce((a,b) => a+b, 0);
    const liquidTotal = computeLiveLiquidTotal();
    const debt = parseFloat(document.getElementById('netDebt').value) || 0;
    const netWorth = assetsTotal - debt;

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
}

/**
 * Nulstiller alle felter efter bekræftelse. Historikken bevares.
 */
function resetNetWorth(){
    if(!confirm('Nulstil alle formuefelter? Det kan ikke fortrydes.')) return;
    NET_WORTH_CATEGORIES.forEach(cat => document.getElementById(cat.id).value = 0);
    document.getElementById('netDebt').value = 0;
    updateNetWorth();
}

loadNetWorthFromStorage();
NET_WORTH_CATEGORIES.forEach(cat => document.getElementById(cat.id).addEventListener('input', updateNetWorth));
document.getElementById('netDebt').addEventListener('input', updateNetWorth);
document.getElementById('wealthAge').addEventListener('input', updateWealthComparison);
updateNetWorth();

let netWorthHistoryChart = null;

/**
 * Indlæser historik fra en CSV-fil (vores eget format eller genexporteret fra
 * Numbers/Excel). Eksisterende punkter bevares; samme dato overskrives.
 * @param {Event} event change-eventet fra <input type="file">
 */
function importNetWorthCSV(event){
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e){
        try{
            const rows = parseCSV(e.target.result);
            const headerIndex = findHeaderRowIndex(rows);
            if(headerIndex === -1){
                alert('CSV-filen ser ikke ud til at have det rigtige format (mangler "Dato"-kolonne).');
                return;
            }
            const headers = rows[headerIndex];
            const dataRows = rows.slice(headerIndex + 1);
            const col = name => headers.indexOf(name);

            let history = JSON.parse(localStorage.getItem('netWorthHistory') || '[]');
            let importedCount = 0;

            dataRows.forEach(row => {
                const date = row[col('Dato')];
                if(!date) return;
                const entry = {
                    date: date,
                    netCatKontanter: parseDanishAmount(row[col('Kontanter')]),
                    netCatAktier: parseDanishAmount(row[col('Aktier')]),
                    netCatPension: parseDanishAmount(row[col('Pension')]),
                    netCatFrivaerdi: parseDanishAmount(row[col('Friværdi')]),
                    netCatAndet: parseDanishAmount(row[col('Andet')]),
                    debt: parseDanishAmount(row[col('Gæld')]),
                    liquid: parseDanishAmount(row[col('Likvid')]),
                    value: parseDanishAmount(row[col('Nettoformue')])
                };
                const existingIndex = history.findIndex(h => h.date === entry.date);
                if(existingIndex >= 0){ history[existingIndex] = entry; }
                else { history.push(entry); }
                importedCount++;
            });

            history.sort((a,b) => a.date.localeCompare(b.date));
            localStorage.setItem('netWorthHistory', JSON.stringify(history));
            renderNetWorthHistory();
            alert(importedCount + ' datapunkt(er) importeret.');
        } catch(err){
            alert('Kunne ikke læse CSV-filen. Tjek at det er en fil eksporteret fra dette værktøj.');
        }
        event.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
}

/**
 * Gemmer felternes værdier som et øjebliksbillede for den valgte dato (i dag
 * som standard) og gentegner historikken.
 */
function saveNetWorthSnapshot(){
    const netWorth = computeLiveNetWorth();
    const liquidTotal = computeLiveLiquidTotal();
    const selectedDate = document.getElementById('snapshotDate').value || new Date().toISOString().slice(0,10);

    const entry = {date: selectedDate, value: netWorth, liquid: liquidTotal};
    NET_WORTH_CATEGORIES.forEach(cat => {
        entry[cat.id] = parseFloat(document.getElementById(cat.id).value) || 0;
    });
    entry.debt = parseFloat(document.getElementById('netDebt').value) || 0;

    let history = JSON.parse(localStorage.getItem('netWorthHistory') || '[]');
    const existingIndex = history.findIndex(h => h.date === selectedDate);
    if(existingIndex >= 0){
        history[existingIndex] = entry;
    } else {
        history.push(entry);
    }
    history.sort((a,b) => a.date.localeCompare(b.date));
    localStorage.setItem('netWorthHistory', JSON.stringify(history));
    renderNetWorthHistory();
}

/**
 * @param {string} date ISO-dato, fx '2026-09-21'
 */
function deleteNetWorthEntry(date){
    let history = JSON.parse(localStorage.getItem('netWorthHistory') || '[]');
    history = history.filter(h => h.date !== date);
    localStorage.setItem('netWorthHistory', JSON.stringify(history));
    renderNetWorthHistory();
}

/**
 * Sletter hele formuehistorikken efter bekræftelse.
 */
function clearNetWorthHistory(){
    if(confirm('Er du sikker på, at du vil slette hele formuehistorikken? Det kan ikke fortrydes.')){
        localStorage.removeItem('netWorthHistory');
        renderNetWorthHistory();
    }
}

/**
 * Læser historikken fra localStorage og opdaterer historik-grafen, tabellen,
 * sammensætningen samt rekord og milepæle.
 */
function renderNetWorthHistory(){
    const history = JSON.parse(localStorage.getItem('netWorthHistory') || '[]');
    const chartData = {
        labels: history.map(h => h.date),
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
            <td>${h.date}</td>
            <td>${DK.format(h.netCatKontanter || 0)} kr.</td>
            <td>${DK.format(h.netCatAktier || 0)} kr.</td>
            <td>${DK.format(h.netCatPension || 0)} kr.</td>
            <td>${DK.format(h.netCatFrivaerdi || 0)} kr.</td>
            <td>${DK.format(h.netCatAndet || 0)} kr.</td>
            <td>${DK.format(h.debt || 0)} kr.</td>
            <td>${DK.format(h.liquid ?? 0)} kr.</td>
            <td>${DK.format(h.value)} kr.</td>
            <td><button class="btn btn-secondary" style="padding:4px 10px; font-size:12px;" onclick="deleteNetWorthEntry('${h.date}')">Slet</button></td>
        </tr>`).join('');

    const netWorthHasHistory = history.length > 0;
    document.getElementById('netWorthHistoryChartEmpty').style.display = netWorthHasHistory ? 'none' : 'flex';
    document.getElementById('netWorthCompositionChartEmpty').style.display = netWorthHasHistory ? 'none' : 'flex';

    renderNetWorthComposition(history);
    renderRecordAndMilestones();
}

let netWorthCompositionChart = null;

/**
 * Stablet arealgraf over aktivtyper og gæld pr. øjebliksbillede.
 * @param {object[]} history øjebliksbillederne, sorteret efter dato
 */
function renderNetWorthComposition(history){
    const labels = history.map(h => h.date);
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
                plugins:{
                    legend:{display:false},
                    tooltip:{
                        backgroundColor:CHART_COLOR('--tooltip-bg'), borderColor:CHART_COLOR('--border'), borderWidth:1,
                        titleColor:CHART_COLOR('--text'), bodyColor:CHART_COLOR('--text'),
                        callbacks:{ label: c => `${c.dataset.label}: ${DK.format(c.raw)} kr.` }
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
    const history = JSON.parse(localStorage.getItem('netWorthHistory') || '[]');
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

document.getElementById('snapshotDate').value = new Date().toISOString().slice(0,10);
renderNetWorthHistory();