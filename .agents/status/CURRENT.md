# PR 11B — Fundamentals + Three Ways to Visualize

- Objective: add the static conceptual-learning slice immediately below the PR 11A Hero, with E1 Fundamentals and E2 Three Ways to Visualize in English and zh-HK.
- Base at branch creation: `origin/main` `76010a2d96b11234a9044599ee0f94c83e80aa98`; PR 11A merge `6971b0a9f1cdcdff033cba6431f351d5345a9f5d` is an ancestor. `origin/main` subsequently advanced concurrently to `abe81a2fcc812ec516215dad4bc884df7114de5e` through unrelated simulator commits.
- Worktree/branch: `/Users/homan/repo/view-camera-landing-fundamentals` / `feature/landing-redesign-fundamentals`; clean dedicated worktree, no upstream tracking.
- Component structure: `LandingFundamentalsSection` and `LandingVisualizationSection` own semantic H2 sections and local card data; shared `LandingConceptCard` renders only image, title, and description. `HomePage` keeps the existing legacy informational block after both sections.
- ImageGen assets: seven independently generated built-in ImageGen source renders, finalized as 4:3 WebP assets under `public/assets/landing/`; no mockup crops, composite sheet, placeholders, SVG, CSS drawing, or simulator captures.
  - `fundamentals-perspective-control.webp` — 1448×1086, 140834 bytes.
  - `fundamentals-focus-plane.webp` — 1448×1086, 94802 bytes.
  - `fundamentals-ground-glass.webp` — 1448×1086, 102270 bytes.
  - `fundamentals-optical-geometry.webp` — 1448×1086, 74596 bytes.
  - `visualize-3d-scene.webp` — 1448×1086, 87352 bytes.
  - `visualize-ground-glass.webp` — 1448×1086, 110834 bytes.
  - `visualize-geometry.webp` — 1448×1086, 63794 bytes.
- i18n: added semantic `home.fundamentals.*` and `home.visualize.*` message trees to English and zh-HK; all learner-facing Part E copy is translated through i18next.
- Responsive decisions: E1 uses four columns at desktop, two columns through tablet, and one column on mobile; E2 uses three columns at desktop/1024, two at 768, and one at mobile. Cards preserve 4:3 artwork with intrinsic dimensions, lazy loading, and no controls or links.
- Validation: focused landing integration tests pass (8/8); full Vitest suite passes (159 files, 1540 tests); bundled-runtime typecheck, lint, CSS structure check, production Vite build, and `git diff --check` pass.
- Browser evidence: focused Chromium landing E2E passes all 7 tests, including Hero CTA/H1 preservation, keyboard behavior, 1440×900, 1024×800, 768×900, 390×844 grid/overflow checks, and zh-HK headings. Manual loaded-image screenshots were inspected for desktop, tablet, and mobile layouts.
- Deferred: Part F / Why It Matters redesign, final CTA, motion/scroll reveal/parallax, Scene Gallery, simulator mini-demos, and new simulator functionality.
