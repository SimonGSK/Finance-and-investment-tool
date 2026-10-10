/**
 * @file Månedsoverblik: vælg et år og en måned (eller hele året) og se, hvor meget
 * nettoformuen, pensionen og hver af de andre kategorier er steget eller faldet i
 * perioden, og hvad porteføljen gav i afkast, når egne indskud er trukket fra.
 * Tallene kommer fra månedsstatusserne (Formue) og Porteføljetrackeren; beregningerne
 * ligger i calc.js (periodBounds, periodRows, periodReturn, yearInNumbers).
 *
 * Vælger man "Hele året", vises "Dit år i tal" øverst, som også kan deles som et billede
 * (med eller uden beløb). Hver kategori har en lille kurve over det seneste år, og under
 * nøgletallene står årets bedste og værste måned.
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

/**
 * Navnet på et skridt mellem to månedsstatusser: måneden, det slutter i ("marts"), eller
 * - når der mangler en status - månederne, det dækker ("aug.–sep.").
 * @param {{from:string, to:string, months:number}} step
 * @param {boolean} [withSpan] tilføj "(2 mdr.)" ved flere måneder
 */
function stepLabel(step, withSpan = true){
    const name = (iso, fmt) => new Date(iso.slice(0, 7) + '-15T00:00:00').toLocaleDateString('da-DK', {month: fmt});
    if(step.months <= 1) return name(step.to, 'long');
    return `${name(addMonthsIso(step.from, 1), 'short')}–${name(step.to, 'short')}${withSpan ? ` (${step.months} mdr.)` : ''}`;
}

/**
 * En lille kurve (inline SVG) over værdierne, farvet efter om udviklingen er god.
 * @param {number[]} values
 * @param {boolean} [inverse] en stigning er dårlig (gæld)
 * @returns {string} SVG-markup, eller '' med under to værdier
 */
function sparkline(values, inverse = false){
    if(values.length < 2) return '';
    const w = 64, h = 18, min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
    const pts = values.map((v, i) => `${(i / (values.length - 1) * w).toFixed(1)},${(h - 2 - (v - min) / range * (h - 4)).toFixed(1)}`).join(' ');
    const good = (values.at(-1) - values[0]) * (inverse ? -1 : 1);
    return `<svg class="spark ${good > 0 ? 'is-up' : good < 0 ? 'is-down' : ''}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}"/></svg>`;
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

const MONTH_NAMES = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];

/**
 * "Dit år i farver": tolv firkanter, én pr. måned, grøn for en stigning og rød for et fald
 * (stærkere farve = større ændring, se yearColors i calc.js). Peger man på eller vælger en
 * måned, står ændringen under firkanterne, og et klik åbner måneden.
 * @param {{date:string, value:number}[]} history
 * @param {number} year
 * @param {number|null} selected den valgte måned (null = hele året)
 */
function renderYearColors(history, year, selected){
    const cells = yearColors(history, year, todayIso());
    const detail = document.getElementById('yearColorsDetail');
    document.getElementById('yearColorsTitle').textContent = `Dit år i farver – ${year}`;
    const describe = c => {
        const name = MONTH_NAMES[c.month - 1].replace(/^./, ch => ch.toUpperCase());
        if(c.state === 'future') return `${name}: endnu ikke`;
        if(c.state === 'none') return `${name}: ingen månedsstatus`;
        if(c.state === 'first') return `${name}: din første månedsstatus – intet at sammenligne med`;
        return `${name}: ${formatSignedKr(c.change)}${c.months > 1 ? ` (${c.months} mdr.)` : ''}`;
    };
    const resting = () => {
        const chosen = selected && cells[selected - 1];
        detail.textContent = chosen ? describe(chosen) : 'Peg på en måned for at se ændringen.';
    };
    document.getElementById('yearColorsGrid').replaceChildren(...cells.map(c => {
        const active = !['none', 'future'].includes(c.state);
        const tone = c.state === 'up' ? 'is-up' : c.state === 'down' ? 'is-down' : c.state === 'flat' ? 'is-flat' : `is-${c.state}`;
        const cell = el('button', {type: 'button', className: `ycell ${tone}${c.level ? ' l' + c.level : ''}${c.month === selected ? ' is-selected' : ''}`,
            disabled: !active, attrs: {'aria-label': describe(c), 'aria-pressed': String(c.month === selected)}}, [
            el('span', {className: 'ycell-box', attrs: {'aria-hidden': 'true'}}),
            el('span', {className: 'ycell-name', textContent: MONTH_NAMES[c.month - 1].slice(0, 3), attrs: {'aria-hidden': 'true'}})
        ]);
        if(active) cell.addEventListener('click', () => setMonthPeriod(c.month));
        ['mouseenter', 'focus'].forEach(ev => cell.addEventListener(ev, () => { detail.textContent = describe(c); }));
        ['mouseleave', 'blur'].forEach(ev => cell.addEventListener(ev, resting));
        return cell;
    }));
    resting();
}

