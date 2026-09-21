// Ren beregningslogik uden nogen afhængighed af DOM'et. Filen indlæses som et
// almindeligt script i browseren (og definerer derfor sine funktioner globalt),
// og kan samtidig require()'es fra Node, så tests/ kan afprøve tallene direkte.

// ==== Skattesatser og -grænser ====

const TAX_LIMIT_27 = 79400;
const ASK_TAX = 0.17;
const AKT_TAX_LOW = 0.27;
const AKT_TAX_HIGH = 0.42;

// ==== Dobbelt fradrag (ægtefælle) og den effektive 27%-grænse ====

let doubleDeductionEnabled = false;

function setDoubleDeduction(enabled){
    doubleDeductionEnabled = !!enabled;
}

function effectiveTaxLimit(){
    return doubleDeductionEnabled ? TAX_LIMIT_27 * 2 : TAX_LIMIT_27;
}

// ==== Afkast og inflation ====

// ---- Porteret fra Main.java: monthlyReturnFactor() ----
function monthlyReturnFactor(yearlyReturn){
    return Math.pow(yearlyReturn, 1/12);
}

// Regner et fremtidigt (nominelt) beløb om til nutidens købekraft.
function toRealValue(nominalValue, year, inflationFactor){
    return nominalValue / Math.pow(inflationFactor, year);
}

// ==== Aktiesparekonto vs. aktiedepot (engangsindskud) ====

// ---- Porteret fra Main.java: ask() ----
function computeAskSeries(years, yearlyReturn, startCash, payTaxExternally){
    let money = startCash;
    const series = [{year:0, value:startCash, taxPaid:0}];
    for(let i=1;i<=years;i++){
        const before = money*yearlyReturn;
        const tax = (before-money)*ASK_TAX;
        money = payTaxExternally ? before : before-tax;
        series.push({year:i, value:money, taxPaid:tax});
    }
    return series;
}

// ---- Importeret fra Main.java: computeFinalValueForStartYear() ----
function computeAktFinalValueForStartYear(years, yearlyReturn, startCash, investSavedAskTax, harvestStartYear){
    let shareValue = startCash, costBasis = startCash, shadowAskMoney = startCash;
    const taxLimit = effectiveTaxLimit();
    for(let i=1;i<=years;i++){
        if(investSavedAskTax){
            const shadowProfit = shadowAskMoney*yearlyReturn - shadowAskMoney;
            const askTax = shadowProfit>0 ? shadowProfit*ASK_TAX : 0;
            shadowAskMoney = shadowAskMoney*yearlyReturn;
            if(askTax>0){ shareValue+=askTax; costBasis+=askTax; }
        }
        shareValue *= yearlyReturn;
        if(i<years){
            if(i>=harvestStartYear){
                const unrealized = shareValue-costBasis;
                if(unrealized>0){
                    const realize = Math.min(unrealized, taxLimit);
                    const tax = realize*AKT_TAX_LOW;
                    shareValue -= tax;
                    costBasis += (realize-tax);
                }
            }
        } else {
            const finalUnrealized = shareValue-costBasis;
            if(finalUnrealized>0){
                const tax = finalUnrealized<=taxLimit
                    ? finalUnrealized*AKT_TAX_LOW
                    : taxLimit*AKT_TAX_LOW + (finalUnrealized-taxLimit)*AKT_TAX_HIGH;
                shareValue -= tax;
            }
        }
    }
    return shareValue;
}

// ---- Importeret fra Main.java: findBestHarvestStartYear() ----
function findBestHarvestStartYear(years, yearlyReturn, startCash, investSavedAskTax){
    let bestStart = years;
    let bestValue = computeAktFinalValueForStartYear(years, yearlyReturn, startCash, investSavedAskTax, bestStart);
    for(let c=years-1;c>=1;c--){
        const v = computeAktFinalValueForStartYear(years, yearlyReturn, startCash, investSavedAskTax, c);
        if(v>bestValue){ bestValue=v; bestStart=c; }
    }
    return bestStart;
}

