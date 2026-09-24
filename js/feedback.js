/**
 * @file Feedback: en lille knap under tandhjulet åbner en formular, hvor man kan
 * skrive en idé, en fejl eller andet. Beskeden sendes til en formulartjeneste
 * (Formspree), som videresender den på mail og samler dem i en oversigt.
 * Kun det, brugeren selv skriver, sendes - aldrig budget, formue eller andre tal.
 *
 * Opsætning: opret en gratis formular på formspree.io og sæt dens adresse
 * (https://formspree.io/f/xxxxxxxx) ind i endpoint herunder. Er den tom, er
 * knappen skjult.
 */

const FEEDBACK = {
    endpoint: 'https://formspree.io/f/xppwljwj'
};

const FEEDBACK_KINDS = ['Idé eller ønske', 'Fejl', 'Andet'];

/** Viser knappen, når der er en adresse at sende til. */
function updateFeedbackButton(){
    document.getElementById('feedbackBtn').hidden = !FEEDBACK.endpoint;
}

/** Fanen og værktøjet, man står i, fx "Bolig & lån / Køb eller leje?" - så en fejlmelding siger, hvor den skete. */
function currentToolName(){
    const sectionBtn = document.querySelector('.top-tab-btn.active');
    const section = sectionBtn && document.getElementById('section-' + sectionBtn.dataset.section);
    const toolBtn = section?.querySelector('.tab-btn.active');
    return [sectionBtn?.textContent, toolBtn?.textContent].filter(Boolean).map(t => t.trim()).join(' / ');
}

function openFeedbackDialog(){
    const kind = el('select', {className:'number-input'}, FEEDBACK_KINDS.map(k => el('option', {value:k, textContent:k})));
    const message = el('textarea', {className:'number-input feedback-message', rows:6, maxLength:4000,
        placeholder:'Hvad kunne gøre siden bedre? Er noget gået galt, så skriv gerne, hvad du gjorde.'});
    const email = el('input', {type:'email', className:'number-input', autocomplete:'email', placeholder:'navn@eksempel.dk'});
    // Honeypot: usynligt felt, som kun spam-robotter udfylder. Formspree afviser dem.
    const trap = el('input', {type:'text', name:'_gotcha', tabIndex:-1, autocomplete:'off', className:'visually-hidden', attrs:{'aria-hidden':'true'}});
    const error = el('div', {className:'field-error', attrs:{role:'alert'}});
    message.addEventListener('input', () => { error.textContent = ''; message.removeAttribute('aria-invalid'); });

    let sending = false;
    const handle = openDialog({
        title:'Giv feedback',
        content: el('div', {}, [
            el('p', {className:'dialog-hint', textContent:'Ris, ros og idéer læses alle sammen. Kun det, du skriver her, sendes – ingen af dine tal.'}),
            fieldEl('Hvad handler det om?', kind),
            fieldEl('Din besked', message),
            fieldEl('Din e-mail (valgfri – hvis du vil have svar)', email, [error]),
            trap
        ]),
        actions:[
            {label:'Annullér', variant:'secondary'},
            {label:'Send', variant:'primary', onClick: () => {
                if(sending) return false;
                const text = message.value.trim();
                if(text.length < 3){
                    error.textContent = 'Skriv lidt om, hvad du tænker.';
                    message.setAttribute('aria-invalid', 'true');
                    message.focus();
                    return false;
                }
                if(email.value && !email.checkValidity()){
                    error.textContent = 'E-mailadressen ser ikke rigtig ud – ret den, eller lad feltet stå tomt.';
                    email.focus();
                    return false;
                }
                sending = true;
                const button = handle.dialog.querySelector('.dialog-footer .btn-primary');
                button.disabled = true;
                button.textContent = 'Sender …';
                sendFeedback({kind: kind.value, message: text, email: email.value.trim(), tool: currentToolName(), _gotcha: trap.value})
                    .then(() => {
                        handle.close();
                        notify('Tak for din feedback!');
                    })
                    .catch(() => {
                        sending = false;
                        button.disabled = false;
                        button.textContent = 'Send';
                        error.textContent = 'Beskeden kunne ikke sendes. Tjek din internetforbindelse og prøv igen – din tekst er ikke gået tabt.';
                    });
                return false;
            }}
        ]
    });
    message.focus();
}

/**
 * @param {{kind:string, message:string, email:string, tool:string, _gotcha:string}} data
 * @returns {Promise<void>} afvises, hvis tjenesten ikke svarer OK
 */
async function sendFeedback(data){
    const body = {
        'Type': data.kind,
        'Besked': data.message,
        'Værktøj': data.tool || '–',
        _subject: `Feedback: ${data.kind}`,
        _gotcha: data._gotcha
    };
    if(data.email){ body.email = data.email; body._replyto = data.email; }
    const response = await fetch(FEEDBACK.endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json', 'Accept':'application/json'},
        body: JSON.stringify(body)
    });
    if(!response.ok) throw new Error('Feedback: ' + response.status);
}

updateFeedbackButton();
