# PR10D — Oblique Tabletop Compound Teaching Geometry

- Branch/base: `feature/oblique-tabletop-teaching-geometry` from `origin/main` at `76010a2d96b11234a9044599ee0f94c83e80aa98`.
- Objective: explain the accepted PR10C compound Tilt + Swing solution through live side, top, and Scheimpflug views; guided tasks and aperture teaching remain deferred.
- Canonical sources: `tabletopTopSurfacePlane` and canonical tabletop extent traces; film, lens, focus, optical-axis, and Scheimpflug construction geometry come from the live `DerivedOpticsState`. No optical calibration or scene geometry changed.
- Views: side projects the canonical near↔far tabletop trace and current one focus plane; top projects the left↔right trace and the same focus plane; the 3D Scheimpflug overlay reuses the existing finite film/lens/focus planes and common line while the static tabletop remains the subject.
- Single-plane contract: `deriveObliqueTabletopTeachingGeometry` keeps one `focusPlane` reference and derives the construction from the same live film/lens/focus planes. No separate Tilt or Swing focus planes are introduced.
- Anchor semantics: analytical RTT sample nodes now identify `analyticalCoverageSampleId` / `canonical-tabletop-surface`; visible markers use `markerId` / visible-anchor metadata, so analytical nodes cannot masquerade as public focus targets.
- Public verification state: Tilt `-8.0°`, Swing `-1.7°`, Focus `2450 mm`, fixed f/11; live neutral, Tilt-only, Swing-only, and compound feedback copy is present in English and zh-HK.
- Feedback semantics: movement-presence states now use direction-neutral relationship language; reachable opposite-sign Tilt/Swing and wrong-sign compound feedback are covered by regression tests.
- Validation: focused teaching/geometry/scene/optics/copy suites passed; full `npm test` passed (160 files, 1,545 tests); typecheck, lint, CSS structure, build, diff check, and focused Chromium smoke passed. Chromium smoke covered side/top updates, reachable opposite-sign Tilt feedback, public Tilt/Swing controls, Scheimpflug overlay, Ground Glass, and SPA scene switching.
- Not run: full `npm run ci:local:e2e`; shared renderer/projection lifecycle was not changed and the focused Chromium smoke covers the new public path.
- Remaining: PR10E guided lesson and final aperture step; no lesson completion state or teaching-geometry overlays beyond this slice.
