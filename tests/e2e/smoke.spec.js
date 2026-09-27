// Røgtest af hele siden i en rigtig browser. Hver test svarer til en slags
// fejl, der faktisk er sket: JavaScript-fejl ved indlæsning, grafer der ikke
// passer til deres boks, vandret scroll på mobil, og data der blev overskrevet
// uden advarsel.
const { test, expect } = require('@playwright/test');

// Alle steder på siden, der kan vises: [sektion, funktion der viser værktøjet, nummer]
const VIEWS = [
    ['tools', 'showTool', 1], ['tools', 'showTool', 2], ['tools', 'showTool', 3],
    ['tools', 'showTool', 4], ['tools', 'showTool', 5], ['tools', 'showTool', 6],
    ['housing', 'showHousingTool', 1], ['housing', 'showHousingTool', 2], ['housing', 'showHousingTool', 3],
    ['budget', null, null], ['formue', null, null]
];

async function openView(page, [section, fn, n]){
    await page.evaluate(([section, fn, n]) => {
        showSection(section);
        if(fn) window[fn](n);
    }, [section, fn, n]);
    await page.waitForTimeout(150);
}

/** Samler JavaScript-fejl; eksterne skrifttyper, der ikke kan hentes, ignoreres. */
function collectErrors(page){
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => {
        if(msg.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(msg.location().url || '')) errors.push(msg.text());
    });
    return errors;
}

test('siden indlæses uden fejl, og alle værktøjer kan vises', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/index.html');
    for(const view of VIEWS) await openView(page, view);
    expect(errors).toEqual([]);
});

test('hver synlig graf fylder præcis sin boks', async ({ page }) => {
    await page.goto('/index.html');
    // Porteføljetrackeren og formuehistorikken skal have data, før deres grafer tegnes.
    await page.evaluate(() => {
        const pts = [['2026-06-30', 180000, 20000, 5000], ['2026-07-31', 192000, 18000, 3000], ['2026-08-31', 205000, 15000, 3000]];
        localStorage.setItem('portfolioHistory', JSON.stringify(pts.map(([date, stockValue, cash, deposit]) =>
            ({date, portfolioValue: stockValue + cash, stockValue, cash, traded: deposit, deposit, dividend: 0}))));
        localStorage.setItem('netWorthHistory', JSON.stringify([
            {date: '2026-07-31', value: 500000, liquid: 300000, netCatKontanter: 100000, netCatAktier: 200000, netCatPension: 200000, netCatFrivaerdi: 0, netCatAndet: 0, debt: 0},
            {date: '2026-08-31', value: 520000, liquid: 320000, netCatKontanter: 110000, netCatAktier: 210000, netCatPension: 200000, netCatFrivaerdi: 0, netCatAndet: 0, debt: 0}
        ]));
    });
    await page.reload();
    for(const view of VIEWS){
        await openView(page, view);
        const mismatches = await page.evaluate(() => [...document.querySelectorAll('canvas')]
            .filter(c => c.offsetParent !== null)
            .map(c => {
                const chart = Chart.getChart(c);
                const box = c.parentElement.getBoundingClientRect();
                return {id: c.id, chartW: chart.width, chartH: chart.height, boxW: Math.round(box.width), boxH: Math.round(box.height)};
            })
            .filter(m => Math.abs(m.chartW - m.boxW) > 2 || Math.abs(m.chartH - m.boxH) > 2));
        expect(mismatches, `${view.join('/')}`).toEqual([]);
    }
});

