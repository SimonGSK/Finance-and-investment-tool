# CLAUDE.md

## Commit messages

Start every commit subject with one of these prefixes:

- `feat:` a new feature or visible addition
- `fix:` a bug fix, or correcting something that looks or behaves wrong
- `refactor:` a code change that doesn't change behaviour
- `docs:` documentation only (README, comments, this file)

Don't use other prefixes (such as `design:` or `test:`); pick the closest of the four.
Example: `fix: Månedsoverblik shows the whole year when you pick a new year`

## Before committing

- Run `npm run stamp` after changing any CSS or JS file. `npm test` fails if the
  version stamps in `index.html` are out of date.
- Run `npm test` (unit tests) and, where possible, `npm run test:e2e` (browser tests).
