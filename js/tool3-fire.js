/**
 * @file Værktøj 3: FIRE-beregner efter 4%-reglen. FIRE-målet vokser med
 * inflationen år for år, så "år til FIRE" er i reelle termer.
 */

const ctx3 = document.getElementById('chart3').getContext('2d');
let chart3 = new Chart(ctx3, {
    type:'line',
    data:{labels:[], datasets:[
            {label:'Formue', data:[], borderColor:CHART_COLOR('--akt'), backgroundColor:CHART_COLOR('--akt'), themeVar:'--akt', tension:0.15, pointRadius:0, borderWidth:2.5},
            {label:'FIRE-mål', data:[], borderColor:CHART_COLOR('--neutral-series'), backgroundColor:CHART_COLOR('--neutral-series'), themeVar:'--neutral-series', tension:0.15, pointRadius:0, borderWidth:2, borderDash:[4,4]}
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

const expenses3Input = document.getElementById('expenses3Number');
const startCash3Input = document.getElementById('startCash3Number');
const monthlyAmount3Input = document.getElementById('monthlyAmount3Number');
const return3Input = document.getElementById('yearlyReturn3Number');
const inflation3Input = document.getElementById('inflation3Number');
const showReal3Input = document.getElementById('showRealValue3');

const FIRE_MAX_YEARS = 60;
const FIRE_WITHDRAWAL_RATE = 4; // 4%-reglen - fast, ikke justerbar

/**
 * Genberegner alt ud fra formularens aktuelle værdier. Kaldes ved hvert input.
 */
function update3(){
    const expenses = parseInt(expenses3Input.value);
    const startCash = parseInt(startCash3Input.value);
    const monthlyAmount = parseInt(monthlyAmount3Input.value);
    const returnPercent = parseFloat(return3Input.value);
    const yearlyReturn = 1 + returnPercent/100;
    const inflationPercent3 = parseFloat(inflation3Input.value);
    const inflationFactor3 = 1 + inflationPercent3/100;
    const showReal3 = showReal3Input.checked;

    document.getElementById('inflationNote3').style.display = showReal3 ? 'block' : 'none';

    // Dit FIRE-beløb, udtrykt i dagens købekraft - det er jo netop det, "expenses" allerede er.
    const fireNumberBase = expenses / (FIRE_WITHDRAWAL_RATE/100);

    const portfolioNominal = computeFireSeries(startCash, monthlyAmount, yearlyReturn, FIRE_MAX_YEARS);
    // FIRE-målet vokser år for år med inflationen, i nominelle kroner.
    const fireTargetNominal = portfolioNominal.map(p => fireNumberBase * Math.pow(inflationFactor3, p.year));

    // Find det første år, hvor formuen (nominelt) når det (nominelt voksende) mål.
    let yearsToFire = null;
    for(let i=0;i<portfolioNominal.length;i++){
        if(portfolioNominal[i].value >= fireTargetNominal[i]){ yearsToFire = i; break; }
    }

    // Hvor langt skal grafen vise? Lidt luft efter målet er nået, ellers hele horisonten.
    const chartEndYear = yearsToFire !== null ? Math.min(yearsToFire + 5, FIRE_MAX_YEARS) : FIRE_MAX_YEARS;
    const portfolioTrimmed = portfolioNominal.slice(0, chartEndYear+1);
    const targetTrimmed = fireTargetNominal.slice(0, chartEndYear+1);

    const portfolioDisplay = showReal3
        ? portfolioTrimmed.map(p => toRealValue(p.value, p.year, inflationFactor3))
        : portfolioTrimmed.map(p => p.value);
    const targetDisplay = showReal3
        ? targetTrimmed.map((v,i) => toRealValue(v, i, inflationFactor3))
        : targetTrimmed;

    chart3.data.labels = portfolioTrimmed.map(p => p.year);
    chart3.data.datasets[0].data = portfolioDisplay;
    chart3.data.datasets[1].data = targetDisplay;
    chart3.update();

    const tableBody3 = document.getElementById('dataTableBody3');
    tableBody3.innerHTML = portfolioTrimmed.map((p, i) => `<tr>
            <td>${p.year}</td>
            <td>${DK.format(portfolioDisplay[i])} kr.</td>
            <td>${DK.format(targetDisplay[i])} kr.</td>
        </tr>`).join('');

    if(yearsToFire !== null){
        document.getElementById('yearsToFire3').textContent = yearsToFire + ' år';
        document.getElementById('yearsToFireSub3').textContent = '';

        // Formue ved FIRE: det nominelle (fremtidige) beløb, I faktisk vil have på det tidspunkt.
        const valueAtFireNominal = portfolioNominal[yearsToFire].value;
        const valueAtFireReal = toRealValue(valueAtFireNominal, yearsToFire, inflationFactor3);
        document.getElementById('valueAtFire3').textContent = DK.format(valueAtFireNominal) + ' kr.';
        document.getElementById('valueAtFireSub3').textContent = 'svarer til ' + DK.format(valueAtFireReal) + ' kr. i dagens købekraft';

        // Årligt forbrug ved FIRE: hvad de 300.000 kr. (i dagens penge) rent faktisk
        // koster i nominelle kroner det år, I når FIRE.
        const consumptionAtFireNominal = expenses * Math.pow(inflationFactor3, yearsToFire);
        document.getElementById('consumptionAtFire3').textContent = DK.format(consumptionAtFireNominal) + ' kr./år';
        document.getElementById('consumptionAtFireSub3').textContent = 'svarer til ' + DK.format(expenses) + ' kr./år i dagens købekraft';
    } else {
        document.getElementById('yearsToFire3').textContent = FIRE_MAX_YEARS + '+ år';
        document.getElementById('yearsToFireSub3').textContent = 'Ikke nået inden for ' + FIRE_MAX_YEARS + ' år med disse tal';
        document.getElementById('valueAtFire3').textContent = '–';
        document.getElementById('valueAtFireSub3').textContent = '';
        document.getElementById('consumptionAtFire3').textContent = '–';
        document.getElementById('consumptionAtFireSub3').textContent = '';
    }
}

bindSliderAndNumber('expenses3', 'expenses3Number', update3);
bindSliderAndNumber('startCash3', 'startCash3Number', update3);
bindSliderAndNumber('monthlyAmount3', 'monthlyAmount3Number', update3);
bindSliderAndNumber('yearlyReturn3', 'yearlyReturn3Number', update3);
bindSliderAndNumber('inflation3', 'inflation3Number', update3);
showReal3Input.addEventListener('input', update3);

update3();
// ---- Hent mine tal fra Formue og Budget ----

/** Tallene, FIRE-beregneren kan hente: formuen (felter eller seneste øjebliksbillede) og budgettet. */
function fireImportSources(){
    const figures = currentNetWorthFigures();
    const {sum, groupSums} = budgetSummary(getBudgetCategories(), loadBudgetItems());
    return {figures, expensesMonthly: sum - groupSums.opsparing, savingsMonthly: groupSums.opsparing};
}

/** Knappen vises kun, når Formue eller Budget har tal. */
function updateFireImportButton(){
    const {figures, expensesMonthly, savingsMonthly} = fireImportSources();
    document.getElementById('fireImportBtn').hidden = !(figures.assets > 0 || expensesMonthly > 0 || savingsMonthly > 0);
}

/**
 * Viser tallene fra Formue og Budget, lader brugeren vælge, hvad der tæller
 * som opsparing til FIRE, og sætter dem ind - med fortryd.
 */
function openFireImport(){
    const {figures, expensesMonthly, savingsMonthly} = fireImportSources();
    // Pension og friværdi kan sjældent bruges før pensionsalderen, så de er fravalgt fra start.
    const assetRows = NET_WORTH_CATEGORIES.filter(cat => figures[cat.id] > 0).map(cat => ({
        cat, box: el('input', {type:'checkbox', checked: cat.liquid})
    }));
    const expensesBox = el('input', {type:'checkbox', checked: expensesMonthly > 0, disabled: !(expensesMonthly > 0)});
    const savingsBox = el('input', {type:'checkbox', checked: savingsMonthly > 0, disabled: !(savingsMonthly > 0)});
    const total = el('strong');
    const refresh = () => {
        const sum = assetRows.reduce((s, r) => s + (r.box.checked ? figures[r.cat.id] : 0), 0);
        total.textContent = DK.format(sum) + ' kr.';
    };
    [...assetRows.map(r => r.box)].forEach(b => b.addEventListener('change', refresh));
    refresh();

    const row = (box, label, amount) => el('label', {className:'toggle-row import-row'}, [
        box, el('span', {className:'toggle-text'}, [label]), el('span', {className:'import-amount', textContent: amount})
    ]);
    const source = figures.fromSnapshot
        ? `Fra dit seneste øjebliksbillede (${formatDanishDate(figures.date)}).`
        : 'Fra felterne i Formue.';

    const content = el('div', {}, [
        el('div', {className:'eyebrow', textContent:'Nuværende opsparing'}),
        assetRows.length
            ? el('div', {}, [
                el('p', {className:'dialog-hint', textContent:`${source} Vælg det, du kan bruge, før du går på pension – pension og friværdi er derfor fravalgt.`}),
                ...assetRows.map(r => row(r.box, r.cat.label, DK.format(figures[r.cat.id]) + ' kr.')),
                el('p', {className:'import-total'}, ['I alt: ', total])
            ])
            : el('p', {className:'dialog-hint', textContent:'Der er ingen aktiver i Formue endnu.'}),
        el('div', {className:'eyebrow', textContent:'Fra budgettet', attrs:{style:'margin-top:18px'}}),
        row(expensesBox, 'Årligt forbrug (udgifter uden opsparing × 12)', expensesMonthly > 0 ? DK.format(expensesMonthly * 12) + ' kr.' : 'intet budget'),
        row(savingsBox, 'Månedlig investering (opsparingsposterne)', savingsMonthly > 0 ? DK.format(savingsMonthly) + ' kr.' : 'ingen opsparing')
    ]);

    openDialog({
        title:'Hent mine tal',
        content,
        actions:[
            {label:'Annullér', variant:'secondary'},
            {label:'Brug tallene', variant:'primary', onClick: () => {
                const changes = [];
                if(assetRows.length) changes.push(['startCash3Number', assetRows.reduce((s, r) => s + (r.box.checked ? figures[r.cat.id] : 0), 0)]);
                if(expensesBox.checked) changes.push(['expenses3Number', Math.round(expensesMonthly * 12)]);
                if(savingsBox.checked) changes.push(['monthlyAmount3Number', Math.round(savingsMonthly)]);
                const previous = changes.map(([id]) => [id, document.getElementById(id).value]);
                const apply = list => list.forEach(([id, v]) => {
                    const input = document.getElementById(id);
                    input.value = v;
                    input.dispatchEvent(new Event('input', {bubbles:true}));
                });
                apply(changes);
                notify('Dine tal er hentet ind i FIRE-beregneren.', {actionLabel:'Fortryd', onAction: () => apply(previous)});
            }}
        ]
    });
}