// ---- Importeret fra Main.java: akt() (år-for-år-serie, med den optimale strategi) ----
function computeAktSeries(years, yearlyReturn, startCash, investSavedAskTax){
    const harvestStartYear = findBestHarvestStartYear(years, yearlyReturn, startCash, investSavedAskTax);
    let shareValue = startCash, costBasis = startCash, shadowAskMoney = startCash;
    const taxLimit = effectiveTaxLimit();
    const series = [{year:0, value:startCash, taxAt27:0, taxAt42:0}];
    for(let i=1;i<=years;i++){
        if(investSavedAskTax){
            const shadowProfit = shadowAskMoney*yearlyReturn - shadowAskMoney;
            const askTax = shadowProfit>0 ? shadowProfit*ASK_TAX : 0;
            shadowAskMoney = shadowAskMoney*yearlyReturn;
            if(askTax>0){ shareValue+=askTax; costBasis+=askTax; }
        }
        shareValue *= yearlyReturn;

        let taxAt27 = 0, taxAt42 = 0;

        if(i<years){
            if(i>=harvestStartYear){
                const unrealized = shareValue-costBasis;
                if(unrealized>0){
                    const realize = Math.min(unrealized, taxLimit);
                    const tax = realize*AKT_TAX_LOW;
                    shareValue -= tax;
                    costBasis += (realize-tax);
                    taxAt27 = tax;
                }
            }
        } else {
            const finalUnrealized = shareValue-costBasis;
            if(finalUnrealized>0){
                if(finalUnrealized<=taxLimit){
                    taxAt27 = finalUnrealized*AKT_TAX_LOW;
                } else {
                    taxAt27 = taxLimit*AKT_TAX_LOW;
                    taxAt42 = (finalUnrealized-taxLimit)*AKT_TAX_HIGH;
                }
                shareValue -= (taxAt27 + taxAt42);
            }
        }
        series.push({year:i, value:shareValue, taxAt27, taxAt42});
    }
    return {series, harvestStartYear};
}

// ==== Aktiedepot med månedlig indbetaling ====

// ---- Porteret fra Main.java: computeMonthlyFinalValueForStartYear() ----
function computeMonthlyFinalValueForStartYear(years, yearlyReturn, startCash, monthlyAmount, harvestStartYear){
    let shareValue = startCash, costBasis = startCash;
    const monthlyFactor = monthlyReturnFactor(yearlyReturn);
    const taxLimit = effectiveTaxLimit();

    for(let i=1;i<=years;i++){
        for(let m=1;m<=12;m++){
            shareValue += monthlyAmount;
            costBasis += monthlyAmount;
            shareValue *= monthlyFactor;
        }

        if(i<years){
            if(i>=harvestStartYear){
                const unrealized = shareValue-costBasis;
                if(unrealized>0){
                    const realize = Math.min(unrealized, taxLimit);
                    const tax = realize*AKT_TAX_LOW;
                    shareValue -= tax;
                    costBasis += (realize-tax);
                }
            }
        } else {
            const finalUnrealized = shareValue-costBasis;
            if(finalUnrealized>0){
                const tax = finalUnrealized<=taxLimit
                    ? finalUnrealized*AKT_TAX_LOW
                    : taxLimit*AKT_TAX_LOW + (finalUnrealized-taxLimit)*AKT_TAX_HIGH;
                shareValue -= tax;
            }
        }
    }
    return shareValue;
}

// ---- Porteret fra Main.java: findBestMonthlyHarvestStartYear() ----
function findBestMonthlyHarvestStartYear(years, yearlyReturn, startCash, monthlyAmount){
    let bestStart = years;
    let bestValue = computeMonthlyFinalValueForStartYear(years, yearlyReturn, startCash, monthlyAmount, bestStart);
    for(let c=years-1;c>=1;c--){
        const v = computeMonthlyFinalValueForStartYear(years, yearlyReturn, startCash, monthlyAmount, c);
        if(v>bestValue){ bestValue=v; bestStart=c; }
    }
    return bestStart;
}

