# Økonomis

A set of Danish personal-finance calculators in a single static web page: compare investment account types, plan monthly investing and FIRE, track a portfolio, build a budget, and follow your net worth over time.

**Live:** https://simongsk.github.io/Finance-and-investment-tool/

All data stays in your browser's `localStorage`. There are no accounts, no server, and nothing is sent anywhere.

## The tools

The menu has **Oversigt** at the top, then three groups: **Værktøjer** (Investering, Bolig & lån, Budget), **Trackers** (Formue, Månedsoverblik, Portefølje) and **Hjælp** (Indstillinger, Hjælp og spørgsmål, Giv feedback).

### Oversigt

The start page: net worth (with the change since the last status), the portfolio (this year's return), the monthly budget and how many months the emergency fund covers; net worth over time (all data by default, or the last 1, 3, 5, 10 … years — only periods your data covers are offered), goals, how assets are split, a short list of next steps (save this month's status, build a budget, take a backup …) and shortcuts to every tool. **Tilpas oversigt** chooses the four key figures at the top, grouped by where the number comes from: Formue (net worth, liquid wealth, pension, debt), Månedsoverblik (average growth per month, growth in % over the last year, growth this year), Portefølje (value, total invested, total return, dividends, return per year) and Budget (budget per month, emergency fund). On phones and tablets the chart comes first and the key figures under it.

### Investering

**ASK vs. Aktiedepot** — Compares a lump sum in a Danish stock savings account (*Aktiesparekonto*, flat 17% yearly tax on gains, 174.200 kr. deposit limit) against the same sum in a regular depot (*Aktiedepot*, 27%/42% progressive tax on realised gains, no limit). The depot side uses the tax-optimal realisation strategy described below. Supports paying the ASK tax from outside the account, the doubled 27% threshold for married couples, and inflation-adjusted ("today's purchasing power") display.

**Aktiedepot: fast + månedligt** — A regular depot with an optional starting amount plus a fixed monthly contribution, again with the optimal realisation strategy. Shows total invested, net profit and percentage gain.

**FIRE-beregner** — How many years until a portfolio can sustain your yearly expenses under the 4% rule, given a starting amount, monthly contributions, expected return and inflation. The FIRE target grows with inflation, so the answer is in real terms. **Hent mine tal** fetches your numbers from Formue (cash and shares by default; pension and home equity can be ticked) and your yearly spending and monthly saving from the budget.

**Pension** — Projects a private pension pot to retirement after costs and the 15.3% PAL tax, then shows the monthly payout before and after tax, in today's money. Shows your folkepension age from your birth year (67–70 is legislated; higher ages are projections and labelled as such).

**Porteføljetracker** — Log your portfolio's value, cash, trades, deposits and dividends over time. Charts value vs. cumulative deposits, monthly buys/sells, and total return. Import and export as CSV. The *Tilføj datapunkt* panel can be folded away to its heading, and the choice is remembered.

**Tips & viden** — A beginner's guide in foldable sections: before you start, account types (aktiedepot, ASK, pension, børneopsparing), tax and the positive-list lookup (search Skattestyrelsens list by ISIN or name, loaded only when you search), shares vs funds vs ETFs vs bonds, sectors and their volatility, risk, a glossary (afkast, udbytte, GAK …) and company key figures from easy (market value, revenue) to technical (EBITDA, free cash flow, net debt/EBITDA). General knowledge, not advice.

### Bolig & lån

**Hvor meget kan jeg låne?** — The highest home price you can buy given three limits: savings covering at least a 5% down payment plus purchase costs (2026 tinglysning fees included), your debt factor, and optionally a maximum monthly payment. Shows which limit binds and a full breakdown of loans and monthly payments after interest deduction.

**Køb eller leje?** — Year-by-year net worth when buying versus renting and investing the difference. Includes mortgage and bank loan, contribution fees, interest deduction, property tax, maintenance, price growth and selling costs.

**Gældsafvikling** — Enter your debts and an extra monthly payment to see when you're debt-free and how much interest you pay with the avalanche method (highest rate first), the snowball method (smallest balance first), or minimum payments only.

### Budget

Build a monthly budget from itemised posts in 15 categories plus your own, each edited in its own dialog. Posts can be monthly, quarterly, half-yearly or yearly. Shows the split across needs / wants / savings against the 50/30/20 rule, and projects yearly savings. **Udskriv overblik** prints (or saves as PDF) a one-page overview of net worth, budget, loans, goals and portfolio; **Download budget** saves a CSV (opens in Excel or Numbers) with every post per month and per year plus a 50/30/20 summary, e.g. to show a financial advisor.

