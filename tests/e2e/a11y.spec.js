// Tilgængelighed: axe-core (samme motor som Lighthouse og browsernes udviklerværktøjer)
// tjekker hver side og dialog for WCAG 2.1 A og AA - fx kontrast, navne på knapper og felter,
// og at alt kan nås med tastaturet. Begge temaer, og telefonens bundmenu og ark.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const VIEWS = [['overview'], ['tools', 'showTool', 1], ['tools', 'showTool', 2], ['tools', 'showTool', 3], ['tools', 'showTool', 5],
    ['tools', 'showTool', 6], ['tools', 'showTool', 7], ['housing', 'showHousingTool', 1], ['housing', 'showHousingTool', 2],
    ['housing', 'showHousingTool', 3], ['budget'], ['formue'], ['month'], ['portfolio']];

/** Kører axe og giver en kort, læsbar liste over fejl (tom, når alt er i orden). */
async function violations(page, where){
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    return result.violations.flatMap(v => v.nodes.map(n => `${where}: ${v.id} – ${n.target.join(' ')} – ${(n.any[0] || n.all[0] || n.none[0])?.message || v.help}`));
}

/** Et par måneder med tal, så tabeller, grafer og kort har indhold at tjekke. */
async function withData(page, theme){
    await page.goto('/index.html');
    await page.evaluate(theme => {
        const nw = (date, value) => ({date, value, liquid: value * 0.6, netCatKontanter: value * 0.3, netCatAktier: value * 0.3, netCatPension: value * 0.4, netCatFrivaerdi: 0, netCatAndet: 0, debt: 20000});
        localStorage.setItem('netWorthHistory', JSON.stringify([nw('2026-06-30', 480000), nw('2026-07-31', 500000), nw('2026-08-31', 520000)]));
        localStorage.setItem('portfolioHistory', JSON.stringify([{date: '2026-07-31', value: 300000, deposit: 250000, dividend: 0}, {date: '2026-08-31', value: 310000, deposit: 255000, dividend: 500}]));
        localStorage.setItem('budgetItems', JSON.stringify({catBolig: [{label: 'Husleje', amount: 10000}], catOpsparing: [{label: 'Aktier', amount: 3000}]}));
        localStorage.setItem('theme', theme);
        localStorage.setItem('hasSeenIntroBanner', 'true');
    }, theme);
    await page.reload();
}

for(const theme of ['dark', 'light']){
    test(`tilgængelighed (${theme === 'dark' ? 'mørkt' : 'lyst'} tema): alle sider og dialoger`, async ({ page }) => {
        await withData(page, theme);
        const found = [];
        for(const [section, fn, n] of VIEWS){
            await page.evaluate(([s, f, n]) => { showSection(s); if(f) window[f](n); }, [section, fn, n]);
            await page.waitForTimeout(100);
            found.push(...await violations(page, section + (n || '')));
        }
        // Dialogerne: indstillinger, månedsstatus, hjælp, feedback og genveje.
        for(const [name, open] of [['indstillinger', () => toggleSettings(true)], ['månedsstatus', () => openMonthlyStatus()],
            ['hjælp', () => openHelp()], ['feedback', () => openFeedbackDialog()], ['genveje', () => openShortcutsDialog()]]){
            await page.evaluate(open);
            await page.waitForTimeout(150);
            found.push(...await violations(page, name));
            await page.keyboard.press('Escape');
        }
        await page.goto('/privatliv.html');
        found.push(...await violations(page, 'privatliv'));
        expect(found).toEqual([]);
    });
}

test('tilgængelighed på telefon: bundmenuen og arkene @mobil', async ({ page }) => {
    await withData(page, 'dark');
    const phone = await page.evaluate(() => window.innerWidth <= 640);
    test.skip(!phone, 'bundmenuen findes kun på telefoner');
    const found = await violations(page, 'oversigt');
    for(const kind of ['trackers', 'tools', 'more']){
        await page.evaluate(k => openNavSheet(k), kind);
        await page.waitForTimeout(250);
        found.push(...await violations(page, 'ark ' + kind));
        await page.keyboard.press('Escape');
    }
    expect(found).toEqual([]);
});
