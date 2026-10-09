# Security

Økonomis is a static website with no server, no accounts and no database: everything a
visitor enters stays in their own browser (`localStorage`). The only data that leaves the
device is a feedback message, if the visitor chooses to send one (via Formspree). See
[`privatliv.html`](privatliv.html) for the full picture.

## Supported version

Only the live site at https://simongsk.github.io/Finance-and-investment-tool/ (the `main`
branch) is maintained. Fixes are published there; there are no older versions to patch.

## Reporting a vulnerability

Please report security problems privately, not in a public issue:

1. Use GitHub's private reporting: the **Security** tab of this repository → **Report a vulnerability**.
2. If that isn't available, send a short message through **Giv feedback** on the site saying
   you've found a security problem and how to reach you. Don't include the details there.

Please include what you found, how to reproduce it, and what an attacker could do with it.
This is a personal project, so replies are best effort, usually within a week.

## Things that are by design

- **The code lock is a screen lock, not encryption.** It hides the page from people looking at
  the device; the numbers are still in the browser's storage on that device. Only a salted
  PBKDF2 hash of the code is stored.
- **The Formspree form address in `js/feedback.js` is public.** Form endpoints are meant to be;
  spam is limited by Formspree's own filtering and a honeypot field.
- **Shared calculator links contain the numbers** in the part after `#`, which is never sent to
  a server. Trackers (net worth, portfolio, budget, loans) can't be shared as links.
