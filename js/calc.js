// Ren beregningslogik uden nogen afhængighed af DOM'et. Filen indlæses som et
// almindeligt script i browseren (og definerer derfor sine funktioner globalt),
// og kan samtidig require()'es fra Node, så tests/ kan afprøve tallene direkte.

// ==== Satser og grænser – opdateres hvert år ====
// Alle årlige tal samlet ét sted. Teksterne på siden (fx "ASK-grænsen er
// 174.200 kr.") hentes også herfra via data-rule, så en ny opdatering kun
// kræver ændringer i denne blok.

const TAX_YEAR = 2026;

// Aktiesparekonto og aktiedepot.
const ASK_DEPOSIT_LIMIT = 174200;
const TAX_LIMIT_27 = 79400;
const ASK_TAX = 0.17;
const AKT_TAX_LOW = 0.27;
const AKT_TAX_HIGH = 0.42;

// Bolig. Tinglysningsafgift pr. 1. januar 2026 (skat.dk): skøde 1.850 kr. + 0,6 % af
// prisen, pant 1.825 kr. + 1,25 % af lånets hovedstol.
const TINGLYSNING = { skoedeFast: 1850, skoedePct: 0.006, pantFast: 1825, pantPct: 0.0125 };
// Mindst 5 % udbetaling ved køb af ejerbolig; realkredit op til 80 % af prisen.
const MIN_UDBETALING = 0.05;
const MAX_REALKREDIT = 0.80;
// Finanstilsynet: gældsfaktor over 4 kombineret med belåningsgrad over 60 %
// betyder begrænsninger på lånetyper (fast rente eller mindst 5 års rentebinding, afdrag).
const HIGH_DEBT_FACTOR = 4;
const HIGH_LTV = 0.60;
// Rentefradrag: ca. 33 % af renteudgifter op til 50.000 kr. pr. voksen, ca. 25 % derover.
const RENTEFRADRAG = { lowRate: 0.33, highRate: 0.25, thresholdPerAdult: 50000 };

// Pensionsafkastskat (PAL) af afkast på pensionsordninger.
const PAL_SKAT = 0.153;
// Beløbsgrænser for pensionsindbetalinger (skat.dk).
const PENSION_LIMITS = { aldersopsparing: 9900, aldersopsparingNearPension: 64200, ratepension: 68700 };

// ==== Dobbelt fradrag (ægtefælle) og den effektive 27%-grænse ====

let doubleDeductionEnabled = false;

/**
 * Slår "dobbelt fradrag" til eller fra: er man gift med en, der ikke selv
 * investerer, kan man udnytte begges 27%-grænse og dermed realisere dobbelt
 * så meget gevinst om året til den lave sats.
 * @param {boolean} enabled
 */
function setDoubleDeduction(enabled){
    doubleDeductionEnabled = !!enabled;
}

/**
 * Den 27%-grænse, beregningerne aktuelt regner med.
 * @returns {number} 79.400 kr., eller det dobbelte med dobbelt fradrag
 */
function effectiveTaxLimit(){
    return doubleDeductionEnabled ? TAX_LIMIT_27 * 2 : TAX_LIMIT_27;
}

// ==== Afkast og inflation ====

/**
 * Omregner en årlig afkastfaktor til den tilsvarende månedlige, så tolv
 * måneders vækst i træk giver præcis ét års afkast.
 * @param {number} yearlyReturn årlig afkastfaktor, fx 1.08 for 8 %
 * @returns {number} månedlig faktor, fx 1.00643 for 8 % p.a.
 */
function monthlyReturnFactor(yearlyReturn){
    return Math.pow(yearlyReturn, 1/12);
}

/**
 * Regner et fremtidigt (nominelt) beløb om til nutidens købekraft.
 * @param {number} nominalValue beløbet i fremtidige kroner
 * @param {number} year hvor mange år ude i fremtiden
 * @param {number} inflationFactor årlig inflationsfaktor, fx 1.02 for 2 %
 * @returns {number} beløbet udtrykt i dagens kroner
 */
function toRealValue(nominalValue, year, inflationFactor){
    return nominalValue / Math.pow(inflationFactor, year);
}

// ==== Aktiesparekonto vs. aktiedepot (engangsindskud) ====

/**
 * Simulerer en aktiesparekonto år for år. ASK lagerbeskattes: hvert års gevinst
 * beskattes med 17 %, uanset om der sælges.
 * @param {number} years antal år
 * @param {number} yearlyReturn årlig afkastfaktor, fx 1.08
 * @param {number} startCash startbeløb i kr.
 * @param {boolean} payTaxExternally true hvis skatten betales udefra, så kontoen
 *   selv vokser ubeskattet (skatten opgøres stadig i taxPaid)
 * @returns {{year:number, value:number, taxPaid:number}[]} ét punkt pr. år inkl. år 0
 */
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

/**
 * Slutværdien af et aktiedepot med engangsindskud, hvor gevinster "høstes"
 * (sælges og genkøbes op til 27%-grænsen) hvert år fra og med harvestStartYear.
 * Sidste år realiseres resten og beskattes progressivt (27 % / 42 %).
 * @param {number} years antal år
 * @param {number} yearlyReturn årlig afkastfaktor, fx 1.08
 * @param {number} startCash startbeløb i kr.
 * @param {boolean} investSavedAskTax true hvis den ASK-skat, man sparer, i stedet
 *   indskydes på depotet år for år (sammenligningsgrundlag for "betal skat udefra")
 * @param {number} harvestStartYear første år, der høstes i (years = høst aldrig)
 * @returns {number} depotets værdi efter skat i sidste år
 */
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

/**
 * Finder det høst-startår, der giver den højeste slutværdi, ved at prøve dem alle.
 * Tidlig høst sparer 42%-skat senere, men koster tabt rentes rente på den skat,
 * der betales tidligt - så det bedste år er ikke oplagt.
 * @param {number} years antal år
 * @param {number} yearlyReturn årlig afkastfaktor
 * @param {number} startCash startbeløb i kr.
 * @param {boolean} investSavedAskTax se computeAktFinalValueForStartYear
 * @returns {number} det bedste startår, 1..years
 */
function findBestHarvestStartYear(years, yearlyReturn, startCash, investSavedAskTax){
    let bestStart = years;
    let bestValue = computeAktFinalValueForStartYear(years, yearlyReturn, startCash, investSavedAskTax, bestStart);
    for(let c=years-1;c>=1;c--){
        const v = computeAktFinalValueForStartYear(years, yearlyReturn, startCash, investSavedAskTax, c);
        if(v>bestValue){ bestValue=v; bestStart=c; }
    }
    return bestStart;
}

/**
 * Simulerer et aktiedepot med engangsindskud år for år med den optimale
 * realiseringsstrategi. Skatten opdeles i 27%- og 42%-delen pr. år.
 * @param {number} years antal år
 * @param {number} yearlyReturn årlig afkastfaktor
 * @param {number} startCash startbeløb i kr.
 * @param {boolean} investSavedAskTax se computeAktFinalValueForStartYear
 * @returns {{series:{year:number, value:number, taxAt27:number, taxAt42:number}[], harvestStartYear:number}}
 */
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

