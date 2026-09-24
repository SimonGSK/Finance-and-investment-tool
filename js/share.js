/**
 * @file Del en beregning: gemmer lommeregnernes felter i adressens #-del, så et
 * link åbner værktøjet med de samme tal. #-delen sendes aldrig til serveren.
 * Kun lommeregnerne kan deles - trackerne og gældslisten er personlige data,
 * og et link må aldrig overskrive det, en bruger selv har gemt.
 */

// værktøjets container-id -> hvordan det vises, og felter uden for containeren, der hører med
const SHAREABLE_TOOLS = {
    tool1: {show: () => { showSection('tools'); showTool(1); }, extra: ['doubleDeduction']},
    tool2: {show: () => { showSection('tools'); showTool(2); }, extra: ['doubleDeduction']},
    tool3: {show: () => { showSection('tools'); showTool(3); }},
    tool5: {show: () => { showSection('tools'); showTool(5); }},
    housing1: {show: () => { showSection('housing'); showHousingTool(1); }},
    housing2: {show: () => { showSection('housing'); showHousingTool(2); }}
};

/**
 * De felter i et værktøj, der kan deles: tal, valg og afkrydsninger med et id.
 * Skyderne udelades - de følger talfelterne.
 * @param {string} toolId
 * @returns {HTMLInputElement[]}
 */
function shareableFields(toolId){
    const inside = [...document.getElementById(toolId).querySelectorAll('input[id], select[id]')]
        .filter(f => f.type !== 'range' && f.type !== 'file' && f.type !== 'search');
    const extra = (SHAREABLE_TOOLS[toolId].extra || []).map(id => document.getElementById(id));
    return inside.concat(extra);
}

/**
 * Laver et link til værktøjet med de felter, der afviger fra standard, og
 * kopierer det. Kan det ikke kopieres, vises linket, så man selv kan kopiere det.
 * @param {string} toolId fx 'housing2'
 */
async function shareCalculator(toolId){
    const params = new URLSearchParams({v: toolId});
    shareableFields(toolId).forEach(f => {
        if(f.type === 'checkbox'){ if(f.checked !== f.defaultChecked) params.set(f.id, f.checked ? '1' : '0'); }
        else if(f.tagName === 'SELECT'){ if(!f.options[f.selectedIndex]?.defaultSelected) params.set(f.id, f.value); }
        else if(f.value !== f.defaultValue && f.value !== '') params.set(f.id, f.value);
    });
    const url = location.origin + location.pathname + '#' + params.toString();
    try{
        await navigator.clipboard.writeText(url);
        notify('Linket til beregningen er kopieret. Den, der åbner det, ser de samme tal.');
    } catch(e){
        const input = el('input', {type:'text', className:'number-input', value:url, readOnly:true, attrs:{'aria-label':'Link til beregningen'}});
        openDialog({title:'Del beregningen', content: el('div', {}, [
            el('p', {className:'dialog-hint', textContent:'Kopiér linket herunder. Den, der åbner det, ser de samme tal.'}), input
        ])});
        input.select();
    }
}

/**
 * Åbner værktøjet fra et delt link og udfylder felterne. Ukendte felter og
 * ugyldige tal ignoreres. Bagefter fjernes #-delen, så senere ændringer ikke
 * forveksles med linkets tal.
 */
function loadSharedCalculator(){
    if(!location.hash.includes('v=')) return;
    const params = new URLSearchParams(location.hash.slice(1));
    const toolId = params.get('v');
    if(!SHAREABLE_TOOLS[toolId]) return;
    SHAREABLE_TOOLS[toolId].show();
    const allowed = new Map(shareableFields(toolId).map(f => [f.id, f]));
    let applied = 0;
    params.forEach((value, key) => {
        const field = allowed.get(key);
        if(!field) return;
        if(field.type === 'checkbox') field.checked = value === '1';
        else if(field.tagName === 'SELECT'){
            if(![...field.options].some(o => o.value === value)) return;
            field.value = value;
        } else {
            if(!isFinite(parseFloat(value))) return;
            field.value = value;
        }
        field.dispatchEvent(new Event('input', {bubbles:true}));
        field.dispatchEvent(new Event('change', {bubbles:true}));
        applied++;
    });
    history.replaceState(null, '', location.pathname + location.search);
    notify(applied ? 'Beregningen fra linket er indlæst.' : 'Linket viser værktøjet med standardtallene.');
}

loadSharedCalculator();