### Månedsoverblik

Pick a year and a month (or the whole year) and see how each part of your net worth changed in that period: net worth, liquid wealth, pension, cash, shares, home equity, other and debt, each with start, end, change in kr. and %. A month is compared with the previous monthly status (the text says which dates, so a gap is visible); a whole year runs from the last status before 1 January. The portfolio's return for the same period comes from the portfolio tracker, with your own deposits taken out. Each category has a small trend line over the last year, and the year's best and worst month are shown under the key figures (a month after a skipped status counts as one step, e.g. "aug.–sep. (2 mdr.)"). Choosing *Hele året* shows **Dit år i tal**: the year's growth, best and worst month, months with growth, the portfolio's return, deposits and dividends, and *Del som billede*, which draws the year as a 1080 × 1350 image to share or save, with or without amounts.

### Formue

Enter your assets (cash, stocks, pension, home equity, other) and debt to get your net worth and liquid wealth. Save a dated *månedsstatus* to build a history (rows can be edited or deleted; each row shows the change since the previous one, and *Bedste perioder* lists the three biggest increases; *År for år* sums up each calendar year, and a dashed forecast on the history chart (can be switched off) continues the last 12 months' pace two years ahead, with when the next milestone is reached — all calculated on the fly, not stored) — or use **Månedsstatus** to save the same date into both the Formue history and the portfolio tracker in one go — see how the composition has changed over time, set your own goals (with the monthly saving needed to reach them by a deadline and whether your pace over the last year is enough), track milestones, and compare your net worth to other Danes of exactly your age using CEPOS's per-age table (2024 data at 2026 levels, pension counted after 40% tax, as CEPOS does). The full table opens with your age highlighted. Plus a light-hearted "your wealth equals *n* bananas / iPhones / Porsches" comparison. The emergency-fund bar runs from 0 to 9 months with the recommended 3–6 months marked, and *Tilføj datapunkt* folds away like in the portfolio tracker.

### Everywhere

Every field has a small **?** that explains it, and each tool has a foldable *Hvad gør dette værktøj?* box. Number fields accept simple arithmetic — type `12.500 + 3.200` or `450 * 12` and the result is filled in when you press Enter or leave the field. Danish (`1.000`, `2,5`) and English (`2.5`) decimals both work, and the arrow keys still step the value.

### Settings

**Indstillinger** in the menu opens a dialog: light or dark theme (follows the system by default), and a one-file JSON backup/restore of all Budget, Formue and Portefølje data. An optional reminder (on by default) appears around each month-end for people who track their numbers — from the last three days of a month to the 10th of the next — and opens *Månedsstatus* on the month's last day.

## Design

The page is **responsive**: one layout that adapts to the space available rather than separate designs per device.

- **Menu.** A floating menu card on the left; below 900 px it becomes a menu button that slides the menu in from the left.
- **Stacking by available space.** The tools, Budget and Formue use CSS container queries: when the content area (not the screen) is narrower than about 1150 px, the chart moves under the inputs, so it never gets squeezed next to the menu.
- **Phones (below 640 px).** Body text is about 14.5 px and small text never under 12 px, in line with Apple's and Material Design's type scales. Form fields stay at 16 px so iPhone doesn't zoom in. Cards are tighter, charts have a landscape shape (roughly 4:3), and long explanations are folded.
- **Themes.** The light theme is forest green on warm off-white; the dark theme is black and greys with the same green and red.

All colours, spacing and radii are variables at the top of [`styles.css`](styles.css). The redesign (top bar, menu card, Oversigt, themes and phone adjustments) is the last part of the file, after the original component styles.

## The optimal realisation strategy

For a regular depot, gains are only taxed when realised — at 27% up to a yearly threshold (79.400 kr. in 2026) and 42% above it. "Harvesting" means selling and immediately re-buying up to that threshold each year, so the gain is taxed at 27% now rather than partly at 42% later. But harvesting early also means paying tax earlier and losing compounding on it.

Rather than assume earlier is always better, the tool tries every possible year to start harvesting and picks the one that produces the highest final value. It then reports how much that beats never selling until the last year.

## Running it locally

It is plain HTML, CSS and JavaScript with no build step. Serve the folder over HTTP rather than opening `index.html` directly, because `localStorage` behaves inconsistently on `file://` URLs:

```bash
npm start
```

Then open http://localhost:4173. (`npm start` just runs `python3 -m http.server 4173`; any static server works.) [Chart.js](https://www.chartjs.org/) and the fonts load from CDNs, so an internet connection is needed for those.

## Tests

The financial calculations, the tax and lending rules, the percentile lookup and the Danish number/CSV parsers live in [`js/calc.js`](js/calc.js), which has no DOM dependencies and is tested with Node's built-in test runner — no packages to install.

```bash
npm test
```

Several tests pin exact known outputs (for example, 25 years at 8% from 100.000 kr. gives 496.847 kr. in a depot with harvesting from year 19), so any change to the maths is caught immediately. Browser tests in [`tests/e2e/`](tests/e2e/) run the whole page in Chromium with [Playwright](https://playwright.dev/). They check what unit tests can't see: that every section loads without JavaScript errors, that every chart exactly fills its box, that nothing scrolls sideways on a phone, and flows such as the budget dialog, the monthly-status overwrite warning, share links, syncing from a file, the menu, the settings dialog, the period picker and the foldable panels.

```bash
npx playwright install chromium   # once
npm run test:e2e
```

Both suites run automatically on every push and pull request via GitHub Actions; failing browser runs upload a trace you can open with `npx playwright show-trace`.

The browser tests run on desktop Chrome, and the tests tagged `@mobil` also on an iPhone and iPad in WebKit (Safari's engine — it lays out grids differently from Chrome) and a small Android phone. They check for horizontal scroll, content cut off at a panel's edge, form fields under 16 px (iPhone zooms into those), that long explanations are folded on phones, that charts on phones are wider than they are tall, and that the overview puts its chart first on one-column screens — also after visiting another page and coming back. Install the browsers once with `npx playwright install chromium webkit`.


**After changing CSS or JS, run `npm run stamp`.** It gives `styles.css` and every `js/` file in `index.html` a version stamp from the file's content (`styles.css?v=42c619c5`), so a new page never gets combined with an old, cached stylesheet or script. `tests/assets.test.js` fails if a stamp is out of date. The service worker also asks the server whether a file changed (`cache: 'no-cache'`) instead of trusting the browser cache.

## Project layout

```
index.html              The whole UI (all tools are sections of one page)
styles.css              All styling: tokens (dark + light themes), layout, components, phone and print
js/calc.js              Pure calculation logic - the only file the tests import
js/shared.js            DOM helpers: slider/number binding, CSV download, chart colours and options
js/ui.js                Dialogs, confirmations, undo toasts, foldable panels, history tables, Danish dates
js/field-help.js        The "?" explanations next to each field
js/number-fields.js     Number fields you can calculate in (12.500 + 3.200, 450 * 12)
js/fold.js              Folds long explanations on phones
js/tool1-ask-akt.js     ASK vs. Aktiedepot
js/tool2-monthly.js     Aktiedepot with monthly contributions
js/tool3-fire.js        FIRE calculator
js/tool4-portfolio.js   Portfolio tracker
js/pension.js           Pension
js/etf-tax.js           Positive-list lookup in Tips & viden
data/positivliste.json  Skattestyrelsens positive list (built by scripts/build-positivliste.py)
js/loan-capacity.js     Hvor meget kan jeg låne?
js/buy-vs-rent.js       Køb eller leje?
js/debt-payoff.js       Gældsafvikling
js/monthly-status.js    Månedsstatus (saves to both trackers)
js/share.js             Shareable calculator links
js/budget.js            Budget
js/net-worth.js         Formue: net worth, history, milestones, comparison
js/month-overview.js    Månedsoverblik: change per category for a month or a year
js/goals.js             Formue goals
js/navigation.js        Menu, sections and tools, page header, settings dialog, reminders
js/sync.js              Backup file and syncing between devices (merge, not overwrite)
js/feedback.js          Feedback button and form (sent via Formspree)
js/pwa.js               "Install as app" button; registers the service worker
js/report.js            Printable one-page overview (Udskriv overblik)
js/overview.js          Oversigt (start page)
js/overview-cards.js    The key figures you can choose on Oversigt, and the chooser
sw.js                   Service worker: network first, cached copy offline
manifest.webmanifest    App name, colours and icons
icons/                  App icons: icon.svg is the source (the Newsreader O traced as outlines, so it needs no font);
                        the PNGs are rendered from it with scripts/render-icons.js
js/theme.js             Theme switching and re-theming charts
tests/calc.test.js      Unit tests for calc.js
tests/assets.test.js    Checks that the version stamps in index.html are up to date
scripts/stamp-assets.js Version-stamps styles.css and js/ in index.html (npm run stamp)
tests/e2e/              Browser tests (Playwright)
src/Main.java           The original console prototype of tools 1 and 2 (Java 21)
```

## Updating for a new tax year

Every yearly figure — ASK limit, 27%/42% threshold, tinglysning, PAL, pension limits, lending rules, interest deduction — sits in one block at the top of [`js/calc.js`](js/calc.js). The explanatory text on the page reads its numbers from that block (`data-rule` in the HTML), so a yearly update is: edit the block, adjust the tests that pin exact values, run `npm test`.

**The positive list** (Skattestyrelsens *Liste over aktiebaserede investeringsselskaber*) is published as an Excel file, usually updated during the year. To refresh `data/positivliste.json`, download the newest file from [skat.dk](https://skat.dk/erhverv/ekapital/vaerdipapirer/beviser-og-aktier-i-investeringsforeninger-og-selskaber-ifpa) and run:

```
python3 scripts/build-positivliste.py <file.xlsx> <year> <published-date>
```

It uses only Python's standard library and keeps the ISIN, name, tax residence and the first year each fund was registered.

## Sharing a calculation

Each calculator has a **Del beregning** button that copies a link reopening it with the same inputs. The inputs live after the `#` in the link, which browsers never send to a server. The trackers, budget and debt list can't be shared this way — they're personal data, and a link must never overwrite what someone has saved.

## Syncing between devices

There's no server, so phone and computer share data through a file. **Gem mine data** saves everything in one JSON file — on a phone through the share sheet (Google Drive, iCloud Files, AirDrop), on a computer as a download. **Hent data fra fil** on the other device doesn't overwrite: `planSync`/`applySync` in `calc.js` merge the histories date by date, and where a part differs (budget, loans, goals …) the user picks which version to keep, with the most recently changed one suggested. To know what's newest, `sync.js` records when each part last changed (`syncTimes`, via a wrapper around `localStorage.setItem` that only stamps real changes). Parts that exist only on the device are kept, and the whole import can be undone.

## Install as an app

The site is a Progressive Web App. In Chrome, Edge or on Android, **Installér som app** in the settings panel installs it; on iPhone/iPad it's Safari's **Share → Add to Home Screen** (the button explains this). The service worker (`sw.js`) fetches from the network first, so a new version is picked up as soon as you're online, and falls back to cached copies offline. On install it caches every file `index.html` refers to, so nothing needs updating when files are added. Note that on iOS the installed app has its own storage, separate from Safari — move data with *Gem mine data / Hent data fra fil*.

## Feedback

**Giv feedback** in the menu opens a feedback form. Messages are sent to [Formspree](https://formspree.io), which emails them on and keeps them in a dashboard. Only what the visitor writes is sent (plus which tool they were on) — never their budget or other numbers. The button is hidden until an endpoint is set: create a free form on formspree.io and put its address in `FEEDBACK.endpoint` at the top of `js/feedback.js`. The form shows a short privacy note (what is sent, to whom, and that messages are deleted within 12 months) — so **delete messages older than 12 months in the Formspree dashboard**, and delete a message sooner if someone asks.

## Assumptions and disclaimer

- Tax rules reflect Danish law as of 2026: 17% flat ASK tax, 27%/42% progressive depot tax with a 79.400 kr. threshold, and a 174.200 kr. ASK deposit limit; 15.3% PAL tax; tinglysning of 1.850 kr. + 0.6% (deed) and 1.825 kr. + 1.25% (mortgage deeds); interest deduction of ~33% up to 50.000 kr. per adult and ~25% above. These figures are normally adjusted yearly and are **not** indexed in this tool.
- All projections assume a constant annual return. Real markets do not move in a straight line.
- The wealth comparison uses CEPOS's full table (one row per age, 18–90; 2024 data projected to 2026 levels, rounded to 1.000 kr.). Pension is counted after a notional 40% tax, as in CEPOS's figures, so the comparable net worth can be lower than the one shown in Formue. For curiosity only.
- This is a personal-finance calculator, **not financial or tax advice**. Consult a professional before making investment decisions.

## License

© 2026 Simon Grynnerup Skouboe. **All rights reserved** — see [LICENSE](LICENSE). You are welcome to use the website, but the code, design and text may not be copied, modified or redistributed without permission. Versions published before 24 September 2026 were MIT-licensed, and copies obtained under that license stay under it.
