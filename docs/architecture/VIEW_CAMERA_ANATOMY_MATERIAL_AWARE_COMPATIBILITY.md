# View Camera Anatomy Material-Aware Compatibility Audit

**Decision: K2 — ARCHITECTURE WORK REQUIRED**

The Anatomy scene runs on the standard native WebGPU path, and the observed
source material families have corresponding NodeMaterial candidates. That is
not enough to reuse the Architecture Rise controller safely. Anatomy’s
registered target borrows module-owned source materials and geometry shared
with Ground Glass, while its conceptual camera changes materials and geometry
throughout Lesson 0. A future adapter must own separate NodeMaterial copies
and keep scene readiness and disposal specific to Anatomy.

This audit did not install or exercise an Anatomy material-aware adapter. The
normal Anatomy route remains standard WebGPU when explicitly requested, the
normal Observer remains WebGL, production remains WebGL-only, and Ground Glass
remains its independent WebGL RTT.

## Scope and evidence provenance

The audit follows the PR #257 promotion on `main` at
`9accfe840ad7a314ba7323d98293bf56cfa6e2fa`. Source and runtime evidence were
collected at measurement commit
`4bb8efcdfaf3cc80d99a605fa909f864fb8e27c0` using a development-only,
read-only R3F snapshot probe. The probe traverses the mounted scene and
captures material, geometry, lighting, shadow, renderer, camera, and projected
region data only when the Anatomy audit query is present. It creates no GPU
resource and changes no scene resource.

The committed machine-readable inventory is
[`view-camera-anatomy-material-inventory.json`](view-camera-anatomy-material-inventory.json).
It contains the per-state inventories, projected regions, backend
measurements, source references, and provenance. The adjacent
[`view-camera-anatomy-material-compatibility/`](view-camera-anatomy-material-compatibility/)
directory contains the 13 matched WebGL and 13 native WebGPU screenshots.

## Current Anatomy rendering architecture

`view-camera-anatomy-subject` is registered as the scene asset. The asset
factory creates fresh Groups and Meshes for each consumer, but borrows its
module-lifetime `UNIT_BOX_GEOMETRY` and five role materials. Observer and
Ground Glass therefore have different object groups over the same source
resource identities. The asset factory explicitly forbids an individual
interactive or RTT group from disposing those shared resources.

The conceptual camera is a separate, R3F-authored teaching assembly. Its eight
semantic parts are lens, lens board, front standard, bellows, rear standard,
ground-glass back, film holder, and camera support. Optical teaching helpers
are separate again. The camera model and helpers are not children of the
registered target subject and have different shadow and lifetime behavior.

## Material inventory

The initial mounted view on either backend contained 47 renderable objects
and material assignments, 35 distinct material instances, and 31 distinct
geometry instances. It included the 17-mesh registered target and 30
conceptual camera meshes; no optical helper was mounted in that initial state.
Across all 13 captured states, the inventory observed three source material
families and no populated material texture slots.

| Scene role | Runtime material families | Ownership and observed semantics |
| --- | --- | --- |
| Registered target subject | `MeshStandardMaterial` | 17 assignments share 5 module-owned materials and one module-owned `BoxGeometry`; tone-mapped, opaque, front-sided, depth-tested and depth-writing; no textures. Source identity and authored properties stayed stable across the captured lesson states. |
| Conceptual camera | `MeshStandardMaterial`, `MeshBasicMaterial` | R3F scene-component owned. Standard camera materials are tone-mapped. Basic camera materials preserve their individual `toneMapped` value. Parts include transparent and opaque states, front/double-sided surfaces, depth-write changes, and non-default render orders. No textures were observed. |
| Optical helpers | `MeshBasicMaterial`, `LineBasicMaterial` | R3F scene-component owned; observed helper materials are `toneMapped=false`, transparent, and have depth test/write disabled. Their display appearance must remain unlit and helper ordering/occlusion semantics must be preserved. No textures were observed. |

