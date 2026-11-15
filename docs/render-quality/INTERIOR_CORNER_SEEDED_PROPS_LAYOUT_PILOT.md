# Interior Corner Seeded Props & Micro-Layout Pilot

## Decision and scope

**PASS — schema-v2 decorative prop variation is integrated in Interior Corner Free Practice.**

Schema v2 adds constrained console accessories, one or two bench cushions, and
small rug-pattern/placement changes. Room architecture, walls, ceiling,
baseboards, major furniture, focus and composition targets, camera placement,
movement limits, lesson semantics, and lighting remain canonical. Guided Mode
and lesson Observe remain canonical.

This is a bounded decorative pilot, not an unrestricted room generator. The
existing Scene Variation subject factory and disposal ownership are reused.
There is no new renderer, asset loader, texture cache, material framework, or
lighting path.

## Version and URL policy

Interior Corner currently declares schema v2 and explicitly supports both v1
and v2:

| URL | Meaning |
| --- | --- |
| `?seed=284719&sv=1` | Accepted PR #337 material-only scene |
| `?seed=284719&sv=2` | Materials plus deterministic props and rug micro-layout |
| `?seed=284719` | Legacy link; remains schema v1 and normalizes to `sv=1` |
| No `seed` or `sv` | One generated seed under current schema v2 |
| Unsupported `sv=3` | Fails closed under the existing schema status behavior |

A copied v2 URL preserves the origin, deployment base, seed, schema version,
unrelated parameters, and hash. Regeneration creates a new seed under the active
schema and pushes a history entry; Back/Forward replays the prior seed and
arrangement. Camera controls, Observer orbit, and Ground Glass mode remain
separate from the variant identity.

Schema v1 is locked against the accepted PR #337 implementation at source
`22ed40b1bbc4696de109f2c6fd2acebfe8f0628c`. Full Observer subject signatures
for `(sceneId=interior-corner, schemaVersion=1)` are:

| Seed | Accepted subject signature |
| ---: | --- |
| 0 | `2fe78f16df3a0a5f1a959c8fba50169cd1553dbeedd20d4a1cdd57dee8d7f9fd` |
| 1 | `4344861526dd05bb3e96837af505aafc947b4ce6f0d350870915e6f5e486b1f1` |
| 284719 | `76e86cab45f0cd07709e1e815874852e09cdbddd3932b9c56749ed58979d0268` |
| 4294967295 | `202e14ae54416b3e44dedcb3a504014a91c685228b6b3e94ee233d87a91dfc7e` |

These locks include subject graph names/types/transforms, geometry attributes
and indices, material parameters, and procedural map bytes. V1 retains the
canonical vase and has no v2 seeded-prop group.

## Deterministic plan

`resolveInteriorCornerPropVariationPlan(descriptor)` returns a pure,
renderer-neutral, serializable `InteriorCornerPropVariationPlan`. It contains
only semantic IDs, object families, millimetre dimensions/placements,
rotations, palette choices, and rug motif. The plan uses stable per-object
`props` and `layout` substreams; it does not use browser entropy, time, camera
state, React render order, or renderer UUIDs. A prop added under a new ID does
not advance another object's stream or any material stream.

Fixed schema-v2 plan signatures (`SHA-256(JSON.stringify(plan))`):

| Seed | Plan signature |
| ---: | --- |
| 0 | `f75ec88d9ff3e410a92e9c04a2811d843b4e0b2c223cc81c0e8a0f943d68b279` |
| 1 | `a2444f7294ce17a3bb26e1f701ff90773519ba26cb1beb96cff7b88ed54233c1` |
| 284719 | `6cc1bfe1ffde90045f99c01af4bfeb7bee74fc05c6f0b262c3875ceb676cec95` |
| 4294967295 | `fcca3b1d9ddb2ab6a315d90e7c0f53e5f755ac4fc38289a246ebb294b461e552` |

The placement audit was sampled over seeds `0–255`; every plan had finite,
positive dimensions and passed room, support, cushion/backrest, mutual
intersection, rug, and protected focus-target checks. If a draft ever fails,
the planner returns a deterministic safe fallback rather than retrying random
positions.

