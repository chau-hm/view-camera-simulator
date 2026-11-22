# Architecture Rise Seeded Materials — Wave 2

Evidence and canonical baselines are refreshed against `origin/main` at `ee2d18bb3064e66847a33c7fcdb47289bee4b01d`, which includes PR #352.

## Objective and scope

Architecture Rise Free Mode now uses the existing Scene Variation schema v1 contract to resolve deterministic, coordinated finishes for its existing modeled surfaces. Regenerate changes the material appearance family while the building geometry, teaching targets, lighting, and camera calibration remain fixed.

The scene previously had no Scene Variation capability, so Free Mode had no standard seed display or Regenerate Scene control. This work adds that existing UI path and threads the same descriptor through the registered Observer and Ground Glass subject factories. It does not modify scene publication configuration.

This work covers material appearance only. Its authoritative base now includes PR #352, which added a modeled rear elevation with window openings and joinery, a service door, and roof-deck/parapet continuity. Wave 2 adds no geometry; it applies the selected material family to the existing modeled surfaces. The front elevation remains more richly articulated than the rear and sides, so any remaining all-elevation refinement is separate geometry work.

## Geometry baseline and protected contracts

The current `origin/main` presentation includes PR #352's complete-building pass in addition to the segmented principal facade, world-aligned running-bond brick, front windows and surrounds, east service-return windows, stone base and joints, entrance, cornice, parapet, sidewalk, street details, focus chart, and fine-detail geometry. It now also has rear window openings and joinery, a service door, and roof-deck/parapet continuity. The earlier [screen-space audit](../architecture/architecture-rise-v2-visual-gap-screen-space-audit.md) predates PR #352 and is historical evidence for the former geometry baseline, not a description of the current rear elevation.

Canonical and seeded subjects have the same mounted capacity:

| Per subject | Canonical | Seeded |
| --- | ---: | ---: |
| Meshes / renderable meshes | 474 / 474 | 474 / 474 |
| Unique geometries | 63 | 63 |
| Unique materials | 17 | 17 |
| Unique textures | 18 | 18 |
| Triangles / effective triangles | 6,734 / 6,734 | 6,734 / 6,734 |

The current-main mounted-geometry signature is `280080d8806991845b56aaf2f2ea2ad5aba6b0407213bbcc29fdbf168e9f4da4`; canonical and seeded subjects match it. The canonical focus target remains `(0, 900, 8890) mm`; composition bounds remain fixed at building-top `(-900, 2920, 8500)–(900, 3730, 10500) mm` and main-body `(-1400, -1000, 8300)–(1400, 2600, 11500) mm`.

The existing physical-lens mounted-geometry suite passed: 111 of 111 samples visible in each of six camera states (666 rays total), with its intentional obstruction negative control detected. The procedural-detail suite also detected its separate obstruction negative control.

## Schema and deterministic resolver

`architecture-rise` advertises `{ enabled: true, schemaVersion: 1 }`. A seed resolves to an immutable, serializable scene material plan through the existing `SceneVariationDescriptor`; no second PRNG or global random state was added. The resolver has no React, Three.js object, camera, focus, or browser dependency.

The family is selected with the independent `materials / scene-style` substream. Supporting material roles use their own stable semantic substreams so adding a role does not reshuffle existing roles:

`scene-style`, `masonry-brick`, `masonry-mortar`, `stone-base`, `stone-joints`, `quiet-facade`, `window-trim`, `roof-surface`, `door-wood`, `sidewalk`, `pavement`, and `ground-plane`.

The 12 frozen browser seeds resolve as follows:

| Seed | Family | Seed | Family |
| ---: | --- | ---: | --- |
| 0 | Weathered brown brick | 1 | Weathered brown brick |
| 284719 | Traditional red brick | 4294967295 | Weathered brown brick |
| 3079748268 | Light clay brick | 654013979 | Light clay brick |
| 4041585854 | Weathered brown brick | 2762659077 | Traditional red brick |
| 2004402848 | Light clay brick | 1824298367 | Light clay brick |
| 2130322642 | Dark fired brick | 4065361417 | Dark fired brick |

Different seeds can share a family while still resolving deterministic role realizations. Reopening a fixed seeded URL reproduces the same material maps; the production-browser replay test also confirmed byte-identical Observer canvas output for seed `284719`.

## Material recipes and physical scale

The main facade and service return use four coordinated brick families: traditional red, weathered brown, light clay, and dark fired. Each family supplies a restrained brick palette, compatible mortar, quiet-facade tone, stone base, joints, trim, roof, door, sidewalk, pavement, and ground colors. The families use muted architectural colors; dark brick retains visible mortar and focus details.

