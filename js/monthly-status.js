/**
 * @file Månedsstatus: ét skema, der gemmer et datapunkt i både formuehistorikken
 * og porteføljetrackeren for samme dato. Skemaet udfyldes med de seneste tal,
 * så man kun retter det, der har ændret sig.
 *
 * Kontanter tælles samlet i Formue: bank- og opsparingskonti + fysiske kontanter
 * + kontanter i aktiedepotet. "Aktier" i Formue er kun værdien af selve aktierne.
 * I porteføljetrackeren er porteføljeværdien aktier + kontanter i depotet.
 * Hvilken kasse depotkontanterne lægges i, ændrer hverken nettoformuen eller den
 * likvide formue, da begge kategorier er likvide.
 *
 * De seneste indtastede saldi gemmes under 'monthlyStatusLast'.
 */

const MONTHLY_STATUS_SECTIONS = [
    {title:'Kontanter', fields:[
        {key:'bank', label:'Bank- og opsparingskonti', help:'Saldoen på alle dine bank- og opsparingskonti.'},
        {key:'physical', label:'Fysiske kontanter', help:'Kontanter i hånden eller derhjemme.'},
        {key:'depotCash', label:'Kontanter i aktiedepot', help: FIELD_HELP.ptCash}
    ]},
    {title:'Aktiedepot', fields:[
        {key:'stocks', label:'Værdi af aktier', hint:'Kun aktierne, uden kontanter', help: FIELD_HELP.ptStockValue},
        {key:'traded', label:'Købt/solgt i perioden', hint:'Negativ ved nettosalg', flow:true, allowNegative:true, help: FIELD_HELP.ptTraded},
        {key:'deposit', label:'Indskud/udbetaling i perioden', hint:'Negativ ved udbetaling', flow:true, allowNegative:true, help: FIELD_HELP.ptDeposit},
        {key:'dividend', label:'Udbytte efter skat i perioden', flow:true, help: FIELD_HELP.ptDividend}
    ]},
    {title:'Øvrig formue og gæld', fields:[
        {key:'pension', label:'Pension', help: FIELD_HELP.netCatPension},
        {key:'homeEquity', label:'Friværdi i bolig', help: FIELD_HELP.netCatFrivaerdi},
        {key:'other', label:'Andet', help: FIELD_HELP.netCatAndet},
        {key:'debt', label:'Gæld', hint:'Ikke realkredit – den indgår i friværdien', help: FIELD_HELP.netDebt}
    ]}
];

/**
 * Omsætter skemaets tal til de to datapunkter, der gemmes.
 * @param {string} date
 * @param {Object<string, number>} v skemaets værdier
 * @returns {{netWorth:Object, portfolio:Object}}
 */
function monthlyStatusEntries(date, v){
    return {
        netWorth: buildNetWorthEntry(date, {
            netCatKontanter: v.bank + v.physical + v.depotCash,
            netCatAktier: v.stocks,
            netCatPension: v.pension,
            netCatFrivaerdi: v.homeEquity,
            netCatAndet: v.other,
            debt: v.debt
        }),
        portfolio: buildPortfolioEntry(date, {
            stockValue: v.stocks, cash: v.depotCash,
            traded: v.traded, deposit: v.deposit, dividend: v.dividend
        })
    };
}

/**
 * De saldi skemaet starter med: sidst indtastede månedsstatus, ellers det bedste
 * bud ud fra Formue-felterne og porteføljens seneste punkt. Periodetal (handler,
 * indskud, udbytte) starter altid på 0.
 * @returns {Object<string, number>}
 */
function monthlyStatusPrefill(){
    const zero = {traded:0, deposit:0, dividend:0};
    try{
        const last = JSON.parse(localStorage.getItem('monthlyStatusLast') || 'null');
        if(last) return {...last, ...zero};
    } catch(e){ /* falder tilbage herunder */ }

    const field = id => parseFloat(document.getElementById(id).value) || 0;
    const latestPortfolio = readPortfolioHistory().at(-1);
    const depotCash = latestPortfolio ? latestPortfolio.cash || 0 : 0;
    return {
        bank: Math.max(0, field('netCatKontanter') - depotCash),
        physical: 0,
        depotCash,
        stocks: latestPortfolio ? latestPortfolio.stockValue || 0 : field('netCatAktier'),
        pension: field('netCatPension'),
        homeEquity: field('netCatFrivaerdi'),
        other: field('netCatAndet'),
        debt: field('netDebt'),
        ...zero
    };
}