test('ingen vandret scroll, ingen zoom-felter og foldede forklaringer på små skærme @mobil', async ({ page }) => {
    await page.goto('/index.html');
    const width = await page.evaluate(() => window.innerWidth);
    const phone = width <= 640;
    for(const view of VIEWS){
        await openView(page, view);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${view.join('/')} ved ${width}px`).toBeLessThanOrEqual(1);
        // Indhold, der stikker ud over sit panel, bliver skåret af - også uden vandret scroll på siden.
        const clipped = await page.evaluate(() => [...document.querySelectorAll('.panel .data-table-wrap, .panel .field, .panel .chart-wrap, .panel .stat')]
            .filter(e => e.offsetParent)
            .filter(e => e.getBoundingClientRect().right > e.closest('.panel').getBoundingClientRect().right + 1)
            .map(e => (e.closest('[id]')?.id || '') + ' ' + e.className));
        expect(clipped, `${view.join('/')} ved ${width}px`).toEqual([]);
    }
    // iPhone zoomer ind i felter med tekst under 16 px - og zoomer ikke ud igen.
    if(phone){
        const small = await page.evaluate(() => [...document.querySelectorAll('input, select, textarea')]
            .filter(i => i.offsetParent && parseFloat(getComputedStyle(i).fontSize) < 16).map(i => i.id || i.name || i.type));
        expect(small).toEqual([]);
    }
    // Lange forklaringer er foldet sammen på telefoner og åbne på større skærme.
    const folds = await page.evaluate(() => [...document.querySelectorAll('details.fold')].map(d => d.open));
    expect(folds.length).toBeGreaterThan(5);
    expect(folds.every(open => open === !phone)).toBe(true);
});

test('budget: en post tilføjes i dialogen, og diagrammets boks er lige så høj som kategorilisten', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Budget', exact: true }).click();
    await page.locator('.category-row', { hasText: 'Bolig' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: '+ Tilføj post' }).click();
    await dialog.getByLabel('Navn på post').fill('Husleje');
    await dialog.getByLabel('Beløb i kroner').fill('4500*2');
    await dialog.getByLabel('Beløb i kroner').press('Tab');   // regnes ud, når feltet forlades
    await dialog.getByLabel('Hvor ofte betales posten').selectOption('3');
    await expect(dialog.locator('.dialog-total strong')).toHaveText('3.000 kr.');
    await dialog.getByRole('button', { name: 'Færdig' }).click();
    await expect(page.locator('#budgetSumDisplay')).toHaveText('3.000 kr.');

    const [list, chart] = await Promise.all([
        page.locator('#budgetCategoryList').evaluate(n => n.closest('.panel').getBoundingClientRect().height),
        page.locator('#budgetChart').evaluate(n => n.closest('.panel').getBoundingClientRect().height)
    ]);
    expect(Math.abs(list - chart)).toBeLessThanOrEqual(1);
});

test('månedsstatus gemmer i begge trackere og advarer, før en dato overskrives', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: '+ Månedsstatus' }).click();
    let dialog = page.getByRole('dialog', { name: 'Månedsstatus' });
    await dialog.getByLabel('Dato').fill('2026-08-31');
    await dialog.getByLabel('Bank- og opsparingskonti', { exact: true }).fill('50000');
    await dialog.getByLabel('Værdi af aktier', { exact: true }).fill('100000');
    await dialog.getByRole('button', { name: 'Gem i begge' }).click();
    await expect(dialog).toBeHidden();

    const saved = await page.evaluate(() => ({
        nw: JSON.parse(localStorage.getItem('netWorthHistory')),
        pt: JSON.parse(localStorage.getItem('portfolioHistory'))
    }));
    expect(saved.nw).toHaveLength(1);
    expect(saved.nw[0]).toMatchObject({date: '2026-08-31', netCatKontanter: 50000, netCatAktier: 100000});
    expect(saved.pt[0]).toMatchObject({date: '2026-08-31', stockValue: 100000, portfolioValue: 100000});

    await page.getByRole('button', { name: '+ Månedsstatus' }).click();
    dialog = page.getByRole('dialog', { name: 'Månedsstatus' });
    await dialog.getByLabel('Dato').fill('2026-08-31');
    await expect(dialog.locator('.existing-note')).toContainText('allerede gemt data');
    await dialog.getByLabel('Værdi af aktier', { exact: true }).fill('120000');
    await dialog.getByRole('button', { name: 'Gem i begge' }).click();

    const warning = page.getByRole('dialog', { name: 'Overskriv eksisterende data?' });
    await expect(warning).toContainText('100.000 kr.');
    await expect(warning).toContainText('120.000 kr.');
    await warning.getByRole('button', { name: 'Annullér' }).click();
    const unchanged = await page.evaluate(() => JSON.parse(localStorage.getItem('portfolioHistory'))[0].stockValue);
    expect(unchanged).toBe(100000);
});

test('et delt link genskaber beregningen', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Bolig & lån' }).click();
    await page.getByRole('button', { name: 'Køb eller leje?' }).click();
    await page.getByLabel('Boligpris (kr.)', { exact: true }).fill('4500000');
    await page.getByLabel('Husleje pr. måned (kr.)', { exact: true }).fill('16000');
    const expected = await page.locator('#brWinnerSub').textContent();
    await page.locator('#housing2').getByRole('button', { name: 'Del beregning' }).click();
    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(url).toContain('#v=housing2');

    const fresh = await context.newPage();
    await fresh.goto(url);
    await expect(fresh.locator('#brPrice')).toHaveValue('4500000');
    await expect(fresh.locator('#brWinnerSub')).toHaveText(expected);
    expect(await fresh.evaluate(() => location.hash)).toBe('');
});

test('hjælp åbner med årets satser og kilder, og Esc lukker', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Hjælp og spørgsmål' }).click();
    const dialog = page.getByRole('dialog', { name: 'Hjælp og spørgsmål' });
    await dialog.getByText('Hvorfor beskattes en aktiesparekonto hvert år?').click();
    await expect(dialog).toContainText('174.200 kr.');
    await expect(dialog.locator('a[href^="https://skat.dk"]')).toHaveCount(5);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
});

test('formue: mål oprettes i en dialog, og hele alderstabellen fremhæver din alder', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Formue', exact: true }).click();
    await page.getByLabel('Aktier & værdipapirer', { exact: true }).fill('300000');

    await page.getByRole('button', { name: '+ Nyt mål' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nyt mål' });
    await dialog.getByRole('button', { name: 'Opret mål' }).click();
    await expect(dialog.locator('.field-error')).toHaveText('Giv målet et navn.');
    await dialog.getByLabel('Navn').fill('Første million');
    await dialog.getByLabel('Hvad vil du måle?').selectOption('netCatAktier');
    await dialog.getByLabel('Mål (kr.)').fill('1000000');
    await dialog.getByRole('button', { name: 'Opret mål' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.goal-row')).toContainText('300.000 / 1.000.000 kr.');
    await expect(page.locator('.goal-facts')).toContainText('30 %');

    await page.getByLabel('Din alder', { exact: true }).fill('27');
    await page.getByRole('button', { name: 'Se hele tabellen' }).click();
    const table = page.getByRole('dialog', { name: 'Formue efter alder' });
    await expect(table.locator('tbody tr')).toHaveCount(73);
    await expect(table.locator('tr.is-highlight td').first()).toHaveText('27 år');
    await expect(table.locator('tr.is-highlight')).toBeInViewport();
});

test('formue: sammensætningen viser alle kategorier for datoen, man peger på', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.setItem('netWorthHistory', JSON.stringify([
        {date:'2026-07-31', value:500000, liquid:300000, netCatKontanter:100000, netCatAktier:200000, netCatPension:200000, netCatFrivaerdi:0, netCatAndet:0, debt:0},
        {date:'2026-08-31', value:520000, liquid:320000, netCatKontanter:110000, netCatAktier:210000, netCatPension:230000, netCatFrivaerdi:0, netCatAndet:0, debt:30000}
    ])));
    await page.reload();
    await page.getByRole('button', { name: 'Formue', exact: true }).click();
    const canvas = page.locator('#netWorthCompositionChart');
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2, { steps: 5 });
    await page.waitForTimeout(300);
    const tip = await page.evaluate(() => {
        const t = netWorthCompositionChart.tooltip;
        return {opacity: t.opacity, lines: t.body.map(b => b.lines.join('')), footer: t.footer};
    });
    expect(tip.opacity).toBeGreaterThan(0);
    expect(tip.lines).toHaveLength(6);
    expect(tip.lines[0]).toBe('Pension: 230.000 kr. (42 %)');
    expect(tip.footer).toEqual(['Nettoformue: 520.000 kr.']);
});

test('"?" ved et felt viser en forklaring, og værktøjets beskrivelse kan foldes ud', async ({ page }) => {
    await page.goto('/index.html');
    const tip = page.getByRole('button', { name: 'Hvad betyder Forventet årligt afkast?' }).first();
    const pop = page.locator('#' + await tip.getAttribute('aria-controls'));
    await expect(pop).toBeHidden();
    await tip.click();
    await expect(pop).toBeVisible();
    await expect(tip).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
    await tip.click();
    await page.mouse.click(5, 5);
    await expect(pop).toBeHidden();

    // Dobbelt fradrag flytter med mellem værktøj 1 og 2 og skjules i de andre.
    const dd = page.locator('#doubleDeduction');
    await page.evaluate(() => showTool(2));
    await expect(dd).toBeVisible();
    await expect(page.locator('#tool2 #doubleDeduction')).toHaveCount(1);
    await page.evaluate(() => showTool(3));
    await expect(dd).toBeHidden();

    const about = page.locator('#tool3 .tool-about');
    await expect(about.locator('.tool-intro')).toBeHidden();
    await about.getByText('Hvad gør dette værktøj?').click();
    await expect(about.locator('.tool-intro')).toBeVisible();
});

test('man kan regne i et talfelt, og pil op/ned tæller i feltets step', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Formue', exact: true }).click();
    const field = page.getByLabel('Aktier & værdipapirer', { exact: true });
    await field.fill('');
    const before = await page.evaluate(() => computeLiveNetWorth());
    await field.pressSequentially('12.500 + 3.200*2');
    await expect(page.locator('#netCatAktier + .calc-hint')).toHaveText('= 18.900');
    await field.press('Enter');
    await expect(field).toHaveValue('18900');
    await expect(page.locator('.calc-hint')).toHaveCount(0);
    expect(await page.evaluate(() => computeLiveNetWorth())).toBe(before + 18900);

    await field.fill('2,5 +');
    await field.press('Tab');
    await expect(field).toHaveValue('2,5 +');
    await expect(page.locator('#netCatAktier ~ .range-hint')).toContainText('Kunne ikke regne det ud');

    const amount = page.locator('#startCashNumber');
    await page.evaluate(() => { showSection('tools'); showTool(1); });
    await amount.fill('950');
    await amount.press('ArrowUp');
    await expect(amount).toHaveValue('1000');   // step 1.000: op til næste hele tusind
    await amount.press('ArrowUp');
    await expect(amount).toHaveValue('2000');
    await amount.press('ArrowDown');
    await amount.press('ArrowDown');
    await amount.press('ArrowDown');
    await expect(amount).toHaveValue('0');      // stopper ved min
    await expect(page.locator('#startCash')).toHaveValue('1000');   // skyderen følger med (dens min er 1.000)
});

test('budgettet kan downloades som CSV til fx en rådgiver', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
        localStorage.setItem('budgetItems', JSON.stringify({catBolig: [{label:'Husleje', amount:9000, freq:1}], catOpsparing: [{label:'Aktier', amount:3000, freq:1}]}));
        localStorage.setItem('budgetData', JSON.stringify({budgetTotalInput: '15000'}));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Budget', exact: true }).click();
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Download budget' }).click()
    ]);
    expect(download.suggestedFilename()).toMatch(/^budget-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = require('fs').readFileSync(await download.path(), 'utf8');
    expect(text.startsWith('﻿"Gruppe";"Kategori";"Post"')).toBe(true);
    expect(text).toContain('"Behov";"Bolig";"Husleje";"9000";"pr. måned";"9000";"108000"');
    expect(text).toContain('"Penge tilbage";"";"";"";"";"3000";"36000"');
});

test('feedback: knappen er skjult uden adresse, og en besked sendes med værktøjets navn', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#feedbackBtn')).toBeVisible();
    await page.evaluate(() => { FEEDBACK.endpoint = ''; updateFeedbackButton(); });
    await expect(page.locator('#feedbackBtn')).toBeHidden();

    await page.route('https://formspree.io/f/xppwljwj', route => route.abort());
    let sent = null;
    await page.route('https://formspree.io/f/test', route => {
        sent = route.request().postDataJSON();
        route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.evaluate(() => { FEEDBACK.endpoint = 'https://formspree.io/f/test'; updateFeedbackButton(); });
    await page.getByRole('button', { name: 'Bolig & lån' }).click();
    await page.getByRole('button', { name: 'Giv feedback' }).click();
    const dialog = page.getByRole('dialog', { name: 'Giv feedback' });
    await dialog.getByText('Sådan behandles din besked').click();
    await expect(dialog.locator('.privacy-note')).toContainText('slettes senest 12 måneder');
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(dialog.locator('.field-error')).toHaveText('Skriv lidt om, hvad du tænker.');
    await dialog.getByLabel('Hvad handler det om?').selectOption('Fejl');
    await dialog.getByLabel('Din besked').fill('Grafen blinker, når jeg skifter fane.');
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.toast')).toContainText('Tak for din feedback');
    expect(sent).toMatchObject({ Type: 'Fejl', Besked: 'Grafen blinker, når jeg skifter fane.', _subject: 'Feedback: Fejl' });
    expect(sent['Værktøj']).toMatch(/^Bolig & lån \/ /);
    expect(sent.email).toBeUndefined();

    // Fejler afsendelsen, bliver dialogen og teksten stående.
    await page.route('https://formspree.io/f/test', route => route.fulfill({ status: 500, body: '' }));
    await page.getByRole('button', { name: 'Giv feedback' }).click();
    await dialog.getByLabel('Din besked').fill('Anden besked');
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(dialog.locator('.field-error')).toContainText('kunne ikke sendes');
    await expect(dialog.getByLabel('Din besked')).toHaveValue('Anden besked');
    await expect(dialog.getByRole('button', { name: 'Send' })).toBeEnabled();
});

test('gældsafvikling forklarer forskellen på lavine og snebold, og etiketterne kan læses', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Bolig & lån' }).click();
    await page.evaluate(() => showHousingTool(3));
    await expect(page.locator('#debtCompare')).toContainText('Lavine sparer dig');
    await expect(page.locator('#debtCompare')).toContainText('9.540 kr. i rente');
    await expect(page.locator('#debtCompare')).toContainText('Afbetaling (mobil) er betalt ud efter 3 mdr.');

    // "Rente betalt" viser den akkumulerede rente, hvor forskellen er tydelig.
    await page.getByRole('button', { name: 'Rente betalt' }).click();
    await expect(page.getByRole('button', { name: 'Rente betalt' })).toHaveAttribute('aria-pressed', 'true');
    const lastInterest = await page.evaluate(() => debtChart.data.datasets.map(d => Math.round(d.data.at(-1))));
    expect(lastInterest[1] - lastInterest[0]).toBeGreaterThan(9000);
    await page.getByRole('button', { name: 'Gæld tilbage' }).click();
    const clipped = await page.locator('.debt-field-label').evaluateAll(ls => ls.filter(l => l.scrollWidth > l.clientWidth + 1).length);
    expect(clipped).toBe(0);

    // Samme rækkefølge: siden siger, at de er ens.
    await page.evaluate(() => {
        localStorage.setItem('debtPayoffData', JSON.stringify({extra: 1000, debts: [
            {name:'Kreditkort', balance:15000, rate:22, minPayment:500}, {name:'Billån', balance:60000, rate:6.5, minPayment:1500}]}));
        renderDebtRows(); updateDebtPayoff();
    });
    await expect(page.locator('#debtCompare')).toContainText('præcis det samme');
});

test('budget: 50/30/20 viser både andel og beløb pr. måned', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.setItem('budgetItems', JSON.stringify({catBolig:[{label:'Husleje', amount:9000}], catOpsparing:[{label:'Aktier', amount:3000}]})));
    await page.reload();
    await page.getByRole('button', { name: 'Budget', exact: true }).click();
    await expect(page.locator('#ruleBehov')).toHaveText('75%');
    await expect(page.locator('#ruleBehovSum')).toHaveText('9.000 kr. pr. måned');
    await expect(page.locator('#ruleOpsparingSum')).toHaveText('3.000 kr. pr. måned');
    await expect(page.locator('#ruleBehov')).toHaveCSS('color', await page.evaluate(() => {
        const probe = document.createElement('span'); probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--cross');
        document.body.append(probe); const c = getComputedStyle(probe).color; probe.remove(); return c;
    }));
});

test('formue: tomme felter viser det seneste datapunkt overalt, og tallene kan hentes ind', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
        localStorage.setItem('netWorthHistory', JSON.stringify([
            {date:'2026-08-31', value:520000, liquid:320000, netCatKontanter:110000, netCatAktier:210000, netCatPension:230000, netCatFrivaerdi:0, netCatAndet:0, debt:30000}]));
        localStorage.setItem('netWorthGoals', JSON.stringify([{id:'g1', name:'Aktiemål', metric:'netCatAktier', target:420000, deadline:null}]));
        localStorage.setItem('budgetItems', JSON.stringify({catBolig:[{label:'Husleje', amount:11000}]}));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Formue', exact: true }).click();
    const note = page.locator('#netWorthSourceNote');
    await expect(note).toContainText('seneste månedsstatus (31. aug. 2026)');
    await expect(page.locator('#netWorthTotal')).toHaveText('520.000 kr.');
    await expect(page.locator('#netLiquidTotal')).toHaveText('320.000 kr.');
    await expect(page.locator('#bufferMonths')).toHaveText('10,0 måneder');
    await expect(page.locator('.goal-facts')).toContainText('50 %');
    await expect(page.locator('#wealthCompareSub')).toContainText('520.000 kr. før');

    await note.getByRole('button', { name: 'Hent tallene ind i felterne' }).click();
    await expect(page.getByLabel('Aktier & værdipapirer', { exact: true })).toHaveValue('210000');
    await expect(note).toBeHidden();
    await expect(page.locator('#netWorthTotal')).toHaveText('520.000 kr.');

    await page.getByLabel('Aktier & værdipapirer', { exact: true }).fill('250000');
    await expect(page.locator('#netWorthTotal')).toHaveText('560.000 kr.');
});

test('afkrydsningsfelter: teksten holder sammen, og "?" bliver i panelet', async ({ page }) => {
    await page.goto('/index.html');
    for(const n of [1, 2]){
        await page.evaluate(n => showTool(n), n);
        const bad = await page.evaluate(() => [...document.querySelectorAll('.toggle-wrap')].filter(w => w.offsetParent).map(w => {
            const label = w.querySelector('.toggle-row');
            const btn = w.querySelector('.help-tip').getBoundingClientRect();
            const panel = w.closest('.panel').getBoundingClientRect();
            const kids = [...label.children].map(c => c.tagName + '.' + c.className);
            return {id: w.id || label.textContent.trim().slice(0, 25), outside: btn.right > panel.right - 4, kids};
        }).filter(r => r.outside || r.kids.length !== 2));
        expect(bad, `værktøj ${n}`).toEqual([]);
    }
});

test('app: manifest og ikoner findes, og siden virker offline efter første besøg', async ({ page, context }) => {
    await page.goto('/index.html');
    const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
    expect(manifest.display).toBe('standalone');
    for(const icon of manifest.icons){
        expect((await page.request.get('/' + icon.src)).status(), icon.src).toBe(200);
    }
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('h1')).toBeVisible();
    await page.getByRole('button', { name: 'Formue', exact: true }).click();
    await page.getByLabel('Aktier & værdipapirer', { exact: true }).fill('1000 + 500');
    await page.getByLabel('Aktier & værdipapirer', { exact: true }).press('Enter');
    await expect(page.locator('#netWorthTotal')).toHaveText('1.500 kr.');   // scripts kører offline
    expect(await page.evaluate(() => typeof Chart)).toBe('function');       // også Chart.js fra CDN'en
    await context.setOffline(false);
});

test('FIRE: "Hent mine tal" henter likvid formue og budgettet, med fortryd', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => showTool(3));
    await expect(page.getByRole('button', { name: 'Hent mine tal' })).toBeHidden();

    await page.evaluate(() => {
        localStorage.setItem('netWorthData', JSON.stringify({netCatKontanter:'50000', netCatAktier:'250000', netCatPension:'400000', netCatFrivaerdi:'0', netCatAndet:'0', netDebt:'0'}));
        localStorage.setItem('budgetItems', JSON.stringify({catBolig:[{label:'Husleje', amount:10000}], catMad:[{label:'Mad', amount:4000}], catOpsparing:[{label:'Aktier', amount:6000}]}));
    });
    await page.reload();
    await page.evaluate(() => showTool(3));
    await page.getByRole('button', { name: 'Hent mine tal' }).click();
    const dialog = page.getByRole('dialog', { name: 'Hent mine tal' });
    await expect(dialog.locator('.import-total')).toContainText('300.000 kr.');     // kontanter + aktier, uden pension
    await dialog.getByText('Pension', { exact: true }).click();
    await expect(dialog.locator('.import-total')).toContainText('700.000 kr.');
    await dialog.getByText('Pension', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Brug tallene' }).click();
    await expect(page.locator('#startCash3Number')).toHaveValue('300000');
    await expect(page.locator('#expenses3Number')).toHaveValue('168000');
    await expect(page.locator('#monthlyAmount3Number')).toHaveValue('6000');
    await page.locator('.toast').getByRole('button', { name: 'Fortryd' }).click();
    await expect(page.locator('#startCash3Number')).toHaveValue('100000');
});

test('påmindelse om månedsstatus: vises ved månedsskiftet og åbner skemaet på månedens sidste dag', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-03T12:00:00'));
    await page.goto('/index.html');
    await expect(page.locator('#monthlyReminderBanner')).toBeHidden();     // ny bruger: ingen påmindelse
    await page.evaluate(() => localStorage.setItem('netWorthHistory', JSON.stringify([{date:'2026-08-31', value:1000, liquid:1000, netCatKontanter:1000, netCatAktier:0, netCatPension:0, netCatFrivaerdi:0, netCatAndet:0, debt:0}])));
    await page.reload();
    const banner = page.locator('#monthlyReminderBanner');
    await expect(banner).toContainText('september');
    await banner.getByRole('button', { name: 'Åbn månedsstatus' }).click();
    const dialog = page.getByRole('dialog', { name: 'Månedsstatus' });
    await expect(dialog.getByLabel('Dato')).toHaveValue('2026-09-30');
    await dialog.getByRole('button', { name: 'Gem i begge' }).click();
    await expect(dialog).toBeHidden();
    await expect(banner).toBeHidden();

    // "Ikke denne måned" huskes.
    await page.evaluate(() => localStorage.setItem('netWorthHistory', JSON.stringify([{date:'2026-08-31', value:1000, liquid:1000, netCatKontanter:1000, netCatAktier:0, netCatPension:0, netCatFrivaerdi:0, netCatAndet:0, debt:0}])));
    await page.evaluate(() => localStorage.removeItem('portfolioHistory'));
    await page.reload();
    await banner.getByRole('button', { name: 'Ikke denne måned' }).click();
    await page.reload();
    await expect(banner).toBeHidden();
});

test('udskriv overblik: rapporten har formue, budget, lån og mål og er det eneste, der udskrives', async ({ page }) => {
    await page.addInitScript(() => { window.print = () => { window.__printed = true; }; });
    await page.goto('/index.html');
    await page.evaluate(() => {
        localStorage.setItem('netWorthData', JSON.stringify({netCatKontanter:'50000', netCatAktier:'250000', netCatPension:'0', netCatFrivaerdi:'0', netCatAndet:'0', netDebt:'20000'}));
        localStorage.setItem('budgetItems', JSON.stringify({catBolig:[{label:'Husleje', amount:9000}], catOpsparing:[{label:'Aktier', amount:3000}]}));
        localStorage.setItem('debtPayoffData', JSON.stringify({extra: 500, debts:[{name:'Billån', balance:20000, rate:6, minPayment:1000}]}));
        localStorage.setItem('netWorthGoals', JSON.stringify([{id:'g1', name:'Første million', metric:'value', target:1000000, deadline:null}]));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Budget', exact: true }).click();
    await page.getByRole('button', { name: 'Udskriv overblik' }).click();
    expect(await page.evaluate(() => window.__printed)).toBe(true);
    const report = page.locator('#printReport');
    await expect(report.locator('h2')).toHaveText(['Formue', 'Budget', 'Lån', 'Mål']);
    await expect(report).toContainText('Nettoformue');
    await expect(report).toContainText('280.000 kr.');
    await expect(report).toContainText('Første million');

    await page.emulateMedia({ media: 'print' });
    await expect(report).toBeVisible();
    await expect(page.locator('.top-tabs')).toBeHidden();
});

test('ETF: opslag på positivlisten, en ISIN der ikke er på listen, og danske udbyttebetalende fonde', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Tips & viden' }).click();
    await page.locator('#tool6 summary', { hasText: 'Skat og positivlisten' }).click();
    const search = page.getByLabel('Søg på ISIN eller navn', { exact: true });
    await search.fill('ie00b4l5y983');
    const results = page.locator('#etfResults');
    await expect(results.locator('.etf-hit')).toHaveCount(1);
    await expect(results).toContainText('iShares Core MSCI World UCITS ETF');
    await expect(results).toContainText('På positivlisten 2026');

    await search.fill('IE00BK5BQT80');
    await expect(results).toContainText('står ikke på listen for 2026');
    await expect(results).toContainText('kapitalindkomst');

    await search.fill('ishares msci world');
    await expect(results.locator('.etf-hit').first()).toBeVisible();

    // Danske udbyttebetalende fonde forklares altid.
    await expect(page.locator('.etf-dk-note')).toContainText('realisationsprincippet');
    await search.fill('DK0060189041');
    await expect(results).toContainText('helt normalt, at den ikke står på listen');
});

test('historik: "Ret" retter et datapunkt, advarer ved en optaget dato og kan fortrydes', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.setItem('netWorthHistory', JSON.stringify([
        {date:'2026-07-31', value:300000, liquid:300000, netCatKontanter:100000, netCatAktier:200000, netCatPension:0, netCatFrivaerdi:0, netCatAndet:0, debt:0},
        {date:'2026-08-31', value:320000, liquid:320000, netCatKontanter:100000, netCatAktier:220000, netCatPension:0, netCatFrivaerdi:0, netCatAndet:0, debt:0}
    ])));
    await page.reload();
    await page.getByRole('button', { name: 'Formue', exact: true }).click();
    await page.getByRole('button', { name: 'Ret datapunktet for 31. aug. 2026' }).click();
    let dialog = page.getByRole('dialog', { name: 'Ret formue for 31. aug. 2026' });
    await dialog.getByLabel('Aktier & værdipapirer (kr.)').fill('220000 + 5000');
    await dialog.getByLabel('Aktier & værdipapirer (kr.)').press('Enter');
    await expect(dialog).toBeHidden();
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('netWorthHistory')));
    expect((await read())[1]).toMatchObject({date:'2026-08-31', netCatAktier:225000, value:325000});

    await page.locator('.toast').getByRole('button', { name: 'Fortryd' }).click();
    expect((await read())[1].netCatAktier).toBe(220000);

    // Flyttes datoen til en dato med data, vises ændringerne først.
    await page.getByRole('button', { name: 'Ret datapunktet for 31. aug. 2026' }).click();
    dialog = page.getByRole('dialog', { name: 'Ret formue for 31. aug. 2026' });
    await dialog.getByLabel('Dato').fill('2026-07-31');
    await dialog.getByRole('button', { name: 'Gem ændringer' }).click();
    const warning = page.getByRole('dialog', { name: 'Overskriv eksisterende data?' });
    await expect(warning).toContainText('200.000 kr.');
    await warning.getByRole('button', { name: 'Erstat data' }).click();
    const after = await read();
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({date:'2026-07-31', netCatAktier:220000});
});

test('alderen i "Hvor rig er jeg?" huskes, og info-dialoger har kun ét luk-kryds', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Formue', exact: true }).click();
    await page.getByLabel('Din alder', { exact: true }).fill('41');
    await page.reload();
    await page.getByRole('button', { name: 'Formue', exact: true }).click();
    await expect(page.getByLabel('Din alder', { exact: true })).toHaveValue('41');

    await page.getByRole('button', { name: 'Se hele tabellen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Formue efter alder' });
    await expect(dialog.locator('.dialog-footer')).toHaveCount(0);
    await expect(dialog.locator('tr.is-highlight td').first()).toHaveText('41 år');
    await expect(dialog.getByRole('link', { name: 'Se kilden hos CEPOS' })).toBeInViewport();
    await dialog.getByRole('button', { name: 'Luk' }).click();
    await expect(dialog).toBeHidden();
});

test('synkronisering: en fil fra en anden enhed flettes i stedet for at overskrive, og kan fortrydes', async ({ browser }) => {
    // Enhed A: gemmer sine data.
    const a = await (await browser.newContext()).newPage();
    await a.goto('/index.html');
    await a.evaluate(() => {
        const nw = (date, value) => ({date, value, liquid:value, netCatKontanter:value, netCatAktier:0, netCatPension:0, netCatFrivaerdi:0, netCatAndet:0, debt:0});
        localStorage.setItem('netWorthHistory', JSON.stringify([nw('2026-07-31', 100), nw('2026-08-31', 200)]));
        localStorage.setItem('budgetItems', JSON.stringify({catBolig:[{label:'Husleje', amount:9500}]}));
    });
    await a.reload();
    await a.locator('#settingsBtn').click();
    const [download] = await Promise.all([a.waitForEvent('download'), a.getByRole('button', { name: 'Gem mine data' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^okonomi-data-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    const filePath = await download.path();
    const file = JSON.parse(require('fs').readFileSync(filePath, 'utf8'));
    expect(file.format).toBe('okonomivaerktoejer');
    expect(file.times.budgetItems).toBeGreaterThan(0);

    // Enhed B: har sin egen historik, et ældre budget og mål, der ikke findes på A.
    const b = await (await browser.newContext()).newPage();
    await b.goto('/index.html');
    await b.evaluate(() => {
        const nw = (date, value) => ({date, value, liquid:value, netCatKontanter:value, netCatAktier:0, netCatPension:0, netCatFrivaerdi:0, netCatAndet:0, debt:0});
        localStorage.setItem('netWorthHistory', JSON.stringify([nw('2026-06-30', 50), nw('2026-08-31', 210)]));
        localStorage.setItem('budgetItems', JSON.stringify({catBolig:[{label:'Husleje', amount:9000}]}));
        localStorage.setItem('netWorthGoals', JSON.stringify([{id:'g1', name:'Kun på B', metric:'value', target:1000, deadline:null}]));
        const times = JSON.parse(localStorage.getItem('syncTimes'));
        times.budgetItems = 1;   // B's budget er ældre end A's
        localStorage.setItem('syncTimes', JSON.stringify(times));
    });
    await b.reload();
    await b.locator('#settingsBtn').click();
    await b.locator('#allDataUpload').setInputFiles(filePath);
    const dialog = b.getByRole('dialog', { name: 'Hent data fra fil' });
    await expect(dialog).toContainText('1 ny dato fra filen lægges til');
    await expect(dialog).toContainText('1 dato har forskellige tal (31. aug. 2026)');
    await expect(dialog.getByLabel('Brug – Budgetposter')).toHaveValue('incoming');     // filens er nyest
    await dialog.getByLabel('Ved forskellige tal, brug – Formuehistorik').selectOption('local');
    await dialog.getByRole('button', { name: 'Hent og flet' }).click();

    await expect(b.locator('.toast')).toContainText('hentet og flettet');
    const after = await b.evaluate(() => ({
        history: JSON.parse(localStorage.getItem('netWorthHistory')).map(h => [h.date, h.value]),
        budget: JSON.parse(localStorage.getItem('budgetItems')).catBolig[0].amount,
        goals: JSON.parse(localStorage.getItem('netWorthGoals')).length
    }));
    expect(after).toEqual({history: [['2026-06-30', 50], ['2026-07-31', 100], ['2026-08-31', 210]], budget: 9500, goals: 1});

    await b.locator('.toast').getByRole('button', { name: 'Fortryd' }).click();
    await b.waitForLoadState('load');
    const undone = await b.evaluate(() => JSON.parse(localStorage.getItem('netWorthHistory')).map(h => h.date));
    expect(undone).toEqual(['2026-06-30', '2026-08-31']);
});

test('synkronisering: en ny, tom enhed foreslår filens tal frem for sine egne standardværdier', async ({ browser }) => {
    const a = await (await browser.newContext()).newPage();
    await a.goto('/index.html');
    await a.getByRole('button', { name: 'Formue', exact: true }).click();
    await a.getByLabel('Aktier & værdipapirer', { exact: true }).fill('300000');
    await a.locator('#settingsBtn').click();
    const [download] = await Promise.all([a.waitForEvent('download'), a.getByRole('button', { name: 'Gem mine data' }).click()]);

    const b = await (await browser.newContext()).newPage();
    await b.goto('/index.html');
    await b.locator('#settingsBtn').click();
    await b.locator('#allDataUpload').setInputFiles(await download.path());
    const dialog = b.getByRole('dialog', { name: 'Hent data fra fil' });
    await expect(dialog.getByLabel('Brug – Formue-felterne')).toHaveValue('incoming');
    await dialog.getByRole('button', { name: 'Hent og flet' }).click();
    await b.getByRole('button', { name: 'Formue', exact: true }).click();
    await expect(b.getByLabel('Aktier & værdipapirer', { exact: true })).toHaveValue('300000');
});

test('Slet i historikken og på lån spørger først, og Annullér beholder data', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.setItem('portfolioHistory', JSON.stringify([
        {date:'2026-08-31', portfolioValue:215000, stockValue:205000, cash:10000, traded:0, deposit:0, dividend:0}])));
    await page.reload();
    await page.evaluate(() => showTool(4));
    await page.getByRole('button', { name: 'Slet datapunktet for 31. aug. 2026' }).click();
    let confirm = page.getByRole('dialog', { name: 'Slet datapunktet?' });
    await expect(confirm).toContainText('215.000 kr.');
    await confirm.getByRole('button', { name: 'Annullér' }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('portfolioHistory')).length)).toBe(1);
    await page.getByRole('button', { name: 'Slet datapunktet for 31. aug. 2026' }).click();
    await page.getByRole('dialog', { name: 'Slet datapunktet?' }).getByRole('button', { name: 'Slet' }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('portfolioHistory')).length)).toBe(0);
    await expect(page.locator('.toast')).toContainText('slettet');

    await page.getByRole('button', { name: 'Bolig & lån' }).click();
    await page.evaluate(() => showHousingTool(3));
    await page.getByRole('button', { name: 'Slet Kreditkort' }).click();
    confirm = page.getByRole('dialog', { name: 'Slet lånet?' });
    await expect(confirm).toContainText('60.000 kr.');
    await confirm.getByRole('button', { name: 'Annullér' }).click();
    await expect(page.locator('.debt-row')).toHaveCount(4);
});

test('ændring pr. datapunkt og bedste perioder - indskud tæller ikke som afkast', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
        const nw = (date, value) => ({date, value, liquid:value, netCatKontanter:value, netCatAktier:0, netCatPension:0, netCatFrivaerdi:0, netCatAndet:0, debt:0});
        localStorage.setItem('netWorthHistory', JSON.stringify([nw('2026-06-30', 480000), nw('2026-07-31', 500000), nw('2026-08-31', 540000), nw('2026-09-30', 530000)]));
        localStorage.setItem('portfolioHistory', JSON.stringify([
            {date:'2026-07-31', portfolioValue:200000, stockValue:200000, cash:0, traded:0, deposit:190000, dividend:0},
            {date:'2026-08-31', portfolioValue:230000, stockValue:230000, cash:0, traded:0, deposit:25000, dividend:0},
            {date:'2026-09-30', portfolioValue:240000, stockValue:240000, cash:0, traded:0, deposit:0, dividend:0}]));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Formue', exact: true }).click();
    const nwRows = page.locator('#netWorthHistoryTableBody tr');
    await expect(nwRows.nth(0).locator('.change-cell')).toHaveText('–');
    await expect(nwRows.nth(2).locator('.change-cell')).toHaveText('+40.000 kr.');
    await expect(nwRows.nth(3).locator('.change-cell')).toHaveClass(/is-down/);
    const nwBest = page.locator('#nwBestPeriods li');
    await expect(nwBest).toHaveCount(2);
    await expect(nwBest.first()).toContainText('31. jul. 2026 → 31. aug. 2026');
    await expect(nwBest.first()).toContainText('+40.000 kr.');

    await page.getByRole('button', { name: 'Investering', exact: true }).click();
    await page.evaluate(() => showTool(4));
    const ptRow = page.locator('#ptTableBody tr').nth(1);
    await expect(ptRow.locator('.change-cell').nth(0)).toHaveText('+30.000 kr.');
    await expect(ptRow.locator('.change-cell').nth(1)).toContainText('+5.000 kr.');     // 30.000 − 25.000 indsat
    await expect(page.locator('#ptBestPeriods li').first()).toContainText('+10.000 kr.');  // september: intet indsat

    // CSV: ændringerne kommer med som tal, Ret/Slet-knapperne gør ikke.
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download som CSV' }).first().click()]);
    const csv = require('fs').readFileSync(await download.path(), 'utf8');
    expect(csv.split('\r\n')[0]).toBe('﻿"Dato";"Porteføljeværdi";"Ændring";"Heraf afkast";"Aktieværdi";"Kontant";"Købt/solgt";"Indskud/udb.";"Udbytte"');
    expect(csv).not.toContain('Slet');
});

test('år for år og prognose: tabellerne regner rigtigt, og prognosen står under grafen', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-05T12:00:00'));
    await page.goto('/index.html');
    await page.evaluate(() => {
        const nw = (date, value) => ({date, value, liquid:value, netCatKontanter:value, netCatAktier:0, netCatPension:0, netCatFrivaerdi:0, netCatAndet:0, debt:0});
        localStorage.setItem('netWorthHistory', JSON.stringify([nw('2025-09-30', 400000), nw('2025-12-31', 430000), nw('2026-09-30', 520000)]));
        localStorage.setItem('portfolioHistory', JSON.stringify([
            {date:'2025-12-31', portfolioValue:100000, stockValue:100000, cash:0, traded:0, deposit:100000, dividend:0},
            {date:'2026-06-30', portfolioValue:130000, stockValue:130000, cash:0, traded:0, deposit:20000, dividend:0},
            {date:'2026-09-30', portfolioValue:140000, stockValue:140000, cash:0, traded:0, deposit:0, dividend:0}]));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Formue', exact: true }).click();
    const nwYear = page.locator('#nwYearBody tr');
    await expect(nwYear.nth(0)).toContainText('2026 (til nu)');
    await expect(nwYear.nth(0)).toContainText('+90.000 kr.');
    await expect(nwYear.nth(1)).toContainText('2025 (fra 30. sep.)');
    await expect(page.locator('#nwForecastNote')).toContainText('+10.008 kr. om måneden');
    await expect(page.locator('#nwForecastNote')).toContainText('Næste milepæl, 1.000.000 kr.');
    expect(await page.evaluate(() => netWorthHistoryChart.data.datasets[2].data.length)).toBe(25);   // ét punkt pr. måned i 2 år

    await page.getByRole('button', { name: 'Investering', exact: true }).click();
    await page.evaluate(() => showTool(4));
    const ptYear = page.locator('#ptYearBody tr').first();
    await expect(ptYear).toContainText('+20.000 kr.');     // indsat
    await expect(ptYear.locator('.change-cell').first()).toHaveText('+20.000 kr.');   // afkast = 40.000 − 20.000
    await expect(ptYear.locator('.change-cell').last()).toHaveText('+18,2 %');
});

test('prognosen: peger man på den stiplede linje, vises den forventede formue for måneden', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
        const nw = (date, value) => ({date, value, liquid:value, netCatKontanter:value, netCatAktier:0, netCatPension:0, netCatFrivaerdi:0, netCatAndet:0, debt:0});
        localStorage.setItem('netWorthHistory', JSON.stringify([nw('2025-09-30', 400000), nw('2026-09-30', 520000)]));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Formue', exact: true }).click();
    await page.locator('#netWorthHistoryChart').scrollIntoViewIfNeeded();
    // Vent, til grafen er færdig med at animere, så punkternes placering ligger fast.
    await page.waitForFunction(() => !netWorthHistoryChart.animating && netWorthHistoryChart.width > 0);
    await page.waitForTimeout(600);
    const hover = async iso => {
        const pos = await page.evaluate(iso => {
            const c = netWorthHistoryChart, r = c.canvas.getBoundingClientRect();
            const point = c.data.datasets[2].data.find(p => p.x === Date.parse(iso + 'T00:00:00'));
            return {x: r.left + c.scales.x.getPixelForValue(point.x), y: r.top + c.scales.y.getPixelForValue(point.y)};
        }, iso);
        await page.mouse.move(pos.x - 30, pos.y);
        await page.mouse.move(pos.x, pos.y, { steps: 4 });
        await page.waitForTimeout(250);
        return page.evaluate(() => ({title: netWorthHistoryChart.tooltip.title, body: netWorthHistoryChart.tooltip.body.map(b => b.lines.join(''))}));
    };
    const ahead = await hover('2027-09-30');
    expect(ahead.title).toEqual(['Omkring sep. 2027']);
    expect(ahead.body).toEqual(['Prognose: ca. 640.000 kr.']);      // 520.000 + 12 × 10.008
    const now = await hover('2026-09-30');
    expect(now.body.some(l => l.startsWith('Prognose'))).toBe(false);   // ikke dobbelt ved seneste datapunkt
    expect(now.body).toContain('Nettoformue: 520.000 kr.');
});

test('Tips & viden: afsnittene kan foldes ud, og nøgletallene står fra let til avanceret', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Tips & viden' }).click();
    const sections = page.locator('#tool6 .guide-section');
    await expect(sections).toHaveCount(7);
    await expect(sections.first()).toHaveAttribute('open', '');
    await page.locator('#tool6 summary', { hasText: 'Nøgletal' }).click();
    const levels = await page.locator('.metric-list .level').allTextContents();
    const order = {'Let': 1, 'Mellem': 2, 'Avanceret': 3};
    expect(levels.map(l => order[l])).toEqual([...levels.map(l => order[l])].sort((a, b) => a - b));
    await page.locator('#tool6 summary', { hasText: 'Ordbog' }).click();
    await expect(page.locator('.glossary')).toContainText('GAK');
    await expect(page.locator('.glossary')).toContainText('Vekselgebyr');
    await page.locator('#tool6 summary', { hasText: 'Risiko' }).click();
    await expect(page.locator('.sector-table tbody tr')).toHaveCount(11);
    await expect(page.locator('#tool6 [data-rule="BOERNE_TOTAL"]')).toHaveText('72.000');
});

test('prognosen kan slås fra og til, og valget huskes', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
        const nw = (date, value) => ({date, value, liquid:value, netCatKontanter:value, netCatAktier:0, netCatPension:0, netCatFrivaerdi:0, netCatAndet:0, debt:0});
        localStorage.setItem('netWorthHistory', JSON.stringify([nw('2025-09-30', 400000), nw('2026-09-30', 520000)]));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Formue', exact: true }).click();
    const toggle = page.getByRole('button', { name: 'Prognose' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => netWorthHistoryChart.data.datasets[2].data.length)).toBe(0);
    await expect(page.locator('#nwForecastNote')).toBeHidden();
    await page.reload();
    await page.getByRole('button', { name: 'Formue', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Prognose' })).toHaveAttribute('aria-pressed', 'false');
});

test('formue uden data: graferne viser ingen akser (ingen "jan. 1970"), kun "Ingen data endnu"', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => showSection('formue'));
    expect(await page.evaluate(() => [netWorthHistoryChart, netWorthCompositionChart].map(c => c.options.scales.x.display || c.options.scales.y.display))).toEqual([false, false]);
    await expect(page.locator('#netWorthHistoryChartEmpty')).toBeVisible();
    await page.evaluate(() => {
        localStorage.setItem('netWorthHistory', JSON.stringify([{date:'2026-08-31', value:1000, liquid:1000, netCatKontanter:1000, netCatAktier:0, netCatPension:0, netCatFrivaerdi:0, netCatAndet:0, debt:0}]));
        renderNetWorthHistory();
    });
    expect(await page.evaluate(() => netWorthHistoryChart.options.scales.x.display)).toBe(true);
});
