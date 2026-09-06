# PR 11C — Why It Matters

- Objective: replace the temporary Home informational block with the static Why It Matters section after Part E.
- Base/update: latest `origin/main` `766332e95ca42066f2f05e6f2f93d234ba45a79e`, containing PR 11B `739b744a880826b3c34200645bac90f988a9436e`.
- Branch/worktree: `feature/landing-redesign-why-it-matters` / `/Users/homan/repo/view-camera-landing-why-it-matters`.
- Landing flow: `LandingHero` → `LandingFundamentalsSection` → `LandingVisualizationSection` → `LandingWhyItMattersSection`; no Final CTA or Scene Gallery.
- Legacy replacement: Home no longer renders `DesktopExperienceNotice`, `InfoCard`, `.landing-home__legacy`, or `.landing-info-section`; `DesktopExperienceNotice` remains on `/scenes`.
- Components: added `LandingWhyItMattersSection` and local `LandingWhyCard`; Part E, Hero, navigation, simulator, and shared catalog components remain unchanged.
- ImageGen assets: independently generated and inspected photorealistic 4:3 WebP photos — `why-control-before-shot.webp` (1448×1086, 140,628 bytes), `why-camera-movements.webp` (1448×1086, 118,206 bytes), and `why-large-format-learning.webp` (1448×1086, 157,300 bytes).
- i18n: replaced temporary `home.why`/`home.info` Home shape with `home.why.eyebrow`, two-line `home.why.title`, and three `home.why.items.*.title/description` keys in English and zh-HK; locale resolution is unchanged.
- Responsive/accessibility: Why cards use a 3-column desktop grid, 2 columns at ≤880px, and one column at ≤767px; images reserve 4:3 space, lazy-load, and use empty alt text beside HTML headings/body. Exactly one page H1 remains.
- Browser evidence: direct Chromium inspection at 1440×900, 1024×800, 768×900, 390×844 English, and 390×844 zh-HK; Why grid was 3/3/2/1/1 columns with zero horizontal overflow, readable crops/copy, and the intended dark editorial transition.
- Validation: focused integrations passed (Home, i18n, marketing warning); focused Home/marketing Chromium E2E passed (11/11); `npm run ci:local` passed CSS structure, lint, typecheck, all Vitest (164 files, 1,595 tests), and production build; `git diff --check` passed.
- Deferred: PR 11D Final CTA; PR 11E motion and accessibility polish.
