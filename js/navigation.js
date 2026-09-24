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
        const payTax = document.getElementById('payTaxExternally');
        (payTax.closest('.toggle-wrap') || payTax.closest('.toggle-row')).insertAdjacentElement('afterend', ddRow);
    } else if(n === 2){
        document.getElementById('tool2InflationRow').insertAdjacentElement('afterend', ddRow);
    }
    ddRow.style.display = (n === 1 || n === 2) ? '' : 'none';
    if(n === 3 && typeof updateFireImportButton === 'function') updateFireImportButton();
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

const BACKUP_KEYS = ['budgetItems', 'budgetData', 'budgetCustomCategories', 'netWorthData', 'netWorthHistory', 'portfolioHistory', 'monthlyStatusLast', 'debtPayoffData', 'netWorthGoals'];

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
    link.download = 'okonomivaerktoejer-backup-' + todayIso() + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    localStorage.setItem('lastBackupAt', String(Date.now()));
    localStorage.removeItem('backupSnoozedUntil');
    document.getElementById('backupBanner').hidden = true;
    renderBackupStatus();
    notify('Backup downloadet. Gem filen et sikkert sted, fx i din cloud-mappe.');
}

/** @returns {boolean} om der er data, der ville gå tabt uden backup */
function hasUserData(){
    const read = key => { try{ return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){ return null; } };
    const items = read('budgetItems') || {};
    return (read('netWorthHistory') || []).length > 0
        || (read('portfolioHistory') || []).length > 0
        || Object.values(items).some(list => list.length > 0)
        || (read('budgetCustomCategories') || []).length > 0
        || read('debtPayoffData') !== null
        || read('monthlyStatusLast') !== null
        || (read('netWorthGoals') || []).length > 0;
}

function readTimestamp(key){
    const v = parseInt(localStorage.getItem(key), 10);
    return isNaN(v) ? null : v;
}

/** Skriver "Seneste backup: …" i indstillingspanelet. */
function renderBackupStatus(){
    const last = readTimestamp('lastBackupAt');
    const node = document.getElementById('backupStatus');
    if(!last){
        node.textContent = hasUserData() ? 'Seneste backup: aldrig' : '';
        node.classList.toggle('is-stale', hasUserData());
        return;
    }
    const days = Math.floor((Date.now() - last) / DAY_MS);
    const ago = days === 0 ? 'i dag' : days === 1 ? 'i går' : `${days} dage siden`;
    node.textContent = `Seneste backup: ${formatDanishDate(todayIso(new Date(last)))} (${ago})`;
    node.classList.toggle('is-stale', days >= BACKUP_REMIND_AFTER_DAYS);
}

/** Viser backup-påmindelsen, hvis den er aktuel. */
function checkBackupReminder(){
    const now = Date.now();
    const hasData = hasUserData();
    if(hasData && !readTimestamp('firstDataAt')) localStorage.setItem('firstDataAt', String(now));
    const {due, daysSinceBackup} = backupReminderDue({
        hasData, now,
        lastBackupAt: readTimestamp('lastBackupAt'),
        firstDataAt: readTimestamp('firstDataAt'),
        snoozedUntil: readTimestamp('backupSnoozedUntil')
    });
    document.getElementById('backupBanner').hidden = !due;
    if(due){
        document.getElementById('backupBannerText').textContent = daysSinceBackup === null
            ? 'Du har ikke taget en backup af dine data endnu. De findes kun i denne browser – download en backup, så du ikke mister dem.'
            : `Det er ${daysSinceBackup} dage siden, du sidst tog en backup. Download en ny, så dine seneste tal også er sikret.`;
    }
}

// ---- Påmindelse om månedsstatus ----

let monthlyReminderState = null;

