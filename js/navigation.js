/**
 * @file Navigation mellem sektioner (Investering/Budget/Formue) og værktøjer,
 * indstillingspanelet, intro-banneret og fuld backup af alle data som JSON.
 */

/**
 * Gentegner de synlige grafer i en container. Chart.js kan ikke måle en graf,
 * der var skjult, da den blev tegnet, så det skal ske, når den bliver vist.
 * @param {HTMLElement} container
 */
function resizeChartsIn(container){
    container.querySelectorAll('canvas').forEach(canvas => {
        if(canvas.offsetParent !== null) Chart.getChart(canvas)?.resize();
    });
}

/**
 * Viser ét værktøj i en gruppe af faner og skjuler de andre.
 * @param {string} toolPrefix fx 'tool' for #tool1, #tool2 ...
 * @param {string} buttonPrefix fx 'tabBtn' for #tabBtn1 ...
 * @param {number} n
 */
function showToolIn(toolPrefix, buttonPrefix, n){
    for(let i = 1; document.getElementById(toolPrefix + i); i++){
        document.getElementById(toolPrefix + i).style.display = i === n ? 'block' : 'none';
        document.getElementById(buttonPrefix + i)?.classList.toggle('active', i === n);
    }
    resizeChartsIn(document.getElementById(toolPrefix + n));
}

/**
 * Viser et af investeringsværktøjerne. "Dobbelt fradrag" gælder kun de to
 * første og flyttes derfor ind i det værktøj, der vises.
 * @param {number} n 1 ASK vs. depot, 2 månedligt depot, 3 FIRE, 4 portefølje, 5 pension
 */
function showTool(n){
    showToolIn('tool', 'tabBtn', n);
    const ddRow = document.getElementById('doubleDeductionRow');
    if(n === 1){
        document.getElementById('payTaxExternally').closest('.toggle-row').insertAdjacentElement('afterend', ddRow);
    } else if(n === 2){
        document.getElementById('tool2InflationRow').insertAdjacentElement('afterend', ddRow);
    }
    ddRow.style.display = (n === 1 || n === 2) ? 'flex' : 'none';
}

/**
 * Viser et af værktøjerne under "Bolig & lån".
 * @param {number} n 1 låneevne, 2 køb eller leje, 3 gældsafvikling
 */
function showHousingTool(n){
    showToolIn('housing', 'housingTabBtn', n);
}

showTool(1);

/**
 * Skifter hovedsektion og gentegner dens synlige grafer.
 * @param {'tools'|'housing'|'budget'|'formue'} name
 */
function showSection(name){
    document.querySelectorAll('[id^="section-"]').forEach(section => {
        section.style.display = section.id === 'section-' + name ? 'block' : 'none';
    });
    document.querySelectorAll('.top-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.section === name));
    resizeChartsIn(document.getElementById('section-' + name));
}

const BACKUP_KEYS = ['budgetItems', 'budgetData', 'budgetCustomCategories', 'netWorthData', 'netWorthHistory', 'portfolioHistory', 'monthlyStatusLast', 'debtPayoffData'];

/**
 * Downloader alle gemte data (budget, formue, historik, portefølje) som én
 * JSON-fil, så man kan flytte dem til en anden browser eller enhed.
 */
function exportAllData(){
    const backup = {};
    BACKUP_KEYS.forEach(key => {
        const raw = localStorage.getItem(key);
        if(raw !== null) backup[key] = JSON.parse(raw);
    });
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'okonomivaerktoejer-backup-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Indlæser en JSON-backup fra exportAllData og overskriver de gemte data efter
 * bekræftelse. Siden genindlæses bagefter, så alt læses ind på ny.
 * @param {Event} event change-eventet fra <input type="file">
 */
function importAllData(event){
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async function(e){
        event.target.value = '';
        let backup;
        try{
            backup = JSON.parse(e.target.result);
        } catch(err){
            await infoDialog({title:'Filen kunne ikke læses', message:'Det ser ikke ud til at være en backup-fil fra dette værktøj. Vælg den .json-fil, du fik fra "Download alt".'});
            return;
        }
        const found = BACKUP_KEYS.filter(key => backup[key] !== undefined);
        if(!found.length){
            await infoDialog({title:'Ingen data i filen', message:'Filen indeholder ingen budget-, formue- eller porteføljedata. Intet er ændret.'});
            return;
        }
        const ok = await confirmDialog({
            title:'Erstat dine data med backuppen?',
            message:'Dine nuværende data i de dele, filen indeholder, bliver erstattet af filens indhold. Det kan ikke fortrydes, så download evt. en backup af dine nuværende data først.',
            confirmLabel:'Erstat og genindlæs', danger:true
        });
        if(!ok) return;
        found.forEach(key => localStorage.setItem(key, JSON.stringify(backup[key])));
        location.reload();
    };
    reader.readAsText(file, 'UTF-8');
}

/**
 * Skjuler velkomst-banneret og husker det, så det ikke vises igen.
 */
function dismissIntroBanner(){
    document.getElementById('introBanner').style.display = 'none';
    localStorage.setItem('hasSeenIntroBanner', 'true');
}

if(!localStorage.getItem('hasSeenIntroBanner')){
    document.getElementById('introBanner').style.display = 'flex';
}

/**
 * Åbner eller lukker indstillingspanelet under tandhjulet.
 */
function toggleSettings(){
    const panel = document.getElementById('settingsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

document.getElementById('doubleDeduction').addEventListener('change', () => {
    setDoubleDeduction(document.getElementById('doubleDeduction').checked);
    update();
    update2();
});