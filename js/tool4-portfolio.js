function lineChartOptions(tooltipLabelFn){
    return {
        responsive:true,
        animation:{duration:250},
        interaction:{mode:'index', intersect:false},
        plugins:{
            legend:{display:false},
            tooltip:{
                backgroundColor:'#1C2733',
                borderColor:'#26323F',
                borderWidth:1,
                titleColor:'#EDEAE3',
                bodyColor:'#EDEAE3',
                callbacks:{ label: tooltipLabelFn }
            }
        },
        scales:{
            x:{ grid:{color:'#202B36'}, ticks:{color:'#8B96A3', font:{family:'IBM Plex Mono', size:11}} },
            y:{ grid:{color:'#202B36'}, ticks:{color:'#8B96A3', font:{family:'IBM Plex Mono', size:11}, callback: v => DK.format(v)} }
        }
    };
}

const ptTooltipLabel = c => `${c.dataset.label}: ${DK.format(c.raw)} kr.`;

const ptCtx1 = document.getElementById('ptChart1').getContext('2d');
let ptChart1 = new Chart(ptCtx1, {
    type:'line',
    data:{labels:[], datasets:[
            {label:'Porteføljeværdi', data:[], borderColor:'#E3A548', backgroundColor:'#E3A548', tension:0.15, pointRadius:0, borderWidth:2.5},
            {label:'Kumuleret indskud/udbetaling', data:[], borderColor:'#45C4B0', backgroundColor:'#45C4B0', tension:0.15, pointRadius:0, borderWidth:2, borderDash:[4,4]}
        ]},
    options: {...lineChartOptions(ptTooltipLabel), maintainAspectRatio:false}
});

const ptCtx2 = document.getElementById('ptChart2').getContext('2d');
let ptChart2 = new Chart(ptCtx2, {
    data:{labels:[], datasets:[
            {type:'line', label:'Aktieværdi', data:[], borderColor:'#E3A548', backgroundColor:'#E3A548', tension:0.15, pointRadius:0, borderWidth:2.5, yAxisID:'y'},
            {type:'bar', label:'Køb/solgt (pr. måned)', data:[], backgroundColor:'#9B7EDE', yAxisID:'y1'}
        ]},
    options:{
        responsive:true,
        animation:{duration:250},
        interaction:{mode:'index', intersect:false},
        plugins:{
            legend:{display:false},
            tooltip:{
                backgroundColor:'#1C2733', borderColor:'#26323F', borderWidth:1,
                titleColor:'#EDEAE3', bodyColor:'#EDEAE3',
                callbacks:{ label: ptTooltipLabel }
            }
        },
        scales:{
            x:{ grid:{color:'#202B36'}, ticks:{color:'#8B96A3', font:{family:'IBM Plex Mono', size:11}} },
            y:{
                position:'left',
                grid:{color:'#202B36'},
                ticks:{color:'#8B96A3', font:{family:'IBM Plex Mono', size:11}, callback: v => DK.format(v)}
            },
            y1:{
                position:'right',
                grid:{drawOnChartArea:false},
                ticks:{color:'#8B96A3', font:{family:'IBM Plex Mono', size:11}, callback: v => DK.format(v)}
            }
        }
    }
});

const ptCtx3 = document.getElementById('ptChart3').getContext('2d');
let ptChart3 = new Chart(ptCtx3, {
    type:'line',
    data:{labels:[], datasets:[
            {label:'Aktieværdi', data:[], borderColor:'#E3A548', backgroundColor:'#E3A548', tension:0.15, pointRadius:0, borderWidth:2.5},
            {label:'Totalt investeret', data:[], borderColor:'#45C4B0', backgroundColor:'#45C4B0', tension:0.15, pointRadius:0, borderWidth:2, borderDash:[4,4]}
        ]},
    options: lineChartOptions(ptTooltipLabel)
});

const ptCtx4 = document.getElementById('ptChart4').getContext('2d');
let ptChart4 = new Chart(ptCtx4, {
    type:'line',
    data:{labels:[], datasets:[
            {label:'Totalt afkast', data:[], borderColor:'#E3A548', backgroundColor:'#E3A548', tension:0.15, pointRadius:0, borderWidth:2.5}
        ]},
    options: lineChartOptions(ptTooltipLabel)
});

