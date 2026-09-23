/**
 * @file Hvor meget kan jeg låne? Viser den højeste boligpris ud fra
 * udbetaling, gældsfaktor og (valgfrit) månedlig ydelse, hvilken af dem der
 * begrænser, og hvordan købet er skruet sammen. Beregningen ligger i calc.js
 * (loanCapacity).
 */

const LOAN_LIMIT_LABELS = {
    downPayment: {title:'Udbetaling', text:'Opsparingen skal dække 5 % udbetaling og omkostningerne'},
    debtFactor: {title:'Gældsfaktor', text:'Samlet gæld i forhold til indkomsten før skat'},
    payment: {title:'Månedlig ydelse', text:'Den ydelse, du har sat som grænse'}
};

/** Genberegner alt ud fra formularen. Kaldes ved hvert input. */
function updateLoanCapacity(){
    const adults = readNumber('lcAdults', 2);
    const debtFactorLimit = readNumber('lcDebtFactor', 4);
    const r = loanCapacity({
        income: readNumber('lcIncome'),
        savings: readNumber('lcSavings'),
        existingDebt: readNumber('lcDebt'),
        debtFactorLimit,
        maxMonthlyPayment: readNumber('lcMaxPayment'),
        realkreditRate: readPercent('lcRkRate'),
        bidragssats: readPercent('lcBidrag'),
        realkreditYears: readNumber('lcRkYears', 30),
        bankRate: readPercent('lcBankRate'),
        bankYears: readNumber('lcBankYears', 20),
        otherCosts: readNumber('lcOtherCosts')
    });
    const d = r.details;

    document.getElementById('lcMaxPrice').textContent = DK.format(r.maxPrice) + ' kr.';
    document.getElementById('lcBinding').textContent = r.maxPrice > 0
        ? `Begrænset af: ${LOAN_LIMIT_LABELS[r.binding].title.toLowerCase()}`
        : 'Opsparingen dækker ikke engang omkostningerne ved et køb';

    // Én bjælke pr. krav, målt mod det største af dem - det korteste er det, der begrænser.
    const shown = Object.entries(r.limits).filter(([, v]) => v !== null);
    const widest = Math.max(...shown.map(([, v]) => v), 1);
    document.getElementById('lcLimits').replaceChildren(...shown.map(([key, value]) => el('div', {className:'limit-row' + (key === r.binding ? ' is-binding' : '')}, [
        el('div', {className:'limit-row-head'}, [
            el('span', {className:'limit-row-title', textContent: LOAN_LIMIT_LABELS[key].title}),
            el('span', {className:'limit-row-value', textContent: DK.format(Math.floor(value / 1000) * 1000) + ' kr.'})
        ]),
        el('div', {className:'progress-track'}, [el('div', {className:'progress-fill', attrs:{style:`width:${Math.max(2, value / widest * 100)}%`}})]),
        el('div', {className:'limit-hint', textContent: LOAN_LIMIT_LABELS[key].text})
    ])));

    const annualInterest = d.realkredit * (readPercent('lcRkRate') + readPercent('lcBidrag')) + d.bank * readPercent('lcBankRate');
    const deduction = interestDeductionValue(annualInterest, adults) / 12;
    const rows = [
        ['Boligpris', d.price],
        ['Udbetaling', d.downPayment, formatPct(d.price ? d.downPayment / d.price : 0) + ' af prisen'],
        ['Realkreditlån', d.realkredit],
        ['Banklån', d.bank],
        ['Tinglysning', d.costs.skoede + d.costs.pant],
        ['Andre købsomkostninger', d.costs.other],
        ['Gældsfaktor efter købet', null, d.debtFactor.toFixed(2).replace('.', ',')],
        ['Belåningsgrad', null, formatPct(d.ltv)],
        ['Ydelse realkredit pr. md.', d.realkreditPayment],
        ['Bidrag pr. md.', d.bidrag],
        ['Ydelse banklån pr. md.', d.bankPayment],
        ['I alt pr. md. før rentefradrag', d.monthly, null, true],
        ['Rentefradrag pr. md. (år 1, ca.)', -deduction],
        ['I alt pr. md. efter rentefradrag', d.monthly - deduction, null, true]
    ];
    document.getElementById('lcBreakdown').replaceChildren(...rows.map(([label, amount, text, strong]) => el('tr', {className: strong ? 'is-total' : ''}, [
        el('td', {textContent: label}),
        el('td', {textContent: amount === null ? text : DK.format(amount) + ' kr.' + (text ? ` (${text})` : '')})
    ])));

    const warning = document.getElementById('lcWarning');
    const highRisk = d.debtFactor > HIGH_DEBT_FACTOR && d.ltv > HIGH_LTV;
    warning.hidden = !highRisk;
    if(highRisk){
        warning.textContent = `Gældsfaktoren er over ${HIGH_DEBT_FACTOR} og belåningsgraden over ${formatPct(HIGH_LTV, 0)}. Efter Finanstilsynets retningslinjer kan du så kun låne med fast rente eller mindst 5 års rentetilpasning, og med afdrag.`;
    }
}

document.getElementById('housing1').addEventListener('input', updateLoanCapacity);
updateLoanCapacity();
