/**
 * @file Fælles UI-byggeklodser: dialoger (bygget på <dialog>, så Esc lukker og
 * fokus holdes i dialogen), bekræftelser, beskeder og "toasts" med fortryd.
 * Bruges i stedet for browserens alert()/confirm(), så alle advarsler ser ens
 * ud og kan forklare præcis, hvad der sker.
 */

const DANISH_DATE = new Intl.DateTimeFormat('da-DK', {day:'numeric', month:'short', year:'numeric'});

/**
 * '2026-09-21' -> '21. sep. 2026'. Ugyldige datoer returneres uændret.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDanishDate(isoDate){
    const d = new Date(isoDate + 'T00:00:00');
    return isNaN(d) ? isoDate : DANISH_DATE.format(d);
}

/**
 * @param {Date} [d] udeladt = nu
 * @returns {string} datoen som 'YYYY-MM-DD' i lokal tid (ikke UTC, som toISOString ville give)
 */
function todayIso(d = new Date()){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * Lille hjælper til at bygge DOM uden at sætte brugerens tekst ind som HTML.
 * @param {string} tag
 * @param {Object} [props] egenskaber (className, textContent, value, onclick ...) og 'attrs' til attributter
 * @param {(Node|string)[]} [children]
 * @returns {HTMLElement}
 */
function el(tag, props = {}, children = []){
    const node = document.createElement(tag);
    const {attrs, ...rest} = props;
    Object.assign(node, rest);
    if(attrs) Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    children.forEach(c => node.append(c));
    return node;
}

/**
 * Et .field med en label, der er koblet til feltet (for/id), så et klik på
 * teksten fokuserer feltet, og skærmlæsere kan læse, hvad feltet er.
 * @param {string} labelText
 * @param {HTMLElement} control input eller select
 * @param {Node[]} [extra] fx en fejlbesked under feltet
 * @param {string} [className] ekstra klasse på .field
 * @returns {HTMLElement}
 */
function fieldEl(labelText, control, extra = [], className = ''){
    if(!control.id) control.id = 'f-' + Math.random().toString(36).slice(2);
    return el('div', {className: 'field' + (className ? ' ' + className : '')},
        [el('label', {textContent: labelText, htmlFor: control.id}), control, ...extra]);
}

/**
 * Åbner en dialog. Indholdet kan være en node eller en tekst. Hver knap i
 * `actions` lukker dialogen og opfylder løftet med sin `value`, medmindre dens
 * onClick returnerer false (bruges til validering).
 * @param {{title:string, content?:Node|string, actions?:{label:string, variant?:'primary'|'secondary'|'danger', value?:any, onClick?:() => boolean|void}[], wide?:boolean, onClose?:() => void, enterSubmits?:boolean}} opts
 *   enterSubmits: false i lange skemaer, hvor Enter i et felt ikke må gemme det hele
 * @returns {{dialog:HTMLDialogElement, close:(value?:any) => void, result:Promise<any>}}
 */
function openDialog({title, content, actions = [], wide = false, onClose, enterSubmits = true}){
    let resolve;
    const result = new Promise(r => { resolve = r; });
    let settled = false;

    const dialog = el('dialog', {className: 'dialog' + (wide ? ' dialog-wide' : '')});
    const close = value => {
        if(settled) return;
        settled = true;
        dialog.close();
        dialog.remove();
        if(onClose) onClose();
        resolve(value);
    };

    const titleId = 'dlg-' + Math.random().toString(36).slice(2);
    dialog.setAttribute('aria-labelledby', titleId);

    const header = el('div', {className:'dialog-header'}, [
        el('h2', {className:'dialog-title', id:titleId, textContent:title}),
        el('button', {className:'dialog-close', type:'button', textContent:'×', onclick: () => close(undefined), attrs:{'aria-label':'Luk'}})
    ]);
    const body = el('div', {className:'dialog-body'});
    if(content instanceof Node) body.append(content);
    else if(content) body.append(el('p', {className:'dialog-text', textContent:content}));

    dialog.append(el('div', {className:'dialog-inner'}, [header, body]));

    if(actions.length){
        const footer = el('div', {className:'dialog-footer'});
        actions.forEach(a => {
            const cls = a.variant === 'primary' ? 'btn btn-primary' : a.variant === 'danger' ? 'btn btn-danger' : 'btn btn-secondary';
            footer.append(el('button', {className:cls, type:'button', textContent:a.label, onclick: () => {
                if(a.onClick && a.onClick() === false) return;
                close(a.value);
            }}));
        });
        dialog.firstChild.append(footer);
    }

    // Esc og klik på baggrunden lukker som "annullér".
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(undefined); });
    // Enter i et felt udfører dialogens hovedhandling, som i en almindelig formular
    // (medmindre dialogen er et langt skema, se enterSubmits).
    dialog.addEventListener('keydown', e => {
        if(e.key !== 'Enter' || !e.target.matches('input:not([type=checkbox]):not([type=radio]), select')) return;
        if(!enterSubmits){ e.preventDefault(); return; }
        const primary = dialog.querySelector('.dialog-footer .btn-primary');
        if(primary){ e.preventDefault(); primary.click(); }
    });
    dialog.addEventListener('click', e => { if(e.target === dialog) close(undefined); });

    document.body.append(dialog);
    dialog.showModal();
    return {dialog, close, result};
}

