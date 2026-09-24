/**
 * @file Gældsafvikling: brugerens lån, et ekstra månedligt afdrag, og en
 * sammenligning af lavine (højeste rente først), snebold (mindste lån først)
 * og kun minimumsydelser. Lånene gemmes i localStorage under 'debtPayoffData'.
 * Beregningen ligger i calc.js (simulateDebtPayoff).
 */

// Eksemplet er valgt, så forskellen på lavine og snebold er tydelig: det dyreste
// lån er også det største, og de mindste lån har lav eller ingen rente.
const DEFAULT_DEBTS = [
    {name:'Kreditkort', balance:60000, rate:24, minPayment:1500},
    {name:'Afbetaling (mobil)', balance:4000, rate:0, minPayment:400},
    {name:'SU-lån', balance:10000, rate:4, minPayment:300},
    {name:'Billån', balance:40000, rate:7, minPayment:1000}
];

/** @returns {{debts:{name:string, balance:number, rate:number, minPayment:number}[], extra:number}} rente i procent */
function loadDebtData(){
    try{
        const saved = JSON.parse(localStorage.getItem('debtPayoffData') || 'null');
        if(saved && Array.isArray(saved.debts)) return saved;
    } catch(e){ /* brug standard */ }
    return {debts: DEFAULT_DEBTS.map(d => ({...d})), extra: 1000};
}

function saveDebtData(data){
    localStorage.setItem('debtPayoffData', JSON.stringify(data));
    markSaved('debtSaveStatus');
}

const debtChart = new Chart(document.getElementById('debtChart').getContext('2d'), {
    type:'line',
    data:{labels:[], datasets:[
        // Lavine tegnes bredere, så den stadig kan ses, hvis snebold ligger oven i den.
        {label:'Lavine', data:[], borderColor:CHART_COLOR('--akt'), backgroundColor:CHART_COLOR('--akt'), themeVar:'--akt', tension:0.1, pointRadius:0, borderWidth:5},
        {label:'Snebold', data:[], borderColor:CHART_COLOR('--ask'), backgroundColor:CHART_COLOR('--ask'), themeVar:'--ask', tension:0.1, pointRadius:0, borderWidth:2.5},
        {label:'Kun minimumsydelser', data:[], borderColor:CHART_COLOR('--neutral-series'), backgroundColor:CHART_COLOR('--neutral-series'), themeVar:'--neutral-series', tension:0.1, pointRadius:0, borderWidth:2, borderDash:[4,4]}
    ]},
    options: lineChartOptions(c => `${c.dataset.label}: ${DK.format(c.raw)} kr. ${debtChartView === 'interest' ? 'i rente betalt' : 'tilbage'}`)
});

// Grafen kan vise gælden tilbage eller renten betalt i alt. Forskellen på lavine
// og snebold er kun renten, så den ses tydeligst i "Rente betalt".
let debtChartView = 'balance';