/**
 * Slutværdien af et aktiedepot med startbeløb og fast månedlig indbetaling,
 * med høst fra harvestStartYear (se computeAktFinalValueForStartYear).
 * Indbetalingerne lægges til før månedens afkast tilskrives.
 * @param {number} years antal år
 * @param {number} yearlyReturn årlig afkastfaktor
 * @param {number} startCash startbeløb i kr.
 * @param {number} monthlyAmount månedlig indbetaling i kr.
 * @param {number} harvestStartYear første år, der høstes i
 * @returns {number} depotets værdi efter skat i sidste år
 */
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

/**
 * Som findBestHarvestStartYear, men for depotet med månedlig indbetaling.
 * @param {number} years
 * @param {number} yearlyReturn
 * @param {number} startCash
 * @param {number} monthlyAmount
 * @returns {number} det bedste startår, 1..years
 */
function findBestMonthlyHarvestStartYear(years, yearlyReturn, startCash, monthlyAmount){
    let bestStart = years;
    let bestValue = computeMonthlyFinalValueForStartYear(years, yearlyReturn, startCash, monthlyAmount, bestStart);
    for(let c=years-1;c>=1;c--){
        const v = computeMonthlyFinalValueForStartYear(years, yearlyReturn, startCash, monthlyAmount, c);
        if(v>bestValue){ bestValue=v; bestStart=c; }
    }
    return bestStart;
}

/**
 * Simulerer depotet med månedlig indbetaling år for år med den optimale
 * strategi, og holder styr på hvor meget der i alt er indbetalt.
 * @param {number} years
 * @param {number} yearlyReturn
 * @param {number} startCash
 * @param {number} monthlyAmount
 * @returns {{series:{year:number, value:number, invested:number, taxAt27:number, taxAt42:number}[], harvestStartYear:number}}
 */
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

/**
 * Formueopbygning frem mod FIRE: et rent vækst-loop uden skatteoptimering
 * (der er intet at "høste" på en opsparing, man endnu ikke har rørt).
 * @param {number} startCash startbeløb i kr.
 * @param {number} monthlyAmount månedlig opsparing i kr.
 * @param {number} yearlyReturn årlig afkastfaktor
 * @param {number} maxYears hvor mange år frem der simuleres
 * @returns {{year:number, value:number}[]} ét punkt pr. år inkl. år 0
 */
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

/**
 * En budgetposts beløb omregnet til pr. måned. `freq` er antal måneder mellem
 * betalingerne (1 = månedlig, 3 = kvartalsvis, 12 = årlig); mangler den, er
 * posten månedlig. Ugyldige beløb tæller som 0.
 * @param {{amount:number|string, freq?:number}} item
 * @returns {number}
 */
function monthlyAmount(item){
    const amount = parseFloat(item.amount) || 0;
    const freq = parseFloat(item.freq) || 1;
    return amount / freq;
}

/**
 * Summen af posterne i én budgetkategori, pr. måned.
 * @param {Object<string, {label:string, amount:number|string, freq?:number}[]>} items alle poster, nøglet på kategori-id
 * @param {string} catId
 * @returns {number}
 */
function categoryTotal(items, catId){
    return (items[catId] || []).reduce((sum, item) => sum + monthlyAmount(item), 0);
}

/**
 * Hele budgettet opsummeret: månedlig total pr. kategori, samlet sum, og summen
 * pr. 50/30/20-gruppe.
 * @param {{id:string, group:'behov'|'onsker'|'opsparing'}[]} categories
 * @param {Object<string, {amount:number|string, freq?:number}[]>} items
 * @returns {{values:number[], sum:number, groupSums:{behov:number, onsker:number, opsparing:number}}}
 */
function budgetSummary(categories, items){
    const values = categories.map(cat => categoryTotal(items, cat.id));
    const groupSums = {behov:0, onsker:0, opsparing:0};
    categories.forEach((cat, i) => { groupSums[cat.group] += values[i]; });
    return { values, sum: values.reduce((a, b) => a + b, 0), groupSums };
}

// ==== Historik (datapunkter pr. dato) ====

/**
 * Indsætter et datapunkt i en historik, eller erstatter det, der allerede
 * findes på samme dato. Rører ikke den oprindelige liste.
 * @template {{date:string}} T
 * @param {T[]} history
 * @param {T} entry
 * @returns {{history:T[], replaced:T|null}} den nye liste sorteret efter dato, og det erstattede punkt (hvis nogen)
 */
function upsertByDate(history, entry){
    const replaced = history.find(h => h.date === entry.date) || null;
    const next = history.filter(h => h.date !== entry.date).concat([entry]);
    next.sort((a, b) => a.date.localeCompare(b.date));
    return { history: next, replaced };
}

/**
 * Fletter flere datapunkter ind i en historik (fx fra en CSV-import). Punkter
 * med en dato, der allerede findes, erstatter det gamle.
 * @template {{date:string}} T
 * @param {T[]} history
 * @param {T[]} entries
 * @returns {{history:T[], replacedDates:string[], addedCount:number}}
 */
function mergeByDate(history, entries){
    const existing = new Set(history.map(h => h.date));
    const byDate = new Map(history.map(h => [h.date, h]));
    entries.forEach(e => byDate.set(e.date, e));
    const incomingDates = [...new Set(entries.map(e => e.date))];
    const replacedDates = incomingDates.filter(d => existing.has(d)).sort();
    const next = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    return { history: next, replacedDates, addedCount: incomingDates.length - replacedDates.length };
}

/**
 * De felter, der er forskellige mellem to datapunkter - bruges til at vise
 * præcis hvad en overskrivning ændrer. Manglende felter tæller som 0.
 * @param {Object} oldEntry
 * @param {Object} newEntry
 * @param {[string, string][]} fields par af [nøgle, visningsnavn]
 * @returns {{key:string, label:string, from:number, to:number}[]}
 */
function changedFields(oldEntry, newEntry, fields){
    return fields
        .map(([key, label]) => ({key, label, from: oldEntry[key] || 0, to: newEntry[key] || 0}))
        .filter(c => c.from !== c.to);
}

/**
 * Omsætter en dato fra en CSV-fil til 'YYYY-MM-DD'. Forstår vores eget format
 * og de danske formater, Excel og Numbers ofte gemmer i (31-08-2026,
 * 31.08.2026, 31/08/2026, også med 1-cifret dag/måned).
 * @param {string} str
 * @returns {string|null} ISO-datoen, eller null hvis den ikke er en gyldig dato
 */
function normalizeDate(str){
    if(!str) return null;
    const s = String(str).trim();
    let y, m, d, match;
    if((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))){ [, y, m, d] = match; }
    else if((match = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/))){ [, d, m, y] = match; }
    else return null;
    const iso = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const date = new Date(iso + 'T00:00:00Z');
    return !isNaN(date) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

// ==== Formue: placering i forhold til andre danskere ====

/**
 * CEPOS: nettoformue efter alder, én række pr. alder fra 18 til 90 år, med
 * gennemsnit og percentilgrænser (p10 = bund 10 %, p90 = top 10 % osv.).
 * Beregnet ud fra 2024-data opregnet til 2026-niveau med lønudviklingen;
 * pensionsformuen er opgjort efter en beregnet skat på 40 %. Afrundet til
 * nærmeste 1.000 kr. Kilde: CEPOS-beregninger på Danmarks Statistiks
 * personregistre (cepos.dk, 26. februar 2026).
 * @type {{age:number, avg:number, p10:number, p25:number, p50:number, p75:number, p90:number, p95:number, p99:number}[]}
 */
