// Kør med: npm test  (eller: node --test tests/)
// Tester den rene beregningslogik i js/calc.js - ingen browser nødvendig.
const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../js/calc.js');

const {
    TAX_LIMIT_27, ASK_TAX, AKT_TAX_LOW, AKT_TAX_HIGH,
    setDoubleDeduction, effectiveTaxLimit,
    monthlyReturnFactor, toRealValue,
    computeAskSeries, computeAktFinalValueForStartYear, findBestHarvestStartYear, computeAktSeries,
    computeMonthlyFinalValueForStartYear, findBestMonthlyHarvestStartYear, computeMonthlySeries,
    computeFireSeries,
    monthlyAmount, categoryTotal, budgetSummary,
    upsertByDate, mergeByDate, changedFields, normalizeDate,
    CEPOS_WEALTH_TABLE, CEPOS_PENSION_TAX, findWealthRow, comparableNetWorth, estimatePercentile,
    parseDanishAmount, findHeaderRowIndex, parseCSV,
    annuityPayment, purchaseCosts, loanSplit, interestDeductionValue, loanCapacity,
    simulateBuyVsRent, simulateDebtPayoff,
    PAL_SKAT, PENSION_LIMITS, folkepensionAge, simulatePension,
    backupReminderDue, emergencyFundMonths, xirr, portfolioCashFlows,
    monthlyTrend, goalProgress
} = calc;