The registered target’s five authored role colors are `#26364a`, `#f8fafc`,
`#e11d48`, `#f59e0b`, and `#38bdf8`; all five use roughness `0.82` and
metalness `0.04`. The actual material family set is compatible with the
existing Standard, Basic, and LineBasic NodeMaterial subclasses at the
source-family level. That does not validate their real-scene adaptation.

The machine inventory records material color, emissive, tone mapping, opacity,
transparency, blending, depth test/write, side, alpha test, roughness,
metalness, texture slots, ownership, per-role assignment counts, and observed
states. Counts for dynamically replaced camera materials are across the
captured states; they are not a claim that all such instances are mounted at
once.

## Module-shared resource contract

The source factory’s `materialByRole` map and `UNIT_BOX_GEOMETRY` live for the
module/application lifetime. The separate shared-resource lifecycle test
confirms that Observer and Ground Glass receive different Groups but share the
same one-geometry/five-material identity sets, and that group cleanup/remount
does not call `dispose()` on those resources. No textures are present in this
asset.

The Architecture Rise controller currently assigns adapted NodeMaterials
inside its subject-specific ownership model. It treats the registered subject
disposer as the owner of those NodeMaterials and their textures. That
assumption cannot be applied to Anatomy source materials or geometry. An
Anatomy adapter must instead:

1. Keep each source material and source geometry unchanged.
2. Create a copied NodeMaterial for Observer rendering and assign it only to
   the Observer mesh.
3. Own and dispose only those NodeMaterial copies.
4. Restore original mesh assignments and renderer/scene output settings on
   cleanup, without disposing the module-owned source resources.
5. Allow Ground Glass to continue consuming its own group over the original
   resource identities.

The audit did not test adapted materials alongside a live Ground Glass RTT.
Ground Glass remained contentful during the standard WebGPU baseline, and its
identity/disposal contract is covered separately by the unit test. Neither
fact is evidence that an unimplemented Anatomy adapter is resource-safe.

## Dynamic Lesson 0 presentation

The 13 sampled states cover the initial view, the registered target subject,
front-standard and lens/board highlights, a smaller aperture, highlighted
bellows, rear-standard highlight, ground-glass-back mode, film-holder mode,
camera-support highlight, the Image Circle lesson, adjusted front rise, and
reset.

The snapshots show why an adapter cannot key updates only by source-material
identity:

- A highlighted lens can update a source material’s color in place.
- Camera parts also use replacement material instances across presentation
  states; signatures must observe property changes and replacements.
- The dimmed bellows reaches transparency with opacity `0.16` and
  `depthWrite=false` while retaining its double-sided surface semantics.
- Aperture changes replace blade geometry while preserving the lens material
  family and authored camera state.
- Bellows geometry identity remains stable while its position/index attribute
  versions change with presentation movement.
- Ground-glass back and film holder are alternative mounted assemblies; the
  snapshot did not find both modes mounted together or a ghost camera mounted.
- Optical helpers are not active in every conceptual lesson step. The
  physical image-circle helper is observed with adjusted front rise; the
  Image Circle lesson itself is conceptual and does not imply that this helper
  is mounted.

These are baseline source/runtime observations, not results from adapted
materials. Any follow-up must assert the visible teaching state as well as the
resulting color output: highlight and dim contrast, aperture readability,
rear-back distinction, helper depth behavior, transparency, side, and render
order.

## Lighting and shadow participation

The mounted scene uses one hemisphere fill at intensity `0.55` without shadow
casting and one directional key at intensity `1.15` with an active 1024 × 1024
PCF shadow map. The registered target’s 17 meshes cast shadows and receive
none. The conceptual camera’s meshes cast and receive none. The material-aware
integration must preserve this subject-specific policy; it must not mark all
scene meshes as target shadow casters or change lighting to compensate for
output differences.

## Native WebGPU and WebGL baseline

