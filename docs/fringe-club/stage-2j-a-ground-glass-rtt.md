# Stage 2J-A development-only Ground Glass RTT validation

**Result:** The same ready Stage 2H `SourceAsset` mounted as an independent
Observer instance and as an instance in the real `GroundGlassRTT` offscreen
scene. The RTT camera configured and both raw and final render-sanity checks
were contentful. No public scene was activated.

## Base and imported asset

- Repository: `chau-hm/view-camera-simulator`
- Worktree: `/Users/homan/repo/view-camera-simulator-fringe-2j`
- Branch: `feature/fringe-club-stage-2j-rtt`
- PR base: `main`, created from `origin/main` at
  `d3aabe88bdd7193de8916eb9339a8ab1017b895d`
- Stage 2I merge `8c1d78437dd20645feea3430f8e58b33a40a98e4` is an ancestor of
  the base.
- GLB: `public/assets/generated/fringe-club/stage-2h/preferred-runtime-candidate.glb`
- SHA-256: `1f15e04fa6161e327d6f4f89f9b011f3b8f41bcf305e7ee2e3a1a127fef93b8e`
  (verified against the Stage 2H manifest)
- Stage 2H authority remains 32 meshes/primitives, 20,203 triangles, 15
  materials, seven embedded PNG textures, metres, +Y up, identity root, and
  scale 1. Its 98.67 MiB RGBA8-plus-mips GPU figure remains an estimate, not a
  measurement from this browser run.

## Development integration

The fixture route is `/__dev/fringe-club-rtt`, registered inside
`if (import.meta.env.DEV)` and absent from normal navigation. The GLB URL still
comes from the existing `publicAssetUrl` boundary. The registered scene-asset
key remains `fringe-club-runtime-subject`, with implementation ID
`threejs-fringe-club-runtime`; asset identity is not a public scene ID.

The fixture shares the Stage 2I owner lease between two renderer contexts:

1. the Observer R3F canvas creates its normal registered instance;
2. `GroundGlassRTT` creates a separate registered instance in its actual
   offscreen scene, then runs the existing camera, render targets, shader
   passes, diagnostics, and cleanup.

The development-only profile delegates shadow participation to the existing
Architecture Rise Ground Glass profile. It only replaces the offscreen subject
and expands clip bounds for the placed asset. Read-only reference optics come
from the Architecture Rise scene definition and default camera preset; this
fixture does not update the app store or canonical simulator state.

Presentation placement is scale 1 and zero rotation. In Three.js metres it
centres the asset bounds on the Architecture Rise focus target in X/Y and places
the asset's minimum Z at that target:

```text
x = target.x / 1000 - bounds.center.x
y = target.y / 1000 - bounds.center.y
z = target.z / 1000 - bounds.min.z
```

The `1000` conversion is only from the scene focus target's millimetres to
rendering metres. The GLB bounds and registered instance transform remain in
metres. This transform is fixture presentation only.

## Browser evidence

Focused Playwright coverage ran in Chromium 149.0.7827.55, WebGL 2, at a
1280×720 viewport and DPR 1. The browser exposed ANGLE/Vulkan with SwiftShader
software rendering; this is not physical GPU or target-device evidence.

- A normal Architecture Rise route mounted its normal Ground Glass RTT and made
  no Fringe GLB request.
- After explicit fixture activation, the Observer and RTT reported the same
  `sourceId`; the audit showed one active source, one owner lease, and two
  instance leases.
- The real RTT camera reported configured. Its render-sanity probe reported
  raw contentful and final contentful. Scene-graph capacity reported 32 meshes
  and 20,203 triangles.
- Unmounting Observer instance A left the RTT root and output active against the
  same source. Turning the RTT subject off released its instance lease while
  retaining the owner. Turning it back on created a different root with the
  same source ID.
- Releasing the source returned source, owner, instance, source geometry,
  material-template, texture, image-backing, and instance-material counters to
  zero.
- The RTT `renderer.info` capacity snapshot is captured when the profile mounts,
  before the next offscreen render. In this run it reported 0 geometries and 2
  textures, so those values are not treated as an after-render resource delta.
  The contentful raw/final probe and subject mesh/triangle counts are the RTT
  render evidence for this stage.
- The request observer saw no fetch on the normal scene route. Development
  React effect replay can issue an aborted request generation; only the current
  generation becomes the one active source. No page errors or unexpected
  console warnings were reported by the focused test.

The app does not expose exact GPU memory. This stage did not measure load time,
frame time, uploaded bytes, or physical-device performance.

## Validation

- Focused Vitest: `fringeClubGroundGlassProfile.test.ts` and
  `GroundGlassRTT.test.ts` passed (32 tests), including shared geometry/texture
  identity, cloned materials, independent lease release, and the actual RTT
  profile mount/dispose seam.
- Focused Playwright file: 3/3 tests passed, covering the existing Observer SPA
  lifecycle/remount, delayed-fetch cancellation, and the new Observer + real RTT
  shared-source scenario.
- Full unit/integration suite: 233 files and 2,183 tests passed.
- `npm run typecheck`, `npm run lint`, `npm run check:css`, and `npm run build`
  passed.
- The production build did not contain the `/__dev/fringe-club-rtt` route
  string. The public asset remains copied from `public/`, but normal app startup
  did not request it.
- `npm run ci:local:e2e` stopped at its first browser spec,
  `architecture-foreground-compound.spec.ts`, which timed out waiting for the
  existing “Complete the Photograph” heading. The same unrelated failure is
  recorded in the Stage 2I report; the CI script therefore did not run the
  remaining E2E files. All three Fringe browser tests passed separately.

No public catalog, scene publication, task registry, public Ground Glass
profile, canonical optics/state, Stage 2F material authority, Stage 2G UV/bake
authority, or Stage 2H runtime asset was changed. There is no weathering,
texture rebake, KTX2 work, FCC content, or production scene activation.

## Scope boundary

This validates shared-source ownership and rendering through the current
development fixture. It does not promote Fringe Club to a public scene, lesson,
catalog entry, or production Ground Glass profile. It also does not establish
performance or visual parity on physical devices.