/**
 * Skemaets værdier for en dato, der allerede er gemt - så en rettelse kan tage
 * udgangspunkt i de gemte tal i stedet for at nulstille periodetallene.
 * Opdelingen af kontanter på bank/fysiske gættes ud fra seneste månedsstatus.
 * @param {string} date
 * @returns {Object<string, number>|null} null hvis datoen ikke har data
 */
function monthlyStatusFromSaved(date){
    const nw = readNetWorthHistory().find(h => h.date === date);
    const pt = readPortfolioHistory().find(h => h.date === date);
    if(!nw && !pt) return null;
    let last = {};
    try{ last = JSON.parse(localStorage.getItem('monthlyStatusLast') || 'null') || {}; } catch(e){ /* tom */ }
    const depotCash = pt ? pt.cash || 0 : last.depotCash || 0;
    const physical = last.physical || 0;
    return {
        bank: nw ? Math.max(0, (nw.netCatKontanter || 0) - depotCash - physical) : last.bank || 0,
        physical, depotCash,
        stocks: pt ? pt.stockValue || 0 : nw.netCatAktier || 0,
        traded: pt ? pt.traded || 0 : 0,
        deposit: pt ? pt.deposit || 0 : 0,
        dividend: pt ? pt.dividend || 0 : 0,
        pension: nw ? nw.netCatPension || 0 : last.pension || 0,
        homeEquity: nw ? nw.netCatFrivaerdi || 0 : last.homeEquity || 0,
        other: nw ? nw.netCatAndet || 0 : last.other || 0,
        debt: nw ? nw.debt || 0 : last.debt || 0
    };
}

/** @returns {string|null} den seneste dato med data i en af de to historikker */
function latestStatusDate(){
    const dates = readNetWorthHistory().map(h => h.date).concat(readPortfolioHistory().map(h => h.date));
    return dates.length ? dates.sort().at(-1) : null;
}

/**
 * Åbner skemaet. Viser løbende nettoformue, likvid formue og porteføljeværdi,
 * og advarer med præcise ændringer, hvis datoen allerede har data.
 */
function openMonthlyStatus(){
    const values = monthlyStatusPrefill();
    const hasHistory = !!latestStatusDate();

    const dateInput = el('input', {type:'date', className:'number-input', value:todayIso(), attrs:{'aria-describedby':'msDateError'}});
    const dateError = el('div', {className:'field-error', id:'msDateError', attrs:{role:'alert'}});
    const existingNote = el('div', {className:'existing-note', attrs:{role:'status'}});

    function checkExistingDate(){
        const date = normalizeDate(dateInput.value);
        const saved = date && monthlyStatusFromSaved(date);
        if(!saved){ existingNote.replaceChildren(); return; }
        existingNote.replaceChildren(
            el('span', {textContent:`Der er allerede gemt data for ${formatDanishDate(date)}. Gemmer du, bliver de erstattet.`}),
            el('button', {className:'btn btn-secondary btn-sm', type:'button', textContent:'Indlæs de gemte tal', onclick: () => {
                Object.assign(values, saved);
                Object.entries(inputs).forEach(([key, input]) => input.value = values[key] || 0);
                refreshSummary();
                existingNote.replaceChildren(el('span', {textContent:`Viser de gemte tal for ${formatDanishDate(date)} – ret det, der skal ændres.`}));
            }})
        );
    }
    dateInput.addEventListener('input', () => { dateError.textContent = ''; dateInput.removeAttribute('aria-invalid'); checkExistingDate(); });

    const summary = el('dl', {className:'status-summary'});
    const inputs = {};

    function refreshSummary(){
        const {netWorth, portfolio} = monthlyStatusEntries('x', values);
        const item = (label, value, strong) => el('div', {}, [
            el('dt', {textContent:label}),
            el('dd', {className: strong ? 'is-strong' : '', textContent: DK.format(value) + ' kr.'})
        ]);
        summary.replaceChildren(
            item('Kontanter i alt', netWorth.netCatKontanter),
            item('Likvid formue', netWorth.liquid),
            item('Porteføljeværdi', portfolio.portfolioValue),
            item('Nettoformue', netWorth.value, true)
        );
    }

    const sections = MONTHLY_STATUS_SECTIONS.map(section => el('fieldset', {className:'status-section'}, [
        el('legend', {className:'eyebrow', textContent:section.title}),
        el('div', {className:'status-grid'}, section.fields.map(f => {
            const input = el('input', {type:'number', className:'number-input', value: values[f.key] || 0, step: f.flow ? 100 : 1000,
                oninput: e => { values[f.key] = parseFloat(e.target.value) || 0; refreshSummary(); }});
            if(!f.allowNegative) input.min = 0;
            inputs[f.key] = input;
            const field = fieldEl(f.label, input, f.hint ? [el('div', {className:'limit-hint', textContent:f.hint})] : [], 'status-field');
            if(f.help) attachFieldHelp(field.querySelector('label'), f.help);
            return field;
        }))
    ]));

    const intro = hasHistory
        ? `Felterne er udfyldt med dine seneste tal (${formatDanishDate(latestStatusDate())}) – ret det, der har ændret sig. Handler, indskud og udbytte starter på 0, fordi de gælder for perioden.`
        : 'Udfyld dine tal én gang om måneden. Status gemmes i både formuehistorikken og porteføljetrackeren.';

    const content = el('div', {}, [
        el('p', {className:'dialog-hint', textContent:intro}),
        fieldEl('Dato', dateInput, [dateError], 'status-date'),
        existingNote,
        ...sections,
        el('div', {className:'status-summary-box'}, [el('div', {className:'eyebrow', textContent:'Opsummering'}), summary])
    ]);
    refreshSummary();
    checkExistingDate();

    let saving = false;
    const handle = openDialog({
        title:'Månedsstatus',
        content,
        wide:true,
        actions:[
            {label:'Annullér', variant:'secondary'},
            {label:'Gem i begge', variant:'primary', onClick: () => {
                if(saving) return false;
                const date = normalizeDate(dateInput.value);
                if(!date){
                    dateError.textContent = 'Vælg en gyldig dato.';
                    dateInput.setAttribute('aria-invalid', 'true');
                    dateInput.focus();
                    return false;
                }
                saving = true;
                saveMonthlyStatus(date, values).then(saved => {
                    saving = false;
                    if(saved) handle.close(true);
                });
                return false;
            }}
        ]
    });
    inputs.bank.focus();
    inputs.bank.select();
}

