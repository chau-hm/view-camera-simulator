# PR #379 — M1A tourbillon review-fix report

**Outcome:** `MACRO_TOURBILLON_INTEGRATION_READY_FOR_HUMAN_REVIEW`

This is a review handoff, not production acceptance. The project owner’s visual review remains the acceptance gate.

- PR branch: `feature/macro-tourbillon-integration`
- Base commit captured: `811456d209988e9f9f4792f5aa46425616eec3d5`
- Accepted watch source: research commit `f1867d71d43cc67e9783bdbd5f3158765236340a`
- Browser: Chrome 158.0.8127.88, WebGL2 / ANGLE Metal on Apple M4 Pro
- Simulator: Three.js r187, ACES filmic output, exposure 1
- Scene and subject: `macro-bellows-extension`, strapless 42 mm × 12 mm head, 13 mm aperture, fixed canonical watch orientation
- Capture manifest: [hardware-capture-run.json](evidence/hardware-capture-run.json)

## Diagnosis

The dial meshes were present. The old B3 image is nearly featureless, while the final pre-DOF source, final B3, and high-resolution loupe expose the existing hobnail field, Roman numeral geometry, railway chapter ring, minute graduations, hands, and tourbillon. The combined old-to-final comparison changes material response, relief units, lighting, and depth precision; it is evidence of recovered output, not a per-variable pixel attribution.

| Hypothesis | Evidence | Result | Correction |
| --- | --- | --- | --- |
| Dial geometry was missing or facing away | Accepted source contains the meshes; final source-before-DOF and high B3 show them | Rejected | No dial geometry added or enlarged |
| Material adaptation flattened relief and metallic response | The old adapter reduced authored metalness and set silver emissive intensity to 0.3; the accepted materials have no such emissive compensation | Confirmed contributor | Removed the finish rewrite and restored authored PBR values |
| Bump heights remained in millimetres after scaling geometry to metres | Chapter ring 0.14, Geneva stripes 0.30, perlage 0.38, and ratchet 0.073 were unscaled; tests inspect all converted values and prove the native asset remains unchanged | Confirmed unit defect; visual contribution not isolated independently | Convert each owned bump height by 0.001 once, including cloned ratchet material |
| Shallow relief tied in the old 16-bit perspective depth target | At 300 mm, with near/far 10 mm / 4 m, estimated depth quantization is about 0.137 mm for 16-bit versus 0.000535 mm for Three.js r187 `UnsignedIntType` / `DEPTH_COMPONENT24`. The engraved dial relief is about 0.019–0.070 mm | Contributing numerical defect; no single-factor old-depth A/B was captured | Use 24-bit depth for the RTT source; the physical watch geometry and relief heights are unchanged |
| Sapphire hid the dial or supplied incorrect DOF depth | Matched crystal-on/off B3 images are visually near-identical. The retained low-alpha sapphire has depth writing disabled and does not cast an opaque shadow | Rejected as the cause of missing detail | Crystal retained; crystal-off switch is development-only diagnostic |
| Resolution or focus caused all missing detail | Standard RTT is 574 × 459; High is 900 × 720. At High, source, dial, numerals, and hands are resolved. B1/B2 blur and stopped-down brightness are expected optical behavior | Contributing only at normal display scale / intentional defocus | Keep 150 mm optics, physical DOF, exposure falloff, and 1:1 condition intact |

The 4× loupe uses the existing inspection-window RTT path. At High it renders a 31.75 mm-wide film crop into a 900 × 720 target, versus the normal 127 mm-wide film view at the same target resolution. It therefore adds useful source sampling for the crop; it is not a 4× upscale of the already-composited screen image.

## Changes

### Materials and lighting

- `MacroSpecimenSubjectFactory` scales only owned bump-bearing `MeshStandardMaterial` values at the millimetre-to-metre boundary. Shared entries are visited once per subject instance; separate Observer and RTT instances own separate materials.
- The research materials remain native and unchanged. The chapter ring retains metalness 0.69 / roughness 0.45; polished rose gold retains metalness 0.92 / roughness 0.165; authored emissive colors remain black. The four required converted bump heights are 0.00014, 0.00030, 0.00038, and 0.000073 world metres.
- The original reflective studio character is restored as a Macro Bellows-only scene environment: five deterministic softbox cards in a 512 × 256 half-float source, base linear radiance 0.105, environment intensity 0.76. The scene also uses the 1.82 key with 2048 PCF shadow map, 0.47 cool fill, 1.66 warm back light, and restrained 0.12 hemisphere fill. Light targets and offsets follow the 300 mm watch datum and convert millimetres at the renderer boundary.
- Observer and RTT resolve the same scene-local illumination. PMREM and source textures follow their renderer-owned disposal paths. Other scene lighting profiles are unchanged.
- The sapphire crystal remains in the public scene. The `macroWatchCrystal=off` query is DEV-only and used only for the matched diagnostic.

