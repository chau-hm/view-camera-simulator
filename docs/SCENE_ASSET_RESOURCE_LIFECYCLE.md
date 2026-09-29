# Scene asset resource lifecycle

This note records the two resource ownership models currently used by scene
subjects. It does not introduce a resource manager or migrate the shared-cache
scenes into `sceneAssetRegistry`.

## Lifecycle classes

### Instance-owned registered assets

The SA1–SA3B registrations create a subject group whose render resources are
owned by that registered instance. The registered disposer releases its owned
geometry, materials, and textures. R3F primitives use `dispose={null}` so the
registered lifecycle remains the single disposal authority.

### Module-shared scene subjects

Focus Fundamentals and View Camera Anatomy create a fresh `THREE.Group` and
fresh child `THREE.Mesh` objects for each consumer. Those objects borrow a
bounded set of immutable geometry, material, and (for Focus Fundamentals)
texture resources cached by their factory module. The resources live for the
module/application lifetime. Removing one consumer's object graph does not
release the borrowed resources.

`SceneSubjectRegistration.renderResourceLifetime: "module-shared"` makes this
policy explicit for the existing scene-subject path. The registration type
requires that a module-shared entry omit `disposeRttGroup`; registrations with
an RTT disposer continue to use their paired disposer. RTT cleanup removes the
group from its scene and calls the optional registered disposer. For these two
entries there is no resource disposer to call. Their interactive primitives
also specify `dispose={null}`.

## Resource inventory

| Scene | Resource | Created where | Shared? | Mutated after creation? | Object/instance owns it? | Disposal authority |
|---|---|---|---|---|---|---|
| Focus Fundamentals | `Group`, child `Group`s, and `Mesh` nodes | `createFocusFundamentalsGroup()` | No; new graph per call | Per-instance node transforms and `userData` are set during creation | Yes, each consumer owns its graph | R3F removes the interactive graph; RTT removes the graph from its scene; no GPU `dispose()` call |
| Focus Fundamentals | 11 geometries: 5 frame, 3 parallax, 1 marker, floor, backdrop | Lazy `ensureSharedResources()` cache in `FocusFundamentalsSubjectFactory.tsx` | Yes; module variables retain the same instances | No mutation after construction; connectors and features change only their mesh transforms | No; borrowed by every returned group | Factory-module/application lifetime; never disposed by an individual group |
| Focus Fundamentals | 7 materials: object, 2 parallax, 2 marker, floor, backdrop | Lazy `ensureSharedResources()` cache | Yes; module variables retain the same instances | No mutation after construction | No; borrowed by every returned group | Factory-module/application lifetime; never disposed by an individual group |
| Focus Fundamentals | 2 marker `DataTexture`s | `makeFocusDetailTexture()` called once per marker during cache initialization | Yes; referenced by shared marker materials | `needsUpdate` is set once during construction; no later mutation found | No; borrowed through the shared materials | Factory-module/application lifetime; no per-group texture disposal |
| View Camera Anatomy | `Group` and 17 `Mesh` nodes | `createLessonZeroGroundGlassGroup()` | No; new graph per call | Per-instance node transforms and `userData` are set during creation | Yes, each consumer owns its graph | R3F removes the interactive graph; RTT removes the graph from its scene; no GPU `dispose()` call |
| View Camera Anatomy | 1 unit `BoxGeometry` | `UNIT_BOX_GEOMETRY` module constant | Yes; shared by every subject mesh and group | No mutation after construction; each box size is a mesh scale | No; borrowed by every returned group | Factory-module/application lifetime; never disposed by an individual group |
| View Camera Anatomy | 5 role `MeshStandardMaterial`s (`structure`, `frame`, `cross`, `centre`, `depth`) | Lazy `materialByRole` module map | Yes; reused by every matching mesh and group | No mutation after construction | No; borrowed by every returned group | Factory-module/application lifetime; never disposed by an individual group |
| View Camera Anatomy | Textures | None created by this factory | No | N/A | N/A | N/A |

For both factories, the relevant categories A–E are:

- **A — Per-instance owned:** each returned Object3D graph.
- **B — Module-shared / process-lifetime:** the cached render resources listed above.
- **C — Shared with explicit lifetime management:** none.
- **D — External / borrowed:** none.
- **E — Unclear:** none found in this audit.

`THREE.Color` constants used to construct Focus Fundamentals materials are CPU
values, not separately disposed GPU resources. The canonical Focus and Anatomy
geometry modules contain renderer-neutral data and are not Three.js resources.

## Consumers, remounts, and concurrency

The interactive components and the RTT scene-subject registrations call the
same factory for each scene. The interactive component passes its fresh group
to `<primitive object={group} dispose={null} />`. RTT `MountedGroundGlassSceneSubject.dispose()` removes its fresh group from the RTT scene and then calls `disposeRegisteredRttSubject()`; the module-shared registration intentionally has no per-group disposer.

Therefore an interactive group and an RTT group have distinct Object3D
identities while referring to the same geometry/material/texture identities.
Cleaning up either group cannot dispose resources still borrowed by the other.
Creating a new group after both consumers have been removed returns the same
module-cache resource identities. React Strict Mode may cause extra construction
and cleanup cycles, but no acquire/release balance is involved and those cycles
do not invalidate the caches.

If construction fails after a cache is initialized, the partially created
Object3D graph can be discarded while module-owned resources remain available
for the next attempt. No consumer mutates cached geometry or materials after
construction. Focus marker textures are marked for upload only when initially
created. The scene renderers update per-object shadow flags, not shared resource
state. `TeachingLighting` reads object names to set renderer shadow participation;
that visual policy does not feed teaching, task, or optics truth.

The shared caches intentionally have no normal scene-switch release operation.
They remain alive while their factory module/application is alive; destroying
the renderer/WebGL context is the ultimate browser resource teardown. No
HMR-specific cache teardown is implemented. This is a development-time
limitation of the module-lifetime choice, not a reason to add per-instance
reference counting to normal scene switching.

## Canonical state remains upstream

Focus targets, target positions, optical focus, teaching cues, and task
definitions come from scene/domain modules. Lesson 0's focus depth, bounds, and
box layout are derived from its canonical scene metadata and finite-focus
resolver. The factories only consume those values to set render-object
transforms. No production code outside these factories reads their object
names or `userData` as teaching, task, or optics authority.

## Migration decision

Neither scene is migrated into `sceneAssetRegistry` in SA4A. The current
scene-subject path is already safe for these module-lifetime caches; this round
adds explicit lifecycle metadata, source ownership comments, and regressions
for shared identity, RTT cleanup/remount, and canonical independence. Moving
both scenes into typed asset slots would also require new presentation/request
contracts and is better handled as **SA4B — Shared Teaching Scene Asset
Migration**, carrying the same explicit module-shared policy into the typed
asset-registration contract when those real assets are migrated.
