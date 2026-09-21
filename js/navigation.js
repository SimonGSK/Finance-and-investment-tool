/**
 * @file Navigation mellem sektioner (Investering/Budget/Formue) og værktøjer,
 * indstillingspanelet, intro-banneret og fuld backup af alle data som JSON.
 */

/**
 * Viser ét af de fire investeringsværktøjer og skjuler de andre. Sørger også
 * for at den viste graf får målt sin størrelse - Chart.js kan ikke måle en
 * graf, der var skjult, da den blev tegnet.
 * @param {1|2|3|4} n
 */
function showTool(n){
    document.getElementById('tool1').style.display = n===1 ? 'block' : 'none';
    document.getElementById('tool2').style.display = n===2 ? 'block' : 'none';
    document.getElementById('tool3').style.display = n===3 ? 'block' : 'none';
    document.getElementById('tool4').style.display = n===4 ? 'block' : 'none';
    document.getElementById('tabBtn1').classList.toggle('active', n===1);
    document.getElementById('tabBtn2').classList.toggle('active', n===2);
    document.getElementById('tabBtn3').classList.toggle('active', n===3);
    document.getElementById('tabBtn4').classList.toggle('active', n===4);

    const ddRow = document.getElementById('doubleDeductionRow');
    if(n===1){
        document.getElementById('payTaxExternally').closest('.toggle-row').insertAdjacentElement('afterend', ddRow);
    } else if(n===2){
        document.getElementById('tool2InflationRow').insertAdjacentElement('afterend', ddRow);
    }
    ddRow.style.display = (n===1 || n===2) ? 'flex' : 'none';

    if(n===1) chart.resize();
    if(n===2) chart2.resize();
    if(n===3) chart3.resize();
    if(n===4){ ptChart1.resize(); ptChart2.resize(); ptChart3.resize(); ptChart4.resize(); }
}

showTool(1);

/**
 * Skifter mellem de tre hovedsektioner og gentegner sektionens grafer, så de
 * får den rigtige størrelse efter at have været skjult.
 * @param {'tools'|'budget'|'formue'} name
 */
function showSection(name){
    document.getElementById('section-tools').style.display = name==='tools' ? 'block' : 'none';
    document.getElementById('section-budget').style.display = name==='budget' ? 'block' : 'none';
    document.getElementById('section-formue').style.display = name==='formue' ? 'block' : 'none';
    document.getElementById('topTabBtn1').classList.toggle('active', name==='tools');
    document.getElementById('topTabBtn2').classList.toggle('active', name==='budget');
    document.getElementById('topTabBtn3').classList.toggle('active', name==='formue');

    if(name==='tools'){
        const tool1Visible = document.getElementById('tool1').style.display !== 'none';
        const tool2Visible = document.getElementById('tool2').style.display !== 'none';
        const tool3Visible = document.getElementById('tool3').style.display !== 'none';
        if(tool1Visible){ chart.resize(); }
        else if(tool2Visible){ chart2.resize(); }
        else if(tool3Visible){ chart3.resize(); }
        else { ptChart1.resize(); ptChart2.resize(); ptChart3.resize(); ptChart4.resize(); }
    }
    if(name==='budget'){ budgetChart.resize(); }
    if(name==='formue'){ netWorthChart.resize(); netWorthHistoryChart.resize(); if(netWorthCompositionChart) netWorthCompositionChart.resize(); }
}

const BACKUP_KEYS = ['budgetItems', 'budgetData', 'netWorthData', 'netWorthHistory', 'portfolioHistory'];

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
    reader.onload = function(e){
        try{
            const backup = JSON.parse(e.target.result);
            if(!confirm('Dette overskriver dine nuværende Budget-, Formue- og Portefølje-data med indholdet af filen. Vil du fortsætte?')) return;
            BACKUP_KEYS.forEach(key => {
                if(backup[key] !== undefined){
                    localStorage.setItem(key, JSON.stringify(backup[key]));
                }
            });
            alert('Data importeret. Siden genindlæses nu.');
            location.reload();
        } catch(err){
            alert('Kunne ikke læse filen. Tjek at det er en backup-fil eksporteret fra dette værktøj.');
        }
        event.target.value = '';
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