/**
 * @file Lange forklaringer foldes sammen på telefoner, så der er plads til
 * tallene og graferne. På computere står de åbne som før (fold-knappen er
 * skjult i CSS), og skifter skærmbredden, følger de med.
 * Gælder .explainer-tekster over FOLD_MIN_CHARS tegn og elementer med
 * data-fold="Knaptekst". Tekster, der allerede ligger i en <details>, i en
 * dialog eller i indstillingerne, og skjulte noter, røres ikke.
 */

const FOLD_MIN_CHARS = 140;
const phoneQuery = window.matchMedia('(max-width: 640px)');

/**
 * Lægger lange forklaringer i en <details>, så de kan foldes sammen på telefon.
 * Kører én gang ved indlæsning; syncFolds åbner og lukker dem efter skærmbredden.
 */
function foldLongTexts(){
    const candidates = [...document.querySelectorAll('.explainer, [data-fold]')].filter(node =>
        !node.closest('details, dialog, template, .settings-panel') &&
        node.style.display !== 'none' && !node.hidden &&
        (node.dataset.fold || node.textContent.trim().length >= FOLD_MIN_CHARS));
    candidates.forEach(node => {
        if(node.closest('details')) return;          // ligger allerede i en større fold
        const label = node.dataset.fold || (node.classList.contains('explainer-lead') ? 'Læs mere' : 'Vis forklaring');
        const details = el('details', {className:'fold'}, [el('summary', {className:'fold-summary', textContent: label})]);
        node.replaceWith(details);
        details.append(node);
    });
    syncFolds();
}

/** Åbne på computer, lukkede på telefon. */
function syncFolds(){
    document.querySelectorAll('details.fold').forEach(d => { d.open = !phoneQuery.matches; });
}

/**
 * Tekst-tabeller (skatteregler, kontotyper, brancher) vises som kort på
 * telefoner. Hver celle får sin kolonneoverskrift som data-label, så CSS kan
 * skrive den over indholdet, når tabellen er stablet.
 */
function labelStackedTables(){
    document.querySelectorAll('table.etf-rules').forEach(table => {
        const heads = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
        table.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if(heads[i]) td.dataset.label = heads[i]; }));
    });
}

phoneQuery.addEventListener('change', syncFolds);
foldLongTexts();
labelStackedTables();
