/**
 * @file De fire nøgletal øverst på Oversigt kan vælges frit: "Tilpas" åbner en dialog
 * med fire vælgere, og hvert kort kan være et af tallene nedenfor, ordnet efter, hvor
 * de kommer fra (Formue, Månedsoverblik, Portefølje, Budget). Valget huskes i
 * localStorage ('overviewCards'). Selve tegningen sker i renderOverview (overview.js).
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
    {label: 'Formue', cards: [
        {id: 'netWorth', elId: 'ovNetWorth', label: 'Nettoformue', render: ctx => !ctx.hasNetWorth ? {value: '–', sub: 'Udfyld din formue'}
            : {value: DK.format(ctx.figures.value) + ' kr.', cls: ctx.figures.value < 0 ? 'negative' : '', ...sinceLastStatus(ctx, 'value')}},
        formueCard('liquid', 'Likvid formue', 'liquid'),
        formueCard('pension', 'Pension', 'netCatPension'),
        formueCard('debt', 'Gæld', 'debt', true)
    ]},
    {label: 'Månedsoverblik', cards: [
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
    {label: 'Portefølje', cards: [
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
    {label: 'Budget', cards: [
        {id: 'budget', elId: 'ovBudget', label: 'Budget pr. måned', render: ctx => ctx.budgetSum <= 0 ? {value: '–', sub: 'Byg dit budget'}
            : {value: DK.format(ctx.budgetSum) + ' kr.', cls: ctx.budgetTotal > 0 && ctx.budgetTotal - ctx.budgetSum < 0 ? 'negative' : '',
                sub: ctx.budgetTotal > 0 ? `${DK.format(ctx.budgetTotal - ctx.budgetSum)} kr. tilbage` : `${Math.round(ctx.savings / ctx.budgetSum * 100)} % går til opsparing`}},
        {id: 'buffer', elId: 'ovBuffer', label: 'Nødopsparing', render: ctx => ctx.bufferMonths === null ? {value: '–', sub: 'Kræver et budget og dine kontanter'}
            : {value: `${ctx.bufferMonths.toFixed(1).replace('.', ',')} mdr.`, cls: ctx.bufferMonths < 3 ? 'negative' : '',
                sub: ctx.bufferMonths >= 6 ? 'En solid buffer' : ctx.bufferMonths >= 3 ? 'Inden for anbefalingen' : 'Under anbefalingen på 3 mdr.'}}
    ]}
];

const OVERVIEW_CARDS = Object.fromEntries(OVERVIEW_CARD_GROUPS.flatMap(g => g.cards).map(c => [c.id, c]));

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
        return el('div', {className: 'stat', attrs: {'data-card': id}}, [
            el('div', {className: 'label', textContent: card.label}),
            el('div', {className: 'value' + (r.cls === 'negative' ? ' negative' : ''), id: elId, textContent: r.value}),
            sub
        ]);
    }));
}

/** "Tilpas": fire vælgere, ét pr. kort. Vælger man et kort, der allerede står et andet sted, bytter de plads. */
function openOverviewCardsDialog(){
    const chosen = readOverviewCards();
    const selects = chosen.map((id, i) => {
        const select = el('select', {className: 'number-input', attrs: {'data-slot': String(i)}},
            OVERVIEW_CARD_GROUPS.map(g => el('optgroup', {label: g.label},
                g.cards.map(c => el('option', {value: c.id, textContent: c.label, selected: c.id === id})))));
        select.dataset.previous = id;
        select.addEventListener('change', () => {
            const other = selects.find(s => s !== select && s.value === select.value);
            if(other){ other.value = select.dataset.previous; other.dataset.previous = other.value; }
            select.dataset.previous = select.value;
        });
        return select;
    });
    const save = ids => {
        try{ localStorage.setItem(OVERVIEW_CARDS_KEY, JSON.stringify(ids)); } catch(e){}
        renderOverview();
    };
    openDialog({
        title: 'Tilpas nøgletal',
        content: el('div', {className: 'cards-chooser'}, [
            el('p', {className: 'dialog-hint', textContent: 'Vælg de fire tal øverst på Oversigt. Tallene hentes fra Formue, Månedsoverblik, Porteføljetrackeren og Budget.'}),
            ...selects.map((s, i) => fieldEl(`Kort ${i + 1}`, s))
        ]),
        actions: [
            {label: 'Standard', variant: 'secondary', onClick: () => { save(DEFAULT_OVERVIEW_CARDS.slice()); }},
            {label: 'Gem', variant: 'primary', onClick: () => { save(selects.map(s => s.value)); }}
        ]
    });
}