/**
 * Bekræftelse med to knapper. Beskeden kan være tekst eller en node (fx en
 * liste over hvad der bliver overskrevet).
 * @param {{title:string, message:Node|string, confirmLabel:string, cancelLabel?:string, danger?:boolean}} opts
 * @returns {Promise<boolean>} true hvis brugeren bekræfter
 */
function confirmDialog({title, message, confirmLabel, cancelLabel = 'Annullér', danger = false}){
    return openDialog({
        title, content: message,
        actions: [
            {label: cancelLabel, variant:'secondary', value:false},
            {label: confirmLabel, variant: danger ? 'danger' : 'primary', value:true}
        ]
    }).result.then(v => v === true);
}

/**
 * Besked med én OK-knap - til fejl, der kræver brugerens opmærksomhed.
 * @param {{title:string, message:Node|string}} opts
 * @returns {Promise<void>}
 */
function infoDialog({title, message}){
    return openDialog({title, content: message}).result.then(() => {});
}

/** Åbner hjælp og spørgsmål. Indholdet ligger i <template id="helpContent">. */
function openHelp(){
    const content = document.getElementById('helpContent').content.cloneNode(true);
    fillRuleText(content);
    openDialog({title:'Hjælp og spørgsmål', content: el('div', {}, [content]), wide:true});
}

let toastRegion = null;

/**
 * Kort besked nederst på skærmen, fx "Datapunkt gemt". Kan have en knap som
 * "Fortryd". Meddeles også til skærmlæsere.
 * @param {string} message
 * @param {{actionLabel?:string, onAction?:() => void, duration?:number}} [opts] duration i ms; Infinity = bliver stående med et luk-kryds
 */
function notify(message, {actionLabel, onAction, duration = 5000} = {}){
    if(!toastRegion){
        toastRegion = el('div', {className:'toast-region', attrs:{'aria-live':'polite', 'role':'status'}});
        document.body.append(toastRegion);
    }
    const toast = el('div', {className:'toast'}, [el('span', {textContent: message})]);
    const dismiss = () => { toast.classList.add('toast-leaving'); setTimeout(() => toast.remove(), 200); };
    if(actionLabel && onAction){
        toast.append(el('button', {className:'toast-action', type:'button', textContent: actionLabel, onclick: () => { onAction(); dismiss(); }}));
    }
    // duration: Infinity = bliver stående, til man lukker den med krydset.
    if(duration === Infinity) toast.append(el('button', {className:'toast-close', type:'button', textContent:'×', attrs:{'aria-label':'Luk'}, onclick: dismiss}));
    toastRegion.append(toast);
    if(duration !== Infinity) setTimeout(dismiss, duration);
}

