/**
 * @file Backup og synkronisering mellem enheder via en fil. Alle data ligger kun
 * i browseren; for at få de samme tal på telefon og computer gemmes en fil
 * (på telefonen via del-menuen, fx til Google Drive eller iCloud) og hentes på
 * den anden enhed. Ved hentning flettes dataene i stedet for at blive
 * overskrevet: historikker samles dato for dato, og hvor noget er forskelligt,
 * vælger brugeren - med den senest ændrede foreslået. Kan fortrydes.
 *
 * For at vide, hvad der er nyest, huskes det, hvornår hver del sidst blev
 * ændret (localStorage 'syncTimes'). Det sker ved at lytte på localStorage.setItem
 * for de nøgler, der synkroniseres - kun når værdien faktisk ændres, og først når
 * siden er indlæst (så standardværdier ikke tæller som ændringer).
 * Filen skal derfor indlæses før de andre scripts. Planlægningen ligger i calc.js
 * (planSync, applySync).
 */

// Alt, der gemmes i filen og flettes. Indstillinger er rå tekst (ikke JSON) og
// ligger i filens 'settings'-afsnit.
const BACKUP_KEYS = ['budgetItems', 'budgetData', 'budgetCustomCategories', 'netWorthData', 'netWorthHistory', 'portfolioHistory', 'monthlyStatusLast', 'debtPayoffData', 'netWorthGoals', 'taxTracker'];
const BACKUP_SETTING_KEYS = ['theme', 'monthlyReminderOff', 'wealthAge', 'showForecast'];
const SYNC_HISTORY_KEYS = ['netWorthHistory', 'portfolioHistory'];
// Dele, brugeren skal tage stilling til, hvis de er forskellige. Resten (fx tema) følger den nyeste.
const SYNC_LABELS = {
    budgetItems: 'Budgetposter', budgetData: 'Budgettets samlede beløb', budgetCustomCategories: 'Egne budgetkategorier',
    netWorthData: 'Formue-felterne', netWorthHistory: 'Formuehistorik', portfolioHistory: 'Porteføljehistorik',
    debtPayoffData: 'Lån i gældsafvikling', netWorthGoals: 'Mål', taxTracker: 'Skattegrænse'
};

