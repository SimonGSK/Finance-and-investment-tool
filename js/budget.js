/**
 * @file Budget: kategorier grupperet efter 50/30/20-reglen, hvor posterne
 * redigeres i en dialog pr. kategori (så listen altid har samme højde), egne
 * kategorier, og en doughnut over fordelingen. Posterne gemmes i localStorage
 * under 'budgetItems', egne kategorier under 'budgetCustomCategories' og det
 * samlede beløb under 'budgetData'.
 */

const BUDGET_GROUPS = [
    {id:'behov', label:'Behov'},
    {id:'onsker', label:'Ønsker'},
    {id:'opsparing', label:'Opsparing'}
];

// Id'erne må ikke ændres - gemte poster er nøglet på dem.
const BUILTIN_BUDGET_CATEGORIES = [
    {id:'catBolig', label:'Bolig', group:'behov', color:'#5FA894', hint:'Husleje, boliglån, fællesudgifter, ejendomsskat'},
    {id:'catMad', label:'Mad & dagligvarer', group:'behov', color:'#C9973F', hint:'Supermarked, bager, husholdningsvarer'},
    {id:'catTransport', label:'Transport', group:'behov', color:'#C96A54', hint:'Bil, brændstof, rejsekort, parkering, cykel'},
    {id:'catForsikring', label:'Forsikringer, a-kasse og fagforening', group:'behov', color:'#6E8FB8', hint:'Indbo, ulykke, bil, a-kasse, fagforening'},
    {id:'catForbrug', label:'El, vand og varme', group:'behov', color:'#8E7BB5', hint:'El, vand, varme, gas, renovation'},
    {id:'catTelefoni', label:'Telefoni og internet', group:'behov', color:'#4E8FA8', hint:'Mobilabonnement, bredbånd'},
    {id:'catGaeld', label:'Gæld & afdrag', group:'behov', color:'#9E5A70', hint:'SU-lån, billån, forbrugslån, kreditkort (boliglån hører under Bolig)'},
    {id:'catBoern', label:'Børn', group:'behov', color:'#D8B85A', hint:'Institution, fritidsaktiviteter, tøj, lommepenge'},
    {id:'catSundhed', label:'Sundhed & personlig pleje', group:'behov', color:'#71B3C4', hint:'Medicin, tandlæge, briller, frisør'},
    {id:'catAbonnementer', label:'Abonnementer & streaming', group:'onsker', color:'#D9895B', hint:'Netflix, Spotify, Viaplay, apps, cloud-lagring'},
    {id:'catToej', label:'Tøj & sko', group:'onsker', color:'#A58D6F', hint:'Tøj, sko, tasker'},
    {id:'catFritid', label:'Fritid & underholdning', group:'onsker', color:'#7FA65C', hint:'Restaurant, takeaway, sport, hobby, fitness'},
    {id:'catFerie', label:'Ferie, gaver & højtider', group:'onsker', color:'#D97B8C', hint:'Rejser, jul, fødselsdage, bryllupper'},
    {id:'catAndet', label:'Andet', group:'onsker', color:'#8A93A6', hint:'Det, der ikke passer andre steder'},
    {id:'catOpsparing', label:'Opsparing', group:'opsparing', color:'#C08CA8', hint:'Opsparingskonto, investering, ekstra pension'}
];

const CUSTOM_CATEGORY_COLORS = ['#B98D5E', '#7C9BD0', '#C27BA0', '#5FA0A0', '#A8A35A', '#9B86C9', '#D1865F', '#6A9F6A'];

const BUDGET_FREQUENCIES = [
    {months:1, label:'pr. måned'},
    {months:3, label:'pr. kvartal'},
    {months:6, label:'pr. halvår'},
    {months:12, label:'pr. år'}
];

/** @returns {{id:string, label:string, group:string, color:string}[]} */
function loadCustomCategories(){
    try{ return JSON.parse(localStorage.getItem('budgetCustomCategories') || '[]'); }
    catch(e){ return []; }
}

/** @param {{id:string, label:string, group:string, color:string}[]} cats */
function saveCustomCategories(cats){
    localStorage.setItem('budgetCustomCategories', JSON.stringify(cats));
    markSaved('budgetSaveStatus');
}

/**
 * Alle kategorier - indbyggede og egne - i gruppe-rækkefølge.
 * @returns {{id:string, label:string, group:string, color:string, hint?:string, custom?:boolean}[]}
 */