function setDebtChartView(view){
    debtChartView = view;
    document.querySelectorAll('#debtViewToggle button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    updateDebtPayoff();
}
debtChart.options.scales.x.title = {display:true, text:'År', color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-sans'), size:12}};
debtChart.options.scales.x.ticks.callback = function(value){
    const month = this.getLabelForValue(value);
    return month % 12 === 0 ? month / 12 : '';
};
debtChart.options.scales.x.ticks.autoSkip = false;
debtChart.options.scales.x.ticks.maxRotation = 0;
debtChart.options.plugins.tooltip.callbacks.title = items => formatDuration(Number(items[0].label));

/** Tegner lånelisten ud fra de gemte data. */
function renderDebtRows(){
    const {debts} = loadDebtData();
    const rows = document.getElementById('debtRows');
    const field = (i, key, label, attrs, isText) => el('label', {className:'debt-field'}, [
        el('span', {className:'debt-field-label', textContent: label}),
        el('input', {type: isText ? 'text' : 'number', className:'number-input', value: debts[i][key],
            ...attrs, oninput: e => editDebt(i, key, isText ? e.target.value : parseFloat(e.target.value) || 0)})
    ]);
    rows.replaceChildren(...(debts.length ? debts.map((d, i) => el('div', {className:'debt-row'}, [
        el('div', {className:'debt-row-head'}, [
            el('input', {type:'text', className:'debt-name', value:d.name, placeholder:'Navn på lånet',
                attrs:{'aria-label':'Navn på lånet'}, oninput: e => editDebt(i, 'name', e.target.value)}),
            el('button', {className:'icon-remove', type:'button', textContent:'✕', attrs:{'aria-label':`Slet ${d.name || 'lånet'}`}, onclick: () => removeDebt(i)})
        ]),
        el('div', {className:'debt-row-fields'}, [
            field(i, 'balance', 'Restgæld (kr.)', {min:0, step:1000}),
            field(i, 'rate', 'Rente (% p.a.)', {min:0, step:0.1}),
            field(i, 'minPayment', 'Min. ydelse (kr./md.)', {min:0, step:100})
        ])
    ])) : [el('p', {className:'empty-note', textContent:'Ingen lån endnu – tilføj dit første herunder.'})]));
}

function editDebt(index, key, value){
    const data = loadDebtData();
    data.debts[index][key] = value;
    saveDebtData(data);
    updateDebtPayoff();
}

/** Tilføjer et tomt lån og flytter fokus til navnet. */
function addDebt(){
    const data = loadDebtData();
    data.debts.push({name:'', balance:0, rate:0, minPayment:0});
    saveDebtData(data);
    renderDebtRows();
    updateDebtPayoff();
    document.querySelector('#debtRows .debt-row:last-child .debt-name')?.focus();
}

/** Sletter et lån - med fortryd. */
function removeDebt(index){
    const data = loadDebtData();
    const [removed] = data.debts.splice(index, 1);
    saveDebtData(data);
    renderDebtRows();
    updateDebtPayoff();
    notify(`"${removed.name || 'Lånet'}" er slettet.`, {actionLabel:'Fortryd', onAction: () => {
        const again = loadDebtData();
        again.debts.splice(index, 0, removed);
        saveDebtData(again);
        renderDebtRows();
        updateDebtPayoff();
    }});
}

/** Én-to sætninger om forskellen på lavine og snebold for netop disse lån. */
function strategyComparisonText(debts, results){
    const c = compareDebtStrategies(results.avalanche, results.snowball);
    if(!c) return '';
    if(debts.length === 1) return 'Med ét lån er lavine og snebold det samme.';
    if(c.identical) return 'Med dine lån giver lavine og snebold præcis det samme, fordi de betaler lånene i samme rækkefølge: det lån med den højeste rente er også det mindste. Derfor ligger de to linjer oven i hinanden.';
    const parts = [];
    if(c.interestSaved >= 1){
        parts.push(`Lavine sparer dig ${DK.format(c.interestSaved)} kr. i rente` + (c.monthsSaved > 0 ? ` og gør dig gældfri ${formatDuration(c.monthsSaved)} før.` : '.'));
    } else if(c.interestSaved <= -1){
        parts.push(`Med dine lån er snebold faktisk billigst: den sparer ${DK.format(-c.interestSaved)} kr. i rente.`);
    } else {
        parts.push('Lavine og snebold koster næsten det samme i rente med dine lån.');
    }
    if(c.firstSnowball && c.firstAvalanche && c.firstSnowball.month < c.firstAvalanche.month){
        parts.push(`Snebold giver til gengæld den første sejr hurtigere: ${c.firstSnowball.name} er betalt ud efter ${formatDuration(c.firstSnowball.month)} mod ${formatDuration(c.firstAvalanche.month)} for det første lån med lavine.`);
    }
    parts.push('Forskellen er renten, så den ses tydeligst, når du vælger "Rente betalt" over grafen.');
    return parts.join(' ');
}

/** Genberegner de tre strategier og opdaterer graf, nøgletal og tabel. */
function updateDebtPayoff(){
    const data = loadDebtData();
    const debts = data.debts
        .map((d, i) => ({name: d.name || `Lån ${i + 1}`, balance: +d.balance || 0, rate: (+d.rate || 0) / 100, minPayment: +d.minPayment || 0}))
        .filter(d => d.balance > 0);
    const extra = data.extra;

    const results = {
        avalanche: simulateDebtPayoff(debts, extra, 'avalanche'),
        snowball: simulateDebtPayoff(debts, extra, 'snowball'),
        minimum: simulateDebtPayoff(debts, extra, 'minimum')
    };

    const longest = Math.max(...Object.values(results).map(r => r.balances.length));
    debtChart.data.labels = Array.from({length: longest}, (_, m) => m);
    const series = debtChartView === 'interest' ? 'interestPaid' : 'balances';
    debtChart.data.datasets[0].data = results.avalanche[series];
    debtChart.data.datasets[1].data = results.snowball[series];
    debtChart.data.datasets[2].data = results.minimum[series];
    debtChart.update();

    const describe = (idValue, idSub, r) => {
        document.getElementById(idValue).textContent = !debts.length ? '–' : r.feasible ? formatDuration(r.months) : 'Aldrig';
        document.getElementById(idSub).textContent = !debts.length ? '' : r.feasible
            ? `${monthsFromNow(r.months)} · ${DK.format(r.totalInterest)} kr. i rente`
            : `ikke betalt ud inden for ${DEBT_MAX_MONTHS / 12} år`;
    };
    describe('debtFreeAvalanche', 'debtFreeAvalancheSub', results.avalanche);
    describe('debtFreeSnowball', 'debtFreeSnowballSub', results.snowball);
    describe('debtFreeMinimum', 'debtFreeMinimumSub', results.minimum);

    document.getElementById('debtCompare').textContent = debts.length ? strategyComparisonText(debts, results) : '';

    const saved = results.minimum.feasible && results.avalanche.feasible
        ? results.minimum.totalInterest - results.avalanche.totalInterest : null;
    document.getElementById('debtSaved').textContent = saved === null ? '–' : DK.format(saved) + ' kr.';

    const payoffCell = (r, index) => {
        const hit = r.payoff.find(p => p.index === index);
        return el('td', {textContent: hit ? `${formatDuration(hit.month)} (${monthsFromNow(hit.month)})` : '–'});
    };
    document.getElementById('debtTableBody').replaceChildren(...debts.map((d, i) => el('tr', {}, [
        el('td', {textContent: d.name}),
        payoffCell(results.avalanche, i),
        payoffCell(results.snowball, i),
        payoffCell(results.minimum, i)
    ])));

    // Lån, hvor minimumsydelsen ikke engang dækker renten, bliver aldrig betalt ud af sig selv.
    const underwater = debts.filter(d => d.minPayment <= d.balance * d.rate / 12);
    const warning = document.getElementById('debtWarning');
    warning.hidden = !underwater.length && results.avalanche.feasible;
    warning.textContent = !results.avalanche.feasible
        ? 'Ydelserne dækker ikke renterne – gælden vokser. Hæv minimumsydelserne eller det ekstra afdrag.'
        : underwater.length
            ? `Minimumsydelsen på ${underwater.map(d => d.name).join(', ')} dækker ikke renten. Lånet bliver kun betalt ud takket være det ekstra afdrag.`
            : '';
}

document.getElementById('debtExtra').value = loadDebtData().extra;
document.getElementById('debtExtra').addEventListener('input', e => {
    const data = loadDebtData();
    data.extra = parseFloat(e.target.value) || 0;
    saveDebtData(data);
    updateDebtPayoff();
});
renderDebtRows();
updateDebtPayoff();
