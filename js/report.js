/**
 * @file Udskriv overblik: samler formue, budget, lån, mål og portefølje på én
 * side, der kan printes eller gemmes som PDF (fx til et møde med en rådgiver).
 * Rapporten bygges ud fra de gemte tal, lægges i #printReport og vises kun
 * ved udskrift (se @media print i styles.css). Tomme afsnit udelades.
 */

const reportKr = n => DK.format(n).replace(/^-/, '−') + ' kr.';

/** Et afsnit med overskrift og indhold. */
function reportSection(title, children){
    return el('section', {className:'report-section'}, [el('h2', {textContent: title}), ...children]);
}

/** En tabel: rows er arrays af celler; den sidste kolonne højrestilles. */
function reportTable(head, rows, {totalRows = []} = {}){
    const tr = (cells, tag, cls = '') => el('tr', {className: cls}, cells.map(c => el(tag, {textContent: c})));
    return el('table', {className:'report-table'}, [
        el('thead', {}, [tr(head, 'th')]),
        el('tbody', {}, rows.map(r => tr(r, 'td')).concat(totalRows.map(r => tr(r, 'td', 'is-total'))))
    ]);
}

function reportNetWorth(){
    const f = currentNetWorthFigures();
    const history = readNetWorthHistory().slice().sort((a, b) => a.date.localeCompare(b.date));
    if(!(f.assets > 0) && !f.debt && !history.length) return null;
    const rows = NET_WORTH_CATEGORIES.filter(c => f[c.id]).map(c => [c.label, f.assets > 0 ? Math.round(f[c.id] / f.assets * 100) + ' %' : '', reportKr(f[c.id])]);
    const parts = [];
    if(f.fromSnapshot) parts.push(el('p', {className:'report-note', textContent:`Tal fra seneste øjebliksbillede, ${formatDanishDate(f.date)}.`}));
    parts.push(reportTable(['Aktiv', 'Andel', 'Beløb'], rows, {totalRows: [
        ['Aktiver i alt', '', reportKr(f.assets)], ['Gæld', '', reportKr(-f.debt)], ['Nettoformue', '', reportKr(f.value)], ['Heraf likvid (kontanter + aktier)', '', reportKr(f.liquid)]
    ]}));
    if(history.length > 1){
        const last = history.at(-1);
        const yearAgo = history.filter(h => h.date <= shiftIsoYears(last.date, -1)).at(-1);
        const base = yearAgo || history[0];
        const change = last.value - base.value;
        parts.push(el('p', {className:'report-note', textContent:
            `Udvikling: ${reportKr(base.value)} (${formatDanishDate(base.date)}) → ${reportKr(last.value)} (${formatDanishDate(last.date)}), ${change >= 0 ? '+' : '−'}${reportKr(Math.abs(change))}`}));
    }
    return reportSection('Formue', parts);
}

/** ISO-dato flyttet et antal hele år. */
function shiftIsoYears(iso, years){
    return (parseInt(iso.slice(0, 4), 10) + years) + iso.slice(4);
}

function reportBudget(){
    const cats = getBudgetCategories();
    const items = loadBudgetItems();
    const {values, sum, groupSums} = budgetSummary(cats, items);
    if(!(sum > 0)) return null;
    const rows = [];
    BUDGET_GROUPS.forEach(g => cats.forEach((c, i) => {
        if(c.group === g.id && values[i] > 0) rows.push([g.label, c.label, reportKr(values[i]), reportKr(values[i] * 12)]);
    }));
    const total = parseFloat(document.getElementById('budgetTotalInput').value) || 0;
    const totalRows = [['Samlet budget', '', reportKr(sum), reportKr(sum * 12)]];
    if(total > 0){
        totalRows.push(['Til rådighed', '', reportKr(total), reportKr(total * 12)]);
        totalRows.push(['Penge tilbage', '', reportKr(total - sum), reportKr((total - sum) * 12)]);
    }
    const pct = key => Math.round(groupSums[key] / sum * 100);
    return reportSection('Budget', [
        reportTable(['Gruppe', 'Kategori', 'Pr. måned', 'Pr. år'], rows, {totalRows}),
        el('p', {className:'report-note', textContent:
            `50/30/20: behov ${pct('behov')} % (mål højst 50 %), ønsker ${pct('onsker')} % (højst 30 %), opsparing ${pct('opsparing')} % (mindst 20 %).`})
    ]);
}

