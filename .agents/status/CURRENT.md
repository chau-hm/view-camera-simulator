# Simulator Shared Visual Skin

- Objective: apply a shared, simulator-scoped dark technical instrument-panel skin while preserving layout, renderer output, scene semantics, routes, and simulator behavior.
- Base: `origin/main` at `aa8910011d57df95b1fb5788f4aa4de0f30269ef` (PR #138 merge `aa89100`). Worktree: `/Users/homan/repo/view-camera-simulator-visual-skin`; branch: `feature/simulator-shared-visual-skin`.

## Since previous review

- P2-A: split generic button hover and keyboard-focus treatments so focus no longer replaces semantic primary/selected backgrounds; Chromium computed focused Continue/selected controls retain cyan `rgb(143, 234, 255)`, dark text, and a 2px cyan outline.
- P2-B: scoped `.simulator-shell` compatibility aliases map `--text` and `--text-muted` to the simulator palette; guided previous/current/upcoming labels, Anatomy label/progress/cue, and other learner-facing muted consumers were checked. No affected consumer resolves to legacy `rgb(100, 116, 139)`; previous-stage opacity remains `0.8` and contrast-safe.
- P2-C: Geometry depth-strip captions use the semantic `geometry-viewport__depth-caption` class; the serialized inline-style selector and inline dark caption colors were removed while caption content and geometry behavior remain unchanged.
- Keyboard/computed-style QA passed at 1288×904; Geometry expansion → Escape restored focus to its trigger. Focused tests passed (7 files / 83 tests), Lesson 0 Chromium flow passed, viewport expansion/focus restoration E2E passed, and `npm run ci:local` passed (167 files / 1,634 tests, lint, type-check, build).
- Renderer, optics, scene definitions, routes, simulator layout, and catalog/marketing surfaces remain outside this correction.
- Tokens: compact `--sim-*` layer on `.simulator-shell` for deep navy background, graphite surfaces, cool borders, ivory/muted text, cyan accent, semantic success/warning/danger, 10px panels, and 6px controls. Existing spacing/layout contracts remain in place.
- Treatments: dark shell/header/body/aside and cards; restrained borders/shadows; cyan active buttons/sliders/focus progress; dark selects/inputs/radios/checkboxes; clear disabled/locked states; readable task/feedback, guided progress, readouts, debug, calibration, and geometry chrome. Renderer canvases and canonical SVG geometry remain unchanged.
- QA surfaces: free `architecture-rise`, `understanding-camera-movements`, `table-tilt`, `oblique-tabletop`, `focus-fundamentals-two-targets`, `mirror-shift`; guided architecture-rise and Mirror Shift; Lesson 0 anatomy; calibration route; scene, Ground Glass, and Geometry expansion with Escape/focus restoration. Chromium checks at 1440×900, 1288×904, 1024×800, and 390×844 show no horizontal overflow or page/console errors.
- Accessibility: native controls and details/summary semantics preserved; simulator-scoped visible focus rings, accent contrast, and explicit disabled/locked styling retained.
- Validation: focused integration/unit set `8 files / 111 tests` passed; focused Chromium E2E for viewport expansion, camera controls, calibration, Ground Glass zoom/reset, Lesson 0, and Mirror Shift passed; CSS structure and `git diff --check` passed; `npm run ci:local` passed (`167` test files / `1634` tests, lint, type-check, build).
- Unchanged boundaries: no ImageGen/assets, renderer/Three.js, optics, canonical scene definitions, catalog/marketing CSS, copy/i18n, routes, or layout architecture changes.
