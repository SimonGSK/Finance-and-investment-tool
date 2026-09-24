/**
 * @file Mål i Formue: egne mål for fx nettoformuen eller aktierne, med
 * fremdrift, hvad der skal spares op pr. måned for at nå en frist, og om
 * tempoet det seneste år rækker. Målene gemmes under 'netWorthGoals'.
 * Beregningen ligger i calc.js (goalProgress, monthlyTrend).
 */

const GOAL_METRICS = [
    {key:'value', label:'Nettoformue', phrase:'Din nettoformue'},
    {key:'liquid', label:'Likvid formue', phrase:'Din likvide formue'},
    {key:'netCatKontanter', label:'Kontanter', phrase:'Dine kontanter'},
    {key:'netCatAktier', label:'Aktier', phrase:'Dine aktier'},
    {key:'netCatPension', label:'Pension', phrase:'Din pension'},
    {key:'netCatFrivaerdi', label:'Friværdi', phrase:'Din friværdi'}
];

/** @returns {{id:string, name:string, metric:string, target:number, deadline:string|null}[]} */
function loadGoals(){
    try{ return JSON.parse(localStorage.getItem('netWorthGoals') || '[]'); }
    catch(e){ return []; }
}

function saveGoals(goals){
    localStorage.setItem('netWorthGoals', JSON.stringify(goals));
}

/** Nuværende værdi af et mål ud fra Formue-felterne. */
function currentGoalValue(metric){
    if(metric === 'value') return computeLiveNetWorth();
    if(metric === 'liquid') return computeLiveLiquidTotal();
    return parseFloat(document.getElementById(metric).value) || 0;
}

/** Tegner alle mål. Kaldes, når Formue-felterne eller historikken ændres. */
function renderGoals(){
    const container = document.getElementById('goalsContainer');
    if(!container) return;
    const goals = loadGoals();
    const history = readNetWorthHistory();
    if(!goals.length){
        container.replaceChildren(el('p', {className:'empty-note', textContent:'Sæt et mål, fx "Første million" for din nettoformue, og følg hvor langt du er – og hvad der skal til for at nå det i tide.'}));
        return;
    }
    container.replaceChildren(...goals.map(goal => {
        const metric = GOAL_METRICS.find(m => m.key === goal.metric) || GOAL_METRICS[0];
        const current = currentGoalValue(goal.metric);
        const trend = monthlyTrend(history, goal.metric);
        const g = goalProgress({target: goal.target, current, deadline: goal.deadline, today: todayIso(), trend});

        const facts = [metric.label, `${Math.round(g.pct * 100)} %`];
        if(!g.reached) facts.push(`mangler ${DK.format(g.remaining)} kr.`);
        if(goal.deadline) facts.push(`frist ${formatDanishDate(goal.deadline)}`);

        let statusText, statusClass = '';
        if(g.reached){ statusText = 'Målet er nået.'; statusClass = 'is-good'; }
        else if(goal.deadline && g.monthsLeft === 0){ statusText = 'Fristen er overskredet.'; statusClass = 'is-bad'; }
        else {
            const parts = [];
            // Det er værdien, der skal stige - via opsparing, kursstigninger eller afdrag - ikke nødvendigvis et beløb, man selv lægger til.
            if(g.neededPerMonth !== null) parts.push(`${metric.phrase} skal stige med ca. ${DK.format(g.neededPerMonth)} kr. om måneden i snit for at nå målet i tide.`);
            if(trend !== null){
                parts.push(`Dit tempo det seneste år: ${trend >= 0 ? '+' : '−'}${DK.format(Math.abs(trend))} kr./md.`);
                if(g.onTrack === true){ parts.push('Du er på sporet.'); statusClass = 'is-good'; }
                else if(g.onTrack === false){ parts.push('Det rækker ikke helt.'); statusClass = 'is-bad'; }
                else if(g.monthsAtTrend !== null) parts.push(`I det tempo når du det om ca. ${formatDuration(Math.ceil(g.monthsAtTrend))}.`);
            } else {
                parts.push('Gem øjebliksbilleder over mindst en måned for at se dit tempo.');
            }
            statusText = parts.join(' ');
        }

        return el('button', {className:'goal-row', type:'button', onclick: () => openGoalDialog(goal.id), attrs:{'aria-haspopup':'dialog'}}, [
            el('div', {className:'goal-head'}, [
                el('span', {className:'goal-name', textContent: goal.name}),
                el('span', {className:'goal-amount', textContent: `${DK.format(current)} / ${DK.format(goal.target)} kr.`})
            ]),
            el('div', {className:'progress-track'}, [el('div', {className:'progress-fill' + (g.reached ? ' is-done' : ''), attrs:{style:`width:${g.pct * 100}%`}})]),
            el('div', {className:'goal-facts', textContent: facts.join(' · ')}),
            el('div', {className:'goal-status ' + statusClass, textContent: statusText})
        ]);
    }));
}