function updatePortfolioValueField(){
    const stockValue = parseFloat(document.getElementById('ptStockValue').value) || 0;
    const cash = parseFloat(document.getElementById('ptCash').value) || 0;
    document.getElementById('ptPortfolioValue').value = stockValue + cash;
}
document.getElementById('ptStockValue').addEventListener('input', updatePortfolioValueField);
document.getElementById('ptCash').addEventListener('input', updatePortfolioValueField);

function importPortfolioCSV(event){
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

            let history = JSON.parse(localStorage.getItem('portfolioHistory') || '[]');
            let importedCount = 0;

            dataRows.forEach(row => {
                const date = row[col('Dato')];
                if(!date) return;
                const entry = {
                    date: date,
                    portfolioValue: parseDanishAmount(row[col('Porteføljeværdi')]),
                    stockValue: parseDanishAmount(row[col('Aktieværdi')]),
                    cash: parseDanishAmount(row[col('Kontant')]),
                    traded: parseDanishAmount(row[col('Købt/solgt')]),
                    deposit: parseDanishAmount(row[col('Indskud/udb.')]),
                    dividend: parseDanishAmount(row[col('Udbytte')])
                };
                const existingIndex = history.findIndex(h => h.date === entry.date);
                if(existingIndex >= 0){ history[existingIndex] = entry; }
                else { history.push(entry); }
                importedCount++;
            });

            history.sort((a,b) => a.date.localeCompare(b.date));
            localStorage.setItem('portfolioHistory', JSON.stringify(history));
            renderPortfolioHistory();
            alert(importedCount + ' datapunkt(er) importeret.');
        } catch(err){
            alert('Kunne ikke læse CSV-filen. Tjek at det er en fil eksporteret fra dette værktøj.');
        }
        event.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
}

function savePortfolioSnapshot(){
    const entry = {
        date: document.getElementById('ptDate').value || new Date().toISOString().slice(0,10),
        portfolioValue: parseFloat(document.getElementById('ptPortfolioValue').value) || 0,
        stockValue: parseFloat(document.getElementById('ptStockValue').value) || 0,
        cash: parseFloat(document.getElementById('ptCash').value) || 0,
        traded: parseFloat(document.getElementById('ptTraded').value) || 0,
        deposit: parseFloat(document.getElementById('ptDeposit').value) || 0,
        dividend: parseFloat(document.getElementById('ptDividend').value) || 0
    };

    let history = JSON.parse(localStorage.getItem('portfolioHistory') || '[]');
    const existingIndex = history.findIndex(h => h.date === entry.date);
    if(existingIndex >= 0){ history[existingIndex] = entry; }
    else { history.push(entry); }
    history.sort((a,b) => a.date.localeCompare(b.date));
    localStorage.setItem('portfolioHistory', JSON.stringify(history));
    renderPortfolioHistory();
}

function deletePortfolioEntry(date){
    let history = JSON.parse(localStorage.getItem('portfolioHistory') || '[]');
    history = history.filter(h => h.date !== date);
    localStorage.setItem('portfolioHistory', JSON.stringify(history));
    renderPortfolioHistory();
}

function clearPortfolioHistory(){
    if(confirm('Er du sikker på, at du vil slette hele porteføljehistorikken? Det kan ikke fortrydes.')){
        localStorage.removeItem('portfolioHistory');
        renderPortfolioHistory();
    }
}

function renderPortfolioHistory(){
    const history = JSON.parse(localStorage.getItem('portfolioHistory') || '[]');

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

    const labels = enriched.map(h => h.date);

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

    const ptTableBody = document.getElementById('ptTableBody');
    ptTableBody.innerHTML = enriched.map(h => `<tr>
            <td>${h.date}</td>
            <td>${DK.format(h.portfolioValue)} kr.</td>
            <td>${DK.format(h.stockValue)} kr.</td>
            <td>${DK.format(h.cash)} kr.</td>
            <td>${DK.format(h.traded)} kr.</td>
            <td>${DK.format(h.deposit)} kr.</td>
            <td>${DK.format(h.dividend)} kr.</td>
            <td><button class="btn btn-secondary" style="padding:4px 10px; font-size:12px;" onclick="deletePortfolioEntry('${h.date}')">Slet</button></td>
        </tr>`).join('');
}

document.getElementById('ptDate').value = new Date().toISOString().slice(0,10);
renderPortfolioHistory();