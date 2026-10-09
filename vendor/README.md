# Tredjepartsfiler

Filer fra andre projekter, som siden selv har liggende i stedet for at hente dem fra
en anden server (så besøgende ikke sender deres IP-adresse videre, og appen virker offline).

| Fil | Kilde | Licens |
|---|---|---|
| `chart-4.4.0.umd.min.js` | [Chart.js](https://www.chartjs.org) 4.4.0, hentet fra cdnjs | MIT – se `CHARTJS-LICENSE.md` |

Filen er tjekket mod cdnjs' offentliggjorte fingeraftryk:
`sha512-SIMGYRUjwY8+gKg7nn9EItdD8LCADSDfJNutF9TPrvEo86sQmFMh6MyralfIyhADlajSxqc7G0gs7+MwWF/ogQ==`
(`tests/assets.test.js` tjekker, at filen ikke er ændret).

Versionen står i filnavnet, så en ny version får et nyt navn, og browseren aldrig blander
en gammel cachet fil med en ny side.
