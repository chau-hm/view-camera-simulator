# Observer inspection

Use scene-authored diagnostic poses with explicit inspection targets and mounted first-hit checks. Keep public orbit behavior and the physical Ground Glass camera independent. The current evidence supports improving capture selection. A public navigation feature needs evidence of a repeated user task that orbit, zoom and reset cannot support.

## Current ownership

| Concern | Source and behavior |
| --- | --- |
| Public scene reset | Scene placement supplies position and target in millimetres. The viewport resolves them in Three.js world metres and has a reset action for the active Scene or Camera view. [Framing resolver](../../../src/render/sceneViewFraming.ts#L208) · [Scene viewport](../../../src/components/simulator/SceneViewport.tsx#L124) · [View toolbar](../../../src/components/simulator/SceneViewport.tsx#L443) |
| Public orbit and zoom | The Observer runs Three.js OrbitControls with rotation and zoom enabled and panning disabled. Each focus has a saved view. A new scene resets that state. No collision query runs in this control path. [Observer controls](../../../src/render/SceneRenderer.tsx#L232) · [Saved views and reset](../../../src/render/SceneRenderer.tsx#L336) · [Controls mount](../../../src/render/SceneRenderer.tsx#L2319) |
| Camera inspection focus | The canonical camera rig pivot or a defined anatomy landmark anchors Camera focus. Scene declarations can supply an inspection position, otherwise the resolver uses a stable offset from the pivot and the configured scene direction. This is a camera-model inspection target. [Inspection targets](../../../src/render/sceneViewFraming.ts#L75) · [Position resolution](../../../src/render/sceneViewFraming.ts#L142) |
| Scripted diagnostic views | Development-only pose events exist for Anatomy and tightly gated Rise capture surfaces. They operate on Observer controls. Historic scene refinement harnesses also captured supplemental render-only views. They prove access from specific poses independent of what the public controls expose. [Verification events](../../../src/render/SceneRenderer.tsx#L278) · [Existing view contract tests](../../../src/tests/e2e/scene-view-focus.spec.ts#L98) |
| Physical teaching visibility | The separate RTT camera follows derived film and lens geometry. A first hit by context in front of a protected teaching surface is an optical integration problem. [Physical camera configuration](../../../src/render/GroundGlassRTT.tsx#L1452) · [Mounted foreground checks](../../../src/tests/unit/architectureForegroundMountedGeometry.test.ts) |

## Evidence

The #368 archive captures two opposite-side Oblique diagnostic views. In the original pose at `(7.0, 2.3, 12.7)` m looking toward `(2.8, 1.3, 13.2)` m, the ironworks north-light roof crosses the lower façade. The archived alternate at `(5.15, 1.75, 24.2)` m toward `(3.3, 1.25, 14.35)` m shows the opposite elevation. The baseline and candidate use the same alternate pose. The #367 archive shows close passage views bounded by actual supporting buildings. #369 retained an example of a very low orbit below the one-sided paving on both the old and accepted scene. These cases identify where to change capture selection. [Oblique PR](https://github.com/chau-hm/view-camera-simulator/pull/368) · [Rise PR](https://github.com/chau-hm/view-camera-simulator/pull/367) · [Forecourt PR](https://github.com/chau-hm/view-camera-simulator/pull/369)

A fresh mounted Oblique asset survey at `35212892d5a359213f68f984bc68ad47c4520886` sampled 72 points on the opposite wall (`X = 3.3 m`). The 45° Observer camera used the measured 514:411 logical aspect. The old pose frames 30 points, of which six hit environment geometry more than 5 mm before the reference plane. The alternate frames all 72 and has zero earlier environment hits. The first intersections identify ironworks roof and mullions and foundry-office parts. This sampled region measures projected and geometric access separately. The archived captures supply pixel evidence for the rest of the elevation. See `performance/registered-cost.json` in the evidence bundle.

Current public controls were exercised on Rise, Oblique, Architecture Foreground and Table Tilt in Chromium WebGL2. Each test starts in Scene focus, drags the actual canvas, zooms with the wheel, switches to Camera and back, and resets. Drag and zoom moved the Observer. Reset restored the declared position and target. The physical Ground Glass request ID remained fixed through all Observer-only actions. Source poses, event traces and images are in `performance/current-runtime.json` and `performance/captures/`.

The development run exposed a capture caveat. A single trusted wheel event encountered two canvas listeners with the same OrbitControls handler source location. The published pose and live rendered camera diverged. All four scenes returned to their pre-switch live camera positions within 1 μm, and the published values then agreed with the live positions. In a local production preview built from the same source, each scene had one wheel listener and restored its published zoom pose exactly. A duplicated render-time controller initialization under development Strict Mode is a plausible explanation. Record the actual camera for dev pose-dependent comparisons. Use production replay before treating a published-pose difference as a public regression. [Controller allocation and pose publication](../../../src/render/SceneRenderer.tsx#L245) · [React root](../../../src/main.tsx#L9)

Public controls and geometry can fail in different ways:

| Observation | Classification and action |
| --- | --- |
| Original opposite-side photo clips part of the façade and shows a roof in the sightline | A historical diagnostic pose lost coverage. Choose and name an alternate. Keep both photos for comparison. |
| A learner repeatedly cannot reach a required inspection using public orbit, zoom and reset | A navigation problem. Reproduce the required task, gesture, start pose and fallback on the smallest supported viewport before proposing a public change. The sampled actions demonstrate basic access and reset. They leave exhaustive reachability open. |
| Mounted context intercepts a protected ray from the derived physical lens | A teaching-surface obstruction. Verify expected first hit with the actual physical camera and resolve through placement or scoped renderer policy. A better Observer pose leaves that optical issue intact. |

## Proportionate follow-up

| Option | Decision |
| --- | --- |
| Named scene-specific diagnostic poses | First choice. Record purpose, scene/variant, source, position, target, FOV and viewport. Keep the source of truth in capture tooling while only the audit needs it. |
| Environment-aware capture selection | Probe a short list of nearby authored alternatives. Use bounds for candidate selection and actual geometry intersections for the final result. Record off-frame points independently from blockers, plus the captured visible surface and nearby alternate. |
| More robust teaching inspection targets | Use an explicit façade, crop or landmark ID when a screen-space subject region matters. Keep canonical focus/composition targets in the teaching contract. |
| Collision-aware public OrbitControls | Defer pending reproducible public task impairment. A room or alley can legitimately occlude an elevation. Camera exclusion shapes, dynamics and recovery introduce a separate interaction policy. |
| Optional teaching presentation controls | Product research only if a demonstrated teaching task needs an alternate representation. Keep it distinct from represented-world visibility, physical RTT and diagnostics. |

A future inspection-only PR can qualify one obscured legacy pose and one clear alternate, reproduce mandatory public orbit / zoom / reset in that scene, and keep physical focus and composition checks stable. A pose that misses its intended landmark should fail with the blocker and a captured reproduction. Restore the prior capture descriptor if an alternate fails these checks. No public reset, obstruction handling or optical schema change is required for that slice.
