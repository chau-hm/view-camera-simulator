# Room at Dawn Ground Glass investigation — incomplete

This experiment contains the original local reference baseline and an incomplete canonical Ground Glass integration. See the next-round findings below; the full PoC has not passed.

Run from the repository root with Node 24 and the normal dependencies installed:

```sh
npm run dev -- --host 127.0.0.1
# Open the Vite base URL + experiments/room-at-dawn/
```

The default base URL is `http://127.0.0.1:5173/view-camera-simulator/experiments/room-at-dawn/`. Select Wide, Desk, or Window for the upstream named camera. The scene is static. This separate document has its own JavaScript realm, so upstream's global Three.js `ShaderChunk` changes do not mutate the normal simulator. It is not a public scene, task, or route. The root production build has no entry or public asset pointing here.

## Source and inventory

Source: <https://github.com/Leonxlnx/room-at-dawn>, commit `aab8be218aa051bbb2e22b82916962619c951747`, MIT; see [vendor/LICENSE](vendor/LICENSE). Upstream and this project both specify Three.js `^0.187.0`. The unmodified snapshot comprises `src/scene/**`, `src/core/**`, `src/render/{pipeline,cams,look}.js`, and `public/bake/gi.bin` (stored here as `vendor/bake/gi.bin`). It excludes audio, film, game, and baking tools. The wrapper in `reference.js` replaces upstream boot code, validates the bake before application, fixes scene animation at its initial state, uses a single reference sample, and captures upstream reflections twice. It uses upstream AO, bloom and display grade. No upstream files were edited.

## Initial reference-round findings

