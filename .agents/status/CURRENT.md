# PR 9D — Ground Glass, Film Holder + Aperture Iris

- Objective: add rear-back anatomy and a visible canonical-aperture iris to the shared `ConceptualViewCamera`; no Lesson 0, new state, controls, optics, RTT, or bellows redesign.
- Base: `origin/main` at `f173a39ff7b662e903bb4efde018a175d4f54d06`, merged PR #111.
- Rear-back contract: `GroundGlassBack` and `FilmHolder` are mutually exclusive render variants under the existing `rear-standard-frame`; both sensitive surfaces use local `{ x: 0, y: 0, z: 0 }`, the canonical rear/film plane. Holder shell/frame geometry extends rearward.
- Aperture contract: `resolveConceptualApertureOpening` derives a bounded visual opening from canonical focal length / f-number; `lens-aperture-iris` remains a child of the canonical front lens hierarchy.
- Semantic reuse: existing `ground-glass-back` remains stable; `ground-glass-frame`, `ground-glass-screen`, `film-holder`, `film-holder-body`, `film-holder-film-surface`, and `lens-aperture-iris` provide stable anatomy names. Current/ghost and world/rig-local paths share the same implementation.
- Compatibility: standards, deformable bellows, fixed support, canonical optics, and Ground Glass RTT remain unchanged; no learner-facing rear-back switch is exposed.
- Validation: `npm run ci:local` passes (149 test files / 1,450 tests, CSS check, lint, typecheck, and build); focused anatomy/camera-body tests pass (29 tests); targeted Chromium smoke coverage passes 45/47, with only the pre-existing scene-orbit assertion and Understanding Camera Movements route-transition RTT race. Camera-focused screenshots show the rear screen/frame and hollow bellows; aperture UI changes were exercised at f/5.6 and f/32.
