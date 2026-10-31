# M7F r187 M6 Presentation Architecture Audit

Base inspected: `bcf6d7aeaa1b8653cc84d02e1fbfddbd359d413c` (M7E on `origin/main`).
This is a source audit before implementation; it reports no new r187 M6 runtime result.

## Compatibility and authority

The historical `GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY` in
`groundGlassM6PresentationPolicy.ts` binds all six M6 presentation features to
`r186` and `m6-architecture-rise-native-presentation-v1`. It remains an
implementation record for that runtime with quality still unqualified.

M4 resource provisioning and execution for an M6 request both use
`isGroundGlassM6PresentationRevisionMatched`. M5 provisioning, execution, and
eligibility use the same monolithic M6 record. That matcher requires every
feature to be implementation-verified at the installed revision; the M7D/M7E
r187 M4/M5 records are research-only and therefore do not pass it. The existing
M6 build flags can form an M6 request in a development build, but the host
selects WebGL because the request's historical r186 compatibility record does
not match installed r187. M6 flags alone do not mount r187 WebGPU. Production
backend policy remains separately denied.

An M6-capable session allocates the M3 scene target, M4 depth/physical/validity
resources, and M5 targets/scenes/materials before its first queued frame. That
provisioning is intentionally independent of whether the first accepted request
is Raw Debug or M6. On a supported M6 session, incomplete required resource
provisioning throws into the existing adapter cleanup and host fallback path.
The Raw Debug request uses the M3 scene target; an M6 request consumes the
adapter-owned completed M5 research composite. Both modes share the channel's
session retry latch, not output identity or source texture.

The r187 qualification must therefore be a separate exact-scene test harness.
It should use the r187 M3 Raw record as the only renderer-attempt authority,
then consume existing r187 M4/M5 research evidence only after native runtime
observation and same-request prerequisite completion. A separate M6 flag and
explicit r187 qualification flag should gate the temporary presentation path.
This keeps M4/M5 research-only, preserves the historical M6 object, and does not
make M6 evidence a renderer-selection credential.

## Rendering and evidence paths

`createGroundGlassPresentationNode` is a single fullscreen
`MeshBasicNodeMaterial` (`toneMapped: false`) sampling the completed composite.
It carries sampled alpha in the TSL expression while the accepted opaque
material/canvas contract stores alpha one. The Raw orientation transform,
physical film coordinates, crop/loupe state, natural cos4 illumination, and image
circle/conic coverage are applied in this final node. The M6D probe exercises
the production composite node at five Near-coverage values and reads its actual
RGBA16F target; the main M6 test screenshots the visible M6 canvas. The M6C
fixture separately renders the same presentation material into a temporary
RGBA8 target and reads selected rows. Its explicit `finally` path restores
renderer state and disposes that target; held readbacks are rejected when
request or generation identity changes.

M6B uses the development calibration Stage overlay and a controlled fixture,
not registered Architecture Rise geometry. It maps physical landmarks through
the presentation crop into the Stage content-box CSS coordinates, then measures
image, overlay-target, and grid intersections. Its 14 capture IDs and thresholds
(2 CSS px maximum, 1.25 CSS px per-capture RMS) are frozen. Its RGB oracle
compares visible canvas screenshots against the independent CPU presentation
reference over nine controlled states (206 historical samples; maximum error 4
eight-bit codes and RGB RMSE 2.5). This is separate from the M6 app capture and
does not establish photographic quality.

## r186 assumptions and reusable coverage

Explicit revision assumptions found: the main M6 E2E expects presentation
revision `r186` and the historical evidence ID; M6C capture guards and its test
expect `186`; the M6D probe test expects `REVISION === "186"`. Other r186
assertions in the aperture/gather spec belong to historical M5/M5Q tests and
must not be changed for M7F. Reusable native coverage includes the M6 app
interaction/Raw-first and failure tests, the 14-state M6B fixture and nine-state
RGB oracle, the M6C actual-material alpha readback and stale-request/navigation
controls, the five-case M6D GPU composite probe, and existing production-preview
WebGL isolation. They must retain r186 semantics unless explicitly running a
separately identified r187 qualification capture.

The M6C target is temporary and disposed with the renderer state restored. M6D
uses temporary source textures, geometry, material, and target; it waits for
queue completion before cleanup and leaves them alive if completion is
uncertain. Adapter-owned M4/M5/M6 resources remain under the M7C single-owner
generation cleanup. No r187 M6 native behavior has yet been observed, so no
renderer-internal, material, TSL, target, or precision change is inferred from
the package upgrade alone.

