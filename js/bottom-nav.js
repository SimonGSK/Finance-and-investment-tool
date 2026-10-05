/**
 * @file Bundmenuen på telefoner: Oversigt, Trackers, + Status, Værktøjer og Mere.
 * Computer og tablet bruger menukortet til venstre; stilarket viser kun bundmenuen
 * på smalle skærme.
 *
 * Værktøjer og Mere åbner et ark nedefra, der bygges ud fra menukortet, så de to
 * menuer altid har de samme punkter. Trackers åbner den tracker, man sidst brugte,
 * og øverst på tracker-siderne kan man skifte mellem de tre.
 */

const TRACKER_SECTIONS = ['formue', 'month', 'portfolio'];
const LAST_TRACKER_KEY = 'lastTracker';
const TOOL_SECTIONS = ['tools', 'housing', 'budget'];

/** "Trackers": åbner den tracker, man sidst brugte (Formue første gang). */
function openLastTracker(){
    let last = null;
    try{ last = localStorage.getItem(LAST_TRACKER_KEY); } catch(e){}
    showSection(TRACKER_SECTIONS.includes(last) ? last : 'formue');
}

/**
 * Markerer fanen for den viste side i bundmenuen og i tracker-skifteren, og husker
 * den seneste tracker. Kaldes fra showSection.
 * @param {string} section
 */
function syncBottomNav(section){
    const tab = section === 'overview' ? 'overview'
        : TRACKER_SECTIONS.includes(section) ? 'trackers'
        : TOOL_SECTIONS.includes(section) ? 'tools' : null;
    document.querySelectorAll('.bottom-tab[data-tab]').forEach(btn => {
        if(btn.dataset.tab === tab) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
    });
    document.querySelectorAll('.tracker-switch button').forEach(btn => {
        if(btn.dataset.section === section) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
    });
    if(TRACKER_SECTIONS.includes(section)){
        try{ localStorage.setItem(LAST_TRACKER_KEY, section); } catch(e){}
    }
}

/**
 * Et punkt i arket, der gør det samme som knappen i menukortet.
 * @param {HTMLButtonElement} source knappen i menukortet
 * @param {Node|null} icon
 * @param {boolean} active
 * @returns {HTMLButtonElement}
 */
function navSheetItem(source, icon, active){
    const label = [...source.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const item = el('button', {className: 'nav-sheet-item' + (active ? ' active' : ''), type: 'button', onclick: () => {
        closeNavSheet();
        source.click();
    }}, [el('span', {className: 'ov-tool-icon', attrs: {'aria-hidden': 'true'}}, icon ? [icon] : []), el('span', {textContent: label})]);
    if(active) item.setAttribute('aria-current', 'page');
    return item;
}

/**
 * Ikonet til et værktøj: det samme som på værktøjskortet på Oversigten, ellers menukortets.
 * @param {HTMLButtonElement} source
 * @returns {Node|null}
 */
function navSheetIcon(source){
    const card = document.querySelector(`.ov-tool[onclick="${source.getAttribute('onclick')}"] svg`);
    return (card || source.querySelector('svg'))?.cloneNode(true) || null;
}

/** @returns {HTMLElement[]} arket "Værktøjer": de tre grupper fra menukortet */
function toolsSheetContent(){
    const current = document.body.dataset.section;
    const groups = [...document.querySelectorAll('#sidebar .nav-item')]
        .filter(btn => TOOL_SECTIONS.includes(btn.dataset.section))
        .map(btn => {
            const section = btn.dataset.section;
            const sub = btn.classList.contains('nav-group') ? [...btn.nextElementSibling.querySelectorAll('.tab-btn')] : [btn];
            const title = [...btn.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
            return el('section', {className: 'nav-sheet-group'}, [
                el('h3', {className: 'nav-sheet-label', textContent: title}),
                ...sub.map(item => navSheetItem(item, navSheetIcon(item),
                    current === section && (item === btn || item.classList.contains('active'))))
            ]);
        });
    return groups;
}

/** @returns {HTMLElement[]} arket "Mere": indstillinger, hjælp og feedback */
function moreSheetContent(){
    return ['settingsBtn', 'helpBtn', 'feedbackBtn']
        .map(id => document.getElementById(id))
        .filter(btn => btn && !btn.hidden)
        .map(btn => navSheetItem(btn, btn.querySelector('svg')?.cloneNode(true), false));
}

/**
 * Åbner arket nedefra.
 * @param {'tools'|'more'} kind
 */
function openNavSheet(kind){
    const sheet = document.getElementById('navSheet');
    document.getElementById('navSheetTitle').textContent = kind === 'tools' ? 'Værktøjer' : 'Mere';
    document.getElementById('navSheetBody').replaceChildren(...(kind === 'tools' ? toolsSheetContent() : moreSheetContent()));
    sheet.dataset.kind = kind;
    if(!sheet.open) sheet.showModal();
    sheet.querySelector('.nav-sheet-item.active, .nav-sheet-item')?.focus();
}

/** Lukker arket (gør intet, hvis det er lukket). */
function closeNavSheet(){
    const sheet = document.getElementById('navSheet');
    if(sheet.open) sheet.close();
}

(function initBottomNav(){
    const sheet = document.getElementById('navSheet');
    // Et tryk på den mørke baggrund lukker arket; fokus går tilbage til fanen, der åbnede det.
    sheet.addEventListener('click', e => { if(e.target === sheet) sheet.close(); });
    sheet.addEventListener('close', () => {
        const tab = document.querySelector(`.bottom-tab[data-tab="${sheet.dataset.kind}"]`);
        if(tab && !document.querySelector('dialog[open]')) tab.focus({preventScroll: true});
    });

    // Mens man skriver i et felt, skjules bundmenuen, så den ikke ligger oven på tastaturet.
    const typing = t => t.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select');
    document.addEventListener('focusin', e => { if(typing(e.target)) document.body.classList.add('is-typing'); });
    document.addEventListener('focusout', e => { if(typing(e.target)) document.body.classList.remove('is-typing'); });

    syncBottomNav(document.body.dataset.section || 'overview');
})();
