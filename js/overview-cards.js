/**
 * @file "Tilpas oversigt": hvilke kort Oversigt viser og i hvilken rækkefølge, og hvilke fire
 * nøgletal der står øverst. Hvert nøgletal kan være et af tallene nedenfor, ordnet efter, hvor
 * de kommer fra (Formue, Månedsoverblik, Portefølje, FIRE, Budget). Valgene huskes i
 * localStorage ('overviewLayout' og 'overviewCards'). Selve tegningen sker i renderOverview (overview.js).
 */

const OVERVIEW_CARDS_KEY = 'overviewCards';
const DEFAULT_OVERVIEW_CARDS = ['netWorth', 'portfolio', 'budget', 'growth'];

/** Ændringen siden forrige månedsstatus i et felt, som tekst til et korts undertekst. */
function sinceLastStatus(ctx, key, inverse = false){
    const last = periodChanges(ctx.nwHistory, h => h[key] || 0).at(-1);
    if(!last) return {sub: 'Gem en månedsstatus for at følge udviklingen', subTone: ''};
    const good = inverse ? -last.change : last.change;
    return {sub: `${formatSignedKr(last.change)} siden ${shortDate(last.from)}`, subTone: good > 0 ? 'up' : good < 0 ? 'down' : ''};
}

/**
 * Et kort fra Formue: den aktuelle værdi og ændringen siden forrige månedsstatus.
 * @param {string} id
 * @param {string} label
 * @param {string} key feltet i Formue og historikken
 * @param {boolean} [inverse] en stigning er dårlig (gæld)
 */
function formueCard(id, label, key, inverse = false){
    return {id, label, render: ctx => {
        if(!ctx.hasNetWorth) return {value: '–', sub: 'Udfyld din formue'};
        const value = key === 'debt' ? ctx.figures.debt : ctx.figures[key];
        return {value: DK.format(value || 0) + ' kr.', cls: !inverse && value < 0 ? 'negative' : '', ...sinceLastStatus(ctx, key, inverse)};
    }};
}

/**
 * Alle kort, ordnet i grupper efter hvor tallene kommer fra. `render(ctx)` giver
 * {value, sub, cls, subTone}: cls 'negative' farver tallet rødt, subTone 'up'/'down'
 * farver underteksten grøn/rød. Kortene med et fast id bruger de id'er, siden altid har haft.
 */
