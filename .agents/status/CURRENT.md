# Current Work Handoff

## Work

PR / work identifier: PR 6C — Internationalization Foundation
Branch: `feature/i18n-foundation`
Base: `origin/main` @ `fa50d74300314cec15c43a3df7a4fce2a0a3fa1c`
Head convention: record the substantive implementation commit here; a final
status-only bookkeeping commit is intentionally not self-referenced.

## Objective

Establish the typed, localizable presentation foundation for the public
landing page and scene catalog without changing simulator teaching behavior,
scene/task identity, routes, curriculum order, optics, calibration, or
rendering.

## Implemented

- Added runtime `i18next` and `react-i18next` integration with bundled typed
  message modules under `src/i18n`.
- Added exactly the supported locales `en` and `zh-HK`; English is the default
  and fallback locale.
- Implemented deterministic locale resolution: valid persisted preference,
  then browser language (`zh`, `zh-*`, and `zh-TW` map to `zh-HK`), then English.
  Persistence uses `view-camera-simulator.locale` and safely tolerates blocked
  storage.
- Added a visible, accessible language selector to the shared public header;
  switching updates public copy immediately, persists the choice, preserves
  the current route, and synchronizes `document.documentElement.lang`.
- Migrated landing-page copy, shared public navigation, Focus CTA, Scenes page
  framing, generic public SceneCard actions, and the bounded site footer and
  desktop-experience notice surfaces.
- Converted public scene presentation metadata to semantic typed message keys;
  translated titles, descriptions, and topics for all six scenes at the
  Scenes-page presentation boundary.
- Kept `src/ui/copy.ts` and simulator teaching/task/readout/feedback/help copy
  unchanged. AppBrand is presentation-neutral with the existing English label
  as its default; SiteHeader supplies the localized public-shell label while
  direct simulator renders remain unchanged.
- Added `docs/I18N.md` documenting the locale, key, resource, and domain-state
  contract.

## Changed surface

- `package.json`, `package-lock.json`
- `docs/I18N.md`
- `src/i18n/**`
- `src/main.tsx`, `src/app/providers.tsx`, `src/app/pages.tsx`,
  `src/app/publicScenes.ts`
- `src/components/layout/LanguageSelector.tsx`, `AppBrand.tsx`,
  `SiteHeader.tsx`, `SiteFooter.tsx`
- `src/components/marketing/DesktopExperienceNotice.tsx`,
  `FocusCtaPanel.tsx`, `SceneCard.tsx`
- `src/styles/site-marketing.css`
- `src/tests/integration/i18n.test.tsx`,
  `src/tests/unit/localePreference.test.ts`,
  `src/tests/unit/i18nFallback.test.ts`
- `.agents/status/CURRENT.md`

Scene IDs, public order, availability, modes, guided-task IDs, thumbnails,
routes, task definitions, calibration, optics, rendering, and simulator copy
were intentionally unchanged. No i18n URL routing, language reload, or locale
files outside the bundled message modules were added.

## Validation

- `npm test`: passed; 110 test files, 1,040 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run check:css`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Focused review-fix tests: passed; 3 files, 5 tests.
- Pre-handoff `git status --short`: clean after the review-fix commit; the only
  subsequent worktree change is this handoff update.

## Not run

- E2E: not run; this PR changes bundled public presentation copy and locale
  state only, with focused UI/integration coverage and no route, scene-state,
  rendering, or WebGL behavior change.
- `npm audit`: not run as a separate validation command. The dependency
  install reported 7 audit findings (1 moderate, 6 high); no automatic audit
  remediation was attempted because dependency upgrades beyond i18n are out
  of scope.

## Key decisions

- English resource modules define the canonical typed message shape; `zh-HK`
  modules satisfy that shape and preserve the learning-model semantics using
  consistent Traditional Chinese terminology.
- Public scene constants store semantic keys only. Translation occurs in
  `ScenesPage`, keeping translated display text out of scene identity, routes,
  task logic, availability, and evaluator state.
- The selector is intentionally limited to the shared public shell. The
  full-bleed simulator retains existing English `UI_COPY`; later content PRs
  can migrate simulator teaching surfaces without coupling that work to the
  i18n foundation.
- No specialist packet was needed after orchestration inspection: the change
  does not cross optics, renderer, or task-domain contracts.

## Remaining risks / known gaps

- Simulator teaching, guided-task, feedback, control, help, readout, and
  diagnostic strings remain English and are deferred to later content PRs.
- The initial `zh-HK` wording has not had a separate native-language editorial
  review; terminology follows the canonical learning model and is covered by
  representative UI tests.
- Locale URL routing, additional locales, and any full-bleed simulator
  language control remain intentionally deferred.
- The npm install audit findings remain unresolved and should be handled in a
  separate dependency-security task.

## Reviewer focus

1. Verify the `en` and `zh-HK` message modules cover every migrated public
   surface with the same typed key shape and English fallback behavior.
2. Verify locale resolution priority, storage failure handling, immediate
   switching, document language synchronization, and selector accessibility.
3. Verify landing and Focus CTA English content remains semantically aligned
   with `docs/LEARNING_MODEL.md`, including fixed f/32.
4. Verify all six public catalog entries preserve Viewpoint/Framing,
   Front/Rear, perspective-control, and plane-of-sharp-focus semantics in
   both locales.
5. Verify translation happens at the presentation boundary and does not
   change scene IDs, order, availability, modes, task IDs, routes, or state.
6. Verify simulator `UI_COPY` and other deferred teaching surfaces were not
   migrated accidentally.
7. Verify no URL routing, reload, i18n-library overreach, or unrelated
   architecture changes entered the PR.

## Since previous review

- Addressed finding 1: `AppBrand` now accepts an optional `homeLabel` with the
  existing English accessible-name default, and `SiteHeader` passes
  `t("common.brand.homeLabel")`; simulator consumers remain unchanged.
- Addressed finding 2: polished only the zh-HK Focus CTA body and the
  Understanding Camera Movements description for natural wording while
  preserving the existing instructional semantics.

## Commit

Substantive implementation: `4afa44e4f4206edc348b18f33cf6678647fbf551`
Review-fix implementation: `33ff60f3e050fb8c473e8acd36d9b2e6f8710e13`

Final bookkeeping: the status-only commit that records this handoff update;
intentionally not self-referenced to avoid recursive commits.
