# Scene asset resource lifecycle

This note records the two resource ownership models represented by the typed
scene asset registry. It does not introduce a resource manager or reference
counting.

## Lifecycle classes

### Instance-owned registered assets

The instance-owned registrations from SA1–SA3B and SA4B, the Mirror Shift
asset from SA5A, and the four Macro subjects from SA6A create subject groups
whose render resources are owned by each registered instance. The registered
disposer releases its owned geometry, materials, and textures. These
registrations retain the implicit instance-owned policy and require a disposer
in the type contract. R3F primitives use `dispose={null}` so the registered
lifecycle remains the single disposal authority.

SA6A adds four independently typed Macro asset slots: Macro Bellows Extension,
Macro Depth of Field, Macro Oblique Plane, and Macro Compound Movements. Each
request carries its renderer-neutral scene presentation, and each factory call
creates fresh per-instance geometry, materials, and teaching textures. Their
registered disposers continue to use the existing teaching-subject resource
cleanup contract.

### Complete public-scene asset coverage

The SA7 final source audit on post-SA6A base
`dadd3d77177866bbe342473acd8148d0daf4711d` found one registered asset slot
for each of the 15 cataloged/implemented public scenes. At the SA7 audit
snapshot, all 15 are enabled by `scenePublication`; publication remains an
independent kill switch and is not an architecture-completeness requirement.
Scene IDs remain separate from asset keys. Interactive static subjects and RTT
subjects resolve the same registered factory; the two specialized runtime
adapters are called out below.

World illumination is outside the registered asset lifetime. The scene
illumination resolver supplies renderer-neutral source data in scene
millimetres; Observer and Ground Glass each create a separate light object for
their own scene. The R3F consumer owns the Observer light lifecycle, while the
imperative Ground Glass rig removes and disposes its lights with the RTT scene.
The Interior Corner asset disposer owns only the subject's geometry, materials,
and textures.

| Scene ID | Asset slot | Implementation ID | Presentation contract | Resource lifetime | Special runtime integration |
|---|---|---|---|---|---|
| `view-camera-anatomy` | `view-camera-anatomy-subject` | `threejs-view-camera-anatomy` | `ViewCameraAnatomyPresentation` | Module-shared | Lesson 0 scene integration |
| `understanding-camera-movements` | `camera-movement-lattice` | `threejs-camera-movement-lattice` | `CameraMovementLatticePresentation` | Instance-owned | Dynamic calibration/lesson presentation and RTT mount/update lifecycle |
| `focus-fundamentals-two-targets` | `focus-fundamentals-subject` | `threejs-focus-fundamentals` | `FocusFundamentalsPresentation` | Module-shared | Selectable-focus lesson state remains upstream |
| `architecture-rise` | `architecture-rise-subject` | `threejs-architecture-rise` | `ArchitectureRisePresentation` | Instance-owned | Canonical focus markers remain scene integration |
| `table-tilt` | `table-tilt-subject` | `threejs-table-tilt` | `TableTiltPresentation` | Instance-owned | None |
| `shelf-swing` | `shelf-swing-subject` | `threejs-shelf-swing` | `ShelfSwingPresentation` | Instance-owned | None |
| `oblique-tabletop` | `oblique-tabletop-subject` | `threejs-oblique-tabletop` | `ObliqueTabletopPresentation` | Instance-owned | Canonical board/focus calibration remains upstream |
| `mirror-shift` | `mirror-shift-subject` | `threejs-mirror-shift` | `MirrorShiftPresentation` | Instance-owned | RTT representation plus Mirror Shift-specific reflection updater |
| `oblique-architecture` | `oblique-architecture-subject` | `threejs-oblique-architecture` | `ObliqueArchitecturePresentation` | Instance-owned | None |
| `architecture-foreground` | `architecture-foreground-subject` | `threejs-architecture-foreground` | `ArchitectureForegroundPresentation` | Instance-owned | None |
| `interior-corner` | `interior-corner-subject` | `threejs-interior-corner` | `InteriorCornerPresentation` | Instance-owned | World-illumination consumer owns the practical PointLight; subject owns geometry/materials only |
| `macro-bellows-extension` | `macro-bellows-extension-subject` | `threejs-macro-bellows-extension` | `MacroBellowsExtensionPresentation` | Instance-owned | None |
| `macro-depth-of-field` | `macro-depth-of-field-subject` | `threejs-macro-depth-of-field` | `MacroDepthOfFieldPresentation` | Instance-owned | None |
| `macro-oblique-plane` | `macro-oblique-plane-subject` | `threejs-macro-oblique-plane` | `MacroObliquePlanePresentation` | Instance-owned | None |
| `macro-compound-movements` | `macro-compound-movements-subject` | `threejs-macro-compound-movements` | `MacroCompoundMovementsPresentation` | Instance-owned | None |