const OVERVIEW_CARD_GROUPS = [
    {label: 'Formue', opens: ['Formue', () => showSection('formue')], cards: [
        {id: 'netWorth', elId: 'ovNetWorth', label: 'Nettoformue', render: ctx => !ctx.hasNetWorth ? {value: '–', sub: 'Udfyld din formue'}
            : {value: DK.format(ctx.figures.value) + ' kr.', cls: ctx.figures.value < 0 ? 'negative' : '', ...sinceLastStatus(ctx, 'value')}},
        formueCard('liquid', 'Likvid formue', 'liquid'),
        formueCard('pension', 'Pension', 'netCatPension'),
        formueCard('debt', 'Gæld', 'debt', true)
    ]},
    {label: 'Månedsoverblik', opens: ['Månedsoverblik', () => showSection('month')], cards: [
        {id: 'growth', elId: 'ovGrowth', label: 'Stigning pr. måned', render: ctx => {
            const growth = monthlyTrend(ctx.nwHistory, 'value');
            const recent = recentChange(ctx.nwHistory, 'value');
            if(growth === null || !recent) return {value: '–', sub: 'Kræver to månedsstatusser'};
            return {value: formatSignedKr(Math.round(growth)), cls: growth < 0 ? 'negative' : '',
                sub: recent.fullYear ? 'i snit det seneste år' : `i snit siden ${shortDate(recent.from)}`};
        }},
        {id: 'growthPct', label: 'Procentvis stigning', render: ctx => {
            const recent = recentChange(ctx.nwHistory, 'value');
            if(!recent || recent.pct === null) return {value: '–', sub: 'Kræver to månedsstatusser'};
            return {value: (recent.pct >= 0 ? '+' : '−') + formatPct(Math.abs(recent.pct)), cls: recent.pct < 0 ? 'negative' : '',
                sub: recent.fullYear ? 'nettoformuen det seneste år' : `nettoformuen siden ${formatDanishDate(recent.from)}`};
        }},
        {id: 'thisYear', label: 'Stigning i år', render: ctx => {
            const year = yearSummary(ctx.nwHistory, h => h.value).find(y => y.year === ctx.year);
            if(!year) return {value: '–', sub: `Kræver to månedsstatusser i ${ctx.year}`};
            return {value: formatSignedKr(year.change), cls: year.change < 0 ? 'negative' : '',
                sub: `nettoformuen siden ${shortDate(year.startDate)}${year.start ? ` (${formatSignedPct(year.change / Math.abs(year.start))})` : ''}`};
        }}
    ]},
    {label: 'Portefølje', opens: ['Portefølje', () => showSection('portfolio')], cards: [
        {id: 'portfolio', elId: 'ovPortfolio', label: 'Porteføljeværdi', render: ctx => {
            const t = ctx.ptTotals;
            if(!t) return {value: '–', sub: 'Ingen datapunkter endnu'};
            const y = yearSummary(ctx.ptHistory, h => h.portfolioValue, h => h.deposit).find(r => r.year === ctx.year);
            return {value: DK.format(t.value) + ' kr.',
                sub: y ? `${formatSignedKr(y.gain)} i afkast i år${y.pct !== null ? ` (${formatSignedPct(y.pct)})` : ''}` : `pr. ${shortDate(t.date)}`,
                subTone: y ? (y.gain >= 0 ? 'up' : 'down') : ''};
        }},
        {id: 'invested', label: 'Totalt investeret', render: ctx => !ctx.ptTotals ? {value: '–', sub: 'Ingen datapunkter endnu'}
            : {value: DK.format(ctx.ptTotals.invested) + ' kr.', sub: `nettokøb siden ${formatDanishDate(ctx.ptHistory[0].date)}`}},
        {id: 'totalReturn', label: 'Totalt afkast', render: ctx => {
            const t = ctx.ptTotals;
            if(!t) return {value: '–', sub: 'Ingen datapunkter endnu'};
            return {value: formatSignedKr(t.gain), cls: t.gain < 0 ? 'negative' : '',
                sub: t.gainPct !== null ? `${formatSignedPct(t.gainPct)} af dine indskud` : 'værdien minus dine indskud'};
        }},
        {id: 'dividends', label: 'Udbytte i alt', render: ctx => !ctx.ptTotals ? {value: '–', sub: 'Ingen datapunkter endnu'}
            : {value: DK.format(ctx.ptTotals.dividends) + ' kr.', sub: `${DK.format(ctx.ptTotals.dividendsThisYear)} kr. i ${ctx.year}`}},
        {id: 'annualReturn', label: 'Afkast pr. år', render: ctx => {
            const h = ctx.ptHistory;
            const days = h.length > 1 ? (Date.parse(h.at(-1).date) - Date.parse(h[0].date)) / DAY_MS : 0;
            const rate = days >= 90 ? xirr(portfolioCashFlows(h)) : null;
            if(rate === null) return {value: '–', sub: days < 90 ? 'Kræver mindst 3 måneders datapunkter' : 'Kan ikke beregnes ud fra dataene'};
            return {value: formatSignedPct(rate), cls: rate < 0 ? 'negative' : '',
                sub: days < 365 ? `omregnet til år fra ${Math.round(days / 30)} mdr.` : `pengevægtet siden ${formatDanishDate(h[0].date)}`};
        }}
    ]},
    {label: 'FIRE', opens: ['FIRE-beregneren', () => showTool(3)], cards: [
        // Som i FIRE-beregneren: 25 × årligt forbrug (budgettet uden opsparing), målt mod den likvide formue.
        {id: 'fire', label: 'FIRE-fremskridt', render: ctx => {
            if(!ctx.hasNetWorth) return {value: '–', sub: 'Udfyld din formue'};
            const f = fireProgress({wealth: ctx.figures.liquid || 0, monthlyExpenses: ctx.budgetSum - ctx.savings});
            if(!f) return {value: '–', sub: 'Kræver et budget med dit forbrug'};
            return {value: formatPct(Math.min(f.pct, 9.99), f.pct < 0.1 ? 1 : 0),
                sub: f.reached ? `FIRE-tallet på ${DK.format(Math.round(f.target))} kr. er nået`
                    : `${DK.format(Math.round(ctx.figures.liquid || 0))} af ${DK.format(Math.round(f.target))} kr.`,
                subTone: f.reached ? 'up' : ''};
        }}
    ]},
    {label: 'Budget', opens: ['Budget', () => showSection('budget')], cards: [
        {id: 'budget', elId: 'ovBudget', label: 'Budget pr. måned', render: ctx => ctx.budgetSum <= 0 ? {value: '–', sub: 'Byg dit budget'}
            : {value: DK.format(ctx.budgetSum) + ' kr.', cls: ctx.budgetTotal > 0 && ctx.budgetTotal - ctx.budgetSum < 0 ? 'negative' : '',
                sub: ctx.budgetTotal > 0 ? `${DK.format(ctx.budgetTotal - ctx.budgetSum)} kr. tilbage` : `${Math.round(ctx.savings / ctx.budgetSum * 100)} % går til opsparing`}},
        {id: 'buffer', elId: 'ovBuffer', label: 'Nødopsparing', opens: ['Formue', () => showSection('formue')], render: ctx => ctx.bufferMonths === null ? {value: '–', sub: 'Kræver et budget og dine kontanter'}
            : {value: `${ctx.bufferMonths.toFixed(1).replace('.', ',')} mdr.`, cls: ctx.bufferMonths < 3 ? 'negative' : '',
                sub: ctx.bufferMonths >= 6 ? 'En solid buffer' : ctx.bufferMonths >= 3 ? 'Inden for anbefalingen' : 'Under anbefalingen på 3 mdr.'}}
    ]}
];

