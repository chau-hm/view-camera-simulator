# Current Work Handoff

## Work

PR / work identifier: PR 6H — README + Documentation Alignment
Branch: `docs/current-project-alignment`
Base: `origin/main` @ `f7ffd05e32e429bc823bc290e9828a79a0412f3e`
Head convention: record the substantive README commit here; the final
status-only bookkeeping commit is intentionally not self-referenced.

## Objective

Align the root README with the current View Camera Simulator product after the
PR 6A–6G changes without changing runtime behavior, deployment configuration,
or historical planning records.

## README sections aligned

- Current product description and instructional-visualization boundary.
- Viewpoint, Framing, Perspective geometry, and Plane of sharp focus model.
- Whole-camera movement versus Front/Rear standard movement and focusing.
- Free Practice versus scene-specific Guided Tasks.
- The six public scenes in catalog order, with current modes and Guided Task
  IDs.
- Current learner-facing scope, limitations, and visualization surfaces.
- React/TypeScript, Three.js/R3F, Ground Glass RTT, 2D geometry, Zustand,
  task/evaluation, and i18next/react-i18next overview.
- English and `zh-HK` localization experience and terminology contract.
- Development scripts, testing tools, documentation map, and CI/CD/Pages
  deployment behavior.

## Documentation authority and inspection

- `docs/LEARNING_MODEL.md` remains the canonical pedagogical and terminology
  reference.
- `docs/I18N.md` remains the current localization and zh-HK terminology
  reference.
- `src/app/publicScenes.ts`, `package.json`, and
  `.github/workflows/pages.yml` were used for catalog, scripts, and deployment
  facts.
- `AGENTS.md` and `docs/AI_AGENT_WORKFLOW.md` were used for workflow context.
- Inspected all five historical MVP documents: `docs/PRD.md`, `docs/SDD.md`,
  `docs/Spec.md`, `docs/TASK_INVENTORY.md`, and
  `docs/ATOMIC_TASK_INVENTORY.md`. Their accurate banners and bodies were
  left unchanged.
- Inspected `docs/SHELF_SWING.md` as a specialized scene/calibration note and
  `docs/UNDERSTANDING_CAMERA_MOVEMENTS_PROVISIONAL_CALIBRATION.md` as a
  provisional calibration record. Neither was promoted or edited.

## Broken/stale links corrected

Replaced the README's stale `doc/...` documentation paths with valid `docs/...`
links and added current, historical, specialized, catalog, and workflow
references.

## Changed surface

- `README.md`
- `.agents/status/CURRENT.md`

No `src/**`, package, dependency, test, optics, rendering, scene, task,
deployment workflow, or historical-document body changed.

## Validation

- Verified 16 local README Markdown links resolve.
- Verified no stale `doc/...` paths or obsolete Front-only MVP exclusions
  remain in README.
- Verified all five historical MVP banners remain present.
- `git diff --check`: passed.
- Application tests, typecheck, lint, CSS check, and build were intentionally
  not run because the change is Markdown and handoff documentation only.

## Validation not run

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:css`,
  `npm run build`, and browser E2E were not run; no runtime or configuration
  file changed, so the documentation/link checks were proportional evidence.

## Important decisions

- README documents the current public catalog and modes from stable repository
  metadata rather than historical MVP planning files.
- Historical planning bodies remain historical evidence and are not rewritten
  to impersonate current specifications.
- Specialized calibration/scene notes remain narrow implementation references.
- Production deployment documentation reflects the existing workflow: CI on
  pull requests and branch pushes, deployment only after a push to
  `production`, with the Pages base path and SPA fallback preserved.

## Remaining risks / known gaps

- README scene descriptions are intentionally concise; detailed pedagogy and
  calibration remain in their current source documents.
- Specialized documentation remains implementation-oriented rather than a
  unified public documentation site.

## Reviewer focus

1. Verify README matches the current public scene catalog, order, modes, and
   Guided Task IDs.
2. Verify obsolete Front-only MVP exclusions and `doc/...` links are gone.
3. Verify Viewpoint, Framing, Perspective geometry, Plane of sharp focus, and
   whole-camera versus standard-movement terminology are accurate.
4. Verify current versus historical documentation roles are clear and the
   five historical bodies were preserved.
5. Verify all README local links resolve and the CI/CD description matches
   `.github/workflows/pages.yml`.
6. Verify no runtime, product, dependency, or deployment files changed.

## Since previous review

- README review finding: the six Teaching scenes descriptions had drifted
  back toward operational “Use Front ...” wording. Replaced all six with the
  current learner-purpose descriptions from the public catalog contract while
  preserving the existing mode and Guided Task ID column.

## Commit

Substantive implementation: `498d511d9fd8d1bbdc9e8b06f5abcda1b4da1166`

Substantive review fix: `699c3f337bb2f667355e0248cd46c199d2020db9`

Final bookkeeping: the status-only commit that records this handoff is
intentionally not self-referenced to avoid recursive commits.