function getBudgetCategories(){
    const all = BUILTIN_BUDGET_CATEGORIES.concat(loadCustomCategories().map(c => ({...c, custom:true})));
    return BUDGET_GROUPS.flatMap(g => all.filter(c => c.group === g.id));
}

/** @returns {Object<string, {label:string, amount:number, freq?:number}[]>} alle poster, nøglet på kategori-id */
function loadBudgetItems(){
    try{ return JSON.parse(localStorage.getItem('budgetItems') || '{}'); }
    catch(e){ return {}; }
}

/** @param {Object<string, {label:string, amount:number, freq?:number}[]>} items */
function saveBudgetItems(items){
    localStorage.setItem('budgetItems', JSON.stringify(items));
    markSaved('budgetSaveStatus');
}

/** Gemmer det indtastede samlede beløb. */
function saveBudgetToStorage(){
    localStorage.setItem('budgetData', JSON.stringify({ budgetTotalInput: document.getElementById('budgetTotalInput').value }));
}

/** Genindlæser det samlede beløb. Ugyldige gemte data ignoreres. */
function loadBudgetFromStorage(){
    try{
        const data = JSON.parse(localStorage.getItem('budgetData') || '{}');
        if(data.budgetTotalInput !== undefined) document.getElementById('budgetTotalInput').value = data.budgetTotalInput;
    } catch(e){
        // Korrupt eller ugyldig data i localStorage - ignorér, og start forfra
    }
}

// Den samlede månedlige sum skrives midt i doughnutten.
const budgetCenterText = {
    id:'budgetCenterText',
    afterDraw(chart){
        const sum = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
        if(sum <= 0) return;
        const {ctx, chartArea:{left, right, top, bottom}} = chart;
        const x = (left + right) / 2, y = (top + bottom) / 2;
        const size = Math.max(16, Math.min(34, Math.min(right - left, bottom - top) / 9));
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = getCSSVar('--text');
        ctx.font = `500 ${size}px ${getCSSVar('--font-mono')}`;
        ctx.fillText(DK.format(sum) + ' kr.', x, y - size * 0.35);
        ctx.fillStyle = getCSSVar('--subtle');
        ctx.font = `400 ${Math.round(size * 0.42)}px ${getCSSVar('--font-sans')}`;
        ctx.fillText('pr. måned', x, y + size * 0.6);
        ctx.restore();
    }
};

const budgetCtx = document.getElementById('budgetChart').getContext('2d');
let budgetChart = new Chart(budgetCtx, {
    type:'doughnut',
    data:{ labels:[], datasets:[{ data:[], backgroundColor:[], borderColor:CHART_COLOR('--panel'), borderWidth:2 }] },
    options:{
        responsive:true,
        maintainAspectRatio:false,
        cutout:'66%',
        plugins:{
            // Kategorilisten til venstre viser farverne, så en legend her ville være dobbelt.
            legend:{ display:false, labels:{ color:CHART_COLOR('--muted') } },
            tooltip:{
                backgroundColor:CHART_COLOR('--tooltip-bg'),
                borderColor:CHART_COLOR('--border'),
                borderWidth:1,
                titleColor:CHART_COLOR('--text'),
                bodyColor:CHART_COLOR('--text'),
                callbacks:{
                    label: c => {
                        const sum = c.dataset.data.reduce((a, b) => a + b, 0);
                        const pct = sum > 0 ? Math.round(c.raw / sum * 100) : 0;
                        return `${c.label}: ${DK.format(c.raw)} kr./md (${pct}%)`;
                    }
                }
            }
        }
    },
    plugins:[budgetCenterText]
});

/**
 * Tegner kategorilisten, grupperet i Behov/Ønsker/Opsparing. Hver række åbner
 * kategoriens dialog.
 */
function renderCategoryList(){
    const items = loadBudgetItems();
    const cats = getBudgetCategories();
    const container = document.getElementById('budgetCategoryList');
    container.replaceChildren(...BUDGET_GROUPS.flatMap(group => {
        const groupCats = cats.filter(c => c.group === group.id);
        if(!groupCats.length) return [];
        return [
            el('div', {className:'category-group-label', textContent:group.label}),
            el('div', {className:'category-list'}, groupCats.map(cat => {
                const total = categoryTotal(items, cat.id);
                const count = (items[cat.id] || []).length;
                return el('button', {
                    className:'category-row', type:'button',
                    onclick: () => openCategoryDialog(cat.id),
                    attrs:{'aria-haspopup':'dialog'}
                }, [
                    el('i', {className:'dot', attrs:{style:`background:${cat.color}`}}),
                    el('span', {className:'cat-name', textContent:cat.label}),
                    el('span', {className:'cat-count', textContent: count ? `${count} ${count === 1 ? 'post' : 'poster'}` : ''}),
                    el('span', {className:'cat-total' + (total ? '' : ' is-empty'), textContent: DK.format(total) + ' kr.'})
                ]);
            }))
        ];
    }));
}

