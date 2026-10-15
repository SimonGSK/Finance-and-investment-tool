/**
 * @file "Nyt i Økonomis": en kort liste over, hvad der er nyt, med den nyeste først. Efter en
 * opdatering viser siden én gang en besked med "Se nyt" (unseenNews i calc.js); listen kan
 * altid åbnes igen fra menuen under Hjælp. Datoen på den nyeste nyhed, man har set, gemmes i
 * localStorage ('newsSeen').
 *
 * Ny funktion? Skriv en linje øverst i WHATS_NEW (en ny dato, eller under dagens), i hverdagssprog.
 */

const WHATS_NEW = [
    {date: '2026-10-15', items: [
        'I januar ser Oversigt tilbage på dit forrige år: hvor meget formuen steg, din bedste måned og porteføljens afkast.'
    ]},
    {date: '2026-10-14', items: [
        'Vælg, hvilke kort Oversigt viser, og i hvilken rækkefølge – under Tilpas oversigt.',
        'Fortryd en månedsstatus lige efter, du har gemt den.',
        'Indstillinger er delt i fire grupper, så det er nemmere at finde rundt.',
        'Små kurver over de seneste 12 måneder i nøgletallene på Formue og Oversigt.',
        'Kortere datoer i historiktabellerne på telefonen.'
    ]},
    {date: '2026-10-13', items: [
        'Månedsstatus på telefonen ét felt ad gangen – "Uændret" er ét tryk.',
        'Stryg til siden for at skifte måned i Månedsoverblik.',
        'Tryk på et kort eller en søjle på Oversigt for at se tallene bag.',
        'Skjul et skridt i Næste skridt med ×.'
    ]},
    {date: '2026-10-10', items: [
        'Dit år i farver: årets måneder som grønne og røde felter i Månedsoverblik.',
        'Forklaringerne på kortene ligger bag et "?" i hjørnet.',
        'Mere kompakt på telefonen.'
    ]},
    {date: '2026-10-09', items: [
        'Skriv en note på en månedsstatus – den vises på grafen i Formue.',
        'En kort opsummering, når du har gemt en månedsstatus.',
        'Månedsstatus advarer, hvis et tal ligner en tastefejl, fx et nul for meget.',
        'Tastaturgenveje på computeren – tryk ? for at se dem.'
    ]},
    {date: '2026-10-08', items: [
        'Skjul beløb: øjet øverst slører alle beløb.',
        'Træk arkene i bundmenuen ned for at lukke dem.',
        'Besked, når en ny version af Økonomis er klar.'
    ]},
    {date: '2026-10-05', items: [
        'Bundmenu på telefonen med Trackers, + Status, Værktøjer og Mere.',
        'Kodelås med Face ID eller fingeraftryk.',
        'Læg påmindelsen om månedsstatus i din kalender.'
    ]}
];

const NEWS_SEEN_KEY = 'newsSeen';

/** Husker, at alle nyheder er set. */
function markNewsSeen(){
    try{ localStorage.setItem(NEWS_SEEN_KEY, WHATS_NEW[0].date); } catch(e){}
}

/**
 * Åbner listen. Nyhederne, der var nye, da siden blev åbnet, er mærket "Ny".
 * @param {string[]} [fresh] datoerne på de nye nyheder
 */
function openWhatsNew(fresh = []){
    markNewsSeen();
    const longDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('da-DK', {day: 'numeric', month: 'long', year: 'numeric'});
    openDialog({
        title: 'Nyt i Økonomis',
        content: el('div', {className: 'whats-new'}, WHATS_NEW.map(entry => el('section', {className: 'whats-new-entry'}, [
            el('h3', {className: 'whats-new-date'}, [longDate(entry.date),
                fresh.includes(entry.date) ? el('span', {className: 'whats-new-tag', textContent: 'Ny'}) : '']),
            el('ul', {}, entry.items.map(text => el('li', {textContent: text})))
        ])))
    });
}

// Efter en opdatering: én besked med "Se nyt". Med kodelås først, når appen er låst op.
document.addEventListener('DOMContentLoaded', () => {
    let lastSeen = null;
    try{ lastSeen = localStorage.getItem(NEWS_SEEN_KEY); } catch(e){}
    const fresh = unseenNews(WHATS_NEW, lastSeen, hasUserData());
    if(!fresh.length){ if(!lastSeen) markNewsSeen(); return; }
    const announce = () => {
        markNewsSeen();
        const count = fresh.reduce((n, e) => n + e.items.length, 0);
        notify(`Økonomis er opdateret med ${count === 1 ? 'en nyhed' : count + ' nyheder'}.`, {
            actionLabel: 'Se nyt', onAction: () => openWhatsNew(fresh.map(e => e.date)), duration: 10000
        });
    };
    const root = document.documentElement;
    if(!root.classList.contains('is-locked')){ announce(); return; }
    const watch = new MutationObserver(() => {
        if(root.classList.contains('is-locked')) return;
        watch.disconnect();
        announce();
    });
    watch.observe(root, {attributes: true, attributeFilter: ['class']});
});