const CEPOS_WEALTH_TABLE = [
    {age:18, avg:209000, p10:3000, p25:10000, p50:37000, p75:90000, p90:181000, p95:300000, p99:1052000},
    {age:19, avg:182000, p10:3000, p25:12000, p50:43000, p75:106000, p90:221000, p95:362000, p99:1200000},
    {age:20, avg:200000, p10:3000, p25:17000, p50:58000, p75:139000, p90:277000, p95:450000, p99:1478000},
    {age:21, avg:280000, p10:3000, p25:22000, p50:78000, p75:183000, p90:372000, p95:617000, p99:1841000},
    {age:22, avg:288000, p10:0, p25:20000, p50:73000, p75:190000, p90:437000, p95:749000, p99:2191000},
    {age:23, avg:381000, p10:-12000, p25:18000, p50:72000, p75:196000, p90:482000, p95:825000, p99:2298000},
    {age:24, avg:320000, p10:-36000, p25:17000, p50:76000, p75:215000, p90:552000, p95:927000, p99:2645000},
    {age:25, avg:358000, p10:-62000, p25:15000, p50:82000, p75:238000, p90:615000, p95:1009000, p99:2984000},
    {age:26, avg:390000, p10:-90000, p25:13000, p50:96000, p75:279000, p90:693000, p95:1106000, p99:3177000},
    {age:27, avg:480000, p10:-121000, p25:13000, p50:115000, p75:341000, p90:801000, p95:1256000, p99:3544000},
    {age:28, avg:463000, p10:-143000, p25:13000, p50:145000, p75:423000, p90:931000, p95:1409000, p99:3918000},
    {age:29, avg:548000, p10:-162000, p25:16000, p50:178000, p75:508000, p90:1059000, p95:1564000, p99:4097000},
    {age:30, avg:561000, p10:-178000, p25:21000, p50:212000, p75:594000, p90:1199000, p95:1778000, p99:4507000},
    {age:31, avg:676000, p10:-187000, p25:27000, p50:255000, p75:696000, p90:1349000, p95:1955000, p99:4856000},
    {age:32, avg:711000, p10:-186000, p25:37000, p50:296000, p75:786000, p90:1494000, p95:2151000, p99:5208000},
    {age:33, avg:787000, p10:-187000, p25:46000, p50:343000, p75:877000, p90:1636000, p95:2353000, p99:5638000},
    {age:34, avg:815000, p10:-178000, p25:57000, p50:390000, p75:976000, p90:1791000, p95:2546000, p99:6137000},
    {age:35, avg:991000, p10:-171000, p25:70000, p50:442000, p75:1089000, p90:1960000, p95:2768000, p99:6541000},
    {age:36, avg:1063000, p10:-151000, p25:88000, p50:502000, p75:1187000, p90:2124000, p95:2993000, p99:6893000},
    {age:37, avg:1197000, p10:-133000, p25:108000, p50:561000, p75:1286000, p90:2306000, p95:3282000, p99:8159000},
    {age:38, avg:1295000, p10:-110000, p25:131000, p50:629000, p75:1425000, p90:2534000, p95:3585000, p99:8603000},
    {age:39, avg:1356000, p10:-88000, p25:154000, p50:689000, p75:1534000, p90:2700000, p95:3854000, p99:8948000},
    {age:40, avg:1547000, p10:-55000, p25:178000, p50:750000, p75:1627000, p90:2899000, p95:4124000, p99:10096000},
    {age:41, avg:1728000, p10:-35000, p25:202000, p50:821000, p75:1766000, p90:3130000, p95:4508000, p99:11523000},
    {age:42, avg:1803000, p10:-16000, p25:234000, p50:895000, p75:1863000, p90:3296000, p95:4721000, p99:11556000},
    {age:43, avg:1881000, p10:-9000, p25:269000, p50:967000, p75:1978000, p90:3547000, p95:5041000, p99:13206000},
    {age:44, avg:2022000, p10:0, p25:305000, p50:1040000, p75:2118000, p90:3780000, p95:5461000, p99:14794000},
    {age:45, avg:2169000, p10:6000, p25:359000, p50:1130000, p75:2264000, p90:4032000, p95:5841000, p99:16171000},
    {age:46, avg:2335000, p10:17000, p25:415000, p50:1227000, p75:2401000, p90:4276000, p95:6237000, p99:17793000},
    {age:47, avg:2541000, p10:26000, p25:457000, p50:1300000, p75:2532000, p90:4466000, p95:6531000, p99:19003000},
    {age:48, avg:2654000, p10:44000, p25:518000, p50:1387000, p75:2681000, p90:4712000, p95:6873000, p99:19927000},
    {age:49, avg:2981000, p10:61000, p25:564000, p50:1460000, p75:2796000, p90:4938000, p95:7260000, p99:23123000},
    {age:50, avg:3073000, p10:72000, p25:602000, p50:1559000, p75:2936000, p90:5234000, p95:7739000, p99:24444000},
    {age:51, avg:3154000, p10:88000, p25:645000, p50:1608000, p75:3050000, p90:5416000, p95:8099000, p99:25652000},
    {age:52, avg:3349000, p10:105000, p25:693000, p50:1683000, p75:3164000, p90:5621000, p95:8392000, p99:28110000},
    {age:53, avg:3433000, p10:122000, p25:724000, p50:1733000, p75:3272000, p90:5876000, p95:8859000, p99:28510000},
    {age:54, avg:3515000, p10:117000, p25:730000, p50:1755000, p75:3312000, p90:5927000, p95:8950000, p99:27685000},
    {age:55, avg:3630000, p10:140000, p25:770000, p50:1808000, p75:3420000, p90:6156000, p95:9285000, p99:29180000},
    {age:56, avg:3689000, p10:139000, p25:798000, p50:1869000, p75:3527000, p90:6321000, p95:9452000, p99:31693000},
    {age:57, avg:3834000, p10:167000, p25:844000, p50:1943000, p75:3643000, p90:6499000, p95:9865000, p99:32804000},
    {age:58, avg:3761000, p10:196000, p25:904000, p50:2005000, p75:3752000, p90:6602000, p95:9871000, p99:30746000},
    {age:59, avg:3795000, p10:206000, p25:931000, p50:2074000, p75:3880000, p90:6884000, p95:10203000, p99:31304000},
    {age:60, avg:3924000, p10:211000, p25:927000, p50:2085000, p75:3909000, p90:6891000, p95:10409000, p99:31045000},
    {age:61, avg:4074000, p10:231000, p25:992000, p50:2185000, p75:4076000, p90:7149000, p95:10632000, p99:33052000},
    {age:62, avg:4054000, p10:242000, p25:1021000, p50:2248000, p75:4157000, p90:7253000, p95:10630000, p99:32270000},
    {age:63, avg:4118000, p10:268000, p25:1083000, p50:2332000, p75:4305000, p90:7365000, p95:10884000, p99:30486000},
    {age:64, avg:4130000, p10:262000, p25:1096000, p50:2396000, p75:4410000, p90:7535000, p95:11009000, p99:30214000},
    {age:65, avg:4238000, p10:299000, p25:1144000, p50:2436000, p75:4499000, p90:7623000, p95:10898000, p99:30245000},
    {age:66, avg:4213000, p10:315000, p25:1122000, p50:2414000, p75:4479000, p90:7573000, p95:10908000, p99:29313000},
    {age:67, avg:4126000, p10:301000, p25:1094000, p50:2419000, p75:4437000, p90:7563000, p95:10824000, p99:28348000},
    {age:68, avg:4125000, p10:295000, p25:1042000, p50:2375000, p75:4409000, p90:7473000, p95:10788000, p99:28531000},
    {age:69, avg:3885000, p10:272000, p25:978000, p50:2292000, p75:4327000, p90:7413000, p95:10807000, p99:28046000},
    {age:70, avg:3855000, p10:239000, p25:882000, p50:2167000, p75:4170000, p90:7237000, p95:10353000, p99:25262000},
    {age:71, avg:3608000, p10:226000, p25:798000, p50:2051000, p75:4068000, p90:6993000, p95:10112000, p99:25168000},
    {age:72, avg:3647000, p10:216000, p25:766000, p50:2009000, p75:4035000, p90:7004000, p95:10309000, p99:26839000},
    {age:73, avg:3647000, p10:203000, p25:708000, p50:1944000, p75:4002000, p90:7083000, p95:10323000, p99:26023000},
    {age:74, avg:3609000, p10:192000, p25:647000, p50:1825000, p75:3833000, p90:6787000, p95:9949000, p99:26888000},
    {age:75, avg:3401000, p10:186000, p25:626000, p50:1805000, p75:3769000, p90:6753000, p95:9896000, p99:24987000},
    {age:76, avg:3544000, p10:179000, p25:599000, p50:1768000, p75:3735000, p90:6788000, p95:10094000, p99:27814000},
    {age:77, avg:3395000, p10:176000, p25:568000, p50:1701000, p75:3657000, p90:6651000, p95:9944000, p99:26016000},
    {age:78, avg:3480000, p10:160000, p25:533000, p50:1652000, p75:3586000, p90:6732000, p95:10046000, p99:27963000},
    {age:79, avg:3454000, p10:143000, p25:475000, p50:1541000, p75:3462000, p90:6533000, p95:9832000, p99:26813000},
    {age:80, avg:3470000, p10:136000, p25:440000, p50:1484000, p75:3328000, p90:6293000, p95:9408000, p99:27360000},
    {age:81, avg:3264000, p10:125000, p25:408000, p50:1412000, p75:3258000, p90:6266000, p95:9445000, p99:25793000},
    {age:82, avg:3056000, p10:116000, p25:370000, p50:1312000, p75:3095000, p90:6021000, p95:9032000, p99:23585000},
    {age:83, avg:3084000, p10:106000, p25:327000, p50:1237000, p75:2897000, p90:5597000, p95:8554000, p99:25328000},
    {age:84, avg:2867000, p10:97000, p25:298000, p50:1154000, p75:2745000, p90:5353000, p95:8070000, p99:21852000},
    {age:85, avg:2506000, p10:97000, p25:287000, p50:1108000, p75:2708000, p90:5392000, p95:8058000, p99:18545000},
    {age:86, avg:2565000, p10:102000, p25:285000, p50:1076000, p75:2644000, p90:5190000, p95:7882000, p99:20458000},
    {age:87, avg:2413000, p10:94000, p25:260000, p50:1024000, p75:2558000, p90:4905000, p95:7244000, p99:19130000},
    {age:88, avg:2370000, p10:90000, p25:250000, p50:970000, p75:2461000, p90:4878000, p95:7422000, p99:19636000},
    {age:89, avg:2159000, p10:86000, p25:243000, p50:934000, p75:2316000, p90:4756000, p95:7003000, p99:17386000},
    {age:90, avg:2331000, p10:81000, p25:224000, p50:883000, p75:2310000, p90:4695000, p95:7073000, p99:16473000}
];