(function trackChanges(){
    const tracked = new Set(BACKUP_KEYS.concat(BACKUP_SETTING_KEYS));
    // Mens siden indlæses, gemmer værktøjerne deres standardværdier (fx tomme felter).
    // Det er ikke brugerens ændringer og må ikke få en tom, ny enhed til at se "nyest" ud.
    let loaded = false;
    window.addEventListener('load', () => { loaded = true; });
    const setItem = Storage.prototype.setItem;
    const removeItem = Storage.prototype.removeItem;
    const stamp = storage => key => {
        try{
            const times = JSON.parse(storage.getItem('syncTimes') || '{}');
            times[key] = Date.now();
            setItem.call(storage, 'syncTimes', JSON.stringify(times));
        } catch(e){ /* tidsstemplet er kun en hjælp */ }
    };
    Storage.prototype.setItem = function(key, value){
        if(loaded && this === window.localStorage && tracked.has(key) && this.getItem(key) !== String(value)) stamp(this)(key);
        return setItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function(key){
        if(loaded && this === window.localStorage && tracked.has(key) && this.getItem(key) !== null) stamp(this)(key);
        return removeItem.call(this, key);
    };
})();

/**
 * Hvornår hver nøgle sidst blev ændret på denne enhed - bruges til at flette en fil fra en anden enhed.
 * @returns {Object<string, number>} nøgle -> millisekunder
 */
function readSyncTimes(){
    try{ return JSON.parse(localStorage.getItem('syncTimes') || '{}'); } catch(e){ return {}; }
}

/** Et kort navn på denne enhed, så man kan se, hvor en fil kommer fra. */
function deviceName(){
    const ua = navigator.userAgent;
    if(/iPhone/.test(ua)) return 'iPhone';
    if(/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad';
    if(/Android/.test(ua)) return 'Android';
    if(/Mac/.test(ua)) return 'Mac';
    if(/Windows/.test(ua)) return 'Windows-pc';
    return 'en anden enhed';
}

/** Alle data på denne enhed: {key: værdi}, hvor indstillinger er tekst. */
function readLocalData(){
    const data = {};
    BACKUP_KEYS.forEach(key => {
        const raw = localStorage.getItem(key);
        if(raw !== null){ try{ data[key] = JSON.parse(raw); } catch(e){ /* ødelagt del springes over */ } }
    });
    BACKUP_SETTING_KEYS.forEach(key => { const v = localStorage.getItem(key); if(v !== null) data[key] = v; });
    return data;
}

/**
 * Gemmer én værdi fra en backupfil. Indstillinger gemmes som tekst, data som JSON; tom værdi sletter nøglen.
 * @param {string} key
 * @param {*} value
 */
function writeLocalValue(key, value){
    if(value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, BACKUP_SETTING_KEYS.includes(key) ? String(value) : JSON.stringify(value));
}

/** Datoen og klokkeslættet som "26. sep. 2026 kl. 14.02". */
function formatDateTime(ms){
    const d = new Date(ms);
    return `${formatDanishDate(todayIso(d))} kl. ${d.toLocaleTimeString('da-DK', {hour:'2-digit', minute:'2-digit'})}`;
}

/**
 * Gemmer alle data i én fil. På en telefon åbnes del-menuen, så filen kan
 * lægges i fx Google Drive eller iCloud eller sendes med AirDrop; på en
 * computer downloades den.
 */
async function exportAllData(){
    const data = readLocalData();
    const file = {format:'okonomivaerktoejer', version:2, exportedAt: Date.now(), device: deviceName(), times: readSyncTimes(), settings:{}};
    Object.entries(data).forEach(([key, value]) => {
        if(BACKUP_SETTING_KEYS.includes(key)) file.settings[key] = value;
        else file[key] = value;
    });
    const now = new Date();
    const stamp = todayIso(now) + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    const filename = `okonomi-data-${stamp}.json`;
    const json = JSON.stringify(file, null, 2);

    const blob = new File([json], filename, {type:'application/json'});
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if(touch && navigator.canShare && navigator.canShare({files:[blob]})){
        try{
            await navigator.share({files:[blob], title:'Mine økonomidata'});
        } catch(e){
            if(e.name === 'AbortError') return;          // brugeren lukkede del-menuen
            downloadBlob(blob, filename);
        }
    } else {
        downloadBlob(blob, filename);
    }
    localStorage.setItem('lastBackupAt', String(Date.now()));
    localStorage.removeItem('backupSnoozedUntil');
    document.getElementById('backupBanner').hidden = true;
    if(typeof renderBackupStatus === 'function') renderBackupStatus();
    notify(touch
        ? 'Dine data er gemt. Hent filen på din anden enhed med "Hent data fra fil".'
        : 'Filen er downloadet. Læg den fx i Google Drive, og hent den på din anden enhed med "Hent data fra fil".');
}

/**
 * Får browseren til at hente en fil, der er lavet på siden (fx backupfilen).
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const link = el('a', {href:url, download:filename});
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

/**
 * Læser en fil fra "Gem mine data" (eller en ældre backup) og viser, hvad der
 * er forskelligt, før noget ændres.
 * @param {Event} event change-eventet fra <input type="file">
 */
function importAllData(event){
    const input = event.target;
    const picked = input.files[0];
    if(!picked) return;
    const reader = new FileReader();
    reader.onload = async e => {
        input.value = '';
        let file;
        try{ file = JSON.parse(e.target.result); } catch(err){ file = null; }
        if(!file || typeof file !== 'object'){
            await infoDialog({title:'Filen kunne ikke læses', message:'Det ser ikke ud til at være en fil fra "Gem mine data". Vælg den .json-fil, du gemte på din anden enhed.'});
            return;
        }
        const incoming = {};
        BACKUP_KEYS.forEach(key => { if(file[key] !== undefined) incoming[key] = file[key]; });
        if(file.settings && typeof file.settings === 'object'){
            BACKUP_SETTING_KEYS.forEach(key => { if(typeof file.settings[key] === 'string') incoming[key] = file.settings[key]; });
        }
        // Ældre filer kan indeholde 'budgetMode' fra en fjernet funktion.
        if(incoming.budgetData && typeof incoming.budgetData === 'object') delete incoming.budgetData.budgetMode;
        if(!Object.keys(incoming).length){
            await infoDialog({title:'Ingen data i filen', message:'Filen indeholder ingen budget-, formue- eller porteføljedata. Intet er ændret.'});
            return;
        }
        // Ældre filer har ingen tidsstempler; så regnes alt i filen for ændret, da filen blev gemt.
        const fileTime = file.exportedAt || picked.lastModified || 0;
        const incomingTimes = file.times || Object.fromEntries(Object.keys(incoming).map(k => [k, fileTime]));
        openSyncDialog({incoming, incomingTimes, fileTime, device: file.device || null});
    };
    reader.readAsText(picked, 'UTF-8');
}

/** Viser forskellene og lader brugeren vælge; skriver først, når der trykkes "Hent". */
function openSyncDialog({incoming, incomingTimes, fileTime, device}){
    const local = readLocalData();
    const localTimes = readSyncTimes();
    const keys = BACKUP_KEYS.concat(BACKUP_SETTING_KEYS.filter(k => k !== 'theme'));   // temaet følger enheden
    const plan = planSync({local, localTimes, incoming, incomingTimes, keys, historyKeys: SYNC_HISTORY_KEYS});
    const visible = plan.filter(p => SYNC_LABELS[p.key] && p.kind !== 'same' && p.kind !== 'onlyLocal');
    const choices = {};

    if(!plan.some(p => p.kind === 'added' || p.kind === 'differs' || p.kind === 'history')){
        infoDialog({title:'Allerede opdateret', message:'Filen indeholder ikke noget, der ikke allerede er på denne enhed.'});
        return;
    }

    const when = t => t ? formatDateTime(t) : 'ukendt tidspunkt';
    const rows = visible.map(item => {
        const label = SYNC_LABELS[item.key];
        if(item.kind === 'added') return syncRow(label, 'Findes kun i filen – hentes.');
        if(item.kind === 'history'){
            const parts = [];
            if(item.dates.length) parts.push(`${item.dates.length} ${item.dates.length === 1 ? 'ny dato' : 'nye datoer'} fra filen lægges til`);
            if(!item.conflicts.length) return syncRow(label, parts.join('') + '. Ingen datoer går tabt.');
            parts.push(`${item.conflicts.length} ${item.conflicts.length === 1 ? 'dato har' : 'datoer har'} forskellige tal (${item.conflicts.map(formatDanishDate).join(', ')})`);
            return syncRow(label, parts.join('. ') + '.', choiceSelect(item, 'Ved forskellige tal, brug', incomingTimes, localTimes, choices));
        }
        return syncRow(label, 'Er forskellig på de to enheder.', choiceSelect(item, 'Brug', incomingTimes, localTimes, choices));
    });

    const source = device ? `Filen er gemt på ${device} ${when(fileTime)}.` : `Filen er gemt ${when(fileTime)}.`;
    openDialog({
        title:'Hent data fra fil',
        wide:true,
        content: el('div', {}, [
            el('p', {className:'dialog-hint', textContent:`${source} Dine data flettes med filens – historikkerne samles, og hvor noget er forskelligt, vælger du. Det, der kun findes på denne enhed, beholdes.`}),
            rows.length ? el('div', {className:'sync-rows'}, rows) : el('p', {className:'dialog-text', textContent:'Kun indstillinger er forskellige – de opdateres.'})
        ]),
        actions:[
            {label:'Annullér', variant:'secondary'},
            {label:'Hent og flet', variant:'primary', onClick: () => applySyncChanges(plan, local, incoming, incomingTimes, choices, device)}
        ]
    });
}

/**
 * Én række i synkroniseringsdialogen: hvad det gælder, hvad der er sket, og evt. et valg.
 * @param {string} label fx "Formue"
 * @param {string} text forklaringen under
 * @param {HTMLElement} [control] fx en vælger mellem denne enhed og filen
 * @returns {HTMLElement}
 */
function syncRow(label, text, control){
    return el('div', {className:'sync-row'}, [
        el('div', {className:'sync-row-text'}, [el('strong', {textContent: label}), el('span', {textContent: text})]),
        control || ''
    ]);
}

/** En vælger mellem filens og denne enheds udgave, med den senest ændrede valgt. */
function choiceSelect(item, prefix, incomingTimes, localTimes, choices){
    const initial = item.newer || 'incoming';
    choices[item.key] = initial;
    // Kort tekst, så den kan være i en vælger på en telefon: "Filens · 26. sep. 14.02 · nyest".
    const short = t => {
        if(!t) return 'ukendt';
        const d = new Date(t);
        const date = d.toLocaleDateString('da-DK', {day:'numeric', month:'short'}).replace(/\.$/, '');
        return `${date}. ${d.toLocaleTimeString('da-DK', {hour:'2-digit', minute:'2-digit'})}`;
    };
    const option = (value, name, t) => el('option', {value, selected: initial === value,
        textContent: [name, short(t), item.newer === value ? 'nyest' : ''].filter(Boolean).join(' · ')});
    const select = el('select', {className:'number-input sync-choice', attrs:{'aria-label': `${prefix} – ${SYNC_LABELS[item.key]}`}, onchange: e => { choices[item.key] = e.target.value; }}, [
        option('incoming', 'Filens', incomingTimes[item.key]),
        option('local', 'Denne enheds', localTimes[item.key])
    ]);
    return el('label', {className:'sync-choice-wrap'}, [el('span', {textContent: prefix}), select]);
}

/**
 * Skriver resultatet, husker det forrige, så det kan fortrydes, og genindlæser
 * siden, så alle værktøjer læser de nye tal.
 */
function applySyncChanges(plan, local, incoming, incomingTimes, choices, device){
    const {changes, chosen} = applySync(plan, local, incoming, choices);
    try{
        sessionStorage.setItem('syncUndo', JSON.stringify({data: local, times: readSyncTimes()}));
    } catch(e){ /* uden fortryd, hvis der ikke er plads */ }
    Object.entries(changes).forEach(([key, value]) => writeLocalValue(key, value));
    // Det hentede beholder filens ændringstidspunkt, så det ikke fejlagtigt ser nyere ud næste gang.
    const times = readSyncTimes();
    Object.entries(chosen).forEach(([key, how]) => {
        if(how === 'incoming') times[key] = incomingTimes[key] || times[key];
        else if(how === 'merged') times[key] = Math.max(times[key] || 0, incomingTimes[key] || 0);
    });
    Storage.prototype.setItem.call(localStorage, 'syncTimes', JSON.stringify(times));
    localStorage.setItem('lastSyncImport', JSON.stringify({at: Date.now(), device}));
    sessionStorage.setItem('syncJustApplied', '1');
    location.reload();
}

/** Efter en hentning: besked med fortryd. */
(function announceSync(){
    if(sessionStorage.getItem('syncJustApplied') !== '1') return;
    sessionStorage.removeItem('syncJustApplied');
    document.addEventListener('DOMContentLoaded', () => {
        notify('Dine data er hentet og flettet.', {actionLabel:'Fortryd', onAction: () => {
            const undo = JSON.parse(sessionStorage.getItem('syncUndo') || 'null');
            if(!undo) return;
            BACKUP_KEYS.concat(BACKUP_SETTING_KEYS).forEach(key => writeLocalValue(key, undo.data[key]));
            Storage.prototype.setItem.call(localStorage, 'syncTimes', JSON.stringify(undo.times));
            sessionStorage.removeItem('syncUndo');
            location.reload();
        }});
    });
})();

/** "Sidst hentet: … fra iPhone" i indstillingerne. */
function renderSyncStatus(){
    const node = document.getElementById('syncStatus');
    if(!node) return;
    let last = null;
    try{ last = JSON.parse(localStorage.getItem('lastSyncImport') || 'null'); } catch(e){ /* intet */ }
    node.textContent = last ? `Sidst hentet fra fil: ${formatDateTime(last.at)}${last.device ? ' (fra ' + last.device + ')' : ''}` : '';
}
document.addEventListener('DOMContentLoaded', renderSyncStatus);
