/**
 * @file "Skjul beløb": knappen med øjet i topbjælken slører alle beløb på siden, så
 * man kan vise appen frem eller bruge den på offentlige steder. Procenter, datoer og
 * graferne form er stadig synlige; graferne mister deres beløbsakse og tooltips.
 *
 * Det er kun en visning: tallene ændres ikke, og valget gælder kun denne enhed (det
 * kommer ikke med i backupfilen). Et lille script i <head> slører siden, før den tegnes,
 * når valget er slået til. Hvad der tæller som et beløb, afgør containsAmount i calc.js.
 */

const HIDE_AMOUNTS_KEY = 'hideAmounts';
let amountObserver = null;

/** @returns {boolean} true, når beløbene er skjult */
function amountsHidden(){
    return document.documentElement.classList.contains('amounts-hidden');
}

/**
 * Markerer de elementer i root, hvis egen tekst indeholder et beløb (klassen has-amount),
 * og talfelter til beløb (data-amount): felter, der tæller i trin på 100 kr. eller mere.
 * @param {Node} root
 */
function markAmounts(root){
    const elements = new Set();
    if(root.nodeType === 3) elements.add(root.parentElement);
    else if(root.nodeType === 1){
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while(walker.nextNode()) elements.add(walker.currentNode.parentElement);
        [root, ...root.querySelectorAll('input[data-number]')].forEach(input => {
            if(input.matches?.('input[data-number]') && (Number(input.step) >= 100 || input.readOnly)) input.dataset.amount = '';
        });
    }
    elements.forEach(node => {
        if(!node || node.closest('script, style, .hide-amounts-btn')) return;
        const ownText = [...node.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ');
        node.classList.toggle('has-amount', containsAmount(ownText));
    });
}

/**
 * Skjuler eller viser beløbene og husker valget.
 * @param {boolean} hide
 */
function setAmountsHidden(hide){
    document.documentElement.classList.toggle('amounts-hidden', hide);
    try{
        if(hide) localStorage.setItem(HIDE_AMOUNTS_KEY, '1');
        else localStorage.removeItem(HIDE_AMOUNTS_KEY);
    } catch(e){}
    const btn = document.getElementById('hideAmountsBtn');
    btn.setAttribute('aria-pressed', String(hide));
    btn.title = hide ? 'Vis beløb' : 'Skjul beløb';
    btn.setAttribute('aria-label', btn.title);

    // Mens beløbene er skjult, markeres alt nyt, der kommer på siden (fx når en graf eller dialog tegnes).
    amountObserver?.disconnect();
    amountObserver = null;
    if(hide){
        markAmounts(document.body);
        amountObserver = new MutationObserver(records => records.forEach(r => {
            if(r.type === 'characterData') markAmounts(r.target);
            else { markAmounts(r.target); r.addedNodes.forEach(markAmounts); }
        }));
        amountObserver.observe(document.body, {childList: true, characterData: true, subtree: true});
    }
    Object.values(Chart.instances).forEach(chart => chart.update('none'));
}

/** Knappen med øjet. */
function toggleAmountsHidden(){
    setAmountsHidden(!amountsHidden());
}

// Graferne: aksen med beløb og tooltips slås fra, mens beløbene er skjult. De oprindelige
// indstillinger huskes pr. graf (Chart.js kopierer indstillingerne ved hver opdatering,
// så de huskes under aksens navn, ikke som objekt), så de kommer tilbage bagefter.
const shownGraphOptions = new WeakMap();
Chart.register({
    id: 'hideAmounts',
    beforeUpdate(chart){
        const options = chart.config.options;
        const valueAxis = options.indexAxis === 'y' ? 'x' : 'y';
        options.plugins ||= {};
        const targets = [
            ...Object.entries(options.scales || {}).filter(([id]) => id.startsWith(valueAxis)).map(([id, s]) => ['scale:' + id, s.ticks ||= {}, 'display']),
            ['tooltip', options.plugins.tooltip ||= {}, 'enabled']
        ];
        if(!shownGraphOptions.has(chart)) shownGraphOptions.set(chart, new Map());
        const shown = shownGraphOptions.get(chart);
        targets.forEach(([name, target, key]) => {
            if(!shown.has(name)) shown.set(name, target[key]);
            const value = shown.get(name);
            if(amountsHidden()) target[key] = false;
            else if(value === undefined) delete target[key];
            else target[key] = value;
        });
    }
});

if(amountsHidden()) setAmountsHidden(true);
