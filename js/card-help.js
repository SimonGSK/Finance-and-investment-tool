/**
 * @file Forklaringer bag et lille "?" i kortets øverste højre hjørne, så kortene kun viser
 * tallene. Tekster i HTML'en med data-card-help (en undertekst, en "Hvorfor …?"-fold eller en
 * hjælpetekst) flyttes ind i en skjult boks øverst i kortet; "?" viser og skjuler den - som "?"
 * ved felterne (field-help.js): Esc, et klik udenfor eller et andet "?" lukker den.
 *
 * Kort, der i sig selv er en forklaring (fx "Om 4%-reglen" og "Regler og antagelser"), har
 * ingen data-card-help og står, som de er.
 */

/**
 * Samler kortets forklaringer bag et "?".
 * @param {HTMLElement} panel et .panel med mindst én [data-card-help]
 */
function attachCardHelp(panel){
    const parts = [...panel.querySelectorAll('[data-card-help]')].filter(node => node.closest('.panel') === panel);
    if(!parts.length) return;
    const titleEl = panel.querySelector('.panel-title, .eyebrow');
    const title = titleEl ? titleEl.textContent.replace(/\s+–\s+\d{4}$/, '').trim() : 'kortet';
    const pop = el('div', {className: 'help-pop card-help-pop', id: 'card-help-' + Math.random().toString(36).slice(2), hidden: true, attrs: {role: 'note'}});
    parts.forEach(part => {
        if(part.tagName === 'DETAILS'){
            // En fold ("Hvorfor 3–6 måneder?"): overskriften og indholdet, uden selve folden.
            const summary = part.querySelector(':scope > summary');
            pop.append(el('p', {className: 'card-help-head', textContent: summary.textContent.trim()}),
                ...[...part.childNodes].filter(n => n !== summary));
            part.remove();
        } else {
            part.removeAttribute('style');
            pop.append(part);
        }
    });

    const btn = el('button', {className: 'help-tip card-help-btn', type: 'button', textContent: '?',
        attrs: {'aria-label': `Forklaring: ${title}`, 'aria-expanded': 'false', 'aria-controls': pop.id},
        onclick: e => {
            e.preventDefault();
            e.stopPropagation();
            const wasOpen = openHelpButton === btn;
            closeFieldHelp();
            if(wasOpen) return;
            pop.hidden = false;
            btn.setAttribute('aria-expanded', 'true');
            openHelpButton = btn;
        }});
    // Boksen står lige under kortets overskrift; "?" i hjørnet.
    const head = panel.querySelector(':scope > .eyebrow, :scope > .panel-title-row');
    if(head) head.insertAdjacentElement('afterend', pop);
    else panel.prepend(pop);
    panel.prepend(btn);
    panel.classList.add('has-card-help');
}

document.querySelectorAll('.panel').forEach(attachCardHelp);
