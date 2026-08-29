# PR #101 — FAQ final correction

- Branch: `feature/landing-faq`.
- Synchronization base: `origin/main` at `8f72c43542f2cb5bfb1f2f213a74460e1adfe376`, merged in `926a9ee`.
- FAQ implementation commit: `8d6c950`.
- Objective: keep `/` concise, retain the redesigned `/faq` accordion, and scope the English fallback explicitly for assistive technology.

## Current surface

- Removed the obsolete FAQ eyebrow/subtitle markup and `home.faq.eyebrow` / `home.faq.subtitle` keys.
- Wrapped the FAQ page H1, questions, and answers in `lang="en"`; the document remains locale-controlled by the existing i18n system.
- Kept the seven approved FAQ items, order, native disclosures, numbering, icons, open-state accent, focus styling, and responsive layout unchanged.

## Validation

- Full unit/integration: pass (144 files / 1,364 tests).
- Focused FAQ/home/navigation/i18n integration: pass (4 files / 7 tests).
- Typecheck, ESLint, CSS structure check, production build, and `git diff --check`: pass.
- Focused Chromium: pass (FAQ navigation/keyboard behavior and 390px overflow; 2 tests).
- Renderer/WebGL E2E not run; no renderer behavior changed.

## Known gap

- Hosted CI remains expected to fail at `npm ci` for `eslint-plugin-react-hooks@^6.8.0`; dependency files were not changed.

## Scope note

- The only merge conflict was this bookkeeping file; it was first resolved to latest `origin/main`, then overwritten after implementation and validation. Incoming simulator/render changes were not manually reinterpreted or modified.
