const DK = new Intl.NumberFormat('da-DK', {maximumFractionDigits:0});

function getCSSVar(name){
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Grafernes farver hentes fra CSS-variabler, så de følger temaet (lyst/mørkt).
function CHART_COLOR(name){
    return getCSSVar(name);
}

// Marker automatisk hele indholdet af et talfelt, når man klikker i det,
// så man kan skrive direkte i stedet for først at skulle slette et "0".
// 'true' til sidst (capture-fasen) er nødvendigt, fordi 'focus' ikke bobler
// op igennem DOM'et som de fleste andre events.
document.addEventListener('focus', function(e){
    if(e.target.matches && e.target.matches('input[type="number"].number-input')){
        e.target.select();
    }
}, true);

// Binder en <input type="range"> og en <input type="number"> sammen. Talfeltet er
// sandheden: det er dét, beregningerne læser fra, så et indtastet beløb bruges
// præcist som skrevet. Skyderen følger bare med visuelt og bliver derfor klemt
// ind i sit eget min/max/step uden at det påvirker tallet. 'onChange' kaldes
// efter begge slags input.
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

