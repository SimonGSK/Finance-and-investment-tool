const BUDGET_CATEGORIES = [
    {id:'catBolig', label:'Bolig (husleje/lån)', color:'#45C4B0'},
    {id:'catMad', label:'Mad & dagligvarer', color:'#E3A548'},
    {id:'catTransport', label:'Transport', color:'#E85C4A'},
    {id:'catForsikring', label:'Forsikringer og fagforening', color:'#6C8EBF'},
    {id:'catForbrug', label:'El, vand og varme', color:'#9B7EDE'},
    {id:'catTelefoni', label:'Telefoni og internet', color:'#4F86C6'},
    {id:'catFritid', label:'Fritid & underholdning', color:'#55C57A'},
    {id:'catOpsparing', label:'Opsparing', color:'#D9A5C0'},
    {id:'catAndet', label:'Andet', color:'#8B96A3'}
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

function saveBudgetToStorage(){
    const data = { budgetMode, budgetTotalInput: document.getElementById('budgetTotalInput').value };
    localStorage.setItem('budgetData', JSON.stringify(data));
}

function loadBudgetFromStorage(){
    const raw = localStorage.getItem('budgetData');
    if(!raw) return;
    try{
        const data = JSON.parse(raw);
        if(data.budgetTotalInput !== undefined) document.getElementById('budgetTotalInput').value = data.budgetTotalInput;
        if(data.budgetMode) budgetMode = data.budgetMode;
    } catch(e){
        // Korrupt eller ugyldig data i localStorage - ignorér, og start forfra
    }
}

// ---- Itemiserede budgetposter (label + beløb) pr. kategori ----

function loadBudgetItems(){
    return JSON.parse(localStorage.getItem('budgetItems') || '{}');
}

function saveBudgetItems(items){
    localStorage.setItem('budgetItems', JSON.stringify(items));
}

function categoryTotal(items, catId){
    return (items[catId] || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
}

function addBudgetItem(catId){
    const items = loadBudgetItems();
    if(!items[catId]) items[catId] = [];
    items[catId].push({label:'', amount:0});
    saveBudgetItems(items);
    renderBudgetCategory(catId);
    updateBudget();
}

function removeBudgetItem(catId, index){
    const items = loadBudgetItems();
    items[catId].splice(index, 1);
    saveBudgetItems(items);
    renderBudgetCategory(catId);
    updateBudget();
}

function updateBudgetItemLabel(catId, index, value){
    const items = loadBudgetItems();
    items[catId][index].label = value;
    saveBudgetItems(items);
}

function updateBudgetItemAmount(catId, index, value){
    const items = loadBudgetItems();
    items[catId][index].amount = parseFloat(value) || 0;
    saveBudgetItems(items);
    document.getElementById('total-' + catId).textContent = DK.format(categoryTotal(items, catId)) + ' kr.';
    updateBudget();
}

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

function renderAllBudgetCategories(){
    BUDGET_CATEGORIES.forEach(cat => renderBudgetCategory(cat.id));
}

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