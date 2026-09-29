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

/**
 * @param {string} id
 * @param {string} value
 * @param {string} sub
 * @param {'negative'|''} [cls] farver selve tallet rødt
 * @param {'up'|'down'|''} [subTone] farver undertekst grøn/rød (fx en ændring)
 */
function setKpi(id, value, sub, cls, subTone){
    const node = document.getElementById(id);
    node.textContent = value;
    node.classList.toggle('negative', cls === 'negative');
    const subNode = document.getElementById(id + 'Sub');
    subNode.textContent = sub || '';
    subNode.classList.toggle('is-up', subTone === 'up');
    subNode.classList.toggle('is-down', subTone === 'down');
}

/** Tegner hele oversigten. Kaldes, hver gang siden vises. */
function renderOverview(){
    const figures = currentNetWorthFigures();
    const nwHistory = readNetWorthHistory();
    const ptHistory = readPortfolioHistory();
    const {sum: budgetSum, groupSums} = budgetSummary(getBudgetCategories(), loadBudgetItems());
    const budgetTotal = parseFloat(document.getElementById('budgetTotalInput').value) || 0;
    const expenses = budgetSum - groupSums.opsparing;

    // ---- Nøgletal ----
    const hasNetWorth = figures.assets > 0 || figures.debt > 0 || nwHistory.length > 0;
    const lastChange = periodChanges(nwHistory, h => h.value).at(-1);
    setKpi('ovNetWorth', hasNetWorth ? DK.format(figures.value) + ' kr.' : '–',
        !hasNetWorth ? 'Udfyld din formue' : lastChange ? `${formatSignedKr(lastChange.change)} siden ${shortDate(lastChange.from)}` : 'Gem en månedsstatus for at følge udviklingen',
        figures.value < 0 ? 'negative' : '', lastChange ? (lastChange.change >= 0 ? 'up' : 'down') : '');

    const lastPt = ptHistory.at(-1);
    const thisYear = yearSummary(ptHistory, h => h.portfolioValue, h => h.deposit).find(y => y.year === new Date().getFullYear());
    setKpi('ovPortfolio', lastPt ? DK.format(lastPt.portfolioValue) + ' kr.' : '–',
        !lastPt ? 'Ingen datapunkter endnu' : thisYear ? `${formatSignedKr(thisYear.gain)} i afkast i år${thisYear.pct !== null ? ` (${thisYear.pct >= 0 ? '+' : '−'}${formatPct(Math.abs(thisYear.pct))})` : ''}` : `pr. ${shortDate(lastPt.date)}`,
        '', thisYear ? (thisYear.gain >= 0 ? 'up' : 'down') : '');

    setKpi('ovBudget', budgetSum > 0 ? DK.format(budgetSum) + ' kr.' : '–',
        budgetSum <= 0 ? 'Byg dit budget' : budgetTotal > 0 ? `${DK.format(budgetTotal - budgetSum)} kr. tilbage` : `${Math.round(groupSums.opsparing / budgetSum * 100)} % går til opsparing`,
        budgetTotal > 0 && budgetTotal - budgetSum < 0 ? 'negative' : '');

    // Gennemsnitlig ændring i nettoformuen pr. måned det seneste år (eller siden første
    // månedsstatus, hvis der er under et års data). Nødopsparingen står i Formue.
    const sorted = nwHistory.slice().sort((a, b) => a.date.localeCompare(b.date));
    const growth = monthlyTrend(sorted, 'value');
    const since = growth === null ? null : sorted.find(h => Date.parse(sorted.at(-1).date) - Date.parse(h.date) <= 366 * DAY_MS);
    const fullYear = since && Date.parse(sorted.at(-1).date) - Date.parse(since.date) >= 330 * DAY_MS;
    setKpi('ovGrowth', growth === null ? '–' : formatSignedKr(Math.round(growth)),
        growth === null ? 'Kræver to månedsstatusser' : fullYear ? 'i snit det seneste år' : `i snit siden ${shortDate(since.date)}`,
        growth !== null && growth < 0 ? 'negative' : '');
    const months = emergencyFundMonths(figures.netCatKontanter, expenses);

    const latest = [nwHistory.at(-1)?.date, lastPt?.date].filter(Boolean).sort().at(-1);
    document.getElementById('pageSub').textContent = latest ? `Seneste månedsstatus ${formatDanishDate(latest)} · alle beløb i DKK` : 'Alle beløb i DKK';

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

    const data = {labels, datasets:[{label:'Nettoformue', data: points.map(h => h.value), backgroundColor: colors, borderRadius:8, borderSkipped:false, maxBarThickness:52}]};
    if(overviewChart){
        overviewChart.data = data;
        overviewChart.$points = points;
        overviewChart.options.scales.x.ticks.color = CHART_COLOR('--muted');
        overviewChart.update();
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
    overviewChart = new Chart(document.getElementById('ovChart').getContext('2d'), {type:'bar', data, options});
    overviewChart.$points = points;
}

/** "Mine mål" på oversigten: de første tre mål med fremskridt, eller en opfordring til at sætte ét. */
function renderOverviewGoals(){
    const box = document.getElementById('ovGoals');
    const goals = loadGoals().slice(0, 3);
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
            el('div', {className:'ov-goal-sub', textContent: `${DK.format(current)} af ${DK.format(goal.target)} kr.`})
        ]);
    }));
}

