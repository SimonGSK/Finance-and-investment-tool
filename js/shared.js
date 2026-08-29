const TAX_LIMIT_27 = 79400;
const ASK_TAX = 0.17;
const AKT_TAX_LOW = 0.27;
const AKT_TAX_HIGH = 0.42;
const DK = new Intl.NumberFormat('da-DK', {maximumFractionDigits:0});

// Marker automatisk hele indholdet af et talfelt, når man klikker i det,
// så man kan skrive direkte i stedet for først at skulle slette et "0".
// 'true' til sidst (capture-fasen) er nødvendigt, fordi 'focus' ikke bobler
// op igennem DOM'et som de fleste andre events.
document.addEventListener('focus', function(e){
    if(e.target.matches && e.target.matches('input[type="number"].number-input')){
        e.target.select();
    }
}, true);

let doubleDeductionEnabled = false;

function effectiveTaxLimit(){
    return doubleDeductionEnabled ? TAX_LIMIT_27 * 2 : TAX_LIMIT_27;
}

// ---- Porteret fra Main.java: monthlyReturnFactor() ----
function monthlyReturnFactor(yearlyReturn){
    return Math.pow(yearlyReturn, 1/12);
}

// Regner et fremtidigt (nominelt) beløb om til nutidens købekraft.
function toRealValue(nominalValue, year, inflationFactor){
    return nominalValue / Math.pow(inflationFactor, year);
}

// Binder en <input type="range"> og en <input type="number"> sammen, så de altid
// afspejler samme værdi - flyt skyderen, og tallet opdateres; skriv et tal, og
// skyderen flytter med. 'onChange' kaldes efter begge slags input.
function bindSliderAndNumber(sliderId, numberId, onChange){
    const slider = document.getElementById(sliderId);
    const number = document.getElementById(numberId);

    slider.addEventListener('input', () => {
        number.value = slider.value;
        onChange();
    });

    number.addEventListener('input', () => {
        let v = parseFloat(number.value);
        if(isNaN(v)) return;
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        v = Math.min(max, Math.max(min, v));
        slider.value = v;
        onChange();
    });
}

function downloadTableAsCSV(tbodyId, filename){
    const tbody = document.getElementById(tbodyId);
    const table = tbody.closest('table');
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const rows = Array.from(tbody.querySelectorAll('tr')).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
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