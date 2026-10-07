# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository. We aim to reply within 7 days.

## What to know when you deploy

- The site is static and public. Everything in `trip.config.json` and `data/` is visible to anyone with the URL.
  Do not put secrets, private notes or personal data there.
- Votes have **no authentication**. With the `local` store they never leave the browser. With `supabase`, anyone
  who has the site URL and the trip id can vote under any name (see docs/votes-supabase.md). Use a long random
  trip id and share the link only with your group.
- The Supabase **anon** key is public by design. Never use the `service_role` key in the app.
- Text from listings is rendered as text (React escapes it), and map popups escape HTML explicitly.
- Agents must not store cookies, tokens or account data in the repo (see AGENTS.md).
