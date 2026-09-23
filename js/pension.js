/**
 * @file Pension: opsparing frem til pensionsalderen og den månedlige
 * udbetaling bagefter, efter omkostninger og PAL-skat. Beregningen ligger i
 * calc.js (simulatePension, folkepensionAge).
 */

const pensionChart = new Chart(document.getElementById('pensionChart').getContext('2d'), {
    type:'line',
    data:{labels:[], datasets:[
        {label:'Pensionsopsparing', data:[], borderColor:CHART_COLOR('--akt'), backgroundColor:CHART_COLOR('--akt'), themeVar:'--akt', tension:0.15, pointRadius:0, borderWidth:2.5},
        {label:'I dagens købekraft', data:[], borderColor:CHART_COLOR('--neutral-series'), backgroundColor:CHART_COLOR('--neutral-series'), themeVar:'--neutral-series', tension:0.15, pointRadius:0, borderWidth:2, borderDash:[4,4]}
    ]},
    options: lineChartOptions(c => `${c.dataset.label}: ${DK.format(c.raw)} kr.`)
});
pensionChart.options.scales.x.title = {display:true, text:'Alder', color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-sans'), size:12}};

let lastSuggestedRetirementAge = null;

/**
 * Viser folkepensionsalderen for fødselsåret og foreslår den som pensionsalder,
 * så længe brugeren ikke selv har ændret feltet.
 */
function updateFolkepensionHint(){
    const birthYear = readNumber('penBirthYear', 1995);
    const {age, legislated} = folkepensionAge(birthYear);
    const ageText = String(age).replace('.', ',');
    document.getElementById('penFolkepensionHint').textContent = legislated
        ? `Din folkepensionsalder er ${ageText} år (vedtaget)`
        : `Din folkepensionsalder er forventet ${ageText} år (skøn – ikke vedtaget endnu)`;
    const retirementInput = document.getElementById('penRetirementAge');
    if(lastSuggestedRetirementAge === null || readNumber('penRetirementAge') === lastSuggestedRetirementAge){
        retirementInput.value = Math.ceil(age);
        lastSuggestedRetirementAge = Math.ceil(age);
    }
}

/** Genberegner alt ud fra formularen. Kaldes ved hvert input. */
function updatePension(){
    const birthYear = readNumber('penBirthYear', 1995);
    const currentAge = Math.max(18, new Date().getFullYear() - birthYear);
    const retirementAge = Math.max(currentAge, readNumber('penRetirementAge', 67));
    const r = simulatePension({
        currentAge, retirementAge,
        currentSavings: readNumber('penSavings'),
        monthlyContribution: readNumber('penMonthly'),
        annualReturn: readPercent('penReturn'),
        annualCosts: readPercent('penCosts'),
        inflation: readPercent('penInflation'),
        payoutYears: Math.max(1, readNumber('penPayoutYears', 20)),
        payoutTaxRate: Math.min(1, Math.max(0, readPercent('penPayoutTax')))
    });

    pensionChart.data.labels = r.series.map(p => Math.round(p.age));
    pensionChart.data.datasets[0].data = r.series.map(p => p.balance);
    pensionChart.data.datasets[1].data = r.series.map(p => p.balanceReal);
    pensionChart.update();

    const years = retirementAge - currentAge;
    document.getElementById('penAtRetirement').textContent = DK.format(r.balanceAtRetirement) + ' kr.';
    document.getElementById('penAtRetirementReal').textContent = `svarer til ${DK.format(r.balanceAtRetirementReal)} kr. i dag`;
    document.getElementById('penPayoutNetReal').textContent = DK.format(r.monthlyPayoutNetReal) + ' kr.';
    document.getElementById('penPayoutNetSub').textContent =
        `i dagens penge · ${DK.format(r.monthlyPayoutNet)} kr. i fremtidens kroner, før skat ${DK.format(r.monthlyPayoutGross)} kr.`;
    document.getElementById('penTotalContrib').textContent = DK.format(r.totalContributions) + ' kr.';
    document.getElementById('penYearsLeft').textContent = years > 0 ? `over ${years} år, fra du er ${currentAge}` : 'du er allerede på pension';
    const netReturnEl = document.getElementById('penNetReturn');
    netReturnEl.textContent = formatPct(r.netAnnualReturn);
    netReturnEl.classList.toggle('negative', r.netAnnualReturn < 0);
}

document.getElementById('penBirthYear').addEventListener('input', updateFolkepensionHint);
document.getElementById('tool5').addEventListener('input', updatePension);
updateFolkepensionHint();
updatePension();
