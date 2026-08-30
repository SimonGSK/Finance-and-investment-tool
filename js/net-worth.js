const NET_WORTH_CATEGORIES = [
    {id:'netCatKontanter', label:'Kontanter & opsparingskonti', color:'#45C4B0', liquid:true},
    {id:'netCatAktier', label:'Aktier & værdipapirer', color:'#E3A548', liquid:true},
    {id:'netCatPension', label:'Pension', color:'#9B7EDE', liquid:false},
    {id:'netCatFrivaerdi', label:'Friværdi i bolig', color:'#6C8EBF', liquid:false},
    {id:'netCatAndet', label:'Andet', color:'#8B96A3', liquid:false}
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
            borderColor:'#0F1720',
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
                labels:{ color:'#8B96A3', font:{family:'Inter', size:11}, boxWidth:12, padding:12 }
            },
            tooltip:{
                backgroundColor:'#1C2733',
                borderColor:'#26323F',
                borderWidth:1,
                titleColor:'#EDEAE3',
                bodyColor:'#EDEAE3',
                callbacks:{ label: c => `${c.label}: ${DK.format(c.raw)} kr.` }
            }
        }
    }
});

function saveNetWorthToStorage(){
    const data = { netDebt: document.getElementById('netDebt').value };
    NET_WORTH_CATEGORIES.forEach(cat => data[cat.id] = document.getElementById(cat.id).value);
    localStorage.setItem('netWorthData', JSON.stringify(data));
}

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

function computeLiveNetWorth(){
    const assetsTotal = NET_WORTH_CATEGORIES.reduce((sum, cat) => sum + (parseFloat(document.getElementById(cat.id).value) || 0), 0);
    const debt = parseFloat(document.getElementById('netDebt').value) || 0;
    return assetsTotal - debt;
}

function computeLiveLiquidTotal(){
    return NET_WORTH_CATEGORIES.reduce((sum, cat) => cat.liquid ? sum + (parseFloat(document.getElementById(cat.id).value) || 0) : sum, 0);
}

// Uddrag af CEPOS' formueopgørelse (Danmarks Statistik, 2022-tal opregnet til
// 2025-niveau) - 16 alderstrin i stedet for alle 73, vi regner lineært imellem.
const CEPOS_WEALTH_TABLE = [
    {age:18, p10:3000, p25:10000, p50:38000, p75:88000, p90:175000, p95:282000, p99:926000},
    {age:20, p10:1000, p25:16000, p50:57000, p75:136000, p90:269000, p95:433000, p99:1320000},
    {age:25, p10:-96000, p25:9000, p50:82000, p75:240000, p90:591000, p95:938000, p99:2330000},
    {age:30, p10:-196000, p25:21000, p50:221000, p75:598000, p90:1113000, p95:1584000, p99:3956000},
    {age:35, p10:-153000, p25:99000, p50:475000, p75:1041000, p90:1792000, p95:2515000, p99:6636000},
    {age:40, p10:-43000, p25:233000, p50:790000, p75:1551000, p90:2619000, p95:3718000, p99:10912000},
    {age:45, p10:34000, p25:464000, p50:1180000, p75:2165000, p90:3629000, p95:5340000, p99:17385000},
    {age:50, p10:115000, p25:695000, p50:1549000, p75:2763000, p90:4753000, p95:7199000, p99:24047000},
    {age:55, p10:173000, p25:842000, p50:1815000, p75:3245000, p90:5613000, p95:8607000, p99:28417000},
    {age:60, p10:262000, p25:1028000, p50:2147000, p75:3804000, p90:6391000, p95:9414000, p99:26968000},
    {age:65, p10:366000, p25:1207000, p50:2415000, p75:4182000, p90:6768000, p95:9571000, p99:24358000},
    {age:70, p10:309000, p25:1019000, p50:2214000, p75:4002000, p90:6597000, p95:9446000, p99:23098000},
    {age:75, p10:257000, p25:828000, p50:1919000, p75:3584000, p90:6122000, p95:8991000, p99:22813000},
    {age:80, p10:167000, p25:574000, p50:1515000, p75:3013000, p90:5380000, p95:8038000, p99:20629000},
    {age:85, p10:117000, p25:380000, p50:1159000, p75:2446000, p90:4463000, p95:6554000, p99:17001000},
    {age:90, p10:85000, p25:265000, p50:925000, p75:2164000, p90:4046000, p95:5999000, p99:14732000}
];

function findNearestWealthRow(age){
    const clampedAge = Math.max(18, Math.min(90, age));
    return CEPOS_WEALTH_TABLE.reduce((closest, row) =>
        Math.abs(row.age - clampedAge) < Math.abs(closest.age - clampedAge) ? row : closest
    );
}

// Regner en cirka-percentil ud fra formuen, ved at interpolere lineært
// imellem de kendte procentgrænser (10/25/50/75/90/95/99) for aldersgruppen.
function estimatePercentile(netWorth, row){
    const points = [
        {p:0, v: row.p10 - (row.p25 - row.p10)},
        {p:10, v: row.p10},
        {p:25, v: row.p25},
        {p:50, v: row.p50},
        {p:75, v: row.p75},
        {p:90, v: row.p90},
        {p:95, v: row.p95},
        {p:99, v: row.p99},
        {p:100, v: row.p99 + (row.p99 - row.p95)}
    ];
    for(let i=1; i<points.length; i++){
        if(netWorth <= points[i].v){
            const a = points[i-1], b = points[i];
            const frac = (netWorth - a.v) / ((b.v - a.v) || 1);
            return Math.max(0, Math.min(100, Math.round(a.p + frac*(b.p-a.p))));
        }
    }
    return 100;
}

