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
 * Uddrag af CEPOS' formueopgørelse (Danmarks Statistik, 2022-tal opregnet til
 * 2025-niveau): nettoformue-percentiler pr. alder. 16 alderstrin i stedet for
 * alle 73 - der regnes lineært imellem.
 * @type {{age:number, p10:number, p25:number, p50:number, p75:number, p90:number, p95:number, p99:number}[]}
 */
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

/**
 * Rækken i CEPOS_WEALTH_TABLE, der ligger tættest på alderen (klemt til 18-90).
 * @param {number} age
 * @returns {{age:number, p10:number, p25:number, p50:number, p75:number, p90:number, p95:number, p99:number}}
 */
function findNearestWealthRow(age){
    const clampedAge = Math.max(18, Math.min(90, age));
    return CEPOS_WEALTH_TABLE.reduce((closest, row) =>
        Math.abs(row.age - clampedAge) < Math.abs(closest.age - clampedAge) ? row : closest
    );
}

/**
 * Cirka-percentil for en nettoformue i sin aldersgruppe: interpolerer lineært
 * imellem de kendte procentgrænser (10/25/50/75/90/95/99).
 * @param {number} netWorth nettoformue i kr.
 * @param {{p10:number, p25:number, p50:number, p75:number, p90:number, p95:number, p99:number}} row aldersrækken fra findNearestWealthRow
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

// Node-eksport, så tests kan importere funktionerne. Ignoreres i browseren.
if(typeof module !== 'undefined' && module.exports){
    module.exports = {
        TAX_YEAR, ASK_DEPOSIT_LIMIT, TAX_LIMIT_27, ASK_TAX, AKT_TAX_LOW, AKT_TAX_HIGH,
        setDoubleDeduction, effectiveTaxLimit,
        monthlyReturnFactor, toRealValue,
        computeAskSeries, computeAktFinalValueForStartYear, findBestHarvestStartYear, computeAktSeries,
        computeMonthlyFinalValueForStartYear, findBestMonthlyHarvestStartYear, computeMonthlySeries,
        computeFireSeries,
        monthlyAmount, categoryTotal, budgetSummary,
        upsertByDate, mergeByDate, changedFields, normalizeDate,
        CEPOS_WEALTH_TABLE, findNearestWealthRow, estimatePercentile,
        parseDanishAmount, findHeaderRowIndex, parseCSV,
        TINGLYSNING, MIN_UDBETALING, MAX_REALKREDIT, HIGH_DEBT_FACTOR, HIGH_LTV, RENTEFRADRAG,
        annuityPayment, purchaseCosts, loanSplit, interestDeductionValue, loanCapacity,
        simulateBuyVsRent, simulateDebtPayoff,
        PAL_SKAT, PENSION_LIMITS, folkepensionAge, simulatePension,
        backupReminderDue, emergencyFundMonths, xirr, portfolioCashFlows
    };
}
