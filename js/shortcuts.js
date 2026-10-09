/**
 * @file Tastaturgenveje på computeren: 1-7 åbner punkterne i menuen (i menuens rækkefølge),
 * N åbner en ny månedsstatus, B skjuler eller viser beløbene, og ? viser en oversigt.
 *
 * Genvejene virker kun, når man ikke skriver: aldrig i et felt, en dialog eller et ark,
 * ikke mens kodelåsen er vist, og ikke sammen med Cmd, Ctrl eller Alt - så fx Cmd+1 stadig
 * skifter fane i browseren, og et tal i et beløbsfelt bare bliver skrevet.
 */

const SHORTCUTS = [
    {key: '1', label: 'Oversigt', run: () => showSection('overview')},
    {key: '2', label: 'Investering', run: () => showSection('tools')},
    {key: '3', label: 'Bolig & lån', run: () => showSection('housing')},
    {key: '4', label: 'Budget', run: () => showSection('budget')},
    {key: '5', label: 'Formue', run: () => showSection('formue')},
    {key: '6', label: 'Månedsoverblik', run: () => showSection('month')},
    {key: '7', label: 'Portefølje', run: () => showSection('portfolio')},
    {key: 'n', label: 'Ny månedsstatus', run: () => openMonthlyStatus()},
    {key: 'b', label: 'Skjul eller vis beløb', run: () => toggleAmountsHidden()},
    {key: '?', label: 'Vis genvejene', run: () => openShortcutsDialog()}
];

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
    const list = el('dl', {className: 'shortcut-list'}, SHORTCUTS.flatMap(s => [
        el('dt', {}, [el('kbd', {textContent: s.key === '?' ? '?' : s.key.toUpperCase()})]),
        el('dd', {textContent: s.label})
    ]));
    openDialog({title: 'Tastaturgenveje', content: el('div', {}, [
        el('p', {className: 'dialog-hint', textContent: 'Virker, når du ikke skriver i et felt. Esc lukker dialoger, og Enter gemmer i dem.'}),
        list
    ])});
}

document.addEventListener('keydown', e => {
    if(!shortcutAllowed(e)) return;
    const shortcut = SHORTCUTS.find(s => s.key === e.key.toLowerCase());
    if(!shortcut) return;
    e.preventDefault();
    shortcut.run();
});

// Skærmlæsere kan fortælle om genvejen ved menupunktet.
SHORTCUTS.slice(0, 7).forEach(({key, label}) => {
    const item = [...document.querySelectorAll('#sidebar .top-tab-btn')].find(btn =>
        [...btn.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() === label);
    item?.setAttribute('aria-keyshortcuts', key);
});