/**
 * Værdierne for de seneste 12 måneder i en historik - til et korts lille kurve.
 * @param {Object[]} history sorteret efter dato
 * @param {(h:Object, i:number) => number} valueOf
 * @returns {number[]} tom med under to punkter
 */
function lastYearValues(history, valueOf){
    if(history.length < 2) return [];
    const from = addMonthsIso(history.at(-1).date, -12);
    return history.map((h, i) => [h.date, valueOf(h, i)]).filter(([date]) => date >= from).map(([, v]) => v);
}

/** Den løbende sum af et felt (fx indskud eller udbytte) til hvert punkt i historikken. */
function runningSum(history, key){
    let sum = 0;
    return history.map(h => (sum += h[key] || 0));
}

/**
 * Kurven i hvert kort på Oversigt (på større skærme): hvad tallet bygger på over de seneste
 * 12 måneder. inverse: en stigning er dårlig (gæld). Budget har ingen historik og ingen kurve.
 */
const CARD_SPARKS = {
    netWorth: ctx => ({values: lastYearValues(ctx.nwHistory, h => h.value || 0)}),
    liquid: ctx => ({values: lastYearValues(ctx.nwHistory, h => h.liquid ?? 0)}),
    pension: ctx => ({values: lastYearValues(ctx.nwHistory, h => h.netCatPension || 0)}),
    debt: ctx => ({values: lastYearValues(ctx.nwHistory, h => h.debt || 0), inverse: true}),
    growth: ctx => CARD_SPARKS.netWorth(ctx),
    growthPct: ctx => CARD_SPARKS.netWorth(ctx),
    thisYear: ctx => CARD_SPARKS.netWorth(ctx),
    portfolio: ctx => ({values: lastYearValues(ctx.ptHistory, h => h.portfolioValue || 0)}),
    invested: ctx => { const sums = runningSum(ctx.ptHistory, 'traded'); return {values: lastYearValues(ctx.ptHistory, (h, i) => sums[i])}; },
    totalReturn: ctx => { const sums = runningSum(ctx.ptHistory, 'deposit'); return {values: lastYearValues(ctx.ptHistory, (h, i) => (h.portfolioValue || 0) - sums[i])}; },
    annualReturn: ctx => CARD_SPARKS.totalReturn(ctx),
    dividends: ctx => { const sums = runningSum(ctx.ptHistory, 'dividend'); return {values: lastYearValues(ctx.ptHistory, (h, i) => sums[i])}; },
    fire: ctx => CARD_SPARKS.liquid(ctx),
    buffer: ctx => ({values: lastYearValues(ctx.nwHistory, h => h.netCatKontanter || 0)})
};

/**
 * Skjuler et korts kurve, hvis den ville ramme kortets tekst (fx en lang overskrift eller et
 * stort tal) - så overlapper intet. Kaldes efter tegning og når vinduet skifter størrelse.
 */
