// ---- Porteret fra Main.java: ask() ----
function computeAskSeries(years, yearlyReturn, startCash, payTaxExternally){
    let money = startCash;
    const series = [{year:0, value:startCash, taxPaid:0}];
    for(let i=1;i<=years;i++){
        const before = money*yearlyReturn;
        const tax = (before-money)*ASK_TAX;
        money = payTaxExternally ? before : before-tax;
        series.push({year:i, value:money, taxPaid:tax});
    }
    return series;
}

// ---- Importeret fra Main.java: computeFinalValueForStartYear() ----
function computeAktFinalValueForStartYear(years, yearlyReturn, startCash, investSavedAskTax, harvestStartYear){
    let shareValue = startCash, costBasis = startCash, shadowAskMoney = startCash;
    const taxLimit = effectiveTaxLimit();
    for(let i=1;i<=years;i++){
        if(investSavedAskTax){
            const shadowProfit = shadowAskMoney*yearlyReturn - shadowAskMoney;
            const askTax = shadowProfit>0 ? shadowProfit*ASK_TAX : 0;
            shadowAskMoney = shadowAskMoney*yearlyReturn;
            if(askTax>0){ shareValue+=askTax; costBasis+=askTax; }
        }
        shareValue *= yearlyReturn;
        if(i<years){
            if(i>=harvestStartYear){
                const unrealized = shareValue-costBasis;
                if(unrealized>0){
                    const realize = Math.min(unrealized, taxLimit);
                    const tax = realize*AKT_TAX_LOW;
                    shareValue -= tax;
                    costBasis += (realize-tax);
                }
            }
        } else {
            const finalUnrealized = shareValue-costBasis;
            if(finalUnrealized>0){
                const tax = finalUnrealized<=taxLimit
                    ? finalUnrealized*AKT_TAX_LOW
                    : taxLimit*AKT_TAX_LOW + (finalUnrealized-taxLimit)*AKT_TAX_HIGH;
                shareValue -= tax;
            }
        }
    }
    return shareValue;
}

// ---- Importeret fra Main.java: findBestHarvestStartYear() ----
function findBestHarvestStartYear(years, yearlyReturn, startCash, investSavedAskTax){
    let bestStart = years;
    let bestValue = computeAktFinalValueForStartYear(years, yearlyReturn, startCash, investSavedAskTax, bestStart);
    for(let c=years-1;c>=1;c--){
        const v = computeAktFinalValueForStartYear(years, yearlyReturn, startCash, investSavedAskTax, c);
        if(v>bestValue){ bestValue=v; bestStart=c; }
    }
    return bestStart;
}

// ---- Importeret fra Main.java: akt() (år-for-år-serie, med den optimale strategi) ----
function computeAktSeries(years, yearlyReturn, startCash, investSavedAskTax){
    const harvestStartYear = findBestHarvestStartYear(years, yearlyReturn, startCash, investSavedAskTax);
    let shareValue = startCash, costBasis = startCash, shadowAskMoney = startCash;
    const taxLimit = effectiveTaxLimit();
    const series = [{year:0, value:startCash, taxAt27:0, taxAt42:0}];
    for(let i=1;i<=years;i++){
        if(investSavedAskTax){
            const shadowProfit = shadowAskMoney*yearlyReturn - shadowAskMoney;
            const askTax = shadowProfit>0 ? shadowProfit*ASK_TAX : 0;
            shadowAskMoney = shadowAskMoney*yearlyReturn;
            if(askTax>0){ shareValue+=askTax; costBasis+=askTax; }
        }
        shareValue *= yearlyReturn;

        let taxAt27 = 0, taxAt42 = 0;

        if(i<years){
            if(i>=harvestStartYear){
                const unrealized = shareValue-costBasis;
                if(unrealized>0){
                    const realize = Math.min(unrealized, taxLimit);
                    const tax = realize*AKT_TAX_LOW;
                    shareValue -= tax;
                    costBasis += (realize-tax);
                    taxAt27 = tax;
                }
            }
        } else {
            const finalUnrealized = shareValue-costBasis;
            if(finalUnrealized>0){
                if(finalUnrealized<=taxLimit){
                    taxAt27 = finalUnrealized*AKT_TAX_LOW;
                } else {
                    taxAt27 = taxLimit*AKT_TAX_LOW;
                    taxAt42 = (finalUnrealized-taxLimit)*AKT_TAX_HIGH;
                }
                shareValue -= (taxAt27 + taxAt42);
            }
        }
        series.push({year:i, value:shareValue, taxAt27, taxAt42});
    }
    return {series, harvestStartYear};
}

