/**
 * @file Månedsoverblik: vælg et år og en måned (eller hele året) og se, hvor meget
 * nettoformuen, pensionen og hver af de andre kategorier er steget eller faldet i
 * perioden, og hvad porteføljen gav i afkast, når egne indskud er trukket fra.
 * Tallene kommer fra månedsstatusserne (Formue) og Porteføljetrackeren; beregningerne
 * ligger i calc.js (periodBounds, periodRows, periodReturn).
 */

/** Rækkerne i tabellen: nøgle, navn, og om en stigning er dårlig (gæld). */
const MONTH_ROWS = [
    {key:'value', label:'Nettoformue'},
    {key:'liquid', label:'Likvid formue'},
    ...NET_WORTH_CATEGORIES.map(c => ({key: c.id, label: c.label})),
    {key:'debt', label:'Gæld', inverse:true}
];

/** Valget i vælgerne, så det huskes, mens man skifter side. */
let monthSelection = null;   // {year, month|null}

/** "september 2026" eller "hele 2026". */
function periodLabel(year, month){
    return month ? new Date(year, month - 1, 15).toLocaleDateString('da-DK', {month:'long', year:'numeric'}) : `hele ${year}`;
}

/** Hele måneder mellem to ISO-datoer, fx 31. jul. → 30. sep. = 2. */
function monthsBetween(fromIso, toIso){
    return (Number(toIso.slice(0, 4)) - Number(fromIso.slice(0, 4))) * 12 + Number(toIso.slice(5, 7)) - Number(fromIso.slice(5, 7));
}

/** Procent med fortegn, fx "+2,4 %". */
function formatSignedPct(p){
    return (p > 0 ? '+' : p < 0 ? '−' : '') + formatPct(Math.abs(p));
}

/**
 * Fylder års- og periodevælgeren ud fra de måneder, der har en månedsstatus.
 * @param {{years:number[], months:Object<number, number[]>}} options fra periodOptions
 */
function syncMonthSelects(options){
    const yearSel = document.getElementById('monthYear'), periodSel = document.getElementById('monthPeriod');
    if(!monthSelection || !options.years.includes(monthSelection.year)){
        const year = options.years[0];
        monthSelection = {year, month: options.months[year].at(-1)};
    }
    const {year, month} = monthSelection;
    if(month && !options.months[year].includes(month)) monthSelection.month = options.months[year].at(-1);
    yearSel.replaceChildren(...options.years.map(y => el('option', {value: String(y), textContent: String(y), selected: y === year})));
    periodSel.replaceChildren(
        el('option', {value: '0', textContent: 'Hele året', selected: !monthSelection.month}),
        ...options.months[year].map(m => el('option', {value: String(m),
            textContent: new Date(year, m - 1, 15).toLocaleDateString('da-DK', {month:'long'}), selected: m === monthSelection.month}))
    );
}

/** Nyt år valgt: vis hele året. */
function setMonthYear(year){
    monthSelection = {year, month: null};
    renderMonthOverview();
}

/** Ny periode valgt: en måned (1-12) eller 0 for hele året. */
function setMonthPeriod(month){
    monthSelection = {...monthSelection, month: month || null};
    renderMonthOverview();
}

/**
 * Et nøgletal: ændringen som stort tal, og start → slut under.
 * @param {string} id
 * @param {{start:number|null, end:number, change:number|null, pct:number|null}|null} row
 * @param {boolean} [inverse] en stigning er dårlig (gæld)
 */
function setMonthKpi(id, row, inverse = false, span = ''){
    const valueEl = document.getElementById(id), subEl = document.getElementById(id + 'Sub');
    if(!row || row.change === null){
        valueEl.textContent = row ? DK.format(row.end) + ' kr.' : '–';
        setChangeTone(valueEl, 0);
        subEl.textContent = row ? 'Første månedsstatus – intet at sammenligne med' : '';
        return;
    }
    valueEl.textContent = formatSignedKr(row.change);
    setChangeTone(valueEl, inverse ? -row.change : row.change);
    subEl.textContent = `${DK.format(row.start)} → ${DK.format(row.end)} kr.${row.pct !== null ? ` (${formatSignedPct(row.pct)})` : ''}${span}`;
}

