# Room at Dawn reference investigation — incomplete

This is a local reference baseline, **not a Ground Glass PoC**. Gates 2 and 3 have not been implemented or validated. It must not be presented as optical integration.

Run from the repository root with Node 24 and the normal dependencies installed:

```sh
npm run dev -- --host 127.0.0.1
# Open the Vite base URL + experiments/room-at-dawn/
```

The default base URL is `http://127.0.0.1:5173/view-camera-simulator/experiments/room-at-dawn/`. Select Wide, Desk, or Window for the upstream named camera. The scene is static. This separate document has its own JavaScript realm, so upstream's global Three.js `ShaderChunk` changes do not mutate the normal simulator. It is not a public scene, task, or route. The root production build has no entry or public asset pointing here.

## Source and inventory

Source: <https://github.com/Leonxlnx/room-at-dawn>, commit `aab8be218aa051bbb2e22b82916962619c951747`, MIT; see [vendor/LICENSE](vendor/LICENSE). Upstream and this project both specify Three.js `^0.187.0`. The unmodified snapshot comprises `src/scene/**`, `src/core/**`, `src/render/{pipeline,cams,look}.js`, and `public/bake/gi.bin` (stored here as `vendor/bake/gi.bin`). It excludes audio, film, game, and baking tools. The wrapper in `reference.js` replaces upstream boot code, validates the bake before application, fixes scene animation at its initial state, uses a single reference sample, and captures upstream reflections twice. It uses upstream AO, bloom and display grade. No upstream files were edited.

## Findings and gate status

- **Gate 1: partial.** Headless Chromium with SwiftShader WebGL rendered the original room at the three named positions. The recorded `evidence/` screenshots are reference output, not Ground Glass. The upstream [wide reference](https://github.com/Leonxlnx/room-at-dawn/blob/aab8be218aa051bbb2e22b82916962619c951747/docs/media/wide.jpg) shows the same layout, materials, and lighting. The local image is darker and less detailed at 960×540 and uses one sample; upstream's film reference is not a controlled pixel comparison. Desk and window comparisons have not been independently assessed against corresponding upstream images.
- **GI:** 302 expected, 302 baked, 302 matched, zero missing, stale, incompatible, invalid or duplicate entries in that run. The wrapper rejects invalid or incompatible files before calling upstream `applyBake`, whose normal fallback inserts placeholder GI. Identity consists of deterministic hierarchical names plus ordinal, vertex/instance count, and back-face flag. It does not prove identical vertex positions or content beyond the pinned, unmodified source and bake.
- **Gate 2: not implemented.** The image is the upstream perspective reference camera, not the simulator camera. There are no movement controls, canonical projection, Ground Glass RTT, or orientation evidence.
- **Gate 3: not implemented.** No focus-plane, aperture, depth-of-field, HDR Ground Glass, or optical correctness claim can be made. Native WebGPU and backend parity have not been tested.

## Integration boundary still to resolve

Upstream builds in metres and simulator optical state uses millimetres at its boundaries (`WORLD_SCALE = 0.001`). A future adapter must define an explicit rigid room-to-simulator transform without changing physical scale. Upstream GI and box reflection shader code use world positions, including a hard-coded exterior threshold; translating or rotating the room without adapting those coordinates changes the lighting. `gi.js` mutates global shader chunks at import, and its reflection environment is renderer-owned. The existing development-only `GroundGlassRTT` scene-profile override offers an integration point, but async construction, ownership, reflection capture and disposal need an isolated adapter. The normal Ground Glass colour target is currently an unsigned-byte target; preserving HDR up to final display requires investigation rather than applying the upstream SDR grade before the optics. No native WebGPU compatibility is established for upstream `onBeforeCompile` shaders.

Smallest next step: create an experiment-only scene owner and material-local shader adaptation in the separate realm, explicitly transform GI/probe coordinates, then mount through the existing development profile and measure actual canonical RTT output before considering HDR changes. Test disposal on client-side unmount and verify all movement and focus states numerically and visually. Do not change production renderer policy to accommodate the experiment.

## Evidence and limits

The three images were captured at 960×700 page viewport (960×540 canvas) in headless Chromium using SwiftShader. The reference rendered successfully with no shader compilation errors observed; browser logs reported GPU readback stalls. No reliable frame rate was measured. Screenshots are not optical proof. The production build completed and a filename/content search found no experiment or GI asset in `dist`; three focused Ground Glass unit files passed (51 tests). Full suite, actual scene lifecycle navigation, hardware GPU, and E2E were not run.
