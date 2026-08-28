# Dedicated FAQ page — final UI refinement

- Work identifier: PR #101 final UI refinement.
- Branch/base: `feature/landing-faq` from `origin/main` at `b97f024134b5b697b8773370991fef068e7a0fc8`.
- Previous HEAD: `dc176cf4084edae3c8ee4f916a86175b39978996`.
- Objective: keep `/` concise and present the existing seven-question FAQ as a polished, dedicated `/faq` page.

## Changed surface

- `FaqPage` uses the shared site shell with a route-local eyebrow, sole page `<h1>`, and i18n-backed subtitle.
- `FaqSection` keeps native `<details>/<summary>` disclosures and adds decorative Material Symbols, presentation-only numbering, and an intentional open/closed indicator.
- FAQ-only CSS adds centered page framing, readable answer width, card/open-state treatment, focus styling, and narrow-screen layout rules.
- Existing English FAQ content and the `zh-HK` English fallback remain unchanged apart from the new page-intro strings.

## Validation

- Focused integration: pass (`faq-page`, `home-page`, and `site-nav`; 3 tests).
- Full unit/integration: pass (143 files / 1,355 tests).
- Focused Chromium: pass (FAQ client-side navigation and keyboard disclosure; narrow `/faq` overflow; 2 tests).
- Typecheck, ESLint, CSS structure check, production build, and `git diff --check`: pass.
- Renderer/WebGL E2E was not run because this refinement changes only site UI and FAQ routing/content presentation.

## Known CI issue

- The pre-existing `npm ci` failure for `eslint-plugin-react-hooks@^6.8.0` remains outside scope; `package.json` and `package-lock.json` were not changed.

## Reviewer focus

- Confirm `/` remains FAQ-free and `/faq` has one page `<h1>` plus all seven disclosures in the approved order.
- Confirm question text remains separate from presentation numbering/icons and summaries remain the only interactive controls.
- Confirm no simulator, optics, renderer, state, scene, task, dependency, or unrelated refactor files changed.
