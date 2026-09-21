/**
 * @file Budget: itemiserede poster pr. kategori, 50/30/20-fordeling, årlig
 * opsparing og en doughnut over fordelingen. Posterne gemmes i localStorage
 * under 'budgetItems', det samlede beløb under 'budgetData'.
 */

const BUDGET_CATEGORIES = [
    {id:'catBolig', label:'Bolig (husleje/lån)', color:'#5FA894'},
    {id:'catMad', label:'Mad & dagligvarer', color:'#C9973F'},
    {id:'catTransport', label:'Transport', color:'#C96A54'},
    {id:'catForsikring', label:'Forsikringer og fagforening', color:'#6E8FB8'},
    {id:'catForbrug', label:'El, vand og varme', color:'#8E7BB5'},
    {id:'catTelefoni', label:'Telefoni og internet', color:'#4E8FA8'},
    {id:'catFritid', label:'Fritid & underholdning', color:'#7FA65C'},
    {id:'catOpsparing', label:'Opsparing', color:'#C08CA8'},
    {id:'catAndet', label:'Andet', color:'#8A93A6'}
];

const BUDGET_RULE_GROUPS = {
    catBolig:'behov', catMad:'behov', catTransport:'behov',
    catForsikring:'behov', catForbrug:'behov', catTelefoni:'behov',
    catFritid:'onsker', catAndet:'onsker',
    catOpsparing:'opsparing'
};

