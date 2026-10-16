# Shared Material-Aware Output Core and Ownership Boundary

## 1. Purpose

PR L extracts the shared source-to-NodeMaterial tracking mechanics used by the
development-only Architecture Rise material-aware Observer policy. It prepares
an ownership boundary that can support a future Anatomy integration while
keeping Anatomy on standard WebGPU output in this PR.

The accepted output transform remains in
[`materialAwareNodeMaterials.ts`](../../src/render/backend/materialAwareNodeMaterials.ts):
Standard materials use ACES Filmic plus sRGB when `toneMapped` is true and
sRGB conversion only when false; Basic and LineBasic materials follow the same
source `toneMapped` semantics. No authored colors, overlay values, exposure,
depth, or blending rules change here.

## 2. Before and after ownership

The previous Architecture Rise controller combined material signatures,
source-to-output tracking, scene-root ownership, readiness, inventory,
renderer output settings, performance instrumentation, and failure reporting.
It also keyed tracked output only by source material, which let traversal order
select the disposal owner.

The extracted boundary is:

| Responsibility | Owner |
| --- | --- |
| Source and shader signatures; adaptation; assignment reconciliation; stale release; generation-scoped tracker | [`materialAwareMaterialTracker.ts`](../../src/render/backend/materialAwareMaterialTracker.ts) and [`observerMaterialSignatures.ts`](../../src/render/backend/observerMaterialSignatures.ts) |
| Architecture Rise root lookup, readiness, and registered-subject adapted-copy ownership | [`architectureRiseMaterialOutputAdapter.ts`](../../src/render/backend/architectureRiseMaterialOutputAdapter.ts) |
| Architecture Rise role labels and material/environment/light inventory | [`architectureRiseMaterialInventory.ts`](../../src/render/backend/architectureRiseMaterialInventory.ts) |
| Renderer output/background setup, React Three Fiber frame scheduling, diagnostics, performance and fallback callback | Existing `MaterialAwareOutputPolicyController` composition in [`materialAwareObserverOutput.tsx`](../../src/render/backend/materialAwareObserverOutput.tsx) |
| Renderer selection, initialization, Canvas remount and one-shot fallback | Existing Observer host and renderer lifecycle |
| Source geometry/material/texture construction and source disposal | Existing subject factories and their lifecycle owners |

The controller remains Architecture Rise-specific. The output/background
setup was deliberately kept in that controller shell because PR L does not
need a second renderer lifecycle abstraction.

## 3. Shared core contract

`getObserverMaterialSignatures()` produces a full property signature and a
shader-relevant signature. The tracker uses source identity plus owner identity
as its cache key. It can therefore reuse one adapted copy for multiple
renderables under one owner without allowing an unrelated owner to inherit
disposal authority.

`MaterialAwareMaterialTracker` accepts renderables, an explicit
`MaterialOutputOwner`, a frame number, signature lookup, and an optional
adaptation timing wrapper. It returns the materials to attach, unsupported
assignments, replacement counts, and whether adaptation state changed. It does
not own or dispose source materials, source textures, or geometry.

The cache is scoped to one renderer generation. Adapted materials carry
private source, owner, and tracker identity symbols. No adapted material is
reused across tracker generations.

## 4. Source and adapted material identity

The private `observerOutputSourceMaterial` symbol links each NodeMaterial copy
to its authored source. This lets the tracker recognize its own attached copy
on later frames and continue to read live authored properties from the source.
The owner and tracker symbols describe the adapted instance's lifetime; they
do not transfer ownership of the source or its texture maps.

The full signature detects changes such as color, opacity, tone mapping,
texture assignment, and other serialized material properties. The shader
signature separately tracks compile-relevant settings such as transparency,
side, blending, depth policy, alpha settings, and map identities. Uniform-only
changes update the existing output copy without recreating it; shader changes
request a material update.

## 5. Ownership and disposal policy

`MaterialOutputOwner` names the owner identity and policy for retaining and
releasing adapted NodeMaterials. Two current policies are used:

* **Observer-controller-owned** copies use a fresh owner for each tracker. The
  controller restores assignments that still point to its copy, then disposes
  each retained copy once.
* **Registered-subject-owned** copies are retained by the registered subject's
  existing adapted-material set. The subject disposer includes those copies in
  its normal resource cleanup. Tracker cleanup is idempotent with subject
  cleanup because release removes and disposes only copies still present in
  that owner set.

