/**
 * @file Bundmenuen på telefoner: Oversigt, Trackers, + Status, Værktøjer og Mere.
 * Computer og tablet bruger menukortet til venstre; stilarket viser kun bundmenuen
 * på smalle skærme.
 *
 * Trackers, Værktøjer og Mere åbner hver et ark nedefra, der bygges ud fra
 * menukortet, så menuerne altid har de samme punkter.
 */

// Trackerne i den rækkefølge og med de navne, de har i arket.
const TRACKERS = [['formue', 'Formuetracker'], ['portfolio', 'Porteføljetracker'], ['month', 'Månedsoverblik']];
const TRACKER_SECTIONS = TRACKERS.map(([section]) => section);
const TOOL_SECTIONS = ['tools', 'housing', 'budget'];

/**
 * Markerer fanen for den viste side i bundmenuen. Kaldes fra showSection.
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
}

/**
 * Et punkt i arket, der gør det samme som knappen i menukortet.
 * @param {HTMLButtonElement} source knappen i menukortet
 * @param {Node|null} icon
 * @param {boolean} active
 * @param {string} [label] navnet i arket; udeladt bruges menukortets
 * @returns {HTMLButtonElement}
 */
function navSheetItem(source, icon, active, label){
    label = label || [...source.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
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

/** @returns {HTMLElement[]} arket "Trackers": Formue, Portefølje og Månedsoverblik */
function trackersSheetContent(){
    const current = document.body.dataset.section;
    return TRACKERS.map(([section, label]) => {
        const btn = document.querySelector(`#sidebar .nav-item[data-section="${section}"]`);
        return navSheetItem(btn, btn.querySelector('svg')?.cloneNode(true), current === section, label);
    });
}

/** @returns {HTMLElement[]} arket "Mere": indstillinger, hjælp og feedback */
function moreSheetContent(){
    return ['settingsBtn', 'helpBtn', 'feedbackBtn']
        .map(id => document.getElementById(id))
        .filter(btn => btn && !btn.hidden)
        .map(btn => navSheetItem(btn, btn.querySelector('svg')?.cloneNode(true), false));
}

const NAV_SHEETS = {
    trackers: ['Trackers', trackersSheetContent],
    tools: ['Værktøjer', toolsSheetContent],
    more: ['Mere', moreSheetContent]
};

// Bruges tastaturet, eller fingeren/musen? Med tastaturet flyttes fokus til et punkt i arket
// (og tilbage til fanen bagefter). Ved et tryk gør det ikke: iPhone viser fokus fra koden som
// en grøn ramme om punktet, selvom man har trykket.
let navByKeyboard = false;
document.addEventListener('keydown', () => { navByKeyboard = true; }, true);
document.addEventListener('pointerdown', () => { navByKeyboard = false; }, true);

/**
 * Åbner arket nedefra.
 * @param {'trackers'|'tools'|'more'} kind
 */
function openNavSheet(kind){
    const sheet = document.getElementById('navSheet');
    const [title, content] = NAV_SHEETS[kind];
    document.getElementById('navSheetTitle').textContent = title;
    document.getElementById('navSheetBody').replaceChildren(...content());
    sheet.dataset.kind = kind;
    if(!sheet.open) sheet.showModal();
    if(navByKeyboard) sheet.querySelector('.nav-sheet-item.active, .nav-sheet-item')?.focus();
    else sheet.focus({preventScroll: true});   // selve arket, uden ramme (ikke lukkeknappen)
}

/** Lukker arket (gør intet, hvis det er lukket). */
function closeNavSheet(){
    const sheet = document.getElementById('navSheet');
    if(sheet.open) sheet.close();
}

(function initBottomNav(){
    const sheet = document.getElementById('navSheet');
    // Et tryk på den mørke baggrund lukker arket. Med tastaturet går fokus tilbage til fanen,
    // der åbnede det; efter et tryk fjernes fokus, så fanen ikke får en grøn ramme.
    sheet.addEventListener('click', e => { if(e.target === sheet) sheet.close(); });
    sheet.addEventListener('close', () => {
        const tab = document.querySelector(`.bottom-tab[data-tab="${sheet.dataset.kind}"]`);
        if(!tab || document.querySelector('dialog[open]')) return;
        if(navByKeyboard) tab.focus({preventScroll: true});
        else if(document.activeElement === tab) tab.blur();
    });

    // Mens man skriver i et felt, skjules bundmenuen, så den ikke ligger oven på tastaturet.
    const typing = t => t.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select');
    document.addEventListener('focusin', e => { if(typing(e.target)) document.body.classList.add('is-typing'); });
    document.addEventListener('focusout', e => { if(typing(e.target)) document.body.classList.remove('is-typing'); });

    syncBottomNav(document.body.dataset.section || 'overview');
})();
