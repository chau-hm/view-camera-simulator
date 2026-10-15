# Architecture Rise material-aware WebGPU output promotion

## Decision

**J1 — Promotion approved for the development-only Architecture Rise WebGPU
pilot.** When `observerRenderer=webgpu` is explicitly requested in a development
build, an unspecified `observerOutput` now selects material-aware output. The
application renderer remains WebGL by default; `observerOutput=standard`
continues to select the legacy WebGPU output. View Camera Anatomy, other
scenes, and production retain standard output.

This decision is limited to the tested Chrome/macOS runtime and this one scene.
It does not establish a WebGPU performance advantage, hardware acceleration,
cross-browser support, or production readiness.

## Measurement environment and provenance

The completed native policy/lifecycle qualification was measured at
`24907c40de795d9bb058cc334eb250beec7c838a` on 2026-10-15. Environment:

- macOS Darwin 27.0.0, arm64; Node v24.19.0; Three.js r186.
- Headed Chrome 155.0.8059.79, 1440 × 1000 viewport, DPR 1.
- `navigator.gpu` present and adapter available.
- Actual mounted backend: `webgpu-renderer / webgpu`, one renderer attempt,
  no initialization failure, and no application fallback.
- Chrome DevTools SystemInfo reported Metal and no software renderer. It does
  not identify the adapter selected by WebGPU, so hardware acceleration remains
  **unconfirmed**.

The unoptimized CPU instrumentation baseline was captured before adapting the
controller at `ea9665673944187cccc7ae0c59f0c9b71f01a77e`, under the same Chrome,
macOS, Three.js, viewport, DPR, and native execution class. Performance figures
are development-browser measurements, not GPU timing.

## Method and paired measurements

All trials used the real Architecture Rise Observer, the same default camera
pose, scene state, high render quality, viewport, DPR, and four real Orbit
Controls drags. Three pairs alternated standard/candidate order. Every WebGPU
trial required the actual native backend. A subject-region pixel check marked
the verified screenshot milestone. Navigation timings include browser/server
scheduling, module loading, renderer initialization, and scene realization;
they are not shader compilation or GPU render times.

| Pair and order | Standard active / verified capture | Material-aware active / verified capture | Candidate minus standard active / capture |
| --- | ---: | ---: | ---: |
| 1, standard → candidate | 1501 / 1661 ms | 1468 / 1611 ms | −33 / −50 ms |
| 2, candidate → standard | 1415 / 1564 ms | 1455 / 1595 ms | +41 / +30 ms |
| 3, standard → candidate | 1453 / 1597 ms | 1524 / 1665 ms | +71 / +69 ms |

The candidate was faster in the first pair and slower in the following two;
the small three-pair sample does not establish a readiness advantage or a
consistent startup penalty.

| Pair | Standard active-gesture rAF median / p95 | Candidate active-gesture rAF median / p95 |
| --- | ---: | ---: |
| 1 | 13.4 / 14.2 ms | 13.3 / 14.2 ms |
| 2 | 13.3 / 14.1 ms | 13.3 / 14.3 ms |
| 3 | 13.3 / 14.1 ms | 13.4 / 14.0 ms |

Active gesture cadence contains only intervals whose endpoints were both
inside a real pointer gesture. It measures browser presentation scheduling,
not Three.js render duration, input-to-present latency, or GPU time.

The initial unoptimized candidate callback means were 3.59, 3.61, and 3.66 ms
per frame. After bounded inventory/signature work, the three paired candidate
means were 0.85, 0.86, and 0.88 ms per frame. During the sustained run, the
controller callback mean was 0.77 ms per frame; sampled scene traversal was
0.77 ms, material signatures 0.63 ms, adaptation 0.006 ms, and inventory plus
diagnostics 0.028 ms. These figures describe instrumented CPU callback work;
the controller is absent from the standard-output route, so they are not a
GPU or renderer-time comparison.

## Sustained use and resource lifecycle

The candidate remained active for 120.5 seconds with 528 orbit gestures and 33
focus/rise/overlay/reset control operations. Across 5,028 active-gesture rAF
intervals, median/p95/p99 were 13.3/14.2/14.4 ms; no active interval exceeded
50 ms. The full session recorded 8,837 intervals, with five over 50 ms; those
include transitions and non-gesture time and are reported separately.

The Architecture Rise graph had 393 mesh/material assignments, 73 distinct
material instances, all 73 adapted, and zero unsupported instances. The peak
managed count stayed 73. Sustained visibility changes produced 271 adapted
material creations and 198 disposals, leaving the expected 73 live materials;
when the candidate mount was removed, the disposal report showed all 271
created materials disposed and zero managed assignments/materials.

The lifecycle qualification completed 11 SPA scene transitions. Seven
material-aware renderer generations were disposed with creation/disposal
counts balanced. Each transition retained a single Observer canvas, the
expected Anatomy or Architecture Rise subject pixels, native backend identity,
and contentful Ground Glass on its existing WebGL2 path. Switching output
policy on the same scene did not recreate Ground Glass resources; scene changes
continued to own their normal RTT generations. No page or console errors were
recorded in this native lifecycle run.

## Visual and functional validation

The unchanged PR #254 strict parity contract passed on native WebGPU for both
the promoted default URL and the explicit material-aware URL: 78 applicable
criteria passed, zero failed, and three conditional criteria were not
applicable (81 total). Both requested forms selected and installed
material-aware output. The explicit standard control remained independently
selectable; its capture-only baseline reproduced the existing 26 strict parity
failures. No thresholds or criteria were changed.

