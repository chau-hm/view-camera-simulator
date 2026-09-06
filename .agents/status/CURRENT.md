# PR 11D — Final CTA + Static Landing Integration

- Objective: complete the static Home flow with a final cinematic CTA after Why It Matters; include the bounded Part E eyebrow shrink-wrap correction.
- Base: latest `origin/main` `6575fa7390b580842d4be2eeae371847f055ab5b`, containing the PR 11C merge.
- Branch/worktree: `feature/landing-redesign-final-cta` / `/Users/homan/repo/view-camera-landing-final-cta`.
- Landing flow: `LandingHero` → `LandingFundamentalsSection` → `LandingVisualizationSection` → `LandingWhyItMattersSection` → `LandingFinalCtaSection`; no Scene Gallery or content after the CTA before the shared footer.
- Components: added local `LandingFinalCtaSection`; Home orchestration and all prior Hero, Part E, and Why markup remain otherwise unchanged.
- ImageGen asset: independently generated and inspected `public/assets/landing/final-cta.webp` — 1962×802, 86,872 bytes, WebP VP8. Rear three-quarter photographer and coherent view camera are right-weighted; left side is a dark text-safe field with a restrained warm-reality/cool-optical transition; no text, UI, logos, or obvious anatomy/camera defects.
- i18n: added `home.finalCta.title`, `home.finalCta.description`, and `home.finalCta.action` in English and zh-HK; locale resolution is unchanged.
- Part E micro-fix: `.site-shell .landing-learning-section__eyebrow` now uses `width: fit-content` and centered auto margins; typography/color and the 18px desktop spacing remain unchanged, with no DevTools-overlay workaround.
- Responsive/accessibility: CTA is a full-width static 420–520px desktop band and 520px mobile band, uses a reserved lazy 1962×802 image with empty alt text, one H2, and exactly one `/scenes` link. Exactly one page H1 remains.
- Browser evidence: direct Chromium inspection at 1440×900, 1288×904, 1024×800, 768×900, 390×844 English, and 390×844 zh-HK. CTA remained readable, camera/photographer stayed visible, and overflow was zero. At 1288×904 the first Part E eyebrow measured 241.36px inside the 780px header, centered with 18px bottom margin.
- Validation: focused Home/i18n integration tests passed (10 tests); focused Home/marketing Chromium E2E passed (11/11); `ci:local` passed CSS structure, lint, typecheck, all Vitest (164 files, 1,596 tests), and production build; `git diff --check` passed.
- Deferred: PR 11E — Motion + Accessibility Polish.