// CEPOS tæller pensionen efter en beregnet skat på 40 %, så brugerens pension
// skal regnes om på samme måde, før formuerne kan sammenlignes.
const CEPOS_PENSION_TAX = 0.40;
const CEPOS_SOURCE = { dataYear: 2024, level: 2026, published: '2026-02-26',
    url: 'https://cepos.dk/artikler/0130-hvor-stor-formue-har-du-sammenlignet-med-andre-pa-din-alder/' };

/**
 * Rækken for en alder (klemt til 18-90, da tabellen har én række pr. alder).
 * @param {number} age
 * @returns {{age:number, avg:number, p10:number, p25:number, p50:number, p75:number, p90:number, p95:number, p99:number}}
 */
function findWealthRow(age){
    const clamped = Math.max(18, Math.min(90, Math.round(age)));
    return CEPOS_WEALTH_TABLE[clamped - 18];
}

/**
 * Nettoformuen opgjort som i CEPOS' tal: pensionen tæller med efter en
 * beregnet skat på 40 %.
 * @param {number} netWorth nettoformue med pensionen før skat
 * @param {number} pension pensionsformuen før skat
 * @returns {number}
 */
function comparableNetWorth(netWorth, pension){
    return netWorth - Math.max(0, pension) * CEPOS_PENSION_TAX;
}

/**
 * Cirka-percentil for en nettoformue i sin aldersgruppe: interpolerer lineært
 * imellem de kendte procentgrænser (10/25/50/75/90/95/99).
 * @param {number} netWorth nettoformue i kr.
 * @param {{p10:number, p25:number, p50:number, p75:number, p90:number, p95:number, p99:number}} row aldersrækken fra findWealthRow
 * @returns {number} 0-100, hvor 50 betyder "mere end halvdelen af aldersgruppen"
 */
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

/**
 * Fortolker et dansk formateret beløb: punktum som tusindtalsseparator, komma
 * som decimaltegn (fx "10.099,00 kr." eller vores eget "10.099 kr.").
 * @param {string|null|undefined} str
 * @returns {number} afrundet til hele kroner; 0 hvis tomt eller ugyldigt
 */
