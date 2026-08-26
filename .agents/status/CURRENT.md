# PR 8K — physical focus metric boundary consolidation

- Branch: `refactor/physical-focus-metric-boundary`.
- Base: `origin/main` at `5909b8c187f0c44bab2d078b59dfa1e0de169392` (PR 8J merged).
- Scope: make physical film-space point/patch focus metrics the strict source
  for learner presentation and guided-task behavior, while retaining wedge
  geometry where it still has a real diagnostic/legacy owner.
- No physical optics, Ground Glass renderer, shader, calibration, task
  threshold, scene, quality, or performance behavior is changed.

## Consumer matrix

| Consumer | Legacy wedge | Physical metric | Final role |
| --- | --- | --- | --- |
| `evaluateFocusTargets()` / `evaluateTask()` | no | `physicalPatchSharpness` + physical CoC | guided-task pass/fail and score; strict fail-closed |
| `FocusAssistPass` / `GroundGlassReadouts` | no | point or patch physical field | learner presentation; strict fail-closed |
| `GroundGlassRenderer` / `groundGlassFocusLabel` | no | selected physical field + equivalent CoC | Ground Glass learner label; no model mixing |
| `calculateSharpness()` | writes legacy wedge diagnostics | writes physical point/patch metrics | canonical derived target producer; both models retained with separate owners |
| `OpticalDebugPanel` | `GroundGlassWorldBlurSample` path-specific value | physical CoC path value | developer diagnostics, explicitly labelled |
| `dofWedge.ts` / `dofBlurModel.ts` | normalized wedge geometry/display input | no | retained geometric/legacy helper path |
| `groundGlassBlur.ts` | derived-plane wedge path | parallel physical CoC path | retained active legacy/non-RTT helper; behavior unchanged and type documented |
| `groundGlassDofShaders.ts` | legacy wedge helper branch | physical RTT branch | renderer implementation; unchanged |
| `focusTargetDisplay.ts` | legacy target sharpness/defocus | no | dead production helper; removed with obsolete tests |

## Boundary decisions

- Normal production presentation uses `resolvePhysicalFocusTargetPresentationMetric()`;
  missing, non-finite, out-of-range, or missing-CoC physical data becomes
  `0 / soft` and never falls back to wedge scores. The old resolver name remains
  only as a strict, deprecated alias for internal compatibility.
- Point presentation uses `physicalPointSharpness` and its point equivalent
  CoC; patch presentation uses `physicalPatchSharpness` and its patch CoC.
- Production `focus-targets-sharp` evaluation remains physical-patch-only and
  fail-closed. Legacy `sharpness` remains available for diagnostics and
  historical fixtures, but is not read by learner/task production paths.
- The Ground Glass learner label reports physical equivalent CoC and its paired
  physical percentage. Wedge normalized defocus is not used as a fallback.
- `sampleDofWedge()` remains the owner of near/focus/far geometric interval
  diagnostics, and the legacy `groundGlassBlur`/shader wedge paths are not
  replaced in this boundary pass.

## Legacy consumer inventory

Remaining production writes/reads are intentional:

- `target.sharpness`, `pointSharpness`, and `patchSharpness` are written by
  `calculateSharpness()` for legacy wedge diagnostics/compatibility. There are
  no production learner/task reads.
- `normalizedDefocus` remains in `dofWedge`, `dofBlurModel`, the derived-plane
  `groundGlassBlur` path, the legacy shader helper, and developer diagnostics.
  It is not used for normal learner target presentation or guided-task success.
- `sampleDofWedge()` and `calculateDofWedgeDefocus()` remain active for wedge
  geometry and legacy helper behavior.
- `calculateFocusTargetDisplaySharpness()` had no production import and was
  removed rather than retaining a misleading legacy fallback.

## Validation

- Focused boundary/readout/task tests: pass (4 files, 40 tests), including
  strict physical presentation, physical task agreement, physical CoC label
  output, and contradictory legacy fixtures.
- Full `npm test`: pass (141 files, 1,338 tests). Typecheck, lint, CSS check,
  build, and `git diff --check`: pass.
- Bounded serial Chromium scene checks: 36 pass; the unchanged known
  Focus Fundamentals RTT diagnostics baseline fails at
  `focus-fundamentals-selectable-focus.spec.ts:155` because owner/resource
  diagnostics are absent; its responsive companion passes.
- `npm run ci:local:e2e`: all pre-E2E checks and affected Architecture +
  Foreground E2E pass, then stops at the same known Focus Fundamentals baseline
  failure. No new focus/readout/task/renderer failure was observed.
