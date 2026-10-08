/**
 * @file Kodelås: skjuler siden bag en kode på 4 cifre (ældre låse kan have op til 6), når den åbnes, og når man
 * kommer tilbage efter mere end 5 minutter i en anden app eller fane. Hvor enheden
 * understøtter det, kan man i stedet låse op med Face ID eller fingeraftryk (WebAuthn);
 * er det slået til, spørges der automatisk, når låseskærmen vises.
 *
 * Det er en skærmlås, ikke kryptering: tallene ligger stadig i browseren, så låsen
 * beskytter mod nysgerrige blikke, ikke mod en med teknisk adgang til enheden.
 * Koden gemmes aldrig, kun et saltet PBKDF2-hash af den. Glemmer man koden, kan man
 * kun komme ind ved at slette dataene på enheden (og hente en backup bagefter).
 *
 * Koden tastes på et taltastatur på skærmen (eller computerens tastatur) og vises som
 * prikker, én pr. ciffer; den tjekkes, så snart alle prikker er fyldt.
 *
 * Låsen gælder kun den enhed, den er slået til på, og kommer ikke med i backupfilen.
 * Et lille script i <head> skjuler siden, før noget vises, når låsen er slået til.
 */

const APP_LOCK_KEY = 'appLock';
const RELOCK_AFTER_MS = 5 * 60 * 1000;
let lockHiddenAt = null;
let lockFailures = 0;

const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));

/** @returns {{hash:string, salt:string, digits?:number, credentialId?:string}|null} låsens indstillinger, eller null når den er slået fra.
 *   digits = kodens længde (4-6), så låseskærmen kan vise én prik pr. ciffer; mangler i låse fra før prikkerne. */
function readAppLock(){
    try{ return JSON.parse(localStorage.getItem(APP_LOCK_KEY) || 'null'); } catch(e){ return null; }
}

/**
 * Et saltet hash af koden (PBKDF2, SHA-256), så selve koden aldrig gemmes.
 * @param {string} code
 * @param {Uint8Array} salt
 * @returns {Promise<string>} base64
 */
async function hashLockCode(code, salt){
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256'}, key, 256);
    return toB64(bits);
}

/** @param {string} code @returns {Promise<boolean>} true, hvis koden er rigtig */
async function checkLockCode(code){
    const lock = readAppLock();
    return !!lock && await hashLockCode(code, fromB64(lock.salt)) === lock.hash;
}