/**
 * Åbner dialogen for én kategori: posterne kan tilføjes, rettes og slettes, og
 * alt gemmes med det samme. Egne kategorier kan desuden omdøbes, flyttes til en
 * anden gruppe eller slettes.
 * @param {string} catId
 */
function openCategoryDialog(catId){
    const cat = getBudgetCategories().find(c => c.id === catId);
    if(!cat) return;

    const rowsBox = el('div');
    const totalValue = el('strong');
    const content = el('div', {}, [
        cat.hint ? el('p', {className:'dialog-hint', textContent: 'Fx ' + cat.hint.charAt(0).toLowerCase() + cat.hint.slice(1) + '.'}) : '',
        rowsBox,
        el('button', {className:'btn btn-secondary', type:'button', textContent:'+ Tilføj post', onclick: () => {
            const items = loadBudgetItems();
            (items[catId] = items[catId] || []).push({label:'', amount:0, freq:1});
            saveBudgetItems(items);
            renderRows();
            updateBudget();
            rowsBox.querySelector('.budget-item-row:last-child input')?.focus();
        }}),
        el('div', {className:'dialog-total'}, [el('span', {textContent:'I alt pr. måned'}), totalValue])
    ]);

    function renderRows(){
        const list = loadBudgetItems()[catId] || [];
        totalValue.textContent = DK.format(categoryTotal(loadBudgetItems(), catId)) + ' kr.';
        if(!list.length){
            rowsBox.replaceChildren(el('p', {className:'empty-note', textContent:'Ingen poster endnu.'}));
            return;
        }
        rowsBox.replaceChildren(
            el('div', {className:'budget-item-head'}, [
                el('span', {textContent:'Post'}), el('span', {textContent:'Beløb (kr.)'}), el('span', {textContent:'Hvor ofte'}), el('span')
            ]),
            ...list.map((item, i) => el('div', {className:'budget-item-row'}, [
                el('input', {type:'text', className:'number-input', value:item.label || '', placeholder:'Navn på posten',
                    attrs:{'aria-label':'Navn på post'},
                    oninput: e => editItem(i, {label: e.target.value})}),
                el('input', {type:'number', className:'number-input', value:item.amount, min:0, step:100,
                    attrs:{'aria-label':'Beløb i kroner'},
                    oninput: e => editItem(i, {amount: parseFloat(e.target.value) || 0})}),
                el('select', {className:'number-input', attrs:{'aria-label':'Hvor ofte betales posten'},
                    onchange: e => editItem(i, {freq: parseInt(e.target.value)})},
                    BUDGET_FREQUENCIES.map(f => el('option', {value:f.months, textContent:f.label, selected:(item.freq || 1) === f.months}))),
                el('button', {className:'icon-remove', type:'button', textContent:'✕',
                    attrs:{'aria-label':`Slet ${item.label || 'posten'}`},
                    onclick: () => removeItem(i)})
            ]))
        );
    }

    function editItem(index, patch){
        const items = loadBudgetItems();
        Object.assign(items[catId][index], patch);
        saveBudgetItems(items);
        totalValue.textContent = DK.format(categoryTotal(items, catId)) + ' kr.';
        updateBudget();
    }

    function removeItem(index){
        const items = loadBudgetItems();
        const [removed] = items[catId].splice(index, 1);
        saveBudgetItems(items);
        renderRows();
        updateBudget();
        notify(`"${removed.label || 'Posten'}" er slettet.`, {actionLabel:'Fortryd', onAction: () => {
            const again = loadBudgetItems();
            (again[catId] = again[catId] || []).splice(index, 0, removed);
            saveBudgetItems(again);
            if(dialogHandle.dialog.isConnected) renderRows();
            updateBudget();
        }});
    }

    if(cat.custom){
        const nameInput = el('input', {type:'text', className:'number-input', value:cat.label, attrs:{'aria-label':'Kategoriens navn'},
            oninput: e => {
                const name = e.target.value.trim();
                if(!name) return;
                updateCustomCategory(catId, {label:name});
                dialogHandle.dialog.querySelector('.dialog-title').textContent = name;
            }});
        const groupSelect = groupSelectEl(cat.group, e => updateCustomCategory(catId, {group:e.target.value}));
        content.append(el('div', {className:'dialog-section'}, [
            el('div', {className:'eyebrow', textContent:'Kategori'}),
            fieldEl('Navn', nameInput),
            fieldEl('Gruppe (50/30/20)', groupSelect),
            el('button', {className:'btn btn-danger', type:'button', textContent:'Slet kategori', onclick: () => deleteCustomCategory(catId, dialogHandle)})
        ]));
    }

    renderRows();
    const dialogHandle = openDialog({
        title: cat.label,
        content,
        wide: true,
        actions: [{label:'Færdig', variant:'primary'}]
    });
}

