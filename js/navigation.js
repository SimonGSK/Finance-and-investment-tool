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
 * første og flyttes derfor ind i det værktøj, der vises. Er Investering ikke
 * den viste sektion, skiftes der dertil.
 * @param {number} n 1 ASK vs. depot, 2 månedligt depot, 3 FIRE, 4 portefølje, 5 pension, 6 tips & viden
 * @param {boolean} [stay] true = skift ikke sektion (bruges ved indlæsning)
 */
function showTool(n, stay){
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
    if(!stay && document.getElementById('section-tools').style.display === 'none') showSection('tools');
    updatePageHeader();
    closeNav();
}

/**
 * Viser et af værktøjerne under "Bolig & lån".
 * @param {number} n 1 låneevne, 2 køb eller leje, 3 gældsafvikling
 * @param {boolean} [stay] true = skift ikke sektion
 */
function showHousingTool(n, stay){
    showToolIn('housing', 'housingTabBtn', n);
    if(!stay && document.getElementById('section-housing').style.display === 'none') showSection('housing');
    updatePageHeader();
    closeNav();
}

/**
 * Skifter hovedsektion og gentegner dens synlige grafer.
 * @param {'overview'|'tools'|'housing'|'budget'|'formue'} name
 */
function showSection(name){
    document.body.dataset.section = name;      // fx viser Oversigtens knapper i sidehovedet
    document.querySelectorAll('[id^="section-"]').forEach(section => {
        section.style.display = section.id === 'section-' + name ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-item[data-section]').forEach(btn => btn.classList.toggle('active', btn.dataset.section === name));
    // Den gruppe, man står i, er foldet ud, og de andre foldes sammen, så menuen ikke bliver lang.
    document.querySelectorAll('.nav-group').forEach(g => g.setAttribute('aria-expanded', String(g.dataset.section === name)));
    resizeChartsIn(document.getElementById('section-' + name));
    if(name === 'overview' && typeof renderOverview === 'function') renderOverview();
    updatePageHeader();
    closeNav();
    window.scrollTo({top: 0});
}

// Overskriften øverst på siden: område som lille tekst, værktøj eller side som titel.
const PAGE_TITLES = {
    overview: ['Oversigt', 'Din økonomi i overblik'],
    budget: ['Budget', 'Dit budget'],
    formue: ['Formue', 'Din formue']
};

/**
 * Området og værktøjet, man står i, som de hedder i menuen.
 * @returns {{section:string, area:string, tool:string|null}}
 */
function activePageNames(){
    const btn = document.querySelector('.nav-item[data-section].active');
    const section = btn?.dataset.section || 'overview';
    // Kun knappens egen tekst - ikke tallet (antal værktøjer) ved siden af.
    const area = btn ? [...btn.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() : '';
    const tool = document.querySelector(`.nav-item[data-section="${section}"] + .nav-sub .nav-subitem.active`)?.textContent.trim() || null;
    return {section, area, tool};
}

/** Skriver område og titel i sidehovedet ud fra den sektion og det værktøj, der vises. */
function updatePageHeader(){
    const {section, area, tool} = activePageNames();
    let [eyebrow, title] = PAGE_TITLES[section] || [area, area];
    if(tool){ eyebrow = area; title = tool; }
    document.getElementById('pageEyebrow').textContent = eyebrow;
    document.getElementById('pageTitle').textContent = title;
    // Undertitlen bruges kun af Oversigten (seneste månedsstatus), som selv skriver den.
    if(section !== 'overview') document.getElementById('pageSub').textContent = '';
}

/**
 * Folder en menugruppe (Investering, Bolig & lån) ud eller sammen. Siden skifter
 * ikke - det sker først, når man vælger et værktøj i gruppen.
 * @param {HTMLButtonElement} btn
 */
function toggleNavGroup(btn){
    const open = btn.getAttribute('aria-expanded') !== 'true';
    // Kun én gruppe åben ad gangen, så menuen ikke bliver lang.
    if(open) document.querySelectorAll('.nav-group').forEach(g => { if(g !== btn) g.setAttribute('aria-expanded', 'false'); });
    btn.setAttribute('aria-expanded', String(open));
}

// ---- Menuen på telefoner: glider ind fra venstre ----

/** Åbner menuen på telefon og tablet og flytter fokus til det aktive punkt. */
function openNav(){
    document.body.classList.add('nav-open');
    document.getElementById('menuBtn').setAttribute('aria-expanded', 'true');
    document.querySelector('#sidebar .nav-item.active')?.focus();
}

/** Lukker menuen på telefon og tablet (gør intet, hvis den allerede er lukket). */
function closeNav(){
    if(!document.body.classList.contains('nav-open')) return;
    document.body.classList.remove('nav-open');
    document.getElementById('menuBtn').setAttribute('aria-expanded', 'false');
}

document.addEventListener('keydown', e => { if(e.key === 'Escape' && document.body.classList.contains('nav-open')) closeNav(); });

// Startsiden er Oversigt; værktøjerne står klar i baggrunden.
document.body.dataset.section = 'overview';
showTool(1, true);
showHousingTool(1, true);

// BACKUP_KEYS, exportAllData og importAllData ligger i sync.js.

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

/**
 * Læser et tidsstempel (millisekunder) fra localStorage.
 * @param {string} key
 * @returns {number|null} null, hvis det mangler eller ikke er et tal
 */
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

/** "Udfyld nu" i påmindelsen: åbner månedsstatus med den foreslåede dato (månedens sidste dag). */
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
    const dialog = document.getElementById('settingsPanel');
    const show = open ?? !dialog.open;
    if(show && !dialog.open){
        closeNav();
        renderBackupStatus();
        dialog.showModal();
    } else if(!show && dialog.open){
        dialog.close();
    }
}

// Esc lukker af sig selv (dialogens "cancel"); et klik på den slørede baggrund lukker også.
(function initSettingsDialog(){
    const dialog = document.getElementById('settingsPanel');
    dialog.addEventListener('click', e => { if(e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => document.getElementById('settingsBtn').focus());
})();

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