The source resource's factory/component owner remains responsible for source
materials, maps, and geometry. `disposeTeachingSubjectResources()` only gained
an optional iterable of additional owned materials so Architecture Rise can
include its adapted outputs in its existing disposal boundary.

## 6. Registered instance-owned assets

Architecture Rise resolves its registered subject root in the scene-specific
adapter. The root provides the set that owns adapted copies. Role classification
and the existing inventory schema remain Architecture Rise-specific. Readiness
still requires the `architecture-rise-subject` root, and the candidate still
fails closed on unsupported material families.

The existing output-policy DOM attributes, inventory fields, background node,
tone-mapping settings, failure callback, and one-shot application fallback are
preserved. Architecture Rise's render graph and output selection are unchanged.

## 7. Module-shared assets

View Camera Anatomy's registered target uses one module-owned box geometry and
five module-owned Standard materials. Observer and Ground Glass construct
separate Object3D groups that borrow those same sources. The isolated lifecycle
regression creates an adapted copy for the Observer mesh while leaving the
Ground Glass mesh attached to the shared source. It mutates the source,
reconciles the Observer copy, releases and remounts the tracker, and verifies
that the source material and geometry are not disposed.

This test validates a borrowed-source client contract. It does not install a
material-aware controller in the Anatomy scene, add an Anatomy output query,
or change Anatomy renderer eligibility. The Ground Glass renderer and its
independent WebGL RTT are unchanged.

## 8. R3F mutation, replacement, and removal

An in-place source mutation updates the existing adapted copy on reconciliation.
When a renderable receives a new material, the new source gets its own adapted
copy and the old copy is released after the existing two-frame stale window.
Multiple renderables can share one owner-scoped copy; it is retained while any
assignment remains active. A newer material assignment wins during cleanup:
the tracker restores the source only when that assignment still points to its
adapted copy.

Each tracked material slot has its own last-seen frame. When a renderable stops
appearing in scene traversal, its attachment is restored and detached after two
missed frames, even if another renderable keeps the shared material record
active. The shared adapted copy is released only after its record has no live
attachments and its own two-frame stale window has elapsed. Tracker teardown
restores assignments that still point to a copy before releasing it. Source
geometry, materials, and textures remain outside the tracker's disposal
authority.

## 9. Renderer generation and fallback

The controller creates one tracker for its `rendererGeneration`. The existing
Observer host remains the authority for selection, asynchronous initialization,
Canvas remount, and application fallback. Tracker cleanup runs with controller
cleanup and releases all copies associated with that renderer generation.
No new retry or fallback state machine was added.

## 10. Performance

The controller retains its once-per-source-per-frame signature cache,
sampled-duration windows, dirty-driven/periodic inventory refresh, and existing
adaptation counters. The tracker performs ownership bookkeeping during the
same scene traversal. Matched browser measurements and the post-extraction
callback/lifecycle results are recorded below. Baseline and extracted-candidate
measurements use the same headed Chrome, macOS host, viewport, DPR, Three.js
revision, native WebGPU qualification, three matched output-policy pairs, orbit
workload, and two-minute sustained-use sequence. Controller CPU numbers are
instrumented JavaScript callback durations, not GPU render times.

| Measurement | `origin/main` baseline | PR L extracted candidate |
| --- | ---: | ---: |
| Material-aware assignments | 393 | 393 |
| Mean signature evaluations/frame | 72.86–72.87 | 72.87–72.88 |
| Inventory builds per ~143-frame pair | 8 | 8 |
| Controller callback mean across three pairs | 0.868 ms (0.855–0.882) | 0.951 ms (0.940–0.974) |
| Controller callback median | 0.8 ms | 0.9 ms |
| Controller callback p95 | 1.2–1.3 ms | 1.2–1.5 ms |
| Active-gesture rAF median | 13.4–16.7 ms | 13.4 ms |
| Active-gesture rAF p95 | 14.1–17.7 ms | 14.3 ms |
| Sustained controller mean | 0.760 ms/frame | 0.842 ms/frame |
| Sustained material signature work | 72.929 evaluations/frame | 72.930 evaluations/frame |
| Sustained inventory builds | 331 / 60-frame refresh interval | 332 / 60-frame refresh interval |