The registry has 13 instance-owned registrations and 2 module-shared
registrations. The completeness regression compares implementation sets:
cataloged public scene IDs, scene definitions, RTT IDs, subject registrations,
and asset slots. It separately checks that published entries are a configurable
subset. The test then creates each implemented RTT subject and verifies its
diagnostic implementation ID matches the mapped registration.

### Module-shared scene subjects

Focus Fundamentals (`focus-fundamentals-subject` →
`threejs-focus-fundamentals`) and View Camera Anatomy
(`view-camera-anatomy-subject` → `threejs-view-camera-anatomy`) create a fresh
`THREE.Group` and fresh child `THREE.Mesh` objects for each consumer. Those
objects borrow a bounded set of immutable geometry, material, and (for Focus
Fundamentals) texture resources cached by their factory module. The resources
live for the module/application lifetime. Removing one consumer's object graph
does not release the borrowed resources.

`SceneAssetRegistration.renderResourceLifetime: "module-shared"` is the single
authority for this policy. The typed registration requires an explicit shared
lifetime and forbids a per-instance disposer. Instance-owned registrations
continue to require their paired disposer; omitting a disposer never implies a
shared lifetime. `disposeRegisteredSceneAsset()` resolves the explicit slot and
registry, then leaves shared GPU resources alive. The consumer removes or
discards its Object3D graph. For these shared slots, `SceneSubjectRegistry`
contains scene-level RTT integration and delegates cleanup to the asset
registry; it no longer duplicates lifetime metadata. Interactive primitives
use `dispose={null}`.

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

The interactive components and RTT scene-subject registrations both create
through the same typed asset slot and registered factory. The interactive
component passes its fresh group to
`<primitive object={group} dispose={null} />`. RTT
`MountedGroundGlassSceneSubject.dispose()` removes its fresh group from the RTT
scene and then calls `disposeRegisteredRttSubject()`, which delegates to
`disposeRegisteredSceneAsset()`. The module-shared policy intentionally has no
per-group GPU disposer.

Static interactive subjects create registered groups from a layout effect,
with that effect's cleanup disposing the exact created instance through its
registered slot. Camera Movement uses the same effect-owned pairing in its
scene-specific dynamic adapter. Asset construction therefore does not happen
inside a render-time memo calculation that React Strict Mode could replay
without a matching cleanup.

The scene's shadow-participation wrapper refreshes its existing traversal after
these effect-owned graphs attach. This preserves the established shadow flags
and refreshes optional capacity metrics without moving lighting policy into an
asset registration.

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

### Mirror Shift reflection asset

Mirror Shift is an instance-owned asset with one registered implementation and
two typed representations: `viewport` and `rtt`. Both receive the same
renderer-neutral `MirrorShiftPresentation` and use the same registered factory
and paired disposer. Each call creates its own object graph and render resources;
the RTT-only reflected props and camera proxy are representation-specific. The
scene-level RTT profile continues to update that proxy using canonical optics
state through the Mirror Shift-specific updater. This update policy does not
change the asset's instance-owned resource lifetime.

## Canonical state remains upstream

Focus targets, target positions, optical focus, teaching cues, and task
definitions come from scene/domain modules. Lesson 0's focus depth, bounds, and
box layout are derived from its canonical scene metadata and finite-focus
resolver. The factories only consume those values to set render-object
transforms. No production code outside these factories reads their object
names or `userData` as teaching, task, or optics authority.

## Migration outcome

Both scenes were migrated into typed asset slots in SA4B and remain in the
production registry. Their factories receive renderer-neutral
`FocusFundamentalsPresentation` and
`ViewCameraAnatomyPresentation` requests. Tests prove that the interactive and
RTT Object3D graphs are distinct, their cached resource identities are shared,
registry cleanup does not dispose borrowed resources, remounts reuse the cache,
and substitute implementations leave canonical scene/task/optics/presentation
state unchanged.

## Pattern for future scenes

For a new static teaching subject, keep the existing path explicit:

```text
canonical scene geometry
→ renderer-neutral presentation
→ typed asset request and registry registration
→ registered interactive subject and RTT creation
→ explicit instance-owned or module-shared cleanup
```

If a future scene needs dynamic renderer behavior, keep that adapter local to
the scene until multiple scenes establish the same abstraction need. Runtime
updates remain separate from the asset registry's create/dispose and resource
lifetime contract.