function fitOverviewSparks(){
    document.querySelectorAll('#ovKpis .ov-spark').forEach(spark => {
        spark.classList.remove('is-cramped');
        if(!spark.offsetParent) return;
        const s = spark.getBoundingClientRect();
        // Selve teksten måles (ikke dens boks, som er lige så bred som kortet).
        const range = document.createRange();
        const hits = [...spark.parentElement.children].filter(c => c !== spark && !c.classList.contains('visually-hidden')).some(c => {
            range.selectNodeContents(c);
            return [...range.getClientRects()].some(r => r.width && r.left < s.right + 6 && r.right > s.left - 6 && r.top < s.bottom + 2 && r.bottom > s.top - 2);
        });
        spark.classList.toggle('is-cramped', hits);
    });
}
let fitSparksFrame = 0;
window.addEventListener('resize', () => { cancelAnimationFrame(fitSparksFrame); fitSparksFrame = requestAnimationFrame(fitOverviewSparks); });
// Teksten får sin endelige bredde, når skrifttyperne er hentet.
document.fonts?.ready.then(fitOverviewSparks);

// Hvert kort åbner den side, tallet kommer fra (gruppens side, medmindre kortet selv siger andet).
const OVERVIEW_CARDS = Object.fromEntries(OVERVIEW_CARD_GROUPS.flatMap(g => g.cards.map(c => ({opens: g.opens, ...c}))).map(c => [c.id, c]));

/** Procent med fortegn, fx "+2,4 %". Bruges også af Månedsoverblik. */
function formatSignedPct(p){
    return (p > 0 ? '+' : p < 0 ? '−' : '') + formatPct(Math.abs(p));
}

/** @returns {string[]} de fire valgte kort (standardvalget, hvis intet gyldigt er gemt). */
function readOverviewCards(){
    try{
        const ids = JSON.parse(localStorage.getItem(OVERVIEW_CARDS_KEY));
        if(Array.isArray(ids) && ids.length === 4 && ids.every(id => OVERVIEW_CARDS[id])) return ids;
    } catch(e){}
    return DEFAULT_OVERVIEW_CARDS.slice();
}

/**
 * Tegner de valgte kort i #ovKpis.
 * @param {object} ctx tallene, kortene regner ud fra (se renderOverview)
 */
function renderOverviewCards(ctx){
    const box = document.getElementById('ovKpis');
    box.replaceChildren(...readOverviewCards().map(id => {
        const card = OVERVIEW_CARDS[id];
        const elId = card.elId || 'ov' + id[0].toUpperCase() + id.slice(1);
        const r = card.render(ctx);
        const sub = el('div', {className: 'sub' + (r.subTone === 'up' ? ' is-up' : r.subTone === 'down' ? ' is-down' : ''), id: elId + 'Sub', textContent: r.sub || ''});
        // Hele kortet er en knap til siden, tallet kommer fra ("›" i hjørnet viser det).
        const [page, open] = card.opens;
        return el('button', {className: 'stat stat-link', type: 'button', attrs: {'data-card': id}, onclick: open}, [
            el('div', {className: 'label', textContent: card.label}),
            el('div', {className: 'value' + (r.cls === 'negative' ? ' negative' : ''), id: elId, textContent: r.value}),
            sub,
            el('span', {className: 'stat-spark ov-spark', attrs: {'aria-hidden': 'true', title: 'De seneste 12 måneder'},
                innerHTML: CARD_SPARKS[id] ? (({values, inverse}) => sparkline(values, inverse))(CARD_SPARKS[id](ctx)) : ''}),
            el('span', {className: 'stat-go', textContent: '›', attrs: {'aria-hidden': 'true'}}),
            el('span', {className: 'visually-hidden', textContent: ` – åbn ${page}`})
        ]);
    }));
    fitOverviewSparks();
}

const OVERVIEW_LAYOUT_KEY = 'overviewLayout';
const OVERVIEW_SECTION_LABELS = {kpis: 'Nøgletal', chart: 'Nettoformue over tid', split: 'Fordeling', goals: 'Mine mål', next: 'Næste skridt', tools: 'Værktøjer'};

/** @returns {{hidden:string[], order:string[]|null}} de skjulte kort og rækkefølgen (null: standard) */
function readOverviewLayout(){
    try{ return normalizeOverviewLayout(JSON.parse(localStorage.getItem(OVERVIEW_LAYOUT_KEY))); }
    catch(e){ return normalizeOverviewLayout(null); }
}