function reportDebts(){
    const data = loadDebtData();
    if(localStorage.getItem('debtPayoffData') === null) return null;   // kun eksemplet - ikke brugerens egne lån
    const debts = data.debts
        .map((d, i) => ({name: d.name || `Lån ${i + 1}`, balance: +d.balance || 0, rate: (+d.rate || 0) / 100, minPayment: +d.minPayment || 0}))
        .filter(d => d.balance > 0);
    if(!debts.length) return null;
    const avalanche = simulateDebtPayoff(debts, data.extra, 'avalanche');
    const rows = debts.map((d, i) => {
        const hit = avalanche.payoff.find(p => p.index === i);
        return [d.name, reportKr(d.balance), formatPct(d.rate), reportKr(d.minPayment), hit ? monthsFromNow(hit.month) : '–'];
    });
    const total = debts.reduce((s, d) => s + d.balance, 0);
    return reportSection('Lån', [
        reportTable(['Lån', 'Restgæld', 'Rente', 'Min. ydelse/md.', 'Betalt ud (lavine)'], rows, {totalRows: [['I alt', reportKr(total), '', reportKr(debts.reduce((s, d) => s + d.minPayment, 0)), '']]}),
        el('p', {className:'report-note', textContent: avalanche.feasible
            ? `Med ${reportKr(data.extra)} ekstra om måneden er al gælden betalt ud ${monthsFromNow(avalanche.months)} og koster ${reportKr(avalanche.totalInterest)} i rente.`
            : 'Ydelserne dækker ikke renterne – gælden bliver ikke betalt ud med de nuværende ydelser.'})
    ]);
}

function reportGoals(){
    const goals = loadGoals();
    if(!goals.length) return null;
    const history = readNetWorthHistory();
    const rows = goals.map(goal => {
        const metric = GOAL_METRICS.find(m => m.key === goal.metric) || GOAL_METRICS[0];
        const current = currentGoalValue(goal.metric);
        const g = goalProgress({target: goal.target, current, deadline: goal.deadline, today: todayIso(), trend: monthlyTrend(history, goal.metric)});
        return [goal.name, metric.label, `${reportKr(current)} af ${reportKr(goal.target)} (${Math.round(g.pct * 100)} %)`,
            goal.deadline ? formatDanishDate(goal.deadline) : '–',
            g.reached ? 'Nået' : g.neededPerMonth !== null ? reportKr(g.neededPerMonth) + '/md.' : '–'];
    });
    return reportSection('Mål', [reportTable(['Mål', 'Måler', 'Status', 'Frist', 'Skal stige'], rows)]);
}

function reportPortfolio(){
    const history = readPortfolioHistory().slice().sort((a, b) => a.date.localeCompare(b.date));
    if(!history.length) return null;
    const last = history.at(-1);
    const deposits = history.reduce((s, h) => s + (h.deposit || 0), 0);
    const days = (Date.parse(last.date) - Date.parse(history[0].date)) / DAY_MS;
    const rate = days >= 365 ? xirr(portfolioCashFlows(history)) : null;
    const rows = [['Værdi', reportKr(last.portfolioValue)], ['Heraf aktier', reportKr(last.stockValue || 0)], ['Heraf kontanter', reportKr(last.cash || 0)], ['Indskudt i alt', reportKr(deposits)]];
    if(rate !== null) rows.push([`Afkast pr. år siden ${formatDanishDate(history[0].date)}`, (rate >= 0 ? '+' : '−') + formatPct(Math.abs(rate))]);
    return reportSection(`Portefølje (${formatDanishDate(last.date)})`, [reportTable(['', 'Beløb'], rows)]);
}

/** Bygger rapporten og åbner browserens udskriftsdialog. */
function printOverview(){
    const sections = [reportNetWorth(), reportBudget(), reportDebts(), reportGoals(), reportPortfolio()].filter(Boolean);
    if(!sections.length){
        notify('Der er ingen tal at udskrive endnu. Udfyld Budget eller Formue først.');
        return;
    }
    const report = document.getElementById('printReport');
    report.replaceChildren(
        el('header', {className:'report-head'}, [
            el('h1', {textContent:'Økonomisk overblik'}),
            el('p', {textContent:`Udskrevet ${formatDanishDate(todayIso())}`})
        ]),
        ...sections,
        el('p', {className:'report-foot', textContent:'Lavet med Økonomiværktøjer. Tallene er mine egne indtastninger; beregningerne er vejledende og ikke rådgivning.'})
    );
    if(typeof toggleSettings === 'function') toggleSettings(false);
    window.print();
}

window.addEventListener('afterprint', () => document.getElementById('printReport').replaceChildren());
