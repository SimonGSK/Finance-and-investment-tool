/**
 * @file Køb eller leje? Sammenligner formuen ved at købe med formuen ved at
 * leje og investere forskellen, år for år. Beregningen ligger i calc.js
 * (simulateBuyVsRent).
 */

const buyRentChart = new Chart(document.getElementById('buyRentChart').getContext('2d'), {
    type:'line',
    data:{labels:[], datasets:[
        {label:'Formue ved køb', data:[], borderColor:CHART_COLOR('--akt'), backgroundColor:CHART_COLOR('--akt'), themeVar:'--akt', tension:0.15, pointRadius:0, borderWidth:2.5},
        {label:'Formue ved leje', data:[], borderColor:CHART_COLOR('--ask'), backgroundColor:CHART_COLOR('--ask'), themeVar:'--ask', tension:0.15, pointRadius:0, borderWidth:2.5}
    ]},
    options: lineChartOptions(c => `${c.dataset.label}: ${DK.format(c.raw)} kr.`)
});
buyRentChart.options.scales.x.title = {display:true, text:'År', color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-sans'), size:12}};

/** Genberegner alt ud fra formularen. Kaldes ved hvert input. */
function updateBuyVsRent(){
    const price = readNumber('brPrice');
    const downPayment = readNumber('brDown');
    const years = Math.min(40, Math.max(1, Math.round(readNumber('brYears', 15))));
    const r = simulateBuyVsRent({
        price, downPayment,
        realkreditRate: readPercent('brRkRate'), bidragssats: readPercent('brBidrag'), realkreditYears: readNumber('brRkYears', 30),
        bankRate: readPercent('brBankRate'), bankYears: readNumber('brBankYears', 20),
        propertyTaxYearly: readNumber('brPropertyTax'), maintenancePct: readPercent('brMaintenance'),
        ownerCostsMonthly: readNumber('brOwnerCosts'), priceGrowth: readPercent('brPriceGrowth'),
        otherBuyCosts: readNumber('brOtherCosts'), sellCostsPct: readPercent('brSellCosts'),
        rentMonthly: readNumber('brRent'), rentGrowth: readPercent('brRentGrowth'), depositMonths: readNumber('brDeposit', 3),
        investReturn: readPercent('brReturn'), adults: readNumber('brAdults', 2), years
    });

    const downHint = document.getElementById('brDownHint');
    const downShare = price > 0 ? downPayment / price : 0;
    downHint.textContent = downShare < MIN_UDBETALING
        ? `Under 5 % – du skal mindst betale ${DK.format(price * MIN_UDBETALING)} kr. i udbetaling`
        : `${formatPct(downShare)} af prisen · plus ${DK.format(r.costs.total)} kr. i købsomkostninger`;
    downHint.classList.toggle('hint-warning', downShare < MIN_UDBETALING);

    buyRentChart.data.labels = r.series.map(s => s.year);
    buyRentChart.data.datasets[0].data = r.series.map(s => s.buyer);
    buyRentChart.data.datasets[1].data = r.series.map(s => s.renter);
    buyRentChart.update();

    const diff = r.final.buyer - r.final.renter;
    const winner = document.getElementById('brWinner');
    document.getElementById('brWinnerLabel').textContent = `Bedst efter ${years} år`;
    winner.textContent = Math.abs(diff) < 1000 ? 'Lige godt' : diff > 0 ? 'Køb' : 'Leje';
    winner.className = 'value ' + (diff > 0 ? 'akt' : 'ask');
    document.getElementById('brWinnerSub').textContent = `${DK.format(Math.abs(diff))} kr. mere i formue`;

    const breakEvenEl = document.getElementById('brBreakEven');
    const breakEvenSub = document.getElementById('brBreakEvenSub');
    if(r.breakEvenYear !== null){
        breakEvenEl.textContent = r.breakEvenYear + ' år';
        breakEvenSub.textContent = 'første år, hvor køb giver mindst lige så stor formue';
    } else {
        breakEvenEl.textContent = `Over ${years} år`;
        breakEvenSub.textContent = 'leje er bedre i hele perioden';
    }
    document.getElementById('brBuyMonthly').textContent = DK.format(r.firstYearBuyerMonthly) + ' kr.';
    document.getElementById('brRentMonthly').textContent = DK.format(r.firstYearRentMonthly) + ' kr.';

    document.getElementById('brTableBody').replaceChildren(...r.series.map(s => {
        const d = s.buyer - s.renter;
        return el('tr', {}, [
            el('td', {textContent: s.year}),
            el('td', {textContent: DK.format(s.homeValue) + ' kr.'}),
            el('td', {textContent: DK.format(s.debt) + ' kr.'}),
            el('td', {textContent: DK.format(s.buyer) + ' kr.'}),
            el('td', {textContent: DK.format(s.renter) + ' kr.'}),
            el('td', {className: d >= 0 ? 'is-positive' : 'is-negative', textContent: (d >= 0 ? '+' : '−') + DK.format(Math.abs(d)) + ' kr.'})
        ]);
    }));
}

document.getElementById('housing2').addEventListener('input', updateBuyVsRent);
updateBuyVsRent();
