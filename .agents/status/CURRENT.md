# PR 8J — physical guided-task focus evaluation audit

- Branch: `feature/physical-task-focus-evaluation`.
- Base: `origin/main` at `102012acefc6a278018acab86c9b99d079b4a15d`.
- Scope: migrate production `focus-targets-sharp` pass/fail and criterion score
  from legacy wedge `sharpness` to physical worst-sample patch sharpness.
- No renderer, optics equations, scene geometry, camera calibration, profiler,
  PR 8F detail, task types, or task controls changed.

## Production contract

- `resolvePhysicalTaskPatchSharpness()` requires finite normalized physical patch
  sharpness and a finite non-negative `patchEquivalentCoCDiameterMm`.
- Missing, non-finite, or invalid physical data fails closed; production task
  evaluation never falls back to legacy wedge fields.
- `evaluateTask()` uses the same physical patch value for focus criterion pass/fail
  and its conservative minimum criterion score. Legacy fields remain available
  for diagnostics and compatibility fixtures.
- `FocusAssist` and task evaluation now share the physical patch source for whole
  target semantics.

## Focus-task inventory and audit

There are 16 production `focus-targets-sharp` criteria across seven tasks. Values
below are rounded for review. `legacy` is the old target sharpness; `physical`
is the minimum physical patch sharpness across criterion targets; `CoC` is the
maximum equivalent physical patch CoC. Initial states come from task definitions,
canonical states use the existing public controls, and negative states are the
existing meaningful wrong-focus/incomplete-movement controls.

| Task / criterion | Targets | Old → final min | Canonical legacy | Canonical physical / CoC mm | Initial physical | Negative physical |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| AF Tilt + Focus / near | foreground-near | 0.7 → 0.7 | 0.881 | 0.902 / 0.009848 | 0.000 / 0.223193 | 0.000 / 0.138770 |
| AF Tilt + Focus / building | building-middle | 0.7 → 0.7 | 0.899 | 0.839 / 0.016108 | 1.000 / 0.000046 | 0.142 / 0.085782 |
| AF DOF / focus targets | foreground-near, foreground-middle, building-base, building-middle | 0.6 → 0.4 | 0.634 | 0.424 / 0.057609 | 0.000 / 0.115217 | 0.000 / 0.115217 |
| AF Compound / focus targets | foreground-near, foreground-middle, building-base, building-middle | 0.6 → 0.4 | 0.634 | 0.424 / 0.057609 | 0.000 / 0.223193 | 0.212 / 0.078830 |
| Oblique Swing + Focus / near | facade-near | 0.8 → 0.8 | 0.988 | 0.992 / 0.000814 | 0.532 / 0.046810 | 0.000 / 0.207799 |
| Oblique Swing + Focus / middle | facade-middle | 0.8 → 0.8 | 0.986 | 0.992 / 0.000847 | 0.972 / 0.002848 | 0.000 / 0.249072 |
| Oblique Swing + Focus / far | facade-far | 0.8 → 0.8 | 0.984 | 0.991 / 0.000868 | 0.707 / 0.029306 | 0.000 / 0.276109 |
| Oblique Compound / near | facade-near | 0.8 → 0.8 | 0.988 | 0.992 / 0.000814 | 0.532 / 0.046810 | 0.000 / 0.242719 |
| Oblique Compound / middle | facade-middle | 0.8 → 0.8 | 0.986 | 0.992 / 0.000847 | 0.972 / 0.002848 | 0.000 / 0.242367 |
| Oblique Compound / far | facade-far | 0.8 → 0.8 | 0.984 | 0.991 / 0.000868 | 0.707 / 0.029306 | 0.000 / 0.242140 |
| Table Tilt / near | near-cup | 0.8 → 0.8 | 1.000 | 1.000 / 0.000027 | 0.000 / 0.222224 | 0.000 / 0.758200 |
| Table Tilt / middle | mid-notebook | 0.8 → 0.8 | 1.000 | 1.000 / 0.000027 | 0.958 / 0.004219 | 0.000 / 0.752520 |
| Table Tilt / far | far-book | 0.8 → 0.8 | 1.000 | 1.000 / 0.000027 | 0.000 / 0.103970 | 0.000 / 0.749828 |
| Shelf Swing / front | shelf-front | 0.8 → 0.8 | 0.983 | 0.981 / 0.001932 | 0.000 / 0.376736 | 0.000 / 0.462776 |
| Shelf Swing / middle | shelf-middle | 0.8 → 0.8 | 0.977 | 0.980 / 0.001971 | 0.805 / 0.019476 | 0.000 / 0.453372 |
| Shelf Swing / back | shelf-back | 0.8 → 0.8 | 0.958 | 0.966 / 0.003352 | 0.000 / 0.160687 | 0.000 / 0.449166 |

The only threshold change is Architecture + Foreground DOF/Compound `0.6 →
0.4`. The public f/22 canonical worst target is `0.423913` with `0.057609 mm`
CoC; nearby public controls reach `0.412691`. A final threshold of `0.4`
preserves those reachable public solutions while remaining below the existing
`0.1 mm` physical acceptance boundary. No scene calibration or canonical state
was changed.

## Validation

- Focused physical task/readout and all affected task/optics tests: pass.
- Full unit/integration suite: 142 files, 1,339 tests passed.
- Typecheck, lint, CSS check, and build: pass.
- Serial bounded Chromium task validation: 8 passed across Architecture +
  Foreground, Oblique Architecture, Shelf Swing, and Table Tilt.
- `npm run ci:local:e2e`: CSS/lint/typecheck/unit/build and affected E2E files
  passed; stopped at the known unrelated Focus Fundamentals baseline in
  `focus-fundamentals-selectable-focus.spec.ts:155` because RTT
  `ownerId/resourceGeneration` diagnostics are absent. Its responsive companion
  passed.