## Prop catalog and geometric bounds

All positions and dimensions are planned in canonical millimetres and pass
through the existing `toWorld()` conversion only in the registered factory.
The support surfaces are derived beside the canonical scene geometry:

| Support | Canonical top/surface | Plan allowance |
| --- | --- | --- |
| Console top | center `(-1050, -745, 9850)`, size `1850 × 70 × 500`, top Y `-710` | Vases, 2–3 stacked books, and one small sculpture use fixed safe tabletop slots |
| Bench seat | center `(-850, -970, 6500)`, size `1750 × 420 × 560`, top Y `-760` | One cushion `470–580 × 145–155 × 330–390`, or two `420 × 135 × 350` cushions; bounded center and yaw; backrest clearance is audited |
| Rug | center `(180, -1388, 5900)`, size `2200 × 24 × 3300` | Existing dimensions stay fixed; X/Z offsets are limited to ±80/±90 mm and yaw to ±1.5° |

The console arrangement selects a bounded vase profile/palette and may add a
small stack of books or a ceramic/faceted sculpture. Cushions use muted clay,
ochre, sage, or slate palettes. The rug selects plain, bordered, or striped
patterns in neutral palettes; the stripe/border geometry stays within the rug
surface. The fixed lamp and all architectural/focus-target geometry remain
unchanged. Ceiling `castShadow=false` remains active; subject-local props use
the existing scene shadow participation policy.

## Observer / Ground Glass integration and ownership

The same variation descriptor and plan flow through the registered
`InteriorCornerSubjectFactory` for Observer and Ground Glass. Tests compare
stable semantic mesh names, dimensions, transforms, materials, and map
signatures for seeds 284719 and 4294967295 while ignoring Three.js UUIDs. The
resulting subject graphs agree but own separate geometries, materials, and
textures. Disposal spies confirm each owned resource is disposed exactly once.

A seed change replaces only the subject. Production-preview checks verify that
renderer generation and RTT resource generation remain stable, frames advance
for each identity, and camera/preview state remains unchanged through
regeneration. Same-seed A→B→A history restoration returns the expected subject
capacity. Ground Glass continues to use the existing WebGL2 projection and
focus/DOF path; no optics, shader, renderer, or task-evaluation code changed.

## Real-browser visual evidence

Chromium production-preview captures used viewport `1440 × 1000`, DPR 1, the
WebGL2 Observer path, clean Observer overlays, and a native `514 × 411` canvas.
The fixed v2 reference URL was copied and replayed; the resulting Observer PNG
was pixel-identical to direct entry. The root production preview was built with
`VITE_BASE_PATH=/`. The second production preview was built with
`VITE_BASE_PATH=/view-camera-simulator/` and verified direct entry, copied URL,
replay, reload, regeneration, Back, and Forward without duplicating the base.

- [Canonical lesson vs schema v1 vs schema v2, seed 284719](evidence/interior-corner-seeded-props-layout/schema-v1-v2-comparison.png)
- [Three schema-v2 seed arrangements](evidence/interior-corner-seeded-props-layout/v2-seed-arrangements.png)
- [Observer, Ground Glass, and copied-link replay for seed 284719](evidence/interior-corner-seeded-props-layout/observer-ground-glass-replay.png)

The ordinary-size comparison shows at least two recognizable differences
between v2 seeds 284719 and 4294967295: one versus two cushions with different
placement/color, and striped versus bordered rug treatment. Console accessory
silhouette/palette also varies. The v1 and canonical captures retain the
original single-vase/uncushioned layout. The design stays restrained; no neon
colors, oversized objects, or camera changes were used. The three contact
sheets contain real browser captures at native panel scale, not generated or
manually edited scene images.

The repository Dream Loop capture harness also passed for the clean/teaching
Observer pair. It wrote its working captures under the ignored
`.dream-loop/interior-corner/` directory. No Dream Loop optimization target or
camera/optics UI change was introduced.

## Ground Glass and regeneration evidence