The extracted candidate remained bounded at 73 active adapted materials after
state churn. The baseline and candidate each recorded 532 orbit gestures, 33
control operations, and 73 active adapted materials after sustained state
churn. The candidate callback mean increased by 0.083 ms (9.6%) across the
three pairs and its sustained mean increased by 0.082 ms/frame (10.8%). This is
the measured cost of the added source-plus-owner lookup and attachment
restoration bookkeeping needed for independent ownership; it remains below
0.1 ms per frame. Candidate gesture cadence did not worsen in these runs, but
the baseline varied more across pairs, so this small sample does not establish
a general performance conclusion. GPU render time is not measured.

The comparison used the existing isolated benchmark from each worktree with
the same invocation and `OBSERVER_NATIVE_WEBGPU_REQUIRED=1`,
`OBSERVER_BACKEND_BENCHMARK=1`, `OBSERVER_OUTPUT_POLICY_COMPARISON=1`, and one
Playwright worker. Baseline and candidate each completed three paired native
trials followed by the same recovery and two-minute sustained lifecycle path.
The candidate's generated report identifies its measurement commit; the
baseline run was generated directly from `origin/main`.

## 11. Native visual regression

The strict PR #254 visual-parity benchmark remains unchanged. Native execution
requires mounted `webgpu-renderer / webgpu`, material-aware output, one
initialization attempt, no initialization failure, and no application
fallback. Headless WebGL2 fallback is not native evidence. On headed Chrome
155.0.8059.84, macOS Darwin 27.0 arm64, Three.js r186, the native-required
strict gate passed with 78 applicable criteria passing, zero failures, and 3
conditional criteria not applicable. The mounted backend was
`webgpu-renderer / webgpu`, with one initialization, available adapter, and no
application fallback. Ground Glass remained contentful on its independent
WebGL2 RTT. Hardware acceleration remains unconfirmed; Chrome reported Metal
and no software renderer, but did not identify the adapter selected by WebGPU.
The benchmark also exercised `observerOutput=standard` as the unchanged
standard-output control. Playwright attaches the report and selected captures
under the ignored `test-results` directory for each run.

## 12. Anatomy readiness for PR M

PR L provides a source-plus-owner material tracker and an isolated test of the
module-shared Anatomy source contract. It does not implement the Anatomy
readiness policy or enable Anatomy output adaptation. A future integration
still needs scene-specific readiness and coverage for the conceptual camera's
dynamic materials, bellows geometry, aperture/rear-back replacements, and
visual output. Standard WebGPU and default WebGL behavior remain unchanged.

## 13. Rollback

The Architecture Rise integration can continue to use its scene-specific
adapter and the extracted tracker. A future Anatomy integration can be disabled
by removing only its future scene-specific adapter/selection hook; the standard
Anatomy WebGPU path, Architecture Rise material-aware pilot, production WebGL
policy, Ground Glass, and canonical optics do not depend on that future hook.

## Validation record

The verified source base was `origin/main` commit
`bcf4aa90a3402fff06db74ba789ccb1988d36a80`; it did not advance during this
round. The completed baseline report was generated on that commit; the
candidate performance report identifies measurement commit
`560e613067ef89cd5d93c2aadf647affa211f751`. The final documentation commit is
recorded separately in the PR handoff.

Validation completed on the extracted candidate:

- Focused tracker, controller, and module-shared lifecycle tests: 20 passed.
- Full unit suite: 251 files and 2,332 tests passed.
- Typecheck, lint, CSS structure check, and production build passed.
- Ordinary Observer pilot E2E: 8 passed; Architecture Rise validation E2E: 2
  passed; Lesson 0 Anatomy E2E: 1 passed; production preview: 1 passed. These
  Observer pilot, Anatomy Lesson 0, and production-preview E2Es ran before the
  final attachment-retention hot-path optimization. Architecture Rise
  validation was rerun on the final source commit: 2/2 passed, with the
  ordinary Chromium route reporting `webgpu-renderer / webgl2-fallback`, an
  unavailable adapter, no application fallback, contentful Ground Glass, and
  no page or console errors. This E2E is fallback regression evidence, not
  native WebGPU evidence.
- Native-required strict visual parity: 1 passed; 78 pass, 0 fail, 3
  conditional N/A.
- Native-required paired performance/lifecycle qualification: 1 passed,
  including six valid native backend trials and 11/11 lifecycle transitions.
  Baseline and candidate reports used the same browser/runtime and each
  recorded 11/11 recovery/navigation transitions, stable material balance,
  contentful Ground Glass, and no page/console errors.
