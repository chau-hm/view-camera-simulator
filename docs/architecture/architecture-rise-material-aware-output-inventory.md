# Architecture Rise material-aware Observer inventory

This inventory separates the authored material roles from the runtime graph
observed on the native WebGPU candidate route. It covers the Observer only;
the shared Architecture Rise asset remains authored with ordinary Three.js
materials for WebGL and Ground Glass.

## Authored roles

| Object/role | Authored family and count | Rendering intent | Owner / disposal |
| --- | --- | --- | --- |
| Registered Architecture Rise subject | 11 `MeshStandardMaterial`, 3 `MeshBasicMaterial` | Lit architectural surfaces and unlit focus-chart details | `disposeArchitectureRiseGroup` → `disposeTeachingSubjectResources` |
| Focus target | 1 `MeshStandardMaterial` | Lit target marker; casts its authored shadow | Scene subject/Observer scene ownership |
| Conceptual camera | Runtime inventory: 29 Standard, 1 Basic | Lit camera assembly plus unlit accents; 2 Standard assignments are transparent | R3F-owned authored materials; adapted output is controller-owned |
| Optical helpers | Runtime inventory: 6 Basic, 16 LineBasic | Unlit teaching construction; transparent and generally depth-independent | R3F-owned authored materials; adapted output is controller-owned |
| Other Observer geometry | Runtime inventory: 1 Standard, 5 LineBasic | Explicitly inventoried ancillary scene content | R3F-owned authored materials; adapted output is controller-owned |
| Focus / near DOF / far DOF overlays | Basic and LineBasic roles | Authored colors/opacity, blending, depth test/write, polygon offset, and outline behavior | R3F Observer scene; adapted output is controller-owned |

The Architecture Rise subject factory roles include building/facade, roof,
trim, glazing, recess, pavement, sidewalk, ground, reference, and reference
light surfaces. The 11 Standard materials use existing authored PBR values;
procedural material construction uses albedo, roughness, and normal maps,
normal scale, roughness, and metalness. The three Basic materials are the
subject's teaching/focus-chart details. No scene geometry, transform, or
material recipe was changed for this integration.

## Runtime candidate observation

Native Chrome 155.0.8059.79 reported 393 mesh/material assignments and 73
distinct material instances. All 73 were adapted; zero unsupported instances
were found. Runtime rows below aggregate assignments by semantic role and
source family; they are not authored object counts.

| Runtime role | Source → NodeMaterial | Instances / assignments | Lit / transparent | Tone-mapped / depth-test / depth-write assignments | Shadow caster / receiver assignments | Status |
| --- | --- | ---: | --- | --- | --- | --- |
| Architecture subject | Basic → `MeshBasicNodeMaterial` | 3 / 81 | no / 0 | 81 / 81 / 81 | 0 / 0 | supported |
| Architecture subject | Standard → `MeshStandardNodeMaterial` | 11 / 253 | yes / 0 | 253 / 253 / 253 | 253 / 41 | supported |
| Conceptual camera | Basic → `MeshBasicNodeMaterial` | 1 / 1 | no / 0 | 1 / 1 / 0 | 0 / 0 | supported |
| Conceptual camera | Standard → `MeshStandardNodeMaterial` | 29 / 29 | yes / 2 | 29 / 29 / 28 | 0 / 0 | supported |
| Focus targets | Standard → `MeshStandardNodeMaterial` | 1 / 1 | yes / 0 | 1 / 1 / 1 | 1 / 0 | supported |
| Other Observer | LineBasic → `LineBasicNodeMaterial` | 5 / 5 | no / 1 | 5 / 5 / 5 | 0 / 0 | supported |
| Other Observer | Standard → `MeshStandardNodeMaterial` | 1 / 1 | yes / 1 | 1 / 1 / 1 | 0 / 0 | supported |
| Optical helpers | LineBasic → `LineBasicNodeMaterial` | 16 / 16 | no / 16 | 0 / 0 / 0 | 0 / 0 | supported |
| Optical helpers | Basic → `MeshBasicNodeMaterial` | 6 / 6 | no / 6 | 2 / 5 / 2 | 0 / 0 | supported |

`toneMapped` is copied for authored NodeMaterial instances and is reported as
runtime evidence. The output node handles lit Standard materials with ACES
Filmic followed by sRGB conversion when tone mapping is enabled; Basic and
LineBasic roles use sRGB conversion without ACES. The candidate disables the
renderer-wide transform with R3F Canvas `flat` and `linear`, keeping output
semantics at the material boundary.

### Maps, environment, lighting, and lifecycle

- Architecture Standard material `map` slots retained sRGB color space.
- `normalMap` and `roughnessMap` retained `NoColorSpace` (linear data), authored
  repeats, and normal-scale values. The runtime inventory records 163 slot
  assignments for each of those three map types across scene draws.
- Runtime roughness values were `0.24`, `0.68`, `0.82`, `0.92`, `0.94`,
  `0.97`, `0.98`, and `0.99`; metalness values were `0` and `0.08` for the
  Architecture subject. The conversion preserves source values rather than
  rebuilding scene recipes.
- The environment is assigned globally to the scene and was active at
  intensity `0.95`. It remains scene-radiance input to lit shading; it is not
  transformed as an albedo or other display-space material map.
- The candidate observed one hemisphere light and two directional lights; the
  teaching key cast shadows. Shadow maps reported active PCF with sizes 1024
  and 512. Node Standard materials remain eligible through the narrow lit
  material classifier; unlit Basic/LineBasic teaching helpers do not become
  shadow casters by family alone.
- Architecture-subject NodeMaterials remain under the existing subject
  disposer. Other adapter NodeMaterials are owned and disposed by the
  material-aware output controller. Source materials and shared textures
  retain their existing owners; the controller does not dispose them.
- The WebGPU scene remains hidden until runtime traversal adapts every
  encountered material. A new unsupported family reports a candidate failure
  and enters the existing one-shot application fallback. That Canvas remount
  uses the standard WebGL output and authored WebGL materials.

The machine-readable source/runtime inventory is in
[`architecture-rise-material-aware-output-inventory.json`](architecture-rise-material-aware-output-inventory.json).
The full runtime report, including every family property and the complete
81-criterion comparison, is retained under ignored Playwright `test-results/`
locally; the compact, committed summary and selected captures are in
[`architecture-rise-material-aware-output/`](architecture-rise-material-aware-output/).