/** @returns {Promise<boolean>} true, hvis enheden kan låse op med Face ID, Touch ID eller fingeraftryk */
async function biometricAvailable(){
    try{
        return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch(e){ return false; }
}

/**
 * Låser: skjuler siden, lukker åbne dialoger og viser låseskærmen. Er Face ID eller
 * fingeraftryk slået til, spørges der med det samme; ellers (eller hvis det ikke
 * lykkes) skrives koden på tastaturet på skærmen.
 */
function lockApp(){
    if(!readAppLock()) return;
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    document.documentElement.classList.add('is-locked');
    lockEntry = '';
    document.getElementById('lockError').textContent = '';
    renderLockDots();
    const biometric = !!readAppLock()?.credentialId;
    document.getElementById('lockBiometric').hidden = !biometric;
    if(biometric) unlockWithBiometric(true);
}

/** Låser op og viser siden igen. */
function unlockApp(){
    document.documentElement.classList.remove('is-locked');
    lockFailures = 0;
    lockEntry = '';
    // Grafer, der blev tegnet, mens siden var skjult, skal måle sig igen.
    window.dispatchEvent(new Event('resize'));
}

/** De cifre, der er tastet indtil nu (kun i hukommelsen, aldrig på siden). */
let lockEntry = '';
let lockChecking = false;

/**
 * Prikkerne på låseskærmen: én pr. ciffer i koden, fyldt efterhånden som man taster.
 * Kendes kodens længde ikke (en lås fra før prikkerne), vises fire, og der kommer flere
 * til, hvis man taster mere - og "Lås op"-knappen bruges, indtil længden er kendt.
 */
function renderLockDots(){
    const digits = readAppLock()?.digits || null;
    const count = digits || Math.max(4, lockEntry.length);
    document.getElementById('lockDots').replaceChildren(...Array.from({length: count}, (_, i) =>
        el('span', {className: 'lock-dot' + (i < lockEntry.length ? ' is-filled' : '')})));
    document.getElementById('lockDigitsHint').textContent = digits
        ? `${lockEntry.length} af ${digits} cifre tastet.`
        : `${lockEntry.length} cifre tastet. Koden har 4-6 cifre.`;
    document.getElementById('lockSubmit').hidden = !!digits;
}

/** Et ciffer fra tastaturet på skærmen (eller computerens): koden tjekkes, så snart den er tastet helt. */
function pressLockDigit(digit){
    const digits = readAppLock()?.digits || null;
    if(lockChecking || document.getElementById('lockPin').classList.contains('is-waiting') || lockEntry.length >= (digits || 6)) return;
    lockEntry += digit;
    document.getElementById('lockError').textContent = '';
    renderLockDots();
    if(digits && lockEntry.length === digits) submitLockCode();
}

/** Sletter det sidst tastede ciffer. */
function deleteLockDigit(){
    if(lockChecking) return;
    lockEntry = lockEntry.slice(0, -1);
    renderLockDots();
}

/** Tjekker koden (fyldte prikker eller "Lås op"). Efter flere forkerte forsøg venter man lidt længere hver gang. */
async function submitLockCode(event){
    event?.preventDefault();
    const error = document.getElementById('lockError');
    if(lockChecking || !lockEntry) return;
    lockChecking = true;
    const code = lockEntry;
    const right = await checkLockCode(code);
    lockChecking = false;
    if(right){
        // En lås fra før prikkerne lærer nu kodens længde.
        const lock = readAppLock();
        if(lock && !lock.digits){ lock.digits = code.length; localStorage.setItem(APP_LOCK_KEY, JSON.stringify(lock)); }
        unlockApp();
        return;
    }
    lockFailures++;
    lockEntry = '';
    renderLockDots();
    const pin = document.getElementById('lockPin');
    pin.classList.remove('is-wrong');
    void pin.offsetWidth;   // start rystelsen forfra, også ved flere forkerte forsøg i træk
    pin.classList.add('is-wrong');
    const wait = lockFailures >= 5 ? Math.min(60, (lockFailures - 4) * 10) : 0;
    error.textContent = wait ? `Forkert kode. Prøv igen om ${wait} sekunder.` : 'Forkert kode. Prøv igen.';
    if(wait){
        const keys = document.querySelectorAll('#lockKeypad .lock-key');
        keys.forEach(k => { k.disabled = true; });
        pin.classList.add('is-waiting');
        setTimeout(() => { keys.forEach(k => { k.disabled = false; }); pin.classList.remove('is-waiting'); error.textContent = ''; }, wait * 1000);
    }
}

let biometricPending = false;

/**
 * "Brug Face ID eller fingeraftryk": beder enheden bekræfte, at det er ejeren.
 * @param {boolean} [auto] true, når låseskærmen selv spørger. Lykkes det ikke
 *   (annulleret, eller browseren vil have et tryk først), vises ingen fejl -
 *   tastaturet på skærmen og knappen står klar.
 */
async function unlockWithBiometric(auto = false){
    const lock = readAppLock();
    if(!lock?.credentialId || biometricPending) return;
    biometricPending = true;
    try{
        await navigator.credentials.get({publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            allowCredentials: [{type: 'public-key', id: fromB64(lock.credentialId)}],
            userVerification: 'required', timeout: 60000
        }});
        unlockApp();
    } catch(e){
        if(!auto) document.getElementById('lockError').textContent = 'Det lykkedes ikke. Brug din kode i stedet.';
    } finally {
        biometricPending = false;
    }
}

