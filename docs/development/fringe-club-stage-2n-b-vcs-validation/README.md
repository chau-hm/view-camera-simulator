# Fringe Club Stage 2N-B — VCS Runtime A/B Validation

**Global verdict: `READY_STAGE_2O_RUNTIME_OPTIMIZATION`**

**Runtime cost: `VCS_RUNTIME_COST_WATCH`**

**Ground Glass: `GG_DETAIL_VALIDATED_WITH_WATCH_ITEMS`**
**Lifecycle: `LIFECYCLE_PASS`**

Stage 2N-A renders through the real VCS Observer and `GroundGlassRTT`, its source/instance lifecycle remains sound, and the added Wyndham and Lower Albert detail is visible. Its per-renderer cost rises substantially, especially in RTT. Continue to Stage 2O for a bounded cost-attribution/optimization experiment before considering promotion. **No promotion occurred in this stage.**

## Scope, authority, and provenance

- Branch: `feature/fringe-club-stage-2n-b-vcs-validation`
- Worktree base: `origin/main` at `635fd868063759e61c284046d0bac0515ee82632`
- Stage 2J prerequisite `df7ea654cf064dd3346500a07c73b4b2fb3cef91` is an ancestor of the base.
- Stage 2H remains `CURRENT_RUNTIME_AUTHORITY`, SHA-256 `1f15e04fa6161e327d6f4f89f9b011f3b8f41bcf305e7ee2e3a1a127fef93b8e`.
- Stage 2N-A remains `CANDIDATE_RUNTIME_AUTHORITY`, SHA-256 `7a505f6c2d25ecb93943a6770356cdaffa529c3b86324a4da9ee819984eb9301`.
- VCS candidate: [`stage-2n-a-candidate.glb`](../../../public/assets/generated/fringe-club/development/stage-2n-a-candidate.glb); the imported bytes match the requested digest. The copied manifest records metres, +Y up, identity root transform, self-contained packaging, zero embedded cameras/lights, 61 meshes, 91 nodes, 91,914 triangles, 17 materials, 14 textures, and 49 transmissive glass primitives.
- The Stage 2H GLB and provenance were not modified. Stage 2N-A was not optimized, compressed, or edited in VCS.
- No public scene, scene/task registration, lesson, optics change, material redesign, or candidate promotion was added.

## Implementation and production reachability

The development fixture extends the Stage 2I/J source loader, source owner, registered instance leases, Observer subject, and actual RTT path. It adds a typed `stage2h | stage2n-a` selector, defaulting to Stage 2H; renderer modes; deterministic focus and join probes; bounded ±40 mm subject-relative movement; source/instance/renderer diagnostics; and candidate-scoped RTT identities. Observer and RTT use one prepared candidate source and distinct instance roots.

Normal Architecture Rise startup made zero Fringe candidate requests in the browser check. Development routes are registered only under `import.meta.env.DEV`. The production build completed, the Stage 2N-A development asset directory is absent from `dist`, and no Fringe entry was added to the public catalog or task registry.

Candidate metadata tests verify the exact GLB digest and manifest facts, embedded buffers/images, and the absence of cameras and punctual lights. Runtime URLs use the repository’s base-path-safe `publicAssetUrl` helper.

## Controlled runtime method and environment

The real Observer renderer and `GroundGlassRTT` use Architecture Rise reference optics: 150 mm, f/11, standard render quality, and raw RTT orientation. Each H/N comparison holds its probe camera/target/focal length, subject alignment, aperture/focus, renderer mode, viewport, DPR, lighting, exposure/tone mapping, and anisotropy constant. `DEVELOPMENT_PROBE_ONLY` positions are diagnostic alignment probes, not Fringe camera calibration or lesson targets. The vent/louver close probe uses 70 mm while its wide transom comparison uses 35 mm; H and N receive the same state for each probe.

Test host: macOS/Darwin arm64, Apple M4 Pro. Chromium 149.0.7827.55; page UA reports Windows 10; DPR 1; viewport 1280×720; WebGL 2; Three.js 186. The measured WebGL device was ANGLE/Vulkan SwiftShader, so these numbers describe a software renderer, not the M4 GPU. Maximum anisotropy was 16 and applied anisotropy was 4 for both candidates. Renderer sizes were compared within the same mode; mode changes can alter panel dimensions. No FPS or portable hardware-performance claim is made.