/** Viser påmindelsen om at gemme månedens tal, hvis den er aktuel (se monthlyStatusReminder i calc.js). */
function checkMonthlyReminder(){
    const banner = document.getElementById('monthlyReminderBanner');
    const latest = typeof latestStatusDate === 'function' ? latestStatusDate() : null;
    monthlyReminderState = monthlyStatusReminder({
        today: todayIso(),
        latestSaved: latest,
        dismissedMonth: localStorage.getItem('monthlyReminderDismissed'),
        enabled: localStorage.getItem('monthlyReminderOff') !== '1'
    });
    banner.hidden = !monthlyReminderState.due;
    if(monthlyReminderState.due){
        const monthName = new Date(monthlyReminderState.month + '-15').toLocaleDateString('da-DK', {month:'long'});
        document.getElementById('monthlyReminderText').textContent =
            `Tid til månedsstatus: gem dine tal for ${monthName}, så din formue- og porteføljehistorik bliver ved med at være komplet.`;
    }
}

function openMonthlyStatusFromReminder(){
    openMonthlyStatus(monthlyReminderState?.suggestedDate);
}

/** "Ikke denne måned": skjuler påmindelsen, til næste måned slutter. */
function dismissMonthlyReminder(){
    if(monthlyReminderState?.month) localStorage.setItem('monthlyReminderDismissed', monthlyReminderState.month);
    document.getElementById('monthlyReminderBanner').hidden = true;
    notify('Du bliver mindet om det igen ved næste månedsskifte. Du kan slå påmindelsen fra i indstillingerne.');
}

/** Udsætter påmindelsen en uge. */
function snoozeBackupReminder(){
    localStorage.setItem('backupSnoozedUntil', String(Date.now() + 7 * DAY_MS));
    document.getElementById('backupBanner').hidden = true;
    notify('Vi minder dig om det igen om en uge.');
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
        // Ældre backups kan indeholde 'budgetMode' fra en fjernet funktion.
        if(backup.budgetData && typeof backup.budgetData === 'object') delete backup.budgetData.budgetMode;
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

checkBackupReminder();

if(!localStorage.getItem('hasSeenIntroBanner')){
    document.getElementById('introBanner').style.display = 'flex';
}

/**
 * Åbner eller lukker indstillingspanelet under tandhjulet. Esc eller et klik
 * uden for panelet lukker det også.
 * @param {boolean} [open] tving åben/lukket; udeladt skifter
 */
function toggleSettings(open){
    const panel = document.getElementById('settingsPanel');
    const btn = document.getElementById('settingsBtn');
    const show = open ?? panel.style.display === 'none';
    panel.style.display = show ? 'block' : 'none';
    btn.setAttribute('aria-expanded', String(show));
    if(show) renderBackupStatus();
}

document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && document.getElementById('settingsPanel').style.display !== 'none' && !document.querySelector('dialog[open]')){
        toggleSettings(false);
        document.getElementById('settingsBtn').focus();
    }
});
document.addEventListener('click', e => {
    const panel = document.getElementById('settingsPanel');
    if(panel.style.display === 'none') return;
    if(!panel.contains(e.target) && !document.getElementById('settingsBtn').contains(e.target) && !e.target.closest('dialog')) toggleSettings(false);
});

document.getElementById('doubleDeduction').addEventListener('change', () => {
    setDoubleDeduction(document.getElementById('doubleDeduction').checked);
    update();
    update2();
});
// Påmindelsen om månedsstatus: tjek ved indlæsning, og slå til/fra i indstillingerne.
(function initMonthlyReminder(){
    const toggle = document.getElementById('monthlyReminderToggle');
    toggle.checked = localStorage.getItem('monthlyReminderOff') !== '1';
    toggle.addEventListener('change', () => {
        if(toggle.checked) localStorage.removeItem('monthlyReminderOff');
        else localStorage.setItem('monthlyReminderOff', '1');
        checkMonthlyReminder();
    });
    // Efter alle scripts: påmindelsen læser historikken fra net-worth.js, som indlæses senere.
    document.addEventListener('DOMContentLoaded', checkMonthlyReminder);
})();