- Native browser: Chrome 155.0.8059.84, macOS Darwin 27.0 arm64, Node 24.19.0,
  Three.js r186. `navigator.gpu` and adapter were available; mounted execution
  was `webgpu-renderer / webgpu`; hardware acceleration is unconfirmed.

The candidate report was generated after implementation commit
`560e613067ef89cd5d93c2aadf647affa211f751`. The baseline report is preserved
in the isolated baseline worktree's ignored benchmark results from
`origin/main`; the candidate report is at
`test-results/observer-backend-comparison/pr-l-final/run.json`. The native
strict report is at
`test-results/observer-backend-comparison/playwright/observer-visual-parity.ben-f1f5b-ounds-and-teaching-overlays-chrome-native-webgpu/observer-visual-parity.json`.
Both completed performance/lifecycle runs and the native strict run report no
page or console errors. Existing `THREE.Clock` deprecation warnings were emitted
by the dependency path and are not page/console errors.

## 14. Review-Fix Round 1 — Renderable Attachment Lifetime

### F1 — Stale attachment retention

The initial stale sweep expired only `ManagedMaterial` records. If Mesh A and
Mesh B shared a source-plus-owner output and A left the scene, B refreshed the
record every frame. A's attachment therefore stayed in both the record's
attachment set and the renderable index indefinitely. The record's liveness
could not establish the liveness of every renderable using it.

Each `MaterialAttachment` now stores its own `lastSeenFrame`. Reconciliation
refreshes that frame and reuses the attachment when the same renderable and
material slot return before expiry. The stale sweep removes attachments absent
for two complete frames, independent of their record's activity. It restores a
slot only when the renderable still points to that attachment's adapted output;
a newer authored assignment is preserved. A shared record and NodeMaterial
remain alive while any attachment is active. The existing `MaterialOutputOwner`
continues to be the only authority that releases the output, keeping source plus
owner identity and Architecture Rise's registered-subject owner unchanged.

Read-only tracker counts expose current attached slots and renderables for unit
assertions. The existing development-only performance report now includes
current and peak attachment/renderable counts. Cleanup operates over currently
tracked attachments and records; it keeps no history of expired renderables.

### Regression evidence

The new two-mesh scene-traversal regression failed against the reviewed tracker:
after A had missed the two-frame window while B remained active, the expected
one attachment was still two. After the fix it verifies that A is restored and
removed from both indexes, B keeps the shared output, and that output is
released once only after B also expires.

Additional focused coverage exercises 100 temporary-mesh mount/unmount cycles,
source replacement while a sibling remains active, multi-material slot
reordering and replacement, reattachment before expiry, independent owner
domains, a newer authored assignment, Architecture Rise's registered-subject
owner, and final tracker/generation cleanup. The 100-cycle test checks the
tracked-renderable and attachment counts after every cycle and requires one
final output disposal with the borrowed source still alive. The Anatomy
module-shared-source lifecycle tests remain passing; Anatomy material-aware
output remains disabled.

| Scenario | Expected attachments | Observed | Output disposal |
| --- | ---: | ---: | --- |
| Two shared meshes active | 2 | 2 | None |
| One mesh expired, sibling active | 1 | 1 | None; shared output retained |
| 100 temporary cycles with persistent sibling | 1 after each cycle | 1 after each cycle | None during cycles |
| All attachments expired | 0 | 0 | Shared output disposed once |
| Tracker/renderer-generation teardown | 0 | 0 | Owned copies released once; source materials remain alive |

### Matched performance and native parity

The corrected comparison used the same isolated benchmark on the reviewed
implementation commit `e7a7a428eafd16000306238118edfbefcb2e2554` and corrected
implementation commit `e45e7aa753787dad3e36e15570606f8ca051880c`. Both ran on
macOS Darwin 27.0 arm64, headed Chrome 155.0.8059.84, Three.js r186, Node
24.19.0, at 1440×1000 / DPR 1. The browser API and adapter were available and
the actual mounted renderer was `webgpu-renderer / webgpu`. Hardware
acceleration remains unconfirmed.

