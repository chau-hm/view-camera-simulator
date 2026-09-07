# PR136 — Ground Glass focus inspection fidelity

## Branch / base

- Branch: `fix/ground-glass-focus-inspection-fidelity`
- Worktree: `/Users/homan/repo/view-camera-ground-glass-focus-inspection-fidelity`
- Reviewed implementation head before this corrective pass: `1dd31d5b635fdb15f8ec9cbacf8612e1c2a91768`
- Reviewed PR base / merge base: `ee92962fa9ee0de46f6185b7bb70dec8ace830c9`
- Latest fetched `origin/main`: `cda5e8ab352e861f44b133502b2f200440562fdd`; it advanced after the reviewed PR base and was not merged in this bounded correction.

## Objective and runtime contract

PR136 makes the Ground Glass focus inspection a physical film-window crop rather than a CSS-only magnification. Normal mode samples the complete `127 × 101.6 mm` film window at the normal RTT dimensions. A 4× loupe selects a `31.75 × 25.4 mm` sub-frustum with the same camera pose and unchanged RTT resource dimensions, so subject detail and the physical CoC/footprint are sampled at approximately 4× film-plane density.

- `GroundGlassStage` owns loupe interaction, pan, reset, and accessibility state.
- RTT scenes keep the completed image at CSS scale `1`; the active inspection window is passed to the physical camera projection.
- Raw preview pan is mapped back to the camera frustum before cropping; upright preview keeps its film orientation.
- Physical CoC equations, thresholds, learner scores, calibration, scene geometry, task criteria, aperture policy, and RTT resource generation remain unchanged.
- Sampled film dimensions are used only for physical-mm-to-RTT-pixel conversion and diagnostics; no blur multiplier or `inspectionMagnification` is present in the physical shader path.

## Evidence

- The crop helper preserves the full-film frustum range and constrains the 4× window to the film bounds.
- RTT diagnostics expose the active window, sampled film span, stable internal dimensions, resource generation, and render-sanity key.
- Neutral public Oblique Tabletop: Tilt `0°`, Swing `0°`, Focus `4540 mm`, f/11; learner readout remained `81 / 25 / 0 / 100 / 11 / 44 / 83%` for Near Left, Near Centre, Near Right, Middle, Far Left, Far Centre, Far Right.
- Public 4× inspection capture made the Middle reference visibly crisp and the neutral Near Right / Far Left regions visibly softer; the accepted compound state `+7.1° / +2.1° / 2500 mm / f/11` rendered the inspected board consistently sharp.
- Loupe activation kept RTT dimensions at `944 × 756`, resource generation at `1`, learner scores unchanged, and render sanity identity tied to the crop state rather than resource replacement.
- Temporary visual evidence is uncommitted at `/tmp/pr136-cropped-loupe-final/01-neutral-1x-overview.png`, `02-neutral-middle-target-rawmapped.png`, `03-neutral-near-right-target-rawmapped.png`, `04-neutral-far-left-target-rawmapped.png`, and `05-aligned-compound-4x.png`.

## Validation

- Full Vitest: `166` files / `1615` tests passed.
- Typecheck, lint, CSS structure check, production build, and `git diff --check` passed.
- Focused unit coverage includes the inspection-window helper, camera sub-frustum, sampled-film physical scale, shader uniforms, RTT diagnostics, render sanity, Stage, Renderer, and RTT suites.
- Focused Chromium passed: Ground Glass interaction `3/3`; Oblique teaching geometry `1/1`; Oblique guided lesson `1/1`; viewport expansion/RTT/reset flows `3/3`. The temporary target-centered visual capture also passed and was deleted from the repository.
- The viewport quality assertion expecting blur-target dimensions to equal color-target dimensions fails on clean current `origin/main` (`cda5e8a`) with the same `172` vs `86` result; it was not changed.
- `CI=1 npm run ci:local:e2e` passed CSS, lint, typecheck, unit/integration (`166` files / `1615` tests), and build, then stopped at `src/tests/e2e/mirror-shift-teaching-geometry.spec.ts` because `ground-glass-rtt` disappeared after the Mirror Shift update. The exact spec reproduced the same result on clean current `origin/main` `cda5e8a` (one failing A/B/C test, one passing navigation test); no unrelated baseline test is weakened or skipped.

## Scope / known gaps

This correction is limited to the physical Ground Glass inspection-window pipeline, its diagnostics, focused tests, and the canonical reviewer handoff. It does not change optics, scene calibration, focus-target geometry, task thresholds, aperture policy, or product assets. The PR remains unmerged; latest `origin/main` advancement is recorded above and must be considered before final publication.