function computeMonthlySeries(years, yearlyReturn, startCash, monthlyAmount){
    const harvestStartYear = findBestMonthlyHarvestStartYear(years, yearlyReturn, startCash, monthlyAmount);
    let shareValue = startCash, costBasis = startCash, cumulativeInvested = startCash;
    const monthlyFactor = monthlyReturnFactor(yearlyReturn);
    const taxLimit = effectiveTaxLimit();
    const series = [{year:0, value:startCash, invested:startCash, taxAt27:0, taxAt42:0}];

    for(let i=1;i<=years;i++){
        for(let m=1;m<=12;m++){
            shareValue += monthlyAmount;
            costBasis += monthlyAmount;
            cumulativeInvested += monthlyAmount;
            shareValue *= monthlyFactor;
        }

        let taxAt27 = 0, taxAt42 = 0;

        if(i<years){
            if(i>=harvestStartYear){
                const unrealized = shareValue-costBasis;
                if(unrealized>0){
                    const realize = Math.min(unrealized, taxLimit);
                    const tax = realize*AKT_TAX_LOW;
                    shareValue -= tax;
                    costBasis += (realize-tax);
                    taxAt27 = tax;
                }
            }
        } else {
            const finalUnrealized = shareValue-costBasis;
            if(finalUnrealized>0){
                if(finalUnrealized<=taxLimit){
                    taxAt27 = finalUnrealized*AKT_TAX_LOW;
                } else {
                    taxAt27 = taxLimit*AKT_TAX_LOW;
                    taxAt42 = (finalUnrealized-taxLimit)*AKT_TAX_HIGH;
                }
                shareValue -= (taxAt27 + taxAt42);
            }
        }
        series.push({year:i, value:shareValue, invested:cumulativeInvested, taxAt27, taxAt42});
    }
    return {series, harvestStartYear};
}

// ==== FIRE-opsparing ====

// FIRE-opsparing: rent vækst-loop uden skatteoptimering (der er intet at "høste"
// på en opsparing, man endnu ikke har rørt). Genbruger monthlyReturnFactor() fra
// det månedlige aktiedepot-værktøj.
function computeFireSeries(startCash, monthlyAmount, yearlyReturn, maxYears){
    const monthlyFactor = monthlyReturnFactor(yearlyReturn);
    let value = startCash;
    const series = [{year:0, value:startCash}];
    for(let i=1;i<=maxYears;i++){
        for(let m=1;m<=12;m++){
            value += monthlyAmount;
            value *= monthlyFactor;
        }
        series.push({year:i, value});
    }
    return series;
}

// ==== Budget ====

function categoryTotal(items, catId){
    return (items[catId] || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
}

// ==== Formue: placering i forhold til andre danskere ====

// Uddrag af CEPOS' formueopgørelse (Danmarks Statistik, 2022-tal opregnet til
// 2025-niveau) - 16 alderstrin i stedet for alle 73, vi regner lineært imellem.
const CEPOS_WEALTH_TABLE = [
    {age:18, p10:3000, p25:10000, p50:38000, p75:88000, p90:175000, p95:282000, p99:926000},
    {age:20, p10:1000, p25:16000, p50:57000, p75:136000, p90:269000, p95:433000, p99:1320000},
    {age:25, p10:-96000, p25:9000, p50:82000, p75:240000, p90:591000, p95:938000, p99:2330000},
    {age:30, p10:-196000, p25:21000, p50:221000, p75:598000, p90:1113000, p95:1584000, p99:3956000},
    {age:35, p10:-153000, p25:99000, p50:475000, p75:1041000, p90:1792000, p95:2515000, p99:6636000},
    {age:40, p10:-43000, p25:233000, p50:790000, p75:1551000, p90:2619000, p95:3718000, p99:10912000},
    {age:45, p10:34000, p25:464000, p50:1180000, p75:2165000, p90:3629000, p95:5340000, p99:17385000},
    {age:50, p10:115000, p25:695000, p50:1549000, p75:2763000, p90:4753000, p95:7199000, p99:24047000},
    {age:55, p10:173000, p25:842000, p50:1815000, p75:3245000, p90:5613000, p95:8607000, p99:28417000},
    {age:60, p10:262000, p25:1028000, p50:2147000, p75:3804000, p90:6391000, p95:9414000, p99:26968000},
    {age:65, p10:366000, p25:1207000, p50:2415000, p75:4182000, p90:6768000, p95:9571000, p99:24358000},
    {age:70, p10:309000, p25:1019000, p50:2214000, p75:4002000, p90:6597000, p95:9446000, p99:23098000},
    {age:75, p10:257000, p25:828000, p50:1919000, p75:3584000, p90:6122000, p95:8991000, p99:22813000},
    {age:80, p10:167000, p25:574000, p50:1515000, p75:3013000, p90:5380000, p95:8038000, p99:20629000},
    {age:85, p10:117000, p25:380000, p50:1159000, p75:2446000, p90:4463000, p95:6554000, p99:17001000},
    {age:90, p10:85000, p25:265000, p50:925000, p75:2164000, p90:4046000, p95:5999000, p99:14732000}
];

function findNearestWealthRow(age){
    const clampedAge = Math.max(18, Math.min(90, age));
    return CEPOS_WEALTH_TABLE.reduce((closest, row) =>
        Math.abs(row.age - clampedAge) < Math.abs(closest.age - clampedAge) ? row : closest
    );
}

// Regner en cirka-percentil ud fra formuen, ved at interpolere lineært
// imellem de kendte procentgrænser (10/25/50/75/90/95/99) for aldersgruppen.
function estimatePercentile(netWorth, row){
    const points = [
        {p:0, v: row.p10 - (row.p25 - row.p10)},
        {p:10, v: row.p10},
        {p:25, v: row.p25},
        {p:50, v: row.p50},
        {p:75, v: row.p75},
        {p:90, v: row.p90},
        {p:95, v: row.p95},
        {p:99, v: row.p99},
        {p:100, v: row.p99 + (row.p99 - row.p95)}
    ];
    for(let i=1; i<points.length; i++){
        if(netWorth <= points[i].v){
            const a = points[i-1], b = points[i];
            const frac = (netWorth - a.v) / ((b.v - a.v) || 1);
            return Math.max(0, Math.min(100, Math.round(a.p + frac*(b.p-a.p))));
        }
    }
    return 100;
}

// ==== Parsing af danske tal og CSV ====

// Fortolker danske talformater korrekt: punktum som tusindtalsseparator,
// komma som decimaltegn (fx "10.099,00 kr." eller vores eget "10.099 kr.").
function parseDanishAmount(str){
    if(!str) return 0;
    let cleaned = str.toString().trim();
    cleaned = cleaned.replace(/[^\d,.-]/g, '');   // fjern "kr.", mellemrum osv.
    cleaned = cleaned.replace(/\./g, '');          // fjern tusindtalspunktummer
    cleaned = cleaned.replace(',', '.');           // komma -> decimalpunktum
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num);
}

