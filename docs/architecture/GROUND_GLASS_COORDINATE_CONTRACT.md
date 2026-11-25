# Ground Glass Coordinate Contract

This contract records the coordinate mappings implemented by the current Ground Glass WebGL path. It complements [Renderer Stabilization Contract](RENDERER_STABILIZATION_CONTRACT.md) and does not define a backend-neutral renderer.

## Coordinate spaces

| Space | Origin and positive axes | Units | Authority / consumer | Canonical or renderer-specific |
| --- | --- | --- | --- | --- |
| Canonical optics / scene world | Camera convention: +X right, +Y up, +Z toward the subject | mm | `deriveOpticsState()`, scene targets, canonical planes | Canonical physical geometry |
| Camera rig-local | Relative to the simulator's zero-movement lens datum; +X/+Y/+Z follow the camera convention | mm | `CameraBodyLocalGeometry`, rig and body transforms | Canonical inputs before placement |
| Rear-standard / film-local | Origin at film center; +X along top-left to top-right, +Y along bottom-left to top-left | mm | `rearStandardFrame`, coverage and film-plane calculations | Canonical physical geometry |
| Physical film UV | Origin at physical top-left; +U toward top-right, +V toward bottom-left | normalized [0,1] | Ordered `filmPlaneCornersWorld`, `projectWorldPointToFilmPlaneGroundGlass()` | Canonical film position; full film unless a crop is stated |
| RTT source frustum / crop UV | Origin at projected source top-left; +U right, +V down | normalized [0,1] | `GroundGlassInspectionWindow`, `configureGroundGlassCamera()` sub-frustum | Renderer-specific camera window |
| RTT sampler texture UV | WebGL texture convention: origin at lower-left; +U right, +V up | normalized [0,1] | Full-screen shader samples and `mapGroundGlassRttTextureUvToCanonicalFilmUv()` | Renderer-specific address with an established physical correspondence |
| Ground Glass display UV | Origin at displayed top-left; +U right, +V down | normalized [0,1], then CSS pixels in the stage content box | `GroundGlassStage`, target presentation, physical grid | Presentation coordinates |
| Focus Loupe window | Center is in displayed full-film coordinates; top-origin; width and height are fractions of the complete film | normalized [0,1] and physical mm | Stage pan, `groundGlassInspectionWindow.ts`, RTT camera crop | Renderer-specific crop of canonical film |

All `*World` values in `DerivedOpticsState` are canonical world coordinates in millimetres. Three.js scene and camera positions are converted to metres with `WORLD_SCALE = 0.001`. Three.js cameras use local −Z as their viewing direction. The `StandardFrame` members `centerWorld`, `rightWorld`, and `upWorld` keep legacy names when nested inside `rearStandardFrameLocal`; in that parent they contain rig-local values. They are not world-space values.

For an unrotated 127 × 101.6 mm film, film-local millimetres and physical film UV relate as `x = (u - 0.5) × 127` and `y = (0.5 - v) × 101.6`. Tilted or shifted film uses its ordered corners and rear-standard basis; consumers must not substitute global X/Y.

## Current transform chain

```text
Canonical Camera / Scene State (mm)
        |
        v
deriveOpticsState()
        |
        +--> Camera rig-local geometry --> body pitch / rig placement --> canonical world geometry
        |
        v
Physical rear-standard film plane (mm; ordered corners)
        |
        v
Physical film UV (top-left, U right, V down)
        |
        +-------------------------------+
        |                               |
        v                               v
Reflected off-axis RTT camera           Target projection / CSS overlay
        |                               |
        v                               |
RTT sampler UV (WebGL bottom-origin)    |
        |                               |
        +--> Raw / Upright sample flip   |
        |                               |
        +---------------+---------------+
                        |
                        v
             Ground Glass display UV (CSS top-origin)
                        ^
                        |
      Focus Loupe display window -> source frustum crop
```

The diagram shows relationships, not one universal UV transform. The physical target projection and the RTT sampler reach display coordinates through different boundaries:

- `configureGroundGlassCamera()` reflects the ordered physical film corners through the lens before configuring the source camera. For the current reflected camera, a source texel's numeric sampler UV maps directly to its corresponding rear-standard film UV. `mapGroundGlassRttTextureUvToCanonicalFilmUv()` is intentionally identity.
- This identity is a numeric correspondence established by the reflected-camera/render-target path, not a claim that WebGL's lower-left sampler origin and physical film's top-left origin are the same convention. The composite's framebuffer-to-screen V conversion remains a separate step.
- The composite shader starts with WebGL sampler coordinates and applies the selected sample transform. Raw flips both sampler axes; Upright Assist flips neither. Converting the resulting framebuffer V to top-origin screen V gives the physical-target display rules below.
- `projectWorldPointToFilmPlaneGroundGlass()` returns top-left-origin physical film UV. `mapPhysicalFilmUvToGroundGlassDisplayUv()` maps that physical position to CSS top-origin display UV. This helper must not be replaced by copying sampler flip flags.
- The CSS physical grid uses the same physical-to-display target mapping to position the physical film origin and keep its spacing tied to the sampled millimetres. RTT display sizing and overlays use the stage content box; the border-box rectangle includes the surrounding border and must not set the image or grid phase.

