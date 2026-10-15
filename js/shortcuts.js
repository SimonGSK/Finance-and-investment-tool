/**
 * @file Tastaturgenveje på computeren: 1-7 åbner punkterne i menuen (i menuens rækkefølge),
 * N åbner en ny månedsstatus, B skjuler eller viser beløbene, ? viser en oversigt, og ←/→
 * skifter måned i Månedsoverblik.
 *
 * Genvejene virker kun, når man ikke skriver: aldrig i et felt, en dialog eller et ark,
 * ikke mens kodelåsen er vist, og ikke sammen med Cmd, Ctrl eller Alt - så fx Cmd+1 stadig
 * skifter fane i browseren, og et tal i et beløbsfelt bare bliver skrevet.
 */

const SHORTCUTS = [
    {key: '1', label: 'Oversigt', section: 'overview', run: () => showSection('overview')},
    {key: '2', label: 'Investering', section: 'tools', run: () => showSection('tools')},
    {key: '3', label: 'Bolig & lån', section: 'housing', run: () => showSection('housing')},
    {key: '4', label: 'Budget', section: 'budget', run: () => showSection('budget')},
    {key: '5', label: 'Formue', section: 'formue', run: () => showSection('formue')},
    {key: '6', label: 'Månedsoverblik', section: 'month', run: () => showSection('month')},
    {key: '7', label: 'Portefølje', section: 'portfolio', run: () => showSection('portfolio')},
    {key: 'n', label: 'Ny månedsstatus', run: () => openMonthlyStatus()},
    {key: 'b', label: 'Skjul eller vis beløb', run: () => toggleAmountsHidden()},
    {key: '?', label: 'Vis genvejene', run: () => openShortcutsDialog()}
];
// Kun til oversigten: ←/→ håndteres for sig (de virker kun i Månedsoverblik).
const SHORTCUT_EXTRAS = [{keys: '← →', label: 'Forrige og næste måned i Månedsoverblik'}];

/**
 * Må tasten bruges som genvej lige nu? Nej, hvis man skriver et sted, holder en
 * ændringstast nede, eller noget andet ligger øverst (en dialog, et ark, kodelåsen).
 * @param {KeyboardEvent} e
 * @returns {boolean}
 */
function shortcutAllowed(e){
    if(e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return false;
    const target = e.target;
    if(target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return false;
    if(document.querySelector('dialog[open]') || document.body.classList.contains('nav-open')) return false;
    if(document.documentElement.classList.contains('is-locked')) return false;
    return true;
}

/** Oversigten over genvejene (? eller Hjælp › Genveje). */
function openShortcutsDialog(){
    const list = el('dl', {className: 'shortcut-list'}, [
        ...SHORTCUTS.flatMap(s => [
            el('dt', {}, [el('kbd', {textContent: s.key === '?' ? '?' : s.key.toUpperCase()})]),
            el('dd', {textContent: s.label})
        ]),
        ...SHORTCUT_EXTRAS.flatMap(s => [
            el('dt', {}, s.keys.split(' ').map(k => el('kbd', {textContent: k}))),
            el('dd', {textContent: s.label})
        ])
    ]);
    openDialog({title: 'Tastaturgenveje', content: el('div', {}, [
        el('p', {className: 'dialog-hint', textContent: 'Virker, når du ikke skriver i et felt. Esc lukker dialoger, og Enter gemmer i dem.'}),
        list
    ])});
}

document.addEventListener('keydown', e => {
    if(!shortcutAllowed(e)) return;
    // ←/→ i Månedsoverblik: forrige og næste måned (som at stryge på en telefon).
    if((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && document.body.dataset.section === 'month'){
        if(e.shiftKey || e.target.closest?.('.data-table-wrap')) return;
        e.preventDefault();
        stepMonth(e.key === 'ArrowRight' ? 1 : -1);
        return;
    }
    const shortcut = SHORTCUTS.find(s => s.key === e.key.toLowerCase());
    if(!shortcut) return;
    // En side, man har skjult i menuen (Indstillinger › Værktøjer), åbnes heller ikke med en genvej.
    if(shortcut.section && document.querySelector(`#sidebar .nav-item[data-section="${shortcut.section}"]`)?.hidden) return;
    e.preventDefault();
    shortcut.run();
});

// Skærmlæsere kan fortælle om genvejen ved menupunktet.
SHORTCUTS.slice(0, 7).forEach(({key, label}) => {
    const item = [...document.querySelectorAll('#sidebar .top-tab-btn')].find(btn =>
        [...btn.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() === label);
    item?.setAttribute('aria-keyshortcuts', key);
});
