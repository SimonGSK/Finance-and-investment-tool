/**
 * @file DOM-hjælpere, der deles af alle værktøjer: talformatering, opslag af
 * CSS-variabler til graferne, kobling af skyder og talfelt, og CSV-download.
 * Selve beregningerne ligger i calc.js.
 */

const DK = new Intl.NumberFormat('da-DK', {maximumFractionDigits:0});

/**
 * Læser en CSS custom property fra :root, fx '--akt' eller '--font-mono'.
 * @param {string} name variabelnavnet inkl. de to bindestreger
 * @returns {string} værdien som tekst, uden omgivende mellemrum
 */
function getCSSVar(name){
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Farve til Chart.js hentet fra en CSS-variabel, så graferne følger temaet.
 * Samme som getCSSVar - navnet gør bare hensigten tydelig i grafopsætningerne.
 * @param {string} name fx '--ask'
 * @returns {string} en hex-farve
 */
function CHART_COLOR(name){
    return getCSSVar(name);
}

// Marker automatisk hele indholdet af et talfelt, når man klikker i det,
// så man kan skrive direkte i stedet for først at skulle slette et "0".
// 'true' til sidst (capture-fasen) er nødvendigt, fordi 'focus' ikke bobler
// op igennem DOM'et som de fleste andre events.
document.addEventListener('focus', function(e){
    if(e.target.matches && e.target.matches('input[data-number]')){
        e.target.select();
    }
}, true);

/**
 * Fælles Chart.js-opsætning for linjegrafer: temafarver, mono-akser med kr.-tal,
 * og en tooltip der viser alle serier for samme x-værdi.
 * @param {(c: object) => string} tooltipLabelFn formaterer én tooltip-linje
 * @returns {object} options-objekt til `new Chart`
 */
function lineChartOptions(tooltipLabelFn){
    return {
        responsive:true,
        maintainAspectRatio:false,
        animation:{duration:250},
        interaction:{mode:'index', intersect:false},
        plugins:{
            legend:{display:false},
            tooltip:{
                backgroundColor:CHART_COLOR('--tooltip-bg'),
                borderColor:CHART_COLOR('--border'),
                borderWidth:1,
                titleColor:CHART_COLOR('--text'),
                bodyColor:CHART_COLOR('--text'),
                callbacks:{ label: tooltipLabelFn }
            }
        },
        scales:{
            x:{ grid:{color:CHART_COLOR('--chart-grid')}, ticks:{color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-mono'), size:11}} },
            y:{ grid:{color:CHART_COLOR('--chart-grid')}, ticks:{color:CHART_COLOR('--muted'), font:{family:getCSSVar('--font-mono'), size:11}, callback: v => DK.format(v)} }
        }
    };
}

/**
 * Binder en <input type="range"> og en <input type="number"> sammen. Talfeltet er
 * sandheden: det er dét, beregningerne læser fra, så et indtastet beløb bruges
 * præcist som skrevet. Skyderen følger bare med visuelt og bliver derfor klemt
 * ind i sit eget min/max/step uden at det påvirker tallet.
 * @param {string} sliderId id på range-inputtet
 * @param {string} numberId id på number-inputtet
 * @param {() => void} onChange kaldes efter begge slags input
 */
function bindSliderAndNumber(sliderId, numberId, onChange){
    const slider = document.getElementById(sliderId);
    const number = document.getElementById(numberId);

    slider.addEventListener('input', () => {
        number.value = slider.value;
        onChange();
    });

    number.addEventListener('input', () => {
        const v = parseFloat(number.value);
        if(isNaN(v)) return;
        slider.value = v;
        onChange();
    });

    // Efterlades feltet tomt, sættes det tilbage til skyderens værdi, så
    // beregningerne aldrig står med et tomt felt.
    number.addEventListener('change', () => {
        if(isNaN(parseFloat(number.value))){
            number.value = slider.value;
            onChange();
        }
    });
}

/**
 * Downloader en HTML-tabel som CSV i dansk Excel-venligt format: semikolon som
 * separator, alle felter i anførselstegn, og en BOM så æøå vises rigtigt.
 * @param {string} tbodyId id på tabellens <tbody>; overskrifterne tages fra <thead>
 * @param {string} filename fx 'formuehistorik.csv'
 */
function downloadTableAsCSV(tbodyId, filename){
    const tbody = document.getElementById(tbodyId);
    const table = tbody.closest('table');
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const rows = Array.from(tbody.querySelectorAll('tr')).map(tr =>
        // Celler kan gemme en maskinlæsbar værdi (fx ISO-datoen) i data-csv, så
        // eksporten kan læses ind igen, selvom tabellen viser "30. sep. 2026".
        Array.from(tr.querySelectorAll('td')).map(td => (td.dataset.csv ?? td.textContent).trim())
    );

    // Semikolon som separator (ikke komma), fordi danske Excel-opsætninger som
    // udgangspunkt forventer det - komma bruges jo allerede som decimaltegn i vores tal.
    const csvLines = [headers, ...rows].map(row =>
        row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';')
    );
    // \uFEFF (byte-order-mark) forrest hjælper Excel med at genkende dansk tegnsæt (æøå) korrekt.
    const csvContent = '\uFEFF' + csvLines.join('\r\n');

    const blob = new Blob([csvContent], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}


/**
 * Tallet i et inputfelt; tomt eller ugyldigt giver `fallback`.
 * @param {string} id
 * @param {number} [fallback]
 * @returns {number}
 */
function readNumber(id, fallback = 0){
    const v = parseFloat(document.getElementById(id).value);
    return isNaN(v) ? fallback : v;
}

/**
 * Et procentfelt som decimaltal: "4,5" i feltet giver 0.045.
 * @param {string} id
 * @returns {number}
 */
function readPercent(id){
    return readNumber(id) / 100;
}

/**
 * @param {number} fraction fx 0.0457
 * @param {number} [digits]
 * @returns {string} fx "4,6 %"
 */
function formatPct(fraction, digits = 1){
    return (fraction * 100).toFixed(digits).replace('.', ',') + ' %';
}

/**
 * @param {number} months
 * @returns {string} fx "3 år og 4 mdr.", "2 år" eller "7 mdr."
 */
function formatDuration(months){
    const y = Math.floor(months / 12), m = months % 12;
    if(!y) return `${m} mdr.`;
    return m ? `${y} år og ${m} mdr.` : `${y} år`;
}

/**
 * @param {number} months måneder fra i dag
 * @returns {string} fx "sep. 2029"
 */
function monthsFromNow(months){
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    return d.toLocaleDateString('da-DK', {month:'short', year:'numeric'});
}

/**
 * En sats som tal uden %-tegn i dansk format: 0.27 -> "27", 0.153 -> "15,3".
 * @param {number} fraction
 * @returns {string}
 */
function pctNumber(fraction){
    return (Math.round(fraction * 10000) / 100).toLocaleString('da-DK', {maximumFractionDigits:2});
}

// Tekster på siden, der gentager årets satser, hentes fra blokken øverst i calc.js.
// Elementet skriver kun selve tallet; "kr." og "%" står i HTML'en.
const RULE_TEXT = {
    TAX_YEAR: () => String(TAX_YEAR),
    ASK_DEPOSIT_LIMIT: () => DK.format(ASK_DEPOSIT_LIMIT),
    TAX_LIMIT_27: () => DK.format(TAX_LIMIT_27),
    AKT_TAX_LOW: () => pctNumber(AKT_TAX_LOW),
    AKT_TAX_HIGH: () => pctNumber(AKT_TAX_HIGH),
    ASK_TAX: () => pctNumber(ASK_TAX),
    EXAMPLE_TAX_HIGH: () => DK.format(TAX_LIMIT_27 * AKT_TAX_HIGH),
    EXAMPLE_TAX_LOW: () => DK.format(TAX_LIMIT_27 * AKT_TAX_LOW),
    EXAMPLE_TAX_SAVING: () => DK.format(TAX_LIMIT_27 * (AKT_TAX_HIGH - AKT_TAX_LOW)),
    PAL_SKAT: () => pctNumber(PAL_SKAT),
    RATEPENSION_LIMIT: () => DK.format(PENSION_LIMITS.ratepension),
    ALDERSOPSPARING_LIMIT: () => DK.format(PENSION_LIMITS.aldersopsparing),
    ALDERSOPSPARING_NEAR_LIMIT: () => DK.format(PENSION_LIMITS.aldersopsparingNearPension),
    SKOEDE_FAST: () => DK.format(TINGLYSNING.skoedeFast),
    SKOEDE_PCT: () => pctNumber(TINGLYSNING.skoedePct),
    PANT_FAST: () => DK.format(TINGLYSNING.pantFast),
    PANT_PCT: () => pctNumber(TINGLYSNING.pantPct),
    MIN_UDBETALING: () => pctNumber(MIN_UDBETALING),
    MAX_REALKREDIT: () => pctNumber(MAX_REALKREDIT),
    HIGH_DEBT_FACTOR: () => String(HIGH_DEBT_FACTOR).replace('.', ','),
    HIGH_LTV: () => pctNumber(HIGH_LTV),
    RENTEFRADRAG_LOW: () => pctNumber(RENTEFRADRAG.lowRate),
    RENTEFRADRAG_HIGH: () => pctNumber(RENTEFRADRAG.highRate),
    RENTEFRADRAG_THRESHOLD: () => DK.format(RENTEFRADRAG.thresholdPerAdult)
};

/**
 * Udfylder alle [data-rule]-elementer med årets tal.
 * @param {ParentNode} [root] fx en dialog; udeladt = hele siden
 */
function fillRuleText(root = document){
    root.querySelectorAll('[data-rule]').forEach(node => {
        const format = RULE_TEXT[node.dataset.rule];
        if(format) node.textContent = format();
    });
}
fillRuleText();
