// ---- Porteret fra Main.java: computeMonthlyFinalValueForStartYear() ----
function computeMonthlyFinalValueForStartYear(years, yearlyReturn, startCash, monthlyAmount, harvestStartYear){
    let shareValue = startCash, costBasis = startCash;
    const monthlyFactor = monthlyReturnFactor(yearlyReturn);
    const taxLimit = effectiveTaxLimit();

    for(let i=1;i<=years;i++){
        for(let m=1;m<=12;m++){
            shareValue += monthlyAmount;
            costBasis += monthlyAmount;
            shareValue *= monthlyFactor;
        }

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

// ---- Porteret fra Main.java: findBestMonthlyHarvestStartYear() ----
function findBestMonthlyHarvestStartYear(years, yearlyReturn, startCash, monthlyAmount){
    let bestStart = years;
    let bestValue = computeMonthlyFinalValueForStartYear(years, yearlyReturn, startCash, monthlyAmount, bestStart);
    for(let c=years-1;c>=1;c--){
        const v = computeMonthlyFinalValueForStartYear(years, yearlyReturn, startCash, monthlyAmount, c);
        if(v>bestValue){ bestValue=v; bestStart=c; }
    }
    return bestStart;
}

function computeMonthlySeries(years, yearlyReturn, startCash, monthlyAmount){
    const harvestStartYear = findBestMonthlyHarvestStartYear(years, yearlyReturn, startCash, monthlyAmount);
    let shareValue = startCash, costBasis = startCash, cumulativeInvested = startCash;
    const monthlyFactor = monthlyReturnFactor(yearlyReturn);
    const taxLimit = effectiveTaxLimit();
    const series = [{year:0, value:startCash, invested:startCash, taxAt27:0, taxAt42:0}];

    for(let i=1;i<=years;i++){
        for(let m=1;m<=12;m++){
            shareValue += monthlyAmount;
            costBasis += monthlyAmount;
            cumulativeInvested += monthlyAmount;
            shareValue *= monthlyFactor;
        }

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
        series.push({year:i, value:shareValue, invested:cumulativeInvested, taxAt27, taxAt42});
    }
    return {series, harvestStartYear};
}

const ctx2 = document.getElementById('chart2').getContext('2d');
let chart2 = new Chart(ctx2, {
    type:'line',
    data:{labels:[], datasets:[
            {label:'Aktiedepot (værdi)', data:[], borderColor:'#E3A548', backgroundColor:'#E3A548', tension:0.15, pointRadius:0, borderWidth:2.5},
            {label:'Indbetalt kapital', data:[], borderColor:'#5B6B7A', backgroundColor:'#5B6B7A', tension:0.15, pointRadius:0, borderWidth:2, borderDash:[4,4]}
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

const startCash2Input = document.getElementById('startCash2');
const monthlyAmount2Input = document.getElementById('monthlyAmount2');
const years2Input = document.getElementById('years2');
const return2Input = document.getElementById('yearlyReturn2');
const inflation2Input = document.getElementById('inflation2');
const showReal2Input = document.getElementById('showRealValue2');

function update2(){
    const startCash = parseInt(startCash2Input.value);
    const monthlyAmount = parseInt(monthlyAmount2Input.value);
    const years = parseInt(years2Input.value);
    const returnPercent = parseFloat(return2Input.value);
    const yearlyReturn = 1 + returnPercent/100;

    const inflationPercent2 = parseFloat(inflation2Input.value);
    const inflationFactor2 = 1 + inflationPercent2/100;
    const showReal2 = showReal2Input.checked;
    document.getElementById('inflationNote2').style.display = showReal2 ? 'block' : 'none';
    document.getElementById('inflationField2').style.display = showReal2 ? 'block' : 'none';

    const {series: seriesNominal, harvestStartYear} = computeMonthlySeries(years, yearlyReturn, startCash, monthlyAmount);

    // Deflatér BÅDE værdi og indbetalt kapital, så de to linjer i grafen
    // fortsat kan sammenlignes ærligt med hinanden.
    const series = showReal2
        ? seriesNominal.map(p => ({
            year: p.year,
            value: toRealValue(p.value, p.year, inflationFactor2),
            invested: toRealValue(p.invested, p.year, inflationFactor2),
            taxAt27: toRealValue(p.taxAt27, p.year, inflationFactor2),
            taxAt42: toRealValue(p.taxAt42, p.year, inflationFactor2)
        }))
        : seriesNominal;

    chart2.data.labels = series.map(p => p.year);
    chart2.data.datasets[0].data = series.map(p => p.value);
    chart2.data.datasets[1].data = series.map(p => p.invested);
    chart2.update();

    const finalValue = series[series.length-1].value;
    const totalInvested = series[series.length-1].invested;
    const netProfit = finalValue - totalInvested;
    const percentIncrease = totalInvested > 0 ? (netProfit/totalInvested)*100 : 0;

    document.getElementById('finalValue2').textContent = DK.format(finalValue) + ' kr.';
    document.getElementById('totalInvested2').textContent = DK.format(totalInvested) + ' kr.';
    document.getElementById('netProfit2').textContent = DK.format(netProfit) + ' kr.';
    document.getElementById('percentIncrease2').textContent = '+' + percentIncrease.toFixed(1).replace('.',',') + '%';

    const tableBody2 = document.getElementById('dataTableBody2');
    tableBody2.innerHTML = series.map(p => `<tr>
            <td>${p.year}</td>
            <td>${DK.format(p.value)} kr.</td>
            <td>${DK.format(p.invested)} kr.</td>
            <td>${p.taxAt27 > 0 ? DK.format(p.taxAt27) + ' kr.' : '–'}</td>
            <td>${p.taxAt42 > 0 ? DK.format(p.taxAt42) + ' kr.' : '–'}</td>
        </tr>`).join('');

    const noHarvestValueNominal = computeMonthlyFinalValueForStartYear(years, yearlyReturn, startCash, monthlyAmount, years);
    const noHarvestValue = showReal2 ? toRealValue(noHarvestValueNominal, years, inflationFactor2) : noHarvestValueNominal;
    const harvestAdvantage = finalValue - noHarvestValue;

    const strategyEl2 = document.getElementById('strategyText2');
    if(harvestStartYear < years){
        strategyEl2.innerHTML = `Start med at realisere gevinst i <strong style="color:var(--akt)">år ${harvestStartYear}</strong> (ud af ${years} år i alt).<br><br>
      Det giver <strong style="color:var(--akt)">${DK.format(harvestAdvantage)} kr. mere</strong> end hvis du havde ventet og solgt det hele i sidste år.`;
    } else {
        strategyEl2.innerHTML = `Bedst er slet ikke at realisere undervejs – vent til sidste år, og betal den progressive skat (27%/42%) af hele gevinsten på én gang. Her giver tidlig realisering ingen fordel.`;
    }
}

bindSliderAndNumber('startCash2', 'startCash2Number', update2);
bindSliderAndNumber('monthlyAmount2', 'monthlyAmount2Number', update2);
bindSliderAndNumber('years2', 'years2Number', update2);
bindSliderAndNumber('yearlyReturn2', 'yearlyReturn2Number', update2);
bindSliderAndNumber('inflation2', 'inflation2Number', update2);
showReal2Input.addEventListener('input', update2);

update2();