function groupSelectEl(selected, onchange){
    return el('select', {className:'number-input', onchange},
        BUDGET_GROUPS.map(g => el('option', {value:g.id, textContent:g.label, selected:g.id === selected})));
}

function updateCustomCategory(catId, patch){
    const cats = loadCustomCategories().map(c => c.id === catId ? {...c, ...patch} : c);
    saveCustomCategories(cats);
    updateBudget();
}

/**
 * Sletter en egen kategori og dens poster efter bekræftelse - med fortryd.
 * @param {string} catId
 * @param {{close:Function}} categoryDialog dialogen, der lukkes, når kategorien er væk
 */
async function deleteCustomCategory(catId, categoryDialog){
    const cats = loadCustomCategories();
    const cat = cats.find(c => c.id === catId);
    const items = loadBudgetItems();
    const catItems = items[catId] || [];
    const monthly = categoryTotal(items, catId);
    const detail = catItems.length
        ? `Kategorien og dens ${catItems.length} ${catItems.length === 1 ? 'post' : 'poster'} (${DK.format(monthly)} kr. pr. måned) slettes.`
        : 'Kategorien er tom.';
    const ok = await confirmDialog({title:`Slet "${cat.label}"?`, message:detail, confirmLabel:'Slet kategori', danger:true});
    if(!ok) return;

    const index = cats.indexOf(cat);
    saveCustomCategories(cats.filter(c => c.id !== catId));
    delete items[catId];
    saveBudgetItems(items);
    categoryDialog.close();
    updateBudget();
    notify(`Kategorien "${cat.label}" er slettet.`, {actionLabel:'Fortryd', onAction: () => {
        const restored = loadCustomCategories();
        restored.splice(index, 0, cat);
        saveCustomCategories(restored);
        const restoredItems = loadBudgetItems();
        restoredItems[catId] = catItems;
        saveBudgetItems(restoredItems);
        updateBudget();
    }});
}

/**
 * Dialog til at oprette en egen kategori. Navnet skal være udfyldt og må ikke
 * findes i forvejen. Den nye kategori åbnes bagefter, så man kan tilføje poster.
 */
function openNewCategoryDialog(){
    const nameInput = el('input', {type:'text', className:'number-input', placeholder:'Fx Kæledyr', attrs:{'aria-describedby':'newCatError'}});
    const groupSelect = groupSelectEl('onsker');
    const error = el('div', {className:'field-error', id:'newCatError', attrs:{role:'alert'}});
    nameInput.addEventListener('input', () => { error.textContent = ''; nameInput.removeAttribute('aria-invalid'); });

    const content = el('div', {}, [
        fieldEl('Navn', nameInput, [error]),
        fieldEl('Gruppe (50/30/20)', groupSelect)
    ]);

    let createdId = null;
    const {result} = openDialog({
        title:'Ny kategori',
        content,
        actions:[
            {label:'Annullér', variant:'secondary'},
            {label:'Opret', variant:'primary', onClick: () => {
                const name = nameInput.value.trim();
                const taken = getBudgetCategories().some(c => c.label.toLowerCase() === name.toLowerCase());
                if(!name || taken){
                    error.textContent = !name ? 'Giv kategorien et navn.' : `Der findes allerede en kategori, der hedder "${name}".`;
                    nameInput.setAttribute('aria-invalid', 'true');
                    nameInput.focus();
                    return false;
                }
                const custom = loadCustomCategories();
                const used = new Set(custom.map(c => c.color));
                const color = CUSTOM_CATEGORY_COLORS.find(c => !used.has(c)) || CUSTOM_CATEGORY_COLORS[custom.length % CUSTOM_CATEGORY_COLORS.length];
                createdId = 'custom-' + Date.now().toString(36);
                saveCustomCategories(custom.concat([{id:createdId, label:name, group:groupSelect.value, color}]));
                updateBudget();
            }}
        ]
    });
    nameInput.focus();
    result.then(() => { if(createdId) openCategoryDialog(createdId); });
}

