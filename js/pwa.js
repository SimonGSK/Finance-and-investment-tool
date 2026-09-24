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

function isInstalledApp(){
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

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
            el('p', {className:'dialog-hint', textContent:'På iPhone og iPad har appen sin egen lagerplads, adskilt fra Safari. Vil du have dine tal med, så tryk Download alt her i Safari først, og Upload alt i appen bagefter.'})
        ])
    });
}

updateInstallButton();
