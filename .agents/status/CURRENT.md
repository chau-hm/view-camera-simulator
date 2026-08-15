# Current Work Handoff

## Work

PR / work identifier: Micro fix — Remove redundant Focus Fundamentals landing CTA
Branch: `fix/remove-focus-cta`
Base: `origin/main` @ `678f919c87a8f5ccf9aeed63eca38d3a3313c9e8`
Head convention: record the substantive implementation commit here; the
final status-only bookkeeping commit is intentionally not self-referenced.

## Objective

Remove the redundant Focus Fundamentals CTA from the landing page while
leaving the public Scenes catalog and the simulator lesson unchanged.

## Implemented

- Removed the `FocusCtaPanel` render and import from `HomePage`.
- Deleted the unused `FocusCtaPanel` component.
- Removed its typed English and zh-HK home message entries.
- Removed only Focus CTA-specific CSS and direct landing-page assertions.
- Updated the responsive marketing assertions that targeted the deleted CTA
  surface.

## Changed surface

- `src/app/pages.tsx`
- `src/components/marketing/FocusCtaPanel.tsx` (deleted)
- `src/i18n/messages/en/home.ts`
- `src/i18n/messages/zh-HK/home.ts`
- `src/styles/site-marketing.css`
- `src/tests/integration/home-page.test.tsx`
- `src/tests/integration/marketing-warning.test.tsx`
- `src/tests/e2e/marketing-responsive.spec.ts`

No scene catalog, route, Focus Fundamentals scene, simulator teaching copy,
task, evaluator, optics, rendering, state, documentation, or dependency files
changed.

## Validation

- Focused landing integration tests: passed; 2 files, 3 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run check:css`: passed.
- `git diff --check`: passed.
- Final worktree status will be verified after the handoff commit and feature
  publication.

## Validation intentionally not run

- Full `npm test` was not run because this is a bounded Micro fix and the
  directly affected landing tests passed.
- Renderer/browser E2E was not run, as explicitly excluded for this change.

## Reviewer focus

1. Verify the landing page no longer renders the redundant Focus CTA.
2. Verify both locale message shapes remain valid after removing `home.focusCta`.
3. Verify CTA-only CSS and direct assertions were removed without changing
   shared landing styles or the Scenes catalog.
4. Verify no Focus Fundamentals simulator, route, task, or teaching behavior
   changed.

## Since previous review

Not applicable

## Commit

Substantive implementation: `19a8865610e42290de696da5e86da0cfefc46fc5`

Final bookkeeping: the status-only commit that records this handoff is
intentionally not self-referenced to avoid recursive commits.