| Measurement | Reviewed PR head | Corrected candidate |
| --- | ---: | ---: |
| Valid matched native trials | 6 / 6 | 6 / 6 |
| Material-aware callback mean across 3 pairs | 0.983 ms | 0.972 ms |
| Pair callback median / p95 | 0.9 / 1.3–1.4 ms | 0.9 / 1.4 ms |
| Assignments / active records | 393 / 73 | 393 / 73 |
| Current / peak attachments | Not instrumented | 393 / 393 |
| Current / peak tracked renderables | Not instrumented | 393 / 393 |
| Sustained callback mean over about 120 seconds | 0.871 ms/frame | 0.913 ms/frame |
| Sustained callback median / p95 | 0.8 / 1.0 ms | 0.9 / 1.2 ms |
| Sustained scene-traversal mean | 0.873 ms | 0.912 ms |
| Detailed stale-cleanup mean / p95 | 0.0023 / 0 ms | 0.0081 / 0.1 ms |
| Signatures evaluated / frame | 72.931 | 72.930 |
| Adapted material creations / disposals during sustained use | 271 / 198 | 271 / 198 |
| Active-gesture rAF median / p95 | 13.3 / 14.1 ms | 13.4 / 14.2 ms |

The corrected candidate's sustained controller mean was 0.042 ms/frame higher
in this single paired run; the sampled stale sweep averaged 0.0081 ms with a
0.1 ms p95 across 298 detailed samples. These measurements are CPU callback
instrumentation, not GPU time, and the browser timing resolution is coarse at
these durations. The three short paired callback means did not increase on the
corrected candidate. Results are descriptive and do not set a performance
threshold or general platform ranking. Both sustained runs kept 393
assignments, 73 active adapted materials, 33 control operations, and similar
gesture cadence. On the corrected run, material creation minus disposal
remained 73 after state churn; teardown reported zero attachments/renderables
and balanced 271 creations with 271 disposals. All 11/11 recovery/navigation
transitions passed with no page or console errors and contentful Ground Glass.

The strict PR #254 native visual-parity gate was rerun on the corrected commit
without changing its criteria: 78 applicable criteria passed, zero failed, and
3 conditional N/A. The standard-output control also remained native WebGPU;
Ground Glass remained contentful on its independent WebGL2 RTT.

### Decision

**L1 — SHARED CORE VALIDATED.** Attachment liveness is independent from shared
material-record lifetime, owned outputs are released through their existing
owners, the stress regression shows bounded counts, and native Architecture
Rise parity remains valid. This decision validates the shared core for its
current Architecture Rise integration. It does not activate Anatomy
material-aware output or authorize production WebGPU.

The matched reports are under the ignored `test-results` directory:

- Reviewed implementation: `test-results/observer-backend-comparison/pr-l-review-fix-baseline/run.json`
- Corrected implementation: `test-results/observer-backend-comparison/pr-l-review-fix-candidate/run.json`
- Corrected strict parity: `test-results/observer-backend-comparison/playwright/observer-visual-parity.ben-f1f5b-ounds-and-teaching-overlays-chrome-native-webgpu/observer-visual-parity.json`

## PR M follow-up — real Anatomy candidate

PR M uses the shared tracker in the real View Camera Anatomy Observer through
an Anatomy-specific readiness, material inventory, and Observer-owned output
adapter. Three native-required Chrome runs adapted all 47 measured assignments
(35 distinct source materials, zero unsupported assignments), kept the five
module-shared source materials and shared BoxGeometry attached to the Ground
Glass consumer, and released NodeMaterials by the controller owner. Ground
Glass remained pixel-identical across WebGL, standard native WebGPU, and the
material-aware candidate in all 13 states.

The measured mean object-ROI RGB MAE was 33.3534 for WebGL versus the Anatomy
candidate and 51.5763 between standard native WebGPU and the candidate. The
large highlighted, dimmed, aperture, bellows, and rear-back differences keep
the integration experimental. The Architecture Rise strict parity result
remains unchanged at 78 pass / 0 fail / 3 conditional N/A. **PR M decision: M2
— OPT-IN IMPLEMENTATION INCOMPLETE.** The Anatomy route remains an explicit
development opt-in; L1 still describes the shared core's validated use in
Architecture Rise, not visual qualification of every scene adapter.

The matched states, per-ROI values, renderer timing/cadence, source ownership,
negative controls, and limitations are recorded in the
[Anatomy integration report](VIEW_CAMERA_ANATOMY_MATERIAL_AWARE_INTEGRATION.md)
and its [three-trial summary](view-camera-anatomy-material-aware/repeat-trials.json).
