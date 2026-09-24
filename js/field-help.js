/**
 * @file Små "?"-knapper ved felternes navne. Et klik viser en kort forklaring
 * under feltet; Esc, et klik udenfor eller et klik på en anden "?" lukker den.
 * Knappen sidder ved siden af labelen (ikke inde i den), så feltets navn for
 * skærmlæsere forbliver rent.
 */

const RETURN_HELP = 'Hvor meget investeringerne i gennemsnit forventes at stige om året. Globale aktier har historisk givet omkring 7-8 % om året før skat, men med store udsving – brug gerne et forsigtigt tal.';
const INFLATION_HELP = 'Hvor meget priserne forventes at stige om året. Bruges til at vise beløbene i dagens købekraft. Centralbankernes mål er typisk omkring 2 % om året.';
const YEARS_HELP = 'Hvor mange år pengene skal stå investeret.';
const REAL_VALUE_HELP = 'Viser alle beløb i dagens penge, så de kan sammenlignes med det, tingene koster i dag. 1 mio. kr. om 30 år er mindre værd end 1 mio. kr. i dag.';
const RK_RATE_HELP = 'Den årlige rente på realkreditlånet. Se aktuelle renter hos dit realkreditinstitut – fast rente er typisk lidt højere end variabel.';
const BIDRAG_HELP = 'Et årligt gebyr til realkreditinstituttet, beregnet af restgælden. Typisk 0,5-1,2 % – højere, jo mere du låner, og hvis lånet er afdragsfrit.';
const RK_YEARS_HELP = 'Hvor mange år realkreditlånet løber. Højst 30 år.';
const BANK_RATE_HELP = `Renten på det banklån, der dækker delen af købet ud over realkreditlånet (op til ${pctNumber(1 - MAX_REALKREDIT - MIN_UDBETALING)} % af prisen). Den er typisk højere end realkreditrenten.`;
const BANK_YEARS_HELP = 'Hvor mange år banklånet løber. Ofte 10-20 år.';
const OTHER_COSTS_HELP = 'Engangsudgifter ved købet ud over tinglysning, som regnes automatisk: fx køberrådgiver, tilstandsrapport og lånesagsgebyrer.';
const ADULTS_HELP = `Rentefradraget er ca. ${pctNumber(RENTEFRADRAG.lowRate)} % op til ${DK.format(RENTEFRADRAG.thresholdPerAdult)} kr. i renter pr. voksen og ca. ${pctNumber(RENTEFRADRAG.highRate)} % derover, så det betyder noget, om I er én eller to om lånet.`;

