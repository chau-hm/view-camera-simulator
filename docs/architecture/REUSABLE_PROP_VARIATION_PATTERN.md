# Reusable Prop Variation Pattern

## Purpose

This pattern lets a scene planner reuse deterministic placement math and
constraint checks without creating a generic scene generator. The shared layer
knows only box bounds, support surfaces, and geometric relationships. Each
scene still decides which objects exist, how to arrange them, and what to do
when its own checks fail.

The production examples are Interior Corner schema v2 and Shelf Swing schema
v1. Each scene has its own catalog, placement constraints, protected teaching
regions, and fallback policy. The test-only Shelf Display fixture remains as a
small helper-level example; it is not a published scene. The foundation
preserves the accepted Interior Corner schema-v1 material-only and schema-v2
material-and-props outputs.

## Architecture boundaries

```text
SceneVariationDescriptor
        |
        v
Scene-specific planner ------------------- Scene-specific fallback policy
        |                                      (planner-owned)
        v
Shared placement geometry and constraints
        |
        v
Registered scene subject factory
        |
        +-- Observer-owned objects and resources
        +-- Ground Glass-owned objects and resources
```

The responsibilities are:

| Layer | Owns |
| --- | --- |
| Shared variation foundation | Stable PRNG substreams and pure placement geometry/constraint helpers |
| Scene planner | Prop catalog, palettes, semantic IDs, candidate placements, protected regions, schema policy, safety policy, and fallback |
| Registered subject factory | Three.js geometry, materials, hierarchy, shadows, and subject-owned disposal |

The shared helpers contain no scene constants, random draws, browser globals,
renderer imports, caches, or fallback decisions. They do not change canonical
geometry, focus targets, camera settings, or teaching criteria.

## Pure placement geometry

`src/scenes/variation/placementGeometry.ts` contains renderer-neutral helpers
for:

- Y-axis yaw rotated rectangular footprints represented as `Bounds3`;
- extracting X/Z bounds from a 3D bound;
- deriving an X/Z footprint from a rectangular support surface.

All placement values are canonical millimetres. The yaw helper computes an
axis-aligned bounding box for a box rotated around Y. It does not perform
arbitrary-axis or mesh collision detection. The existing `Bounds3` type is
reused so the variation layer does not create a competing 3D bounds contract.

## Composable constraints

`src/scenes/variation/placementConstraints.ts` contains pure checks for:

- finite, positive box dimensions and finite 3D bounds;
- inclusive room-bound containment and boundary excursions;
- inclusive X/Z support containment;
- support-height alignment with an explicit millimetre tolerance;
- strict 3D AABB overlap, where touching faces do not overlap;
- inclusive X/Z protected-region overlap, where touching a protected edge
  counts as an intersection;
- pairwise overlap reporting in stable input order.

The different edge rules are intentional: room and support surfaces contain
objects that end exactly on their boundary; mutual collision requires positive
volume overlap; focus-protected regions include their boundaries. Callers
choose tolerances and compose the checks into scene-specific issue codes or
messages. Non-finite bounds are reported explicitly by the caller.

These checks are not a physics engine. They do not settle, move, retry, or
optimize placements.

## Stable substreams and planning

Planners receive the existing `SceneVariationDescriptor` and request fresh
streams using stable semantic object IDs, for example:

```ts
const propStream = descriptor.createRandomStream("props", "shelf-left-slot");
const layoutStream = descriptor.createRandomStream("layout", "shelf-left-slot");
const kind = propStream.pick(["book", "small-object"] as const);
```

The `(sceneId, seed, schemaVersion, domain, objectId)` tuple determines each
stream. Use semantic IDs instead of array indices. A material draw, a new
object ID, or a layout draw does not advance another object's stream. Shared
geometry and constraint functions never receive a random stream, so validating
a candidate cannot consume random values.

## Scene planner and fallback ownership

The Interior Corner planner remains responsible for its vase profiles,
book-stack generation, sculpture and cushion alternatives, rug patterns,
console and bench slots, room-specific focus protection, arrangement IDs, and
schema-v2 safe fallback. It resolves one pure millimetre-based plan and audits
that plan using shared checks plus its own room and teaching-context rules.

The Shelf Swing planner owns a separate schema-v1 catalog of boxes, cylinders,
and low-poly ceramic-like vessels. Stable IDs identify the left/right display
slot at each of the front, middle, and back stations. It puts one or two props
on each station's supported lower shelf, inside the central display zone and
behind the chart. Existing contextual books, station frames, backdrops, focus
charts, probes, and samples remain authored and fixed. The planner validates
support height and footprint, station and scene bounds, frame clearance,
backdrop and chart backing, the full focus-chart volume, the chart's protected
front-facing view, authored book footprints, and pairwise prop intersections.
Its deterministic fallback uses one small box on each lower shelf and records
the generated candidate's issue codes. It uses no random retries.

