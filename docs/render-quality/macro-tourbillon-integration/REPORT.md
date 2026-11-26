# Macro tourbillon integration acceptance report

**Outcome:** MACRO_TOURBILLON_INTEGRATION_NEEDS_REFINEMENT

**Integrated source revision:** 1897b554b14c8954ef76ba9eb8e470a8f0c2d662  
**Read-only research source:** f1867d71d43cc67e9783bdbd5f3158765236340a  
**Capture run:** 425b38c2-5d8f-4d49-976e-216e867b318a  
**Capture source status:** clean  
**Runtime:** Chromium 149.0.7827.55, macOS 27.0.0 arm64, Three.js r187, WebGL2 / ANGLE SwiftShader  
**Capture viewport:** 1280 × 900 CSS px at DPR 1; Ground Glass 450 × 360 CSS px with 574 × 459 internal RTT

## Integration decisions

- The registered Macro Bellows subject now builds the research asset with the removable strap excluded. It remains at 42 mm case diameter and 12 mm thickness.
- Research local +Z points from the caseback toward the dial. The integration places the case origin at (0, 0, 303.55) mm, rotates the assembly 180° about Y so the dial faces the lens at world Z = 300 mm, and converts millimetres to metres once.
- The two primary focus samples lie on the real chapter-ring surface at 300 mm: (-2.65, 15.45, 300) mm and (-15.45, -1.4, 300) mm. Additional geometry probes cover the hobnail dial at 300.133 mm, hand collet at 299.015 mm, tourbillon wheel at 305.69 mm, and front bezel at 298.687 mm. Raised and recessed parts therefore remain inspectable without redefining the lesson datum.
- The front and rear sapphire meshes are retained for Observer and RTT. The low-alpha material uses depthWrite false; the transparent sapphire does not cast an opaque teaching shadow. Refraction is not simulated, so the chapter-ring plane remains the explicit focus datum behind the crystal.
- Cage rotation is fixed at canonical phase 0 for this scene. The reusable asset retains its cage-angle API.
- A bounded watch-specific fill/key profile and role-based metal finish adjustments apply only to Macro Bellows. Other scene lighting recipes are not changed.

## Visual and optical review

The RQ3G run captured and host-accepted all ten requested images: the five bellows states, default Observer, 4× Ground Glass loupe, and canonical Ground Glass controls for the other three macro scenes. There were no page errors or console errors. The Ground Glass used the WebGL2 renderer without an application or internal fallback.

At 300 mm focus with the 150 mm lens, the physical chapter-ring plane reports 1:1 magnification and the rendered watch head spans about 150 px in the 450 px Ground Glass view, consistent with a 42 mm subject at life size. The dial, blued hands, case silhouette and open tourbillon are distinguishable at the normal capture size; the loupe capture resolves the central hands and cage. The raw optical image is inverted, so the physical six-o'clock aperture appears at the top of Raw Ground Glass.

At 900 mm and 450 mm, the expected defocus makes the watch less legible. At 300 mm, f/11 and f/22 captures become much darker because the simulator applies the aperture's exposure loss without shutter compensation. The camera and aperture controls retain their existing teaching behavior.

The default Observer image shows the rear movement and the camera/rail together at real scale. It is useful as a fixed scene reference, while the Ground Glass/loupe images provide the watch detail. A dedicated high-resolution Observer front view and a close dial/chapter-ring capture remain useful follow-up evidence.

## Runtime resource and performance observations

The committed scene-capacity capture reports, for each of the Observer and RTT watch roots:

- 263 renderable mesh instances and 398,954 triangles;
- 204 unique geometries, 17 unique materials, and 4 unique textures;
- no instanced meshes.

A separate opt-in profiler run on the same headless Chromium / SwiftShader environment collected 60 frame-cadence samples and 56 valid GPU-query samples at the 1:1 state:

- Ground Glass frame cadence: p50 562.6 ms, p95 610.6 ms, approximately 1.69 FPS;
- Ground Glass GPU work: p50 416.8 ms, p95 489.6 ms;
- physical DOF GPU work: p50 340.6 ms, p95 370.5 ms;
- scene render pass: p50 75.8 ms, p95 136.5 ms;
- renderer memory counters: 205 geometries and 15 textures while the scene and RTT pipeline were mounted.

These are actual measurements from ANGLE SwiftShader software rendering, not a hardware-GPU performance estimate. They show that the asset and DOF pipeline are slow in this headless software environment. No hardware-accelerated browser measurement or isolated draw-call count was obtained. The watch's four deterministic DataTextures have about 10 MiB of uncompressed base texels; full mip chains raise the rough texture-storage estimate to about 13.3 MiB before driver alignment.

## Validation

Passed:

- 87 focused unit/integration tests across the subject factory, disposal, macro scene, lighting/registry, and asset migration.
- npm run typecheck (also included in the successful production build).
- npm run lint.
- npm run build.
- git diff --check.
- The dedicated RQ3G capture: ten images, all accepted WebGL2 RTT frames, fixed camera movement policy, no browser errors.
- The existing physical grid-origin E2E for both Raw and Upright display orientation.
- Focus-surface ray probes through the retained crystal, including dial field, hand collet, tourbillon wheel, and bezel.

The complete existing Macro Bellows E2E file ran three tests: one passed and two failed. The passing test checks Raw/Upright film-origin alignment. One failure stopped on the preceding Architecture Rise route while the page still showed “Loading simulator workspace…” and its five-second wait for “Infinity Reset” elapsed before reaching Macro Bellows. The auxiliary-interaction test reached the 1:1 state but timed out at its Observer canvas screenshot under the default High quality; Playwright reported that the canvas element was no longer attached. The RQ3G Standard-quality capture completed the same 900 → 450 → 300 mm focus progression and accepted every RTT frame. The High-quality E2E failure remains to be resolved or independently reproduced.

The cross-scene RQ3G images confirm that the other macro scene subjects still render and accept frames. This was a render smoke check, not a pixel comparison against a pre-change baseline.

## Remaining review items

- Check dial and chapter-ring contrast at a larger Observer or loupe capture; the Roman markers are not reliably legible in the 450 × 360 full-watch capture.
- Re-run the auxiliary-interaction E2E at default High quality after investigating its detached-canvas timeout.
- Measure frame cadence on a hardware-accelerated browser before making a performance claim for normal user hardware.
- Review physical focus behavior through the retained sapphire in a real optical acceptance pass; this simulator does not model crystal refraction.
- Keep the watch's canonical static pose for the focus/magnification lesson. No production acceptance or replacement beyond this local feature branch is implied.

## Evidence files

- [Front Raw Ground Glass, 1:1, f/5.6](b3-life-size.png)
- [4× Ground Glass loupe at 1:1](b3-life-size-focus-loupe-4x.png)
- [Default Observer, rear movement and camera rig](observer-default-reverse-side.png)
- [900 mm initial defocus](b1-initial.png)
- [450 mm intermediate focus](b2-intermediate.png)
- [1:1 at f/11](b4-life-size-f11.png)
- [1:1 at f/22](b5-life-size-f22.png)
- [Macro depth-of-field control](macro-depth-of-field-regression.png)
- [Macro oblique-plane control](macro-oblique-plane-regression.png)
- [Macro compound-movements control](macro-compound-movements-regression.png)
- [Full capture manifest with accepted frame IDs and browser/runtime metadata](capture-run.json)
- [Focused watch-scene profiler measurements](runtime-profile.json)