/**
 * Farver et tal grønt, når det er godt (en stigning), og rødt, når det er skidt.
 * @param {HTMLElement} node
 * @param {number} good positiv = godt, negativ = skidt, 0 = neutral (gæld vendes af kalderen)
 */
function setChangeTone(node, good){
    node.classList.toggle('positive', good > 0);
    node.classList.toggle('negative', good < 0);
}

/** Tegner hele Månedsoverblik for det valgte år og den valgte periode. */
function renderMonthOverview(){
    const history = readNetWorthHistory();
    const empty = document.getElementById('monthEmpty'), content = document.getElementById('monthContent');
    const options = periodOptions(history);
    empty.hidden = options.years.length > 0;
    content.hidden = !options.years.length;
    if(!options.years.length) return;

    syncMonthSelects(options);
    const {year, month} = monthSelection;
    const bounds = periodBounds(history, year, month);
    const rows = periodRows(bounds, MONTH_ROWS.map(r => r.key));
    const byKey = Object.fromEntries(rows.map(r => [r.key, r]));

    // Mangler der månedsstatusser, dækker en måned mere end én måned: det markeres ("2 mdr.").
    const spanMonths = month && bounds.start ? monthsBetween(bounds.start.date, bounds.end.date) : 1;
    const spanText = spanMonths > 1 ? ` · ${spanMonths} mdr.` : '';
    const title = periodLabel(year, month).replace(/^./, c => c.toUpperCase());
    document.getElementById('monthRange').replaceChildren(bounds.start
        ? `${title}: fra din månedsstatus ${formatDanishDate(bounds.start.date)} til ${formatDanishDate(bounds.end.date)}.`
        : `${title}: din første månedsstatus (${formatDanishDate(bounds.end.date)}), så der er intet at sammenligne med endnu.`,
        ...(spanMonths > 1 ? [' ', el('span', {className:'month-span', textContent:`${spanMonths} mdr.`,
            attrs:{title:`Der er ingen månedsstatus imellem, så ændringen dækker ${spanMonths} måneder.`}})] : []));

    setMonthKpi('monthNetWorth', byKey.value, false, spanText);
    setMonthKpi('monthPension', byKey.netCatPension, false, spanText);
    setMonthKpi('monthLiquid', byKey.liquid, false, spanText);

    // Porteføljens afkast i samme periode (fra Porteføljetrackeren).
    const ret = periodReturn(readPortfolioHistory(), year, month);
    const retEl = document.getElementById('monthReturn'), retSub = document.getElementById('monthReturnSub');
    retEl.textContent = ret ? formatSignedKr(ret.gain) : '–';
    setChangeTone(retEl, ret ? ret.gain : 0);
    retSub.textContent = ret
        ? `${ret.pct !== null ? formatSignedPct(ret.pct) + ' · ' : ''}${ret.flows ? `${formatSignedKr(ret.flows)} indskudt` : 'ingen indskud'}${ret.dividends ? ` · ${DK.format(ret.dividends)} kr. i udbytte` : ''}`
        : 'Kræver to datapunkter i Porteføljetrackeren';

    // Alle kategorier.
    document.getElementById('monthTableBody').innerHTML = MONTH_ROWS.map(({key, label, inverse}) => {
        const r = byKey[key];
        const tone = r.change === null || r.change === 0 ? '' : (r.change > 0) !== !!inverse ? 'is-up' : 'is-down';
        // På telefonen er Start og Slut skjult; de står så med små tal under navnet.
        const fromTo = r.start === null ? DK.format(r.end) : `${DK.format(r.start)} → ${DK.format(r.end)}`;
        return `<tr><td>${label}<span class="month-sub">${fromTo}</span></td>`
            + `<td data-csv="${r.start ?? ''}">${r.start === null ? '–' : DK.format(r.start) + ' kr.'}</td>`
            + `<td data-csv="${r.end}">${DK.format(r.end)} kr.</td>`
            + `<td class="change-cell ${tone}" data-csv="${r.change ?? ''}">${r.change === null ? '–' : formatSignedKr(r.change)}${r.pct === null ? '' : `<span class="month-sub">${formatSignedPct(r.pct)}</span>`}</td>`
            + `<td class="change-cell ${tone}">${r.pct === null ? '–' : formatSignedPct(r.pct)}</td></tr>`;
    }).join('');
}
