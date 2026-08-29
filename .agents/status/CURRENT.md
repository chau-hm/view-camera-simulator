# PR 9B — Conceptual View Camera v2 static anatomy

- Objective: replace the primitive visible camera meshes with one reusable semantic camera model for static teaching anatomy; do not add Lesson 0 or new movement exposure.
- Base: `origin/main` at `4c588e9fbed71d038e7af4464665bf11ab4b488b`, which includes merged PR #109.
- Scope: shared `ConceptualViewCamera` anatomy for lens, lens board, front standard, static accordion bellows, rear standard, ground-glass back, and support; current and ghost variants use the same renderer path.
- Transform decision: ordinary scenes consume resolved world-space `DerivedOpticsState`; the calibrated body-pitch scene retains the existing local geometry → body pitch → rig placement hierarchy through a thin `CameraBodyAssembly` adapter. No optics/model state was added.
- Semantic IDs: stable `camera-anatomy-*` object names and `userData.anatomyPart` values cover all seven future Lesson 0 parts.
- Bellows decision: nine procedural, tapered rectangular static folds span canonical film and lens centres. No compound/deformable bellows interpolation is implemented.
- Compatibility: existing rail names and calibrated rail geometry remain available; Mirror Shift's specialized reflection/teaching implementation remains untouched; no public Rear Shift/Rear Swing or Lesson 0 controls were added.
- Validation: final `npm run ci:local` passed (147 files / 1,420 tests, CSS check, lint, typecheck, and build); focused anatomy/renderer tests pass; camera inspection E2E passed 5/5. The requested Mirror Shift, Understanding Camera Movements, and Ground Glass smoke run passed 9/10, with the route-transition `data-rtt-focal-length-mm` assertion remaining a confirmed pre-existing failure on untouched `origin/main`.
- PR 9C note: the shared anatomy boundary and canonical placement adapters are ready for deformable bellows and standard animation without another camera-geometry rewrite, subject to keeping animation state derived from canonical optics/frame data.
