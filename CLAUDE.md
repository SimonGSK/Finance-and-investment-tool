# CLAUDE.md

## Commit messages

Follow Conventional Commits: start every commit subject with a type prefix.
These four are the usual choices:

- `feat:` a new feature or visible addition
- `fix:` a bug fix, or correcting something that looks or behaves wrong
- `refactor:` a code change that doesn't change behaviour
- `docs:` documentation only (README, comments, this file)

The other standard types are also fine when they fit better: `test:`, `style:`
(code formatting only, not visual design), `perf:`, `build:`, `ci:`, `chore:`
and `revert:`. Visual changes to the app go under `feat:` or `fix:`.
Example: `fix: Månedsoverblik shows the whole year when you pick a new year`

## Before committing

- Run `npm run stamp` after changing any CSS or JS file. `npm test` fails if the
  version stamps in `index.html` are out of date.
- Run `npm test` (unit tests) and, where possible, `npm run test:e2e` (browser tests).
