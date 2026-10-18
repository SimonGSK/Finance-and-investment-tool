/**
 * @file Oversigt: startsiden med nøgletal for formue, portefølje, budget og
 * nødopsparing, formuen over tid, mål, fordeling, næste skridt og genveje til
 * værktøjerne. Alt læses fra de andre dele (intet gemmes her) og tegnes, når
 * siden vises. Beregningerne ligger i calc.js og de enkelte værktøjers filer.
 */

let overviewChart = null;

/** "#0B6B4F" + 0.4 -> "rgba(11,107,79,0.4)" */
function hexToRgba(hex, alpha){
    const h = hex.trim().replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const shortDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('da-DK', {day:'numeric', month:'short'});

let overviewRange = 0;       // antal år bagud fra seneste datapunkt; 0 = alt

/** Vælger periode i grafen (antal år, 0 = alt). */
function setOverviewRange(years){
    overviewRange = years;
    renderOverviewChart(readNetWorthHistory());
}

/**
 * Fylder periodevælgeren: "Alt" og de perioder, som dataene rækker til
 * (1, 3, 5, 10 år ...). En periode, der er lige så lang som dataene, er det samme som "Alt".
 * @returns {number} den valgte periode i år (0 = alt)
 */
function syncPeriodSelect(history){
    const select = document.getElementById('ovPeriod');
    const choices = history.length > 1 ? periodChoices(history[0].date, history.at(-1).date) : [];
    const chosen = choices.includes(overviewRange) ? overviewRange : 0;
    select.replaceChildren(...[0, ...choices].map(y => el('option', {value: String(y), textContent: y === 0 ? 'Alt' : y === 1 ? '1 år' : `${y} år`, selected: y === chosen})));
    select.closest('.period-select').hidden = !choices.length;
    return chosen;
}

/** Tegner hele oversigten. Kaldes, hver gang siden vises. */
function renderOverview(){
    const figures = currentNetWorthFigures();
    const nwHistory = readNetWorthHistory().slice().sort((a, b) => a.date.localeCompare(b.date));
    const ptHistory = readPortfolioHistory().slice().sort((a, b) => a.date.localeCompare(b.date));
    const {sum: budgetSum, groupSums} = budgetSummary(getBudgetCategories(), loadBudgetItems());
    const budgetTotal = parseFloat(document.getElementById('budgetTotalInput').value) || 0;
    const expenses = budgetSum - groupSums.opsparing;
    const hasNetWorth = figures.assets > 0 || figures.debt > 0 || nwHistory.length > 0;
    const months = emergencyFundMonths(figures.netCatKontanter, expenses);
    const year = new Date().getFullYear();

    // ---- Nøgletal: de fire kort, man har valgt (overview-cards.js) ----
    renderOverviewCards({figures, nwHistory, ptHistory, hasNetWorth, year, budgetSum, budgetTotal,
        savings: groupSums.opsparing, bufferMonths: months, ptTotals: portfolioTotals(ptHistory, year)});

    const latest = [nwHistory.at(-1)?.date, ptHistory.at(-1)?.date].filter(Boolean).sort().at(-1);
    document.getElementById('pageSub').textContent = latest ? `Seneste månedsstatus ${formatDanishDate(latest)} · alle beløb i DKK` : 'Alle beløb i DKK';

    renderOverviewYearReview(nwHistory, ptHistory);
    renderOverviewChart(nwHistory);
    renderOverviewGoals();
    renderOverviewSplit(figures);
    renderOverviewNext({hasNetWorth, budgetSum, months});
}

/** Søjler for de seneste 12 datapunkter i en stigende nuance af hovedfarven. */
function renderOverviewChart(history){
    const years = syncPeriodSelect(history);
    const from = years ? addMonthsIso(history.at(-1).date, -12 * years) : '';
    const points = years ? history.filter(h => h.date >= from) : history.slice();
    document.getElementById('ovChartEmpty').style.display = points.length ? 'none' : 'flex';
    // Korte etiketter ("okt."); året står kun ved første søjle og ved januar.
    const labels = points.map((h, i) => {
        const d = new Date(h.date + 'T00:00:00');
        const month = d.toLocaleDateString('da-DK', {month:'short'});
        return i === 0 || d.getMonth() === 0 ? `${month} ${String(d.getFullYear()).slice(2)}` : month;
    });
    const base = getCSSVar('--akt');
    const colors = points.map((_, i) => hexToRgba(base, points.length === 1 ? 1 : 0.3 + 0.7 * i / (points.length - 1)));
    document.getElementById('ovChartSub').textContent = !points.length ? 'Dine seneste månedsstatusser'
        : years === 1 ? 'Det seneste år' : years ? `De seneste ${years} år` : `Alle dine månedsstatusser siden ${formatMonthYear(points[0].date)}`;

    // Ændringen i den viste periode: fra første til sidste søjle, grøn ved stigning og rød ved fald.
    const changeEl = document.getElementById('ovChartChange');
    changeEl.hidden = points.length < 2;
    if(points.length >= 2){
        const change = points.at(-1).value - points[0].value;
        const pct = points[0].value !== 0 ? change / Math.abs(points[0].value) : null;
        changeEl.textContent = `${formatSignedKr(change)}${pct !== null ? ` (${formatSignedPct(pct)})` : ''}`;
        changeEl.classList.toggle('is-up', change > 0);
        changeEl.classList.toggle('is-down', change < 0);
    }

    const data = {labels, datasets:[{label:'Nettoformue', data: points.map(h => h.value), backgroundColor: colors, borderRadius:8, borderSkipped:false, maxBarThickness:52}]};
    // En valgt søjle, der ikke længere vises (fx efter et skift af periode), vælges fra.
    if(ovSelectedDate && !points.some(h => h.date === ovSelectedDate)) ovSelectedDate = null;
    if(overviewChart){
        overviewChart.data = data;
        overviewChart.$points = points;
        overviewChart.options.scales.x.ticks.color = CHART_COLOR('--muted');
        paintOverviewSelection();
        return;
    }
    const options = lineChartOptions(c => `Nettoformue: ${DK.format(c.raw)} kr.`);
    options.plugins.tooltip.callbacks.title = items => formatDanishDate(overviewChart.$points?.[items[0].dataIndex]?.date || '');
    // Rolig graf som i skitsen: ingen akser eller gitterlinjer - tallet ses, når man peger.
    options.scales.x.grid = {display:false};
    options.scales.x.border = {display:false};
    options.scales.x.ticks = {color: CHART_COLOR('--muted'), font:{family:getCSSVar('--font-sans'), size:13}, maxRotation:0, autoSkip:true};
    // Søjler skal starte ved 0 - ellers ser stigningerne større ud, end de er.
    options.scales.y = {display:false, beginAtZero:true};
    // Et klik/tryk på en søjle (den nærmeste) vælger den og viser "Se måneden" under grafen; et klik
    // mere på samme søjle åbner måneden. Så åbner et tryk for at se tallet på en telefon ikke noget.
    options.onClick = (event, elements) => {
        const date = elements.length ? overviewChart.$points[elements[0].index]?.date : null;
        if(date && date === ovSelectedDate){ openOverviewMonth(date); return; }
        ovSelectedDate = date;
        paintOverviewSelection();
    };
    options.onHover = (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : ''; };
    overviewChart = new Chart(document.getElementById('ovChart').getContext('2d'), {type:'bar', data, options});
    overviewChart.$points = points;
    paintOverviewSelection();
}

let ovSelectedDate = null;

// Grafen vælger den nærmeste søjle, uanset hvor man trykker i den (søjlerne er smalle på en
// telefon). Et tryk et andet sted på siden fjerner valget igen.
document.addEventListener('click', e => {
    if(!ovSelectedDate || e.target.closest('#ovChart, #ovChartPick')) return;
    ovSelectedDate = null;
    if(overviewChart) paintOverviewSelection();
});

/** Åbner en søjles måned i Månedsoverblik. */
function openOverviewMonth(date){
    ovSelectedDate = null;
    showMonthOverview(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
}

/** Markerer den valgte søjle med en ramme og skriver dens dato, beløb og "Se måneden" under grafen. */
function paintOverviewSelection(){
    const points = overviewChart.$points || [];
    const index = points.findIndex(h => h.date === ovSelectedDate);
    const ds = overviewChart.data.datasets[0];
    ds.borderWidth = points.map((_, i) => i === index ? 2 : 0);
    ds.borderColor = getCSSVar('--text');
    overviewChart.update();
    const pick = document.getElementById('ovChartPick');
    pick.hidden = index < 0;
    if(index < 0){ pick.replaceChildren(); return; }
    const h = points[index];
    const month = new Date(h.date + 'T00:00:00').toLocaleDateString('da-DK', {month: 'long', year: 'numeric'});
    pick.replaceChildren(
        el('span', {textContent: `${formatDanishDate(h.date)}: ${DK.format(h.value)} kr.`}),
        el('button', {className: 'link-btn', type: 'button', textContent: `Se ${month} →`, onclick: () => openOverviewMonth(h.date)})
    );
}

/**
 * Linjen under et mål: hvornår det nås i dit tempo det seneste år (goalPace i calc.js), fx
 * "I dit tempo: jun. 2029" - kort, så den står ved beløbet på en telefon. Med en frist står
 * det, om det er før eller efter den.
 * @returns {HTMLElement}
 */
function goalPaceEl(pace){
    const [text, tone] =
        pace.kind === 'reached' ? ['Målet er nået', 'is-up']
        : pace.kind === 'noTrend' ? ['Dit tempo vises efter to månedsstatusser', '']
        : pace.kind === 'noProgress' ? ['Ingen fremgang det seneste år', '']
        : pace.months > 600 ? ['I dit tempo: over 50 år', pace.onTrack === false ? 'is-down' : '']
        : [`I dit tempo: ${monthsFromNow(pace.months)}${pace.onTrack === true ? ' – før fristen' : pace.onTrack === false ? ' – efter fristen' : ''}`,
            pace.onTrack === true ? 'is-up' : pace.onTrack === false ? 'is-down' : ''];
    return el('span', {className: 'ov-goal-pace' + (tone ? ' ' + tone : ''), textContent: text,
        attrs: pace.kind === 'eta' ? {title: 'Hvornår du når målet, hvis det fortsætter som det seneste år'} : {}});
}

/** "Mine mål" på oversigten: de første tre mål med fremskridt og tempo, eller en opfordring til at sætte ét. */
function renderOverviewGoals(){
    const box = document.getElementById('ovGoals');
    const goals = loadGoals().slice(0, 3);
    const history = readNetWorthHistory().slice().sort((a, b) => a.date.localeCompare(b.date));
    if(!goals.length){
        box.replaceChildren(el('p', {className:'empty-note'}, ['Sæt et mål, fx din første million, og følg hvor langt du er. ',
            el('button', {className:'link-btn', type:'button', textContent:'Sæt et mål', onclick: () => { showSection('formue'); openGoalDialog(); }})]));
        return;
    }
    box.replaceChildren(...goals.map(goal => {
        const current = currentGoalValue(goal.metric);
        const pct = Math.max(0, Math.min(1, goal.target > 0 ? current / goal.target : 0));
        return el('div', {className:'ov-goal'}, [
            el('div', {className:'ov-row'}, [el('span', {textContent: goal.name}), el('strong', {textContent: `${Math.round(pct * 100)} %`})]),
            el('div', {className:'progress-track'}, [el('div', {className:'progress-fill' + (pct >= 1 ? ' is-done' : ''), attrs:{style:`width:${pct * 100}%`}})]),
            el('div', {className:'ov-goal-sub'}, [el('span', {textContent: `${DK.format(current)} af ${DK.format(goal.target)} kr.`}),
                goalPaceEl(goalPace({target: goal.target, current, deadline: goal.deadline, today: todayIso(), trend: monthlyTrend(history, goal.metric)}))])
        ]);
    }));
}

/** Formuens fordeling som én samlet søjle med en forklaring under, sorteret efter størrelse. */
function renderOverviewSplit(figures){
    const box = document.getElementById('ovSplit');
    const rows = NET_WORTH_CATEGORIES.map(c => ({label: c.label, color: c.color, value: figures[c.id]})).filter(r => r.value > 0).sort((a, b) => b.value - a.value);
    document.getElementById('ovSplitSub').textContent = figures.fromSnapshot ? `pr. ${shortDate(figures.date)}` : '';
    if(!rows.length){
        box.replaceChildren(el('p', {className:'empty-note'}, ['Udfyld dine aktiver for at se fordelingen. ', el('button', {className:'link-btn', type:'button', textContent:'Gå til Formue', onclick: () => showSection('formue')})]));
        return;
    }
    // Nuancer af hovedfarven: den største del stærkest. I forklaringen står kun
    // kategoriens første ord (fx "Kontanter"); det fulde navn står i tooltippet.
    const base = getCSSVar('--akt');
    // Procenterne regnes af søjlens egen sum, så de passer til søjlen og giver 100 % -
    // også når et ældre datapunkts samlede formue ikke er lig summen af kategorierne.
    const total = rows.reduce((sum, r) => sum + r.value, 0);
    const parts = rows.map((r, i) => ({...r, pct: Math.round(r.value / total * 100),
        short: r.label.split(' ')[0], color: hexToRgba(base, Math.max(0.28, 1 - i * 0.18))}));
    const tip = p => `${p.label}: ${p.pct} % (${DK.format(p.value)} kr.)`;
    box.replaceChildren(
        el('div', {className:'ov-split-bar', attrs:{role:'img', 'aria-label': 'Fordeling: ' + parts.map(tip).join(', ')}},
            parts.map(p => el('div', {className:'ov-split-seg', attrs:{title: tip(p), style:`flex-grow:${p.value}; background:${p.color}`}}))),
        el('ul', {className:'ov-split-legend' + (parts.length >= 5 ? ' is-tight' : ''), attrs:{style:`--parts:${parts.length}`}}, parts.map(p => el('li', {className:'ov-split-item', attrs:{title: tip(p)}}, [
            el('span', {className:'ov-split-dot', attrs:{style:`background:${p.color}`, 'aria-hidden':'true'}}),
            el('strong', {textContent: `${p.pct} %`}),
            el('span', {textContent: p.short})
        ])))
    );
}

const YEAR_REVIEW_HIDDEN_KEY = 'yearReviewHidden';

/**
 * "Dit år i tal" øverst på Oversigt i januar: hvordan det forrige år gik (yearInNumbers i
 * calc.js) - nettoformuen og hvor meget af den var afkast, den bedste måned, måneder med
 * fremgang og porteføljens afkast.
 * Herfra åbnes hele året i Månedsoverblik, eller det deles som billede. × skjuler kortet til
 * næste januar.
 * @param {Object[]} nwHistory sorteret efter dato
 * @param {Object[]} ptHistory sorteret efter dato
 * @param {string} [today] ISO-dato (til test)
 */
function renderOverviewYearReview(nwHistory, ptHistory, today = todayIso()){
    const panel = document.getElementById('ovYearReview');
    let hidden = null;
    try{ hidden = localStorage.getItem(YEAR_REVIEW_HIDDEN_KEY); } catch(e){}
    const year = yearReviewYear(today, hidden);
    const info = year && yearInNumbers(nwHistory, ptHistory, year);
    panel.hidden = !info;
    if(!info) return;

    const tone = n => n > 0 ? 'is-up' : n < 0 ? 'is-down' : '';
    const fact = (label, value, cls = '') => el('div', {className: 'year-fact'}, [el('dt', {textContent: label}), el('dd', {className: cls, textContent: value})]);
    const p = info.portfolio;
    const split = savingsVsReturns(nwHistory, ptHistory, year, null);
    const verb = info.change > 0 ? 'steg' : info.change < 0 ? 'faldt' : 'stod stille';
    const hide = () => {
        try{ localStorage.setItem(YEAR_REVIEW_HIDDEN_KEY, String(year)); } catch(e){}
        renderOverviewYearReview(nwHistory, ptHistory, today);
        notify('Kortet er skjult til næste januar. Året står stadig i Månedsoverblik.', {actionLabel: 'Fortryd', onAction: () => {
            try{ localStorage.setItem(YEAR_REVIEW_HIDDEN_KEY, hidden ?? ''); } catch(e){}
            renderOverviewYearReview(nwHistory, ptHistory, today);
        }});
    };
    panel.replaceChildren(
        el('div', {className: 'panel-title-row'}, [
            el('h2', {className: 'panel-title', id: 'ovYearReviewTitle', textContent: `Dit ${year} i tal`}),
            el('button', {className: 'year-review-close', type: 'button', textContent: '×', attrs: {'aria-label': `Skjul Dit ${year} i tal`, title: 'Skjul'}, onclick: hide})
        ]),
        el('p', {className: 'year-lead'}, [`Din nettoformue ${verb} `,
            el('strong', {className: tone(info.change), textContent: `${formatSignedKr(info.change).replace(/^[+−]/, '')}${info.pct !== null ? ` (${formatSignedPct(info.pct)})` : ''}`}),
            // Hvor meget af stigningen var afkast (savingsVsReturns i calc.js) - kun når det er en del af den.
            split && split.returns > 0 && split.returns < info.change ? ` i ${year} – ${DK.format(split.returns)} kr. af det var afkast.` : ` i ${year}.`]),
        el('dl', {className: 'year-facts'}, [
            info.best ? fact('Bedste måned', stepLabel(info.best, false)) : '',
            fact('Måneder med fremgang', `${info.ups} af ${info.steps}`),
            p ? fact('Porteføljens afkast', p.pct !== null ? formatSignedPct(p.pct) : formatSignedKr(p.gain), tone(p.gain)) : ''
        ].filter(Boolean)),
        el('div', {className: 'year-review-actions'}, [
            el('button', {className: 'btn btn-secondary btn-sm', type: 'button', textContent: `Se hele ${year}`, onclick: () => showMonthOverview(year, null)}),
            el('button', {className: 'link-btn', type: 'button', textContent: 'Del som billede', onclick: () => openYearShare(info)})
        ])
    );
}

const NEXT_STEPS_HIDDEN_KEY = 'nextStepsHidden';

/** @returns {Object<string, number>} skjulte skridt: nøgle -> skjult indtil (ms) */
function readHiddenSteps(){
    try{ return JSON.parse(localStorage.getItem(NEXT_STEPS_HIDDEN_KEY) || '{}') || {}; } catch(e){ return {}; }
}

/**
 * "Næste skridt": højst fire konkrete ting at gøre nu, vigtigste først. Skridt forsvinder af
 * sig selv, når de er gjort, og kan skjules med ×. Hvor længe afhænger af skridtet: månedens
 * status kommer igen næste måned, backup efter 30 dage, nødopsparingen efter 90 dage, og
 * "kom i gang"-skridtene (formue, budget, mål) bliver væk. Er der intet tilbage, skjules kortet.
 */
function renderOverviewNext({hasNetWorth, budgetSum, months}){
    const steps = [];
    const add = (key, hideFor, text, label, action) => steps.push({key, hideFor, text, label, action});
    if(typeof monthlyReminderState !== 'undefined' && (monthlyReminderState?.due || monthlyReminderState?.snoozed)){
        const month = new Date(monthlyReminderState.month + '-15').toLocaleDateString('da-DK', {month:'long'});
        // Skjules for denne måned: nøglen indeholder måneden, så næste måned er et nyt skridt.
        add(`status:${monthlyReminderState.month}`, 'forever', `Gem dine tal for ${month}.`, 'Gem status', () => openMonthlyStatusFromReminder());
    }
    if(!hasNetWorth) add('formue', 'forever', 'Skriv dine aktiver og din gæld ind.', 'Udfyld formue', () => showSection('formue'));
    if(budgetSum <= 0) add('budget', 'forever', 'Byg dit budget – så kan resten af siden regne med dine udgifter.', 'Byg budget', () => showSection('budget'));
    if(months !== null && months < 3) add('buffer', 90, 'Din nødopsparing dækker under 3 måneders udgifter.', 'Se nødopsparing', () => showSection('formue'));
    if(!loadGoals().length && hasNetWorth) add('goal', 'forever', 'Sæt et mål for din formue eller dine aktier.', 'Sæt mål', () => { showSection('formue'); openGoalDialog(); });
    const lastBackup = parseInt(localStorage.getItem('lastBackupAt'), 10);
    if(hasUserData() && (isNaN(lastBackup) || Date.now() - lastBackup > 30 * DAY_MS)) add('backup', 30, 'Tag en backup i indstillingerne, så dine tal ikke går tabt.', 'Åbn indstillinger', () => toggleSettings(true, 'data'));

    const hidden = readHiddenSteps();
    const visible = steps.filter(step => !(hidden[step.key] > Date.now())).slice(0, 4);
    const hide = step => {
        const before = readHiddenSteps();
        const next = {...before, [step.key]: step.hideFor === 'forever' ? Number.MAX_SAFE_INTEGER : Date.now() + step.hideFor * DAY_MS};
        try{ localStorage.setItem(NEXT_STEPS_HIDDEN_KEY, JSON.stringify(next)); } catch(e){}
        renderOverviewNext({hasNetWorth, budgetSum, months});
        notify('Skridtet er skjult.', {actionLabel: 'Fortryd', onAction: () => {
            try{ localStorage.setItem(NEXT_STEPS_HIDDEN_KEY, JSON.stringify(before)); } catch(e){}
            renderOverviewNext({hasNetWorth, budgetSum, months});
        }});
    };
    document.getElementById('ovNextPanel').hidden = !visible.length;
    document.getElementById('ovNext').replaceChildren(...visible.map(step => el('li', {attrs: {'data-step': step.key}}, [
        el('span', {className: 'ov-next-text', textContent: step.text}),
        el('button', {className: 'btn btn-secondary btn-sm', type: 'button', textContent: step.label, onclick: step.action}),
        el('button', {className: 'ov-next-hide', type: 'button', textContent: '×', attrs: {'aria-label': `Skjul: ${step.text}`, title: 'Skjul'}, onclick: () => hide(step)})
    ])));
    applyOverviewLayout();   // et tomt "Næste skridt" kan efterlade en tom kolonne
}

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('section-overview').style.display !== 'none') renderOverview();
});