const FIELD_HELP = {
    // ASK vs. aktiedepot
    startCashNumber: 'Beløbet du sætter ind fra start. En aktiesparekonto har et loft for, hvor meget du må indskyde i alt.',
    yearsNumber: YEARS_HELP,
    yearlyReturnNumber: RETURN_HELP,
    inflationNumber: INFLATION_HELP,
    payTaxExternally: 'På en aktiesparekonto trækkes skatten normalt fra kontoen hvert år. Slår du dette til, betaler du den med andre penge, så kontoen vokser uberørt – og for at sammenligne fair, indsættes samme beløb på aktiedepotet.',
    showRealValue: REAL_VALUE_HELP,
    doubleDeduction: `Gifte deler grænsen for ${pctNumber(AKT_TAX_LOW)} %-skat: ${DK.format(TAX_LIMIT_27 * 2)} kr. tilsammen, og den del, din ægtefælle ikke selv bruger, overføres automatisk til dig. Din ægtefælle må gerne investere – det afgørende er, at ægtefællens egen aktieindkomst (gevinster og udbytter) ikke bruger af grænsen. Bruger ægtefællen noget af den, har du kun resten.`,
    // Aktiedepot: fast + månedligt
    startCash2Number: 'Beløbet du investerer fra start. Kan være 0, hvis du kun sparer op hver måned.',
    monthlyAmount2Number: 'Det faste beløb, du investerer hver måned.',
    years2Number: YEARS_HELP,
    yearlyReturn2Number: RETURN_HELP,
    inflation2Number: INFLATION_HELP,
    showRealValue2: REAL_VALUE_HELP,
    // FIRE
    expenses3Number: 'Det, du regner med at bruge om året, når du ikke længere arbejder – i dagens priser. Efter 4 %-reglen skal formuen være 25 gange dette beløb.',
    startCash3Number: 'Det, du allerede har investeret.',
    monthlyAmount3Number: 'Det, du investerer hver måned fremover.',
    yearlyReturn3Number: RETURN_HELP,
    inflation3Number: 'Hvor meget priserne forventes at stige om året. Dit FIRE-mål vokser med inflationen, så det stadig dækker det samme forbrug.',
    showRealValue3: REAL_VALUE_HELP,
    // Porteføljetracker
    ptDate: 'Datoen tallene gælder for – fx den sidste dag i måneden.',
    ptPortfolioValue: 'Aktieværdi og kontanter i depotet lagt sammen. Udregnes selv.',
    ptStockValue: 'Markedsværdien af dine aktier og fonde i depotet på datoen, uden kontanter.',
    ptCash: 'De kontanter, der står i selve aktiedepotet og endnu ikke er investeret.',
    ptTraded: 'Hvor meget du har købt for i perioden siden sidste datapunkt. Har du solgt mere, end du har købt, skrives et negativt tal.',
    ptDeposit: 'Penge du har sat ind på eller taget ud af depotet i perioden. Udbetalinger skrives som negative tal. Bruges til at beregne dit faktiske afkast.',
    ptDividend: 'Udbytte, der er udbetalt til depotet i perioden, efter udbytteskat.',
    // Pension
    penBirthYear: 'Bruges til at finde din alder og din folkepensionsalder.',
    penRetirementAge: 'Alderen, hvor udbetalingen af din private pension begynder. Du kan tidligst få den udbetalt nogle år før folkepensionsalderen.',
    penSavings: 'Det, du allerede har stående på dine pensionsordninger (rate, livrente, aldersopsparing). Se det samlet på pensionsinfo.dk.',
    penMonthly: 'Det, der hver måned indbetales til din pension – både dit eget og din arbejdsgivers bidrag. Står typisk på lønsedlen.',
    penReturn: 'Forventet afkast før omkostninger og PAL-skat. Afhænger af, hvor meget i aktier din pension er investeret – typisk 4-7 % om året.',
    penCosts: 'Årlige omkostninger i procent af opsparingen (ÅOP). Står hos dit pensionsselskab eller på pensionsinfo.dk. Typisk 0,5-1,5 %.',
    penPayoutYears: 'Hvor mange år opsparingen fordeles over. Ratepension udbetales over 10-30 år; en livrente udbetales resten af livet.',
    penPayoutTax: 'Rate- og livrente beskattes som indkomst, typisk 37-40 %. Aldersopsparing udbetales skattefrit – sæt da 0 %.',
    penInflation: INFLATION_HELP,
    // Hvor meget kan jeg låne?
    lcIncome: 'Den samlede indkomst før skat for alle, der skal stå på lånet.',
    lcSavings: `Det, I har sparet op til købet. Det skal dække mindst ${pctNumber(MIN_UDBETALING)} % udbetaling plus omkostninger ved købet.`,
    lcDebt: 'Gæld I har i forvejen, fx SU-lån, billån og forbrugslån. Den tæller med i gældsfaktoren.',
    lcAdults: ADULTS_HELP,
    lcDebtFactor: `Gældsfaktoren er den samlede gæld delt med indkomsten før skat. Finanstilsynet ser en gældsfaktor over ${HIGH_DEBT_FACTOR} som høj, og mange banker låner sjældent mere ud.`,
    lcMaxPayment: 'Det højeste, I vil betale om måneden på lånene. Lad det stå på 0, hvis I kun vil se, hvad udbetaling og gældsfaktor tillader.',
    lcRkRate: RK_RATE_HELP,
    lcBidrag: BIDRAG_HELP,
    lcRkYears: RK_YEARS_HELP,
    lcBankRate: BANK_RATE_HELP,
    lcBankYears: BANK_YEARS_HELP,
    lcOtherCosts: OTHER_COSTS_HELP,
    // Køb eller leje?
    brPrice: 'Købsprisen på boligen.',
    brDown: `Det, du selv betaler kontant. Mindst ${pctNumber(MIN_UDBETALING)} % af prisen. Resten lånes: op til ${pctNumber(MAX_REALKREDIT)} % i realkredit og resten i banken.`,
    brOwnerCosts: 'Faste månedlige udgifter som boligejer, ud over lån og skat: forsikring, fællesudgifter, grundejerforening.',
    brPropertyTax: 'Ejendomsværdiskat og grundskyld pr. år. Se din forventede boligskat på vurderingsportalen.dk.',
    brMaintenance: 'Vedligehold og reparationer pr. år i procent af boligens værdi. 1 % er en udbredt tommelfingerregel.',
    brPriceGrowth: 'Hvor meget boligens værdi forventes at stige om året. Boligpriserne svinger meget fra år til år og mellem landsdele – vælg et forsigtigt tal.',
    brRent: 'Den månedlige husleje for en tilsvarende lejebolig.',
    brRentGrowth: 'Hvor meget huslejen forventes at stige om året.',
    brDeposit: 'Depositum i antal måneders husleje. Højst 3 måneder. Du får det tilbage, når du flytter.',
    brReturn: 'Afkastet efter skat på de penge, der investeres i stedet for at gå til boligen.',
    brYears: 'Hvor mange år sammenligningen skal gå over – fx hvor længe du regner med at bo der.',
    brAdults: ADULTS_HELP,
    brRkRate: RK_RATE_HELP,
    brBidrag: BIDRAG_HELP,
    brRkYears: RK_YEARS_HELP,
    brBankRate: BANK_RATE_HELP,
    brBankYears: BANK_YEARS_HELP,
    brOtherCosts: OTHER_COSTS_HELP,
    brSellCosts: 'Udgifter, når boligen sælges: ejendomsmægler, markedsføring og advokat, i procent af salgsprisen. Ofte 2-3 %.',
    // Gældsafvikling
    debtExtra: 'Et fast beløb om måneden ud over lånenes minimumsydelser. Det sættes ind på ét lån ad gangen, og når et lån er betalt ud, går dets ydelse videre til det næste.',
    // Budget
    budgetTotalInput: 'Det, du har til rådighed om måneden efter skat. Udfyldes det, kan du se, hvor meget der er tilbage, når budgettets udgifter er trukket fra.',
    // Formue
    netCatKontanter: 'Penge på bank- og opsparingskonti, fysiske kontanter og kontanter i dit aktiedepot.',
    netCatAktier: 'Markedsværdien af dine aktier, fonde og andre værdipapirer – kun selve værdipapirerne, ikke kontanterne i depotet.',
    netCatPension: `Din samlede pensionsopsparing før skat. Se den på pensionsinfo.dk. I sammenligningen med andre regnes den efter ${pctNumber(CEPOS_PENSION_TAX)} % skat, som hos CEPOS.`,
    netCatFrivaerdi: 'Boligens værdi minus restgælden på realkredit- og boliglån.',
    netCatAndet: 'Andre værdier af betydning, fx bil, båd eller sommerhus (fratrukket gælden i dem).',
    netDebt: 'Gæld, der ikke hører til boligen: fx billån, SU-lån, forbrugslån og kreditkort.',
    snapshotDate: 'Datoen øjebliksbilledet gælder for. Vælg en tidligere dato for at tilføje historiske tal.',
    wealthAge: 'Din alder. Du sammenlignes med alle danskere på præcis samme alder.'
};