/** Formuens fordeling som vandrette søjler, sorteret efter størrelse. */
function renderOverviewSplit(figures){
    const box = document.getElementById('ovSplit');
    const rows = NET_WORTH_CATEGORIES.map(c => ({label: c.label, color: c.color, value: figures[c.id]})).filter(r => r.value > 0).sort((a, b) => b.value - a.value);
    document.getElementById('ovSplitSub').textContent = figures.fromSnapshot ? `pr. ${shortDate(figures.date)}` : '';
    if(!rows.length){
        box.replaceChildren(el('p', {className:'empty-note'}, ['Udfyld dine aktiver for at se fordelingen. ', el('button', {className:'link-btn', type:'button', textContent:'Gå til Formue', onclick: () => showSection('formue')})]));
        return;
    }
    // Nuancer af hovedfarven: den største søjle stærkest. Kontanter får en fast
    // nuance mellem de to stærkeste, så de skiller sig lidt ud uden at blive blegest.
    const base = getCSSVar('--akt');
    let rank = 0;
    box.replaceChildren(...rows.map(r => {
        const pct = r.value / figures.assets;
        const color = hexToRgba(base, r.label.startsWith('Kontanter') ? 0.91 : Math.max(0.45, 1 - rank++ * 0.18));
        return el('div', {className:'ov-split-row'}, [
            el('div', {className:'ov-row'}, [el('span', {textContent: r.label}), el('strong', {textContent: `${Math.round(pct * 100)} %`})]),
            el('div', {className:'progress-track'}, [el('div', {className:'progress-fill', attrs:{style:`width:${pct * 100}%; background:${color}`}})])
        ]);
    }));
}

/** Højst fire konkrete ting at gøre nu, vigtigste først. */
function renderOverviewNext({hasNetWorth, budgetSum, months}){
    const items = [];
    const add = (text, label, action) => items.push(el('li', {}, [el('span', {textContent: text}), el('button', {className:'btn btn-secondary btn-sm', type:'button', textContent: label, onclick: action})]));
    if(typeof monthlyReminderState !== 'undefined' && monthlyReminderState?.due){
        const month = new Date(monthlyReminderState.month + '-15').toLocaleDateString('da-DK', {month:'long'});
        add(`Gem dine tal for ${month}.`, 'Gem status', () => openMonthlyStatusFromReminder());
    }
    if(!hasNetWorth) add('Skriv dine aktiver og din gæld ind.', 'Udfyld formue', () => showSection('formue'));
    if(budgetSum <= 0) add('Byg dit budget – så kan resten af siden regne med dine udgifter.', 'Byg budget', () => showSection('budget'));
    if(months !== null && months < 3) add('Din nødopsparing dækker under 3 måneders udgifter.', 'Se nødopsparing', () => showSection('formue'));
    if(!loadGoals().length && hasNetWorth) add('Sæt et mål for din formue eller dine aktier.', 'Sæt mål', () => { showSection('formue'); openGoalDialog(); });
    const lastBackup = parseInt(localStorage.getItem('lastBackupAt'), 10);
    if(hasUserData() && (isNaN(lastBackup) || Date.now() - lastBackup > 30 * DAY_MS)) add('Tag en backup i indstillingerne, så dine tal ikke går tabt.', 'Åbn indstillinger', () => toggleSettings(true));
    document.getElementById('ovNext').replaceChildren(...(items.length
        ? items.slice(0, 4)
        : [el('li', {className:'ov-done'}, [el('span', {textContent:'Du er helt opdateret. Næste gang: gem din månedsstatus ved månedens udgang.'})])]));
}

document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('section-overview').style.display !== 'none') renderOverview();
});
