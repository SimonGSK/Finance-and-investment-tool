# Stock Portfolio Tool

A pair of calculators for comparing Danish investment account types — a **Danish stock savings account (Aktiesparekonto / ASK)** versus a **regular stock trading account (Aktiedepot)** — including an optimal tax-realization strategy for the regular depot.

The project has two parts:

1. **A Java console application** (`src/Main.java`) — the original command-line version, with a small tool menu.
2. **An interactive web dashboard** (`ask-vs-akt-graf.html`) — a browser-based version of the same calculations, with sliders and live charts. (https://simongsk.github.io/Stock-portfolio-tool/).

## What it does

Danish investors can hold stocks either in an **ASK** (flat 17% yearly tax on gains, but capped at a 174,200 kr. deposit limit in 2026) or a regular **depot** (27%/42% progressive tax, only on realized gains, no deposit limit). Deciding between the two — and figuring out *when* to realize gains on a regular depot to minimize tax — isn't obvious. This tool runs the numbers for you.

**Tool 1 — ASK vs. Aktiedepot**
Compares a lump-sum investment in an ASK against the same lump sum in a regular depot, using the tax-optimal realization strategy for the depot (see below).

**Tool 2 — Aktiedepot with a lump sum + monthly contributions**
Models a regular depot with an optional starting amount plus a fixed monthly contribution, again using the optimal realization strategy — since a regular depot has no deposit limit, this covers scenarios an ASK can't.

**Optimal realization strategy**
For the regular depot, the tool searches every possible year to start "harvesting" gains (selling and immediately re-buying, up to the 79,400 kr. 27%-tax threshold each year) and picks whichever start year actually produces the highest final value — rather than assuming earlier is always better. It also shows how much this strategy saves compared to never selling until the final year.

## Running the Java console app

Requires Java 21+ (uses `Locale.of(...)` and switch expressions).

```bash
cd src
javac Main.java
java Main
```

You'll get a menu to choose between the two tools, enter your numbers, and re-run with different values without restarting.

## Using the web dashboard

`ask-vs-akt-graf.html` is a single, self-contained file — no build step, no server required.

```bash
open ask-vs-akt-graf.html   # macOS
# or just double-click the file / drag it into a browser
```

It uses [Chart.js](https://www.chartjs.org/) (loaded from a CDN) and needs an internet connection to load fonts and the charting library.

## Assumptions & disclaimer

- Tax rules reflect Danish law as of 2026: 17% flat ASK tax, 27%/42% progressive depot tax with a 79,400 kr. threshold, and a 174,200 kr. ASK deposit limit. These thresholds are typically adjusted yearly and are **not** inflation-indexed in this tool.
- All figures are nominal projections based on a constant assumed annual return — real markets don't move in a straight line.
- This is a personal finance calculator, **not financial or tax advice**. Consult a professional before making investment decisions.

## Tech stack

- Java 21 (console app)
- Vanilla HTML/CSS/JavaScript + Chart.js (web dashboard) — no framework, no build tooling

## License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details. In short: you're free to use, copy, modify, and distribute this code, including commercially, as long as the original copyright notice is included.
