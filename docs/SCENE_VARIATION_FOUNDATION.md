# Scene Variation Foundation

## Purpose and scope

Scene Variation gives an opted-in scene subject a reproducible identity and
stable random substreams for presentation-only choices. Canonical geometry,
focus and composition targets, camera presets and movement limits, task
criteria, and lesson/calibration semantics remain authoritative.

Interior Corner and Shelf Swing are the two production opt-ins. Interior
Corner's schema-v1 contract preserves the accepted material-only scene; schema
v2 adds bounded decorative props and rug micro-layout. Shelf Swing uses its
own schema-v1 contract for bounded decorative props. Schema numbers identify a
scene-specific plan and do not imply the same catalog or output across scenes.
Guided Mode, lesson Observe, other scenes, and all teaching contracts remain
canonical. New implicit Interior Corner Free Practice sessions use v2; new
Shelf Swing Free Practice sessions use v1. Historical seed-only links continue
to resolve according to each scene's accepted v1 contract.

## Capability and identity

A scene opts in through its existing `SceneDefinition`. Interior Corner
declares `sceneVariation: { enabled: true, schemaVersion: 2,
supportedSchemaVersions: [1, 2] }`: version 2 is current and version 1 is
explicitly retained for historical links. Shelf Swing declares
`sceneVariation: { enabled: true, schemaVersion: 1 }`. The route never infers
support from the presence of a `seed` query parameter.

`SceneVariantIdentity` is the serializable tuple:

```text
(sceneId, seed, schemaVersion)
```

`seed` is an unsigned 32-bit integer (`0` through `4294967295`). The identity
lives in its own Zustand field, separate from `CameraState`, derived optics,
task evaluation, and lesson state.

## Version and deterministic core

Schema versions are scoped to their scene. Interior Corner schema v1 remains
the accepted material-only variation contract, and schema v2 adds its
deterministic decorative-prop plan without changing the v1 material maps or
subject graph. Shelf Swing schema v1 is a separate props-only plan. These are
the production contracts; Interior Corner supports both and declares v2
current, while Shelf Swing supports v1 only. Unsupported versions fail closed
and are never mapped to another algorithm.

Both versions use a small Mulberry32 stream with explicit unsigned 32-bit
arithmetic. `nextFloat()` returns `[0, 1)`, `nextInt(min, max)` returns an
inclusive integer interval, and `nextRange(min, max)` returns a half-open
numeric interval. `pick(items)` needs a non-empty list.

`deriveSceneSubstreamSeed(seed, sceneId, domain, objectId, schemaVersion)` hashes
a JSON tuple over UTF-16 code units with stable FNV-1a arithmetic. Each
semantic object and domain gets its own fresh stream. Supported domains are
`materials`, `props`, `layout`, and `lighting`. Use stable IDs such as
`bench-cushion-left` or `rug-arrangement`, not array positions. A draw added
for one object/domain cannot advance another stream.

`resolveSceneVariationDescriptor(scene, identity)` returns the shared,
renderer-neutral `SceneVariationDescriptor`. It rejects a scene ID or schema
mismatch and throws `UnsupportedSceneVariationSchemaError` for an unsupported
version. Future schema changes must add an explicit algorithm contract; no
migration framework is included.

## Seed creation and URL policy

`seed` accepts one canonical decimal unsigned 32-bit integer. Signs, leading
zeroes (except `0`), fractions, exponent notation, `NaN`, empty values,
duplicates, trailing characters, and overflow are rejected.

For an opted-in Free Practice route:

- Shelf Swing `?seed=284719&sv=1` reproduces the Shelf Swing schema-v1 prop
  arrangement; a legacy seed-only Shelf Swing link also resolves to v1.
- A missing Shelf Swing seed generates an identity under schema v1 and
  replace-normalizes both `seed` and `sv`.
- Interior Corner `?seed=284719&sv=1` reproduces the accepted material-only
  schema v1.
- Interior Corner `?seed=284719&sv=2` reproduces the material-plus-props
  schema v2.
- A legacy `?seed=284719` link is interpreted as v1 and replace-normalized to
  include `sv=1` without changing its seed.
- A missing seed with an explicit supported `sv` generates a seed under that
  version.
- A route with neither seed nor schema generates one seed under the current
  version (v2 for Interior Corner) and replace-normalizes both `seed` and `sv`.
- A malformed seed with no explicit schema generates a new seed under the
  current version; malformed values are never interpreted as zero.
- A malformed, duplicated, mismatched, or unsupported `sv` does not activate a
  variant. The canonical scene is shown with an explanatory status, and the
  requested values remain in the URL so the app does not claim that a different
  version reproduced it.
- Unrelated query parameters and the hash are preserved. Repeated effects for
  one router location reuse its established identity. Back/Forward replays the
  identity stored in each history entry, and reloading a canonical URL
  reproduces it.

For Guided Mode, lesson Observe, and scenes without the capability, `seed` and
`sv` are removed from the route and no variant is activated. Other query
parameters and the hash remain. Regeneration pushes a new seed under the
currently active schema. Camera controls and the existing route initialization
guard remain separate from variant identity; Reset Movements and task restart
do not change the identity.

Entropy acquisition is isolated in `createSceneVariationSeed`. The PRNG,
substream derivation, URL parser, and route policy have no time or
browser-global dependency. Deterministic generation never calls
`Math.random()`.

## Registered subject seam

The registered interactive subject and Ground Glass subject options share the
optional `variationDescriptor` input type. They resolve the same identity and
plan while each renderer-owned factory creates and disposes its own Three.js
objects, materials, geometries, and textures. Do not share live render
resources or add a global texture cache. Subject generation belongs at the
registered factory boundary, not in camera-frame updates or optics derivation.