`renderer.info.memory.textures` is a texture **count**, not MiB or a GPU-memory measurement. Observer and RTT statistics are for separate renderer contexts and are never added into one opaque application total. Submitted triangle counts may include transmission, shadows, and other passes, so they are not source-GLB triangle counts.

## Warm combined and isolated mode measurements

Each row is a warm steady-state sample. A zero row means that renderer was inactive in that mode.

| Candidate / mode | Observer calls / triangles / geometries / textures | Ground Glass RTT calls / triangles / geometries / textures |
|---|---:|---:|
| Stage 2H — Observer only | 55 / 45,418 / 32 / 11 | 0 / 0 / 0 / 0 |
| Stage 2H — Ground Glass only | 0 / 0 / 0 / 0 | 75 / 52,371 / 29 / 17 |
| Stage 2H — combined | 55 / 45,418 / 32 / 11 | 75 / 52,371 / 32 / 20 |
| Stage 2N-A — Observer only | 103 / 197,200 / 61 / 18 | 0 / 0 / 0 / 0 |
| Stage 2N-A — Ground Glass only | 0 / 0 / 0 / 0 | 140 / 241,384 / 46 / 24 |
| Stage 2N-A — combined | 95 / 196,360 / 61 / 18 | 140 / 241,384 / 59 / 27 |

Combined-mode deltas, measured per renderer:

- Observer: calls `+40` (55 → 95); submitted triangles `+150,942` (45,418 → 196,360); geometries `+29`; textures `+7`.
- RTT: calls `+65` (75 → 140); submitted triangles `+189,013` (52,371 → 241,384); geometries `+27`; textures `+7`.
- No combined renderer sum is reported. The N-A render-path delta is materially larger in RTT; the available counters do not isolate the portion attributable to transmission versus added geometry and other passes.

### Fixed-probe call and triangle comparison

Each cell is `Stage 2H → Stage 2N-A (delta)`. These are actual VCS render counters for the named probe; they are not asset counts.

| Probe | Observer calls | Observer triangles | RTT calls | RTT triangles |
|---|---:|---:|---:|---:|
| Wyndham rectangular sash pair | 72 → 118 (+46) | 51,769 → 190,270 (+138,501) | 80 → 128 (+48) | 54,367 → 204,532 (+150,165) |
| Wyndham segmental window | 55 → 95 (+40) | 45,418 → 196,360 (+150,942) | 75 → 140 (+65) | 52,371 → 241,384 (+189,013) |
| Wyndham main transom | 27 → 138 (+111) | 24,272 → 229,004 (+204,732) | 33 → 132 (+99) | 24,294 → 234,414 (+210,120) |
| Wyndham vent/louver close view | 25 → 120 (+95) | 23,276 → 202,924 (+179,648) | 33 → 132 (+99) | 24,294 → 234,414 (+210,120) |
| Wyndham frieze | 49 → 78 (+29) | 42,146 → 180,400 (+138,254) | 73 → 137 (+64) | 51,227 → 250,796 (+199,569) |
| Lower Albert timber window | 46 → 187 (+141) | 36,106 → 266,242 (+230,136) | 40 → 101 (+61) | 28,849 → 235,056 (+206,207) |
| Lower Albert light louver door | 40 → 106 (+66) | 31,226 → 206,786 (+175,560) | 40 → 87 (+47) | 28,849 → 207,940 (+179,091) |
| Lower Albert dark louver door | 37 → 100 (+63) | 29,795 → 211,322 (+181,527) | 39 → 70 (+31) | 29,057 → 158,908 (+129,851) |
| Entrance timber window | 26 → 124 (+98) | 23,288 → 222,752 (+199,464) | 32 → 108 (+76) | 24,282 → 220,822 (+196,540) |
| Entrance paired glazed entry | 26 → 98 (+72) | 23,288 → 206,580 (+183,292) | 31 → 85 (+54) | 24,270 → 218,190 (+193,920) |
| Wyndham window/frame seam | 55 → 95 (+40) | 45,418 → 196,360 (+150,942) | 75 → 140 (+65) | 52,371 → 241,384 (+189,013) |

Points and lines were zero in the six mode samples. The full per-sample counters, sanity keys, root IDs, and browser measurements are in [`fringe-club-stage-2n-b-runtime-measurements.json`](evidence/fringe-club-stage-2n-b-runtime-measurements.json).