/** Standardrækkefølgen, som den ses nu: i én kolonne (telefon og tablet) står grafen over nøgletallene. */
function defaultOverviewOrder(){
    return matchMedia('(max-width:1250px)').matches ? ['chart', 'kpis', 'split', 'goals', 'next', 'tools'] : OVERVIEW_SECTIONS.slice();
}

/**
 * Skjuler og ordner kortene på Oversigt efter valget. I én kolonne følger kortene rækkefølgen
 * præcist. På en computer står kortene i to kolonner: hver kolonne følger rækkefølgen, og de
 * to kolonner står dér, hvor deres første kort er. En tom kolonne forsvinder, så den anden
 * får hele bredden. Kaldes, når siden tegnes (også når "Næste skridt" bliver tomt).
 */
function applyOverviewLayout(){
    const {hidden, order} = readOverviewLayout();
    const page = document.getElementById('section-overview');
    const place = id => order ? String(order.indexOf(id)) : '';
    page.querySelectorAll('[data-ov-section]').forEach(node => {
        node.classList.toggle('is-off', hidden.includes(node.dataset.ovSection));
        node.style.order = place(node.dataset.ovSection);
    });
    const grid = page.querySelector('.overview-grid');
    const inGrid = [...grid.querySelectorAll('[data-ov-section]')];
    grid.style.order = order ? String(Math.min(...inGrid.map(n => order.indexOf(n.dataset.ovSection)))) : '';
    const shown = node => !node.hidden && !node.classList.contains('is-off');
    const columns = [...grid.querySelectorAll(':scope > .ov-side')];
    columns.forEach(col => col.classList.toggle('is-empty', ![...col.children].some(shown)));
    grid.classList.toggle('is-single', columns.some(col => col.classList.contains('is-empty')));
    grid.classList.toggle('is-empty', columns.every(col => col.classList.contains('is-empty')));
}

/**
 * Kortene på siden i dialogen: hvert kort kan slås fra og flyttes op eller ned med pilene.
 * @param {{hidden:string[], order:string[]}} state ændres her; moved sættes, når et kort flyttes
 * @returns {HTMLElement}
 */
function overviewSectionsChooser(state){
    const box = el('div', {className: 'ov-sections-chooser'});
    const render = focus => {
        const visible = state.order.filter(id => !state.hidden.includes(id));
        box.replaceChildren(...state.order.map((id, i) => {
            const label = OVERVIEW_SECTION_LABELS[id];
            const on = !state.hidden.includes(id);
            const arrow = (dir, text, name) => el('button', {className: 'ov-section-move', type: 'button', textContent: text,
                disabled: i + dir < 0 || i + dir >= state.order.length,
                attrs: {'aria-label': `Flyt ${label} ${name}`, title: `Flyt ${name}`, 'data-move': `${id}:${dir}`},
                onclick: () => {
                    state.order = moveInList(state.order, id, dir);
                    state.moved = true;
                    render(`${id}:${dir}`);
                }});
            return el('div', {className: 'ov-section-row' + (on ? '' : ' is-off')}, [
                el('label', {className: 'toggle-row'}, [
                    el('input', {type: 'checkbox', checked: on, disabled: on && visible.length === 1,
                        onchange: e => {
                            state.hidden = e.target.checked ? state.hidden.filter(h => h !== id) : state.hidden.concat(id);
                            render();
                            box.querySelectorAll('input')[i].focus();
                        }}),
                    el('span', {textContent: label})
                ]),
                arrow(-1, '↑', 'op'), arrow(1, '↓', 'ned')
            ]);
        }));
        // Pilen, man trykkede på, beholder fokus - eller den anden, når kortet står yderst.
        if(focus){
            const [id, dir] = focus.split(':');
            const btn = box.querySelector(`[data-move="${focus}"]`);
            (btn && !btn.disabled ? btn : box.querySelector(`[data-move="${id}:${-dir}"]`))?.focus();
        }
    };
    render();
    return box;
}

/**
 * "Tilpas oversigt": de fire pladser (Kort 1-4). Et tryk på en plads folder listen over alle
 * kort ud lige under den. Kortet på pladsen har et tydeligt flueben; de tre andre kort, man
 * har nu, er mærket svagt med deres plads ("Kort 3") - vælger man et af dem, bytter de plads.
 * En liste af knapper i stedet for <select>, fordi en vælgers punkter ikke kan mærkes.
 */
