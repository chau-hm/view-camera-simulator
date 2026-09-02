# Legacy Ground Glass cleanup

- Branch: `chore/remove-legacy-ground-glass-scene`
- Baseline: `origin/main` `9fb0bb5d947f1b31a045e5c4a36edd6de1736409` (PR #117 merged).
- Objective: delete the dead legacy Ground Glass implementation and remove only its obsolete test coverage and historical test-ID assertions.
- Decisions: canonical RTT routing, scene-subject registration, public-scene invariants, optics, camera anatomy, and Ground Glass behavior are unchanged. Remaining presentation tests cover current components and positive RTT contracts.
- Validation: focused Ground Glass/registry/public-scene tests (62 passed), full CI (154 files / 1,492 tests and build), standalone typecheck/lint, diff check, repository searches (both obsolete identifiers absent), and Lesson 0/Table Tilt Playwright smoke (2 passed).
