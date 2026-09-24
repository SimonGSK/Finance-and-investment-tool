/**
 * @file Talfelter, man kan regne i: skriv fx "12.500 + 3.200" eller "450 * 12",
 * og feltet viser "= 15.700" mens du skriver og sætter resultatet ind, når du
 * trykker Enter eller forlader feltet. Danske tal ("1.000", "2,5") forstås også.
 *
 * Et <input type="number"> kan ikke rumme "100 + 200", så alle talfelter laves
 * om til tekstfelter med data-number. Værdien i feltet er altid et almindeligt
 * tal med punktum som decimaltegn, så resten af koden bare kan bruge parseFloat.
 * Så længe der står et regnestykke eller et dansk tal, holdes 'input'-events
 * tilbage, så beregningerne ikke regner med et halvt skrevet tal.
 * Pil op/ned tæller stadig op og ned i feltets step, ligesom før.
 * Selve regningen ligger i calc.js (parseAmount).
 */

/** Gør et <input type="number"> til et tekstfelt, man kan regne i. */
function enhanceNumberInput(input){
    if(input.type !== 'number') return;
    input.type = 'text';
    input.dataset.number = '';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.spellcheck = false;
}

document.querySelectorAll('input[type=number]').forEach(enhanceNumberInput);
// Felter i dialoger, budgetposter og lån bygges løbende.
new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(node => {
    if(node.nodeType !== 1) return;
    if(node.matches('input[type=number]')) enhanceNumberInput(node);
    node.querySelectorAll('input[type=number]').forEach(enhanceNumberInput);
}))).observe(document.body, {childList:true, subtree:true});

/** Er teksten et almindeligt tal, som parseFloat læser rigtigt? */
function isPlainNumber(text){
    return /^-?\d+(\.\d+)?$/.test(text.trim()) && parseAmount(text) === parseFloat(text);
}

/** Et tal skrevet som feltets værdi: højst to decimaler, punktum som decimaltegn. */
function toFieldValue(n){
    return String(Math.round(n * 100) / 100);
}

/** Viser (eller fjerner) "= 15.700" under feltet, mens der står et regnestykke. */
function showCalcHint(input, text){
    let hint = [input.nextElementSibling, input.nextElementSibling?.nextElementSibling]
        .find(n => n?.classList.contains('calc-hint'));
    if(text === null){ hint?.remove(); return; }
    if(!hint){
        hint = el('div', {className:'calc-hint', attrs:{'aria-live':'polite'}});
        input.insertAdjacentElement('afterend', hint);
    }
    hint.textContent = text;
}

/**
 * Regner feltets indhold ud og skriver resultatet ind. Kan det ikke regnes
 * ud, bliver teksten stående med en besked, og beregningerne bruger det
 * seneste gyldige tal.
 * @returns {boolean} true hvis feltet nu indeholder et tal (eller er tomt)
 */
function commitNumberInput(input){
    const text = input.value;
    showCalcHint(input, null);
    if(text.trim() === '' || isPlainNumber(text)) return true;
    const v = parseAmount(text);
    if(v === null){
        showRangeHint(input);
        return false;
    }
    input.value = toFieldValue(v);
    input.dispatchEvent(new Event('input', {bubbles:true}));
    return true;
}

// Capture-fasen på document kører før feltets egne lyttere, så et halvt skrevet
// regnestykke når aldrig ud til beregningerne.
document.addEventListener('input', e => {
    const input = e.target;
    if(!input.matches?.('input[data-number]')) return;
    const text = input.value;
    if(text.trim() === '' || isPlainNumber(text)){
        showCalcHint(input, null);
        return;
    }
    e.stopImmediatePropagation();
    const v = parseAmount(text);
    showCalcHint(input, v === null ? '' : '= ' + DK.format(v).replace(/^-/, '−'));
    // En gammel "skal være mellem"-besked passer ikke længere til teksten.
    const range = input.parentElement?.querySelector(':scope > .range-hint');
    if(range){ range.remove(); input.removeAttribute('aria-invalid'); }
}, true);

document.addEventListener('change', e => {
    if(e.target.matches?.('input[data-number]')) commitNumberInput(e.target);
}, true);

document.addEventListener('keydown', e => {
    const input = e.target;
    if(!input.matches?.('input[data-number]') || e.altKey || e.ctrlKey || e.metaKey) return;
    if(e.key === 'Enter'){ commitNumberInput(input); return; }
    if(e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const current = parseAmount(input.value) ?? (parseFloat(input.defaultValue) || 0);
    const step = parseFloat(input.step) || 1;
    // Som et almindeligt talfelt: 950 med step 1000 går op til 1.000, ikke 1.950.
    let next = e.key === 'ArrowUp'
        ? (Math.floor(current / step + 1e-9) + 1) * step
        : (Math.ceil(current / step - 1e-9) - 1) * step;
    if(input.min !== '') next = Math.max(next, parseFloat(input.min));
    if(input.max !== '') next = Math.min(next, parseFloat(input.max));
    showCalcHint(input, null);
    input.value = toFieldValue(next);
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('change', {bubbles:true}));
}, true);