function openOverviewCardsDialog(){
    const slots = readOverviewCards();
    let open = null;                                   // den plads, hvis liste er foldet ud
    const labelOf = id => OVERVIEW_CARDS[id]?.label || id;
    const box = el('div', {className: 'cards-chooser-slots'});

    /** Vælger et kort til en plads; har en anden plads det allerede, får den pladsens gamle kort. */
    const choose = (slot, id) => {
        const other = slots.indexOf(id);
        if(other >= 0 && other !== slot) slots[other] = slots[slot];
        slots[slot] = id;
        open = null;
        render();
        box.querySelector(`[data-slot="${slot}"]`)?.focus();
    };

    function render(){
        box.replaceChildren(...slots.map((current, slot) => {
            const listId = `cards-list-${slot}`;
            const btn = el('button', {className: 'card-slot-btn', type: 'button', attrs: {'data-slot': String(slot),
                'aria-expanded': String(open === slot), 'aria-controls': listId, 'aria-label': `Kort ${slot + 1}: ${labelOf(current)}`},
                onclick: () => { open = open === slot ? null : slot; render(); box.querySelector(`#${listId} [aria-checked="true"]`)?.focus(); }}, [
                el('span', {className: 'card-slot-name', textContent: `Kort ${slot + 1}`}),
                el('span', {className: 'card-slot-value', textContent: labelOf(current)})
            ]);
            const list = el('div', {className: 'card-slot-list', id: listId, hidden: open !== slot, attrs: {role: 'radiogroup', 'aria-label': `Vælg kort ${slot + 1}`}},
                OVERVIEW_CARD_GROUPS.flatMap(g => [
                    el('div', {className: 'card-group-label', textContent: g.label, attrs: {'aria-hidden': 'true'}}),
                    ...g.cards.map(c => {
                        const usedAt = slots.indexOf(c.id);
                        const isCurrent = usedAt === slot, isUsed = usedAt >= 0 && !isCurrent;
                        return el('button', {className: `card-option${isCurrent ? ' is-current' : isUsed ? ' is-used' : ''}`, type: 'button',
                            attrs: {role: 'radio', 'aria-checked': String(isCurrent)}, onclick: () => choose(slot, c.id)}, [
                            el('span', {className: 'card-mark', attrs: {'aria-hidden': 'true'}}),
                            el('span', {className: 'card-option-label', textContent: c.label}),
                            isUsed ? el('span', {className: 'card-used', textContent: `Kort ${usedAt + 1}`}) : ''
                        ]);
                    })
                ]));
            return el('div', {className: `card-slot${open === slot ? ' is-open' : ''}`}, [btn, list]);
        }));
    }
    render();

    const layout = readOverviewLayout();
    const sections = {hidden: layout.hidden.slice(), order: layout.order || defaultOverviewOrder(), moved: !!layout.order};

    const save = (ids, sectionsLayout) => {
        try{
            localStorage.setItem(OVERVIEW_CARDS_KEY, JSON.stringify(ids));
            if(sectionsLayout) localStorage.setItem(OVERVIEW_LAYOUT_KEY, JSON.stringify(sectionsLayout));
            else localStorage.removeItem(OVERVIEW_LAYOUT_KEY);
        } catch(e){}
        renderOverview();
    };
    openDialog({
        title: 'Tilpas oversigt',
        content: el('div', {className: 'cards-chooser'}, [
            el('h3', {className: 'cards-chooser-head', textContent: 'Kort på siden'}),
            overviewSectionsChooser(sections),
            el('h3', {className: 'cards-chooser-head', textContent: 'Nøgletal'}),
            el('p', {className: 'dialog-hint', textContent: 'Tryk på en plads for at skifte tallet.'}),
            box
        ]),
        actions: [
            {label: 'Standard', variant: 'secondary', onClick: () => { save(DEFAULT_OVERVIEW_CARDS.slice(), null); }},
            // Rækkefølgen gemmes kun, hvis et kort er flyttet - ellers beholder telefon og computer hver sin.
            {label: 'Gem', variant: 'primary', onClick: () => { save(slots.slice(), {hidden: sections.hidden, order: sections.moved ? sections.order : null}); }}
        ]
    });
}