Interior Corner derives its material roles from stable IDs (`wall-plaster`,
`ceiling-plaster`, `floor-wood`, `trim-plaster`, `furniture-wood`,
`artwork-paper`, and `bench-fabric`). In v2, the same descriptor also resolves
one pure `InteriorCornerPropVariationPlan` for both Observer and Ground Glass.
The planner is renderer-neutral, serializable, millimetre-based, and independent
of camera state. It varies the console accessories/vase profile, one or two
bench cushions, and a bounded rug motif/offset/yaw. It uses the existing
console, bench, rug, room, and focus-target bounds, with a deterministic safe
fallback. The existing registered factory constructs separate renderer-owned
resources from that plan.

Shelf Swing is the second production consumer. Its independent schema-v1
planner varies one or two lower-shelf display objects per station using
scene/station/slot semantic IDs and the station's existing material hints. The
catalog is limited to boxes, 16-sided cylinders, and 12-segment ceramic-like
vessels. The planner uses the shared yaw bounds, support-surface, containment,
collision, and protected-region helpers while retaining Shelf Swing-specific
station, frame, book, backdrop, chart, visibility, and fallback rules. It
places objects in station-local millimetres, computes world bounds after the
canonical station transform with station yaw applied once, and verifies the
canonical camera remains on the chart-facing side. Without a variation
descriptor, the factory keeps the accepted canonical subject signature. With a
descriptor, it replaces only the authored display objects; station structure,
books, charts, probes, samples, and calibration remain fixed.

Observer and Ground Glass receive the same descriptor through the existing
registered-subject seams and independently create and dispose their own Three.js
resources. Seed changes replace the subject while keeping the WebGL Ground
Glass renderer and render targets mounted. The Shelf Swing pilot and browser
captures are documented in
[`render-quality/SHELF_SWING_SEEDED_PROPS_PILOT.md`](render-quality/SHELF_SWING_SEEDED_PROPS_PILOT.md).

A seed change replaces the owned subject while keeping the WebGL Ground Glass
renderer/targets mounted. Focus/aperture changes do not change the variant
identity. The experimental WebGPU path keeps its existing capability/fallback
policy; this pilot does not qualify WebGPU rendering.

Reproducibility covers the `(sceneId, seed, schemaVersion)` descriptor and the
current deterministic plan/material data. It does not promise permanent pixel
identity across future geometry, shaders, material recipes, or browser
renderers.

## API and reproduction

- Identity, versions, and PRNG: `src/scenes/sceneVariation.ts`
- Entropy: `src/scenes/sceneVariationSeed.ts`
- URL parsing and regeneration location: `src/app/sceneVariationUrl.ts`
- Route policy and React synchronization: `src/app/sceneVariationRoute.ts`,
  `src/app/SceneVariationRouteSync.tsx`,
  `src/app/useRegenerateSceneVariant.ts`
- Store state/action: `sceneVariantIdentity` and `resolveSceneVariantRoute` in
  `src/state/appStore.ts`
- Subject input: `SceneVariationSubjectInput` in `src/types/sceneVariation.ts`
- Interior Corner material role seeds:
  `src/scenes/interiorCornerMaterialVariation.ts`
- Interior Corner v2 prop planner:
  `src/scenes/interiorCornerPropVariation.ts`
- Shelf Swing schema-v1 prop planner:
  `src/scenes/shelfSwingPropVariation.ts`
- Shared canonical support surfaces:
  `src/scenes/interiorCornerGeometry.ts`
- Registered subject integration: `src/render/InteriorCornerSubjectFactory.tsx`
- Shelf Swing registered subject integration:
  `src/render/ShelfSwingSubjectFactory.tsx`,
  `src/render/SceneAssetSubjects.tsx`, and
  `src/render/sceneSubjectRegistry.tsx`
- Compact Free Practice controls:
  `src/components/simulator/SceneVariationControls.tsx`

Focused checks:

```bash
npm test -- src/tests/unit/sceneVariation.test.ts src/tests/unit/sceneVariationUrl.test.ts src/tests/unit/sceneVariationRoute.test.ts src/tests/unit/sceneVariationStore.test.ts src/tests/unit/proceduralSurfaceMaterials.test.ts src/tests/unit/interiorCornerFoundation.test.ts src/tests/unit/interiorCornerPropVariation.test.ts src/tests/integration/sceneVariationRoute.test.tsx
npm run typecheck
npm run test:e2e -- --config=playwright.scene-variation.config.ts src/tests/scene-variation-e2e/interior-corner-seeded-materials.spec.ts
npm run test:e2e -- --config=playwright.scene-variation.production.config.ts --project=chromium-scene-variation-production
npm run test:e2e -- --config=playwright.scene-variation.subpath-production.config.ts --project=chromium-scene-variation-subpath-production
```

The accepted Interior Corner schema-v1 material evidence is recorded in
[`render-quality/INTERIOR_CORNER_SEEDED_MATERIALS_PILOT.md`](render-quality/INTERIOR_CORNER_SEEDED_MATERIALS_PILOT.md).
The schema-v2 props/layout evidence is recorded in
[`render-quality/INTERIOR_CORNER_SEEDED_PROPS_LAYOUT_PILOT.md`](render-quality/INTERIOR_CORNER_SEEDED_PROPS_LAYOUT_PILOT.md).
Reusable renderer-neutral placement geometry and constraint guidance is
documented in
[`architecture/REUSABLE_PROP_VARIATION_PATTERN.md`](architecture/REUSABLE_PROP_VARIATION_PATTERN.md).
