# Focused fix — Ground Glass focus-to-film-plane propagation

- Branch: `fix/ground-glass-focus-film-plane-propagation`.
- Base: `origin/main` at `e7faa124` (merged PR #86 / PR 8E; PR 8D is also in
  main).
- Objective: make the Architecture + Foreground focus control update the
  canonical physical film plane consumed by Ground Glass CoC/footprint
  uniforms, without changing renderer algorithms or global optics defaults.

## Root cause and decision

- `calculateFiniteFocusFilmPlane` already supports the declarative
  `rear-standard-thin-lens` strategy, but Architecture + Foreground did not
  declare it. Its focus-adjustable path therefore kept the legacy `-f`
  film-plane datum for every finite focus value.
- Architecture + Foreground now declares the existing rear-standard strategy:
  `lensDatum: baseline-origin`, `focusDistanceReference: lens-to-focus-plane`.
- Focus Fundamentals remains owned by its selectable front/rear resolver;
  Architecture Rise keeps its explicit rear-standard special case; Table Tilt
  and Shelf Swing retain derived-plane focus semantics; Oblique Architecture
  and the fixed Understanding Camera Movements scene retain their existing
  declarations/contracts; Mirror Shift remains fixed.

## Validation evidence

- Focused unit coverage compares 3920 mm and 9450 mm focus, canonical
  thin-lens image distance, unchanged lens/rig placement, physical signed CoC
  and ellipse footprints at façade/foreground samples, and Ground Glass
  uniform film-plane propagation.
- Focused Chromium coverage checks processed RTT output changes after focus,
  film-center movement with a stable lens center, finite diagnostics, and Raw
  RTT contentfulness through a processed/raw transition.
- Full unit/integration validation passed (134 files / 1278 tests), along with
  typecheck, lint, CSS check, and build. Serial Architecture + Foreground,
  Ground Glass stability, Table Tilt, Shelf Swing, and Oblique smoke checks
  passed. The CI-local E2E workflow stopped at the existing Focus Fundamentals
  diagnostic baseline (`focus-fundamentals-selectable-focus.spec.ts:155`,
  missing owner/resource-generation diagnostics); the affected optics and
  integration code was not changed here.
- No renderer shader, blur-quality, display scaling, or UI control
  implementation was changed.

## Known limitation

This is a scene-contract correction. The existing local-affine physical CoC,
oriented footprint, near/far gather, and profiling implementations remain
unchanged; later work may extend focus propagation to any newly introduced
scene only when its canonical focusing semantics are explicitly classified.