### Observer composition

The Macro Bellows scene Observer now targets the real dial datum at 300 mm on the optical axis. Its default view remains a camera-and-watch context view; standard OrbitControls zoom produces a readable front close-up and a separate rear movement close-up. Capture disables Focus plane, DOF region, and Optical geometry through the existing public overlay controls. No debug camera or rendered-image overlay was used.

### Cage timeline

- Public operation starts automatically at phase zero and uses the asset’s 60-second revolution.
- Both separately owned watch objects sample one monotonic, scene-owned epoch; there is no second animation clock or extra requestAnimationFrame loop.
- Explicit scene entry/reset advances the shared reset generation. Focus, aperture, loupe, grid, and ordinary controls do not reset it. Unmount has no running timer or subscription to cancel; the existing R3F and RTT request schedulers drive their respective samples.
- The DEV-only `?macroWatchCage=static` option freezes evidence at canonical phase zero. Production remains animated.
- Hardware paired samples differ by about 0.00014 rad (High); the tests also verify real cage transforms advance and reset on same-route re-entry. The cage is a rigid one-minute visual demonstration, not a simulated functioning escapement.

## Visual and optical review

Matched scene state for B1–B5: 150 mm, focus 900 / 450 / 300 / 300 / 300 mm, apertures f/5.6 / f/5.6 / f/5.6 / f/11 / f/22. The watch remains physically scaled; the 300 mm chapter-ring datum preserves 1:1 at B3. Raw shows the expected optical inversion; the Upright capture verifies the alternate presentation. B4/B5 preserve aperture exposure loss instead of independently brightening each capture.