const budgetCtx = document.getElementById('budgetChart').getContext('2d');
let budgetChart = new Chart(budgetCtx, {
    type:'doughnut',
    data:{
        labels: BUDGET_CATEGORIES.map(c => c.label),
        datasets:[{
            data: BUDGET_CATEGORIES.map(() => 0),
            backgroundColor: BUDGET_CATEGORIES.map(c => c.color),
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
 * Gemmer det indtastede samlede beløb.
 */
function saveBudgetToStorage(){
    const data = { budgetTotalInput: document.getElementById('budgetTotalInput').value };
    localStorage.setItem('budgetData', JSON.stringify(data));
}

/**
 * Genindlæser det samlede beløb. Ugyldige gemte data ignoreres.
 */
function loadBudgetFromStorage(){
    const raw = localStorage.getItem('budgetData');
    if(!raw) return;
    try{
        const data = JSON.parse(raw);
        if(data.budgetTotalInput !== undefined) document.getElementById('budgetTotalInput').value = data.budgetTotalInput;
    } catch(e){
        // Korrupt eller ugyldig data i localStorage - ignorér, og start forfra
    }
}

// ---- Itemiserede budgetposter (label + beløb) pr. kategori ----

/**
 * @returns {Object<string, {label:string, amount:number}[]>} alle poster, nøglet på kategori-id
 */
function loadBudgetItems(){
    return JSON.parse(localStorage.getItem('budgetItems') || '{}');
}

/**
 * @param {Object<string, {label:string, amount:number}[]>} items
 */
function saveBudgetItems(items){
    localStorage.setItem('budgetItems', JSON.stringify(items));
}

/**
 * Tilføjer en tom post til en kategori og gentegner den.
 * @param {string} catId fx 'catBolig'
 */
function addBudgetItem(catId){
    const items = loadBudgetItems();
    if(!items[catId]) items[catId] = [];
    items[catId].push({label:'', amount:0});
    saveBudgetItems(items);
    renderBudgetCategory(catId);
    updateBudget();
}

/**
 * @param {string} catId
 * @param {number} index postens plads i kategorien
 */
function removeBudgetItem(catId, index){
    const items = loadBudgetItems();
    items[catId].splice(index, 1);
    saveBudgetItems(items);
    renderBudgetCategory(catId);
    updateBudget();
}

/**
 * @param {string} catId
 * @param {number} index
 * @param {string} value den nye tekst
 */
function updateBudgetItemLabel(catId, index, value){
    const items = loadBudgetItems();
    items[catId][index].label = value;
    saveBudgetItems(items);
}

/**
 * Opdaterer et beløb, kategoriens total og hele budgettet.
 * @param {string} catId
 * @param {number} index
 * @param {string} value råværdien fra inputfeltet
 */
function updateBudgetItemAmount(catId, index, value){
    const items = loadBudgetItems();
    items[catId][index].amount = parseFloat(value) || 0;
    saveBudgetItems(items);
    document.getElementById('total-' + catId).textContent = DK.format(categoryTotal(items, catId)) + ' kr.';
    updateBudget();
}

/**
 * Gentegner posterne og totalen for én kategori.
 * @param {string} catId
 */
function renderBudgetCategory(catId){
    const items = loadBudgetItems();
    const catItems = items[catId] || [];
    const container = document.getElementById('items-' + catId);
    container.innerHTML = catItems.map((item, i) => `
        <div class="budget-item-row">
            <input type="text" class="number-input" style="flex:2;" placeholder="Fx Husleje" value="${(item.label || '').replace(/"/g,'&quot;')}" oninput="updateBudgetItemLabel('${catId}',${i},this.value)">
            <input type="number" class="number-input" style="flex:1;" value="${item.amount}" oninput="updateBudgetItemAmount('${catId}',${i},this.value)">
            <button class="btn btn-secondary" style="padding:6px 10px; font-size:12px;" onclick="removeBudgetItem('${catId}',${i})">✕</button>
        </div>
    `).join('');
    document.getElementById('total-' + catId).textContent = DK.format(categoryTotal(items, catId)) + ' kr.';
}

/**
 * Gentegner alle kategorier.
 */
function renderAllBudgetCategories(){
    BUDGET_CATEGORIES.forEach(cat => renderBudgetCategory(cat.id));
}

/**
 * Genberegner sum, penge tilbage, årlig opsparing, 50/30/20-procenterne og
 * doughnut-grafen, og gemmer det samlede beløb. Kaldes ved hver ændring.
 */
function updateBudget(){
    const items = loadBudgetItems();
    const values = BUDGET_CATEGORIES.map(cat => categoryTotal(items, cat.id));
    const sum = values.reduce((a,b) => a+b, 0);

    const groupSums = {behov:0, onsker:0, opsparing:0};
    BUDGET_CATEGORIES.forEach((cat, i) => {
        groupSums[BUDGET_RULE_GROUPS[cat.id]] += values[i];
    });

    const yearlySavings = categoryTotal(items, 'catOpsparing') * 12;
    document.getElementById('budgetYearlySavings').textContent = DK.format(yearlySavings) + ' kr.';
    const behovPct = sum > 0 ? (groupSums.behov/sum)*100 : 0;
    const onskerPct = sum > 0 ? (groupSums.onsker/sum)*100 : 0;
    const opsparingPct = sum > 0 ? (groupSums.opsparing/sum)*100 : 0;

    const ruleBehovEl = document.getElementById('ruleBehov');
    ruleBehovEl.textContent = behovPct.toFixed(0) + '%';
    ruleBehovEl.classList.toggle('negative', behovPct > 50);

    const ruleOnskerEl = document.getElementById('ruleOnsker');
    ruleOnskerEl.textContent = onskerPct.toFixed(0) + '%';
    ruleOnskerEl.classList.toggle('negative', onskerPct > 30);

    const ruleOpsparingEl = document.getElementById('ruleOpsparing');
    ruleOpsparingEl.textContent = opsparingPct.toFixed(0) + '%';
    ruleOpsparingEl.classList.toggle('negative', opsparingPct < 20);

    document.getElementById('budgetSumDisplay').textContent = DK.format(sum) + ' kr.';

    const total = parseFloat(document.getElementById('budgetTotalInput').value) || 0;
    const remainingEl = document.getElementById('budgetRemaining');
    if(total > 0){
        const remaining = total - sum;
        remainingEl.textContent = DK.format(remaining) + ' kr.';
        remainingEl.classList.toggle('negative', remaining < 0);
    } else {
        remainingEl.textContent = '–';
        remainingEl.classList.remove('negative');
    }

    budgetChart.data.datasets[0].data = values;
    budgetChart.update();
    document.getElementById('budgetChartEmpty').style.display = sum > 0 ? 'none' : 'flex';
    saveBudgetToStorage();
}

/**
 * Nulstiller alle poster og det samlede beløb efter bekræftelse.
 */
function resetBudget(){
    if(!confirm('Nulstil alle budgetfelter? Det kan ikke fortrydes.')) return;
    localStorage.removeItem('budgetItems');
    document.getElementById('budgetTotalInput').value = 0;
    renderAllBudgetCategories();
    updateBudget();
}

loadBudgetFromStorage();
renderAllBudgetCategories();
document.getElementById('budgetTotalInput').addEventListener('input', updateBudget);
updateBudget();