The final headed Chrome 155.0.8059.79 run on macOS Darwin 27.0.0 arm64 with
Three.js r186 captured 13 states on each backend. Both runs used the standard
output policy and matched canvas dimensions, viewport, DPR, camera pose, and
scene state for comparison.

| Evidence | WebGL reference | Native WebGPU baseline |
| --- | --- | --- |
| Mounted renderer | `webgl-renderer` | `webgpu-renderer` |
| Execution backend | `webgl2` | `webgpu` |
| Adapter | Not requested | Available |
| Application fallback / init failure | None / none | None / none; one initialization attempt |
| Output policy | Standard | Standard |
| Ground Glass | Contentful across all 13 captures | Contentful across all 13 captures |
| Page errors | None | None |
| Hardware acceleration | Unconfirmed | Unconfirmed; adapter presence does not distinguish hardware from software |

The Anatomy subject is visible and interactive on native WebGPU. In the
registered-target capture, the projected target region measured RGB MAE
`13.38` between the standard WebGL and WebGPU outputs, with `54.19%` of region
pixels changed. The conceptual camera ROI in the initial view measured RGB
MAE `13.72`. The background reference ROI measured RGB MAE `24.67`. These are
descriptive measurements only: this audit establishes no visual-parity
threshold and does not attribute all differences to one specific renderer
stage.

The captured screenshot canvas was 514 × 411 CSS pixels and 1028 × 820 backing
pixels at DPR 1. Screen projection and camera pose matched. Backend-specific
clip-depth entries in the full projection matrix differ as expected, so the
audit compares screen-relevant projection terms separately and retains the
complete matrices in the report.

The native captures confirm that the Anatomy pilot draws on WebGPU with the
existing standard output path. They do not show that standard output satisfies
Anatomy visual parity or that the material-aware candidate fixes the observed
differences.