- [Accepted research front three-quarter](evidence/accepted-research-front-three-quarter.png), [dial and hands](evidence/accepted-research-dial-hands-macro.png), [rear movement](evidence/accepted-research-movement-macro.png)
- [PR #379 pre-fix B3](evidence/pre-fix-b3-life-size.png) → [final Standard B3](evidence/standard-b3-life-size.png) → [final High B3](evidence/high-b3-life-size.png)
- [Final High 4× loupe](evidence/high-b3-focus-loupe-4x.png), [pre-DOF source](evidence/standard-b3-source-before-dof.png), [crystal-off diagnostic](evidence/standard-b3-crystal-off-diagnostic.png), [Upright B3](evidence/standard-b3-upright.png)
- [Standard B1–B5](evidence/standard-b1-initial.png), [B2](evidence/standard-b2-intermediate.png), [B4 f/11](evidence/standard-b4-life-size-f11.png), [B5 f/22](evidence/standard-b5-life-size-f22.png)
- [High B1–B5](evidence/high-b1-initial.png), [B2](evidence/high-b2-intermediate.png), [B4 f/11](evidence/high-b4-life-size-f11.png), [B5 f/22](evidence/high-b5-life-size-f22.png)
- [Default Observer](evidence/observer-default.png), [front close](evidence/observer-front-close.png), [rear movement close](evidence/observer-rear-close.png)

The accepted research images are a reference, not pixel-matched captures. The prior PR and final B3 are matched to the same focus/aperture and Ground Glass framing; their PNGs differ by a border row from browser capture rounding. The high capture is 900 × 722 as a canvas element screenshot including its 2 px CSS border; the underlying RTT is 900 × 720. The 4× loupe PNG is exactly 900 × 720. The Observer captures are 450 × 360 at DPR 1.

At normal 450 × 360 CSS size, fine engraving remains display-limited. High plus the real Loupe exposes the maximum detail available through the supported simulator path. The retained crystal has no refraction model. The default Observer remains a context shot; the front and movement close-ups are actual user-controlled views.

## Runtime and resources

All GPU timings below are 60-sample Chrome/Metal profiles at B3; frame cadence is display-capped and does not prove unlimited GPU headroom.

| Mode | Quality / RTT | Frame p50 / p95 | Ground Glass GPU p50 / p95 | Physical DOF GPU p50 / p95 | Scene pass p50 / p95 |
| --- | --- | ---: | ---: | ---: | ---: |
| Static | Standard, 574 × 459 | 16.7 / 28.2 ms | 17.41 / 19.04 ms | 13.93 / 15.05 ms | 3.55 / 4.27 ms |
| Static | High, 900 × 720 | 16.7 / 23.8 ms | 13.04 / 29.72 ms | 11.56 / 25.57 ms | 1.69 / 4.90 ms |
| Static Loupe | High, 900 × 720 | 16.7 / 23.5 ms | 21.78 / 29.73 ms | 17.89 / 24.53 ms | 3.52 / 5.80 ms |
| Animated | Standard, 574 × 459 | 16.7 / 18.6 ms | 7.38 / 15.40 ms | 6.10 / 12.65 ms | 1.28 / 2.85 ms |
| Animated | High, 900 × 720 | 16.7 / 23.1 ms | 11.59 / 26.57 ms | 10.39 / 23.81 ms | 1.23 / 3.11 ms |

The page rAF remained around 60 Hz (p50 16.7 ms, p95 17.2–17.5 ms). Profiler query capacity is bounded at 24 total / five pending; some High timing queries were rejected when that pool filled. RTT accepted frames continued, with at most one pending frame. No unbounded request backlog, context loss, or browser errors were observed.

At High B3 the RTT subject reports 263 meshes, 204 unique geometries, 17 unique materials, 4 subject textures, and 398,954 subject triangles. The renderer reported 298 calls, 398,964 submitted triangles, 205 geometries, and 16 textures (including RTT/environment resources). The accepted asset’s four deterministic textures are estimated at about 13.3 MiB including mip levels; this is an estimate, not a GPU allocation query. The 60 Hz page cadence includes occasional Ground Glass GPU p95 timings above 16.7 ms. No matched hardware old-medallion performance control was run.

The capture recorded zero browser errors and eight existing Three.js `Clock` deprecation warnings. The warnings were not suppressed.

## Validation

- Full unit/integration run: `npm test` — 360 test files, 4,515 tests passed.
- `npm run typecheck`, `npm run lint`, `npm run check:css`, and production build passed. The direct build used `/private/tmp/macro-tourbillon-build` because the sandbox blocks clearing the worktree `dist/assets`; the managed `ci:local:e2e` build also passed.
- Macro Bellows hardware E2E: 3/3 passed, including real cage transform progression, shared Observer/RTT time, ordinary-control non-reset, route re-entry reset, Raw/Upright grid and bellows metrics.
- Hardware visual/performance capture: 1/1 passed after exercising the real public Observer zoom, overlay, focus, aperture, loupe, and Raw/Upright controls.
- Cross-scene browser regressions: Macro DoF, Macro Oblique Plane, Macro Compound Movements, DoF Orientation, Architecture Rise Focus Range: 7/7 passed. SPA scene switching: 1/1. Architecture Foreground Rise: 2/2.
- `npm run ci:local:e2e` was run twice. The first run exposed and led to a correction of a stale Architecture Rise route assertion; the focused Rise suite then passed. The second run passed CSS, lint, typecheck, full unit tests, build, and preceding E2E files, then stopped in the unrelated Architecture + Foreground Tilt + Focus spec: free-practice sharpness did not reach 70% at focus 6830 mm, and the guided Restart click timed out. These failures were not changed or attributed to the watch integration. The complete local E2E pipeline is therefore not green.
- `git diff --check` passed on the final working diff before commit.

## Remaining limits

- Full repository `ci:local:e2e` still has the two unrelated Architecture + Foreground Tilt + Focus failures above.
- There is no isolated per-factor pixel capture for material conversion versus studio lighting versus depth precision; the accepted research reference, preserved pre-fix B3, final source/processed images, crystal A/B, numerical depth estimate, and material-value tests are retained for review.
- No sapphire refraction or moving balance/escapement simulation is claimed.
- No matched old-subject hardware performance comparison was performed.
- Final visual acceptance and any production subject replacement remain future owner decisions.
