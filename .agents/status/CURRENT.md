# PR 11B — Review correction: Geometry View consistency

- Objective: update PR #126 onto the latest `origin/main` and correct only the Geometry View artwork so the three visualization cards communicate one shared camera/subject state.
- Branch/worktree: `feature/landing-redesign-fundamentals` / `/Users/homan/repo/view-camera-landing-fundamentals`; correction is being applied to existing PR #126, with no new branch or PR.
- Base/update: original branch base `76010a2d96b11234a9044599ee0f94c83e80aa98`; merged latest `origin/main` `abe81a2fcc812ec516215dad4bc884df7114de5e`; PR 11A merge `6971b0a9f1cdcdff033cba6431f351d5345a9f5d` remains an ancestor.
- Since previous review: merged `origin/main` normally in `f30de7e12e2b9f81e733ddcb5adcfc1a195102c7`; the only conflict was this shared status file. Landing source files merged without conflicts, and the simulator changes from main were retained unchanged.
- Landing preservation: `HomePage` still renders Hero → Fundamentals → Three Ways to Visualize, with the existing informational block after Part E. The fetched `origin/main` does not contain later Why It Matters or Final CTA components, so neither out-of-scope section was invented or restored here.
- Geometry View correction: regenerated only `public/assets/landing/visualize-geometry.webp` with built-in ImageGen, using the two sibling assets as references. The corrected image contains the same single cube, sphere, and cone arrangement, camera/lens, mapped rays, and image plane; the other six Part E assets are unchanged.
- Asset: `visualize-geometry.webp` is 1448×1086, 4:3, 95148 bytes after WebP encoding.
- i18n/responsive/code: no copy, component, layout, or simulator changes in this correction pass.
- Validation: final-head focused landing/i18n integration tests pass (8/8); repository `ci:local` passes CSS structure, lint, typecheck, full Vitest (161 files, 1553 tests), and production build; focused Chromium home E2E passes (7/7); runtime screenshots at 1440×900 and 390×844 show the corrected asset in its card crop with zero horizontal overflow; `git diff --check` passes.
- Deferred: Part F / Why It Matters, final CTA, motion/scroll reveal/parallax, Scene Gallery, simulator mini-demos, and new simulator functionality.
