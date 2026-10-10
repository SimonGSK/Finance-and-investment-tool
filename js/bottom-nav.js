/**
 * @file Bundmenuen på telefoner: Oversigt, Trackers, + Status, Værktøjer og Mere.
 * Computer og tablet bruger menukortet til venstre; stilarket viser kun bundmenuen
 * på smalle skærme.
 *
 * Trackers, Værktøjer og Mere åbner hver et ark nedefra, der bygges ud fra
 * menukortet, så menuerne altid har de samme punkter. Arket lukkes med krydset,
 * et tryk udenfor, Esc, eller ved at trække det ned.
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

/** @returns {HTMLElement[]} arket "Mere": indstillinger, hjælp, feedback og privatliv */
function moreSheetContent(){
    return ['settingsBtn', 'helpBtn', 'feedbackBtn', 'privacyLink']
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
    // Kan indholdet være der uden at rulle, kan hele arket trækkes ned; ellers kun i toppen (håndtaget og titlen).
    const body = document.getElementById('navSheetBody');
    sheet.classList.toggle('is-static', body.scrollHeight <= body.clientHeight + 1);
    if(navByKeyboard) sheet.querySelector('.nav-sheet-item.active, .nav-sheet-item')?.focus();
    else sheet.focus({preventScroll: true});   // selve arket, uden ramme (ikke lukkeknappen)
}

/** Lukker arket (gør intet, hvis det er lukket). */
function closeNavSheet(){
    const sheet = document.getElementById('navSheet');
    if(sheet.open) sheet.close();
}

/**
 * Træk arket ned for at lukke det, som på en iPhone: arket følger fingeren, og slippes
 * det mere end en tredjedel nede eller med et hurtigt svip nedad, glider det ud og lukkes.
 * Ellers glider det tilbage. Et træk tæller ikke som et tryk på punktet, man startede på.
 * @param {HTMLDialogElement} sheet
 */
function initSheetSwipe(sheet){
    let start = null, dragging = false, dy = 0, swallowClick = false;
    const reset = () => {
        sheet.classList.remove('is-dragging', 'is-settling');
        sheet.style.transform = '';
    };
    const settle = (to, then) => {
        sheet.classList.remove('is-dragging');
        sheet.classList.add('is-settling');
        sheet.style.transform = to;
        let done = false;
        const finish = () => { if(done) return; done = true; sheet.classList.remove('is-settling'); then?.(); };
        sheet.addEventListener('transitionend', finish, {once: true});
        setTimeout(finish, 260);   // hvis der ingen overgang er (fx "reducer bevægelse")
    };

    sheet.addEventListener('pointerdown', e => {
        if(!e.isPrimary || e.button !== 0) return;
        // I et ark, der skal rulle, trækkes kun i toppen, så man stadig kan rulle i listen.
        if(!sheet.classList.contains('is-static') && !e.target.closest('.nav-sheet-grip, .dialog-header')) return;
        start = {y: e.clientY, t: e.timeStamp, id: e.pointerId};
        dragging = false; dy = 0;
    });
    sheet.addEventListener('pointermove', e => {
        if(!start || e.pointerId !== start.id) return;
        // En mus, der bevæger sig uden knappen nede, er sluppet - også hvis "slip" aldrig nåede frem.
        if(e.pointerType !== 'touch' && e.buttons === 0){ end(e, true); return; }
        dy = e.clientY - start.y;
        if(!dragging){
            if(dy < 6) return;
            dragging = true;
            sheet.classList.add('is-dragging');
            try{ sheet.setPointerCapture(e.pointerId); } catch(err){}
        }
        // Opad giver arket kun lidt efter.
        sheet.style.transform = `translateY(${dy > 0 ? dy : dy / 4}px)`;
    });
    /**
     * Slutter et træk: lukker arket eller lader det glide tilbage.
     * @param {PointerEvent} e
     * @param {boolean} [released] fingeren eller knappen blev sluppet (ikke afbrudt af browseren)
     */
    function end(e, released = e.type === 'pointerup'){
        if(!start || e.pointerId !== start.id) return;
        const velocity = dy / Math.max(1, e.timeStamp - start.t);   // px pr. ms
        start = null;
        if(!dragging) return;
        dragging = false;
        swallowClick = true;
        setTimeout(() => { swallowClick = false; }, 0);
        try{ sheet.releasePointerCapture(e.pointerId); } catch(err){}
        if(released && (dy > sheet.offsetHeight / 3 || (dy > 40 && velocity > 0.6))){
            settle('translateY(100%)', () => sheet.close());
        } else settle('');
    }
    // Slip lyttes efter på hele vinduet, så et træk aldrig hænger fast, hvis slip sker et andet sted end på arket.
    window.addEventListener('pointerup', e => end(e), true);
    window.addEventListener('pointercancel', e => end(e), true);
    sheet.addEventListener('lostpointercapture', e => end(e, true));
    // Klikket, der kommer efter et træk, må ikke åbne det punkt, man startede på.
    sheet.addEventListener('click', e => { if(swallowClick){ e.stopPropagation(); e.preventDefault(); swallowClick = false; } }, true);
    sheet.addEventListener('close', reset);
}

(function initBottomNav(){
    const sheet = document.getElementById('navSheet');
    // Et tryk på den mørke baggrund lukker arket. Med tastaturet går fokus tilbage til fanen,
    // der åbnede det; efter et tryk fjernes fokus, så fanen ikke får en grøn ramme.
    sheet.addEventListener('click', e => { if(e.target === sheet) sheet.close(); });
    initSheetSwipe(sheet);
    sheet.addEventListener('close', () => {
        const tab = document.querySelector(`.bottom-tab[data-tab="${sheet.dataset.kind}"]`);
        if(!tab || document.querySelector('dialog[open]')) return;
        if(navByKeyboard) tab.focus({preventScroll: true});
        else if(document.activeElement === tab) tab.blur();
    });

    // Mens man skriver i et felt, skjules bundmenuen, så den ikke ligger oven på tastaturet.
    // Kun felter med tastatur: vælgere (år, periode, dato) åbner ikke tastaturet, og fokus
    // bliver på dem efter valget - så ville bundmenuen forsvinde, til man trykkede et andet sted.
    const typing = t => t.matches?.('textarea, input:not([type]), input[type=text], input[type=number], input[type=email], input[type=search], input[type=tel], input[type=url], input[type=password]');
    document.addEventListener('focusin', e => { if(typing(e.target)) document.body.classList.add('is-typing'); });
    document.addEventListener('focusout', e => { if(typing(e.target)) document.body.classList.remove('is-typing'); });

    syncBottomNav(document.body.dataset.section || 'overview');
})();
