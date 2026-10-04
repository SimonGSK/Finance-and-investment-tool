/**
 * @file ASK og skattegrænser (værktøj 7 under Investering): man skriver årets tal ind
 * fra sin bank og ser, hvor meget der endnu kan sættes ind på aktiesparekontoen, og
 * hvor meget gevinst der kan realiseres, før aktieindkomsten passerer grænsen, hvor
 * skatten stiger fra 27 % til 42 %. Beregningen ligger i calc.js (taxLimitStatus).
 * Tallene gemmes under 'taxTracker' pr. skatteår og kommer med i backupfilen.
 */

const TAX_TRACKER_KEY = 'taxTracker';
const TAX_FIELDS = [
    {id: 'taxAskDeposits', key: 'askDeposits'},
    {id: 'taxRealizedGains', key: 'realizedGains'},
    {id: 'taxRealizedLosses', key: 'realizedLosses'},
    {id: 'taxDividends', key: 'dividends'},
    {id: 'taxLagerGains', key: 'lagerGains'}
];

/** @returns {{married?:boolean, years?:Object<string, object>}} alt, der er gemt */
function loadTaxTracker(){
    try{ return JSON.parse(localStorage.getItem(TAX_TRACKER_KEY) || '{}') || {}; } catch(e){ return {}; }
}

/** Gemmer felterne for det aktuelle skatteår og viser "Gemt". */
function saveTaxTracker(){
    const data = loadTaxTracker();
    const year = {};
    TAX_FIELDS.forEach(({id, key}) => { const v = document.getElementById(id).value; if(v !== '') year[key] = parseFloat(v) || 0; });
    data.years = {...(data.years || {}), [TAX_YEAR]: year};
    data.married = document.getElementById('taxMarried').checked;
    localStorage.setItem(TAX_TRACKER_KEY, JSON.stringify(data));
    markSaved('taxSaveStatus');
}

/** Fylder felterne med det gemte for det aktuelle skatteår. */
function loadTaxTrackerFields(){
    const data = loadTaxTracker();
    const year = data.years?.[TAX_YEAR] || {};
    TAX_FIELDS.forEach(({id, key}) => { document.getElementById(id).value = year[key] ?? ''; });
    document.getElementById('taxMarried').checked = !!data.married;
}

/**
 * Sætter en fremskridtsbjælke: bredden efter andelen (højst 100 %), rød, når grænsen er passeret.
 * @param {string} id bjælkens element
 * @param {number} pct andel af grænsen (1 = ved grænsen)
 * @param {boolean} over grænsen er overskredet
 */
function setTaxBar(id, pct, over){
    const fill = document.getElementById(id);
    fill.style.width = Math.min(100, Math.max(0, pct * 100)) + '%';
    fill.classList.toggle('is-over', over);
}

/** Regner og viser status ud fra felterne. */
function updateTaxTracker(){
    const val = id => parseFloat(document.getElementById(id).value) || 0;
    const s = taxLimitStatus({askDeposits: val('taxAskDeposits'), realizedGains: val('taxRealizedGains'), realizedLosses: val('taxRealizedLosses'),
        dividends: val('taxDividends'), lagerGains: val('taxLagerGains'), married: document.getElementById('taxMarried').checked});

    // Aktiesparekonto
    document.getElementById('taxAskValue').textContent = `${DK.format(s.ask.deposits)} af ${DK.format(s.ask.limit)} kr.`;
    setTaxBar('taxAskFill', s.ask.pct, s.ask.over > 0);
    const askNote = document.getElementById('taxAskNote');
    askNote.textContent = s.ask.over > 0
        ? `Du har sat ${DK.format(s.ask.over)} kr. mere ind end loftet. Kontakt din bank – beløbet over loftet skal hæves.`
        : s.ask.room === 0 ? 'Du har nået loftet og kan ikke sætte mere ind i år.'
        : `Du kan sætte ${DK.format(s.ask.room)} kr. mere ind.`;
    askNote.classList.toggle('hint-warning', s.ask.over > 0);

    // Aktieindkomst
    const inc = s.income;
    document.getElementById('taxIncomeValue').textContent = `${DK.format(Math.max(0, inc.amount))} af ${DK.format(inc.limit)} kr.`;
    setTaxBar('taxIncomeFill', inc.pct, inc.above > 0);
    document.getElementById('taxIncomeNote').textContent = inc.loss > 0
        ? `Dit tab er større end dine gevinster: ${DK.format(inc.loss)} kr. kan fremføres og trækkes fra i et senere år.`
        : inc.above > 0 ? `${DK.format(inc.above)} kr. ligger over grænsen og beskattes med ${pctNumber(AKT_TAX_HIGH)} %.`
        : `Du kan realisere ${DK.format(inc.room)} kr. mere gevinst i år, før skatten stiger til ${pctNumber(AKT_TAX_HIGH)} %.`;
    document.getElementById('taxIncomeNote').classList.toggle('hint-warning', inc.above > 0);

    document.getElementById('taxIncomeTotal').textContent = `${inc.amount < 0 ? '−' : ''}${DK.format(Math.abs(inc.amount))} kr.`;
    document.getElementById('taxIncomeTotal').classList.toggle('negative', inc.amount < 0);
    document.getElementById('taxRoom').textContent = `${DK.format(inc.room)} kr.`;
    document.getElementById('taxEstimate').textContent = `${DK.format(Math.round(inc.tax))} kr.`;
    document.getElementById('taxEstimateSub').textContent = inc.above > 0
        ? `${pctNumber(AKT_TAX_LOW)} % af ${DK.format(inc.limit)} kr. + ${pctNumber(AKT_TAX_HIGH)} % af resten`
        : `${pctNumber(AKT_TAX_LOW)} % af din aktieindkomst`;
}

loadTaxTrackerFields();
updateTaxTracker();
TAX_FIELDS.forEach(({id}) => document.getElementById(id).addEventListener('input', () => { updateTaxTracker(); saveTaxTracker(); }));
document.getElementById('taxMarried').addEventListener('change', () => { updateTaxTracker(); saveTaxTracker(); });
