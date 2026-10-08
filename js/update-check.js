/**
 * @file "Ny version klar": en side, der står åben længe (fx appen på telefonen, som
 * iPhone holder i live i baggrunden), opdager, når der er lagt en ny version ud, og
 * tilbyder at genindlæse. Den sammenligner sit eget versionsnummer (<meta name="app-version">,
 * sat af npm run stamp) med den nyeste index.html, når man vender tilbage til appen og
 * hver halve time, mens den er åben. Uden internet tjekkes der ikke.
 */

const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || null;
const VERSION_CHECK_EVERY_MS = 30 * 60 * 1000;
const VERSION_CHECK_ON_RETURN_MS = 10 * 60 * 1000;
let lastVersionCheck = Date.now();   // siden er lige hentet, så den er den nyeste
let versionShown = null;

/**
 * Henter den nyeste index.html og viser beskeden, hvis den er nyere end den åbne side.
 * @returns {Promise<boolean>} true, hvis beskeden blev vist
 */
async function checkForNewVersion(){
    lastVersionCheck = Date.now();
    if(!APP_VERSION || navigator.onLine === false) return false;
    let latest = null;
    try{
        latest = appVersionOf(await (await fetch('index.html', {cache: 'no-store'})).text());
    } catch(e){ return false; }
    // Samme version, eller beskeden er allerede vist for den (også hvis den er lukket med krydset).
    if(!latest || latest === APP_VERSION || latest === versionShown) return false;
    versionShown = latest;
    notify('En ny version er klar.', {actionLabel: 'Genindlæs', onAction: () => location.reload(), duration: Infinity});
    return true;
}

document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible' && Date.now() - lastVersionCheck > VERSION_CHECK_ON_RETURN_MS) checkForNewVersion();
});
setInterval(() => { if(document.visibilityState === 'visible') checkForNewVersion(); }, VERSION_CHECK_EVERY_MS);
