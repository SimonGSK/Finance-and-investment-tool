// Røgtest af hele siden i en rigtig browser. Hver test svarer til en slags
// fejl, der faktisk er sket: JavaScript-fejl ved indlæsning, grafer der ikke
// passer til deres boks, vandret scroll på mobil, og data der blev overskrevet
// uden advarsel.
const { test, expect } = require('@playwright/test');

// Alle steder på siden, der kan vises: [sektion, funktion der viser værktøjet, nummer]
const VIEWS = [
    ['tools', 'showTool', 1], ['tools', 'showTool', 2], ['tools', 'showTool', 3],
    ['tools', 'showTool', 4], ['tools', 'showTool', 5],
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

test('ingen vandret scroll på en telefon', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto('/index.html');
    expect(await page.evaluate(() => window.innerWidth)).toBe(375);
    for(const view of VIEWS){
        await openView(page, view);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${view.join('/')}`).toBeLessThanOrEqual(1);
    }
    await context.close();
});

test('budget: en post tilføjes i dialogen, og diagrammets boks er lige så høj som kategorilisten', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Budget', exact: true }).click();
    await page.locator('.category-row', { hasText: 'Bolig' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: '+ Tilføj post' }).click();
    await dialog.getByLabel('Navn på post').fill('Husleje');
    await dialog.getByLabel('Beløb i kroner').fill('9000');
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
    await dialog.getByLabel('Bank- og opsparingskonti').fill('50000');
    await dialog.getByLabel('Værdi af aktier').fill('100000');
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
    await dialog.getByLabel('Værdi af aktier').fill('120000');
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
    await page.getByLabel('Boligpris (kr.)').fill('4500000');
    await page.getByLabel('Husleje pr. måned (kr.)').fill('16000');
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
    await page.getByLabel('Aktier & værdipapirer').fill('300000');

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

    await page.getByLabel('Din alder').fill('27');
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