/** "Glemt koden?": den eneste vej ind er at slette dataene på enheden. */
async function forgotLockCode(){
    const ok = await confirmDialog({
        title: 'Glemt koden?',
        message: 'Koden kan ikke gendannes. Du kan kun komme ind igen ved at slette alle dine tal på denne enhed. Har du en backupfil (Gem mine data), kan du hente dem tilbage bagefter under Indstillinger › Hent data fra fil.',
        confirmLabel: 'Slet data og fjern koden', danger: true
    });
    if(!ok) return;
    localStorage.clear();
    location.reload();
}

/**
 * Beder om en ny kode to gange i en dialog.
 * @returns {Promise<string|null>} koden, eller null hvis man fortrød
 */
function askNewLockCode(){
    const first = el('input', {type: 'password', className: 'number-input', attrs: {inputmode: 'numeric', autocomplete: 'off', maxlength: '4'}});
    const second = el('input', {type: 'password', className: 'number-input', attrs: {inputmode: 'numeric', autocomplete: 'off', maxlength: '4'}});
    const error = el('div', {className: 'field-error', attrs: {role: 'alert'}});
    let code = null;
    const handle = openDialog({
        title: 'Vælg en kode',
        content: el('div', {}, [
            el('p', {className: 'dialog-hint', textContent: 'Vælg 4 cifre. Glemmer du koden, kan du kun komme ind ved at slette dine tal på denne enhed – så tag gerne en backup først.'}),
            fieldEl('Kode', first), fieldEl('Gentag koden', second, [error])
        ]),
        actions: [
            {label: 'Annullér', variant: 'secondary'},
            {label: 'Gem kode', variant: 'primary', onClick: () => {
                if(!/^\d{4}$/.test(first.value)){ error.textContent = 'Koden skal være 4 cifre.'; first.focus(); return false; }
                if(first.value !== second.value){ error.textContent = 'De to koder er ikke ens.'; second.value = ''; second.focus(); return false; }
                code = first.value;
            }}
        ]
    });
    first.focus();
    return handle.result.then(() => code);
}

/** Slår låsen til (eller skifter kode): gemmer et hash af den nye kode. */
async function setAppLockCode(){
    const code = await askNewLockCode();
    if(!code) return;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const existing = readAppLock();
    localStorage.setItem(APP_LOCK_KEY, JSON.stringify({hash: await hashLockCode(code, salt), salt: toB64(salt), digits: code.length, credentialId: existing?.credentialId}));
    notify(existing ? 'Koden er skiftet.' : 'Kodelåsen er slået til. Siden låses, når den åbnes, og når du har været væk i mere end 5 minutter.');
    renderLockSettings();
}

/**
 * Beder om den nuværende kode, før låsen slås fra.
 * @returns {Promise<boolean>} true, hvis koden var rigtig
 */
function confirmCurrentLockCode(){
    const input = el('input', {type: 'password', className: 'number-input', attrs: {inputmode: 'numeric', autocomplete: 'off', maxlength: '6'}});
    const error = el('div', {className: 'field-error', attrs: {role: 'alert'}});
    let ok = false;
    const handle = openDialog({
        title: 'Slå kodelåsen fra',
        content: el('div', {}, [fieldEl('Din nuværende kode', input, [error])]),
        actions: [
            {label: 'Annullér', variant: 'secondary'},
            {label: 'Slå fra', variant: 'danger', onClick: () => {
                checkLockCode(input.value).then(right => {
                    if(right){ ok = true; handle.close(true); }
                    else { error.textContent = 'Forkert kode.'; input.value = ''; input.focus(); }
                });
                return false;
            }}
        ]
    });
    input.focus();
    return handle.result.then(() => ok);
}

/** Slår låsen fra (efter den nuværende kode). */
async function removeAppLock(){
    if(!await confirmCurrentLockCode()) return;
    localStorage.removeItem(APP_LOCK_KEY);
    notify('Kodelåsen er slået fra.');
    renderLockSettings();
}

