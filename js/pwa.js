/**
 * @file Installér som app: registrerer service workeren (sw.js), så siden kan
 * lægges på hjemmeskærmen og virker uden internet, og viser en knap i
 * indstillingerne. Chrome, Edge og Android tilbyder selv installationen;
 * på iPhone og iPad forklares det via Del-menuen.
 */

if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')){
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

let deferredInstallPrompt = null;

/**
 * App-ikonets tre farver. En web-app kan ikke selv skifte sit ikon, når den først ligger
 * på hjemmeskærmen: iPhone og Android tager ikonet med, i det øjeblik appen lægges på.
 * Derfor vælger man farven her, før man installerer, og siden peger så på det valgte
 * ikon (apple-touch-icon) og det manifest, der hører til (Chrome og Android).
 */
const APP_ICONS = {
    green: {touch: 'icons/apple-touch-icon.png', manifest: 'manifest.webmanifest'},
    black: {touch: 'icons/black/apple-touch-icon.png', manifest: 'manifest-black.webmanifest'},
    white: {touch: 'icons/white/apple-touch-icon.png', manifest: 'manifest-white.webmanifest'}
};

/** @returns {'green'|'black'|'white'} den valgte farve (grøn, hvis intet er valgt). */
function readAppIcon(){
    try{
        const id = localStorage.getItem('appIcon');
        return APP_ICONS[id] ? id : 'green';
    } catch(e){ return 'green'; }
}

/**
 * Peger siden på ikonet og manifestet for en farve og markerer valget i indstillingerne.
 * @param {'green'|'black'|'white'} id
 */
function applyAppIcon(id){
    const icon = APP_ICONS[id] || APP_ICONS.green;
    document.querySelector('link[rel="apple-touch-icon"]').setAttribute('href', icon.touch);
    document.querySelector('link[rel="manifest"]').setAttribute('href', icon.manifest);
    document.querySelectorAll('input[name="appIcon"]').forEach(r => { r.checked = r.value === id; });
}

/**
 * Valget i indstillingerne: huskes, og bruges næste gang appen lægges på hjemmeskærmen.
 * @param {'green'|'black'|'white'} id
 */
function setAppIcon(id){
    try{ localStorage.setItem('appIcon', id); } catch(e){}
    applyAppIcon(id);
}

/** @returns {boolean} true, når siden kører som installeret app (fra hjemmeskærmen). */
function isInstalledApp(){
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

/** @returns {boolean} true på iPhone og iPad, hvor appen installeres via Del > Føj til hjemmeskærm. */
function isIOS(){
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Viser knappen, når appen kan installeres og ikke allerede kører som app. */
function updateInstallButton(){
    const row = document.getElementById('installAppRow');
    row.hidden = isInstalledApp() || !(deferredInstallPrompt || isIOS());
}

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();          // vi viser vores egen knap i stedet for browserens banner
    deferredInstallPrompt = e;
    updateInstallButton();
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallButton();
    notify('Appen er installeret. Du finder den på din hjemmeskærm eller i dine programmer.');
});

/** Installerer appen: browserens egen dialog, eller en vejledning på iPhone og iPad. */
async function installApp(){
    if(deferredInstallPrompt){
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        updateInstallButton();
        return;
    }
    openDialog({
        title: 'Læg appen på hjemmeskærmen',
        content: el('div', {}, [
            el('ol', {className:'install-steps'}, [
                el('li', {}, ['Tryk på ', el('strong', {textContent:'Del'}), ' (firkanten med pilen) nederst i Safari.']),
                el('li', {}, ['Vælg ', el('strong', {textContent:'Føj til hjemmeskærm'}), '.']),
                el('li', {}, ['Tryk ', el('strong', {textContent:'Tilføj'}), '.'])
            ]),
            el('p', {className:'dialog-hint', textContent:'På iPhone og iPad har appen sin egen lagerplads, adskilt fra Safari. Vil du have dine tal med, så tryk Gem mine data her i Safari først, og Hent data fra fil i appen bagefter.'}),
            el('p', {className:'dialog-hint', textContent:'Er ikonerne på din hjemmeskærm mørke, tonede eller klare (hold fingeren på hjemmeskærmen › Rediger › Tilpas), farver iOS selv app-ikonet. Vælg Standard eller Lys dér for at se det i farver.'})
        ])
    });
}

applyAppIcon(readAppIcon());
updateInstallButton();
