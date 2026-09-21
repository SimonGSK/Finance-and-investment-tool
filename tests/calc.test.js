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
    categoryTotal,
    CEPOS_WEALTH_TABLE, findNearestWealthRow, estimatePercentile,
    parseDanishAmount, findHeaderRowIndex, parseCSV
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
});

describe('formue: placering', () => {
    test('nærmeste aldersrække vælges, og alderen klemmes til 18-90', () => {
        assert.equal(findNearestWealthRow(33).age, 35);
        assert.equal(findNearestWealthRow(32).age, 30);
        assert.equal(findNearestWealthRow(17).age, 18);
        assert.equal(findNearestWealthRow(120).age, 90);
    });

    test('percentilen rammer de kendte grænser præcist', () => {
        const row = findNearestWealthRow(30);
        assert.equal(estimatePercentile(row.p10, row), 10);
        assert.equal(estimatePercentile(row.p50, row), 50);
        assert.equal(estimatePercentile(row.p90, row), 90);
        assert.equal(estimatePercentile(row.p99, row), 99);
    });

    test('percentilen er begrænset til 0-100 og stiger med formuen', () => {
        const row = findNearestWealthRow(40);
        assert.equal(estimatePercentile(-1e9, row), 0);
        assert.equal(estimatePercentile(1e12, row), 100);
        let last = -1;
        for (let v = -300000; v <= 30000000; v += 100000) {
            const p = estimatePercentile(v, row);
            assert.ok(p >= last, `faldt ved ${v}`);
            last = p;
        }
    });

    test('tabellen dækker 18-90 år i stigende orden', () => {
        assert.equal(CEPOS_WEALTH_TABLE[0].age, 18);
        assert.equal(CEPOS_WEALTH_TABLE.at(-1).age, 90);
        for (let i = 1; i < CEPOS_WEALTH_TABLE.length; i++) {
            assert.ok(CEPOS_WEALTH_TABLE[i].age > CEPOS_WEALTH_TABLE[i - 1].age);
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