const approx = (actual, expected, tolerance = 1e-6) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (±${tolerance})`);

afterEach(() => setDoubleDeduction(false));

describe('skattesatser', () => {
    test('konstanterne er de gældende danske satser', () => {
        assert.equal(TAX_LIMIT_27, 79400);
        assert.equal(ASK_TAX, 0.17);
        assert.equal(AKT_TAX_LOW, 0.27);
        assert.equal(AKT_TAX_HIGH, 0.42);
    });

    test('dobbelt fradrag fordobler 27%-grænsen', () => {
        assert.equal(effectiveTaxLimit(), 79400);
        setDoubleDeduction(true);
        assert.equal(effectiveTaxLimit(), 158800);
        setDoubleDeduction(false);
        assert.equal(effectiveTaxLimit(), 79400);
    });
});

describe('afkast og inflation', () => {
    test('månedsfaktoren ganget 12 gange giver årsafkastet', () => {
        approx(Math.pow(monthlyReturnFactor(1.08), 12), 1.08);
        assert.equal(monthlyReturnFactor(1.0), 1);
    });

    test('toRealValue deflaterer med inflationen pr. år', () => {
        approx(toRealValue(102, 1, 1.02), 100);
        approx(toRealValue(100 * 1.02 ** 5, 5, 1.02), 100);
        assert.equal(toRealValue(500, 0, 1.03), 500);
    });
});

describe('aktiesparekonto (ASK)', () => {
    test('beskatter årets gevinst med 17% (lagerbeskatning)', () => {
        const s = computeAskSeries(1, 1.08, 100000, false);
        assert.equal(s.length, 2);
        assert.deepEqual(s[0], { year: 0, value: 100000, taxPaid: 0 });
        approx(s[1].value, 106640);   // 108.000 - 17% af 8.000
        approx(s[1].taxPaid, 1360);
    });

    test('betales skatten udefra, vokser kontoen ubeskattet', () => {
        const s = computeAskSeries(1, 1.08, 100000, true);
        approx(s[1].value, 108000);
        approx(s[1].taxPaid, 1360);   // skatten opgøres stadig, den trækkes bare ikke
    });

    test('uden afkast sker der ingenting', () => {
        const s = computeAskSeries(5, 1.0, 50000, false);
        assert.ok(s.every(p => p.value === 50000 && p.taxPaid === 0));
    });

    test('25 år, 100.000 kr., 8%: kendt slutværdi', () => {
        approx(Math.round(computeAskSeries(25, 1.08, 100000, false).at(-1).value), 498888);
    });
});

describe('aktiedepot (engangsindskud)', () => {
    test('ét år: hele gevinsten realiseres til 27%', () => {
        const { series, harvestStartYear } = computeAktSeries(1, 1.08, 100000, false);
        assert.equal(harvestStartYear, 1);
        assert.deepEqual(series[1], { year: 1, value: 105840, taxAt27: 2160, taxAt42: 0 });
    });

    test('gevinst over grænsen beskattes progressivt med 42%', () => {
        const expectedTax = TAX_LIMIT_27 * AKT_TAX_LOW + (1000000 - TAX_LIMIT_27) * AKT_TAX_HIGH;
        approx(computeAktFinalValueForStartYear(1, 2.0, 1000000, false, 1), 2000000 - expectedTax);
        assert.equal(computeAktFinalValueForStartYear(1, 2.0, 1000000, false, 1), 1591910);
    });

    test('dobbelt fradrag giver lavere skat på samme gevinst', () => {
        const single = computeAktFinalValueForStartYear(1, 2.0, 1000000, false, 1);
        setDoubleDeduction(true);
        const double = computeAktFinalValueForStartYear(1, 2.0, 1000000, false, 1);
        assert.equal(double, 1603820);
        assert.ok(double > single);
    });

    test('den optimale realiseringsstrategi er aldrig dårligere end at vente', () => {
        for (const [years, ret, cash] of [[25, 1.08, 100000], [10, 1.05, 500000], [40, 1.10, 20000]]) {
            const best = findBestHarvestStartYear(years, ret, cash, false);
            assert.ok(best >= 1 && best <= years);
            const withHarvest = computeAktFinalValueForStartYear(years, ret, cash, false, best);
            const noHarvest = computeAktFinalValueForStartYear(years, ret, cash, false, years);
            assert.ok(withHarvest >= noHarvest, `${years}y/${ret}/${cash}: ${withHarvest} < ${noHarvest}`);
        }
    });

    test('25 år, 100.000 kr., 8%: kendt strategi og slutværdi', () => {
        const best = findBestHarvestStartYear(25, 1.08, 100000, false);
        assert.equal(best, 19);
        const withHarvest = computeAktFinalValueForStartYear(25, 1.08, 100000, false, best);
        const noHarvest = computeAktFinalValueForStartYear(25, 1.08, 100000, false, 25);
        assert.equal(Math.round(withHarvest), 496847);
        assert.equal(Math.round(withHarvest - noHarvest), 45726);
    });

    test('der realiseres aldrig mere end 27%-grænsen i et høstår', () => {
        const { series } = computeAktSeries(25, 1.08, 100000, false);
        const maxTaxAt27 = TAX_LIMIT_27 * AKT_TAX_LOW;
        for (const p of series.slice(1, -1)) {
            assert.ok(p.taxAt27 <= maxTaxAt27 + 1e-9, `år ${p.year}: ${p.taxAt27} > ${maxTaxAt27}`);
            assert.equal(p.taxAt42, 0);
        }
    });

    test('serien og slutværdi-funktionen er enige om slutresultatet', () => {
        const { series, harvestStartYear } = computeAktSeries(15, 1.07, 250000, true);
        approx(series.at(-1).value, computeAktFinalValueForStartYear(15, 1.07, 250000, true, harvestStartYear), 1e-6);
    });
});

describe('aktiedepot (månedlig indbetaling)', () => {
    test('uden afkast er værdien lig det indbetalte, og der betales ingen skat', () => {
        const { series } = computeMonthlySeries(2, 1.0, 1000, 500);
        assert.equal(series[1].invested, 1000 + 12 * 500);
        assert.equal(series[2].invested, 1000 + 24 * 500);
        approx(series[2].value, 13000);
        assert.ok(series.every(p => p.taxAt27 === 0 && p.taxAt42 === 0));
    });

    test('indbetalt kapital vokser lineært med årene', () => {
        const { series } = computeMonthlySeries(10, 1.08, 20000, 3000);
        series.forEach(p => assert.equal(p.invested, 20000 + 12 * 3000 * p.year));
    });

    test('den optimale strategi er aldrig dårligere end at vente', () => {
        const best = findBestMonthlyHarvestStartYear(25, 1.08, 0, 3000);
        assert.equal(best, 17);
        const withHarvest = computeMonthlyFinalValueForStartYear(25, 1.08, 0, 3000, best);
        const noHarvest = computeMonthlyFinalValueForStartYear(25, 1.08, 0, 3000, 25);
        assert.ok(withHarvest >= noHarvest);
    });

    test('serien og slutværdi-funktionen er enige', () => {
        const { series, harvestStartYear } = computeMonthlySeries(12, 1.06, 5000, 2500);
        approx(series.at(-1).value, computeMonthlyFinalValueForStartYear(12, 1.06, 5000, 2500, harvestStartYear), 1e-6);
    });
});

describe('FIRE', () => {
    test('uden afkast lægges der bare indbetalinger til', () => {
        const s = computeFireSeries(1000, 100, 1.0, 3);
        assert.deepEqual(s.map(p => p.value), [1000, 2200, 3400, 4600]);
    });

    test('uden indbetalinger vokser startkapitalen med årsafkastet', () => {
        approx(computeFireSeries(1000, 0, 1.08, 1)[1].value, 1080);
        approx(computeFireSeries(1000, 0, 1.08, 10)[10].value, 1000 * 1.08 ** 10, 1e-6);
    });

    test('serien har ét punkt pr. år inkl. år 0', () => {
        assert.equal(computeFireSeries(0, 100, 1.05, 60).length, 61);
    });
});

describe('budget', () => {
    test('kategoritotal summerer beløb og ignorerer ugyldige', () => {
        const items = { bolig: [{ label: 'Husleje', amount: '7500' }, { label: 'El', amount: 700 }, { label: '?', amount: 'x' }] };
        assert.equal(categoryTotal(items, 'bolig'), 8200);
        assert.equal(categoryTotal(items, 'mad'), 0);
        assert.equal(categoryTotal({}, 'bolig'), 0);
    });

    test('ikke-månedlige poster omregnes til pr. måned', () => {
        assert.equal(monthlyAmount({ amount: 1200, freq: 12 }), 100);
        assert.equal(monthlyAmount({ amount: 900, freq: 3 }), 300);
        assert.equal(monthlyAmount({ amount: 500 }), 500);          // gamle poster uden freq er månedlige
        assert.equal(monthlyAmount({ amount: 'x', freq: 12 }), 0);
        const items = { forsikring: [{ amount: 6000, freq: 12 }, { amount: 250, freq: 1 }] };
        assert.equal(categoryTotal(items, 'forsikring'), 750);
    });

    test('opsummering fordeler på 50/30/20-grupper', () => {
        const cats = [{ id: 'a', group: 'behov' }, { id: 'b', group: 'onsker' }, { id: 'c', group: 'opsparing' }, { id: 'd', group: 'behov' }];
        const items = { a: [{ amount: 5000 }], b: [{ amount: 3000 }], c: [{ amount: 24000, freq: 12 }], d: [{ amount: 1000 }] };
        const s = budgetSummary(cats, items);
        assert.deepEqual(s.values, [5000, 3000, 2000, 1000]);
        assert.equal(s.sum, 11000);
        assert.deepEqual(s.groupSums, { behov: 6000, onsker: 3000, opsparing: 2000 });
    });

    test('tomt budget giver nuller', () => {
        const s = budgetSummary([{ id: 'a', group: 'behov' }], {});
        assert.equal(s.sum, 0);
        assert.deepEqual(s.groupSums, { behov: 0, onsker: 0, opsparing: 0 });
    });
});

describe('historik pr. dato', () => {
    const h = [{ date: '2026-07-31', v: 1 }, { date: '2026-08-31', v: 2 }];

    test('ny dato indsættes sorteret, intet erstattes', () => {
        const r = upsertByDate(h, { date: '2026-08-15', v: 9 });
        assert.deepEqual(r.history.map(x => x.date), ['2026-07-31', '2026-08-15', '2026-08-31']);
        assert.equal(r.replaced, null);
    });

    test('eksisterende dato erstattes, og det gamle punkt returneres', () => {
        const r = upsertByDate(h, { date: '2026-08-31', v: 5 });
        assert.equal(r.history.length, 2);
        assert.equal(r.history[1].v, 5);
        assert.deepEqual(r.replaced, { date: '2026-08-31', v: 2 });
    });

    test('den oprindelige liste ændres ikke', () => {
        upsertByDate(h, { date: '2026-08-31', v: 5 });
        assert.equal(h[1].v, 2);
    });

    test('fletning melder hvilke datoer der erstattes', () => {
        const r = mergeByDate(h, [{ date: '2026-08-31', v: 7 }, { date: '2026-09-30', v: 8 }, { date: '2026-07-31', v: 6 }]);
        assert.deepEqual(r.replacedDates, ['2026-07-31', '2026-08-31']);
        assert.equal(r.addedCount, 1);
        assert.deepEqual(r.history.map(x => x.v), [6, 7, 8]);
    });
});

describe('ændringer og datoer', () => {
    test('kun felter der faktisk ændres, kommer med', () => {
        const fields = [['cash', 'Kontanter'], ['stocks', 'Aktier'], ['debt', 'Gæld']];
        assert.deepEqual(changedFields({ cash: 100, stocks: 50 }, { cash: 100, stocks: 80, debt: 10 }, fields), [
            { key: 'stocks', label: 'Aktier', from: 50, to: 80 },
            { key: 'debt', label: 'Gæld', from: 0, to: 10 }
        ]);
        assert.deepEqual(changedFields({ cash: 1 }, { cash: 1 }, fields), []);
    });

    test('forstår ISO og danske datoformater', () => {
        assert.equal(normalizeDate('2026-08-31'), '2026-08-31');
        assert.equal(normalizeDate('31-08-2026'), '2026-08-31');
        assert.equal(normalizeDate('31.08.2026'), '2026-08-31');
        assert.equal(normalizeDate('1/9/2026'), '2026-09-01');
        assert.equal(normalizeDate(' 2026-9-1 '), '2026-09-01');
    });

    test('afviser ugyldige datoer', () => {
        assert.equal(normalizeDate('31-02-2026'), null);
        assert.equal(normalizeDate('2026-13-01'), null);
        assert.equal(normalizeDate('i går'), null);
        assert.equal(normalizeDate(''), null);
        assert.equal(normalizeDate(undefined), null);
    });
});

describe('formue: placering', () => {
    test('én række pr. alder fra 18 til 90, og alderen klemmes', () => {
        assert.equal(CEPOS_WEALTH_TABLE.length, 73);
        CEPOS_WEALTH_TABLE.forEach((row, i) => assert.equal(row.age, 18 + i));
        assert.equal(findWealthRow(33).age, 33);
        assert.equal(findWealthRow(27).age, 27);
        assert.equal(findWealthRow(17).age, 18);
        assert.equal(findWealthRow(120).age, 90);
    });

    test('CEPOS 2026: kendte tal for 40-årige', () => {
        assert.deepEqual(findWealthRow(40), { age: 40, avg: 1547000, p10: -55000, p25: 178000, p50: 750000, p75: 1627000, p90: 2899000, p95: 4124000, p99: 10096000 });
    });

    test('percentilgrænserne stiger inden for hver alder', () => {
        for(const r of CEPOS_WEALTH_TABLE){
            const seq = [r.p10, r.p25, r.p50, r.p75, r.p90, r.p95, r.p99];
            for(let i = 1; i < seq.length; i++) assert.ok(seq[i] >= seq[i - 1], `alder ${r.age}`);
        }
    });

    test('pensionen tæller med efter 40 % skat, som i CEPOS\' tal', () => {
        assert.equal(CEPOS_PENSION_TAX, 0.40);
        assert.equal(comparableNetWorth(1000000, 500000), 800000);
        assert.equal(comparableNetWorth(1000000, 0), 1000000);
    });

    test('percentilen rammer de kendte grænser præcist', () => {
        const row = findWealthRow(30);
        assert.equal(estimatePercentile(row.p10, row), 10);
        assert.equal(estimatePercentile(row.p50, row), 50);
        assert.equal(estimatePercentile(row.p90, row), 90);
        assert.equal(estimatePercentile(row.p99, row), 99);
    });

    test('percentilen er begrænset til 0-100 og stiger med formuen', () => {
        const row = findWealthRow(40);
        assert.equal(estimatePercentile(-1e9, row), 0);
        assert.equal(estimatePercentile(1e12, row), 100);
        let last = -1;
        for (let v = -300000; v <= 30000000; v += 100000) {
            const p = estimatePercentile(v, row);
            assert.ok(p >= last, `faldt ved ${v}`);
            last = p;
        }
    });
});

describe('parsing af danske tal', () => {
    test('forstår tusindtalspunktum og decimalkomma', () => {
        assert.equal(parseDanishAmount('10.099,00 kr.'), 10099);
        assert.equal(parseDanishAmount('1.234'), 1234);
        assert.equal(parseDanishAmount('12,7'), 13);
        assert.equal(parseDanishAmount('-500 kr.'), -500);
    });

    test('tomt eller ugyldigt giver 0', () => {
        assert.equal(parseDanishAmount(''), 0);
        assert.equal(parseDanishAmount(null), 0);
        assert.equal(parseDanishAmount('abc'), 0);
    });
});

describe('CSV', () => {
    test('finder overskriftsrækken selv hvis der er en titel-linje først', () => {
        assert.equal(findHeaderRowIndex([['Min tabel'], ['Dato', 'Værdi']]), 1);
        assert.equal(findHeaderRowIndex([['Dato', 'Værdi']]), 0);
        assert.equal(findHeaderRowIndex([['a'], ['b']]), -1);
    });

    test('opdager selv om filen bruger semikolon eller komma', () => {
        assert.deepEqual(parseCSV('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
        assert.deepEqual(parseCSV('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
    });

    test('respekterer anførselstegn, også med separator og "" indeni', () => {
        assert.deepEqual(parseCSV('"x;y";2'), [['x;y', '2']]);
        assert.deepEqual(parseCSV('"say ""hi""";3'), [['say "hi"', '3']]);
    });

    test('springer tomme linjer over', () => {
        assert.deepEqual(parseCSV('a;b\n\n1;2\n   \n'), [['a', 'b'], ['1', '2']]);
        assert.deepEqual(parseCSV(''), []);
    });
});

describe('bolig og lån: grundelementer', () => {
    test('annuitetsydelse matcher den kendte formel', () => {
        approx(annuityPayment(1000000, 0.04, 30), 4774.153, 0.001);
        approx(annuityPayment(120000, 0, 10), 1000);
        assert.equal(annuityPayment(0, 0.05, 30), 0);
    });

    test('tinglysning 2026: skøde 1.850 + 0,6 %, pant 1.825 + 1,25 % pr. lån', () => {
        assert.deepEqual(purchaseCosts(3000000, 2400000, 450000, 0), { skoede: 19850, pant: 39275, other: 0, total: 59125 });
        assert.equal(purchaseCosts(2000000, 0, 0, 15000).total, 1850 + 12000 + 15000);
    });

    test('realkredit højst 80 % af prisen, resten i banken', () => {
        assert.deepEqual(loanSplit(3000000, 150000), { loan: 2850000, realkredit: 2400000, bank: 450000 });
        assert.deepEqual(loanSplit(3000000, 1000000), { loan: 2000000, realkredit: 2000000, bank: 0 });
        assert.deepEqual(loanSplit(1000000, 2000000), { loan: 0, realkredit: 0, bank: 0 });
    });

    test('rentefradrag: 33 % op til 50.000 kr. pr. voksen, 25 % derover', () => {
        assert.equal(interestDeductionValue(40000, 1), 13200);
        approx(interestDeductionValue(80000, 1), 50000 * 0.33 + 30000 * 0.25);
        assert.equal(interestDeductionValue(80000, 2), 26400);
        assert.equal(interestDeductionValue(-5, 1), 0);
    });
});

describe('hvor meget kan jeg låne', () => {
    const base = { income: 900000, savings: 400000, existingDebt: 50000, debtFactorLimit: 4, maxMonthlyPayment: 0,
        realkreditRate: 0.04, bidragssats: 0.0075, realkreditYears: 30, bankRate: 0.065, bankYears: 20, otherCosts: 25000 };

    test('gældsfaktoren begrænser: 4 × 900.000 - 50.000 i lån', () => {
        const r = loanCapacity(base);
        assert.equal(r.binding, 'debtFactor');
        assert.equal(r.maxPrice, 3852000);
        approx(r.details.debtFactor, 4, 0.001);
        approx(r.details.loan, 3550000, 1000);
    });

    test('lille opsparing: udbetalingen på 5 % begrænser', () => {
        const r = loanCapacity({ ...base, savings: 100000, income: 2000000 });
        assert.equal(r.binding, 'downPayment');
        assert.ok(r.details.downPayment >= 0.05 * r.maxPrice);
        assert.ok(loanCapacity({ ...base, savings: 100000, income: 2000000 }).maxPrice < 100000 / 0.05);
    });

    test('ydelsesgrænsen overholdes, når den er sat', () => {
        const r = loanCapacity({ ...base, maxMonthlyPayment: 12000 });
        assert.equal(r.binding, 'payment');
        assert.ok(r.details.monthly <= 12000);
        const above = loanCapacity({ ...base, maxMonthlyPayment: 12000 });
        assert.ok(above.limits.payment < above.limits.debtFactor);
    });

    test('ved maksprisen er alle krav opfyldt', () => {
        for(const variant of [base, { ...base, savings: 150000 }, { ...base, maxMonthlyPayment: 15000 }, { ...base, existingDebt: 0, income: 500000 }]){
            const r = loanCapacity(variant);
            const d = r.details;
            assert.ok(d.downPayment >= 0.05 * r.maxPrice - 1, 'udbetaling');
            assert.ok(d.debtFactor <= variant.debtFactorLimit + 1e-9, 'gældsfaktor');
            if(variant.maxMonthlyPayment) assert.ok(d.monthly <= variant.maxMonthlyPayment + 1e-6, 'ydelse');
        }
    });

    test('opsparing, der ikke dækker omkostningerne, giver 0', () => {
        assert.equal(loanCapacity({ ...base, savings: 20000 }).maxPrice, 0);
    });
});

describe('køb eller leje', () => {
    const zero = { realkreditRate: 0, bidragssats: 0, realkreditYears: 30, bankRate: 0, bankYears: 20,
        propertyTaxYearly: 0, maintenancePct: 0, ownerCostsMonthly: 0, priceGrowth: 0, otherBuyCosts: 0,
        sellCostsPct: 0, rentGrowth: 0, depositMonths: 3, investReturn: 0, adults: 1 };

    test('kontantkøb uden udgifter: køber sparer præcis huslejen', () => {
        const r = simulateBuyVsRent({ ...zero, price: 1000000, downPayment: 1000000, rentMonthly: 5000, years: 1 });
        const skoede = 1850 + 6000;
        assert.equal(r.upfront, 1000000 + skoede);
        assert.equal(r.final.buyer, 1000000 + 12 * 5000);           // boligen + investeret husleje-besparelse
        assert.equal(r.final.renter, 1000000 + skoede);              // hele startformuen, depositum retur
        assert.equal(r.breakEvenYear, 1);
    });

    test('begge starter med samme formue minus køberens omkostninger', () => {
        const r = simulateBuyVsRent({ ...zero, price: 2000000, downPayment: 100000, rentMonthly: 8000, years: 5 });
        approx(r.series[0].renter - r.series[0].buyer, r.costs.total, 1e-6);
    });

    test('lån afdrages og restgælden falder', () => {
        const r = simulateBuyVsRent({ ...zero, realkreditRate: 0.04, bankRate: 0.06, price: 3000000, downPayment: 150000, rentMonthly: 12000, years: 10 });
        for(let i = 1; i < r.series.length; i++) assert.ok(r.series[i].debt < r.series[i - 1].debt);
    });

    test('højere boligprisstigning favoriserer køb', () => {
        const p = { ...zero, realkreditRate: 0.04, price: 3000000, downPayment: 300000, rentMonthly: 13000, investReturn: 0.05, years: 15 };
        const low = simulateBuyVsRent({ ...p, priceGrowth: 0 });
        const high = simulateBuyVsRent({ ...p, priceGrowth: 0.04 });
        assert.ok(high.final.buyer - high.final.renter > low.final.buyer - low.final.renter);
    });
});

describe('gældsafvikling', () => {
    test('rentefrit lån betales af på præcis antal måneder', () => {
        const r = simulateDebtPayoff([{ name: 'A', balance: 12000, rate: 0, minPayment: 1000 }], 0, 'avalanche');
        assert.equal(r.feasible, true);
        assert.equal(r.months, 12);
        assert.equal(r.totalInterest, 0);
        assert.equal(r.balances.length, 13);
        assert.equal(r.balances.at(-1), 0);
    });

    test('lavine giver aldrig mere rente end snebold', () => {
        const debts = [
            { name: 'Kreditkort', balance: 10000, rate: 0.20, minPayment: 200 },
            { name: 'Billån', balance: 2000, rate: 0.05, minPayment: 100 },
            { name: 'Forbrugslån', balance: 30000, rate: 0.12, minPayment: 600 }
        ];
        const av = simulateDebtPayoff(debts, 500, 'avalanche');
        const sb = simulateDebtPayoff(debts, 500, 'snowball');
        const min = simulateDebtPayoff(debts, 500, 'minimum');
        assert.ok(av.totalInterest <= sb.totalInterest);
        assert.ok(sb.totalInterest < min.totalInterest);
        assert.ok(av.months <= min.months);
        assert.equal(sb.payoff[0].name, 'Billån');            // mindste restgæld først
        assert.equal(av.payoff[0].name, 'Kreditkort');         // højeste rente først
    });

    test('ydelse under renten bliver aldrig betalt', () => {
        const r = simulateDebtPayoff([{ name: 'A', balance: 100000, rate: 0.24, minPayment: 1000 }], 0, 'avalanche');
        assert.equal(r.feasible, false);
        assert.equal(r.months, null);
    });

    test('restgælden falder hver måned, når ydelsen dækker renten', () => {
        const r = simulateDebtPayoff([{ name: 'A', balance: 50000, rate: 0.08, minPayment: 1500 }], 200, 'snowball');
        for(let i = 1; i < r.balances.length; i++) assert.ok(r.balances[i] < r.balances[i - 1]);
    });
});

describe('pension', () => {
    test('satser 2026', () => {
        assert.equal(PAL_SKAT, 0.153);
        assert.deepEqual(PENSION_LIMITS, { aldersopsparing: 9900, aldersopsparingNearPension: 64200, ratepension: 68700 });
    });

    test('folkepensionsalder: 67-70 er vedtaget, derover skøn', () => {
        assert.deepEqual(folkepensionAge(1960), { age: 67, legislated: true });
        assert.deepEqual(folkepensionAge(1963), { age: 68, legislated: true });
        assert.deepEqual(folkepensionAge(1970), { age: 69, legislated: true });
        assert.deepEqual(folkepensionAge(1971), { age: 70, legislated: true });
        assert.deepEqual(folkepensionAge(1976), { age: 71, legislated: false });
        assert.deepEqual(folkepensionAge(1987, 6), { age: 72.5, legislated: false });
        assert.deepEqual(folkepensionAge(1987, 7), { age: 73, legislated: false });
        assert.deepEqual(folkepensionAge(2000), { age: 74, legislated: false });
    });

    test('uden afkast er formuen opsparing + indbetalinger, fordelt jævnt ud', () => {
        const r = simulatePension({ currentAge: 60, retirementAge: 65, currentSavings: 100000, monthlyContribution: 1000,
            annualReturn: 0, annualCosts: 0, inflation: 0, payoutYears: 10, payoutTaxRate: 0 });
        assert.equal(r.balanceAtRetirement, 160000);
        assert.equal(r.totalContributions, 60000);
        approx(r.monthlyPayoutGross, 160000 / 120);
    });

    test('afkast efter omkostninger og PAL-skat', () => {
        const r = simulatePension({ currentAge: 50, retirementAge: 51, currentSavings: 100000, monthlyContribution: 0,
            annualReturn: 0.10, annualCosts: 0, inflation: 0, payoutYears: 10, payoutTaxRate: 0 });
        approx(r.netAnnualReturn, 0.0847);
        approx(r.balanceAtRetirement, 108470, 1e-6);
    });

    test('udbetalingen tømmer præcis formuen, og skat trækkes fra netto', () => {
        const r = simulatePension({ currentAge: 30, retirementAge: 69, currentSavings: 100000, monthlyContribution: 4000,
            annualReturn: 0.06, annualCosts: 0.006, inflation: 0.02, payoutYears: 20, payoutTaxRate: 0.37 });
        approx(r.series.at(-1).balance, 0, 1e-3);
        approx(r.monthlyPayoutNet, r.monthlyPayoutGross * 0.63);
        assert.ok(r.balanceAtRetirementReal < r.balanceAtRetirement);
    });
});

describe('backup-påmindelse', () => {
    const day = 24 * 60 * 60 * 1000, now = Date.parse('2026-09-24T12:00:00Z');
    test('ingen data, ingen påmindelse', () => {
        assert.equal(backupReminderDue({hasData:false, now, lastBackupAt:null, firstDataAt:now - 100 * day, snoozedUntil:null}).due, false);
    });
    test('aldrig taget backup: påmind efter 7 dage med data', () => {
        assert.equal(backupReminderDue({hasData:true, now, lastBackupAt:null, firstDataAt:now - 6 * day, snoozedUntil:null}).due, false);
        assert.equal(backupReminderDue({hasData:true, now, lastBackupAt:null, firstDataAt:now - 7 * day, snoozedUntil:null}).due, true);
    });
    test('seneste backup over 30 dage gammel', () => {
        const r = backupReminderDue({hasData:true, now, lastBackupAt:now - 31 * day, firstDataAt:null, snoozedUntil:null});
        assert.deepEqual(r, {due:true, daysSinceBackup:31});
        assert.equal(backupReminderDue({hasData:true, now, lastBackupAt:now - 29 * day, firstDataAt:null, snoozedUntil:null}).due, false);
    });
    test('udsættelse respekteres, indtil den udløber', () => {
        const base = {hasData:true, now, lastBackupAt:now - 60 * day, firstDataAt:null};
        assert.equal(backupReminderDue({...base, snoozedUntil: now + day}).due, false);
        assert.equal(backupReminderDue({...base, snoozedUntil: now - day}).due, true);
    });
});

describe('nødopsparing', () => {
    test('måneder dækket', () => {
        assert.equal(emergencyFundMonths(90000, 30000), 3);
        assert.equal(emergencyFundMonths(-5000, 30000), 0);
        assert.equal(emergencyFundMonths(90000, 0), null);
    });
});

describe('faktisk afkast (XIRR)', () => {
    test('100 bliver til 110 på et år: 10 %', () => {
        approx(xirr([{date:'2025-01-01', amount:-100}, {date:'2026-01-01', amount:110}]), 0.10, 1e-9);
    });
    test('nutidsværdien er 0 ved den fundne rente, også med ekstra indskud', () => {
        const flows = [{date:'2024-01-01', amount:-10000}, {date:'2024-07-01', amount:-5000}, {date:'2025-03-15', amount:-2000}, {date:'2026-01-01', amount:19500}];
        const r = xirr(flows);
        const t0 = Date.parse('2024-01-01T00:00:00Z');
        const npv = flows.reduce((s, f) => s + f.amount / Math.pow(1 + r, (Date.parse(f.date + 'T00:00:00Z') - t0) / (365 * 24 * 3600 * 1000)), 0);
        approx(npv, 0, 1e-6);
        assert.ok(r > 0 && r < 0.2);
    });
    test('tab giver negativ rente', () => {
        assert.ok(xirr([{date:'2025-01-01', amount:-100}, {date:'2026-01-01', amount:80}]) < 0);
    });
    test('kan ikke bestemmes uden både ind- og udbetalinger', () => {
        assert.equal(xirr([{date:'2025-01-01', amount:-100}]), null);
        assert.equal(xirr([{date:'2025-01-01', amount:-100}, {date:'2026-01-01', amount:-10}]), null);
    });
    test('pengestrømme fra porteføljehistorik', () => {
        const h = [
            {date:'2025-01-31', portfolioValue:100000, deposit:5000},
            {date:'2025-02-28', portfolioValue:106000, deposit:3000},
            {date:'2025-03-31', portfolioValue:108000, deposit:0}
        ];
        assert.deepEqual(portfolioCashFlows(h), [
            {date:'2025-01-31', amount:-100000},
            {date:'2025-02-28', amount:-3000},
            {date:'2025-03-31', amount:108000}
        ]);
        assert.deepEqual(portfolioCashFlows(h.slice(0, 1)), []);
    });
});

describe('mål', () => {
    const h = [
        { date: '2025-09-30', value: 400000 },
        { date: '2026-03-31', value: 460000 },
        { date: '2026-09-30', value: 520000 }
    ];
    test('månedlig udvikling over det seneste år', () => {
        approx(monthlyTrend(h, 'value'), 120000 / (365 / 30.44), 1);
        assert.equal(monthlyTrend(h.slice(0, 1), 'value'), null);
        assert.equal(monthlyTrend([{ date: '2026-09-01', value: 1 }, { date: '2026-09-15', value: 2 }], 'value'), null);
    });
    test('kun det seneste år tæller med', () => {
        const old = [{ date: '2020-01-31', value: 0 }, ...h];
        approx(monthlyTrend(old, 'value'), monthlyTrend(h, 'value'), 1e-9);
    });
    test('fremdrift og krævet opsparing pr. måned', () => {
        const g = goalProgress({ target: 1000000, current: 520000, deadline: '2030-09-30', today: '2026-09-30', trend: 12000 });
        approx(g.pct, 0.52);
        assert.equal(g.remaining, 480000);
        assert.equal(g.reached, false);
        approx(g.neededPerMonth, 480000 / ((Date.parse('2030-09-30') - Date.parse('2026-09-30')) / (86400000 * 30.44)), 1e-6);
        assert.equal(g.onTrack, true);
        approx(g.monthsAtTrend, 40);
    });
    test('bag efter, når tempoet ikke rækker', () => {
        assert.equal(goalProgress({ target: 1000000, current: 520000, deadline: '2027-09-30', today: '2026-09-30', trend: 10000 }).onTrack, false);
    });
    test('nået mål og mål uden frist', () => {
        assert.deepEqual(goalProgress({ target: 100, current: 150, today: '2026-09-30' }),
            { pct: 1, remaining: 0, reached: true, monthsLeft: null, neededPerMonth: null, monthsAtTrend: null, onTrack: true });
        const noDeadline = goalProgress({ target: 100, current: 50, today: '2026-09-30', trend: null });
        assert.equal(noDeadline.onTrack, null);
        assert.equal(noDeadline.neededPerMonth, null);
    });
});

describe('regnestykker i talfelter', () => {
    const { parseAmount, isExpression } = calc;
    test('almindelige tal på dansk og med punktum', () => {
        assert.equal(parseAmount('1000'), 1000);
        assert.equal(parseAmount('1.000'), 1000);
        assert.equal(parseAmount('1.000.000'), 1000000);
        assert.equal(parseAmount('2,5'), 2.5);
        assert.equal(parseAmount('2.5'), 2.5);
        assert.equal(parseAmount('0.125'), 0.125);
        assert.equal(parseAmount('1.000,50'), 1000.5);
        assert.equal(parseAmount('12 500 kr.'), 12500);
        assert.equal(parseAmount('-300'), -300);
    });
    test('de fire regnearter med rigtig rækkefølge og parenteser', () => {
        assert.equal(parseAmount('12.500 + 3.200'), 15700);
        assert.equal(parseAmount('450*12'), 5400);
        assert.equal(parseAmount('100 + 200 * 3'), 700);
        assert.equal(parseAmount('(100 + 200) * 3'), 900);
        assert.equal(parseAmount('60000/12'), 5000);
        assert.equal(parseAmount('5.000 − 1.200'), 3800);
        assert.equal(parseAmount('3 × 2,5'), 7.5);
        assert.equal(parseAmount('0,1 + 0,2'), 0.3);
        assert.equal(parseAmount('10 - -5'), 15);
    });
    test('ugyldigt eller ufuldstændigt giver null', () => {
        for(const bad of ['', '   ', '100 +', '*5', '(1+2', '1+2)', 'abc', '10/0', '1,2,3', '1.2.3', '1.00,5', '5 5 +']){
            assert.equal(parseAmount(bad), null, bad);
        }
    });
    test('genkender regnestykker', () => {
        assert.equal(isExpression('100+200'), true);
        assert.equal(isExpression('(5)'), true);
        assert.equal(isExpression('-300'), false);
        assert.equal(isExpression('1.000,50'), false);
        assert.equal(isExpression('2.5'), false);
    });
});

describe('budget til download', () => {
    const groups = [{id:'behov', label:'Behov'}, {id:'onsker', label:'Ønsker'}, {id:'opsparing', label:'Opsparing'}];
    const frequencies = [{months:1, label:'pr. måned'}, {months:3, label:'pr. kvartal'}, {months:12, label:'pr. år'}];
    const categories = [
        {id:'catBolig', label:'Bolig', group:'behov'},
        {id:'catFritid', label:'Fritid', group:'onsker'},
        {id:'catOpsparing', label:'Opsparing', group:'opsparing'}
    ];
    const items = {
        catBolig: [{label:'Husleje', amount:9000, freq:1}, {label:'Ejendomsskat', amount:3000, freq:3}],
        catFritid: [{label:'', amount:1250.5}],
        catOpsparing: [{label:'Aktier', amount:3000, freq:1}]
    };

    test('én række pr. post med beløb pr. måned og pr. år', () => {
        const rows = calc.budgetExportRows({categories, groups, items, frequencies});
        assert.deepEqual(rows[0], ['Gruppe', 'Kategori', 'Post', 'Beløb (kr.)', 'Hvor ofte', 'Pr. måned (kr.)', 'Pr. år (kr.)']);
        assert.deepEqual(rows[2], ['Behov', 'Bolig', 'Ejendomsskat', '3000', 'pr. kvartal', '1000', '12000']);
        assert.deepEqual(rows[3], ['Ønsker', 'Fritid', '(uden navn)', '1250,5', 'pr. måned', '1250,5', '15006']);
        assert.equal(rows.length, 1 + 4 + 1 + 1 + 3 + 1);
    });

    test('opsummering med 50/30/20 og penge tilbage, når beløbet er udfyldt', () => {
        const rows = calc.budgetExportRows({categories, groups, items, frequencies, total: 20000});
        const summary = rows.slice(rows.findIndex(r => r[0] === 'Opsummering'));
        const find = label => summary.find(r => r[0] === label);
        assert.deepEqual(find('Behov').slice(5), ['10000', '120000', csvShare(10000, 14250.5), 'højst 50 %']);
        assert.deepEqual(find('Samlet budget').slice(5, 7), ['14250,5', '171006']);
        assert.deepEqual(find('Penge tilbage').slice(5, 7), ['5749,5', '68994']);
        function csvShare(v, sum){ return calc.csvNumber(v / sum * 100); }
    });

    test('et tomt budget giver kun overskrift og opsummering', () => {
        const rows = calc.budgetExportRows({categories, groups, items:{}, frequencies});
        assert.equal(rows.length, 1 + 1 + 1 + 3 + 1);
        assert.equal(rows.find(r => r[0] === 'Penge tilbage'), undefined);
    });
});

describe('lavine mod snebold', () => {
    const run = (debts, s) => calc.simulateDebtPayoff(debts, 1000, s);
    test('samme rækkefølge giver præcis det samme', () => {
        const debts = [{name:'Kreditkort', balance:15000, rate:0.22, minPayment:500}, {name:'Billån', balance:60000, rate:0.065, minPayment:1500}];
        const c = calc.compareDebtStrategies(run(debts, 'avalanche'), run(debts, 'snowball'));
        assert.equal(c.identical, true);
    });
    test('forskellig rækkefølge: lavine er billigst, snebold giver den første sejr', () => {
        const debts = [{name:'Kreditkort', balance:25000, rate:0.22, minPayment:600}, {name:'Forbrugslån', balance:8000, rate:0.12, minPayment:300}, {name:'Billån', balance:60000, rate:0.065, minPayment:1500}];
        const c = calc.compareDebtStrategies(run(debts, 'avalanche'), run(debts, 'snowball'));
        assert.equal(c.identical, false);
        assert.ok(c.interestSaved > 800 && c.interestSaved < 1000, String(c.interestSaved));
        assert.equal(c.monthsSaved, 1);
        assert.deepEqual([c.firstSnowball.name, c.firstSnowball.month], ['Forbrugslån', 7]);
        assert.deepEqual([c.firstAvalanche.name, c.firstAvalanche.month], ['Kreditkort', 19]);
    });
    test('ingen sammenligning, hvis gælden aldrig bliver betalt ud', () => {
        const debts = [{name:'Lån', balance:100000, rate:0.2, minPayment:100}];
        assert.equal(calc.compareDebtStrategies(calc.simulateDebtPayoff(debts, 0, 'avalanche'), calc.simulateDebtPayoff(debts, 0, 'snowball')), null);
    });
});

describe('formuetal: felterne eller seneste øjebliksbillede', () => {
    const history = [
        {date:'2026-08-31', value:520000, liquid:320000, netCatKontanter:110000, netCatAktier:210000, netCatPension:230000, netCatFrivaerdi:0, netCatAndet:0, debt:30000},
        {date:'2026-07-31', value:500000, liquid:300000, netCatKontanter:100000, netCatAktier:200000, netCatPension:200000, netCatFrivaerdi:0, netCatAndet:0, debt:0}
    ];
    const zero = {netCatKontanter:0, netCatAktier:0, netCatPension:0, netCatFrivaerdi:0, netCatAndet:0, debt:0};

    test('tomme felter bruger det seneste øjebliksbillede', () => {
        const f = calc.pickNetWorthFigures(zero, history);
        assert.equal(f.fromSnapshot, true);
        assert.equal(f.date, '2026-08-31');
        assert.equal(f.netCatAktier, 210000);
        assert.equal(f.value, 520000);
        assert.equal(f.liquid, 320000);
        assert.equal(f.assets, 550000);
    });
    test('udfyldte felter vinder, også hvis kun gælden er udfyldt', () => {
        const f = calc.pickNetWorthFigures({...zero, netCatAktier:50000}, history);
        assert.equal(f.fromSnapshot, false);
        assert.equal(f.value, 50000);
        assert.equal(calc.pickNetWorthFigures({...zero, debt:1000}, history).value, -1000);
    });
    test('uden historik er det bare felterne', () => {
        const f = calc.pickNetWorthFigures(zero, []);
        assert.equal(f.fromSnapshot, false);
        assert.equal(f.value, 0);
    });
    test('ældre øjebliksbilleder med kun value virker også', () => {
        const f = calc.pickNetWorthFigures(zero, [{date:'2025-12-31', value:400000}]);
        assert.equal(f.value, 400000);
        assert.equal(f.liquid, 0);
    });
});