The existing PR #256 material-family checks remain in place for Standard,
Basic, and LineBasic output, including `toneMapped=true/false`, alpha, and
transparent Focus/DOF overlays. The development E2E checks subject visibility,
controls, environment readiness, shadows, output-policy transitions, and
Ground Glass. Ground Glass remains a contentful WebGL2 RTT with its existing
Raw/Upright behavior and optics path.

## Runtime categories and fallback

| Runtime | Evidence and behavior |
| --- | --- |
| Native WebGPU | Headed Chrome 155: `webgpu-renderer / webgpu`; required for the paired, sustained, and strict parity measurements. |
| Three.js internal WebGL2 fallback | Ordinary Playwright Chromium 149 had the WebGPU API but no adapter and mounted `webgpu-renderer / webgl2-fallback`, one attempt, no application fallback. Subject, interaction, and Ground Glass checks remained functional. |
| Application WebGL fallback after initialization failure | A fresh page intercepted the lazy Three.js WebGPU module request. One WebGPU attempt fell back to `webgl-renderer / webgl2` with `app-webgl`; a subsequent ineligible scene had no stale fallback, and the next eligible request received a new renderer generation. |
| Application WebGL fallback after output-policy failure | A fresh default-pilot page intercepted the material-aware module. The candidate reported the output-policy failure and performed one application fallback to standard WebGL; Architecture Rise and Ground Glass remained contentful. |
| Explicit standard rollback | `?observerRenderer=webgpu&observerOutput=standard` selects and installs standard WebGPU output without the material-aware controller. |

Ineligible Table Tilt routes do not request the lazy WebGPU module. The route
owner now gates renderer selection until the active store scene matches the
route scene, preventing the previous scene's initial store value from starting
the Architecture Rise candidate during route initialization.

## Policy and rollback

| Context | Output parameter | Selected output |
| --- | --- | --- |
| Architecture Rise, development, explicit WebGPU | omitted | material-aware (`development-pilot-default`) |
| Architecture Rise, development, explicit WebGPU | `material-aware` | material-aware (`material-aware-selected`) |
| Architecture Rise, development, explicit WebGPU | `standard` | standard WebGPU (`standard-requested`) |
| Architecture Rise default WebGL or explicit WebGL | omitted | standard WebGL |
| View Camera Anatomy WebGPU | omitted or `material-aware` | standard output |
| Other/ineligible scenes | any | existing fail-closed backend/output behavior |
| Production | any | standard WebGL; WebGPU remains denied |
| Unknown output value | unknown | standard output with `unknown-output-request` diagnostic |

The rollback route for side-by-side diagnostics is:

```text
/simulator/free/architecture-rise?observerRenderer=webgpu&observerOutput=standard
```

The existing parity and backend-comparison benchmarks now pin standard
controls explicitly to `observerOutput=standard`; candidate comparisons keep
an explicit `observerOutput=material-aware` request. The strict parity harness
also supports an opt-in omitted-parameter run to verify the promoted default.

## Promotion verification rerun

After changing the Architecture Rise policy so an omitted `observerOutput`
selects the candidate only for an explicit development WebGPU request, the
native-required route was rechecked on headed Chrome 155.0.8059.79, macOS
Darwin 27.0 arm64, Node v24.19.0, and Three.js r186. The browser API and
adapter were available. The mounted route reported
`webgpu-renderer / webgpu`, one initialization, no failure, and no application
fallback. The strict PR #254 parity contract passed unchanged for the promoted
default URL: 78 applicable criteria passed, none failed, and three conditional
criteria were not applicable. The report selected and installed
`material-aware` with the query parameter recorded as `unspecified`.

The native-required Observer pilot passed five applicable tests; its three
controlled fallback-injection tests are intentionally skipped in native mode.
The ordinary Chromium pilot passed all eight tests, including the internal
WebGL2 fallback, controlled initialization-failure fallback, output-policy
failure fallback, default WebGL regression, material-aware scene integration,
and cross-scene request transitions. The transition test now waits for the
new renderer generation to be active and classified before reading its
capabilities, so a previous generation's `active` status cannot satisfy the
new route's evidence check. The focused Architecture Rise scene validation
passed both tests in native-required mode, and the production-preview test
passed its WebGL-only denial assertions.

The native fixture evidence also reconfirmed the registered subject's
visible-versus-hidden framebuffer contribution, active environment and shadow
map, camera controls, and contentful Ground Glass WebGL2 RTT. Hardware
acceleration remains unconfirmed. Full unit tests passed (2,314 tests), as did
typecheck, lint, and production build. These reruns validate the policy
promotion and its existing candidate path; they do not expand the three-pair
performance sample above or establish a general WebGPU performance advantage.

## Limitations

- One native browser/OS combination was exercised. Safari, Firefox, Windows,
  Linux, and other GPU/driver combinations were unavailable.
- Hardware acceleration remains unconfirmed; the browser's Metal report does
  not prove which adapter WebGPU used.
- GPU timestamp queries, VRAM, renderer-owned GPU memory, and actual GPU
  allocations were not measured.
- Three paired trials are bounded descriptive evidence, not a broad performance
  ranking. No performance advantage is claimed.
- Visual equivalence follows the unchanged automated parity criteria; teaching
  suitability across additional scene states remains subject to human review.
- Production remains WebGL-only. This result does not authorize new eligible
  scenes, a general renderer architecture, or a Ground Glass migration.