/**
 * Genberegner sum, penge tilbage, årlig opsparing, 50/30/20-procenterne,
 * kategorilisten og doughnut-grafen, og gemmer det samlede beløb.
 */
function updateBudget(){
    const cats = getBudgetCategories();
    const items = loadBudgetItems();
    const {values, sum, groupSums} = budgetSummary(cats, items);

    document.getElementById('budgetYearlySavings').textContent = DK.format(groupSums.opsparing * 12) + ' kr.';
    const pct = key => sum > 0 ? (groupSums[key] / sum) * 100 : 0;
    [['ruleBehov', 'behov', p => p > 50], ['ruleOnsker', 'onsker', p => p > 30], ['ruleOpsparing', 'opsparing', p => p < 20]]
        .forEach(([id, key, isOff]) => {
            const node = document.getElementById(id);
            node.textContent = pct(key).toFixed(0) + '%';
            node.classList.toggle('negative', sum > 0 && isOff(pct(key)));
            document.getElementById(id + 'Sum').textContent = `${DK.format(groupSums[key])} kr. pr. måned`;
        });

    document.getElementById('budgetSumDisplay').textContent = DK.format(sum) + ' kr.';
    const total = parseFloat(document.getElementById('budgetTotalInput').value) || 0;
    const remainingEl = document.getElementById('budgetRemaining');
    if(total > 0){
        remainingEl.textContent = DK.format(total - sum) + ' kr.';
        remainingEl.classList.toggle('negative', total - sum < 0);
    } else {
        remainingEl.textContent = '–';
        remainingEl.classList.remove('negative');
    }

    budgetChart.data.labels = cats.map(c => c.label);
    budgetChart.data.datasets[0].data = values;
    budgetChart.data.datasets[0].backgroundColor = cats.map(c => c.color);
    budgetChart.update();
    document.getElementById('budgetChartEmpty').style.display = sum > 0 ? 'none' : 'flex';

    renderCategoryList();
    saveBudgetToStorage();
    // Formue-sektionens nødopsparing bygger på budgettet (net-worth.js indlæses efter denne fil).
    if(typeof updateEmergencyFund === 'function') updateEmergencyFund();
}

/**
 * Downloader budgettet som CSV - fx til at vise en rådgiver. Filen åbner i
 * Excel og Numbers med én række pr. post og en opsummering nederst.
 */
function downloadBudget(){
    const items = loadBudgetItems();
    if(!Object.values(items).some(list => list.length)){
        notify('Budgettet er tomt. Tilføj poster ved at klikke på en kategori.');
        return;
    }
    downloadCSV(budgetExportRows({
        categories: getBudgetCategories(), groups: BUDGET_GROUPS, items, frequencies: BUDGET_FREQUENCIES,
        total: parseFloat(document.getElementById('budgetTotalInput').value) || 0
    }), `budget-${todayIso()}.csv`);
}

/**
 * Nulstiller alle poster og det samlede beløb efter bekræftelse - med fortryd.
 * Egne kategorier bevares.
 */
async function resetBudget(){
    const ok = await confirmDialog({
        title:'Nulstil budgettet?',
        message:'Alle poster og det samlede beløb slettes. Dine egne kategorier bevares.',
        confirmLabel:'Nulstil', danger:true
    });
    if(!ok) return;
    const previousItems = loadBudgetItems();
    const previousTotal = document.getElementById('budgetTotalInput').value;
    localStorage.removeItem('budgetItems');
    document.getElementById('budgetTotalInput').value = 0;
    updateBudget();
    notify('Budgettet er nulstillet.', {actionLabel:'Fortryd', onAction: () => {
        saveBudgetItems(previousItems);
        document.getElementById('budgetTotalInput').value = previousTotal;
        updateBudget();
    }});
}

loadBudgetFromStorage();
document.getElementById('budgetTotalInput').addEventListener('input', () => { updateBudget(); markSaved('budgetSaveStatus'); });
updateBudget();