### Source resources and timing

| Measure | Stage 2H | Stage 2N-A |
|---|---:|---:|
| Source-owner geometries / materials / Three.js texture objects / image backings | 32 / 15 / 7 / 7 | 61 / 17 / 16 / 14 |
| First measured source fetch | 41.5 ms | 31.5 ms |
| First measured parse | 28.0 ms | 35.7 ms |
| First measured source-ready total | 70.6 ms | 68.3 ms |
| First combined Observer+RTT content | 6,522 ms for initial H attach | 13,830 ms from first H→N-A selection to content |

The Stage 2N-A manifest lists 14 textures; the runtime source-owner audit counts 16 Three.js texture objects and 14 image backings. Those counters describe parsed runtime objects and embedded image backings, not a measured GPU byte total. Stage 2N-A’s manifest reports 91,914 source triangles versus Stage 2H’s 20,203; VCS-submitted triangles are larger because of render passes.

Further candidate switching observations: N-A→H content `10,384 ms`; H→N-A content `13,451 ms`. Source fetch/parse timings were small relative to canvas/RTT readiness in this software-WebGL run. Initial attach and switch timings are observations, not pass/fail timing thresholds.

## Ground Glass cue review

The panels compare Stage 2H Observer, Stage 2H RTT, Stage 2N-A Observer, and Stage 2N-A RTT pixels with identical state. No overlays cover the captured image content. Stage 2N-A classifications:

| Family | Classification | VCS RTT observation |
|---|---|---|
| `WINDOW_WY_RECT_PAIR` | `GG_PASS` | Repeated sash/window rhythm and added edge relief remain usable; the finest muntins are subdued. |
| `WINDOW_WY_SEGMENTAL` | `GG_PASS` | The segmental heads and main frame contours remain clear. |
| `WINDOW_WY_MAIN_TRANSOM` | `GG_PASS_WITH_FINE_DETAIL_LOSS` | Main rails/transom structure survives; smallest divisions lose contrast. |
| `WINDOW_LA_TIMBER` | `GG_PASS_WITH_FINE_DETAIL_LOSS` | Window cadence and larger frame edges remain discernible; fine subdivisions are muted. |
| `WINDOW_EN_TIMBER` | `GG_WATCH` | The entrance view carries facade/window silhouettes, but timber-frame contrast is weak in RTT. |
| `DOOR_LA_LOUVER_LIGHT` | `GG_PASS` | The grille/blade structure gives a clear repeated-line cue. |
| `DOOR_LA_LOUVER_DARK` | `GG_PASS_WITH_FINE_DETAIL_LOSS` | Dark blade structure is visible but low contrast. |
| `VENT_WY_LOUVER` | `GG_PASS_WITH_FINE_DETAIL_LOSS` | The 70 mm close view exposes the louver field; the thinnest lines remain subdued. |
| `FRIEZE_WY_PANEL` | `GG_WATCH` | Main bands/relief survive. Nested micro-motifs are subdued, without dominant moiré in the captured view. |

Overall `GG_DETAIL_VALIDATED_WITH_WATCH_ITEMS`. No family was classified `GG_FAIL`. Observed blur/downsampling is not treated as export loss; optics, aperture, blur calibration, and RTT sampling were not changed to showcase the candidate. Wyndham and Lower Albert show the clearest useful detail gain over H; Entrance remains a watch item.

Comparison panels: [`evidence/`](evidence/), including Wyndham, Lower Albert, Entrance, frieze, and window/frame captures. The paired entry is an additional visual comparison, not one of the nine classified families.

## Lifecycle, switching, and seams