The production-preview v2 suite runs nine focus/aperture combinations for seed
284719 (focus 5800/8000/10400 mm × f/5.6, f/11, and f/22), requiring a distinct
completed RTT frame for every state. A second v2 seed exercises Upright Assist,
Raw Ground Glass, Front Rise 33 mm, and Front Swing 3.6°. Regeneration runs
while Upright Assist is active and checks that the preview mode, aperture,
focus, rise, swing, Observer camera position, overlay state, renderer
generation, and RTT resource generation stay fixed.

The lifecycle browser test performs A→B→A/Forward restoration followed by ten
regenerations through mixed plan capacities. It records renderer resources and
frame cadence from the existing profiler, checks exact same-seed subject
capacities after a new completed frame, and bounds resource growth across the
sequence. In the final root production-preview run, the test made 11
regenerations with 9 distinct subject-capacity plans. Renderer geometry counts
ranged from 64 to 71 while renderer texture count remained 31; renderer and RTT
resource generations stayed stable. Restored seed 284719 had Observer/RTT
subjects with 88/87 objects, 76 meshes, 65 geometries, 13 materials, and 22
textures. Timing used the existing CPU fallback profiler (`gpuQueryState` was
unavailable): 60 frame samples had p50 288.7 ms and p95 343.9 ms, while CPU
submit p50/p95 were 0.3/0.4 ms. These headless-browser timings are diagnostic
only and do not support a GPU or production-FPS claim. WebGPU qualification is
outside scope.

## Final browser validation

Both preview builds used Chromium and the production Vite preview server. The
existing schema-v1 variation suite passed all 5 tests (11.1 minutes).

| Build base | Browser route and share result | Production-preview result |
| --- | --- | --- |
| `/` | `http://127.0.0.1:4182/simulator/free/interior-corner?seed=284719&sv=2&keep=one#pilot`; copied URL was `http://127.0.0.1:4182/simulator/free/interior-corner?keep=one&seed=284719&sv=2#pilot` | 5/5 passed (9.5 minutes); copied-link replay was pixel-identical at 514 × 411; v1 smoke, v2 policy, nine-state Ground Glass matrix, regeneration, resource lifetime, and second-seed movement checks passed. |
| `/view-camera-simulator/` | `http://127.0.0.1:4183/view-camera-simulator/simulator/free/interior-corner?seed=284719&sv=2&keep=one#pilot`; copied URL matched the effective browser URL with one deployment-base prefix | 2/2 passed (2.0 minutes); v1 share regression and v2 copied-link replay, reload, regeneration, Back, and Forward checks passed. The copied replay matched the original Observer capture. |

The copied v2 link preserved origin, path/base, `seed`, `sv`, unrelated query
parameters, and hash. Regeneration changed the seed without changing the active
schema; Back restored seed 284719 and Forward restored the regenerated seed.

## Validation

The v1 golden signatures and schema-v2 plan signatures are asserted in focused
unit tests. Local final checks completed under Node 24.3.0: `npm test` passed
336 files / 4,153 tests; `npm run typecheck`, `npm run lint`,
`npm run check:css`, `npm run build`, and `git diff --check` passed. The focused
variation/factory/routing group passed 107 tests. The existing schema-v1
browser suite passed 5/5; root-base production preview passed 5/5; and the
`/view-camera-simulator/` production preview passed 2/2. Current-head GitHub CI
status is reported in the PR handoff and is not inferred from these local runs.

## Reproduction

```bash
npm test -- src/tests/unit/sceneVariation.test.ts src/tests/unit/sceneVariationUrl.test.ts src/tests/unit/sceneVariationRoute.test.ts src/tests/unit/sceneVariationStore.test.ts src/tests/unit/interiorCornerFoundation.test.ts src/tests/unit/interiorCornerPropVariation.test.ts
npm run typecheck
npm run test:e2e -- --config=playwright.scene-variation.config.ts src/tests/scene-variation-e2e/interior-corner-seeded-materials.spec.ts
npm run test:e2e -- --config=playwright.scene-variation.production.config.ts --project=chromium-scene-variation-production
npm run test:e2e -- --config=playwright.scene-variation.subpath-production.config.ts --project=chromium-scene-variation-subpath-production
```