/**
 * Liste over ændringer til en bekræftelse: "Nettoformue: 640.000 kr. → 655.000 kr.".
 * @param {{label:string, from:number, to:number}[]} rows
 * @returns {HTMLElement}
 */
function changeList(rows){
    return el('dl', {className:'change-list'}, rows.flatMap(r => [
        el('dt', {textContent: r.label}),
        el('dd', {}, [
            el('span', {className:'change-from', textContent: DK.format(r.from) + ' kr.'}),
            ' → ',
            el('span', {className:'change-to', textContent: DK.format(r.to) + ' kr.'})
        ])
    ]));
}

/**
 * Advarer før et eksisterende datapunkt overskrives og viser præcis hvilke tal,
 * der ændres. Er der ingen forskelle, spørges der ikke.
 * @param {string} isoDate
 * @param {{title:string, changes:{label:string, from:number, to:number}[]}[]} sections én pr. tracker
 * @returns {Promise<boolean>} true hvis der må gemmes
 */
function confirmOverwrite(isoDate, sections){
    const withChanges = sections.filter(s => s.changes.length);
    if(!withChanges.length) return Promise.resolve(true);
    const content = el('div', {}, [
        el('p', {className:'dialog-text', textContent:`Der findes allerede data for ${formatDanishDate(isoDate)}. Gemmer du, bliver de erstattet af de nye tal:`}),
        ...withChanges.flatMap(s => [
            withChanges.length > 1 || sections.length > 1 ? el('div', {className:'eyebrow eyebrow-section', textContent:s.title}) : '',
            changeList(s.changes)
        ])
    ]);
    return confirmDialog({title:'Overskriv eksisterende data?', message:content, confirmLabel:'Erstat data', danger:true});
}

/**
 * Bekræftelse før en CSV-import erstatter punkter, der allerede findes.
 * @param {string[]} replacedDates ISO-datoer, der bliver erstattet
 * @param {number} totalCount antal punkter i filen
 * @returns {Promise<boolean>}
 */
function confirmImportOverwrite(replacedDates, totalCount){
    const shown = replacedDates.slice(0, 6).map(formatDanishDate).join(', ');
    const more = replacedDates.length > 6 ? ` og ${replacedDates.length - 6} mere` : '';
    return confirmDialog({
        title:'Erstat eksisterende datapunkter?',
        message:`${replacedDates.length} af filens ${totalCount} datapunkter har en dato, du allerede har data for (${shown}${more}). De eksisterende tal for de datoer bliver erstattet af filens.`,
        confirmLabel:'Importér og erstat', danger:true
    });
}

/**
 * Kort opsummering efter en import, fx "12 datapunkter importeret (3 erstattet, 1 sprunget over)".
 * @param {number} added
 * @param {number} replaced
 * @param {number} skipped rækker uden gyldig dato
 * @returns {string}
 */
function importSummary(added, replaced, skipped){
    const total = added + replaced;
    const parts = [];
    if(replaced) parts.push(`${replaced} erstattet`);
    if(skipped) parts.push(`${skipped} sprunget over pga. ugyldig dato`);
    return `${total} ${total === 1 ? 'datapunkt' : 'datapunkter'} importeret` + (parts.length ? ` (${parts.join(', ')})` : '') + '.';
}

// ---- Talfelter: grænser og tomme felter ----

/**
 * Viser en besked under et talfelt, der er uden for sine min/max-grænser eller
 * ikke kan regnes ud, og fjerner den igen, når feltet er i orden. Beregningen
 * bruger stadig tallet - beskeden gør bare opmærksom på det.
 * @param {HTMLInputElement} input et felt med data-number (se number-fields.js)
 */
