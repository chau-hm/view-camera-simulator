# Interior Corner 12B — Rise Composition

- Objective: establish a free-mode composition slice where Front Rise improves the upper architectural framing while the camera remains level.
- Branch / worktree / base / head: `feature/interior-rise-composition` / `/Users/homan/repo/view-camera-interior-corner-12b` / `origin/main` `76010a2d96b11234a9044599ee0f94c83e80aa98` / current review-fix commit (SHA in final handoff).
- PR12A contracts preserved: 150 mm lens, 8000 mm focus, f/5.6, zero neutral movements, room geometry, one-wall near/mid/far anchors, widened Focus range, free-only scene identity, catalog/route/localization, RTT subject, and artwork.
- Composition problem: neutral Rise 0 leaves the canonical upper-architecture landmark outside the Ground Glass frame while the room-corner anchor remains usable; the existing camera is level.
- Composition evaluator contract: project the canonical upper landmark and room-corner bounds center through the existing Ground Glass film-plane projection; both must lie in normalized safe frame `u/v = 0.1–0.9`.
- Neutral evidence: upper landmark `visible=false`, `vRaw≈1.2248`; room corner remains inside the safe zone at `vRaw≈0.6997`.
- Public-step successful Rise evidence: existing public range `0–40 mm`, step `1 mm`; first passing state is `33 mm`, while the adjacent insufficient state `32 mm` fails. At 33 mm both projected anchors are inside the safe zone.
- Perspective/orientation invariants: pure Rise leaves lens/rear-frame orientation and optical-axis direction unchanged; the evaluator observes only the projected framing change. The passing state is proven with `frontSwingDeg=0`.
- Files / surfaces changed: scene-local evaluator; workspace-to-feedback wiring; free-mode English and zh-HK Rise copy; focused unit/integration tests; focused Playwright browser test.
- Validation run: prior foundation checks remain green; this review fix passed the focused 2-file/23-test run, `npm run typecheck`, `npm run lint`, focused Playwright test, and `git diff --check`.
- Validation not run: full renderer-wide E2E / `npm run ci:local:e2e`; no RTT, renderer, or lifecycle code changed and the focused browser test covers the public route and Ground Glass readiness.
- Since review: corrected the recorded branch name to `feature/interior-rise-composition`; softened successful Rise feedback to describe the observed projected composition without over-claiming Rise as the sole cause when other free-mode controls are available; no evaluator, geometry, optics, RTT, routing, or scene-state behavior changed.
- Known limitations: this is free-mode Rise feedback only; no composition overlay, guided task, compound success, Swing calibration, sharpness scoring, or aperture stage is included.
- Reviewer focus: projected neutral failure and public-grid success; level/orientation invariants; reset behavior; free-only route behavior; localized feedback; and unchanged PR12A scene/RTT contracts.
- Deferred: PR12C — Swing + Focus Calibration; PR12D — Guided Lesson + Final Integration.