- **Gate 1: partial.** Headless Chromium with SwiftShader WebGL rendered the original room at the three named positions. The recorded `evidence/` screenshots are reference output, not Ground Glass. The upstream [wide reference](https://github.com/Leonxlnx/room-at-dawn/blob/aab8be218aa051bbb2e22b82916962619c951747/docs/media/wide.jpg) shows the same layout, materials, and lighting. The local image is darker and less detailed at 960×540 and uses one sample; upstream's film reference is not a controlled pixel comparison. Desk and window comparisons have not been independently assessed against corresponding upstream images.
- **GI:** 302 expected, 302 baked, 302 matched, zero missing, stale, incompatible, invalid or duplicate entries in that run. The wrapper rejects invalid or incompatible files before calling upstream `applyBake`, whose normal fallback inserts placeholder GI. Identity consists of deterministic hierarchical names plus ordinal, vertex/instance count, and back-face flag. It does not prove identical vertex positions or content beyond the pinned, unmodified source and bake.
- **Gate 2: not implemented.** The image is the upstream perspective reference camera, not the simulator camera. There are no movement controls, canonical projection, Ground Glass RTT, or orientation evidence.
- **Gate 3: not implemented.** No focus-plane, aperture, depth-of-field, HDR Ground Glass, or optical correctness claim can be made. Native WebGPU and backend parity have not been tested.

## Initial integration investigation

Upstream builds in metres and simulator optical state uses millimetres at its boundaries (`WORLD_SCALE = 0.001`). A future adapter must define an explicit rigid room-to-simulator transform without changing physical scale. Upstream GI and box reflection shader code use world positions, including a hard-coded exterior threshold; translating or rotating the room without adapting those coordinates changes the lighting. `gi.js` mutates global shader chunks at import, and its reflection environment is renderer-owned. The existing development-only `GroundGlassRTT` scene-profile override offers an integration point, but async construction, ownership, reflection capture and disposal need an isolated adapter. The normal Ground Glass colour target is currently an unsigned-byte target; preserving HDR up to final display requires investigation rather than applying the upstream SDR grade before the optics. No native WebGPU compatibility is established for upstream `onBeforeCompile` shaders.

Smallest next step: create an experiment-only scene owner and material-local shader adaptation in the separate realm, explicitly transform GI/probe coordinates, then mount through the existing development profile and measure actual canonical RTT output before considering HDR changes. Test disposal on client-side unmount and verify all movement and focus states numerically and visually. Do not change production renderer policy to accommodate the experiment.

## Initial reference evidence and limits

The three images were captured at 960×700 page viewport (960×540 canvas) in headless Chromium using SwiftShader. The reference rendered successfully with no shader compilation errors observed; browser logs reported GPU readback stalls. No reliable frame rate was measured. Screenshots are not optical proof. The production build completed and a filename/content search found no experiment or GI asset in `dist`; three focused Ground Glass unit files passed (51 tests). Full suite, actual scene lifecycle navigation, hardware GPU, and E2E were not run.

## Next round: experimental canonical Ground Glass (incomplete)

Open `/view-camera-simulator/experiments/room-at-dawn/optics.html` from the Vite dev server. This is a separate document and JavaScript realm, not a public application route. The page prebuilds the unchanged upstream scene, fetches and validates the pinned bake, then mounts a clone through the existing development-only `GroundGlassSceneProfile` override on `GroundGlassRTT`. The RTT uses the existing `deriveOpticsState`, off-axis camera configuration, CoC/gather/composite passes, aperture illuminance, and Raw/Upright orientation. It does not use the upstream perspective camera or film renderer. The room is static. Controls use the existing camera state fields, step constants and aperture choices; they are experiment-local controls rather than the production store-connected control components.

### Coordinate contract

Upstream and Three.js scene coordinates are metres; canonical optics and scene bounds are millimetres. One translation places the camera at upstream `[2.6, 1.45, 0.7]` metres with the VCS rig at the origin, viewing along +Z with +Y up. No scale or rotation is applied. The observed neutral clip range was 0.01–11 m; these conservative experimental bounds do not establish coverage of all exterior geometry. The GI material hook reverses that translation for `vGiW`, preserving upstream position-dependent GI and box-projection inputs; GI direction remains unchanged. Exterior wind shaders also use world position and have **not** been adapted, so their static time-zero shape may differ. The lateral rig control uses the existing canonical mirror-shift translation capability; the room is never moved when the camera moves. General camera orientation and other translation axes are not provided.

### Lighting, color, and ownership

The RTT profile hides the teaching lights during its mount and restores their visibility on unmount. Original GI attributes are used. No reflection capture is currently installed on the RTT scene, so reflection parity is absent. The upstream `LOOK.exposure` of 19 is applied as a **linear, experiment-only material pre-exposure**, not as a change to optical illuminance or the upstream film grade. The existing byte scene target can clip this result before blur; this is a lossy visibility investigation, not HDR or a physically validated exposure conversion. The sky and custom non-GI materials do not receive that pre-exposure. No HalfFloat path or WebGPU implementation has been added; the Ground Glass CoC target can be half-float independently of the byte scene-color target.

The source scene owns geometries, materials and discovered textures; RTT and Observer clones borrow those resources, and each mounted view owns its object hierarchy. The profile removes its group but does not dispose borrowed resources; the experiment owner disposes deduplicated source resources when the application unmounts. Construction is guarded against cancellation after the upstream async builder returns and after the bake fetch. Upstream `buildScene` itself does not provide cancellation or access to a partially built graph if it throws; cleanup in that failure case is not proven. The Unmount/Remount button removes and re-adds both views without a reload; browser evidence established canvas removal and a later image, not verified GPU resource release or all disposal paths.

### Evidence and remaining gates

`evidence/ground-glass/` contains SwiftShader Chromium canvas captures and `states.json`. Neutral uses f/5.6, 150 mm lens, 2000 mm focus and zero movements. The lateral case uses 500 mm camera translation. Combined uses that position with 30 mm rise, 40 mm shift, 5° tilt and 5° swing; its Raw view uses the same state. The wall picture and ceiling cable show the 180° Raw/Upright inversion. Diagnostics observed a configured canonical camera and contentful raw/final frames in lateral and combined cases; lens positions and focus planes are recorded independently of the asynchronous diagnostics. Separate captures also record focus planes at 800 mm and 3500 mm and f/22 at 3500 mm. The stopped-down result was reported non-contentful by the RTT diagnostic in that run; its asynchronous snapshot may lag, and brightness is visibly very low. The captures show visible image changes, but not calibrated image displacement or a quantitative focus/sharpness assessment. Browser console emitted known Three.js clock deprecation warnings and software GPU readback stall warnings; one Vite hot-refresh session also logged a duplicate root warning. No shader compilation error was observed. Performance was not measured and hardware rendering was not tested.

Reproduce with the dev server on port 5199 and run `node experiments/room-at-dawn/capture-evidence.cjs /private/tmp/room-optics-evidence`. The script uses software WebGL, captures the specified states, logs the camera/optics and runtime observations, and toggles the views without navigation. It is a diagnostic, not a complete automated acceptance test.

- **Gate 1: partial**, as above; GI 302/302 remains matched.
- **Gate 2: partial.** The room renders through the actual canonical WebGL RTT, and lateral movement, combined standard movements, and orientation were observed. The image remains dim and cropped, reflections are missing, general camera position/orientation are unavailable, and separate movement sign/displacement checks are incomplete.
- **Gate 3: not passed.** Focus/DOF, aperture response, photographic texture and reflection fidelity, HDR and backend parity lack the required evidence. The linear pre-exposure and byte target visibly limit fidelity. Raw/Upright screenshots are evidence of inversion only, not proof of all optical behavior.

Next corrections: give the development-only RTT integration an explicit renderer-owned reflection-capture lifecycle; preserve linear HDR through the scene and gather stages before one display mapping, with a compatibility probe; then validate per-movement framing and measured near/far focus regions with hardware rendering. Do not promote this diagnostic approximation or enable it in public scenes.
