/**
 * @file Værktøj 1: Aktiesparekonto vs. aktiedepot med engangsindskud. Læser
 * parametrene fra formularen, kører beregningerne fra calc.js, og opdaterer
 * graf, nøgletal, strategitekst og tabellen.
 */

const ctx = document.getElementById('chart').getContext('2d');
let chart = new Chart(ctx, {
    type:'line',
    data:{labels:[], datasets:[
            {label:'Aktiesparekonto', data:[], borderColor:CHART_COLOR('--ask'), backgroundColor:CHART_COLOR('--ask'), themeVar:'--ask', tension:0.15, pointRadius:0, borderWidth:2.5},
            {label:'Aktiedepot', data:[], borderColor:CHART_COLOR('--akt'), backgroundColor:CHART_COLOR('--akt'), themeVar:'--akt', tension:0.15, pointRadius:0, borderWidth:2.5}
        ]},
    options:{
        responsive:true,
        maintainAspectRatio:false,
        animation:{duration:250},
        interaction:{mode:'index', intersect:false},
        plugins:{
            legend:{display:false},
            tooltip:{
                backgroundColor:CHART_COLOR('--tooltip-bg'),
                borderColor:CHART_COLOR('--border'),
                borderWidth:1,
                titleColor:CHART_COLOR('--text'),
                bodyColor:CHART_COLOR('--text'),
                callbacks:{
                    label: c => `${c.dataset.label}: ${DK.format(c.raw)} kr.`
                }
            }
        },
        scales:{
            x:{
                grid:{color:CHART_COLOR('--chart-grid')},
                ticks:{color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-mono'), size:11}},
                title:{display:true, text:'År', color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-sans'), size:12}}
            },
            y:{
                grid:{color:CHART_COLOR('--chart-grid')},
                ticks:{
                    color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-mono'), size:11},
                    callback: v => DK.format(v)
                }
            }
        }
    }
});

const startCashInput = document.getElementById('startCashNumber');
const yearsInput = document.getElementById('yearsNumber');
const returnInput = document.getElementById('yearlyReturnNumber');
const payTaxInput = document.getElementById('payTaxExternally');
const inflationInput = document.getElementById('inflationNumber');
const showRealInput = document.getElementById('showRealValue');

const SNAP_TOLERANCE = 4000;
document.querySelector('#askLimitMark option').value = ASK_DEPOSIT_LIMIT;

// Skyderen snapper til ASK-grænsen, når man trækker den tæt på - kun skyderen,
// så et præcist indtastet tal aldrig bliver rykket.
const startCashSlider = document.getElementById('startCash');
startCashSlider.addEventListener('input', () => {
    const val = parseInt(startCashSlider.value);
    if(Math.abs(val - ASK_DEPOSIT_LIMIT) < SNAP_TOLERANCE){
        startCashSlider.value = ASK_DEPOSIT_LIMIT;
    }
});

/**
 * Genberegner alt ud fra formularens aktuelle værdier. Kaldes ved hvert input.
 */
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
        strategyEl.innerHTML = `Start med at realisere gevinst i <strong style="color:var(--akt)">år ${harvestStartYear}</strong> (ud af ${years} år i alt) – sælg og genkøb årligt op til ${pctNumber(AKT_TAX_LOW)}%-grænsen, indtil sidste år, hvor resten sælges og beskattes progressivt.<br><br>
                Det giver <strong style="color:var(--akt)">${DK.format(harvestAdvantage)} kr. mere</strong> end hvis du havde ventet og solgt det hele i sidste år.`;
    } else {
        strategyEl.innerHTML = `Bedst er slet ikke at realisere undervejs – vent til sidste år, og betal den progressive skat (${pctNumber(AKT_TAX_LOW)}%/${pctNumber(AKT_TAX_HIGH)}%) af hele gevinsten på én gang. Her giver tidlig realisering ingen fordel.`;
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