Shelf Swing's station-local prop centers are converted through
`subjectLocalToWorld()`. World bounds include the station yaw plus the prop yaw
once; tests compare generated mesh world centers against the canonical
transform. The observer remains on the chart-facing side. The planner also
checks canonical `sceneBounds` before a prop can reach the registered factory.

A future planner follows the same division: generate one deterministic
candidate from named streams, validate it, then apply that scene's explicit
fallback policy. The shared layer reports geometry; it never chooses the
fallback. Do not add random retries to address invalid candidates.

## Test-only placement fixture

`src/tests/unit/fixtures/shelfDisplayPlacementFixture.ts` models two items on a
hypothetical shelf. It has its own support dimensions, two semantic slots, and
a protected center region. It uses the shared geometry and constraint modules
and the normal variation descriptor. Its tests verify stable plans, valid
alternative choices, support containment, unsupported placement detection,
protected-region detection, and overlap detection. The fixture imports neither
production planner nor Three.js and is not registered in the scene catalog.
The production second-consumer proof is Shelf Swing.

## Registered subjects and ownership

Scene planners return renderer-neutral semantic placement data. Registered
subject factories convert that data into their own Three.js objects. Observer
and Ground Glass may resolve equivalent plans from the same identity, but each
factory must create and dispose its own geometry, materials, and textures.
Do not share live Three.js resources or introduce a global resource cache.
Resolve plans at subject creation or variation resolution, not in camera-frame
updates, focus/aperture derivation, or Ground Glass frame requests.

Both registered factories resolve plans at subject creation. Observer and
Ground Glass each own independent geometry and materials; seed regeneration
replaces those subjects while preserving the mounted WebGL renderer and RTT
targets. Shelf Swing's canonical no-descriptor factory signature remains
pinned. Its visual and lifecycle evidence is recorded in
[`../render-quality/SHELF_SWING_SEEDED_PROPS_PILOT.md`](../render-quality/SHELF_SWING_SEEDED_PROPS_PILOT.md).

## Versioned reproducibility

Schema version is part of the variation identity. Current accepted contracts
are Interior Corner schema v1 (material-only), Interior Corner schema v2
(materials plus decorative props and bounded rug micro-layout), and Shelf
Swing schema v1 (decorative props). Schema numbers are scene-scoped.
Unsupported versions must not be silently mapped to another algorithm. The
extraction does not add a schema migration framework.

For the current implementation, the planner data contract is reproducible for
`(sceneId, seed, schemaVersion)`. Interior Corner plan serializations and
Shelf Swing plan serializations and subject signatures are pinned for seeds
`0`, `1`, `284719`, and `4294967295`. This does not promise permanent pixel
identity across future geometry, shader, material, browser, or renderer
changes.

## Example for a future scene

Keep the semantic candidate, the scene-specific policy, and rendering separate:

```ts
// Planner: stable semantic placement data in millimetres.
const candidate = Object.freeze({
  id: "display-vase-left",
  positionMm: Object.freeze({ x: -320, y: support.topY + heightMm / 2, z: 0 }),
  dimensionsMm: Object.freeze({ width: 140, height: heightMm, depth: 130 }),
});
const bounds = getYawRotatedBoxBoundsMm(candidate.positionMm, candidate.dimensionsMm);

// Scene-specific validation: compose shared checks with this room's rules.
const safe = isWithinBoundsXZ(getBoundsXZMm(bounds), getSupportSurfaceBoundsXZMm(support)) &&
  isSupportedAtHeightMm(bounds.min.y, support.topY, 1e-6) &&
  !intersectsProtectedRegionXZ(getBoundsXZMm(bounds), protectedRegion);

// Registered subject factory: build its own renderer-owned mesh/resources.
if (safe) createSceneSpecificThreeMesh(candidate);
```

The scene planner still chooses `heightMm`, the support, the protected region,
what to do when `safe` is false, and how the semantic placement maps to a
subject. Three.js construction stays inside that scene's registered factory.

## Testing recommendations

- Unit-test yaw footprints at zero, signed small angles, and 90 degrees using
  non-square dimensions.
- Test exact containment edges, support tolerance, touching versus overlapping
  boxes, protected-region edges, and non-finite/invalid dimensions.
- Pin plan serialization and subject signatures before refactoring a production
  planner; do not update accepted hashes to hide output changes.
- Sweep a bounded range of seeds and label it as sampled coverage, not
  exhaustive coverage of all uint32 values.
- Keep helper-only fixtures unregistered; production consumers should be
  validated through their actual registered Observer and Ground Glass paths.
- For subject tests, compare semantic geometry/material signatures while
  ignoring renderer UUIDs, and verify independent ownership and disposal.

## Limitations

The shared footprint model is box-based and supports yaw around Y only. The
protected-region helper checks X/Z overlap, not arbitrary 3D volumes. Scene
planners remain responsible for vertical policy, canonical room semantics,
fallback selection, and authored object catalogs. The pilot adds Shelf Swing
as a production consumer without changing Interior Corner output or the optics
engine.
