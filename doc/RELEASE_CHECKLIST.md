# MVP Release Checklist

This checklist defines the criteria and verification steps required before releasing the View Camera Simulator MVP.

---

## 1. Scope & Core Requirements Check (Zero Creep)

- [ ] Verify that no rear-standard movements (rear rise, tilt, swing, shift) are implemented.
- [ ] Verify that no front-fall or front-shift movements are implemented.
- [ ] Verify that no user accounts, multiplayer, or cloud persistence are included.
- [ ] Verify that no photorealistic or ray-traced optical rendering is implemented.
- [ ] Treat simulation state as the single source of truth; verify all viewports (2D geometry, 3D scene, ground-glass) synchronize automatically.

## 2. Guided Tasks Verification (Three Mission-Critical Scenarios)

Ensure a new user can complete all three guided levels in the simulator:

- [ ] **Architecture Rise Task (`task-rise-basics`)**:
  - [ ] Can complete using sliders or keyboard input (Arrow keys, Home, End).
  - [ ] Displays final score and explanation upon successful completion.
  - [ ] Cannot complete if the primary subject/head is not fully visible on the ground glass.
- [ ] **Table Tilt Task (`task-tilt-basics`)**:
  - [ ] Can complete using a combination of Tilt, Focus, and Aperture adjustment.
  - [ ] Verified that using a wide-open aperture (e.g. f/5.6) or f/32 alone does not pass.
  - [ ] Verified that correct tilt and focus adjustments to bring foreground/mid/background into focus passes.
- [ ] **Shelf Swing Task (`task-swing-basics`)**:
  - [ ] Can complete by adjusting Swing and Focus to align focus plane diagonally across the shelf.
  - [ ] Verified that incorrect direction of swing does not pass.

## 3. Automated Test Verification

- [ ] **Unit Tests**:
  - [ ] All geometry, optics, Zustand store, and utility tests pass (`npm run test`).
  - [ ] No regression or broken math formulas in Core Optics calculations.
- [ ] **Integration Tests**:
  - [ ] All UI view and control integration tests pass.
- [ ] **End-to-End Tests**:
  - [ ] Smoke tests and Playwright E2E tests pass (`npm run test:e2e`).
- [ ] **Type Check**:
  - [ ] No TypeScript compiler errors are present (`npm run typecheck`).
- [ ] **Code Linting**:
  - [ ] Zero lint warnings/errors in ESLint and Prettier (`npm run lint`).

## 4. Performance & Telemetry Validation

- [ ] **Movement Input Latency**:
  - [ ] Slider input to primary visual viewport update is below **100ms** on target devices.
  - [ ] Verified using the live Performance Telemetry panel in the workspace.
- [ ] **Ground Glass Frame Rate**:
  - [ ] Ground Glass viewport rendering runs at **>= 30 FPS** on standard desktop setups.
  - [ ] Verified under different Render Quality profiles (`low`, `standard`, `high`).
- [ ] **Scene Switch Duration**:
  - [ ] Switching between tasks/scenes takes less than **2.0 seconds**.

## 5. Visual & Interaction Quality Checklist

- [ ] **No Console Errors**:
  - [ ] Open browser DevTools; verify zero unhandled exceptions, console errors, or failed network assets during a full practice session.
- [ ] **Accessibility (A11Y)**:
  - [ ] All sliders, dropdowns, and buttons have explicit, screen-reader-accessible ARIA labels.
  - [ ] Focus sharpness/status on the ground glass uses shape pattern glyphs (■, ▒, ✕) as well as text status, not rely solely on colors.
- [ ] **Responsive Design & Reset Controls**:
  - [ ] "Reset movements" button successfully clears all front standard adjustments.
  - [ ] "Restart task" button successfully restores the initial task/scene baseline.

---

## Known P1 / P2 Limitations & Future Optimizations

- **PERF-003**: Low-performance mode resolves frame lag by scaling down the Ground Glass resolution target (Scale: 0.65x).
- **PERF-004**: Depth-of-Field blur samples are scaled down to 0.25x in Low-performance mode to preserve FPS on low-end devices.
- **A11Y-003**: Keyboard navigation is optimized with shift-keys for range inputs; focus outlines are present but can be styled with higher contrast in future iterations.