/**
 * Opret eller ret et mål. Navn og et positivt beløb er påkrævet.
 * @param {string} [goalId] udeladt = nyt mål
 */
function openGoalDialog(goalId){
    const goals = loadGoals();
    const existing = goals.find(g => g.id === goalId);
    const nameInput = el('input', {type:'text', className:'number-input', value: existing?.name || '', placeholder:'Fx Første million'});
    const metricSelect = el('select', {className:'number-input'},
        GOAL_METRICS.map(m => el('option', {value:m.key, textContent:m.label, selected: (existing?.metric || 'value') === m.key})));
    const targetInput = el('input', {type:'number', className:'number-input', value: existing?.target ?? '', min:1, step:10000, placeholder:'1000000'});
    const deadlineInput = el('input', {type:'date', className:'number-input', value: existing?.deadline || ''});
    const error = el('div', {className:'field-error', attrs:{role:'alert'}});
    [nameInput, targetInput].forEach(i => i.addEventListener('input', () => { error.textContent = ''; i.removeAttribute('aria-invalid'); }));

    const actions = [{label:'Annullér', variant:'secondary'}];
    if(existing) actions.push({label:'Slet mål', variant:'danger', onClick: () => { deleteGoal(existing.id); }});
    actions.push({label: existing ? 'Gem' : 'Opret mål', variant:'primary', onClick: () => {
        const name = nameInput.value.trim();
        const target = parseFloat(targetInput.value);
        if(!name){ error.textContent = 'Giv målet et navn.'; nameInput.setAttribute('aria-invalid', 'true'); nameInput.focus(); return false; }
        if(!(target > 0)){ error.textContent = 'Skriv et beløb over 0 kr.'; targetInput.setAttribute('aria-invalid', 'true'); targetInput.focus(); return false; }
        const goal = {id: existing?.id || 'goal-' + Date.now().toString(36), name, metric: metricSelect.value, target, deadline: normalizeDate(deadlineInput.value)};
        const next = existing ? goals.map(g => g.id === goal.id ? goal : g) : goals.concat([goal]);
        saveGoals(next);
        renderGoals();
        notify(existing ? `Målet "${name}" er opdateret.` : `Målet "${name}" er oprettet.`);
    }});

    openDialog({
        title: existing ? 'Ret mål' : 'Nyt mål',
        content: el('div', {}, [
            fieldEl('Navn', nameInput),
            fieldEl('Hvad vil du måle?', metricSelect),
            fieldEl('Mål (kr.)', targetInput),
            fieldEl('Frist (valgfri)', deadlineInput, [error])
        ]),
        actions
    });
    nameInput.focus();
}

/** Sletter et mål - med fortryd. */
function deleteGoal(goalId){
    const goals = loadGoals();
    const index = goals.findIndex(g => g.id === goalId);
    const [removed] = goals.splice(index, 1);
    saveGoals(goals);
    renderGoals();
    notify(`Målet "${removed.name}" er slettet.`, {actionLabel:'Fortryd', onAction: () => {
        const again = loadGoals();
        again.splice(index, 0, removed);
        saveGoals(again);
        renderGoals();
    }});
}

renderGoals();
