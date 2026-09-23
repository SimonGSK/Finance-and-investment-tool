# Økonomiværktøjer

A set of Danish personal-finance calculators in a single static web page: compare investment account types, plan monthly investing and FIRE, track a portfolio, build a budget, and follow your net worth over time.

**Live:** https://simongsk.github.io/Finance-and-investment-tool/

All data stays in your browser's `localStorage`. There are no accounts, no server, and nothing is sent anywhere.

## The tools

### Investering

**ASK vs. Aktiedepot** — Compares a lump sum in a Danish stock savings account (*Aktiesparekonto*, flat 17% yearly tax on gains, 174.200 kr. deposit limit) against the same sum in a regular depot (*Aktiedepot*, 27%/42% progressive tax on realised gains, no limit). The depot side uses the tax-optimal realisation strategy described below. Supports paying the ASK tax from outside the account, the doubled 27% threshold for married couples, and inflation-adjusted ("today's purchasing power") display.

**Aktiedepot: fast + månedligt** — A regular depot with an optional starting amount plus a fixed monthly contribution, again with the optimal realisation strategy. Shows total invested, net profit and percentage gain.

**FIRE-beregner** — How many years until a portfolio can sustain your yearly expenses under the 4% rule, given a starting amount, monthly contributions, expected return and inflation. The FIRE target grows with inflation, so the answer is in real terms.

**Pension** — Projects a private pension pot to retirement after costs and the 15.3% PAL tax, then shows the monthly payout before and after tax, in today's money. Shows your folkepension age from your birth year (67–70 is legislated; higher ages are projections and labelled as such).

**Porteføljetracker** — Log your portfolio's value, cash, trades, deposits and dividends over time. Charts value vs. cumulative deposits, monthly buys/sells, and total return. Import and export as CSV.

### Bolig & lån

**Hvor meget kan jeg låne?** — The highest home price you can buy given three limits: savings covering at least a 5% down payment plus purchase costs (2026 tinglysning fees included), your debt factor, and optionally a maximum monthly payment. Shows which limit binds and a full breakdown of loans and monthly payments after interest deduction.

**Køb eller leje?** — Year-by-year net worth when buying versus renting and investing the difference. Includes mortgage and bank loan, contribution fees, interest deduction, property tax, maintenance, price growth and selling costs.

**Gældsafvikling** — Enter your debts and an extra monthly payment to see when you're debt-free and how much interest you pay with the avalanche method (highest rate first), the snowball method (smallest balance first), or minimum payments only.

### Budget

Build a monthly budget from itemised posts in 15 categories plus your own, each edited in its own dialog. Posts can be monthly, quarterly, half-yearly or yearly. Shows the split across needs / wants / savings against the 50/30/20 rule, and projects yearly savings.

### Formue

Enter your assets (cash, stocks, pension, home equity, other) and debt to get your net worth and liquid wealth. Save dated snapshots to build a history — or use **Månedsstatus** to save the same date into both the Formue history and the portfolio tracker in one go — see how the composition has changed over time, track milestones, and compare your net worth to other Danes your age (based on CEPOS's summary of Danmarks Statistik wealth data). Plus a light-hearted "your wealth equals *n* bananas / iPhones / Porsches" comparison.

### Settings

Light or dark theme (follows the system by default), and a one-file JSON backup/restore of all Budget, Formue and Portefølje data.

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

Several tests pin exact known outputs (for example, 25 years at 8% from 100.000 kr. gives 496.847 kr. in a depot with harvesting from year 19), so any change to the maths is caught immediately. The suite runs automatically on every push and pull request via GitHub Actions.

## Project layout

```
index.html              The whole UI (all tools are sections of one page)
styles.css              Design tokens (dark + light themes), layout, components
js/calc.js              Pure calculation logic - the only file the tests import
js/shared.js            DOM helpers: slider/number binding, CSV download, chart colours and options
js/ui.js                Dialogs, confirmations, undo toasts, Danish date formatting
js/tool1-ask-akt.js     ASK vs. Aktiedepot
js/tool2-monthly.js     Aktiedepot with monthly contributions
js/tool3-fire.js        FIRE calculator
js/tool4-portfolio.js   Portfolio tracker
js/pension.js           Pension
js/loan-capacity.js     Hvor meget kan jeg låne?
js/buy-vs-rent.js       Køb eller leje?
js/debt-payoff.js       Gældsafvikling
js/monthly-status.js    Månedsstatus (saves to both trackers)
js/share.js             Shareable calculator links
js/budget.js            Budget
js/net-worth.js         Formue: net worth, history, milestones, comparison
js/navigation.js        Tab switching, settings panel, full backup import/export
js/theme.js             Theme switching and re-theming charts
tests/calc.test.js      Test suite for calc.js
src/Main.java           The original console prototype of tools 1 and 2 (Java 21)
```

## Updating for a new tax year

Every yearly figure — ASK limit, 27%/42% threshold, tinglysning, PAL, pension limits, lending rules, interest deduction — sits in one block at the top of [`js/calc.js`](js/calc.js). The explanatory text on the page reads its numbers from that block (`data-rule` in the HTML), so a yearly update is: edit the block, adjust the tests that pin exact values, run `npm test`.

## Sharing a calculation

Each calculator has a **Del beregning** button that copies a link reopening it with the same inputs. The inputs live after the `#` in the link, which browsers never send to a server. The trackers, budget and debt list can't be shared this way — they're personal data, and a link must never overwrite what someone has saved.

## Assumptions and disclaimer

- Tax rules reflect Danish law as of 2026: 17% flat ASK tax, 27%/42% progressive depot tax with a 79.400 kr. threshold, and a 174.200 kr. ASK deposit limit; 15.3% PAL tax; tinglysning of 1.850 kr. + 0.6% (deed) and 1.825 kr. + 1.25% (mortgage deeds); interest deduction of ~33% up to 50.000 kr. per adult and ~25% above. These figures are normally adjusted yearly and are **not** indexed in this tool.
- All projections assume a constant annual return. Real markets do not move in a straight line.
- The wealth comparison uses a 16-row extract of CEPOS's age-by-age table, interpolated linearly, and is for curiosity only.
- This is a personal-finance calculator, **not financial or tax advice**. Consult a professional before making investment decisions.

## License

[MIT](LICENSE) — free to use, copy, modify and distribute, including commercially, as long as the original copyright notice is included.