/** Face ID / fingeraftryk til eller fra: registrerer en nøgle på enheden (ingen server). */
async function toggleBiometric(enable){
    const lock = readAppLock();
    if(!lock) return;
    if(!enable){
        delete lock.credentialId;
        localStorage.setItem(APP_LOCK_KEY, JSON.stringify(lock));
        renderLockSettings();
        return;
    }
    try{
        const cred = await navigator.credentials.create({publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rp: {name: 'Økonomis'},
            user: {id: crypto.getRandomValues(new Uint8Array(16)), name: 'Økonomis', displayName: 'Økonomis'},
            pubKeyCredParams: [{type: 'public-key', alg: -7}, {type: 'public-key', alg: -257}],
            authenticatorSelection: {authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged'},
            timeout: 60000
        }});
        lock.credentialId = toB64(cred.rawId);
        localStorage.setItem(APP_LOCK_KEY, JSON.stringify(lock));
        notify('Du kan nu låse op med Face ID eller fingeraftryk.');
    } catch(e){
        notify('Face ID eller fingeraftryk blev ikke slået til.');
    }
    renderLockSettings();
}

/** Afsnittet "Kodelås" i indstillingerne: slå til, eller (når den er til) skift kode, Face ID og slå fra. */
async function renderLockSettings(){
    const box = document.getElementById('lockSettings');
    const lock = readAppLock();
    if(!lock){
        box.replaceChildren(el('button', {className: 'btn btn-secondary btn-sm', type: 'button', textContent: 'Slå kodelås til', onclick: setAppLockCode}));
        return;
    }
    const children = [el('p', {className: 'lock-status', textContent: 'Kodelåsen er slået til.'})];
    if(await biometricAvailable()){
        const box2 = el('input', {type: 'checkbox', checked: !!lock.credentialId, onchange: e => toggleBiometric(e.target.checked)});
        children.push(el('label', {className: 'toggle-row'}, [box2, el('span', {className: 'toggle-text', textContent: 'Lås op med Face ID eller fingeraftryk'})]));
    }
    children.push(el('div', {className: 'lock-actions'}, [
        el('button', {className: 'btn btn-secondary btn-sm', type: 'button', textContent: 'Skift kode', onclick: setAppLockCode}),
        el('button', {className: 'btn btn-secondary btn-sm', type: 'button', textContent: 'Slå kodelås fra', onclick: removeAppLock})
    ]));
    box.replaceChildren(...children);
}

// Låst fra start (scriptet i <head> har allerede skjult siden), og igen efter 5 minutter væk.
document.getElementById('lockForm').addEventListener('submit', submitLockCode);
document.getElementById('lockPin').addEventListener('animationend', e => e.currentTarget.classList.remove('is-wrong'));
document.getElementById('lockKeypad').addEventListener('click', e => {
    const key = e.target.closest('.lock-key');
    if(!key) return;
    if(key.dataset.digit) pressLockDigit(key.dataset.digit);
    else if(key.dataset.action === 'delete') deleteLockDigit();
});
// På en computer kan koden også skrives: cifre, Backspace og (ved en ældre kode) Enter.
document.addEventListener('keydown', e => {
    if(!document.documentElement.classList.contains('is-locked') || document.querySelector('dialog[open]')) return;
    if(e.ctrlKey || e.metaKey || e.altKey) return;
    if(/^[0-9]$/.test(e.key)){ e.preventDefault(); pressLockDigit(e.key); }
    else if(e.key === 'Backspace'){ e.preventDefault(); deleteLockDigit(); }
    else if(e.key === 'Enter' && !e.target.closest?.('button')){ e.preventDefault(); submitLockCode(); }
});
document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden'){ lockHiddenAt = Date.now(); return; }
    if(lockHiddenAt !== null && Date.now() - lockHiddenAt > RELOCK_AFTER_MS) lockApp();
    lockHiddenAt = null;
});
if(readAppLock()) lockApp();
renderLockSettings();