Reproduce the isolated matched-state audit from the repository root on a
headed Chrome environment that can initialize native WebGPU:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 \
npx playwright test --config=playwright.anatomy-material-audit.config.ts --workers=1
```

The audit fails unless the native mount reports `webgpu-renderer / webgpu`,
one initialization attempt, no application fallback, and no initialization
failure. The paired WebGL run must report `webgl-renderer / webgl2`. The
machine-readable report and selected screenshots are written to ignored
Playwright `test-results`; copy only a completed run’s selected evidence into
the committed directory. This environment had native WebGPU, but no
independent GPU diagnostics were collected to establish hardware acceleration.

## Existing material-aware controller assumptions

| Controller responsibility | Audit classification |
| --- | --- |
| `setupOutput()` transforms for Standard, Basic, and LineBasic materials; source `toneMapped` semantics and sRGB conversion | Candidate shared output mechanism, previously tested in the r186 fixture; still needs Anatomy-specific integration validation. |
| Source-to-adapted material mapping and property/shader signatures | Candidate shared mechanics. Must handle in-place updates and replacement materials during Lesson 0. |
| Scene readiness and inventory schema keyed to `architecture-rise` | Architecture Rise-specific; Anatomy needs its own readiness/inventory adapter. |
| Subject lookup by `architecture-rise-subject` | Architecture Rise-specific; Anatomy root is `view-camera-anatomy-subject`. |
| Registered-subject disposer owns adapted NodeMaterials/textures | Unsafe for Anatomy’s module-shared source contract; must be replaced by explicit Observer-owned copies. |
| Background node install, renderer output setup, generation handling, and diagnostics | Potentially reusable after separating their output mechanics from subject readiness and resource ownership. |

Directly enabling the current controller for Anatomy would not be a safe
configuration-only change. Renaming its root test would still leave inventory,
readiness, background/scene lifecycle, and disposal assumptions coupled.

## Prototype boundary

No material-aware Anatomy prototype was installed. The controller’s ownership
assumption would let an Anatomy adaptation collide with resources still used
by Ground Glass, so testing adaptation before separating ownership would not
provide safe evidence. The report therefore distinguishes the actual standard
WebGPU baseline from source-level NodeMaterial family support; it claims no
registered-asset material-aware pass and no Anatomy material-aware parity.

The R3F probe is gated to development, the Anatomy scene, and the explicit
`observerMaterialAudit=1` verification query. It is read-only and absent from
the production bundle. It adds no renderer setting or user-facing control.

## Visual-parity acceptance plan

The next candidate should compare matched WebGL and native-WebGPU captures at
the same camera pose, viewport, DPR, and lesson state. Keep object-aligned ROIs
for the registered target, lens and board, front/rear standards, bellows,
ground-glass back, film holder, optical helper, and clear background. Test
state transitions independently:

- normal → selected highlight → reset;
- selected part → dimmed remaining parts;
- full → small aperture;
- ground-glass back ↔ film holder;
- bellows movement/highlight;
- optical helper visible and occlusion behavior.

Include negative controls that hide the target or remove a specific helper and
prove the corresponding ROI detector fails. Check transparency/depth
compositing and target shadow behavior in their own regions. Measure repeated
capture noise before setting thresholds. Until then, keep the comparisons
descriptive and do not copy Architecture Rise thresholds into Anatomy.

## Architecture options and recommendation

| Option | Assessment |
| --- | --- |
| A — Directly reuse the current controller | Reject for this scene. Readiness, root lookup, inventory and registered-subject disposal are Architecture Rise-specific; Anatomy resources are borrowed and shared. |
| B — Shared output core with scene-specific ownership adapters | Recommended. Extract output conversion/signatures/renderer mechanics from scene readiness, subject lookup, inventory, and disposal. Keep the existing Architecture Rise adapter behavior unchanged and give Anatomy its own Observer-owned NodeMaterial-copy lifecycle. |
| C — Dedicated Anatomy controller | Safer than direct reuse, but duplicates background/output/signature/render-generation mechanisms and risks drift. Consider only if a narrow shared core cannot be isolated without broad refactoring. |
| D — Defer integration | Required until Option B ownership/readiness boundaries and dynamic-state tests exist. Standard WebGPU remains the correct current Anatomy behavior. |

**K2 — ARCHITECTURE WORK REQUIRED.** The concrete blocker is the mismatch
between Architecture Rise’s registered-subject disposal ownership and
Anatomy’s module-shared source-resource contract, compounded by Lesson 0’s
material/geometry changes. The next work should first separate shared output
mechanics from scene-specific ownership and readiness. A later Anatomy
development-only integration can then create owned material copies and prove
them through matched visual evidence.

## Next implementation PR and rollback

The next PR should extract a narrow shared output core without enabling
Anatomy or changing Architecture Rise behavior. Its contract should accept a
scene-specific adapter for supported renderables, readiness, material
assignment, cleanup, and diagnostics. For Anatomy, the adapter must clone
source material properties into NodeMaterials, maintain source-to-copy
signatures, reassign safely when R3F replaces materials, restore source
assignments on cleanup, and dispose only copies it owns.

Required regression evidence for that work:

1. Source Anatomy materials, the module `BoxGeometry`, and Ground Glass
   resource identity/properties remain unchanged after mount, update, remount,
   and cleanup.
2. Ground Glass remains contentful and receives no NodeMaterial assignments.
3. Genuine native execution is required for candidate screenshots; a WebGL2
   fallback must fail the native gate.
4. Lesson 0 highlight, dim, aperture, bellows, rear-back, and helper states
   retain authored semantics and actual rendered visibility.
5. Existing Architecture Rise native parity evidence and all WebGL defaults
   remain intact.
6. An explicit development-only request and one-shot fallback remain
   independent of the normal WebGL route and production.

Rollback should consist of removing the Anatomy-specific adapter/opt-in while
leaving the standard WebGPU path and Architecture Rise-specific adapter
untouched. No production renderer, Ground Glass, or canonical optics change is
part of this audit or its proposed first extraction.