The brick material accepts an optional appearance separate from its masonry geometry style. The existing seeded running-bond realization continues to use the fixed physical dimensions: 220 mm brick length, 68 mm brick height, 8 mm mortar joint, 8 pitches by 8 courses, and an 1824 × 608 mm periodic tile. Its existing approximately 2.4 mm texel spacing yields a 759 × 253 pixel tile. Brick, roughness, and normal maps retain the existing wrap and mipmap behavior.

Supporting roles reuse `createProceduralSurfaceMaterial()` with the existing `limestone` (base), `wood` (door), `cut-stone` (roof and trim), and `concrete` (sidewalk) patterns. Their repeat varies by at most 3%; role color channels vary by at most 3 RGB levels; roughness varies by at most 0.012; and normal strength varies by at most 0.008. Brick roughness is bounded around 0.91 and normal strength around 0.11. These bounded changes preserve stable material identity while making the selected families recognizable.

Glass and recess materials, reference objects and their markings, focus chart cells and bars, the focus crosshair, and fine-detail teaching geometry retain their canonical roles and colors.

## Canonical compatibility and material signatures

With no descriptor, the brick implementation follows its original palette, fixed style seed, texture dimensions, physical tile, color spaces, wrapping, filters, mipmaps, and UV interpretation. Guided Mode does not receive a variation descriptor; a seeded query on the Guided route is removed, and the route has no Scene Variation controls.

Canonical regression signatures remain:

- Mounted geometry SHA-256 on current `origin/main`: `280080d8806991845b56aaf2f2ea2ad5aba6b0407213bbcc29fdbf168e9f4da4`
- Canonical material snapshot SHA-256 on current `origin/main`: `eb7c64c6ce11ba1330fd533b6a16d6b68ad251e8b039fe0b91865ecf31ce71bc`
- Brick albedo bytes SHA-256 on current `origin/main`: `1640a923fda3bef2da1123a633e02ea4f4962e6e116e4bd821ddf81cd6d27fc4`
- Brick roughness bytes SHA-256: `12ec52ae47528dded4a86eaeddf6287acce3790de9c55ca7e9792339bbe9bc98`
- Brick normal bytes SHA-256: `a03c6cbb2779c57f1ad4f7f2c50a1d1cc2ddd367720c6d38ec9c6401eea00cb2`

The tests compare same-seed map bytes from independent material construction and verify distinct families resolve to different valid material snapshots. The canonical hashes above are the current-main values after PR #352; they remain unchanged by this branch. No shared procedural generator defaults or other scenes' seed contracts were changed.

## Observer, Ground Glass, and resource ownership

Observer and RTT receive the same descriptor and resolve matching material signatures. Each subject independently owns its materials and textures; meshes that share a role reuse that one role material within the subject. Subject disposal tests verify owned materials and maps are disposed once. The request wrapper is memoized by descriptor identity, so camera/focus rerenders with the same identity do not create another seeded subject.

Each mounted Architecture Rise subject has 17 materials and 18 texture objects. The five existing procedural-surface roles use three maps apiece; the brick role uses its albedo, roughness, and normal maps. Observer and RTT textures are separate owned instances by design. Ten consecutive Regenerate actions passed while Observer/RTT canvases, WebGL contexts, and RTT resource generation remained stable. Camera/focus/aperture changes in the browser qualification produced completed current-state RTT frames without changing the material identity.

Renderer texture memory was not used as a hardware performance benchmark. The evidence reports subject texture counts and stable renderer/RTT lifecycle; it does not claim measured GPU bytes or frame-rate performance.

## Browser visual qualification

Captures were taken from the production Vite preview using Chromium/WebGL2 at a 1440 × 1000 viewport and DPR 1, Standard render quality, fixed scene lighting, fixed front three-quarter Observer pose, and overlays disabled. Application surfaces are shown at their native 514-pixel display width. Contact sheets add captions and layout only; source captures were not retouched or resized.

### Canonical and representative material families

At normal Observer size, the red, brown, light-clay, and dark-fired families are perceptibly different. Seed `284719` remains close to the established red-brick identity, while the other representative families visibly shift the building palette. Seed `0` and seed `1` share the brown family as expected. Stone, trim, roof, and door colors remain coordinated; the family is not a set of independently randomized component colors.

![Guided canonical and representative seeded material families](evidence/architecture-rise-seeded-materials-wave2/observer-canonical-and-material-families.png)