## Qualification boundary

The existing tests distinguish presentation/numerical contract conformance from
photographic quality: M6D is an opaque-output contract, M6B spatial/RGB checks
are controlled fixture contracts, and M5Q remains a separate historical r186
quality qualification. M7F must preserve those boundaries, add fresh r187
provenance, and leave M5Q/M6 photographic quality, broad device support, M8,
M9, and production WebGPU unqualified.

## Required audit answers

1. **r186 records:** all features in `GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY` still name Three.js r186. The old M6 tests retain their historical r186 branch; only the explicit M7F qualification branch expects r187.
2. **M4/M5 provisioning:** their M6-capable-session provisioning delegates to the old monolithic M6 matcher. It denied r187 even though M4/M5 now have independent r187 research records.
3. **Provisioning order:** an authorized session provisions M3, M4, and M5 resources before the first request is rendered. An initial Raw Debug frame can therefore be followed by M6 without another renderer attempt; M4/M5 pass execution remains request-scoped.
4. **Prior r187 reachability:** ordinary M6 build flags did not match the r186 M6 record against installed r187. The r187 qualification harness is now explicit, exact-scene, development-only, test-seam-only, and requires M3 Raw plus M6 and r187 qualification flags. It exposes no renderer selector.
5. **Flag bypass:** M6 flags without the revision-specific qualification flag do not enable the unaccepted r187 record. Production builds do not satisfy the development gate. After evidence acceptance, the normal development M6 gate will use the exact r187 record.
6. **M5 input:** M6 uses `researchCompositeTarget.texture`, whose frame request/generation must match the accepted request. Raw Debug displays the M3 target separately. The M6D probe runs the production composite node over independent known Far/Near values.
7. **Raw Debug:** Raw Debug bypasses the M6 display node and M4/M5 execution for that frame, while an M6-capable session may still provision those resources. M6 output consumes the completed composite. Both modes share the retry session.
8. **Material/TSL/target:** no renderer or presentation implementation changed. The M6 `MeshBasicNodeMaterial` retains `toneMapped: false`, normal blending, and opaque output; the presentation node and source target contract are unchanged. The alpha readback now records `toneMapped` explicitly.
9. **Hard-coded revision assertions:** the M6 registered app, M6B, M6C, and M6D tests carry r186 expectations and keep them unless the explicit qualification flag is set. The historical aperture/gather tests are not revision-rewritten; only the targeted M7F M6D capture accepts r187.
10. **Reusable native fixtures:** M6 app/Raw-first/failure tests, M6B's 14 spatial states and nine RGB cases, M6C's actual material alpha capture and held stale readbacks, M6D's five-case GPU probe, and production preview tests are reused with separate r187 capture identity.
11. **Coordinates:** the Stage, physical overlay, calibration fixture, crop/loupe mapping, film-window mapping, and display node share the existing canonical film coordinate contract. The M6B fixture is explicitly not registered-scene physical-target evidence.
12. **Visible versus offscreen:** the M6B pixel oracle samples the visible canvas; M6C reads the temporary RGBA8 alpha target rendered with the same presentation material; M6D reads the temporary RGBA16F target for the production M5 composite node.
13. **Temporary resources:** M6B asserts calibration source disposal after SPA navigation; M6C restores renderer state and disposes its target; M6D waits for queue completion, restores renderer state, and disposes its temporary sources/material/geometry/target only when safe.
14. **Quality distinction:** spatial, RGB, alpha, and M6D checks establish bounded implementation conformance only. M5Q photographic-quality results remain independent and unchanged.
15. **r187 behavior:** no runtime difference is assumed from the package update. The new native captures determine whether material, TSL, allocation, precision, or final-canvas behavior changed.

## M7F authorization decision

The implementation uses a distinct, initially `not-evaluated` r187 M6 compatibility entry. The qualification harness can gather evidence only for the exact Architecture Rise request in a development build with the M3 Raw, M6 presentation, test seam, and r187 qualification controls. On r187 the M6 request passes `["raw-rtt"]` as its renderer request feature set and uses the existing r187 M3 compatibility record. M4 and M5 pass authorization remains tied to their separate r187 research records and the exact M6 qualification session. A completed M6 report cannot select or retry a renderer, promote M4/M5, qualify M5Q, enable M8/M9, or enable production WebGPU.