/**
 * Noterne fra månedsstatus i den valgte periode ("Note: Bonus" eller, ved flere,
 * "Noter: 31. jan. 2026: Bonus · 30. jun. 2026: Købte bil"). Skjult, når der ingen er.
 * @param {{date:string, note?:string}[]} history
 * @param {{start:object|null, end:object}} bounds
 */
function renderMonthNotes(history, bounds){
    const box = document.getElementById('monthNotes');
    const from = bounds.start ? bounds.start.date : '';
    const notes = history.filter(h => h.note && h.date > from && h.date <= bounds.end.date);
    box.hidden = !notes.length;
    if(!notes.length){ box.replaceChildren(); return; }
    box.replaceChildren(notes.length === 1
        ? el('span', {}, [el('strong', {textContent: 'Note: '}), notes[0].note])
        : el('span', {}, [el('strong', {textContent: 'Noter: '}), notes.map(h => `${formatDanishDate(h.date)}: ${h.note}`).join(' · ')]));
}

/**
 * Åbner Månedsoverblik på en bestemt måned (fx fra beskeden efter en gemt månedsstatus).
 * @param {number} year
 * @param {number} month 1-12
 */
function showMonthOverview(year, month){
    monthSelection = {year, month};
    showSection('month');
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
    const spanMonths = month && bounds.start ? monthSpan(bounds.start.date, bounds.end.date) : 1;
    const spanText = spanMonths > 1 ? ` · ${spanMonths} mdr.` : '';
    const title = periodLabel(year, month).replace(/^./, c => c.toUpperCase());
    document.getElementById('monthRange').replaceChildren(bounds.start
        ? `${title}: fra din månedsstatus ${formatDanishDate(bounds.start.date)} til ${formatDanishDate(bounds.end.date)}.`
        : `${title}: din første månedsstatus (${formatDanishDate(bounds.end.date)}), så der er intet at sammenligne med endnu.`,
        ...(spanMonths > 1 ? [' ', el('span', {className:'month-span', textContent:`${spanMonths} mdr.`,
            attrs:{title:`Der er ingen månedsstatus imellem, så ændringen dækker ${spanMonths} måneder.`}})] : []));

    renderMonthNotes(history, bounds);
    renderYearColors(history, year, month);

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

    // Årets tal: "Dit år i tal" ved hele året, ellers årets bedste og værste måned.
    const yearInfo = yearInNumbers(history, readPortfolioHistory(), year);
    renderYearPanel(month ? null : yearInfo);
    renderMonthBest(month ? yearInfo : null, bounds);

    // Alle kategorier, hver med en lille kurve over året op til periodens slut.
    const sparkFrom = month ? addMonthsIso(bounds.end.date, -12) : (bounds.start || bounds.end).date;
    const sparkPoints = history.slice().sort((a, b) => a.date.localeCompare(b.date))
        .filter(h => h.date >= sparkFrom && h.date <= bounds.end.date);
    document.getElementById('monthTableBody').innerHTML = MONTH_ROWS.map(({key, label, inverse}) => {
        const r = byKey[key];
        const spark = sparkline(sparkPoints.map(h => h[key] || 0), inverse);
        const tone = r.change === null || r.change === 0 ? '' : (r.change > 0) !== !!inverse ? 'is-up' : 'is-down';
        // På telefonen er Start og Slut skjult; de står så med små tal under navnet.
        const fromTo = r.start === null ? DK.format(r.end) : `${DK.format(r.start)} → ${DK.format(r.end)}`;
        return `<tr><td><div class="month-cat"><span>${label}</span>${spark}</div><span class="month-sub">${fromTo}</span></td>`
            + `<td data-csv="${r.start ?? ''}">${r.start === null ? '–' : DK.format(r.start) + ' kr.'}</td>`
            + `<td data-csv="${r.end}">${DK.format(r.end)} kr.</td>`
            + `<td class="change-cell ${tone}" data-csv="${r.change ?? ''}">${r.change === null ? '–' : formatSignedKr(r.change)}${r.pct === null ? '' : `<span class="month-sub">${formatSignedPct(r.pct)}</span>`}</td>`
            + `<td class="change-cell ${tone}">${r.pct === null ? '–' : formatSignedPct(r.pct)}</td></tr>`;
    }).join('');
}