/**
 * Gemmer i begge historikker. Findes datoen i en af dem, vises alle ændringer
 * samlet i én bekræftelse først.
 * @param {string} date
 * @param {Object<string, number>} values
 * @returns {Promise<boolean>} true hvis der blev gemt
 */
async function saveMonthlyStatus(date, values){
    const {netWorth, portfolio} = monthlyStatusEntries(date, values);
    const nw = upsertByDate(readNetWorthHistory(), netWorth);
    const pt = upsertByDate(readPortfolioHistory(), portfolio);

    if(nw.replaced || pt.replaced){
        const nwChanges = nw.replaced ? changedFields(nw.replaced, netWorth, NET_WORTH_FIELDS) : [];
        const ptChanges = pt.replaced ? changedFields(pt.replaced, portfolio, PORTFOLIO_FIELDS) : [];
        if(nw.replaced && pt.replaced && !nwChanges.length && !ptChanges.length){
            notify(`Ingen ændringer – status for ${formatDanishDate(date)} var allerede gemt med de samme tal.`);
            return true;
        }
        const ok = await confirmOverwrite(date, [
            {title:'Formue', changes: nwChanges},
            {title:'Porteføljetracker', changes: ptChanges}
        ]);
        if(!ok) return false;
    }

    writeNetWorthHistory(nw.history);
    writePortfolioHistory(pt.history);
    const {traded, deposit, dividend, ...balances} = values;
    localStorage.setItem('monthlyStatusLast', JSON.stringify(balances));

    // Formue-felterne viser den nyeste status, hvis dette er den seneste dato.
    if(latestStatusDate() === date){
        [['netCatKontanter', netWorth.netCatKontanter], ['netCatAktier', netWorth.netCatAktier],
         ['netCatPension', netWorth.netCatPension], ['netCatFrivaerdi', netWorth.netCatFrivaerdi],
         ['netCatAndet', netWorth.netCatAndet], ['netDebt', netWorth.debt]]
            .forEach(([id, v]) => document.getElementById(id).value = v);
        updateNetWorth();
    }
    renderNetWorthHistory();
    renderPortfolioHistory();
    notify(`Månedsstatus for ${formatDanishDate(date)} er gemt i Formue og Porteføljetracker.`);
    return true;
}
