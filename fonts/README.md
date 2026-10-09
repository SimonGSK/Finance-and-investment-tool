# Skrifttyper

Økonomis bruger tre skrifttyper, som ligger her, så siden ikke henter noget fra Google
(besøgendes IP-adresse sendes ikke videre) og virker offline. Filerne er latin-udsnittet
fra Google Fonts, som dækker dansk (æ, ø, å) og tegn som –, • og −.

| Fil | Skrifttype | Bruges til | Licens |
|---|---|---|---|
| `newsreader-variable.woff2` | [Newsreader](https://github.com/productiontype/Newsreader), vægt 400–600 | Overskrifter, store tal, navnet | SIL OFL 1.1 – `OFL-newsreader.txt` |
| `manrope-variable.woff2` | [Manrope](https://github.com/sharanda/manrope), vægt 400–700 | Brødtekst, menu, knapper | SIL OFL 1.1 – `OFL-manrope.txt` |
| `ibm-plex-mono-{400,500,600}.woff2` | [IBM Plex Mono](https://github.com/IBM/plex) | Beløb i tabeller, grafer og felter | SIL OFL 1.1 – `OFL-ibmplexmono.txt` |

`@font-face` står øverst i `styles.css`, og `index.html` henter filerne med det samme (`preload`).