The Focus Loupe enters at the displayed full-film window. Pan is expressed in displayed top-origin coordinates. The active window is clamped within the complete film and its fraction is \(1 / \text{magnification}\). `mapGroundGlassInspectionWindowToRttSourceCrop()` maps its center to the pre-composite, top-origin source frustum. The camera uses that window to select a sub-frustum; it keeps the physical camera pose and clip range. When converting the selected source crop to physical millimetres, `resolveGroundGlassInspectionFilmWindowMm()` converts top-origin crop V to sampler/canonical V once with \(v_\text{texture} = 1 - v_\text{crop}\). Do not also flip the returned physical coordinate.

The crop changes the physical area shown and therefore pixels per millimetre. It does not change the physical CoC or footprint calculation. The gather shader converts its unchanged CoC in mm to pixels using the sampled film width and render width. Image-circle coverage and natural illumination consume the same canonical physical film window and existing coverage data.

## Worked asymmetric reference points

These expected values follow the coordinate definitions above. For each point, physical \(v\) is measured downward from the physical top edge. Raw and Upright values are top-origin display coordinates. The final column is the top-origin source-frustum center that crops the same physical point in either display mode.

| Reference point | Physical film UV | Raw display UV | Upright display UV | Source crop top UV |
| --- | --- | --- | --- | --- |
| Off-center upper-left | (0.17, 0.28) | (0.83, 0.28) | (0.17, 0.72) | (0.17, 0.72) |
| Off-center upper-right | (0.82, 0.21) | (0.18, 0.21) | (0.82, 0.79) | (0.82, 0.79) |
| Off-center lower-left | (0.23, 0.79) | (0.77, 0.79) | (0.23, 0.21) | (0.23, 0.21) |
| Off-center lower-right | (0.76, 0.84) | (0.24, 0.84) | (0.76, 0.16) | (0.76, 0.16) |
| Interior | (0.37, 0.61) | (0.63, 0.61) | (0.37, 0.39) | (0.37, 0.39) |

For example, the interior point is \((-16.51,\,-11.176)\) mm from the film center in rear-standard coordinates. Its Raw display position is \((0.63,0.61)\), and its Upright position is \((0.37,0.39)\). Cropping either displayed position produces source-frustum center \((0.37,0.39)\); the one V conversion then returns physical film UV \((0.37,0.61)\).

These values are fixed conformance references, not outputs generated by the mapping functions under test. The `groundGlassCoordinateContract.test.ts` fixture constructs each world point from the stated film-plane fraction and independently projects it through the reflected RTT camera.

## Backend conformance requirements

| Requirement | Current evidence | Alternate Ground Glass backend |
| --- | --- | --- |
| Same canonical film plane, physical film coordinates, lens coverage offsets, CoC, and footprint classification | Core optics and WebGL unit/browser coverage | Must consume the same canonical values without recalibration |
| Asymmetric Raw and Upright orientation, source/crop relationship, and physical target mapping | Fixed coordinate references plus WebGL camera/composite tests | Must reproduce these mappings and show rendered output parity |
| Loupe dimensions, source-side pan, edge clamp, and film-window coverage | Unit and current WebGL browser tests | Must preserve the same cropped physical region |
| Image-circle/coverage placement and natural-illumination coordinates | Canonical coverage state tests and current WebGL rendering evidence | Must preserve offset, falloff, and crop behavior |
| Physical grid and Focus Distribution target coordinates | Unit and current UI/browser tests | Must align each overlay to its rendered physical target |
| Owned resource cleanup and failure reporting | Renderer stabilization tests and current WebGL lifecycle evidence | Must define backend-specific allocation, cleanup, and runtime evidence |

Passing WebGL conformance tests establishes the reference behavior for this backend only. It does not prove WebGPU feasibility or parity. A future backend still needs its own shader, capability/fallback, resource-lifetime, mounted-runtime, and browser-rendering evidence.

## Related authority

- [Renderer Stabilization Contract](RENDERER_STABILIZATION_CONTRACT.md) — current Observer and WebGL Ground Glass boundaries and resource ownership.
- [Architecture Diagnosis, coordinate spaces](../ARCHITECTURE_DIAGNOSIS.md#11-coordinate-spaces) — world, rig-local, and renderer coordinate history.
- [DOF Focus Physics Convergence](../DOF_FOCUS_PHYSICS_CONVERGENCE.md) — physical CoC, footprints, and gather scale.
- [Visual Pipeline Readiness](../VISUAL_PIPELINE_READINESS.md) — current capability and migration readiness.
- [Scene Asset Resource Lifecycle](../SCENE_ASSET_RESOURCE_LIFECYCLE.md) — registered scene-subject ownership and lifetime.
- `src/render/groundGlassRttOrientation.ts`, `groundGlassInspectionWindow.ts`, and `groundGlassTargetProjection.ts` — executable mapping contracts.