/**
 * Under nøgletallene: årets bedste og værste måned, og et mærke, hvis den valgte
 * måned er en af dem.
 * @param {object|null} info fra yearInNumbers (null skjuler linjen)
 * @param {{start:object|null, end:object}} bounds den valgte måneds start og slut
 */
function renderMonthBest(info, bounds){
    const box = document.getElementById('monthBest');
    box.hidden = !info || !info.best;
    if(box.hidden) return;
    // To linjer i "Dit år i farver" (året står allerede i kortets titel).
    const line = (label, step) => el('div', {className:'month-best-row'}, [el('span', {className:'month-best-label', textContent: label + ' '}),
        el('strong', {textContent: stepLabel(step)}), ' ',
        el('span', {className: step.change > 0 ? 'is-up' : step.change < 0 ? 'is-down' : '', textContent: formatSignedKr(step.change)})]);
    box.replaceChildren(line('Bedste måned', info.best), ...(info.worst ? [line('Værste måned', info.worst)] : []));
    const isStep = step => step && bounds.start && step.from === bounds.start.date && step.to === bounds.end.date;
    const badge = isStep(info.best) ? ['Årets bedste måned', 'is-up'] : isStep(info.worst) ? ['Årets værste måned', 'is-down'] : null;
    if(badge) document.getElementById('monthRange').append(' ', el('span', {className:`month-badge ${badge[1]}`, textContent: badge[0]}));
}

/**
 * "Dit år i tal" (kun ved "Hele året"): en indledende sætning om årets udvikling og
 * de vigtigste tal, plus knappen, der deler året som billede.
 * @param {object|null} info fra yearInNumbers (null skjuler panelet)
 */
function renderYearPanel(info){
    const panel = document.getElementById('yearPanel');
    panel.hidden = !info;
    if(!info) return;
    const tone = n => n > 0 ? 'is-up' : n < 0 ? 'is-down' : '';
    const fact = (label, value, sub, cls = '') => el('div', {className:'year-fact'}, [
        el('dt', {textContent: label}), el('dd', {className: cls, textContent: value}), sub ? el('dd', {className:'year-fact-sub', textContent: sub}) : '']);
    const p = info.portfolio;
    const facts = [
        info.best ? fact('Bedste måned', stepLabel(info.best), `${formatSignedKr(info.best.change)}${info.best.pct !== null ? ` (${formatSignedPct(info.best.pct)})` : ''}`) : '',
        info.worst ? fact('Værste måned', stepLabel(info.worst), `${formatSignedKr(info.worst.change)}${info.worst.pct !== null ? ` (${formatSignedPct(info.worst.pct)})` : ''}`) : '',
        fact('Måneder med fremgang', `${info.ups} af ${info.steps}`, info.steps !== info.statuses ? `${info.statuses} månedsstatusser i ${info.year}` : ''),
        p ? fact('Porteføljens afkast', formatSignedKr(p.gain), `${p.pct !== null ? formatSignedPct(p.pct) + ' · ' : ''}markedsudvikling`, tone(p.gain)) : '',
        p ? fact('Egne indskud', formatSignedKr(p.flows), 'i porteføljen') : '',
        p ? fact('Udbytte', `${DK.format(p.dividends)} kr.`, 'i porteføljen') : ''
    ];
    const verb = info.change > 0 ? 'steg' : info.change < 0 ? 'faldt' : 'stod stille';
    panel.replaceChildren(
        el('div', {className:'panel-title-row'}, [
            el('div', {}, [el('h2', {className:'panel-title', textContent: 'Dit år i tal'}),
                el('p', {className:'panel-sub', textContent: `${info.year} · fra ${formatDanishDate(info.from)} til ${formatDanishDate(info.to)}`})]),
            el('button', {className:'btn btn-secondary btn-sm', type:'button', textContent:'Del som billede', onclick: () => openYearShare(info)})
        ]),
        el('p', {className:'year-lead'}, [`Din nettoformue ${verb} `,
            el('strong', {className: tone(info.change), textContent: `${formatSignedKr(info.change).replace(/^[+−]/, '')}${info.pct !== null ? ` (${formatSignedPct(info.pct)})` : ''}`}),
            ` i ${info.year}.`]),
        el('dl', {className:'year-facts'}, facts.filter(Boolean))
    );
}

/**
 * Tegner året som et billede (1080 × 1350, til fx Instagram eller en besked).
 * @param {object} info fra yearInNumbers
 * @param {boolean} showAmounts false = kun procenter og antal, ingen beløb
 * @returns {Promise<HTMLCanvasElement>}
 */
