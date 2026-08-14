# Current Work Handoff

## Work

PR / work identifier: PR 6B — Landing Page + Scene Catalog Alignment
Branch: `content/landing-scene-catalog-alignment`
Base: `origin/main` @ `dffdd92c00107d87785cf86f9c96753145c7d51b`
Head convention: record the substantive implementation commit here; a final
status-only bookkeeping commit is intentionally not self-referenced.

## Objective

Align the public landing-page narrative, Focus CTA, Scenes introduction, and
six public scene catalog entries with `docs/LEARNING_MODEL.md` without
changing simulator behavior, task logic, routes, curriculum order, or i18n.

## Implemented

- Reframed the hero and first two information cards around viewpoint, framing,
  perspective relationships, and plane-of-sharp-focus control.
- Updated the Focus CTA to teach Front versus Rear focusing with two depths at
  fixed f/32 on the Ground Glass.
- Updated all six catalog descriptions and topics, including whole-camera
  viewpoint versus standard movement, Front Rise framing, Front Tilt/Swing
  plane-of-sharp-focus control, and Mirror Shift viewpoint-versus-framing.
- Updated only the home-page and scenes-page assertions invalidated by the
  intentional copy changes.

## Changed surface

- `src/app/pages.tsx`
- `src/app/publicScenes.ts`
- `src/components/marketing/FocusCtaPanel.tsx`
- `src/tests/integration/home-page.test.tsx`
- `src/tests/integration/scenes-page.test.tsx`
- `.agents/status/CURRENT.md`

Scene IDs, public order, availability, modes, guided-task IDs, thumbnails,
routes, task definitions, calibration, optics, rendering, CSS, packages, and
i18n infrastructure were intentionally unchanged.

## Validation

- Focused home/scenes integration tests: passed; 2 files, 2 tests.
- `npm test`: passed; 107 files, 1,026 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `git diff --check`: passed.
- Pre-commit `git status --short`: reported only the five intended PR6B
  source/test files. The worktree was clean after the substantive commit
  before this handoff update.
- Final post-handoff `git status --short` will be verified separately after
  the status-only commit.

## Not run

- `npm run check:css`: not run; no CSS files changed.
- `npm run build`: not run; this is a copy-only change with no import or
  application-architecture changes.
- E2E: not run; existing behavior, routes, layout, and scene state were not
  changed, and the focused integration coverage passed.

## Key content decisions

- English public copy now uses the canonical distinctions between viewpoint,
  framing, perspective geometry/control, Front/Rear standards, and plane of
  sharp focus.
- Focus Fundamentals explicitly isolates Front/Rear focusing at fixed f/32;
  it is not presented as an aperture-choice lesson.
- Mirror Shift is presented as whole-camera lateral viewpoint change followed
  by opposite Front Shift to restore framing, while retaining the changed
  viewpoint and parallax relationships.
- The existing artistic/process card was preserved.
- No i18n scaffolding, translation keys, locale files, or translated copy was
  introduced.

## Remaining risks / known gaps

- Later content PRs still need to align task/free-practice guidance, feedback,
  controls, help/readouts, and broader README orientation where required.
- Curriculum ordering and homepage CTA sequencing remain deferred by scope.
- Multilingual infrastructure and `en` / `zh-HK` content remain deferred to
  the localization work.

## Reviewer focus

1. Verify public copy matches `docs/LEARNING_MODEL.md`.
2. Verify the Focus CTA no longer misrepresents fixed f/32.
3. Verify Mirror Shift communicates Viewpoint versus Framing.
4. Verify Front/Rear terminology is used consistently.
5. Verify public scene identity, order, routes, and behavior did not change.
6. Verify no i18n implementation or unrelated copy cleanup entered the PR.

## Since previous review

Not applicable.

## Commit

Substantive implementation: `103a7734ee01d1dbd806142659532c8afbaaadbe`

Final bookkeeping: the status-only commit that adds this file; intentionally
not self-referenced to avoid recursive commits.