// Sjove, omtrentlige priser - juster frit efter smag. Bruges kun til
// "din formue svarer til X ting"-sammenligningen, ikke til noget seriøst.
const FUN_ITEMS = [
    {label:'bananer', price:3},
    {label:'iPhone 17', price:7499},
    {label:'kvadratmeters lejlighed i Kbh K', price:85760},
    {label:'Fiat 500 (2026)', price:189990},
    {label:'Porsche 911 GT3 RS med danske afgifter', price:4910783}
];

function renderPurchasingPower(netWorth){
    const container = document.getElementById('purchasingPowerContainer');
    if(netWorth <= 0){
        container.innerHTML = '<span style="color:var(--muted);">Udfyld dine aktiver ovenfor for at se det her.</span>';
        return;
    }
    container.innerHTML = FUN_ITEMS.map(item => {
        const qty = netWorth / item.price;
        const qtyDisplay = qty >= 10 ? Math.round(qty).toLocaleString('da-DK') : qty.toFixed(1).replace('.', ',');
        return `<div>💰 <strong>${qtyDisplay}</strong> ${item.label}</div>`;
    }).join('');
}

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

function deleteNetWorthEntry(date){
    let history = JSON.parse(localStorage.getItem('netWorthHistory') || '[]');
    history = history.filter(h => h.date !== date);
    localStorage.setItem('netWorthHistory', JSON.stringify(history));
    renderNetWorthHistory();
}

function clearNetWorthHistory(){
    if(confirm('Er du sikker på, at du vil slette hele formuehistorikken? Det kan ikke fortrydes.')){
        localStorage.removeItem('netWorthHistory');
        renderNetWorthHistory();
    }
}

function renderNetWorthHistory(){
    const history = JSON.parse(localStorage.getItem('netWorthHistory') || '[]');
    const chartData = {
        labels: history.map(h => h.date),
        datasets:[
            {
                label:'Nettoformue',
                data: history.map(h => h.value),
                borderColor:'#E3A548',
                backgroundColor:'#E3A548',
                tension:0.15,
                pointRadius:4,
                borderWidth:2.5
            },
            {
                label:'Likvid formue',
                data: history.map(h => h.liquid ?? null),
                borderColor:'#45C4B0',
                backgroundColor:'#45C4B0',
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
                plugins:{
                    legend:{
                        display:true,
                        position:'bottom',
                        labels:{ color:'#8B96A3', font:{family:'Inter', size:11}, boxWidth:12, padding:12 }
                    },
                    tooltip:{
                        backgroundColor:'#1C2733',
                        borderColor:'#26323F',
                        borderWidth:1,
                        titleColor:'#EDEAE3',
                        bodyColor:'#EDEAE3',
                        callbacks:{ label: c => `${c.dataset.label}: ${DK.format(c.raw)} kr.` }
                    }
                },
                scales:{
                    x:{ grid:{color:'#202B36'}, ticks:{color:'#8B96A3', font:{family:'IBM Plex Mono', size:11}} },
                    y:{ grid:{color:'#202B36'}, ticks:{color:'#8B96A3', font:{family:'IBM Plex Mono', size:11}, callback: v => DK.format(v)} }
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

function renderNetWorthComposition(history){
    const labels = history.map(h => h.date);
    const datasets = [
        {label:'Kontanter', data: history.map(h => h.netCatKontanter || 0), backgroundColor:'#45C4B0', borderColor:'#45C4B0', fill:true, stack:'formue', pointRadius:0, tension:0.1},
        {label:'Aktier', data: history.map(h => h.netCatAktier || 0), backgroundColor:'#E3A548', borderColor:'#E3A548', fill:true, stack:'formue', pointRadius:0, tension:0.1},
        {label:'Pension', data: history.map(h => h.netCatPension || 0), backgroundColor:'#9B7EDE', borderColor:'#9B7EDE', fill:true, stack:'formue', pointRadius:0, tension:0.1},
        {label:'Friværdi', data: history.map(h => h.netCatFrivaerdi || 0), backgroundColor:'#6C8EBF', borderColor:'#6C8EBF', fill:true, stack:'formue', pointRadius:0, tension:0.1},
        {label:'Andet', data: history.map(h => h.netCatAndet || 0), backgroundColor:'#8B96A3', borderColor:'#8B96A3', fill:true, stack:'formue', pointRadius:0, tension:0.1},
        {label:'Gæld', data: history.map(h => -(h.debt || 0)), backgroundColor:'#E85C4A', borderColor:'#E85C4A', fill:true, stack:'formue', pointRadius:0, tension:0.1}
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
                plugins:{
                    legend:{display:false},
                    tooltip:{
                        backgroundColor:'#1C2733', borderColor:'#26323F', borderWidth:1,
                        titleColor:'#EDEAE3', bodyColor:'#EDEAE3',
                        callbacks:{ label: c => `${c.dataset.label}: ${DK.format(c.raw)} kr.` }
                    }
                },
                scales:{
                    x:{ grid:{color:'#202B36'}, ticks:{color:'#8B96A3', font:{family:'IBM Plex Mono', size:11}} },
                    y:{
                        stacked:true,
                        grid:{color:'#202B36'},
                        ticks:{color:'#8B96A3', font:{family:'IBM Plex Mono', size:11}, callback: v => DK.format(v)}
                    }
                }
            }
        });
    }
}

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