# PR 11D.1 — Static Landing Polish

- Objective: improve static landing eyebrow readability, tighten the Three Ways → Why It Matters boundary, and correct the Final CTA camera orientation.
- Since previous review: eyebrow typography was still judged too small at `0.86rem` / `0.78rem`; both landing eyebrow selectors now use `0.95rem` desktop / `0.875rem` mobile. Section spacing and `final-cta.webp` were intentionally left unchanged; browser verification was performed at 1288×904 and 390×844 in zh-HK.
- Base: latest `origin/main` `0ad4ad75a998c329dab771aa19803f83ddd48ebf`, containing PR #133 / PR 11D.
- Branch/worktree: `fix/landing-static-polish` / `/Users/homan/repo/view-camera-landing-static-polish`; the merged PR 11D branch was not reused.
- CSS typography: `.landing-learning-section__eyebrow` and `.landing-why-section__eyebrow` are now `0.95rem` desktop and `0.875rem` mobile. Existing cyan treatment, tracking, centered `width: fit-content`, and mobile/desktop margins remain intact; the Hero eyebrow is unchanged.
- Section rhythm: reduced only the Part E bottom and Why top boundary padding. Runtime E → Why-eyebrow separation measured 136px at 1440, 128.78px at 1288, 102.38px at 1024, 96px at 768, and 88px at 390; E1 ↔ E2 spacing and other section padding remain unchanged.
- ImageGen: regenerated and inspected only `public/assets/landing/final-cta.webp` — 1959×803, 89,746 bytes, WebP VP8. The photographer is at the rear standard; the bellows run forward to one front lens pointing outward toward the landscape; tripod, hands, and camera assembly read coherently. The dark left text-safe region is preserved.
- Scope: static CSS and asset correction only. No copy, i18n, component markup, section order, Hero, Part E content, Why content, simulator, optics, renderer, RTT, routes, or motion changed.
- Browser evidence: direct Chromium inspection at 1440×900, 1288×904, 1024×800, 768×900, 390×844 English, and 390×844 zh-HK. Eyebrows measured 13.76px desktop / 12.48px mobile, remained centered and readable, CTA copy remained legible, camera orientation was clear, and horizontal overflow was zero. A full-page 1440 review confirmed the complete static rhythm.
- Validation: focused Home/i18n integration tests passed (10 tests); focused Home/marketing Chromium E2E passed (11/11); `npm run ci:local` passed CSS structure, lint, typecheck, all Vitest (164 files, 1,596 tests), and production build; `git diff --check` passed.
- Deferred: PR 11E — Motion + Accessibility Polish.