let openHelpButton = null;

function closeFieldHelp(){
    if(!openHelpButton) return;
    openHelpButton.setAttribute('aria-expanded', 'false');
    document.getElementById(openHelpButton.getAttribute('aria-controls')).hidden = true;
    openHelpButton = null;
}

/**
 * Sætter en "?"-knap ved en label og en skjult forklaring under feltet.
 * @param {HTMLLabelElement} label
 * @param {string} text
 * @returns {void}
 */
function attachFieldHelp(label, text){
    const name = label.textContent.trim().replace(/\s*\(.*\)$/, '');
    const popId = 'help-' + (label.htmlFor || Math.random().toString(36).slice(2));
    const pop = el('div', {className:'help-pop', id:popId, hidden:true, attrs:{role:'note'}}, [text]);
    const btn = el('button', {className:'help-tip', type:'button', textContent:'?',
        attrs:{'aria-label':`Hvad betyder ${name}?`, 'aria-expanded':'false', 'aria-controls':popId},
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

    if(label.classList.contains('toggle-row')){
        // Teksten samles i ét element; ellers bliver fx årets sats (<span data-rule>) sin egen kolonne i flex-rækken.
        if(!label.querySelector(':scope > .toggle-text')){
            const textNodes = [...label.childNodes].filter(n => !(n.nodeType === 1 && n.matches('input')));
            label.append(el('span', {className:'toggle-text'}, textNodes));
        }
        // Afkrydsningsfelter: labelen omslutter feltet, så knap og forklaring lægges i en fælles ramme.
        const wrap = el('div', {className:'toggle-wrap'});
        if(label.id){ wrap.id = label.id; label.removeAttribute('id'); }
        if(label.getAttribute('style')){ wrap.setAttribute('style', label.getAttribute('style')); label.removeAttribute('style'); }
        label.replaceWith(wrap);
        wrap.append(el('div', {className:'toggle-line'}, [label, btn]), pop);
    } else {
        const row = el('div', {className:'label-row'});
        label.replaceWith(row);
        row.append(label, btn);
        row.insertAdjacentElement('afterend', pop);
    }
}

document.addEventListener('click', e => {
    if(openHelpButton && !e.target.closest('.help-pop')) closeFieldHelp();
});
document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && openHelpButton){
        const btn = openHelpButton;
        closeFieldHelp();
        btn.focus();
    }
});

Object.entries(FIELD_HELP).forEach(([id, text]) => {
    const input = document.getElementById(id);
    if(!input) return;
    const label = document.querySelector(`label[for="${id}"]`) || input.closest('label.toggle-row');
    if(label) attachFieldHelp(label, text);
});
