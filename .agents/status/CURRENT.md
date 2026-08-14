# Current Work Handoff

## Work

PR / work identifier: PR 6A — Canonical Learning Model
Branch: `docs/canonical-learning-model`
Base: `origin/main` @ `e554623dc6e465952f962a705c97d860303b362f`
Head convention: record the substantive implementation commit here; a final
status-only bookkeeping commit is intentionally not self-referenced.

## Objective

Establish the canonical current pedagogical/content model for the simulator
without changing application behaviour or learner-facing UI.

## Implemented

- Added `docs/LEARNING_MODEL.md` as the current source of truth for viewpoint,
  framing, perspective geometry, standard movement, focus-plane concepts, and
  the six current public lessons.
- Defined canonical English terminology, cross-scene teaching principles, and
  the `en` / `zh-HK` localization contract without implementing i18n.
- Marked the five original MVP planning documents as historical while
  preserving their bodies.

## Changed surface

- `docs/LEARNING_MODEL.md`
- `docs/PRD.md`
- `docs/SDD.md`
- `docs/Spec.md`
- `docs/TASK_INVENTORY.md`
- `docs/ATOMIC_TASK_INVENTORY.md`
- `.agents/status/CURRENT.md`

## Validation

- `git diff --check`: passed for the substantive documentation diff.
- Required-heading, terminology, locale, and placeholder searches: passed.
- Historical-document diff inspection: passed; each file has only a top banner
  addition and no body deletions or rewrites.
- Runtime/package/CI surface inspection: passed; no application or dependency
  files changed.

## Not run

- Application tests, typecheck, lint, CSS check, build, and E2E: not run; this
  PR changes documentation and handoff state only.
- Markdown-specific validator: not run; no repository command for one exists.

## Decisions

- The six public lessons are described by pedagogical role, not as a new
  mandatory runtime curriculum order.
- README alignment, learner-facing copy, calibration, optics, and i18n remain
  deferred to later PRs.
- `LEARNING_MODEL.md` documents conceptual truth while code/tests and
  scene-specific calibration documents retain technical authority.
- Historical MVP claims remain intact after the compact status banners.

## Remaining risks / known gaps

- Existing README and UI copy still contain historical or pre-localization
  wording; aligning them is intentionally deferred.
- No automated documentation consistency or glossary check exists.
- Later copy/localization work must preserve the viewpoint, framing, and focus
  plane distinctions established here.

## Reviewer focus

1. Verify that `LEARNING_MODEL.md` matches current implemented teaching
   behaviour rather than old MVP intent.
2. Verify that Viewpoint, Framing, Perspective, and Plane of Sharp Focus are
   clearly separated.
3. Verify that Mirror Shift and Focus Fundamentals are represented accurately.
4. Verify that historical planning documents were preserved rather than
   rewritten.
5. Verify that localization readiness is defined without prematurely
   implementing i18n.
6. Verify that the PR stayed documentation-only.

## Since previous review

Not applicable.

## Commit

Substantive implementation: `7c627bb592e3996c64d6e801b1cab03ff6ef48bb`

Final bookkeeping: the status-only commit that adds this file; intentionally
not self-referenced to avoid recursive commits.