async function drawYearImage(info, showAmounts){
    await Promise.all(['600 80px Newsreader', '500 30px Manrope', '600 30px Manrope'].map(f => document.fonts.load(f).catch(() => {})));
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
    const x = canvas.getContext('2d');
    const C = {bg:'#F3F1EB', ink:'#14231C', muted:'#4B5A52', green:'#0B6B4F', up:'#0B7A55', down:'#B4473A', line:'#E4E0D5'};
    x.fillStyle = C.bg; x.fillRect(0, 0, 1080, 1350);
    // Logo og navn
    const icon = await new Promise(res => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = 'icons/icon-192.png'; });
    if(icon) x.drawImage(icon, 90, 90, 84, 84);
    x.fillStyle = C.ink; x.font = '600 46px Newsreader, Georgia, serif'; x.fillText('Økonomis', 196, 148);
    // Titel
    x.fillStyle = C.muted; x.font = '600 34px Manrope, system-ui, sans-serif'; x.fillText('MIT ÅR I TAL', 90, 290);
    x.fillStyle = C.green; x.font = '600 180px Newsreader, Georgia, serif'; x.fillText(String(info.year), 80, 450);
    const pctText = p => p === null ? '' : formatSignedPct(p);
    const kr = n => formatSignedKr(n);
    const rows = [
        ['Nettoformue', showAmounts ? `${kr(info.change)}${info.pct !== null ? `  ${pctText(info.pct)}` : ''}` : (pctText(info.pct) || '–'), info.change],
        info.best ? ['Bedste måned', `${stepLabel(info.best, false)}  ${showAmounts ? kr(info.best.change) : pctText(info.best.pct)}`, info.best.change] : null,
        ['Måneder med fremgang', `${info.ups} af ${info.steps}`, 0],
        info.portfolio ? ['Porteføljens afkast', showAmounts ? `${kr(info.portfolio.gain)}${info.portfolio.pct !== null ? `  ${pctText(info.portfolio.pct)}` : ''}` : (pctText(info.portfolio.pct) || '–'), info.portfolio.gain] : null,
        info.portfolio && showAmounts ? ['Udbytte', `${DK.format(info.portfolio.dividends)} kr.`, 0] : null
    ].filter(Boolean);
    let y = 560;
    rows.forEach(([label, value, sign]) => {
        x.fillStyle = C.line; x.fillRect(90, y - 10, 900, 2);
        x.fillStyle = C.muted; x.font = '500 32px Manrope, system-ui, sans-serif'; x.fillText(label, 90, y + 46);
        x.fillStyle = sign > 0 ? C.up : sign < 0 ? C.down : C.ink; x.font = '600 58px Newsreader, Georgia, serif'; x.fillText(value, 90, y + 110);
        y += 136;
    });
    x.fillStyle = C.muted; x.font = '500 26px Manrope, system-ui, sans-serif';
    x.fillText(`${formatDanishDate(info.from)} – ${formatDanishDate(info.to)} · lavet med Økonomis`, 90, 1290);
    return canvas;
}

/**
 * "Del som billede": en forhåndsvisning med valget "Vis beløb" (fra som udgangspunkt, så
 * man ikke deler sine tal ved et uheld), og knappen Del (telefonens delemenu) eller Gem billede.
 * @param {object} info fra yearInNumbers
 */
function openYearShare(info){
    const amounts = el('input', {type:'checkbox'});
    const preview = el('img', {className:'year-share-preview', alt:`Mit år i tal ${info.year}`});
    const fileName = `mit-aar-i-tal-${info.year}.png`;
    let blob = null;
    const redraw = async () => {
        const canvas = await drawYearImage(info, amounts.checked);
        preview.src = canvas.toDataURL('image/png');
        blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    };
    amounts.addEventListener('change', redraw);
    const canShareFiles = typeof navigator.canShare === 'function' && navigator.canShare({files: [new File([new Blob()], 'x.png', {type:'image/png'})]});
    openDialog({
        title: 'Del dit år',
        content: el('div', {className:'year-share'}, [
            el('label', {className:'toggle-row'}, [amounts, el('span', {className:'toggle-text', textContent:'Vis beløb (ellers kun procenter og antal)'})]),
            preview
        ]),
        actions: [
            {label: 'Luk', variant: 'secondary'},
            {label: canShareFiles ? 'Del' : 'Gem billede', variant: 'primary', onClick: () => {
                if(!blob) return false;
                if(canShareFiles){
                    navigator.share({files: [new File([blob], fileName, {type:'image/png'})], title: `Mit år i tal ${info.year}`}).catch(() => {});
                } else {
                    downloadBlob(blob, fileName);
                }
            }}
        ]
    });
    redraw();
}
