# PR Review Checklist

## Repository state

- correct base and head
- not unexpectedly behind base
- focused commit history
- no unrelated generated or ignored files
- no unresolved high-priority review threads
- CI result matches the current head SHA

## Optics and geometry

- sign convention unchanged or intentionally documented
- raw calibration preserved
- public control solution is reachable
- 2D, 3D, Ground Glass, and task evaluation agree
- no scene-specific workaround in generic optics
- nearby values remain finite

## Renderer

- intended RTT path is exclusive
- no legacy visual fallback hides defects
- one scene canvas and one Ground Glass renderer
- meaningful resource ownership and disposal
- SPA lifecycle test does not reload the page
- diagnostics observe internal lifecycle, not only props
- warnings are narrowly filtered

## UI, routes, and tasks

- public catalog is internally consistent
- route/task pairing is strict
- invalid route cannot initialize mismatched task state
- keyboard interaction uses public step values
- restart restores declared state
- dialog/menu focus behavior is complete
- 1024px layout is usable

## Test integrity

- focused unit and integration tests exist
- E2E follows public navigation
- WebGL-independent and dependent assertions are separated
- direct DOM injection is not used to prove user completion
- screenshots supplement semantic evidence
- timeouts are justified
- tests would fail for the original defect

## Final checks

```bash
npm test
npm run typecheck
npm run lint
npm run check:css
npm run build
git diff --check
git status --short
```

Run affected E2E specs and full E2E at the merge gate when renderer-wide risk exists.