- One selected candidate source owner feeds two distinct instance roots/leases when both renderers are active. Observer and RTT report the same source ID for a candidate and different root IDs.
- H→N-A→H→N-A switching completed. Candidate source IDs and Observer roots changed with selection; the selected candidate ended contentful. Delayed stale-fetch switching aborted the stale request and only the final H/N-A selection attached. Unit coverage disposes a parsed stale result after a newer generation wins.
- Observer-only and RTT-only modes both produced current-candidate content. A dedicated browser test removed Observer while RTT stayed contentful on the same source/root, remounted Observer with a fresh root, then removed RTT while Observer kept sampling and remounted RTT with a new root/generation.
- RTT off cleared candidate/root/contentful diagnostics; re-enabling RTT required a fresh sanity identity/generation. Probe, motion, candidate, and subject identity were present in RTT diagnostics.
- Final N-A release returned source geometry/material/texture/image-backing and instance-lease counters to zero. Observer geometry count returned to its fixture baseline. The Observer texture counter started at 2, settled at 4 after the first transmission render/release, and remained 4 after a second load/release cycle. This is a stable `+2` renderer texture-count overhang in this software renderer, separate from source-owned textures; its renderer-internal cause was not isolated. Texture count is not memory.
- The development fixture’s initial React Strict Mode mount may start and cancel one loader effect; the browser lifecycle run recorded one cancelled request and one completed parse/source, not duplicate Observer/RTT parses. There was one active owner and two instance leases at steady combined render.
- Stage 2H activation-gated lifecycle passed, including release and client-side navigation. The ordinary Architecture Rise route fetched neither H nor N-A.

The copied GLB retains Stage 2N-A’s deliberate nominal 0.5 mm join separation by exact-byte identity. VCS did not measure that distance from pixels. Four representative N-A joins were checked at center and ±40 mm lateral/near/far offsets. All 20 motion states had current, contentful RTT output and fresh generation/key identity. Human review found no visible seam popping, z-fighting, bright leak, or high-contrast gap in the readable Wyndham window and sill strips. Lower Albert and Entrance Observer strips are very dark, which limits the visual conclusion for those views; the RTT strips remained renderable and showed no clear popping/leak, but are recorded as lower-confidence checks. These are discrete visual samples, not high-speed flicker capture or metrology.

Motion strips and the 20-state machine-readable record are in [`fringe-club-stage-2n-b-motion-measurements.json`](evidence/fringe-club-stage-2n-b-motion-measurements.json) and the corresponding `*-motion-stage-2n-a.png` files in [`evidence/`](evidence/).

Transmission/glazing rendered without browser/WebGL errors through Observer and RTT. N-A contains 49 transmissive primitives. Its RTT sample rose by 65 calls and 189,013 submitted triangles over H in the matched segmental combined probe. The counters do not attribute those increments to glass alone; Stage 2O should isolate transmission-pass cost before changing any material or asset.

## Validation

Passed:

- `npm run ci:local` — CSS structure, repository lint, typecheck, 236 unit/integration files (2,202 tests), and production build.
- Focused lifecycle/cancellation/navigation Playwright selection — 3 passed (57.5 s).
- Full Stage 2H vs Stage 2N-A VCS mode/probe/switching scenario — 1 passed (11.2 min), all six modes and 11 focus probes.
- N-A four-join bounded-motion scenario — 1 passed (12.0 min), 20 center/offset states.
- N-A independent Observer/RTT disposal/remount and repeated resource cycle — 1 passed (1.1 min).
- `git diff --check` and the production candidate-directory check passed.

Known repository E2E failure:

- `npm run ci:local:e2e` passed CSS, lint, typecheck, all 2,202 unit/integration tests, and build, then stopped at `architecture-foreground-compound.spec.ts` because the expected “Complete the Photograph” heading was absent.
- The same test failed with the same heading error from a clean archive of `origin/main` at base `635fd868063759e61c284046d0bac0515ee82632`.
- A skip-run reached two passes, five failures, then was stopped; the five failing Architecture + Foreground E2E titles were reproduced with the same errors on that clean base. 160 tests in that broad run did not execute. The VCS-specific E2E scenarios above passed.

## Stage 2O recommendation

Proceed to a bounded runtime-cost experiment, not promotion. The measured issue is per-renderer N-A submission growth: in combined mode Observer was `+40` calls / `+150,942` triangles and RTT was `+65` calls / `+189,013` triangles; RTT-only was 140 calls / 241,384 triangles versus H’s 75 / 52,371. N-A also carries 49 transmissive primitives. First add or use pass-level attribution to separate transmission work from added geometry, shadows, and scene passes; then test one bounded N-A experiment if that data supports it. Keep the GLB, optics, and glass design unchanged during attribution. Revisit the low-contrast Entrance/Lower Albert seam views before any promotion decision.

Evidence directory: [`evidence/`](evidence/). Runtime counters: [`fringe-club-stage-2n-b-runtime-measurements.json`](evidence/fringe-club-stage-2n-b-runtime-measurements.json). Lifecycle checks and visual classifications are documented above; no separate duplicate report tree was created.