function showRangeHint(input){
    const text = input.value.trim();
    const value = parseFloat(text);
    let message = '';
    if(text !== '' && !/^-?\d+(\.\d+)?$/.test(text)) message = 'Kunne ikke regne det ud. Skriv et tal eller fx 1.200 + 350.';
    else if(text !== ''){
        const min = input.min !== '' ? parseFloat(input.min) : -Infinity;
        const max = input.max !== '' ? parseFloat(input.max) : Infinity;
        const fmt = x => DK.format(x).replace(/^-/, '−');
        if(value < min || value > max){
            message = isFinite(min) && isFinite(max)
                ? `Skal være mellem ${fmt(min)} og ${fmt(max)}.`
                : value < min ? `Må ikke være under ${fmt(min)}.` : `Må ikke være over ${fmt(max)}.`;
        }
    }
    let hint = input.nextElementSibling?.classList.contains('range-hint') ? input.nextElementSibling : null;
    if(!message){
        hint?.remove();
        input.removeAttribute('aria-invalid');
        return;
    }
    if(!hint){
        hint = el('div', {className:'field-error range-hint', id: (input.id || 'n' + Math.random().toString(36).slice(2)) + '-hint', attrs:{role:'alert'}});
        input.insertAdjacentElement('afterend', hint);
        input.setAttribute('aria-describedby', hint.id);
    }
    hint.textContent = message;
    input.setAttribute('aria-invalid', 'true');
}

document.addEventListener('input', e => {
    if(e.target.matches('input[data-number]')) showRangeHint(e.target);
});

// Et felt, der efterlades tomt, sættes tilbage til sin standardværdi i stedet
// for stille at tælle som 0. Felter uden standardværdi (fx nye budgetposter) røres ikke.
document.addEventListener('change', e => {
    const input = e.target;
    if(!input.matches('input[data-number]') || input.value.trim() !== '' || input.defaultValue === '') return;
    input.value = input.defaultValue;
    showRangeHint(input);
    input.dispatchEvent(new Event('input', {bubbles:true}));
    notify(`Feltet var tomt og er sat tilbage til ${DK.format(parseFloat(input.defaultValue))}.`);
});

/**
 * Viser "Gemt kl. 14.32" i en statuslinje, efter brugeren har ændret noget,
 * der gemmes automatisk.
 * @param {string} id statuslinjens id
 */
function markSaved(id){
    const node = document.getElementById(id);
    if(!node) return;
    const time = new Date().toLocaleTimeString('da-DK', {hour:'2-digit', minute:'2-digit'});
    node.textContent = `✓ Gemt i denne browser kl. ${time}`;
    node.classList.add('is-saved');
}

/**
 * Retter ét datapunkt i en historik (Formue eller porteføljetrackeren): dato
 * og tal i en dialog. Flyttes datoen til en dato, der allerede har data, vises
 * præcis hvad der overskrives først. Rettelsen kan fortrydes.
 * @param {object} p
 * @param {string} p.date datapunktets nuværende dato
 * @param {string} p.title fx 'Formue' - bruges i overskrifter og beskeder
 * @param {() => Object[]} p.read
 * @param {(history:Object[]) => void} p.write
 * @param {() => void} p.render
 * @param {[string, string][]} p.inputs de felter, der kan rettes: [nøgle, etiket]
 * @param {(date:string, values:Object<string, number>) => Object} p.build bygger datapunktet
 * @param {[string, string][]} p.fields felterne, der vises i en overskrivnings-advarsel
 * @param {boolean} [p.withNote] datapunktet kan have en note (formuehistorikken)
 */