// Finder overskriftsrækken ved at lede efter "Dato" i de første par linjer,
// i stedet for blindt at antage den står på linje 1 - Numbers/Excel indsætter
// sommetider en ekstra "tabelnavn"-linje øverst, som ellers ville forvirre os.
function findHeaderRowIndex(rows){
    for(let i=0; i<Math.min(rows.length, 5); i++){
        if(rows[i].includes('Dato')) return i;
    }
    return -1;
}

// CSV-parser der selv opdager, om filen bruger semikolon (vores eget format)
// eller komma (fx hvis filen er genexporteret fra Numbers/Excel med andre
// regionsindstillinger). Forstår desuden anførselstegn omkring felter.
function parseCSV(text){
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if(lines.length === 0) return [];
    const semicolons = (lines[0].match(/;/g) || []).length;
    const commas = (lines[0].match(/,/g) || []).length;
    const delimiter = semicolons >= commas ? ';' : ',';

    return lines.map(line => {
        const cells = [];
        let cur = '', inQuotes = false;
        for(let i=0;i<line.length;i++){
            const c = line[i];
            if(inQuotes){
                if(c === '"'){
                    if(line[i+1] === '"'){ cur += '"'; i++; }
                    else { inQuotes = false; }
                } else { cur += c; }
            } else {
                if(c === '"'){ inQuotes = true; }
                else if(c === delimiter){ cells.push(cur); cur=''; }
                else { cur += c; }
            }
        }
        cells.push(cur.trim());
        return cells;
    });
}

// Node-eksport, så tests kan importere funktionerne. Ignoreres i browseren.
if(typeof module !== 'undefined' && module.exports){
    module.exports = {
        TAX_LIMIT_27, ASK_TAX, AKT_TAX_LOW, AKT_TAX_HIGH,
        setDoubleDeduction, effectiveTaxLimit,
        monthlyReturnFactor, toRealValue,
        computeAskSeries, computeAktFinalValueForStartYear, findBestHarvestStartYear, computeAktSeries,
        computeMonthlyFinalValueForStartYear, findBestMonthlyHarvestStartYear, computeMonthlySeries,
        computeFireSeries,
        categoryTotal,
        CEPOS_WEALTH_TABLE, findNearestWealthRow, estimatePercentile,
        parseDanishAmount, findHeaderRowIndex, parseCSV
    };
}
