/**
 * @file Vælg dine værktøjer: under Indstillinger › Værktøjer kan man skjule de værktøjer, man
 * ikke bruger. De forsvinder fra menuen, fra arket "Værktøjer" i bundmenuen og fra kortet
 * Værktøjer på Oversigt - men virker stadig, fx fra et delt link. Skjules alle værktøjer i en
 * gruppe (Investering eller Bolig & lån), skjules gruppen også. Valget huskes i localStorage
 * ('hiddenTools') som knappernes id i menuen ('tabBtn3', 'housingTabBtn2', 'budget').
 */

const HIDDEN_TOOLS_KEY = 'hiddenTools';

/** Grupperne og deres værktøjer, som de står i menuen. */
function menuToolGroups(){
    const label = btn => [...btn.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    return [['tools', 'navSubTools'], ['housing', 'navSubHousing']].map(([section, subId]) => {
        const group = document.querySelector(`#sidebar .nav-group[data-section="${section}"]`);
        return {section, title: label(group), group,
            tools: [...document.getElementById(subId).querySelectorAll('.nav-subitem')].map(btn => ({id: btn.id, label: btn.textContent.trim(), btn}))};
    }).concat([(() => {
        const btn = document.querySelector('#sidebar .nav-item[data-section="budget"]');
        return {section: 'budget', title: label(btn), group: null, tools: [{id: 'budget', label: label(btn), btn}]};
    })()]);
}

/** @returns {string[]} id'erne på de skjulte værktøjer */
function readHiddenTools(){
    try{
        const ids = JSON.parse(localStorage.getItem(HIDDEN_TOOLS_KEY) || '[]');
        return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [];
    } catch(e){ return []; }
}

/** Det værktøj (n), en knap i menuen åbner, fx 'tabBtn5' -> 5. */
const toolNumber = btn => Number(/(\d+)$/.exec(btn.id)?.[1]);

/** Skjuler de valgte værktøjer i menuen og på Oversigt. Kaldes ved start og efter et valg. */
function applyHiddenTools(){
    const hidden = readHiddenTools();
    let anyShown = false;
    menuToolGroups().forEach(({section, group, tools}) => {
        tools.forEach(t => { t.btn.hidden = hidden.includes(t.id); });
        const shown = tools.filter(t => !t.btn.hidden);
        if(group) group.hidden = !shown.length;
        if(shown.length) anyShown = true;
        // Står gruppen på et skjult værktøj, skiftes der til det første synlige (uden at skifte side).
        if(group && shown.length && tools.find(t => t.btn.classList.contains('active'))?.btn.hidden){
            (section === 'tools' ? showTool : showHousingTool)(toolNumber(shown[0].btn), true);
        }
        // Kortene på Oversigt åbner de samme værktøjer (onclick="showTool(3)" osv.).
        tools.forEach(t => {
            const call = t.id === 'budget' ? null : `${section === 'tools' ? 'showTool' : 'showHousingTool'}(${toolNumber(t.btn)})`;
            if(call) document.querySelectorAll(`.ov-tool[onclick="${call}"]`).forEach(card => { card.hidden = t.btn.hidden; });
        });
    });
    const label = [...document.querySelectorAll('#sidebar .nav-label')].find(n => n.textContent.trim() === 'Værktøjer');
    if(label) label.hidden = !anyShown;
}

/** Afkrydsningerne i Indstillinger › Værktøjer: én pr. værktøj, ordnet som i menuen. */
function renderToolSettings(){
    const box = document.getElementById('toolSettings');
    const hidden = readHiddenTools();
    const groups = menuToolGroups();
    const save = next => {
        try{ localStorage.setItem(HIDDEN_TOOLS_KEY, JSON.stringify(next)); } catch(e){}
        applyHiddenTools();
        renderSettingsSummaries();
    };
    box.replaceChildren(...groups.map(({title, tools, section}) => el('fieldset', {className: 'tool-choice'}, [
        section === 'budget' ? '' : el('legend', {textContent: title}),
        ...tools.map(t => el('label', {className: 'toggle-row'}, [
            el('input', {type: 'checkbox', checked: !hidden.includes(t.id), onchange: e => {
                const now = readHiddenTools().filter(id => id !== t.id);
                save(e.target.checked ? now : now.concat(t.id));
            }}),
            el('span', {textContent: t.label})
        ]))
    ])));
}

/** "Alle" eller fx "7 af 10" ved gruppen i Indstillinger. */
function toolSettingsState(){
    const all = menuToolGroups().flatMap(g => g.tools);
    const shown = all.filter(t => !readHiddenTools().includes(t.id)).length;
    return shown === all.length ? 'Alle' : `${shown} af ${all.length}`;
}

applyHiddenTools();
renderToolSettings();