const ctx = document.getElementById('chart').getContext('2d');
let chart = new Chart(ctx, {
    type:'line',
    data:{labels:[], datasets:[
            {label:'Aktiesparekonto', data:[], borderColor:'#45C4B0', backgroundColor:'#45C4B0', tension:0.15, pointRadius:0, borderWidth:2.5},
            {label:'Aktiedepot', data:[], borderColor:'#E3A548', backgroundColor:'#E3A548', tension:0.15, pointRadius:0, borderWidth:2.5}
        ]},
    options:{
        responsive:true,
        maintainAspectRatio:false,
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
                callbacks:{
                    label: c => `${c.dataset.label}: ${DK.format(c.raw)} kr.`
                }
            }
        },
        scales:{
            x:{
                grid:{color:'#202B36'},
                ticks:{color:'#8B96A3', font:{family:'IBM Plex Mono', size:11}},
                title:{display:true, text:'År', color:'#8B96A3', font:{family:'Inter', size:12}}
            },
            y:{
                grid:{color:'#202B36'},
                ticks:{
                    color:'#8B96A3', font:{family:'IBM Plex Mono', size:11},
                    callback: v => DK.format(v)
                }
            }
        }
    }
});

const startCashInput = document.getElementById('startCash');
const yearsInput = document.getElementById('years');
const returnInput = document.getElementById('yearlyReturn');
const payTaxInput = document.getElementById('payTaxExternally');
const inflationInput = document.getElementById('inflation');
const showRealInput = document.getElementById('showRealValue');

const ASK_LIMIT = 174200;
const SNAP_TOLERANCE = 4000;

startCashInput.addEventListener('input', () => {
    const val = parseInt(startCashInput.value);
    if(Math.abs(val - ASK_LIMIT) < SNAP_TOLERANCE){
        startCashInput.value = ASK_LIMIT;
    }
});

