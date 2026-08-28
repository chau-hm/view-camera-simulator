# Landing FAQ — dedicated-page review fix

- Work identifier: PR #101 review fix.
- Branch/base: `feature/landing-faq` from `origin/main` at `b97f024134b5b697b8773370991fef068e7a0fc8`.
- Previous HEAD: `78e5383d2407622cbadf5436cb462fb7863445bc`.
- Objective: keep `/` concise and move the existing seven-question FAQ to `/faq`.

## Changed surface

- `FaqPage` mounts the existing native `<details>/<summary>` FAQ under `AppShell`.
- `AppShell` supplies the sole visible `Frequently Asked Questions` page `<h1>`; `FaqSection` no longer renders a duplicate heading.
- `SiteHeader` adds the active `FAQ` `NavLink`; both locales use the approved `FAQ` label.
- Home-page coverage asserts the FAQ is absent; route, disclosure, navigation, keyboard, and narrow-layout coverage targets `/faq`.

## Since previous review

- Removed FAQ rendering from `HomePage`.
- Added the public `/faq` route and primary-nav entry.
- Renamed FAQ-only CSS classes from `landing-faq-*` to page-neutral `faq-*`.
- Kept the English FAQ message subtree and existing `zh-HK` English fallback unchanged.

## Validation and known gaps

- Focused integration: pass, 4 files / 6 tests; full unit/integration: pass, 143 files / 1,355 tests.
- Focused Chromium: pass, public-nav/keyboard disclosure and narrow `/faq` overflow checks, 2 tests.
- Typecheck, lint, CSS structure check, production build, and `git diff --check`: pass.
- Renderer/WebGL E2E was not run because this correction changes only site UI, routing, copy wiring, and tests.
- The pre-existing `npm ci` failure for `eslint-plugin-react-hooks@^6.8.0` remains outside scope; no dependency files are to be changed.

## Reviewer focus

- Confirm `/` contains no FAQ section/content and `/faq` has one page `<h1>` plus all seven disclosures in the approved order.
- Confirm the header FAQ link uses client-side navigation and remains active on `/faq`.
- Confirm no simulator, optics, renderer, state, scene, task, or unrelated refactor files changed.