function parseDanishAmount(str){
    if(!str) return 0;
    let cleaned = str.toString().trim();
    cleaned = cleaned.replace(/[^\d,.-]/g, '');   // fjern "kr.", mellemrum osv.
    cleaned = cleaned.replace(/\./g, '');          // fjern tusindtalspunktummer
    cleaned = cleaned.replace(',', '.');           // komma -> decimalpunktum
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Læser ét tal skrevet på dansk eller med punktum som decimaltegn.
 * "1.000" og "1.000.000" er tusinder, "2,5" og "2.5" er to en halv, "1.000,50"
 * er tusind og en halv. Et punktum efterfulgt af præcis tre cifre er tusinder
 * (som i dansk), undtagen efter "0" - "0.125" er et decimaltal.
 * @param {string} token kun cifre, punktum og komma
 * @returns {number|null} null hvis det ikke er et gyldigt tal
 */
function parseNumberToken(token){
    if(!/^[\d.,]+$/.test(token) || !/\d/.test(token)) return null;
    const dots = (token.match(/\./g) || []).length;
    const commas = (token.match(/,/g) || []).length;
    let plain;
    if(dots && commas){
        // "1.000,50": punktum er tusinder, komma er decimaltegn
        if(commas > 1 || !/^\d{1,3}(\.\d{3})+,\d*$/.test(token)) return null;
        plain = token.replace(/\./g, '').replace(',', '.');
    } else if(commas){
        if(commas > 1) return null;
        plain = token.replace(',', '.');
    } else if(dots > 1 || /^[1-9]\d{0,2}\.\d{3}$/.test(token)){
        if(!/^\d{1,3}(\.\d{3})+$/.test(token)) return null;
        plain = token.replace(/\./g, '');
    } else {
        plain = token;
    }
    if(plain === '.' ) return null;
    const n = Number(plain);
    return isFinite(n) ? n : null;
}

/**
 * Regner et lille regnestykke ud, så man kan skrive fx "12.500 + 3.200" eller
 * "450 * 12" i et talfelt. Forstår + − * / (også × og ÷), parenteser, fortegn
 * og danske tal (se parseNumberToken). "kr." og mellemrum ignoreres.
 * Evaluerer uden eval() - kun tal og de fire regnearter.
 * @param {string} text
 * @returns {number|null} resultatet, eller null hvis det ikke kan regnes ud
 *   (ufuldstændigt, ugyldigt eller division med 0)
 */
function parseAmount(text){
    if(text === null || text === undefined) return null;
    const src = String(text).replace(/kr\.?/gi, '').replace(/[\s ]/g, '')
        .replace(/[×xX]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-');
    if(!src) return null;
    const tokens = src.match(/[\d.,]+|[-+*/()]|./g);
    let i = 0;
    const peek = () => tokens[i];

    function number(){
        const t = tokens[i];
        if(t === '('){
            i++;
            const v = sum();
            if(tokens[i] !== ')') throw 0;
            i++;
            return v;
        }
        if(t === '-' || t === '+'){ i++; const v = number(); return t === '-' ? -v : v; }
        const n = t === undefined ? null : parseNumberToken(t);
        if(n === null) throw 0;
        i++;
        return n;
    }
    function product(){
        let v = number();
        while(peek() === '*' || peek() === '/'){
            const op = tokens[i++];
            const r = number();
            if(op === '/' && r === 0) throw 0;
            v = op === '*' ? v * r : v / r;
        }
        return v;
    }
    function sum(){
        let v = product();
        while(peek() === '+' || peek() === '-'){
            const op = tokens[i++];
            const r = product();
            v = op === '+' ? v + r : v - r;
        }
        return v;
    }

    try{
        const v = sum();
        if(i !== tokens.length || !isFinite(v)) return null;
        return Math.round(v * 1e10) / 1e10;   // 0,1 + 0,2 = 0,3 - ikke 0,30000000000000004
    } catch(e){
        return null;
    }
}

/**
 * Er teksten et regnestykke (og ikke bare ét tal, evt. med fortegn)?
 * @param {string} text
 * @returns {boolean}
 */
function isExpression(text){
    return /\d\s*[-+*/×xX÷−–]|[()]/.test(String(text).trim().replace(/^[-+−–]/, ''));
}

/**
 * Finder overskriftsrækken ved at lede efter "Dato" i de første fem linjer -
 * Numbers/Excel indsætter sommetider en ekstra "tabelnavn"-linje øverst.
 * @param {string[][]} rows rækker fra parseCSV
 * @returns {number} indeks for overskriftsrækken, eller -1
 */
function findHeaderRowIndex(rows){
    for(let i=0; i<Math.min(rows.length, 5); i++){
        if(rows[i].includes('Dato')) return i;
    }
    return -1;
}

/**
 * CSV-parser, der selv opdager om filen bruger semikolon (vores eget format)
 * eller komma (fx genexporteret fra Numbers/Excel). Forstår anførselstegn
 * omkring felter og "" som escaped anførselstegn. Tomme linjer springes over.
 * @param {string} text hele filens indhold
 * @returns {string[][]} én række pr. linje, én streng pr. celle
 */
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

// ==== Bolig og lån ====

/**
 * Den faste månedlige ydelse på et annuitetslån.
 * @param {number} principal lånets hovedstol i kr.
 * @param {number} annualRate årlig rente som decimaltal, fx 0.04
 * @param {number} years løbetid i år
 * @returns {number} ydelse pr. måned (rente + afdrag), 0 hvis intet lån
 */
function annuityPayment(principal, annualRate, years){
    if(principal <= 0 || years <= 0) return 0;
    const n = Math.round(years * 12);
    const r = annualRate / 12;
    if(r === 0) return principal / n;
    return principal * r / (1 - Math.pow(1 + r, -n));
}

/**
 * Engangsomkostninger ved køb: tinglysning af skøde og pantebreve plus andre
 * omkostninger (advokat/køberrådgiver, tilstandsrapport, lånesagsgebyrer ...).
 * @param {number} price
 * @param {number} realkreditLoan
 * @param {number} bankLoan
 * @param {number} otherCosts
 * @returns {{skoede:number, pant:number, other:number, total:number}}
 */
function purchaseCosts(price, realkreditLoan, bankLoan, otherCosts){
    const skoede = TINGLYSNING.skoedeFast + TINGLYSNING.skoedePct * price;
    const pantFor = loan => loan > 0 ? TINGLYSNING.pantFast + TINGLYSNING.pantPct * loan : 0;
    const pant = pantFor(realkreditLoan) + pantFor(bankLoan);
    const other = otherCosts || 0;
    return { skoede, pant, other, total: skoede + pant + other };
}

/**
 * Fordeler lånet på realkredit (op til 80 % af prisen) og banklån (resten).
 * @param {number} price
 * @param {number} downPayment
 * @returns {{loan:number, realkredit:number, bank:number}}
 */
function loanSplit(price, downPayment){
    const loan = Math.max(0, price - downPayment);
    const realkredit = Math.min(loan, MAX_REALKREDIT * price);
    return { loan, realkredit, bank: loan - realkredit };
}

/**
 * Værdien af rentefradraget for et års renteudgifter (inkl. bidrag).
 * @param {number} annualInterest
 * @param {number} adults antal voksne, der deler lånet (1 eller 2)
 * @returns {number}
 */
function interestDeductionValue(annualInterest, adults){
    if(annualInterest <= 0) return 0;
    const threshold = RENTEFRADRAG.thresholdPerAdult * Math.max(1, adults || 1);
    return Math.min(annualInterest, threshold) * RENTEFRADRAG.lowRate
         + Math.max(0, annualInterest - threshold) * RENTEFRADRAG.highRate;
}

// ==== Hvor meget kan jeg låne? ====

/**
 * Den højeste boligpris, man kan købe, givet tre begrænsninger:
 * 1) udbetaling: opsparingen skal dække omkostningerne og mindst 5 % af prisen,
 * 2) gældsfaktor: samlet gæld efter købet højst `debtFactorLimit` × indkomsten,
 * 3) ydelse: den samlede månedlige ydelse højst `maxMonthlyPayment` (0 = ingen grænse).
 * Hele opsparingen bruges; det, der er tilbage efter omkostninger, er udbetaling.
 * @param {{income:number, savings:number, existingDebt:number, debtFactorLimit:number,
 *   maxMonthlyPayment:number, realkreditRate:number, bidragssats:number, realkreditYears:number,
 *   bankRate:number, bankYears:number, otherCosts:number}} p satser som decimaltal
 * @returns {{maxPrice:number, limits:{downPayment:number, debtFactor:number, payment:number|null},
 *   binding:'downPayment'|'debtFactor'|'payment', details:Object}}
 */
function loanCapacity(p){
    const evaluate = price => {
        // Omkostningerne afhænger af lånene og omvendt - få gennemløb konvergerer.
        let downPayment = p.savings;
        for(let i = 0; i < 25; i++){
            const s = loanSplit(price, Math.max(0, downPayment));
            downPayment = p.savings - purchaseCosts(price, s.realkredit, s.bank, p.otherCosts).total;
        }
        const split = loanSplit(price, Math.max(0, downPayment));
        const costs = purchaseCosts(price, split.realkredit, split.bank, p.otherCosts);
        const realkreditPayment = annuityPayment(split.realkredit, p.realkreditRate, p.realkreditYears);
        const bidrag = split.realkredit * p.bidragssats / 12;
        const bankPayment = annuityPayment(split.bank, p.bankRate, p.bankYears);
        return {
            price, downPayment, ...split, costs,
            realkreditPayment, bidrag, bankPayment,
            monthly: realkreditPayment + bidrag + bankPayment,
            debtFactor: p.income > 0 ? (split.loan + (p.existingDebt || 0)) / p.income : Infinity,
            ltv: price > 0 ? split.loan / price : 0
        };
    };

    const checks = {
        downPayment: price => evaluate(price).downPayment >= MIN_UDBETALING * price - 1e-6,
        debtFactor: price => evaluate(price).debtFactor <= p.debtFactorLimit + 1e-9,
        payment: price => evaluate(price).monthly <= p.maxMonthlyPayment + 1e-6
    };
    // Alle tre er monotone i prisen, så den højeste gyldige pris findes ved halvering.
    const maxBy = ok => {
        if(!ok(0)) return 0;
        let lo = 0, hi = Math.max(1, p.savings / MIN_UDBETALING);
        if(ok(hi)) return hi;
        for(let i = 0; i < 60; i++){
            const mid = (lo + hi) / 2;
            if(ok(mid)) lo = mid; else hi = mid;
        }
        return lo;
    };
    const limits = {
        downPayment: maxBy(checks.downPayment),
        debtFactor: maxBy(checks.debtFactor),
        payment: p.maxMonthlyPayment > 0 ? maxBy(checks.payment) : null
    };
    const binding = Object.keys(limits)
        .filter(k => limits[k] !== null)
        .reduce((a, b) => limits[b] < limits[a] ? b : a);
    const maxPrice = Math.floor(limits[binding] / 1000) * 1000;
    return { maxPrice, limits, binding, details: evaluate(maxPrice) };
}

// ==== Køb eller leje? ====

/**
 * Sammenligner at købe en bolig med at leje og investere forskellen, måned for
 * måned. Begge starter med samme formue: køberens udbetaling + købsomkostninger.
 * Lejeren betaler depositum og investerer resten. Hver måned investerer den af
 * de to, der har de laveste boligudgifter, forskellen. Gevinst ved salg af egen
 * bolig er skattefri (parcelhusreglen); investeringsafkastet angives efter skat.
 *
 * @param {{price:number, downPayment:number, realkreditRate:number, bidragssats:number,
 *   realkreditYears:number, bankRate:number, bankYears:number, propertyTaxYearly:number,
 *   maintenancePct:number, ownerCostsMonthly:number, priceGrowth:number, otherBuyCosts:number,
 *   sellCostsPct:number, rentMonthly:number, rentGrowth:number, depositMonths:number,
 *   investReturn:number, adults:number, years:number}} p satser som decimaltal
 * @returns {{series:{year:number, buyer:number, renter:number, homeValue:number, debt:number}[],
 *   upfront:number, firstYearBuyerMonthly:number, firstYearRentMonthly:number, breakEvenYear:number|null,
 *   final:{buyer:number, renter:number}}}
 */
function simulateBuyVsRent(p){
    const split = loanSplit(p.price, p.downPayment);
    const costs = purchaseCosts(p.price, split.realkredit, split.bank, p.otherBuyCosts);
    const upfront = Math.min(p.downPayment, p.price) + costs.total;
    const deposit = p.rentMonthly * p.depositMonths;

    let rk = split.realkredit, bank = split.bank;
    const rkPay = annuityPayment(rk, p.realkreditRate, p.realkreditYears);
    const bankPay = annuityPayment(bank, p.bankRate, p.bankYears);
    const monthlyFactor = Math.pow(1 + p.investReturn, 1 / 12);

    let buyerInvest = 0;
    let renterInvest = upfront - deposit;
    let rent = p.rentMonthly;
    let homeValue = p.price;
    let propertyTax = p.propertyTaxYearly;
    let firstYearBuyer = 0, firstYearRent = 0;

    const netWorth = () => ({
        buyer: homeValue * (1 - p.sellCostsPct) - rk - bank + buyerInvest,
        renter: renterInvest + deposit
    });
    const series = [{ year: 0, ...netWorth(), homeValue, debt: rk + bank }];

    for(let year = 1; year <= p.years; year++){
        let yearInterest = 0;
        const monthlyCosts = [];
        for(let m = 0; m < 12; m++){
            const rkInterest = rk * p.realkreditRate / 12;
            const bidrag = rk * p.bidragssats / 12;
            const rkPaid = rk > 0 ? Math.min(rkPay, rk + rkInterest) : 0;
            rk = Math.max(0, rk + rkInterest - rkPaid);
            const bankInterest = bank * p.bankRate / 12;
            const bankPaid = bank > 0 ? Math.min(bankPay, bank + bankInterest) : 0;
            bank = Math.max(0, bank + bankInterest - bankPaid);
            yearInterest += rkInterest + bidrag + bankInterest;
            monthlyCosts.push(rkPaid + bidrag + bankPaid
                + propertyTax / 12 + homeValue * p.maintenancePct / 12 + p.ownerCostsMonthly);
        }
        // Rentefradraget modregnes jævnt over året.
        const deductionMonthly = interestDeductionValue(yearInterest, p.adults) / 12;
        for(let m = 0; m < 12; m++){
            const buyerCost = monthlyCosts[m] - deductionMonthly;
            if(year === 1){ firstYearBuyer += buyerCost / 12; firstYearRent += rent / 12; }
            buyerInvest *= monthlyFactor;
            renterInvest *= monthlyFactor;
            const diff = buyerCost - rent;
            if(diff > 0) renterInvest += diff; else buyerInvest -= diff;
        }
        homeValue *= 1 + p.priceGrowth;
        propertyTax *= 1 + p.priceGrowth;
        rent *= 1 + p.rentGrowth;
        series.push({ year, ...netWorth(), homeValue, debt: rk + bank });
    }
    const breakEven = series.find(s => s.year > 0 && s.buyer >= s.renter);
    return {
        series, upfront, costs, split,
        firstYearBuyerMonthly: firstYearBuyer, firstYearRentMonthly: firstYearRent,
        breakEvenYear: breakEven ? breakEven.year : null,
        final: { buyer: series.at(-1).buyer, renter: series.at(-1).renter }
    };
}

// ==== Gældsafvikling ====

const DEBT_MAX_MONTHS = 600;

/**
 * Afvikler flere lån måned for måned. Minimumsydelsen betales på alle lån;
 * ekstrabeløbet - og ydelsen fra lån, der er betalt ud ("sneboldeffekten") -
 * går til ét mållån ad gangen:
 * 'avalanche' (lavine) = højeste rente først, 'snowball' (snebold) = mindste
 * restgæld først, 'minimum' = kun minimumsydelser, ingen overførsel.
 * @param {{name:string, balance:number, rate:number, minPayment:number}[]} debts rente som decimaltal
 * @param {number} extraMonthly
 * @param {'avalanche'|'snowball'|'minimum'} strategy
 * @returns {{feasible:boolean, months:number, totalInterest:number, totalPaid:number,
 *   payoff:{name:string, index:number, month:number}[], balances:number[]}} index = lånets plads blandt lånene med restgæld balances[m] = samlet restgæld efter m måneder
 */
function simulateDebtPayoff(debts, extraMonthly, strategy){
    const state = debts
        .filter(d => d.balance > 0)
        .map((d, i) => ({ ...d, index: i, left: d.balance, paidOffMonth: null }));
    const budget = state.reduce((s, d) => s + d.minPayment, 0) + (strategy === 'minimum' ? 0 : Math.max(0, extraMonthly));
    const balances = [state.reduce((s, d) => s + d.left, 0)];
    let totalInterest = 0, totalPaid = 0, month = 0;

    const order = () => {
        const open = state.filter(d => d.left > 0.005);
        if(strategy === 'snowball') return open.sort((a, b) => a.left - b.left || b.rate - a.rate);
        return open.sort((a, b) => b.rate - a.rate || a.left - b.left);
    };

    while(state.some(d => d.left > 0.005) && month < DEBT_MAX_MONTHS){
        month++;
        state.forEach(d => {
            if(d.left <= 0.005) return;
            const interest = d.left * d.rate / 12;
            d.left += interest;
            totalInterest += interest;
        });
        let available = budget;
        state.forEach(d => {
            if(d.left <= 0.005) return;
            const pay = Math.min(d.minPayment, d.left, strategy === 'minimum' ? Infinity : available);
            d.left -= pay; available -= pay; totalPaid += pay;
        });
        if(strategy !== 'minimum'){
            for(const d of order()){
                if(available <= 0) break;
                const pay = Math.min(d.left, available);
                d.left -= pay; available -= pay; totalPaid += pay;
            }
        }
        state.forEach(d => { if(d.left <= 0.005 && d.paidOffMonth === null){ d.left = 0; d.paidOffMonth = month; } });
        balances.push(state.reduce((s, d) => s + d.left, 0));
    }
    const feasible = state.every(d => d.left <= 0.005);
    return {
        feasible,
        months: feasible ? month : null,
        totalInterest, totalPaid,
        payoff: state.filter(d => d.paidOffMonth !== null)
            .sort((a, b) => a.paidOffMonth - b.paidOffMonth)
            .map(d => ({ name: d.name, index: d.index, month: d.paidOffMonth })),
        balances
    };
}

// ==== Pension ====

/**
 * Folkepensionsalderen for et fødselstidspunkt. 67-70 år er vedtaget; højere
 * aldre er Beskæftigelsesministeriets skøn, som endnu ikke er vedtaget.
 * @param {number} birthYear
 * @param {number} [birthMonth] 1-12, bruges kun ved grænserne midt i 1987 og 1996
 * @returns {{age:number, legislated:boolean}}
 */
function folkepensionAge(birthYear, birthMonth = 1){
    const key = birthYear * 12 + (birthMonth - 1);
    const from = (y, m) => y * 12 + (m - 1);
    const table = [
        [from(1996, 7), 74, false], [from(1992, 1), 73.5, false], [from(1987, 7), 73, false],
        [from(1983, 1), 72.5, false], [from(1979, 1), 71.5, false], [from(1975, 1), 71, false],
        [from(1971, 1), 70, true], [from(1967, 1), 69, true], [from(1963, 1), 68, true]
    ];
    const row = table.find(([start]) => key >= start);
    return row ? { age: row[1], legislated: row[2] } : { age: 67, legislated: true };
}

/**
 * Pensionsopsparing frem til pensionsalderen og en jævn månedlig udbetaling
 * bagefter. Afkastet fratrækkes omkostninger og PAL-skat. Udbetalingen er en
 * annuitet over `payoutYears`, hvor restformuen fortsat forrentes.
 * @param {{currentAge:number, retirementAge:number, currentSavings:number, monthlyContribution:number,
 *   annualReturn:number, annualCosts:number, inflation:number, payoutYears:number, payoutTaxRate:number}} p
 *   satser som decimaltal
 * @returns {{netAnnualReturn:number, balanceAtRetirement:number, balanceAtRetirementReal:number,
 *   monthlyPayoutGross:number, monthlyPayoutNet:number, monthlyPayoutNetReal:number,
 *   totalContributions:number, series:{age:number, balance:number, balanceReal:number}[]}}
 */
function simulatePension(p){
    const netAnnualReturn = (p.annualReturn - p.annualCosts) * (1 - PAL_SKAT);
    const monthlyFactor = Math.pow(1 + netAnnualReturn, 1 / 12);
    const yearsToRetirement = Math.max(0, Math.round((p.retirementAge - p.currentAge) * 12) / 12);
    const deflate = (value, years) => value / Math.pow(1 + p.inflation, years);

    let balance = p.currentSavings;
    let totalContributions = 0;
    const series = [{ age: p.currentAge, balance, balanceReal: balance }];
    const accumulationMonths = Math.round(yearsToRetirement * 12);
    for(let m = 1; m <= accumulationMonths; m++){
        balance += p.monthlyContribution;
        totalContributions += p.monthlyContribution;
        balance *= monthlyFactor;
        if(m % 12 === 0 || m === accumulationMonths){
            const years = m / 12;
            series.push({ age: p.currentAge + years, balance, balanceReal: deflate(balance, years) });
        }
    }
    const balanceAtRetirement = balance;
    // Samme effektive månedsrente som i opsparingsfasen, så formuen rammer præcis 0.
    const payoutMonths = Math.round(p.payoutYears * 12);
    const rm = monthlyFactor - 1;
    const monthlyPayoutGross = payoutMonths <= 0 ? 0 : rm === 0 ? balance / payoutMonths : balance * rm / (1 - Math.pow(1 + rm, -payoutMonths));
    for(let m = 1; m <= payoutMonths; m++){
        balance = balance * monthlyFactor - monthlyPayoutGross;
        if(m % 12 === 0){
            const years = yearsToRetirement + m / 12;
            series.push({ age: p.currentAge + years, balance: Math.max(0, balance), balanceReal: deflate(Math.max(0, balance), years) });
        }
    }
    const monthlyPayoutNet = monthlyPayoutGross * (1 - p.payoutTaxRate);
    return {
        netAnnualReturn, balanceAtRetirement,
        balanceAtRetirementReal: deflate(balanceAtRetirement, yearsToRetirement),
        monthlyPayoutGross, monthlyPayoutNet,
        monthlyPayoutNetReal: deflate(monthlyPayoutNet, yearsToRetirement),
        totalContributions, series
    };
}

// ==== Backup, nødopsparing og faktisk afkast ====

const DAY_MS = 24 * 60 * 60 * 1000;
const BACKUP_REMIND_AFTER_DAYS = 30;
const BACKUP_FIRST_REMIND_AFTER_DAYS = 7;

/**
 * Skal brugeren mindes om at tage backup? Kun hvis der er data at miste, og
 * enten er seneste backup over 30 dage gammel, eller der aldrig er taget en
 * og dataene er over 7 dage gamle. En udsættelse ("påmind mig senere") respekteres.
 * @param {{hasData:boolean, now:number, lastBackupAt:number|null, firstDataAt:number|null, snoozedUntil:number|null}} s tidspunkter i ms
 * @returns {{due:boolean, daysSinceBackup:number|null}}
 */
function backupReminderDue(s){
    const daysSinceBackup = s.lastBackupAt ? Math.floor((s.now - s.lastBackupAt) / DAY_MS) : null;
    if(!s.hasData || (s.snoozedUntil && s.now < s.snoozedUntil)) return {due:false, daysSinceBackup};
    if(daysSinceBackup !== null) return {due: daysSinceBackup >= BACKUP_REMIND_AFTER_DAYS, daysSinceBackup};
    const dataAge = s.firstDataAt ? (s.now - s.firstDataAt) / DAY_MS : 0;
    return {due: dataAge >= BACKUP_FIRST_REMIND_AFTER_DAYS, daysSinceBackup};
}

/**
 * Hvor mange måneders udgifter kontanterne dækker.
 * @param {number} cash
 * @param {number} monthlyExpenses
 * @returns {number|null} null hvis udgifterne er ukendte
 */
function emergencyFundMonths(cash, monthlyExpenses){
    if(!(monthlyExpenses > 0)) return null;
    return Math.max(0, cash) / monthlyExpenses;
}

/**
 * Årlig intern rente (XIRR) for en række ind- og udbetalinger på datoer.
 * Negativ = penge ind i investeringen, positiv = penge ud (eller slutværdien).
 * @param {{date:string, amount:number}[]} flows ISO-datoer
 * @returns {number|null} fx 0.07 for 7 % om året; null hvis den ikke kan bestemmes
 */
function xirr(flows){
    if(flows.length < 2 || !flows.some(f => f.amount < 0) || !flows.some(f => f.amount > 0)) return null;
    const t0 = Date.parse(flows[0].date + 'T00:00:00Z');
    const years = flows.map(f => (Date.parse(f.date + 'T00:00:00Z') - t0) / (365 * DAY_MS));
    const npv = r => flows.reduce((sum, f, i) => sum + f.amount / Math.pow(1 + r, years[i]), 0);
    let lo = -0.9999, hi = 1;
    while(npv(lo) * npv(hi) > 0 && hi < 1e6) hi *= 2;
    if(npv(lo) * npv(hi) > 0) return null;
    for(let i = 0; i < 200; i++){
        const mid = (lo + hi) / 2;
        if(npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
}

/**
 * Pengestrømmene til XIRR fra porteføljehistorikken: startværdien som et
 * indskud på første dato, hver periodes indskud/udbetaling, og slutværdien.
 * Udbytte, der bliver i depotet, indgår i værdien.
 * @param {{date:string, portfolioValue:number, deposit:number}[]} history sorteret efter dato
 * @returns {{date:string, amount:number}[]}
 */
function portfolioCashFlows(history){
    if(history.length < 2) return [];
    const flows = [{date: history[0].date, amount: -(history[0].portfolioValue || 0)}];
    history.slice(1).forEach(h => { if(h.deposit) flows.push({date: h.date, amount: -h.deposit}); });
    flows.push({date: history.at(-1).date, amount: history.at(-1).portfolioValue || 0});
    return flows;
}

// ==== Mål i Formue ====

/**
 * Gennemsnitlig ændring pr. måned i et felt over den seneste periode (højst 12
 * måneder tilbage fra seneste datapunkt), ud fra historikken.
 * @param {{date:string}[]} history sorteret efter dato
 * @param {string} key fx 'value' (nettoformue) eller 'netCatAktier'
 * @returns {number|null} null ved under to punkter eller under en måneds spænd
 */
function monthlyTrend(history, key){
    if(history.length < 2) return null;
    const last = history.at(-1);
    const lastTime = Date.parse(last.date + 'T00:00:00Z');
    const window = history.filter(h => lastTime - Date.parse(h.date + 'T00:00:00Z') <= 366 * DAY_MS);
    const first = window[0];
    const months = (lastTime - Date.parse(first.date + 'T00:00:00Z')) / (DAY_MS * 30.44);
    if(months < 1) return null;
    return ((last[key] || 0) - (first[key] || 0)) / months;
}

/**
 * Fremdrift mod et mål: hvor langt man er, hvad der mangler, hvad der skal
 * spares op pr. måned for at nå fristen, og om det nuværende tempo rækker.
 * @param {{target:number, current:number, deadline?:string|null, today:string, trend?:number|null}} g datoer som ISO
 * @returns {{pct:number, remaining:number, reached:boolean, monthsLeft:number|null, neededPerMonth:number|null,
 *   monthsAtTrend:number|null, onTrack:boolean|null}}
 */
function goalProgress(g){
    const remaining = Math.max(0, g.target - g.current);
    const reached = g.current >= g.target;
    const pct = g.target > 0 ? Math.max(0, Math.min(1, g.current / g.target)) : 0;
    const monthsLeft = g.deadline
        ? Math.max(0, (Date.parse(g.deadline + 'T00:00:00Z') - Date.parse(g.today + 'T00:00:00Z')) / (DAY_MS * 30.44))
        : null;
    const neededPerMonth = !reached && monthsLeft !== null && monthsLeft > 0 ? remaining / monthsLeft : null;
    const trend = g.trend ?? null;
    const monthsAtTrend = !reached && trend !== null && trend > 0 ? remaining / trend : null;
    let onTrack = null;
    if(reached) onTrack = true;
    else if(monthsLeft !== null && trend !== null) onTrack = monthsLeft > 0 && trend >= neededPerMonth;
    return { pct, remaining, reached, monthsLeft, neededPerMonth, monthsAtTrend, onTrack };
}

// Node-eksport, så tests kan importere funktionerne. Ignoreres i browseren.
if(typeof module !== 'undefined' && module.exports){
    module.exports = {
        parseNumberToken, parseAmount, isExpression,
        TAX_YEAR, ASK_DEPOSIT_LIMIT, TAX_LIMIT_27, ASK_TAX, AKT_TAX_LOW, AKT_TAX_HIGH,
        setDoubleDeduction, effectiveTaxLimit,
        monthlyReturnFactor, toRealValue,
        computeAskSeries, computeAktFinalValueForStartYear, findBestHarvestStartYear, computeAktSeries,
        computeMonthlyFinalValueForStartYear, findBestMonthlyHarvestStartYear, computeMonthlySeries,
        computeFireSeries,
        monthlyAmount, categoryTotal, budgetSummary,
        upsertByDate, mergeByDate, changedFields, normalizeDate,
        CEPOS_WEALTH_TABLE, CEPOS_PENSION_TAX, CEPOS_SOURCE, findWealthRow, comparableNetWorth, estimatePercentile,
        parseDanishAmount, findHeaderRowIndex, parseCSV,
        TINGLYSNING, MIN_UDBETALING, MAX_REALKREDIT, HIGH_DEBT_FACTOR, HIGH_LTV, RENTEFRADRAG,
        annuityPayment, purchaseCosts, loanSplit, interestDeductionValue, loanCapacity,
        simulateBuyVsRent, simulateDebtPayoff,
        PAL_SKAT, PENSION_LIMITS, folkepensionAge, simulatePension,
        backupReminderDue, emergencyFundMonths, xirr, portfolioCashFlows,
        monthlyTrend, goalProgress
    };
}