function update(){
    const startCash = parseInt(startCashInput.value);
    const years = parseInt(yearsInput.value);
    const returnPercent = parseFloat(returnInput.value);
    const payTaxExternally = payTaxInput.checked;
    const yearlyReturn = 1 + returnPercent/100;

    const inflationPercent = parseFloat(inflationInput.value);
    const inflationFactor = 1 + inflationPercent/100;
    const showReal = showRealInput.checked;
    document.getElementById('inflationNote').style.display = showReal ? 'block' : 'none';
    document.getElementById('inflationField').style.display = showReal ? 'block' : 'none';

    const askSeriesNominal = computeAskSeries(years, yearlyReturn, startCash, payTaxExternally);
    const {series: aktSeriesNominal, harvestStartYear} = computeAktSeries(years, yearlyReturn, startCash, payTaxExternally);

    // Vis enten de rå (nominelle) tal, eller de samme tal regnet om til nutidens købekraft
    const askSeries = showReal
        ? askSeriesNominal.map(p => ({
            year:p.year,
            value: toRealValue(p.value, p.year, inflationFactor),
            taxPaid: toRealValue(p.taxPaid, p.year, inflationFactor)
        }))
        : askSeriesNominal;
    const aktSeries = showReal
        ? aktSeriesNominal.map(p => ({
            year:p.year,
            value: toRealValue(p.value, p.year, inflationFactor),
            taxAt27: toRealValue(p.taxAt27, p.year, inflationFactor),
            taxAt42: toRealValue(p.taxAt42, p.year, inflationFactor)
        }))
        : aktSeriesNominal;

    chart.data.labels = askSeries.map(p => p.year);
    chart.data.datasets[0].data = askSeries.map(p => p.value);
    chart.data.datasets[1].data = aktSeries.map(p => p.value);

    chart.update();

    const tableBody = document.getElementById('dataTableBody');
    tableBody.innerHTML = askSeries.map((askPoint, i) => {
        const aktPoint = aktSeries[i];
        return `<tr>
                <td>${askPoint.year}</td>
                <td>${DK.format(askPoint.value)} kr.</td>
                <td>${DK.format(askPoint.taxPaid)} kr.</td>
                <td>${DK.format(aktPoint.value)} kr.</td>
                <td>${aktPoint.taxAt27 > 0 ? DK.format(aktPoint.taxAt27) + ' kr.' : '–'}</td>
                <td>${aktPoint.taxAt42 > 0 ? DK.format(aktPoint.taxAt42) + ' kr.' : '–'}</td>
            </tr>`;
    }).join('');

    const noHarvestValueNominal = computeAktFinalValueForStartYear(years, yearlyReturn, startCash, payTaxExternally, years);
    const noHarvestValue = showReal ? toRealValue(noHarvestValueNominal, years, inflationFactor) : noHarvestValueNominal;
    const harvestAdvantage = aktSeries[aktSeries.length-1].value - noHarvestValue;

    const strategyEl = document.getElementById('strategyText');
    if(harvestStartYear < years){
        strategyEl.innerHTML = `Start med at realisere gevinst i <strong style="color:var(--akt)">år ${harvestStartYear}</strong> (ud af ${years} år i alt) – sælg og genkøb årligt op til 27%-grænsen, indtil sidste år, hvor resten sælges og beskattes progressivt.<br><br>
                Det giver <strong style="color:var(--akt)">${DK.format(harvestAdvantage)} kr. mere</strong> end hvis du havde ventet og solgt det hele i sidste år.`;
    } else {
        strategyEl.innerHTML = `Bedst er slet ikke at realisere undervejs – vent til sidste år, og betal den progressive skat (27%/42%) af hele gevinsten på én gang. Her giver tidlig realisering ingen fordel.`;
    }
    const finalAsk = askSeries[askSeries.length-1].value;
    const finalAkt = aktSeries[aktSeries.length-1].value;

    document.getElementById('finalAsk').textContent = DK.format(finalAsk) + ' kr.';
    document.getElementById('finalAkt').textContent = DK.format(finalAkt) + ' kr.';

    const winnerEl = document.getElementById('winner');
    const winnerDetail = document.getElementById('winnerDetail');
    if(finalAsk > finalAkt){
        winnerEl.textContent = 'Aktiesparekonto';
        winnerEl.className = 'value ask';
        winnerDetail.textContent = '+' + DK.format(finalAsk-finalAkt) + ' kr. mere';
    } else if(finalAkt > finalAsk){
        winnerEl.textContent = 'Aktiedepot';
        winnerEl.className = 'value akt';
        winnerDetail.textContent = '+' + DK.format(finalAkt-finalAsk) + ' kr. mere';
    } else {
        winnerEl.textContent = 'Uafgjort';
        winnerEl.className = 'value';
        winnerDetail.textContent = '';
    }
}

bindSliderAndNumber('startCash', 'startCashNumber', update);
bindSliderAndNumber('years', 'yearsNumber', update);
bindSliderAndNumber('yearlyReturn', 'yearlyReturnNumber', update);
bindSliderAndNumber('inflation', 'inflationNumber', update);
[payTaxInput, showRealInput].forEach(el => el.addEventListener('input', update));

update();