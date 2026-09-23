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

/** @returns {string} dagens dato som 'YYYY-MM-DD' i lokal tid */
function todayIso(){
    const d = new Date();
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
 * Åbner en dialog. Indholdet kan være en node eller en tekst. Hver knap i
 * `actions` lukker dialogen og opfylder løftet med sin `value`, medmindre dens
 * onClick returnerer false (bruges til validering).
 * @param {{title:string, content?:Node|string, actions?:{label:string, variant?:'primary'|'secondary'|'danger', value?:any, onClick?:() => boolean|void}[], wide?:boolean, onClose?:() => void}} opts
 * @returns {{dialog:HTMLDialogElement, close:(value?:any) => void, result:Promise<any>}}
 */
function openDialog({title, content, actions = [], wide = false, onClose}){
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
    return openDialog({title, content: message, actions: [{label:'OK', variant:'primary'}]}).result.then(() => {});
}

let toastRegion = null;

/**
 * Kort besked nederst på skærmen, fx "Datapunkt gemt". Kan have en knap som
 * "Fortryd". Meddeles også til skærmlæsere.
 * @param {string} message
 * @param {{actionLabel?:string, onAction?:() => void, duration?:number}} [opts]
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
    toastRegion.append(toast);
    setTimeout(dismiss, duration);
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