function editHistoryEntry({date, title, read, write, render, inputs, build, fields, withNote = false}){
    const entry = read().find(h => h.date === date);
    if(!entry) return;
    const dateInput = el('input', {type:'date', className:'number-input', value: date});
    const noteInput = withNote ? el('input', {type:'text', className:'number-input note-input', value: entry.note || '', maxLength: NOTE_MAX_LENGTH, autocomplete:'off', placeholder:'Fx bonus, købte bil, flyttede'}) : null;
    const numberInputs = inputs.map(([key]) => el('input', {type:'number', className:'number-input', value: entry[key] || 0, step: 100}));
    const error = el('div', {className:'field-error', attrs:{role:'alert'}});
    dateInput.addEventListener('input', () => { error.textContent = ''; dateInput.removeAttribute('aria-invalid'); });

    const save = () => {
        const newDate = normalizeDate(dateInput.value);
        if(!newDate){
            error.textContent = 'Vælg en gyldig dato.';
            dateInput.setAttribute('aria-invalid', 'true');
            dateInput.focus();
            return false;
        }
        const values = Object.fromEntries(inputs.map(([key], i) => [key, parseFloat(numberInputs[i].value) || 0]));
        const updated = build(newDate, values);
        const note = noteInput ? cleanNote(noteInput.value) : '';
        if(note) updated.note = note;
        const previous = read();
        const others = previous.filter(h => h.date !== date);
        const clash = newDate !== date ? others.find(h => h.date === newDate) : null;
        const commit = () => {
            write(upsertByDate(others, updated).history);
            render();
            notify(`${title} for ${formatDanishDate(newDate)} er rettet.`, {actionLabel:'Fortryd', onAction: () => { write(previous); render(); }});
        };
        if(!clash){ commit(); return; }
        confirmOverwrite(newDate, [{title, changes: changedFields(clash, updated, fields)}]).then(ok => {
            if(ok){ commit(); handle.close(); }
        });
        return false;
    };

    const handle = openDialog({
        title: `Ret ${title.toLowerCase()} for ${formatDanishDate(date)}`,
        content: el('div', {}, [
            fieldEl('Dato', dateInput),
            ...inputs.map(([, label], i) => fieldEl(label, numberInputs[i])),
            ...(noteInput ? [fieldEl('Note (valgfri)', noteInput)] : []),
            error
        ]),
        actions: [{label:'Annullér', variant:'secondary'}, {label:'Gem ændringer', variant:'primary', onClick: save}]
    });
    numberInputs[0]?.focus();
}

// ---- Ændringer og bedste perioder (Formue og porteføljen) ----

/** "+20.000 kr." / "−10.000 kr." */
function formatSignedKr(n){
    const r = Math.round(n);
    return (r > 0 ? '+' : r < 0 ? '−' : '') + DK.format(Math.abs(r)) + ' kr.';
}

/**
 * En tabelcelle med ændringen siden forrige datapunkt, farvet op/ned.
 * @param {{change:number, gain:number, pct:number|null}|undefined} c
 * @param {'change'|'gain'} field
 * @returns {string} HTML
 */
function changeCellHtml(c, field = 'change'){
    if(!c) return '<td class="change-cell">–</td>';
    const v = c[field];
    const pct = field === 'gain' && c.pct !== null ? ` <span class="change-pct">(${c.pct >= 0 ? '+' : '−'}${formatPct(Math.abs(c.pct))})</span>` : '';
    return `<td class="change-cell ${v > 0 ? 'is-up' : v < 0 ? 'is-down' : ''}" data-csv="${Math.round(v)}">${formatSignedKr(v)}${pct}</td>`;
}

/**
 * Tegner top-listen over de bedste perioder.
 * @param {string} id listens id (<ol>)
 * @param {ReturnType<typeof bestPeriods>} best
 * @param {string} emptyText vises, når der endnu ikke er perioder med stigning
 */
function renderBestPeriods(id, best, emptyText){
    const list = document.getElementById(id);
    if(!list) return;
    if(!best.length){
        list.replaceChildren(el('li', {className:'empty-note', textContent: emptyText}));
        return;
    }
    list.replaceChildren(...best.map(b => {
        // Perioder, der ikke er ca. en måned, får længden med - tre måneder stiger naturligt mere end én.
        const months = Math.round(b.days / 30.4);
        const length = b.days > 45 ? ` · ${formatDuration(months)}` : b.days < 20 ? ` · ${b.days} dage` : '';
        return el('li', {className:'best-period'}, [
            el('span', {className:'best-period-when', textContent: `${formatDanishDate(b.from)} → ${formatDanishDate(b.to)}${length}`}),
            el('span', {className:'best-period-value'}, [
                formatSignedKr(b.gain),
                b.pct !== null ? el('span', {className:'change-pct', textContent:` (+${formatPct(b.pct)})`}) : ''
            ])
        ]);
    }));
}