![All 12 fixed Architecture Rise seed captures](evidence/architecture-rise-seeded-materials-wave2/observer-12-fixed-seeds.png)

### Existing east return and rear coverage

The east service-return capture shows the seeded masonry family continuing onto the existing side elevation and its modeled windows. The rear diagnostic shows the current main-branch rear wall, rear window assemblies, service door, and roofline, with the same selected material family. Those elements arrived in PR #352; Wave 2 changed their appearance only. The sheet documents existing material coverage, not a claim that every elevation has the same ornamental detail as the front.

![East service-return and rear diagnostic captures](evidence/architecture-rise-seeded-materials-wave2/observer-side-and-rear-coverage.png)

### Ground Glass and focus detail

For seeds `284719` (traditional red), `3079748268` (light clay), and `2130322642` (dark fired), normal f/11 Raw and Upright captures used focus `8890 mm`, Front Rise `0 mm`, and DOF bypass disabled. The building facade and focus chart are visible; the chart remains distinguishable against all three material families. Request IDs matched completed-frame IDs for every saved frame. The existing raster-orientation regression sampled the Architecture Rise raster and passed the Raw/Upright X/Y mapping checks.

The f/5.6 Raw and Front Rise 20 mm Raw frames are supporting views for seed `284719`, not replacements for the f/11 comparisons. At f/5.6, the existing photographic presentation is markedly brighter and visibly washed out, so that frame is not used to qualify material color. No lighting, exposure, optics, or shader changes were made to adjust it. Raw orientation is not Raw RTT DOF bypass: all saved qualification frames have DOF processing enabled and bypass disabled.

![Three-seed Ground Glass Raw and Upright comparisons, plus f/5.6 and Rise support views](evidence/architecture-rise-seeded-materials-wave2/ground-glass-three-seed-orientations.png)

The capture manifest records source-image hashes, seed/schema identity, focus and aperture settings, preview orientation, DOF bypass state, request/completion identity, renderer generation where available, and capture viewport.

## Regenerate and URL behavior

The root production Chromium suite passed 6/6 tests against a 1440 × 1000 viewport at DPR 1, including all 12 frozen seed captures, byte-identical replay for `284719`, east/rear views, camera-preserving Regenerate, ten successive Regenerate actions, three-family Ground Glass Raw/Upright at f/11 plus f/5.6 and Rise support views, and Guided Mode canonical behavior. The `/view-camera-simulator/` production suite passed 1/1 test for seeded URL, Share URL, Regenerate, and browser history. Regenerate changed the seed while preserving the measured Focus, Aperture, Rise, Observer camera position/orbit target, Ground Glass orientation, and live canvas/context identities. Ten successive Regenerate actions completed without replacing the renderer or RTT render-target generation.

## Validation and verdict

Validation passed locally: `npm test -- --maxWorkers=4` (346 files, 4,257 tests), `npm run typecheck`, `npm run lint`, `npm run check:css`, and `npm run build`. The Architecture Rise mounted-geometry suite retained 111/111 visible samples in each of six camera states (666 rays total) and detected its obstruction negative control. Focused material, detail, and subject-registry tests passed 52/52; the production Chromium root suite passed 6/6, the `/view-camera-simulator/` suite passed 1/1, and the Raw/Upright orientation regression passed 2/2. The current-main Still-Life Studio publication switch remains unchanged; its stale catalog-test assertion was aligned with the existing false production flag and true qualification-mode override. Remote CI is reported in the PR handoff.

**Technical qualification: PASS** — local regression and browser checks establish deterministic materials, unchanged geometry/teaching targets, canonical compatibility, and stable subject lifecycle. Final remote CI status is reported separately in the PR handoff.

**Visual qualification: IMPROVED** — representative families are recognizable at ordinary Observer size and remain inspectable through normal f/11 Ground Glass views. Material differences are restrained within any one family; not every seed is intended to look unique.

**Manual user acceptance: PENDING_USER_REVIEW** — automated checks and implementer inspection do not substitute for review of the linked captures.

## Known limitation and recommended follow-up

Architecture Rise still has richer front-facade articulation than rear/side detail. PR #352 has already added rear openings and joinery, a service door, and roof-deck/parapet continuity. Any follow-up should first review the current 360-degree coverage and focus on remaining elevation articulation, side-wall transitions, and corner masonry rather than reimplementing those existing elements. Preserve focus-chart visibility and mounted-geometry contracts.

Wave 2 does not add to or complete the geometry delivered by PR #352 and should not be described as doing so.