/** "sep. 2026" */
function formatMonthYear(isoOrMs){
    const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs + 'T00:00:00');
    return d.toLocaleDateString('da-DK', {month:'short', year:'numeric'});
}

/**
 * Tegner en år-for-år-tabel (se yearSummary i calc.js).
 * @param {string} tbodyId
 * @param {ReturnType<typeof yearSummary>} years
 * @param {boolean} withFlows portefølje: vis indskud og afkast; formue: kun ændringen
 * @param {string} emptyText
 */
function renderYearSummary(tbodyId, years, withFlows, emptyText){
    const tbody = document.getElementById(tbodyId);
    if(!tbody) return;
    const cols = withFlows ? 6 : 5;
    if(!years.length){
        tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-cell">${emptyText}</td></tr>`;
        return;
    }
    const thisYear = new Date().getFullYear();
    const short = iso => new Date(iso + 'T00:00:00').toLocaleDateString('da-DK', {day:'numeric', month:'short'});
    const pct = y => y.pct === null ? '–' : `${y.pct >= 0 ? '+' : '−'}${formatPct(Math.abs(y.pct))}`;
    const cls = v => v > 0 ? 'is-up' : v < 0 ? 'is-down' : '';
    tbody.innerHTML = years.map(y => {
        // Delvise år siges højt: "2026 (til nu)", "2025 (fra 31. jul.)".
        const note = y.year === thisYear ? ' (til nu)' : !y.fromPreviousYear ? ` (fra ${short(y.startDate)})` : '';
        const cells = [
            `<td data-csv="${y.year}">${y.year}<span class="year-note">${note}</span></td>`,
            `<td>${DK.format(y.start)} kr.</td>`,
            `<td>${DK.format(y.end)} kr.</td>`
        ];
        if(withFlows){
            cells.push(`<td>${formatSignedKr(y.flows)}</td>`, `<td class="change-cell ${cls(y.gain)}">${formatSignedKr(y.gain)}</td>`);
        } else {
            cells.push(`<td class="change-cell ${cls(y.change)}">${formatSignedKr(y.change)}</td>`);
        }
        cells.push(`<td class="change-cell ${cls(y.gain)}">${pct(y)}</td>`);
        return `<tr>${cells.join('')}</tr>`;
    }).join('');
}

// ---- Paneler, der kan foldes sammen til kun deres overskrift ----

/**
 * Folder et panel (.collapsible) sammen eller ud. Valget huskes pr. panel.
 * @param {HTMLButtonElement} btn panelets .panel-toggle
 * @param {boolean} [open] tving åben/lukket
 */
function togglePanel(btn, open){
    const panel = btn.closest('.collapsible');
    const show = open ?? btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(show));
    panel.classList.toggle('is-collapsed', !show);
    try{ localStorage.setItem('collapsed:' + panel.id, show ? '0' : '1'); } catch(e){ /* kun en bekvemmelighed */ }
}

document.querySelectorAll('.collapsible').forEach(panel => {
    let collapsed = false;
    try{ collapsed = localStorage.getItem('collapsed:' + panel.id) === '1'; } catch(e){ /* åben */ }
    if(collapsed) togglePanel(panel.querySelector('.panel-toggle'), false);
});

/**
 * Tabeller, der kan rulle (.data-table-wrap), kan nås med tastaturet: de får tabindex, så man
 * kan rulle dem med piletasterne, og et navn, så en skærmlæser siger, hvilken tabel det er.
 * @param {ParentNode} [root] fx en dialog, der lige er bygget
 */
function makeTablesKeyboardScrollable(root = document){
    root.querySelectorAll('.data-table-wrap:not([tabindex])').forEach(wrap => {
        wrap.tabIndex = 0;
        wrap.setAttribute('role', 'region');
        const name = wrap.closest('.panel, .dialog')?.querySelector('.eyebrow, .panel-title, .dialog-title')?.textContent.trim();
        wrap.setAttribute('aria-label', name ? `Tabel: ${name}` : 'Tabel');
    });
}
makeTablesKeyboardScrollable();
